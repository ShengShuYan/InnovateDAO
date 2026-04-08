# InnovateDAO Project Summary

## Scope
InnovateDAO is a local-demo governance system built on OpenZeppelin Governor and ERC721Votes.

Core demo flow:
Connect wallet -> Mint NFT -> Delegate voting power -> Create proposal with deposit -> Vote -> Execute or refund.

## Implemented Features
1. Account management in frontend
- Switch account
- Copy address
- Disconnect
- Automatic MetaMask account-change handling

2. Treasury funding
- Manual funding from frontend (`Donate to Treasury`)

3. Duplicate-action guards
- Prevent mint when membership NFT already exists
- Prevent repeated delegate operations

4. Deployment and helper scripts
- `scripts/deploy.js`
- `scripts/fastforward.js`
- `scripts/fundTreasury.js`

## Governance Parameters (Current)
- Voting delay: 1 block
- Voting period: 50,400 blocks
- Quorum: 60% (`GovernorVotesQuorumFraction(60)`)
- Supermajority: >66.6% yes votes among cast yes/no votes
- Vote weight cap: 33% per address
- Proposal deposit: 0.1 ETH

## Known Risk
- Vote count display mismatch may occur in some local test sessions.

Potential root causes:
- Snapshot timing vs mint/delegate timing
- Delegation state not established before snapshot
- Frontend parsing/display issues for `proposalVotes()`

## Recommended Next Priorities
1. Fix vote-count display and validate against on-chain values.
2. Run full end-to-end scenario tests (create -> vote -> execute -> treasury check).
3. Improve frontend state explanations (Pending/Active/Succeeded/Defeated/Executed).
4. Add user voting-power visibility and clearer transaction error messages.

## Current Status
- Branch intent: `main`
- Overall status: core functionality is in place; polish and validation are ongoing.
