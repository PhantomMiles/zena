// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { MembershipRegistry } from "./MembershipRegistry.sol";

/**
 * @title Governance
 * @notice Consortium governance for Zena Network (one-member-one-vote).
 * @dev Enforces democratic proposal voting, quorum, threshold, timelock execution,
 * and validator-set update hooks for Hyperledger Besu QBFT.
 */
contract Governance {
    MembershipRegistry public immutable membershipRegistry;

    enum ProposalState {
        Pending,
        Active,
        Defeated,
        Succeeded,
        Queued,
        Executed,
        Canceled
    }

    struct Proposal {
        uint256 id;
        bytes32 proposerMemberId;
        address target;
        bytes callData;
        bytes32 descriptionHash;
        uint256 startBlock;
        uint256 endBlock;
        uint256 executionTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 totalVotersAtCreation;
        bool executed;
        bool canceled;
        bool isValidatorUpdate;
        address validatorAddress;
        bool validatorAuth;
    }

    // Configurable parameters
    uint256 public votingDelayBlocks; // Blocks before voting begins
    uint256 public votingPeriodBlocks; // Duration of voting window
    uint256 public timelockDelaySeconds; // Timelock delay between Succeeded and Execution
    uint256 public quorumPercent; // e.g. 50 (50% of active members required)
    uint256 public thresholdPercent; // e.g. 51 (>50% of cast votes must be FOR)

    uint256 public proposalCount;
    // Not `public`: the auto-generated getter for a 16-field struct cannot compile ("Stack too
    // deep"). Use `getProposal` instead.
    mapping(uint256 => Proposal) internal proposals;
    mapping(uint256 => mapping(bytes32 => bool)) public hasVoted;

    // Events
    event ProposalCreated(
        uint256 indexed proposalId,
        bytes32 indexed proposerMemberId,
        address target,
        bytes32 descriptionHash,
        uint256 startBlock,
        uint256 endBlock
    );

    event VoteCast(
        uint256 indexed proposalId,
        bytes32 indexed memberId,
        address indexed voterSigner,
        bool support
    );

    event ProposalQueued(uint256 indexed proposalId, uint256 executionTime);
    event ProposalExecuted(uint256 indexed proposalId);
    event ProposalCanceled(uint256 indexed proposalId);

    event ValidatorSetChangeQueued(address indexed validator, bool auth, uint256 executionTime);
    event ValidatorSetChangeExecuted(address indexed validator, bool auth);

    // Custom errors
    error InvalidMembershipRegistry();
    error NotActiveMember();
    error ProposalNotFound(uint256 proposalId);
    error InvalidProposalState(ProposalState current, ProposalState expected);
    error AlreadyVoted(bytes32 memberId);
    error TimelockNotMet(uint256 currentTime, uint256 executionTime);
    error ExecutionFailed();
    error InvalidParameter();

    constructor(
        address _membershipRegistry,
        uint256 _votingDelayBlocks,
        uint256 _votingPeriodBlocks,
        uint256 _timelockDelaySeconds,
        uint256 _quorumPercent,
        uint256 _thresholdPercent
    ) {
        if (_membershipRegistry == address(0)) revert InvalidMembershipRegistry();
        if (_quorumPercent == 0 || _quorumPercent > 100) revert InvalidParameter();
        if (_thresholdPercent == 0 || _thresholdPercent > 100) revert InvalidParameter();

        membershipRegistry = MembershipRegistry(_membershipRegistry);
        votingDelayBlocks = _votingDelayBlocks;
        votingPeriodBlocks = _votingPeriodBlocks;
        timelockDelaySeconds = _timelockDelaySeconds;
        quorumPercent = _quorumPercent;
        thresholdPercent = _thresholdPercent;
    }

    /**
     * @notice Proposes a generic contract action or configuration change.
     */
    function propose(
        address target,
        bytes calldata callData,
        bytes32 descriptionHash
    ) external returns (uint256 proposalId) {
        return _createProposal(target, callData, descriptionHash, false, address(0), false);
    }

    /**
     * @notice Proposes a validator set addition or removal in the QBFT consensus.
     */
    function proposeValidatorSetChange(
        address validatorAddress,
        bool auth,
        bytes32 descriptionHash
    ) external returns (uint256 proposalId) {
        return _createProposal(address(0), "", descriptionHash, true, validatorAddress, auth);
    }

    function _createProposal(
        address target,
        bytes memory callData,
        bytes32 descriptionHash,
        bool isValidatorUpdate,
        address validatorAddress,
        bool validatorAuth
    ) internal returns (uint256 proposalId) {
        if (!membershipRegistry.isNodeSignerActive(msg.sender)) revert NotActiveMember();
        bytes32 proposerId = membershipRegistry.getMemberBySigner(msg.sender).memberId;

        proposalId = ++proposalCount;

        // Field-by-field storage writes and few locals: a 16-field struct literal exceeds the
        // EVM stack ("Stack too deep"), which was a third compile blocker in the original source.
        Proposal storage p = proposals[proposalId];
        p.id = proposalId;
        p.proposerMemberId = proposerId;
        p.target = target;
        p.callData = callData;
        p.descriptionHash = descriptionHash;
        p.startBlock = block.number + votingDelayBlocks;
        p.endBlock = p.startBlock + votingPeriodBlocks;
        p.totalVotersAtCreation = _activeMembersOrRevert();
        p.isValidatorUpdate = isValidatorUpdate;
        p.validatorAddress = validatorAddress;
        p.validatorAuth = validatorAuth;

        emit ProposalCreated(proposalId, proposerId, target, descriptionHash, p.startBlock, p.endBlock);
    }

    function _activeMembersOrRevert() private view returns (uint256 activeMembers) {
        activeMembers = membershipRegistry.getActiveMemberCount();
        if (activeMembers == 0) revert NotActiveMember();
    }

    /**
     * @notice Casts exactly 1 vote per active member company.
     */
    function castVote(uint256 proposalId, bool support) external {
        if (!membershipRegistry.isNodeSignerActive(msg.sender)) revert NotActiveMember();
        MembershipRegistry.Member memory voter = membershipRegistry.getMemberBySigner(msg.sender);

        Proposal storage p = proposals[proposalId];
        if (state(proposalId) != ProposalState.Active) {
            revert InvalidProposalState(state(proposalId), ProposalState.Active);
        }
        if (hasVoted[proposalId][voter.memberId]) revert AlreadyVoted(voter.memberId);

        hasVoted[proposalId][voter.memberId] = true;

        if (support) {
            p.forVotes++;
        } else {
            p.againstVotes++;
        }

        emit VoteCast(proposalId, voter.memberId, msg.sender, support);
    }

    /**
     * @notice Queues a succeeded proposal for timelock delay.
     */
    function queue(uint256 proposalId) external {
        ProposalState s = state(proposalId);
        if (s != ProposalState.Succeeded) revert InvalidProposalState(s, ProposalState.Succeeded);

        Proposal storage p = proposals[proposalId];
        p.executionTime = block.timestamp + timelockDelaySeconds;

        emit ProposalQueued(proposalId, p.executionTime);

        if (p.isValidatorUpdate) {
            emit ValidatorSetChangeQueued(p.validatorAddress, p.validatorAuth, p.executionTime);
        }
    }

    /**
     * @notice Executes a queued proposal once timelock expires.
     */
    function execute(uint256 proposalId) external {
        ProposalState s = state(proposalId);
        if (s != ProposalState.Queued) revert InvalidProposalState(s, ProposalState.Queued);

        Proposal storage p = proposals[proposalId];
        if (block.timestamp < p.executionTime) {
            revert TimelockNotMet(block.timestamp, p.executionTime);
        }

        p.executed = true;

        if (p.isValidatorUpdate) {
            emit ValidatorSetChangeExecuted(p.validatorAddress, p.validatorAuth);
        } else if (p.target != address(0)) {
            (bool success, ) = p.target.call(p.callData);
            if (!success) revert ExecutionFailed();
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @notice Computes current state of a proposal.
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage p = proposals[proposalId];
        if (p.id == 0) revert ProposalNotFound(proposalId);
        if (p.canceled) return ProposalState.Canceled;
        if (p.executed) return ProposalState.Executed;

        if (block.number < p.startBlock) return ProposalState.Pending;
        if (block.number <= p.endBlock) return ProposalState.Active;

        // Voting closed: Check Quorum and Threshold
        uint256 totalVotes = p.forVotes + p.againstVotes;
        uint256 quorumRequired = (p.totalVotersAtCreation * quorumPercent + 99) / 100;

        if (totalVotes < quorumRequired) return ProposalState.Defeated;

        uint256 votesNeededToPass = (totalVotes * thresholdPercent + 99) / 100;
        if (p.forVotes < votesNeededToPass) return ProposalState.Defeated;

        if (p.executionTime == 0) return ProposalState.Succeeded;
        return ProposalState.Queued;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        Proposal memory p = proposals[proposalId];
        if (p.id == 0) revert ProposalNotFound(proposalId);
        return p;
    }
}
