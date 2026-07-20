import { Navigate } from 'react-router-dom';
import { useAuth } from './useAuth';

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  // Enquanto verifica sessão, mostra loading
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

  // Se não estiver autenticado, redireciona para /auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Autenticado, renderiza o conteúdo
  return children;
}