import { create } from 'zustand';
import type { Room, Guest, Stay, Payment, ActivityLog, NavTab, MotelSettings } from './types';
import { isSupabaseConnected } from './supabase';
import { authFetch } from '@/components/auth-provider';

// ── Helpers ──────────────────────────────────────────────────────

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function timeNow(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Supabase Field Mapping ───────────────────────────────────────
// Our app uses camelCase. Supabase uses snake_case.
// These mappers translate between the two.

function mapRoomFromDb(row: Record<string, unknown>, settings: MotelSettings): Room {
  return {
    id: row.id as string,
    roomNumber: row.room_number as string,
    type: row.type as Room['type'],
    rate: row.type === '2-bed' ? settings.twoBedRate : settings.oneBedRate,
    status: row.status as Room['status'],
  };
}

function mapGuestFromDb(row: Record<string, unknown>): Guest {
  return {
    id: row.id as string,
    firstName: (row.first_name as string) || '',
    lastName: (row.last_name as string) || '',
    phone: (row.phone as string) || '',
    email: (row.email as string) || '',
    idNumber: (row.id_number as string) || '',
    dateOfBirth: row.date_of_birth ? String(row.date_of_birth) : '',
    idPhotoUrl: (row.id_photo_url as string) || '',
    idType: (row.id_type as string) || '',
    idState: (row.id_state as string) || '',
    createdAt: row.created_at as string,
  };
}

function mapStayFromDb(row: Record<string, unknown>): Stay {
  return {
    id: row.id as string,
    guestId: row.guest_id as string,
    roomId: row.room_id as string,
    checkInDate: row.check_in_date ? String(row.check_in_date) : '',
    checkInTime: row.check_in_time ? String(row.check_in_time) : '',
    checkOutDate: row.check_out_date ? String(row.check_out_date) : '',
    checkOutTime: row.check_out_time ? String(row.check_out_time) : '',
    rateAmount: Number(row.rate_amount) || 0,
    status: row.status as Stay['status'],
    createdAt: row.created_at as string,
  };
}

function mapPaymentFromDb(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    stayId: row.stay_id as string,
    amount: Number(row.amount) || 0,
    method: (row.method as Payment['method']) || 'cash',
    description: (row.notes as string) || '',
    paidAt: row.paid_at as string,
  };
}

// ── Mock Data ────────────────────────────────────────────────────

const MOCK_ROOMS: Room[] = [
  { id: 'room-101', roomNumber: '101', type: '1-bed', rate: 80, status: 'occupied' },
  { id: 'room-102', roomNumber: '102', type: '1-bed', rate: 80, status: 'available' },
  { id: 'room-103', roomNumber: '103', type: '2-bed', rate: 100, status: 'occupied' },
  { id: 'room-104', roomNumber: '104', type: '1-bed', rate: 80, status: 'cleaning' },
  { id: 'room-105', roomNumber: '105', type: '2-bed', rate: 100, status: 'available' },
  { id: 'room-106', roomNumber: '106', type: '1-bed', rate: 80, status: 'available' },
  { id: 'room-107', roomNumber: '107', type: '2-bed', rate: 100, status: 'maintenance' },
  { id: 'room-108', roomNumber: '108', type: '1-bed', rate: 80, status: 'available' },
  { id: 'room-109', roomNumber: '109', type: '2-bed', rate: 100, status: 'reserved' },
  { id: 'room-110', roomNumber: '110', type: '1-bed', rate: 80, status: 'available' },
  { id: 'room-111', roomNumber: '111', type: '2-bed', rate: 100, status: 'occupied' },
  { id: 'room-112', roomNumber: '112', type: '1-bed', rate: 80, status: 'available' },
];

const MOCK_GUESTS: Guest[] = [
  { id: 'guest-1', firstName: 'Marcus', lastName: 'Johnson', phone: '(720) 555-0142', email: 'marcus.j@email.com', idNumber: 'DL-882931', dateOfBirth: '1985-03-12', createdAt: '2025-01-15T10:00:00Z' },
  { id: 'guest-2', firstName: 'Elena', lastName: 'Rodriguez', phone: '(303) 555-0278', email: 'elena.r@email.com', idNumber: 'DL-441277', dateOfBirth: '1990-07-22', createdAt: '2025-02-20T14:30:00Z' },
  { id: 'guest-3', firstName: 'David', lastName: 'Chen', phone: '(720) 555-0391', email: 'david.c@email.com', idNumber: 'PASS-9821', dateOfBirth: '1978-11-05', createdAt: '2025-03-10T09:15:00Z' },
  { id: 'guest-4', firstName: 'Sarah', lastName: 'Williams', phone: '(303) 555-0510', email: 'sarah.w@email.com', idNumber: 'DL-556093', dateOfBirth: '1992-06-18', createdAt: '2025-04-05T16:45:00Z' },
];

const today = todayStr();
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

const MOCK_STAYS: Stay[] = [
  { id: 'stay-1', guestId: 'guest-1', roomId: 'room-101', checkInDate: twoDaysAgo, checkInTime: '2:00 PM', checkOutDate: today, checkOutTime: '10:00 AM', rateAmount: 80, status: 'active', createdAt: twoDaysAgo + 'T14:00:00Z' },
  { id: 'stay-2', guestId: 'guest-2', roomId: 'room-103', checkInDate: twoDaysAgo, checkInTime: '3:30 PM', checkOutDate: today, checkOutTime: '10:00 AM', rateAmount: 100, status: 'active', createdAt: twoDaysAgo + 'T15:30:00Z' },
  { id: 'stay-3', guestId: 'guest-3', roomId: 'room-201', checkInDate: today, checkInTime: '11:00 AM', checkOutDate: tomorrow, checkOutTime: '10:00 AM', rateAmount: 80, status: 'active', createdAt: today + 'T11:00:00Z' },
  { id: 'stay-4', guestId: 'guest-4', roomId: 'room-301', checkInDate: today, checkInTime: '1:00 PM', checkOutDate: tomorrow, checkOutTime: '10:00 AM', rateAmount: 100, status: 'active', createdAt: today + 'T13:00:00Z' },
];

const MOCK_PAYMENTS: Payment[] = [
  { id: 'pay-1', stayId: 'stay-1', amount: 80, method: 'card', description: 'Room charge (1 night)', paidAt: twoDaysAgo + 'T14:00:00Z' },
  { id: 'pay-3', stayId: 'stay-2', amount: 100, method: 'cash', description: 'Room charge (1 night)', paidAt: twoDaysAgo + 'T15:30:00Z' },
  { id: 'pay-5', stayId: 'stay-3', amount: 80, method: 'card', description: 'Room charge (1 night)', paidAt: today + 'T11:00:00Z' },
  { id: 'pay-7', stayId: 'stay-4', amount: 100, method: 'debit', description: 'Room charge (1 night)', paidAt: today + 'T13:00:00Z' },
];

const MOCK_ACTIVITY: ActivityLog[] = [
  { id: 'log-1', guest: 'David Chen', action: 'Check-in', room: '201', time: '11:00 AM', status: 'Success' },
  { id: 'log-2', guest: 'Sarah Williams', action: 'Check-in', room: '301', time: '1:00 PM', status: 'Success' },
  { id: 'log-3', guest: 'Marcus Johnson', action: 'Check-in', room: '101', time: '2:00 PM', status: 'Success' },
  { id: 'log-4', guest: 'Elena Rodriguez', action: 'Check-in', room: '103', time: '3:30 PM', status: 'Success' },
  { id: 'log-5', guest: 'Mike Turner', action: 'Check-out', room: '104', time: '9:45 AM', status: 'Success' },
];

const DEFAULT_SETTINGS: MotelSettings = {
  oneBedRate: 80,
  twoBedRate: 100,
  vatEnabled: false,
  vatRate: 10.75,
  weeklyDiscountEnabled: false,
  weeklyDiscountAmount: 200,
};

function mapSettingsFromDb(row: Record<string, unknown> | undefined): MotelSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    oneBedRate: Number(row.one_bed_rate) ?? 80,
    twoBedRate: Number(row.two_bed_rate) ?? 100,
    vatEnabled: Boolean(row.vat_enabled),
    vatRate: Number(row.vat_rate) ?? 10.75,
    weeklyDiscountEnabled: Boolean(row.weekly_discount_enabled),
    weeklyDiscountAmount: Number(row.weekly_discount_amount) ?? 200,
  };
}

// ── API Fetch Helpers ────────────────────────────────────────────

async function fetchFromApi<T>(path: string): Promise<T[] | null> {
  try {
    const res = await authFetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function postToApi<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await authFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function patchApi<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await authFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Store Interface ──────────────────────────────────────────────

interface MotelStore {
  // Data
  rooms: Room[];
  guests: Guest[];
  stays: Stay[];
  payments: Payment[];
  activityLog: ActivityLog[];
  activeTab: NavTab;
  isLoading: boolean;
  isUsingSupabase: boolean;
  dataLoaded: boolean;

  // Navigation
  setActiveTab: (tab: NavTab) => void;

  // Data loading
  loadFromSupabase: () => Promise<void>;

  // Room operations
  addRoom: (room: Omit<Room, 'id'>) => Promise<string>;
  updateRoomStatus: (roomId: string, status: Room['status']) => void;
  updateRoom: (roomId: string, updates: Partial<Omit<Room, 'id'>>) => void;
  deleteRoom: (roomId: string) => Promise<void>;

  // Guest operations
  addGuest: (guest: Omit<Guest, 'id' | 'createdAt'>) => Promise<string>;
  updateGuest: (guestId: string, updates: Partial<Omit<Guest, 'id' | 'createdAt'>>) => void;
  deleteGuest: (guestId: string) => Promise<void>;

  // Stay operations
  addStay: (stay: Omit<Stay, 'id' | 'createdAt'>) => Promise<string>;
  checkoutStay: (stayId: string) => void;

  // Payment operations
  addPayment: (payment: Omit<Payment, 'id' | 'paidAt'>) => Promise<void>;

  // Activity log
  addActivity: (entry: Omit<ActivityLog, 'id'>) => void;

  // Computed helpers
  getAvailableRooms: (type?: Room['type']) => Room[];
  getActiveStays: () => (Stay & { guest: Guest; room: Room; payments: Payment[] })[];
  getGuestStays: (guestId: string) => (Stay & { room: Room; payments: Payment[] })[];
  getTodayRevenue: () => number;
  getOccupiedCount: () => number;
  getAvailableCount: () => number;
  getCheckoutsToday: () => Stay[];

  // Motel settings
  motelSettings: MotelSettings;
  updateMotelSettings: (settings: Partial<MotelSettings>) => void;
}

// ── Store ────────────────────────────────────────────────────────

export const useMotelStore = create<MotelStore>((set, get) => ({
  rooms: [],
  guests: [],
  stays: [],
  payments: [],
  activityLog: [],
  activeTab: 'dashboard',
  isLoading: false,
  isUsingSupabase: false,
  dataLoaded: false,
  motelSettings: DEFAULT_SETTINGS,

  setActiveTab: (tab) => set({ activeTab: tab }),

  // ── Load all data from Supabase via API routes ──
  loadFromSupabase: async () => {
    if (!isSupabaseConnected) return;

    set({ isLoading: true });

    const settingsData = await fetchFromApi<Record<string, unknown>>('/api/motel-settings');
    const settings = settingsData && settingsData.length > 0 ? mapSettingsFromDb(settingsData[0]) : DEFAULT_SETTINGS;

    const [roomsData, guestsData, staysData, paymentsData] = await Promise.all([
      fetchFromApi<Record<string, unknown>>('/api/rooms'),
      fetchFromApi<Record<string, unknown>>('/api/guests'),
      fetchFromApi<Record<string, unknown>>('/api/stays'),
      fetchFromApi<Record<string, unknown>>('/api/payments'),
    ]);

    set({
      rooms: roomsData ? roomsData.map((r) => mapRoomFromDb(r, settings)) : [],
      guests: guestsData ? guestsData.map(mapGuestFromDb) : [],
      stays: staysData ? (staysData as Record<string, unknown>[]).map(mapStayFromDb) : [],
      payments: paymentsData ? paymentsData.map(mapPaymentFromDb) : [],
      motelSettings: settings,
      isUsingSupabase: !!(roomsData || guestsData || staysData || paymentsData),
      dataLoaded: true,
      isLoading: false,
    });
  },

  // ── Room operations ──
  addRoom: async (roomData) => {
    // Sync to Supabase first to get the real UUID
    if (isSupabaseConnected) {
      const result = await postToApi<{ id: string }>('/api/rooms', {
        room_number: roomData.roomNumber,
        type: roomData.type,
        status: roomData.status,
      });

      if (result?.id) {
        set((state) => ({
          rooms: [...state.rooms, { ...roomData, id: result.id }].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
        }));
        return result.id;
      }
    }

    // Fallback: generate a local ID
    const id = generateId();
    set((state) => ({
      rooms: [...state.rooms, { ...roomData, id }].sort((a, b) => a.roomNumber.localeCompare(b.roomNumber)),
    }));
    return id;
  },

  updateRoomStatus: (roomId, status) => {
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, status } : r)),
    }));

    // Sync to Supabase
    if (isSupabaseConnected) {
      patchApi('/api/rooms', { id: roomId, status });
    }
  },

  updateRoom: (roomId, updates) => {
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, ...updates } : r)),
    }));

    // Sync to Supabase
    if (isSupabaseConnected) {
      const snakeUpdates: Record<string, unknown> = {};
      if (updates.roomNumber !== undefined) snakeUpdates.room_number = updates.roomNumber;
      if (updates.type !== undefined) snakeUpdates.type = updates.type;
      if (updates.status !== undefined) snakeUpdates.status = updates.status;
      if (updates.rate !== undefined) snakeUpdates.rate = updates.rate;
      patchApi('/api/rooms', { id: roomId, ...snakeUpdates });
    }
  },

  deleteRoom: async (roomId) => {
    // Sync to Supabase
    if (isSupabaseConnected) {
      try {
        const res = await authFetch(`/api/rooms?id=${roomId}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to delete room');
        }
      } catch (err) {
        console.error('Failed to delete room from Supabase:', err);
        throw err;
      }
    }

    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
    }));
  },

  // ── Guest operations ──
  addGuest: async (guestData) => {
    const now = new Date().toISOString();

    // Sync to Supabase first to get the real UUID
    if (isSupabaseConnected) {
      const result = await postToApi<{ id: string }>('/api/guests', {
        first_name: guestData.firstName,
        last_name: guestData.lastName,
        phone: guestData.phone,
        email: guestData.email,
        id_number: guestData.idNumber,
        date_of_birth: guestData.dateOfBirth || null,
        id_photo_url: guestData.idPhotoUrl || null,
        id_type: guestData.idType || null,
        id_state: guestData.idState || null,
      });

      if (result?.id) {
        // Use the Supabase UUID as the local ID so everything matches
        set((state) => ({
          guests: [...state.guests, { ...guestData, id: result.id, createdAt: now }],
        }));
        return result.id;
      }
    }

    // Fallback: generate a local ID
    const id = generateId();
    set((state) => ({
      guests: [...state.guests, { ...guestData, id, createdAt: now }],
    }));
    return id;
  },

  updateGuest: (guestId, updates) => {
    set((state) => ({
      guests: state.guests.map((g) => (g.id === guestId ? { ...g, ...updates } : g)),
    }));

    if (isSupabaseConnected) {
      const snakeUpdates: Record<string, unknown> = {};
      if (updates.firstName !== undefined) snakeUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) snakeUpdates.last_name = updates.lastName;
      if (updates.phone !== undefined) snakeUpdates.phone = updates.phone;
      if (updates.email !== undefined) snakeUpdates.email = updates.email;
      if (updates.idNumber !== undefined) snakeUpdates.id_number = updates.idNumber;
      if (updates.dateOfBirth !== undefined) snakeUpdates.date_of_birth = updates.dateOfBirth;
      if (updates.idType !== undefined) snakeUpdates.id_type = updates.idType;
      if (updates.idState !== undefined) snakeUpdates.id_state = updates.idState;
      patchApi('/api/guests', { id: guestId, ...snakeUpdates });
    }
  },

  deleteGuest: async (guestId) => {
    set((state) => {
      const staysToDelete = state.stays.filter((s) => s.guestId === guestId);
      const stayIds = new Set(staysToDelete.map((s) => s.id));
      return {
        guests: state.guests.filter((g) => g.id !== guestId),
        stays: state.stays.filter((s) => s.guestId !== guestId),
        payments: state.payments.filter((p) => !stayIds.has(p.stayId)),
      };
    });

    if (isSupabaseConnected) {
      try {
        const res = await authFetch(`/api/guests?id=${guestId}`, { method: 'DELETE' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to delete guest');
        }
      } catch (err) {
        console.error('Failed to delete guest from Supabase:', err);
        throw err;
      }
    }
  },

  // ── Stay operations ──
  addStay: async (stayData) => {
    const now = new Date().toISOString();

    // Sync to Supabase first to get the real UUID
    if (isSupabaseConnected) {
      const result = await postToApi<{ id: string }>('/api/stays', {
        guest_id: stayData.guestId,
        room_id: stayData.roomId,
        rate_type: 'daily',
        rate_amount: stayData.rateAmount,
        check_in_date: stayData.checkInDate,
        check_in_time: stayData.checkInTime,
        check_out_date: stayData.checkOutDate,
        check_out_time: stayData.checkOutTime,
        status: 'active',
      });

      if (result?.id) {
        set((state) => ({
          stays: [...state.stays, { ...stayData, id: result.id, createdAt: now }],
        }));
        return result.id;
      }
    }

    // Fallback: generate a local ID
    const id = generateId();
    set((state) => ({
      stays: [...state.stays, { ...stayData, id, createdAt: now }],
    }));
    return id;
  },

  checkoutStay: (stayId) => {
    const state = get();
    const stay = state.stays.find((s) => s.id === stayId);
    if (!stay) return;

    set((state) => ({
      stays: state.stays.map((s) => (s.id === stayId ? { ...s, status: 'checked_out' as const } : s)),
      rooms: state.rooms.map((r) => (r.id === stay.roomId ? { ...r, status: 'cleaning' as const } : r)),
    }));

    // Sync to Supabase
    if (isSupabaseConnected) {
      patchApi('/api/stays', { id: stayId, status: 'checked_out', actual_check_out: new Date().toISOString() });
      patchApi('/api/rooms', { id: stay.roomId, status: 'cleaning' });
    }
  },

  // ── Payment operations ──
  addPayment: async (paymentData) => {
    const now = new Date().toISOString();

    // Sync to Supabase first to get the real UUID
    if (isSupabaseConnected) {
      const result = await postToApi<{ id: string }>('/api/payments', {
        stay_id: paymentData.stayId,
        amount: paymentData.amount,
        method: paymentData.method,
        notes: paymentData.description,
      });

      if (result?.id) {
        set((state) => ({
          payments: [...state.payments, { ...paymentData, id: result.id, paidAt: now }],
        }));
        return;
      }
    }

    // Fallback: generate a local ID
    set((state) => ({
      payments: [...state.payments, { ...paymentData, id: generateId(), paidAt: now }],
    }));
  },

  // ── Activity log (local only — not in Supabase) ──
  addActivity: (entry) => {
    set((state) => ({
      activityLog: [{ ...entry, id: generateId() }, ...state.activityLog].slice(0, 50),
    }));
  },

  // ── Computed helpers ──
  getAvailableRooms: (type) => {
    const { rooms } = get();
    return rooms.filter((r) => {
      if (r.status !== 'available') return false;
      if (type && r.type !== type) return false;
      return true;
    });
  },

  getActiveStays: () => {
    const { stays, guests, rooms, payments } = get();
    return stays
      .filter((s) => s.status === 'active')
      .map((s) => ({
        ...s,
        guest: guests.find((g) => g.id === s.guestId)!,
        room: rooms.find((r) => r.id === s.roomId)!,
        payments: payments.filter((p) => p.stayId === s.id),
      }))
      .filter((s) => s.guest && s.room);
  },

  getGuestStays: (guestId) => {
    const { stays, rooms, payments } = get();
    return stays
      .filter((s) => s.guestId === guestId)
      .map((s) => ({
        ...s,
        room: rooms.find((r) => r.id === s.roomId)!,
        payments: payments.filter((p) => p.stayId === s.id),
      }))
      .filter((s) => s.room);
  },

  getTodayRevenue: () => {
    const { payments } = get();
    const today = todayStr();
    return payments
      .filter((p) => p.paidAt.startsWith(today))
      .reduce((sum, p) => sum + p.amount, 0);
  },

  getOccupiedCount: () => get().rooms.filter((r) => r.status === 'occupied').length,

  getAvailableCount: () => get().rooms.filter((r) => r.status === 'available').length,

  getCheckoutsToday: () => {
    const today = todayStr();
    return get().stays.filter((s) => s.status === 'active' && s.checkOutDate === today);
  },

  // Motel settings
  updateMotelSettings: async (newSettings) => {
    const state = get();
    const updated = { ...state.motelSettings, ...newSettings };

    if (isSupabaseConnected) {
      const existing = await fetchFromApi<Record<string, unknown>[]>('/api/motel-settings');
      if (existing && existing.length > 0) {
        await patchApi('/api/motel-settings', {
          id: existing[0].id,
          one_bed_rate: updated.oneBedRate,
          two_bed_rate: updated.twoBedRate,
          vat_enabled: updated.vatEnabled,
          vat_rate: updated.vatRate,
          weekly_discount_enabled: updated.weeklyDiscountEnabled,
          weekly_discount_amount: updated.weeklyDiscountAmount,
        });
      } else {
        await postToApi<{ id: string }>('/api/motel-settings', {
          id: 'main',
          one_bed_rate: updated.oneBedRate,
          two_bed_rate: updated.twoBedRate,
          vat_enabled: updated.vatEnabled,
          vat_rate: updated.vatRate,
          weekly_discount_enabled: updated.weeklyDiscountEnabled,
          weekly_discount_amount: updated.weeklyDiscountAmount,
        });
      }
    }

    set({ motelSettings: updated });
  },
}));
