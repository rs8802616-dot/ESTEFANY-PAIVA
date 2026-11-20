import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ArrowLeft, Eye, Sparkles } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { OfflineIndicator } from './components/PWAInstallButton';
import { ClientPortal } from './components/client/ClientPortal';
import { AdminPanel } from './components/admin/AdminPanel';
import { auth } from './lib/firebase';
import { resolveAdminRouteAccess } from './lib/adminRoute';
import {
  checkIsAdminUser,
  subscribeActiveAvailabilitySlots,
  subscribeClientAppointments,
  subscribePublicCategories,
  subscribePublicServices,
  subscribeSalonSettings,
} from './lib/db';
import { DEFAULT_CATEGORIES, DEFAULT_SERVICES } from './lib/defaults';
import {
  loadCachedSettingsSync,
  loadLocalBookings,
  subscribeLocalStoreChanges,
  upsertLocalBooking,
} from './lib/localClientStore';
import type {
  Appointment,
  AvailabilitySlot,
  Category,
  SalonSettings,
  Service,
} from './types/salon';

type AppMode = 'client' | 'admin';

function SalonAppShell() {
  const [mode, setMode] = useState<AppMode>('client');
  const [adminPreviewClient, setAdminPreviewClient] = useState(false);
  const [routeChecked, setRouteChecked] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  const [settings, setSettings] = useState<SalonSettings>(() => loadCachedSettingsSync());
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [busySlots, setBusySlots] = useState<AvailabilitySlot[]>([]);
  const [googleAppointments, setGoogleAppointments] = useState<Appointment[]>([]);
  const [localBookings, setLocalBookings] = useState<Appointment[]>(() => loadLocalBookings());

  useEffect(() => {
    let active = true;
    const syncRoute = async () => {
      const allowedAdmin = await resolveAdminRouteAccess();
      if (!active) return;
      setMode(allowedAdmin ? 'admin' : 'client');
      setRouteChecked(true);
    };
    void syncRoute();
    const onNav = () => {
      void syncRoute();
    };
    window.addEventListener('hashchange', onNav);
    window.addEventListener('popstate', onNav);
    return () => {
      active = false;
      window.removeEventListener('hashchange', onNav);
      window.removeEventListener('popstate', onNav);
    };
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const adminFlag = await checkIsAdminUser(
          nextUser.uid,
          nextUser.email,
          nextUser.emailVerified,
        );
        setIsAdmin(adminFlag);
      } else {
        setIsAdmin(false);
        setGoogleAppointments([]);
      }
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const unsubs = [
      subscribeSalonSettings(setSettings),
      subscribePublicCategories(setCategories),
      subscribePublicServices(setServices),
      subscribeActiveAvailabilitySlots(setBusySlots),
      subscribeLocalStoreChanges(() => {
        setLocalBookings(loadLocalBookings());
      }),
    ];
    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (!authReady || !user) {
      setGoogleAppointments([]);
      return;
    }
    return subscribeClientAppointments(user.uid, setGoogleAppointments);
  }, [authReady, user]);

  const clientAppointments = useMemo(() => {
    const map = new Map<string, Appointment>();
    localBookings.forEach((apt) => map.set(apt.id, apt));
    googleAppointments.forEach((apt) => map.set(apt.id, apt));
    return Array.from(map.values()).sort((a, b) =>
      `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`),
    );
  }, [localBookings, googleAppointments]);

  const handleUpsertClientBooking = useCallback((apt: Appointment) => {
    const updated = upsertLocalBooking(apt);
    setLocalBookings(updated);
  }, []);

  // Quando a admin clica para visualizar a Página Pública (Telas 7 a 11),
  // permanece dentro de /painel com barra flutuante para voltar em 1 clique!
  const handlePreviewClientFromAdmin = () => {
    setAdminPreviewClient(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!routeChecked) {
    return null;
  }

  return (
    <>
      <OfflineIndicator />
      {mode === 'admin' && !adminPreviewClient ? (
        <AdminPanel
          user={user}
          isAdmin={isAdmin}
          authReady={authReady}
          settings={settings}
          onExitAdmin={handlePreviewClientFromAdmin}
        />
      ) : (
        <>
          {mode === 'admin' && adminPreviewClient && (
            <div className="sticky top-0 z-50 bg-[#594943] text-[#FAF6F1] border-b border-[#C4A477]/40 px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                <span className="w-7 h-7 rounded-lg bg-[#C4A477]/20 text-[#C4A477] flex items-center justify-center shrink-0">
                  <Eye className="w-4 h-4" />
                </span>
                <span>
                  <strong className="text-[#C4A477]">Modo Visualização (Telas 7 a 11):</strong> Você está vendo a Página da Cliente sem sair do Painel Admin.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAdminPreviewClient(false)}
                className="min-h-[38px] inline-flex items-center gap-2 rounded-xl bg-[#C4A477] px-4 py-1.5 text-xs font-bold text-[#594943] hover:bg-[#E8D6CB] transition-colors cursor-pointer shrink-0 shadow-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Voltar ao Painel da Admin</span>
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <ClientPortal
            settings={settings}
            categories={categories}
            services={services}
            busySlots={busySlots}
            user={user}
            clientAppointments={clientAppointments}
            onAppointmentCreated={handleUpsertClientBooking}
            onAppointmentUpdated={handleUpsertClientBooking}
          />
        </>
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <SalonAppShell />
      </ToastProvider>
    </ErrorBoundary>
  );
}
