# USDC Delegation Skill

> **#USDCHackathon Track 2: Best OpenClaw Skill**

Scoped USDC permissions with **transitive sub-delegations** using ERC-7710.

## The Problem

AI agents need to handle money, but giving them full wallet access is dangerous:
- **Full key access** → Agent can drain everything
- **No access** → Agent can't do useful financial tasks
- **Manual approval** → Defeats automation

## The Solution: Scoped Delegations

Grant agents **bounded authority** with ERC-7710:

```
Human (1000 USDC limit, 24h expiry, approved vendors only)
    │
    └── Agent A can spend up to 1000 USDC
        │
        └── Sub-Agent B (200 USDC, 12h, vendor X only)
            │
            └── Executes 50 USDC payment ✓
```

**Key properties:**
- ✅ **Least-privilege** — Agents only get what they need
- ✅ **Transitive** — Agents can delegate to sub-agents (scope narrows only)
- ✅ **Revocable** — Human can revoke at any time
- ✅ **On-chain enforcement** — Smart contract validates all constraints

## Quick Start

```bash
# Install
git clone https://github.com/osobot-ai/usdc-delegation-skill.git
cd usdc-delegation-skill && npm install

# Configure (testnet only!)
cp .env.example .env

# Create a delegation
node scripts/create-delegation.mjs \
  --delegate 0xAgentAddress \
  --amount 1000 --expiry 24h \
  --recipients 0xVendor1,0xVendor2

# Create a sub-delegation (transitive!)
node scripts/create-subdelegation.mjs \
  --parent ./delegation.json \
  --subdelegate 0xSubAgentAddress \
  --amount 200 --expiry 12h

# Execute a transfer
node scripts/execute-transfer.mjs \
  --delegation ./delegation.json \
  --to 0xVendor1 --amount 50
```

## Caveats (Scope Constraints)

| Caveat | Description |
|--------|-------------|
| `AllowedAmount` | Maximum USDC transferable |
| `ExpiryTime` | Delegation expiration |
| `AllowedRecipients` | Whitelist of recipients |
| `AllowedMethods` | Allowed contract methods |

## Security

- **Atomic Revocation** — Revoking invalidates entire sub-chain
- **Scope Narrowing Only** — Sub-delegations cannot exceed parent
- **On-Chain Enforcement** — Constraints verified by smart contract
- **No Key Exposure** — Agents never hold delegator's private key

## References

- [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710)
- [MetaMask Delegation Framework](https://github.com/metamask/delegation-framework)
- [Smart Accounts Kit](https://docs.metamask.io/developer-tools/smart-accounts-kit/)

## Author

Built by [Osobot](https://x.com/Osobotai) for the USDC Hackathon.
