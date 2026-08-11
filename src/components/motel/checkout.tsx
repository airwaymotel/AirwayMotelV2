'use client';

import { useState, useMemo } from 'react';
import { Timer, LogIn, LogOut, User, Receipt, KeyRound, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMotelStore } from '@/lib/store';
import { toast } from 'sonner';

export default function Checkout() {
  const getActiveStays = useMotelStore((s) => s.getActiveStays);
  const checkoutStay = useMotelStore((s) => s.checkoutStay);
  const addPayment = useMotelStore((s) => s.addPayment);
  const addActivity = useMotelStore((s) => s.addActivity);
  const setActiveTab = useMotelStore((s) => s.setActiveTab);

  const [selectedStayId, setSelectedStayId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const activeStays = getActiveStays();

  const selectedStay = activeStays.find((s) => s.id === selectedStayId);

  // Calculate late fee: $10/hour after 10 AM checkout
  const lateFee = useMemo(() => {
    if (!selectedStay) return 0;
    const checkoutDateTime = new Date(`${selectedStay.checkOutDate}T${selectedStay.checkOutTime}`);
    const now = new Date();
    if (now <= checkoutDateTime) return 0;
    const hoursLate = Math.ceil((now.getTime() - checkoutDateTime.getTime()) / (1000 * 60 * 60));
    return hoursLate * 10;
  }, [selectedStay]);

  const totalPaid = selectedStay
    ? selectedStay.payments.reduce((sum, p) => sum + p.amount, 0)
    : 0;

  const serviceFees = 15.5;
  const totalAmount = selectedStay ? totalPaid + serviceFees + lateFee : 0;

  const handleCheckout = async () => {
    if (!selectedStay) return;
    setIsProcessing(true);

    try {
      // Record late fee if applicable
      if (lateFee > 0) {
        addPayment({
          stayId: selectedStay.id,
          amount: lateFee,
          method: 'cash',
          description: `Late checkout fee (${lateFee / 10} hour(s) @ $10/hr)`,
        });
      }

      // Process checkout
      checkoutStay(selectedStay.id);

      addActivity({
        guest: `${selectedStay.guest.firstName} ${selectedStay.guest.lastName}`,
        action: 'Check-out',
        room: selectedStay.room.roomNumber,
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        status: 'Success',
      });

      setShowSuccess(true);
      toast.success('Checkout processed successfully!');
    } catch {
      toast.error('Failed to process checkout.');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setShowSuccess(false);
    setSelectedStayId('');
    setActiveTab('dashboard');
  };

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">Guest Checkout</h2>
        <p className="text-muted-foreground mt-1">
          Process room release and final billing for departing guests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Content */}
        <div className="lg:col-span-8 space-y-4">
          <Card>
            <CardContent className="p-4">
              <Label className="text-xs text-muted-foreground uppercase font-semibold mb-2 block">
                Select Occupied Room
              </Label>
              <Select value={selectedStayId} onValueChange={setSelectedStayId}>
                <SelectTrigger>
                  <SelectValue placeholder={activeStays.length > 0 ? 'Search by name or room number...' : 'No active stays'} />
                </SelectTrigger>
                <SelectContent>
                  {activeStays.map((stay) => (
                    <SelectItem key={stay.id} value={stay.id}>
                      Room {stay.room.roomNumber} — {stay.guest.firstName} {stay.guest.lastName} (Checkout: {stay.checkOutDate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeStays.length === 0 && (
                <p className="text-muted-foreground mt-2 text-sm">No active stays found.</p>
              )}
            </CardContent>
          </Card>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${selectedStay ? 'opacity-100' : 'opacity-40'}`}>
            {/* Guest Profile */}
            <Card>
              <CardContent className="p-5">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-3">Guest Profile</p>
                <h3 className="text-xl font-bold">
                  {selectedStay ? `${selectedStay.guest.firstName} ${selectedStay.guest.lastName}` : 'Select Guest'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-[10px]">Guest</Badge>
                  <span className="text-xs text-muted-foreground">ID: {selectedStay?.guest.idNumber || '---'}</span>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <User className="text-muted-foreground w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contact</p>
                    <p className="text-sm font-medium">{selectedStay?.guest.phone || 'N/A'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Room Details */}
            <Card>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-semibold">Room Details</p>
                    <h3 className="text-4xl font-bold mt-1">
                      {selectedStay?.room.roomNumber || '---'}
                    </h3>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">
                    <span className="w-1.5 h-1.5 bg-current rounded-full mr-1" />
                    OCCUPIED
                  </Badge>
                </div>
                <div className="space-y-2 pt-3 border-t border-border">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <LogIn className="w-4 h-4" />
                      <span className="text-xs">Check-in</span>
                    </div>
                    <span className="text-sm font-medium">{selectedStay?.checkInDate || '---'}, {selectedStay?.checkInTime || ''}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <LogOut className="w-4 h-4" />
                      <span className="text-xs">Check-out (Sched)</span>
                    </div>
                    <span className="text-sm font-medium text-red-600">{selectedStay?.checkOutDate || '---'}, {selectedStay?.checkOutTime || ''}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Late Fee */}
            <Card className="md:col-span-2">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Timer className="w-4 h-4 text-red-500" />
                    Operational Adjustments
                  </h4>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Auto-calculated</span>
                </div>
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <div className="flex-grow space-y-1">
                    <p className="text-sm">
                      Scheduled checkout at{' '}
                      <strong>{selectedStay?.checkOutTime || '10:00 AM'}</strong>.
                      Current time is{' '}
                      <strong>{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</strong>.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      A late fee of $10/hour applies after checkout time.
                    </p>
                  </div>
                  <div className="bg-muted p-3 rounded-lg flex flex-col items-center min-w-[140px]">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Late Fee</p>
                    <p className="text-xl font-bold text-red-600">${lateFee.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Content — Billing Summary */}
        <div className="lg:col-span-4">
          <Card className="bg-primary text-primary-foreground border-0 shadow-lg">
            <CardContent className="p-6 relative overflow-hidden">
              <Receipt className="absolute top-2 right-2 w-24 h-24 opacity-10" />
              <div className="relative z-10">
                <h3 className="text-base font-semibold mb-4 pb-3 border-b border-primary-foreground/20">
                  Billing Summary
                </h3>
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-80">Room Charges</span>
                    <span className="text-sm font-bold">${totalPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm opacity-80">Service Fees</span>
                    <span className="text-sm font-bold">${serviceFees.toFixed(2)}</span>
                  </div>
                  {lateFee > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm opacity-80">Late Fee</span>
                      <span className="text-sm font-bold text-red-300">+${lateFee.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-3 border-t border-primary-foreground/20">
                    <span className="text-base font-semibold">Total Amount</span>
                    <span className="text-2xl font-bold">${totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <Button
                  onClick={handleCheckout}
                  disabled={isProcessing || !selectedStay}
                  className="w-full bg-amber-500 dark:bg-amber-600 hover:bg-amber-600 dark:hover:bg-amber-500 text-white py-3 text-sm font-bold shadow-lg"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  {isProcessing ? 'Processing...' : 'Process Checkout'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Receipt Preview */}
          {selectedStay && (
            <Card className="mt-4">
              <CardContent className="p-4 text-[10px] font-mono text-foreground">
                <div className="text-center border-b border-dashed border-border pb-3 mb-3">
                  <p className="font-bold text-xs">AIRWAY MOTEL</p>
                  <p>Terminal ID: #ADM-44</p>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>GUEST:</span>
                    <span>{`${selectedStay.guest.firstName} ${selectedStay.guest.lastName}`.toUpperCase()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ROOM:</span>
                    <span>{selectedStay.room.roomNumber}</span>
                  </div>
                  <div className="flex justify-between pt-2 mt-2 border-t border-dashed border-border font-bold text-xs">
                    <span>TOTAL:</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-dashed border-border text-center opacity-60">
                  THANK YOU FOR YOUR STAY
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccess} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="text-center max-w-sm">
          <DialogHeader>
            <DialogTitle className="sr-only">Checkout Complete</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold mb-2">Checkout Complete</h3>
            <p className="text-muted-foreground mb-6">
              Room <span className="font-semibold">{selectedStay?.room.roomNumber}</span> is now marked as{' '}
              <strong>Cleaning</strong> for housekeeping.
            </p>
            <Button onClick={closeModal} className="w-full">
              Return to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Minimal Label component for internal use
function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={className} {...props}>
      {children}
    </label>
  );
}
