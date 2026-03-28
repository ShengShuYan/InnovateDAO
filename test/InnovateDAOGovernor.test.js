const { expect } = require("chai");
const { ethers } = require("hardhat");
// 引入 Hardhat 提供的“时间机器”，用来快进区块时间，模拟投票周期的流逝
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("InnovateDAO 核心逻辑测试", function () {
  let nft, governor;
  let owner, user1, user2;
  const depositAmount = ethers.parseEther("0.1"); // 设定提案押金为 0.1 ETH

  // 在每个测试用例运行前，重新部署干净的合约环境
  beforeEach(async function () {
    // 获取几个模拟用户的钱包地址
    [owner, user1, user2] = await ethers.getSigners();

    // 1. 部署 NFT 合约
    const NFT = await ethers.getContractFactory("InnovateDAONFT");
    nft = await NFT.deploy();

    // 2. 部署 Governor 治理合约
    const Governor = await ethers.getContractFactory("InnovateDAOGovernor");
    governor = await Governor.deploy(await nft.getAddress(), depositAmount);

    // 3. 基础设置：给 user1 和 user2 各发一张 DAO 成员卡 (NFT)
    await nft.safeMint(user1.address);
    await nft.safeMint(user2.address);

    // ⚠️ 极其关键的一步：在 OpenZeppelin 体系里，拿到 NFT 还不够，
    // 必须调用 delegate() 把票权“委托”给自己，系统才会生成快照记录你的权重。
    await nft.connect(user1).delegate(user1.address);
    await nft.connect(user2).delegate(user2.address);
  });

  describe("提案与押金机制", function () {
    it("测试 1：不交押金或押金金额不对，应该无法发起提案", async function () {
      // 准备一个空提案的参数
      const targets = [user1.address];
      const values = [0];
      const calldatas = ["0x"];
      const description = "给社团买一台咖啡机";

      // 尝试发起提案，但不附带 ETH 押金，期望它被拦截并报错
      await expect(
        governor.connect(user1).proposeWithDeposit(targets, values, calldatas, description)
      ).to.be.revertedWith("InnovateDAO: Must pay the exact proposal deposit");
    });

    it("测试 2：交足 0.1 ETH 押金，成功发起提案并记录押金", async function () {
      const targets = [user1.address];
      const values = [0];
      const calldatas = ["0x"];
      const description = "给社团买一台咖啡机";

      // user1 带着 0.1 ETH 押金发起提案
      const tx = await governor.connect(user1).proposeWithDeposit(targets, values, calldatas, description, {
        value: depositAmount
      });
      const receipt = await tx.wait();

      // 从交易日志中解析出 proposalId
      const proposalCreatedEvent = receipt.logs.find(log => log.fragment && log.fragment.name === 'ProposalCreated');
      const proposalId = proposalCreatedEvent.args[0];

      // 验证合约是否正确记录了这笔押金
      expect(await governor.deposits(proposalId)).to.equal(depositAmount);
      expect(await governor.proposers(proposalId)).to.equal(user1.address);
      
      console.log(`      ✅ 提案成功创建！Proposal ID: ${proposalId}`);
    });
  });
});