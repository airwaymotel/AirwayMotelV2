'use client';

import { useState, useMemo } from 'react';
import { BedSingle, BedDouble, ArrowRight, ArrowLeft, CheckCircle, CreditCard, Banknote, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useMotelStore } from '@/lib/store';
import { toast } from 'sonner';
import type { RoomType, PaymentMethod } from '@/lib/types';

const STEPS = [
  'Room Type',
  'Guest Details',
  'ID Information',
  'Payment',
  'Terms & Signature',
  'Confirmation',
];

export default function CheckIn() {
  const rooms = useMotelStore((s) => s.rooms);
  const addGuest = useMotelStore((s) => s.addGuest);
  const addStay = useMotelStore((s) => s.addStay);
  const addPayment = useMotelStore((s) => s.addPayment);
  const updateRoomStatus = useMotelStore((s) => s.updateRoomStatus);
  const addActivity = useMotelStore((s) => s.addActivity);
  const setActiveTab = useMotelStore((s) => s.setActiveTab);

  const [step, setStep] = useState(0);
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
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [checkOutDate, setCheckOutDate] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().split('T')[0]
  );
  const [checkInTime, setCheckInTime] = useState('2:00 PM');
  const [checkOutTime, setCheckOutTime] = useState('10:00 AM');

  const [completedStayId, setCompletedStayId] = useState('');

  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === 'available' && r.type === roomType),
    [rooms, roomType]
  );

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const rate = selectedRoom?.rate ?? (roomType === '1-bed' ? 65 : 85);

  const canNext = (): boolean => {
    switch (step) {
      case 0: return availableRooms.length > 0;
      case 1: return firstName.length >= 2 && lastName.length >= 2 && phone.length >= 10;
      case 2: return idNumber.length >= 4 && dateOfBirth.length > 0;
      case 3: return true;
      case 4: return termsAccepted;
      case 5: return false;
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

    setCompletedStayId(stayId);
    setStep(5);
    toast.success('Check-in completed successfully!');
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
    setDateOfBirth('');
    setCheckInDate(new Date().toISOString().split('T')[0]);
    setCheckOutDate(new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    setCheckInTime('2:00 PM');
    setCheckOutTime('10:00 AM');
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
                    ? 'bg-green-100 text-green-700'
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

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guest Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName" className="mb-1.5 block">First Name *</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="mb-1.5 block">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone" className="mb-1.5 block">Phone *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(720) 555-0100"
                />
              </div>
              <div>
                <Label htmlFor="email" className="mb-1.5 block">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@email.com"
                />
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

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">ID Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="idNumber" className="mb-1.5 block">ID Number *</Label>
                <Input
                  id="idNumber"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="DL-123456 or PASS-12345"
                />
              </div>
              <div>
                <Label htmlFor="dob" className="mb-1.5 block">Date of Birth *</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                <p className="font-semibold mb-1">ID Verification</p>
                <p>In production, this step would include ID barcode scanning and photo capture for document verification.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
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

        {step === 4 && (
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

              <div className="border border-dashed border-border rounded-lg p-6 text-center text-muted-foreground">
                <p className="text-sm font-medium mb-1">Guest Signature</p>
                <p className="text-xs">In production, signature capture canvas would appear here.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card>
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
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
              disabled={!canNext()}
            >
              {step === 4 ? 'Complete Check-In' : 'Continue'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
