'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, RotateCcw, User, Phone, Mail, Calendar,
  CreditCard, Shield, FileText, ArrowRight, BedSingle, BedDouble,
  ImageIcon, PenLine,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useMotelStore } from '@/lib/store';
import RoomCard from './room-card';
import type { Room } from '@/lib/types';

const FILTERS = ['All', 'Available', 'Occupied', 'Needs Attention'] as const;

export default function Rooms() {
  const router = useRouter();
  const rooms = useMotelStore((s) => s.rooms);
  const stays = useMotelStore((s) => s.stays);
  const guests = useMotelStore((s) => s.guests);
  const payments = useMotelStore((s) => s.payments);
  const updateRoomStatus = useMotelStore((s) => s.updateRoomStatus);

  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

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

  // Currently selected room's active stay (with guest + payments)
  const activeStay = selectedRoom ? getActiveStayForRoom(selectedRoom.id) : undefined;

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

          <Button variant="outline" size="icon" className="h-9 w-9">
            <RotateCcw className="w-4 h-4" />
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
            {(['available', 'occupied', 'maintenance', 'cleaning', 'reserved'] as const).map((status) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${statusColors[status]}`} />
                <span className="capitalize">{status}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {filteredRooms.map((room) => (
              <RoomCard
                key={room.id}
                room={room}
                activeStay={getActiveStayForRoom(room.id)}
                onClick={() => setSelectedRoom(room)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Room Detail Sheet ── */}
      <Sheet open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedRoom && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${statusColors[selectedRoom.status]}`} />
                  Room {selectedRoom.roomNumber}
                </SheetTitle>
              </SheetHeader>

              {/* ── OCCUPIED ROOM: Rich guest detail ── */}
              {selectedRoom.status === 'occupied' && activeStay ? (
                <div className="mt-6 space-y-5">
                  {/* Room basics */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Type</p>
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        {selectedRoom.type === '1-bed' ? <BedSingle className="w-4 h-4" /> : <BedDouble className="w-4 h-4" />}
                        {selectedRoom.type === '1-bed' ? '1-Bed King' : '2-Bed Queen'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Rate</p>
                      <p className="text-sm font-medium">${selectedRoom.rate}/night</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Guest Profile */}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-3 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Current Guest
                    </p>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                          {activeStay.guest.firstName[0]}{activeStay.guest.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold">
                          {activeStay.guest.firstName} {activeStay.guest.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {activeStay.guest.phone}
                        </p>
                        {activeStay.guest.email && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {activeStay.guest.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Check-in / Check-out */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Check-in
                      </p>
                      <p className="text-sm font-medium">{activeStay.checkInDate}</p>
                      <p className="text-xs text-muted-foreground">{activeStay.checkInTime}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Check-out
                      </p>
                      <p className="text-sm font-medium">{activeStay.checkOutDate}</p>
                      <p className="text-xs text-muted-foreground">{activeStay.checkOutTime}</p>
                    </div>
                  </div>

                  {/* Identification Details */}
                  {(activeStay.guest.idNumber || activeStay.guest.dateOfBirth) && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> Identification
                      </p>
                      <div className="bg-muted/40 rounded-lg p-3 space-y-2">
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
                      <p className="text-xs text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" /> ID Photo on File
                      </p>
                      <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                        <img
                          src={activeStay.guest.idPhotoUrl}
                          alt="ID Photo"
                          className="w-full max-h-40 object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Payments Summary */}
                  {activeStay.payments && activeStay.payments.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase mb-2 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" /> Payments
                      </p>
                      <div className="bg-muted/40 rounded-lg p-3 space-y-2">
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

                  <Separator />

                  {/* View Details Button */}
                  <Button
                    className="w-full"
                    onClick={() => router.push(`/stay/${activeStay.id}`)}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    View Full Details
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : selectedRoom.status === 'occupied' ? (
                /* Occupied but no active stay found */
                <div className="mt-6 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Type</p>
                      <p className="text-sm font-medium">
                        {selectedRoom.type === '1-bed' ? '1-Bed King' : '2-Bed Queen'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Rate</p>
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
              ) : (
                /* ── NON-OCCUPIED ROOM: Simple info + status change ── */
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Floor</p>
                      <p className="text-sm font-medium">{selectedRoom.floor}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Type</p>
                      <p className="text-sm font-medium">
                        {selectedRoom.type === '1-bed' ? '1-Bed King' : '2-Bed Queen'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Rate</p>
                      <p className="text-sm font-medium">${selectedRoom.rate}/night</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Status</p>
                      <Badge
                        variant={
                          selectedRoom.status === 'available' ? 'secondary' :
                          selectedRoom.status === 'occupied' ? 'destructive' : 'outline'
                        }
                        className="capitalize text-xs"
                      >
                        {selectedRoom.status}
                      </Badge>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-2">Change Status</p>
                    <div className="flex flex-wrap gap-2">
                      {(['available', 'occupied', 'maintenance', 'cleaning', 'reserved'] as const).map((status) => (
                        <Button
                          key={status}
                          variant={selectedRoom.status === status ? 'default' : 'outline'}
                          size="sm"
                          className="capitalize text-xs"
                          onClick={() => {
                            updateRoomStatus(selectedRoom.id, status);
                            setSelectedRoom({ ...selectedRoom, status });
                          }}
                        >
                          {status}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
