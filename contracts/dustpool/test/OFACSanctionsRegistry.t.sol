// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "forge-std/Test.sol";
import {OFACSanctionsRegistry} from "../src/OFACSanctionsRegistry.sol";
import {IComplianceOracle} from "../src/IComplianceOracle.sol";
import {DustPoolV2} from "../src/DustPoolV2.sol";
import {IFFLONKVerifier} from "../src/IFFLONKVerifier.sol";

contract MockFFLONKVerifierForOFAC is IFFLONKVerifier {
    function verifyProof(bytes32[24] calldata, uint256[9] calldata) external pure returns (bool) {
        return true;
    }
}

contract OFACSanctionsRegistryTest is Test {
    OFACSanctionsRegistry public registry;

    address deployer = makeAddr("deployer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    address dave = makeAddr("dave");
    address eve = makeAddr("eve");

    event AddressSanctioned(address indexed account);
    event AddressUnsanctioned(address indexed account);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    function setUp() public {
        vm.prank(deployer);
        registry = new OFACSanctionsRegistry();
    }

    // ========== Deployment ==========

    function testDeploymentSetsOwner() public view {
        assertEq(registry.owner(), deployer);
    }

    function testDeploymentStartsEmpty() public view {
        assertEq(registry.sanctionedCount(), 0);
        assertFalse(registry.isSanctioned(alice));
        assertFalse(registry.isBlocked(alice));
    }

    function testImplementsIComplianceOracle() public view {
        // Verify the contract can be cast to the interface
        IComplianceOracle oracle = IComplianceOracle(address(registry));
        assertFalse(oracle.isBlocked(alice));
    }

    // ========== addSanctionedAddresses — Single ==========

    function testAddSingleSanctionedAddress() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        assertTrue(registry.isSanctioned(alice));
        assertTrue(registry.isBlocked(alice));
        assertEq(registry.sanctionedCount(), 1);
    }

    // ========== addSanctionedAddresses — Bulk ==========

    function testAddBulkSanctionedAddresses() public {
        address[] memory addrs = new address[](3);
        addrs[0] = alice;
        addrs[1] = bob;
        addrs[2] = charlie;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        assertTrue(registry.isSanctioned(alice));
        assertTrue(registry.isSanctioned(bob));
        assertTrue(registry.isSanctioned(charlie));
        assertFalse(registry.isSanctioned(dave));
        assertEq(registry.sanctionedCount(), 3);
    }

    // ========== addSanctionedAddresses — Duplicate Reverts ==========

    function testAddDuplicateSanctionedAddressReverts() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(OFACSanctionsRegistry.AlreadySanctioned.selector, alice));
        registry.addSanctionedAddresses(addrs);
    }

    function testAddBulkWithDuplicateInBatchReverts() public {
        address[] memory addrs = new address[](2);
        addrs[0] = alice;
        addrs[1] = alice;

        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(OFACSanctionsRegistry.AlreadySanctioned.selector, alice));
        registry.addSanctionedAddresses(addrs);
    }

    // ========== removeSanctionedAddresses — Single ==========

    function testRemoveSingleSanctionedAddress() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);
        assertTrue(registry.isSanctioned(alice));

        vm.prank(deployer);
        registry.removeSanctionedAddresses(addrs);

        assertFalse(registry.isSanctioned(alice));
        assertFalse(registry.isBlocked(alice));
        assertEq(registry.sanctionedCount(), 0);
    }

    // ========== removeSanctionedAddresses — Bulk ==========

    function testRemoveBulkSanctionedAddresses() public {
        address[] memory addrs = new address[](3);
        addrs[0] = alice;
        addrs[1] = bob;
        addrs[2] = charlie;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);
        assertEq(registry.sanctionedCount(), 3);

        address[] memory toRemove = new address[](2);
        toRemove[0] = alice;
        toRemove[1] = charlie;

        vm.prank(deployer);
        registry.removeSanctionedAddresses(toRemove);

        assertFalse(registry.isSanctioned(alice));
        assertTrue(registry.isSanctioned(bob));
        assertFalse(registry.isSanctioned(charlie));
        assertEq(registry.sanctionedCount(), 1);
    }

    // ========== removeSanctionedAddresses — Non-existent Reverts ==========

    function testRemoveNonExistentAddressReverts() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(OFACSanctionsRegistry.NotSanctioned.selector, alice));
        registry.removeSanctionedAddresses(addrs);
    }

    function testRemoveAlreadyRemovedAddressReverts() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        vm.prank(deployer);
        registry.removeSanctionedAddresses(addrs);

        vm.prank(deployer);
        vm.expectRevert(abi.encodeWithSelector(OFACSanctionsRegistry.NotSanctioned.selector, alice));
        registry.removeSanctionedAddresses(addrs);
    }

    // ========== isBlocked — IComplianceOracle Interface ==========

    function testIsBlockedReturnsTrueForSanctioned() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        assertTrue(registry.isBlocked(alice));
    }

    function testIsBlockedReturnsFalseForClean() public view {
        assertFalse(registry.isBlocked(alice));
    }

    function testIsBlockedReturnsFalseAfterRemoval() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);
        assertTrue(registry.isBlocked(alice));

        vm.prank(deployer);
        registry.removeSanctionedAddresses(addrs);
        assertFalse(registry.isBlocked(alice));
    }

    // ========== isSanctioned — Alias Consistency ==========

    function testIsSanctionedMatchesIsBlocked() public {
        address[] memory addrs = new address[](2);
        addrs[0] = alice;
        addrs[1] = bob;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        assertEq(registry.isSanctioned(alice), registry.isBlocked(alice));
        assertEq(registry.isSanctioned(bob), registry.isBlocked(bob));
        assertEq(registry.isSanctioned(charlie), registry.isBlocked(charlie));
    }

    // ========== sanctionedCount — Tracking ==========

    function testSanctionedCountTracksAdds() public {
        assertEq(registry.sanctionedCount(), 0);

        address[] memory batch1 = new address[](2);
        batch1[0] = alice;
        batch1[1] = bob;

        vm.prank(deployer);
        registry.addSanctionedAddresses(batch1);
        assertEq(registry.sanctionedCount(), 2);

        address[] memory batch2 = new address[](1);
        batch2[0] = charlie;

        vm.prank(deployer);
        registry.addSanctionedAddresses(batch2);
        assertEq(registry.sanctionedCount(), 3);
    }

    function testSanctionedCountTracksRemoves() public {
        address[] memory addrs = new address[](3);
        addrs[0] = alice;
        addrs[1] = bob;
        addrs[2] = charlie;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);
        assertEq(registry.sanctionedCount(), 3);

        address[] memory toRemove = new address[](1);
        toRemove[0] = bob;

        vm.prank(deployer);
        registry.removeSanctionedAddresses(toRemove);
        assertEq(registry.sanctionedCount(), 2);
    }

    function testSanctionedCountAccurateAfterAddRemoveAdd() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);
        assertEq(registry.sanctionedCount(), 1);

        vm.prank(deployer);
        registry.removeSanctionedAddresses(addrs);
        assertEq(registry.sanctionedCount(), 0);

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);
        assertEq(registry.sanctionedCount(), 1);
    }

    // ========== Access Control ==========

    function testNonOwnerCannotAdd() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(alice);
        vm.expectRevert(OFACSanctionsRegistry.Unauthorized.selector);
        registry.addSanctionedAddresses(addrs);
    }

    function testNonOwnerCannotRemove() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        vm.prank(bob);
        vm.expectRevert(OFACSanctionsRegistry.Unauthorized.selector);
        registry.removeSanctionedAddresses(addrs);
    }

    function testSanctionedAddressCannotAddOthers() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        address[] memory moreAddrs = new address[](1);
        moreAddrs[0] = bob;

        vm.prank(alice);
        vm.expectRevert(OFACSanctionsRegistry.Unauthorized.selector);
        registry.addSanctionedAddresses(moreAddrs);
    }

    // ========== Events ==========

    function testAddEmitsAddressSanctionedEvent() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        vm.expectEmit(true, false, false, true);
        emit AddressSanctioned(alice);
        registry.addSanctionedAddresses(addrs);
    }

    function testAddBulkEmitsMultipleEvents() public {
        address[] memory addrs = new address[](3);
        addrs[0] = alice;
        addrs[1] = bob;
        addrs[2] = charlie;

        vm.prank(deployer);
        vm.expectEmit(true, false, false, true);
        emit AddressSanctioned(alice);
        vm.expectEmit(true, false, false, true);
        emit AddressSanctioned(bob);
        vm.expectEmit(true, false, false, true);
        emit AddressSanctioned(charlie);
        registry.addSanctionedAddresses(addrs);
    }

    function testRemoveEmitsAddressUnsanctionedEvent() public {
        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        vm.prank(deployer);
        vm.expectEmit(true, false, false, true);
        emit AddressUnsanctioned(alice);
        registry.removeSanctionedAddresses(addrs);
    }

    function testRemoveBulkEmitsMultipleEvents() public {
        address[] memory addrs = new address[](2);
        addrs[0] = alice;
        addrs[1] = bob;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        vm.prank(deployer);
        vm.expectEmit(true, false, false, true);
        emit AddressUnsanctioned(alice);
        vm.expectEmit(true, false, false, true);
        emit AddressUnsanctioned(bob);
        registry.removeSanctionedAddresses(addrs);
    }

    // ========== Ownable2Step ==========

    function testTransferOwnershipSetsPending() public {
        vm.prank(deployer);
        registry.transferOwnership(alice);

        assertEq(registry.owner(), deployer);
        assertEq(registry.pendingOwner(), alice);
    }

    function testAcceptOwnershipCompletes() public {
        vm.prank(deployer);
        registry.transferOwnership(alice);

        vm.prank(alice);
        registry.acceptOwnership();

        assertEq(registry.owner(), alice);
        assertEq(registry.pendingOwner(), address(0));
    }

    function testNonPendingOwnerCannotAccept() public {
        vm.prank(deployer);
        registry.transferOwnership(alice);

        vm.prank(bob);
        vm.expectRevert();
        registry.acceptOwnership();
    }

    function testNewOwnerCanManageSanctions() public {
        vm.prank(deployer);
        registry.transferOwnership(alice);

        vm.prank(alice);
        registry.acceptOwnership();

        address[] memory addrs = new address[](1);
        addrs[0] = bob;

        vm.prank(alice);
        registry.addSanctionedAddresses(addrs);
        assertTrue(registry.isSanctioned(bob));

        vm.prank(alice);
        registry.removeSanctionedAddresses(addrs);
        assertFalse(registry.isSanctioned(bob));
    }

    function testOldOwnerCannotManageAfterTransfer() public {
        vm.prank(deployer);
        registry.transferOwnership(alice);

        vm.prank(alice);
        registry.acceptOwnership();

        address[] memory addrs = new address[](1);
        addrs[0] = bob;

        vm.prank(deployer);
        vm.expectRevert(OFACSanctionsRegistry.Unauthorized.selector);
        registry.addSanctionedAddresses(addrs);
    }

    function testTransferOwnershipEmitsEvent() public {
        vm.prank(deployer);
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferStarted(deployer, alice);
        registry.transferOwnership(alice);
    }

    function testAcceptOwnershipEmitsEvent() public {
        vm.prank(deployer);
        registry.transferOwnership(alice);

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferred(deployer, alice);
        registry.acceptOwnership();
    }

    // ========== Integration — DustPoolV2 Compliance Oracle ==========

    function testCanBeSetAsDustPoolComplianceOracle() public {
        MockFFLONKVerifierForOFAC mockVerifier = new MockFFLONKVerifierForOFAC();

        vm.prank(deployer);
        DustPoolV2 pool = new DustPoolV2(
            address(mockVerifier),
            address(mockVerifier),
            address(registry)
        );

        assertEq(address(pool.complianceOracle()), address(registry));
    }

    function testDustPoolRejectsBlockedDepositor() public {
        MockFFLONKVerifierForOFAC mockVerifier = new MockFFLONKVerifierForOFAC();

        vm.prank(deployer);
        DustPoolV2 pool = new DustPoolV2(
            address(mockVerifier),
            address(mockVerifier),
            address(registry)
        );

        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        vm.expectRevert(DustPoolV2.DepositBlocked.selector);
        pool.deposit{value: 1 ether}(bytes32(uint256(0xdead)));
    }

    function testDustPoolAllowsCleanDepositor() public {
        MockFFLONKVerifierForOFAC mockVerifier = new MockFFLONKVerifierForOFAC();

        vm.prank(deployer);
        DustPoolV2 pool = new DustPoolV2(
            address(mockVerifier),
            address(mockVerifier),
            address(registry)
        );

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        pool.deposit{value: 1 ether}(bytes32(uint256(0xdead)));

        assertEq(pool.depositQueueTail(), 1);
    }

    function testDustPoolAllowsAfterUnsanction() public {
        MockFFLONKVerifierForOFAC mockVerifier = new MockFFLONKVerifierForOFAC();

        vm.prank(deployer);
        DustPoolV2 pool = new DustPoolV2(
            address(mockVerifier),
            address(mockVerifier),
            address(registry)
        );

        address[] memory addrs = new address[](1);
        addrs[0] = alice;

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        vm.prank(deployer);
        registry.removeSanctionedAddresses(addrs);

        vm.deal(alice, 1 ether);
        vm.prank(alice);
        pool.deposit{value: 1 ether}(bytes32(uint256(0xbeef)));

        assertEq(pool.depositQueueTail(), 1);
    }

    function testDustPoolCanSwapOracleAtRuntime() public {
        MockFFLONKVerifierForOFAC mockVerifier = new MockFFLONKVerifierForOFAC();

        vm.startPrank(deployer);
        DustPoolV2 pool = new DustPoolV2(
            address(mockVerifier),
            address(mockVerifier),
            address(0)
        );
        pool.setRelayer(deployer, true);

        OFACSanctionsRegistry registry2 = new OFACSanctionsRegistry();
        pool.setComplianceOracle(address(registry2));
        vm.stopPrank();

        assertEq(address(pool.complianceOracle()), address(registry2));
    }

    // ========== Edge Cases ==========

    function testEmptyAddArray() public {
        address[] memory empty = new address[](0);

        vm.prank(deployer);
        registry.addSanctionedAddresses(empty);

        assertEq(registry.sanctionedCount(), 0);
    }

    function testEmptyRemoveArray() public {
        address[] memory empty = new address[](0);

        vm.prank(deployer);
        registry.removeSanctionedAddresses(empty);

        assertEq(registry.sanctionedCount(), 0);
    }

    function testAddressZeroCanBeSanctioned() public {
        address[] memory addrs = new address[](1);
        addrs[0] = address(0);

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        assertTrue(registry.isSanctioned(address(0)));
        assertTrue(registry.isBlocked(address(0)));
        assertEq(registry.sanctionedCount(), 1);
    }

    function testLargeBatchAdd() public {
        uint256 batchSize = 50;
        address[] memory addrs = new address[](batchSize);
        for (uint256 i = 0; i < batchSize; i++) {
            addrs[i] = address(uint160(i + 1000));
        }

        vm.prank(deployer);
        registry.addSanctionedAddresses(addrs);

        assertEq(registry.sanctionedCount(), batchSize);
        assertTrue(registry.isSanctioned(address(uint160(1000))));
        assertTrue(registry.isSanctioned(address(uint160(1049))));
    }
}
