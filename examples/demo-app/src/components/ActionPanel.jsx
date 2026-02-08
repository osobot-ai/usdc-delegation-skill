import React from 'react';

export function ActionPanel({ 
  state,
  onCreateRootDelegation,
  onCreateSubDelegations,
  onExecuteTransfer,
  onReset
}) {
  const { step, loading, transfers } = state;
  
  const hasTransferredB = transfers?.[0]?.amount > 0;
  const hasTransferredC = transfers?.[1]?.amount > 0;
  const hasTransferredD = transfers?.[2]?.amount > 0;

  return (
    <div className="action-buttons">
      {/* Step 1: Create Root Delegation */}
      <button
        className="action-btn primary"
        onClick={onCreateRootDelegation}
        disabled={step >= 1 || loading}
      >
        <span className="icon">🔐</span>
        <div className="btn-content">
          <span className="btn-title">Create Root Delegation</span>
          <span className="btn-subtitle">1,000 USDC • 24h expiry</span>
        </div>
      </button>

      {/* Step 2: Create Sub-Delegations */}
      <button
        className="action-btn primary"
        onClick={onCreateSubDelegations}
        disabled={step < 1 || step >= 2 || loading}
      >
        <span className="icon">🔗</span>
        <div className="btn-content">
          <span className="btn-title">Create Sub-Delegations</span>
          <span className="btn-subtitle">3 sub-agents • 300 USDC each</span>
        </div>
      </button>

      <div className="action-divider">
        <span>Execute Transfers</span>
      </div>

      {/* Agent B Transfer */}
      <button
        className="action-btn success"
        onClick={() => onExecuteTransfer('B', 0)}
        disabled={step < 2 || hasTransferredB || loading}
      >
        <span className="icon">💸</span>
        <div className="btn-content">
          <span className="btn-title">Execute Transfer (Agent B)</span>
          <span className="btn-subtitle">
            {hasTransferredB ? '✓ Completed' : '50 USDC to recipient'}
          </span>
        </div>
      </button>

      {/* Agent C Transfer */}
      <button
        className="action-btn success"
        onClick={() => onExecuteTransfer('C', 1)}
        disabled={step < 2 || hasTransferredC || loading}
      >
        <span className="icon">💸</span>
        <div className="btn-content">
          <span className="btn-title">Execute Transfer (Agent C)</span>
          <span className="btn-subtitle">
            {hasTransferredC ? '✓ Completed' : '75 USDC to recipient'}
          </span>
        </div>
      </button>

      {/* Agent D Transfer */}
      <button
        className="action-btn success"
        onClick={() => onExecuteTransfer('D', 2)}
        disabled={step < 2 || hasTransferredD || loading}
      >
        <span className="icon">💸</span>
        <div className="btn-content">
          <span className="btn-title">Execute Transfer (Agent D)</span>
          <span className="btn-subtitle">
            {hasTransferredD ? '✓ Completed' : '100 USDC to recipient'}
          </span>
        </div>
      </button>

      <div className="action-divider">
        <span>Controls</span>
      </div>

      {/* Reset */}
      <button
        className="action-btn secondary"
        onClick={onReset}
        disabled={step === 0 || loading}
      >
        <span className="icon">🔄</span>
        <div className="btn-content">
          <span className="btn-title">Reset Demo</span>
          <span className="btn-subtitle">Start over</span>
        </div>
      </button>
    </div>
  );
}
