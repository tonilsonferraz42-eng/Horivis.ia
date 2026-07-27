import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

function hasSupabaseConfig() {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    const restore = async () => {
      setLoading(true);
      setAuthError(null);

      try {
        if (!hasSupabaseConfig()) {
          throw new Error('Authentication service unavailable');
        }

        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
        } else {
          setSession(null);
          setUser(null);
        }
      } catch {
        setSession(null);
        setUser(null);
        setAuthError('Não foi possível validar a sessão no momento. Tente novamente.');
      } finally {
        setLoading(false);
      }
    };

    restore();

    let subscription = null;
    try {
      const response = supabase.auth.onAuthStateChange((_event, currentSession) => {
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          setAuthError(null);
        } else {
          setSession(null);
          setUser(null);
          setAuthError(null);
        }
        setLoading(false);
      });
      subscription = response?.data?.subscription ?? null;
    } catch {
      // sem listener externo disponível
    }

    return () => subscription?.unsubscribe?.();
  }, []);

  const signIn = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!hasSupabaseConfig()) {
      throw new Error('Authentication service unavailable. Please try again later.');
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error('Unable to sign in');
      }

      setUser(data.user);
      setSession(data.session);
      setAuthError(null);
      return data;
    } catch (err) {
      setUser(null);
      setSession(null);
      setAuthError('Não foi possível iniciar sessão. Verifique as credenciais e tente novamente.');
      throw err;
    }
  };

  const signUp = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!hasSupabaseConfig()) {
      throw new Error('Authentication service unavailable. Please try again later.');
    }

    try {
      const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
      if (error) {
        throw error;
      }

      if (data?.session) {
        setUser(data.user);
        setSession(data.session);
      } else {
        setUser(null);
        setSession(null);
      }

      setAuthError(null);
      return data;
    } catch (err) {
      setUser(null);
      setSession(null);
      setAuthError('Não foi possível criar a conta. Tente novamente mais tarde.');
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // noop
    }

    setUser(null);
    setSession(null);
    setAuthError(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, authError, signIn, signUp, signOut, clearAuthError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}