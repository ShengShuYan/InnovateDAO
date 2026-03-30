// js/config.js

// 1. Deployed Contract Addresses
const CONTRACT_ADDRESSES = {
    nft: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    governor: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512"
};

// 2. Human-Readable ABIs
const CONTRACT_ABIS = {
    nft: [
        "function safeMint(address to) public",
        "function delegate(address delegatee) public"
    ],
    governor: [
        "function proposeWithDeposit(address[] targets, uint256[] values, bytes[] calldatas, string description) public payable returns (uint256)"
    ]
};