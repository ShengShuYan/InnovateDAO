# InnovateDAO Update Log

## 2026-04-03 - Fixes and Improvements

### Completed
1. Frontend vote-count formatting improved.
2. Wallet address synchronization fixed.
3. Duplicate delegate prevention added.
4. Automatic treasury funding on deploy removed; funding is now manual.

### Known Issue
- In some local sessions, proposal vote totals may not refresh correctly in UI after successful vote transactions.

### Quick Debug Checklist
```javascript
// Check proposal vote tuple
const votes = await governorContract.proposalVotes(proposalId);
console.log("For:", votes[1].toString());
console.log("Against:", votes[0].toString());

// Check user voting power
const power = await nftContract.getVotes(currentAccount);
console.log("Power:", power.toString());

// Check delegation target
const delegate = await nftContract.delegates(currentAccount);
console.log("Delegate:", delegate);
```

## 2026-04-01 - Initialization

### Architecture and Branch Setup
- Adopted OpenZeppelin Governor architecture.
- Preserved a backup branch and prepared the demo integration flow.

### Governance Configuration
- Voting delay: 1 block
- Voting period: 50,400 blocks (~1 week)
- Quorum: 60%
- Supermajority: 66.6%
- Vote cap per address: 33%
- Proposal deposit: 0.1 ETH

### Frontend Baseline
- Account controls: switch/copy/disconnect
- Donate-to-treasury interaction
- Automatic MetaMask account-change handling

## Ongoing Focus
1. Stabilize vote-count synchronization between on-chain values and UI.
2. Strengthen end-to-end tests for create/vote/execute/refund flow.
3. Improve runtime diagnostics and user-facing error messages.
