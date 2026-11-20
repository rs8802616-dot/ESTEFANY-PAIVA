import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'Ocorreu um erro inesperado.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; operationType?: string; path?: string };
      if (parsed.error) {
        if (parsed.error.includes('Quota exceeded')) {
          message =
            'O limite diário gratuito de leitura do Firestore foi atingido. A cota é renovada automaticamente no próximo dia.';
        } else if (parsed.error.includes('Missing or insufficient permissions')) {
          message = `Permissão insuficiente ao acessar ${parsed.path || 'os dados'}. Verifique se você está autenticado com a conta correta.`;
        } else {
          message = parsed.error;
        }
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message };
  }

  componentDidCatch(error: Error): void {
    console.error('App ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E8D6CB] rounded-3xl p-8 text-center">
            <h1 className="font-editorial text-3xl font-semibold text-[#594943]">
              Algo saiu do previsto
            </h1>
            <p className="mt-3 text-sm text-[#95847C] leading-relaxed">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-[#594943] text-white text-sm font-medium px-5 py-2.5 hover:bg-[#433631] transition-colors"
            >
              Recarregar aplicativo
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
