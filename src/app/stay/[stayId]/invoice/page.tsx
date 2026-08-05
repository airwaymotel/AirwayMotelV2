'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
  const stayId = params.stayId as string;
  const isDownload = searchParams.get('download') === 'true';

  const stays = useMotelStore((s) => s.stays);
  const guests = useMotelStore((s) => s.guests);
  const rooms = useMotelStore((s) => s.rooms);
  const payments = useMotelStore((s) => s.payments);

  const [data, setData] = useState<PrintData | null>(null);
  const [loading, setLoading] = useState(true);
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
              setLoading(false);
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
        setError('Failed to load invoice details');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [stayId, stays, guests, rooms, payments]);

  // Trigger print or download
  useEffect(() => {
    if (data) {
      const timer = setTimeout(async () => {
        if (isDownload) {
          try {
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.getElementById('pdf-content');
            const opt = {
              margin: [0.5, 0.5, 0.5, 0.5],
              filename: `invoice_${data.guest.lastName}_${data.room.roomNumber}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2 },
              jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            await html2pdf().set(opt).from(element).save();
            setTimeout(() => window.close(), 1000);
          } catch (err) {
            console.error('Failed to generate PDF', err);
            window.print();
          }
        } else {
          window.print();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [data, isDownload]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <p className="text-red-500 font-medium">{error}</p>
        <button onClick={() => window.close()} className="mt-4 text-sm underline text-muted-foreground">Close</button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { stay, guest, room, payments: pmts } = data;
  const cashPayments = pmts.filter(p => p.method === 'cash');
  const totalCashPaid = cashPayments.reduce((sum, p) => sum + p.amount, 0);

  const start = new Date(stay.checkInDate);
  const end = new Date(stay.checkOutDate);
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const roomTotal = stay.rateAmount * nights;
  const grandTotal = roomTotal;

  return (
    <div className="min-h-screen bg-zinc-100 py-8 print:py-0 print:bg-white text-black font-sans">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: auto; margin: 0mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white !important; }
        }
      `}} />

      <div id="pdf-content" className="max-w-[8.5in] mx-auto bg-white p-12 shadow-sm print:shadow-none min-h-[11in]">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-zinc-200 pb-8 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-zinc-900 mb-1">INVOICE</h1>
            <p className="text-zinc-500 text-sm font-mono uppercase tracking-wider">Receipt for Payment</p>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold text-amber-600 mb-1">Airway Motel</h2>
            <p className="text-zinc-600 text-sm">123 Motel Way</p>
            <p className="text-zinc-600 text-sm">Denver, CO 80202</p>
            <p className="text-zinc-600 text-sm">(555) 123-4567</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-12">
          {/* Bill To */}
          <div>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Billed To</h3>
            <p className="font-bold text-lg text-zinc-800">{guest.firstName} {guest.lastName}</p>
            <p className="text-zinc-600">ID: {guest.idNumber || 'N/A'}</p>
            <p className="text-zinc-600">Phone: {guest.phone || 'N/A'}</p>
          </div>
          {/* Invoice Details */}
          <div className="text-right">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Stay Details</h3>
            <p className="text-zinc-800"><span className="font-semibold">Room:</span> #{room.roomNumber}</p>
            <p className="text-zinc-800"><span className="font-semibold">Check In:</span> {stay.checkInDate}</p>
            <p className="text-zinc-800"><span className="font-semibold">Check Out:</span> {stay.checkOutDate}</p>
            <p className="text-zinc-800"><span className="font-semibold">Duration:</span> {nights} Night{nights > 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Charges Table */}
        <table className="w-full mb-8 text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-zinc-800">
              <th className="py-3 font-bold text-zinc-800 uppercase text-xs tracking-wider">Description</th>
              <th className="py-3 font-bold text-zinc-800 uppercase text-xs tracking-wider text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-zinc-200">
              <td className="py-4 text-zinc-800">Room Rate ({nights} Night{nights > 1 ? 's' : ''} @ ${stay.rateAmount}/night)</td>
              <td className="py-4 text-zinc-800 text-right font-medium">${roomTotal.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-12">
          <div className="w-1/2">
            <div className="flex justify-between py-2 border-b border-zinc-200">
              <span className="text-zinc-600 font-medium">Subtotal</span>
              <span className="font-medium text-zinc-900">${grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between py-4 border-b-2 border-zinc-800 bg-zinc-50 px-2 mt-2">
              <span className="font-bold text-lg text-zinc-900">Total Charges</span>
              <span className="font-bold text-lg text-zinc-900">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Received */}
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center">
          <h3 className="text-green-800 font-bold text-lg mb-1">PAYMENT RECEIVED IN CASH</h3>
          <p className="text-green-700">A total of <span className="font-bold">${totalCashPaid.toFixed(2)}</span> was paid via cash.</p>
          <p className="text-green-600 text-sm mt-2">Thank you for your business!</p>
        </div>

        {/* Footer */}
        <div className="mt-16 text-center text-sm text-zinc-400">
          <p>Please retain this receipt for your records.</p>
        </div>
      </div>
    </div>
  );
}
