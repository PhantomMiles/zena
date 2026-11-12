// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MembershipRegistry } from "./MembershipRegistry.sol";

/**
 * @title EventRegistry
 * @notice Verifiable, append-only event publication registry for the Zena Network.
 * @dev Maps EPCIS 2.0-style events into signed on-chain receipts without storing plaintext.
 * Emits full event logs; stores only minimal counter indexes to save gas.
 */
contract EventRegistry is EIP712 {
    using ECDSA for bytes32;

    MembershipRegistry public immutable membershipRegistry;

    bytes32 public constant EVENT_TYPEHASH =
        keccak256(
            "PublishEvent(bytes32 shipmentId,bytes32 eventType,bytes32 payloadHash,uint256 nonce,uint256 expiry)"
        );

    // Minimal indexes
    mapping(bytes32 => uint256) public shipmentEventCount;
    mapping(address => uint256) public memberNonces;

    // Events
    event EventPublished(
        bytes32 indexed shipmentId,
        bytes32 indexed eventType,
        bytes32 indexed publisherId,
        address signer,
        bytes32 payloadHash,
        uint256 eventIndex,
        uint256 timestamp
    );

    // Errors
    error InvalidMembershipRegistry();
    error SignerNotActive(address signer);
    error InvalidShipmentId();
    error InvalidEventType();
    error InvalidPayloadHash();
    error SignatureExpired(uint256 expiry);
    error InvalidSignature();
    error InvalidNonce(uint256 provided, uint256 expected);

    constructor(address _membershipRegistry) EIP712("ZenaEventRegistry", "1") {
        if (_membershipRegistry == address(0)) revert InvalidMembershipRegistry();
        membershipRegistry = MembershipRegistry(_membershipRegistry);
    }

    /**
     * @notice Publishes a verifiable supply chain event signed by an active member node.
     * @param shipmentId Associated shipment identifier
     * @param eventType Standard event type identifier (e.g. EPCIS ObjectEvent/AggregationEvent)
     * @param payloadHash SHA-256 fingerprint of the off-chain event document
     * @param nonce Signer's next sequential nonce (ignored for direct, unsigned submissions)
     * @param expiry Expiration timestamp for the signature
     * @param signature EIP-712 signature from the member's registered node key
     */
    function publishEvent(
        bytes32 shipmentId,
        bytes32 eventType,
        bytes32 payloadHash,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) external returns (uint256 eventIndex) {
        if (shipmentId == bytes32(0)) revert InvalidShipmentId();
        if (eventType == bytes32(0)) revert InvalidEventType();
        if (payloadHash == bytes32(0)) revert InvalidPayloadHash();
        if (block.timestamp > expiry) revert SignatureExpired(expiry);

        address callerOrSigner = signature.length == 0
            ? msg.sender
            : _consumeSignedNonce(shipmentId, eventType, payloadHash, nonce, expiry, signature);

        if (!membershipRegistry.isNodeSignerActive(callerOrSigner)) {
            revert SignerNotActive(callerOrSigner);
        }

        MembershipRegistry.Member memory publisher = membershipRegistry.getMemberBySigner(
            callerOrSigner
        );

        eventIndex = ++shipmentEventCount[shipmentId];

        emit EventPublished(
            shipmentId,
            eventType,
            publisher.memberId,
            callerOrSigner,
            payloadHash,
            eventIndex,
            block.timestamp
        );
    }

    /// @dev Direct submissions (empty signature) are authenticated by msg.sender. For relayed
    /// submissions the signer is recovered from the EIP-712 digest and THAT address's nonce is
    /// consumed, so a relayer can never replay the same signature.
    function _consumeSignedNonce(
        bytes32 shipmentId,
        bytes32 eventType,
        bytes32 payloadHash,
        uint256 nonce,
        uint256 expiry,
        bytes calldata signature
    ) private returns (address signer) {
        bytes32 structHash = keccak256(
            abi.encode(EVENT_TYPEHASH, shipmentId, eventType, payloadHash, nonce, expiry)
        );
        signer = _hashTypedDataV4(structHash).recover(signature);
        uint256 expectedNonce = memberNonces[signer];
        if (nonce != expectedNonce) revert InvalidNonce(nonce, expectedNonce);
        memberNonces[signer] = expectedNonce + 1;
    }
}
