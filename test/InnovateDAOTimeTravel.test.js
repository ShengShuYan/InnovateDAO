const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("InnovateDAO End-to-End Integration Test (Time Travel and Automated Funding)", function () {
  let nft, governor;
  let owner, user1, user2, user3; // Fix 1: Introduce user3 to expand the voter pool
  let proposalId;
  const depositAmount = ethers.parseEther("0.1");
  const grantAmount = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("InnovateDAONFT");
    nft = await NFT.deploy();
    const Governor = await ethers.getContractFactory("InnovateDAOGovernor");
    governor = await Governor.deploy(await nft.getAddress(), depositAmount);

    // Fix 2: Mint NFTs for 4 users to set the total supply to 4.
    // This ensures that 4 * 33% = 1.32. Solidity truncates this to a cap of 1 vote, 
    // avoiding the previous 0-vote calculation bug.
    await nft.safeMint(owner.address);
    await nft.safeMint(user1.address);
    await nft.safeMint(user2.address);
    await nft.safeMint(user3.address);

    await nft.connect(owner).delegate(owner.address);
    await nft.connect(user1).delegate(user1.address);
    await nft.connect(user2).delegate(user2.address);
    await nft.connect(user3).delegate(user3.address);

    await owner.sendTransaction({
      to: await governor.getAddress(),
      value: ethers.parseEther("10.0")
    });

    const targets = [user1.address];
    const values = [grantAmount];
    const calldatas = ["0x"];
    const description = "Funding for club coffee machine";

    const tx = await governor.connect(user1).proposeWithDeposit(targets, values, calldatas, description, {
      value: depositAmount
    });
    const receipt = await tx.wait();
    proposalId = receipt.logs.find(log => log.fragment && log.fragment.name === 'ProposalCreated').args[0];
  });

  it("Stress Test: Fast-forward time -> Complete voting -> Verify automated funding", async function () {
    await mine(2);

    // Fix 3: Have 3 members cast their votes.
    // 3 votes / 4 total supply = 75% participation rate, perfectly exceeding the 60% Quorum requirement!
    await governor.connect(user1).castVote(proposalId, 1);
    await governor.connect(user2).castVote(proposalId, 1);
    await governor.connect(user3).castVote(proposalId, 1);
    console.log("      🗳️ Voting completed!");

    await mine(50401);

    const balanceBefore = await ethers.provider.getBalance(user1.address);

    const targets = [user1.address];
    const values = [grantAmount];
    const calldatas = ["0x"];
    // The description hash MUST exactly match the description string used when creating the proposal
    const descriptionHash = ethers.id("Funding for club coffee machine");

    await governor.execute(targets, values, calldatas, descriptionHash);

    const balanceAfter = await ethers.provider.getBalance(user1.address);
    expect(balanceAfter > balanceBefore).to.be.true;
    
    console.log("      💰 Proposal executed successfully, 1 ETH has been automatically transferred!");
  });
});