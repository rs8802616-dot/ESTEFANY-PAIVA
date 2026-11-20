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
  handleFirestoreError,
  OperationType,
} from './firebase';
import { isAdminGateUnlocked } from './adminRoute';
import { DEFAULT_CATEGORIES, DEFAULT_SERVICES, DEFAULT_SETTINGS } from './defaults';
import { saveCachedSettingsSync } from './localClientStore';
import {
  generateSecureToken,
  makeClientNoteId,
  makeSafeDocId,
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
  // Conta autenticada via E-mail/Senha (criada no Firebase Console) na rota secreta desbloqueada
  const isPasswordProvider = auth.currentUser?.providerData?.some(
    (p) => p.providerId === 'password',
  );
  if (isPasswordProvider && isAdminGateUnlocked()) {
    return true;
  }
  return false;
}

// ------------------------------------------------------------------
// Initial Studio Seeding (Admin-only, idempotent)
// ------------------------------------------------------------------
export async function seedInitialStudioDataIfEmpty(): Promise<void> {
  const settingsRef = doc(db, 'salon_settings', 'main');
  try {
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, {
        ...DEFAULT_SETTINGS,
        updatedAt: serverTimestamp(),
      });
    } else {
      // Backfill any newly added v36 fields if upgrading an existing main doc
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'salon_settings/main');
  }
}

// ------------------------------------------------------------------
// Public Realtime Subscriptions (Zero PII)
// ------------------------------------------------------------------
export function subscribeSalonSettings(onData: (settings: SalonSettings) => void): Unsubscribe {
  const ref = doc(db, 'salon_settings', 'main');
  return onSnapshot(
    ref,
    (snap) => {
      const merged: SalonSettings = snap.exists()
        ? {
            ...DEFAULT_SETTINGS,
            ...(snap.data() as Partial<SalonSettings>),
          }
        : DEFAULT_SETTINGS;
      saveCachedSettingsSync(merged);
      onData(merged);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'salon_settings/main');
    },
  );
}

export function subscribePublicCategories(onData: (categories: Category[]) => void): Unsubscribe {
  const q = query(collection(db, 'categories'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(DEFAULT_CATEGORIES);
        return;
      }
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    },
  );
}

export function subscribePublicServices(onData: (services: Service[]) => void): Unsubscribe {
  const q = query(collection(db, 'services'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(DEFAULT_SERVICES);
        return;
      }
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    },
  );
}

export function subscribeActiveAvailabilitySlots(
  onData: (slots: AvailabilitySlot[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'availability_slots'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AvailabilitySlot, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'availability_slots');
    },
  );
}

// ------------------------------------------------------------------
// Client Authenticated Subscriptions & Mutations (Google OR Guest LGPD)
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
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
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
  const resolvedClientUid =
    input.clientUid || `guest_${cleanPhoneDigits}_${Date.now().toString(36)}`.slice(0, 72);
  const bookingToken = generateSecureToken();

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
  const endTime = minutesToTime(timeToMinutes(input.startTime) + totalDurationMinutes);
  const status: AppointmentStatus = input.asAdminStatus ?? 'pending';

  const aptPayload = {
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
    status,
    paymentMethod: input.paymentMethod,
    pixPaid: false,
    notes: clampStr(input.notes, 500),
    rescheduleCount: 0,
    bookingToken,
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
    active: status !== 'cancelled',
    ownerUid: clampStr(resolvedClientUid, 128),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'appointments', appointmentId), aptPayload);
    batch.set(doc(db, 'availability_slots', appointmentId), slotPayload);
    await batch.commit();

    return {
      id: appointmentId,
      ...aptPayload,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `appointments/${appointmentId}`);
  }
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

  const aptPatch: Record<string, unknown> = {
    date: newDate,
    startTime: newStartTime,
    endTime: newEndTime,
    rescheduleCount: appointment.rescheduleCount + 1,
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

    return {
      ...appointment,
      date: newDate,
      startTime: newStartTime,
      endTime: newEndTime,
      rescheduleCount: appointment.rescheduleCount + 1,
      bookingToken: nextToken,
      lastVerifiedToken: isGuest ? appointment.bookingToken : appointment.lastVerifiedToken,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
}

export async function cancelAppointmentAtomic(appointment: Appointment): Promise<Appointment> {
  const isGuest = appointment.clientUid.startsWith('guest_');
  const nextToken = isGuest ? generateSecureToken() : appointment.bookingToken;

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
      active: false,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();

    return {
      ...appointment,
      status: 'cancelled',
      bookingToken: nextToken,
      lastVerifiedToken: isGuest ? appointment.bookingToken : appointment.lastVerifiedToken,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
}

// ------------------------------------------------------------------
// Admin Subscriptions & Mutations
// ------------------------------------------------------------------
export function subscribeAllCategoriesAdmin(onData: (cats: Category[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'categories'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    },
  );
}

export function subscribeAllServicesAdmin(onData: (svcs: Service[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'services'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Service, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'services');
    },
  );
}

export function subscribeAllAppointmentsAdmin(
  onData: (appointments: Appointment[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'appointments'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Appointment, 'id'>) }))
        .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    },
  );
}

export function subscribePersonalBlocksAdmin(
  onData: (blocks: PersonalBlock[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'personal_blocks'),
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<PersonalBlock, 'id'>) }))
        .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'personal_blocks');
    },
  );
}

export function subscribeClientTechNotesAdmin(
  onData: (notes: ClientTechNote[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'client_tech_notes'),
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ClientTechNote, 'id'>),
      }));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'client_tech_notes');
    },
  );
}

export async function adminUpdateAppointmentStatus(
  appointment: Appointment,
  updates: { status?: AppointmentStatus; pixPaid?: boolean; notes?: string },
): Promise<void> {
  const nextStatus = updates.status ?? appointment.status;
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
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
}

export async function adminDeleteAppointment(appointmentId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'appointments', appointmentId));
    batch.delete(doc(db, 'availability_slots', appointmentId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `appointments/${appointmentId}`);
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

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'personal_blocks', blockId), {
      title: clampStr(input.title, 100),
      date: input.date,
      startTime: start,
      endTime: end,
      allDay: input.allDay,
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
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `personal_blocks/${blockId}`);
  }
}

export async function adminDeletePersonalBlock(blockId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'personal_blocks', blockId));
    batch.delete(doc(db, 'availability_slots', blockId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `personal_blocks/${blockId}`);
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
  const ref = doc(db, 'categories', catId);
  try {
    if (isNew) {
      await setDoc(ref, {
        name: clampStr(input.name, 60),
        order: Math.max(0, Math.min(1000, Number(input.order) || 0)),
        active: Boolean(input.active),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        name: clampStr(input.name, 60),
        order: Math.max(0, Math.min(1000, Number(input.order) || 0)),
        active: Boolean(input.active),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      `categories/${catId}`,
    );
  }
}

export async function adminDeleteCategory(categoryId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'categories', categoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${categoryId}`);
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
}): Promise<void> {
  const isNew = !input.id;
  const svcId = input.id || makeSafeDocId('svc');
  const ref = doc(db, 'services', svcId);
  const common = {
    name: clampStr(input.name, 100),
    categoryId: clampStr(input.categoryId, 128),
    description: clampStr(input.description, 400),
    price: Math.max(0, Math.min(50000, Number(input.price) || 0)),
    durationMinutes: Math.max(10, Math.min(600, Number(input.durationMinutes) || 60)),
    imageUrl: clampStr(input.imageUrl, 250000),
    featured: Boolean(input.featured),
    active: Boolean(input.active),
    order: Math.max(0, Math.min(1000, Number(input.order) || 0)),
    updatedAt: serverTimestamp(),
  };
  try {
    if (isNew) {
      await setDoc(ref, {
        ...common,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, common);
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isNew ? OperationType.CREATE : OperationType.UPDATE,
      `services/${svcId}`,
    );
  }
}

export async function adminDeleteService(serviceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'services', serviceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `services/${serviceId}`);
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
  const ref = doc(db, 'client_tech_notes', noteId);
  try {
    await setDoc(ref, {
      clientName: clampStr(input.clientName, 100),
      clientPhone: clampStr(input.clientPhone, 25),
      nailFormat: clampStr(input.nailFormat, 50),
      gelBrand: clampStr(input.gelBrand, 100),
      favoriteColors: clampStr(input.favoriteColors, 160),
      allergies: clampStr(input.allergies, 240),
      cuticleNotes: clampStr(input.cuticleNotes, 300),
      notes: clampStr(input.notes, 1000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `client_tech_notes/${noteId}`);
  }
}

export async function adminSaveSettings(settings: SalonSettings): Promise<void> {
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

  const payload = {
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
    returnAlertDays: Math.max(1, Math.min(180, Number(settings.returnAlertDays) || 21)),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(ref, payload);
    saveCachedSettingsSync({ ...settings, configuredSlots: cleanSlots, blockedDates: cleanBlocked });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'salon_settings/main');
  }
}
