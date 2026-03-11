// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import {DustPoolV2} from "../src/DustPoolV2.sol";
import {IFFLONKVerifier} from "../src/IFFLONKVerifier.sol";

contract MockFFLONKVerifier is IFFLONKVerifier {
    bool public shouldPass = true;

    function setResult(bool _pass) external {
        shouldPass = _pass;
    }

    function verifyProof(bytes32[24] calldata, uint256[9] calldata) external view returns (bool) {
        return shouldPass;
    }
}

contract MockERC20 {
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

contract DustPoolV2Test is Test {
    DustPoolV2 public pool;
    MockFFLONKVerifier public mockVerifier;
    MockERC20 public mockToken;

    uint256 constant FIELD_SIZE =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

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

    address deployer = makeAddr("deployer");
    address relayer = makeAddr("relayer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        vm.startPrank(deployer);
        mockVerifier = new MockFFLONKVerifier();
        pool = new DustPoolV2(address(mockVerifier), address(mockVerifier), address(0));
        pool.setRelayer(relayer, true);
        vm.stopPrank();

        mockToken = new MockERC20();

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
        vm.deal(address(pool), 100 ether);
    }

    function _dummyProof() internal pure returns (bytes memory) {
        return new bytes(768);
    }

    // Encode a withdrawal amount as a negative field element
    function _encodeWithdrawal(uint256 amount) internal pure returns (uint256) {
        return FIELD_SIZE - amount;
    }

    // ========== Deposit ETH ==========

    function testDeposit() public {
        bytes32 commitment = bytes32(uint256(0xdead));

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit DepositQueued(commitment, 0, 1 ether, address(0), block.timestamp);
        pool.deposit{value: 1 ether}(commitment);

        assertEq(pool.depositQueueTail(), 1);
        assertEq(pool.depositQueue(0), commitment);
    }

    // ========== Deposit ERC20 ==========

    function testDepositERC20() public {
        bytes32 commitment = bytes32(uint256(0xbeef));
        uint256 amount = 1e18;

        mockToken.mint(alice, amount);
        vm.prank(alice);
        mockToken.approve(address(pool), amount);

        vm.prank(alice);
        vm.expectEmit(true, false, false, true);
        emit DepositQueued(commitment, 0, amount, address(mockToken), block.timestamp);
        pool.depositERC20(commitment, address(mockToken), amount);

        assertEq(pool.depositQueueTail(), 1);
        assertEq(pool.depositQueue(0), commitment);
        assertEq(mockToken.balanceOf(address(pool)), amount);
    }

    // ========== Deposit Reverts ==========

    function testDepositZeroCommitment() public {
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.ZeroCommitment.selector);
        pool.deposit{value: 1 ether}(bytes32(0));
    }

    function testDepositZeroValue() public {
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.ZeroValue.selector);
        pool.deposit{value: 0}(bytes32(uint256(1)));
    }

    function testDepositERC20ZeroCommitment() public {
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.ZeroCommitment.selector);
        pool.depositERC20(bytes32(0), address(mockToken), 100);
    }

    function testDepositERC20ZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.ZeroValue.selector);
        pool.depositERC20(bytes32(uint256(1)), address(mockToken), 0);
    }

    // ========== Update Root ==========

    function testUpdateRoot() public {
        bytes32 root = bytes32(uint256(0xcafe));

        vm.prank(relayer);
        vm.expectEmit(false, false, false, true);
        emit RootUpdated(root, 1, relayer);
        pool.updateRoot(root);

        assertTrue(pool.isKnownRoot(root));
        assertEq(pool.currentRootIndex(), 1);
    }

    function testUpdateRootNotRelayer() public {
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.NotRelayer.selector);
        pool.updateRoot(bytes32(uint256(1)));
    }

    // ========== Root History Circular Buffer ==========

    function testRootHistoryCircularBuffer() public {
        bytes32 firstRoot = bytes32(uint256(1));

        vm.startPrank(relayer);
        pool.updateRoot(firstRoot);
        assertTrue(pool.isKnownRoot(firstRoot));

        // Push ROOT_HISTORY_SIZE more roots to evict the first
        for (uint256 i = 2; i <= 101; i++) {
            pool.updateRoot(bytes32(i));
        }
        vm.stopPrank();

        assertFalse(pool.isKnownRoot(firstRoot));
        assertTrue(pool.isKnownRoot(bytes32(uint256(101))));
    }

    // ========== Nullifier Double-Spend ==========

    function testNullifierDoubleSpend() public {
        bytes32 root = bytes32(uint256(0xaaa));
        bytes32 nullifier0 = bytes32(uint256(0xbbb));
        bytes32 outCommitment0 = bytes32(uint256(0xccc));

        vm.prank(relayer);
        pool.updateRoot(root);

        // First withdraw succeeds (pure private transfer, publicAmount = 0)
        vm.prank(relayer);
        pool.withdraw(
            _dummyProof(),
            root,
            nullifier0,
            bytes32(0),
            outCommitment0,
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );

        assertTrue(pool.nullifiers(nullifier0));

        // Second withdraw with same nullifier reverts
        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.NullifierAlreadySpent.selector);
        pool.withdraw(
            _dummyProof(),
            root,
            nullifier0,
            bytes32(0),
            bytes32(uint256(0xddd)),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    // ========== Withdraw Unknown Root ==========

    function testWithdrawUnknownRoot() public {
        bytes32 fakeRoot = bytes32(uint256(0xfff));

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.UnknownRoot.selector);
        pool.withdraw(
            _dummyProof(),
            fakeRoot,
            bytes32(uint256(1)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    // ========== Withdraw Not Relayer ==========

    function testWithdrawNotRelayer() public {
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.NotRelayer.selector);
        pool.withdraw(
            _dummyProof(),
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    // ========== Withdraw ETH ==========

    function testWithdrawETH() public {
        // Seed pool with a real deposit so totalDeposited is tracked
        bytes32 seedCommitment = bytes32(uint256(0xa0));
        vm.prank(alice);
        pool.deposit{value: 5 ether}(seedCommitment);

        bytes32 root = bytes32(uint256(0xa1));
        bytes32 nullifier0 = bytes32(uint256(0xb1));
        uint256 withdrawAmount = 1 ether;
        uint256 publicAmount = _encodeWithdrawal(withdrawAmount);

        vm.prank(relayer);
        pool.updateRoot(root);

        uint256 bobBefore = bob.balance;

        vm.prank(relayer);
        vm.expectEmit(true, true, false, true);
        emit Withdrawal(nullifier0, bob, withdrawAmount, address(0));
        pool.withdraw(
            _dummyProof(),
            root,
            nullifier0,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            publicAmount,
            0,
            bob,
            address(0)
        );

        assertEq(bob.balance, bobBefore + withdrawAmount);
    }

    // ========== Withdraw Queues Output Commitments ==========

    function testWithdrawQueuesOutputCommitments() public {
        bytes32 root = bytes32(uint256(0xa2));
        bytes32 out0 = bytes32(uint256(0xc1));
        bytes32 out1 = bytes32(uint256(0xc2));

        vm.prank(relayer);
        pool.updateRoot(root);

        uint256 tailBefore = pool.depositQueueTail();

        vm.prank(relayer);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(0xd1)),
            bytes32(0),
            out0,
            out1,
            0,
            0,
            bob,
            address(0)
        );

        assertEq(pool.depositQueueTail(), tailBefore + 2);
        assertEq(pool.depositQueue(tailBefore), out0);
        assertEq(pool.depositQueue(tailBefore + 1), out1);
    }

    // ========== Set Relayer ==========

    function testSetRelayer() public {
        address newRelayer = makeAddr("newRelayer");

        assertFalse(pool.relayers(newRelayer));

        vm.prank(deployer);
        pool.setRelayer(newRelayer, true);
        assertTrue(pool.relayers(newRelayer));

        vm.prank(deployer);
        pool.setRelayer(newRelayer, false);
        assertFalse(pool.relayers(newRelayer));
    }

    function testSetRelayerNotOwner() public {
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.NotOwner.selector);
        pool.setRelayer(alice, true);
    }

    // ========== Transfer Ownership (2-step) ==========

    function testTransferOwnership() public {
        vm.prank(deployer);
        pool.transferOwnership(alice);

        // Owner not changed yet — 2-step pattern
        assertEq(pool.owner(), deployer);
        assertEq(pool.pendingOwner(), alice);

        // Accept ownership
        vm.prank(alice);
        pool.acceptOwnership();
        assertEq(pool.owner(), alice);

        // Old owner can no longer call onlyOwner
        vm.prank(deployer);
        vm.expectRevert(DustPoolV2.NotOwner.selector);
        pool.setRelayer(bob, true);

        // New owner can
        vm.prank(alice);
        pool.setRelayer(bob, true);
        assertTrue(pool.relayers(bob));
    }

    // ========== Invalid Proof ==========

    function testWithdrawInvalidProof() public {
        bytes32 root = bytes32(uint256(0xa3));

        vm.prank(relayer);
        pool.updateRoot(root);

        mockVerifier.setResult(false);

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.InvalidProof.selector);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(0xe1)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    // ========== Invalid Proof Length ==========

    function testWithdrawInvalidProofLength() public {
        bytes32 root = bytes32(uint256(0xa4));

        vm.prank(relayer);
        pool.updateRoot(root);

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.InvalidProofLength.selector);
        pool.withdraw(
            new bytes(256), // Wrong length, should be 768
            root,
            bytes32(uint256(0xe2)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    // ========== Zero Recipient ==========

    function testWithdrawZeroRecipient() public {
        bytes32 root = bytes32(uint256(0xa5));

        vm.prank(relayer);
        pool.updateRoot(root);

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.ZeroRecipient.selector);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(0xe3)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            address(0),
            address(0)
        );
    }

    // ========== isKnownRoot with zero ==========

    function testIsKnownRootZero() public view {
        assertFalse(pool.isKnownRoot(bytes32(0)));
    }

    // ========== C1: Total deposits tracking ==========

    function testTotalDepositsTracked() public {
        bytes32 c1 = bytes32(uint256(0x111));
        bytes32 c2 = bytes32(uint256(0x222));

        vm.prank(alice);
        pool.deposit{value: 2 ether}(c1);
        assertEq(pool.totalDeposited(address(0)), 2 ether);

        vm.prank(bob);
        pool.deposit{value: 3 ether}(c2);
        assertEq(pool.totalDeposited(address(0)), 5 ether);
    }

    function testWithdrawExceedingTotalDeposits() public {
        bytes32 c1 = bytes32(uint256(0x333));
        vm.prank(alice);
        pool.deposit{value: 1 ether}(c1);

        bytes32 root = bytes32(uint256(0xf1));
        vm.prank(relayer);
        pool.updateRoot(root);

        // Try to withdraw 2 ether when only 1 ether was deposited
        uint256 publicAmount = _encodeWithdrawal(2 ether);

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.InsufficientPoolBalance.selector);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(0xf2)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            publicAmount,
            0,
            bob,
            address(0)
        );
    }

    function testWithdrawDecrementsDeposits() public {
        bytes32 c1 = bytes32(uint256(0x444));
        vm.prank(alice);
        pool.deposit{value: 5 ether}(c1);

        bytes32 root = bytes32(uint256(0xf3));
        vm.prank(relayer);
        pool.updateRoot(root);

        uint256 publicAmount = _encodeWithdrawal(2 ether);

        vm.prank(relayer);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(0xf4)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            publicAmount,
            0,
            bob,
            address(0)
        );

        assertEq(pool.totalDeposited(address(0)), 3 ether);
    }

    // ========== H1: Nullifier0 = 0 guard ==========

    function testZeroNullifierNotPoisoned() public {
        bytes32 root = bytes32(uint256(0xaa1));

        vm.prank(relayer);
        pool.updateRoot(root);

        // First tx with nullifier0 = 0 (dummy input)
        vm.prank(relayer);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );

        // Zero slot must NOT be marked spent
        assertFalse(pool.nullifiers(bytes32(0)));

        // Second tx with nullifier0 = 0 should still work
        vm.prank(relayer);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            alice,
            address(0)
        );
    }

    // ========== H3: Duplicate commitment protection ==========

    function testDuplicateCommitmentReverts() public {
        bytes32 commitment = bytes32(uint256(0x555));

        vm.prank(alice);
        pool.deposit{value: 1 ether}(commitment);

        vm.prank(bob);
        vm.expectRevert(DustPoolV2.DuplicateCommitment.selector);
        pool.deposit{value: 1 ether}(commitment);
    }

    function testDuplicateCommitmentERC20Reverts() public {
        bytes32 commitment = bytes32(uint256(0x666));

        mockToken.mint(alice, 2e18);
        vm.prank(alice);
        mockToken.approve(address(pool), 2e18);

        vm.prank(alice);
        pool.depositERC20(commitment, address(mockToken), 1e18);

        vm.prank(alice);
        vm.expectRevert(DustPoolV2.DuplicateCommitment.selector);
        pool.depositERC20(commitment, address(mockToken), 1e18);
    }

    // ========== M3: Deposit amount cap ==========

    function testDepositTooLarge() public {
        bytes32 commitment = bytes32(uint256(0x777));
        uint256 tooMuch = (1 << 128); // MAX_DEPOSIT_AMOUNT + 1

        vm.deal(alice, tooMuch + 1 ether);
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.DepositTooLarge.selector);
        pool.deposit{value: tooMuch}(commitment);
    }

    function testDepositERC20TooLarge() public {
        bytes32 commitment = bytes32(uint256(0x888));
        uint256 tooMuch = (1 << 128);

        mockToken.mint(alice, tooMuch);
        vm.prank(alice);
        mockToken.approve(address(pool), tooMuch);

        vm.prank(alice);
        vm.expectRevert(DustPoolV2.DepositTooLarge.selector);
        pool.depositERC20(commitment, address(mockToken), tooMuch);
    }

    function testDepositMaxAmount() public {
        bytes32 commitment = bytes32(uint256(0x999));
        uint256 maxAmount = (1 << 64) - 1;

        vm.deal(alice, maxAmount + 1 ether);
        vm.prank(alice);
        pool.deposit{value: maxAmount}(commitment);

        assertEq(pool.totalDeposited(address(0)), maxAmount);
    }

    // ========== ERC20 total deposits tracking ==========

    function testERC20TotalDepositsTracked() public {
        bytes32 c1 = bytes32(uint256(0xaaa));
        mockToken.mint(alice, 1e18);
        vm.prank(alice);
        mockToken.approve(address(pool), 1e18);

        vm.prank(alice);
        pool.depositERC20(c1, address(mockToken), 1e18);

        assertEq(pool.totalDeposited(address(mockToken)), 1e18);
    }

    // ========== H1 (audit): Field element validation ==========

    function testWithdrawFieldOverflowNullifier() public {
        bytes32 root = bytes32(uint256(0xab1));
        vm.prank(relayer);
        pool.updateRoot(root);

        // nullifier0 >= FIELD_SIZE should revert
        bytes32 overflowNullifier = bytes32(FIELD_SIZE);

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.InvalidFieldElement.selector);
        pool.withdraw(
            _dummyProof(),
            root,
            overflowNullifier,
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    function testWithdrawFieldOverflowCommitment() public {
        bytes32 root = bytes32(uint256(0xab2));
        vm.prank(relayer);
        pool.updateRoot(root);

        bytes32 overflowCommitment = bytes32(FIELD_SIZE);

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.InvalidFieldElement.selector);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(1)),
            bytes32(0),
            overflowCommitment,
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    function testWithdrawFieldOverflowMerkleRoot() public {
        // Merkle root >= FIELD_SIZE should fail isKnownRoot (not in buffer)
        // but if somehow it was in buffer, field validation catches it
        bytes32 overflowRoot = bytes32(FIELD_SIZE);

        // First, the root isn't known so UnknownRoot fires.
        // To test field validation, we'd need the root in the buffer.
        // Since isKnownRoot checks before field validation, this test just
        // verifies the root can't be added and used with overflow values.
        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.UnknownRoot.selector);
        pool.withdraw(
            _dummyProof(),
            overflowRoot,
            bytes32(uint256(1)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    // ========== L1 (audit): Ownership transfer event ==========

    function testTransferOwnershipEvent() public {
        vm.prank(deployer);
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferStarted(deployer, alice);
        pool.transferOwnership(alice);

        // OwnershipTransferred emits on acceptOwnership
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferred(deployer, alice);
        pool.acceptOwnership();
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    // ========== L2 (audit): Zero address ownership transfer ==========

    function testTransferOwnershipZeroAddress() public {
        vm.prank(deployer);
        vm.expectRevert(DustPoolV2.ZeroRecipient.selector);
        pool.transferOwnership(address(0));
    }

    // ========== Pausable ==========

    event Paused(address account);
    event Unpaused(address account);

    function test_pause_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.NotOwner.selector);
        pool.pause();
    }

    function test_unpause_onlyOwner() public {
        vm.prank(deployer);
        pool.pause();

        vm.prank(alice);
        vm.expectRevert(DustPoolV2.NotOwner.selector);
        pool.unpause();
    }

    function test_deposit_reverts_when_paused() public {
        vm.prank(deployer);
        pool.pause();

        vm.prank(alice);
        vm.expectRevert(DustPoolV2.ContractPaused.selector);
        pool.deposit{value: 1 ether}(bytes32(uint256(0xdead)));
    }

    function test_depositERC20_reverts_when_paused() public {
        vm.prank(deployer);
        pool.pause();

        mockToken.mint(alice, 1e18);
        vm.prank(alice);
        mockToken.approve(address(pool), 1e18);

        vm.prank(alice);
        vm.expectRevert(DustPoolV2.ContractPaused.selector);
        pool.depositERC20(bytes32(uint256(0xbeef)), address(mockToken), 1e18);
    }

    function test_withdraw_reverts_when_paused() public {
        bytes32 root = bytes32(uint256(0xf00));
        vm.prank(relayer);
        pool.updateRoot(root);

        vm.prank(deployer);
        pool.pause();

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.ContractPaused.selector);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(0xf01)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            0,
            bob,
            address(0)
        );
    }

    function test_unpause_allows_operations() public {
        vm.prank(deployer);
        pool.pause();

        vm.prank(deployer);
        pool.unpause();

        vm.prank(alice);
        pool.deposit{value: 1 ether}(bytes32(uint256(0xfeed)));
        assertEq(pool.depositQueueTail(), 1);
    }

    function test_pause_emits_event() public {
        vm.prank(deployer);
        vm.expectEmit(false, false, false, true);
        emit Paused(deployer);
        pool.pause();
    }

    function test_unpause_emits_event() public {
        vm.prank(deployer);
        pool.pause();

        vm.prank(deployer);
        vm.expectEmit(false, false, false, true);
        emit Unpaused(deployer);
        pool.unpause();
    }

    // ========== Ownable2Step ==========

    function test_transferOwnership_sets_pendingOwner() public {
        vm.prank(deployer);
        pool.transferOwnership(alice);

        // Ownership NOT transferred yet
        assertEq(pool.owner(), deployer);
        assertEq(pool.pendingOwner(), alice);
    }

    function test_acceptOwnership_completes_transfer() public {
        vm.prank(deployer);
        pool.transferOwnership(alice);

        vm.prank(alice);
        pool.acceptOwnership();

        assertEq(pool.owner(), alice);
    }

    function test_acceptOwnership_reverts_non_pending() public {
        vm.prank(deployer);
        pool.transferOwnership(alice);

        vm.prank(bob);
        vm.expectRevert(DustPoolV2.NotPendingOwner.selector);
        pool.acceptOwnership();
    }

    function test_transferOwnership_emits_started_event() public {
        vm.prank(deployer);
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferStarted(deployer, alice);
        pool.transferOwnership(alice);
    }

    function test_acceptOwnership_clears_pendingOwner() public {
        vm.prank(deployer);
        pool.transferOwnership(alice);

        vm.prank(alice);
        pool.acceptOwnership();

        assertEq(pool.pendingOwner(), address(0));
    }

    // ========== M2: setRelayer emits event ==========

    event RelayerUpdated(address indexed relayer, bool allowed);

    function testSetRelayerEmitsEvent() public {
        address newRelayer = makeAddr("eventRelayer");

        vm.prank(deployer);
        vm.expectEmit(true, false, false, true);
        emit RelayerUpdated(newRelayer, true);
        pool.setRelayer(newRelayer, true);

        vm.prank(deployer);
        vm.expectEmit(true, false, false, true);
        emit RelayerUpdated(newRelayer, false);
        pool.setRelayer(newRelayer, false);
    }

    // ========== M4: publicAsset field validation ==========

    function testWithdrawFieldOverflowPublicAsset() public {
        bytes32 root = bytes32(uint256(0xab3));
        vm.prank(relayer);
        pool.updateRoot(root);

        uint256 overflowAsset = FIELD_SIZE;

        vm.prank(relayer);
        vm.expectRevert(DustPoolV2.InvalidFieldElement.selector);
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(1)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            0,
            overflowAsset,
            bob,
            address(0)
        );
    }

    // ========== L3: ERC20 withdrawal path ==========

    function testWithdrawERC20() public {
        bytes32 c1 = bytes32(uint256(0xeee));
        uint256 depositAmount = 5e18;

        mockToken.mint(alice, depositAmount);
        vm.prank(alice);
        mockToken.approve(address(pool), depositAmount);

        vm.prank(alice);
        pool.depositERC20(c1, address(mockToken), depositAmount);

        bytes32 root = bytes32(uint256(0xef1));
        vm.prank(relayer);
        pool.updateRoot(root);

        uint256 withdrawAmount = 2e18;
        uint256 publicAmount = _encodeWithdrawal(withdrawAmount);

        uint256 bobBefore = mockToken.balanceOf(bob);

        vm.prank(relayer);
        vm.expectEmit(true, true, false, true);
        emit Withdrawal(bytes32(uint256(0xef2)), bob, withdrawAmount, address(mockToken));
        pool.withdraw(
            _dummyProof(),
            root,
            bytes32(uint256(0xef2)),
            bytes32(0),
            bytes32(0),
            bytes32(0),
            publicAmount,
            0,
            bob,
            address(mockToken)
        );

        assertEq(mockToken.balanceOf(bob), bobBefore + withdrawAmount);
        assertEq(pool.totalDeposited(address(mockToken)), depositAmount - withdrawAmount);
    }
}
