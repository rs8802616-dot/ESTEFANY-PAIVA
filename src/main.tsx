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
  const SW_MIGRATION_KEY = 'epn_sw_v70_timeline_calendar_pastel';
  if (!localStorage.getItem(SW_MIGRATION_KEY)) {
    localStorage.setItem(SW_MIGRATION_KEY, '1');
    localStorage.removeItem('ep_nails_guest_bookings_v36');
    localStorage.removeItem('ep_nails_deleted_apt_ids_v46');
    void navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => void r.update());
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
