'use client';

import { DoorClosed, DoorOpen, LogOut, DollarSign } from 'lucide-react';
import StatCard from './stat-card';
import { useMotelStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import AnimateOnScroll from '@/components/ui/animate-on-scroll';

export default function Dashboard() {
  const rooms = useMotelStore((s) => s.rooms);
  const guests = useMotelStore((s) => s.guests);
  const stays = useMotelStore((s) => s.stays);
  const getActiveStays = useMotelStore((s) => s.getActiveStays);
  const getTodayRevenue = useMotelStore((s) => s.getTodayRevenue);

  const occupied = rooms.filter((r) => r.status === 'occupied').length;
  const available = rooms.filter((r) => r.status === 'available').length;
  const total = rooms.length || 1;
  const occPercent = Math.round((occupied / total) * 100);
  const availPercent = Math.round((available / total) * 100);
  const revenue = getTodayRevenue();

  const activeStays = getActiveStays();
  const today = new Date().toISOString().split('T')[0];
  const checkoutsToday = activeStays.filter((s) => s.checkOutDate === today);

  // Dynamic greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const upcomingCheckouts = checkoutsToday.map((s) => ({
    id: s.id,
    name: `${s.guest.firstName} ${s.guest.lastName}`,
    room: s.room.roomNumber,
    time: s.checkOutTime,
  }));

  // Generate real activity log from stays
  const realActivityLog = stays
    .filter((s) => s.checkInDate && s.guestId && s.roomId)
    .map((stay) => {
      const guest = guests.find((g) => g.id === stay.guestId);
      const room = rooms.find((r) => r.id === stay.roomId);
      const guestName = guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown Guest';
      const roomNumber = room ? room.roomNumber : 'Unknown';

      return {
        id: stay.id,
        guest: guestName,
        action: stay.status === 'checked_out' ? 'Check-out' : 'Check-in',
        room: roomNumber,
        time: stay.status === 'checked_out' ? (stay.checkOutTime || '11:00 AM') : (stay.checkInTime || '3:00 PM'),
        date: stay.status === 'checked_out' ? stay.checkOutDate : stay.checkInDate,
        status: 'Success',
      };
    })
    .sort((a, b) => {
      // Sort descending by date/time (rough heuristic)
      const dateA = new Date(`${a.date} ${a.time}`).getTime();
      const dateB = new Date(`${b.date} ${b.time}`).getTime();
      return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
    })
    .slice(0, 5);

  return (
    <div className="p-4 lg:p-6">
      <AnimateOnScroll>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Operations Overview</h2>
          <p className="text-muted-foreground mt-1">
            {greeting}, Admin. Here is what is happening at Airway Motel today.
          </p>
        </div>
      </AnimateOnScroll>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AnimateOnScroll delay={0}>
          <StatCard
            title="Rooms Occupied"
            value={occupied}
            badgeText={`${occPercent}% Full`}
            icon={DoorClosed}
            tone="warning"
          />
        </AnimateOnScroll>
        <AnimateOnScroll delay={100}>
          <StatCard
            title="Rooms Free"
            value={available}
            badgeText={`${availPercent}% Avail`}
            icon={DoorOpen}
            tone="success"
          />
        </AnimateOnScroll>
        <AnimateOnScroll delay={200}>
          <StatCard
            title="Check-outs Today"
            value={checkoutsToday.length}
            badgeText="Due 10 AM"
            icon={LogOut}
            tone="destructive"
          />
        </AnimateOnScroll>
        <AnimateOnScroll delay={300}>
          <StatCard
            title="Today's Revenue"
            value={`$${Math.round(revenue).toLocaleString()}`}
            badgeText="+12% vs yest"
            icon={DollarSign}
            isInverse
          />
        </AnimateOnScroll>
      </div>

      {/* Activity + Upcoming Checkouts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Recent Activity */}
        <AnimateOnScroll delay={200} className="lg:col-span-8">
          <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase text-[10px]">Guest</TableHead>
                  <TableHead className="uppercase text-[10px]">Action</TableHead>
                  <TableHead className="uppercase text-[10px]">Room</TableHead>
                  <TableHead className="uppercase text-[10px]">Time</TableHead>
                  <TableHead className="uppercase text-[10px] text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {realActivityLog.length > 0 ? (
                  realActivityLog.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                            {log.guest.split(' ').map((n) => n[0]).join('').substring(0, 2)}
                          </div>
                          <span className="font-medium text-sm">{log.guest}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{log.action}</TableCell>
                      <TableCell className="text-sm">#{log.room}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.date} {log.time}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={log.status === 'Success' ? 'secondary' : 'outline'}
                          className="text-[10px]"
                        >
                          {log.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No recent activity found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        </AnimateOnScroll>

        {/* Upcoming Checkouts */}
        <AnimateOnScroll delay={300} className="lg:col-span-4">
          <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Upcoming Check-outs</CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {upcomingCheckouts.length > 0 ? (
              <div className="space-y-3">
                {upcomingCheckouts.map((guest) => (
                  <div
                    key={guest.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                      {guest.name.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{guest.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Room {guest.room}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{guest.time}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No check-outs scheduled for today.
              </div>
            )}
          </CardContent>
        </Card>
        </AnimateOnScroll>
      </div>
    </div>
  );
}
