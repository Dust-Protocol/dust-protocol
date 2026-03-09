// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IFFLONKVerifier} from "./IFFLONKVerifier.sol";
import {IFFLONKSplitVerifier} from "./IFFLONKSplitVerifier.sol";
import {IFFLONKComplianceVerifier} from "./IFFLONKComplianceVerifier.sol";
import {IComplianceOracle} from "./IComplianceOracle.sol";

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/// @dev SafeERC20-style transfer using low-level call (handles non-standard tokens like USDT)
library SafeTransfer {
    error ERC20TransferFailed();

    function safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert ERC20TransferFailed();
        }
    }

    function safeTransferFrom(address token, address from, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, amount)
        );
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert ERC20TransferFailed();
        }
    }
}

/// @title DustPoolV2 — ZK-UTXO privacy pool with FFLONK proofs
/// @notice 2-in-2-out and 2-in-8-out UTXO model with off-chain Merkle tree. Supports native + ERC20 tokens.
///         Relayers maintain the Merkle tree and post roots on-chain.
contract DustPoolV2 {
    using SafeTransfer for address;
    // BN254 scalar field size
    uint256 public constant FIELD_SIZE =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 public constant ROOT_HISTORY_SIZE = 100;
    /// @dev Max deposit per tx: 2^64 - 1 (matches circuit range proof width)
    uint256 public constant MAX_DEPOSIT_AMOUNT = (1 << 64) - 1;
    uint256 public constant MAX_BATCH_SIZE = 8;
    /// @dev Post-deposit standby — depositor can only withdraw to self during cooldown
    uint256 public constant COOLDOWN_PERIOD = 1 hours;

    IFFLONKVerifier public immutable VERIFIER;
    IFFLONKSplitVerifier public immutable SPLIT_VERIFIER;
    address public owner;
    address public pendingOwner;
    bool public paused;

    /// @notice Compliance oracle (address(0) = disabled, no screening)
    IComplianceOracle public complianceOracle;

    /// @notice ZK exclusion-proof verifier (address(0) = disabled, no compliance proof required)
    IFFLONKComplianceVerifier public complianceVerifier;

    /// @notice Exclusion SMT root history — circular buffer of flagged commitment tree roots
    mapping(uint256 => bytes32) public exclusionRoots;
    uint256 public currentExclusionRootIndex;

    /// @notice Pre-verified compliance proofs per nullifier (set by verifyComplianceProof, consumed by withdraw)
    mapping(bytes32 => bool) public complianceVerified;

    /// @notice Tracks when each commitment was deposited (for cooldown enforcement)
    mapping(bytes32 => uint256) public depositTimestamp;

    /// @notice Tracks who deposited each commitment (for cooldown-period withdraw restriction)
    mapping(bytes32 => address) public depositOriginator;

    // Root history — circular buffer
    mapping(uint256 => bytes32) public roots;
    uint256 public currentRootIndex;

    // Nullifier tracking — prevents double-spend
    mapping(bytes32 => bool) public nullifiers;

    // Deposit queue — relayer batches these into the off-chain Merkle tree
    mapping(uint256 => bytes32) public depositQueue;
    uint256 public depositQueueTail;

    // Duplicate commitment protection — each commitment can only be deposited once
    mapping(bytes32 => bool) public commitmentUsed;

    // Pool solvency tracking — total deposits per asset, prevents draining beyond deposits
    mapping(address => uint256) public totalDeposited;

    // Relayer whitelist
    mapping(address => bool) public relayers;

    // Token whitelist — when enabled, only allowedAssets can be deposited
    mapping(address => bool) public allowedAssets;
    bool public whitelistEnabled;

    // Reentrancy guard (no OZ available)
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status = _NOT_ENTERED;

    event DepositQueued(
        bytes32 indexed commitment,
        uint256 queueIndex,
        uint256 amount,
        address asset,
        uint256 timestamp
    );
    event Withdrawal(
        bytes32 indexed nullifier,
        address indexed recipient,
        uint256 amount,
        address asset
    );
    event RootUpdated(bytes32 newRoot, uint256 index, address relayer);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event RelayerUpdated(address indexed relayer, bool allowed);
    event Paused(address account);
    event Unpaused(address account);
    event ComplianceOracleUpdated(address indexed oracle);
    event ComplianceVerifierUpdated(address indexed verifier);
    event ExclusionRootUpdated(bytes32 newRoot, uint256 index, address relayer);
    event DepositScreened(address indexed depositor, bool passed);
    event ComplianceProofVerified(bytes32 indexed nullifier, bytes32 exclusionRoot);
    event WhitelistUpdated(bool enabled);
    event AssetAllowed(address indexed asset, bool allowed);

    error ZeroCommitment();
    error ZeroValue();
    error UnknownRoot();
    error NullifierAlreadySpent();
    error InvalidProof();
    error InvalidProofLength();
    error InvalidFieldElement();
    error TransferFailed();
    error ZeroRecipient();
    error DuplicateCommitment();
    error DepositTooLarge();
    error InsufficientPoolBalance();
    error NotRelayer();
    error NotOwner();
    error NotPendingOwner();
    error ReentrantCall();
    error ContractPaused();
    error BatchTooLarge();
    error EmptyBatch();
    error DepositBlocked();
    error CooldownActive();
    error InvalidComplianceProof();
    error UnknownExclusionRoot();
    error ComplianceRequired();
    error ComplianceNotEnabled();
    error ZeroNullifier();
    error ZeroExclusionRoot();
    error ZeroAddress();
    error AssetNotAllowed(address asset);

    modifier onlyRelayer() {
        if (!relayers[msg.sender]) revert NotRelayer();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_status == _ENTERED) revert ReentrantCall();
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    constructor(address _verifier, address _splitVerifier, address _complianceOracle) {
        if (_verifier == address(0)) revert ZeroAddress();
        if (_splitVerifier == address(0)) revert ZeroAddress();
        VERIFIER = IFFLONKVerifier(_verifier);
        SPLIT_VERIFIER = IFFLONKSplitVerifier(_splitVerifier);
        // complianceOracle can be address(0) — disables screening
        complianceOracle = IComplianceOracle(_complianceOracle);
        owner = msg.sender;
        // ETH is always allowed even when whitelist is enabled
        allowedAssets[address(0)] = true;
    }

    /// @notice Deposit native tokens into the pool
    /// @param commitment Poseidon commitment for the UTXO
    function deposit(bytes32 commitment) external payable whenNotPaused {
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (msg.value == 0) revert ZeroValue();
        if (msg.value > MAX_DEPOSIT_AMOUNT) revert DepositTooLarge();
        if (commitmentUsed[commitment]) revert DuplicateCommitment();
        _screenDepositor(msg.sender);

        commitmentUsed[commitment] = true;
        totalDeposited[address(0)] += msg.value;
        depositTimestamp[commitment] = block.timestamp;
        depositOriginator[commitment] = msg.sender;

        uint256 index = depositQueueTail;
        depositQueue[index] = commitment;
        depositQueueTail = index + 1;

        emit DepositQueued(commitment, index, msg.value, address(0), block.timestamp);
    }

    /// @notice Deposit ERC20 tokens into the pool
    /// @param commitment Poseidon commitment for the UTXO
    /// @param token ERC20 token address
    /// @param amount Token amount to deposit
    function depositERC20(bytes32 commitment, address token, uint256 amount) external nonReentrant whenNotPaused {
        if (commitment == bytes32(0)) revert ZeroCommitment();
        if (amount == 0) revert ZeroValue();
        if (amount > MAX_DEPOSIT_AMOUNT) revert DepositTooLarge();
        if (commitmentUsed[commitment]) revert DuplicateCommitment();
        if (whitelistEnabled && !allowedAssets[token]) revert AssetNotAllowed(token);
        _screenDepositor(msg.sender);

        // Effects before interactions (CEI pattern)
        commitmentUsed[commitment] = true;
        totalDeposited[token] += amount;
        depositTimestamp[commitment] = block.timestamp;
        depositOriginator[commitment] = msg.sender;

        uint256 index = depositQueueTail;
        depositQueue[index] = commitment;
        depositQueueTail = index + 1;

        // Interaction — external call last
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit DepositQueued(commitment, index, amount, token, block.timestamp);
    }

    /// @notice Batch-deposit native tokens into the pool, creating multiple UTXOs in one tx
    /// @param commitments Array of Poseidon commitments (max 8)
    function batchDeposit(bytes32[] calldata commitments) external payable whenNotPaused {
        uint256 len = commitments.length;
        if (len == 0) revert EmptyBatch();
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge();
        if (msg.value == 0) revert ZeroValue();
        if (msg.value > MAX_DEPOSIT_AMOUNT) revert DepositTooLarge();
        _screenDepositor(msg.sender);

        uint256 amountPerCommitment = msg.value / len;
        totalDeposited[address(0)] += msg.value;

        for (uint256 i = 0; i < len; i++) {
            bytes32 c = commitments[i];
            if (c == bytes32(0)) revert ZeroCommitment();
            if (commitmentUsed[c]) revert DuplicateCommitment();

            commitmentUsed[c] = true;
            depositTimestamp[c] = block.timestamp;
            depositOriginator[c] = msg.sender;

            uint256 idx = depositQueueTail;
            depositQueue[idx] = c;
            depositQueueTail = idx + 1;

            emit DepositQueued(c, idx, amountPerCommitment, address(0), block.timestamp);
        }
    }

    /// @notice Withdraw funds by proving UTXO ownership with an FFLONK proof
    /// @param proof FFLONK proof (24 * 32 = 768 bytes)
    /// @param merkleRoot Merkle root the proof was generated against
    /// @param nullifier0 First input UTXO nullifier
    /// @param nullifier1 Second input UTXO nullifier (bytes32(0) for single-input)
    /// @param outCommitment0 First output UTXO commitment
    /// @param outCommitment1 Second output UTXO commitment
    /// @param publicAmount Net public amount (field element; > FIELD_SIZE/2 encodes withdrawal)
    /// @param publicAsset Poseidon(chainId, tokenAddress) — must match circuit public signal
    /// @param recipient Address to receive withdrawn funds
    /// @param tokenAddress Actual token address for transfer (address(0) = native ETH)
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
    ) external onlyRelayer nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroRecipient();
        if (!isKnownRoot(merkleRoot)) revert UnknownRoot();

        // All public signals must be valid BN254 field elements to prevent
        // double-spend via field overflow (V and V+FIELD_SIZE are equivalent in proofs)
        if (uint256(merkleRoot) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(nullifier0) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(nullifier1) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(outCommitment0) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(outCommitment1) >= FIELD_SIZE) revert InvalidFieldElement();
        if (publicAmount >= FIELD_SIZE) revert InvalidFieldElement();
        if (publicAsset >= FIELD_SIZE) revert InvalidFieldElement();

        if (nullifiers[nullifier0]) revert NullifierAlreadySpent();
        if (nullifier1 != bytes32(0) && nullifiers[nullifier1]) {
            revert NullifierAlreadySpent();
        }
        if (proof.length != 768) revert InvalidProofLength();

        // Public signals match circuit order:
        // [merkleRoot, nullifier0, nullifier1, outCommitment0, outCommitment1, publicAmount, publicAsset, recipient, chainId]
        uint256[9] memory pubSignals;
        pubSignals[0] = uint256(merkleRoot);
        pubSignals[1] = uint256(nullifier0);
        pubSignals[2] = uint256(nullifier1);
        pubSignals[3] = uint256(outCommitment0);
        pubSignals[4] = uint256(outCommitment1);
        pubSignals[5] = publicAmount;
        pubSignals[6] = publicAsset;
        pubSignals[7] = uint256(uint160(recipient));
        pubSignals[8] = block.chainid;

        bytes32[24] memory proofData;
        for (uint256 i = 0; i < 24; i++) {
            proofData[i] = bytes32(proof[i * 32:(i + 1) * 32]);
        }

        if (!VERIFIER.verifyProof(proofData, pubSignals)) revert InvalidProof();

        // Exclusion compliance gate: each non-zero nullifier must be pre-verified if compliance is enabled
        _checkComplianceGate(nullifier0, nullifier1);

        // Effects — mark nullifiers spent (skip zero slot used by dummy inputs)
        if (nullifier0 != bytes32(0)) {
            nullifiers[nullifier0] = true;
        }
        if (nullifier1 != bytes32(0)) {
            nullifiers[nullifier1] = true;
        }

        // Queue output commitments + emit events so chain-watcher can discover them
        if (outCommitment0 != bytes32(0)) {
            uint256 idx = depositQueueTail;
            depositQueue[idx] = outCommitment0;
            depositQueueTail = idx + 1;
            emit DepositQueued(outCommitment0, idx, 0, tokenAddress, block.timestamp);
        }
        if (outCommitment1 != bytes32(0)) {
            uint256 idx = depositQueueTail;
            depositQueue[idx] = outCommitment1;
            depositQueueTail = idx + 1;
            emit DepositQueued(outCommitment1, idx, 0, tokenAddress, block.timestamp);
        }

        // Interactions — transfer if publicAmount encodes a withdrawal
        // Values > FIELD_SIZE/2 represent negative field elements (net outflow)
        if (publicAmount != 0 && publicAmount > FIELD_SIZE / 2) {
            uint256 withdrawAmount = FIELD_SIZE - publicAmount;

            // Solvency check: pool cannot pay out more than was deposited per asset
            if (totalDeposited[tokenAddress] < withdrawAmount) revert InsufficientPoolBalance();
            totalDeposited[tokenAddress] -= withdrawAmount;

            if (tokenAddress == address(0)) {
                (bool ok,) = recipient.call{value: withdrawAmount}("");
                if (!ok) revert TransferFailed();
            } else {
                tokenAddress.safeTransfer(recipient, withdrawAmount);
            }

            emit Withdrawal(nullifier0, recipient, withdrawAmount, tokenAddress);
        }
    }

    /// @notice Withdraw with denomination split — proves 2-in-8-out UTXO ownership via FFLONK proof
    /// @param proof FFLONK proof (24 * 32 = 768 bytes)
    /// @param merkleRoot Merkle root the proof was generated against
    /// @param nullifier0 First input UTXO nullifier
    /// @param nullifier1 Second input UTXO nullifier (bytes32(0) for single-input)
    /// @param outCommitments 8 output UTXO commitments (bytes32(0) for unused slots)
    /// @param publicAmount Net public amount (field element; > FIELD_SIZE/2 encodes withdrawal)
    /// @param publicAsset Poseidon(chainId, tokenAddress) — must match circuit public signal
    /// @param recipient Address to receive withdrawn funds
    /// @param tokenAddress Actual token address for transfer (address(0) = native ETH)
    function withdrawSplit(
        bytes calldata proof,
        bytes32 merkleRoot,
        bytes32 nullifier0,
        bytes32 nullifier1,
        bytes32[8] calldata outCommitments,
        uint256 publicAmount,
        uint256 publicAsset,
        address recipient,
        address tokenAddress
    ) external onlyRelayer nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroRecipient();
        if (!isKnownRoot(merkleRoot)) revert UnknownRoot();

        if (uint256(merkleRoot) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(nullifier0) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(nullifier1) >= FIELD_SIZE) revert InvalidFieldElement();
        for (uint256 i = 0; i < 8; i++) {
            if (uint256(outCommitments[i]) >= FIELD_SIZE) revert InvalidFieldElement();
        }
        if (publicAmount >= FIELD_SIZE) revert InvalidFieldElement();
        if (publicAsset >= FIELD_SIZE) revert InvalidFieldElement();

        if (nullifiers[nullifier0]) revert NullifierAlreadySpent();
        if (nullifier1 != bytes32(0) && nullifiers[nullifier1]) {
            revert NullifierAlreadySpent();
        }
        if (proof.length != 768) revert InvalidProofLength();

        // 15 public signals: [merkleRoot, nullifier0, nullifier1, outCommitment0..7, publicAmount, publicAsset, recipient, chainId]
        uint256[15] memory pubSignals;
        pubSignals[0] = uint256(merkleRoot);
        pubSignals[1] = uint256(nullifier0);
        pubSignals[2] = uint256(nullifier1);
        for (uint256 i = 0; i < 8; i++) {
            pubSignals[3 + i] = uint256(outCommitments[i]);
        }
        pubSignals[11] = publicAmount;
        pubSignals[12] = publicAsset;
        pubSignals[13] = uint256(uint160(recipient));
        pubSignals[14] = block.chainid;

        bytes32[24] memory proofData;
        for (uint256 i = 0; i < 24; i++) {
            proofData[i] = bytes32(proof[i * 32:(i + 1) * 32]);
        }

        if (!SPLIT_VERIFIER.verifyProof(proofData, pubSignals)) revert InvalidProof();

        // Exclusion compliance gate: each non-zero nullifier must be pre-verified if compliance is enabled
        _checkComplianceGate(nullifier0, nullifier1);

        // Effects — mark nullifiers spent (skip zero slot used by dummy inputs)
        if (nullifier0 != bytes32(0)) {
            nullifiers[nullifier0] = true;
        }
        if (nullifier1 != bytes32(0)) {
            nullifiers[nullifier1] = true;
        }

        // Queue output commitments (skip zero commitments)
        for (uint256 i = 0; i < 8; i++) {
            if (outCommitments[i] != bytes32(0)) {
                uint256 idx = depositQueueTail;
                depositQueue[idx] = outCommitments[i];
                depositQueueTail = idx + 1;
                emit DepositQueued(outCommitments[i], idx, 0, tokenAddress, block.timestamp);
            }
        }

        // Interactions — transfer if publicAmount encodes a withdrawal
        if (publicAmount != 0 && publicAmount > FIELD_SIZE / 2) {
            uint256 withdrawAmount = FIELD_SIZE - publicAmount;

            if (totalDeposited[tokenAddress] < withdrawAmount) revert InsufficientPoolBalance();
            totalDeposited[tokenAddress] -= withdrawAmount;

            if (tokenAddress == address(0)) {
                (bool ok,) = recipient.call{value: withdrawAmount}("");
                if (!ok) revert TransferFailed();
            } else {
                tokenAddress.safeTransfer(recipient, withdrawAmount);
            }

            emit Withdrawal(nullifier0, recipient, withdrawAmount, tokenAddress);
        }
    }

    /// @notice Post a new Merkle root after processing the deposit queue
    /// @param newRoot New Merkle root
    function updateRoot(bytes32 newRoot) external onlyRelayer {
        uint256 newIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[newIndex] = newRoot;
        currentRootIndex = newIndex;

        emit RootUpdated(newRoot, newIndex, msg.sender);
    }

    /// @notice Check if a root exists in the history buffer
    /// @param root Root to check
    /// @return True if root is in the circular buffer
    function isKnownRoot(bytes32 root) public view returns (bool) {
        if (root == bytes32(0)) return false;
        uint256 i = currentRootIndex;
        do {
            if (roots[i] == root) return true;
            if (i == 0) i = ROOT_HISTORY_SIZE;
            i--;
        } while (i != currentRootIndex);
        return false;
    }

    /// @notice Set or unset a relayer address
    /// @param relayer Address to update (must not be address(0))
    /// @param allowed Whether to allow or disallow
    function setRelayer(address relayer, bool allowed) external onlyOwner {
        if (relayer == address(0)) revert ZeroAddress();
        relayers[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    /// @notice Enable or disable the token whitelist
    /// @param enabled True to require assets be in allowedAssets mapping
    function setWhitelistEnabled(bool enabled) external onlyOwner {
        whitelistEnabled = enabled;
        emit WhitelistUpdated(enabled);
    }

    /// @notice Add or remove an asset from the whitelist
    /// @param asset Token address (address(0) = native ETH)
    /// @param allowed Whether the asset is allowed for deposits
    function setAllowedAsset(address asset, bool allowed) external onlyOwner {
        // ETH (address(0)) is always allowed — cannot be disabled
        if (asset == address(0) && !allowed) revert AssetNotAllowed(asset);
        allowedAssets[asset] = allowed;
        emit AssetAllowed(asset, allowed);
    }

    /// @notice Start ownership transfer (2-step)
    /// @param newOwner New owner address (must call acceptOwnership())
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroRecipient();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Accept ownership transfer (must be called by pendingOwner)
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    /// @notice Pause all deposits and withdrawals
    function pause() external onlyOwner {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Update the compliance oracle address (address(0) disables screening)
    /// @param oracle New oracle address (or address(0) to disable)
    function setComplianceOracle(address oracle) external onlyOwner {
        complianceOracle = IComplianceOracle(oracle);
        emit ComplianceOracleUpdated(oracle);
    }

    /// @notice Check if a commitment is still in the post-deposit cooldown period
    /// @param commitment The commitment to check
    /// @return inCooldown True if the cooldown is still active
    /// @return originator The address that deposited this commitment
    function getCooldownStatus(bytes32 commitment) external view returns (bool inCooldown, address originator) {
        uint256 ts = depositTimestamp[commitment];
        originator = depositOriginator[commitment];
        // ts == 0 means commitment came from a withdraw (change output), not a deposit
        inCooldown = ts != 0 && block.timestamp < ts + COOLDOWN_PERIOD;
    }

    /// @notice Set the ZK exclusion-proof verifier (address(0) disables compliance proof checks)
    /// @param _verifier New compliance verifier address (or address(0) to disable)
    function setComplianceVerifier(address _verifier) external onlyOwner {
        complianceVerifier = IFFLONKComplianceVerifier(_verifier);
        emit ComplianceVerifierUpdated(_verifier);
    }

    /// @notice Post a new exclusion SMT root (relayer feeds from Chainalysis/sanctions data)
    /// @param newRoot New exclusion tree root (must be non-zero)
    function updateExclusionRoot(bytes32 newRoot) external onlyRelayer {
        if (newRoot == bytes32(0)) revert ZeroExclusionRoot();

        uint256 newIndex = (currentExclusionRootIndex + 1) % ROOT_HISTORY_SIZE;
        exclusionRoots[newIndex] = newRoot;
        currentExclusionRootIndex = newIndex;

        emit ExclusionRootUpdated(newRoot, newIndex, msg.sender);
    }

    /// @notice Check if an exclusion root exists in the history buffer
    /// @param root Root to check
    /// @return True if root is in the circular buffer
    function isKnownExclusionRoot(bytes32 root) public view returns (bool) {
        if (root == bytes32(0)) return false;
        uint256 i = currentExclusionRootIndex;
        do {
            if (exclusionRoots[i] == root) return true;
            if (i == 0) i = ROOT_HISTORY_SIZE;
            i--;
        } while (i != currentExclusionRootIndex);
        return false;
    }

    /// @dev Screen depositor against compliance oracle. No-op if oracle is address(0).
    function _screenDepositor(address depositor) internal {
        IComplianceOracle oracle = complianceOracle;
        if (address(oracle) == address(0)) return;
        bool blocked = oracle.isBlocked(depositor);
        emit DepositScreened(depositor, !blocked);
        if (blocked) revert DepositBlocked();
    }

    /// @notice Pre-verify an exclusion compliance proof for a nullifier.
    ///         Relayer calls this before withdraw/withdrawSplit. Proves the commitment
    ///         behind the nullifier is NOT in the exclusion SMT (sanctions list).
    ///         The compliance flag is NOT bound to a specific exclusion root — it persists
    ///         until consumed by withdraw/withdrawSplit. Root staleness is mitigated by the
    ///         relayer using recent roots and the circular buffer expiring old ones.
    /// @param exclusionRoot Root of the exclusion SMT the proof was generated against
    /// @param nullifier The nullifier to verify compliance for (must match withdraw's nullifier, non-zero)
    /// @param proof FFLONK proof (768 bytes) for the DustV2Compliance circuit
    function verifyComplianceProof(
        bytes32 exclusionRoot,
        bytes32 nullifier,
        bytes calldata proof
    ) external onlyRelayer whenNotPaused {
        if (nullifier == bytes32(0)) revert ZeroNullifier();

        IFFLONKComplianceVerifier verifier = complianceVerifier;
        if (address(verifier) == address(0)) revert ComplianceNotEnabled();
        if (!isKnownExclusionRoot(exclusionRoot)) revert UnknownExclusionRoot();
        if (proof.length != 768) revert InvalidProofLength();

        // BN254 field element guards — prevent field overflow equivalence attacks
        if (uint256(exclusionRoot) >= FIELD_SIZE) revert InvalidFieldElement();
        if (uint256(nullifier) >= FIELD_SIZE) revert InvalidFieldElement();

        uint256[2] memory pubSignals;
        pubSignals[0] = uint256(exclusionRoot);
        pubSignals[1] = uint256(nullifier);

        bytes32[24] memory proofData;
        for (uint256 i = 0; i < 24; i++) {
            proofData[i] = bytes32(proof[i * 32:(i + 1) * 32]);
        }

        if (!verifier.verifyProof(proofData, pubSignals)) revert InvalidComplianceProof();

        complianceVerified[nullifier] = true;
        emit ComplianceProofVerified(nullifier, exclusionRoot);
    }

    /// @dev Check exclusion compliance gate for non-zero nullifiers. No-op if verifier == address(0).
    ///      Consumes (clears) the pre-verified flag to prevent reuse.
    function _checkComplianceGate(bytes32 nullifier0, bytes32 nullifier1) internal {
        if (address(complianceVerifier) == address(0)) return;

        if (nullifier0 != bytes32(0)) {
            if (!complianceVerified[nullifier0]) revert ComplianceRequired();
            delete complianceVerified[nullifier0];
        }
        if (nullifier1 != bytes32(0)) {
            if (!complianceVerified[nullifier1]) revert ComplianceRequired();
            delete complianceVerified[nullifier1];
        }
    }

    receive() external payable {}
}
