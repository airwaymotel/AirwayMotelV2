'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  BedSingle, BedDouble, ArrowRight, ArrowLeft, CheckCircle,
  CreditCard, Banknote, Wallet, QrCode, PenLine, Upload,
  Camera, Loader2, X, ImageIcon, CheckCheck, Smartphone, Keyboard,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import SignatureCanvas from 'react-signature-canvas';
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

const STEPS = [
  'Room',
  'ID Method',
  'Guest Details',
  'ID & Scan',
  'Payment',
  'Terms & Sign',
  'Confirm',
];

type IdMethod = 'manual' | 'phone-scan';

export default function CheckIn() {
  const rooms = useMotelStore((s) => s.rooms);
  const addGuest = useMotelStore((s) => s.addGuest);
  const addStay = useMotelStore((s) => s.addStay);
  const addPayment = useMotelStore((s) => s.addPayment);
  const updateRoomStatus = useMotelStore((s) => s.updateRoomStatus);
  const addActivity = useMotelStore((s) => s.addActivity);
  const setActiveTab = useMotelStore((s) => s.setActiveTab);

  // Step & method
  const [step, setStep] = useState(0);
  const [idMethod, setIdMethod] = useState<IdMethod | null>(null);

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
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [checkInTime, setCheckInTime] = useState('2:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('10:00 AM');

  // ID photo (manual upload)
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [idPhotoUrl, setIdPhotoUrl] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');

  // QR / Phone scan
  const [scanSessionId] = useState(() => Math.random().toString(36).substring(2, 10) + Date.now().toString(36));
  const [scanReceived, setScanReceived] = useState(false);
  const [scannedImageUrl, setScannedImageUrl] = useState<string>('');
  const [scannedSignatureUrl, setScannedSignatureUrl] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realtimeChannelRef = useRef<any>(null);

  const [completedStayId, setCompletedStayId] = useState('');

  // ── Derived ──
  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === 'available' && r.type === roomType),
    [rooms, roomType]
  );
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const rate = selectedRoom?.rate ?? (roomType === '1-bed' ? 65 : 85);

  // ── QR URL (the mobile scan page) ──
  const scanUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/scan/${scanSessionId}`
    : '';

  // ── Supabase Realtime listener for phone scan ──
  useEffect(() => {
    if (!supabase || idMethod !== 'phone-scan' || step !== 3) return;

    const channel = supabase.channel(`scan_${scanSessionId}`, {
      config: { broadcast: { self: true } },
    });

    channel.on('broadcast', { event: 'id_scanned' }, (payload) => {
      const { imageUrl, signatureDataUrl: sigUrl } = payload.payload;
      if (imageUrl) {
        setScannedImageUrl(imageUrl);
        setIdPhotoUrl(imageUrl);
      }
      if (sigUrl) {
        setScannedSignatureUrl(sigUrl);
        setSignatureDataUrl(sigUrl);
      }
      setScanReceived(true);
      toast.success('ID scan received from phone!');
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[Scan] Listening for ID scan on channel:', `scan_${scanSessionId}`);
      }
    });

    realtimeChannelRef.current = channel;

    return () => {
      if (supabase) supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  }, [idMethod, step, scanSessionId]);

  // ── Manual file upload handler ──
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setIdPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to Supabase Storage if connected
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
      // No Supabase — just use the data URL as preview
      setIdPhotoUrl(reader.result as string);
    }
  }, []);

  // ── Step validation ──
  const canNext = (): boolean => {
    switch (step) {
      case 0: return availableRooms.length > 0;
      case 1: return idMethod !== null;
      case 2: return firstName.length >= 2 && lastName.length >= 2 && phone.length >= 10;
      case 3:
        if (idMethod === 'phone-scan') return scanReceived;
        return idNumber.length >= 4 && dateOfBirth.length > 0;
      case 4: return true;
      case 5:
        if (idMethod === 'phone-scan') return termsAccepted && !!scannedSignatureUrl;
        return termsAccepted && !!signatureDataUrl;
      case 6: return false;
      default: return false;
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = () => {
    if (!selectedRoomId || !selectedRoom) return;

    const guestId = addGuest({
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

    const stayId = addStay({
      guestId,
      roomId: selectedRoomId,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      rateAmount: rate,
      status: 'active',
      keyDeposit: 10,
      tvRemoteDeposit: 10,
    });

    addPayment({
      stayId,
      amount: rate,
      method: paymentMethod,
      description: `Room charge (1 night, ${roomType})`,
    });

    addPayment({
      stayId,
      amount: 20,
      method: paymentMethod,
      description: 'Key + TV remote deposit',
    });

    updateRoomStatus(selectedRoomId, 'occupied');

    addActivity({
      guest: `${firstName} ${lastName}`,
      action: 'Check-in',
      room: selectedRoom.roomNumber,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
      status: 'Success',
    });

    // Save signature to Supabase if connected
    const sigData = idMethod === 'phone-scan' ? scannedSignatureUrl : signatureDataUrl;
    if (supabase && sigData) {
      supabase.from('signatures').insert({
        stay_id: stayId,
        guest_id: guestId,
        signature_data_url: sigData,
      }).then(({ error }) => {
        if (error) console.error('Failed to save signature:', error);
      });
    }

    setCompletedStayId(stayId);
    setStep(6);
    toast.success('Check-in completed successfully!');
  };

  const resetForm = () => {
    setStep(0);
    setIdMethod(null);
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
    setCheckInDate(new Date().toISOString().split('T')[0]);
    setCheckOutDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setCheckInTime('2:00 PM');
    setCheckOutTime('10:00 AM');
    setIdPhotoPreview(null);
    setIdPhotoUrl('');
    setSignatureDataUrl('');
    setScannedImageUrl('');
    setScannedSignatureUrl('');
    setScanReceived(false);
    setCompletedStayId('');
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
                  <p className="text-sm text-muted-foreground">$65/night</p>
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
                  <p className="text-sm text-muted-foreground">$85/night</p>
                </button>
              </div>

              <div>
                <Label className="mb-2 block">Available Rooms</Label>
                <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder={`${availableRooms.length} rooms available`} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        Room {r.roomNumber} — Floor {r.floor} (${r.rate}/night)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 1: ID Method Choice ── */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">How will you verify the guest&apos;s ID?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Manual Entry */}
                <button
                  onClick={() => setIdMethod('manual')}
                  className={`p-6 rounded-lg border-2 transition-all cursor-pointer text-left space-y-3 ${
                    idMethod === 'manual'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Keyboard className="w-8 h-8 text-muted-foreground" />
                    <span className="font-semibold text-lg">Manual Entry</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Type in ID details and upload a photo of the ID from this computer.
                  </p>
                  {idMethod === 'manual' && (
                    <Badge className="bg-primary text-primary-foreground">Selected</Badge>
                  )}
                </button>

                {/* Phone Scan */}
                <button
                  onClick={() => setIdMethod('phone-scan')}
                  className={`p-6 rounded-lg border-2 transition-all cursor-pointer text-left space-y-3 ${
                    idMethod === 'phone-scan'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-8 h-8 text-muted-foreground" />
                    <span className="font-semibold text-lg">Phone Scan</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Show a QR code to the guest. They scan it with their phone camera to upload their ID photo and sign.
                  </p>
                  {idMethod === 'phone-scan' && (
                    <Badge className="bg-primary text-primary-foreground">Selected</Badge>
                  )}
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Guest Details ── */}
        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guest Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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

        {/* ── Step 3: ID Info / Scan ── */}
        {step === 3 && idMethod === 'manual' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Keyboard className="w-5 h-5" /> Manual ID Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block">ID Type</Label>
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Driver License">Driver License</SelectItem>
                      <SelectItem value="State ID">State ID</SelectItem>
                      <SelectItem value="Passport">Passport</SelectItem>
                      <SelectItem value="Military ID">Military ID</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">ID State</Label>
                  <Input value={idState} onChange={(e) => setIdState(e.target.value)} placeholder="CO" />
                </div>
              </div>
              <div>
                <Label htmlFor="idNumber" className="mb-1.5 block">ID Number *</Label>
                <Input id="idNumber" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="DL-123456" />
              </div>
              <div>
                <Label htmlFor="dob" className="mb-1.5 block">Date of Birth *</Label>
                <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              </div>

              {/* File Upload */}
              <div>
                <Label className="mb-1.5 block">Upload ID Photo</Label>
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
                    <img src={idPhotoPreview} alt="ID Preview" className="w-full max-h-48 object-contain bg-muted/30" />
                    <button
                      onClick={() => { setIdPhotoPreview(null); setIdPhotoUrl(''); }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-8 border-2 border-dashed border-border rounded-lg flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors cursor-pointer"
                  >
                    <Upload className="w-8 h-8" />
                    <span className="text-sm font-medium">Click to upload ID photo</span>
                    <span className="text-xs">JPG, PNG — or take a photo</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && idMethod === 'phone-scan' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="w-5 h-5" /> Phone Scan — QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Show this QR code to the guest. They scan it with their phone to take a photo of their ID and sign the agreement.
              </p>

              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG
                    value={scanUrl}
                    size={220}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground break-all">
                {scanUrl}
              </p>

              <Separator />

              {/* Status */}
              {scanReceived ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <CheckCheck className="w-5 h-5" />
                    <span className="font-semibold">ID scan received from phone!</span>
                  </div>

                  {scannedImageUrl && (
                    <div className="rounded-lg overflow-hidden border border-border">
                      <p className="text-xs font-medium text-muted-foreground px-3 pt-2">Scanned ID Photo:</p>
                      <img
                        src={scannedImageUrl}
                        alt="Scanned ID"
                        className="w-full max-h-48 object-contain bg-muted/30 p-2"
                      />
                    </div>
                  )}

                  {scannedSignatureUrl && (
                    <div className="rounded-lg overflow-hidden border border-border">
                      <p className="text-xs font-medium text-muted-foreground px-3 pt-2">Guest Signature:</p>
                      <img
                        src={scannedSignatureUrl}
                        alt="Guest Signature"
                        className="w-full max-h-24 object-contain bg-white p-2"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground animate-pulse">Waiting for guest to scan and upload...</p>
                  <p className="text-xs text-muted-foreground mt-1">The ID photo and signature will appear here automatically.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Payment ── */}
        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: 'card' as PaymentMethod, icon: CreditCard, label: 'Credit Card' },
                  { value: 'debit' as PaymentMethod, icon: Wallet, label: 'Debit Card' },
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

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Room ({roomType === '1-bed' ? '1-Bed King' : '2-Bed Queen'})</span>
                  <span className="font-medium">${rate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Key Deposit</span>
                  <span className="font-medium">$10</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>TV Remote Deposit</span>
                  <span className="font-medium">$10</span>
                </div>
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total Due</span>
                  <span>${rate + 20}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 5: Terms & Signature ── */}
        {step === 5 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Terms & Signature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 text-xs text-muted-foreground space-y-2 max-h-48 overflow-y-auto">
                <p className="font-semibold text-foreground text-sm mb-2">Airway Motel — Terms and Conditions</p>
                <p>By signing below, as a guest of AIRWAY MOTEL you state that you have fully read the statements below and agree to abide by them.</p>
                <ol className="list-decimal list-inside space-y-1.5 mt-2">
                  <li>Checkout time is 10 AM on date of checkout.</li>
                  <li>A fee of $10 per hour will be assessed for each hour past checkout time.</li>
                  <li>Deposits for key and T.V. remote will not be returned unless each is returned in serviceable condition.</li>
                  <li>Guests may request refund of room rent and deposits within five (5) minutes of check-in if room unsatisfactory.</li>
                  <li>No illicit drug activity, solicitation, illegal weapon possession, or dangerous activities tolerated.</li>
                  <li>Management reserves the right to evict any guest at any time without refund for policy violations.</li>
                  <li>Management reserves the right to enter any room at any time for inspection or repairs.</li>
                  <li>Airway Motel assumes no responsibility for lost, stolen, or damaged personal items.</li>
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

              {/* Signature — different for each method */}
              {idMethod === 'phone-scan' ? (
                <div>
                  {scannedSignatureUrl ? (
                    <div className="border border-border rounded-lg p-3 bg-white">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Signature captured from phone:</p>
                      <img
                        src={scannedSignatureUrl}
                        alt="Guest Signature"
                        className="max-h-24 object-contain mix-blend-multiply"
                      />
                    </div>
                  ) : (
                    <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                      <p className="text-sm">Waiting for signature from phone...</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <Label className="text-xs font-medium">Guest Signature *</Label>
                    <button
                      type="button"
                      onClick={() => { sigCanvas.current?.clear(); setSignatureDataUrl(''); }}
                      className="text-xs text-destructive font-medium hover:underline"
                    >
                      Clear
                    </button>
                  </div>
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
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 6: Confirmation ── */}
        {step === 6 && (
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
                  <span>${rate + 20}</span>
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
        {step < 6 && (
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
              onClick={step === 5 ? handleSubmit : handleNext}
              disabled={!canNext()}
            >
              {step === 5 ? 'Complete Check-In' : 'Continue'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
