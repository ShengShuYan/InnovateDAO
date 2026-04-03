const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

function updateFrontendConfig(nftAddress, governorAddress) {
  const configPath = path.join(__dirname, "..", "js", "config.js");
  const configContent = `var CONTRACT_ADDRESSES = {
  nft: "${nftAddress}",
  governor: "${governorAddress}"
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
    "function votingDelay() view returns (uint256)",
    "function votingPeriod() view returns (uint256)",
    "function quorum(uint256 blockNumber) view returns (uint256)",
    "function proposalThreshold() view returns (uint256)",
    "function fundTreasury() payable",
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
`;

  fs.writeFileSync(configPath, configContent, "utf8");
  console.log("✅ Frontend config updated:", configPath);
}

async function main() {
  const depositAmount = hre.ethers.parseEther("0.1");

  // 1. 部署 NFT
  const NFT = await hre.ethers.getContractFactory("InnovateDAONFT");
  const nft = await NFT.deploy();
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();
  console.log("✅ InnovateDAONFT 部署地址:", nftAddress);

  // 2. 部署 Governor 大脑
  const Governor = await hre.ethers.getContractFactory("InnovateDAOGovernor");
  const governor = await Governor.deploy(nftAddress, depositAmount);
  await governor.waitForDeployment();
  const governorAddress = await governor.getAddress();
  console.log("✅ InnovateDAOGovernor 部署地址:", governorAddress);

  // 3. Treasury初始余额（用户可使用Donate按钮手动充值）
  const treasuryBalance = await hre.ethers.provider.getBalance(governorAddress);
  console.log("\n💰 Treasury初始余额:", hre.ethers.formatEther(treasuryBalance), "ETH");
  console.log("📝 提示：可通过前端 'Donate to Treasury' 按钮充值");

  updateFrontendConfig(nftAddress, governorAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
