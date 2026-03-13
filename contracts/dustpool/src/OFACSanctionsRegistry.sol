// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import {IComplianceOracle} from "./IComplianceOracle.sol";

/// @title OFACSanctionsRegistry — Production-grade OFAC sanctions list registry
/// @notice Admin-managed registry of sanctioned addresses implementing IComplianceOracle.
///         Replaces TestnetComplianceOracle with proper 2-step ownership and bulk operations.
/// @dev Uses inline Ownable2Step pattern (no OZ dependency in dustpool).
contract OFACSanctionsRegistry is IComplianceOracle {
    // ──────────────────────────────────────────────
    // Errors
    // ──────────────────────────────────────────────

    error Unauthorized();
    error NewOwnerIsZeroAddress();
    error AlreadySanctioned(address addr);
    error NotSanctioned(address addr);

    // ──────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────

    event AddressSanctioned(address indexed addr);
    event AddressUnsanctioned(address indexed addr);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ──────────────────────────────────────────────
    // State
    // ──────────────────────────────────────────────

    address public owner;
    address public pendingOwner;

    mapping(address => bool) private _sanctioned;
    uint256 private _count;

    // ──────────────────────────────────────────────
    // Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    // ──────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    // ──────────────────────────────────────────────
    // Ownership (2-step transfer)
    // ──────────────────────────────────────────────

    /// @notice Initiate ownership transfer to a new address
    /// @param newOwner Address of the proposed new owner
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert NewOwnerIsZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    /// @notice Accept ownership transfer (must be called by pending owner)
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert Unauthorized();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    // ──────────────────────────────────────────────
    // Sanctions management
    // ──────────────────────────────────────────────

    /// @notice Add multiple addresses to the sanctions list
    /// @param addrs Addresses to sanction
    function addSanctionedAddresses(address[] calldata addrs) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; i++) {
            address addr = addrs[i];
            if (_sanctioned[addr]) revert AlreadySanctioned(addr);
            _sanctioned[addr] = true;
            _count++;
            emit AddressSanctioned(addr);
        }
    }

    /// @notice Remove multiple addresses from the sanctions list
    /// @param addrs Addresses to unsanction
    function removeSanctionedAddresses(address[] calldata addrs) external onlyOwner {
        for (uint256 i = 0; i < addrs.length; i++) {
            address addr = addrs[i];
            if (!_sanctioned[addr]) revert NotSanctioned(addr);
            _sanctioned[addr] = false;
            _count--;
            emit AddressUnsanctioned(addr);
        }
    }

    // ──────────────────────────────────────────────
    // Queries
    // ──────────────────────────────────────────────

    /// @inheritdoc IComplianceOracle
    function isBlocked(address account) external view returns (bool) {
        return _sanctioned[account];
    }

    /// @notice Check if an address is on the sanctions list
    /// @param addr Address to check
    /// @return True if sanctioned
    function isSanctioned(address addr) public view returns (bool) {
        return _sanctioned[addr];
    }

    /// @notice Total number of currently sanctioned addresses
    /// @return Count of sanctioned addresses
    function sanctionedCount() external view returns (uint256) {
        return _count;
    }
}
