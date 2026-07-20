-- HORIVIS - Schema Supabase
-- Executar no SQL Editor: https://supabase.com/dashboard/project/djanaqrmndrediqxslir/sql/new

-- 1. Tabela de perfis
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nome TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger: criar perfil automaticamente apos registo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome)
  VALUES (NEW.id, NEW.email, SPLIT_PART(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Tabela de analises
CREATE TABLE IF NOT EXISTS public.analises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  produto TEXT NOT NULL,
  resultado JSONB,
  score INTEGER,
  status TEXT DEFAULT 'ok',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analises_user_id ON public.analises(user_id);
CREATE INDEX IF NOT EXISTS idx_analises_modulo ON public.analises(modulo);
CREATE INDEX IF NOT EXISTS idx_analises_created_at ON public.analises(created_at DESC);

-- 3. Tabela de palavras-chave
CREATE TABLE IF NOT EXISTS public.palavras_chave (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  termo TEXT NOT NULL,
  resultado JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_palavras_chave_user_id ON public.palavras_chave(user_id);

-- 4. Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.palavras_chave ENABLE ROW LEVEL SECURITY;

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