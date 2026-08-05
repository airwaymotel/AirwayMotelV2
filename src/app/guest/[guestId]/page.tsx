'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, User, Phone, Mail, Calendar, BedSingle, BedDouble,
  Shield, CreditCard, Banknote, Wallet, ImageIcon, PenLine,
  CheckCircle, Clock, AlertTriangle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
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

interface StayDetail {
  stay: Stay;
  room: Room;
  payments: Payment[];
  totalPaid: number;
}

interface GuestDetails {
  guest: Guest;
  stayHistory: StayDetail[];
  signatures: SignatureRecord[];
}

export default function GuestDetailsPage() {
  const params = useParams();
  const guestId = params.guestId as string;

  const guests = useMotelStore((s) => s.guests);
  const stays = useMotelStore((s) => s.stays);
  const rooms = useMotelStore((s) => s.rooms);
  const payments = useMotelStore((s) => s.payments);

  const [data, setData] = useState<GuestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function load() {
      if (!guestId) return;
      setLoading(true);
      setError('');

      try {
        if (supabase) {
          const { data: guestRow, error: guestError } = await supabase
            .from('guests')
            .select('*')
            .eq('id', guestId)
            .single();

          if (guestError || !guestRow) {
            setError('Guest not found');
            setLoading(false);
            return;
          }

          const guest: Guest = {
            id: guestRow.id as string,
            firstName: (guestRow.first_name as string) || '',
            lastName: (guestRow.last_name as string) || '',
            phone: (guestRow.phone as string) || '',
            email: (guestRow.email as string) || '',
            idNumber: (guestRow.id_number as string) || '',
            dateOfBirth: guestRow.date_of_birth ? String(guestRow.date_of_birth) : '',
            idPhotoUrl: (guestRow.id_photo_url as string) || '',
            idType: (guestRow.id_type as string) || '',
            idState: (guestRow.id_state as string) || '',
            createdAt: guestRow.created_at as string,
          };

          const { data: stayRows, error: stayError } = await supabase
            .from('stays')
            .select('*, rooms(*), payments(*)')
            .eq('guest_id', guestId)
            .order('created_at', { ascending: false });

          if (stayError) throw stayError;

          const stayDetails: StayDetail[] = (stayRows || []).map((row) => {
            const r = row.rooms as Record<string, unknown>;
            const room: Room = {
              id: r.id as string,
              roomNumber: (r.room_number as string) || '',
              type: (r.type as Room['type']) || '1-bed',
              rate: r.type === '2-bed' ? 85 : 65,
              status: (r.status as Room['status']) || 'available',
            };

            const rawPmts = (row.payments || []) as Record<string, unknown>[];
            const pmts: Payment[] = rawPmts.map((p) => ({
              id: p.id as string,
              stayId: p.stay_id as string,
              amount: p.amount as number,
              method: (p.method as Payment['method']) || 'card',
              description: (p.description as string) || '',
              paidAt: p.paid_at as string,
            }));

            const totalPaid = pmts.reduce((sum, p) => sum + p.amount, 0);

            const stay: Stay = {
              id: row.id as string,
              guestId: row.guest_id as string,
              roomId: row.room_id as string,
              checkInDate: row.check_in_date as string,
              checkInTime: row.check_in_time as string,
              checkOutDate: row.check_out_date as string,
              checkOutTime: row.check_out_time as string,
              rateAmount: Number(row.rate_amount) || 0,
              status: row.status as Stay['status'],
              keyDeposit: Number(row.key_deposit) || 10,
              tvRemoteDeposit: Number(row.tv_remote_deposit) || 10,
              createdAt: row.created_at as string,
            };

            return { stay, room, payments: pmts, totalPaid };
          });

          const { data: sigRows, error: sigError } = await supabase
            .from('signatures')
            .select('*')
            .eq('guest_id', guestId)
            .order('signed_at', { ascending: false });

          if (sigError) throw sigError;

          const signatures: SignatureRecord[] = (sigRows || []).map((s) => ({
            id: s.id as string,
            stay_id: s.stay_id as string,
            guest_id: s.guest_id as string,
            signature_data_url: (s.signature_data_url as string) || '',
            signed_at: s.signed_at as string,
          }));

          setData({ guest, stayHistory: stayDetails, signatures });
        } else {
          // Fallback: build from local store
          const guest = guests.find((g) => g.id === guestId);
          if (!guest) {
            setError('Guest not found');
            setLoading(false);
            return;
          }

          const guestStays = stays.filter((s) => s.guestId === guestId);
          const stayDetails: StayDetail[] = guestStays.map((stay) => {
            const room = rooms.find((r) => r.id === stay.roomId)!;
            const stayPayments = payments.filter((p) => p.stayId === stay.id);
            const totalPaid = stayPayments.reduce((sum, p) => sum + p.amount, 0);
            return { stay, room, payments: stayPayments, totalPaid };
          });

          setData({ guest, stays: stayDetails, signatures: [] });
        }
      } catch (err) {
        console.error('Failed to load guest details:', err);
        setError('Failed to load guest details');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [guestId, guests, stays, rooms, payments]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Loading guest details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Guest Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || 'The guest record could not be found.'}</p>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
          </Button>
        </div>
      </div>
    );
  }

  const { guest, stayHistory, signatures } = data;

  const age = guest.dateOfBirth
    ? Math.floor((Date.now() - new Date(guest.dateOfBirth).getTime()) / (365.25 * 86400000))
    : null;

  const totalSpent = stayHistory.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalNights = stayHistory.reduce((sum, s) => {
    const start = new Date(s.stay.checkInDate);
    const end = new Date(s.stay.checkOutDate);
    return sum + Math.max(1, Math.round((end.getTime() - start.getTime()) / (86400000)));
  }, 0);

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4 -ml-2">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back
      </Button>

      {/* ── Top Section: Name, ID Photo, Signature ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Guest Profile Card */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-5 mb-6">
            <Avatar className="h-20 w-20">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {(guest.firstName || '?')[0]}{(guest.lastName || '?')[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">
                {guest.firstName} {guest.lastName}
              </h1>
              <p className="text-sm text-muted-foreground">Guest since {new Date(guest.createdAt).toLocaleDateString()}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="secondary">{stayHistory.length} stay{stayHistory.length !== 1 ? 's' : ''}</Badge>
                <Badge variant="outline">${totalSpent.toFixed(2)} total</Badge>
              </div>
            </div>
          </div>

          {/* Personal Details */}
          <div>
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Personal Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Full Name</p>
                <p className="text-sm font-medium">{guest.firstName} {guest.lastName}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">ID Type</p>
                <p className="text-sm font-medium">{guest.idType || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">ID Number</p>
                <p className="text-sm font-medium font-mono">{guest.idNumber || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">ID State</p>
                <p className="text-sm font-medium">{guest.idState || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Date of Birth</p>
                <p className="text-sm font-medium">{guest.dateOfBirth || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Age</p>
                <p className="text-sm font-medium">{age !== null ? `${age} years` : '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Phone</p>
                <p className="text-sm font-medium">{guest.phone || '—'}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Email</p>
                <p className="text-sm font-medium">{guest.email || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ID Photo & Signature */}
        <div className="space-y-4">
          {/* ID Photo */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> ID Photo
            </h3>
            {guest.idPhotoUrl ? (
              <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                <img
                  src={guest.idPhotoUrl}
                  alt="ID Photo"
                  className="w-full max-h-48 object-contain"
                />
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-6 text-center text-muted-foreground">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs">No ID photo on file</p>
              </div>
            )}
          </div>

          {/* Signature */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <PenLine className="w-4 h-4" /> Signature
            </h3>
            {signatures.length > 0 && signatures[0].signature_data_url ? (
              <div className="border border-border rounded-lg p-3 bg-white dark:bg-zinc-100">
                <img
                  src={signatures[0].signature_data_url}
                  alt="Guest Signature"
                  className="max-h-24 object-contain mix-blend-multiply"
                />
              </div>
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 text-center text-muted-foreground">
                <PenLine className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">No signature on file</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Stay History Table ── */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Stay History
        </h2>

        {stayHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No stays recorded for this guest.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="uppercase text-[10px]">Room</TableHead>
                  <TableHead className="uppercase text-[10px]">Type</TableHead>
                  <TableHead className="uppercase text-[10px]">Check-In</TableHead>
                  <TableHead className="uppercase text-[10px]">Check-Out</TableHead>
                  <TableHead className="uppercase text-[10px]">Nights</TableHead>
                  <TableHead className="uppercase text-[10px]">Rate</TableHead>
                  <TableHead className="uppercase text-[10px] text-right">Total Paid</TableHead>
                  <TableHead className="uppercase text-[10px] text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stayHistory.map(({ stay, room, payments: stayPayments, totalPaid }) => {
                  const start = new Date(stay.checkInDate);
                  const end = new Date(stay.checkOutDate);
                  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (86400000)));

                  return (
                    <TableRow key={stay.id}>
                      <TableCell className="font-medium">#{room.roomNumber}</TableCell>
                      <TableCell>
                        {room.type === '1-bed' ? (
                          <span className="flex items-center gap-1"><BedSingle className="w-3 h-3" /> 1-Bed King</span>
                        ) : (
                          <span className="flex items-center gap-1"><BedDouble className="w-3 h-3" /> 2-Bed Queen</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{stay.checkInDate}</p>
                        <p className="text-[11px] text-muted-foreground">{stay.checkInTime}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{stay.checkOutDate}</p>
                        <p className="text-[11px] text-muted-foreground">{stay.checkOutTime}</p>
                      </TableCell>
                      <TableCell className="text-sm">{nights}</TableCell>
                      <TableCell className="text-sm">${stay.rateAmount}/night</TableCell>
                      <TableCell className="text-right text-sm font-semibold">${totalPaid.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={stay.status === 'checked_out' ? 'outline' : stay.status === 'active' ? 'secondary' : 'destructive'}
                          className="text-[10px]"
                        >
                          {stay.status === 'checked_out' ? 'Checked Out' : stay.status === 'active' ? 'Active' : 'Cancelled'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Summary footer */}
        {stayHistory.length > 0 && (
          <>
<Separator className="my-4" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total stays</span>
              <span className="font-medium">{stayHistory.length}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total nights</span>
              <span className="font-medium">{totalNights}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Total paid</span>
              <span className="font-semibold">${totalSpent.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}