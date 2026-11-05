// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ShipmentAgreement } from "./ShipmentAgreement.sol";
import { MembershipRegistry } from "./MembershipRegistry.sol";

/**
 * @title SettlementLedger
 * @notice Auditable ledger of payment settlement instructions for the Zena Network.
 * @dev Emits off-chain payout instructions to licensed banking/PSP partners (Paystack, Flutterwave, bank rails).
 * Holds no ERC-20 tokens or Ether on-chain. Supports partial dispute escrow/holds and mediation.
 */
contract SettlementLedger is AccessControl, EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant MEDIATION_ROLE = keccak256("MEDIATION_ROLE");
    bytes32 public constant DISPUTE_RESOLUTION_TYPEHASH =
        keccak256(
            "DisputeResolution(bytes32 shipmentId,uint256 agreedPayoutMinorUnits,bytes32 referenceHash,uint256 nonce,uint256 expiry)"
        );

    MembershipRegistry public immutable membershipRegistry;
    ShipmentAgreement public immutable shipmentAgreement;

    struct Dispute {
        uint256 disputedAmountMinorUnits;
        bytes32 evidenceHash;
        bool active;
        bool resolved;
        uint256 createdAt;
        uint256 resolvedAt;
    }

    // Storage
    mapping(bytes32 => bool) public settledShipments;
    mapping(bytes32 => Dispute) public disputes;
    mapping(bytes32 => uint256) public disputeNonces;
    uint256 public nextInstructionId;

    // Events
    event SettlementInstructionEmitted(
        uint256 indexed instructionId,
        bytes32 indexed shipmentId,
        bytes32 indexed payeeMemberId,
        address payeeNodeSigner,
        uint256 amountMinorUnits,
        bytes3 currencyCode,
        bytes32 referenceHash,
        uint256 timestamp
    );

    event DisputeRaised(
        bytes32 indexed shipmentId,
        bytes32 indexed raisedByMemberId,
        uint256 disputedAmountMinorUnits,
        bytes32 evidenceHash,
        uint256 timestamp
    );

    event DisputeResolved(
        bytes32 indexed shipmentId,
        uint256 agreedPayoutMinorUnits,
        bytes32 referenceHash,
        address resolver,
        uint256 timestamp
    );

    // Custom errors
    error InvalidMembershipRegistry();
    error InvalidShipmentAgreement();
    error ShipmentNotDelivered(bytes32 shipmentId);
    error AlreadySettled(bytes32 shipmentId);
    error DisputeAlreadyActive(bytes32 shipmentId);
    error DisputeNotActive(bytes32 shipmentId);
    error InvalidDisputeAmount(uint256 disputedAmount, uint256 maxAmount);
    error UnauthorizedSigner(address signer);
    error SignatureExpired(uint256 expiry);
    error InvalidSignature();
    error ZeroAmount();

    constructor(
        address _membershipRegistry,
        address _shipmentAgreement,
        address initialAdmin
    ) EIP712("ZenaSettlementLedger", "1") {
        if (_membershipRegistry == address(0)) revert InvalidMembershipRegistry();
        if (_shipmentAgreement == address(0)) revert InvalidShipmentAgreement();

        membershipRegistry = MembershipRegistry(_membershipRegistry);
        shipmentAgreement = ShipmentAgreement(_shipmentAgreement);

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(MEDIATION_ROLE, initialAdmin);
        nextInstructionId = 1;
    }

    /**
     * @notice Triggers automatic payout instruction upon verified delivery when terms are met.
     */
    function triggerSettlement(
        bytes32 shipmentId,
        bytes32 referenceHash
    ) external returns (uint256 instructionId) {
        if (settledShipments[shipmentId]) revert AlreadySettled(shipmentId);

        ShipmentAgreement.Shipment memory s = shipmentAgreement.getShipment(shipmentId);
        if (s.state != ShipmentAgreement.ShipmentState.Delivered) {
            revert ShipmentNotDelivered(shipmentId);
        }

        Dispute storage d = disputes[shipmentId];
        uint256 payoutAmount = s.totalAmountMinorUnits;

        if (d.active) {
            if (d.disputedAmountMinorUnits >= s.totalAmountMinorUnits) {
                revert DisputeAlreadyActive(shipmentId);
            }
            // Pay undisputed portion
            payoutAmount = s.totalAmountMinorUnits - d.disputedAmountMinorUnits;
        }

        if (payoutAmount == 0) revert ZeroAmount();

        settledShipments[shipmentId] = true;
        shipmentAgreement.markSettled(shipmentId);

        MembershipRegistry.Member memory carrier = membershipRegistry.getMember(s.carrierMemberId);

        instructionId = nextInstructionId++;

        emit SettlementInstructionEmitted(
            instructionId,
            shipmentId,
            s.carrierMemberId,
            carrier.nodeSigner,
            payoutAmount,
            s.currencyCode,
            referenceHash,
            block.timestamp
        );
    }

    /**
     * @notice Raises a dispute and holds only the disputed amount.
     */
    function raiseDispute(
        bytes32 shipmentId,
        uint256 disputedAmountMinorUnits,
        bytes32 evidenceHash
    ) external {
        if (settledShipments[shipmentId]) revert AlreadySettled(shipmentId);

        ShipmentAgreement.Shipment memory s = shipmentAgreement.getShipment(shipmentId);
        if (s.state == ShipmentAgreement.ShipmentState.Settled) revert AlreadySettled(shipmentId);

        Dispute storage d = disputes[shipmentId];
        if (d.active) revert DisputeAlreadyActive(shipmentId);
        if (disputedAmountMinorUnits == 0 || disputedAmountMinorUnits > s.totalAmountMinorUnits) {
            revert InvalidDisputeAmount(disputedAmountMinorUnits, s.totalAmountMinorUnits);
        }

        MembershipRegistry.Member memory callerMember = membershipRegistry.getMemberBySigner(msg.sender);
        if (
            callerMember.memberId != s.shipperMemberId &&
            callerMember.memberId != s.carrierMemberId
        ) {
            revert UnauthorizedSigner(msg.sender);
        }

        disputes[shipmentId] = Dispute({
            disputedAmountMinorUnits: disputedAmountMinorUnits,
            evidenceHash: evidenceHash,
            active: true,
            resolved: false,
            createdAt: block.timestamp,
            resolvedAt: 0
        });

        shipmentAgreement.markDisputed(shipmentId);

        emit DisputeRaised(
            shipmentId,
            callerMember.memberId,
            disputedAmountMinorUnits,
            evidenceHash,
            block.timestamp
        );
    }

    /**
     * @notice Resolves a dispute via mutual counterparty agreement (dual signatures).
     */
    function resolveDisputeByAgreement(
        bytes32 shipmentId,
        uint256 agreedPayoutMinorUnits,
        bytes32 referenceHash,
        uint256 expiry,
        bytes calldata shipperSignature,
        bytes calldata carrierSignature
    ) external returns (uint256 instructionId) {
        Dispute storage d = disputes[shipmentId];
        if (!d.active || d.resolved) revert DisputeNotActive(shipmentId);
        if (block.timestamp > expiry) revert SignatureExpired(expiry);

        ShipmentAgreement.Shipment memory s = shipmentAgreement.getShipment(shipmentId);
        if (agreedPayoutMinorUnits > s.totalAmountMinorUnits) {
            revert InvalidDisputeAmount(agreedPayoutMinorUnits, s.totalAmountMinorUnits);
        }

        MembershipRegistry.Member memory shipper = membershipRegistry.getMember(s.shipperMemberId);
        MembershipRegistry.Member memory carrier = membershipRegistry.getMember(s.carrierMemberId);

        uint256 nonce = disputeNonces[shipmentId]++;
        bytes32 structHash = keccak256(
            abi.encode(DISPUTE_RESOLUTION_TYPEHASH, shipmentId, agreedPayoutMinorUnits, referenceHash, nonce, expiry)
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        address recoveredShipper = digest.recover(shipperSignature);
        address recoveredCarrier = digest.recover(carrierSignature);

        if (recoveredShipper != shipper.nodeSigner) revert UnauthorizedSigner(recoveredShipper);
        if (recoveredCarrier != carrier.nodeSigner) revert UnauthorizedSigner(recoveredCarrier);

        d.active = false;
        d.resolved = true;
        d.resolvedAt = block.timestamp;

        settledShipments[shipmentId] = true;
        shipmentAgreement.markSettled(shipmentId);

        instructionId = nextInstructionId++;

        emit DisputeResolved(shipmentId, agreedPayoutMinorUnits, referenceHash, msg.sender, block.timestamp);

        if (agreedPayoutMinorUnits > 0) {
            emit SettlementInstructionEmitted(
                instructionId,
                shipmentId,
                s.carrierMemberId,
                carrier.nodeSigner,
                agreedPayoutMinorUnits,
                s.currencyCode,
                referenceHash,
                block.timestamp
            );
        }
    }

    /**
     * @notice Resolves a dispute through network mediation panel (`MEDIATION_ROLE`).
     */
    function resolveDisputeByMediation(
        bytes32 shipmentId,
        uint256 payoutAmountMinorUnits,
        bytes32 referenceHash
    ) external onlyRole(MEDIATION_ROLE) returns (uint256 instructionId) {
        Dispute storage d = disputes[shipmentId];
        if (!d.active || d.resolved) revert DisputeNotActive(shipmentId);

        ShipmentAgreement.Shipment memory s = shipmentAgreement.getShipment(shipmentId);
        if (payoutAmountMinorUnits > s.totalAmountMinorUnits) {
            revert InvalidDisputeAmount(payoutAmountMinorUnits, s.totalAmountMinorUnits);
        }

        d.active = false;
        d.resolved = true;
        d.resolvedAt = block.timestamp;

        settledShipments[shipmentId] = true;
        shipmentAgreement.markSettled(shipmentId);

        MembershipRegistry.Member memory carrier = membershipRegistry.getMember(s.carrierMemberId);

        instructionId = nextInstructionId++;

        emit DisputeResolved(shipmentId, payoutAmountMinorUnits, referenceHash, msg.sender, block.timestamp);

        if (payoutAmountMinorUnits > 0) {
            emit SettlementInstructionEmitted(
                instructionId,
                shipmentId,
                s.carrierMemberId,
                carrier.nodeSigner,
                payoutAmountMinorUnits,
                s.currencyCode,
                referenceHash,
                block.timestamp
            );
        }
    }
}

