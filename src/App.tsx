import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { OfflineIndicator } from './components/PWAInstallButton';
import { ClientPortal } from './components/client/ClientPortal';
import { AdminPanel } from './components/admin/AdminPanel';
import { auth } from './lib/firebase';
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

function getInitialMode(): AppMode {
  if (
    typeof window !== 'undefined' &&
    (window.location.hash.includes('admin') || window.location.pathname.includes('admin'))
  ) {
    return 'admin';
  }
  return 'client';
}

function SalonAppShell() {
  const [mode, setMode] = useState<AppMode>(getInitialMode);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  // Synchronous hydration eliminates avatar/banner flash on startup (PRD v36)
  const [settings, setSettings] = useState<SalonSettings>(() => loadCachedSettingsSync());
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [services, setServices] = useState<Service[]>(DEFAULT_SERVICES);
  const [busySlots, setBusySlots] = useState<AvailabilitySlot[]>([]);
  const [googleAppointments, setGoogleAppointments] = useState<Appointment[]>([]);
  const [localBookings, setLocalBookings] = useState<Appointment[]>(() => loadLocalBookings());

  useEffect(() => {
    const handleHash = () => {
      setMode(window.location.hash.includes('admin') ? 'admin' : 'client');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
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

  // Merge Google Firestore appointments with device-local guest bookings (Firestore wins by id)
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

  const openAdmin = () => {
    window.location.hash = '#/admin';
    setMode('admin');
  };

  const exitAdmin = () => {
    if (window.location.pathname.includes('admin')) {
      window.history.replaceState({}, '', '/');
    } else {
      window.location.hash = '';
    }
    setMode('client');
  };

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
          onOpenAdmin={openAdmin}
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
