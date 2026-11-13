// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title MembershipRegistry
 * @notice Authoritative registry of verified member companies on the Zena Network.
 * @dev Manages company IDs, W3C DIDs, node signer keys, and credential fingerprints.
 * No personal data, rates, or commercial secrets are stored on-chain.
 */
contract MembershipRegistry is AccessControl, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant ROTATE_SIGNER_TYPEHASH =
        keccak256("RotateSigner(bytes32 memberId,address newSigner,uint256 nonce,uint256 expiry)");

    enum MemberStatus {
        None,
        Active,
        Suspended,
        Revoked
    }

    struct Member {
        bytes32 memberId;
        string did;
        address nodeSigner;
        bytes32 credentialHash;
        MemberStatus status;
        uint256 registeredAt;
    }

    // Storage
    mapping(bytes32 => Member) private _members;
    mapping(address => bytes32) private _signerToMemberId;
    bytes32[] private _allMemberIds;

    // Nonces for key rotation EIP-712 replay protection
    mapping(bytes32 => uint256) public rotationNonces;

    // Registry pointers for system modules (modular upgradeability without proxies)
    mapping(bytes32 => address) public systemContracts;

    // Events
    event MemberRegistered(
        bytes32 indexed memberId,
        string did,
        address indexed nodeSigner,
        bytes32 credentialHash,
        uint256 timestamp
    );

    event MemberStatusUpdated(
        bytes32 indexed memberId,
        MemberStatus previousStatus,
        MemberStatus newStatus,
        uint256 timestamp
    );

    event NodeSignerRotated(
        bytes32 indexed memberId,
        address indexed oldSigner,
        address indexed newSigner,
        uint256 timestamp
    );

    event SystemContractUpdated(bytes32 indexed key, address indexed contractAddress);

    // Custom errors
    error MemberAlreadyExists(bytes32 memberId);
    error MemberNotFound(bytes32 memberId);
    error SignerAlreadyAssigned(address signer);
    error InvalidSigner(address signer);
    error MemberNotActive(bytes32 memberId);
    error SignatureExpired(uint256 expiry);
    error InvalidSignature();
    error InvalidDID();
    error InvalidCredentialHash();
    error InvalidStatus();

    constructor(address initialAdmin) EIP712("ZenaMembershipRegistry", "1") {
        if (initialAdmin == address(0)) revert InvalidSigner(address(0));
        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(GOVERNANCE_ROLE, initialAdmin);
    }

    /**
     * @notice Registers a new member company after off-chain KYB verification.
     * @param memberId Unique company ID (e.g. hash of legal registration)
     * @param did W3C DID string (e.g. "did:zena:ng:rc123456")
     * @param nodeSigner Ethereum address of the company node authorized to sign events
     * @param credentialHash SHA-256 fingerprint of the off-chain KYB credential document
     */
    function registerMember(
        bytes32 memberId,
        string calldata did,
        address nodeSigner,
        bytes32 credentialHash
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (memberId == bytes32(0)) revert MemberNotFound(memberId);
        if (_members[memberId].status != MemberStatus.None) revert MemberAlreadyExists(memberId);
        if (nodeSigner == address(0)) revert InvalidSigner(address(0));
        if (_signerToMemberId[nodeSigner] != bytes32(0)) revert SignerAlreadyAssigned(nodeSigner);
        if (bytes(did).length == 0) revert InvalidDID();
        if (credentialHash == bytes32(0)) revert InvalidCredentialHash();

        _members[memberId] = Member({
            memberId: memberId,
            did: did,
            nodeSigner: nodeSigner,
            credentialHash: credentialHash,
            status: MemberStatus.Active,
            registeredAt: block.timestamp
        });

        _signerToMemberId[nodeSigner] = memberId;
        _allMemberIds.push(memberId);

        emit MemberRegistered(memberId, did, nodeSigner, credentialHash, block.timestamp);
    }

    /**
     * @notice Updates the status of an existing member (Active, Suspended, Revoked).
     */
    function setMemberStatus(
        bytes32 memberId,
        MemberStatus status
    ) external onlyRole(GOVERNANCE_ROLE) {
        Member storage member = _members[memberId];
        if (member.status == MemberStatus.None) revert MemberNotFound(memberId);
        // `None` means "never registered"; allowing it would orphan the signer mapping.
        if (status == MemberStatus.None) revert InvalidStatus();

        MemberStatus previous = member.status;
        member.status = status;

        emit MemberStatusUpdated(memberId, previous, status, block.timestamp);
    }

    /**
     * @notice Allows a member to rotate their node signer key with an EIP-712 authorization.
     */
    function rotateNodeSigner(
        bytes32 memberId,
        address newSigner,
        uint256 expiry,
        bytes calldata signature
    ) external {
        Member storage member = _members[memberId];
        if (member.status != MemberStatus.Active) revert MemberNotActive(memberId);
        if (newSigner == address(0)) revert InvalidSigner(address(0));
        if (_signerToMemberId[newSigner] != bytes32(0)) revert SignerAlreadyAssigned(newSigner);
        if (block.timestamp > expiry) revert SignatureExpired(expiry);

        uint256 nonce = rotationNonces[memberId]++;
        bytes32 structHash = keccak256(
            abi.encode(ROTATE_SIGNER_TYPEHASH, memberId, newSigner, nonce, expiry)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(signature);

        if (recovered != member.nodeSigner) revert InvalidSignature();

        address oldSigner = member.nodeSigner;
        delete _signerToMemberId[oldSigner];

        member.nodeSigner = newSigner;
        _signerToMemberId[newSigner] = memberId;

        emit NodeSignerRotated(memberId, oldSigner, newSigner, block.timestamp);
    }

    /**
     * @notice Points to an authorized system contract module (EventRegistry, ShipmentAgreement, etc.).
     */
    function setSystemContract(
        bytes32 key,
        address contractAddress
    ) external onlyRole(GOVERNANCE_ROLE) {
        systemContracts[key] = contractAddress;
        emit SystemContractUpdated(key, contractAddress);
    }

    // --- Views ---

    function getMember(bytes32 memberId) external view returns (Member memory) {
        Member memory m = _members[memberId];
        if (m.status == MemberStatus.None) revert MemberNotFound(memberId);
        return m;
    }

    function getMemberBySigner(address signer) external view returns (Member memory) {
        bytes32 memberId = _signerToMemberId[signer];
        if (memberId == bytes32(0)) revert InvalidSigner(signer);
        return _members[memberId];
    }

    function isNodeSignerActive(address signer) external view returns (bool) {
        bytes32 memberId = _signerToMemberId[signer];
        if (memberId == bytes32(0)) return false;
        return _members[memberId].status == MemberStatus.Active;
    }

    function getActiveMemberCount() external view returns (uint256 count) {
        uint256 len = _allMemberIds.length;
        for (uint256 i = 0; i < len; ++i) {
            if (_members[_allMemberIds[i]].status == MemberStatus.Active) {
                count++;
            }
        }
    }

    function getAllMemberIds() external view returns (bytes32[] memory) {
        return _allMemberIds;
    }
}

