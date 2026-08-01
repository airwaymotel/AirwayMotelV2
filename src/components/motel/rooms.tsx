'use client';

import { useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useMotelStore } from '@/lib/store';
import RoomCard from './room-card';
import type { Room } from '@/lib/types';

const FILTERS = ['All', 'Available', 'Occupied', 'Needs Attention'] as const;

export default function Rooms() {
  const rooms = useMotelStore((s) => s.rooms);
  const stays = useMotelStore((s) => s.stays);
  const guests = useMotelStore((s) => s.guests);
  const updateRoomStatus = useMotelStore((s) => s.updateRoomStatus);

  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const filteredRooms = rooms.filter((room) => {
    // Status filter
    if (filter !== 'All') {
      if (filter === 'Available' && room.status !== 'available') return false;
      if (filter === 'Occupied' && room.status !== 'occupied') return false;
      if (filter === 'Needs Attention' && room.status !== 'cleaning' && room.status !== 'maintenance') return false;
    }
    // Search
    if (searchQuery && !room.roomNumber.includes(searchQuery)) return false;
    return true;
  });

  const getActiveStayForRoom = (roomId: string) => {
    const stay = stays.find((s) => s.roomId === roomId && s.status === 'active');
    if (!stay) return undefined;
    const guest = guests.find((g) => g.id === stay.guestId);
    if (!guest) return undefined;
    return { ...stay, guest };
  };

  const statusColors: Record<Room['status'], string> = {
    available: 'bg-green-500',
    occupied: 'bg-red-500',
    maintenance: 'bg-amber-500',
    cleaning: 'bg-blue-500',
    reserved: 'bg-purple-500',
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

      {/* Room Detail Sheet */}
      <Sheet open={!!selectedRoom} onOpenChange={(open) => !open && setSelectedRoom(null)}>
        <SheetContent>
          {selectedRoom && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full ${statusColors[selectedRoom.status]}`} />
                  Room {selectedRoom.roomNumber}
                </SheetTitle>
              </SheetHeader>
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

                {(() => {
                  const activeStay = getActiveStayForRoom(selectedRoom.id);
                  if (activeStay) {
                    return (
                      <>
                        <Separator />
                        <div>
                          <p className="text-xs text-muted-foreground uppercase mb-2">Current Guest</p>
                          <p className="text-sm font-medium">
                            {activeStay.guest.firstName} {activeStay.guest.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{activeStay.guest.phone}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground uppercase">Check-in</p>
                            <p className="text-sm font-medium">{activeStay.checkInDate}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground uppercase">Check-out</p>
                            <p className="text-sm font-medium">{activeStay.checkOutDate}</p>
                          </div>
                        </div>
                      </>
                    );
                  }
                  return null;
                })()}

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
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
