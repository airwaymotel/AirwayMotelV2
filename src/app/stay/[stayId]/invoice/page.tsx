'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMotelStore } from '@/lib/store';
import type { Guest, Room, Stay, Payment } from '@/lib/types';
import { jsPDF } from 'jspdf';
import { Loader2 } from 'lucide-react';

interface PrintData {
  stay: Stay;
  guest: Guest;
  room: Room;
  payments: Payment[];
}

function generateReceiptPdf(data: PrintData): jsPDF {
  const { stay, guest, room, payments } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageWidth = 210;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const centerX = pageWidth / 2;
  let y = 25;

  const asteriskLine = '***************************************';

  const cashPayments = payments.filter(p => p.method === 'cash');
  const totalCashPaid = cashPayments.reduce((sum, p) => sum + p.amount, 0);
  const cardPayments = payments.filter(p => p.method === 'card');
  const totalCardPaid = cardPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = totalCashPaid + totalCardPaid;

  const start = new Date(stay.checkInDate);
  const end = new Date(stay.checkOutDate);
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const roomTotal = stay.rateAmount * nights;

  // ══════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════
  doc.setFont('courier', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('AIRWAY MOTEL', centerX, y, { align: 'center' });
  y += 7;

  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('8339 E Colfax Ave, Denver, CO 80220', centerX, y, { align: 'center' });
  y += 5;
  doc.text('Tel. (303) 420-8998', centerX, y, { align: 'center' });
  y += 7;

  // Asterisk divider
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(asteriskLine, centerX, y, { align: 'center' });
  y += 7;

  // CASH RECEIPT heading
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.text('CASH RECEIPT', centerX, y, { align: 'center' });
  y += 7;

  // Asterisk divider
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.text(asteriskLine, centerX, y, { align: 'center' });
  y += 10;

  // ══════════════════════════════════════════
  // GUEST & STAY INFO
  // ══════════════════════════════════════════
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  doc.text(`Guest: ${guest.firstName || ''} ${guest.lastName || ''}`, margin, y);
  y += 5;
  doc.text(`Room: #${room.roomNumber || 'N/A'}`, margin, y);
  y += 5;
  doc.text(`Check-In:  ${stay.checkInDate || ''}  ${stay.checkInTime || ''}`, margin, y);
  y += 5;
  doc.text(`Check-Out: ${stay.checkOutDate || ''}  ${stay.checkOutTime || ''}`, margin, y);
  y += 5;
  doc.text(`Nights: ${nights}`, margin, y);
  y += 8;

  // ══════════════════════════════════════════
  // LINE ITEMS
  // ══════════════════════════════════════════
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('Description', margin, y);
  doc.text('Price', pageWidth - margin, y, { align: 'right' });
  y += 3;

  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.text('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -', centerX, y, { align: 'center' });
  y += 6;

  // Room charge line item
  doc.text(`Room (${nights} night${nights > 1 ? 's' : ''} x $${stay.rateAmount})`, margin, y);
  doc.text(`$${roomTotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 6;

  doc.text('- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -', centerX, y, { align: 'center' });
  y += 8;

  // ══════════════════════════════════════════
  // FINANCIAL SUMMARY
  // ══════════════════════════════════════════
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL', margin, y);
  doc.text(`$${roomTotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 7;

  doc.setFont('courier', 'normal');
  doc.setFontSize(10);

  if (totalCashPaid > 0) {
    doc.text('Cash', margin, y);
    doc.text(`$${totalCashPaid.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  if (totalCardPaid > 0) {
    doc.text('Card', margin, y);
    doc.text(`$${totalCardPaid.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  const change = totalPaid - roomTotal;
  if (change > 0) {
    doc.setFont('courier', 'bold');
    doc.text('Change', margin, y);
    doc.text(`$${change.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  y += 3;
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.text(asteriskLine, centerX, y, { align: 'center' });
  y += 8;

  // ══════════════════════════════════════════
  // PAYMENT META DETAILS
  // ══════════════════════════════════════════
  if (totalCardPaid > 0) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text('Payment Method', margin, y);
    doc.text('Card', pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  if (totalCashPaid > 0) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text('Payment Method', margin, y);
    doc.text('Cash', pageWidth - margin, y, { align: 'right' });
    y += 5;
  }

  doc.text('Date', margin, y);
  doc.text(stay.checkOutDate || '', pageWidth - margin, y, { align: 'right' });
  y += 5;

  doc.text('Time', margin, y);
  doc.text(stay.checkOutTime || '', pageWidth - margin, y, { align: 'right' });
  y += 5;

  doc.text('Receipt #', margin, y);
  doc.text(stay.id ? stay.id.slice(0, 8).toUpperCase() : 'N/A', pageWidth - margin, y, { align: 'right' });
  y += 8;

  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.text(asteriskLine, centerX, y, { align: 'center' });
  y += 10;

  // ══════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════
  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text('THANK YOU!', centerX, y, { align: 'center' });
  y += 7;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Please retain this receipt for your records.', centerX, y, { align: 'center' });
  y += 10;

  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(asteriskLine, centerX, y, { align: 'center' });

  return doc;
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

  // Generate PDF and auto-download
  useEffect(() => {
    if (data) {
      try {
        const doc = generateReceiptPdf(data);
        const fileName = `${data.guest.firstName || ''} ${data.guest.lastName || ''}`.trim() || 'Guest';
        doc.save(`${fileName}.Receipt.pdf`);
        window.close();
      } catch (err) {
        console.error('PDF generation error:', err);
        setError('Failed to generate PDF');
      }
    }
  }, [data]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', background: '#fafafa' }}>
        <p style={{ color: '#dc2626', fontWeight: 500 }}>{error}</p>
        <button onClick={() => window.close()} style={{ marginTop: '16px', padding: '8px 16px', background: '#18181b', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Close</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', background: '#fafafa' }}>
      <Loader2 style={{ width: '32px', height: '32px', animation: 'spin 0.8s linear infinite', color: '#a1a1aa' }} />
      <p style={{ marginTop: '16px', color: '#71717a', fontSize: '14px' }}>Generating receipt...</p>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
    </div>
  );
}
