-- ============================================================
-- HORIVIS - Verificacao e Correcao de Seguranca (RLS)
-- ============================================================
-- Executar este script APOS criar as tabelas com supabase-schema.sql
-- Verifica se RLS esta ativo e aplica politicas se necessario
-- ============================================================

-- 1. VERIFICACAO: RLS esta ativo?
SELECT 
  tablename, 
  rowsecurity AS rls_ativo
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'analises', 'palavras_chave');

-- 2. CORRECAO: Ativar RLS se estiver desativado
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.palavras_chave ENABLE ROW LEVEL SECURITY;

-- 3. CORRECAO: Remover politicas antigas (caso existam) e recriar
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own analises" ON public.analises;
DROP POLICY IF EXISTS "Users can insert own analises" ON public.analises;
DROP POLICY IF EXISTS "Users can delete own analises" ON public.analises;
DROP POLICY IF EXISTS "Users can view own keywords" ON public.palavras_chave;
DROP POLICY IF EXISTS "Users can insert own keywords" ON public.palavras_chave;

-- Politicas para profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Politicas para analises
CREATE POLICY "Users can view own analises"
  ON public.analises FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analises"
  ON public.analises FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own analises"
  ON public.analises FOR DELETE
  USING (auth.uid() = user_id);

-- Politicas para palavras_chave
CREATE POLICY "Users can view own keywords"
  ON public.palavras_chave FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own keywords"
  ON public.palavras_chave FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. VERIFICACAO FINAL: Confirmar que RLS esta ativo
SELECT 
  tablename, 
  rowsecurity AS rls_ativo,
  'OK' as status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'analises', 'palavras_chave');

-- Se alguma linha mostrar rls_ativo = false, execute novamente as linhas da secao 2.