const { expect } = require("chai");
const { ethers } = require("hardhat");
// Import the Hardhat "time machine" helper to mine blocks and simulate the passing of voting periods
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("InnovateDAO Core Logic Tests", function () {
  let nft, governor;
  let owner, user1, user2;
  const depositAmount = ethers.parseEther("0.1"); // Set the required proposal deposit to 0.1 ETH

  // Deploy a fresh contract environment before each test case
  beforeEach(async function () {
    // Get simulated user wallet accounts
    [owner, user1, user2] = await ethers.getSigners();

    // 1. Deploy the NFT contract
    const NFT = await ethers.getContractFactory("InnovateDAONFT");
    nft = await NFT.deploy();

    // 2. Deploy the Governor contract
    const Governor = await ethers.getContractFactory("InnovateDAOGovernor");
    governor = await Governor.deploy(await nft.getAddress(), depositAmount);

    // 3. Initial Setup: Mint DAO membership cards (NFTs) to user1 and user2
    await nft.safeMint(user1.address);
    await nft.safeMint(user2.address);

    // ⚠️ Crucial Step: In the OpenZeppelin governance system, holding the NFT is not enough.
    // Users must call delegate() to assign their voting power to themselves, generating a historical snapshot.
    await nft.connect(user1).delegate(user1.address);
    await nft.connect(user2).delegate(user2.address);
  });

  describe("Proposal and Deposit Mechanism", function () {
    it("Test 1: Should fail to create a proposal without the exact deposit", async function () {
      // Prepare parameters for a dummy proposal
      const targets = [user1.address];
      const values = [0];
      const calldatas = ["0x"];
      const description = "Buy a coffee machine for the club";

      // Attempt to propose without sending the ETH deposit, expecting a revert
      await expect(
        governor.connect(user1).proposeWithDeposit(targets, values, calldatas, description)
      ).to.be.revertedWith("InnovateDAO: Must pay the exact proposal deposit");
    });

    it("Test 2: Should successfully create a proposal and record the deposit when 0.1 ETH is paid", async function () {
      const targets = [user1.address];
      const values = [0];
      const calldatas = ["0x"];
      const description = "Buy a coffee machine for the club";

      // user1 initiates the proposal with the 0.1 ETH deposit
      const tx = await governor.connect(user1).proposeWithDeposit(targets, values, calldatas, description, {
        value: depositAmount
      });
      const receipt = await tx.wait();

      // Parse the proposalId from the transaction logs
      const proposalCreatedEvent = receipt.logs.find(log => log.fragment && log.fragment.name === 'ProposalCreated');
      const proposalId = proposalCreatedEvent.args[0];

      // Verify that the contract correctly recorded the deposit and proposer
      expect(await governor.deposits(proposalId)).to.equal(depositAmount);
      expect(await governor.proposers(proposalId)).to.equal(user1.address);
      
      console.log(`      ✅ Proposal successfully created! Proposal ID: ${proposalId}`);
    });
  });
});