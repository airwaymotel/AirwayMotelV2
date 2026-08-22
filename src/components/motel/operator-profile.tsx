'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  User, Loader2, ClipboardCheck, DollarSign, CalendarDays,
  LogOut, ArrowLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth, authFetch } from '@/components/auth-provider';
import { toast } from 'sonner';
import type { OperatorActivity } from '@/lib/auth-types';

export default function OperatorProfile() {
  const router = useRouter();
  const { user: authUser, logout } = useAuth();
  const [activities, setActivities] = useState<OperatorActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [freshUser, setFreshUser] = useState<{ full_name: string; username: string; role: string; permissions: string[] } | null>(null);

  const user = freshUser || authUser;

  const fetchFreshUser = useCallback(async () => {
    try {
      const res = await authFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setFreshUser(data.user);
      }
    } catch { /* silent */ }
  }, []);

  const fetchActivity = useCallback(async () => {
    if (!authUser) return;
    try {
      const res = await authFetch(`/api/admin/operators/${authUser.id}/activity?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    fetchFreshUser();
    fetchActivity();

    // Poll every 5s for real-time sync
    const interval = setInterval(() => {
      fetchFreshUser();
      fetchActivity();
    }, 5000);

    // Refetch on tab focus
    const handleFocus = () => { fetchFreshUser(); fetchActivity(); };
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchFreshUser, fetchActivity]);

  if (!user) return null;

  const totalCheckIns = activities.filter(a => a.action === 'check_in').length;
  const totalRevenue = activities.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* User Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <img
              src={`https://api.dicebear.com/10.x/adventurer-neutral/svg?seed=${encodeURIComponent(user?.full_name || 'user')}`}
              alt="avatar"
              className="w-16 h-16 rounded-full bg-muted"
            />
            <div>
              <p className="text-lg font-bold">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <Badge variant="secondary" className="mt-1 text-[10px] capitalize">{user.role.replace('_', ' ')}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardCheck className="w-4 h-4" />
              <span className="text-xs font-medium">Check-Ins</span>
            </div>
            <p className="text-2xl font-bold">{totalCheckIns}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Revenue</span>
            </div>
            <p className="text-2xl font-bold">${Math.round(totalRevenue).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Your Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1.5">
            {user.permissions.map(p => (
              <Badge key={p} variant="outline" className="text-xs capitalize">
                {p.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Recent Check-Ins
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-8">No activity yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {activities.map(act => (
                <div key={act.id} className="flex items-center justify-between text-sm p-3 rounded-lg bg-muted/30">
                  <div>
                    <span className="font-medium">{act.action}</span>
                    {act.guest_name && <span className="text-muted-foreground ml-1">— {act.guest_name}</span>}
                    {act.room_number && <span className="text-muted-foreground ml-1">Room {act.room_number}</span>}
                  </div>
                  <div className="text-right">
                    {act.amount > 0 && <span className="text-green-600">${Number(act.amount).toFixed(2)}</span>}
                    <span className="text-xs text-muted-foreground block">
                      {new Date(act.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logout */}
      <div className="pt-2">
        <Button variant="destructive" onClick={logout} className="gap-1.5">
          <LogOut className="w-4 h-4" /> Log Out
        </Button>
      </div>
    </div>
  );
}
