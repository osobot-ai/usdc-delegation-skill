#!/usr/bin/env node
/**
 * Create a USDC delegation with scoped permissions
 * 
 * This creates an ERC-7710 compliant delegation using the MetaMask Delegation Framework.
 * The delegation is signed with EIP-712 typed data and can be shared offchain.
 * 
 * Usage:
 *   node create-delegation.mjs --delegate 0x... --amount 1000 --expiry 24h
 *   node create-delegation.mjs --delegate 0x... --amount 500 --expiry 7d --recipients 0xA,0xB
 */

import 'dotenv/config';
import { writeFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { 
  getClients, 
  buildDelegation, 
  signDelegation, 
  formatDelegation, 
  parseDuration,
  getDelegationHash,
  DELEGATION_FRAMEWORK,
  USDC_ADDRESS
} from './lib/delegation.mjs';

const argv = yargs(hideBin(process.argv))
  .option('delegate', {
    type: 'string',
    description: 'Address of the delegate (agent)',
    demandOption: true
  })
  .option('amount', {
    type: 'number',
    description: 'Maximum USDC amount (e.g., 1000)',
    demandOption: true
  })
  .option('expiry', {
    type: 'string',
    description: 'Expiry duration (e.g., 24h, 7d)',
    demandOption: true
  })
  .option('recipients', {
    type: 'string',
    description: 'Comma-separated list of allowed recipient addresses',
    default: ''
  })
  .option('max-calls', {
    type: 'number',
    description: 'Maximum number of times delegation can be used'
  })
  .option('output', {
    type: 'string',
    alias: 'o',
    description: 'Output file path for the delegation JSON'
  })
  .help()
  .argv;

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('🔐 Creating ERC-7710 USDC Delegation\n');
  console.log('📋 Framework Contracts:');
  console.log(`   DelegationManager: ${DELEGATION_FRAMEWORK.DelegationManager}`);
  console.log(`   USDC Token:        ${USDC_ADDRESS}`);
  console.log('');

  const { walletClient, account, chain } = getClients(process.env.PRIVATE_KEY);
  
  console.log(`📍 Network: ${chain.name} (${chain.id})`);
  console.log(`👤 Delegator: ${account.address}\n`);
  
  const allowedRecipients = argv.recipients 
    ? argv.recipients.split(',').map(r => r.trim())
    : [];

  // Build the delegation with proper ERC-7710 caveats
  const delegation = buildDelegation({
    delegator: account.address,
    delegate: argv.delegate,
    amount: argv.amount,
    expirySeconds: parseDuration(argv.expiry),
    allowedRecipients,
    maxCalls: argv.maxCalls
  });

  console.log('📝 Signing with EIP-712...');
  const signedDelegation = await signDelegation(delegation, walletClient);

  console.log('✅ Delegation Created:\n');
  console.log(formatDelegation(signedDelegation));
  
  // Convert BigInt salt to string for JSON serialization
  const serializable = {
    ...signedDelegation,
    salt: signedDelegation.salt.toString(),
    _meta: {
      createdAt: new Date().toISOString(),
      delegationHash: getDelegationHash(signedDelegation),
      chain: chain.name,
      chainId: chain.id,
      usdcAddress: USDC_ADDRESS,
      delegationManager: DELEGATION_FRAMEWORK.DelegationManager
    }
  };

  if (argv.output) {
    writeFileSync(argv.output, JSON.stringify(serializable, null, 2));
    console.log(`\n💾 Saved to: ${argv.output}`);
  } else {
    console.log('\n📦 Raw delegation (save this):');
    console.log(JSON.stringify(serializable, null, 2));
  }

  console.log('\n💡 To use this delegation:');
  console.log('   1. Share the JSON with the delegate (agent)');
  console.log('   2. Delegate can execute transfers via DelegationManager.redeemDelegations()');
  console.log('   3. Revoke anytime with: node revoke-delegation.mjs --delegation <file>');
}

main().catch(console.error);
