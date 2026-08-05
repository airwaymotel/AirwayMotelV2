'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMotelStore } from '@/lib/store';
import type { Guest, Room, Stay, Payment } from '@/lib/types';
import { jsPDF } from 'jspdf';

interface PrintData {
  stay: Stay;
  guest: Guest;
  room: Room;
  payments: Payment[];
}

function generateReceiptPdf(data: PrintData): jsPDF {
  const { stay, guest, room, payments } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });

  const pageWidth = 215.9;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const cashPayments = payments.filter(p => p.method === 'cash');
  const totalCashPaid = cashPayments.reduce((sum, p) => sum + p.amount, 0);
  const cardPayments = payments.filter(p => p.method === 'card');
  const totalCardPaid = cardPayments.reduce((sum, p) => sum + p.amount, 0);

  const start = new Date(stay.checkInDate);
  const end = new Date(stay.checkOutDate);
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const roomTotal = stay.rateAmount * nights;

  // ── Header ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(9, 9, 11);
  doc.text('RECEIPT', margin, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(161, 161, 170);
  doc.text('AIRWAY MOTEL — GUEST RECEIPT', margin, y + 11);

  // Motel info (right side)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(217, 119, 6);
  doc.text('Airway Motel', pageWidth - margin, y + 4, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text('123 Motel Way', pageWidth - margin, y + 9, { align: 'right' });
  doc.text('Denver, CO 80202', pageWidth - margin, y + 13, { align: 'right' });
  doc.text('(555) 123-4567', pageWidth - margin, y + 17, { align: 'right' });

  // Divider
  y += 24;
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Guest & Stay Info ──
  // Guest (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(161, 161, 170);
  doc.text('GUEST', margin, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(39, 39, 42);
  doc.text(`${guest.firstName || ''} ${guest.lastName || ''}`, margin, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(82, 82, 91);
  doc.text(`ID: ${guest.idNumber || 'N/A'}`, margin, y + 11);
  doc.text(`Phone: ${guest.phone || 'N/A'}`, margin, y + 15.5);

  // Stay details (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(161, 161, 170);
  doc.text('STAY DETAILS', pageWidth - margin, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(39, 39, 42);
  doc.text(`Room #${room.roomNumber || ''}`, pageWidth - margin, y + 6, { align: 'right' });
  doc.setTextColor(82, 82, 91);
  doc.text(`Check In: ${stay.checkInDate || ''}`, pageWidth - margin, y + 11, { align: 'right' });
  doc.text(`Check Out: ${stay.checkOutDate || ''}`, pageWidth - margin, y + 15.5, { align: 'right' });
  doc.text(`${nights} Night${nights > 1 ? 's' : ''}`, pageWidth - margin, y + 20, { align: 'right' });

  y += 28;

  // ── Charges Table ──
  doc.setDrawColor(39, 39, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(39, 39, 42);
  doc.text('DESCRIPTION', margin, y);
  doc.text('AMOUNT', pageWidth - margin, y, { align: 'right' });
  y += 6;

  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(39, 39, 42);
  doc.text(`Room Charge (${nights} Night${nights > 1 ? 's' : ''} x $${stay.rateAmount})`, margin, y);
  doc.text(`$${roomTotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 8;

  // ── Total ──
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Subtotal', margin, y);
  doc.text(`$${roomTotal.toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
  y += 7;

  // Total box
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y - 2, contentWidth, 10, 'F');
  doc.setDrawColor(39, 39, 42);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 8, pageWidth - margin, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL', margin + 3, y + 5);
  doc.text(`$${roomTotal.toFixed(2)}`, pageWidth - margin - 3, y + 5, { align: 'right' });
  y += 16;

  // ── Payment Info ──
  if (totalCashPaid > 0) {
    doc.setFillColor(240, 253, 244);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text('CASH PAYMENT RECEIVED', pageWidth / 2, y + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(21, 128, 61);
    doc.text(`Amount: $${totalCashPaid.toFixed(2)}`, pageWidth / 2, y + 9, { align: 'center' });
    y += 16;
  }

  if (totalCardPaid > 0) {
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'F');
    doc.setDrawColor(191, 219, 254);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175);
    doc.text('CARD PAYMENT RECEIVED', pageWidth / 2, y + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(29, 78, 216);
    doc.text(`Amount: $${totalCardPaid.toFixed(2)}`, pageWidth / 2, y + 9, { align: 'center' });
    y += 16;
  }

  // ── Footer ──
  const footerY = 255;
  doc.setDrawColor(229, 229, 229);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(161, 161, 170);
  doc.text('Thank you for staying with Airway Motel!', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.text('Please retain this receipt for your records.', pageWidth / 2, footerY + 10, { align: 'center' });

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
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    async function load() {
      if (!stayId) return;
      try {
        // Try Supabase first with joined query
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

        // Fallback to local store
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

  // Generate and download PDF when data loads
  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        try {
          const doc = generateReceiptPdf(data);
          const fileName = `receipt_${data.guest.lastName || 'guest'}_${data.room.roomNumber || 'room'}.pdf`;
          doc.save(fileName);
          setGenerating(false);
          setTimeout(() => window.close(), 2000);
        } catch (err) {
          console.error('PDF generation error:', err);
          setError('Failed to generate PDF');
          setGenerating(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        background: '#fafafa',
      }}>
        <p style={{ color: '#dc2626', fontWeight: 500 }}>{error}</p>
        <button
          onClick={() => window.close()}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: '#18181b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Close
        </button>
      </div>
    );
  }

  if (generating) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        fontFamily: 'sans-serif',
        background: '#fafafa',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid #e5e5e5',
          borderTopColor: '#d97706',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ marginTop: '16px', color: '#71717a', fontSize: '14px' }}>Generating PDF receipt...</p>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'sans-serif',
      background: '#fafafa',
    }}>
      <div style={{
        background: 'white',
        padding: '32px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>&#10003;</div>
        <p style={{ fontWeight: 600, color: '#18181b', marginBottom: '4px' }}>PDF Downloaded!</p>
        <p style={{ color: '#71717a', fontSize: '13px' }}>Check your downloads folder.</p>
        <button
          onClick={() => window.close()}
          style={{
            marginTop: '16px',
            padding: '8px 20px',
            background: '#18181b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Close Tab
        </button>
      </div>
    </div>
  );
}
