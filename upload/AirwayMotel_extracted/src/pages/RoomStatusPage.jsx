import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Settings } from 'lucide-react';
import RoomCard from '../components/rooms/RoomCard';
import RoomDrawer from '../components/rooms/RoomDrawer';
import RoomManagementModal from '../components/rooms/RoomManagementModal';
import { supabase } from '../lib/supabase';
const ROOM_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  RESERVED: 'reserved',
  CLEANING: 'cleaning',
};

export default function RoomStatusPage() {
  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('rooms')
      .select('*, stays(*, guests(*))')
      .order('floor', { ascending: true })
      .order('room_number', { ascending: true });
    
    if (error) {
      console.error("Error fetching rooms:", error);
    } else {
      setRooms(data || []);
    }
    setIsLoading(false);
  };

  const getFilteredRooms = () => {
    return rooms.filter(room => {
      // Status filter
      if (filter !== 'All') {
        const matchesAvailable = filter === 'Available' && room.status === ROOM_STATUS.AVAILABLE;
        const matchesOccupied = filter === 'Occupied' && room.status === ROOM_STATUS.OCCUPIED;
        const matchesNeedsAttention = filter === 'Needs Attention' && (room.status === ROOM_STATUS.CLEANING || room.status === ROOM_STATUS.MAINTENANCE);
        if (!matchesAvailable && !matchesOccupied && !matchesNeedsAttention) return false;
      }
      
      // Search filter
      if (searchQuery) {
        if (!room.room_number.includes(searchQuery)) return false;
      }
      
      return true;
    });
  };

  const filteredRooms = getFilteredRooms();
  
  // Group by floor
  const floors = [...new Set(filteredRooms.map(r => r.floor))].sort();

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="p-container-padding flex-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h2 className="text-display-lg font-bold text-primary">Room Status Board</h2>
          <p className="text-on-surface-variant text-body-md mt-1">Real-time overview of all property units.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input 
              type="text" 
              placeholder="Room #"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-surface-container-low border-none rounded-lg focus:ring-2 focus:ring-secondary/20 transition-all font-body-sm w-32"
            />
          </div>
          
          <div className="flex bg-surface-container-low rounded-lg p-1">
            {['All', 'Available', 'Occupied', 'Needs Attention'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-md font-title-sm text-sm transition-all cursor-pointer ${
                  filter === f 
                    ? 'bg-surface-container-lowest text-primary shadow-sm' 
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchRooms}
            className="p-2 border border-outline text-on-surface-variant rounded-lg hover:bg-surface-container transition-all cursor-pointer"
            title="Refresh"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsManageModalOpen(true)}
            className="px-4 py-2 bg-surface-container-low border border-outline text-on-surface-variant text-sm font-bold rounded-lg hover:text-primary hover:border-primary transition-all cursor-pointer flex items-center gap-2"
          >
            <Settings className="w-4 h-4" /> Manage Inventory
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-on-surface-variant">
          Loading rooms...
        </div>
      ) : (
        <div className="space-y-10 pb-10">
          {filteredRooms.length === 0 ? (
            <div className="text-center py-20 text-on-surface-variant bg-surface-container-lowest rounded-xl border border-outline-variant border-dashed">
              No rooms match your current filters.
            </div>
          ) : (
            <div>
              <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-4 uppercase tracking-widest border-b border-outline-variant pb-2">
                All Rooms
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                {filteredRooms.map(room => (
                  <RoomCard 
                    key={room.id} 
                    room={room} 
                    onClick={() => setSelectedRoomId(room.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedRoomId && (
        <RoomDrawer 
          room={selectedRoom} 
          isOpen={!!selectedRoomId} 
          onClose={() => setSelectedRoomId(null)} 
        />
      )}

      <RoomManagementModal 
        isOpen={isManageModalOpen} 
        onClose={() => setIsManageModalOpen(false)} 
        rooms={rooms}
        fetchRooms={fetchRooms}
      />
    </div>
  );
}
