// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "forge-std/Test.sol";
import {DustSwapAdapterGeneric} from "../src/DustSwapAdapterGeneric.sol";

// ─── Mock ERC20 ─────────────────────────────────────────────────────────────

contract MockERC20Generic is Test {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

// ─── Mock DustPoolV2 ────────────────────────────────────────────────────────

contract MockDustPoolV2Generic {
    bool public paused;
    uint256 public withdrawAmountToSend;
    address public withdrawTokenToSend;

    struct DepositRecord {
        bytes32 commitment;
        uint256 amount;
        address token;
    }
    DepositRecord[] public ethDeposits;
    DepositRecord[] public erc20Deposits;

    function setPaused(bool _paused) external { paused = _paused; }
    function setWithdrawAmount(uint256 _amount) external { withdrawAmountToSend = _amount; }
    function setWithdrawToken(address _token) external { withdrawTokenToSend = _token; }

    function withdraw(
        bytes calldata, bytes32, bytes32, bytes32, bytes32, bytes32,
        uint256, uint256, address recipient, address tokenAddress
    ) external {
        if (tokenAddress == address(0)) {
            (bool ok,) = recipient.call{value: withdrawAmountToSend}("");
            require(ok, "MockPool: ETH send failed");
        } else {
            // Transfer ERC20 tokens to recipient
            (bool ok,) = tokenAddress.call(
                abi.encodeWithSignature("transfer(address,uint256)", recipient, withdrawAmountToSend)
            );
            require(ok, "MockPool: ERC20 send failed");
        }
    }

    function deposit(bytes32 commitment) external payable {
        ethDeposits.push(DepositRecord(commitment, msg.value, address(0)));
    }

    function depositERC20(bytes32 commitment, address token, uint256 amount) external {
        (bool ok,) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amount)
        );
        require(ok, "MockPool: transferFrom failed");
        erc20Deposits.push(DepositRecord(commitment, amount, token));
    }

    function ethDepositCount() external view returns (uint256) { return ethDeposits.length; }
    function erc20DepositCount() external view returns (uint256) { return erc20Deposits.length; }

    receive() external payable {}
}

// ─── Mock Router ────────────────────────────────────────────────────────────
// Accepts ETH or ERC20 input via arbitrary calldata, sends back a configured output token/amount

contract MockRouter {
    MockERC20Generic public outputToken;
    uint256 public outputAmount;

    function setOutput(address _token, uint256 _amount) external {
        outputToken = MockERC20Generic(_token);
        outputAmount = _amount;
    }

    /// @dev Fallback accepts any calldata. Sends outputAmount of outputToken to msg.sender.
    fallback() external payable {
        if (address(outputToken) == address(0)) {
            (bool ok,) = msg.sender.call{value: outputAmount}("");
            require(ok, "MockRouter: ETH send failed");
        } else {
            outputToken.transfer(msg.sender, outputAmount);
        }
    }

    receive() external payable {}
}

// ─── Tests ──────────────────────────────────────────────────────────────────

contract DustSwapAdapterGenericTest is Test {
    DustSwapAdapterGeneric public adapter;
    MockDustPoolV2Generic public mockPool;
    MockRouter public mockRouter;
    MockERC20Generic public tokenIn;
    MockERC20Generic public tokenOut;

    address deployer = makeAddr("deployer");
    address relayer = makeAddr("relayer");
    address alice = makeAddr("alice");

    uint256 constant INPUT_AMOUNT = 1 ether;
    uint256 constant OUTPUT_AMOUNT = 2000e18;
    uint256 constant RELAYER_FEE_BPS = 100;
    bytes32 constant OUTPUT_COMMITMENT = bytes32(uint256(0xabcdef123456));

    event RelayerUpdated(address indexed relayer, bool allowed);
    event RouterUpdated(address indexed router, bool allowed);

    function setUp() public {
        deployCodeTo(
            "PoseidonT3.sol:PoseidonT3",
            0x203a488C06e9add25D4b51F7EDE8e56bCC4B1A1C
        );
        deployCodeTo(
            "PoseidonT6.sol:PoseidonT6",
            0x666333F371685334CdD69bdDdaFBABc87CE7c7Db
        );

        vm.startPrank(deployer);
        mockPool = new MockDustPoolV2Generic();
        mockRouter = new MockRouter();
        tokenIn = new MockERC20Generic();
        tokenOut = new MockERC20Generic();

        adapter = new DustSwapAdapterGeneric(address(mockPool));
        adapter.setRelayer(relayer, true);
        adapter.setRouter(address(mockRouter), true);
        vm.stopPrank();

        // Fund mocks
        vm.deal(address(mockPool), 100 ether);
        vm.deal(address(mockRouter), 100 ether);
        tokenIn.mint(address(mockPool), 1_000_000e18);
        tokenOut.mint(address(mockRouter), 1_000_000e18);
        tokenOut.mint(address(mockPool), 1_000_000e18);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    function _dummyProof() internal pure returns (bytes memory) {
        return new bytes(768);
    }

    function _buildSwapCalldata() internal pure returns (bytes memory) {
        return abi.encodeWithSignature("swap()");
    }

    function _callExecuteSwap(
        address caller,
        address _tokenIn,
        address router,
        bytes memory swapCalldata,
        uint256 minAmountOut,
        address _tokenOut,
        address _relayer,
        uint256 feeBps
    ) internal {
        vm.prank(caller);
        adapter.executeSwap(
            _dummyProof(),
            bytes32(uint256(0xAABB)),
            bytes32(uint256(0x1111)),
            bytes32(uint256(0x2222)),
            bytes32(uint256(0x3333)),
            bytes32(uint256(0x4444)),
            INPUT_AMOUNT,
            uint256(0x5555),
            _tokenIn,
            router,
            swapCalldata,
            minAmountOut,
            OUTPUT_COMMITMENT,
            _tokenOut,
            _relayer,
            feeBps
        );
    }

    // ─── Test 1: Only Relayer Can Swap ──────────────────────────────────────

    function test_onlyRelayerCanSwap() public {
        vm.prank(alice);
        vm.expectRevert(DustSwapAdapterGeneric.NotRelayer.selector);
        adapter.executeSwap(
            _dummyProof(),
            bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0),
            INPUT_AMOUNT, 0,
            address(0),
            address(mockRouter),
            _buildSwapCalldata(),
            1,
            OUTPUT_COMMITMENT,
            address(tokenOut),
            alice,
            0
        );
    }

    // ─── Test 2: Only Allowed Router ────────────────────────────────────────

    function test_onlyAllowedRouterCanBeUsed() public {
        address rogue = makeAddr("rogueRouter");

        vm.prank(relayer);
        vm.expectRevert(DustSwapAdapterGeneric.NotAllowedRouter.selector);
        adapter.executeSwap(
            _dummyProof(),
            bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0),
            INPUT_AMOUNT, 0,
            address(0),
            rogue,
            _buildSwapCalldata(),
            1,
            OUTPUT_COMMITMENT,
            address(tokenOut),
            relayer,
            0
        );
    }

    // ─── Test 3: Cannot Use Pool as Router ──────────────────────────────────

    function test_cannotUsePoolAsRouter() public {
        vm.prank(deployer);
        adapter.setRouter(address(mockPool), true);

        vm.prank(relayer);
        vm.expectRevert(DustSwapAdapterGeneric.RouterIsPool.selector);
        adapter.executeSwap(
            _dummyProof(),
            bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0),
            INPUT_AMOUNT, 0,
            address(0),
            address(mockPool),
            _buildSwapCalldata(),
            1,
            OUTPUT_COMMITMENT,
            address(tokenOut),
            relayer,
            0
        );
    }

    // ─── Test 4: Cannot Use Self as Router ──────────────────────────────────

    function test_cannotUseSelfAsRouter() public {
        vm.prank(deployer);
        adapter.setRouter(address(adapter), true);

        vm.prank(relayer);
        vm.expectRevert(DustSwapAdapterGeneric.RouterIsSelf.selector);
        adapter.executeSwap(
            _dummyProof(),
            bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0),
            INPUT_AMOUNT, 0,
            address(0),
            address(adapter),
            _buildSwapCalldata(),
            1,
            OUTPUT_COMMITMENT,
            address(tokenOut),
            relayer,
            0
        );
    }

    // ─── Test 5: Relayer Fee Too High ───────────────────────────────────────

    function test_relayerFeeTooHigh() public {
        vm.prank(relayer);
        vm.expectRevert(DustSwapAdapterGeneric.RelayerFeeTooHigh.selector);
        adapter.executeSwap(
            _dummyProof(),
            bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0),
            INPUT_AMOUNT, 0,
            address(0),
            address(mockRouter),
            _buildSwapCalldata(),
            1,
            OUTPUT_COMMITMENT,
            address(tokenOut),
            relayer,
            501
        );
    }

    // ─── Test 6: Zero Min Amount Reverts ────────────────────────────────────

    function test_zeroMinAmountReverts() public {
        vm.prank(relayer);
        vm.expectRevert(DustSwapAdapterGeneric.ZeroMinAmount.selector);
        adapter.executeSwap(
            _dummyProof(),
            bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0),
            INPUT_AMOUNT, 0,
            address(0),
            address(mockRouter),
            _buildSwapCalldata(),
            0,
            OUTPUT_COMMITMENT,
            address(tokenOut),
            relayer,
            100
        );
    }

    // ─── Test 7: Router Whitelist Only Owner ────────────────────────────────

    function test_routerWhitelistOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        adapter.setRouter(makeAddr("newRouter"), true);
    }

    // ─── Test 8: Set Router Emits Event ─────────────────────────────────────

    function test_setRouterEmitsEvent() public {
        address newRouter = makeAddr("newRouter");

        vm.prank(deployer);
        vm.expectEmit(true, false, false, true, address(adapter));
        emit RouterUpdated(newRouter, true);
        adapter.setRouter(newRouter, true);
    }

    // ─── Test 9: Relayer Whitelist Only Owner ───────────────────────────────

    function test_relayerWhitelistOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        adapter.setRelayer(makeAddr("newRelayer"), true);
    }

    // ─── Test 10: Emergency Withdraw ETH Only Owner ─────────────────────────

    function test_emergencyWithdrawETHOnlyOwner() public {
        vm.deal(address(adapter), 1 ether);

        vm.prank(alice);
        vm.expectRevert();
        adapter.emergencyWithdrawETH();
    }

    // ─── Test 11: Emergency Withdraw ETH ────────────────────────────────────

    function test_emergencyWithdrawETH() public {
        vm.deal(address(adapter), 5 ether);
        uint256 balBefore = deployer.balance;

        vm.prank(deployer);
        adapter.emergencyWithdrawETH();

        assertEq(address(adapter).balance, 0, "Adapter drained");
        assertEq(deployer.balance - balBefore, 5 ether, "Owner received ETH");
    }

    // ─── Test 12: Ownable2Step ──────────────────────────────────────────────

    function test_ownershipTransferRequiresAcceptance() public {
        address newOwner = makeAddr("newOwner");

        // Non-owner cannot initiate transfer
        vm.prank(alice);
        vm.expectRevert();
        adapter.transferOwnership(newOwner);

        // Owner initiates transfer — ownership not yet changed
        vm.prank(deployer);
        adapter.transferOwnership(newOwner);
        assertEq(adapter.owner(), deployer, "Owner unchanged until accepted");

        // Random address cannot accept
        vm.prank(alice);
        vm.expectRevert();
        adapter.acceptOwnership();

        // Pending owner accepts
        vm.prank(newOwner);
        adapter.acceptOwnership();
        assertEq(adapter.owner(), newOwner, "Ownership transferred after acceptance");
    }

    // ─── Test 13: Set Relayer Emits Event ───────────────────────────────────

    function test_setRelayerEmitsEvent() public {
        address newRelayer = makeAddr("newRelayer");

        vm.prank(deployer);
        vm.expectEmit(true, false, false, true, address(adapter));
        emit RelayerUpdated(newRelayer, true);
        adapter.setRelayer(newRelayer, true);
    }

    // ─── Test 14: Emergency Withdraw ERC20 Only Owner ───────────────────────

    function test_emergencyWithdrawERC20OnlyOwner() public {
        tokenOut.mint(address(adapter), 1000e18);

        vm.prank(alice);
        vm.expectRevert();
        adapter.emergencyWithdrawERC20(address(tokenOut));
    }

    // ─── Test 15: Emergency Withdraw ERC20 ──────────────────────────────────

    function test_emergencyWithdrawERC20() public {
        tokenOut.mint(address(adapter), 1000e18);

        vm.prank(deployer);
        adapter.emergencyWithdrawERC20(address(tokenOut));

        assertEq(tokenOut.balanceOf(address(adapter)), 0, "Adapter drained");
        assertEq(tokenOut.balanceOf(deployer), 1000e18, "Owner received tokens");
    }

    // ─── Test 16: Pool Paused Reverts ───────────────────────────────────────

    function test_poolPausedReverts() public {
        mockPool.setPaused(true);

        vm.prank(relayer);
        vm.expectRevert(DustSwapAdapterGeneric.PoolPaused.selector);
        adapter.executeSwap(
            _dummyProof(),
            bytes32(0), bytes32(0), bytes32(0), bytes32(0), bytes32(0),
            INPUT_AMOUNT, 0,
            address(0),
            address(mockRouter),
            _buildSwapCalldata(),
            1,
            OUTPUT_COMMITMENT,
            address(tokenOut),
            relayer,
            100
        );
    }

    // ─── Test 17: Set Price Oracle Only Owner ───────────────────────────────

    function test_setPriceOracleOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        adapter.setPriceOracle(address(1));
    }

    // ─── Test 18: Set Price Oracle Works ────────────────────────────────────

    function test_setPriceOracle() public {
        address oracle = makeAddr("oracle");

        vm.prank(deployer);
        adapter.setPriceOracle(oracle);
    }
}
