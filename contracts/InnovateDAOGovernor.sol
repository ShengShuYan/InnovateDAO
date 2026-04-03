// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";

/**
 * @title InnovateDAOGovernor
 * @notice Core governance brain combining OpenZeppelin industrial-grade security standards with customized requirements.
 */
contract InnovateDAOGovernor is 
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorVotes, 
    GovernorVotesQuorumFraction 
{
    // ============ Custom State Variables ============
    
    uint256 public proposalDeposit; // Required deposit amount for a proposal
    mapping(uint256 => uint256) public deposits; // Records the deposit for each proposal
    mapping(uint256 => address) public proposers; // Records the proposer of each proposal

    // ============ Constructor ============
    
    constructor(
        IVotes _token, 
        uint256 _proposalDeposit
    )
        Governor("InnovateDAOGovernor")
        GovernorSettings(
            1, /* 1 block voting delay */
            50400, /* Approx. 1 week voting period (assuming 12s per block) */
            0 /* Proposal threshold (0 since we use deposit instead of token threshold) */
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(60) // Core feature: Enforces a 60% quorum
    {
        proposalDeposit = _proposalDeposit;
    }

        function fundTreasury() external payable {
            require(msg.value > 0, "InnovateDAO: funding amount must be greater than 0");
        }

        fallback() external payable {
            require(msg.value > 0, "InnovateDAO: funding amount must be greater than 0");
        }

    // ============ Custom Feature 1: Proposal with Deposit (Anti-Spam) ============
    
    /**
     * @notice Wraps the standard propose function to enforce a deposit payment.
     */
    function proposeWithDeposit(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public payable returns (uint256) {
        require(msg.value == proposalDeposit, "InnovateDAO: Must pay the exact proposal deposit");
        
        // Call the underlying framework to create the proposal
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        
        // Record the deposit status
        deposits[proposalId] = msg.value;
        proposers[proposalId] = msg.sender;
        
        return proposalId;
    }

    // ============ Custom Feature 2: 33% Voting Weight Cap (Anti-Whale) ============
    
    /**
     * @notice Overrides the vote counting logic. Dynamically calculates and applies a 33% weight cap before recording.
     */
    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight,
        bytes memory params
    ) internal virtual override(Governor, GovernorCountingSimple) returns (uint256) {
        // Get a snapshot of the total supply at the time the proposal was created
        uint256 timepoint = proposalSnapshot(proposalId);
        uint256 totalPastSupply = token().getPastTotalSupply(timepoint);
        
        // Calculate the strict 33% cap.
        // Guardrail: when totalPastSupply is small, integer division may truncate to 0.
        // Keep the anti-whale cap, but ensure governance can still progress.
        uint256 maxWeight = (totalPastSupply * 33) / 100;
        if (maxWeight == 0 && totalPastSupply > 0) {
            maxWeight = 1;
        }
        
        // Cap the user's weight at maxWeight if it exceeds the limit
        uint256 effectiveWeight = weight > maxWeight ? maxWeight : weight;
        
        // Call the underlying counting logic with the capped weight and return the result
        return super._countVote(proposalId, account, support, effectiveWeight, params);
    }

    // ============ Custom Feature 3: 66.6% Supermajority Threshold ============
    
    /**
     * @notice Overrides the successful proposal logic. Requires a 66.6% approval rate instead of simple majority.
     */
    function _voteSucceeded(uint256 proposalId) internal view virtual override(Governor, GovernorCountingSimple) returns (bool) {
        (uint256 againstVotes, uint256 forVotes, ) = proposalVotes(proposalId);
        uint256 totalVotes = againstVotes + forVotes;
        
        if (totalVotes == 0) return false;
        
        // For votes must be greater than 66.6% (6666/10000) of the total votes
        return forVotes > (totalVotes * 6666) / 10000;
    }

    // ============ Custom Feature 4: Deposit Slashing for Failed Quorum ============
    
    /**
     * @notice Allows the proposer to claim their deposit after the proposal ends. The deposit is slashed if quorum is not reached.
     */
    function claimRefund(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Defeated || state(proposalId) == ProposalState.Executed || state(proposalId) == ProposalState.Succeeded, "InnovateDAO: Proposal not finished");
        require(msg.sender == proposers[proposalId], "InnovateDAO: Only proposer can claim");
        
        uint256 amount = deposits[proposalId];
        require(amount > 0, "InnovateDAO: No deposit to claim or already claimed");

        // Slashing mechanism: If the proposal is defeated and fails to reach the 60% quorum, the deposit is confiscated.
        if (state(proposalId) == ProposalState.Defeated && !_quorumReached(proposalId)) {
            revert("InnovateDAO: Deposit slashed due to quorum shortfall");
        }

        // Clear the deposit status and refund
        deposits[proposalId] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "InnovateDAO: Refund failed");
    }

    // ============ Required System Overrides (Solidity Requirements) ============
    // These functions resolve multiple inheritance conflicts to keep the framework running correctly.
    
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }
}
