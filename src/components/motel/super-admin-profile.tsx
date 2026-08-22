'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Trash2, Save, X, Loader2, UserCheck, UserX,
  DollarSign, ClipboardCheck, ArrowLeft, Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth, authFetch } from '@/components/auth-provider';
import { toast } from 'sonner';
import type { OperatorWithStats } from '@/lib/auth-types';

export default function SuperAdminProfile() {
  const router = useRouter();
  const { user: currentUser, logout } = useAuth();
  const [operators, setOperators] = useState<OperatorWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');

  const fetchOperators = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/operators');
      if (res.ok) {
        const data = await res.json();
        setOperators(data.operators);
      }
    } catch {
      // silent on poll
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + silent polling
  useEffect(() => {
    fetchOperators();
    const interval = setInterval(fetchOperators, 5000);
    const handleFocus = () => fetchOperators();
    window.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchOperators]);

  const handleAddOperator = async () => {
    if (!newUsername || !newPassword || !newFullName) {
      toast.error('All fields are required');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch('/api/admin/operators', {
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

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/')} className="gap-1.5">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      {/* Super Admin Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <img
              src={`https://api.dicebear.com/10.x/adventurer-neutral/svg?seed=${encodeURIComponent(currentUser?.full_name || 'admin')}`}
              alt="avatar"
              className="w-16 h-16 rounded-full bg-muted"
            />
            <div>
              <p className="text-lg font-bold">{currentUser?.full_name}</p>
              <p className="text-sm text-muted-foreground">@{currentUser?.username}</p>
              <Badge variant="default" className="mt-1 text-[10px]">Super Admin</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operators Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" />
            Operators
            <Badge variant="secondary" className="text-xs">{operators.length}</Badge>
          </h2>
          <Button size="sm" onClick={() => setShowAddForm(!showAddForm)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Operator
          </Button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <Card className="mb-4 bg-muted/30">
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

        {/* Operator List */}
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
          </div>
        ) : operators.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No operators yet. Add one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {operators.map(op => (
              <Card
                key={op.id}
                className={`cursor-pointer hover:border-amber-500/40 transition-colors ${!op.is_active ? 'opacity-50' : ''}`}
                onClick={() => router.push(`/admin/operators/${op.id}`)}
              >
                <CardContent className="py-4">
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
                    <div className="flex items-center gap-4">
                      <div className="text-right text-xs text-muted-foreground hidden sm:block">
                        <span className="flex items-center gap-1">
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          {op.total_check_ins} check-ins
                        </span>
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5" />
                          ${Math.round(op.total_revenue).toLocaleString()}
                        </span>
                      </div>
                      <Badge variant={op.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {op.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Logout */}
      <div className="pt-4">
        <Button variant="destructive" onClick={logout} className="gap-1.5">
          <X className="w-4 h-4" /> Log Out
        </Button>
      </div>
    </div>
  );
}
