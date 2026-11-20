export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentMethod = 'pix' | 'presencial';

export interface SalonSettings {
  studioName: string;
  tagline: string;
  ownerName: string;
  bio: string;
  avatarImage: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  whatsapp: string;
  instagram: string;
  address: string;
  pixKey: string;
  pixName: string;
  pixCity: string;
  depositPercent: number;
  rescheduleMinHours: number;
  monthlyGoal: number;
  openTime: string;
  closeTime: string;
  slotIntervalMinutes: number;
  configuredSlots: string[];
  workDays: number[];
  blockedDates: string[];
  returnAlertDays: number;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Service {
  id: string;
  name: string;
  categoryId: string;
  description: string;
  price: number;
  durationMinutes: number;
  imageUrl: string;
  featured: boolean;
  active: boolean;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Appointment {
  id: string;
  clientUid: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  serviceIds: string[];
  serviceNames: string[];
  totalPrice: number;
  totalDurationMinutes: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: AppointmentStatus;
  paymentMethod: PaymentMethod;
  pixPaid: boolean;
  notes: string;
  rescheduleCount: number;
  bookingToken: string;
  lastVerifiedToken: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AvailabilitySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  kind: 'appointment' | 'block';
  active: boolean;
  ownerUid: string;
  updatedAt?: unknown;
}

export interface PersonalBlock {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ClientTechNote {
  id: string;
  clientName: string;
  clientPhone: string;
  nailFormat: string;
  gelBrand: string;
  favoriteColors: string;
  allergies: string;
  cuticleNotes: string;
  notes: string;
  updatedAt?: unknown;
}

export interface ClientProfileSummary {
  key: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  totalVisits: number;
  totalSpent: number;
  lastVisitDate: string | null;
  daysSinceLastVisit: number | null;
  needsReturnAlert: boolean;
  lastServices: string[];
  techNote?: ClientTechNote;
}
