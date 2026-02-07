#!/usr/bin/env node
/**
 * Execute a USDC transfer using a delegation
 * 
 * Validates all caveats before execution.
 * 
 * Usage:
 *   node execute-transfer.mjs --delegation ./delegation.json --to 0x... --amount 100
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parseUnits, formatUnits } from 'viem';
import { 
  getClients, 
  validateTransfer, 
  formatDelegation,
  USDC_ADDRESS,
  USDC_DECIMALS 
} from './lib/delegation.mjs';

const argv = yargs(hideBin(process.argv))
  .option('delegation', {
    type: 'string',
    description: 'Path to delegation JSON file',
    demandOption: true
  })
  .option('to', {
    type: 'string',
    description: 'Recipient address',
    demandOption: true
  })
  .option('amount', {
    type: 'number',
    description: 'USDC amount to transfer',
    demandOption: true
  })
  .option('dry-run', {
    type: 'boolean',
    description: 'Validate without executing',
    default: false
  })
  .help()
  .argv;

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('💸 Executing USDC Transfer via Delegation...\n');

  // Load delegation
  const delegation = JSON.parse(readFileSync(argv.delegation, 'utf8'));
  
  const { walletClient, publicClient, account } = getClients(process.env.PRIVATE_KEY);
  
  // Verify we are the delegate
  if (account.address.toLowerCase() !== delegation.delegate.toLowerCase()) {
    console.error('❌ You are not the delegate of this delegation');
    process.exit(1);
  }

  console.log('📋 Delegation:');
  console.log(formatDelegation(delegation));
  console.log('');

  // Validate against caveats
  const validation = validateTransfer(delegation, argv.to, argv.amount);
  if (!validation.valid) {
    console.error('❌ Transfer violates delegation caveats:');
    validation.errors.forEach(e => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('✅ Transfer validated against all caveats');
  console.log(`   To:     ${argv.to}`);
  console.log(`   Amount: ${argv.amount} USDC`);
  console.log('');

  if (argv.dryRun) {
    console.log('🔍 Dry run - no transaction sent');
    return;
  }

  // In production, this would go through the Delegation Manager
  // For demo, we show what the transaction would look like
  console.log('📝 Transaction would be submitted to Delegation Manager:');
  console.log(`   Target:    ${USDC_ADDRESS}`);
  console.log(`   Method:    transfer(address,uint256)`);
  console.log(`   Args:      [${argv.to}, ${parseUnits(argv.amount.toString(), USDC_DECIMALS)}]`);
  console.log(`   Authority: via delegation chain`);
  console.log('');
  console.log('⚠️  Demo mode - actual on-chain execution requires deployed Delegation Manager');
}

main().catch(console.error);
