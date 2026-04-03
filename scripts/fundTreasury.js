// 给Treasury充值脚本
// 使用方法: npx hardhat run scripts/fundTreasury.js --network localhost

const hre = require("hardhat");

async function main() {
  const governorAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  const [owner] = await hre.ethers.getSigners();
  
  console.log("💰 准备给Treasury充值...");
  console.log("从账户:", owner.address);
  console.log("到Treasury:", governorAddress);
  
  // 检查当前余额
  const currentBalance = await hre.ethers.provider.getBalance(governorAddress);
  console.log("Treasury当前余额:", hre.ethers.formatEther(currentBalance), "ETH");
  
  // 充值20 ETH
  const amount = hre.ethers.parseEther("20");
  console.log("\n转账中...");
  
  const tx = await owner.sendTransaction({
    to: governorAddress,
    value: amount
  });
  
  await tx.wait();
  console.log("✅ 交易确认:", tx.hash);
  
  // 检查新余额
  const newBalance = await hre.ethers.provider.getBalance(governorAddress);
  console.log("Treasury新余额:", hre.ethers.formatEther(newBalance), "ETH");
  
  console.log("\n🎉 Treasury充值成功！现在可以创建提案申请资金了。");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
