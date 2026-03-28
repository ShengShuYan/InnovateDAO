// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";

/**
 * @title InnovateDAOGovernor
 * @notice 结合了 OpenZeppelin 工业级安全标准与 FT5004 定制化需求的核心治理大脑
 */
contract InnovateDAOGovernor is 
    Governor, 
    GovernorSettings, 
    GovernorCountingSimple, 
    GovernorVotes, 
    GovernorVotesQuorumFraction 
{
    // ============ 自定义状态变量 ============
    
    uint256 public proposalDeposit; // 提案所需的押金金额
    mapping(uint256 => uint256) public deposits; // 记录每个提案的押金
    mapping(uint256 => address) public proposers; // 记录提案发起人

    // ============ 构造函数 ============
    
    constructor(
        IVotes _token, 
        uint256 _proposalDeposit
    )
        Governor("InnovateDAOGovernor")
        GovernorSettings(
            1, /* 1 个区块的投票延迟 (Voting Delay) */
            50400, /* 约 1 周的投票期 (Voting Period，假设 12 秒一个区块) */
            0 /* 提案门槛 (Proposal Threshold)，我们用押金代替了代币门槛 */
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(60) // 核心亮点：强制 60% 的法定参与率 (Quorum)
    {
        proposalDeposit = _proposalDeposit;
    }

    // ============ 核心定制 1：带押金的提案机制 (防垃圾信息) ============
    
    /**
     * @notice 包装了标准的 propose 函数，强制要求缴纳押金
     */
    function proposeWithDeposit(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public payable returns (uint256) {
        require(msg.value == proposalDeposit, "InnovateDAO: Must pay the exact proposal deposit");
        
        // 调用底层框架生成提案
        uint256 proposalId = super.propose(targets, values, calldatas, description);
        
        // 记录押金状态
        deposits[proposalId] = msg.value;
        proposers[proposalId] = msg.sender;
        
        return proposalId;
    }

    // ============ 核心定制 2：33% 投票权重上限 (防巨鲸垄断) ============
    
    /**
     * @notice 重写计票逻辑。在记录选票前，动态拦截并计算 33% 权重上限
     */
    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight,
        bytes memory params
    ) internal virtual override(Governor, GovernorCountingSimple) returns (uint256) {
        // 获取提案发起时的总票数快照
        uint256 timepoint = proposalSnapshot(proposalId);
        uint256 totalPastSupply = token().getPastTotalSupply(timepoint);
        
        // 计算 33% 的硬性上限
        uint256 maxWeight = (totalPastSupply * 33) / 100;
        
        // 如果用户的票数超过上限，强行截断为 maxWeight
        uint256 effectiveWeight = weight > maxWeight ? maxWeight : weight;
        
        // 调用底层的简单计票逻辑（按裁剪后的权重计入赞成/反对）并返回结果
        return super._countVote(proposalId, account, support, effectiveWeight, params);
    }

    // ============ 核心定制 3：66.6% 绝对多数门槛 ============
    
    /**
     * @notice 重写提案成功判定逻辑。默认是赞成>反对，我们改为必须达到 66.6% 赞成率
     */
    function _voteSucceeded(uint256 proposalId) internal view virtual override(Governor, GovernorCountingSimple) returns (bool) {
        (uint256 againstVotes, uint256 forVotes, ) = proposalVotes(proposalId);
        uint256 totalVotes = againstVotes + forVotes;
        
        if (totalVotes == 0) return false;
        
        // 赞成票必须大于总票数的 66.6% (6666/10000)
        return forVotes > (totalVotes * 6666) / 10000;
    }

    // ============ 核心定制 4：未达法定人数的押金惩罚 (Slashing) ============
    
    /**
     * @notice 提案结束后，允许发起人取回押金。如果未达法定人数，押金将被扣留。
     */
    function claimRefund(uint256 proposalId) external {
        require(state(proposalId) == ProposalState.Defeated || state(proposalId) == ProposalState.Executed || state(proposalId) == ProposalState.Succeeded, "InnovateDAO: Proposal not finished");
        require(msg.sender == proposers[proposalId], "InnovateDAO: Only proposer can claim");
        
        uint256 amount = deposits[proposalId];
        require(amount > 0, "InnovateDAO: No deposit to claim or already claimed");

        // 惩罚机制：如果提案被否决，且总票数未达到 60% 法定人数，直接没收押金
        if (state(proposalId) == ProposalState.Defeated && !_quorumReached(proposalId)) {
            revert("InnovateDAO: Deposit slashed due to quorum shortfall");
        }

        // 清零状态并退款
        deposits[proposalId] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "InnovateDAO: Refund failed");
    }

    // ============ 必需的系统重写 (Solidity 语法要求) ============
    // 这些函数只是为了解决多重继承的冲突，让框架正常运转
    
    function votingDelay() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber) public view override(Governor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }
}