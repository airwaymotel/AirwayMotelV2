'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Loader2, UserCheck, UserX, Trash2, DollarSign,
  ClipboardCheck, CalendarDays, Eye, EyeOff, Settings, RefreshCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth, authFetch } from '@/components/auth-provider';
import AuthGuard from '@/components/auth-guard';
import { toast } from 'sonner';
import { ALL_PERMISSIONS, type OperatorWithStats, type OperatorActivity, type Permission } from '@/lib/auth-types';

export default function OperatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isSuperAdmin } = useAuth();

  const [operator, setOperator] = useState<OperatorWithStats | null>(null);
  const [activities, setActivities] = useState<OperatorActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const fetchOperator = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/operators');
      if (res.ok) {
        const data = await res.json();
        const op = data.operators.find((o: OperatorWithStats) => o.id === id);
        if (op) {
          setOperator(op);
          setEditName(op.full_name);
        }
      }
    } catch {
      // silent on poll
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchActivity = useCallback(async () => {
    try {
      const res = await authFetch(`/api/admin/operators/${id}/activity?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
      }
    } catch {
      // silent on poll
    } finally {
      setActivityLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.push('/profile');
    }
  }, [loading, isSuperAdmin, router]);

  useEffect(() => {
    fetchOperator();
    fetchActivity();

    // Poll every 5s for real-time sync
    const interval = setInterval(() => {
      fetchOperator();
      fetchActivity();
    }, 5000);

    // Refetch on tab focus
    const handleFocus = () => { fetchOperator(); fetchActivity(); };
    window.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchOperator, fetchActivity]);

  const handleUpdateName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    const res = await authFetch(`/api/admin/operators/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: editName }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('Name updated');
      fetchOperator();
    } else {
      toast.error('Failed to update');
    }
  };

  const handleUpdatePassword = async () => {
    if (!editPassword) return;
    setSaving(true);
    const res = await authFetch(`/api/admin/operators/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: editPassword }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success('Password updated');
      setEditPassword('');
    } else {
      toast.error('Failed to update');
    }
  };

  const handleToggleActive = async () => {
    if (!operator) return;
    const res = await authFetch(`/api/admin/operators/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !operator.is_active }),
    });
    if (res.ok) {
      toast.success(operator.is_active ? 'Operator disabled' : 'Operator enabled');
      fetchOperator();
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete this operator? This cannot be undone.`)) return;
    const res = await authFetch(`/api/admin/operators/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Operator deleted');
      router.push('/profile');
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to delete');
    }
  };

  const handleTogglePermission = async (permission: Permission, currentEnabled: boolean) => {
    const res = await authFetch(`/api/admin/operators/${id}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: [{ permission, enabled: !currentEnabled }] }),
    });
    if (res.ok) {
      fetchOperator();
    }
  };

  if (!isSuperAdmin) {
    return null;
  }

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
        </div>
      </AuthGuard>
    );
  }

  if (!operator) {
    return (
      <AuthGuard>
        <div className="p-6 text-center text-muted-foreground">Operator not found.</div>
      </AuthGuard>
    );
  }

  const totalCheckIns = activities.filter(a => a.action === 'check_in').length;
  const totalRevenue = activities.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  return (
    <AuthGuard>
      <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/profile')} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        </div>

        {/* Operator Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={`https://api.dicebear.com/10.x/adventurer-neutral/svg?seed=${encodeURIComponent(operator.full_name)}`}
                  alt="avatar"
                  className="w-16 h-16 rounded-full bg-muted"
                />
                <div>
                  <p className="text-lg font-bold">{operator.full_name}</p>
                  <p className="text-sm text-muted-foreground">@{operator.username}</p>
                  <Badge variant={operator.is_active ? 'default' : 'secondary'} className="mt-1 text-[10px]">
                    {operator.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant={operator.is_active ? 'outline' : 'default'} size="sm" onClick={handleToggleActive} className="gap-1.5">
                  {operator.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  {operator.is_active ? 'Disable' : 'Enable'}
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5">
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <CalendarDays className="w-4 h-4" />
                <span className="text-xs font-medium">Joined</span>
              </div>
              <p className="text-sm font-bold">{new Date(operator.created_at).toLocaleDateString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Edit Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" /> Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Full Name</Label>
              <div className="flex gap-2 mt-1">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1" />
                <Button size="sm" onClick={handleUpdateName} disabled={saving || editName === operator.full_name}>Save</Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Reset Password</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="New password"
                  className="flex-1"
                />
                <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
                <Button size="sm" onClick={handleUpdatePassword} disabled={saving || !editPassword}>Update</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" /> Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map(p => {
                const enabled = operator.permissions.includes(p.value);
                return (
                  <button
                    key={p.value}
                    onClick={() => handleTogglePermission(p.value, enabled)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left text-sm transition-colors ${
                      enabled
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <div>
                      <span className="font-medium">{p.label}</span>
                      <span className="text-xs text-muted-foreground block">{p.description}</span>
                    </div>
                    {enabled ? (
                      <Eye className="w-5 h-5 text-green-500 shrink-0" />
                    ) : (
                      <EyeOff className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4" /> Recent Activity
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchActivity} className="gap-1.5">
              <RefreshCcw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
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
                      <span className="font-medium capitalize">{act.action.replace('_', ' ')}</span>
                      {act.guest_name && <span className="text-muted-foreground ml-1">— {act.guest_name}</span>}
                      {act.room_number && <span className="text-muted-foreground ml-1">Room {act.room_number}</span>}
                      {act.description && <span className="text-xs text-muted-foreground block">{act.description}</span>}
                    </div>
                    <div className="text-right shrink-0 ml-4">
                      {act.amount > 0 && <span className="text-green-600 font-medium">${Number(act.amount).toFixed(2)}</span>}
                      <span className="text-xs text-muted-foreground block">
                        {new Date(act.created_at).toLocaleDateString()} {new Date(act.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}
