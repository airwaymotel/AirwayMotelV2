'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, Phone, Mail, Calendar, BedSingle, BedDouble,
  Shield, CreditCard, Banknote, Wallet, ImageIcon, PenLine,
  CheckCircle, Clock, AlertTriangle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { useMotelStore } from '@/lib/store';
import type { Guest, Room, Stay, Payment } from '@/lib/types';

interface SignatureRecord {
  id: string;
  stay_id: string;
  guest_id: string;
  signature_data_url: string;
  signed_at: string;
}

interface StayDetails {
  stay: Stay;
  guest: Guest;
  room: Room;
  payments: Payment[];
  signatures: SignatureRecord[];
}

export default function StayDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const stayId = params.stayId as string;

  const stays = useMotelStore((s) => s.stays);
  const guests = useMotelStore((s) => s.guests);
  const rooms = useMotelStore((s) => s.rooms);
  const payments = useMotelStore((s) => s.payments);

  const [data, setData] = useState<StayDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function load() {
      if (!stayId) return;
      setLoading(true);
      setError('');

      try {
        // Try Supabase first for full data (including signatures)
        if (supabase) {
          const { data: stayRow, error: stayError } = await supabase
            .from('stays')
            .select('*, guests(*), rooms(*), signatures(*), payments(*)')
            .eq('id', stayId)
            .single();

          if (!stayError && stayRow) {
            // Map snake_case Supabase rows to camelCase app types
            const g = stayRow.guests as Record<string, unknown>;
            const r = stayRow.rooms as Record<string, unknown>;

            const guest: Guest = {
              id: g.id as string,
              firstName: (g.first_name as string) || '',
              lastName: (g.last_name as string) || '',
              phone: (g.phone as string) || '',
              email: (g.email as string) || '',
              idNumber: (g.id_number as string) || '',
              dateOfBirth: g.date_of_birth ? String(g.date_of_birth) : '',
              idPhotoUrl: (g.id_photo_url as string) || '',
              idType: (g.id_type as string) || '',
              idState: (g.id_state as string) || '',
              createdAt: g.created_at as string,
            };

            const room: Room = {
              id: r.id as string,
              roomNumber: (r.room_number as string) || '',
              floor: (r.floor as number) || 1,
              type: (r.type as Room['type']) || '1-bed',
              rate: r.type === '2-bed' ? 85 : 65,
              status: (r.status as Room['status']) || 'available',
            };

            const rawSigs = (stayRow.signatures || []) as Record<string, unknown>[];
            const signatures: SignatureRecord[] = rawSigs.map((s) => ({
              id: s.id as string,
              stay_id: s.stay_id as string,
              guest_id: s.guest_id as string,
              signature_data_url: (s.signature_data_url as string) || '',
              signed_at: s.signed_at as string,
            }));

            const rawPmts = (stayRow.payments || []) as Record<string, unknown>[];
            const pmts: Payment[] = rawPmts.map((p) => ({
              id: p.id as string,
              stayId: p.stay_id as string,
              amount: p.amount as number,
              method: (p.method as Payment['method']) || 'card',
              description: (p.description as string) || '',
              paidAt: p.paid_at as string,
            }));

            const stay: Stay = {
              id: stayRow.id,
              guestId: stayRow.guest_id,
              roomId: stayRow.room_id,
              checkInDate: stayRow.check_in_date,
              checkInTime: stayRow.check_in_time,
              checkOutDate: stayRow.check_out_date,
              checkOutTime: stayRow.check_out_time,
              rateAmount: stayRow.rate_amount,
              status: stayRow.status,
              keyDeposit: stayRow.key_deposit,
              tvRemoteDeposit: stayRow.tv_remote_deposit,
              createdAt: stayRow.created_at,
            };

            setData({ stay, guest, room, payments: pmts, signatures });
            setLoading(false);
            return;
          }
        }

        // Fallback: build from local store
        const stay = stays.find((s) => s.id === stayId);
        if (!stay) {
          setError('Stay not found');
          setLoading(false);
          return;
        }
        const guest = guests.find((g) => g.id === stay.guestId);
        const room = rooms.find((r) => r.id === stay.roomId);
        const stayPayments = payments.filter((p) => p.stayId === stayId);

        if (!guest || !room) {
          setError('Missing guest or room data for this stay');
          setLoading(false);
          return;
        }

        setData({ stay, guest, room, payments: stayPayments, signatures: [] });
      } catch (err) {
        console.error('Failed to load stay details:', err);
        setError('Failed to load stay details');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [stayId, stays, guests, rooms, payments]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Loading stay details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Stay Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'The stay record could not be found or has been removed.'}
          </p>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { stay, guest, room, payments: stayPayments, signatures } = data;

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
    active: { label: 'Active', variant: 'secondary', icon: <CheckCircle className="w-4 h-4" /> },
    checked_out: { label: 'Checked Out', variant: 'outline', icon: <Clock className="w-4 h-4" /> },
    cancelled: { label: 'Cancelled', variant: 'destructive', icon: <AlertTriangle className="w-4 h-4" /> },
  };

  const statusInfo = statusConfig[stay.status] || statusConfig.active;
  const totalPayments = stayPayments.reduce((sum, p) => sum + p.amount, 0);
  const methodIcons: Record<string, React.ReactNode> = {
    card: <CreditCard className="w-3.5 h-3.5" />,
    cash: <Banknote className="w-3.5 h-3.5" />,
    debit: <Wallet className="w-3.5 h-3.5" />,
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="mb-2 -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {(guest.firstName || '?')[0]}{(guest.lastName || '?')[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {guest.firstName} {guest.lastName}
                <Badge variant={statusInfo.variant} className="text-xs">
                  {statusInfo.icon} {statusInfo.label}
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                Room {room.roomNumber} &middot; {room.type === '1-bed' ? '1-Bed King' : '2-Bed Queen'}
              </p>
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Stay ID</p>
          <p className="text-xs font-mono text-muted-foreground">{stay.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left Column ── */}
        <div className="space-y-6">
          {/* Guest Profile */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4" /> Guest Profile
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{guest.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{guest.email || '—'}</p>
                </div>
              </div>
              {guest.dateOfBirth && (
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date of Birth</p>
                    <p className="text-sm font-medium">{guest.dateOfBirth}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stay Details */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Stay Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Check-in</p>
                <p className="text-sm font-medium">{stay.checkInDate}</p>
                <p className="text-xs text-muted-foreground">{stay.checkInTime}</p>
              </div>
              <div className="bg-muted/40 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Check-out</p>
                <p className="text-sm font-medium">{stay.checkOutDate}</p>
                <p className="text-xs text-muted-foreground">{stay.checkOutTime}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Rate</p>
                <p className="text-sm font-medium">${stay.rateAmount}/night</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Room</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  {room.type === '1-bed' ? <BedSingle className="w-4 h-4" /> : <BedDouble className="w-4 h-4" />}
                  {room.roomNumber}
                </p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Key Deposit</p>
                <p className="text-sm font-medium">${stay.keyDeposit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">TV Remote Deposit</p>
                <p className="text-sm font-medium">${stay.tvRemoteDeposit}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="space-y-6">
          {/* Identity & Verification */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Identity & Verification
            </h2>

            {/* ID details */}
            {(guest.idType || guest.idNumber || guest.idState) && (
              <div className="bg-muted/40 rounded-lg p-3 mb-4 space-y-2">
                {guest.idType && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Type</span>
                    <span className="font-medium">{guest.idType}</span>
                  </div>
                )}
                {guest.idNumber && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Number</span>
                    <span className="font-medium font-mono">{guest.idNumber}</span>
                  </div>
                )}
                {guest.idState && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">State</span>
                    <span className="font-medium">{guest.idState}</span>
                  </div>
                )}
              </div>
            )}

            {/* ID Photo */}
            {guest.idPhotoUrl ? (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> ID Photo
                </p>
                <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                  <img
                    src={guest.idPhotoUrl}
                    alt="ID Photo"
                    className="w-full max-h-48 object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="mb-4 bg-muted/30 rounded-lg p-4 text-center text-muted-foreground">
                <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">No ID photo on file</p>
              </div>
            )}

            {/* Signature */}
            {signatures.length > 0 && signatures[0].signature_data_url ? (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <PenLine className="w-3 h-3" /> Guest Signature
                </p>
                <div className="border border-border rounded-lg p-3 bg-white dark:bg-zinc-100">
                  <img
                    src={signatures[0].signature_data_url}
                    alt="Guest Signature"
                    className="max-h-24 object-contain mix-blend-multiply"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground">
                <PenLine className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">No signature on file</p>
              </div>
            )}
          </div>

          {/* Payment History */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4" /> Payment History
            </h2>

            {stayPayments.length > 0 ? (
              <div className="space-y-3">
                {stayPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between bg-muted/40 rounded-lg p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-muted-foreground">
                        {methodIcons[p.method] || <CreditCard className="w-3.5 h-3.5" />}
                      </span>
                      <div>
                        <p className="text-xs font-medium">{p.description}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{p.method}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">${p.amount}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(p.paidAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between px-1">
                  <span className="text-sm font-semibold">Total Paid</span>
                  <span className="text-sm font-bold">${totalPayments}</span>
                </div>
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground">
                <CreditCard className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">No payments recorded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
