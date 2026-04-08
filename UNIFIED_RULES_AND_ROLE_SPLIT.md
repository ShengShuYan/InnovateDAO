# Unified Rules and Initial Role Split

## 1. Unified Governance Rules
To keep smart contracts, frontend behavior, and testing aligned, the project uses the following shared rules:

- Proposal states are treated as `Pending`, `Active`, `Succeeded`, `Defeated/Failed`, and `Executed`.
- Voting power has a 33% effective cap per address.
- Quorum is defined as 60% participation.
- Supermajority requires approval above 66.6% of counted votes.
- Proposal creation requires a refundable deposit.
- Deposit refund policy follows contract conditions.
- Proposal execution is allowed only after voting period ends and governance thresholds are satisfied.
- Frontend must consistently show wallet/governance fields: membership NFT status, voting power, proposal metadata, tallies, status, and action availability.

## 2. User-Flow Alignment
All synchronization discussions should follow this flow:
1. Connect wallet
2. Stake or obtain governance eligibility
3. Create proposal
4. Vote
5. Execute
6. Withdraw (if applicable)

## 3. Responsibility Split

### Governance Rules and Smart Contracts
Owner: Sheng
- Define and maintain on-chain governance rules.
- Implement Solidity architecture and core modules.
- Deliver interface/state/event documentation.
- Fix contract logic issues and support deployment tuning.

### Frontend and Demo Flow
Owner: Li
- Build DApp interface and interaction flow.
- Integrate wallet connection and contract calls.
- Implement proposal/voting/execution pages.
- Keep demo flow stable and user-facing messages clear.

### Testing, Validation, and Documentation
Owner: Tian
- Design and maintain test plans and cases.
- Validate edge cases using Hardhat/Foundry.
- Track defects, verify fixes, and run regression checks.
- Consolidate final technical and demo documentation.

## 4. Collaboration Rules
- Confirm governance rules before implementation starts.
- Assign each core module a primary owner and reviewer.
- Measure sync progress by end-to-end flow readiness.
- Log major decisions and changes for transparency.

## 5. Shared Tasks
- Finalize project scope and governance assumptions.
- Confirm critical user journeys and demo priorities.
- Prepare localhost/testnet demo environment.
- Prepare presentation slides and rehearsal material.
