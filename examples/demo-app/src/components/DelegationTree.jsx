import React from 'react';
import { formatAddress, formatExpiry, formatUSDC } from '../lib/utils.js';

export function DelegationTree({ state }) {
  const { rootDelegation, subDelegations, transfers, step } = state;

  if (step === 0) {
    return (
      <div className="delegation-tree">
        <div className="empty-tree">
          <div className="icon">🌱</div>
          <p>No delegations yet</p>
          <p className="hint">Click "Create Root Delegation" to start</p>
        </div>
      </div>
    );
  }

  return (
    <div className="delegation-tree">
      {/* Root Delegator (Human) */}
      <DelegationNode
        type="human"
        label="Root Delegator"
        address={rootDelegation?.delegator || '0x...'}
        role="Human with DeleGator Smart Account"
        amount={rootDelegation?.amount || 0}
        remaining={rootDelegation?.amount || 0}
        expiry={rootDelegation?.expiry}
        active={step >= 1}
        isRoot
      />

      <div className={`connector ${step >= 1 ? 'active' : ''}`} />

      {/* Agent A */}
      <DelegationNode
        type="agent"
        label="Agent A"
        address={rootDelegation?.delegate || '0x...'}
        role="Primary Delegate"
        amount={rootDelegation?.amount || 0}
        remaining={calculateAgentARemaining(rootDelegation, subDelegations)}
        expiry={rootDelegation?.expiry}
        active={step >= 1}
        pending={step < 1}
      />

      {step >= 2 && (
        <>
          <div className={`connector ${step >= 2 ? 'active' : ''}`} />
          
          {/* Sub-agents row */}
          <div className="sub-agents-row">
            {['B', 'C', 'D'].map((id, idx) => {
              const subDel = subDelegations?.[idx];
              const transfer = transfers?.[idx];
              
              return (
                <div key={id} className="sub-agent-wrapper">
                  <div className="sub-connector" />
                  <DelegationNode
                    type="subagent"
                    label={`Sub-Agent ${id}`}
                    address={subDel?.delegate || '0x...'}
                    role="Sub-Delegate"
                    amount={subDel?.amount || 0}
                    remaining={(subDel?.amount || 0) - (transfer?.amount || 0)}
                    expiry={subDel?.expiry}
                    active={step >= 2}
                    transferred={transfer?.amount || 0}
                    transferTo={transfer?.to}
                  />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function DelegationNode({ 
  type, 
  label, 
  address, 
  role, 
  amount, 
  remaining, 
  expiry, 
  active, 
  pending,
  isRoot,
  transferred,
  transferTo
}) {
  const getEmoji = () => {
    switch (type) {
      case 'human': return '👤';
      case 'agent': return '🤖';
      case 'subagent': return '🔧';
      default: return '📦';
    }
  };

  const nodeClasses = [
    'delegation-node',
    active ? 'active' : '',
    pending ? 'pending' : '',
    isRoot ? 'root' : ''
  ].filter(Boolean).join(' ');

  const isExpired = expiry && expiry < Date.now();

  return (
    <div className={nodeClasses}>
      <div className="node-header">
        <div className={`node-avatar ${type}`}>
          {getEmoji()}
        </div>
        <div className="node-info">
          <h3>{label}</h3>
          <p>{formatAddress(address)}</p>
        </div>
      </div>
      
      <div className="node-stats">
        <div className="stat">
          <span className="stat-label">Delegated</span>
          <span className="stat-value usdc">{formatUSDC(amount)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Remaining</span>
          <span className={`stat-value ${remaining > 0 ? 'remaining' : ''}`}>
            {formatUSDC(remaining)}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Expiry</span>
          <span className={`stat-value ${isExpired ? 'expired' : ''}`}>
            {formatExpiry(expiry)}
          </span>
        </div>
        {transferred > 0 && (
          <div className="stat">
            <span className="stat-label">Transferred</span>
            <span className="stat-value">{formatUSDC(transferred)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateAgentARemaining(rootDelegation, subDelegations) {
  if (!rootDelegation) return 0;
  if (!subDelegations || subDelegations.length === 0) return rootDelegation.amount;
  
  const totalSubDelegated = subDelegations.reduce((sum, sub) => sum + (sub?.amount || 0), 0);
  return rootDelegation.amount - totalSubDelegated;
}
