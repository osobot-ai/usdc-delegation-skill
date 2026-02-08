import React, { useState, useCallback } from 'react';
import { DelegationTree } from './components/DelegationTree.jsx';
import { ActionPanel } from './components/ActionPanel.jsx';
import { TransactionLog } from './components/TransactionLog.jsx';
import { Header } from './components/Header.jsx';
import { useDelegationDemo } from './hooks/useDelegationDemo.js';

export default function App() {
  const {
    state,
    logs,
    createRootDelegation,
    createSubDelegations,
    executeTransfer,
    reset
  } = useDelegationDemo();

  return (
    <div className="app-container">
      <Header />
      
      <main className="main-content">
        <div className="demo-grid">
          {/* Delegation Tree Visualization */}
          <section className="tree-section">
            <h2>
              <span className="icon">🌳</span>
              Delegation Chain
            </h2>
            <DelegationTree state={state} />
          </section>
          
          {/* Action Panel */}
          <section className="action-section">
            <h2>
              <span className="icon">⚡</span>
              Actions
            </h2>
            <ActionPanel 
              state={state}
              onCreateRootDelegation={createRootDelegation}
              onCreateSubDelegations={createSubDelegations}
              onExecuteTransfer={executeTransfer}
              onReset={reset}
            />
          </section>
          
          {/* Transaction Log */}
          <section className="log-section">
            <h2>
              <span className="icon">📜</span>
              Transaction Log
            </h2>
            <TransactionLog logs={logs} />
          </section>
        </div>
      </main>
      
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <span>Built with</span>
            <a href="https://eips.ethereum.org/EIPS/eip-7710" target="_blank" rel="noopener">ERC-7710</a>
            <span>+</span>
            <a href="https://github.com/MetaMask/delegation-framework" target="_blank" rel="noopener">MetaMask Delegation Framework</a>
          </div>
          <div className="footer-right">
            <span className="network-badge">Base Sepolia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
