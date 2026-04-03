// 快进区块辅助脚本
// 使用方法: npx hardhat run scripts/fastforward.js --network localhost

const hre = require("hardhat");

async function main() {
  const currentBlock = await hre.ethers.provider.getBlockNumber();
  console.log("📊 当前区块高度:", currentBlock);
  
  // 快进50400个区块（完成投票周期）
  const blocksToMine = 50400;
  
  console.log(`⏩ 正在快进 ${blocksToMine} 个区块...`);
  
  // 使用十六进制格式
  const hexBlocks = "0x" + blocksToMine.toString(16);
  await hre.network.provider.send("hardhat_mine", [hexBlocks]);
  
  const newBlock = await hre.ethers.provider.getBlockNumber();
  console.log("✅ 新区块高度:", newBlock);
  console.log("✅ 已快进区块数:", newBlock - currentBlock);
  console.log("");
  console.log("现在可以执行提案了！");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
