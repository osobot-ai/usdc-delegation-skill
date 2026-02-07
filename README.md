# USDC Delegation Skill

> **Circle Hackathon - Track 2: Best OpenClaw Skill**

Scoped USDC permissions with **transitive sub-delegations** using [ERC-7710](https://eips.ethereum.org/EIPS/eip-7710) and the [MetaMask Delegation Framework](https://github.com/MetaMask/delegation-framework).

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
- ✅ **Revocable** — Human can revoke at any time, invalidating entire chain
- ✅ **On-chain enforcement** — Smart contract validates all constraints
- ✅ **EIP-712 signatures** — Proper typed data signing for security

## Architecture

This skill implements proper ERC-7710 compliance:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MetaMask Delegation Framework                 │
├─────────────────────────────────────────────────────────────────┤
│  DelegationManager (0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3) │
│  ├── redeemDelegations()  - Execute delegated actions           │
│  └── disableDelegation()  - Revoke delegations                  │
├─────────────────────────────────────────────────────────────────┤
│  Caveat Enforcers (on-chain constraint validators)              │
│  ├── ERC20TransferAmountEnforcer - Max USDC amount              │
│  ├── TimestampEnforcer           - Expiry time                  │
│  ├── AllowedTargetsEnforcer      - Recipient whitelist          │
│  ├── AllowedMethodsEnforcer      - transfer/approve only        │
│  └── LimitedCallsEnforcer        - Max redemption count         │
└─────────────────────────────────────────────────────────────────┘
```

### ERC-7710 Delegation Structure

```javascript
{
  delegate: "0x...",      // Who receives the authority
  delegator: "0x...",     // Who grants the authority
  authority: "0x...",     // Parent delegation hash (or ROOT)
  caveats: [              // On-chain enforced constraints
    {
      enforcer: "0x...",  // CaveatEnforcer contract address
      terms: "0x...",     // ABI-encoded constraint parameters
      args: "0x..."       // Runtime arguments (optional)
    }
  ],
  salt: 123456789n,       // Unique nonce
  signature: "0x..."      // EIP-712 typed signature
}
```

## Quick Start

```bash
# Install
git clone https://github.com/osobot-ai/usdc-delegation-skill.git
cd usdc-delegation-skill && npm install

# Configure (testnet only!)
cp .env.example .env
# Edit .env with your private key

# Create a delegation with EIP-712 signing
node scripts/create-delegation.mjs \
  --delegate 0xAgentAddress \
  --amount 1000 --expiry 24h \
  --recipients 0xVendor1,0xVendor2 \
  --output delegation.json

# Check delegation scope
node scripts/check-scope.mjs --delegation delegation.json

# Create a transitive sub-delegation
node scripts/create-subdelegation.mjs \
  --parent ./delegation.json \
  --subdelegate 0xSubAgentAddress \
  --amount 200 --expiry 12h \
  --output subdelegation.json

# Execute a transfer (validates all caveats)
node scripts/execute-transfer.mjs \
  --delegation ./delegation.json \
  --to 0xVendor1 --amount 50 \
  --dry-run

# Revoke a delegation (cascades to all sub-delegations)
node scripts/revoke-delegation.mjs \
  --delegation ./delegation.json \
  --execute
```

## Caveat Enforcers

| Enforcer | Address | Description |
|----------|---------|-------------|
| `ERC20TransferAmountEnforcer` | `0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc` | Maximum USDC transferable |
| `TimestampEnforcer` | `0x1046bb45C8d673d4ea75321280DB34899413c069` | Delegation expiration |
| `AllowedTargetsEnforcer` | `0x7F20f61b1f09b08D970938F6fa563634d65c4EeB` | Whitelist of recipients |
| `AllowedMethodsEnforcer` | `0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5` | Allowed contract methods |
| `LimitedCallsEnforcer` | `0x04658B29F6b82ed55274221a06Fc97D318E25416` | Maximum redemption count |

All addresses are for the MetaMask Delegation Framework v1.3.0 deployed on Base Sepolia and other networks.

## Security Model

### Proper ERC-7710 Compliance
- ✅ **EIP-712 Typed Data Signing** — Delegations use proper structured data signatures
- ✅ **Real Caveat Enforcers** — Uses deployed MetaMask Delegation Framework contracts
- ✅ **Proper Delegation Struct** — Matches the on-chain `Delegation` type exactly
- ✅ **Authority Chain** — Sub-delegations correctly reference parent delegation hashes

### Security Properties
1. **Atomic Revocation** — Revoking a delegation invalidates all sub-delegations
2. **Scope Narrowing Only** — Sub-delegations cannot exceed parent scope
3. **On-Chain Enforcement** — All constraints verified by smart contract
4. **No Key Exposure** — Agents never hold the delegator's private key
5. **Simulation Before Execution** — Always simulate `redeemDelegations` before submitting

### What This Skill Does NOT Do
- ❌ Hold private keys for the delegator
- ❌ Bypass on-chain caveat enforcement
- ❌ Allow scope expansion in sub-delegations
- ❌ Execute without proper delegation chain

## Network Support

| Network | Chain ID | USDC Address | Status |
|---------|----------|--------------|--------|
| Base Sepolia | 84532 | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | ✅ Primary |
| Ethereum Sepolia | 11155111 | - | ✅ Supported |
| Base Mainnet | 8453 | - | ⚠️ Production |

## References

- [ERC-7710 Specification](https://eips.ethereum.org/EIPS/eip-7710) - Smart Contract Delegation
- [ERC-7579 Specification](https://eips.ethereum.org/EIPS/eip-7579) - Modular Smart Account
- [MetaMask Delegation Framework](https://github.com/metamask/delegation-framework)
- [Delegation Framework Deployments](https://github.com/MetaMask/delegation-framework/blob/main/documents/Deployments.md)

## Author

Built by [Osobot](https://x.com/Osobotai) for the Circle USDC Hackathon.

## License

MIT
