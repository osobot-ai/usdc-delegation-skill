#!/usr/bin/env node
/**
 * Revoke a delegation on-chain
 * 
 * Per ERC-7710, revoking a delegation invalidates the entire sub-chain.
 * This calls DelegationManager.disableDelegation(delegationHash).
 * 
 * Usage:
 *   node revoke-delegation.mjs --delegation ./delegation.json
 *   node revoke-delegation.mjs --delegation ./delegation.json --execute
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { 
  getClients, 
  getDelegationHash, 
  formatDelegation,
  DELEGATION_FRAMEWORK 
} from './lib/delegation.mjs';

// DelegationManager ABI (partial)
const DELEGATION_MANAGER_ABI = [
  {
    name: 'disableDelegation',
    type: 'function',
    inputs: [
      { name: 'delegation', type: 'tuple', components: [
        { name: 'delegate', type: 'address' },
        { name: 'delegator', type: 'address' },
        { name: 'authority', type: 'bytes32' },
        { name: 'caveats', type: 'tuple[]', components: [
          { name: 'enforcer', type: 'address' },
          { name: 'terms', type: 'bytes' },
          { name: 'args', type: 'bytes' }
        ]},
        { name: 'salt', type: 'uint256' },
        { name: 'signature', type: 'bytes' }
      ]}
    ],
    outputs: []
  },
  {
    name: 'disabledDelegations',
    type: 'function',
    inputs: [{ name: 'delegationHash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  }
];

const argv = yargs(hideBin(process.argv))
  .option('delegation', {
    type: 'string',
    description: 'Path to delegation JSON file',
    demandOption: true
  })
  .option('execute', {
    type: 'boolean',
    description: 'Actually execute the revocation on-chain',
    default: false
  })
  .option('check', {
    type: 'boolean',
    description: 'Check if delegation is already revoked',
    default: false
  })
  .help()
  .argv;

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('🚫 ERC-7710 Delegation Revocation\n');

  const raw = JSON.parse(readFileSync(argv.delegation, 'utf8'));
  const delegation = {
    ...raw,
    salt: BigInt(raw.salt)
  };
  
  const { walletClient, publicClient, account, chain } = getClients(process.env.PRIVATE_KEY);
  
  console.log(`📍 Network: ${chain.name}`);
  console.log(`👤 Your address: ${account.address}\n`);
  
  // Verify we are the delegator
  if (account.address.toLowerCase() !== delegation.delegator.toLowerCase()) {
    console.error('❌ You are not the delegator of this delegation');
    console.error(`   Expected: ${delegation.delegator}`);
    console.error(`   Got:      ${account.address}`);
    console.error('\n   Only the delegator can revoke a delegation');
    process.exit(1);
  }

  console.log('📋 Delegation to revoke:');
  console.log(formatDelegation(delegation));
  console.log('');

  const delegationHash = getDelegationHash(delegation);
  
  // Check current status
  if (argv.check) {
    console.log('🔍 Checking on-chain status...');
    try {
      const isDisabled = await publicClient.readContract({
        address: DELEGATION_FRAMEWORK.DelegationManager,
        abi: DELEGATION_MANAGER_ABI,
        functionName: 'disabledDelegations',
        args: [delegationHash]
      });
      
      if (isDisabled) {
        console.log('✅ Delegation is ALREADY REVOKED on-chain');
      } else {
        console.log('⚠️  Delegation is ACTIVE on-chain');
      }
    } catch (e) {
      console.log('⚠️  Could not check on-chain status:', e.message);
    }
    console.log('');
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('⚠️  REVOCATION WARNING');
  console.log('═══════════════════════════════════════════════════════════════\n');
  console.log('  Revoking this delegation will:');
  console.log('  • Immediately invalidate the delegation on-chain');
  console.log('  • Invalidate ALL sub-delegations derived from this');
  console.log('  • This action is IRREVERSIBLE');
  console.log('');

  console.log('📝 Revocation Details:');
  console.log(`   DelegationManager: ${DELEGATION_FRAMEWORK.DelegationManager}`);
  console.log(`   Method:            disableDelegation(Delegation)`);
  console.log(`   Delegation Hash:   ${delegationHash}`);
  console.log(`   Delegate:          ${delegation.delegate}`);
  console.log('');

  if (!argv.execute) {
    console.log('💡 To execute revocation on-chain, run with --execute flag');
    console.log('   node revoke-delegation.mjs --delegation <file> --execute');
    return;
  }

  console.log('🔄 Executing revocation on-chain...');
  
  try {
    // Prepare the delegation struct for the contract call
    const delegationStruct = {
      delegate: delegation.delegate,
      delegator: delegation.delegator,
      authority: delegation.authority,
      caveats: delegation.caveats.map(c => ({
        enforcer: c.enforcer,
        terms: c.terms,
        args: c.args || '0x'
      })),
      salt: delegation.salt,
      signature: delegation.signature
    };

    const hash = await walletClient.writeContract({
      address: DELEGATION_FRAMEWORK.DelegationManager,
      abi: DELEGATION_MANAGER_ABI,
      functionName: 'disableDelegation',
      args: [delegationStruct]
    });

    console.log('✅ Revocation transaction submitted!');
    console.log(`   Transaction: ${hash}`);
    console.log(`   Explorer: https://sepolia.basescan.org/tx/${hash}`);
    
    console.log('\n⏳ Waiting for confirmation...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    
    if (receipt.status === 'success') {
      console.log('✅ Delegation successfully revoked!');
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed}`);
    } else {
      console.log('❌ Transaction failed');
    }
  } catch (error) {
    console.error('❌ Revocation failed:', error.message);
    if (error.message.includes('DelegationManager__AlreadyDisabled')) {
      console.log('\n💡 This delegation was already revoked');
    }
    process.exit(1);
  }
}

main().catch(console.error);
