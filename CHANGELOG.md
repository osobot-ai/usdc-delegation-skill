# Changelog

## [1.1.0] - 2025-02-07

### 🔒 ERC-7710 Compliance Improvements

This release brings the skill into full compliance with the ERC-7710 specification and MetaMask Delegation Framework.

#### Changed

- **Delegation Structure** - Now uses the proper `Delegation` struct from the MetaMask Delegation Framework:
  - `delegate` (address)
  - `delegator` (address)
  - `authority` (bytes32) - parent delegation hash or ROOT
  - `caveats[]` with `enforcer`, `terms`, `args`
  - `salt` (uint256)
  - `signature` (bytes)

- **Caveat Encoding** - Caveats now use real deployed CaveatEnforcer contract addresses instead of string types:
  - `ERC20TransferAmountEnforcer` (0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc)
  - `TimestampEnforcer` (0x1046bb45C8d673d4ea75321280DB34899413c069)
  - `AllowedTargetsEnforcer` (0x7F20f61b1f09b08D970938F6fa563634d65c4EeB)
  - `AllowedMethodsEnforcer` (0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5)
  - `LimitedCallsEnforcer` (0x04658B29F6b82ed55274221a06Fc97D318E25416)

- **Signature Scheme** - Switched from simple message signing to proper EIP-712 typed data signing as required by the DelegationManager

- **Terms Encoding** - Caveat terms are now properly ABI-encoded:
  - `ERC20TransferAmountEnforcer`: `(address token, uint256 amount)`
  - `TimestampEnforcer`: `(uint128 threshold, uint128 mode)`
  - `AllowedMethodsEnforcer`: packed `bytes4[]` selectors

#### Added

- **getDelegationHash()** - Computes the EIP-712 struct hash matching `EncoderLib._getDelegationHash()`
- **Caveat encoding helpers** - `encodeERC20TransferAmountTerms()`, `encodeTimestampTerms()`, etc.
- **ERC-7579 execution encoding** - `encodeSingleExecution()` for building execution calldata
- **check-scope.mjs** - Enhanced to decode and display all caveat details
- **--output flag** - Save delegations to file directly
- **--simulate flag** - Simulate transactions before execution
- **CHANGELOG.md** - This file

#### Fixed

- **Security**: Delegations now use real on-chain enforcers instead of client-side validation only
- **Compatibility**: Delegations can now be redeemed via `DelegationManager.redeemDelegations()`
- **Revocation**: Properly calls `disableDelegation()` with the full delegation struct

#### Removed

- **@metamask/delegation-framework dependency** - Using viem directly for ABI encoding
- **Legacy string-based caveat types** - Replaced with contract addresses

### Migration Guide

Delegations created with v1.0.0 are NOT compatible with this version. The structure has changed significantly to match the on-chain format.

To migrate:
1. Create new delegations using v1.1.0
2. Old delegations should be considered invalid
3. Any sub-delegations derived from old delegations are also invalid

## [1.0.0] - 2025-02-01

Initial release with basic delegation functionality.

- Create delegations with amount, expiry, and recipient constraints
- Create transitive sub-delegations
- Execute transfers with caveat validation
- Revoke delegations
