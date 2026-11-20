/**
 * Phase 0 Security Test Specification for Estefany Paiva Nails Firestore Rules.
 * Verifies all "Dirty Dozen" adversarial payloads are rejected by firestore.rules.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  actor: { uid: string; email: string; email_verified: boolean } | null;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Booking',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/appointments/apt_spoof',
    payload: { clientUid: 'client_b', status: 'pending', pixPaid: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Approved Payment / Status',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/appointments/apt_self_confirm',
    payload: { clientUid: 'client_a', status: 'confirmed', pixPaid: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/appointments/apt_ghost',
    payload: { clientUid: 'client_a', status: 'pending', isVip: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Missing Atomic Availability Slot Sync',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/appointments/apt_no_slot',
    payload: { clientUid: 'client_a', status: 'pending', pixPaid: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'PII Cross-Read on Appointments',
    actor: { uid: 'client_b', email: 'b@example.com', email_verified: true },
    operation: 'get',
    path: '/appointments/apt_owned_by_a',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Terminal State Violation',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'update',
    path: '/appointments/apt_completed',
    payload: { status: 'confirmed', date: '2026-12-01' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Price Tampering During Reschedule',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'update',
    path: '/appointments/apt_owned_by_a',
    payload: { date: '2026-12-02', totalPrice: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client Timestamp Forgery',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/appointments/apt_bad_time',
    payload: { clientUid: 'client_a', createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Path ID Poisoning',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/appointments/bad$id!with*chars',
    payload: { clientUid: 'client_a' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Array Exhaustion / Type Poisoning',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/appointments/apt_array_poison',
    payload: { clientUid: 'client_a', serviceIds: [12345] },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Admin Email Spoofing Without Verification',
    actor: { uid: 'spoof_uid', email: 'rs8802616@gmail.com', email_verified: false },
    operation: 'get',
    path: '/client_tech_notes/note_1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Self-Role Escalation in Admins Collection',
    actor: { uid: 'client_a', email: 'a@example.com', email_verified: true },
    operation: 'create',
    path: '/admins/client_a',
    payload: { email: 'a@example.com' },
    expected: 'PERMISSION_DENIED',
  },
];
