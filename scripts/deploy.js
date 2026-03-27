const hre = require("hardhat");

async function main() {
  console.log("Deploying InnovateDAO...");

  // Deploy parameters
  const membershipNFTAddress = "0x0000000000000000000000000000000000000000"; // Replace with actual NFT address
  const proposalDeposit = hre.ethers.parseEther("0.1"); // 0.1 ETH deposit
  const votingPeriod = 7 * 24 * 60 * 60; // 7 days in seconds

  // Get deployer
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  // Deploy InnovateDAO
  const InnovateDAO = await hre.ethers.getContractFactory("InnovateDAO");
  const dao = await InnovateDAO.deploy(
    membershipNFTAddress,
    proposalDeposit,
    votingPeriod
  );

  await dao.waitForDeployment();
  const daoAddress = await dao.getAddress();

  console.log("InnovateDAO deployed to:", daoAddress);
  console.log("Configuration:");
  console.log("  - Membership NFT:", membershipNFTAddress);
  console.log("  - Proposal Deposit:", hre.ethers.formatEther(proposalDeposit), "ETH");
  console.log("  - Voting Period:", votingPeriod / (24 * 60 * 60), "days");
  console.log("\nGovernance Rules:");
  console.log("  - Quorum: 60%");
  console.log("  - Supermajority: >66.6%");
  console.log("  - Voting Weight Cap: 33%");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
