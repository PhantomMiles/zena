// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MembershipRegistry } from "./MembershipRegistry.sol";

/**
 * @title ShipmentAgreement
 * @notice Multi-party subcontract lifecycle and dual-signed custody handover protocol.
 * @dev Enforces monotonic state transitions, dual-party activation, dual-party handovers,
 * and receiver proof-of-delivery confirmation.
 */
contract ShipmentAgreement is EIP712 {
    using ECDSA for bytes32;

    MembershipRegistry public immutable membershipRegistry;

    enum ShipmentState {
        Proposed,
        Active,
        InTransit,
        Delivered,
        Settled,
        Disputed
    }

    struct Shipment {
        bytes32 shipmentId;
        bytes32 shipperMemberId;
        bytes32 carrierMemberId;
        bytes32 termsHash;
        uint256 totalAmountMinorUnits;
        bytes3 currencyCode;
        ShipmentState state;
        ShipmentState preDisputeState;
        uint256 handoverCount;
        uint256 createdAt;
        uint256 activatedAt;
        uint256 deliveredAt;
    }

    struct HandoverAuthorization {
        bytes32 shipmentId;
        bytes32 handoverId;
        bytes32 givingMemberId;
        bytes32 receivingMemberId;
        bytes32 conditionNotesHash;
        uint256 nonce;
        uint256 expiry;
    }

    // Typehashes
    bytes32 public constant ACTIVATE_SHIPMENT_TYPEHASH =
        keccak256(
            "ActivateShipment(bytes32 shipmentId,bytes32 termsHash,uint256 nonce,uint256 expiry)"
        );

    bytes32 public constant HANDOVER_TYPEHASH =
        keccak256(
            "HandoverAuthorization(bytes32 shipmentId,bytes32 handoverId,bytes32 givingMemberId,bytes32 receivingMemberId,bytes32 conditionNotesHash,uint256 nonce,uint256 expiry)"
        );

    bytes32 public constant POD_TYPEHASH =
        keccak256(
            "ProofOfDelivery(bytes32 shipmentId,bytes32 receiverMemberId,bytes32 podDocumentHash,uint256 nonce,uint256 expiry)"
        );

    // Storage
    mapping(bytes32 => Shipment) private _shipments;
    mapping(bytes32 => bool) public executedHandovers;
    mapping(bytes32 => uint256) public memberNonces;

    // Authorized SettlementLedger address
    address public settlementLedger;

    // Events
    event ShipmentProposed(
        bytes32 indexed shipmentId,
        bytes32 indexed shipperMemberId,
        bytes32 indexed carrierMemberId,
        bytes32 termsHash,
        uint256 totalAmountMinorUnits,
        bytes3 currencyCode
    );

    event ShipmentActivated(bytes32 indexed shipmentId, uint256 activatedAt);

    event HandoverConfirmed(
        bytes32 indexed shipmentId,
        bytes32 indexed handoverId,
        bytes32 givingMemberId,
        bytes32 receivingMemberId,
        bytes32 conditionNotesHash,
        uint256 handoverIndex,
        uint256 timestamp
    );

    event DeliveryConfirmed(
        bytes32 indexed shipmentId,
        bytes32 indexed receiverMemberId,
        bytes32 podDocumentHash,
        uint256 timestamp
    );

    event ShipmentStateChanged(
        bytes32 indexed shipmentId,
        ShipmentState previousState,
        ShipmentState newState,
        uint256 timestamp
    );

    event SettlementLedgerUpdated(address indexed newSettlementLedger);

    // Custom errors
    error InvalidMembershipRegistry();
    error ShipmentAlreadyExists(bytes32 shipmentId);
    error ShipmentNotFound(bytes32 shipmentId);
    error InvalidShipper();
    error InvalidCarrier();
    error InvalidTerms();
    error InvalidStateTransition(ShipmentState current, ShipmentState target);
    error SignatureExpired(uint256 expiry);
    error InvalidSignature();
    error SignerNotActive(address signer);
    error UnauthorizedSigner(address signer, bytes32 expectedMemberId);
    error HandoverAlreadyExecuted(bytes32 handoverId);
    error UnauthorizedCaller();
    error InvalidAmount();

    modifier onlySettlementLedger() {
        if (msg.sender != settlementLedger) revert UnauthorizedCaller();
        _;
    }

    constructor(address _membershipRegistry) EIP712("ZenaShipmentAgreement", "1") {
        if (_membershipRegistry == address(0)) revert InvalidMembershipRegistry();
        membershipRegistry = MembershipRegistry(_membershipRegistry);
    }

    function setSettlementLedger(address _settlementLedger) external {
        if (
            !membershipRegistry.hasRole(
                membershipRegistry.GOVERNANCE_ROLE(),
                msg.sender
            )
        ) revert UnauthorizedCaller();
        settlementLedger = _settlementLedger;
        emit SettlementLedgerUpdated(_settlementLedger);
    }

    /**
     * @notice Proposes a new shipment subcontract between a shipper/forwarder and a carrier.
     */
    function proposeShipment(
        bytes32 shipmentId,
        bytes32 carrierMemberId,
        bytes32 termsHash,
        uint256 totalAmountMinorUnits,
        bytes3 currencyCode
    ) external {
        if (shipmentId == bytes32(0)) revert ShipmentNotFound(shipmentId);
        if (_shipments[shipmentId].createdAt != 0) revert ShipmentAlreadyExists(shipmentId);
        if (carrierMemberId == bytes32(0)) revert InvalidCarrier();
        if (termsHash == bytes32(0)) revert InvalidTerms();
        if (totalAmountMinorUnits == 0) revert InvalidAmount();

        if (!membershipRegistry.isNodeSignerActive(msg.sender)) {
            revert SignerNotActive(msg.sender);
        }

        MembershipRegistry.Member memory shipper = membershipRegistry.getMemberBySigner(msg.sender);
        MembershipRegistry.Member memory carrier = membershipRegistry.getMember(carrierMemberId);
        if (carrier.status != MembershipRegistry.MemberStatus.Active) revert InvalidCarrier();

        _shipments[shipmentId] = Shipment({
            shipmentId: shipmentId,
            shipperMemberId: shipper.memberId,
            carrierMemberId: carrierMemberId,
            termsHash: termsHash,
            totalAmountMinorUnits: totalAmountMinorUnits,
            currencyCode: currencyCode,
            state: ShipmentState.Proposed,
            preDisputeState: ShipmentState.Proposed,
            handoverCount: 0,
            createdAt: block.timestamp,
            activatedAt: 0,
            deliveredAt: 0
        });

        emit ShipmentProposed(
            shipmentId,
            shipper.memberId,
            carrierMemberId,
            termsHash,
            totalAmountMinorUnits,
            currencyCode
        );
    }

    /**
     * @notice Activates a proposed shipment agreement via carrier co-signature.
     */
    function activateShipment(
        bytes32 shipmentId,
        uint256 expiry,
        bytes calldata carrierSignature
    ) external {
        Shipment storage s = _shipments[shipmentId];
        if (s.createdAt == 0) revert ShipmentNotFound(shipmentId);
        if (s.state != ShipmentState.Proposed) {
            revert InvalidStateTransition(s.state, ShipmentState.Active);
        }
        if (block.timestamp > expiry) revert SignatureExpired(expiry);

        MembershipRegistry.Member memory carrier = membershipRegistry.getMember(s.carrierMemberId);

        uint256 nonce = memberNonces[s.carrierMemberId]++;
        bytes32 structHash = keccak256(
            abi.encode(ACTIVATE_SHIPMENT_TYPEHASH, shipmentId, s.termsHash, nonce, expiry)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(carrierSignature);

        if (recovered != carrier.nodeSigner) {
            revert UnauthorizedSigner(recovered, s.carrierMemberId);
        }
        if (!membershipRegistry.isNodeSignerActive(recovered)) {
            revert SignerNotActive(recovered);
        }

        s.state = ShipmentState.Active;
        s.activatedAt = block.timestamp;

        emit ShipmentActivated(shipmentId, block.timestamp);
        emit ShipmentStateChanged(shipmentId, ShipmentState.Proposed, ShipmentState.Active, block.timestamp);
    }

    /**
     * @notice Confirms a custody transfer between two parties, requiring dual EIP-712 signatures.
     */
    function confirmHandover(
        HandoverAuthorization calldata auth,
        bytes calldata givingSignature,
        bytes calldata receivingSignature
    ) external {
        Shipment storage s = _shipments[auth.shipmentId];
        if (s.createdAt == 0) revert ShipmentNotFound(auth.shipmentId);
        if (s.state != ShipmentState.Active && s.state != ShipmentState.InTransit) {
            revert InvalidStateTransition(s.state, ShipmentState.InTransit);
        }
        if (executedHandovers[auth.handoverId]) {
            revert HandoverAlreadyExecuted(auth.handoverId);
        }
        if (block.timestamp > auth.expiry) revert SignatureExpired(auth.expiry);

        MembershipRegistry.Member memory giver = membershipRegistry.getMember(auth.givingMemberId);
        MembershipRegistry.Member memory receiver = membershipRegistry.getMember(auth.receivingMemberId);

        if (!membershipRegistry.isNodeSignerActive(giver.nodeSigner)) revert SignerNotActive(giver.nodeSigner);
        if (!membershipRegistry.isNodeSignerActive(receiver.nodeSigner)) revert SignerNotActive(receiver.nodeSigner);

        bytes32 structHash = keccak256(
            abi.encode(
                HANDOVER_TYPEHASH,
                auth.shipmentId,
                auth.handoverId,
                auth.givingMemberId,
                auth.receivingMemberId,
                auth.conditionNotesHash,
                auth.nonce,
                auth.expiry
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        address recoveredGiver = digest.recover(givingSignature);
        address recoveredReceiver = digest.recover(receivingSignature);

        if (recoveredGiver != giver.nodeSigner) {
            revert UnauthorizedSigner(recoveredGiver, auth.givingMemberId);
        }
        if recoveredReceiver != receiver.nodeSigner {
            revert UnauthorizedSigner(recoveredReceiver, auth.receivingMemberId);
        }

        executedHandovers[auth.handoverId] = true;
        s.handoverCount++;

        ShipmentState previousState = s.state;
        if (s.state != ShipmentState.InTransit) {
            s.state = ShipmentState.InTransit;
            emit ShipmentStateChanged(auth.shipmentId, previousState, ShipmentState.InTransit, block.timestamp);
        }

        emit HandoverConfirmed(
            auth.shipmentId,
            auth.handoverId,
            auth.givingMemberId,
            auth.receivingMemberId,
            auth.conditionNotesHash,
            s.handoverCount,
            block.timestamp
        );
    }

    /**
     * @notice Confirms final delivery with receiver proof-of-delivery (POD) signature.
     */
    function confirmDelivery(
        bytes32 shipmentId,
        bytes32 receiverMemberId,
        bytes32 podDocumentHash,
        uint256 expiry,
        bytes calldata receiverSignature
    ) external {
        Shipment storage s = _shipments[shipmentId];
        if (s.createdAt == 0) revert ShipmentNotFound(shipmentId);
        if (s.state != ShipmentState.InTransit && s.state != ShipmentState.Active) {
            revert InvalidStateTransition(s.state, ShipmentState.Delivered);
        }
        if (block.timestamp > expiry) revert SignatureExpired(expiry);

        MembershipRegistry.Member memory receiver = membershipRegistry.getMember(receiverMemberId);
        if (!membershipRegistry.isNodeSignerActive(receiver.nodeSigner)) {
            revert SignerNotActive(receiver.nodeSigner);
        }

        uint256 nonce = memberNonces[receiverMemberId]++;
        bytes32 structHash = keccak256(
            abi.encode(POD_TYPEHASH, shipmentId, receiverMemberId, podDocumentHash, nonce, expiry)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = digest.recover(receiverSignature);

        if (recovered != receiver.nodeSigner) {
            revert UnauthorizedSigner(recovered, receiverMemberId);
        }

        ShipmentState previous = s.state;
        s.state = ShipmentState.Delivered;
        s.deliveredAt = block.timestamp;

        emit DeliveryConfirmed(shipmentId, receiverMemberId, podDocumentHash, block.timestamp);
        emit ShipmentStateChanged(shipmentId, previous, ShipmentState.Delivered, block.timestamp);
    }

    /**
     * @notice Updates state to Settled (called by SettlementLedger once instructions emit).
     */
    function markSettled(bytes32 shipmentId) external onlySettlementLedger {
        Shipment storage s = _shipments[shipmentId];
        if (s.createdAt == 0) revert ShipmentNotFound(shipmentId);
        if (s.state != ShipmentState.Delivered && s.state != ShipmentState.Disputed) {
            revert InvalidStateTransition(s.state, ShipmentState.Settled);
        }

        ShipmentState previous = s.state;
        s.state = ShipmentState.Settled;
        emit ShipmentStateChanged(shipmentId, previous, ShipmentState.Settled, block.timestamp);
    }

    /**
     * @notice Updates state to Disputed (called by SettlementLedger).
     */
    function markDisputed(bytes32 shipmentId) external onlySettlementLedger {
        Shipment storage s = _shipments[shipmentId];
        if (s.createdAt == 0) revert ShipmentNotFound(shipmentId);
        if (s.state == ShipmentState.Settled) {
            revert InvalidStateTransition(s.state, ShipmentState.Disputed);
        }

        s.preDisputeState = s.state;
        s.state = ShipmentState.Disputed;
        emit ShipmentStateChanged(shipmentId, s.preDisputeState, ShipmentState.Disputed, block.timestamp);
    }

    /**
     * @notice Restores pre-dispute state upon dispute resolution (called by SettlementLedger).
     */
    function resolveDisputeState(bytes32 shipmentId, ShipmentState resolvedState) external onlySettlementLedger {
        Shipment storage s = _shipments[shipmentId];
        if (s.createdAt == 0) revert ShipmentNotFound(shipmentId);
        if (s.state != ShipmentState.Disputed) {
            revert InvalidStateTransition(s.state, resolvedState);
        }

        s.state = resolvedState;
        emit ShipmentStateChanged(shipmentId, ShipmentState.Disputed, resolvedState, block.timestamp);
    }

    // --- Views ---

    function getShipment(bytes32 shipmentId) external view returns (Shipment memory) {
        Shipment memory s = _shipments[shipmentId];
        if (s.createdAt == 0) revert ShipmentNotFound(shipmentId);
        return s;
    }
}

