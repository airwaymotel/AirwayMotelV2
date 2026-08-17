export type UserRole = 'super_admin' | 'operator';

export type Permission =
  | 'check_in'
  | 'view_dashboard'
  | 'view_rooms'
  | 'view_guests'
  | 'view_payments'
  | 'download_receipts'
  | 'download_forms';

export const ALL_PERMISSIONS: { value: Permission; label: string; description: string }[] = [
  { value: 'check_in', label: 'Check-In', description: 'Can complete guest check-ins' },
  { value: 'view_dashboard', label: 'Dashboard', description: 'Can view the dashboard' },
  { value: 'view_rooms', label: 'Rooms', description: 'Can view room status' },
  { value: 'view_guests', label: 'Guests', description: 'Can view guest history' },
  { value: 'view_payments', label: 'Payments', description: 'Can view payment records' },
  { value: 'download_receipts', label: 'Receipts', description: 'Can download/print receipts' },
  { value: 'download_forms', label: 'Forms', description: 'Can download/print registration forms' },
];

export const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  'check_in',
  'view_dashboard',
  'view_rooms',
  'view_guests',
  'view_payments',
  'download_receipts',
  'download_forms',
];

export interface AuthUser {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  permissions: Permission[];
}

export interface OperatorWithStats {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  permissions: Permission[];
  total_check_ins: number;
  total_revenue: number;
}

export interface OperatorActivity {
  id: string;
  operator_id: string;
  action: string;
  stay_id: string | null;
  guest_id: string | null;
  room_id: string | null;
  amount: number;
  description: string | null;
  created_at: string;
  guest_name?: string;
  room_number?: string;
}
