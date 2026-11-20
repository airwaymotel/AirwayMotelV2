'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, User, Phone, Mail, Calendar, BedSingle, BedDouble,
  Shield, CreditCard, Banknote, Wallet, ImageIcon, PenLine,
  CheckCircle, Clock, AlertTriangle, Loader2, FileText, Printer,
  Receipt, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import InitialsAvatar from '@/components/ui/initials-avatar';
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
  companionGuests: Guest[];
  isTwoGuests: boolean;
}

interface GuestDetails {
  guest: Guest;
  companionGuests: Guest[];
  stayHistory: StayDetail[];
  signatures: SignatureRecord[];
  companionSignatures: SignatureRecord[];
  targetStay?: Stay;
  targetRoom?: Room;
}

function GuestProfileCard({
  guest,
  roleLabel,
  badgeVariant = 'secondary',
}: {
  guest: Guest;
  roleLabel: string;
  badgeVariant?: 'secondary' | 'outline' | 'default';
}) {
  const age = guest.dateOfBirth
    ? Math.floor((Date.now() - new Date(guest.dateOfBirth).getTime()) / (365.25 * 86400000))
    : null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-4 mb-4">
        <InitialsAvatar
          name={`${guest.firstName} ${guest.lastName}`}
          className="h-14 w-14 text-base"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold truncate">
              {guest.firstName} {guest.lastName}
            </h3>
            <Badge variant={badgeVariant} className="text-xs">
              {roleLabel}
            </Badge>
          </div>
          {guest.createdAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Guest since {new Date(guest.createdAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      <Separator className="my-3" />

      <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5" /> Personal Details
      </h4>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">ID Type</p>
          <p className="font-medium text-xs mt-0.5">{guest.idType || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">ID Number</p>
          <p className="font-medium font-mono text-xs mt-0.5">{guest.idNumber || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">ID State</p>
          <p className="font-medium text-xs mt-0.5">{guest.idState || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Date of Birth</p>
          <p className="font-medium text-xs mt-0.5">{guest.dateOfBirth || '—'} {age !== null ? `(${age} yrs)` : ''}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Phone</p>
          <p className="font-medium text-xs mt-0.5">{guest.phone || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase font-semibold">Email</p>
          <p className="font-medium text-xs truncate mt-0.5" title={guest.email}>{guest.email || '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function GuestDetailsPage() {
  const params = useParams();
  const router = useRouter();
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

      // Check for stayId in URL query string if launched from Guest History row
      const queryStayId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('stayId')
        : null;

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

          const { data: rawStayRows, error: stayError } = await supabase
            .from('stays')
            .select('*, rooms(*), payments(*)')
            .eq('guest_id', guestId)
            .order('created_at', { ascending: false });

          if (stayError) throw stayError;
          const stayRows = [...(rawStayRows || [])];

          // Check if guest was a companion guest in other stays
          try {
            const { data: memberRows } = await supabase
              .from('stay_guest_members')
              .select('stay_id')
              .eq('guest_id', guestId);
            if (memberRows && memberRows.length > 0) {
              const currentIds = new Set(stayRows.map((s: any) => s.id));
              const companionStayIds = memberRows.map((m: any) => m.stay_id).filter((id: string) => !currentIds.has(id));
              if (companionStayIds.length > 0) {
                const { data: compStays } = await supabase
                  .from('stays')
                  .select('*, rooms(*), payments(*)')
                  .in('id', companionStayIds);
                if (compStays) {
                  stayRows.push(...compStays);
                }
              }
            }
          } catch {
            // stay_guest_members table might not exist yet
          }

          // Fetch companion guests and signatures for these stays
          const stayIds = stayRows.map((s: any) => s.id);
          const companionGuestsMap: Record<string, Guest[]> = {};
          let allCompanionGuests: Guest[] = [];
          let companionSignatures: SignatureRecord[] = [];

          if (stayIds.length > 0) {
            try {
              const { data: allMembers } = await supabase
                .from('stay_guest_members')
                .select('stay_id, guest_id, is_primary')
                .in('stay_id', stayIds);

              const otherGuestIds = new Set<string>();

              if (allMembers && allMembers.length > 0) {
                allMembers.forEach((m: any) => {
                  if (m.guest_id !== guestId) {
                    otherGuestIds.add(m.guest_id);
                  }
                });
              }

              // Also check stays where guest_id !== guestId
              stayRows.forEach((s: any) => {
                if (s.guest_id && s.guest_id !== guestId) {
                  otherGuestIds.add(s.guest_id);
                }
              });

              if (otherGuestIds.size > 0) {
                const { data: compRows } = await supabase
                  .from('guests')
                  .select('*')
                  .in('id', Array.from(otherGuestIds));

                if (compRows && compRows.length > 0) {
                  const compMapById: Record<string, Guest> = {};
                  compRows.forEach((cg: any) => {
                    const compGuest: Guest = {
                      id: cg.id as string,
                      firstName: (cg.first_name as string) || '',
                      lastName: (cg.last_name as string) || '',
                      phone: (cg.phone as string) || '',
                      email: (cg.email as string) || '',
                      idNumber: (cg.id_number as string) || '',
                      dateOfBirth: cg.date_of_birth ? String(cg.date_of_birth) : '',
                      idPhotoUrl: (cg.id_photo_url as string) || '',
                      idType: (cg.id_type as string) || '',
                      idState: (cg.id_state as string) || '',
                      createdAt: cg.created_at as string,
                    };
                    compMapById[cg.id] = compGuest;
                    allCompanionGuests.push(compGuest);
                  });

                  allMembers?.forEach((m: any) => {
                    if (m.guest_id !== guestId && compMapById[m.guest_id]) {
                      if (!companionGuestsMap[m.stay_id]) companionGuestsMap[m.stay_id] = [];
                      if (!companionGuestsMap[m.stay_id].some((g) => g.id === m.guest_id)) {
                        companionGuestsMap[m.stay_id].push(compMapById[m.guest_id]);
                      }
                    }
                  });

                  stayRows.forEach((s: any) => {
                    if (s.guest_id && s.guest_id !== guestId && compMapById[s.guest_id]) {
                      if (!companionGuestsMap[s.id]) companionGuestsMap[s.id] = [];
                      if (!companionGuestsMap[s.id].some((g) => g.id === s.guest_id)) {
                        companionGuestsMap[s.id].push(compMapById[s.guest_id]);
                      }
                    }
                  });

                  const { data: compSigs } = await supabase
                    .from('signatures')
                    .select('*')
                    .in('guest_id', Array.from(otherGuestIds))
                    .order('signed_at', { ascending: false });

                  if (compSigs) {
                    companionSignatures = compSigs.map((s: any) => ({
                      id: s.id as string,
                      stay_id: s.stay_id as string,
                      guest_id: s.guest_id as string,
                      signature_data_url: (s.signature_data_url as string) || '',
                      signed_at: s.signed_at as string,
                    }));
                  }
                }
              }
            } catch {
              // fallback
            }
          }

          // Fallback check from store
          stays.forEach((s) => {
            if (s.id && stayIds.includes(s.id)) {
              if (s.companionGuestIds && s.companionGuestIds.length > 0) {
                s.companionGuestIds.forEach((cId) => {
                  if (cId !== guestId) {
                    const comp = guests.find((g) => g.id === cId);
                    if (comp) {
                      if (!companionGuestsMap[s.id]) companionGuestsMap[s.id] = [];
                      if (!companionGuestsMap[s.id].some((g) => g.id === comp.id)) {
                        companionGuestsMap[s.id].push(comp);
                      }
                      if (!allCompanionGuests.some((g) => g.id === comp.id)) {
                        allCompanionGuests.push(comp);
                      }
                    }
                  }
                });
              }
              if (s.guestId && s.guestId !== guestId) {
                const primary = guests.find((g) => g.id === s.guestId);
                if (primary) {
                  if (!companionGuestsMap[s.id]) companionGuestsMap[s.id] = [];
                  if (!companionGuestsMap[s.id].some((g) => g.id === primary.id)) {
                    companionGuestsMap[s.id].push(primary);
                  }
                  if (!allCompanionGuests.some((g) => g.id === primary.id)) {
                    allCompanionGuests.push(primary);
                  }
                }
              }
            }
          });

          const stayDetails: StayDetail[] = (stayRows || []).map((row) => {
            const r = row.rooms as Record<string, unknown>;
            const room: Room = {
              id: r.id as string,
              roomNumber: (r.room_number as string) || '',
              type: (r.type as Room['type']) || '1-bed',
              rate: (r.rate as number) || (r.type === '2-bed' ? 100 : 80),
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
              createdAt: row.created_at as string,
              guestCount: row.guest_count || 1,
            };

            const companions = companionGuestsMap[row.id] || [];
            const isTwo = companions.length > 0 || (stay.guestCount ?? 1) > 1;

            return { stay, room, payments: pmts, totalPaid, companionGuests: companions, isTwoGuests: isTwo };
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

          // Determine target stay (if passed in query or fallback to newest)
          const targetDetail = queryStayId
            ? stayDetails.find((sd) => sd.stay.id === queryStayId)
            : stayDetails[0];

          const targetCompanions = targetDetail
            ? targetDetail.companionGuests
            : allCompanionGuests;

          setData({
            guest,
            companionGuests: targetCompanions,
            stayHistory: stayDetails,
            signatures,
            companionSignatures,
            targetStay: targetDetail?.stay,
            targetRoom: targetDetail?.room,
          });
        } else {
          // Fallback: build from local store
          const guest = guests.find((g) => g.id === guestId);
          if (!guest) {
            setError('Guest not found');
            setLoading(false);
            return;
          }

          const guestStays = stays.filter((s) => s.guestId === guestId || s.companionGuestIds?.includes(guestId));
          const companionGuestsMap: Record<string, Guest[]> = {};
          let allCompanionGuests: Guest[] = [];

          const stayDetails: StayDetail[] = guestStays.map((stay) => {
            const room = rooms.find((r) => r.id === stay.roomId)!;
            const stayPayments = payments.filter((p) => p.stayId === stay.id);
            const totalPaid = stayPayments.reduce((sum, p) => sum + p.amount, 0);

            const comps: Guest[] = [];
            if (stay.companionGuestIds && stay.companionGuestIds.length > 0) {
              stay.companionGuestIds.forEach((cId) => {
                if (cId !== guestId) {
                  const comp = guests.find((g) => g.id === cId);
                  if (comp) {
                    comps.push(comp);
                    if (!allCompanionGuests.some((g) => g.id === comp.id)) allCompanionGuests.push(comp);
                  }
                }
              });
            }
            if (stay.guestId && stay.guestId !== guestId) {
              const primary = guests.find((g) => g.id === stay.guestId);
              if (primary) {
                comps.push(primary);
                if (!allCompanionGuests.some((g) => g.id === primary.id)) allCompanionGuests.push(primary);
              }
            }

            companionGuestsMap[stay.id] = comps;
            const isTwo = comps.length > 0 || (stay.guestCount ?? 1) > 1;

            return { stay, room, payments: stayPayments, totalPaid, companionGuests: comps, isTwoGuests: isTwo };
          });

          const targetDetail = queryStayId
            ? stayDetails.find((sd) => sd.stay.id === queryStayId)
            : stayDetails[0];

          setData({
            guest,
            companionGuests: targetDetail ? targetDetail.companionGuests : allCompanionGuests,
            stayHistory: stayDetails,
            signatures: [],
            companionSignatures: [],
            targetStay: targetDetail?.stay,
            targetRoom: targetDetail?.room,
          });
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

  const { guest, companionGuests, stayHistory, signatures, companionSignatures, targetStay, targetRoom } = data;
  const isTwoPeople = companionGuests.length > 0;

  const age = guest.dateOfBirth
    ? Math.floor((Date.now() - new Date(guest.dateOfBirth).getTime()) / (365.25 * 86400000))
    : null;

  const totalSpent = stayHistory.reduce((sum, s) => sum + s.totalPaid, 0);
  const totalNights = stayHistory.reduce((sum, s) => {
    const start = new Date(s.stay.checkInDate);
    const end = new Date(s.stay.checkOutDate);
    return sum + Math.max(1, Math.round((end.getTime() - start.getTime()) / (86400000)));
  }, 0);

  const hasCash = targetStay && stayHistory.find(s => s.stay.id === targetStay.id)?.payments.some(p => p.method === 'cash');

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* ── Top Bar: Navigation & Quick Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="-ml-2 w-fit">
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
        </Button>

        {targetStay && (
          <div className="flex items-center gap-2 flex-wrap">
            {hasCash && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs border-green-500/30 text-green-600 hover:bg-green-500/10 hover:text-green-700"
                onClick={() => window.open(`/stay/${targetStay.id}/invoice?download=true`, '_blank')}
              >
                <Receipt className="w-3.5 h-3.5 mr-1.5" /> Cash Receipt
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => window.open(`/stay/${targetStay.id}/print`, '_blank')}
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" /> Print Form
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-8 text-xs"
              onClick={() => router.push(`/stay/${targetStay.id}`)}
            >
              <Calendar className="w-3.5 h-3.5 mr-1.5" /> View Stay Details
            </Button>
          </div>
        )}
      </div>

      {/* ── Header Title & Stats ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
            {guest.firstName} {guest.lastName}
            {companionGuests.map((cg) => ` & ${cg.firstName} ${cg.lastName}`)}
          </h1>
          {isTwoPeople ? (
            <Badge
              variant="outline"
              className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-semibold"
            >
              <Users className="w-3 h-3 mr-1 inline" /> 2 Guests (Couple / Pair)
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              <User className="w-3 h-3 mr-1 inline" /> Solo Guest
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground mt-1">
          {targetRoom ? (
            <span>
              Stay in Room #{targetRoom.roomNumber} ({targetStay?.checkInDate} to {targetStay?.checkOutDate}) &middot;{' '}
            </span>
          ) : null}
          Total: {stayHistory.length} stay{stayHistory.length !== 1 ? 's' : ''} &middot; {totalNights} nights &middot; ${totalSpent.toFixed(2)} total paid
        </p>
      </div>

      {/* ── Guest Profile Cards ── */}
      {isTwoPeople ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <GuestProfileCard
            guest={guest}
            roleLabel="Guest 1 (Primary)"
            badgeVariant="default"
          />
          {companionGuests.map((comp) => (
            <GuestProfileCard
              key={comp.id}
              guest={comp}
              roleLabel="Guest 2 (Companion)"
              badgeVariant="secondary"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Solo Guest Profile Card */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-6">
            <div className="flex items-start gap-5 mb-6">
              <InitialsAvatar
                name={`${guest.firstName} ${guest.lastName}`}
                className="h-20 w-20"
              />
              <div className="flex-1">
                <h2 className="text-2xl font-bold">
                  {guest.firstName} {guest.lastName}
                </h2>
                <p className="text-sm text-muted-foreground">Guest since {new Date(guest.createdAt).toLocaleDateString()}</p>
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary">{stayHistory.length} stay{stayHistory.length !== 1 ? 's' : ''}</Badge>
                  <Badge variant="outline">${totalSpent.toFixed(2)} total</Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" /> Personal Details
              </h3>
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

          {/* ID Photo & Signature for Solo Guest */}
          <div className="space-y-4">
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

            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                <PenLine className="w-4 h-4" /> Signature
              </h3>
              {signatures.length > 0 && signatures[0].signature_data_url ? (
                <div className="border border-border rounded-lg p-3 bg-white dark:bg-zinc-100 flex items-center justify-center">
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
      )}

      {/* ── Dual ID Photos & Dual Signatures (when 2 guests) ── */}
      {isTwoPeople && (
        <>
          {/* ID Photos */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Scanned ID Photos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Guest 1 Photo */}
              <div className="border border-border/80 rounded-xl p-4 bg-muted/10">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Guest 1 (Primary): {guest.firstName} {guest.lastName}
                </p>
                {guest.idPhotoUrl ? (
                  <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                    <img
                      src={guest.idPhotoUrl}
                      alt={`${guest.firstName} ID Photo`}
                      className="w-full max-h-56 object-contain"
                    />
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-8 text-center text-muted-foreground">
                    <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No ID photo on file</p>
                  </div>
                )}
              </div>

              {/* Guest 2 Photo */}
              {companionGuests.map((comp, idx) => (
                <div key={comp.id || idx} className="border border-border/80 rounded-xl p-4 bg-muted/10">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Guest {idx + 2} (Companion): {comp.firstName} {comp.lastName}
                  </p>
                  {comp.idPhotoUrl ? (
                    <div className="rounded-lg overflow-hidden border border-border bg-muted/20">
                      <img
                        src={comp.idPhotoUrl}
                        alt={`${comp.firstName} ID Photo`}
                        className="w-full max-h-56 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-lg p-8 text-center text-muted-foreground">
                      <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs">No ID photo on file</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Signatures */}
          <div className="bg-card border border-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold uppercase text-muted-foreground mb-4 flex items-center gap-2">
              <PenLine className="w-4 h-4" /> Digital Signatures
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Guest 1 Signature */}
              <div className="border border-border/80 rounded-xl p-4 bg-muted/10">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Guest 1: {guest.firstName} {guest.lastName}
                </p>
                {signatures.length > 0 && signatures[0].signature_data_url ? (
                  <div className="border border-border rounded-lg p-3 bg-white dark:bg-zinc-100 flex items-center justify-center">
                    <img
                      src={signatures[0].signature_data_url}
                      alt={`${guest.firstName} Signature`}
                      className="max-h-24 object-contain mix-blend-multiply"
                    />
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded-lg p-6 text-center text-muted-foreground">
                    <PenLine className="w-6 h-6 mx-auto mb-1 opacity-40" />
                    <p className="text-xs">No signature on file</p>
                  </div>
                )}
              </div>

              {/* Guest 2 Signature */}
              {companionGuests.map((comp, idx) => {
                const compSig = companionSignatures.find((s) => s.guest_id === comp.id);
                return (
                  <div key={comp.id || idx} className="border border-border/80 rounded-xl p-4 bg-muted/10">
                    <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Guest {idx + 2}: {comp.firstName} {comp.lastName}
                    </p>
                    {compSig && compSig.signature_data_url ? (
                      <div className="border border-border rounded-lg p-3 bg-white dark:bg-zinc-100 flex items-center justify-center">
                        <img
                          src={compSig.signature_data_url}
                          alt={`${comp.firstName} Signature`}
                          className="max-h-24 object-contain mix-blend-multiply"
                        />
                      </div>
                    ) : (
                      <div className="bg-muted/30 rounded-lg p-6 text-center text-muted-foreground">
                        <PenLine className="w-6 h-6 mx-auto mb-1 opacity-40" />
                        <p className="text-xs">No signature on file</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

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
                  <TableHead className="uppercase text-[10px]">Guests & Room Type</TableHead>
                  <TableHead className="uppercase text-[10px]">Check-In</TableHead>
                  <TableHead className="uppercase text-[10px]">Check-Out</TableHead>
                  <TableHead className="uppercase text-[10px]">Nights</TableHead>
                  <TableHead className="uppercase text-[10px]">Rate</TableHead>
                  <TableHead className="uppercase text-[10px] text-right">Total Paid</TableHead>
                  <TableHead className="uppercase text-[10px] text-center">Status</TableHead>
                  <TableHead className="uppercase text-[10px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stayHistory.map(({ stay, room, payments: stayPayments, totalPaid, companionGuests: rowCompanions, isTwoGuests: rowIsTwo }) => {
                  const start = new Date(stay.checkInDate);
                  const end = new Date(stay.checkOutDate);
                  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (86400000)));

                  return (
                    <TableRow key={stay.id}>
                      <TableCell className="font-medium">#{room.roomNumber}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {room.type === '1-bed' ? (
                            <span className="flex items-center gap-1 text-xs"><BedSingle className="w-3 h-3" /> 1-Bed King</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs"><BedDouble className="w-3 h-3" /> 2-Bed Queen</span>
                          )}
                          {rowIsTwo && (
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 px-1.5 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 font-semibold"
                            >
                              2 Guests
                            </Badge>
                          )}
                        </div>
                        {rowCompanions && rowCompanions.length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            + {rowCompanions.map((cg) => `${cg.firstName} ${cg.lastName}`).join(', ')}
                          </p>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] font-medium"
                            onClick={() => router.push(`/stay/${stay.id}`)}
                            title="View Stay Details"
                          >
                            Stay
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[11px] font-medium text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-950"
                            onClick={() => window.open(`/stay/${stay.id}/print`, '_blank')}
                            title="Print Registration PDF"
                          >
                            <FileText className="w-3 h-3 mr-1" />
                            Registration
                          </Button>
                        </div>
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
