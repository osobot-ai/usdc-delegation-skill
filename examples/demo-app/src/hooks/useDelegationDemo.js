import { useState, useCallback } from 'react';
import { generateAddress, delay } from '../lib/utils.js';

// Demo addresses (simulated for UI)
const DEMO_ADDRESSES = {
  human: '0x742d35Cc6634C0532925a3b844Bc9e7595f3bA71',
  agentA: '0x8ba1f109551bD432803012645Hc5e38c2c2d6d3a',
  agentB: '0x1234567890abcdef1234567890abcdef12345678',
  agentC: '0xabcdef1234567890abcdef1234567890abcdef12',
  agentD: '0xfedcba0987654321fedcba0987654321fedcba09',
  recipient: '0x9876543210fedcba9876543210fedcba98765432'
};

// Contract addresses (real Base Sepolia)
const CONTRACTS = {
  delegationManager: '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3',
  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  erc20Enforcer: '0xf100b0819427117EcF76Ed94B358B1A5b5C6D2Fc',
  timestampEnforcer: '0x1046bb45C8d673d4ea75321280DB34899413c069',
  valueLteEnforcer: '0x92Bf12322527cAA612fd31a0e810472BBB106A8F'
};

const initialState = {
  step: 0,
  loading: false,
  rootDelegation: null,
  subDelegations: [],
  transfers: [null, null, null]
};

export function useDelegationDemo() {
  const [state, setState] = useState(initialState);
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((type, message, data = null) => {
    setLogs(prev => [...prev, {
      type,
      message,
      data,
      timestamp: Date.now()
    }]);
  }, []);

  const createRootDelegation = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    addLog('info', '🔐 Creating root delegation...');
    await delay(800);
    
    const expiry = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    const delegationHash = '0x' + Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    addLog('info', 'Building delegation with enforcers:');
    addLog('info', '  • ValueLteEnforcer: Prevents ETH transfers', { contract: CONTRACTS.valueLteEnforcer });
    addLog('info', '  • ERC20TransferAmountEnforcer: {amount} USDC max', { amount: '1,000' });
    addLog('info', '  • TimestampEnforcer: 24h expiry');
    
    await delay(600);
    addLog('info', '📝 Signing with EIP-712...');
    
    await delay(400);
    const rootDelegation = {
      delegator: DEMO_ADDRESSES.human,
      delegate: DEMO_ADDRESSES.agentA,
      amount: 1000,
      expiry,
      hash: delegationHash,
      signature: '0x' + Array.from({length: 130}, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('')
    };
    
    addLog('success', '✅ Root delegation created!');
    addLog('success', 'Delegation hash: {hash}', { hash: delegationHash.slice(0, 18) + '...' });
    addLog('info', '📋 Delegator: {addr} (Human)', { addr: formatAddr(DEMO_ADDRESSES.human) });
    addLog('info', '📋 Delegate: {addr} (Agent A)', { addr: formatAddr(DEMO_ADDRESSES.agentA) });
    addLog('info', '📋 Amount: 1,000 USDC • Expiry: 24h');
    
    setState(prev => ({
      ...prev,
      step: 1,
      loading: false,
      rootDelegation
    }));
  }, [addLog]);

  const createSubDelegations = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    
    addLog('info', '🔗 Creating transitive sub-delegations...');
    addLog('info', 'Agent A is delegating portions to 3 sub-agents');
    
    await delay(600);
    
    const subAgents = [
      { label: 'B', address: DEMO_ADDRESSES.agentB, amount: 300 },
      { label: 'C', address: DEMO_ADDRESSES.agentC, amount: 300 },
      { label: 'D', address: DEMO_ADDRESSES.agentD, amount: 300 }
    ];
    
    const subDelegations = [];
    
    for (const agent of subAgents) {
      addLog('info', `🔍 Validating scope for Sub-Agent ${agent.label}...`);
      await delay(300);
      addLog('success', `✅ Scope valid: ${agent.amount} USDC ≤ 1,000 USDC parent limit`);
      
      const hash = '0x' + Array.from({length: 64}, () => 
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      
      subDelegations.push({
        delegator: DEMO_ADDRESSES.agentA,
        delegate: agent.address,
        amount: agent.amount,
        expiry: Date.now() + (12 * 60 * 60 * 1000), // 12 hours
        hash,
        parentHash: state.rootDelegation.hash
      });
      
      addLog('success', `📝 Sub-delegation to Agent ${agent.label}: {hash}`, {
        hash: hash.slice(0, 18) + '...'
      });
      
      await delay(400);
    }
    
    addLog('success', '✅ All sub-delegations created!');
    addLog('info', '🔗 Delegation chain established:');
    addLog('info', '   Human → Agent A → [B, C, D]');
    addLog('info', '   Total delegated to sub-agents: 900 USDC');
    addLog('info', '   Remaining with Agent A: 100 USDC');
    
    setState(prev => ({
      ...prev,
      step: 2,
      loading: false,
      subDelegations
    }));
  }, [addLog, state.rootDelegation]);

  const executeTransfer = useCallback(async (agentLabel, index) => {
    setState(prev => ({ ...prev, loading: true }));
    
    const amounts = [50, 75, 100];
    const amount = amounts[index];
    
    addLog('info', `💸 Sub-Agent ${agentLabel} executing transfer...`);
    addLog('info', `   Amount: ${amount} USDC`);
    addLog('info', `   To: {addr}`, { addr: formatAddr(DEMO_ADDRESSES.recipient) });
    
    await delay(500);
    
    addLog('info', '🔍 Validating against delegation caveats...');
    await delay(300);
    addLog('success', '  ✓ Amount within limit (300 USDC)');
    addLog('success', '  ✓ Delegation not expired');
    addLog('success', '  ✓ Target is USDC contract');
    addLog('success', '  ✓ Method is transfer()');
    
    await delay(400);
    
    addLog('info', '📝 Building redeemDelegations() call...');
    addLog('info', `   DelegationManager: {addr}`, { addr: formatAddr(CONTRACTS.delegationManager) });
    
    await delay(300);
    
    // Simulate transaction
    const txHash = '0x' + Array.from({length: 64}, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    
    addLog('info', '🔬 Simulating transaction...');
    await delay(600);
    addLog('success', '✅ Simulation successful!');
    
    addLog('success', `✅ Transfer executed! Tx: {hash}`, { hash: txHash.slice(0, 18) + '...' });
    addLog('info', `   ${amount} USDC transferred from DeleGator account`);
    addLog('info', `   Remaining allowance for Agent ${agentLabel}: ${300 - amount} USDC`);
    
    setState(prev => {
      const newTransfers = [...prev.transfers];
      newTransfers[index] = {
        amount,
        to: DEMO_ADDRESSES.recipient,
        txHash,
        timestamp: Date.now()
      };
      
      return {
        ...prev,
        loading: false,
        transfers: newTransfers
      };
    });
  }, [addLog]);

  const reset = useCallback(() => {
    setState(initialState);
    setLogs([]);
    addLog('info', '🔄 Demo reset. Ready to start again!');
  }, [addLog]);

  return {
    state,
    logs,
    createRootDelegation,
    createSubDelegations,
    executeTransfer,
    reset
  };
}

function formatAddr(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
