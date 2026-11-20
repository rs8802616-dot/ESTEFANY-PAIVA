import { DEFAULT_CATEGORIES, DEFAULT_SERVICES, DEFAULT_SETTINGS } from './defaults';
import type {
  Appointment,
  AvailabilitySlot,
  Category,
  ClientTechNote,
  PersonalBlock,
  SalonSettings,
  Service,
} from '../types/salon';

const SETTINGS_CACHE_KEY = 'ep_nails_settings_cache_v36';
const CLIENT_PROFILE_KEY = 'ep_nails_client_profile_v36';
const GUEST_BOOKINGS_KEY = 'ep_nails_guest_bookings_v36';
const CATEGORIES_CACHE_KEY = 'ep_nails_categories_cache_v44';
const SERVICES_CACHE_KEY = 'ep_nails_services_cache_v44';
const BLOCKS_CACHE_KEY = 'ep_nails_personal_blocks_v44';
const TECH_NOTES_CACHE_KEY = 'ep_nails_tech_notes_v44';

export interface SavedClientIdentity {
  name: string;
  phone: string;
}

type StoreListener = () => void;
const listeners = new Set<StoreListener>();

export function subscribeLocalStoreChanges(fn: StoreListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyLocalStoreChanges(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener errors
    }
  });
}

// ------------------------------------------------------------------
// 1. Salon Settings
// ------------------------------------------------------------------
export function loadCachedSettingsSync(): SalonSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SalonSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      workDays:
        Array.isArray(parsed.workDays) && parsed.workDays.length > 0
          ? parsed.workDays
          : DEFAULT_SETTINGS.workDays,
      configuredSlots: Array.isArray(parsed.configuredSlots)
        ? parsed.configuredSlots
        : DEFAULT_SETTINGS.configuredSlots,
      blockedDates: Array.isArray(parsed.blockedDates) ? parsed.blockedDates : [],
      closedMonths: Array.isArray(parsed.closedMonths) ? parsed.closedMonths : [],
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveCachedSettingsSync(settings: SalonSettings, notify = true): void {
  if (typeof window === 'undefined') return;
  try {
    const { updatedAt: _omit, ...serializable } = settings;
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(serializable));
    if (notify) notifyLocalStoreChanges();
  } catch {
    // Ignore storage quota errors
  }
}

// ------------------------------------------------------------------
// 2. Client Identity
// ------------------------------------------------------------------
export function loadSavedClientIdentity(): SavedClientIdentity {
  if (typeof window === 'undefined') return { name: '', phone: '' };
  try {
    const raw = window.localStorage.getItem(CLIENT_PROFILE_KEY);
    if (!raw) return { name: '', phone: '' };
    const parsed = JSON.parse(raw) as Partial<SavedClientIdentity>;
    return {
      name: String(parsed.name || ''),
      phone: String(parsed.phone || ''),
    };
  } catch {
    return { name: '', phone: '' };
  }
}

export function saveClientIdentity(identity: SavedClientIdentity): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CLIENT_PROFILE_KEY, JSON.stringify(identity));
  } catch {
    // Ignore storage quota errors
  }
}

// ------------------------------------------------------------------
// 3. Appointments (Bookings)
// ------------------------------------------------------------------
export function loadLocalBookings(): Appointment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(GUEST_BOOKINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as Appointment[];
  } catch {
    return [];
  }
}

export function saveAllLocalBookings(appointments: Appointment[], notify = true): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = appointments
      .map(({ createdAt: _c, updatedAt: _u, ...rest }) => rest)
      .sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));
    window.localStorage.setItem(GUEST_BOOKINGS_KEY, JSON.stringify(cleaned.slice(0, 200)));
    if (notify) notifyLocalStoreChanges();
  } catch {
    // Ignore storage quota errors
  }
}

export function upsertLocalBooking(appointment: Appointment, notify = true): Appointment[] {
  const current = loadLocalBookings();
  const { createdAt: _c, updatedAt: _u, ...clean } = appointment;
  const next = [clean, ...current.filter((item) => item.id !== appointment.id)].sort((a, b) =>
    `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`),
  );
  saveAllLocalBookings(next, notify);
  return next;
}

export function removeLocalBooking(appointmentId: string, notify = true): Appointment[] {
  const current = loadLocalBookings();
  const next = current.filter((item) => item.id !== appointmentId);
  saveAllLocalBookings(next, notify);
  return next;
}

// ------------------------------------------------------------------
// 4. Categories
// ------------------------------------------------------------------
export function loadLocalCategories(): Category[] {
  if (typeof window === 'undefined') return DEFAULT_CATEGORIES;
  try {
    const raw = window.localStorage.getItem(CATEGORIES_CACHE_KEY);
    if (!raw) return DEFAULT_CATEGORIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CATEGORIES;
    return (parsed as Category[]).sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveLocalCategories(categories: Category[], notify = true): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = categories
      .map(({ createdAt: _c, updatedAt: _u, ...rest }) => rest)
      .sort((a, b) => a.order - b.order);
    window.localStorage.setItem(CATEGORIES_CACHE_KEY, JSON.stringify(cleaned));
    if (notify) notifyLocalStoreChanges();
  } catch {
    // Ignore storage quota errors
  }
}

// ------------------------------------------------------------------
// 5. Services
// ------------------------------------------------------------------
export function loadLocalServices(): Service[] {
  if (typeof window === 'undefined') return DEFAULT_SERVICES;
  try {
    const raw = window.localStorage.getItem(SERVICES_CACHE_KEY);
    if (!raw) return DEFAULT_SERVICES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SERVICES;
    return (parsed as Service[]).sort((a, b) => a.order - b.order);
  } catch {
    return DEFAULT_SERVICES;
  }
}

export function saveLocalServices(services: Service[], notify = true): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = services
      .map(({ createdAt: _c, updatedAt: _u, ...rest }) => rest)
      .sort((a, b) => a.order - b.order);
    window.localStorage.setItem(SERVICES_CACHE_KEY, JSON.stringify(cleaned));
    if (notify) notifyLocalStoreChanges();
  } catch {
    // Ignore storage quota errors
  }
}

// ------------------------------------------------------------------
// 6. Personal Blocks
// ------------------------------------------------------------------
export function loadLocalBlocks(): PersonalBlock[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(BLOCKS_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as PersonalBlock[]).sort((a, b) =>
      `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`),
    );
  } catch {
    return [];
  }
}

export function saveLocalBlocks(blocks: PersonalBlock[], notify = true): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = blocks
      .map(({ createdAt: _c, updatedAt: _u, ...rest }) => rest)
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));
    window.localStorage.setItem(BLOCKS_CACHE_KEY, JSON.stringify(cleaned));
    if (notify) notifyLocalStoreChanges();
  } catch {
    // Ignore storage quota errors
  }
}

// ------------------------------------------------------------------
// 7. Client Technical Notes (Ficha Técnica)
// ------------------------------------------------------------------
export function loadLocalTechNotes(): ClientTechNote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TECH_NOTES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as ClientTechNote[];
  } catch {
    return [];
  }
}

export function saveLocalTechNotes(notes: ClientTechNote[], notify = true): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = notes.map(({ updatedAt: _u, ...rest }) => rest);
    window.localStorage.setItem(TECH_NOTES_CACHE_KEY, JSON.stringify(cleaned));
    if (notify) notifyLocalStoreChanges();
  } catch {
    // Ignore storage quota errors
  }
}

// ------------------------------------------------------------------
// 8. Computed Local Availability Slots (from local bookings + blocks)
// ------------------------------------------------------------------
export function computeLocalAvailabilitySlots(): AvailabilitySlot[] {
  const bookings = loadLocalBookings().filter((b) => b.status !== 'cancelled');
  const blocks = loadLocalBlocks();

  const fromBookings: AvailabilitySlot[] = bookings.map((b) => ({
    id: b.id,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    durationMinutes: b.totalDurationMinutes,
    kind: 'appointment',
    active: true,
    ownerUid: b.clientUid,
  }));

  const fromBlocks: AvailabilitySlot[] = blocks.map((blk) => ({
    id: blk.id,
    date: blk.date,
    startTime: blk.startTime,
    endTime: blk.endTime,
    durationMinutes: 60,
    kind: 'block',
    active: true,
    ownerUid: 'admin',
  }));

  return [...fromBookings, ...fromBlocks];
}
