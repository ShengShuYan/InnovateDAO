const hre = require("hardhat");

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
  console.log("✅ InnovateDAOGovernor 部署地址:", await governor.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});