InnovateDAO Local Demo Guide

This project demonstrates the full local governance flow of InnovateDAO:
Connect Wallet -> Mint NFT + Delegate -> Submit Proposal -> Vote -> Execute / Refund.

1. Environment Setup
- Install Node.js (v20+ recommended; v18 can run but Hardhat may warn).
- Install the MetaMask browser extension.
- Install dependencies in the project root:
`npm install`

2. Start Local Chain and Deploy Contracts
- Open two terminal windows.
- Terminal A (start local chain):
`npx hardhat node`
- Terminal B (deploy contracts):
`npx hardhat run scripts/deploy.js --network localhost`

After deployment, NFT and Governor addresses are printed and `js/config.js` is updated automatically.

3. Frontend Configuration
- The deploy script writes fresh addresses to `js/config.js`.
- If `hardhat node` is restarted, chain state is reset and redeployment is required.
- If frontend addresses do not match the current local chain session, you may see proposal load failures, vote failures, or execute parameter mismatches.

4. Configure MetaMask Local Network
When clicking `Connect Wallet`, the app attempts to switch/add the local chain automatically.
If manual setup is needed, use:
- Network Name: Hardhat Local
- RPC URL: http://127.0.0.1:8545
- Chain ID: 1337
- Currency Symbol: ETH

Import a test account private key from the `npx hardhat node` terminal output.

5. Start Frontend
Open `index.html` via Live Server or any static server.
Example:
`python3 -m http.server 5500`

Open in browser:
`http://localhost:5500/?v=20260331`

The query string is used to avoid stale browser cache.

6. Minimum Demo Flow
1. Click `Connect Wallet`.
2. Click `Mint NFT & Delegate Votes`.
3. Submit a proposal via `Pay 0.1 ETH & Submit Proposal`.
4. Wait until proposal is `Active`, then vote with multiple accounts.
5. Execute when status becomes `Succeeded`.
6. Use `Claim Refund` when conditions are satisfied.

7. FAQ
Q1: Proposal remains `Pending`.
- This is expected until the snapshot/voting delay is reached.
- On local chain, keep mining blocks by sending transactions or manual mining.

Q2: Vote succeeds but displayed weight is zero.
- Usually caused by missing valid voting power at snapshot time.

Q3: `Execute` fails or reports parameter mismatch.
- Common causes:
	- Frontend addresses do not match current deployment.
	- Different local chain session after node restart.
	- Proposal has not reached `Succeeded`.
	- Treasury balance is insufficient.

Q4: Proposals disappeared after restart.
- `hardhat node` is ephemeral; restart resets chain state.

Q5: `Connect Wallet` keeps failing.
- Verify MetaMask is on `Hardhat Local` (Chain ID 1337).
- Reload with:
`http://localhost:5500/?v=20260331`

8. Demo Best Practices
- Use a fixed account set during demo.
- Do not restart local node mid-demo.
- Complete `mint + delegate` for all voting accounts before proposal creation.
- Verify proposal state and treasury balance before execution.
