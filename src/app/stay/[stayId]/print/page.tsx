'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMotelStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { jsPDF } from 'jspdf';
import { Download, Loader2, FileText } from 'lucide-react';

function fetchImageAsBase64(url: string): Promise<string | null> {
  return fetch(url)
    .then(res => res.blob())
    .then(blob => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
}

function imageToBase64(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return Promise.resolve(url);
  return fetchImageAsBase64(url);
}

async function generateRegistrationPdf(stayId: string) {
  const stay = useMotelStore.getState().stays.find(s => s.id === stayId);
  if (!stay) throw new Error('Stay not found');
  const guest = useMotelStore.getState().guests.find(g => g.id === stay.guestId);
  if (!guest) throw new Error('Guest not found');
  const room = useMotelStore.getState().rooms.find(r => r.id === stay.roomId);
  if (!room) throw new Error('Room not found');
  const settings = useMotelStore.getState().settings || {};

  let idBase64: string | null = null;
  if (guest.idPhotoUrl) {
    idBase64 = await imageToBase64(guest.idPhotoUrl);
  }

  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageWidth = 215.9;
  const margin = 16;
  const leftCol = margin;
  const rightCol = 115;
  let y = margin;

  // ── Header ──
  doc.setFillColor(254, 249, 195);
  doc.rect(0, 0, pageWidth, 32, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('Airway Motel', leftCol, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(68, 68, 68);
  doc.text('123 Motel Way · Denver, CO 80202 · (555) 123-4567', leftCol, 24);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('REGISTRATION CARD', rightCol, 22);
  y = 40;

  // ── Terms & Conditions ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text('Terms & Conditions', leftCol, y + 4);
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 51, 51);
  const terms = [
    'Payment is due at the time of check-in. We accept cash and card.',
    'Check-out time is 12:00 PM. Late check-out may result in additional charges.',
    'Guests are responsible for any damages to the room or its contents.',
    'Smoking is not permitted inside the room. A cleaning fee will be charged for violations.',
    'The motel is not responsible for any lost, stolen, or damaged personal property.',
    'Quiet hours are observed from 10:00 PM to 8:00 AM.',
    'The registered guest must be at least 18 years of age.',
    'All local, state, and federal laws must be obeyed on the premises.',
    'The motel reserves the right to refuse service or evict guests for disruptive behavior.',
  ];
  const termLineHeight = 3.0;
  terms.forEach(term => {
    doc.text('• ' + term, leftCol + 2, y);
    y += termLineHeight;
  });
  y += 6;

  // ── Guest Info ──
  const guestInfoY = y;
  const halfWidth = (pageWidth - margin * 2) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Guest Information', leftCol, guestInfoY);
  doc.text('Payment Information', rightCol, guestInfoY);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.1);
  doc.line(leftCol, guestInfoY + 1.5, leftCol + halfWidth - 5, guestInfoY + 1.5);
  doc.line(rightCol, guestInfoY + 1.5, rightCol + halfWidth - 5, guestInfoY + 1.5);
  y += 6;

  // ── Guest Info Fields ──
  const colGap = 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const labelX = leftCol + 3;
  const valueX = leftCol + 28;
  const lineLen = halfWidth - 12;
  const rowH = 6;

  const guestName = `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || '___________________________';
  doc.text('Name:', leftCol, y);
  doc.text(guestName, leftCol + 18, y);
  doc.line(leftCol + 18, y + 1, leftCol + halfWidth - 5, y + 1);
  y += rowH;

  const idType = guest.idType ? guest.idType.toUpperCase() : '___________________________';
  doc.text('ID Type:', leftCol, y);
  doc.text(idType, leftCol + 18, y);
  doc.line(leftCol + 18, y + 1, leftCol + halfWidth - 5, y + 1);
  y += rowH;

  const idNumber = guest.idNumber || '___________________________';
  doc.text('ID Number:', leftCol, y);
  doc.text(idNumber, leftCol + 18, y);
  doc.line(leftCol + 18, y + 1, leftCol + halfWidth - 5, y + 1);
  y += rowH;

  const phone = guest.phone || '___________________________';
  doc.text('Phone:', leftCol, y);
  doc.text(phone, leftCol + 18, y);
  doc.line(leftCol + 18, y + 1, leftCol + halfWidth - 5, y + 1);
  y += rowH;

  const email = guest.email || '___________________________';
  doc.text('Email:', leftCol, y);
  doc.text(email, leftCol + 18, y);
  doc.line(leftCol + 18, y + 1, leftCol + halfWidth - 5, y + 1);
  y += rowH;

  doc.text('Date of Birth:', leftCol, y);
  doc.text(guest.dateOfBirth || '___/___/______', leftCol + 18, y);
  doc.line(leftCol + 18, y + 1, leftCol + halfWidth - 5, y + 1);
  y += rowH + 4;

  doc.text('Address:', leftCol, y);
  doc.line(labelX, y + 1, leftCol + lineLen, y + 1);
  y += rowH;
  doc.line(labelX, y + 1, leftCol + lineLen, y + 1);
  y += rowH;

  // ── Payment Info Fields ──
  const pLabelX = rightCol + 3;
  const pValueX = rightCol + 28;
  let pY = guestInfoY + 8;
  const pLineLen = halfWidth - 12;

  doc.text('Room #:', rightCol, pY);
  doc.text(room.roomNumber || '___________', pValueX, pY);
  doc.line(pValueX, pY + 1, rightCol + pLineLen, pY + 1);
  pY += rowH;

  const nights = Math.max(1, Math.round((new Date(stay.checkOutDate).getTime() - new Date(stay.checkInDate).getTime()) / (1000 * 60 * 60 * 24)));
  doc.text('Nights:', rightCol, pY);
  doc.text(String(nights), pValueX, pY);
  doc.line(pValueX, pY + 1, rightCol + pLineLen, pY + 1);
  pY += rowH;

  doc.text('Room Rate:', rightCol, pY);
  doc.text('$' + stay.rateAmount + ' / night', pValueX, pY);
  doc.line(pValueX, pY + 1, rightCol + pLineLen, pY + 1);
  pY += rowH;

  doc.text('Room Total:', rightCol, pY);
  doc.text('$' + (stay.rateAmount * nights).toFixed(2), pValueX, pY);
  doc.line(pValueX, pY + 1, rightCol + pLineLen, pY + 1);
  pY += rowH;

  if (settings?.vatEnabled) {
    doc.text('VAT (10.75%):', rightCol, pY);
    doc.text('$' + ((stay.rateAmount * nights) * 0.1075).toFixed(2), pValueX, pY);
    doc.line(pValueX, pY + 1, rightCol + pLineLen, pY + 1);
    pY += rowH;
  }

  if (settings?.weeklyDiscountEnabled && nights >= 7) {
    doc.text('Weekly Discount:', rightCol, pY);
    doc.text('-$200.00', pValueX, pY);
    doc.line(pValueX, pY + 1, rightCol + pLineLen, pY + 1);
    pY += rowH;
  }

  pY += 2;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL DUE:', rightCol, pY);
  doc.text('$' + stay.rateAmount.toFixed(2), pValueX, pY);
  pY += 2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(rightCol, pY, rightCol + pLineLen, pY);
  pY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Amount Paid:', rightCol, pY);
  doc.text('$' + stay.rateAmount.toFixed(2), pValueX, pY);
  pY += 4;
  doc.text('Payment Method: Cash', rightCol, pY);

  y += 2;

  // ── Vehicle Information ──
  const vehicleY = y;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Vehicle Information', leftCol, vehicleY);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.1);
  doc.line(leftCol, vehicleY + 1.5, leftCol + halfWidth - 5, vehicleY + 1.5);
  y = vehicleY + 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  doc.text('License Plate #:', leftCol, y);
  doc.line(leftCol + 28, y + 1, leftCol + halfWidth - 5, y + 1);
  y += 6;

  doc.text('Vehicle Make:', leftCol, y);
  doc.line(leftCol + 28, y + 1, leftCol + halfWidth - 5, y + 1);
  y += 6;

  doc.text('Vehicle Color:', leftCol, y);
  doc.line(leftCol + 28, y + 1, leftCol + halfWidth - 5, y + 1);
  y += 10;

  // ── Dates ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Check-In / Check-Out', leftCol, y);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.1);
  doc.line(leftCol, y + 1.5, leftCol + halfWidth - 5, y + 1.5);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const dateLineLen = 28;
  doc.text('Check-In Date:', leftCol, y);
  doc.text(stay.checkInDate, leftCol + 24, y);
  doc.line(leftCol + 24, y + 1, leftCol + 24 + dateLineLen, y + 1);
  doc.text('Time:', leftCol + 60, y);
  doc.text(stay.checkInTime, leftCol + 68, y);
  doc.line(leftCol + 68, y + 1, leftCol + 68 + dateLineLen, y + 1);
  y += 6;

  doc.text('Check-Out Date:', leftCol, y);
  doc.text(stay.checkOutDate, leftCol + 24, y);
  doc.line(leftCol + 24, y + 1, leftCol + 24 + dateLineLen, y + 1);
  doc.text('Time:', leftCol + 60, y);
  doc.text(stay.checkOutTime, leftCol + 68, y);
  doc.line(leftCol + 68, y + 1, leftCol + 68 + dateLineLen, y + 1);
  y += 10;

  // ── Agreement ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Acknowledgement & Signature', leftCol, y);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.1);
  doc.line(leftCol, y + 1.5, pageWidth - margin, y + 1.5);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('I have read, understand, and agree to all terms listed above.', leftCol, y + 2);
  y += 10;

  // ── Signatures ──
  const sigLineWidth = 55;
  const sigGap = 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  doc.text('Guest Signature', leftCol, y);
  doc.line(leftCol, y + 16, leftCol + sigLineWidth, y + 16);

  doc.text('Date', leftCol + sigLineWidth + sigGap, y);
  doc.line(leftCol + sigLineWidth + sigGap, y + 16, leftCol + sigLineWidth + sigGap + 38, y + 16);

  doc.text('Phone', leftCol + sigLineWidth + sigGap + 38 + sigGap, y);
  doc.line(leftCol + sigLineWidth + sigGap + 38 + sigGap, y + 16, pageWidth - margin, y + 16);

  // ── ID Image ──
  if (idBase64) {
    y += 24;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.text('ID Verification', leftCol, y);
    y += 3;

    const imgW = 38;
    const imgH = 24;
    doc.setDrawColor(200, 200, 200);
    doc.rect(leftCol, y, imgW, imgH);
    try {
      doc.addImage(idBase64, 'JPEG', leftCol, y, imgW, imgH);
    } catch {
      doc.setFontSize(7);
      doc.setTextColor(128, 128, 128);
      doc.text('ID IMAGE', leftCol + 2, y + 12);
    }
  }

  return doc;
}

export default function PrintPage() {
  const params = useParams();
  const stayId = params.stayId as string;

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [ready, setReady] = useState(false);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generate = async () => {
      setGenerating(true);
      setError(null);

      // Wait for store data to load from Supabase
      const waitForData = () => new Promise<void>((resolve) => {
        const check = () => {
          const { stays, guests, rooms, settings, dataLoaded } = useMotelStore.getState();
          if (dataLoaded && stays.some(s => s.id === stayId) && guests.some(g => g.id === stays.find(s => s.id === stayId)?.guestId) && settings) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });

      try {
        await waitForData();
        const doc = await generateRegistrationPdf(stayId);
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);

        const stay = useMotelStore.getState().stays.find(s => s.id === stayId);
        const guest = useMotelStore.getState().guests.find(g => g.id === stay?.guestId);
        setFileName(`registration_${guest?.lastName || 'guest'}_${stay?.checkInDate || ''}`);
        setReady(true);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to generate PDF');
      } finally {
        setGenerating(false);
      }
    };

    generate();
  }, [stayId]);

  const handleDownload = () => {
    if (!pdfUrl || !fileName) return;
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = `${fileName}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (generating || !ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Generating registration form...</p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar with filename input and download button */}
      <div className="bg-white border-b border-border px-4 py-3 flex items-center gap-3 flex-wrap">
        <FileText className="w-5 h-5 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Registration Form Preview</span>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            className="px-3 py-1.5 border border-input rounded-md text-sm w-[280px] outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-sm text-muted-foreground">.pdf</span>
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-transparent text-muted-foreground border border-input rounded-lg text-sm hover:bg-accent transition-colors"
        >
          Close
        </button>
      </div>

      {/* PDF Preview */}
      <div className="flex-1 p-5 flex justify-center">
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full max-w-[900px] border-none rounded-lg shadow-md"
            style={{ height: 'calc(100vh - 80px)' }}
          />
        )}
      </div>
    </div>
  );
}
