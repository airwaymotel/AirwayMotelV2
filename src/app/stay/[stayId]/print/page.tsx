'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMotelStore } from '@/lib/store';
import type { Guest, Room, Stay, Payment } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface SignatureRecord {
  id: string;
  stay_id: string;
  guest_id: string;
  signature_data_url: string;
  signed_at: string;
}

export default function PrintRegistrationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const stayId = params.stayId as string;
  const isDownload = searchParams.get('download') === 'true';

  const stays = useMotelStore((s) => s.stays);
  const guests = useMotelStore((s) => s.guests);
  const rooms = useMotelStore((s) => s.rooms);
  const payments = useMotelStore((s) => s.payments);

  const [data, setData] = useState<{
    stay: Stay;
    guest: Guest;
    room: Room;
    payments: Payment[];
    signatures: SignatureRecord[];
  } | null>(null);

  useEffect(() => {
    async function load() {
      if (!stayId) return;

      try {
        if (supabase) {
          const { data: stayRow } = await supabase
            .from('stays')
            .select('*, guests(*), rooms(*), signatures(*), payments(*)')
            .eq('id', stayId)
            .single();

          if (stayRow) {
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
              createdAt: stayRow.created_at,
            };

            setData({ stay, guest, room, payments: pmts, signatures });
            return;
          }
        }

        // Fallback local store
        const stay = stays.find((s) => s.id === stayId);
        if (stay) {
          const guest = guests.find((g) => g.id === stay.guestId);
          const room = rooms.find((r) => r.id === stay.roomId);
          const stayPayments = payments.filter((p) => p.stayId === stayId);
          if (guest && room) {
            setData({ stay, guest, room, payments: stayPayments, signatures: [] });
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, [stayId, stays, guests, rooms, payments]);

  // Trigger print dialog or PDF download once data is loaded and rendered
  useEffect(() => {
    if (data) {
      const timer = setTimeout(async () => {
        if (isDownload) {
          try {
            // @ts-ignore
            const html2pdf = (await import('html2pdf.js')).default;
            const element = document.getElementById('pdf-content');
            const opt = {
              margin: 0.5,
              filename: `registration_${data.guest.lastName}_${data.room.roomNumber}.pdf`,
              image: { type: 'jpeg', quality: 0.98 },
              html2canvas: { scale: 2 },
              jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
            };
            await html2pdf().set(opt).from(element).save();
            setTimeout(() => window.close(), 1000); // close tab after download
          } catch (err) {
            console.error('Failed to generate PDF', err);
            window.print(); // fallback
          }
        } else {
          window.print();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [data, isDownload]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-black">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const { stay, guest, room, payments: stayPayments, signatures } = data;
  const signatureUrl = signatures.length > 0 ? signatures[0].signature_data_url : null;
  const totalAmount = stayPayments.reduce((acc, p) => acc + p.amount, 0);

  // Use inline styles and force light mode for the print layout
  return (
    <div className="bg-white text-black min-h-screen font-sans p-8 print:p-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body, html {
            background-color: white !important;
            color: black !important;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            margin: 0.5in;
          }
        }
        .form-field {
          border-bottom: 1px solid black;
          display: inline-block;
          min-width: 40px;
          text-align: center;
          font-family: monospace;
          padding: 0 4px;
        }
      `}} />

      <div id="pdf-content" className="max-w-[8in] mx-auto text-[13px] leading-relaxed bg-white">
        
        {/* Top Section */}
        <div className="flex justify-between items-start mb-6 gap-8">
          {/* ID Image */}
          <div className="w-[45%]">
            {guest.idPhotoUrl ? (
              <img 
                src={guest.idPhotoUrl} 
                alt="ID Card" 
                className="w-full h-auto border-2 border-black rounded shadow-sm max-h-48 object-cover"
              />
            ) : (
              <div className="w-full h-40 border-2 border-black border-dashed flex items-center justify-center text-gray-500 font-bold uppercase">
                ID Image Placeholder
              </div>
            )}
          </div>

          {/* Payment Box */}
          <div className="w-[50%] border-2 border-black p-4 space-y-4">
            <div className="flex items-end justify-between">
              <span className="font-bold">ROOM #</span>
              <span className="form-field w-32 text-xl font-bold">{room.roomNumber}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-bold">DAILY/WEEKLY RATE $</span>
              <span className="form-field w-32">{stay.rateAmount}</span>
            </div>
            <div className="flex items-center justify-end gap-6 pt-1">
              <label className="flex items-center gap-1 font-bold">
                CASH
                <div className="w-4 h-4 border border-black ml-1 flex items-center justify-center">
                  {stayPayments.some(p => p.method === 'cash') && '✔'}
                </div>
              </label>
              <label className="flex items-center gap-1 font-bold">
                CREDIT
                <div className="w-4 h-4 border border-black ml-1 flex items-center justify-center">
                  {stayPayments.some(p => p.method !== 'cash') && '✔'}
                </div>
              </label>
            </div>
            <div className="flex items-end justify-between pt-1">
              <span className="font-bold">TOTAL AMOUNT PAID $</span>
              <span className="form-field w-32">{totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Dates Row */}
        <div className="flex flex-wrap items-end gap-2 mb-4 font-bold text-sm">
          <span>CHECK-IN DATE</span>
          <span className="form-field flex-1 text-center">{stay.checkInDate}</span>
          <span>CHECK-IN TIME</span>
          <span className="form-field flex-1 text-center">{stay.checkInTime}</span>
          <span>CHECK-OUT DATE</span>
          <span className="form-field flex-1 text-center">{stay.checkOutDate}</span>
          <span>CHECK-OUT TIME</span>
          <span className="form-field flex-1 text-center">10 AM</span>
        </div>

        {/* Vehicle Row */}
        <div className="flex flex-wrap items-end gap-2 mb-6 font-bold text-sm">
          <span>VEHICLE INFORMATION:</span>
          <span>MAKE</span>
          <span className="form-field flex-1"></span>
          <span>MODEL</span>
          <span className="form-field flex-1"></span>
          <span>LICENSE #</span>
          <span className="form-field flex-1"></span>
          <span>COLOR</span>
          <span className="form-field flex-1"></span>
          <span>YEAR</span>
          <span className="form-field flex-1"></span>
        </div>

        {/* Agreement Text */}
        <p className="font-bold mb-4 text-justify">
          By signing below, as a guest of AIRWAY MOTEL you state that you have fully read the statements conditions below and agree to abide by them, without exception, while staying at AIRWAY MOTEL.
        </p>

        {/* Rules */}
        <ol className="list-decimal pl-6 space-y-2 mb-8 text-[12px]">
          <li>Checkout time is 10 AM on date of checkout.</li>
          <li>A fee of $10 dollars per hour will be assessed for each hour guest stays past checkout time.</li>
          <li>Guests may request refund of room rent within five (5) minutes of check-in time if room unsatisfactory. NO refunds will be given outside this time for any reason.</li>
          <li>The following WILL NOT be tolerated during your stay at AIRWAY MOTEL, for any reason: Illicit drug activity, solicitation (prostitution), illegal weapon possession, or any activities that would pose a danger to guests, staff, general public or in violation of any state/county/city municipal code.</li>
          <li>Management reserves the right to EVICT any guest or visitors AT ANY TIME, without refund, for any damage to property, harassment of other guests or staff, causing harm to others, refusal to pay rent fees, allowing/having unregistered visitors in room, participating in any illegal or suspicious activities or any other management policies/verbal directions. Any person(s) can be barred from entering AIRWAY MOTEL property at any time.</li>
          <li>Management reserves the right to enter any room at any time, for inspection, for repairs, for cleaning, pest control measures, or other actions to maintain room/facilities. Management/staff will knock before entering room.</li>
          <li>AIRWAY MOTEL, management/staff, does not/will not assume any responsibility for any, lost, stolen, or damaged personal items/valuables or vehicles. AIRWAY MOTEL, management/staff does not/will not assume any responsibility for any accident(s), personal injury or death(s) occurring on property and shall not be held liable of the for mentioned reason(s).</li>
          <li>Upon check-out, eviction, or nonpayment of room rental fee, AIRWAY MOTEL/management/staff will assume and all properties including valuables left in room/on property were left intentionally and assumes the rights to the a for mentioned items. Should guest/tenant leave by circumstances beyond their control, management at its discretion, will pack and store guest/tenant belongings for a period of 30 days at a fee of $200 dollars, paid prior to recovery of items. Note: Any items that are excessively large (furniture and appliances), non-servable, perishable, unsafe will not be stored.</li>
          <li>Any tenant who commits, conducts, facilitates, allows, permits, or fails on Airway Motel property any public nuisance as defined in section 37-50 (c) or (d) of the Denver Revised Municipal Code, or any other activity prohibited by law or the Denver Revised Municipal Code shall be subject to immediate eviction.</li>
        </ol>

        {/* Signatures */}
        <div className="space-y-8">
          <div className="flex items-end gap-2 relative">
            <span className="font-bold">GUEST SIGNATURE</span>
            <span className="form-field flex-[2] relative h-6">
              {signatureUrl && (
                <img 
                  src={signatureUrl} 
                  alt="Signature" 
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-16 object-contain pointer-events-none mix-blend-multiply"
                />
              )}
            </span>
            <span className="font-bold">DATE</span>
            <span className="form-field flex-1">{stay.checkInDate}</span>
            <span className="font-bold">PHONE #</span>
            <span className="form-field flex-1">{guest.phone}</span>
          </div>
          
          <div className="flex items-end gap-2">
            <span className="font-bold">GUEST SIGNATURE</span>
            <span className="form-field flex-[2]"></span>
            <span className="font-bold">DATE</span>
            <span className="form-field flex-1"></span>
            <span className="font-bold">PHONE #</span>
            <span className="form-field flex-1"></span>
          </div>
        </div>

      </div>
    </div>
  );
}
