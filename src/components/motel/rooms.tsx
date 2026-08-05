'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, RotateCcw, User, Phone, Mail, Calendar,
  CreditCard, Shield, FileText, ArrowRight, BedSingle, BedDouble,
  ImageIcon, PenLine, Plus, Trash2, Pencil, Check, X, Loader2,
  Settings,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMotelStore } from '@/lib/store';
import { toast } from 'sonner';
import RoomCard from './room-card';
import type { Room, RoomType, RoomStatus } from '@/lib/types';

const FILTERS = ['All', 'Available', 'Occupied', 'Needs Attention'] as const;

const STATUS_OPTIONS: { value: RoomStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Available', color: 'bg-green-500' },
  { value: 'occupied', label: 'Occupied', color: 'bg-red-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-amber-500' },
  { value: 'cleaning', label: 'Cleaning', color: 'bg-blue-500' },
  { value: 'reserved', label: 'Reserved', color: 'bg-purple-500' },
];

export default function Rooms() {
  const router = useRouter();
  const rooms = useMotelStore((s) => s.rooms);
  const stays = useMotelStore((s) => s.stays);
  const guests = useMotelStore((s) => s.guests);
  const payments = useMotelStore((s) => s.payments);
  const addRoom = useMotelStore((s) => s.addRoom);
  const updateRoomStatus = useMotelStore((s) => s.updateRoomStatus);
  const updateRoom = useMotelStore((s) => s.updateRoom);
  const deleteRoom = useMotelStore((s) => s.deleteRoom);
  const motelSettings = useMotelStore((s) => s.motelSettings);
  const updateMotelSettings = useMotelStore((s) => s.updateMotelSettings);

  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Add Room dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newRoomType, setNewRoomType] = useState<RoomType>('1-bed');

  const [newRoomStatus, setNewRoomStatus] = useState<RoomStatus>('available');
  const [adding, setAdding] = useState(false);

  // Edit mode in sheet
  const [editing, setEditing] = useState(false);
  const [editRoomNumber, setEditRoomNumber] = useState('');
  const [editRoomType, setEditRoomType] = useState<RoomType>('1-bed');


  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(motelSettings);

  const filteredRooms = rooms.filter((room) => {
    if (filter !== 'All') {
      if (filter === 'Available' && room.status !== 'available') return false;
      if (filter === 'Occupied' && room.status !== 'occupied') return false;
      if (filter === 'Needs Attention' && room.status !== 'cleaning' && room.status !== 'maintenance') return false;
    }
    if (searchQuery && !room.roomNumber.includes(searchQuery)) return false;
    return true;
  });

  const getActiveStayForRoom = (roomId: string) => {
    const stay = stays.find((s) => s.roomId === roomId && s.status === 'active');
    if (!stay) return undefined;
    const guest = guests.find((g) => g.id === stay.guestId);
    if (!guest) return undefined;
    const stayPayments = payments.filter((p) => p.stayId === stay.id);
    return { ...stay, guest, payments: stayPayments };
  };

  const statusColors: Record<Room['status'], string> = {
    available: 'bg-green-500',
    occupied: 'bg-red-500',
    maintenance: 'bg-amber-500',
    cleaning: 'bg-blue-500',
    reserved: 'bg-purple-500',
  };

  const activeStay = selectedRoom ? getActiveStayForRoom(selectedRoom.id) : undefined;

  // ── Add Room Handler ──
  const handleAddRoom = async () => {
    if (!newRoomNumber.trim()) {
      toast.error('Room number is required');
      return;
    }
    if (rooms.some((r) => r.roomNumber === newRoomNumber.trim())) {
      toast.error(`Room ${newRoomNumber} already exists`);
      return;
    }
    setAdding(true);
    try {
      const rate = newRoomType === '1-bed' ? settings.oneBedRate : settings.twoBedRate;
      await addRoom({
        roomNumber: newRoomNumber.trim(),
        type: newRoomType,
        rate,
        status: newRoomStatus,
      });
      toast.success(`Room ${newRoomNumber} added successfully`);
      setShowAddDialog(false);
      setNewRoomNumber('');
      setNewRoomType('1-bed');
      setNewRoomStatus('available');
    } catch (err) {
      toast.error('Failed to add room');
    } finally {
      setAdding(false);
    }
  };

  // ── Delete Room Handler ──
  const handleDeleteRoom = async () => {
    if (!selectedRoom) return;
    if (selectedRoom.status === 'occupied') {
      toast.error('Cannot delete an occupied room. Check out the guest first.');
      setShowDeleteConfirm(false);
      return;
    }
    setDeleting(true);
    try {
      await deleteRoom(selectedRoom.id);
      toast.success(`Room ${selectedRoom.roomNumber} deleted`);
      setSelectedRoom(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      toast.error('Failed to delete room');
    } finally {
      setDeleting(false);
    }
  };

  // ── Edit Room Handler ──
  const handleSaveEdit = () => {
    if (!selectedRoom) return;
    if (!editRoomNumber.trim()) {
      toast.error('Room number is required');
      return;
    }
    const updates: Partial<Omit<Room, 'id'>> = {};
    if (editRoomNumber !== selectedRoom.roomNumber) updates.roomNumber = editRoomNumber.trim();
    if (editRoomType !== selectedRoom.type) {
      updates.type = editRoomType;
      updates.rate = editRoomType === '1-bed' ? settings.oneBedRate : settings.twoBedRate;
    }


    if (Object.keys(updates).length > 0) {
      updateRoom(selectedRoom.id, updates);
      setSelectedRoom({ ...selectedRoom, ...updates });
      toast.success('Room updated');
    }
    setEditing(false);
  };

  const startEditing = () => {
    if (!selectedRoom) return;
    setEditRoomNumber(selectedRoom.roomNumber);
    setEditRoomType(selectedRoom.type);

    setEditing(true);
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Room Status Board</h2>
          <p className="text-muted-foreground mt-1">Real-time overview of all property units.</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Room #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-28"
            />
          </div>

          <div className="flex bg-muted rounded-md p-0.5">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-sm text-xs font-medium transition-all cursor-pointer ${
                  filter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => useMotelStore.getState().loadFromSupabase()}>
            <RotateCcw className="w-4 h-4" />
          </Button>

          {/* Settings Button */}
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => { setSettings(motelSettings); setShowSettings(true); }}>
            <Settings className="w-4 h-4" />
          </Button>

          {/* Add Room Button */}
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="h-9">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Room
          </Button>
        </div>
      </div>

      {/* Room Grid */}
      {filteredRooms.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground bg-card rounded-xl border border-dashed border-border">
          No rooms match your current filters.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {STATUS_OPTIONS.map((s) => (
              <div key={s.value} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                activeStay={getActiveStayForRoom(room.id)}
                onClick={() => { setSelectedRoom(room); setEditing(false); }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Add Room Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Room</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <div className="space-y-2">
                <Label htmlFor="room-number" className="text-xs">Room Number *</Label>
                <Input
                  id="room-number"
                  placeholder="e.g. 15"
                  value={newRoomNumber}
                  onChange={(e) => setNewRoomNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Room Type</Label>
                <Select value={newRoomType} onValueChange={(v) => setNewRoomType(v as RoomType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-bed">1-Bed King (${settings.oneBedRate})</SelectItem>
                    <SelectItem value="2-bed">2-Bed Queen (${settings.twoBedRate})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Initial Status</Label>
                <Select value={newRoomStatus} onValueChange={(v) => setNewRoomStatus(v as RoomStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${s.color}`} />
                          {s.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={adding}>
              Cancel
            </Button>
            <Button onClick={handleAddRoom} disabled={adding || !newRoomNumber.trim()}>
              {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              {adding ? 'Adding...' : 'Add Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Room {selectedRoom?.roomNumber}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will permanently remove this room from the system. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRoom} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {deleting ? 'Deleting...' : 'Delete Room'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Room Detail Sheet ── */}
      <Sheet open={!!selectedRoom} onOpenChange={(open) => { if (!open) { setSelectedRoom(null); setEditing(false); } }}>
        <SheetContent className="overflow-y-auto pl-6 pr-6">
          {selectedRoom && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${statusColors[selectedRoom.status]}`} />
                  {editing ? `Edit Room ${selectedRoom.roomNumber}` : `Room ${selectedRoom.roomNumber}`}
                </SheetTitle>
              </SheetHeader>

              {/* ── EDIT MODE ── */}
              {editing ? (
                <div className="mt-8 space-y-5">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Room Number</Label>
                      <Input value={editRoomNumber} onChange={(e) => setEditRoomNumber(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Type</Label>
                      <Select value={editRoomType} onValueChange={(v) => setEditRoomType(v as RoomType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-bed">1-Bed King (${settings.oneBedRate})</SelectItem>
                          <SelectItem value="2-bed">2-Bed Queen (${settings.twoBedRate})</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                      <X className="w-4 h-4 mr-1.5" /> Cancel
                    </Button>
                    <Button className="flex-1" onClick={handleSaveEdit}>
                      <Check className="w-4 h-4 mr-1.5" /> Save
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── OCCUPIED ROOM: Rich guest detail ── */}
                  {selectedRoom.status === 'occupied' && activeStay ? (
                    <div className="mt-8 space-y-6">
                      {/* Room basics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Type</p>
                          <p className="text-sm font-medium flex items-center gap-1.5">
                            {selectedRoom.type === '1-bed' ? <BedSingle className="w-4 h-4" /> : <BedDouble className="w-4 h-4" />}
                            {selectedRoom.type === '1-bed' ? '1-Bed King' : '2-Bed Queen'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Rate</p>
                          <p className="text-sm font-medium">${selectedRoom.rate}/night</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Status</p>
                          <Badge variant="destructive" className="text-[10px] uppercase">Occupied</Badge>
                        </div>
                      </div>

                      <Separator className="my-2" />

                      {/* Guest Profile */}
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-3 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" /> Current Guest
                        </p>
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                              {(activeStay.guest.firstName || '?')[0]}{(activeStay.guest.lastName || '?')[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="space-y-1.5">
                            <p className="text-sm font-semibold">
                              {activeStay.guest.firstName} {activeStay.guest.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <Phone className="w-3 h-3 shrink-0" /> {activeStay.guest.phone}
                            </p>
                            {activeStay.guest.email && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Mail className="w-3 h-3 shrink-0" /> {activeStay.guest.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Check-in / Check-out */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-muted/40 rounded-lg p-4">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Check-in
                          </p>
                          <p className="text-sm font-medium">{activeStay.checkInDate}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{activeStay.checkInTime}</p>
                        </div>
                        <div className="bg-muted/40 rounded-lg p-4">
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Check-out
                          </p>
                          <p className="text-sm font-medium">{activeStay.checkOutDate}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{activeStay.checkOutTime}</p>
                        </div>
                      </div>

                      {/* Identification Details */}
                      {(activeStay.guest.idNumber || activeStay.guest.dateOfBirth || activeStay.guest.idType) && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-3 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5" /> Identification
                          </p>
                          <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                            {activeStay.guest.idType && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">ID Type</span>
                                <span className="font-medium">{activeStay.guest.idType}</span>
                              </div>
                            )}
                            {activeStay.guest.idNumber && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">ID Number</span>
                                <span className="font-medium font-mono">{activeStay.guest.idNumber}</span>
                              </div>
                            )}
                            {activeStay.guest.idState && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">State</span>
                                <span className="font-medium">{activeStay.guest.idState}</span>
                              </div>
                            )}
                            {activeStay.guest.dateOfBirth && (
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Date of Birth</span>
                                <span className="font-medium">{activeStay.guest.dateOfBirth}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ID Photo */}
                      {activeStay.guest.idPhotoUrl && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-3 flex items-center gap-1.5">
                            <ImageIcon className="w-3.5 h-3.5" /> ID Photo on File
                          </p>
                          <div className="rounded-lg overflow-hidden border border-border bg-muted/20 p-2">
                            <img
                              src={activeStay.guest.idPhotoUrl}
                              alt="ID Photo"
                              className="w-full max-h-44 object-contain"
                            />
                          </div>
                        </div>
                      )}

                      {/* Payments Summary */}
                      {activeStay.payments && activeStay.payments.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-3 flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" /> Payments
                          </p>
                          <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                            {activeStay.payments.map((p) => (
                              <div key={p.id} className="flex justify-between text-xs">
                                <span className="text-muted-foreground">{p.description}</span>
                                <span className="font-medium">${p.amount}</span>
                              </div>
                            ))}
                            <Separator className="my-1" />
                            <div className="flex justify-between text-xs font-semibold">
                              <span>Total</span>
                              <span>${activeStay.payments.reduce((sum, p) => sum + p.amount, 0)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <Separator className="my-2" />

                      {/* View Details Button */}
                      <Button
                        className="w-full h-11 text-sm"
                        onClick={() => router.push(`/stay/${activeStay.id}`)}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        View Full Details
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  ) : selectedRoom.status === 'occupied' ? (
                    /* Occupied but no active stay found */
                    <div className="mt-8 space-y-5">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Type</p>
                          <p className="text-sm font-medium">
                            {selectedRoom.type === '1-bed' ? '1-Bed King' : '2-Bed Queen'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Rate</p>
                          <p className="text-sm font-medium">${selectedRoom.rate}/night</p>
                        </div>
                      </div>
                      <Separator />
                      <div className="text-center py-6 text-muted-foreground">
                        <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-medium">No active guest</p>
                        <p className="text-xs">This room is marked occupied but has no linked stay.</p>
                      </div>
                    </div>
                  ) : null}

                  {/* ── COMMON: Status Change + Edit + Delete (for ALL room states) ── */}
                  {!(selectedRoom.status === 'occupied' && activeStay) && (
                    <div className="mt-6 space-y-5">
                      {/* Room info for non-occupied with guest detail */}
                      {selectedRoom.status !== 'occupied' && (
                        <>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Type</p>
                              <p className="text-sm font-medium flex items-center gap-1.5">
                                {selectedRoom.type === '1-bed' ? <BedSingle className="w-4 h-4" /> : <BedDouble className="w-4 h-4" />}
                                {selectedRoom.type === '1-bed' ? '1-Bed King' : '2-Bed Queen'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Rate</p>
                              <p className="text-sm font-medium">${selectedRoom.rate}/night</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1.5">Status</p>
                              <Badge
                                variant={selectedRoom.status === 'available' ? 'secondary' : 'outline'}
                                className="capitalize text-[10px]"
                              >
                                {selectedRoom.status}
                              </Badge>
                            </div>
                          </div>
                          <Separator />
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Status Change + Actions (always visible) ── */}
                  <div className="space-y-5 mt-6">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-3">Change Status</p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map((s) => (
                          <Button
                            key={s.value}
                            variant={selectedRoom.status === s.value ? 'default' : 'outline'}
                            size="sm"
                            className="text-xs gap-1.5"
                            onClick={() => {
                              updateRoomStatus(selectedRoom.id, s.value);
                              setSelectedRoom({ ...selectedRoom, status: s.value });
                            }}
                          >
                            <span className={`w-2 h-2 rounded-full ${s.color} shrink-0`} />
                            {s.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1 h-10 text-xs"
                        onClick={startEditing}
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit Room
                      </Button>
                      <Button
                        variant="destructive"
                        className="flex-1 h-10 text-xs"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={selectedRoom.status === 'occupied'}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Room
                      </Button>
                    </div>
                    {selectedRoom.status === 'occupied' && (
                      <p className="text-[10px] text-muted-foreground text-center">
                        Cannot delete an occupied room. Check out the guest first.
                      </p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Settings Modal ── */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Motel Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">1-Bed Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.oneBedRate}
                  onChange={(e) => setSettings({ ...settings, oneBedRate: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">2-Bed Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.twoBedRate}
                  onChange={(e) => setSettings({ ...settings, twoBedRate: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs">VAT (10.75%)</Label>
                <p className="text-[11px] text-muted-foreground">Apply VAT to room charges</p>
              </div>
              <Button
                variant={settings.vatEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSettings({ ...settings, vatEnabled: !settings.vatEnabled })}
              >
                {settings.vatEnabled ? 'On' : 'Off'}
              </Button>
            </div>

            {settings.vatEnabled && (
              <div className="space-y-2 ml-4">
                <Label className="text-xs">VAT Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.vatRate}
                  onChange={(e) => setSettings({ ...settings, vatRate: Number(e.target.value) || 0 })}
                />
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs">Weekly Discount ($200)</Label>
                <p className="text-[11px] text-muted-foreground">Apply discount for stays of 7+ nights</p>
              </div>
              <Button
                variant={settings.weeklyDiscountEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSettings({ ...settings, weeklyDiscountEnabled: !settings.weeklyDiscountEnabled })}
              >
                {settings.weeklyDiscountEnabled ? 'On' : 'Off'}
              </Button>
            </div>

            {settings.weeklyDiscountEnabled && (
              <div className="space-y-2 ml-4">
                <Label className="text-xs">Discount Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.weeklyDiscountAmount}
                  onChange={(e) => setSettings({ ...settings, weeklyDiscountAmount: Number(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={() => { updateMotelSettings(settings); setShowSettings(false); toast.success('Settings saved'); }}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
