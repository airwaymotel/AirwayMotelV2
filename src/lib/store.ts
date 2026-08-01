import { create } from 'zustand';
import type { Room, Guest, Stay, Payment, ActivityLog, NavTab } from './types';

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function timeNow(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ── Mock Data ──────────────────────────────────────────────────────

const MOCK_ROOMS: Room[] = [
  // Floor 1
  { id: 'room-101', roomNumber: '101', floor: 1, type: '1-bed', rate: 65, status: 'occupied' },
  { id: 'room-102', roomNumber: '102', floor: 1, type: '1-bed', rate: 65, status: 'available' },
  { id: 'room-103', roomNumber: '103', floor: 1, type: '2-bed', rate: 85, status: 'occupied' },
  { id: 'room-104', roomNumber: '104', floor: 1, type: '1-bed', rate: 65, status: 'cleaning' },
  { id: 'room-105', roomNumber: '105', floor: 1, type: '2-bed', rate: 85, status: 'available' },
  // Floor 2
  { id: 'room-201', roomNumber: '201', floor: 2, type: '1-bed', rate: 65, status: 'occupied' },
  { id: 'room-202', roomNumber: '202', floor: 2, type: '2-bed', rate: 85, status: 'maintenance' },
  { id: 'room-203', roomNumber: '203', floor: 2, type: '1-bed', rate: 65, status: 'available' },
  { id: 'room-204', roomNumber: '204', floor: 2, type: '2-bed', rate: 85, status: 'reserved' },
  { id: 'room-205', roomNumber: '205', floor: 2, type: '1-bed', rate: 65, status: 'available' },
  // Floor 3
  { id: 'room-301', roomNumber: '301', floor: 3, type: '2-bed', rate: 85, status: 'occupied' },
  { id: 'room-302', roomNumber: '302', floor: 3, type: '1-bed', rate: 65, status: 'available' },
];

const MOCK_GUESTS: Guest[] = [
  {
    id: 'guest-1',
    firstName: 'Marcus',
    lastName: 'Johnson',
    phone: '(720) 555-0142',
    email: 'marcus.j@email.com',
    idNumber: 'DL-882931',
    dateOfBirth: '1985-03-12',
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'guest-2',
    firstName: 'Elena',
    lastName: 'Rodriguez',
    phone: '(303) 555-0278',
    email: 'elena.r@email.com',
    idNumber: 'DL-441277',
    dateOfBirth: '1990-07-22',
    createdAt: '2025-02-20T14:30:00Z',
  },
  {
    id: 'guest-3',
    firstName: 'David',
    lastName: 'Chen',
    phone: '(720) 555-0391',
    email: 'david.c@email.com',
    idNumber: 'PASS-9821',
    dateOfBirth: '1978-11-05',
    createdAt: '2025-03-10T09:15:00Z',
  },
  {
    id: 'guest-4',
    firstName: 'Sarah',
    lastName: 'Williams',
    phone: '(303) 555-0510',
    email: 'sarah.w@email.com',
    idNumber: 'DL-556093',
    dateOfBirth: '1992-06-18',
    createdAt: '2025-04-05T16:45:00Z',
  },
];

const today = todayStr();
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];

const MOCK_STAYS: Stay[] = [
  {
    id: 'stay-1',
    guestId: 'guest-1',
    roomId: 'room-101',
    checkInDate: twoDaysAgo,
    checkInTime: '2:00 PM',
    checkOutDate: today,
    checkOutTime: '10:00 AM',
    rateAmount: 65,
    status: 'active',
    keyDeposit: 10,
    tvRemoteDeposit: 10,
    createdAt: twoDaysAgo + 'T14:00:00Z',
  },
  {
    id: 'stay-2',
    guestId: 'guest-2',
    roomId: 'room-103',
    checkInDate: twoDaysAgo,
    checkInTime: '3:30 PM',
    checkOutDate: today,
    checkOutTime: '10:00 AM',
    rateAmount: 85,
    status: 'active',
    keyDeposit: 10,
    tvRemoteDeposit: 10,
    createdAt: twoDaysAgo + 'T15:30:00Z',
  },
  {
    id: 'stay-3',
    guestId: 'guest-3',
    roomId: 'room-201',
    checkInDate: today,
    checkInTime: '11:00 AM',
    checkOutDate: tomorrow,
    checkOutTime: '10:00 AM',
    rateAmount: 65,
    status: 'active',
    keyDeposit: 10,
    tvRemoteDeposit: 10,
    createdAt: today + 'T11:00:00Z',
  },
  {
    id: 'stay-4',
    guestId: 'guest-4',
    roomId: 'room-301',
    checkInDate: today,
    checkInTime: '1:00 PM',
    checkOutDate: tomorrow,
    checkOutTime: '10:00 AM',
    rateAmount: 85,
    status: 'active',
    keyDeposit: 10,
    tvRemoteDeposit: 10,
    createdAt: today + 'T13:00:00Z',
  },
];

const MOCK_PAYMENTS: Payment[] = [
  { id: 'pay-1', stayId: 'stay-1', amount: 65, method: 'card', description: 'Room charge (1 night)', paidAt: twoDaysAgo + 'T14:00:00Z' },
  { id: 'pay-2', stayId: 'stay-1', amount: 20, method: 'cash', description: 'Key + TV remote deposit', paidAt: twoDaysAgo + 'T14:00:00Z' },
  { id: 'pay-3', stayId: 'stay-2', amount: 85, method: 'cash', description: 'Room charge (1 night)', paidAt: twoDaysAgo + 'T15:30:00Z' },
  { id: 'pay-4', stayId: 'stay-2', amount: 20, method: 'cash', description: 'Key + TV remote deposit', paidAt: twoDaysAgo + 'T15:30:00Z' },
  { id: 'pay-5', stayId: 'stay-3', amount: 65, method: 'card', description: 'Room charge (1 night)', paidAt: today + 'T11:00:00Z' },
  { id: 'pay-6', stayId: 'stay-3', amount: 20, method: 'card', description: 'Key + TV remote deposit', paidAt: today + 'T11:00:00Z' },
  { id: 'pay-7', stayId: 'stay-4', amount: 85, method: 'debit', description: 'Room charge (1 night)', paidAt: today + 'T13:00:00Z' },
  { id: 'pay-8', stayId: 'stay-4', amount: 20, method: 'debit', description: 'Key + TV remote deposit', paidAt: today + 'T13:00:00Z' },
];

const MOCK_ACTIVITY: ActivityLog[] = [
  { id: 'log-1', guest: 'David Chen', action: 'Check-in', room: '201', time: '11:00 AM', status: 'Success' },
  { id: 'log-2', guest: 'Sarah Williams', action: 'Check-in', room: '301', time: '1:00 PM', status: 'Success' },
  { id: 'log-3', guest: 'Marcus Johnson', action: 'Check-in', room: '101', time: '2:00 PM', status: 'Success' },
  { id: 'log-4', guest: 'Elena Rodriguez', action: 'Check-in', room: '103', time: '3:30 PM', status: 'Success' },
  { id: 'log-5', guest: 'Mike Turner', action: 'Check-out', room: '104', time: '9:45 AM', status: 'Success' },
];

// ── Store Interface ────────────────────────────────────────────────

interface MotelStore {
  // Data
  rooms: Room[];
  guests: Guest[];
  stays: Stay[];
  payments: Payment[];
  activityLog: ActivityLog[];
  activeTab: NavTab;

  // Navigation
  setActiveTab: (tab: NavTab) => void;

  // Room operations
  updateRoomStatus: (roomId: string, status: Room['status']) => void;

  // Guest operations
  addGuest: (guest: Omit<Guest, 'id' | 'createdAt'>) => string;

  // Stay operations
  addStay: (stay: Omit<Stay, 'id' | 'createdAt'>) => string;
  checkoutStay: (stayId: string) => void;

  // Payment operations
  addPayment: (payment: Omit<Payment, 'id' | 'paidAt'>) => void;

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
}

// ── Store ──────────────────────────────────────────────────────────

export const useMotelStore = create<MotelStore>((set, get) => ({
  rooms: MOCK_ROOMS,
  guests: MOCK_GUESTS,
  stays: MOCK_STAYS,
  payments: MOCK_PAYMENTS,
  activityLog: MOCK_ACTIVITY,
  activeTab: 'dashboard',

  setActiveTab: (tab) => set({ activeTab: tab }),

  updateRoomStatus: (roomId, status) =>
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, status } : r)),
    })),

  addGuest: (guestData) => {
    const id = generateId();
    set((state) => ({
      guests: [
        ...state.guests,
        { ...guestData, id, createdAt: new Date().toISOString() },
      ],
    }));
    return id;
  },

  addStay: (stayData) => {
    const id = generateId();
    set((state) => ({
      stays: [
        ...state.stays,
        { ...stayData, id, createdAt: new Date().toISOString() },
      ],
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
  },

  addPayment: (paymentData) => {
    set((state) => ({
      payments: [
        ...state.payments,
        { ...paymentData, id: generateId(), paidAt: new Date().toISOString() },
      ],
    }));
  },

  addActivity: (entry) => {
    set((state) => ({
      activityLog: [{ ...entry, id: generateId() }, ...state.activityLog].slice(0, 50),
    }));
  },

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
}));
