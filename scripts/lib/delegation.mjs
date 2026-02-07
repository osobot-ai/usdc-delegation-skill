import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, encodeFunctionData, keccak256, toBytes, encodeAbiParameters } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

// Base Sepolia USDC (Circle's testnet USDC)
export const USDC_ADDRESS = process.env.USDC_ADDRESS || '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
export const USDC_DECIMALS = 6;

// Caveat types
export const CAVEAT_TYPES = {
  ALLOWED_AMOUNT: 'AllowedAmountEnforcer',
  EXPIRY_TIME: 'ExpiryTimeEnforcer', 
  ALLOWED_RECIPIENTS: 'AllowedRecipientsEnforcer',
  ALLOWED_METHODS: 'AllowedMethodsEnforcer'
};

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

// Parse duration string to seconds
export function parseDuration(duration) {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error('Invalid duration format. Use: 30s, 5m, 24h, 7d');
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
}

// Create a delegation with caveats
export function buildDelegation({
  delegator,
  delegate,
  authority = '0x0000000000000000000000000000000000000000000000000000000000000000',
  amount,
  expirySeconds,
  allowedRecipients = []
}) {
  const caveats = [];
  
  // Amount caveat
  if (amount) {
    caveats.push({
      type: CAVEAT_TYPES.ALLOWED_AMOUNT,
      data: parseUnits(amount.toString(), USDC_DECIMALS).toString()
    });
  }
  
  // Expiry caveat
  if (expirySeconds) {
    const expiryTimestamp = Math.floor(Date.now() / 1000) + expirySeconds;
    caveats.push({
      type: CAVEAT_TYPES.EXPIRY_TIME,
      data: expiryTimestamp.toString()
    });
  }
  
  // Allowed recipients caveat
  if (allowedRecipients.length > 0) {
    caveats.push({
      type: CAVEAT_TYPES.ALLOWED_RECIPIENTS,
      data: JSON.stringify(allowedRecipients)
    });
  }
  
  // Restrict to USDC transfer method only
  caveats.push({
    type: CAVEAT_TYPES.ALLOWED_METHODS,
    data: JSON.stringify(['transfer(address,uint256)', 'approve(address,uint256)'])
  });
  
  return {
    delegator,
    delegate,
    authority,
    caveats,
    salt: Date.now().toString(),
    signature: null
  };
}

// Sign a delegation
export async function signDelegation(delegation, walletClient) {
  const hash = hashDelegation(delegation);
  const signature = await walletClient.signMessage({
    message: { raw: toBytes(hash) }
  });
  
  return { ...delegation, signature };
}

// Hash a delegation for signing
export function hashDelegation(delegation) {
  const encoded = JSON.stringify({
    delegator: delegation.delegator,
    delegate: delegation.delegate,
    authority: delegation.authority,
    caveats: delegation.caveats,
    salt: delegation.salt
  });
  return keccak256(toBytes(encoded));
}

// Validate sub-delegation scope against parent
export function validateSubDelegationScope(parentDelegation, subDelegationParams) {
  const errors = [];
  
  // Check amount
  const parentAmountCaveat = parentDelegation.caveats.find(c => c.type === CAVEAT_TYPES.ALLOWED_AMOUNT);
  if (parentAmountCaveat && subDelegationParams.amount) {
    const parentAmount = BigInt(parentAmountCaveat.data);
    const subAmount = parseUnits(subDelegationParams.amount.toString(), USDC_DECIMALS);
    if (subAmount > parentAmount) {
      errors.push(`Sub-delegation amount exceeds parent scope`);
    }
  }
  
  // Check expiry
  const parentExpiryCaveat = parentDelegation.caveats.find(c => c.type === CAVEAT_TYPES.EXPIRY_TIME);
  if (parentExpiryCaveat && subDelegationParams.expirySeconds) {
    const parentExpiry = parseInt(parentExpiryCaveat.data);
    const subExpiry = Math.floor(Date.now() / 1000) + subDelegationParams.expirySeconds;
    if (subExpiry > parentExpiry) {
      errors.push(`Sub-delegation expiry exceeds parent expiry`);
    }
  }
  
  // Check recipients
  const parentRecipientsCaveat = parentDelegation.caveats.find(c => c.type === CAVEAT_TYPES.ALLOWED_RECIPIENTS);
  if (parentRecipientsCaveat && subDelegationParams.allowedRecipients) {
    const parentRecipients = new Set(JSON.parse(parentRecipientsCaveat.data).map(r => r.toLowerCase()));
    const invalidRecipients = subDelegationParams.allowedRecipients.filter(
      r => !parentRecipients.has(r.toLowerCase())
    );
    if (invalidRecipients.length > 0) {
      errors.push(`Recipients not in parent scope: ${invalidRecipients.join(', ')}`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Validate a transfer against delegation caveats
export function validateTransfer(delegation, to, amount) {
  const errors = [];
  const amountWei = parseUnits(amount.toString(), USDC_DECIMALS);
  
  for (const caveat of delegation.caveats) {
    if (caveat.type === CAVEAT_TYPES.ALLOWED_AMOUNT) {
      if (amountWei > BigInt(caveat.data)) {
        errors.push('Transfer amount exceeds delegated limit');
      }
    }
    
    if (caveat.type === CAVEAT_TYPES.EXPIRY_TIME) {
      if (Math.floor(Date.now() / 1000) > parseInt(caveat.data)) {
        errors.push('Delegation has expired');
      }
    }
    
    if (caveat.type === CAVEAT_TYPES.ALLOWED_RECIPIENTS) {
      const recipients = JSON.parse(caveat.data).map(r => r.toLowerCase());
      if (!recipients.includes(to.toLowerCase())) {
        errors.push('Recipient not in allowed list');
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

// Format delegation for display
export function formatDelegation(delegation) {
  const lines = [
    `Delegator: ${delegation.delegator}`,
    `Delegate:  ${delegation.delegate}`,
    `Authority: ${delegation.authority === '0x0000000000000000000000000000000000000000000000000000000000000000' ? 'ROOT' : delegation.authority.slice(0, 18) + '...'}`,
    `Caveats:`
  ];
  
  for (const caveat of delegation.caveats) {
    if (caveat.type === CAVEAT_TYPES.ALLOWED_AMOUNT) {
      lines.push(`  - Amount Limit: ${formatUnits(BigInt(caveat.data), USDC_DECIMALS)} USDC`);
    } else if (caveat.type === CAVEAT_TYPES.EXPIRY_TIME) {
      const expiry = new Date(parseInt(caveat.data) * 1000);
      lines.push(`  - Expires: ${expiry.toISOString()}`);
    } else if (caveat.type === CAVEAT_TYPES.ALLOWED_RECIPIENTS) {
      const recipients = JSON.parse(caveat.data);
      lines.push(`  - Allowed Recipients: ${recipients.length} addresses`);
    } else if (caveat.type === CAVEAT_TYPES.ALLOWED_METHODS) {
      const methods = JSON.parse(caveat.data);
      lines.push(`  - Allowed Methods: ${methods.join(', ')}`);
    }
  }
  
  lines.push(`Hash: ${hashDelegation(delegation)}`);
  if (delegation.signature) {
    lines.push(`Signed: ✓`);
  }
  
  return lines.join('\n');
}
