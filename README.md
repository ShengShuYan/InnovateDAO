InnovateDAO Local Demo Guide
本项目用于本地演示 InnovateDAO 的完整治理流程：
连接钱包 -> Mint NFT + Delegate -> 提交提案 -> 投票 -> 执行 / 退款。

1. 环境准备
安装 Node.js（建议 v20+，当前你本机 v18 也能跑，但 Hardhat 会警告）。
安装浏览器插件 MetaMask。
在项目根目录安装依赖：
npm install
2. 启动本地链与部署合约
打开两个终端窗口。

第一个终端启动本地链：
npx hardhat node

第二个终端部署合约：
npx hardhat run scripts/deploy.js --network localhost

部署成功后会输出两条地址（NFT 和 Governor）。

3. 更新前端配置 js/config.js
把部署输出的新地址填入 CONTRACT_ADDRESSES：

nft: NFT 合约地址
governor: Governor 合约地址
如果地址没更新，前端会出现：

无法加载提案
投票失败
execute 参数不匹配
4. 配置 MetaMask 本地网络
在 MetaMask 添加网络：

Network Name: Hardhat Local
RPC URL: http://127.0.0.1:8545
Chain ID: 31337（如你本地配置是 1337，则按实际为准）
Currency Symbol: ETH
从 npx hardhat node 终端复制测试账户私钥，导入 MetaMask。

5. 启动前端
可用 Live Server 打开 index.html，或使用任意静态服务器。
示例（如果你有 Python）：
python3 -m http.server 5500

浏览器访问：
http://127.0.0.1:5500

6. 最小可行演示流程
点击 Connect Wallet。
点击 Mint NFT & Delegate Votes。
填写提案信息并点击 Pay 0.1 ETH & Submit Proposal。
等提案进入 Active 后用多个账户投票。
提案到 Succeeded 后执行 Execute。
根据状态尝试 Claim Refund（仅提案人可领取，且需满足合约条件）。
更多演示细节见：DEMO_FLOW.md。

7. 常见问题
Q1: 提案一直 Pending
这是正常的，需要等待达到 snapshot 区块（votingDelay）。
在本地链可通过继续发送交易推进区块。

Q2: 投票成功但显示权重为 0
通常是快照时没有有效投票权（未提前 delegate 或快照前票权不足）。

Q3: Execute failed / params not found
常见原因：

前端地址与当前部署不一致
不是同一条本地链会话（重启 node 后链状态重置）
提案未达到 Succeeded
金库余额不足导致执行目标调用失败
Q4: 为什么重启后提案没了
hardhat node 是本地临时链。重启后状态重置，历史提案会消失，需要重新部署并重新创建提案。

8. 演示建议
演示前固定一套地址，不中途重启 node。
提案前先完成所有需要投票账号的 mint + delegate。
演示 execute 前先确认提案状态和金库余额。
