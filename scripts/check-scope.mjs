#!/usr/bin/env node
/**
 * Check the scope of a delegation
 * 
 * Displays all caveats and remaining capacity.
 * 
 * Usage:
 *   node check-scope.mjs --delegation ./delegation.json
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { formatUnits } from 'viem';
import { formatDelegation, hashDelegation, CAVEAT_TYPES, USDC_DECIMALS } from './lib/delegation.mjs';

const argv = yargs(hideBin(process.argv))
  .option('delegation', {
    type: 'string',
    description: 'Path to delegation JSON file',
    demandOption: true
  })
  .help()
  .argv;

async function main() {
  console.log('🔍 Delegation Scope Analysis\n');

  const delegation = JSON.parse(readFileSync(argv.delegation, 'utf8'));
  
  console.log(formatDelegation(delegation));
  console.log('');
  
  // Detailed caveat analysis
  console.log('📊 Caveat Details:');
  
  for (const caveat of delegation.caveats) {
    if (caveat.type === CAVEAT_TYPES.ALLOWED_AMOUNT) {
      const amount = formatUnits(BigInt(caveat.data), USDC_DECIMALS);
      console.log(`\n💰 Amount Limit: ${amount} USDC`);
      console.log('   Maximum that can be transferred under this delegation');
    }
    
    if (caveat.type === CAVEAT_TYPES.EXPIRY_TIME) {
      const expiry = new Date(parseInt(caveat.data) * 1000);
      const now = new Date();
      const remaining = expiry - now;
      
      console.log(`\n⏰ Expiry: ${expiry.toISOString()}`);
      if (remaining > 0) {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        console.log(`   ✅ Valid - ${hours}h ${minutes}m remaining`);
      } else {
        console.log('   ❌ EXPIRED');
      }
    }
    
    if (caveat.type === CAVEAT_TYPES.ALLOWED_RECIPIENTS) {
      const recipients = JSON.parse(caveat.data);
      console.log(`\n📬 Allowed Recipients: ${recipients.length}`);
      recipients.forEach((r, i) => console.log(`   ${i + 1}. ${r}`));
    }
    
    if (caveat.type === CAVEAT_TYPES.ALLOWED_METHODS) {
      const methods = JSON.parse(caveat.data);
      console.log(`\n🔧 Allowed Methods: ${methods.length}`);
      methods.forEach(m => console.log(`   - ${m}`));
    }
  }
  
  // Chain info
  console.log('\n🔗 Delegation Chain:');
  if (delegation.authority === '0x0000000000000000000000000000000000000000000000000000000000000000') {
    console.log('   ROOT delegation (directly from delegator)');
  } else {
    console.log(`   Sub-delegation of: ${delegation.authority.slice(0, 18)}...`);
  }
}

main().catch(console.error);
