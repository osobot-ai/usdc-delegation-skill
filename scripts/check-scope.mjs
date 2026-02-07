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
import { formatUnits, decodeAbiParameters, parseAbiParameters } from 'viem';
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
          // Terms: (address token, uint256 amount)
          const token = '0x' + caveat.terms.slice(26, 66);
          const amount = BigInt('0x' + caveat.terms.slice(66));
          console.log(`     💰 Maximum Amount: ${formatUnits(amount, USDC_DECIMALS)} USDC`);
          console.log(`     📍 Token: ${token}`);
          console.log(`     Status: ✅ Active`);
          break;
        }
        
        case 'TimestampEnforcer': {
          // Terms: (uint128 threshold, uint128 mode)
          const threshold = Number(BigInt('0x' + caveat.terms.slice(2, 34)));
          const mode = Number(BigInt('0x' + caveat.terms.slice(34, 66)));
          const expiry = new Date(threshold * 1000);
          const remaining = threshold - now;
          
          console.log(`     ⏰ ${mode === 0 ? 'Expires' : 'Valid after'}: ${expiry.toISOString()}`);
          
          if (mode === 0) { // Before mode (expiry)
            if (remaining > 0) {
              const days = Math.floor(remaining / 86400);
              const hours = Math.floor((remaining % 86400) / 3600);
              const minutes = Math.floor((remaining % 3600) / 60);
              console.log(`     Status: ✅ Valid - ${days}d ${hours}h ${minutes}m remaining`);
            } else {
              console.log(`     Status: ❌ EXPIRED ${Math.abs(remaining / 60).toFixed(0)} minutes ago`);
            }
          } else { // After mode
            if (now >= threshold) {
              console.log(`     Status: ✅ Now active`);
            } else {
              console.log(`     Status: ⏳ Not yet active`);
            }
          }
          break;
        }
        
        case 'AllowedTargetsEnforcer': {
          // Terms: (address[])
          // Simplified - would need proper ABI decoding
          console.log(`     📬 Restricts transfer recipients`);
          console.log(`     Status: ✅ Active`);
          if (argv.verbose) {
            console.log(`     Raw terms: ${caveat.terms}`);
          }
          break;
        }
        
        case 'AllowedMethodsEnforcer': {
          // Terms: packed bytes4[]
          const selectorsCount = (caveat.terms.length - 2) / 8;
          const selectors = [];
          for (let j = 0; j < selectorsCount; j++) {
            selectors.push(caveat.terms.slice(2 + j * 8, 10 + j * 8));
          }
          console.log(`     🔧 Allowed method selectors: ${selectors.length}`);
          selectors.forEach(s => {
            const known = {
              'a9059cbb': 'transfer(address,uint256)',
              '095ea7b3': 'approve(address,uint256)',
              '23b872dd': 'transferFrom(address,address,uint256)'
            };
            console.log(`        - 0x${s} ${known[s] ? `(${known[s]})` : ''}`);
          });
          console.log(`     Status: ✅ Active`);
          break;
        }
        
        case 'LimitedCallsEnforcer': {
          const maxCalls = BigInt('0x' + caveat.terms.slice(2));
          console.log(`     📊 Maximum calls: ${maxCalls}`);
          console.log(`     Status: ✅ Active (check on-chain for remaining)`);
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
  const hasMethods = delegation.caveats.some(c => 
    c.enforcer.toLowerCase() === DELEGATION_FRAMEWORK.AllowedMethodsEnforcer.toLowerCase()
  );
  
  console.log(`  Amount Limit:     ${hasAmount ? '✅' : '⚠️  Missing (DANGEROUS)'}`);
  console.log(`  Expiry Time:      ${hasExpiry ? '✅' : '⚠️  Missing (indefinite)'}`);
  console.log(`  Method Restrict:  ${hasMethods ? '✅' : '⚠️  Missing'}`);
  
  // Metadata if present
  if (raw._meta) {
    console.log('\n📎 METADATA');
    console.log(`   Created: ${raw._meta.createdAt}`);
    console.log(`   Chain:   ${raw._meta.chain} (${raw._meta.chainId})`);
  }
}

main().catch(console.error);
