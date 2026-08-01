'use client';

import { Badge } from '@/components/ui/badge';
import type { Room, Stay, Guest } from '@/lib/types';

interface RoomCardProps {
  room: Room;
  activeStay?: (Stay & { guest: Guest }) | undefined;
  onClick: () => void;
}

const STATUS_CONFIG: Record<Room['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; ruleColor: string }> = {
  available: { label: 'Free', variant: 'secondary', ruleColor: 'bg-green-500' },
  occupied: { label: 'Occupied', variant: 'destructive', ruleColor: 'bg-red-500' },
  maintenance: { label: 'Maintenance', variant: 'outline', ruleColor: 'bg-amber-500' },
  cleaning: { label: 'Cleaning', variant: 'outline', ruleColor: 'bg-blue-500' },
  reserved: { label: 'Reserved', variant: 'default', ruleColor: 'bg-purple-500' },
};

export default function RoomCard({ room, activeStay, onClick }: RoomCardProps) {
  const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;

  const guestName = activeStay
    ? `${activeStay.guest.firstName} ${activeStay.guest.lastName}`
    : room.status === 'available'
      ? 'Ready for check-in'
      : 'No guest on file';

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-card border border-border rounded-lg p-4 flex flex-col relative overflow-hidden transition-all hover:border-primary/40 hover:shadow-md cursor-pointer w-full"
    >
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${config.ruleColor}`} />

      <div className="flex items-start justify-between pl-2 mb-4">
        <span className="text-xl font-bold text-foreground leading-none">
          {room.roomNumber}
        </span>
        <Badge variant={config.variant} className="text-[10px] uppercase font-semibold">
          {config.label}
        </Badge>
      </div>

      <div className="pl-2 mt-auto">
        <p className="text-xs text-muted-foreground capitalize">{room.type === '1-bed' ? '1-Bed King' : '2-Bed Queen'}</p>
        <p
          className={`text-sm mt-1 truncate ${
            room.status === 'available'
              ? 'text-muted-foreground italic'
              : 'text-foreground font-medium'
          }`}
        >
          {guestName}
        </p>
        <p className="text-xs text-muted-foreground mt-1">${room.rate}/night</p>
      </div>
    </button>
  );
}
