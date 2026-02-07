import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  parseUnits, 
  formatUnits, 
  encodeFunctionData, 
  keccak256, 
  toBytes, 
  encodeAbiParameters,
  parseAbiParameters,
  concat,
  pad,
  toHex,
  hexToBytes,
  encodePacked,
  hashTypedData
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

// Base Sepolia USDC (Circle's testnet USDC)
export const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const USDC_DECIMALS = 6;

// MetaMask Delegation Framework v1.3.0 - Deployed on Base Sepolia
// See: https://github.com/MetaMask/delegation-framework/blob/main/documents/Deployments.md
export const DELEGATION_FRAMEWORK = {
  DelegationManager: '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3',
  
  // Caveat Enforcers
  AllowedCalldataEnforcer: '0xc2b0d624c1c4319760C96503BA27C347F3260f55',
  AllowedMethodsEnforcer: '0x2c21fD0Cb9DC8445CB3fb0DC5E7Bb0Aca01842B5',
  AllowedTargetsEnforcer: '0x7F20f61b1f09b08D970938F6fa563634d65c4EeB',
  TimestampEnforcer: '0x1046bb45C8d673d4ea75321280DB34899413c069',
  ERC20TransferAmountEnforcer: '0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc',
  LimitedCallsEnforcer: '0x04658B29F6b82ed55274221a06Fc97D318E25416',
  RedeemerEnforcer: '0xE144b0b2618071B4E56f746313528a669c7E65c5',
  NonceEnforcer: '0xDE4f2FAC4B3D87A1d9953Ca5FC09FCa7F366254f',
};

// EIP-712 Domain for Delegation Framework
export const DELEGATION_DOMAIN = {
  name: 'DelegationManager',
  version: '1',
  chainId: 84532, // Base Sepolia
  verifyingContract: DELEGATION_FRAMEWORK.DelegationManager,
};

// =============================================================================
// EIP-712 TYPE DEFINITIONS
// Per MetaMask Delegation Framework specification
// =============================================================================

export const DELEGATION_TYPEHASH = keccak256(
  toBytes('Delegation(address delegate,address delegator,bytes32 authority,bytes32 caveatsHash,uint256 salt)')
);

export const CAVEAT_TYPEHASH = keccak256(
  toBytes('Caveat(address enforcer,bytes32 termsHash)')
);

// EIP-712 types for viem's signTypedData
export const EIP712_TYPES = {
  Caveat: [
    { name: 'enforcer', type: 'address' },
    { name: 'terms', type: 'bytes' },
  ],
  Delegation: [
    { name: 'delegate', type: 'address' },
    { name: 'delegator', type: 'address' },
    { name: 'authority', type: 'bytes32' },
    { name: 'caveats', type: 'Caveat[]' },
    { name: 'salt', type: 'uint256' },
  ],
};

// Root authority constant (for root delegations)
export const ROOT_AUTHORITY = '0x0000000000000000000000000000000000000000000000000000000000000000';

// Open delegation delegate (allows any delegate)
export const OPEN_DELEGATE = '0x000000000000000000000000000000000000A11';

// =============================================================================
// CLIENT SETUP
// =============================================================================

export function getClients(privateKey) {
  const account = privateKeyToAccount(privateKey);
  const chain = baseSepolia;
  
  const publicClient = createPublicClient({
    chain,
    transport: http(process.env.RPC_URL || 'https://sepolia.base.org')
  });
  
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(process.env.RPC_URL || 'https://sepolia.base.org')
  });
  
  return { publicClient, walletClient, account, chain };
}

// =============================================================================
// CAVEAT ENCODING HELPERS
// Per MetaMask Delegation Framework's CaveatEnforcer contracts
// =============================================================================

/**
 * Encode terms for ERC20TransferAmountEnforcer
 * @param {string} tokenAddress - ERC20 token address
 * @param {bigint} amount - Maximum transfer amount in wei
 * @returns {string} ABI-encoded terms
 */
export function encodeERC20TransferAmountTerms(tokenAddress, amount) {
  return encodeAbiParameters(
    parseAbiParameters('address token, uint256 amount'),
    [tokenAddress, amount]
  );
}

/**
 * Encode terms for TimestampEnforcer
 * Enforces: block.timestamp must be < threshold (expiry time)
 * @param {number} expiryTimestamp - Unix timestamp when delegation expires
 * @returns {string} ABI-encoded terms
 */
export function encodeTimestampTerms(expiryTimestamp, mode = 'before') {
  // mode: 0 = before (block.timestamp < threshold), 1 = after (block.timestamp >= threshold)
  return encodeAbiParameters(
    parseAbiParameters('uint128 threshold, uint128 mode'),
    [BigInt(expiryTimestamp), mode === 'before' ? 0n : 1n]
  );
}

/**
 * Encode terms for AllowedTargetsEnforcer
 * @param {string[]} allowedAddresses - List of allowed target addresses
 * @returns {string} ABI-encoded terms
 */
export function encodeAllowedTargetsTerms(allowedAddresses) {
  return encodeAbiParameters(
    parseAbiParameters('address[]'),
    [allowedAddresses]
  );
}

/**
 * Encode terms for AllowedMethodsEnforcer
 * @param {string[]} methodSignatures - e.g., ['transfer(address,uint256)', 'approve(address,uint256)']
 * @returns {string} ABI-encoded terms (array of 4-byte selectors)
 */
export function encodeAllowedMethodsTerms(methodSignatures) {
  const selectors = methodSignatures.map(sig => 
    keccak256(toBytes(sig)).slice(0, 10) // First 4 bytes
  );
  // Encode as packed bytes4[]
  return concat(selectors);
}

/**
 * Encode terms for RedeemerEnforcer
 * Restricts which addresses can redeem the delegation
 * @param {string[]} allowedRedeemers - List of addresses allowed to redeem
 * @returns {string} ABI-encoded terms
 */
export function encodeRedeemerTerms(allowedRedeemers) {
  return encodeAbiParameters(
    parseAbiParameters('address[]'),
    [allowedRedeemers]
  );
}

/**
 * Encode terms for LimitedCallsEnforcer
 * @param {number} maxCalls - Maximum number of calls allowed
 * @returns {string} ABI-encoded terms
 */
export function encodeLimitedCallsTerms(maxCalls) {
  return encodeAbiParameters(
    parseAbiParameters('uint256'),
    [BigInt(maxCalls)]
  );
}

// =============================================================================
// DELEGATION BUILDING
// =============================================================================

/**
 * Parse duration string to seconds
 */
export function parseDuration(duration) {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error('Invalid duration format. Use: 30s, 5m, 24h, 7d');
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

/**
 * Build a proper ERC-7710 compliant delegation with caveats
 * 
 * @param {Object} params
 * @param {string} params.delegator - Address granting the delegation
 * @param {string} params.delegate - Address receiving the delegation
 * @param {string} [params.authority] - Parent delegation hash (ROOT_AUTHORITY for root)
 * @param {string|number} [params.amount] - Maximum USDC amount
 * @param {number} [params.expirySeconds] - Seconds until expiry
 * @param {string[]} [params.allowedRecipients] - Whitelist of recipients
 * @param {number} [params.maxCalls] - Maximum number of calls
 * @returns {Object} Delegation object with proper caveat structure
 */
export function buildDelegation({
  delegator,
  delegate,
  authority = ROOT_AUTHORITY,
  amount,
  expirySeconds,
  allowedRecipients = [],
  maxCalls
}) {
  const caveats = [];
  
  // 1. ERC20 Transfer Amount Enforcer - limits total USDC transferred
  if (amount) {
    const amountWei = parseUnits(amount.toString(), USDC_DECIMALS);
    caveats.push({
      enforcer: DELEGATION_FRAMEWORK.ERC20TransferAmountEnforcer,
      terms: encodeERC20TransferAmountTerms(USDC_ADDRESS, amountWei),
      args: '0x' // Empty args - can be populated at redemption time
    });
  }
  
  // 2. Timestamp Enforcer - expiry time
  if (expirySeconds) {
    const expiryTimestamp = Math.floor(Date.now() / 1000) + expirySeconds;
    caveats.push({
      enforcer: DELEGATION_FRAMEWORK.TimestampEnforcer,
      terms: encodeTimestampTerms(expiryTimestamp, 'before'),
      args: '0x'
    });
  }
  
  // 3. Allowed Targets Enforcer - restrict to specific recipients
  if (allowedRecipients.length > 0) {
    caveats.push({
      enforcer: DELEGATION_FRAMEWORK.AllowedTargetsEnforcer,
      terms: encodeAllowedTargetsTerms(allowedRecipients),
      args: '0x'
    });
  }
  
  // 4. Allowed Methods Enforcer - restrict to transfer/approve only
  caveats.push({
    enforcer: DELEGATION_FRAMEWORK.AllowedMethodsEnforcer,
    terms: encodeAllowedMethodsTerms(['transfer(address,uint256)', 'approve(address,uint256)']),
    args: '0x'
  });
  
  // 5. Limited Calls Enforcer - optional max calls
  if (maxCalls) {
    caveats.push({
      enforcer: DELEGATION_FRAMEWORK.LimitedCallsEnforcer,
      terms: encodeLimitedCallsTerms(maxCalls),
      args: '0x'
    });
  }
  
  return {
    delegate,
    delegator,
    authority,
    caveats,
    salt: BigInt(Date.now()),
    signature: '0x'
  };
}

// =============================================================================
// EIP-712 SIGNING
// =============================================================================

/**
 * Compute the EIP-712 hash of a caveat
 */
export function hashCaveat(caveat) {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, address, bytes32'),
      [CAVEAT_TYPEHASH, caveat.enforcer, keccak256(caveat.terms)]
    )
  );
}

/**
 * Compute the hash of a caveats array
 */
export function hashCaveatsArray(caveats) {
  const caveatHashes = caveats.map(c => hashCaveat(c));
  return keccak256(concat(caveatHashes));
}

/**
 * Compute the EIP-712 struct hash of a delegation
 * This matches EncoderLib._getDelegationHash()
 */
export function getDelegationHash(delegation) {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters('bytes32, address, address, bytes32, bytes32, uint256'),
      [
        DELEGATION_TYPEHASH,
        delegation.delegate,
        delegation.delegator,
        delegation.authority,
        hashCaveatsArray(delegation.caveats),
        delegation.salt
      ]
    )
  );
}

/**
 * Sign a delegation using EIP-712 typed data
 * 
 * @param {Object} delegation - The delegation to sign
 * @param {Object} walletClient - Viem wallet client
 * @returns {Object} Signed delegation with signature field populated
 */
export async function signDelegation(delegation, walletClient) {
  // Prepare caveats for EIP-712 (without args field, as per the type definition)
  const caveatsForSigning = delegation.caveats.map(c => ({
    enforcer: c.enforcer,
    terms: c.terms
  }));
  
  const signature = await walletClient.signTypedData({
    domain: DELEGATION_DOMAIN,
    types: EIP712_TYPES,
    primaryType: 'Delegation',
    message: {
      delegate: delegation.delegate,
      delegator: delegation.delegator,
      authority: delegation.authority,
      caveats: caveatsForSigning,
      salt: delegation.salt
    }
  });
  
  return { ...delegation, signature };
}

/**
 * Legacy hash function for backwards compatibility
 * @deprecated Use getDelegationHash instead
 */
export function hashDelegation(delegation) {
  return getDelegationHash(delegation);
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate sub-delegation scope against parent
 * Sub-delegations can only NARROW scope, never expand
 */
export function validateSubDelegationScope(parentDelegation, subDelegationParams) {
  const errors = [];
  
  // Find parent caveats by enforcer address
  const findCaveat = (enforcer) => 
    parentDelegation.caveats.find(c => c.enforcer.toLowerCase() === enforcer.toLowerCase());
  
  // Check amount
  const parentAmountCaveat = findCaveat(DELEGATION_FRAMEWORK.ERC20TransferAmountEnforcer);
  if (parentAmountCaveat && subDelegationParams.amount) {
    // Decode parent terms: (address token, uint256 amount)
    const parentAmount = BigInt('0x' + parentAmountCaveat.terms.slice(66)); // Second word
    const subAmount = parseUnits(subDelegationParams.amount.toString(), USDC_DECIMALS);
    if (subAmount > parentAmount) {
      errors.push(`Sub-delegation amount (${subDelegationParams.amount}) exceeds parent scope`);
    }
  }
  
  // Check expiry
  const parentExpiryCaveat = findCaveat(DELEGATION_FRAMEWORK.TimestampEnforcer);
  if (parentExpiryCaveat && subDelegationParams.expirySeconds) {
    // Decode parent terms: (uint128 threshold, uint128 mode)
    const parentExpiry = Number(BigInt('0x' + parentExpiryCaveat.terms.slice(2, 34)));
    const subExpiry = Math.floor(Date.now() / 1000) + subDelegationParams.expirySeconds;
    if (subExpiry > parentExpiry) {
      errors.push(`Sub-delegation expiry exceeds parent expiry`);
    }
  }
  
  // Check recipients
  const parentTargetsCaveat = findCaveat(DELEGATION_FRAMEWORK.AllowedTargetsEnforcer);
  if (parentTargetsCaveat && subDelegationParams.allowedRecipients?.length > 0) {
    // For simplicity, we'll require the parent to have the same or broader target list
    // Full validation would require decoding the ABI-encoded address array
    // This is a security check that should be enhanced in production
    console.warn('⚠️  Recipient validation requires full ABI decoding - verify manually');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a transfer against delegation caveats
 */
export function validateTransfer(delegation, to, amount) {
  const errors = [];
  const amountWei = parseUnits(amount.toString(), USDC_DECIMALS);
  const now = Math.floor(Date.now() / 1000);
  
  for (const caveat of delegation.caveats) {
    const enforcerLower = caveat.enforcer.toLowerCase();
    
    // Check ERC20 amount limit
    if (enforcerLower === DELEGATION_FRAMEWORK.ERC20TransferAmountEnforcer.toLowerCase()) {
      const maxAmount = BigInt('0x' + caveat.terms.slice(66));
      if (amountWei > maxAmount) {
        errors.push(`Transfer amount exceeds delegated limit of ${formatUnits(maxAmount, USDC_DECIMALS)} USDC`);
      }
    }
    
    // Check timestamp expiry
    if (enforcerLower === DELEGATION_FRAMEWORK.TimestampEnforcer.toLowerCase()) {
      const threshold = Number(BigInt('0x' + caveat.terms.slice(2, 34)));
      const mode = Number(BigInt('0x' + caveat.terms.slice(34, 66)));
      if (mode === 0 && now >= threshold) { // Before mode
        errors.push('Delegation has expired');
      }
    }
    
    // Note: AllowedTargetsEnforcer validation would require full ABI decoding
  }
  
  return { valid: errors.length === 0, errors };
}

// =============================================================================
// DISPLAY FORMATTING
// =============================================================================

/**
 * Format delegation for human-readable display
 */
export function formatDelegation(delegation) {
  const lines = [
    `Delegator: ${delegation.delegator}`,
    `Delegate:  ${delegation.delegate}`,
    `Authority: ${delegation.authority === ROOT_AUTHORITY ? 'ROOT' : delegation.authority.slice(0, 18) + '...'}`,
    `Salt:      ${delegation.salt.toString()}`,
    `Caveats:   ${delegation.caveats.length}`
  ];
  
  for (const caveat of delegation.caveats) {
    const enforcerName = Object.entries(DELEGATION_FRAMEWORK)
      .find(([_, addr]) => addr.toLowerCase() === caveat.enforcer.toLowerCase())?.[0] 
      || 'Unknown';
    
    lines.push(`  - ${enforcerName}`);
    
    // Decode and display specific caveats
    try {
      if (enforcerName === 'ERC20TransferAmountEnforcer') {
        const amount = BigInt('0x' + caveat.terms.slice(66));
        lines.push(`    Amount: ${formatUnits(amount, USDC_DECIMALS)} USDC`);
      }
      if (enforcerName === 'TimestampEnforcer') {
        const threshold = Number(BigInt('0x' + caveat.terms.slice(2, 34)));
        lines.push(`    Expires: ${new Date(threshold * 1000).toISOString()}`);
      }
    } catch (e) {
      lines.push(`    Terms: ${caveat.terms.slice(0, 20)}...`);
    }
  }
  
  lines.push(`Hash:      ${getDelegationHash(delegation)}`);
  if (delegation.signature && delegation.signature !== '0x') {
    lines.push(`Signed:    ✓`);
  }
  
  return lines.join('\n');
}

// =============================================================================
// EXECUTION HELPERS (ERC-7579 / ERC-7710)
// =============================================================================

/**
 * Encode a single call execution for ERC-7579
 * Mode: 0x00 (default execution, single call)
 */
export function encodeSingleExecution(target, value, data) {
  return encodeAbiParameters(
    parseAbiParameters('address target, uint256 value, bytes data'),
    [target, value, data]
  );
}

/**
 * Build the permission context for redeemDelegations
 * This encodes the delegation chain for validation
 * 
 * @param {Object[]} delegationChain - Array of delegations, leaf to root
 * @returns {string} Encoded permission context
 */
export function encodePermissionContext(delegationChain) {
  // The permission context is the ABI-encoded delegation array
  // Each delegation in the chain is encoded as a tuple
  const encoded = delegationChain.map(d => ({
    delegate: d.delegate,
    delegator: d.delegator,
    authority: d.authority,
    caveats: d.caveats.map(c => ({
      enforcer: c.enforcer,
      terms: c.terms,
      args: c.args || '0x'
    })),
    salt: d.salt,
    signature: d.signature
  }));
  
  // For now, return stringified for reference
  // In production, this would be proper ABI encoding
  return JSON.stringify(encoded);
}

/**
 * ERC-7579 execution mode for single call
 * Bits: [0-7] callType, [8-15] execType, [16-23] unused, [24-255] modeSelector
 */
export const SINGLE_CALL_MODE = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * ERC-7579 execution mode for batch calls
 */
export const BATCH_CALL_MODE = '0x0100000000000000000000000000000000000000000000000000000000000000';
