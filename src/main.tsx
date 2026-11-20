import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      void updateSW(true);
    },
  });

  // Limpa qualquer Service Worker antigo (v38/v39/v40) que ainda estivesse preso no cache do navegador
  const SW_MIGRATION_KEY = 'epn_sw_v75_ep_app_icons';
  if (!localStorage.getItem(SW_MIGRATION_KEY)) {
    localStorage.setItem(SW_MIGRATION_KEY, '1');
    try {
      const raw = localStorage.getItem('ep_nails_settings_cache_v36');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.heroImageUrl = '/src/assets/images/hero_nail_studio_1795135079713.jpg';
        localStorage.setItem('ep_nails_settings_cache_v36', JSON.stringify(parsed));
      }
      localStorage.removeItem('ep_nails_settings_dirty_v55');
    } catch {
      // ignore
    }
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.update());
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
