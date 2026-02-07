# USDC Delegation Skill

Scoped USDC permissions with transitive sub-delegations using ERC-7710.

## Overview

This skill enables AI agents to:
1. **Receive scoped USDC permissions** — bounded by amount, time, and recipient
2. **Create transitive sub-delegations** — delegate portions of their authority to sub-agents
3. **Execute USDC transfers** within their delegated scope
4. **Revoke delegations** at any level of the chain

## Why This Matters

Traditional agent wallets give full control or nothing. With ERC-7710 delegations:
- Agents operate with **least-privilege access**
- Humans retain **revocation authority** at any time
- Sub-agents can receive **further-scoped permissions**
- All constraints are **cryptographically enforced on-chain**

## Architecture

```
Human (Delegator)
    │
    ├── Delegation: 1000 USDC, 24h expiry, only to approved vendors
    │
    ▼
Agent A (Delegate)
    │
    ├── Sub-delegation: 200 USDC, 12h expiry, only to vendor X
    │
    ▼
Sub-Agent B (Sub-delegate)
    │
    └── Executes transfer: 50 USDC to vendor X ✓
```

## Installation

```bash
# Clone the skill
git clone https://github.com/osobot-ai/usdc-delegation-skill.git

# Install dependencies
cd usdc-delegation-skill
npm install
```

## Configuration

Set environment variables or create `.env`:

```bash
# Required
PRIVATE_KEY=0x...           # Delegator's private key (testnet only!)
RPC_URL=https://...         # Base Sepolia or other testnet

# Optional
USDC_ADDRESS=0x...          # USDC contract (defaults to Base Sepolia USDC)
```

## Usage

### 1. Create a Delegation

Grant an agent scoped USDC permissions:

```bash
node scripts/create-delegation.mjs \
  --delegate 0xAgentAddress \
  --amount 1000 \
  --expiry 24h \
  --allowedRecipients 0xVendor1,0xVendor2
```

### 2. Create a Sub-Delegation (Transitive)

Agent delegates a portion of their authority to a sub-agent:

```bash
node scripts/create-subdelegation.mjs \
  --parentDelegation 0xDelegationHash \
  --subDelegate 0xSubAgentAddress \
  --amount 200 \
  --expiry 12h
```

### 3. Execute a Transfer

Sub-agent executes a transfer within their delegated scope:

```bash
node scripts/execute-transfer.mjs \
  --delegation 0xDelegationHash \
  --to 0xRecipient \
  --amount 50
```

### 4. Revoke a Delegation

Revoke at any level — cascades to all sub-delegations:

```bash
node scripts/revoke-delegation.mjs \
  --delegation 0xDelegationHash
```

## Caveats (Scope Constraints)

| Caveat | Description |
|--------|-------------|
| `AllowedAmount` | Maximum USDC that can be transferred |
| `ExpiryTime` | Delegation expires after this timestamp |
| `AllowedRecipients` | Whitelist of valid transfer recipients |
| `AllowedMethods` | Restrict to specific contract methods (e.g., `transfer`) |

Sub-delegations can only **narrow** scope, never expand it.

## Example: Multi-Agent Payment Flow

```javascript
// Human creates delegation for primary agent
const delegation = await createDelegation({
  delegate: primaryAgent,
  amount: 5000,
  expiry: '7d',
  allowedRecipients: [vendorA, vendorB, vendorC]
});

// Primary agent creates sub-delegation for specialist agent
const subDelegation = await createSubDelegation({
  parentDelegation: delegation,
  subDelegate: specialistAgent,
  amount: 1000,
  allowedRecipients: [vendorA] // Further restricted
});

// Specialist agent executes payment
await executeTransfer({
  delegation: subDelegation,
  to: vendorA,
  amount: 500
});
```

## Security Model

1. **Atomic Revocation** — Revoking a delegation invalidates all sub-delegations
2. **Scope Narrowing Only** — Sub-delegations cannot exceed parent scope
3. **On-Chain Enforcement** — All constraints verified by smart contract
4. **No Key Exposure** — Agents never hold the delegator's private key

## Network Support

- Base Sepolia (testnet) — Primary
- Ethereum Sepolia (testnet)
- Base Mainnet (production)

## References

- [ERC-7710 Specification](https://eips.ethereum.org/EIPS/eip-7710)
- [MetaMask Delegation Framework](https://github.com/metamask/delegation-framework)
- [Smart Accounts Kit](https://docs.metamask.io/developer-tools/smart-accounts-kit/)

## License

MIT
