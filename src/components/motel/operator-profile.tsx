'use client';

import { useState, useEffect } from 'react';
import {
  User, X, Loader2, ClipboardCheck, DollarSign, CalendarDays,
  LogOut,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/components/auth-provider';
import { toast } from 'sonner';
import type { OperatorActivity } from '@/lib/auth-types';

export default function OperatorProfile({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const [activities, setActivities] = useState<OperatorActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchActivity = async () => {
      try {
        const res = await fetch(`/api/admin/operators/${user.id}/activity?limit=50`);
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities);
        }
      } catch {
        toast.error('Failed to load activity');
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [user]);

  if (!user) return null;

  const totalCheckIns = activities.filter(a => a.action === 'check_in').length;
  const totalRevenue = activities.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-8 px-4 overflow-y-auto">
      <Card className="w-full max-w-lg mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5 text-amber-500" />
            My Profile
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <User className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <p className="text-lg font-bold">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
              <Badge variant="secondary" className="mt-1 text-[10px] capitalize">{user.role.replace('_', ' ')}</Badge>
            </div>
          </div>

          <Separator />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <ClipboardCheck className="w-4 h-4" />
                <span className="text-xs font-medium">Check-Ins</span>
              </div>
              <p className="text-2xl font-bold">{totalCheckIns}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs font-medium">Revenue</span>
              </div>
              <p className="text-2xl font-bold">${Math.round(totalRevenue).toLocaleString()}</p>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Your Permissions</p>
            <div className="flex flex-wrap gap-1.5">
              {user.permissions.map(p => (
                <Badge key={p} variant="outline" className="text-[10px] capitalize">
                  {p.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>

          <Separator />

          {/* Recent Activity */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Recent Check-Ins
            </p>
            {loading ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4 text-center">No activity yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {activities.slice(0, 10).map(act => (
                  <div key={act.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                    <div>
                      <span className="font-medium">{act.action}</span>
                      {act.guest_name && <span className="text-muted-foreground ml-1">— {act.guest_name}</span>}
                      {act.room_number && <span className="text-muted-foreground ml-1">Rm {act.room_number}</span>}
                    </div>
                    <div className="text-right">
                      {act.amount > 0 && <span className="text-green-600">${Number(act.amount).toFixed(2)}</span>}
                      <span className="text-muted-foreground ml-2">
                        {new Date(act.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Logout */}
          <Button variant="destructive" onClick={logout} className="w-full gap-1.5">
            <LogOut className="w-4 h-4" /> Log Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
