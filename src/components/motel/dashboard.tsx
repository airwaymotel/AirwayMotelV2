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

export default function Dashboard() {
  const rooms = useMotelStore((s) => s.rooms);
  const activityLog = useMotelStore((s) => s.activityLog);
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

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Operations Overview</h2>
        <p className="text-muted-foreground mt-1">
          {greeting}, Admin. Here is what is happening at Airway Motel today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Rooms Occupied"
          value={occupied}
          badgeText={`${occPercent}% Full`}
          icon={DoorClosed}
          tone="warning"
        />
        <StatCard
          title="Rooms Free"
          value={available}
          badgeText={`${availPercent}% Avail`}
          icon={DoorOpen}
          tone="success"
        />
        <StatCard
          title="Check-outs Today"
          value={checkoutsToday.length}
          badgeText="Due 10 AM"
          icon={LogOut}
          tone="destructive"
        />
        <StatCard
          title="Today's Revenue"
          value={`$${revenue}`}
          badgeText="+12% vs yest"
          icon={DollarSign}
          isInverse
        />
      </div>

      {/* Activity + Upcoming Checkouts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Recent Activity */}
        <Card className="lg:col-span-8">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <button className="text-xs text-muted-foreground hover:text-foreground font-semibold uppercase cursor-pointer">
              View All
            </button>
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
                {activityLog.length > 0 ? (
                  activityLog.slice(0, 5).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {log.guest.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span className="font-medium text-sm">{log.guest}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{log.action}</TableCell>
                      <TableCell className="text-sm">#{log.room}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{log.time}</TableCell>
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

        {/* Upcoming Checkouts */}
        <Card className="lg:col-span-4 flex flex-col">
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
      </div>
    </div>
  );
}
