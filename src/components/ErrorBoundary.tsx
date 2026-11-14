import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('WiFive Pro Studio ErrorBoundary capturou erro:', error, info.componentStack);
  }

  handleRecover = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch {
        // ignore
      }
    }
  };

  handleReloadPage = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4"
        >
          <div className="max-w-lg w-full bg-slate-900 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-white">
                  Ocorreu uma falha inesperada na interface
                </h1>
                <p className="text-xs text-slate-400">
                  O sistema de proteção evitou que a tela ficasse branca. Você pode recuperar o estúdio sem perder o controle.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-red-300 break-words max-h-36 overflow-y-auto">
                {this.state.error.message || 'Erro desconhecido de renderização'}
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-1">
              <button
                type="button"
                onClick={this.handleRecover}
                className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition"
              >
                <RotateCcw className="w-4 h-4" />
                Tentar Recuperar Interface
              </button>
              <button
                type="button"
                onClick={this.handleReloadPage}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <RefreshCw className="w-4 h-4" />
                Recarregar Página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
