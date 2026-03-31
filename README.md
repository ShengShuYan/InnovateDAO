InnovateDAO Local Demo Guide

本项目用于本地演示 InnovateDAO 的完整治理流程：
连接钱包 -> Mint NFT + Delegate -> 提交提案 -> 投票 -> 执行 / 退款。

1. 环境准备
安装 Node.js（建议 v20+，当前本机 v18 也能运行，但 Hardhat 会警告）。
安装浏览器插件 MetaMask。
在项目根目录安装依赖：
`npm install`

2. 启动本地链与部署合约
打开两个终端窗口。

第一个终端启动本地链：
`npx hardhat node`

第二个终端部署合约：
`npx hardhat run scripts/deploy.js --network localhost`

部署成功后会输出两条地址（NFT 和 Governor），并自动更新前端的 `js/config.js`。

3. 前端配置说明
当前部署脚本会自动把新地址写入 `js/config.js`，一般不需要再手动修改。
如果你重启了 `hardhat node`，本地链状态会重置，需要重新部署一次。
如果地址和当前本地链会话不一致，前端可能出现：

无法加载提案
投票失败
execute 参数不匹配

4. 配置 MetaMask 本地网络
点击 `Connect Wallet` 时，前端会尝试自动切换到本地链；如果 MetaMask 中还没有这条网络，也会尝试自动添加。
如果需要手动添加，请使用：

Network Name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 1337
Currency Symbol: ETH

从 `npx hardhat node` 终端复制测试账户私钥，导入 MetaMask。

5. 启动前端
可用 Live Server 打开 `index.html`，或使用任意静态服务器。
示例（如果你有 Python）：
`python3 -m http.server 5500`

浏览器访问：
`http://localhost:5500/?v=20260331`

说明：
带上 `?v=20260331` 是为了避免浏览器继续使用旧缓存。

6. 最小可行演示流程
点击 `Connect Wallet`。
点击 `Mint NFT & Delegate Votes`。
填写提案信息并点击 `Pay 0.1 ETH & Submit Proposal`。
等提案进入 `Active` 后用多个账户投票。
提案到 `Succeeded` 后执行 `Execute`。
根据状态尝试 `Claim Refund`（仅提案人可领取，且需满足合约条件）。
更多演示细节见：`js/DEMO_FLOW.md`。

7. 常见问题
Q1: 提案一直 Pending
这是正常的，需要等待达到 snapshot 区块（`votingDelay`）。
在本地链可通过继续发送交易或手动挖块推进区块高度。

Q2: 投票成功但显示权重为 0
通常是快照时没有有效投票权（未提前 delegate 或快照前票权不足）。

Q3: Execute failed / params not found
常见原因：

前端地址与当前部署不一致
不是同一条本地链会话（重启 node 后链状态重置）
提案未达到 Succeeded
金库余额不足导致执行目标调用失败

Q4: 为什么重启后提案没了
`hardhat node` 是本地临时链。重启后状态重置，历史提案会消失，需要重新部署并重新创建提案。

Q5: Connect Wallet 一直失败怎么办
先确认 MetaMask 当前网络是 `Hardhat Local`（Chain ID 1337）。
如果浏览器仍然读到旧地址或旧脚本，重新打开：
`http://localhost:5500/?v=20260331`

8. 演示建议
演示前固定一套地址，不中途重启 `node`。
提案前先完成所有需要投票账号的 `mint + delegate`。
演示 `execute` 前先确认提案状态和金库余额。
