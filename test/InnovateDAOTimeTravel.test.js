const { expect } = require("chai");
const { ethers } = require("hardhat");
const { mine } = require("@nomicfoundation/hardhat-network-helpers");

describe("InnovateDAO 全链路集成测试 (时间旅行与自动打款)", function () {
  let nft, governor;
  let owner, user1, user2, user3; // 🕵️‍♂️ 修复点 1：多拉一个 user3 进来凑数
  let proposalId;
  const depositAmount = ethers.parseEther("0.1");
  const grantAmount = ethers.parseEther("1.0");

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    const NFT = await ethers.getContractFactory("InnovateDAONFT");
    nft = await NFT.deploy();
    const Governor = await ethers.getContractFactory("InnovateDAOGovernor");
    governor = await Governor.deploy(await nft.getAddress(), depositAmount);

    // 🕵️‍♂️ 修复点 2：给 4 个人发 NFT。总发行量 = 4。
    // 这样 4 * 33% = 1.32，Solidity 取整后上限是 1 票，不再是 0 票了！
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
    const description = "社团咖啡机采购经费";

    const tx = await governor.connect(user1).proposeWithDeposit(targets, values, calldatas, description, {
      value: depositAmount
    });
    const receipt = await tx.wait();
    proposalId = receipt.logs.find(log => log.fragment && log.fragment.name === 'ProposalCreated').args[0];
  });

  it("极限测试：快进时间 -> 完成投票 -> 验证资金自动拨付", async function () {
    await mine(2);

    // 🕵️‍♂️ 修复点 3：让 3 个人投票。
    // 3 票 / 总共 4 票 = 75% 参与率，完美超过 60% 的 Quorum 要求！
    await governor.connect(user1).castVote(proposalId, 1);
    await governor.connect(user2).castVote(proposalId, 1);
    await governor.connect(user3).castVote(proposalId, 1);
    console.log("      🗳️ 投票已完成！");

    await mine(50401);

    const balanceBefore = await ethers.provider.getBalance(user1.address);

    const targets = [user1.address];
    const values = [grantAmount];
    const calldatas = ["0x"];
    const descriptionHash = ethers.id("社团咖啡机采购经费");

    await governor.execute(targets, values, calldatas, descriptionHash);

    const balanceAfter = await ethers.provider.getBalance(user1.address);
    expect(balanceAfter > balanceBefore).to.be.true;
    
    console.log("      💰 提案执行成功，1 ETH 资金已自动拨付到账！");
  });
});