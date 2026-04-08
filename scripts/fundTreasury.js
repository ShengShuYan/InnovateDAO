// Treasury funding script
// Usage: npx hardhat run scripts/fundTreasury.js --network localhost

const hre = require("hardhat");

async function main() {
  const governorAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  
  const [owner] = await hre.ethers.getSigners();
  
  console.log("💰 Preparing to fund Treasury...");
  console.log("From account:", owner.address);
  console.log("To Treasury:", governorAddress);
  
  // Check current balance
  const currentBalance = await hre.ethers.provider.getBalance(governorAddress);
  console.log("Current Treasury balance:", hre.ethers.formatEther(currentBalance), "ETH");
  
  // Fund 20 ETH
  const amount = hre.ethers.parseEther("20");
  console.log("\nSending transaction...");
  
  const tx = await owner.sendTransaction({
    to: governorAddress,
    value: amount
  });
  
  await tx.wait();
  console.log("✅ Transaction confirmed:", tx.hash);
  
  // Check new balance
  const newBalance = await hre.ethers.provider.getBalance(governorAddress);
  console.log("New Treasury balance:", hre.ethers.formatEther(newBalance), "ETH");
  
  console.log("\n🎉 Treasury funded successfully. You can now create funding proposals.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
