import { DEFAULT_SETTINGS } from './defaults';
import type { Appointment, SalonSettings } from '../types/salon';

const SETTINGS_CACHE_KEY = 'ep_nails_settings_cache_v36';
const CLIENT_PROFILE_KEY = 'ep_nails_client_profile_v36';
const GUEST_BOOKINGS_KEY = 'ep_nails_guest_bookings_v36';

export interface SavedClientIdentity {
  name: string;
  phone: string;
}

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
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveCachedSettingsSync(settings: SalonSettings): void {
  if (typeof window === 'undefined') return;
  try {
    const { updatedAt: _omit, ...serializable } = settings;
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(serializable));
  } catch {
    // Ignore storage quota errors
  }
}

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

export function upsertLocalBooking(appointment: Appointment): Appointment[] {
  const current = loadLocalBookings();
  const { createdAt: _c, updatedAt: _u, ...clean } = appointment;
  const next = [clean, ...current.filter((item) => item.id !== appointment.id)].sort((a, b) =>
    `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`),
  );
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(GUEST_BOOKINGS_KEY, JSON.stringify(next.slice(0, 40)));
    } catch {
      // Ignore storage quota errors
    }
  }
  return next;
}
