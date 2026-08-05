'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMotelStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { jsPDF } from 'jspdf';
import { Loader2 } from 'lucide-react';

interface SignatureRecord {
  id: string;
  stay_id: string;
  guest_id: string;
  signature_data_url: string;
  signed_at: string;
}

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

async function generateRegistrationPdf(stayId: string) {
  const stay = useMotelStore.getState().stays.find(s => s.id === stayId);
  if (!stay) throw new Error('Stay not found');
  const guest = useMotelStore.getState().guests.find(g => g.id === stay.guestId);
  if (!guest) throw new Error('Guest not found');
  const room = useMotelStore.getState().rooms.find(r => r.id === stay.roomId);
  if (!room) throw new Error('Room not found');
  const settings = useMotelStore.getState().settings || {};

  // Fetch payments and signatures from Supabase
  let payments: { amount: number; method: string }[] = [];
  let signatures: SignatureRecord[] = [];

  if (supabase) {
    const { data: pmts } = await supabase
      .from('payments')
      .select('*')
      .eq('stay_id', stayId);
    if (pmts) {
      payments = pmts.map((p: Record<string, unknown>) => ({
        amount: p.amount as number,
        method: (p.method as string) || 'card',
      }));
    }

    const { data: sigs } = await supabase
      .from('signatures')
      .select('*')
      .eq('stay_id', stayId);
    if (sigs) {
      signatures = sigs.map((s: Record<string, unknown>) => ({
        id: s.id as string,
        stay_id: s.stay_id as string,
        guest_id: s.guest_id as string,
        signature_data_url: (s.signature_data_url as string) || '',
        signed_at: s.signed_at as string,
      }));
    }
  }

  const totalAmount = payments.reduce((acc, p) => acc + p.amount, 0);
  const hasCash = payments.some(p => p.method === 'cash');
  const hasCard = payments.some(p => p.method !== 'cash');
  const signatureUrl = signatures.length > 0 ? signatures[0].signature_data_url : null;

  // Load ID image
  let idImageBase64: string | null = null;
  let idImageType: 'JPEG' | 'PNG' = 'JPEG';
  if (guest.idPhotoUrl) {
    const base64 = await imageToBase64(guest.idPhotoUrl);
    if (base64) {
      idImageBase64 = base64;
      idImageType = base64.includes('image/png') ? 'PNG' : 'JPEG';
    }
  }

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageWidth = 215.9;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  doc.text('ROOM #', labelX, innerY);
  doc.text(room.roomNumber || '___', valueX, innerY, { align: 'right' });
  innerY += lineSpacing;

  doc.text('DAILY/WEEKLY RATE $', labelX, innerY);
  doc.text(String(stay.rateAmount || '___'), valueX, innerY, { align: 'right' });
  innerY += lineSpacing;

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
  doc.setFontSize(11);
  TERMS.forEach((term, i) => {
    const termLines = doc.splitTextToSize(`${i + 1}. ${term}`, contentWidth - 6);
    doc.text(termLines, margin + 4, y);
    y += termLines.length * 3.8 + 3;
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

  return { doc, guest };
}

export default function PrintPage() {
  const params = useParams();
  const stayId = params.stayId as string;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      const waitForData = () => new Promise<void>((resolve) => {
        const check = () => {
          const { stays, guests, dataLoaded } = useMotelStore.getState();
          if (dataLoaded && stays.some(s => s.id === stayId) && guests.some(g => g.id === stays.find(s => s.id === stayId)?.guestId)) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });

      try {
        await waitForData();
        const { doc, guest } = await generateRegistrationPdf(stayId);
        if (!cancelled) {
          const fileName = `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || 'Guest';
          doc.save(`${fileName}.Registration.pdf`);
          window.close();
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to generate PDF');
        }
      }
    };

    generate();

    return () => { cancelled = true; };
  }, [stayId]);

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Generating registration form...</p>
      </div>
    </div>
  );
}
