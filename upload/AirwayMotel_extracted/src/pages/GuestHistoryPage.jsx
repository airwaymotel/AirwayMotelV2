import React, { useState, useMemo, useEffect } from 'react';
import { Download, Printer, Users, Clock, Repeat, Search, User } from 'lucide-react';
import InitialsAvatar from '../components/ui/InitialsAvatar';
import { supabase } from '../lib/supabase';

export default function GuestHistoryPage() {
  const [historyData, setHistoryData] = useState([]);
  const [stats, setStats] = useState({ totalGuests: 0, avgStay: 0, repeatRate: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('All Types');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    // Fetch all stays
    const { data: stays } = await supabase
      .from('stays')
      .select('*, guests(*), rooms(*), payments(*)')
      .order('created_at', { ascending: false });
      
    if (stays) {
      const formattedData = stays.map(stay => {
        // Calculate nights
        const start = new Date(stay.check_in_date);
        const end = new Date(stay.check_out_date);
        const nights = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
        
        // Calculate total paid
        const totalPaid = stay.payments ? stay.payments.reduce((sum, p) => sum + Number(p.amount), 0) : 0;
        
        return {
          id: stay.guests?.id_number || stay.guests?.id?.substring(0, 8),
          name: `${stay.guests?.first_name} ${stay.guests?.last_name}`,
          room: stay.rooms?.room_number,
          dates: `${new Date(stay.check_in_date).toLocaleDateString('en-US', {month:'short', day:'numeric'})} - ${new Date(stay.check_out_date).toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'})}`,
          cinDate: stay.check_in_date,
          coutDate: stay.check_out_date,
          details: `${nights} Night${nights > 1 ? 's' : ''} • ${stay.rooms?.type}`,
          roomType: stay.rooms?.type,
          status: stay.status === 'checked_out' ? 'Completed' : (stay.status === 'active' ? 'Active' : 'Cancelled'),
          paid: `$${totalPaid.toFixed(2)}`
        };
      });
      setHistoryData(formattedData);

      // Calculate Stats from real stays
      const uniqueGuests = new Set(stays.map(s => s.guest_id)).size;
      const stayCountsByGuest = new Map();
      let totalNights = 0;
      let stayCount = 0;

      stays.forEach(s => {
        stayCountsByGuest.set(s.guest_id, (stayCountsByGuest.get(s.guest_id) || 0) + 1);
        if (s.check_in_date && s.check_out_date) {
          const nights = Math.max(1, Math.round((new Date(s.check_out_date) - new Date(s.check_in_date)) / 86400000));
          totalNights += nights;
          stayCount++;
        }
      });

      const repeatGuests = [...stayCountsByGuest.values()].filter(c => c > 1).length;
      const avgStay = stayCount > 0 ? (totalNights / stayCount) : 0;
      const repeatRate = uniqueGuests > 0 ? (repeatGuests / uniqueGuests) * 100 : 0;

      setStats({
        totalGuests: uniqueGuests,
        avgStay: avgStay.toFixed(1),
        repeatRate: repeatRate.toFixed(1)
      });
    }
    setIsLoading(false);
  };

  const filteredData = useMemo(() => {
    return historyData.filter(guest => {
      const matchesSearch = guest.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            guest.id?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRoom = roomTypeFilter === 'All Types' || guest.roomType === roomTypeFilter;
      
      let matchesDate = true;
      if (dateFrom && dateTo) {
        matchesDate = guest.cinDate >= dateFrom && guest.coutDate <= dateTo;
      } else if (dateFrom) {
        matchesDate = guest.cinDate >= dateFrom;
      } else if (dateTo) {
        matchesDate = guest.coutDate <= dateTo;
      }

      return matchesSearch && matchesRoom && matchesDate;
    });
  }, [historyData, searchQuery, dateFrom, dateTo, roomTypeFilter]);

  return (
    <div className="p-container-padding space-y-stack-lg flex-1">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display-lg text-display-lg text-primary">Guest History</h2>
          <p className="font-body-md text-on-surface-variant mt-1">Search and review past guest records from the unified vault.</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-outline text-on-surface-variant rounded-lg font-title-sm hover:bg-surface-container transition-all flex items-center gap-2 cursor-pointer">
            <Download className="w-5 h-5" />
            <span>Export CSV</span>
          </button>
          <button className="px-4 py-2 border border-outline text-on-surface-variant rounded-lg font-title-sm hover:bg-surface-container transition-all flex items-center gap-2 cursor-pointer">
            <Printer className="w-5 h-5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant flex items-center gap-4">
          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center text-secondary">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Total Unique Guests</p>
            <p className="font-headline-md text-headline-md text-primary">{isLoading ? '-' : stats.totalGuests}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant flex items-center gap-4">
          <div className="w-12 h-12 bg-tertiary-fixed rounded-full flex items-center justify-center text-on-tertiary-fixed-variant">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Avg. Stay Duration</p>
            <p className="font-headline-md text-headline-md text-primary">{isLoading ? '-' : `${stats.avgStay} Days`}</p>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant flex items-center gap-4">
          <div className="w-12 h-12 bg-on-primary-fixed rounded-full flex items-center justify-center text-surface">
            <Repeat className="w-6 h-6" />
          </div>
          <div>
            <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Repeat Guest Rate</p>
            <p className="font-headline-md text-headline-md text-primary">{isLoading ? '-' : `${stats.repeatRate}%`}</p>
          </div>
        </div>
      </div>

      {/* Robust Filter & Search Bar */}
      <div className="bg-surface-container-lowest p-stack-md rounded-xl shadow-sm border border-outline-variant">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Text Search */}
          <div className="md:col-span-4 relative group">
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1 ml-1 group-focus-within:text-secondary transition-colors">GUEST SEARCH</label>
            <Search className="absolute left-3 top-[34px] text-on-surface-variant w-5 h-5" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary transition-all font-body-sm" 
              placeholder="Name, ID, or Phone..." 
              type="text" 
            />
          </div>
          {/* Date Range */}
          <div className="md:col-span-4 flex gap-2">
            <div className="flex-1 group">
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1 ml-1 group-focus-within:text-secondary transition-colors">FROM</label>
              <input 
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary font-body-sm transition-all" 
                type="date" 
              />
            </div>
            <div className="flex-1 group">
              <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1 ml-1 group-focus-within:text-secondary transition-colors">TO</label>
              <input 
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary font-body-sm transition-all" 
                type="date" 
              />
            </div>
          </div>
          {/* Room Type */}
          <div className="md:col-span-2 group">
            <label className="block font-label-caps text-label-caps text-on-surface-variant mb-1 ml-1 group-focus-within:text-secondary transition-colors">ROOM TYPE</label>
            <select 
              value={roomTypeFilter}
              onChange={(e) => setRoomTypeFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-secondary font-body-sm transition-all"
            >
              <option>All Types</option>
              <option>1-Bed King</option>
              <option>2-Bed Queen</option>
              <option>Suite</option>
            </select>
          </div>
          {/* Apply Button */}
          <div className="md:col-span-2 flex items-end">
            <button 
              onClick={() => {
                setSearchQuery('');
                setDateFrom('');
                setDateTo('');
                setRoomTypeFilter('All Types');
              }}
              className="w-full py-2.5 bg-surface-container-high text-on-surface font-title-sm rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Historical Data Table */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Guest Name</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Room #</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Stay Period</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Status</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Total Paid</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {filteredData.length > 0 ? (
                filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-surface-container transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <InitialsAvatar name={row.name} className="w-10 h-10 text-[16px]" />
                        <div>
                          <p className="font-title-sm text-primary">{row.name}</p>
                          <p className="text-[12px] text-on-surface-variant">ID: {row.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-body-md text-primary">#{row.room}</td>
                    <td className="p-4">
                      <p className="font-body-sm text-primary">{row.dates}</p>
                      <p className="text-[12px] text-on-surface-variant">{row.details}</p>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="p-4 text-right font-title-sm text-primary">{row.paid}</td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button className="p-2 text-on-surface-variant hover:text-secondary hover:bg-secondary/10 rounded-lg transition-all cursor-pointer" title="View Profile">
                          <User className="w-5 h-5" />
                        </button>
                        <button 
                          className={`p-2 rounded-lg transition-all cursor-pointer ${row.status === 'Cancelled' ? 'text-outline-variant cursor-not-allowed' : 'text-on-surface-variant hover:text-secondary hover:bg-secondary/10'}`} 
                          disabled={row.status === 'Cancelled'}
                          title="Re-download Receipt"
                        >
                          <Download className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-on-surface-variant">
                    No records found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Record count footer */}
        <div className="p-4 bg-surface-container border-t border-outline-variant flex items-center justify-between">
          <p className="font-body-sm text-on-surface-variant">
            Showing {filteredData.length} record{filteredData.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>
    </div>
  );
}
