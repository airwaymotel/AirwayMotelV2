'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Printer, Users, Clock, Repeat, Search, User, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useMotelStore } from '@/lib/store';

export default function Guests() {
   const router = useRouter();
   const guests = useMotelStore((s) => s.guests);
  const stays = useMotelStore((s) => s.stays);
  const rooms = useMotelStore((s) => s.rooms);
  const payments = useMotelStore((s) => s.payments);

  const [searchQuery, setSearchQuery] = useState('');
  const [roomTypeFilter, setRoomTypeFilter] = useState('All Types');

  // Build history data
  const historyData = useMemo(() => {
    return stays.map((stay) => {
      const guest = guests.find((g) => g.id === stay.guestId);
      const room = rooms.find((r) => r.id === stay.roomId);
      const stayPayments = payments.filter((p) => p.stayId === stay.id);
      const totalPaid = stayPayments.reduce((sum, p) => sum + p.amount, 0);

      const start = new Date(stay.checkInDate);
      const end = new Date(stay.checkOutDate);
      const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        id: guest?.idNumber || stay.guestId.substring(0, 8),
        guestId: guest?.id || stay.guestId,
        name: guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown',
        phone: guest?.phone || '',
        room: room?.roomNumber || '---',
        dates: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        details: `${nights} Night${nights > 1 ? 's' : ''} • ${room?.type === '1-bed' ? '1-Bed King' : room?.type === '2-bed' ? '2-Bed Queen' : 'Standard'}`,
        roomType: room?.type || '',
        status: stay.status === 'checked_out' ? 'Completed' : stay.status === 'active' ? 'Active' : 'Cancelled',
        paid: `$${totalPaid.toFixed(2)}`,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        stayId: stay.id,
        hasCash: stayPayments.some(p => p.method === 'cash'),
      };
    }).sort((a, b) => b.checkInDate.localeCompare(a.checkInDate));
  }, [stays, guests, rooms, payments]);

  const filteredData = useMemo(() => {
    return historyData.filter((guest) => {
      const matchesSearch =
        guest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guest.phone.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRoom = roomTypeFilter === 'All Types' || guest.roomType === roomTypeFilter;
      return matchesSearch && matchesRoom;
    });
  }, [historyData, searchQuery, roomTypeFilter]);

  // Stats
  const uniqueGuests = new Set(stays.map((s) => s.guestId)).size;
  const avgStay = historyData.length > 0
    ? (historyData.reduce((sum, h) => {
        const nights = parseInt(h.details) || 1;
        return sum + nights;
      }, 0) / historyData.length).toFixed(1)
    : '0';
  const repeatRate = (() => {
    const guestCounts = new Map<string, number>();
    stays.forEach((s) => guestCounts.set(s.guestId, (guestCounts.get(s.guestId) || 0) + 1));
    const repeatGuests = [...guestCounts.values()].filter((c) => c > 1).length;
    return uniqueGuests > 0 ? ((repeatGuests / uniqueGuests) * 100).toFixed(1) : '0';
  })();

  const handleExportCSV = () => {
    const headers = ['Guest Name', 'ID', 'Room', 'Stay Period', 'Details', 'Room Type', 'Status', 'Total Paid'];
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => 
        `"${row.name}","${row.id}","${row.room}","${row.dates}","${row.details}","${row.roomType}","${row.status}","${row.paid}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `guest_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Guest History</h2>
          <p className="text-muted-foreground mt-1">Search and review past guest records.</p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-1" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Unique Guests</p>
              <p className="text-xl font-bold">{uniqueGuests}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg. Stay Duration</p>
              <p className="text-xl font-bold">{avgStay} Days</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <Repeat className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Repeat Guest Rate</p>
              <p className="text-xl font-bold">{repeatRate}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="no-print">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-5 relative">
              <label className="block text-[10px] text-muted-foreground uppercase font-semibold mb-1">Guest Search</label>
              <Search className="absolute left-2.5 top-[26px] text-muted-foreground w-4 h-4" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
                placeholder="Name, ID, or Phone..."
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-[10px] text-muted-foreground uppercase font-semibold mb-1">Room Type</label>
              <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Types">All Types</SelectItem>
                  <SelectItem value="1-bed">1-Bed King</SelectItem>
                  <SelectItem value="2-bed">2-Bed Queen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3 flex items-end">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setSearchQuery('');
                  setRoomTypeFilter('All Types');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <div id="print-area">
        <div className="mb-4 hidden print:block text-center">
          <h1 className="text-xl font-bold">Airway Motel - Guest History Report</h1>
          <p className="text-sm text-gray-500">Generated on {new Date().toLocaleDateString()}</p>
        </div>
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase text-[10px]">Guest Name</TableHead>
                  <TableHead className="uppercase text-[10px]">ID</TableHead>
                  <TableHead className="uppercase text-[10px]">Phone</TableHead>
                  <TableHead className="uppercase text-[10px]">Room #</TableHead>
                  <TableHead className="uppercase text-[10px]">Stay Period</TableHead>
                  <TableHead className="uppercase text-[10px] text-center">Status</TableHead>
                  <TableHead className="uppercase text-[10px] text-right">Total Paid</TableHead>
                  <TableHead className="uppercase text-[10px] text-right no-print">Actions</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {row.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{row.name}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono">{row.id}</TableCell>
                    <TableCell className="text-sm">{row.phone || '—'}</TableCell>
                    <TableCell className="text-sm font-medium">#{row.room}</TableCell>
                    <TableCell>
                      <p className="text-sm">{row.dates}</p>
                      <p className="text-[11px] text-muted-foreground">{row.details}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={row.status === 'Completed' ? 'secondary' : row.status === 'Active' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">{row.paid}</TableCell>
                    <TableCell className="text-right no-print">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View Guest Details" onClick={() => router.push(`/guest/${row.guestId}`)}>
                          <User className="w-4 h-4" />
                        </Button>
                        {row.hasCash && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-500/10" 
                            title="Download Cash Receipt"
                            onClick={() => window.open(`/stay/${row.stayId}/invoice?download=true`, '_blank')}
                          >
                            <Receipt className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No records found matching your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
          <div className="p-3 bg-muted/30 border-t border-border flex items-center justify-between no-print">
            <p className="text-xs text-muted-foreground">
              Showing {filteredData.length} record{filteredData.length === 1 ? '' : 's'}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
