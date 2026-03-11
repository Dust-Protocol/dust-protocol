// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDustPoolV2Deposit {
    function deposit(bytes32 commitment) external payable;
    function depositERC20(bytes32 commitment, address token, uint256 amount) external;
}

/// @title DepositSplitter — single-tx bulk deposit into DustPoolV2
/// @notice Accepts a large native-token or ERC20 deposit and splits it into
///         multiple pool deposits, each within the circuit's 64-bit range.
///         The caller pre-computes one commitment per chunk off-chain.
contract DepositSplitter {
    IDustPoolV2Deposit public immutable POOL;
    uint256 public constant MAX_CHUNK = (1 << 64) - 1;

    error CommitmentCountMismatch();
    error ZeroCommitments();
    error ZeroValue();

    constructor(address pool) {
        POOL = IDustPoolV2Deposit(pool);
    }

    /// @notice Split a native-token deposit into N chunks.
    /// @param commitments One pre-computed commitment per chunk (length = ceil(msg.value / MAX_CHUNK)).
    function splitDeposit(bytes32[] calldata commitments) external payable {
        if (commitments.length == 0) revert ZeroCommitments();
        if (msg.value == 0) revert ZeroValue();

        uint256 remaining = msg.value;
        uint256 expectedChunks = (msg.value + MAX_CHUNK - 1) / MAX_CHUNK;
        if (commitments.length != expectedChunks) revert CommitmentCountMismatch();

        for (uint256 i = 0; i < commitments.length; i++) {
            uint256 chunk = remaining > MAX_CHUNK ? MAX_CHUNK : remaining;
            POOL.deposit{value: chunk}(commitments[i]);
            remaining -= chunk;
        }
    }

    /// @notice Split an ERC20 deposit into N chunks.
    /// @dev Caller must approve this contract for the full amount first.
    function splitDepositERC20(
        bytes32[] calldata commitments,
        address token,
        uint256 totalAmount
    ) external {
        if (commitments.length == 0) revert ZeroCommitments();
        if (totalAmount == 0) revert ZeroValue();

        uint256 expectedChunks = (totalAmount + MAX_CHUNK - 1) / MAX_CHUNK;
        if (commitments.length != expectedChunks) revert CommitmentCountMismatch();

        // Pull tokens from caller
        (bool ok, ) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), totalAmount)
        );
        require(ok, "transferFrom failed");

        // Approve pool for full amount
        (bool ok2, ) = token.call(
            abi.encodeWithSignature("approve(address,uint256)", address(POOL), totalAmount)
        );
        require(ok2, "approve failed");

        uint256 remaining = totalAmount;
        for (uint256 i = 0; i < commitments.length; i++) {
            uint256 chunk = remaining > MAX_CHUNK ? MAX_CHUNK : remaining;
            POOL.depositERC20(commitments[i], token, chunk);
            remaining -= chunk;
        }
    }
}
