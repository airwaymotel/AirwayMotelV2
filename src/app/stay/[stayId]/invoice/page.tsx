'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMotelStore } from '@/lib/store';
import type { Guest, Room, Stay, Payment } from '@/lib/types';

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
            .select('*')
            .eq('id', stayId)
            .single();

          if (!stayErr && stayRow) {
            const [{ data: guest }, { data: room }, { data: rawPmts }] = await Promise.all([
              supabase.from('guests').select('*').eq('id', stayRow.guest_id).single(),
              supabase.from('rooms').select('*').eq('id', stayRow.room_id).single(),
              supabase.from('payments').select('*').eq('stay_id', stayId)
            ]);

            if (guest && room && rawPmts) {
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
        }

        // Fallback
        const stay = stays.find((s) => s.id === stayId);
        if (!stay) throw new Error('Not found');
        const guest = guests.find((g) => g.id === stay.guestId);
        const room = rooms.find((r) => r.id === stay.roomId);
        const stayPayments = payments.filter((p) => p.stayId === stayId);

        if (!guest || !room) throw new Error('Missing data');

        setData({ stay, guest, room, payments: stayPayments });
      } catch (err) {
        console.error(err);
        setError('Failed to load receipt details');
      }
    }
    load();
  }, [stayId, stays, guests, rooms, payments]);

  // Auto-trigger print dialog after data loads
  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (error) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <p style={{ color: '#dc2626' }}>{error}</p>
        <button onClick={() => window.close()} style={{ marginTop: '16px', textDecoration: 'underline' }}>
          Close
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { stay, guest, room, payments: pmts } = data;
  const cashPayments = pmts.filter(p => p.method === 'cash');
  const totalCashPaid = cashPayments.reduce((sum, p) => sum + p.amount, 0);
  const cardPayments = pmts.filter(p => p.method === 'card');
  const totalCardPaid = cardPayments.reduce((sum, p) => sum + p.amount, 0);

  const start = new Date(stay.checkInDate);
  const end = new Date(stay.checkOutDate);
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const roomTotal = stay.rateAmount * nights;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @page {
          size: letter;
          margin: 0;
        }
        @media print {
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
        }
        @media print {
          body {
            background: white;
          }
        }
      `}} />

      {/* Close button - hidden when printing */}
      <button
        className="no-print"
        onClick={() => window.close()}
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          padding: '8px 16px',
          background: '#18181b',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '500',
          zIndex: 100,
        }}
      >
        Close & Print
      </button>

      {/* Receipt - exactly one letter page */}
      <div
        id="receipt"
        style={{
          width: '8.5in',
          minHeight: '11in',
          maxHeight: '11in',
          overflow: 'hidden',
          background: 'white',
          margin: '0 auto',
          padding: '0.6in 0.7in',
          color: '#18181b',
          fontSize: '11px',
          lineHeight: '1.5',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e5e5e5', paddingBottom: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', color: '#09090b' }}>RECEIPT</div>
            <div style={{ fontSize: '9px', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>
              Airway Motel — Guest Receipt
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: '700', color: '#d97706' }}>Airway Motel</div>
            <div style={{ fontSize: '10px', color: '#52525b', lineHeight: '1.4' }}>
              123 Motel Way<br />
              Denver, CO 80202<br />
              (555) 123-4567
            </div>
          </div>
        </div>

        {/* Guest & Stay Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '8px', fontWeight: '700', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              Guest
            </div>
            <div style={{ fontWeight: '600', fontSize: '13px', color: '#27272a' }}>{guest.firstName} {guest.lastName}</div>
            <div style={{ color: '#52525b', fontSize: '10px' }}>ID: {guest.idNumber || 'N/A'}</div>
            <div style={{ color: '#52525b', fontSize: '10px' }}>Phone: {guest.phone || 'N/A'}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '8px', fontWeight: '700', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
              Stay Details
            </div>
            <div style={{ color: '#27272a', fontSize: '10px' }}>Room #{room.roomNumber}</div>
            <div style={{ color: '#52525b', fontSize: '10px' }}>Check In: {stay.checkInDate}</div>
            <div style={{ color: '#52525b', fontSize: '10px' }}>Check Out: {stay.checkOutDate}</div>
            <div style={{ color: '#52525b', fontSize: '10px' }}>{nights} Night{nights > 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* Charges */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #27272a' }}>
              <th style={{ padding: '6px 0', textAlign: 'left', fontSize: '8px', fontWeight: '700', color: '#27272a', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Description
              </th>
              <th style={{ padding: '6px 0', textAlign: 'right', fontSize: '8px', fontWeight: '700', color: '#27272a', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e5e5' }}>
              <td style={{ padding: '8px 0', color: '#27272a' }}>
                Room Charge ({nights} Night{nights > 1 ? 's' : ''} x ${stay.rateAmount})
              </td>
              <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: '500', color: '#27272a' }}>
                ${roomTotal.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Total */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <div style={{ width: '50%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e5e5e5' }}>
              <span style={{ color: '#52525b' }}>Subtotal</span>
              <span style={{ color: '#27272a' }}>${roomTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '2px solid #27272a', background: '#f5f5f5', marginTop: '4px', paddingLeft: '6px', paddingRight: '6px' }}>
              <span style={{ fontWeight: '700', fontSize: '13px', color: '#27272a' }}>Total</span>
              <span style={{ fontWeight: '700', fontSize: '13px', color: '#27272a' }}>${roomTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        {totalCashPaid > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', textAlign: 'center' }}>
            <div style={{ fontWeight: '700', color: '#166534', fontSize: '11px', marginBottom: '2px' }}>CASH PAYMENT RECEIVED</div>
            <div style={{ color: '#15803d', fontSize: '10px' }}>
              Amount: <span style={{ fontWeight: '700' }}>${totalCashPaid.toFixed(2)}</span>
            </div>
          </div>
        )}

        {totalCardPaid > 0 && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '10px 14px', marginBottom: '12px', textAlign: 'center' }}>
            <div style={{ fontWeight: '700', color: '#1e40af', fontSize: '11px', marginBottom: '2px' }}>CARD PAYMENT RECEIVED</div>
            <div style={{ color: '#1d4ed8', fontSize: '10px' }}>
              Amount: <span style={{ fontWeight: '700' }}>${totalCardPaid.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #e5e5e5', textAlign: 'center', color: '#a1a1aa', fontSize: '9px' }}>
          <p>Thank you for staying with Airway Motel!</p>
          <p style={{ marginTop: '4px' }}>Please retain this receipt for your records.</p>
        </div>
      </div>
    </>
  );
}
