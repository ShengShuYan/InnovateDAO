# InnovateDAO Demo Flow (Li - Frontend & Demo)

## 0) Environment
- Start local chain: `npx hardhat node`
- Deploy to localhost: `npx hardhat run scripts/deploy.js --network localhost`
- Update `js/config.js` with new NFT/Governor addresses
- Open frontend (e.g. Live Server)

## 1) Wallet Connection
- Connect wallet on `localhost:8545`
- Confirm top status shows Connected and chain id

## 2) Membership Activation
- Use 4 different test accounts
- For each account, click `Mint NFT & Delegate Votes`
- Purpose: ensure vote weight is available before proposal snapshot

## 3) Create Proposal
- Switch to proposer account
- Fill description + target + amount
- Submit with 0.1 ETH deposit
- Click `Refresh` and verify proposal appears in Proposal Board

## 4) Vote
- Wait until status changes from `Pending` to `Active`
- Switch to different accounts and vote `For/Against/Abstain`
- Click `Refresh` after each vote

## 5) Execute
- After voting period and success conditions, click `Execute`
- Confirm transaction and refresh

## 6) Error Handling Talking Points
- Duplicate vote -> "You already voted on this proposal"
- Wrong action state -> "Invalid proposal state for this action"
- Wrong network/deployment -> explicit contract-not-found message

## 7) Quick Recovery
- If state is messy: restart local chain + redeploy + update config + hard refresh browser
