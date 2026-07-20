import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-8">
          <div className="max-w-lg w-full bg-white/5 rounded-2xl border border-red-500/30 p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-lg">!</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-red-400">Erro ao carregar</h2>
                <p className="text-sm text-white/50">Ocorreu um erro inesperado na aplicação.</p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm text-red-300 font-mono break-all">
                {this.state.error?.message || 'Erro desconhecido'}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary flex-1"
              >
                Recarregar página
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="btn-primary !w-auto !px-4 !bg-white/10 !text-white hover:!bg-white/20"
              >
                Tentar novamente
              </button>
            </div>

            {this.state.errorInfo && (
              <details className="text-xs text-white/30">
                <summary className="cursor-pointer hover:text-white/50">Detalhes técnicos</summary>
                <pre className="mt-2 p-2 bg-black/30 rounded overflow-auto max-h-40">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}