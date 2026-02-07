# USDC Delegation Skill

Scoped USDC permissions with transitive sub-delegations using ERC-7710.

## Overview

This skill enables AI agents to:
1. **Receive scoped USDC permissions** — bounded by amount, time, and recipients
2. **Create transitive sub-delegations** — delegate portions of authority to sub-agents
3. **Execute USDC transfers** within delegated scope via DelegationManager
4. **Revoke delegations** at any level of the chain (cascades to sub-delegations)

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
    │   [EIP-712 signed, references DelegationManager]
    │
    ▼
Agent A (Delegate)
    │
    ├── Sub-delegation: 200 USDC, 12h expiry, only to vendor X
    │   [authority = hash(parent delegation)]
    │
    ▼
Sub-Agent B (Sub-delegate)
    │
    └── Calls DelegationManager.redeemDelegations()
        with full delegation chain → 50 USDC to vendor X ✓
```

## Installation

```bash
git clone https://github.com/osobot-ai/usdc-delegation-skill.git
cd usdc-delegation-skill
npm install
```

## Configuration

```bash
cp .env.example .env
# Edit .env with your private key (TESTNET ONLY!)
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVATE_KEY` | Your wallet private key | Required |
| `RPC_URL` | RPC endpoint | `https://sepolia.base.org` |
| `USDC_ADDRESS` | USDC contract | Base Sepolia USDC |

## Usage

### 1. Create a Delegation

Grant an agent scoped USDC permissions:

```bash
node scripts/create-delegation.mjs \
  --delegate 0xAgentAddress \
  --amount 1000 \
  --expiry 24h \
  --recipients 0xVendor1,0xVendor2 \
  --output delegation.json
```

### 2. Check Delegation Scope

Analyze what a delegation permits:

```bash
node scripts/check-scope.mjs --delegation delegation.json
```

### 3. Create a Sub-Delegation (Transitive)

Agent delegates a portion of authority to a sub-agent:

```bash
node scripts/create-subdelegation.mjs \
  --parent delegation.json \
  --subdelegate 0xSubAgentAddress \
  --amount 200 \
  --expiry 12h \
  --output subdelegation.json
```

### 4. Execute a Transfer

Execute a transfer via the delegation (validates all caveats):

```bash
node scripts/execute-transfer.mjs \
  --delegation delegation.json \
  --to 0xRecipient \
  --amount 50 \
  --dry-run
```

### 5. Revoke a Delegation

Revoke on-chain (cascades to all sub-delegations):

```bash
node scripts/revoke-delegation.mjs \
  --delegation delegation.json \
  --execute
```

## Caveat Enforcers (On-Chain Constraints)

| Enforcer | Purpose | Terms Encoding |
|----------|---------|----------------|
| `ERC20TransferAmountEnforcer` | Max USDC | `(address token, uint256 amount)` |
| `TimestampEnforcer` | Expiry | `(uint128 threshold, uint128 mode)` |
| `AllowedTargetsEnforcer` | Recipients | `(address[])` |
| `AllowedMethodsEnforcer` | Methods | packed `bytes4[]` selectors |
| `LimitedCallsEnforcer` | Max calls | `(uint256 maxCalls)` |

Sub-delegations can only **narrow** scope, never expand it.

## ERC-7710 Compliance

This skill implements proper ERC-7710:

- ✅ **Delegation struct** matches on-chain type exactly
- ✅ **EIP-712 typed data signing** for security
- ✅ **Real CaveatEnforcer addresses** from MetaMask Delegation Framework v1.3.0
- ✅ **Proper terms encoding** (ABI-encoded per enforcer spec)
- ✅ **Authority chain** links sub-delegations to parents

## Security Model

1. **Atomic Revocation** — Revoking invalidates entire sub-chain
2. **Scope Narrowing Only** — Sub-delegations cannot exceed parent
3. **On-Chain Enforcement** — Constraints verified by smart contracts
4. **No Key Exposure** — Agents never hold the delegator's private key
5. **Simulation** — Always simulate before on-chain execution

## Network Support

- **Base Sepolia** (84532) — Primary testnet
- **Ethereum Sepolia** (11155111) — Supported
- **Base Mainnet** (8453) — Production ready

## References

- [ERC-7710 Specification](https://eips.ethereum.org/EIPS/eip-7710)
- [MetaMask Delegation Framework](https://github.com/metamask/delegation-framework)
- [Deployed Contract Addresses](https://github.com/MetaMask/delegation-framework/blob/main/documents/Deployments.md)

## License

MIT
