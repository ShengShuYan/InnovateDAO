# InnovateDAO

A decentralized autonomous organization (DAO) smart contract with advanced governance features.

## Features

- **NFT-Gated Proposal Creation**: Only membership NFT holders can create proposals
- **Stake-Weighted Voting**: Voting power based on staked ETH
- **Voting Weight Cap**: Maximum 33% of total voting power per user
- **Strict Governance Rules**:
  - 60% quorum requirement
  - >66.6% supermajority for approval
- **Refundable Deposits**: Proposal creators pay a refundable deposit
- **Vote Locking**: Prevents withdrawal while votes are active

## Smart Contract Architecture

### Core Components

- **InnovateDAO.sol**: Main DAO contract with governance logic
- Uses OpenZeppelin's `ReentrancyGuard` and `Ownable` for security
- Integrates with ERC721 NFT for membership verification

### Key Functions

1. **createProposal**: Create a new proposal (NFT holders only, requires deposit)
2. **castVote**: Vote on active proposals (weight capped at 33%)
3. **executeProposal**: Execute proposal after voting period if quorum and supermajority met
4. **stake**: Stake ETH to gain voting power
5. **withdrawStake**: Withdraw staked ETH (only if no active votes)
6. **unlockVote**: Unlock voting power after proposal deadline

## Installation

```bash
npm install
```

## Compilation

```bash
npm run compile
```

## Testing

```bash
npm run test
```

## Deployment

```bash
npm run deploy
```

## Governance Parameters

- **Quorum**: 60% of total staked supply must participate
- **Supermajority**: >66.6% approval rate required
- **Voting Weight Cap**: Individual voting power capped at 33% of total
- **Voting Period**: Configurable (set during deployment)
- **Proposal Deposit**: Refundable deposit required to create proposals

## License

MIT
