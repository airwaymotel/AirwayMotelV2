import React from 'react';
import { X, Edit2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RoomDrawer({ isOpen, onClose, room }) {
  const navigate = useNavigate();

  if (!isOpen || !room) return null;

  const activeStay = room?.stays?.find(s => s.status === 'active');
  const guest = activeStay?.guests;
  
  const guestInitials = guest ? `${guest.first_name?.[0] || ''}${guest.last_name?.[0] || ''}`.toUpperCase() : '-';

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity opacity-100 cursor-pointer" 
        onClick={onClose}
      ></div>
      
      <div className="absolute right-0 top-0 h-full w-96 bg-surface-container-lowest shadow-2xl transform translate-x-0 transition-transform duration-300 ease-out flex flex-col">
        <div className="p-container-padding flex justify-between items-center border-b border-outline-variant">
          <h3 className="text-headline-md font-bold text-primary">Room {room.room_number}</h3>
          <button className="p-2 hover:bg-surface-container rounded-full transition-colors cursor-pointer" onClick={onClose}>
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-grow overflow-y-auto p-container-padding space-y-8">
          <div>
            <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-widest ${
              room.status === 'available' ? 'bg-green-100 text-green-800' :
              room.status === 'occupied' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {room.status}
            </span>
            <p className="mt-4 text-body-md text-on-surface-variant capitalize">{room.type} Premium</p>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-label-caps text-on-surface-variant uppercase font-bold">Current Guest</h4>
            <div className="flex items-center gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant">
              <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container font-bold text-xl shrink-0">
                {guestInitials}
              </div>
              <div>
                <p className="text-title-sm font-bold text-primary">
                  {guest ? `${guest.first_name} ${guest.last_name}` : 'No Guest'}
                </p>
                {guest && <p className="text-body-sm text-on-surface-variant truncate">{guest.phone}</p>}
                {guest?.email && <p className="text-body-sm text-on-surface-variant truncate">{guest.email}</p>}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-surface-container-low rounded-xl">
              <p className="text-label-caps text-on-surface-variant uppercase font-bold mb-1">Check-in</p>
              <p className="text-title-sm font-bold">{activeStay ? activeStay.check_in_date : '-'}</p>
            </div>
            <div className="p-4 bg-surface-container-low rounded-xl">
              <p className="text-label-caps text-on-surface-variant uppercase font-bold mb-1">Check-out</p>
              <p className="text-title-sm font-bold">{activeStay ? activeStay.check_out_date : '-'}</p>
            </div>
          </div>

          {guest?.id_number && (
            <div className="space-y-3">
              <h4 className="text-label-caps text-on-surface-variant uppercase font-bold">Identification Details</h4>
              <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl text-body-sm">
                <p><strong>ID Number:</strong> {guest.id_number}</p>
                <p><strong>DOB:</strong> {guest.date_of_birth}</p>
              </div>
            </div>
          )}
          
          <div className="space-y-3">
            <h4 className="text-label-caps text-on-surface-variant uppercase font-bold">Active Notes</h4>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-body-sm text-yellow-800">{activeStay?.notes || "No active notes for this stay."}</p>
            </div>
          </div>
        </div>
        
        <div className="p-container-padding border-t border-outline-variant flex gap-3">
          <button 
            disabled={!activeStay}
            onClick={() => activeStay && navigate(`/stay/${activeStay.id}`)}
            className="flex-grow bg-primary text-on-primary py-3 rounded-lg text-title-sm font-bold hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
}
