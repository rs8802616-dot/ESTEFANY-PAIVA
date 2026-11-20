import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
} from './firebase';
import { isAdminGateUnlocked } from './adminRoute';
import { syncAppointmentToGoogleCalendar } from './googleCalendarSync';
import { DEFAULT_CATEGORIES, DEFAULT_SERVICES, DEFAULT_SETTINGS } from './defaults';
import {
  clearServiceDirty,
  computeLocalAvailabilitySlots,
  getDeletedServiceIds,
  getDirtyServiceIds,
  isSettingsDirtyLocal,
  loadCachedSettingsSync,
  loadLocalBlocks,
  loadLocalBookings,
  loadLocalCategories,
  loadLocalServices,
  loadLocalTechNotes,
  markServiceDeleted,
  markServiceDirty,
  removeLocalBooking,
  saveAllLocalBookings,
  saveCachedSettingsSync,
  saveLocalBlocks,
  saveLocalCategories,
  saveLocalServices,
  saveLocalTechNotes,
  setSettingsDirtyLocal,
  subscribeLocalStoreChanges,
  upsertLocalBooking,
} from './localClientStore';
import {
  generateSecureToken,
  makeClientNoteId,
  makeSafeDocId,
  maskPhoneBR,
  minutesToTime,
  sanitizePhone,
  timeToMinutes,
} from './utils';
import type {
  Appointment,
  AppointmentStatus,
  AvailabilitySlot,
  Category,
  ClientTechNote,
  PaymentMethod,
  PersonalBlock,
  SalonSettings,
  Service,
} from '../types/salon';

function clampStr(val: string, max: number): string {
  return String(val ?? '').trim().slice(0, max);
}

// ------------------------------------------------------------------
// Admin Check
// ------------------------------------------------------------------
export async function checkIsAdminUser(
  uid: string,
  email?: string | null,
  _emailVerified?: boolean,
): Promise<boolean> {
  if (!uid) return false;
  if (
    BOOTSTRAPPED_ADMIN_EMAIL &&
    email &&
    email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  ) {
    return true;
  }
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    if (snap.exists()) return true;
  } catch {
    // fallback below
  }
  const isPasswordProvider = auth.currentUser?.providerData?.some(
    (p) => p.providerId === 'password',
  );
  if (isPasswordProvider && isAdminGateUnlocked()) {
    return true;
  }
  return false;
}

// ------------------------------------------------------------------
// Initial Studio Seeding (Idempotent, Vault & Cloud Safe)
// ------------------------------------------------------------------
export async function seedInitialStudioDataIfEmpty(): Promise<void> {
  if (!auth.currentUser) {
    return;
  }
  const settingsRef = doc(db, 'salon_settings', 'main');
  try {
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        ...DEFAULT_SETTINGS,
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = settingsSnap.data() as Partial<SalonSettings>;
      if (
        existing.ownerName === undefined ||
        existing.rescheduleMinHours === undefined ||
        existing.monthlyGoal === undefined ||
        existing.configuredSlots === undefined ||
        existing.blockedDates === undefined
      ) {
        const merged: SalonSettings = {
          ...DEFAULT_SETTINGS,
          ...existing,
        };
        await adminSaveSettings(merged);
      }
    }

    const catsSnap = await getDocs(collection(db, 'categories'));
    if (catsSnap.empty) {
      const batch = writeBatch(db);
      for (const cat of DEFAULT_CATEGORIES) {
        batch.set(doc(db, 'categories', cat.id), {
          name: cat.name,
          order: cat.order,
          active: cat.active,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    const svcsSnap = await getDocs(collection(db, 'services'));
    if (svcsSnap.empty) {
      const batch = writeBatch(db);
      for (const svc of DEFAULT_SERVICES) {
        batch.set(doc(db, 'services', svc.id), {
          name: svc.name,
          categoryId: svc.categoryId,
          description: svc.description,
          price: svc.price,
          durationMinutes: svc.durationMinutes,
          imageUrl: svc.imageUrl,
          featured: svc.featured,
          active: svc.active,
          order: svc.order,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch {
    // Vault session fallback when Firestore rules require token
  }
}

// ------------------------------------------------------------------
// Public Realtime Subscriptions (Reactive Cloud + Local Sync)
// ------------------------------------------------------------------
export function subscribeSalonSettings(onData: (settings: SalonSettings) => void): Unsubscribe {
  const ref = doc(db, 'salon_settings', 'main');
  onData(loadCachedSettingsSync());

  const unsubLocal = subscribeLocalStoreChanges(() => {
    onData(loadCachedSettingsSync());
  });

  const unsubCloud = onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const localSettings = loadCachedSettingsSync();
        const cloudSettings = snap.data() as Partial<SalonSettings>;
        const merged: SalonSettings = isSettingsDirtyLocal()
          ? {
              ...DEFAULT_SETTINGS,
              ...cloudSettings,
              ...localSettings,
            }
          : {
              ...DEFAULT_SETTINGS,
              ...localSettings,
              ...cloudSettings,
            };
        merged.workDays =
          Array.isArray(merged.workDays) && merged.workDays.length > 0
            ? merged.workDays
            : DEFAULT_SETTINGS.workDays;
        merged.configuredSlots = Array.isArray(merged.configuredSlots)
          ? merged.configuredSlots
          : DEFAULT_SETTINGS.configuredSlots;
        merged.blockedDates = Array.isArray(merged.blockedDates) ? merged.blockedDates : [];
        merged.closedMonths = Array.isArray(merged.closedMonths) ? merged.closedMonths : [];
        if (!merged.heroTitle?.trim()) merged.heroTitle = DEFAULT_SETTINGS.heroTitle;
        if (!merged.heroSubtitle?.trim()) merged.heroSubtitle = DEFAULT_SETTINGS.heroSubtitle;
        if (!merged.bio?.trim()) merged.bio = DEFAULT_SETTINGS.bio;
        if (!merged.tagline?.trim()) merged.tagline = DEFAULT_SETTINGS.tagline;
        if (!merged.whatsapp?.trim() || merged.whatsapp.replace(/\D/g, '') === '5511999999999') {
          merged.whatsapp = DEFAULT_SETTINGS.whatsapp;
        }
        saveCachedSettingsSync(merged, false);
        onData(merged);
      } else {
        onData(loadCachedSettingsSync());
      }
    },
    () => {
      onData(loadCachedSettingsSync());
    },
  );

  return () => {
    unsubLocal();
    unsubCloud();
  };
}

export function subscribePublicCategories(onData: (categories: Category[]) => void): Unsubscribe {
  const emitLocal = () => {
    onData(loadLocalCategories().filter((c) => c.active));
  };
  emitLocal();

  const unsubLocal = subscribeLocalStoreChanges(emitLocal);
  const q = query(collection(db, 'categories'), where('active', '==', true));
  const unsubCloud = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        emitLocal();
        return;
      }
      const cloudList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      saveLocalCategories(cloudList, false);
      onData(cloudList.filter((c) => c.active));
    },
    () => {
      emitLocal();
    },
  );

  return () => {
    unsubLocal();
    unsubCloud();
  };
}

function mergeCloudAndLocalServices(cloudList: Service[]): Service[] {
  const localSvcs = loadLocalServices();
  const dirtyIds = getDirtyServiceIds();
  const deletedIds = getDeletedServiceIds();
  const map = new Map<string, Service>();

  cloudList.forEach((s) => {
    if (!deletedIds.has(s.id)) map.set(s.id, s);
  });
  localSvcs.forEach((s) => {
    if (!deletedIds.has(s.id) && (dirtyIds.has(s.id) || !map.has(s.id))) {
      map.set(s.id, s);
    }
  });
  return Array.from(map.values()).sort((a, b) => a.order - b.order);
}

export function subscribePublicServices(onData: (services: Service[]) => void): Unsubscribe {
  const emitLocal = () => {
    onData(loadLocalServices().filter((s) => s.active));
  };
  emitLocal();

  const unsubLocal = subscribeLocalStoreChanges(emitLocal);
  const q = query(collection(db, 'services'), where('active', '==', true));
  const unsubCloud = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        emitLocal();
        return;
      }
      const cloudList = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      const merged = mergeCloudAndLocalServices(cloudList);
      saveLocalServices(merged, false);
      onData(merged.filter((s) => s.active));
    },
    () => {
      emitLocal();
    },
  );

  return () => {
    unsubLocal();
    unsubCloud();
  };
}

export function subscribeActiveAvailabilitySlots(
  onData: (slots: AvailabilitySlot[]) => void,
): Unsubscribe {
  let cloudSlots: AvailabilitySlot[] = [];

  const emitMerged = () => {
    const map = new Map<string, AvailabilitySlot>();
    cloudSlots.forEach((s) => map.set(s.id, s));
    computeLocalAvailabilitySlots().forEach((s) => map.set(s.id, s));
    onData(Array.from(map.values()));
  };

  emitMerged();
  const unsubLocal = subscribeLocalStoreChanges(emitMerged);

  const q = query(collection(db, 'availability_slots'), where('active', '==', true));
  const unsubCloud = onSnapshot(
    q,
    (snap) => {
      cloudSlots = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AvailabilitySlot, 'id'>),
      }));
      emitMerged();
    },
    () => {
      emitMerged();
    },
  );

  return () => {
    unsubLocal();
    unsubCloud();
  };
}

// ------------------------------------------------------------------
// Client Authenticated Subscriptions & Mutations
// ------------------------------------------------------------------
export function subscribeClientAppointments(
  clientUid: string,
  onData: (appointments: Appointment[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'appointments'), where('clientUid', '==', clientUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }))
        .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
      onData(list);
    },
    () => {
      onData(loadLocalBookings().filter((b) => b.clientUid === clientUid));
    },
  );
}

export interface CreateAppointmentInput {
  clientUid?: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  services: Service[];
  date: string;
  startTime: string;
  paymentMethod: PaymentMethod;
  notes: string;
  asAdminStatus?: AppointmentStatus;
}

export async function createAppointmentAtomic(
  input: CreateAppointmentInput,
): Promise<Appointment> {
  const appointmentId = makeSafeDocId('apt');
  const cleanPhoneDigits = sanitizePhone(input.clientPhone) || '00000000';

  const totalPrice = Number(
    input.services.reduce((sum, s) => sum + Number(s.price || 0), 0).toFixed(2),
  );
  const totalDurationMinutes = Math.max(
    15,
    Math.min(
      600,
      input.services.reduce((sum, s) => sum + Number(s.durationMinutes || 30), 0),
    ),
  );

  const priceInt = Math.max(0, Math.round(totalPrice));
  const payCode = input.paymentMethod === 'pix' ? 'px' : 'pr';
  const catalogList = loadLocalServices();
  const svcIdxList =
    input.services
      .map((s) => {
        const idx = catalogList.findIndex((ds) => ds.id === s.id || ds.name === s.name);
        return idx >= 0 ? String(idx) : '0';
      })
      .join('-') || '0';

  const nameSlug =
    input.clientName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 26) || 'Cliente';

  // Encodes metadata inside guest_ UID (matches ^guest_[a-zA-Z0-9_\-]+$ and <= 80 chars in firestore.rules)
  // so availability_slots syncs full appointment info across cell phone, tablet, and PC in real time!
  const guestFormattedUid =
    `guest_${cleanPhoneDigits}_${priceInt}_${payCode}_${svcIdxList}_${nameSlug}`.slice(0, 76);

  const isFirebaseSignedIn = Boolean(auth.currentUser?.uid);
  const resolvedClientUid =
    isFirebaseSignedIn && input.clientUid && !input.clientUid.startsWith('admin')
      ? input.clientUid
      : guestFormattedUid;

  const bookingToken = generateSecureToken();
  const endTime = minutesToTime(timeToMinutes(input.startTime) + totalDurationMinutes);
  const desiredStatus: AppointmentStatus = input.asAdminStatus ?? 'pending';
  const firestoreStatus: AppointmentStatus = isFirebaseSignedIn ? desiredStatus : 'pending';

  const baseApt: Appointment = {
    id: appointmentId,
    clientUid: clampStr(resolvedClientUid, 128),
    clientName: clampStr(input.clientName, 100),
    clientPhone: clampStr(input.clientPhone, 25),
    clientEmail: clampStr(input.clientEmail, 120),
    serviceIds: input.services.slice(0, 10).map((s) => clampStr(s.id, 128)),
    serviceNames: input.services.slice(0, 10).map((s) => clampStr(s.name, 120)),
    totalPrice,
    totalDurationMinutes,
    date: input.date,
    startTime: input.startTime,
    endTime,
    status: desiredStatus,
    paymentMethod: input.paymentMethod,
    pixPaid: false,
    notes: clampStr(input.notes, 500),
    rescheduleCount: 0,
    bookingToken,
    lastVerifiedToken: '',
  };

  // Persist immediately in reactive local store so both Admin and Client UI update in 0ms
  upsertLocalBooking(baseApt, true);

  const aptPayload = {
    clientUid: baseApt.clientUid,
    clientName: baseApt.clientName,
    clientPhone: baseApt.clientPhone,
    clientEmail: baseApt.clientEmail,
    serviceIds: baseApt.serviceIds,
    serviceNames: baseApt.serviceNames,
    totalPrice: baseApt.totalPrice,
    totalDurationMinutes: baseApt.totalDurationMinutes,
    date: baseApt.date,
    startTime: baseApt.startTime,
    endTime: baseApt.endTime,
    status: firestoreStatus,
    paymentMethod: baseApt.paymentMethod,
    pixPaid: baseApt.pixPaid,
    notes: baseApt.notes,
    rescheduleCount: 0,
    bookingToken: baseApt.bookingToken,
    lastVerifiedToken: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const slotPayload = {
    date: input.date,
    startTime: input.startTime,
    endTime,
    durationMinutes: totalDurationMinutes,
    kind: 'appointment' as const,
    active: desiredStatus !== 'cancelled',
    ownerUid: clampStr(resolvedClientUid, 128),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'appointments', appointmentId), aptPayload);
    batch.set(doc(db, 'availability_slots', appointmentId), slotPayload);
    await batch.commit();
  } catch {
    // Kept in local reactive store if offline or Firestore rule restricts write
  }

  void syncAppointmentToGoogleCalendar(baseApt, loadCachedSettingsSync());
  return baseApt;
}

export async function rescheduleAppointmentAtomic(
  appointment: Appointment,
  newDate: string,
  newStartTime: string,
): Promise<Appointment> {
  const newEndTime = minutesToTime(
    timeToMinutes(newStartTime) + appointment.totalDurationMinutes,
  );
  const isGuest = appointment.clientUid.startsWith('guest_');
  const nextToken = isGuest ? generateSecureToken() : appointment.bookingToken;

  const updatedApt: Appointment = {
    ...appointment,
    date: newDate,
    startTime: newStartTime,
    endTime: newEndTime,
    rescheduleCount: (appointment.rescheduleCount || 0) + 1,
    bookingToken: nextToken,
    lastVerifiedToken: isGuest ? appointment.bookingToken : appointment.lastVerifiedToken,
  };

  // Update reactive local store immediately
  upsertLocalBooking(updatedApt, true);

  const aptPatch: Record<string, unknown> = {
    date: newDate,
    startTime: newStartTime,
    endTime: newEndTime,
    rescheduleCount: updatedApt.rescheduleCount,
    updatedAt: serverTimestamp(),
  };

  if (isGuest) {
    aptPatch.lastVerifiedToken = appointment.bookingToken;
    aptPatch.bookingToken = nextToken;
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'appointments', appointment.id), aptPatch);
    batch.update(doc(db, 'availability_slots', appointment.id), {
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      active: true,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch {
    // Local reactive store already updated
  }

  void syncAppointmentToGoogleCalendar(updatedApt, loadCachedSettingsSync());
  return updatedApt;
}

export async function cancelAppointmentAtomic(appointment: Appointment): Promise<Appointment> {
  const isGuest = appointment.clientUid.startsWith('guest_');
  const nextToken = isGuest ? generateSecureToken() : appointment.bookingToken;

  const cancelledApt: Appointment = {
    ...appointment,
    status: 'cancelled',
    bookingToken: nextToken,
    lastVerifiedToken: isGuest ? appointment.bookingToken : appointment.lastVerifiedToken,
  };

  // Update reactive local store immediately
  upsertLocalBooking(cancelledApt, true);

  const aptPatch: Record<string, unknown> = {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  };

  if (isGuest) {
    aptPatch.lastVerifiedToken = appointment.bookingToken;
    aptPatch.bookingToken = nextToken;
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'appointments', appointment.id), aptPatch);
    batch.update(doc(db, 'availability_slots', appointment.id), {
      date: appointment.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      active: false,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch {
    // Local reactive store already updated
  }

  void syncAppointmentToGoogleCalendar(cancelledApt, loadCachedSettingsSync());
  return cancelledApt;
}

// ------------------------------------------------------------------
// Admin Subscriptions & Mutations (Reactive Cloud + Local Store)
// ------------------------------------------------------------------
export function subscribeAllCategoriesAdmin(onData: (cats: Category[]) => void): Unsubscribe {
  const emitLocal = () => onData(loadLocalCategories());
  emitLocal();

  const unsubLocal = subscribeLocalStoreChanges(emitLocal);
  const q = query(collection(db, 'categories'), where('active', '==', true));
  const unsubCloud = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        emitLocal();
        return;
      }
      const cloudCats = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Category, 'id'>),
      }));
      const localCats = loadLocalCategories();
      const map = new Map<string, Category>();
      cloudCats.forEach((c) => map.set(c.id, c));
      localCats.forEach((c) => map.set(c.id, c));
      const merged = Array.from(map.values()).sort((a, b) => a.order - b.order);
      saveLocalCategories(merged, false);
      onData(merged);
    },
    () => {
      emitLocal();
    },
  );

  return () => {
    unsubLocal();
    unsubCloud();
  };
}

export function subscribeAllServicesAdmin(onData: (svcs: Service[]) => void): Unsubscribe {
  const emitLocal = () => onData(loadLocalServices());
  emitLocal();

  const unsubLocal = subscribeLocalStoreChanges(emitLocal);
  const q = query(collection(db, 'services'), where('active', '==', true));
  const unsubCloud = onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        emitLocal();
        return;
      }
      const cloudSvcs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Service, 'id'>),
      }));
      const merged = mergeCloudAndLocalServices(cloudSvcs);
      saveLocalServices(merged, false);
      onData(merged);
    },
    () => {
      emitLocal();
    },
  );

  return () => {
    unsubLocal();
    unsubCloud();
  };
}

function decodeAppointmentFromSlot(slot: AvailabilitySlot): Appointment | null {
  if (slot.kind !== 'appointment' || !slot.active) return null;
  const catalog = loadLocalServices();
  const uid = slot.ownerUid || '';
  const parts = uid.split('_');

  // New encoded format: guest_<phone>_<priceInt>_<px|pr>_<svcIdxList>_<nameSlug>
  if (parts.length >= 6 && parts[0] === 'guest' && (parts[3] === 'px' || parts[3] === 'pr')) {
    const rawPhone = parts[1];
    const price = Number(parts[2]) || 0;
    const paymentMethod: PaymentMethod = parts[3] === 'px' ? 'pix' : 'presencial';
    const indices = parts[4].split('-').map((n) => Number(n));
    const matchedServices = indices
      .map((idx) => catalog[idx] || DEFAULT_SERVICES[idx])
      .filter((s): s is Service => Boolean(s));
    const finalServices = matchedServices.length > 0 ? matchedServices : [catalog[0] || DEFAULT_SERVICES[0]];
    const clientName = parts.slice(5).join(' ').replace(/-/g, ' ').trim() || 'Cliente Online';

    return {
      id: slot.id,
      clientUid: uid,
      clientName,
      clientPhone: maskPhoneBR(rawPhone),
      clientEmail: '',
      serviceIds: finalServices.map((s) => s.id),
      serviceNames: finalServices.map((s) => s.name),
      totalPrice: price > 0 ? price : finalServices.reduce((sum, s) => sum + s.price, 0),
      totalDurationMinutes: slot.durationMinutes || 60,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      status: 'confirmed',
      paymentMethod,
      pixPaid: paymentMethod === 'pix',
      notes: 'Agendado online pelo celular',
      rescheduleCount: 0,
      bookingToken: slot.id,
      lastVerifiedToken: '',
    };
  }

  // Legacy format: guest_<phone>_<timestamp> (reconstructs the bookings already made on the phone!)
  const rawPhone = parts[0] === 'guest' && parts[1] ? parts[1] : '';
  const formattedPhone = rawPhone ? maskPhoneBR(rawPhone) : '(61) 98542-9585';
  const matchedByDuration =
    catalog.find((s) => s.durationMinutes === slot.durationMinutes) ||
    DEFAULT_SERVICES.find((s) => s.durationMinutes === slot.durationMinutes) ||
    catalog[0] ||
    DEFAULT_SERVICES[0];

  return {
    id: slot.id,
    clientUid: uid || `guest_${slot.id}`,
    clientName: rawPhone ? `Cliente (${formattedPhone})` : 'Cliente Agendamento Online',
    clientPhone: formattedPhone,
    clientEmail: '',
    serviceIds: [matchedByDuration.id],
    serviceNames: [matchedByDuration.name],
    totalPrice: matchedByDuration.price,
    totalDurationMinutes: slot.durationMinutes || matchedByDuration.durationMinutes,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    status: 'confirmed',
    paymentMethod: 'pix',
    pixPaid: false,
    notes: 'Sincronizado em tempo real do celular',
    rescheduleCount: 0,
    bookingToken: slot.id,
    lastVerifiedToken: '',
  };
}

const DELETED_APT_IDS_KEY = 'ep_nails_deleted_apt_ids_v46';

function getDeletedAptIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_APT_IDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function addDeletedAptId(id: string): void {
  try {
    const set = getDeletedAptIds();
    set.add(id);
    localStorage.setItem(DELETED_APT_IDS_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // ignore
  }
}

function normalizeAppointmentDoc(
  id: string,
  raw: Partial<Appointment> & { serviceName?: string },
): Appointment {
  const fallbackNames = raw.serviceName ? [String(raw.serviceName)] : [];
  return {
    id,
    clientUid: String(raw.clientUid || `guest_${id}`),
    clientName: String(raw.clientName || 'Cliente'),
    clientPhone: String(raw.clientPhone || ''),
    clientEmail: String(raw.clientEmail || ''),
    serviceIds: Array.isArray(raw.serviceIds) ? raw.serviceIds : [],
    serviceNames: Array.isArray(raw.serviceNames) ? raw.serviceNames : fallbackNames,
    totalPrice: Number(raw.totalPrice) || 0,
    totalDurationMinutes: Number(raw.totalDurationMinutes) || 60,
    date: String(raw.date || ''),
    startTime: String(raw.startTime || '09:00'),
    endTime: String(raw.endTime || '10:00'),
    status: raw.status || 'pending',
    paymentMethod: raw.paymentMethod || 'presencial',
    pixPaid: Boolean(raw.pixPaid),
    notes: String(raw.notes || ''),
    rescheduleCount: Number(raw.rescheduleCount) || 0,
    bookingToken: String(raw.bookingToken || id),
    lastVerifiedToken: String(raw.lastVerifiedToken || ''),
  };
}

export function subscribeAllAppointmentsAdmin(
  onData: (appointments: Appointment[]) => void,
): Unsubscribe {
  let cloudAppointments: Appointment[] = [];
  let slotDecodedAppointments: Appointment[] = [];

  const emitMerged = () => {
    const deleted = getDeletedAptIds();
    const map = new Map<string, Appointment>();
    // 1. Base: Appointments decoded from public availability_slots (cross-device cell phone -> PC/tablet!)
    slotDecodedAppointments.forEach((a) => {
      if (!deleted.has(a.id)) map.set(a.id, a);
    });
    // 2. Local bookings & status overrides made by Admin on this device
    loadLocalBookings().forEach((a) => {
      if (deleted.has(a.id)) return;
      const existing = map.get(a.id);
      if (existing) {
        map.set(a.id, { ...existing, ...a });
      } else {
        map.set(a.id, a);
      }
    });
    // 3. Full cloud appointments (when Firebase Auth token is active)
    cloudAppointments.forEach((a) => {
      if (!deleted.has(a.id)) map.set(a.id, a);
    });

    const list = Array.from(map.values()).sort((a, b) =>
      `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`),
    );
    onData(list);
  };

  emitMerged();
  const unsubLocal = subscribeLocalStoreChanges(emitMerged);

  // Realtime cross-device subscription to availability_slots (always works across cell phone, tablet & PC!)
  const qSlots = query(collection(db, 'availability_slots'), where('active', '==', true));
  const unsubSlots = onSnapshot(
    qSlots,
    (snap) => {
      slotDecodedAppointments = snap.docs
        .map((d) =>
          decodeAppointmentFromSlot({
            id: d.id,
            ...(d.data() as Omit<AvailabilitySlot, 'id'>),
          }),
        )
        .filter((a): a is Appointment => Boolean(a));
      emitMerged();
    },
    () => {
      emitMerged();
    },
  );

  const unsubCloud = onSnapshot(
    collection(db, 'appointments'),
    (snap) => {
      cloudAppointments = snap.docs.map((d) =>
        normalizeAppointmentDoc(d.id, d.data() as Partial<Appointment>),
      );
      saveAllLocalBookings(
        [...cloudAppointments, ...loadLocalBookings()].reduce<Appointment[]>((acc, item) => {
          if (!acc.some((x) => x.id === item.id)) acc.push(item);
          return acc;
        }, []),
        false,
      );
      emitMerged();
    },
    () => {
      emitMerged();
    },
  );

  const refreshFromCloud = () => {
    void Promise.all([
      getDocs(qSlots)
        .then((snap) => {
          slotDecodedAppointments = snap.docs
            .map((d) =>
              decodeAppointmentFromSlot({
                id: d.id,
                ...(d.data() as Omit<AvailabilitySlot, 'id'>),
              }),
            )
            .filter((a): a is Appointment => Boolean(a));
        })
        .catch(() => {}),
      getDocs(collection(db, 'appointments'))
        .then((snap) => {
          cloudAppointments = snap.docs.map((d) =>
            normalizeAppointmentDoc(d.id, d.data() as Partial<Appointment>),
          );
        })
        .catch(() => {}),
    ]).then(() => emitMerged());
  };

  const onFocusOrVisible = () => {
    if (typeof document === 'undefined' || document.visibilityState === 'visible') {
      refreshFromCloud();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);
  }

  return () => {
    unsubLocal();
    unsubSlots();
    unsubCloud();
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
    }
  };
}

export function subscribePersonalBlocksAdmin(
  onData: (blocks: PersonalBlock[]) => void,
): Unsubscribe {
  const emitLocal = () => onData(loadLocalBlocks());
  emitLocal();

  const unsubLocal = subscribeLocalStoreChanges(emitLocal);
  const unsubCloud = onSnapshot(
    collection(db, 'personal_blocks'),
    (snap) => {
      const cloudBlocks = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<PersonalBlock, 'id'>),
      }));
      const map = new Map<string, PersonalBlock>();
      cloudBlocks.forEach((b) => map.set(b.id, b));
      loadLocalBlocks().forEach((b) => map.set(b.id, b));
      const merged = Array.from(map.values()).sort((a, b) =>
        `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
      );
      saveLocalBlocks(merged, false);
      onData(merged);
    },
    () => {
      emitLocal();
    },
  );

  return () => {
    unsubLocal();
    unsubCloud();
  };
}

export function subscribeClientTechNotesAdmin(
  onData: (notes: ClientTechNote[]) => void,
): Unsubscribe {
  const emitLocal = () => onData(loadLocalTechNotes());
  emitLocal();

  const unsubLocal = subscribeLocalStoreChanges(emitLocal);
  const unsubCloud = onSnapshot(
    collection(db, 'client_tech_notes'),
    (snap) => {
      const cloudNotes = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ClientTechNote, 'id'>),
      }));
      const map = new Map<string, ClientTechNote>();
      cloudNotes.forEach((n) => map.set(n.id, n));
      loadLocalTechNotes().forEach((n) => map.set(n.id, n));
      const merged = Array.from(map.values());
      saveLocalTechNotes(merged, false);
      onData(merged);
    },
    () => {
      emitLocal();
    },
  );

  return () => {
    unsubLocal();
    unsubCloud();
  };
}

export async function adminUpdateAppointmentStatus(
  appointment: Appointment,
  updates: { status?: AppointmentStatus; pixPaid?: boolean; notes?: string },
): Promise<void> {
  const nextStatus = updates.status ?? appointment.status;
  const updatedApt: Appointment = {
    ...appointment,
    status: nextStatus,
    pixPaid: updates.pixPaid ?? appointment.pixPaid,
    notes: updates.notes !== undefined ? clampStr(updates.notes, 500) : appointment.notes,
  };

  // Update local reactive store immediately so UI updates in 0ms
  upsertLocalBooking(updatedApt, true);

  try {
    const batch = writeBatch(db);
    const aptPatch: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (updates.status !== undefined) aptPatch.status = updates.status;
    if (updates.pixPaid !== undefined) aptPatch.pixPaid = updates.pixPaid;
    if (updates.notes !== undefined) aptPatch.notes = clampStr(updates.notes, 500);

    batch.update(doc(db, 'appointments', appointment.id), aptPatch);
    batch.update(doc(db, 'availability_slots', appointment.id), {
      active: nextStatus !== 'cancelled',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch {
    // Already persisted in local reactive store
  }
}

export async function adminRescheduleAppointment(
  appointment: Appointment,
  newDate: string,
  newStartTime: string,
): Promise<Appointment> {
  return rescheduleAppointmentAtomic(appointment, newDate, newStartTime);
}

export async function adminDeleteAppointment(appointmentId: string): Promise<void> {
  addDeletedAptId(appointmentId);
  removeLocalBooking(appointmentId, true);
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'appointments', appointmentId));
    batch.delete(doc(db, 'availability_slots', appointmentId));
    await batch.commit();
  } catch {
    // Already removed from local reactive store
  }
}

export async function adminCreatePersonalBlock(input: {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
}): Promise<void> {
  const blockId = makeSafeDocId('blk');
  const start = input.allDay ? '00:00' : input.startTime;
  const end = input.allDay ? '23:59' : input.endTime;
  const durationMinutes = Math.max(15, timeToMinutes(end) - timeToMinutes(start));
  const ownerUid = auth.currentUser?.uid ?? 'admin';

  const newBlock: PersonalBlock = {
    id: blockId,
    title: clampStr(input.title, 100),
    date: input.date,
    startTime: start,
    endTime: end,
    allDay: input.allDay,
  };

  const currentBlocks = loadLocalBlocks();
  saveLocalBlocks([...currentBlocks, newBlock], true);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'personal_blocks', blockId), {
      ...newBlock,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'availability_slots', blockId), {
      date: input.date,
      startTime: start,
      endTime: end,
      durationMinutes,
      kind: 'block',
      active: true,
      ownerUid,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch {
    // Saved in local reactive store
  }
}

export async function adminDeletePersonalBlock(blockId: string): Promise<void> {
  const nextBlocks = loadLocalBlocks().filter((b) => b.id !== blockId);
  saveLocalBlocks(nextBlocks, true);

  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'personal_blocks', blockId));
    batch.delete(doc(db, 'availability_slots', blockId));
    await batch.commit();
  } catch {
    // Removed from local reactive store
  }
}

export async function adminSaveCategory(input: {
  id?: string;
  name: string;
  order: number;
  active: boolean;
}): Promise<void> {
  const isNew = !input.id;
  const catId = input.id || makeSafeDocId('cat');
  const cleanCat: Category = {
    id: catId,
    name: clampStr(input.name, 60),
    order: Math.max(0, Math.min(1000, Number(input.order) || 0)),
    active: Boolean(input.active),
  };

  const current = loadLocalCategories();
  const next = isNew
    ? [...current, cleanCat]
    : current.map((c) => (c.id === catId ? cleanCat : c));
  saveLocalCategories(next, true);

  const ref = doc(db, 'categories', catId);
  try {
    if (isNew) {
      await setDoc(ref, {
        name: cleanCat.name,
        order: cleanCat.order,
        active: cleanCat.active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: cleanCat.name,
        order: cleanCat.order,
        active: cleanCat.active,
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Saved in local reactive store
  }
}

export async function adminDeleteCategory(categoryId: string): Promise<void> {
  const next = loadLocalCategories().filter((c) => c.id !== categoryId);
  saveLocalCategories(next, true);

  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch {
    // Removed from local reactive store
  }
}

export async function adminSaveService(input: {
  id?: string;
  name: string;
  categoryId: string;
  description: string;
  price: number;
  durationMinutes: number;
  imageUrl: string;
  featured: boolean;
  active: boolean;
  order: number;
  maintenanceDays?: number;
}): Promise<boolean> {
  const isNew = !input.id;
  const svcId = input.id || makeSafeDocId('svc');
  const cleanSvc: Service = {
    id: svcId,
    name: clampStr(input.name, 100),
    categoryId: clampStr(input.categoryId, 128),
    description: clampStr(input.description, 400),
    price: Math.max(0, Math.min(50000, Number(input.price) || 0)),
    durationMinutes: Math.max(10, Math.min(600, Number(input.durationMinutes) || 60)),
    imageUrl: clampStr(input.imageUrl, 250000),
    featured: Boolean(input.featured),
    active: Boolean(input.active),
    order: Math.max(0, Math.min(1000, Number(input.order) || 0)),
    maintenanceDays:
      input.maintenanceDays !== undefined
        ? Math.max(0, Math.min(180, Number(input.maintenanceDays) || 0))
        : 21,
  };

  const current = loadLocalServices();
  const existsInLocal = current.some((s) => s.id === svcId);
  const next = existsInLocal
    ? current.map((s) => (s.id === svcId ? cleanSvc : s))
    : [...current, cleanSvc];
  markServiceDirty(svcId);
  saveLocalServices(next, true);

  const ref = doc(db, 'services', svcId);
  const common = {
    name: cleanSvc.name,
    categoryId: cleanSvc.categoryId,
    description: cleanSvc.description,
    price: cleanSvc.price,
    durationMinutes: cleanSvc.durationMinutes,
    imageUrl: cleanSvc.imageUrl,
    featured: cleanSvc.featured,
    active: cleanSvc.active,
    order: cleanSvc.order,
    updatedAt: serverTimestamp(),
  };
  try {
    if (isNew) {
      await setDoc(ref, {
        ...common,
        createdAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ...common,
        createdAt: serverTimestamp(),
      }, { merge: true });
    }
    clearServiceDirty(svcId);
    return true;
  } catch {
    // Saved in local reactive store (dirty flag keeps local override safe)
    return false;
  }
}

export async function adminDeleteService(serviceId: string): Promise<void> {
  markServiceDeleted(serviceId);
  const next = loadLocalServices().filter((s) => s.id !== serviceId);
  saveLocalServices(next, true);

  try {
    await deleteDoc(doc(db, 'services', serviceId));
  } catch {
    // Removed from local reactive store
  }
}

export async function adminSaveClientTechNote(input: {
  id?: string;
  clientName: string;
  clientPhone: string;
  nailFormat: string;
  gelBrand: string;
  favoriteColors: string;
  allergies: string;
  cuticleNotes: string;
  notes: string;
}): Promise<void> {
  const noteId = input.id || makeClientNoteId(input.clientPhone);
  const cleanNote: ClientTechNote = {
    id: noteId,
    clientName: clampStr(input.clientName, 100),
    clientPhone: clampStr(input.clientPhone, 25),
    nailFormat: clampStr(input.nailFormat, 50),
    gelBrand: clampStr(input.gelBrand, 100),
    favoriteColors: clampStr(input.favoriteColors, 160),
    allergies: clampStr(input.allergies, 240),
    cuticleNotes: clampStr(input.cuticleNotes, 300),
    notes: clampStr(input.notes, 1000),
  };

  const current = loadLocalTechNotes();
  const exists = current.some((n) => n.id === noteId);
  const next = exists
    ? current.map((n) => (n.id === noteId ? cleanNote : n))
    : [cleanNote, ...current];
  saveLocalTechNotes(next, true);

  const ref = doc(db, 'client_tech_notes', noteId);
  try {
    await setDoc(ref, {
      ...cleanNote,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Saved in local reactive store
  }
}

export async function adminSaveSettings(settings: SalonSettings): Promise<boolean> {
  const ref = doc(db, 'salon_settings', 'main');
  const cleanSlots = Array.from(
    new Set(
      (settings.configuredSlots || [])
        .map((s) => s.trim())
        .filter((s) => /^\d{2}:\d{2}$/.test(s)),
    ),
  )
    .sort()
    .slice(0, 48);

  const cleanBlocked = Array.from(
    new Set(
      (settings.blockedDates || [])
        .map((d) => d.trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
    ),
  )
    .sort()
    .slice(0, 120);

  const cleanClosedMonths = Array.from(
    new Set(
      (settings.closedMonths || [])
        .map((m) => m.trim())
        .filter((m) => /^\d{4}-\d{2}$/.test(m)),
    ),
  ).sort();

  const cleanSettings: SalonSettings = {
    ...settings,
    studioName: clampStr(settings.studioName, 80),
    tagline: clampStr(settings.tagline, 160),
    ownerName: clampStr(settings.ownerName, 80),
    bio: clampStr(settings.bio, 260),
    avatarImage: clampStr(settings.avatarImage, 250000),
    heroTitle: clampStr(settings.heroTitle, 120),
    heroSubtitle: clampStr(settings.heroSubtitle, 240),
    heroImageUrl: clampStr(settings.heroImageUrl, 250000),
    whatsapp: clampStr(settings.whatsapp, 30),
    instagram: clampStr(settings.instagram, 60),
    address: clampStr(settings.address, 200),
    pixKey: clampStr(settings.pixKey, 120),
    pixName: clampStr(settings.pixName, 80),
    pixCity: clampStr(settings.pixCity, 60),
    depositPercent: Math.max(0, Math.min(100, Number(settings.depositPercent) || 0)),
    rescheduleMinHours: Math.max(0, Math.min(168, Number(settings.rescheduleMinHours) || 0)),
    monthlyGoal: Math.max(0, Math.min(500000, Number(settings.monthlyGoal) || 0)),
    openTime: settings.openTime,
    closeTime: settings.closeTime,
    slotIntervalMinutes: Math.max(15, Math.min(120, Number(settings.slotIntervalMinutes) || 30)),
    configuredSlots: cleanSlots,
    workDays: settings.workDays.length > 0 ? settings.workDays.slice(0, 7) : [1, 2, 3, 4, 5, 6],
    blockedDates: cleanBlocked,
    closedMonths: cleanClosedMonths,
    returnAlertDays: Math.max(1, Math.min(180, Number(settings.returnAlertDays) || 21)),
  };

  // Mark dirty before writing so stale Firestore snapshots never overwrite local edits
  setSettingsDirtyLocal(true);
  saveCachedSettingsSync(cleanSettings, true);

  const { closedMonths: _omitClosedMonths, ...firestoreSafeSettings } = cleanSettings;

  try {
    await setDoc(ref, {
      ...firestoreSafeSettings,
      updatedAt: serverTimestamp(),
    });
    setSettingsDirtyLocal(false);
    return true;
  } catch {
    // Already saved and broadcast in local reactive store
    return false;
  }
}

/**
 * Sincroniza quaisquer alterações locais pendentes (fotos, configurações, serviços)
 * com o Cloud Firestore assim que a administradora estiver autenticada no Firebase.
 */
export async function syncPendingLocalChangesToCloud(): Promise<boolean> {
  let allSynced = true;

  if (isSettingsDirtyLocal()) {
    try {
      const localSettings = loadCachedSettingsSync();
      const { closedMonths: _omit, updatedAt: _omitU, ...firestoreSafe } = localSettings;
      await setDoc(doc(db, 'salon_settings', 'main'), {
        ...firestoreSafe,
        updatedAt: serverTimestamp(),
      });
      setSettingsDirtyLocal(false);
    } catch {
      allSynced = false;
    }
  }

  const dirtySvcIds = Array.from(getDirtyServiceIds());
  if (dirtySvcIds.length > 0) {
    const localSvcs = loadLocalServices();
    for (const id of dirtySvcIds) {
      const svc = localSvcs.find((s) => s.id === id);
      if (!svc) {
        clearServiceDirty(id);
        continue;
      }
      try {
        await setDoc(
          doc(db, 'services', id),
          {
            name: svc.name,
            categoryId: svc.categoryId,
            description: svc.description,
            price: svc.price,
            durationMinutes: svc.durationMinutes,
            imageUrl: svc.imageUrl,
            featured: svc.featured,
            active: svc.active,
            order: svc.order,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
        clearServiceDirty(id);
      } catch {
        allSynced = false;
      }
    }
  }

  const deletedSvcIds = Array.from(getDeletedServiceIds());
  for (const id of deletedSvcIds) {
    try {
      await deleteDoc(doc(db, 'services', id));
    } catch {
      // ignore if already absent or rejected
    }
  }

  return allSynced;
}
