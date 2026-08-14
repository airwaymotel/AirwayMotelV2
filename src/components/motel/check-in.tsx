'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  BedSingle, BedDouble, ArrowRight, ArrowLeft, CheckCircle,
  CreditCard, Banknote, PenLine, Upload,
  Camera, Loader2, X, ImageIcon, ScanLine, DoorOpen, User,
  AlertCircle, RefreshCcw, Search,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useMotelStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { RoomType, PaymentMethod } from '@/lib/types';
import IdScanner, { type ScannedIdData } from './id-scanner';

// ── Phone Signature Panel ──────────────────────────────────
// Shows a QR code linking to /scan/{id}?mode=signature.
// Desktop polls GET /api/scan-session until the phone submits, then fires onReceived.

function PhoneSignaturePanel({
  onReceived,
}: {
  onReceived: (signatureDataUrl: string, termsAccepted: boolean) => void;
}) {
  const [sessionId, setSessionId] = useState<string>('');
  const [scanUrl, setScanUrl] = useState<string>('');
  const [status, setStatus] = useState<'generating' | 'waiting' | 'received' | 'error'>('generating');
  const [errorMsg, setErrorMsg] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onReceivedRef = useRef(onReceived);
  useEffect(() => {
    onReceivedRef.current = onReceived;
  }, [onReceived]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const id = crypto.randomUUID();

      try {
        const res = await fetch('/api/scan-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', sessionId: id, mode: 'signature' }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create signature session');
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err?.message || 'Failed to create signature session. Please try again.');
        }
        return;
      }

      if (cancelled) return;

      setSessionId(id);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/scan/${id}?mode=signature`;
      setScanUrl(url);
      setStatus('waiting');

      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/scan-session?sessionId=${id}`);
          if (!res.ok) return;

          const data = await res.json();

          if (data.status === 'received') {
            if (pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
            }

            fetch(`/api/scan-session?sessionId=${id}`, { method: 'DELETE' }).catch(() => {});

            if (!cancelled) {
              setStatus('received');
              onReceivedRef.current(
                data.signatureDataUrl || '',
                !!data.termsAccepted,
              );
            }
          }
        } catch {
          // Ignore polling errors, just retry
        }
      }, 2000);
    };

    init();

    return () => {
      cancelled = true;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  const handleCancel = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setStatus('generating');
    setSessionId('');
    setScanUrl('');
  };

  if (status === 'error') {
    return (
      <div className="space-y-4">
        <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errorMsg}</p>
          <Button variant="outline" size="sm" onClick={() => { setStatus('generating'); setErrorMsg(''); }}>
            <RefreshCcw className="w-4 h-4 mr-1" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-white p-4 rounded-xl shadow-md">
          {scanUrl && (
            <QRCodeSVG
              value={scanUrl}
              size={200}
              level="M"
              includeMargin={false}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          )}
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium">Scan with your phone</p>
          <p className="text-xs text-muted-foreground">
            Open the link on your phone to read the terms and sign the agreement.
          </p>
        </div>
      </div>

      {status === 'waiting' && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Waiting for phone signature...</p>
            <p className="text-[11px] text-amber-600/70 dark:text-amber-400/60">
              Scan the QR code with your phone, read the terms, and sign.
            </p>
          </div>
        </div>
      )}

      {status === 'received' && (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">Signature received!</p>
            <p className="text-[11px] text-green-600/70 dark:text-green-400/60">
              The signature has been applied to the form.
            </p>
          </div>
        </div>
      )}

      {status === 'waiting' && (
        <Button variant="outline" size="sm" className="w-full" onClick={handleCancel}>
          <X className="w-4 h-4 mr-2" /> Cancel
        </Button>
      )}
    </div>
  );
}

export default function CheckIn() {
const STEPS = [
  'Room',
  'Scan ID',
  'Guest Details',
  'Payment',
  'Terms & Sign',
  'Confirm',
];

  const rooms = useMotelStore((s) => s.rooms);
  const guests = useMotelStore((s) => s.guests);
  const addGuest = useMotelStore((s) => s.addGuest);
  const addStay = useMotelStore((s) => s.addStay);
  const addPayment = useMotelStore((s) => s.addPayment);
  const updateRoomStatus = useMotelStore((s) => s.updateRoomStatus);
  const addActivity = useMotelStore((s) => s.addActivity);
  const setActiveTab = useMotelStore((s) => s.setActiveTab);
  const motelSettings = useMotelStore((s) => s.motelSettings);

  // Step
  const [step, setStep] = useState(0);

  // Room selection
  const [roomType, setRoomType] = useState<RoomType>('1-bed');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Guest form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idType, setIdType] = useState('Driver License');
  const [idState, setIdState] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [gender, setGender] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [height, setHeight] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [checkInTime, setCheckInTime] = useState('2:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('10:00 AM');

  // ID photo
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [idPhotoUrl, setIdPhotoUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ID scan tracking
  const [idScanned, setIdScanned] = useState(false);
  const [scannedIdImage, setScannedIdImage] = useState<string | undefined>();

  // Signature
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  // True when the signature + terms came from the guest's phone — we render it
  // as a static image until the admin clears it to re-sign on the pad.
  const [signatureFromPhone, setSignatureFromPhone] = useState(false);

  const [completedStayId, setCompletedStayId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Returning customer flow
  const [isReturningCustomer, setIsReturningCustomer] = useState(false);
  const [showReturningSelector, setShowReturningSelector] = useState(false);
  const [selectedReturningGuestId, setSelectedReturningGuestId] = useState('');
  const [returningSearchQuery, setReturningSearchQuery] = useState('');

  // VAT & Discount toggles (admin selects per customer in payment step)
  const [applyVat, setApplyVat] = useState(false);
  const [applyWeeklyDiscount, setApplyWeeklyDiscount] = useState(false);

  // Phone signature flow
  const [showPhoneSignature, setShowPhoneSignature] = useState(false);
  const [phoneSigSessionId, setPhoneSigSessionId] = useState('');
  const [phoneSigStatus, setPhoneSigStatus] = useState<'idle' | 'waiting' | 'received' | 'error'>('idle');
  const [phoneSigDataUrl, setPhoneSigDataUrl] = useState('');
  const [phoneSigError, setPhoneSigError] = useState('');
  const phoneSigPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived ──
  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === 'available' && r.type === roomType),
    [rooms, roomType]
  );
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const defaultRate = roomType === '1-bed' ? motelSettings.oneBedRate : motelSettings.twoBedRate;
  const rate = selectedRoom?.rate ?? defaultRate;

  const checkInDateObj = checkInDate ? new Date(checkInDate + 'T00:00:00') : null;
  const checkOutDateObj = checkOutDate ? new Date(checkOutDate + 'T00:00:00') : null;
  const nights = checkInDateObj && checkOutDateObj
    ? Math.max(1, Math.round((checkOutDateObj.getTime() - checkInDateObj.getTime()) / 86400000))
    : 1;

  const subtotal = rate * nights;
  const vatAmount = applyVat ? subtotal * (motelSettings.vatRate / 100) : 0;
  const weeklyDiscount = applyWeeklyDiscount && nights >= 7 ? 200 : 0;
  const totalDue = subtotal + vatAmount - weeklyDiscount;

  // ── Manual file upload handler ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setIdPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    if (supabase) {
      try {
        const fileName = `id_admin_${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from('ids').upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) {
          toast.error('Failed to upload ID image to storage');
          return;
        }
        const { data } = supabase.storage.from('ids').getPublicUrl(fileName);
        setIdPhotoUrl(data.publicUrl);
        toast.success('ID image uploaded');
      } catch {
        toast.error('Upload failed');
      }
    } else {
      setIdPhotoUrl(reader.result as string);
    }
  }, []);

  // ── ID Scan Complete Handler ──
  const handleScanComplete = useCallback((data: ScannedIdData, imageBase64?: string) => {
    // Auto-fill all form fields from scanned data
    if (data.firstName) setFirstName(data.firstName);
    if (data.lastName) setLastName(data.lastName);
    if (data.idNumber) setIdNumber(data.idNumber);
    if (data.idType) setIdType(data.idType);
    if (data.issuingState) setIdState(data.issuingState);
    if (data.dateOfBirth) setDateOfBirth(data.dateOfBirth);
    if (data.gender) setGender(data.gender);
    if (data.eyeColor) setEyeColor(data.eyeColor);
    if (data.height) setHeight(data.height);

    // Build address string
    if (data.address) {
      const parts = [
        data.address.street,
        data.address.city,
        data.address.state,
        data.address.zipCode,
      ].filter(Boolean);
      if (parts.length > 0) setAddress(parts.join(', '));
    }

    // Store scanned image
    if (imageBase64) {
      setScannedIdImage(imageBase64);
      setIdPhotoPreview(imageBase64);
      setIdPhotoUrl(imageBase64);
    }

    setIdScanned(true);
    toast.success('ID data extracted — please review and add contact info');
  }, []);

  // ── Returning Customer Handler ──
  const handleReturningGuestSelect = useCallback((guestId: string) => {
    const guest = guests.find((g) => g.id === guestId);
    if (!guest) return;

    setSelectedReturningGuestId(guestId);
    setFirstName(guest.firstName);
    setLastName(guest.lastName);
    setPhone(guest.phone);
    setEmail(guest.email || '');
    setIdNumber(guest.idNumber);
    setIdType(guest.idType || 'Driver License');
    setIdState(guest.idState || '');
    setDateOfBirth(guest.dateOfBirth);
    setIdPhotoPreview(guest.idPhotoUrl || null);
    setIdPhotoUrl(guest.idPhotoUrl || '');
    setIdScanned(true);
    setIsReturningCustomer(true);
    toast.success(`Loaded ${guest.firstName} ${guest.lastName} — verify details and continue`);
  }, [guests]);

  // ── Signature received from the phone flow ──
  // Auto-fills Step 4 (terms + signature) but keeps the step visible so the
  // admin can verify or clear & re-sign.
  const handleSignatureReceived = useCallback((sigDataUrl: string, termsAccepted: boolean) => {
    setSignatureDataUrl(sigDataUrl);
    setSignatureFromPhone(true);
    if (termsAccepted) setTermsAccepted(true);
    toast.success('Guest signed on phone — review on the Terms & Sign step');
  }, []);

  // ── Mobile scan result: detect scan completed on this device ──
  useEffect(() => {
    const raw = localStorage.getItem('airway_scan_result');
    if (!raw) return;

    try {
      const result = JSON.parse(raw);
      localStorage.removeItem('airway_scan_result');

      // Store signature
      if (result.signatureDataUrl) {
        setSignatureDataUrl(result.signatureDataUrl);
        setSignatureFromPhone(true);
      }
      if (result.termsAccepted) {
        setTermsAccepted(true);
      }

      // Process ID image with AI to extract guest data
      const imageUrl = result.imageStorageUrl || result.imageBase64;
      if (imageUrl) {
        setScannedIdImage(imageUrl);
        setIdPhotoPreview(imageUrl);
        setIdPhotoUrl(imageUrl);

        toast.info('Processing scanned ID with AI...');
        fetch('/api/scan-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: imageUrl }),
        })
          .then((res) => res.json())
          .then(({ data: extracted }) => {
            if (extracted) {
              if (extracted.firstName) setFirstName(extracted.firstName);
              if (extracted.lastName) setLastName(extracted.lastName);
              if (extracted.idNumber) setIdNumber(extracted.idNumber);
              if (extracted.idType) setIdType(extracted.idType);
              if (extracted.issuingState) setIdState(extracted.issuingState);
              if (extracted.dateOfBirth) setDateOfBirth(extracted.dateOfBirth);
              if (extracted.gender) setGender(extracted.gender);
              if (extracted.eyeColor) setEyeColor(extracted.eyeColor);
              if (extracted.height) setHeight(extracted.height);
              if (extracted.address) {
                const parts = [
                  extracted.address.street,
                  extracted.address.city,
                  extracted.address.state,
                  extracted.address.zipCode,
                ].filter(Boolean);
                if (parts.length > 0) setAddress(parts.join(', '));
              }
              setIdScanned(true);
              toast.success('ID scanned and guest details extracted! Review and add contact info.');
            } else {
              toast.error('Could not extract data from ID. Please fill in manually.');
            }
          })
          .catch(() => {
            toast.error('Failed to process ID. Please fill in manually.');
          });
      }

      // Skip to Guest Details step (step 2) — admin reviews and adds phone/email
      setStep(2);
    } catch {
      // Invalid data — ignore
    }
  }, []);

  // ── Step validation ──
  const canNext = (): boolean => {
    switch (step) {
      case 0: return availableRooms.length > 0;
      case 1:
        if (isReturningCustomer) return selectedReturningGuestId !== '';
        return idScanned && idNumber.length >= 4;
      case 2: return firstName.length >= 2 && lastName.length >= 2 && phone.length >= 10;
      case 3: return true;
      case 4: return termsAccepted;
      case 5: return false;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (submitting) return;

    if (!selectedRoomId || !selectedRoom) {
      toast.error('No room selected. Please go back and select a room.');
      return;
    }

    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions before completing check-in.');
      return;
    }

    setSubmitting(true);

    try {
      // For returning customers, reuse the existing guest ID
      const guestId = isReturningCustomer && selectedReturningGuestId
        ? selectedReturningGuestId
        : await addGuest({
            firstName,
            lastName,
            phone,
            email,
            idNumber,
            dateOfBirth,
            idPhotoUrl: idPhotoUrl || undefined,
            idType: idType || undefined,
            idState: idState || undefined,
          });

       const stayId = await addStay({
         guestId,
         roomId: selectedRoomId,
         checkInDate,
         checkInTime,
         checkOutDate,
         checkOutTime,
         rateAmount: rate,
         status: 'active',
       });

       await addPayment({
         stayId,
         amount: subtotal,
         method: paymentMethod,
         description: `Room charge (${nights} night${nights > 1 ? 's' : ''}, ${roomType})`,
       });

       if (vatAmount > 0) {
         await addPayment({
           stayId,
           amount: vatAmount,
           method: paymentMethod,
           description: `VAT (${motelSettings.vatRate}%)`,
         });
       }

       if (weeklyDiscount > 0) {
         await addPayment({
           stayId,
           amount: -weeklyDiscount,
           method: paymentMethod,
           description: 'Weekly discount',
         });
       }

      updateRoomStatus(selectedRoomId, 'occupied');

      addActivity({
        guest: `${firstName} ${lastName}`,
        action: 'Check-in',
        room: selectedRoom.roomNumber,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        status: 'Success',
      });

      // Save signature to Supabase if connected
      if (supabase && signatureDataUrl) {
        const { error } = await supabase.from('signatures').insert({
          stay_id: stayId,
          guest_id: guestId,
          signature_data_url: signatureDataUrl,
        });
        if (error) console.error('Failed to save signature:', error);
      }

      setCompletedStayId(stayId);
      setStep(5);
      toast.success('Check-in completed successfully!');
    } catch (err) {
      console.error('Check-in error:', err);
      toast.error('Check-in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(0);
    setRoomType('1-bed');
    setSelectedRoomId('');
    setPaymentMethod('card');
    setTermsAccepted(false);
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setIdNumber('');
    setIdType('Driver License');
    setIdState('');
    setDateOfBirth('');
    setAddress('');
    setGender('');
    setEyeColor('');
    setHeight('');
    setCheckInDate(new Date().toISOString().split('T')[0]);
    setCheckOutDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setCheckInTime('2:00 PM');
    setCheckOutTime('10:00 AM');
    setIdPhotoPreview(null);
    setIdPhotoUrl('');
    setSignatureDataUrl('');
    setSignatureFromPhone(false);
    setScannedIdImage(undefined);
    setIdScanned(false);
    setCompletedStayId('');
    setSubmitting(false);
    setApplyVat(false);
    setApplyWeeklyDiscount(false);
    // Reset returning customer state
    setIsReturningCustomer(false);
    setShowReturningSelector(false);
    setSelectedReturningGuestId('');
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">New Check-In</h2>
        <p className="text-muted-foreground mt-1">Register a new guest and assign a room.</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 min-w-0">
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <span>{i + 1}</span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="max-w-2xl">

        {/* ── Step 0: Room Selection ── */}
        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Room Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setRoomType('1-bed'); setSelectedRoomId(''); }}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer text-left ${
                    roomType === '1-bed'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <BedSingle className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="font-semibold">1-Bed King</p>
                   <p className="text-sm text-muted-foreground">${motelSettings.oneBedRate}/night</p>
                </button>
                <button
                  onClick={() => { setRoomType('2-bed'); setSelectedRoomId(''); }}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer text-left ${
                    roomType === '2-bed'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <BedDouble className="w-8 h-8 mb-2 text-muted-foreground" />
                  <p className="font-semibold">2-Bed Queen</p>
                   <p className="text-sm text-muted-foreground">${motelSettings.twoBedRate}/night</p>
                </button>
              </div>

              <div>
                <Label className="mb-2 block">
                  Available Rooms{' '}
                  <span className="text-muted-foreground font-normal">
                    ({availableRooms.length} {availableRooms.length === 1 ? 'room' : 'rooms'})
                  </span>
                </Label>
                {availableRooms.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      No {roomType === '1-bed' ? '1-Bed King' : '2-Bed Queen'} rooms available right now.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {availableRooms.map((r) => {
                      const selected = r.id === selectedRoomId;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRoomId(r.id)}
                          className={`relative p-4 rounded-lg border-2 transition-all cursor-pointer flex flex-col items-center gap-2 ${
                            selected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border hover:border-primary/40 hover:bg-muted/30'
                          }`}
                        >
                          {selected && (
                            <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <DoorOpen className={`w-6 h-6 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                          <p className="font-bold text-lg leading-none">{r.roomNumber}</p>
                          <p className="text-[11px] text-muted-foreground">${r.rate}/night</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 1: Scan ID ── */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Returning Customer Toggle */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <p className="text-sm font-medium">Returning Customer?</p>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant={isReturningCustomer ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setIsReturningCustomer(true);
                      setShowReturningSelector(true);
                    }}
                  >
                    Yes, Returning Guest
                  </Button>
                  <Button
                    variant={!isReturningCustomer ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setIsReturningCustomer(false);
                      setShowReturningSelector(false);
                    }}
                  >
                    New Guest
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Returning Guest Selector */}
            {isReturningCustomer && showReturningSelector && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Select Returning Guest</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, phone, or ID..."
                      value={returningSearchQuery}
                      onChange={(e) => setReturningSearchQuery(e.target.value)}
                      className="pl-8"
                      autoFocus
                    />
                  </div>
                  {guests.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No previous guests found.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {guests
                        .filter((g) => {
                          if (!returningSearchQuery.trim()) return true;
                          const q = returningSearchQuery.toLowerCase();
                          return (
                            `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) ||
                            g.phone.toLowerCase().includes(q) ||
                            (g.idNumber && g.idNumber.toLowerCase().includes(q))
                          );
                        })
                        .map((g) => (
                          <button
                            key={g.id}
                            onClick={() => {
                              handleReturningGuestSelect(g.id);
                              setReturningSearchQuery('');
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                              selectedReturningGuestId === g.id
                                ? 'bg-primary text-primary-foreground'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <p className="font-medium">{g.firstName} {g.lastName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {g.idNumber || 'No ID'}{g.phone ? ` · ${g.phone}` : ''}
                            </p>
                          </button>
                        ))}
                      {guests.filter((g) => {
                        if (!returningSearchQuery.trim()) return true;
                        const q = returningSearchQuery.toLowerCase();
                        return (
                          `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) ||
                          g.phone.toLowerCase().includes(q) ||
                          (g.idNumber && g.idNumber.toLowerCase().includes(q))
                        );
                      }).length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-2">No guests match your search.</p>
                      )}
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setIsReturningCustomer(false);
                      setShowReturningSelector(false);
                      setSelectedReturningGuestId('');
                      setReturningSearchQuery('');
                    }}
                  >
                    Cancel — Use New Guest Flow
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* New Guest: ID Scanner (only when not returning customer) */}
            {!isReturningCustomer && (
              <>
                <IdScanner
                  onScanComplete={handleScanComplete}
                  onSignatureReceived={handleSignatureReceived}
                />

                {/* Manual ID entry fallback (always visible) */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <PenLine className="w-4 h-4" /> Or enter manually
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="mb-1 block text-xs">ID Type</Label>
                        <Select value={idType} onValueChange={setIdType}>
                          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Driver License">Driver License</SelectItem>
                            <SelectItem value="State ID">State ID</SelectItem>
                            <SelectItem value="Passport">Passport</SelectItem>
                            <SelectItem value="Military ID">Military ID</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="mb-1 block text-xs">ID State</Label>
                        <Input value={idState} onChange={(e) => setIdState(e.target.value)} placeholder="CO" className="h-9 text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">ID Number *</Label>
                      <Input value={idNumber} onChange={(e) => { setIdNumber(e.target.value); if (e.target.value.length >= 4) setIdScanned(true); }} placeholder="DL-123456" className="h-9 text-sm" />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs">Date of Birth *</Label>
                      <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className="h-9 text-sm" />
                    </div>

                    {/* Optional file upload */}
                    <div>
                      <Label className="mb-1 block text-xs">Upload ID Photo</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      {idPhotoPreview ? (
                        <div className="relative rounded-lg overflow-hidden border border-border">
                          <img src={idPhotoPreview} alt="ID Preview" className="w-full max-h-32 object-contain bg-muted/30" />
                          <button
                            onClick={() => { setIdPhotoPreview(null); setIdPhotoUrl(''); }}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full p-4 border-2 border-dashed border-border rounded-lg flex items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors cursor-pointer text-xs"
                        >
                          <Upload className="w-4 h-4" />
                          <span>Upload ID photo</span>
                        </button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── Step 2: Guest Details ── */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guest Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Scan info banner */}
              {idScanned && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
                  <p className="text-xs text-green-700 dark:text-green-300">
                    ID data auto-filled from scan. Please verify and add contact info.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="mb-1.5 block">First Name *</Label>
                  <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
                </div>
                <div>
                  <Label htmlFor="lastName" className="mb-1.5 block">Last Name *</Label>
                  <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="mb-1.5 block">Phone *</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(720) 555-0100" />
              </div>
              <div>
                <Label htmlFor="email" className="mb-1.5 block">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="guest@email.com" />
              </div>

              {/* Auto-filled ID info (read-only display) */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">From ID Scan</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground">ID Number</p>
                    <p className="text-sm font-medium font-mono">{idNumber || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Date of Birth</p>
                    <p className="text-sm font-medium">{dateOfBirth || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">ID Type</p>
                    <p className="text-sm font-medium">{idType}{idState ? ` — ${idState}` : ''}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Gender</p>
                    <p className="text-sm font-medium">{gender || '—'}</p>
                  </div>
                  {address && (
                    <div className="col-span-2">
                      <p className="text-[10px] text-muted-foreground">Address</p>
                      <p className="text-sm font-medium">{address}</p>
                    </div>
                  )}
                  {(eyeColor || height) && (
                    <>
                      {eyeColor && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Eye Color</p>
                          <p className="text-sm font-medium">{eyeColor}</p>
                        </div>
                      )}
                      {height && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Height</p>
                          <p className="text-sm font-medium">{height}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Check-in Date</Label>
                  <Input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Check-in Time</Label>
                  <Select value={checkInTime} onValueChange={setCheckInTime}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM'].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">Check-out Date</Label>
                  <Input type="date" value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Check-out Time</Label>
                  <Select value={checkOutTime} onValueChange={setCheckOutTime}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['10:00 AM', '11:00 AM', '12:00 PM'].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Payment ── */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'card' as PaymentMethod, icon: CreditCard, label: 'Card' },
                  { value: 'cash' as PaymentMethod, icon: Banknote, label: 'Cash' },
                ]).map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    onClick={() => setPaymentMethod(value)}
                    className={`p-4 rounded-lg border-2 transition-all cursor-pointer flex flex-col items-center gap-2 ${
                      paymentMethod === value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <Icon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ))}
              </div>

              {/* VAT & Weekly Discount — returning customers only */}
              {isReturningCustomer && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Adjustments (Returning Customer)</p>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyVat}
                        onChange={(e) => setApplyVat(e.target.checked)}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">Apply VAT ({motelSettings.vatRate}%)</span>
                        <span className="text-xs text-muted-foreground ml-2">${vatAmount.toFixed(2)}</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={applyWeeklyDiscount}
                        onChange={(e) => setApplyWeeklyDiscount(e.target.checked)}
                        disabled={nights < 7}
                        className="w-4 h-4 rounded border-border accent-primary"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium">Weekly Discount (7+ nights)</span>
                        {nights < 7 ? (
                          <span className="text-xs text-muted-foreground ml-2">Requires 7+ nights</span>
                        ) : (
                          <span className="text-xs text-green-600 dark:text-green-400 ml-2">-$200.00</span>
                        )}
                      </div>
                    </label>
                  </div>
                </>
              )}

              <Separator />

               <div className="space-y-2">
                 <div className="flex justify-between text-sm">
                   <span>Room ({roomType === '1-bed' ? '1-Bed King' : '2-Bed Queen'})</span>
                   <span className="font-medium">${rate} × {nights}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                   <span>Subtotal</span>
                   <span className="font-medium">${subtotal.toFixed(2)}</span>
                 </div>
                 {vatAmount > 0 && (
                   <div className="flex justify-between text-sm">
                     <span>VAT ({motelSettings.vatRate}%)</span>
                     <span className="font-medium">${vatAmount.toFixed(2)}</span>
                   </div>
                 )}
                  {weeklyDiscount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Weekly Discount</span>
                      <span className="font-medium text-green-600 dark:text-green-400">-${weeklyDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-base font-semibold">
                    <span>Total Due</span>
                    <span>${totalDue.toFixed(2)}</span>
                  </div>
               </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Terms & Signature ── */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Terms & Signature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto">
                <p className="font-semibold text-foreground text-sm mb-2">Airway Motel — Terms and Conditions</p>
                <p className="text-[11px]">8339 E Colfax Ave, Denver, CO 80220 | (303) 420-8998</p>
                <p>By signing below, as a guest of AIRWAY MOTEL, you state that you have fully read the statements and conditions below and agree to abide by them, without exception, while staying at AIRWAY MOTEL.</p>
                 <ol className="list-decimal list-inside space-y-1.5 mt-2">
                   <li>Checkout time is 10 AM on the date of checkout.</li>
                   <li>A fee of <strong>$10 dollars per hour</strong> will be assessed for each hour the guest stays past checkout time.</li>
                   <li>Deposits for key and T.V. remote will not be returned unless each is returned in serviceable condition.</li>
                   <li>Guests may request refund of room rent and deposits for key and T.V remote, within <strong>five (5) minutes</strong> of check-in time if room unsatisfactory. <em>NO refunds will be given outside this time for any reason.</em></li>
                   <li>The following <strong>WILL NOT</strong> be tolerated during your stay at AIRWAY MOTEL, for any reason: Illicit drug activity, solicitation (prostitution), illegal weapon possession, or any activities that would pose a danger to guests, staff, general public or in violation of any state/county/city municipal code.</li>
                   <li>Management reserves the right to <strong>EVICT</strong> any guest or visitors <strong>AT ANY TIME</strong>, without refund, for any damaging of property, harassment of other guests or staff, causing harm to others, refusal to pay rent fees, allowing/having unregistered visitors in room, participating in any illegal or suspicious activities or any other management policies/verbal directions. Any person(s) can be barred from entering AIRWAY MOTEL property at any time.</li>
                   <li>Management reserves the right to enter any room at any time, for inspection, for repairs, for cleaning, pest control measures, or other actions to maintain room/facilities. Management/staff will knock before entering room.</li>
                   <li>AIRWAY MOTEL, management/staff, does not/will not assume any responsibility for any; lost, stolen, or damage to personal items/valuables or vehicles. AIRWAY MOTEL, management/staff does not/will not assume any responsibility for any accident(s), personal injury or death(s) occurring on property and shall not be held liable for any of the for mentioned reason(s).</li>
                   <li>Upon check-out, eviction, or nonpayment of room rental fee, AIRWAY MOTEL/management/staff will assume any and all properties including valuables left in room/on property were left intentionally and assumes the right to discard the a for mentioned items. Should guest/tenant leave by circumstances beyond their control, management, at their discretion, will pack and store guest/tenant belongings for a period of <strong>30 days</strong> at a fee of <strong>$200 dollars</strong>, paid at time of recovery of items. Note: Any items that are excessively large (furniture and appliances), non-servable, perishable, or unsafe will not be stored.</li>
                   <li>Any tenant who commits, conducts, facilitates, allows, permits, or fails on Airway Motel property any public nuisance as defined in section 37-50 (c) or (d) of the Denver Revised Municipal Code, or any other activity prohibited by state law or the Denver Revised Municipal Code shall be subject to <strong>immediate eviction</strong>.</li>
                 </ol>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                />
                <Label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                  I have read and agree to the terms and conditions above.
                </Label>
              </div>

              {/* Signature pad */}
              <div>
                <div className="flex justify-between items-end mb-2">
                  <Label className="text-xs font-medium">Guest Signature *</Label>
                  <button
                    type="button"
                    onClick={() => {
                      sigCanvas.current?.clear();
                      setSignatureDataUrl('');
                      setSignatureFromPhone(false);
                    }}
                    className="text-xs text-destructive font-medium hover:underline"
                  >
                    Clear
                  </button>
                </div>

                {/* Sign with Phone toggle */}
                <div className="flex gap-2 mb-3">
                  <Button
                    variant={!showPhoneSignature ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setShowPhoneSignature(false);
                      setPhoneSigStatus('idle');
                      setPhoneSigDataUrl('');
                    }}
                  >
                    Sign Here
                  </Button>
                  <Button
                    variant={showPhoneSignature ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setShowPhoneSignature(true);
                      setPhoneSigStatus('generating');
                      setPhoneSigDataUrl('');
                    }}
                  >
                    Sign with Phone
                  </Button>
                </div>

                {/* Phone Signature Panel */}
                {showPhoneSignature && (
                  <PhoneSignaturePanel
                    onReceived={(sigUrl, terms) => {
                      setSignatureDataUrl(sigUrl);
                      setSignatureFromPhone(true);
                      if (terms) setTermsAccepted(true);
                      setPhoneSigStatus('received');
                      toast.success('Signature received from phone');
                    }}
                  />
                )}

                {/* Local signature pad (shown when not using phone) */}
                {!showPhoneSignature && (
                  <>
                    {signatureFromPhone && signatureDataUrl ? (
                      <>
                        <div
                          className="w-full h-36 border border-border rounded-lg bg-white dark:bg-zinc-100 relative overflow-hidden flex items-center justify-center"
                          style={{
                            backgroundImage: 'repeating-linear-gradient(#e2e8f0 0px, #e2e8f0 1px, transparent 1px, transparent 20px)',
                            backgroundSize: '100% 20px',
                          }}
                        >
                          <img
                            src={signatureDataUrl}
                            alt="Guest signature from phone"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                          <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
                          <p className="text-[11px] text-green-700 dark:text-green-300">
                            Signed on guest&apos;s phone. Tap <strong>Clear</strong> if you need to re-sign here.
                          </p>
                        </div>
                      </>
                    ) : (
                      <div
                        className="w-full h-36 border border-border rounded-lg bg-white dark:bg-zinc-100 relative overflow-hidden"
                        style={{
                          backgroundImage: 'repeating-linear-gradient(#e2e8f0 0px, #e2e8f0 1px, transparent 1px, transparent 20px)',
                          backgroundSize: '100% 20px',
                        }}
                      >
                        <SignatureCanvas
                          ref={sigCanvas}
                          canvasProps={{ className: 'w-full h-full absolute inset-0 cursor-crosshair' }}
                          penColor="#0f172a"
                          onEnd={() => {
                            if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
                              setSignatureDataUrl(sigCanvas.current.getCanvas().toDataURL('image/png'));
                            }
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 5: Confirmation ── */}
        {step === 5 && (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold mb-2">Check-in Complete!</h3>
              <p className="text-muted-foreground mb-1">
                Room <span className="font-semibold">{selectedRoom?.roomNumber}</span> has been assigned to{' '}
                <span className="font-semibold">{firstName} {lastName}</span>.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Stay ID: {completedStayId}
              </p>

              <div className="bg-muted/30 rounded-lg p-4 text-sm space-y-1 text-left max-w-xs mx-auto mb-6">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room</span>
                  <span className="font-medium">{selectedRoom?.roomNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <span className="font-medium">{checkInDate}, {checkInTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out</span>
                  <span className="font-medium">{checkOutDate}, {checkOutTime}</span>
                </div>
                 <Separator className="my-2" />
                 <div className="flex justify-between font-semibold">
                   <span>Total Paid</span>
                   <span>${totalDue.toFixed(2)}</span>
                 </div>
              </div>

              {idPhotoUrl && (
                <div className="mb-4 max-w-xs mx-auto">
                  <p className="text-xs text-muted-foreground mb-1">ID Photo on File:</p>
                  <img src={idPhotoUrl} alt="ID on file" className="w-full max-h-32 object-contain rounded border border-border bg-muted/20" />
                </div>
              )}

              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={resetForm}>
                  New Check-In
                </Button>
                <Button onClick={() => setActiveTab('dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        {step < 5 && (
          <div className="flex justify-between mt-4">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <Button
              onClick={step === 4 ? handleSubmit : handleNext}
              disabled={!canNext() || submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {step === 4 ? 'Complete Check-In' : 'Continue'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
