import React, { useState } from 'react';
import { X, Trash2, Plus, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'sonner';

export default function RoomManagementModal({ isOpen, onClose, rooms, fetchRooms }) {
  const [newRoomNum, setNewRoomNum] = useState('');
  const [newRoomType, setNewRoomType] = useState('1-bed');
  const [newRoomFloor, setNewRoomFloor] = useState('1');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!newRoomNum) return;

    try {
      setIsAdding(true);
      const { error } = await supabase.from('rooms').insert([{
        room_number: newRoomNum,
        type: newRoomType,
        floor: parseInt(newRoomFloor, 10),
        status: 'available'
      }]);

      if (error) throw error;
      toast.success(`Room ${newRoomNum} added successfully.`);
      setNewRoomNum('');
      fetchRooms();
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Failed to add room.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (room) => {
    // Check if occupied
    if (room.status === 'occupied') {
      toast.error('Cannot delete an occupied room. Check out the guest first.');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to completely delete Room ${room.room_number}?`)) return;

    try {
      const { error } = await supabase.from('rooms').delete().eq('id', room.id);
      if (error) throw error;
      toast.success(`Room ${room.room_number} deleted.`);
      fetchRooms();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete room. It might have active dependencies.');
    }
  };

  const handleStatusChange = async (room, newStatus) => {
    if (room.status === 'occupied' && newStatus !== 'occupied') {
      toast.error('You cannot override an occupied room status. Check out the guest first.');
      return;
    }
    if (newStatus === 'occupied') {
      toast.error('You cannot manually set a room to occupied. Please use Check-In.');
      return;
    }

    try {
      const { error } = await supabase.from('rooms').update({ status: newStatus }).eq('id', room.id);
      if (error) throw error;
      toast.success(`Room ${room.room_number} status updated to ${newStatus}.`);
      fetchRooms();
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-surface-container-lowest w-full max-w-3xl rounded-2xl shadow-2xl z-10 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-outline-variant">
          <div>
            <h2 className="text-headline-sm font-bold text-primary">Manage Room Inventory</h2>
            <p className="text-body-sm text-on-surface-variant">Add, delete, or override the status of physical rooms.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Add Room Form */}
        <div className="p-6 bg-surface-container-low border-b border-outline-variant">
          <form onSubmit={handleAddRoom} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-label-sm font-bold text-on-surface-variant mb-1">Room Number</label>
              <input required value={newRoomNum} onChange={e => setNewRoomNum(e.target.value)} type="text" className="w-full bg-surface-container-lowest border border-outline rounded-lg px-4 py-2" placeholder="e.g. 105" />
            </div>
            <div className="flex-1">
              <label className="block text-label-sm font-bold text-on-surface-variant mb-1">Type</label>
              <select value={newRoomType} onChange={e => setNewRoomType(e.target.value)} className="w-full bg-surface-container-lowest border border-outline rounded-lg px-4 py-2">
                <option value="1-bed">1-Bed Premium</option>
                <option value="2-bed">2-Bed Premium</option>
              </select>
            </div>
            <button disabled={isAdding} type="submit" className="bg-primary text-on-primary px-6 py-2.5 rounded-lg font-bold hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 h-[42px] shrink-0 cursor-pointer disabled:opacity-50">
              <Plus className="w-4 h-4" /> Add Room
            </button>
          </form>
        </div>

        {/* Room List */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low border-b border-outline-variant">
                <tr>
                  <th className="px-6 py-3 text-label-caps font-bold text-on-surface-variant">Room</th>
                  <th className="px-6 py-3 text-label-caps font-bold text-on-surface-variant">Type</th>
                  <th className="px-6 py-3 text-label-caps font-bold text-on-surface-variant">Status</th>
                  <th className="px-6 py-3 text-right text-label-caps font-bold text-on-surface-variant">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {rooms.map(room => (
                  <tr key={room.id} className="hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-primary">{room.room_number}</td>
                    <td className="px-6 py-4 text-on-surface capitalize">{room.type}</td>
                    <td className="px-6 py-4">
                      {room.status === 'occupied' ? (
                        <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full uppercase tracking-widest">
                          Occupied
                        </span>
                      ) : (
                        <select 
                          value={room.status}
                          onChange={(e) => handleStatusChange(room, e.target.value)}
                          className="bg-surface-container border border-outline rounded-lg px-2 py-1 text-sm font-bold uppercase tracking-wider cursor-pointer focus:ring-2 focus:ring-secondary/50 outline-none"
                        >
                          <option value="available">Available</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="cleaning">Cleaning</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDelete(room)}
                        disabled={room.status === 'occupied'}
                        className="p-2 text-error hover:bg-error/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer inline-flex"
                        title={room.status === 'occupied' ? "Cannot delete occupied room" : "Delete Room"}
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rooms.length === 0 && (
              <div className="p-12 text-center text-on-surface-variant">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-bold">No rooms found in inventory.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
