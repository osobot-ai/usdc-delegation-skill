#!/usr/bin/env node
/**
 * Create a transitive sub-delegation from an existing delegation
 * 
 * The sub-delegate receives a portion of the parent's authority.
 * Per ERC-7710, scope can only be NARROWED, never expanded.
 * 
 * The authority field is set to the hash of the parent delegation,
 * creating a verifiable delegation chain.
 * 
 * Usage:
 *   node create-subdelegation.mjs --parent ./delegation.json --subdelegate 0x... --amount 200 --expiry 12h
 */

import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { 
  getClients, 
  buildDelegation, 
  signDelegation, 
  formatDelegation, 
  parseDuration,
  getDelegationHash,
  validateSubDelegationScope,
  DELEGATION_FRAMEWORK
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
  .option('max-calls', {
    type: 'number',
    description: 'Maximum number of times sub-delegation can be used'
  })
  .option('output', {
    type: 'string',
    alias: 'o',
    description: 'Output file path for the sub-delegation JSON'
  })
  .help()
  .argv;

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('🔗 Creating Transitive Sub-Delegation (ERC-7710)\n');

  // Load and parse parent delegation
  const rawParent = JSON.parse(readFileSync(argv.parent, 'utf8'));
  const parentDelegation = {
    ...rawParent,
    salt: BigInt(rawParent.salt)
  };
  
  const { walletClient, account, chain } = getClients(process.env.PRIVATE_KEY);
  
  console.log(`📍 Network: ${chain.name}`);
  console.log(`👤 Your address: ${account.address}\n`);
  
  // Verify we are the delegate of the parent
  if (account.address.toLowerCase() !== parentDelegation.delegate.toLowerCase()) {
    console.error('❌ You are not the delegate of the parent delegation');
    console.error(`   Expected: ${parentDelegation.delegate}`);
    console.error(`   Got:      ${account.address}`);
    console.error('\n   Only the delegate can create sub-delegations');
    process.exit(1);
  }

  const allowedRecipients = argv.recipients
    ? argv.recipients.split(',').map(r => r.trim())
    : [];

  const subDelegationParams = {
    amount: argv.amount,
    expirySeconds: parseDuration(argv.expiry),
    allowedRecipients,
    maxCalls: argv.maxCalls
  };

  // Validate scope narrowing (ERC-7710 requirement)
  console.log('🔍 Validating scope narrowing...');
  const validation = validateSubDelegationScope(parentDelegation, subDelegationParams);
  if (!validation.valid) {
    console.error('❌ Sub-delegation exceeds parent scope:');
    validation.errors.forEach(e => console.error(`   - ${e}`));
    console.error('\n   Per ERC-7710, sub-delegations can only NARROW scope');
    process.exit(1);
  }
  console.log('✅ Scope validation passed\n');

  // Compute parent delegation hash for authority chain
  const parentHash = getDelegationHash(parentDelegation);
  
  console.log('📋 Parent Delegation:');
  console.log(`   Hash: ${parentHash}`);
  console.log(`   From: ${parentDelegation.delegator}`);
  console.log(`   To:   ${parentDelegation.delegate} (you)`);
  console.log('');

  // Build sub-delegation with parent's hash as authority
  const subDelegation = buildDelegation({
    delegator: account.address, // We are now the delegator
    delegate: argv.subdelegate,
    authority: parentHash, // Links to parent delegation
    ...subDelegationParams
  });

  console.log('📝 Signing with EIP-712...');
  const signedSubDelegation = await signDelegation(subDelegation, walletClient);

  console.log('✅ Sub-Delegation Created:\n');
  console.log(formatDelegation(signedSubDelegation));
  
  const subHash = getDelegationHash(signedSubDelegation);
  console.log('\n🔗 Delegation Chain:');
  console.log(`   Root Delegator: ${parentDelegation.delegator}`);
  console.log(`       ↓ (${parentHash.slice(0, 18)}...)`);
  console.log(`   You (delegate): ${account.address}`);
  console.log(`       ↓ (${subHash.slice(0, 18)}...)`);
  console.log(`   Sub-delegate:   ${argv.subdelegate}`);
  
  // Serialize for JSON
  const serializable = {
    ...signedSubDelegation,
    salt: signedSubDelegation.salt.toString(),
    _meta: {
      createdAt: new Date().toISOString(),
      delegationHash: subHash,
      parentHash: parentHash,
      chain: chain.name,
      chainId: chain.id,
      delegationManager: DELEGATION_FRAMEWORK.DelegationManager
    },
    _chain: {
      // Include parent for redemption
      parent: {
        ...parentDelegation,
        salt: parentDelegation.salt.toString()
      }
    }
  };

  if (argv.output) {
    writeFileSync(argv.output, JSON.stringify(serializable, null, 2));
    console.log(`\n💾 Saved to: ${argv.output}`);
  } else {
    console.log('\n📦 Raw sub-delegation (save this):');
    console.log(JSON.stringify(serializable, null, 2));
  }

  console.log('\n💡 Notes:');
  console.log('   - Sub-delegate must include BOTH delegations when redeeming');
  console.log('   - Revoking the parent invalidates ALL sub-delegations');
  console.log('   - Sub-delegate can create further sub-delegations (transitive)');
}

main().catch(console.error);
