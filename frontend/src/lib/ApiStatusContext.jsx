import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ApiStatusContext = createContext();

export function ApiStatusProvider({ children }) {
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('A verificar...');

  const checkStatus = useCallback(async () => {
    setStatus('checking');
    setMessage('A verificar...');

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const healthRes = await fetch(baseUrl + '/api/health', {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (healthRes.ok) {
        setStatus('online');
        setMessage('IA ATIVA');
        return;
      }

      if (healthRes.status === 401 || healthRes.status === 429) {
        setStatus('demo');
        setMessage('MODO DEMO');
        return;
      }

      setStatus('demo');
      setMessage('MODO DEMO');
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