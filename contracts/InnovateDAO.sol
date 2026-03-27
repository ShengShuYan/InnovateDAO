// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title InnovateDAO
 * @notice A DAO contract with NFT-gated proposal creation, stake-weighted voting,
 *         and strict governance rules (60% quorum, 66.6% supermajority, 33% individual cap)
 */
contract InnovateDAO is ReentrancyGuard, Ownable {
    
    // ============ Enums ============
    
    enum ProposalStatus {
        Pending,
        Active,
        Succeeded,
        Failed,
        Executed
    }
    
    enum VoteType {
        Against,
        Support
    }
    
    // ============ Structs ============
    
    struct Proposal {
        uint256 id;
        address proposer;
        address recipient;
        uint256 amount;
        uint256 startTime;
        uint256 votingDeadline;
        uint256 totalSupport;
        uint256 totalAgainst;
        bool executed;
        ProposalStatus status;
        string description;
    }
    
    // ============ State Variables ============
    
    IERC721 public membershipNFT;
    
    mapping(address => uint256) public stakedBalance;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => Proposal) public proposals;
    mapping(address => uint256) public activeVotes; // Track number of active locked votes per user
    mapping(address => uint256) public proposalDeposits; // Track refundable deposits
    
    uint256 public proposalCount;
    uint256 public totalStakedSupply;
    uint256 public proposalDeposit;
    uint256 public votingPeriod;
    
    // Constants for governance rules
    uint256 public constant QUORUM_PERCENTAGE = 60; // 60% quorum
    uint256 public constant SUPERMAJORITY_PERCENTAGE = 6666; // 66.6% (in basis points * 100)
    uint256 public constant VOTING_WEIGHT_CAP_PERCENTAGE = 33; // 33% max per user
    uint256 public constant PERCENTAGE_BASE = 100;
    uint256 public constant BASIS_POINTS_BASE = 10000;
    
    // ============ Events ============
    
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address recipient,
        uint256 amount,
        uint256 startTime,
        uint256 votingDeadline,
        string description
    );
    
    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        VoteType voteType,
        uint256 weight
    );
    
    event ProposalExecuted(
        uint256 indexed proposalId,
        address recipient,
        uint256 amount
    );
    
    event ProposalStatusChanged(
        uint256 indexed proposalId,
        ProposalStatus newStatus
    );
    
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event DepositRefunded(address indexed proposer, uint256 amount);
    
    // ============ Modifiers ============
    
    modifier onlyNFTHolder() {
        require(membershipNFT.balanceOf(msg.sender) > 0, "Must hold membership NFT");
        _;
    }
    
    modifier proposalExists(uint256 proposalId) {
        require(proposalId > 0 && proposalId <= proposalCount, "Proposal does not exist");
        _;
    }
    
    // ============ Constructor ============
    
    constructor(
        address _membershipNFT,
        uint256 _proposalDeposit,
        uint256 _votingPeriod
    ) Ownable(msg.sender) {
        require(_membershipNFT != address(0), "Invalid NFT address");
        membershipNFT = IERC721(_membershipNFT);
        proposalDeposit = _proposalDeposit;
        votingPeriod = _votingPeriod;
    }
    
    // ============ Core Functions ============
    
    /**
     * @notice Allows users to stake ETH for voting power
     */
    function stake() external payable nonReentrant {
        require(msg.value > 0, "Must stake positive amount");
        
        stakedBalance[msg.sender] += msg.value;
        totalStakedSupply += msg.value;
        
        emit Staked(msg.sender, msg.value);
    }
    
    /**
     * @notice Create a new proposal (NFT holders only, requires deposit)
     * @param recipient Address to receive funds if proposal passes
     * @param amount Amount of ETH to transfer
     * @param description Description of the proposal
     */
    function createProposal(
        address recipient,
        uint256 amount,
        string calldata description
    ) external payable onlyNFTHolder nonReentrant returns (uint256) {
        require(msg.value == proposalDeposit, "Incorrect deposit amount");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        require(amount <= address(this).balance - proposalDeposit, "Insufficient DAO funds");
        
        proposalCount++;
        uint256 proposalId = proposalCount;
        
        uint256 startTime = block.timestamp;
        uint256 votingDeadline = startTime + votingPeriod;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            recipient: recipient,
            amount: amount,
            startTime: startTime,
            votingDeadline: votingDeadline,
            totalSupport: 0,
            totalAgainst: 0,
            executed: false,
            status: ProposalStatus.Active,
            description: description
        });
        
        proposalDeposits[msg.sender] += msg.value;
        
        emit ProposalCreated(
            proposalId,
            msg.sender,
            recipient,
            amount,
            startTime,
            votingDeadline,
            description
        );
        
        return proposalId;
    }
    
    /**
     * @notice Cast a vote on an active proposal
     * @param proposalId ID of the proposal
     * @param voteType Support (1) or Against (0)
     */
    function castVote(
        uint256 proposalId,
        VoteType voteType
    ) external proposalExists(proposalId) nonReentrant {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp < proposal.votingDeadline, "Voting period ended");
        require(!hasVoted[proposalId][msg.sender], "Already voted");
        require(stakedBalance[msg.sender] > 0, "No voting power");
        
        // Calculate voting weight with 33% cap
        uint256 userStake = stakedBalance[msg.sender];
        uint256 maxWeight = (totalStakedSupply * VOTING_WEIGHT_CAP_PERCENTAGE) / PERCENTAGE_BASE;
        uint256 votingWeight = userStake < maxWeight ? userStake : maxWeight;
        
        // Update vote tallies
        if (voteType == VoteType.Support) {
            proposal.totalSupport += votingWeight;
        } else {
            proposal.totalAgainst += votingWeight;
        }
        
        // Lock the user's voting power
        hasVoted[proposalId][msg.sender] = true;
        activeVotes[msg.sender]++;
        
        emit VoteCast(proposalId, msg.sender, voteType, votingWeight);
    }
    
    /**
     * @notice Execute a proposal if conditions are met
     * @param proposalId ID of the proposal to execute
     */
    function executeProposal(uint256 proposalId) 
        external 
        proposalExists(proposalId) 
        nonReentrant 
    {
        Proposal storage proposal = proposals[proposalId];
        
        require(proposal.status == ProposalStatus.Active, "Proposal not active");
        require(block.timestamp >= proposal.votingDeadline, "Voting period not ended");
        require(!proposal.executed, "Already executed");
        
        // Check quorum: 60% of total staked supply must participate
        uint256 totalVotes = proposal.totalSupport + proposal.totalAgainst;
        uint256 quorumRequired = (totalStakedSupply * QUORUM_PERCENTAGE) / PERCENTAGE_BASE;
        
        if (totalVotes < quorumRequired) {
            proposal.status = ProposalStatus.Failed;
            emit ProposalStatusChanged(proposalId, ProposalStatus.Failed);
            _refundDeposit(proposal.proposer);
            return;
        }
        
        // Check supermajority: >66.6% approval
        uint256 approvalRate = (proposal.totalSupport * BASIS_POINTS_BASE) / totalVotes;
        
        if (approvalRate > SUPERMAJORITY_PERCENTAGE) {
            // Proposal succeeded
            proposal.status = ProposalStatus.Succeeded;
            proposal.executed = true;
            
            // Atomic transfer to recipient
            (bool success, ) = proposal.recipient.call{value: proposal.amount}("");
            require(success, "Transfer failed");
            
            proposal.status = ProposalStatus.Executed;
            
            emit ProposalExecuted(proposalId, proposal.recipient, proposal.amount);
            emit ProposalStatusChanged(proposalId, ProposalStatus.Executed);
            
            // Refund deposit to proposer
            _refundDeposit(proposal.proposer);
        } else {
            // Proposal failed
            proposal.status = ProposalStatus.Failed;
            emit ProposalStatusChanged(proposalId, ProposalStatus.Failed);
            _refundDeposit(proposal.proposer);
        }
    }
    
    /**
     * @notice Withdraw staked tokens (only if no active locked votes)
     * @param amount Amount to withdraw
     */
    function withdrawStake(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be positive");
        require(stakedBalance[msg.sender] >= amount, "Insufficient balance");
        require(activeVotes[msg.sender] == 0, "Cannot withdraw with active votes");
        
        stakedBalance[msg.sender] -= amount;
        totalStakedSupply -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @notice Unlock votes after proposal deadline has passed
     * @param proposalId ID of the proposal
     */
    function unlockVote(uint256 proposalId) external proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        require(hasVoted[proposalId][msg.sender], "Did not vote on this proposal");
        require(block.timestamp >= proposal.votingDeadline, "Voting period not ended");
        require(activeVotes[msg.sender] > 0, "No active votes to unlock");
        
        activeVotes[msg.sender]--;
    }
    
    // ============ Internal Functions ============
    
    function _refundDeposit(address proposer) internal {
        uint256 depositAmount = proposalDeposits[proposer];
        if (depositAmount > 0) {
            proposalDeposits[proposer] = 0;
            (bool success, ) = proposer.call{value: depositAmount}("");
            require(success, "Deposit refund failed");
            emit DepositRefunded(proposer, depositAmount);
        }
    }
    
    // ============ View Functions ============
    
    function getProposal(uint256 proposalId) 
        external 
        view 
        proposalExists(proposalId) 
        returns (Proposal memory) 
    {
        return proposals[proposalId];
    }
    
    function getVotingWeight(address voter) external view returns (uint256) {
        uint256 userStake = stakedBalance[voter];
        uint256 maxWeight = (totalStakedSupply * VOTING_WEIGHT_CAP_PERCENTAGE) / PERCENTAGE_BASE;
        return userStake < maxWeight ? userStake : maxWeight;
    }
    
    function hasUserVoted(uint256 proposalId, address user) 
        external 
        view 
        returns (bool) 
    {
        return hasVoted[proposalId][user];
    }
    
    // ============ Admin Functions ============
    
    function updateProposalDeposit(uint256 newDeposit) external onlyOwner {
        proposalDeposit = newDeposit;
    }
    
    function updateVotingPeriod(uint256 newPeriod) external onlyOwner {
        require(newPeriod > 0, "Invalid period");
        votingPeriod = newPeriod;
    }
    
    // Allow the contract to receive ETH for funding proposals
    receive() external payable {}
}
