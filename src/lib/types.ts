export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'reserved';
export type RoomType = '1-bed' | '2-bed';
export type StayStatus = 'active' | 'checked_out' | 'cancelled';
export type PaymentMethod = 'cash' | 'card' | 'debit';

export interface Room {
  id: string;
  roomNumber: string;
  floor: number;
  type: RoomType;
  rate: number;
  status: RoomStatus;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  idNumber: string;
  dateOfBirth: string;
  createdAt: string;
}

export interface Stay {
  id: string;
  guestId: string;
  roomId: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate: string;
  checkOutTime: string;
  rateAmount: number;
  status: StayStatus;
  keyDeposit: number;
  tvRemoteDeposit: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  stayId: string;
  amount: number;
  method: PaymentMethod;
  description: string;
  paidAt: string;
}

export interface ActivityLog {
  id: string;
  guest: string;
  action: string;
  room: string;
  time: string;
  status: 'Success' | 'Pending';
}

export type NavTab = 'dashboard' | 'rooms' | 'check-in' | 'checkout' | 'guests';
