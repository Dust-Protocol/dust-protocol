// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract NoteAnnouncer {
    event EncryptedNote(bytes32 indexed commitment, bytes ciphertext);

    function announce(bytes32 commitment, bytes calldata ciphertext) external {
        emit EncryptedNote(commitment, ciphertext);
    }

    function announceBatch(
        bytes32[] calldata commitments,
        bytes[] calldata ciphertexts
    ) external {
        require(commitments.length == ciphertexts.length, "length mismatch");
        for (uint256 i = 0; i < commitments.length; i++) {
            emit EncryptedNote(commitments[i], ciphertexts[i]);
        }
    }
}
