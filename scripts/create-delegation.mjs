#!/usr/bin/env node
/**
 * Create a USDC delegation with scoped permissions
 * 
 * Usage:
 *   node create-delegation.mjs --delegate 0x... --amount 1000 --expiry 24h
 *   node create-delegation.mjs --delegate 0x... --amount 500 --expiry 7d --recipients 0xA,0xB
 */

import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { getClients, buildDelegation, signDelegation, formatDelegation, parseDuration } from './lib/delegation.mjs';

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
  .help()
  .argv;

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('🔐 Creating USDC Delegation...\n');

  const { walletClient, account } = getClients(process.env.PRIVATE_KEY);
  
  const allowedRecipients = argv.recipients 
    ? argv.recipients.split(',').map(r => r.trim())
    : [];

  const delegation = buildDelegation({
    delegator: account.address,
    delegate: argv.delegate,
    amount: argv.amount,
    expirySeconds: parseDuration(argv.expiry),
    allowedRecipients
  });

  const signedDelegation = await signDelegation(delegation, walletClient);

  console.log('✅ Delegation Created:\n');
  console.log(formatDelegation(signedDelegation));
  console.log('\n📦 Raw delegation (save this):');
  console.log(JSON.stringify(signedDelegation, null, 2));
}

main().catch(console.error);
