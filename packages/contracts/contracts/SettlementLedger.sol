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
 * Holds no ERC-20 tokens or Ether on-chain. A dispute freezes the whole shipment until it is resolved by agreement or mediation.
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

    // Mediation panel: N-of-M approval over the MEDIATION_ROLE holders
    uint256 public mediatorCount;
    uint256 public mediationThreshold;
    mapping(bytes32 => uint256) public mediationApprovals; // outcome key => approvals
    mapping(bytes32 => mapping(address => bool)) public hasApprovedMediation;

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

    event MediationApproved(
        bytes32 indexed shipmentId,
        address indexed mediator,
        uint256 payoutAmountMinorUnits,
        bytes32 referenceHash,
        uint256 approvals,
        uint256 threshold
    );
    event MediationThresholdUpdated(uint256 threshold);

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
    error InvalidThreshold(uint256 threshold, uint256 mediators);
    error AlreadyApprovedMediation(address mediator);
    error PreDeliveryDisputeCannotPay(bytes32 shipmentId, uint256 payoutAmount);

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
        mediationThreshold = 1; // raise via setMediationThreshold once a real panel is seated
        nextInstructionId = 1;
    }

    /**
     * @notice Sets how many distinct mediators must approve the SAME outcome before it executes.
     * @dev Admin should seat >= 3 independent mediators, set the threshold to a majority, then
     * renounce its own MEDIATION_ROLE so no single deployer key can decide disputes.
     */
    function setMediationThreshold(uint256 threshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (threshold == 0 || threshold > mediatorCount) revert InvalidThreshold(threshold, mediatorCount);
        mediationThreshold = threshold;
        emit MediationThresholdUpdated(threshold);
    }

    function _grantRole(bytes32 role, address account) internal override returns (bool granted) {
        granted = super._grantRole(role, account);
        if (granted && role == MEDIATION_ROLE) mediatorCount++;
    }

    function _revokeRole(bytes32 role, address account) internal override returns (bool revoked) {
        if (role == MEDIATION_ROLE && hasRole(role, account) && mediatorCount - 1 < mediationThreshold) {
            revert InvalidThreshold(mediationThreshold, mediatorCount - 1);
        }
        revoked = super._revokeRole(role, account);
        if (revoked && role == MEDIATION_ROLE) mediatorCount--;
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

        // A disputed shipment is in state `Disputed`, so it cannot reach this point: disputes freeze
        // the whole shipment until resolved. (The earlier "pay the undisputed portion" branch was
        // unreachable and has been removed.)
        uint256 payoutAmount = s.totalAmountMinorUnits;

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
     * @notice Raises a dispute. The shipment is frozen until the dispute is resolved.
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

        if (!membershipRegistry.isNodeSignerActive(msg.sender)) revert UnauthorizedSigner(msg.sender);
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

        bytes32 digest = _resolutionDigest(shipmentId, agreedPayoutMinorUnits, referenceHash, expiry);
        _requireSignedBy(digest, shipperSignature, s.shipperMemberId);
        _requireSignedBy(digest, carrierSignature, s.carrierMemberId);

        d.active = false;
        d.resolved = true;
        d.resolvedAt = block.timestamp;

        emit DisputeResolved(shipmentId, agreedPayoutMinorUnits, referenceHash, msg.sender, block.timestamp);

        instructionId = _closeShipmentAfterDispute(
            s,
            agreedPayoutMinorUnits,
            referenceHash,
            membershipRegistry.getMember(s.carrierMemberId).nodeSigner
        );
    }

    /// @dev The signing helpers below are split out of `resolveDisputeByAgreement` to keep the EVM
    /// stack shallow. The original inline version failed with "Stack too deep", a second compile
    /// blocker beyond the syntax error in ShipmentAgreement.
    function _resolutionDigest(
        bytes32 shipmentId,
        uint256 agreedPayoutMinorUnits,
        bytes32 referenceHash,
        uint256 expiry
    ) private returns (bytes32) {
        return
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        DISPUTE_RESOLUTION_TYPEHASH,
                        shipmentId,
                        agreedPayoutMinorUnits,
                        referenceHash,
                        disputeNonces[shipmentId]++,
                        expiry
                    )
                )
            );
    }

    function _requireSignedBy(bytes32 digest, bytes calldata signature, bytes32 memberId) private view {
        address recovered = digest.recover(signature);
        if (recovered != membershipRegistry.getMember(memberId).nodeSigner) {
            revert UnauthorizedSigner(recovered);
        }
    }

    /**
     * @notice Mediation panel vote. Each MEDIATION_ROLE holder approves a specific outcome
     * (payout + reference); the dispute resolves once `mediationThreshold` distinct mediators
     * have approved the same outcome. Returns 0 while approvals are still pending.
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

        _recordMediationApproval(shipmentId, d.createdAt, payoutAmountMinorUnits, referenceHash);
        if (_approvalsFor(shipmentId, d.createdAt, payoutAmountMinorUnits, referenceHash) < mediationThreshold) {
            return 0;
        }

        d.active = false;
        d.resolved = true;
        d.resolvedAt = block.timestamp;

        MembershipRegistry.Member memory carrier = membershipRegistry.getMember(s.carrierMemberId);

        emit DisputeResolved(shipmentId, payoutAmountMinorUnits, referenceHash, msg.sender, block.timestamp);

        instructionId = _closeShipmentAfterDispute(s, payoutAmountMinorUnits, referenceHash, carrier.nodeSigner);
    }

    function _outcomeKey(
        bytes32 shipmentId,
        uint256 disputeCreatedAt,
        uint256 payout,
        bytes32 referenceHash
    ) private pure returns (bytes32) {
        return keccak256(abi.encode(shipmentId, disputeCreatedAt, payout, referenceHash));
    }

    function _approvalsFor(
        bytes32 shipmentId,
        uint256 disputeCreatedAt,
        uint256 payout,
        bytes32 referenceHash
    ) private view returns (uint256) {
        return mediationApprovals[_outcomeKey(shipmentId, disputeCreatedAt, payout, referenceHash)];
    }

    function _recordMediationApproval(
        bytes32 shipmentId,
        uint256 disputeCreatedAt,
        uint256 payout,
        bytes32 referenceHash
    ) private {
        bytes32 key = _outcomeKey(shipmentId, disputeCreatedAt, payout, referenceHash);
        if (hasApprovedMediation[key][msg.sender]) revert AlreadyApprovedMediation(msg.sender);
        hasApprovedMediation[key][msg.sender] = true;
        uint256 approvals = ++mediationApprovals[key];
        emit MediationApproved(shipmentId, msg.sender, payout, referenceHash, approvals, mediationThreshold);
    }

    /**
     * @dev Shared tail of both resolution paths.
     * - Dispute raised AFTER delivery: shipment settles and, if the payout is non-zero, an
     *   instruction is emitted.
     * - Dispute raised BEFORE delivery: nothing may be paid (no delivery has been proven). The
     *   shipment simply resumes in its pre-dispute state so custody/delivery can complete.
     */
    function _closeShipmentAfterDispute(
        ShipmentAgreement.Shipment memory s,
        uint256 payoutAmountMinorUnits,
        bytes32 referenceHash,
        address payeeSigner
    ) private returns (uint256 instructionId) {
        if (s.preDisputeState != ShipmentAgreement.ShipmentState.Delivered) {
            if (payoutAmountMinorUnits != 0) {
                revert PreDeliveryDisputeCannotPay(s.shipmentId, payoutAmountMinorUnits);
            }
            shipmentAgreement.restoreFromDispute(s.shipmentId);
            return 0;
        }

        settledShipments[s.shipmentId] = true;
        shipmentAgreement.markSettled(s.shipmentId);

        if (payoutAmountMinorUnits > 0) {
            instructionId = nextInstructionId++;
            emit SettlementInstructionEmitted(
                instructionId,
                s.shipmentId,
                s.carrierMemberId,
                payeeSigner,
                payoutAmountMinorUnits,
                s.currencyCode,
                referenceHash,
                block.timestamp
            );
        }
    }
}
