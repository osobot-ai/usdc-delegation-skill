import React, { useRef, useEffect } from 'react';

export function TransactionLog({ logs }) {
  const scrollRef = useRef(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) {
    return (
      <div className="transaction-log">
        <div className="log-empty">
          Waiting for actions...
        </div>
      </div>
    );
  }

  return (
    <div className="transaction-log" ref={scrollRef}>
      {logs.map((log, idx) => (
        <LogEntry key={idx} log={log} />
      ))}
    </div>
  );
}

function LogEntry({ log }) {
  const { type, message, timestamp, data } = log;
  
  return (
    <div className={`log-entry ${type}`}>
      <div className="log-time">
        {formatTime(timestamp)}
      </div>
      <div className="log-message">
        {formatMessage(message, data)}
      </div>
    </div>
  );
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatMessage(message, data) {
  if (!data) return message;
  
  // Replace placeholders with code elements
  return (
    <>
      {message.split(/(\{[^}]+\})/g).map((part, idx) => {
        if (part.startsWith('{') && part.endsWith('}')) {
          const key = part.slice(1, -1);
          const value = data[key];
          if (value !== undefined) {
            return <code key={idx}>{value}</code>;
          }
        }
        return part;
      })}
    </>
  );
}
