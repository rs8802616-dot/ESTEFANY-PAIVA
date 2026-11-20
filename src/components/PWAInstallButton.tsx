import React, { useEffect, useState } from 'react';
import { Download, Share, WifiOff } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC<{ variant?: 'light' | 'dark' }> = ({
  variant = 'light',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  const baseClass =
    variant === 'dark'
      ? 'min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-medium text-[#FAF6F1] hover:bg-white/20 transition-colors whitespace-nowrap shrink-0'
      : 'min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-[#E8D6CB] bg-white px-3.5 py-2 text-xs font-medium text-[#594943] hover:border-[#C4A477] transition-colors whitespace-nowrap shrink-0';

  if (isInstallable) {
    return (
      <button type="button" onClick={install} className={baseClass}>
        <Download className="w-3.5 h-3.5 text-[#C4A477]" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button type="button" onClick={() => setShowIOSGuide(true)} className={baseClass}>
          <Share className="w-3.5 h-3.5 text-[#C4A477]" />
          <span>Instalar no iOS</span>
        </button>
        <BottomSheet
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title="Instalar no iPhone ou iPad"
          subtitle="Acesse o aplicativo direto da sua Tela de Início."
        >
          <ol className="space-y-3 text-sm text-[#594943] leading-relaxed">
            <li className="flex gap-3">
              <span className="font-mono text-xs font-semibold text-[#C4A477] pt-0.5">01</span>
              <span>
                Toque no botão <strong>Compartilhar</strong> na barra do Safari.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs font-semibold text-[#C4A477] pt-0.5">02</span>
              <span>
                Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="font-mono text-xs font-semibold text-[#C4A477] pt-0.5">03</span>
              <span>
                Confirme tocando em <strong>Adicionar</strong> para abrir em tela cheia.
              </span>
            </li>
          </ol>
        </BottomSheet>
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[85] flex items-center gap-2 rounded-xl bg-[#594943] text-[#FAF6F1] px-4 py-2 text-xs font-medium shadow-lg border border-[#C4A477]/40 no-print">
      <WifiOff className="w-3.5 h-3.5 text-[#C4A477]" />
      <span>Modo offline — exibindo dados em cache</span>
    </div>
  );
};
