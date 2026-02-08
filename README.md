# USDC Delegation Skill

Scoped USDC permissions with transitive sub-delegations using ERC-7710.

## Overview

This skill enables AI agents to:
1. **Receive scoped USDC permissions** — bounded by amount and time
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
Human (owns DeleGator Smart Account)
    │
    ├── Signs Delegation: 1000 USDC, 24h expiry
    │   [EIP-712 signed, delegator = Smart Account address]
    │
    ▼
Agent A (Delegate) 
    │
    ├── Creates Sub-delegation: 200 USDC, 12h expiry
    │   [authority = hash(parent delegation)]
    │
    ▼
Sub-Agent B (Sub-delegate)
    │
    └── Calls DelegationManager.redeemDelegations()
        → DelegationManager calls Smart Account.executeFromExecutor()
        → 50 USDC transfer ✓
```

### ⚠️ IMPORTANT: Account Requirements

**Root Delegator (Human/Owner):** Must be a DeleGator Smart Account (HybridDeleGator, MultiSigDeleGator, etc.) because the DelegationManager calls `executeFromExecutor()` on it.

**Delegates & Sub-delegates (Agents):** Can be **EOA OR Smart Account**! This is key:
- ✅ Agent with simple EOA wallet CAN receive delegations
- ✅ Agent with EOA CAN create sub-delegations  
- ✅ Agent with EOA CAN redeem delegations to execute transfers

**How it works:**
1. Human owns a DeleGator Smart Account (holds the USDC)
2. Human signs delegation (EIP-712) granting agent permissions
3. Agent (even if just an EOA) redeems via DelegationManager
4. DelegationManager calls the Human's Smart Account to execute the transfer

## 🎮 Interactive Demo

Try the interactive demo app to visualize the complete delegation flow:

```bash
cd examples/demo-app
npm install
npm run dev
# Open http://localhost:3000
```

The demo shows:
- Visual delegation tree with hierarchical relationships
- Step-by-step creation of root delegation and sub-delegations
- Transaction simulation and execution
- Real-time allowance tracking

See [examples/demo-app/README.md](examples/demo-app/README.md) for details.

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

## Caveat Enforcers (Simplified Stack)

Based on MetaMask Delegation Framework v1.3.0, we use a minimal but complete enforcer set:

| Enforcer | Purpose | Terms Encoding |
|----------|---------|----------------|
| `ValueLteEnforcer` | Prevent ETH transfers | `uint256` (32 bytes) - set to 0 |
| `ERC20TransferAmountEnforcer` | Limit USDC + validate token/method | `encodePacked(address, uint256)` (52 bytes) |
| `TimestampEnforcer` | Time window constraints | `encodePacked(uint128 afterThreshold, uint128 beforeThreshold)` (32 bytes) |

### TimestampEnforcer Details

The TimestampEnforcer uses **two thresholds**, not a single timestamp with mode:

```
Terms (32 bytes):
├── First 16 bytes:  afterThreshold  (must execute AFTER this time, 0 = no minimum)
└── Last 16 bytes:   beforeThreshold (must execute BEFORE this time, 0 = no expiry)
```

Examples:
- **Expiry only**: `afterThreshold=0, beforeThreshold=expiryTime`
- **Start time only**: `afterThreshold=startTime, beforeThreshold=0`
- **Time window**: `afterThreshold=startTime, beforeThreshold=expiryTime`

### Why This Stack?

**ERC20TransferAmountEnforcer** is the key enforcer. It handles:
- ✅ Token address validation (target must be USDC)
- ✅ Method validation (must be `transfer(address,uint256)`)
- ✅ Amount tracking and limiting

This means we **don't need**:
- ❌ AllowedMethodsEnforcer (already enforced)
- ❌ AllowedTargetsEnforcer (already enforced)
- ❌ LimitedCallsEnforcer (not needed for this use case)

**ValueLteEnforcer(0)** ensures no ETH can be sent with the call, preventing native token transfers.

Sub-delegations can only **narrow** scope, never expand it.

## Contract Addresses (Base Sepolia - v1.3.0)

```
DelegationManager:           0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3
ERC20TransferAmountEnforcer: 0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc
TimestampEnforcer:           0x1046bb45C8d673d4ea75321280DB34899413c069
ValueLteEnforcer:            0x92Bf12322527cAA612fd31a0e810472BBB106A8F
USDC Token:                  0x036CbD53842c5426634e7929541eC2318f3dCF7e
```

## Important Constants

```javascript
// Root authority - for delegations directly from the delegator (all 0xff)
ROOT_AUTHORITY = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff

// Any delegate - allows any address to redeem the delegation
ANY_DELEGATE = 0x0000000000000000000000000000000000000a11
```

## ERC-7710 Compliance

This skill implements proper ERC-7710:

- ✅ **Delegation struct** matches on-chain type exactly
- ✅ **EIP-712 typed data signing** for security
- ✅ **Real CaveatEnforcer addresses** from MetaMask Delegation Framework v1.3.0
- ✅ **Proper terms encoding** (encodePacked per enforcer spec)
- ✅ **Authority chain** links sub-delegations to parents

## Security Model

1. **Atomic Revocation** — Revoking invalidates entire sub-chain
2. **Scope Narrowing Only** — Sub-delegations cannot exceed parent
3. **On-Chain Enforcement** — Constraints verified by smart contracts
4. **No Key Exposure** — Agents never hold the delegator's private key
5. **ETH Transfer Prevention** — ValueLteEnforcer(0) blocks native transfers

## Network Support

- **Base Sepolia** (84532) — Primary testnet
- **Ethereum Sepolia** (11155111) — Supported
- **Base Mainnet** (8453) — Production ready

## References

- [ERC-7710 Specification](https://eips.ethereum.org/EIPS/eip-7710)
- [MetaMask Delegation Framework](https://github.com/metamask/delegation-framework)
- [Deployed Contract Addresses](https://github.com/MetaMask/delegation-framework/blob/main/documents/Deployments.md)
- [ERC20TransferAmountEnforcer Source](https://github.com/MetaMask/delegation-framework/blob/main/src/enforcers/ERC20TransferAmountEnforcer.sol)
- [ValueLteEnforcer Source](https://github.com/MetaMask/delegation-framework/blob/main/src/enforcers/ValueLteEnforcer.sol)

## License

MIT
