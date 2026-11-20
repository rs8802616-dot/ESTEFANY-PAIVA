import React, { createContext, useCallback, useContext, useState } from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 3400);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[90] flex flex-col gap-2 pointer-events-none no-print"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg border transition-all ${
              t.tone === 'error'
                ? 'bg-[#594943] text-white border-[#C4A477]/40'
                : t.tone === 'info'
                  ? 'bg-white text-[#594943] border-[#E8D6CB]'
                  : 'bg-[#594943] text-[#FAF6F1] border-[#433631]'
            }`}
          >
            {t.tone === 'error' ? (
              <AlertCircle className="w-4 h-4 text-[#C4A477] shrink-0" />
            ) : t.tone === 'info' ? (
              <Info className="w-4 h-4 text-[#C4A477] shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-[#C4A477] shrink-0" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fechar aviso"
              className="p-1 rounded-lg opacity-70 hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
