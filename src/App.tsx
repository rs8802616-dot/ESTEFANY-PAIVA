import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
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

  const exitAdmin = () => {
    window.open('/', '_blank', 'noopener,noreferrer');
  };

  if (!routeChecked) {
    return null;
  }

  return (
    <>
      <OfflineIndicator />
      {mode === 'admin' ? (
        <AdminPanel
          user={user}
          isAdmin={isAdmin}
          authReady={authReady}
          settings={settings}
          onExitAdmin={exitAdmin}
        />
      ) : (
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
