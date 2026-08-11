'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMotelStore } from '@/lib/store';
import type { Guest, Room, Stay, Payment } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface PrintData {
  stay: Stay;
  guest: Guest;
  room: Room;
  payments: Payment[];
}

export default function InvoicePage() {
  const params = useParams();
  const stayId = params.stayId as string;

  const stays = useMotelStore((s) => s.stays);
  const guests = useMotelStore((s) => s.guests);
  const rooms = useMotelStore((s) => s.rooms);
  const payments = useMotelStore((s) => s.payments);

  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!stayId) return;
      try {
        if (supabase) {
          const { data: stayRow, error: stayErr } = await supabase
            .from('stays')
            .select('*, guests(*), rooms(*), payments(*)')
            .eq('id', stayId)
            .single();

          if (!stayErr && stayRow) {
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
              type: (r.type as Room['type']) || '1-bed',
              rate: r.type === '2-bed' ? 85 : 65,
              status: (r.status as Room['status']) || 'available',
            };

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
              createdAt: stayRow.created_at,
            };

            setData({ stay, guest, room, payments: pmts });
            return;
          }
        }

        const stay = stays.find((s) => s.id === stayId);
        if (!stay) throw new Error('Stay not found');
        const guest = guests.find((g) => g.id === stay.guestId);
        const room = rooms.find((r) => r.id === stay.roomId);
        const stayPayments = payments.filter((p) => p.stayId === stayId);

        if (!guest || !room) throw new Error('Missing guest or room data');

        setData({ stay, guest, room, payments: stayPayments });
      } catch (err) {
        console.error(err);
        setError('Failed to load receipt details');
      }
    }
    load();
  }, [stayId, stays, guests, rooms, payments]);

  // Auto-print after data loads
  useEffect(() => {
    if (data) {
      // Set empty title to prevent URL from showing in print header/footer
      document.title = ' ';
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => window.close()} className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading receipt...</p>
        </div>
      </div>
    );
  }

  const { stay, guest, room, payments: stayPayments } = data;
  const cashPayments = stayPayments.filter(p => p.method === 'cash');
  const totalCashPaid = cashPayments.reduce((sum, p) => sum + p.amount, 0);
  const cardPayments = stayPayments.filter(p => p.method === 'card');
  const totalCardPaid = cardPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = totalCashPaid + totalCardPaid;

  const start = new Date(stay.checkInDate);
  const end = new Date(stay.checkOutDate);
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const roomTotal = stay.rateAmount * nights;
  const change = totalPaid - roomTotal;
  const receiptId = stay.id ? stay.id.slice(0, 8).toUpperCase() : 'N/A';
  const asterisks = '***************************************';
  const dashes = '- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -';

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @page { margin: 0; }
        @media print {
          body * { visibility: hidden; }
          #receipt, #receipt * { visibility: visible; }
          #receipt { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}} />
      <div id="receipt" className="min-h-screen bg-white flex items-center justify-center p-8">
        <div style={{ width: '320px', fontFamily: 'Courier New, Courier, monospace', fontSize: '13px', color: '#000', lineHeight: '1.6' }}>
          {/* Header */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>AIRWAY MOTEL</div>
            <div style={{ fontSize: '11px', color: '#555' }}>8339 E Colfax Ave, Denver, CO 80220</div>
            <div style={{ fontSize: '11px', color: '#555' }}>Tel. (303) 420-8998</div>
            <div style={{ margin: '8px 0' }}>{asterisks}</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>CASH RECEIPT</div>
            <div style={{ margin: '8px 0' }}>{asterisks}</div>
          </div>

          {/* Guest & Stay Info */}
          <div style={{ margin: '12px 0' }}>
            <div>Guest: {guest.firstName} {guest.lastName}</div>
            <div>Room: #{room.roomNumber || 'N/A'}</div>
            <div>Check-In: {stay.checkInDate} {stay.checkInTime}</div>
            <div>Check-Out: {stay.checkOutDate} {stay.checkOutTime}</div>
            <div>Nights: {nights}</div>
          </div>

          {/* Line Items */}
          <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
            <span>Description</span>
            <span>Price</span>
          </div>
          <div style={{ textAlign: 'center', margin: '4px 0' }}>{dashes}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Room ({nights} night{nights > 1 ? 's' : ''} x ${stay.rateAmount})</span>
            <span>${roomTotal.toFixed(2)}</span>
          </div>
          <div style={{ textAlign: 'center', margin: '4px 0' }}>{dashes}</div>

          {/* Financial Summary */}
          <div style={{ margin: '12px 0' }}>
            <div style={{ fontWeight: 'bold', fontSize: '15px', display: 'flex', justifyContent: 'space-between' }}>
              <span>TOTAL</span>
              <span>${roomTotal.toFixed(2)}</span>
            </div>
            {totalCashPaid > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Cash</span>
                <span>${totalCashPaid.toFixed(2)}</span>
              </div>
            )}
            {totalCardPaid > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Card</span>
                <span>${totalCardPaid.toFixed(2)}</span>
              </div>
            )}
            {change > 0 && (
              <div style={{ fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                <span>Change</span>
                <span>${change.toFixed(2)}</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', margin: '8px 0' }}>{asterisks}</div>

          {/* Payment Meta */}
          <div style={{ fontSize: '11px' }}>
            {totalCardPaid > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Payment Method</span><span>Card</span>
              </div>
            )}
            {totalCashPaid > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Payment Method</span><span>Cash</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Date</span><span>{stay.checkOutDate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Time</span><span>{stay.checkOutTime}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Receipt #</span><span>{receiptId}</span>
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '8px 0' }}>{asterisks}</div>

          {/* Footer */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>THANK YOU!</div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>Please retain this receipt for your records.</div>
            <div style={{ margin: '8px 0' }}>{asterisks}</div>
          </div>
        </div>
      </div>
    </>
  );
}
