import { createClient } from '@supabase/supabase-js';

// URL e chave vêm de variáveis de ambiente (Vite) — configuráveis por ambiente (dev/prod)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos. Verifique o .env.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
