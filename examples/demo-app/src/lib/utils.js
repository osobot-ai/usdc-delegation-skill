/**
 * Format an Ethereum address for display
 */
export function formatAddress(address) {
  if (!address || address === '0x...') return '0x...';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format USDC amount for display
 */
export function formatUSDC(amount) {
  if (amount === undefined || amount === null) return '0 USDC';
  return `${amount.toLocaleString()} USDC`;
}

/**
 * Format expiry timestamp for display
 */
export function formatExpiry(expiry) {
  if (!expiry) return 'No expiry';
  
  const now = Date.now();
  const diff = expiry - now;
  
  if (diff <= 0) return 'Expired';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}

/**
 * Generate a random Ethereum address (for demo purposes)
 */
export function generateAddress() {
  const chars = '0123456789abcdef';
  let address = '0x';
  for (let i = 0; i < 40; i++) {
    address += chars[Math.floor(Math.random() * chars.length)];
  }
  return address;
}

/**
 * Simulate network delay
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
