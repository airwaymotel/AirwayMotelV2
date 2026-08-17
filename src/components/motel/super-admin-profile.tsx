'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Trash2, Save, X, ChevronDown, ChevronUp,
  Loader2, UserCheck, UserX, DollarSign, ClipboardCheck,
  Shield, Eye, EyeOff, Settings, RefreshCcw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/components/auth-provider';
import { toast } from 'sonner';
import { ALL_PERMISSIONS, type OperatorWithStats, type OperatorActivity, type Permission } from '@/lib/auth-types';

export default function SuperAdminProfile({ onClose }: { onClose: () => void }) {
  const { user: currentUser } = useAuth();
  const [operators, setOperators] = useState<OperatorWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activityData, setActivityData] = useState<OperatorActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Add form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchOperators = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/operators');
      if (res.ok) {
        const data = await res.json();
        setOperators(data.operators);
      }
    } catch {
      toast.error('Failed to load operators');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOperators();
  }, [fetchOperators]);

  const handleAddOperator = async () => {
    if (!newUsername || !newPassword || !newFullName) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/operators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, full_name: newFullName }),
      });
      if (res.ok) {
        toast.success('Operator created');
        setNewUsername('');
        setNewPassword('');
        setNewFullName('');
        setShowAddForm(false);
        fetchOperators();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to create operator');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (op: OperatorWithStats) => {
    const res = await fetch(`/api/admin/operators/${op.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !op.is_active }),
    });
    if (res.ok) {
      toast.success(op.is_active ? 'Operator disabled' : 'Operator enabled');
      fetchOperators();
    }
  };

  const handleDeleteOperator = async (op: OperatorWithStats) => {
    if (!confirm(`Delete operator "${op.full_name}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/operators/${op.id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Operator deleted');
      fetchOperators();
    } else {
      const data = await res.json();
      toast.error(data.error || 'Failed to delete');
    }
  };

  const handleTogglePermission = async (opId: string, permission: Permission, currentEnabled: boolean) => {
    const res = await fetch(`/api/admin/operators/${opId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: [{ permission, enabled: !currentEnabled }] }),
    });
    if (res.ok) {
      fetchOperators();
    }
  };

  const loadActivity = async (opId: string) => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/admin/operators/${opId}/activity?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setActivityData(data.activities);
      }
    } catch {
      toast.error('Failed to load activity');
    } finally {
      setActivityLoading(false);
    }
  };

  const handleExpand = (opId: string) => {
    if (expandedId === opId) {
      setExpandedId(null);
      setActivityData([]);
    } else {
      setExpandedId(opId);
      loadActivity(opId);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-8 px-4 overflow-y-auto">
      <Card className="w-full max-w-2xl mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-500" />
            Operator Management
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add Operator */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{operators.length} operator(s)</p>
            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Operator
            </Button>
          </div>

          {showAddForm && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Username</Label>
                    <Input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="e.g. op2" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Password</Label>
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Password" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Full Name</Label>
                  <Input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="John Doe" className="mt-1" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddOperator} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Create
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* Operator List */}
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : operators.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">No operators yet.</p>
          ) : (
            <div className="space-y-3">
              {operators.map(op => (
                <Card key={op.id} className={!op.is_active ? 'opacity-50' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <Users className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                          <p className="font-medium">{op.full_name}</p>
                          <p className="text-xs text-muted-foreground">@{op.username}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={op.is_active ? 'default' : 'secondary'} className="text-[10px]">
                          {op.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                        <Button variant="ghost" size="sm" onClick={() => handleExpand(op.id)} className="gap-1">
                          {expandedId === op.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {op.total_check_ins} check-ins
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        ${Math.round(op.total_revenue).toLocaleString()} revenue
                      </span>
                    </div>

                    {/* Expanded details */}
                    {expandedId === op.id && (
                      <div className="mt-4 space-y-4">
                        <Separator />

                        {/* Permissions */}
                        <div>
                          <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                            <Settings className="w-3.5 h-3.5" /> Permissions
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {ALL_PERMISSIONS.map(p => {
                              const enabled = op.permissions.includes(p.value);
                              return (
                                <button
                                  key={p.value}
                                  onClick={() => handleTogglePermission(op.id, p.value, enabled)}
                                  className={`flex items-center justify-between p-2 rounded-lg border text-left text-xs transition-colors ${
                                    enabled
                                      ? 'border-green-500/30 bg-green-500/5'
                                      : 'border-border hover:border-primary/40'
                                  }`}
                                >
                                  <span>
                                    <span className="font-medium">{p.label}</span>
                                    <span className="text-muted-foreground ml-1">— {p.description}</span>
                                  </span>
                                  {enabled ? (
                                    <Eye className="w-4 h-4 text-green-500 shrink-0" />
                                  ) : (
                                    <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={op.is_active ? 'outline' : 'default'}
                            onClick={() => handleToggleActive(op)}
                            className="gap-1.5"
                          >
                            {op.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            {op.is_active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteOperator(op)}
                            className="gap-1.5"
                          >
                            <Trash2 className="w-4 h-4" /> Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => loadActivity(op.id)}
                            className="gap-1.5"
                          >
                            <RefreshCcw className="w-4 h-4" /> Refresh
                          </Button>
                        </div>

                        {/* Recent Activity */}
                        <div>
                          <p className="text-xs font-semibold mb-2">Recent Activity</p>
                          {activityLoading ? (
                            <div className="flex items-center justify-center p-4">
                              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : activityData.length === 0 ? (
                            <p className="text-xs text-muted-foreground p-4 text-center">No activity yet.</p>
                          ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                              {activityData.map(act => (
                                <div key={act.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                                  <div>
                                    <span className="font-medium">{act.action}</span>
                                    {act.guest_name && <span className="text-muted-foreground ml-1">— {act.guest_name}</span>}
                                    {act.room_number && <span className="text-muted-foreground ml-1">Room {act.room_number}</span>}
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
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
