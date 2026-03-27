const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InnovateDAO", function () {
  let dao;
  let mockNFT;
  let owner;
  let proposer;
  let voter1;
  let voter2;
  let recipient;

  const PROPOSAL_DEPOSIT = ethers.parseEther("0.1");
  const VOTING_PERIOD = 7 * 24 * 60 * 60; // 7 days

  beforeEach(async function () {
    [owner, proposer, voter1, voter2, recipient] = await ethers.getSigners();

    // Deploy mock NFT
    const MockNFT = await ethers.getContractFactory("MockERC721");
    mockNFT = await MockNFT.deploy();

    // Deploy DAO
    const InnovateDAO = await ethers.getContractFactory("InnovateDAO");
    dao = await InnovateDAO.deploy(
      await mockNFT.getAddress(),
      PROPOSAL_DEPOSIT,
      VOTING_PERIOD
    );

    // Mint NFT to proposer
    await mockNFT.mint(proposer.address, 1);
  });

  describe("Deployment", function () {
    it("Should set the correct membership NFT", async function () {
      expect(await dao.membershipNFT()).to.equal(await mockNFT.getAddress());
    });

    it("Should set the correct proposal deposit", async function () {
      expect(await dao.proposalDeposit()).to.equal(PROPOSAL_DEPOSIT);
    });

    it("Should set the correct voting period", async function () {
      expect(await dao.votingPeriod()).to.equal(VOTING_PERIOD);
    });
  });

  describe("Staking", function () {
    it("Should allow users to stake ETH", async function () {
      const stakeAmount = ethers.parseEther("10");
      
      await dao.connect(voter1).stake({ value: stakeAmount });
      
      expect(await dao.stakedBalance(voter1.address)).to.equal(stakeAmount);
      expect(await dao.totalStakedSupply()).to.equal(stakeAmount);
    });

    it("Should emit Staked event", async function () {
      const stakeAmount = ethers.parseEther("10");
      
      await expect(dao.connect(voter1).stake({ value: stakeAmount }))
        .to.emit(dao, "Staked")
        .withArgs(voter1.address, stakeAmount);
    });

    it("Should revert when staking zero amount", async function () {
      await expect(
        dao.connect(voter1).stake({ value: 0 })
      ).to.be.revertedWith("Must stake positive amount");
    });
  });

  describe("Proposal Creation", function () {
    beforeEach(async function () {
      // Fund DAO
      await owner.sendTransaction({
        to: await dao.getAddress(),
        value: ethers.parseEther("100")
      });
    });

    it("Should allow NFT holders to create proposals", async function () {
      const amount = ethers.parseEther("5");
      
      await dao.connect(proposer).createProposal(
        recipient.address,
        amount,
        "Test Proposal",
        { value: PROPOSAL_DEPOSIT }
      );
      
      expect(await dao.proposalCount()).to.equal(1);
      
      const proposal = await dao.getProposal(1);
      expect(proposal.proposer).to.equal(proposer.address);
      expect(proposal.recipient).to.equal(recipient.address);
      expect(proposal.amount).to.equal(amount);
    });

    it("Should revert if not NFT holder", async function () {
      await expect(
        dao.connect(voter1).createProposal(
          recipient.address,
          ethers.parseEther("5"),
          "Test",
          { value: PROPOSAL_DEPOSIT }
        )
      ).to.be.revertedWith("Must hold membership NFT");
    });

    it("Should revert with incorrect deposit", async function () {
      await expect(
        dao.connect(proposer).createProposal(
          recipient.address,
          ethers.parseEther("5"),
          "Test",
          { value: ethers.parseEther("0.05") }
        )
      ).to.be.revertedWith("Incorrect deposit amount");
    });
  });

  describe("Voting", function () {
    let proposalId;

    beforeEach(async function () {
      // Fund DAO
      await owner.sendTransaction({
        to: await dao.getAddress(),
        value: ethers.parseEther("100")
      });

      // Stake tokens
      await dao.connect(voter1).stake({ value: ethers.parseEther("30") });
      await dao.connect(voter2).stake({ value: ethers.parseEther("20") });

      // Create proposal
      const tx = await dao.connect(proposer).createProposal(
        recipient.address,
        ethers.parseEther("5"),
        "Test Proposal",
        { value: PROPOSAL_DEPOSIT }
      );
      
      proposalId = 1;
    });

    it("Should allow stakers to vote", async function () {
      await dao.connect(voter1).castVote(proposalId, 1); // Support
      
      const proposal = await dao.getProposal(proposalId);
      expect(proposal.totalSupport).to.be.gt(0);
    });

    it("Should cap voting weight at 33%", async function () {
      const totalStaked = ethers.parseEther("50");
      const maxWeight = (totalStaked * 33n) / 100n;
      
      await dao.connect(voter1).castVote(proposalId, 1);
      
      const proposal = await dao.getProposal(proposalId);
      expect(proposal.totalSupport).to.equal(maxWeight);
    });

    it("Should prevent double voting", async function () {
      await dao.connect(voter1).castVote(proposalId, 1);
      
      await expect(
        dao.connect(voter1).castVote(proposalId, 1)
      ).to.be.revertedWith("Already voted");
    });

    it("Should lock votes", async function () {
      await dao.connect(voter1).castVote(proposalId, 1);
      
      expect(await dao.activeVotes(voter1.address)).to.equal(1);
    });
  });

  describe("Proposal Execution", function () {
    let proposalId;

    beforeEach(async function () {
      // Fund DAO
      await owner.sendTransaction({
        to: await dao.getAddress(),
        value: ethers.parseEther("100")
      });

      // Stake tokens for quorum
      await dao.connect(voter1).stake({ value: ethers.parseEther("40") });
      await dao.connect(voter2).stake({ value: ethers.parseEther("30") });

      // Create proposal
      await dao.connect(proposer).createProposal(
        recipient.address,
        ethers.parseEther("5"),
        "Test Proposal",
        { value: PROPOSAL_DEPOSIT }
      );
      
      proposalId = 1;
    });

    it("Should execute proposal with quorum and supermajority", async function () {
      // Vote (need 60% participation and >66.6% approval)
      await dao.connect(voter1).castVote(proposalId, 1); // Support
      await dao.connect(voter2).castVote(proposalId, 1); // Support

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine");

      const balanceBefore = await ethers.provider.getBalance(recipient.address);
      
      await dao.executeProposal(proposalId);
      
      const balanceAfter = await ethers.provider.getBalance(recipient.address);
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("5"));
    });

    it("Should fail proposal without quorum", async function () {
      // Only vote with small amount (below 60% quorum)
      await dao.connect(voter1).castVote(proposalId, 1);

      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [VOTING_PERIOD + 1]);
      await ethers.provider.send("evm_mine");

      await dao.executeProposal(proposalId);
      
      const proposal = await dao.getProposal(proposalId);
      expect(proposal.status).to.equal(3); // Failed
    });
  });

  describe("Withdrawal", function () {
    it("Should allow withdrawal with no active votes", async function () {
      const stakeAmount = ethers.parseEther("10");
      await dao.connect(voter1).stake({ value: stakeAmount });
      
      await dao.connect(voter1).withdrawStake(stakeAmount);
      
      expect(await dao.stakedBalance(voter1.address)).to.equal(0);
    });

    it("Should prevent withdrawal with active votes", async function () {
      // Fund DAO and stake
      await owner.sendTransaction({
        to: await dao.getAddress(),
        value: ethers.parseEther("100")
      });
      
      await dao.connect(voter1).stake({ value: ethers.parseEther("30") });
      
      // Create and vote on proposal
      await dao.connect(proposer).createProposal(
        recipient.address,
        ethers.parseEther("5"),
        "Test",
        { value: PROPOSAL_DEPOSIT }
      );
      
      await dao.connect(voter1).castVote(1, 1);
      
      await expect(
        dao.connect(voter1).withdrawStake(ethers.parseEther("10"))
      ).to.be.revertedWith("Cannot withdraw with active votes");
    });
  });
});
