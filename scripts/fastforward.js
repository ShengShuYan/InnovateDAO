// Block fast-forward helper script
// Usage: npx hardhat run scripts/fastforward.js --network localhost

const hre = require("hardhat");

async function main() {
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  console.log("📊 Current block number:", currentBlock);
  
  // Fast-forward 50,400 blocks (one full voting period)
  const blocksToMine = 50400;
  
  console.log(`⏩ Fast-forwarding ${blocksToMine} blocks...`);
  
  // Use hex format required by hardhat_mine
  const hexBlocks = "0x" + blocksToMine.toString(16);
  await hre.network.provider.send("hardhat_mine", [hexBlocks]);
  
  const newBlock = await hre.ethers.provider.getBlockNumber();
  console.log("✅ New block number:", newBlock);
  console.log("✅ Blocks mined:", newBlock - currentBlock);
  console.log("");
  console.log("Proposal execution is now available.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
