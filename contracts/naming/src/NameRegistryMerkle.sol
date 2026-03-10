// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title NameRegistryMerkle — Stealth name registry with keccak256 Merkle tree
/// @notice Stores name->metaAddress mappings on the canonical chain (Ethereum Sepolia).
///         The Merkle root is consumed by NameVerifier contracts on destination chains.
contract NameRegistryMerkle {
    // ─── Merkle Tree ────────────────────────────────────────────────────
    uint256 public constant TREE_DEPTH = 20;
    uint256 public constant ROOT_HISTORY_SIZE = 10;

    uint256 public nextLeafIndex;
    bytes32[20] public filledSubtrees;
    bytes32[20] public zeroHashes;
    bytes32[10] public roots;
    uint256 public currentRootIndex;

    // ─── Name Storage ───────────────────────────────────────────────────
    struct NameEntry {
        bytes metaAddress;
        address owner;
        uint256 leafIndex;
        uint256 version;
        uint256 registeredAt;
    }

    mapping(bytes32 => NameEntry) public names;
    mapping(address => bytes32[]) public ownedNames;
    mapping(address => string[]) private ownedNameStrings;

    // ─── Access Control ─────────────────────────────────────────────────
    address public sponsor;

    // ─── Events ─────────────────────────────────────────────────────────
    event NameRegistered(
        string indexed name,
        bytes32 indexed nameHash,
        bytes metaAddress,
        uint256 leafIndex,
        uint256 version,
        bytes32 newRoot
    );
    event NameUpdated(
        bytes32 indexed nameHash,
        bytes oldMetaAddress,
        bytes newMetaAddress,
        uint256 newLeafIndex,
        uint256 newVersion,
        bytes32 newRoot
    );
    event NameTransferred(bytes32 indexed nameHash, address from, address to);
    event SponsorUpdated(address oldSponsor, address newSponsor);

    // ─── Errors ─────────────────────────────────────────────────────────
    error NameTaken();
    error NameNotFound();
    error NotOwner();
    error NotSponsor();
    error InvalidName();
    error InvalidMetaAddress();
    error TreeFull();

    modifier onlySponsor() {
        if (msg.sender != sponsor) revert NotSponsor();
        _;
    }

    constructor() {
        sponsor = msg.sender;
        bytes32 currentZero = bytes32(0);
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            zeroHashes[i] = currentZero;
            filledSubtrees[i] = currentZero;
            currentZero = keccak256(abi.encodePacked(currentZero, currentZero));
        }
        roots[0] = currentZero;
    }

    /// @notice Register a new name with its stealth meta-address (sponsor-only)
    function registerName(
        string calldata name,
        bytes calldata stealthMetaAddress
    ) external onlySponsor {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        if (names[nameHash].owner != address(0)) revert NameTaken();
        if (bytes(name).length == 0 || bytes(name).length > 32) revert InvalidName();
        if (stealthMetaAddress.length == 0) revert InvalidMetaAddress();

        uint256 version = 1;
        bytes32 leaf = _computeLeaf(nameHash, keccak256(stealthMetaAddress), version);
        uint256 leafIdx = _insertLeaf(leaf);

        names[nameHash] = NameEntry({
            metaAddress: stealthMetaAddress,
            owner: msg.sender,
            leafIndex: leafIdx,
            version: version,
            registeredAt: block.timestamp
        });
        ownedNames[msg.sender].push(nameHash);
        ownedNameStrings[msg.sender].push(name);

        emit NameRegistered(
            name, nameHash, stealthMetaAddress,
            leafIdx, version, roots[currentRootIndex]
        );
    }

    /// @notice Update meta-address for an existing name (appends new leaf)
    function updateMetaAddress(
        string calldata name,
        bytes calldata newMetaAddress
    ) external onlySponsor {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        NameEntry storage entry = names[nameHash];
        if (entry.owner == address(0)) revert NameNotFound();
        if (newMetaAddress.length == 0) revert InvalidMetaAddress();

        bytes memory oldMeta = entry.metaAddress;
        uint256 newVersion = entry.version + 1;

        bytes32 newLeaf = _computeLeaf(nameHash, keccak256(newMetaAddress), newVersion);
        uint256 newIdx = _insertLeaf(newLeaf);

        entry.metaAddress = newMetaAddress;
        entry.leafIndex = newIdx;
        entry.version = newVersion;

        emit NameUpdated(nameHash, oldMeta, newMetaAddress, newIdx, newVersion, roots[currentRootIndex]);
    }

    /// @notice Transfer name ownership
    function transferName(string calldata name, address newOwner) external onlySponsor {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        NameEntry storage entry = names[nameHash];
        if (entry.owner == address(0)) revert NameNotFound();

        address oldOwner = entry.owner;
        entry.owner = newOwner;

        // Remove from old owner's ownedNames array
        bytes32[] storage oldOwnerNames = ownedNames[oldOwner];
        string[] storage oldOwnerStrings = ownedNameStrings[oldOwner];
        for (uint256 i = 0; i < oldOwnerNames.length; i++) {
            if (oldOwnerNames[i] == nameHash) {
                oldOwnerNames[i] = oldOwnerNames[oldOwnerNames.length - 1];
                oldOwnerNames.pop();
                oldOwnerStrings[i] = oldOwnerStrings[oldOwnerStrings.length - 1];
                oldOwnerStrings.pop();
                break;
            }
        }

        ownedNames[newOwner].push(nameHash);
        ownedNameStrings[newOwner].push(name);

        emit NameTransferred(nameHash, oldOwner, newOwner);
    }

    /// @notice Update the sponsor address
    function setSponsor(address newSponsor) external onlySponsor {
        address old = sponsor;
        sponsor = newSponsor;
        emit SponsorUpdated(old, newSponsor);
    }

    // ─── Read Functions ─────────────────────────────────────────────────

    function resolveName(string calldata name) external view returns (bytes memory) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        return names[nameHash].metaAddress;
    }

    function isNameAvailable(string calldata name) external view returns (bool) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        return names[nameHash].owner == address(0);
    }

    function getOwner(string calldata name) external view returns (address) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        return names[nameHash].owner;
    }

    function getNamesOwnedBy(address owner) external view returns (string[] memory) {
        return ownedNameStrings[owner];
    }

    function getLastRoot() external view returns (bytes32) {
        return roots[currentRootIndex];
    }

    function isKnownRoot(bytes32 root) public view returns (bool) {
        if (root == bytes32(0)) return false;
        for (uint256 i = 0; i < ROOT_HISTORY_SIZE; i++) {
            if (roots[i] == root) return true;
        }
        return false;
    }

    function getNameEntry(string calldata name) external view returns (
        bytes memory metaAddress,
        address owner,
        uint256 leafIndex,
        uint256 version,
        uint256 registeredAt
    ) {
        bytes32 nameHash = keccak256(abi.encodePacked(name));
        NameEntry storage entry = names[nameHash];
        return (entry.metaAddress, entry.owner, entry.leafIndex, entry.version, entry.registeredAt);
    }

    // ─── Merkle Tree Internals ──────────────────────────────────────────

    function _computeLeaf(
        bytes32 nameHash,
        bytes32 metaAddressHash,
        uint256 version
    ) internal pure returns (bytes32) {
        return keccak256(bytes.concat(
            keccak256(abi.encodePacked(nameHash, metaAddressHash, version))
        ));
    }

    function _insertLeaf(bytes32 leaf) internal returns (uint256 index) {
        if (nextLeafIndex >= 2 ** TREE_DEPTH) revert TreeFull();
        index = nextLeafIndex;

        bytes32 currentHash = leaf;
        uint256 idx = index;
        for (uint256 i = 0; i < TREE_DEPTH; i++) {
            if (idx % 2 == 0) {
                filledSubtrees[i] = currentHash;
                currentHash = keccak256(abi.encodePacked(currentHash, zeroHashes[i]));
            } else {
                currentHash = keccak256(abi.encodePacked(filledSubtrees[i], currentHash));
            }
            idx >>= 1;
        }

        currentRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        roots[currentRootIndex] = currentHash;
        nextLeafIndex++;

        return index;
    }
}
