#!/usr/bin/env node
/**
 * Check the scope of a delegation
 * 
 * Displays all caveats (constraints) and their status.
 * Useful for understanding what actions are permitted.
 * 
 * Usage:
 *   node check-scope.mjs --delegation ./delegation.json
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { formatUnits } from 'viem';
import { 
  formatDelegation, 
  getDelegationHash, 
  DELEGATION_FRAMEWORK, 
  USDC_DECIMALS,
  ROOT_AUTHORITY
} from './lib/delegation.mjs';

const argv = yargs(hideBin(process.argv))
  .option('delegation', {
    type: 'string',
    description: 'Path to delegation JSON file',
    demandOption: true
  })
  .option('verbose', {
    type: 'boolean',
    alias: 'v',
    description: 'Show raw terms data',
    default: false
  })
  .help()
  .argv;

async function main() {
  console.log('🔍 ERC-7710 Delegation Scope Analysis\n');

  const raw = JSON.parse(readFileSync(argv.delegation, 'utf8'));
  const delegation = {
    ...raw,
    salt: BigInt(raw.salt)
  };
  
  const delegationHash = getDelegationHash(delegation);
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📋 DELEGATION OVERVIEW');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  console.log(`  Delegator:  ${delegation.delegator}`);
  console.log(`  Delegate:   ${delegation.delegate}`);
  console.log(`  Hash:       ${delegationHash}`);
  console.log(`  Salt:       ${delegation.salt}`);
  console.log(`  Signed:     ${delegation.signature && delegation.signature !== '0x' ? '✓ Yes' : '✗ No'}`);
  
  // Chain info
  console.log('\n🔗 DELEGATION CHAIN');
  if (delegation.authority === ROOT_AUTHORITY) {
    console.log('   Type: ROOT delegation (directly from delegator)');
    console.log('   The delegator owns the funds being delegated.');
  } else {
    console.log('   Type: SUB-DELEGATION (derived from parent)');
    console.log(`   Parent: ${delegation.authority}`);
    console.log('   This is a transitive delegation in a chain.');
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('🔒 CAVEATS (SCOPE CONSTRAINTS)');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  if (delegation.caveats.length === 0) {
    console.log('  ⚠️  NO CAVEATS - Delegation has FULL authority!');
    console.log('      This is extremely dangerous. Add caveats to limit scope.');
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = 0; i < delegation.caveats.length; i++) {
    const caveat = delegation.caveats[i];
    const enforcerName = Object.entries(DELEGATION_FRAMEWORK)
      .find(([_, addr]) => addr.toLowerCase() === caveat.enforcer.toLowerCase())?.[0] 
      || 'Unknown';
    
    console.log(`  ${i + 1}. ${enforcerName}`);
    console.log(`     Contract: ${caveat.enforcer}`);
    
    // Decode and display specific caveats
    try {
      switch (enforcerName) {
        case 'ERC20TransferAmountEnforcer': {
          // Terms: encodePacked(address[20], uint256[32]) = 52 bytes
          const token = '0x' + caveat.terms.slice(2, 42);
          const amount = BigInt('0x' + caveat.terms.slice(42));
          console.log(`     💰 Maximum Amount: ${formatUnits(amount, USDC_DECIMALS)} USDC`);
          console.log(`     📍 Token: ${token}`);
          console.log(`     🔧 Method: transfer(address,uint256) only`);
          console.log(`     Status: ✅ Active`);
          break;
        }
        
        case 'TimestampEnforcer': {
          // Terms: encodePacked(uint128 afterThreshold, uint128 beforeThreshold) = 32 bytes
          // afterThreshold: must execute AFTER this time (0 = no minimum)
          // beforeThreshold: must execute BEFORE this time (0 = no expiry)
          const afterThreshold = Number(BigInt('0x' + caveat.terms.slice(2, 34)));
          const beforeThreshold = Number(BigInt('0x' + caveat.terms.slice(34, 66)));
          
          // Show time constraints
          if (afterThreshold > 0) {
            const afterDate = new Date(afterThreshold * 1000);
            console.log(`     ⏰ Valid after: ${afterDate.toISOString()}`);
            if (now <= afterThreshold) {
              const remaining = afterThreshold - now;
              const hours = Math.floor(remaining / 3600);
              const minutes = Math.floor((remaining % 3600) / 60);
              console.log(`     Status: ⏳ Not yet active - ${hours}h ${minutes}m until valid`);
            } else {
              console.log(`     Status: ✅ Start time passed`);
            }
          }
          
          if (beforeThreshold > 0) {
            const expiryDate = new Date(beforeThreshold * 1000);
            console.log(`     ⏰ Expires: ${expiryDate.toISOString()}`);
            const remaining = beforeThreshold - now;
            if (remaining > 0) {
              const days = Math.floor(remaining / 86400);
              const hours = Math.floor((remaining % 86400) / 3600);
              const minutes = Math.floor((remaining % 3600) / 60);
              console.log(`     Status: ✅ Valid - ${days}d ${hours}h ${minutes}m remaining`);
            } else {
              console.log(`     Status: ❌ EXPIRED ${Math.abs(remaining / 60).toFixed(0)} minutes ago`);
            }
          }
          
          if (afterThreshold === 0 && beforeThreshold === 0) {
            console.log(`     ⚠️  No time constraints (perpetual)`);
          }
          break;
        }
        
        case 'ValueLteEnforcer': {
          // Terms: uint256 as bytes32 (32 bytes)
          const maxValue = BigInt(caveat.terms);
          if (maxValue === 0n) {
            console.log(`     🚫 Max ETH Value: 0 (prevents ETH transfers)`);
            console.log(`     📝 Purpose: Ensures only ERC20 transfers, no native ETH`);
            console.log(`     Status: ✅ Active`);
          } else {
            console.log(`     💎 Max ETH Value: ${formatUnits(maxValue, 18)} ETH`);
            console.log(`     Status: ✅ Active`);
          }
          break;
        }
        
        case 'RedeemerEnforcer': {
          console.log(`     👤 Restricts who can redeem this delegation`);
          console.log(`     Status: ✅ Active`);
          break;
        }
        
        default:
          console.log(`     📋 Custom enforcer`);
          if (argv.verbose) {
            console.log(`     Terms: ${caveat.terms}`);
          }
      }
    } catch (e) {
      console.log(`     ⚠️  Could not decode terms`);
      if (argv.verbose) {
        console.log(`     Raw terms: ${caveat.terms}`);
        console.log(`     Error: ${e.message}`);
      }
    }
    
    if (caveat.args && caveat.args !== '0x') {
      console.log(`     Args: ${caveat.args}`);
    }
    
    console.log('');
  }

  // Security summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🛡️  SECURITY SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const hasAmount = delegation.caveats.some(c => 
    c.enforcer.toLowerCase() === DELEGATION_FRAMEWORK.ERC20TransferAmountEnforcer.toLowerCase()
  );
  const hasExpiry = delegation.caveats.some(c => 
    c.enforcer.toLowerCase() === DELEGATION_FRAMEWORK.TimestampEnforcer.toLowerCase()
  );
  const hasValueLimit = delegation.caveats.some(c => 
    c.enforcer.toLowerCase() === DELEGATION_FRAMEWORK.ValueLteEnforcer.toLowerCase()
  );
  
  console.log(`  Amount Limit:      ${hasAmount ? '✅' : '⚠️  Missing (DANGEROUS)'}`);
  console.log(`  Expiry Time:       ${hasExpiry ? '✅' : '⚠️  Missing (indefinite)'}`);
  console.log(`  ETH Prevention:    ${hasValueLimit ? '✅' : '⚠️  Missing (can transfer ETH)'}`);
  
  if (hasAmount && hasExpiry && hasValueLimit) {
    console.log('\n  ✅ Properly scoped delegation with all recommended enforcers');
  }
  
  // Metadata if present
  if (raw._meta) {
    console.log('\n📎 METADATA');
    console.log(`   Created: ${raw._meta.createdAt}`);
    console.log(`   Chain:   ${raw._meta.chain} (${raw._meta.chainId})`);
  }
}

main().catch(console.error);
