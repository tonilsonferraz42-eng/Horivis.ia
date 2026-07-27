import { useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from './useAuth';

export default function PrivateRoute({ children }) {
  const { user, loading, authError } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/60 text-sm">A verificar sessão...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold">Autenticação necessária</h2>
          <p className="mt-2 text-sm text-white/60">
            {authError || 'Para aceder ao dashboard, inicia sessão novamente.'}
          </p>
          <button
            onClick={() => navigate('/auth', { replace: true })}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-300 transition hover:bg-cyan-500/30"
          >
            <RefreshCw className="h-4 w-4" />
            Voltar para entrar
          </button>
        </div>
      </div>
    );
  }

  return children;
}