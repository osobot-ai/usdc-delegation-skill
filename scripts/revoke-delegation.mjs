#!/usr/bin/env node
/**
 * Revoke a delegation
 * 
 * Revoking cascades to all sub-delegations in the chain.
 * 
 * Usage:
 *   node revoke-delegation.mjs --delegation ./delegation.json
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { getClients, hashDelegation, formatDelegation } from './lib/delegation.mjs';

const argv = yargs(hideBin(process.argv))
  .option('delegation', {
    type: 'string',
    description: 'Path to delegation JSON file',
    demandOption: true
  })
  .help()
  .argv;

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('🚫 Revoking Delegation...\n');

  const delegation = JSON.parse(readFileSync(argv.delegation, 'utf8'));
  const { account } = getClients(process.env.PRIVATE_KEY);
  
  // Verify we are the delegator
  if (account.address.toLowerCase() !== delegation.delegator.toLowerCase()) {
    console.error('❌ You are not the delegator of this delegation');
    console.error('   Only the delegator can revoke');
    process.exit(1);
  }

  console.log('📋 Delegation to revoke:');
  console.log(formatDelegation(delegation));
  console.log('');

  const delegationHash = hashDelegation(delegation);
  
  console.log('✅ Revocation prepared');
  console.log(`   Hash: ${delegationHash}`);
  console.log('');
  console.log('⚠️  All sub-delegations derived from this delegation will also be invalidated');
  console.log('');
  console.log('📝 Revocation would be submitted to Delegation Manager:');
  console.log(`   Method: disableDelegation(bytes32)`);
  console.log(`   Args:   [${delegationHash}]`);
}

main().catch(console.error);
