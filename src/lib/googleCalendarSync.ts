import type { Appointment, SalonSettings } from '../types/salon';
import { getAdminSessionToken } from './adminRoute';

export interface GoogleCalendarStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

export async function fetchGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  try {
    const token = getAdminSessionToken();
    const resp = await fetch('/api/google-calendar?action=status', {
      headers: token ? { 'x-admin-auth': token } : {},
    });
    if (!resp.ok) return { configured: false, connected: false, email: null };
    return (await resp.json()) as GoogleCalendarStatus;
  } catch {
    return { configured: false, connected: false, email: null };
  }
}

export async function disconnectGoogleCalendar(): Promise<boolean> {
  try {
    const token = getAdminSessionToken();
    const resp = await fetch('/api/google-calendar?action=disconnect', {
      method: 'POST',
      headers: token ? { 'x-admin-auth': token } : {},
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function syncAppointmentToGoogleCalendar(
  appointment: Appointment,
  settings?: Partial<SalonSettings>,
): Promise<boolean> {
  try {
    const resp = await fetch('/api/google-calendar?action=sync-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appointmentId: appointment.id,
        clientName: appointment.clientName,
        clientPhone: appointment.clientPhone,
        serviceNames: appointment.serviceNames,
        date: appointment.date,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        totalPrice: appointment.totalPrice,
        status: appointment.status,
        notes: appointment.notes,
        studioName: settings?.studioName || 'Estefany Paiva Nails',
        address: settings?.address || '',
      }),
    });
    if (!resp.ok) return false;
    const data = (await resp.json()) as { ok?: boolean };
    return Boolean(data.ok);
  } catch {
    return false;
  }
}
