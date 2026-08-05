'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useMotelStore } from '@/lib/store';
import type { Guest, Room, Stay, Payment } from '@/lib/types';
import { jsPDF } from 'jspdf';

interface SignatureRecord {
  id: string;
  stay_id: string;
  guest_id: string;
  signature_data_url: string;
  signed_at: string;
}

interface PrintData {
  stay: Stay;
  guest: Guest;
  room: Room;
  payments: Payment[];
  signatures: SignatureRecord[];
}

const TERMS = [
  'Checkout time is 10 AM on date of checkout.',
  'A fee of $10 dollars per hour will be assessed for each hour guest stays past checkout time.',
  'Guests may request refund of room rent within five (5) minutes of check-in time if room unsatisfactory. NO refunds will be given outside this time for any reason.',
  'The following WILL NOT be tolerated during your stay at AIRWAY MOTEL, for any reason: Illicit drug activity, solicitation (prostitution), illegal weapon possession, or any activities that would pose a danger to guests, staff, general public or in violation of any state/county/city municipal code.',
  'Management reserves the right to EVICT any guest or visitors AT ANY TIME, without refund, for any damage to property, harassment of other guests or staff, causing harm to others, refusal to pay rent fees, allowing/having unregistered visitors in room, participating in any illegal or suspicious activities or any other management policies/verbal directions. Any person(s) can be barred from entering AIRWAY MOTEL property at any time.',
  'Management reserves the right to enter any room at any time, for inspection, for repairs, for cleaning, pest control measures, or other actions to maintain room/facilities. Management/staff will knock before entering room.',
  'AIRWAY MOTEL, management/staff, does not/will not assume any responsibility for any, lost, stolen, or damaged personal items/valuables or vehicles. AIRWAY MOTEL, management/staff does not/will not assume any responsibility for any accident(s), personal injury or death(s) occurring on property and shall not be held liable of the for mentioned reason(s).',
  'Upon check-out, eviction, or nonpayment of room rental fee, AIRWAY MOTEL/management/staff will assume and all properties including valuables left in room/on property were left intentionally and assumes the rights to the a for mentioned items. Should guest/tenant leave by circumstances beyond their control, management at its discretion, will pack and store guest/tenant belongings for a period of 30 days at a fee of $200 dollars, paid prior to recovery of items. Note: Any items that are excessively large (furniture and appliances), non-servable, perishable, unsafe will not be stored.',
  'Any tenant who commits, conducts, facilitates, allows, permits, or fails on Airway Motel property any public nuisance as defined in section 37-50 (c) or (d) of the Denver Revised Municipal Code, or any other activity prohibited by law or the Denver Revised Municipal Code shall be subject to immediate eviction.',
];

// Fetch an image URL and convert to base64 data URL
async function imageToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function generateRegistrationPdf(data: PrintData): Promise<jsPDF> {
  const { stay, guest, room, payments, signatures } = data;
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });

  const pageWidth = 215.9;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const totalAmount = payments.reduce((acc, p) => acc + p.amount, 0);
  const hasCash = payments.some(p => p.method === 'cash');
  const hasCard = payments.some(p => p.method !== 'cash');
  const signatureUrl = signatures.length > 0 ? signatures[0].signature_data_url : null;

  // ── Load ID image if available ──
  let idImageBase64: string | null = null;
  let idImageType: 'JPEG' | 'PNG' = 'JPEG';
  if (guest.idPhotoUrl) {
    const base64 = await imageToBase64(guest.idPhotoUrl);
    if (base64) {
      idImageBase64 = base64;
      idImageType = base64.includes('image/png') ? 'PNG' : 'JPEG';
    }
  }

  // ── Top Section: ID Image (left) + Payment Box (right) ──
  const leftColW = contentWidth * 0.48;
  const rightColW = contentWidth * 0.48;
  const rightColX = margin + contentWidth * 0.52;
  const boxHeight = 40;

  // Left: ID Image
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, leftColW, boxHeight);

  if (idImageBase64) {
    try {
      // Calculate aspect ratio to fit inside the box
      const img = new Image();
      img.src = idImageBase64;
      // Add image centered in box with padding
      const padding = 2;
      doc.addImage(idImageBase64, idImageType, margin + padding, y + padding, leftColW - padding * 2, boxHeight - padding * 2);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text('ID IMAGE', margin + leftColW / 2, y + boxHeight / 2, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text('ID IMAGE', margin + leftColW / 2, y + boxHeight / 2, { align: 'center' });
  }

  // Right: Payment Box
  doc.setLineWidth(0.4);
  doc.rect(rightColX, y, rightColW, boxHeight);

  let innerY = y + 7;
  const lineSpacing = 7.5;
  const labelX = rightColX + 3;
  const valueX = rightColX + rightColW - 3;

  // Room number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('ROOM #', labelX, innerY);
  doc.text(room.roomNumber || '___', valueX, innerY, { align: 'right' });
  innerY += lineSpacing;

  // Rate
  doc.text('DAILY/WEEKLY RATE $', labelX, innerY);
  doc.text(String(stay.rateAmount || '___'), valueX, innerY, { align: 'right' });
  innerY += lineSpacing;

  // Cash/Credit checkboxes
  doc.setFontSize(8);
  const checkY = innerY;
  doc.text('CASH', labelX, checkY);
  doc.rect(labelX + 12, checkY - 3, 3.5, 3.5);
  if (hasCash) {
    doc.setFont('helvetica', 'bold');
    doc.text('X', labelX + 13, checkY - 0.2);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CREDIT', labelX + 22, checkY);
  doc.rect(labelX + 36, checkY - 3, 3.5, 3.5);
  if (hasCard) {
    doc.text('X', labelX + 37, checkY - 0.2);
  }
  innerY += lineSpacing;

  // Total
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL AMOUNT PAID $', labelX, innerY);
  doc.text(String(totalAmount || '___'), valueX, innerY, { align: 'right' });

  y += boxHeight + 6;

  // ── Dates Row ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);

  const dateFieldW = 28;
  const timeFieldW = 18;
  let dx = margin;

  doc.text('CHECK-IN DATE', dx, y);
  dx += 24;
  doc.rect(dx, y - 3.5, dateFieldW, 5);
  doc.setFont('helvetica', 'normal');
  doc.text(stay.checkInDate || '', dx + 1, y);
  dx += dateFieldW + 3;

  doc.setFont('helvetica', 'bold');
  doc.text('CHECK-IN TIME', dx, y);
  dx += 22;
  doc.rect(dx, y - 3.5, timeFieldW, 5);
  doc.setFont('helvetica', 'normal');
  doc.text(stay.checkInTime || '', dx + 1, y);
  dx += timeFieldW + 3;

  doc.setFont('helvetica', 'bold');
  doc.text('CHECK-OUT DATE', dx, y);
  dx += 24;
  doc.rect(dx, y - 3.5, dateFieldW, 5);
  doc.setFont('helvetica', 'normal');
  doc.text(stay.checkOutDate || '', dx + 1, y);
  dx += dateFieldW + 3;

  doc.setFont('helvetica', 'bold');
  doc.text('CHECK-OUT TIME', dx, y);
  dx += 22;
  doc.rect(dx, y - 3.5, timeFieldW, 5);
  doc.setFont('helvetica', 'normal');
  doc.text('10 AM', dx + 1, y);

  y += 10;

  // ── Vehicle Row ──
  dx = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);

  const vehicleFields = [
    { label: 'MAKE', w: 28 },
    { label: 'MODEL', w: 28 },
    { label: 'LICENSE #', w: 28 },
    { label: 'COLOR', w: 22 },
    { label: 'YEAR', w: 18 },
  ];

  doc.text('VEHICLE INFO:', dx, y);
  dx += 22;

  vehicleFields.forEach((field) => {
    doc.text(field.label, dx, y);
    dx += field.label.length * 2 + 2;
    doc.rect(dx, y - 3.5, field.w, 5);
    dx += field.w + 3;
  });

  y += 10;

  // ── Agreement Header ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  const agreementText = 'By signing below, as a guest of AIRWAY MOTEL you state that you have fully read the statements conditions below and agree to abide by them, without exception, while staying at AIRWAY MOTEL.';
  const agreementLines = doc.splitTextToSize(agreementText, contentWidth);
  doc.text(agreementLines, margin, y);
  y += agreementLines.length * 3.5 + 3;

  // ── Terms ──
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  TERMS.forEach((term, i) => {
    const termLines = doc.splitTextToSize(`${i + 1}. ${term}`, contentWidth - 6);
    doc.text(termLines, margin + 4, y);
    y += termLines.length * 2.8 + 1;
  });

  y += 5;

  // ── Signature Line 1 ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);

  const sigLineStart = margin;
  const sigLineEnd = margin + 60;
  const dateLineStart = margin + 65;
  const dateLineEnd = margin + 95;
  const phoneLineStart = margin + 100;
  const phoneLineEnd = pageWidth - margin;

  doc.text('GUEST SIGNATURE', sigLineStart, y);
  doc.setLineWidth(0.3);
  doc.line(sigLineStart + 28, y, sigLineEnd, y);

  doc.text('DATE', dateLineStart, y);
  doc.line(dateLineStart + 10, y, dateLineEnd, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(stay.checkInDate || '', dateLineStart + 11, y - 1);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PHONE #', phoneLineStart, y);
  doc.line(phoneLineStart + 15, y, phoneLineEnd, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(guest.phone || '', phoneLineStart + 16, y - 1);

  // Draw signature image
  if (signatureUrl) {
    try {
      doc.addImage(signatureUrl, 'PNG', sigLineStart + 28, y - 7, 50, 7);
    } catch {
      // Image failed to load
    }
  }

  y += 14;

  // ── Signature Line 2 (blank) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);

  doc.text('GUEST SIGNATURE', sigLineStart, y);
  doc.line(sigLineStart + 28, y, sigLineEnd, y);

  doc.text('DATE', dateLineStart, y);
  doc.line(dateLineStart + 10, y, dateLineEnd, y);

  doc.text('PHONE #', phoneLineStart, y);
  doc.line(phoneLineStart + 15, y, phoneLineEnd, y);

  return doc;
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

  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);

  useEffect(() => {
    async function load() {
      if (!stayId) return;
      try {
        // Try Supabase first with joined query
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

        // Fallback to local store
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
        setError('Failed to load data');
      }
    }
    load();
  }, [stayId, stays, guests, rooms, payments]);

  // Generate PDF or trigger print
  useEffect(() => {
    if (data) {
      const timer = setTimeout(async () => {
        try {
          if (isDownload) {
            const doc = await generateRegistrationPdf(data);
            const fileName = `registration_${data.guest.lastName || 'guest'}_${data.room.roomNumber || 'room'}.pdf`;
            doc.save(fileName);
            setGenerating(false);
            setTimeout(() => window.close(), 2000);
          } else {
            setGenerating(false);
            setTimeout(() => window.print(), 300);
          }
        } catch (err) {
          console.error('PDF generation error:', err);
          setError('Failed to generate PDF');
          setGenerating(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [data, isDownload]);

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
          borderTopColor: '#18181b',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ marginTop: '16px', color: '#71717a', fontSize: '14px' }}>
          {isDownload ? 'Generating PDF...' : 'Loading form...'}
        </p>
        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />
      </div>
    );
  }

  // Print mode: show the form as HTML for the print dialog
  if (!isDownload && data) {
    const { stay, guest, room, payments: stayPayments, signatures } = data;
    const signatureUrl = signatures.length > 0 ? signatures[0].signature_data_url : null;
    const totalAmount = stayPayments.reduce((acc, p) => acc + p.amount, 0);

    return (
      <div className="bg-white text-black min-h-screen font-sans p-8 print:p-0">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body, html { background: white !important; margin: 0; padding: 0; }
            @page { margin: 0.5in; }
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

        <div className="max-w-[8in] mx-auto text-[13px] leading-relaxed bg-white">
          <div className="flex justify-between items-start mb-6 gap-8">
            <div className="w-[45%]">
              {guest.idPhotoUrl ? (
                <img src={guest.idPhotoUrl} alt="ID Card" className="w-full h-auto border-2 border-black rounded shadow-sm max-h-48 object-cover" />
              ) : (
                <div className="w-full h-40 border-2 border-black border-dashed flex items-center justify-center text-gray-500 font-bold uppercase">
                  ID Image Placeholder
                </div>
              )}
            </div>
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

          <p className="font-bold mb-4 text-justify">
            By signing below, as a guest of AIRWAY MOTEL you state that you have fully read the statements conditions below and agree to abide by them, without exception, while staying at AIRWAY MOTEL.
          </p>

          <ol className="list-decimal pl-6 space-y-2 mb-8 text-[12px]">
            {TERMS.map((term, i) => (
              <li key={i}>{term}</li>
            ))}
          </ol>

          <div className="space-y-8">
            <div className="flex items-end gap-2 relative">
              <span className="font-bold">GUEST SIGNATURE</span>
              <span className="form-field flex-[2] relative h-6">
                {signatureUrl && (
                  <img src={signatureUrl} alt="Signature" className="absolute bottom-0 left-1/2 -translate-x-1/2 h-16 object-contain pointer-events-none mix-blend-multiply" />
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

  // Download mode: show success
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
