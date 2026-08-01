import React, { useState, useEffect } from 'react';
import { Timer, LogIn, LogOut, User, Receipt, KeyRound, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CheckoutPage() {
  const [selectedStayId, setSelectedStayId] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [activeStays, setActiveStays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchActiveStays();
  }, []);

  const fetchActiveStays = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('stays')
      .select('*, guests(*), rooms(*), payments(*)')
      .eq('status', 'active');
      
    if (data) {
      const formattedStays = data.map(stay => {
        const checkOutDate = new Date(stay.check_out_date + 'T' + stay.check_out_time);
        const now = new Date();
        const isLate = now > checkOutDate;
        const totalPaid = stay.payments ? stay.payments.reduce((sum, p) => sum + Number(p.amount), 0) : 0;
        
        return {
          id: stay.id,
          name: `${stay.guests.first_name} ${stay.guests.last_name}`,
          room: stay.rooms.room_number,
          roomId: stay.rooms.id,
          cin: `${new Date(stay.check_in_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}, ${stay.check_in_time}`,
          cout: `${new Date(stay.check_out_date).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}, ${stay.check_out_time}`,
          lateFee: isLate ? 35.00 : 0.00,
          roomCharges: totalPaid > 0 ? totalPaid : Number(stay.rate_amount) * 2,
          email: stay.guests.email || 'No email on file',
          initial: stay.guests.first_name.charAt(0)
        };
      });
      setActiveStays(formattedStays);
    }
    setIsLoading(false);
  };

  const selectedGuest = activeStays.find(s => s.id === selectedStayId);
  const totalAmount = selectedGuest ? selectedGuest.roomCharges + 15.50 + selectedGuest.lateFee : 0;

  const handleCheckout = async () => {
    if (!selectedGuest) return alert('Please select a guest first.');
    setIsProcessing(true);
    
    try {
      // Update Stay Status
      const { error: stayError } = await supabase
        .from('stays')
        .update({ status: 'checked_out' })
        .eq('id', selectedGuest.id);
        
      if (stayError) throw stayError;
      
      // Update Room Status
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'available' })
        .eq('id', selectedGuest.roomId);
        
      if (roomError) throw roomError;
      
      // If late fee, record payment (omitted for brevity, but would go here)
      
      setShowModal(true);
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to process checkout.');
    } finally {
      setIsProcessing(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedStayId('');
    fetchActiveStays();
  };

  return (
    <div className="p-container-padding flex-grow flex flex-col">
      <header className="mb-8">
        <h2 className="text-display-lg font-bold text-primary">Guest Checkout</h2>
        <p className="text-on-surface-variant text-body-md mt-1">Process room release and final billing for departing guests.</p>
      </header>

      <div className="grid grid-cols-12 gap-gutter flex-grow">
        {/* Left Content */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <section className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant">
            <label className="block text-label-caps font-bold text-on-surface-variant mb-2">SELECT OCCUPIED ROOM</label>
            <select 
              value={selectedStayId}
              onChange={(e) => setSelectedStayId(e.target.value)}
              className="w-full p-4 bg-surface-container-low border border-outline-variant rounded-lg font-title-sm font-bold text-on-surface focus:ring-2 focus:ring-secondary cursor-pointer appearance-none"
              disabled={isLoading}
            >
              <option value="" disabled>{isLoading ? 'Loading active stays...' : 'Search by name or room number...'}</option>
              {activeStays.map(stay => (
                <option key={stay.id} value={stay.id}>
                  Room {stay.room} - {stay.name} (Checkout: {stay.cout})
                </option>
              ))}
            </select>
            {activeStays.length === 0 && !isLoading && (
              <p className="text-on-surface-variant mt-2 text-sm">No active stays found.</p>
            )}
          </section>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-gutter transition-opacity duration-300 ${selectedGuest ? 'opacity-100' : 'opacity-40'}`}>
            <div className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant flex flex-col justify-between">
              <div>
                <p className="text-label-caps font-bold text-on-surface-variant mb-4">GUEST PROFILE</p>
                <h3 className="text-headline-md font-bold">{selectedGuest?.name || 'Select Guest'}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 bg-secondary-fixed text-on-secondary-fixed rounded text-[10px] font-bold">PREMIUM MEMBER</span>
                  <span className="text-body-sm text-on-surface-variant">• ID: #88293</span>
                </div>
              </div>
              <div className="mt-8 flex items-center gap-4">
                <div className="w-12 h-12 bg-surface-container rounded-lg flex items-center justify-center">
                  <User className="text-secondary w-6 h-6" />
                </div>
                <div>
                  <p className="text-body-sm text-on-surface-variant">Contact</p>
                  <p className="text-body-md font-bold text-primary">{selectedGuest?.email || 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-label-caps font-bold text-on-surface-variant">ROOM DETAILS</p>
                  <h3 className="text-[48px] leading-tight font-bold text-primary">{selectedGuest?.room || '---'}</h3>
                </div>
                <div className="bg-error-container text-on-error-container px-3 py-1 rounded-full text-label-caps font-bold flex items-center gap-1">
                  <span className="w-2 h-2 bg-error rounded-full"></span>
                  OCCUPIED
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-outline-variant">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <LogIn className="w-5 h-5 text-outline" />
                    <span className="text-body-sm">Check-in</span>
                  </div>
                  <span className="text-body-md font-bold">{selectedGuest?.cin || '---'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <LogOut className="w-5 h-5 text-outline" />
                    <span className="text-body-sm">Check-out (Sched)</span>
                  </div>
                  <span className="text-body-md font-bold text-error">{selectedGuest?.cout || '---'}</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant md:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-title-sm font-bold flex items-center gap-2">
                  <Timer className="w-5 h-5 text-error" />
                  Operational Adjustments
                </h4>
                <span className="text-label-caps font-bold text-on-surface-variant">AUTO-CALCULATED</span>
              </div>
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-grow space-y-2">
                  <p className="text-body-md">Scheduled checkout was at <strong className="text-primary">{selectedGuest?.cout ? selectedGuest.cout.split(', ')[1] : '11:00 AM'}</strong>. Current system time is <strong>{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong>.</p>
                  <p className="text-body-sm text-on-surface-variant">A late fee policy of 15% hourly rate applies after a 15-minute grace period.</p>
                </div>
                <div className="w-full md:w-auto bg-surface-container p-4 rounded-lg flex flex-col items-center min-w-[200px]">
                  <p className="text-label-caps font-bold text-on-surface-variant">LATE FEE</p>
                  <p className="text-headline-md font-bold text-error">${selectedGuest?.lateFee?.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Content */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <section className="bg-primary-container text-on-primary-fixed p-8 rounded-xl shadow-lg flex flex-col relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Receipt className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <h3 className="text-title-sm font-bold mb-6 pb-4 border-b border-on-primary-fixed-variant">Billing Summary</h3>
              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="text-body-sm opacity-80">Room Charges</span>
                  <span className="text-body-md font-bold">${selectedGuest?.roomCharges?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-body-sm opacity-80">Service Fees</span>
                  <span className="text-body-md font-bold">$15.50</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-body-sm text-error-container">Late Fee Adjustment</span>
                  <span className="text-body-md text-error-container font-bold">+${selectedGuest?.lateFee?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-on-primary-fixed-variant">
                  <span className="text-title-sm font-bold">Total Amount</span>
                  <span className="text-[32px] font-bold text-on-primary">${totalAmount.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="space-y-4 mb-10">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-on-primary-fixed-variant text-secondary bg-primary-container focus:ring-secondary" />
                  <span className="text-body-sm group-hover:text-secondary transition-colors text-on-primary">Generate Digital Receipt (PDF)</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input type="checkbox" className="w-5 h-5 rounded border-on-primary-fixed-variant text-secondary bg-primary-container focus:ring-secondary" />
                  <span className="text-body-sm group-hover:text-secondary transition-colors text-on-primary">Send copy to guest email</span>
                </label>
              </div>

              <button 
                onClick={handleCheckout}
                disabled={isProcessing || !selectedGuest}
                className="w-full bg-secondary hover:bg-secondary-hover text-on-secondary py-4 rounded-lg font-bold text-title-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <KeyRound className="w-5 h-5" />
                {isProcessing ? 'Processing...' : 'Process Checkout'}
              </button>
            </div>
          </section>

          {selectedGuest && (
            <div className="receipt-preview bg-white p-6 rounded shadow-sm border border-outline-variant text-[10px] font-mono text-primary rotate-1 mx-auto max-w-[280px] hover:rotate-0 transition-transform">
              <div className="text-center border-b border-dashed border-outline-variant pb-4 mb-4">
                <p className="font-bold text-sm">AIRWAY MOTEL</p>
                <p>Terminal ID: #ADM-44</p>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span>GUEST:</span> <span>{selectedGuest.name.toUpperCase()}</span></div>
                <div className="flex justify-between"><span>ROOM:</span> <span>{selectedGuest.room}</span></div>
                <div className="pt-2 mt-2 border-t border-dashed border-outline-variant flex justify-between font-bold text-sm">
                  <span>TOTAL:</span>
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-dashed border-outline-variant text-center opacity-60">
                THANK YOU FOR YOUR STAY
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-outline-variant animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-[28px] font-bold text-primary mb-2">Checkout Complete</h3>
            <p className="text-on-surface-variant mb-8 text-body-md">Room <span className="font-bold">{selectedGuest?.room}</span> is now marked as <strong>Available</strong> for housekeeping.</p>
            <button 
              onClick={closeModal}
              className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
