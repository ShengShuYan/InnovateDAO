# InnovateDAO Diagrams

This folder contains architecture, flow, and interaction diagrams for the InnovateDAO smart contract system.

## Files

### 01-architecture.mmd
**Smart Contract Architecture**
- Layered architecture across client, contracts, and dependencies
- Core relationships: Frontend, Governor, NFT votes, and Treasury execution
- Black-and-white high-contrast style for technical PDF documents

### 02-lifecycle.mmd
**Proposal Lifecycle & Logic Flow**
- State-based lifecycle with 4 phases: setup, creation, voting, finalization
- Includes governance constraints: delay, quorum, and execution conditions

### 03-interaction.mmd
**Frontend & Smart Contract Interaction Map**
- Sequence-based interaction between User, Frontend, MetaMask, and contracts
- Covers end-to-end flow from connect to proposal execution

## Viewing Options

### Mermaid Diagram Viewers
1. **VS Code** (built-in): Right-click .mmd file → Preview
2. **mermaid.live**: https://mermaid.live (paste .mmd content)
3. **GitHub**: Direct preview in repo (if using GitHub markdown)

### Export Options
The .mmd files can be exported to image/PDF formats:

```bash
# Using mermaid-cli
npm install -g @mermaid-js/mermaid-cli
mmdc -i 01-architecture.mmd -o 01-architecture.png
mmdc -i 02-lifecycle.mmd -o 02-lifecycle.svg
mmdc -i 03-interaction.mmd -o 03-interaction.pdf
```

## Governance Features Represented

### Smart Contracts
- **InnovateDAONFT**: ERC721 with voting power (ERC721Votes)
- **InnovateDAOGovernor**: OpenZeppelin Governor with:
  - Anti-spam: Proposal deposit requirement
  - Anti-whale: 33% voting weight cap
  - Quorum: 60% participation required
  - Timing: 1 block voting delay, ~72 hours voting period

### Frontend Components
- MetaMask wallet integration
- Account manager (switch, copy, disconnect)
- NFT mint & delegation
- Proposal creation with deposit
- Real-time voting interface
- Treasury funding & status
