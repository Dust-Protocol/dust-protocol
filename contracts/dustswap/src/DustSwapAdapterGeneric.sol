// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
// Poseidon libraries removed — Flow EVM's 24KB code size limit prevents deployment.
// Output commitment is computed off-chain by the relayer and passed as a parameter.
// Safety: relayer is already trusted (whitelisted), and user verifies deposit correctness client-side.

// ─── Minimal Interfaces ─────────────────────────────────────────────────────

interface IAggregatorV3 {
    function latestRoundData()
        external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
    function decimals() external view returns (uint8);
}

interface IERC20Adapter {
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IDustPoolV2 {
    function withdraw(
        bytes calldata proof,
        bytes32 merkleRoot,
        bytes32 nullifier0,
        bytes32 nullifier1,
        bytes32 outCommitment0,
        bytes32 outCommitment1,
        uint256 publicAmount,
        uint256 publicAsset,
        address recipient,
        address tokenAddress
    ) external;

    function deposit(bytes32 commitment) external payable;
    function depositERC20(bytes32 commitment, address token, uint256 amount) external;
    function paused() external view returns (bool);
}

// ─── Contract ────────────────────────────────────────────────────────────────

/// @title DustSwapAdapterGeneric — Atomic withdraw-swap-deposit adapter for DustPoolV2 + any whitelisted DEX router
/// @notice Withdraws from DustPoolV2 (ZK proof), swaps via a whitelisted router using arbitrary calldata,
///         then deposits the output back into DustPoolV2 as a new UTXO commitment.
///         The swap output never touches a user wallet — it flows adapter → pool atomically.
/// @dev Router-agnostic: works with any DEX (Uniswap, SushiSwap, Increment, etc.) via whitelisted routers.
///      Adapter must be whitelisted as a relayer on DustPoolV2.
contract DustSwapAdapterGeneric is Ownable2Step, ReentrancyGuard {

    // ─── Constants ───────────────────────────────────────────────────────────

    /// @dev 5% max relayer fee (500 basis points)
    uint256 public constant MAX_RELAYER_FEE_BPS = 500;

    /// @dev Chainlink oracle price staleness threshold (1 hour)
    uint256 private constant ORACLE_STALE_THRESHOLD = 3600;

    // ─── Immutables ──────────────────────────────────────────────────────────

    IDustPoolV2 public immutable DUST_POOL_V2;

    // ─── State ───────────────────────────────────────────────────────────────

    mapping(address => bool) public authorizedRelayers;
    mapping(address => bool) public allowedRouters;

    /// @notice Chainlink ETH/USD price feed (address(0) = disabled)
    IAggregatorV3 public priceOracle;

    /// @notice Maximum allowed deviation from oracle price in basis points (default: 1000 = 10%)
    uint256 public maxOracleDeviationBps = 1000;

    // ─── Events ──────────────────────────────────────────────────────────────

    event PrivateSwapExecuted(
        bytes32 indexed nullifier,
        bytes32 indexed outputCommitment,
        address tokenIn,
        address tokenOut,
        uint256 outputAmount,
        uint256 relayerFeeBps
    );

    event RelayerUpdated(address indexed relayer, bool allowed);
    event RouterUpdated(address indexed router, bool allowed);
    event OracleUpdated(address indexed oracle);
    event MaxDeviationUpdated(uint256 bps);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotRelayer();
    error NotAllowedRouter();
    error RouterIsSelf();
    error RouterIsPool();
    error SlippageExceeded();
    error RelayerFeeTooHigh();
    error ZeroMinAmount();
    error SwapFailed();
    error TransferFailed();
    error PoolPaused();
    error ZeroAddress();
    error OracleDeviationExceeded(uint256 oraclePrice, uint256 executionPrice);
    error OracleStale(uint256 updatedAt);
    error DeviationBpsTooHigh();

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyRelayer() {
        if (!authorizedRelayers[msg.sender]) revert NotRelayer();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    /// @notice Deploy the generic swap adapter
    /// @param dustPoolV2_ DustPoolV2 privacy pool address
    constructor(address dustPoolV2_) Ownable(msg.sender) {
        if (dustPoolV2_ == address(0)) revert ZeroAddress();
        DUST_POOL_V2 = IDustPoolV2(dustPoolV2_);
    }

    // ─── External: Atomic Private Swap ───────────────────────────────────────

    /// @notice Atomically withdraw from DustPoolV2, swap via whitelisted router, and deposit output as new UTXO
    /// @param proof FFLONK proof bytes (768 bytes) for DustPoolV2 withdraw
    /// @param merkleRoot Merkle root the proof was generated against
    /// @param nullifier0 First input UTXO nullifier
    /// @param nullifier1 Second input UTXO nullifier (bytes32(0) for single-input)
    /// @param outCommitment0 First change UTXO commitment (from the withdraw proof)
    /// @param outCommitment1 Second change UTXO commitment (from the withdraw proof)
    /// @param publicAmount Net public amount field element for the withdraw proof
    /// @param publicAsset Poseidon(chainId, tokenIn) — must match withdraw circuit signal
    /// @param tokenIn Input token address (address(0) = ETH)
    /// @param router Whitelisted DEX router to execute the swap through
    /// @param swapCalldata ABI-encoded call to the router's swap function
    /// @param minAmountOut Minimum output after relayer fee (slippage protection)
    /// @param outputCommitment Pre-computed Poseidon commitment for the output UTXO (relayer-computed)
    /// @param tokenOut Output token address (address(0) = ETH)
    /// @param relayer Address to receive the relayer fee
    /// @param relayerFeeBps Relayer fee in basis points (max 500 = 5%)
    function executeSwap(
        bytes calldata proof,
        bytes32 merkleRoot,
        bytes32 nullifier0,
        bytes32 nullifier1,
        bytes32 outCommitment0,
        bytes32 outCommitment1,
        uint256 publicAmount,
        uint256 publicAsset,
        address tokenIn,
        address router,
        bytes calldata swapCalldata,
        uint256 minAmountOut,
        bytes32 outputCommitment,
        address tokenOut,
        address relayer,
        uint256 relayerFeeBps
    ) external nonReentrant onlyRelayer {
        // ── Checks ──────────────────────────────────────────────────────────
        if (minAmountOut == 0) revert ZeroMinAmount();
        if (relayerFeeBps > MAX_RELAYER_FEE_BPS) revert RelayerFeeTooHigh();
        if (DUST_POOL_V2.paused()) revert PoolPaused();
        if (!allowedRouters[router]) revert NotAllowedRouter();
        if (router == address(DUST_POOL_V2)) revert RouterIsPool();
        if (router == address(this)) revert RouterIsSelf();

        // ── Withdraw from DustPoolV2 ────────────────────────────────────────
        uint256 balanceBefore = _tokenBalance(tokenIn);

        DUST_POOL_V2.withdraw(
            proof, merkleRoot, nullifier0, nullifier1,
            outCommitment0, outCommitment1,
            publicAmount, publicAsset,
            address(this), tokenIn
        );

        uint256 inputAmount = _tokenBalance(tokenIn) - balanceBefore;
        if (inputAmount == 0) revert SwapFailed();

        // ── Execute swap via whitelisted router ───────────────────────────
        uint256 outputBalanceBefore = _tokenBalance(tokenOut);

        if (tokenIn != address(0)) {
            IERC20Adapter(tokenIn).approve(router, inputAmount);
        }

        (bool swapOk,) = router.call{value: tokenIn == address(0) ? inputAmount : 0}(swapCalldata);
        if (!swapOk) revert SwapFailed();

        if (tokenIn != address(0)) {
            IERC20Adapter(tokenIn).approve(router, 0);
        }

        uint256 outputAmount = _tokenBalance(tokenOut) - outputBalanceBefore;
        if (outputAmount == 0) revert SwapFailed();

        // ── Fee split ───────────────────────────────────────────────────────
        // Fee is computed on the FULL output. The user receives exactly minAmountOut
        // (which matches the pre-computed commitment). Any positive slippage surplus
        // stays in the adapter (recoverable via emergencyWithdraw).
        uint256 fee = (outputAmount * relayerFeeBps) / 10_000;
        uint256 userAmount = outputAmount - fee;
        if (userAmount < minAmountOut) revert SlippageExceeded();

        // Deposit exactly minAmountOut to match the relayer-computed commitment.
        // Depositing userAmount when userAmount > minAmountOut would create a
        // commitment-amount mismatch, permanently locking the excess.
        uint256 depositAmount = minAmountOut;

        // ── Oracle price bound check (anti-sandwich) ────────────────────────
        _checkOracleBound(inputAmount, outputAmount, tokenIn, tokenOut);

        // ── Deposit output to DustPoolV2 using relayer-computed commitment ──
        if (tokenOut == address(0)) {
            DUST_POOL_V2.deposit{value: depositAmount}(outputCommitment);
        } else {
            IERC20Adapter(tokenOut).approve(address(DUST_POOL_V2), depositAmount);
            DUST_POOL_V2.depositERC20(outputCommitment, tokenOut, depositAmount);
        }

        // ── Pay relayer fee ─────────────────────────────────────────────────
        if (fee > 0) {
            if (tokenOut == address(0)) {
                (bool ok,) = relayer.call{value: fee}("");
                if (!ok) revert TransferFailed();
            } else {
                bool ok = IERC20Adapter(tokenOut).transfer(relayer, fee);
                if (!ok) revert TransferFailed();
            }
        }

        emit PrivateSwapExecuted(
            nullifier0, outputCommitment, tokenIn, tokenOut, depositAmount, relayerFeeBps
        );
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    /// @notice Authorize or deauthorize a relayer address
    /// @param relayer_ Address to update
    /// @param allowed Whether to allow or disallow
    function setRelayer(address relayer_, bool allowed) external onlyOwner {
        authorizedRelayers[relayer_] = allowed;
        emit RelayerUpdated(relayer_, allowed);
    }

    /// @notice Authorize or deauthorize a DEX router for swaps
    /// @param router_ Router address to update
    /// @param allowed Whether to allow or disallow
    function setRouter(address router_, bool allowed) external onlyOwner {
        allowedRouters[router_] = allowed;
        emit RouterUpdated(router_, allowed);
    }

    /// @notice Set the Chainlink price oracle. address(0) disables oracle checks.
    /// @param oracle_ Chainlink AggregatorV3Interface address
    function setPriceOracle(address oracle_) external onlyOwner {
        priceOracle = IAggregatorV3(oracle_);
        emit OracleUpdated(oracle_);
    }

    /// @notice Set maximum allowed deviation from oracle price
    /// @param bps Deviation in basis points (e.g. 1000 = 10%). Max 5000 (50%).
    function setMaxOracleDeviation(uint256 bps) external onlyOwner {
        if (bps > 5000) revert DeviationBpsTooHigh();
        maxOracleDeviationBps = bps;
        emit MaxDeviationUpdated(bps);
    }

    /// @notice Emergency withdraw all ETH held by this contract
    function emergencyWithdrawETH() external onlyOwner {
        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool ok,) = owner().call{value: bal}("");
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice Emergency withdraw all of a specific ERC20 held by this contract
    /// @param token ERC20 token address
    function emergencyWithdrawERC20(address token) external onlyOwner {
        uint256 bal = IERC20Adapter(token).balanceOf(address(this));
        if (bal > 0) {
            bool ok = IERC20Adapter(token).transfer(owner(), bal);
            if (!ok) revert TransferFailed();
        }
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    /// @dev Check that swap execution price is within oracle bounds.
    ///      Only applies when oracle is set (non-zero) and swap involves ETH↔ERC20.
    ///      Oracle returns ETH/USD price with 8 decimals.
    function _checkOracleBound(
        uint256 inputAmount,
        uint256 outputAmount,
        address tokenIn,
        address tokenOut
    ) internal view {
        if (address(priceOracle) == address(0)) return;

        bool ethIn = tokenIn == address(0);
        bool ethOut = tokenOut == address(0);
        if (!ethIn && !ethOut) return;

        (, int256 answer,, uint256 updatedAt,) = priceOracle.latestRoundData();
        if (block.timestamp - updatedAt > ORACLE_STALE_THRESHOLD) revert OracleStale(updatedAt);
        if (answer <= 0) return;

        uint8 oracleDecimals = priceOracle.decimals();

        uint256 oraclePriceX18 = uint256(answer) * (10 ** (18 - oracleDecimals));

        uint256 executionPriceX18;
        if (ethIn) {
            executionPriceX18 = (outputAmount * 1e12 * 1e18) / inputAmount;
        } else {
            executionPriceX18 = (inputAmount * 1e12 * 1e18) / outputAmount;
        }

        uint256 deviation;
        if (executionPriceX18 < oraclePriceX18) {
            deviation = ((oraclePriceX18 - executionPriceX18) * 10_000) / oraclePriceX18;
        } else {
            deviation = ((executionPriceX18 - oraclePriceX18) * 10_000) / oraclePriceX18;
        }

        if (deviation > maxOracleDeviationBps) {
            revert OracleDeviationExceeded(oraclePriceX18, executionPriceX18);
        }
    }

    /// @dev Get token balance of this contract
    function _tokenBalance(address token) internal view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        }
        return IERC20Adapter(token).balanceOf(address(this));
    }

    // ─── Receive ETH ─────────────────────────────────────────────────────────

    /// @notice Accept ETH from DustPoolV2 withdraw and router swaps
    receive() external payable {}
}
