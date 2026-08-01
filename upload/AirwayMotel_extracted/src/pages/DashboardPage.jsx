import React, { useState, useEffect } from 'react';
import { DoorClosed, DoorOpen, LogOut, DollarSign } from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import { supabase } from '../lib/supabase';
import InitialsAvatar from '../components/ui/InitialsAvatar';

export default function DashboardPage() {
  const [stats, setStats] = useState({ occupied: 0, available: 0, checkoutsToday: 0, revenue: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingCheckouts, setUpcomingCheckouts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    // Fetch rooms for occupancy stats
    const { data: rooms } = await supabase.from('rooms').select('*');
    const occupied = rooms?.filter(r => r.status === 'occupied').length || 0;
    const available = rooms?.filter(r => r.status === 'available').length || 0;
    const total = rooms?.length || 1;
    const occPercent = Math.round((occupied / total) * 100);
    const availPercent = Math.round((available / total) * 100);

    // Fetch stays for checkouts and activity
    const today = new Date().toISOString().split('T')[0];
    
    const { data: stays } = await supabase
      .from('stays')
      .select('*, guests(*), rooms(*)')
      .order('created_at', { ascending: false });
      
    // Fetch payments to compute today's revenue
    const { data: payments } = await supabase
      .from('payments')
      .select('amount, paid_at');

    const todayRevenue = (payments || [])
      .filter(p => p.paid_at?.startsWith(today))
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Calculate Checkouts Today
    const checkoutsToday = stays?.filter(s => s.status === 'active' && s.check_out_date === today).length || 0;
    
    // Map upcoming checkouts
    const upcoming = stays?.filter(s => s.status === 'active' && s.check_out_date === today).map(s => ({
      id: s.id,
      name: `${s.guests?.first_name} ${s.guests?.last_name}`,
      room: s.rooms?.room_number,
      detail: 'Standard',
      time: s.check_out_time,
      isLate: false
    })) || [];
    
    // Map recent activity (just using all stays as check-ins for MVP)
    const recent = stays?.slice(0, 5).map(s => ({
      id: s.id,
      guest: `${s.guests?.first_name} ${s.guests?.last_name}`,
      action: s.status === 'active' ? 'Check-in' : 'Check-out',
      room: s.rooms?.room_number,
      time: new Date(s.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      status: s.status === 'active' ? 'Success' : 'Success'
    })) || [];

    setStats({
      occupied,
      available,
      occPercent,
      availPercent,
      checkoutsToday,
      revenue: todayRevenue
    });
    setUpcomingCheckouts(upcoming);
    setRecentActivity(recent);
    setIsLoading(false);
  };

  return (
    <div className="p-container-padding flex-1">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-display-lg font-bold text-primary">Operations Overview</h2>
          <p className="text-on-surface-variant text-body-md mt-2">Good morning, Admin. Here is what is happening at Airway Motel today.</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 mb-10">
        <StatCard 
          title="Rooms Occupied" 
          value={isLoading ? '-' : stats.occupied} 
          badgeText={isLoading ? '-' : `${stats.occPercent}% Full`} 
          badgeColor="green" 
          icon={DoorClosed} 
        />
        <StatCard 
          title="Rooms Free" 
          value={isLoading ? '-' : stats.available} 
          badgeText={isLoading ? '-' : `${stats.availPercent}% Avail`} 
          badgeColor="default" 
          icon={DoorOpen} 
        />
        <StatCard 
          title="Check-outs Today" 
          value={isLoading ? '-' : stats.checkoutsToday} 
          badgeText="Due 11AM" 
          badgeColor="red" 
          icon={LogOut} 
        />
        <StatCard 
          title="Today's Revenue" 
          value={isLoading ? '-' : `$${stats.revenue}`} 
          badgeText="+12% vs yest" 
          badgeColor="default" 
          icon={DollarSign} 
          isInverse={true}
        />
      </div>

      <div className="grid grid-cols-12 gap-6 mb-10">
        <div className="col-span-12 md:col-span-8 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant flex justify-between items-center">
            <h3 className="text-title-sm font-bold">Recent Activity</h3>
            <button className="text-secondary text-label-caps uppercase hover:underline font-bold cursor-pointer">View All Logs</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-container-low">
                <tr className="text-on-surface-variant text-label-caps uppercase">
                  <th className="px-6 py-3">Guest</th>
                  <th className="px-6 py-3">Action</th>
                  <th className="px-6 py-3">Room</th>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {recentActivity.length > 0 ? recentActivity.map((log) => (
                  <tr key={log.id} className="hover:bg-surface-container transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={log.guest} className="w-8 h-8 text-[12px]" />
                        <span className="font-bold text-primary">{log.guest}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{log.action}</td>
                    <td className="px-6 py-4">#{log.room}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{log.time}</td>
                    <td className="px-6 py-4 text-right">
                      {log.status === 'Success' ? (
                        <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold uppercase">Success</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-secondary-container/20 text-secondary text-xs font-bold uppercase">Pending Pay</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr><td colSpan="5" className="px-6 py-8 text-center text-on-surface-variant">No recent activity found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="col-span-12 md:col-span-4 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant flex flex-col">
          <div className="px-6 py-4 border-b border-outline-variant">
            <h3 className="text-title-sm font-bold">Upcoming Check-outs</h3>
          </div>
          <div className="p-6 space-y-4">
            {upcomingCheckouts.length > 0 ? upcomingCheckouts.map((guest) => (
              <div key={guest.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-surface-container transition-all cursor-pointer">
                <InitialsAvatar name={guest.name} className="w-10 h-10" />
                <div className="flex-1">
                  <p className="font-bold text-primary">{guest.name}</p>
                  <p className="text-xs text-on-surface-variant">Room {guest.room} • {guest.detail}</p>
                </div>
                <div className="text-right">
                  <p className={`text-xs text-label-caps uppercase ${guest.isLate ? 'text-error' : 'text-on-surface-variant'}`}>{guest.time}</p>
                </div>
              </div>
            )) : (
              <div className="text-center py-6 text-on-surface-variant">No check-outs scheduled for today.</div>
            )}
          </div>
          <div className="mt-auto p-6 pt-0">
            <button className="w-full py-2 border border-outline text-on-surface text-label-caps uppercase font-bold rounded hover:bg-surface-container transition-colors disabled:opacity-50 cursor-pointer" disabled={upcomingCheckouts.length === 0}>
              Prepare All Final Bills
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
