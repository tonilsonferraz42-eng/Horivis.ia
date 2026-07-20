import { useState, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './useAuth';

export function useAnalises() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Guarda uma análise no Supabase
   */
  const salvarAnalise = useCallback(async ({ modulo, produto, resultado, score, status = 'ok' }) => {
    if (!user) {
      // Fallback para localStorage se não estiver autenticado
      const key = `horivis_${modulo}_${produto}`;
      localStorage.setItem(key, JSON.stringify({ resultado, score, status, timestamp: Date.now() }));
      return { local: true };
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: supabaseError } = await supabase
        .from('analises')
        .insert({
          user_id: user.id,
          modulo,
          produto,
          resultado,
          score,
          status,
        })
        .select()
        .single();

      if (supabaseError) throw supabaseError;
      return data;
    } catch (err) {
      console.error('[useAnalises] Erro ao salvar:', err);
      setError(err.message);
      // Fallback para localStorage
      const key = `horivis_${modulo}_${produto}`;
      localStorage.setItem(key, JSON.stringify({ resultado, score, status, timestamp: Date.now() }));
      return { local: true };
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Lista análises do utilizador
   */
  const listarAnalises = useCallback(async ({ modulo, limite = 20 } = {}) => {
    if (!user) {
      // Fallback: ler do localStorage
      const todas = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('horivis_')) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            const parts = key.replace('horivis_', '').split('_');
            todas.push({
              modulo: parts[0],
              produto: parts.slice(1).join('_'),
              ...data,
            });
          } catch { /* ignora */ }
        }
      }
      return todas.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, limite);
    }

    setLoading(true);
    setError('');

    try {
      let query = supabase
        .from('analises')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limite);

      if (modulo) {
        query = query.eq('modulo', modulo);
      }

      const { data, error: supabaseError } = await query;
      if (supabaseError) throw supabaseError;
      return data || [];
    } catch (err) {
      console.error('[useAnalises] Erro ao listar:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Apaga uma análise
   */
  const apagarAnalise = useCallback(async (id) => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      const { error: supabaseError } = await supabase
        .from('analises')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (supabaseError) throw supabaseError;
    } catch (err) {
      console.error('[useAnalises] Erro ao apagar:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    salvarAnalise,
    listarAnalises,
    apagarAnalise,
    loading,
    error,
  };
}