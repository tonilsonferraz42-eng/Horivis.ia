import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ApiStatusContext = createContext();

export function ApiStatusProvider({ children }) {
  const [status, setStatus] = useState('checking'); // checking | online | demo | offline
  const [message, setMessage] = useState('A verificar...');

  const checkStatus = useCallback(async () => {
    setStatus('checking');
    setMessage('A verificar...');
    try {
      const res = await fetch('/api/claude/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-5',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }]
        })
      });
      if (res.ok) {
        setStatus('online');
        setMessage('IA ATIVA');
      } else if (res.status === 401) {
        setStatus('demo');
        setMessage('MODO DEMO');
      } else if (res.status === 429) {
        setStatus('demo');
        setMessage('MODO DEMO');
      } else {
        setStatus('demo');
        setMessage('MODO DEMO');
      }
    } catch {
      setStatus('offline');
      setMessage('API OFFLINE');
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <ApiStatusContext.Provider value={{ status, message, checkStatus }}>
      {children}
    </ApiStatusContext.Provider>
  );
}

export function useApiStatus() {
  const ctx = useContext(ApiStatusContext);
  if (!ctx) throw new Error('useApiStatus must be used within ApiStatusProvider');
  return ctx;
}