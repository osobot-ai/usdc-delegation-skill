#!/usr/bin/env node
/**
 * Execute a USDC transfer using a delegation via ERC-7710
 * 
 * This script:
 * 1. Loads and validates the delegation
 * 2. Checks all caveats before execution
 * 3. Builds the ERC-7579 execution calldata
 * 4. Calls DelegationManager.redeemDelegations()
 * 
 * Usage:
 *   node execute-transfer.mjs --delegation ./delegation.json --to 0x... --amount 100
 *   node execute-transfer.mjs --delegation ./delegation.json --to 0x... --amount 50 --dry-run
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { parseUnits, formatUnits, encodeFunctionData, keccak256, toBytes } from 'viem';
import { 
  getClients, 
  validateTransfer, 
  formatDelegation,
  getDelegationHash,
  encodeSingleExecution,
  USDC_ADDRESS,
  USDC_DECIMALS,
  DELEGATION_FRAMEWORK,
  SINGLE_CALL_MODE
} from './lib/delegation.mjs';

// USDC transfer function ABI
const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ type: 'bool' }]
  }
];

// DelegationManager ABI (partial)
const DELEGATION_MANAGER_ABI = [
  {
    name: 'redeemDelegations',
    type: 'function',
    inputs: [
      { name: '_permissionContexts', type: 'bytes[]' },
      { name: '_modes', type: 'bytes32[]' },
      { name: '_executionCallDatas', type: 'bytes[]' }
    ],
    outputs: []
  }
];

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
  .option('simulate', {
    type: 'boolean',
    description: 'Simulate the transaction on-chain',
    default: false
  })
  .help()
  .argv;

async function main() {
  if (!process.env.PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY environment variable required');
    process.exit(1);
  }

  console.log('💸 Executing USDC Transfer via ERC-7710 Delegation\n');

  // Load and parse delegation
  const rawDelegation = JSON.parse(readFileSync(argv.delegation, 'utf8'));
  
  // Convert string salt back to BigInt
  const delegation = {
    ...rawDelegation,
    salt: BigInt(rawDelegation.salt)
  };
  
  const { walletClient, publicClient, account, chain } = getClients(process.env.PRIVATE_KEY);
  
  console.log(`📍 Network: ${chain.name}`);
  console.log(`👤 Executor: ${account.address}\n`);
  
  // Verify we are the delegate
  if (account.address.toLowerCase() !== delegation.delegate.toLowerCase()) {
    console.error('❌ You are not the delegate of this delegation');
    console.error(`   Expected: ${delegation.delegate}`);
    console.error(`   Got:      ${account.address}`);
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
    console.log('🔍 Dry run complete - no transaction sent');
    return;
  }

  // Build the transfer calldata
  const transferCalldata = encodeFunctionData({
    abi: USDC_ABI,
    functionName: 'transfer',
    args: [argv.to, parseUnits(argv.amount.toString(), USDC_DECIMALS)]
  });

  // Build ERC-7579 execution calldata (single call mode)
  const executionCallData = encodeSingleExecution(
    USDC_ADDRESS,
    0n, // No ETH value
    transferCalldata
  );

  // Build the permission context (delegation chain encoded)
  // For a single delegation, it's just the delegation itself encoded
  const permissionContext = buildPermissionContext([delegation]);

  console.log('📝 Transaction Details:');
  console.log(`   DelegationManager: ${DELEGATION_FRAMEWORK.DelegationManager}`);
  console.log(`   Method:            redeemDelegations`);
  console.log(`   Target:            ${USDC_ADDRESS} (USDC)`);
  console.log(`   Transfer:          ${argv.amount} USDC → ${argv.to}`);
  console.log(`   Delegation Hash:   ${getDelegationHash(delegation)}`);
  console.log('');

  if (argv.simulate) {
    console.log('🔬 Simulating transaction...');
    try {
      const { request } = await publicClient.simulateContract({
        address: DELEGATION_FRAMEWORK.DelegationManager,
        abi: DELEGATION_MANAGER_ABI,
        functionName: 'redeemDelegations',
        args: [
          [permissionContext],
          [SINGLE_CALL_MODE],
          [executionCallData]
        ],
        account: account.address
      });
      console.log('✅ Simulation successful!');
    } catch (error) {
      console.error('❌ Simulation failed:', error.message);
      process.exit(1);
    }
  }

  console.log('⚠️  Demo mode - to execute on-chain:');
  console.log('   1. Ensure the delegator has approved DelegationManager');
  console.log('   2. Ensure the delegator has sufficient USDC balance');
  console.log('   3. Call redeemDelegations with the parameters above');
}

/**
 * Build the ABI-encoded permission context for a delegation chain
 * The context is an array of Delegation structs, leaf to root
 */
function buildPermissionContext(delegationChain) {
  // In production, this would be proper ABI encoding of the Delegation[] array
  // For now, we encode as the raw delegation data
  const encoded = delegationChain.map(d => ({
    delegate: d.delegate,
    delegator: d.delegator,
    authority: d.authority,
    caveats: d.caveats.map(c => ({
      enforcer: c.enforcer,
      terms: c.terms,
      args: c.args || '0x'
    })),
    salt: d.salt.toString(),
    signature: d.signature
  }));
  
  // Return as hex-encoded JSON for demo
  // Production would use proper ABI encoding
  return '0x' + Buffer.from(JSON.stringify(encoded)).toString('hex');
}

main().catch(console.error);
