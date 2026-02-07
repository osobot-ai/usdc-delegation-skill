#!/usr/bin/env node
/**
 * Create a transitive sub-delegation from an existing delegation
 * 
 * The sub-delegate receives a portion of the parent's authority.
 * Scope can only be NARROWED, never expanded.
 * 
 * Usage:
 *   node create-subdelegation.mjs --parent ./delegation.json --subdelegate 0x... --amount 200 --expiry 12h
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { 
  getClients, 
  buildDelegation, 
  signDelegation, 
  formatDelegation, 
  parseDuration,
  hashDelegation,
  validateSubDelegationScope 
} from './lib/delegation.mjs';

const argv = yargs(hideBin(process.argv))
  .option('parent', {
    type: 'string',
    description: 'Path to parent delegation JSON file',
    demandOption: true
  })
  .option('subdelegate', {
    type: 'string',
    description: 'Address of the sub-delegate (sub-agent)',
    demandOption: true
  })
  .option('amount', {
    type: 'number',
    description: 'Maximum USDC amount for sub-delegation',
    demandOption: true
  })
  .option('expiry', {
    type: 'string',
    description: 'Expiry duration (must be <= parent expiry)',
    demandOption: true
  })
  .option('recipients', {
    type: 'string',
    description: 'Comma-separated allowed recipients (must be subset of parent)',
    default: ''
  })
  .help()
  .argv;

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('🔗 Creating Transitive Sub-Delegation...\n');

  // Load parent delegation
  const parentDelegation = JSON.parse(readFileSync(argv.parent, 'utf8'));
  
  const { walletClient, account } = getClients(process.env.PRIVATE_KEY);
  
  // Verify we are the delegate of the parent
  if (account.address.toLowerCase() !== parentDelegation.delegate.toLowerCase()) {
    console.error('❌ You are not the delegate of the parent delegation');
    console.error(`   Expected: ${parentDelegation.delegate}`);
    console.error(`   Got:      ${account.address}`);
    process.exit(1);
  }

  const allowedRecipients = argv.recipients
    ? argv.recipients.split(',').map(r => r.trim())
    : [];

  const subDelegationParams = {
    amount: argv.amount,
    expirySeconds: parseDuration(argv.expiry),
    allowedRecipients
  };

  // Validate scope narrowing
  const validation = validateSubDelegationScope(parentDelegation, subDelegationParams);
  if (!validation.valid) {
    console.error('❌ Sub-delegation exceeds parent scope:');
    validation.errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  // Build sub-delegation with parent's hash as authority
  const subDelegation = buildDelegation({
    delegator: account.address, // We are now the delegator
    delegate: argv.subdelegate,
    authority: hashDelegation(parentDelegation), // Points to parent
    ...subDelegationParams
  });

  const signedSubDelegation = await signDelegation(subDelegation, walletClient);

  console.log('✅ Sub-Delegation Created:\n');
  console.log(formatDelegation(signedSubDelegation));
  console.log('\n📦 Delegation Chain:');
  console.log(`   Root → Parent (${hashDelegation(parentDelegation).slice(0, 18)}...) → This`);
  console.log('\n📦 Raw sub-delegation (save this):');
  console.log(JSON.stringify(signedSubDelegation, null, 2));
}

main().catch(console.error);
