import React from 'react';
import StatusBadge from '../ui/StatusBadge';

const STATUS_RULE_COLOR = {
  available: 'bg-moss',
  occupied: 'bg-clay',
  maintenance: 'bg-amber',
  cleaning: 'bg-amber',
  reserved: 'bg-on-surface-faint',
};

const STATUS_LABEL = {
  available: 'Free',
  occupied: 'Occupied',
  maintenance: 'Maintenance',
  cleaning: 'Cleaning',
  reserved: 'Reserved',
};

export default function RoomCard({ room, onClick }) {
  const status = room?.status || 'available';
  const ruleColor = STATUS_RULE_COLOR[status] || 'bg-on-surface-faint';
  const label = STATUS_LABEL[status] || status;

  const activeStay = room?.stays?.find((s) => s.status === 'active');
  const guestName = activeStay?.guests
    ? `${activeStay.guests.first_name} ${activeStay.guests.last_name}`
    : status === 'available'
      ? 'Ready for check-in'
      : 'No guest on file';

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-surface border border-rule rounded-md p-4 flex flex-col relative overflow-hidden transition-all hover:border-gold/50 hover:bg-surface-raised cursor-pointer w-full"
    >
      {/* Thin left signal rule */}
      <span className={`absolute left-0 top-0 bottom-0 w-[2px] ${ruleColor}`} />

      <div className="flex items-start justify-between pl-2 mb-6">
        <span className="font-display text-display-sm text-on-surface leading-none">
          {room?.room_number || '—'}
        </span>
        <StatusBadge status={status}>{label}</StatusBadge>
      </div>

      <div className="pl-2 mt-auto">
        <p className="text-eyebrow text-on-surface-faint capitalize">{room?.type || 'standard'}</p>
        <p
          className={`text-body-sm mt-1 truncate ${
            status === 'available'
              ? 'text-on-surface-faint italic'
              : 'text-on-surface font-medium'
          }`}
        >
          {guestName}
        </p>
      </div>
    </button>
  );
}
