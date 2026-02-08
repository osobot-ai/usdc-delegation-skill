# USDC Delegation Demo App

Interactive visualization of the USDC Delegation Skill with transitive sub-delegations using ERC-7710.

![Demo Screenshot](https://img.shields.io/badge/Demo-Live-success)
![Base Sepolia](https://img.shields.io/badge/Network-Base%20Sepolia-blue)
![ERC-7710](https://img.shields.io/badge/Standard-ERC--7710-purple)

## 🎯 What This Demo Shows

This demo visualizes the complete delegation flow:

1. **Root Delegation**: Human creates a delegation granting Agent A 1,000 USDC scope
2. **Transitive Sub-delegations**: Agent A creates sub-delegations to Agents B, C, D (300 USDC each)
3. **Scoped Execution**: Sub-agents execute transfers within their delegated limits

### Key Concepts Demonstrated

- **Scope Narrowing**: Sub-delegations can only narrow, never expand parent scope
- **Authority Chain**: Each sub-delegation links to parent via `authority` hash
- **Caveat Enforcement**: Amount limits, expiry times, and target validation
- **Transaction Simulation**: Preview transactions before execution

## 🚀 Quick Start

```bash
# Navigate to demo app
cd examples/demo-app

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000
```

## 📦 Tech Stack

- **React 18** - UI framework
- **Vite** - Build tool & dev server
- **viem** - Ethereum interactions

## 🎨 Features

### Visual Delegation Tree
- Hierarchical view of the delegation chain
- Real-time status updates (active, pending, executed)
- Remaining allowance tracking per agent

### Interactive Actions
- Step-by-step delegation creation
- One-click sub-delegation generation
- Transfer execution with simulation

### Transaction Log
- Detailed operation logging
- Caveat validation feedback
- Transaction hash display

## 🔧 How It Works

### 1. Create Root Delegation

```
Human (DeleGator Smart Account)
    │
    ├── Signs EIP-712 Delegation
    │   - Delegate: Agent A
    │   - Amount: 1,000 USDC
    │   - Expiry: 24 hours
    │   - Authority: ROOT_AUTHORITY (0xff...ff)
    │
    └── Enforcers:
        - ValueLteEnforcer(0) → No ETH transfers
        - ERC20TransferAmountEnforcer → 1,000 USDC limit
        - TimestampEnforcer → 24h expiry
```

### 2. Create Sub-Delegations

```
Agent A (Delegate)
    │
    ├── Validates scope narrowing
    │   - Sub-amount ≤ Parent amount ✓
    │   - Sub-expiry ≤ Parent expiry ✓
    │
    └── Creates sub-delegations:
        - Agent B: 300 USDC, authority = hash(parent)
        - Agent C: 300 USDC, authority = hash(parent)
        - Agent D: 300 USDC, authority = hash(parent)
```

### 3. Execute Transfers

```
Sub-Agent B
    │
    ├── Calls DelegationManager.redeemDelegations()
    │   - permissionContext: [subDelegation, rootDelegation]
    │   - execution: USDC.transfer(recipient, 50e6)
    │
    └── DelegationManager:
        1. Validates delegation chain
        2. Checks all caveats
        3. Calls delegator.executeFromExecutor()
        4. Transfer completes ✓
```

## 📋 Contract Addresses (Base Sepolia)

| Contract | Address |
|----------|---------|
| DelegationManager | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |
| ERC20TransferAmountEnforcer | `0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc` |
| TimestampEnforcer | `0x1046bb45C8d673d4ea75321280DB34899413c069` |
| ValueLteEnforcer | `0x92Bf12322527cAA612fd31a0e810472BBB106A8F` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

## 🔗 Related

- [USDC Delegation Skill](../../README.md)
- [ERC-7710 Specification](https://eips.ethereum.org/EIPS/eip-7710)
- [MetaMask Delegation Framework](https://github.com/metamask/delegation-framework)

## 📄 License

MIT
