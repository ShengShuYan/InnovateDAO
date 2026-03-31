var CONTRACT_ADDRESSES = {
  nft: "0xFD471836031dc5108809D173A067e8486B9047A3",
  governor: "0xcbEAF3BDe82155F56486Fb5a1072cb8baAf547cc"
};

var CONTRACT_ABIS = {
  nft: [
    "function safeMint(address to) public",
    "function delegate(address delegatee) public",
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)"
  ],
  governor: [
    "function proposalDeposit() view returns (uint256)",
    "function proposeWithDeposit(address[] targets, uint256[] values, bytes[] calldatas, string description) payable returns (uint256)",
    "function state(uint256 proposalId) view returns (uint8)",
    "function proposalSnapshot(uint256 proposalId) view returns (uint256)",
    "function proposalDeadline(uint256 proposalId) view returns (uint256)",
    "function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
    "function getProposalId(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) view returns (uint256)",
    "function deposits(uint256 proposalId) view returns (uint256)",
    "function castVote(uint256 proposalId, uint8 support) returns (uint256)",
    "function claimRefund(uint256 proposalId) external",
    "function execute(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) payable returns (uint256)",
    "function hasVoted(uint256 proposalId, address account) view returns (bool)",
    "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)",
    "event ProposalExecuted(uint256 proposalId)",
    "event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)"
  ]
};

window.CONTRACT_ADDRESSES = CONTRACT_ADDRESSES;
window.CONTRACT_ABIS = CONTRACT_ABIS;

console.log("config loaded", CONTRACT_ADDRESSES, CONTRACT_ABIS);
