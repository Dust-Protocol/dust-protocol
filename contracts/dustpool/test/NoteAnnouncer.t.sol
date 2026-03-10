// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/NoteAnnouncer.sol";

contract NoteAnnouncerTest is Test {
    NoteAnnouncer announcer;

    event EncryptedNote(bytes32 indexed commitment, bytes ciphertext);

    function setUp() public {
        announcer = new NoteAnnouncer();
    }

    function test_announce_emitsEvent() public {
        bytes32 commitment = keccak256("test");
        bytes memory ciphertext = hex"deadbeef";

        vm.expectEmit(true, false, false, true);
        emit EncryptedNote(commitment, ciphertext);
        announcer.announce(commitment, ciphertext);
    }

    function test_announceBatch_emitsAllEvents() public {
        bytes32[] memory commitments = new bytes32[](3);
        bytes[] memory ciphertexts = new bytes[](3);
        for (uint256 i = 0; i < 3; i++) {
            commitments[i] = keccak256(abi.encode(i));
            ciphertexts[i] = abi.encode(i);
        }

        for (uint256 i = 0; i < 3; i++) {
            vm.expectEmit(true, false, false, true);
            emit EncryptedNote(commitments[i], ciphertexts[i]);
        }
        announcer.announceBatch(commitments, ciphertexts);
    }

    function test_announceBatch_revertsOnLengthMismatch() public {
        bytes32[] memory commitments = new bytes32[](2);
        bytes[] memory ciphertexts = new bytes[](1);
        vm.expectRevert("length mismatch");
        announcer.announceBatch(commitments, ciphertexts);
    }

    function test_announce_anyoneCanCall() public {
        address rando = makeAddr("rando");
        vm.prank(rando);
        announcer.announce(bytes32(0), hex"cafe");
    }
}
