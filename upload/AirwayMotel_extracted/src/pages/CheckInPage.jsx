import React, { useState, useEffect, useRef } from 'react';
import { BedSingle, BedDouble, Camera, ArrowRight, Info, CheckCircle, Smartphone } from 'lucide-react';
import SectionCard from '../components/ui/SectionCard';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import SignatureCanvas from 'react-signature-canvas';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { TERMS_AND_CONDITIONS, TERMS_HEADER } from '../data/termsAndConditions';

const schema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  dob: z.string().min(1, "Date of birth is required"),
  idNumber: z.string().min(4, "ID Number is required"),
  phone: z.string().min(10, "Valid phone number required"),
  email: z.string().email("Invalid email address").or(z.literal('')),
  checkInDate: z.string().min(1, "Required"),
  checkInTime: z.string().min(1, "Required"),
  checkOutDate: z.string().min(1, "Required"),
  checkOutTime: z.string().min(1, "Required"),
});

export default function CheckInPage() {
  const navigate = useNavigate();
  const sigCanvas = useRef(null);
  
  const [roomType, setRoomType] = useState('1-bed');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  
  const [showQRModal, setShowQRModal] = useState(false);
  const [digitalKeyData, setDigitalKeyData] = useState(null);
  const [assignedRoomNumber, setAssignedRoomNumber] = useState('');

  const [idImageUrl, setIdImageUrl] = useState(null);
  const [showMobileScanModal, setShowMobileScanModal] = useState(false);
  const [scanSessionId, setScanSessionId] = useState('');
  const [parsedIdData, setParsedIdData] = useState(null);
  const [mobileSignatureDataUrl, setMobileSignatureDataUrl] = useState(null);

  // Holds the active Realtime channel for the mobile ID-scan handoff so we
  // can remove it on success or when the admin closes the modal.
  const scanChannelRef = useRef(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      checkInDate: new Date().toISOString().split('T')[0],
      checkInTime: new Date().toLocaleTimeString('en-GB', {hour: '2-digit', minute:'2-digit'}),
      checkOutTime: '11:00',
      email: ''
    }
  });

  const startMobileScanSession = () => {
    const sessionId = Math.random().toString(36).substring(7);
    setScanSessionId(sessionId);

    // Subscribe BEFORE showing the QR so the channel is listening by the time
    // the mobile device uploads — otherwise a fast upload can beat subscription
    // and the broadcast is missed.
    const channel = supabase.channel(`scan_${sessionId}`)
      .on('broadcast', { event: 'id_scanned' }, (payload) => {
        const { imageUrl, parsedData, signatureDataUrl } = payload.payload;
        setIdImageUrl(imageUrl);
        
        if (parsedData) {
          setParsedIdData(parsedData);
          reset((prev) => ({
            ...prev,
            firstName: parsedData.firstName || prev.firstName,
            lastName: parsedData.lastName || prev.lastName,
            dob: parsedData.dob || prev.dob,
            idNumber: parsedData.idNumber || prev.idNumber,
          }));
        }

        if (signatureDataUrl) {
          setMobileSignatureDataUrl(signatureDataUrl);
        }

        if (parsedData && signatureDataUrl) {
          toast.success('ID fields & Signature auto-filled from mobile!');
        } else {
          toast.success('Data successfully received from mobile device!');
        }
        
        setShowMobileScanModal(false);
        if (scanChannelRef.current) {
          supabase.removeChannel(scanChannelRef.current);
          scanChannelRef.current = null;
        }
      })
      .subscribe();

    scanChannelRef.current = channel;
    setShowMobileScanModal(true);
  };

  const closeMobileScanModal = () => {
    if (scanChannelRef.current) {
      supabase.removeChannel(scanChannelRef.current);
      scanChannelRef.current = null;
    }
    setShowMobileScanModal(false);
  };

  useEffect(() => {
    fetchAvailableRooms();
  }, [roomType]);

  const fetchAvailableRooms = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('status', 'available')
      .eq('type', roomType)
      .order('room_number', { ascending: true });
    
    setAvailableRooms(data || []);
    if (data && data.length > 0) {
      setSelectedRoomId(data[0].id);
    } else {
      setSelectedRoomId('');
    }
  };

  const clearSignature = () => {
    sigCanvas.current?.clear();
  };

  const onSubmit = async (data) => {
    if (!selectedRoomId) {
      toast.error('Please select an available room.');
      return;
    }
    
    let finalSignatureUrl = mobileSignatureDataUrl;
    if (!finalSignatureUrl) {
      if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
        toast.error('Please provide a digital signature.');
        return;
      }
      finalSignatureUrl = sigCanvas.current.getCanvas().toDataURL('image/png');
    }

    try {
      // 1. Create Guest
      const { data: guestData, error: guestError } = await supabase
        .from('guests')
        .insert([{
          first_name: data.firstName,
          last_name: data.lastName,
          date_of_birth: data.dob,
          id_number: data.idNumber,
          id_photo_url: idImageUrl || null,
          phone: data.phone,
          email: data.email || null,
          id_type: parsedIdData?.idType || null,
          id_state: parsedIdData?.idState || null,
          address: parsedIdData?.address || null,
          city: parsedIdData?.city || null,
          state: parsedIdData?.state || null,
          zip: parsedIdData?.zip || null,
          sex: parsedIdData?.sex || null,
          eye_color: parsedIdData?.eyeColor || null,
          height: parsedIdData?.height || null
        }])
        .select()
        .single();
        
      if (guestError) throw guestError;

      // 2. Update Room
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'occupied' })
        .eq('id', selectedRoomId);
        
      if (roomError) throw roomError;

      // 3. Create Stay
      const rateAmount = roomType === '1-bed' ? 85 : 120;
      const { data: stayData, error: stayError } = await supabase
        .from('stays')
        .insert([{
          guest_id: guestData.id,
          room_id: selectedRoomId,
          rate_type: 'daily',
          rate_amount: rateAmount,
          check_in_date: data.checkInDate,
          check_in_time: data.checkInTime,
          check_out_date: data.checkOutDate,
          check_out_time: data.checkOutTime,
          status: 'active'
        }])
        .select()
        .single();
        
      if (stayError) throw stayError;

      // 4. Save Signature
      const { error: sigError } = await supabase
        .from('signatures')
        .insert([{
          stay_id: stayData.id,
          guest_id: guestData.id,
          signature_data_url: finalSignatureUrl
        }]);
        
      if (sigError) throw sigError;

      // 5. Create Payment
      const totalDue = rateAmount * 1.09;
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          stay_id: stayData.id,
          amount: totalDue,
          method: paymentMethod,
          receipt_generated: true
        }]);
        
      if (paymentError) throw paymentError;

      toast.success('Check-in completed successfully!');
      
      const roomInfo = availableRooms.find(r => r.id === selectedRoomId);
      setAssignedRoomNumber(roomInfo?.room_number || '');
      setDigitalKeyData(JSON.stringify({
        stay_id: stayData.id,
        room: roomInfo?.room_number,
        token: Math.random().toString(36).substring(7)
      }));
      setShowQRModal(true);

    } catch (error) {
      console.error('Error during check-in:', error);
      toast.error('Failed to complete check-in: ' + error.message);
    }
  };

  return (
    <div className="flex-1 p-container-padding max-w-5xl mx-auto w-full">
      <header className="mb-10">
        <h2 className="text-display-lg font-bold text-primary mb-2">New Guest Check-In</h2>
        <p className="text-on-surface-variant text-body-md">Complete all sections to generate the digital key and room assignment.</p>
      </header>

      <form className="space-y-8 pb-32" onSubmit={handleSubmit(onSubmit)}>
        
        {/* Section 1: Room Selection */}
        <SectionCard 
          number="1" 
          title="Room Selection" 
          rightContent={<span className="text-secondary font-bold text-title-sm">${roomType === '1-bed' ? '85.00' : '120.00'} <span className="font-normal text-on-surface-variant text-body-sm">/ night</span></span>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-label-caps text-on-surface-variant uppercase font-bold">Room Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  type="button" 
                  onClick={() => setRoomType('1-bed')}
                  className={`border-2 p-4 rounded-lg flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    roomType === '1-bed' 
                      ? 'border-secondary bg-secondary-fixed text-on-secondary-fixed' 
                      : 'border-outline-variant hover:border-secondary opacity-60'
                  }`}
                >
                  <BedSingle className="w-6 h-6" />
                  <span className="font-bold">1-Bed Standard</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setRoomType('2-bed')}
                  className={`border-2 p-4 rounded-lg flex flex-col items-center gap-2 transition-all cursor-pointer ${
                    roomType === '2-bed' 
                      ? 'border-secondary bg-secondary-fixed text-on-secondary-fixed' 
                      : 'border-outline-variant hover:border-secondary opacity-60'
                  }`}
                >
                  <BedDouble className="w-6 h-6" />
                  <span className="font-bold">2-Bed Queen</span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-label-caps text-on-surface-variant uppercase font-bold">Available Room Number</label>
              <select 
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full h-14 bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary text-body-md"
                required
              >
                <option value="" disabled>Select a room...</option>
                {availableRooms.map(room => (
                  <option key={room.id} value={room.id}>Room {room.room_number} - Floor {room.floor}</option>
                ))}
              </select>
              {availableRooms.length === 0 && (
                <p className="text-error text-sm mt-1">No rooms available for this type.</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Section 2 & 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden">
            <div className="bg-surface-container-low px-6 py-4 border-b border-outline-variant flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-sm">2</span>
              <h3 className="text-title-sm text-on-surface font-bold">Guest ID Identification</h3>
            </div>
            <div className="p-6 space-y-6">
              
              {idImageUrl ? (
                <div className="border-2 border-outline rounded-xl p-4 text-center bg-surface-container-lowest relative">
                  <img src={idImageUrl} alt="Scanned ID" className="h-40 mx-auto rounded object-contain" />
                  <button type="button" onClick={() => setIdImageUrl(null)} className="absolute top-2 right-2 bg-error text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider cursor-pointer">Remove</button>
                  <p className="text-secondary font-bold text-sm mt-2 flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> ID Successfully Captured</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <label className="border-2 border-dashed border-outline rounded-xl p-6 text-center bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer group flex flex-col items-center justify-center">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => setIdImageUrl(e.target.result);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <Camera className="w-8 h-8 text-outline mb-2 group-hover:text-secondary" />
                    <p className="font-bold text-on-surface text-sm">Upload File</p>
                  </label>
                  <div 
                    onClick={startMobileScanSession}
                    className="border-2 border-dashed border-outline rounded-xl p-6 text-center bg-surface-container-lowest hover:bg-surface-container hover:border-secondary transition-colors cursor-pointer group flex flex-col items-center justify-center"
                  >
                    <Smartphone className="w-8 h-8 text-outline mb-2 group-hover:text-secondary" />
                    <p className="font-bold text-on-surface text-sm group-hover:text-secondary">Use Mobile Camera</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-caps text-on-surface-variant uppercase font-bold">First Name</label>
                  <input {...register('firstName')} type="text" placeholder="John" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4" />
                  {errors.firstName && <p className="text-error text-xs">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-label-caps text-on-surface-variant uppercase font-bold">Last Name</label>
                  <input {...register('lastName')} type="text" placeholder="Doe" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4" />
                  {errors.lastName && <p className="text-error text-xs">{errors.lastName.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-label-caps text-on-surface-variant uppercase font-bold">Date of Birth</label>
                  <input {...register('dob')} type="date" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4" />
                  {errors.dob && <p className="text-error text-xs">{errors.dob.message}</p>}
                </div>
                <div className="space-y-1">
                  <label className="text-label-caps text-on-surface-variant uppercase font-bold">ID Document Number</label>
                  <input {...register('idNumber')} type="text" placeholder="E12345678" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4" />
                  {errors.idNumber && <p className="text-error text-xs">{errors.idNumber.message}</p>}
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl shadow-sm border border-outline-variant overflow-hidden">
            <div className="bg-surface-container-low px-6 py-4 border-b border-outline-variant flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-sm">3</span>
              <h3 className="text-title-sm text-on-surface font-bold">Contact</h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-1">
                <label className="text-label-caps text-on-surface-variant uppercase font-bold">Mobile Phone</label>
                <div className="relative">
                  <input {...register('phone')} type="tel" placeholder="(555) 000-0000" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4" />
                  {errors.phone && <p className="text-error text-xs">{errors.phone.message}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-label-caps text-on-surface-variant uppercase font-bold">Email Address (Optional)</label>
                <input {...register('email')} type="email" placeholder="guest@example.com" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4" />
                {errors.email && <p className="text-error text-xs">{errors.email.message}</p>}
              </div>
              <div className="mt-4 p-3 bg-secondary-fixed-dim/20 rounded-lg text-body-sm text-on-secondary-fixed-variant flex items-start gap-2">
                <Info className="w-5 h-5 flex-shrink-0" />
                <span>Guest will receive check-out instructions via SMS.</span>
              </div>
            </div>
          </section>
        </div>

        {/* Section 4 */}
        <SectionCard number="4" title="Stay Duration">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 w-full space-y-2">
              <label className="text-label-caps text-on-surface-variant uppercase font-bold">Check-In</label>
              <div className="flex gap-2">
                <div className="w-2/3">
                  <input {...register('checkInDate')} type="date" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4 h-14" />
                  {errors.checkInDate && <p className="text-error text-xs mt-1">{errors.checkInDate.message}</p>}
                </div>
                <div className="w-1/3">
                  <input {...register('checkInTime')} type="time" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4 h-14" />
                  {errors.checkInTime && <p className="text-error text-xs mt-1">{errors.checkInTime.message}</p>}
                </div>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-center text-outline-variant">
              <ArrowRight className="w-6 h-6" />
              <span className="text-[10px] font-bold uppercase mt-1">Nights</span>
            </div>
            <div className="flex-1 w-full space-y-2">
              <label className="text-label-caps text-on-surface-variant uppercase font-bold">Check-Out</label>
              <div className="flex gap-2">
                <div className="w-2/3">
                  <input {...register('checkOutDate')} type="date" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4 h-14" />
                  {errors.checkOutDate && <p className="text-error text-xs mt-1">{errors.checkOutDate.message}</p>}
                </div>
                <div className="w-1/3">
                  <input {...register('checkOutTime')} type="time" className="w-full bg-surface-container rounded-lg border-none focus:ring-2 focus:ring-secondary py-3 px-4 h-14" />
                  {errors.checkOutTime && <p className="text-error text-xs mt-1">{errors.checkOutTime.message}</p>}
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Section 5 */}
        <SectionCard number="5" title="Agreement & Signature">
          {mobileSignatureDataUrl ? (
            <div className="bg-secondary-fixed/30 border-2 border-secondary/20 rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <CheckCircle className="w-12 h-12 text-secondary mb-3" />
              <h4 className="text-title-md font-bold text-on-surface mb-1">Guest Signed via Mobile</h4>
              <p className="text-on-surface-variant text-body-sm">The digital signature and agreement have been securely captured.</p>
              <button type="button" onClick={() => setMobileSignatureDataUrl(null)} className="mt-4 text-error text-label-sm font-bold uppercase hover:underline cursor-pointer">Clear & Re-sign on Desktop</button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-surface-container rounded-lg p-4 h-48 overflow-y-auto text-body-sm text-on-surface-variant border border-outline-variant leading-relaxed">
                <h4 className="font-bold text-on-surface mb-2">Terms and Conditions of Stay</h4>
                <p className="mb-3 italic">{TERMS_HEADER}</p>
                <ol className="space-y-2 list-decimal list-inside">
                  {TERMS_AND_CONDITIONS.map(term => (
                    <li key={term.number}>{term.text}</li>
                  ))}
                </ol>
              </div>
              <div className="space-y-2">
                <label className="text-label-caps text-on-surface-variant uppercase font-bold">Digital Signature</label>
                <div 
                  className="w-full h-40 border border-outline rounded-lg bg-white relative overflow-hidden"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(#f1f5f9 0px, #f1f5f9 1px, transparent 1px, transparent 20px)',
                    backgroundSize: '100% 20px'
                  }}
                >
                  <SignatureCanvas 
                    ref={sigCanvas} 
                    canvasProps={{className: 'w-full h-full absolute inset-0 cursor-crosshair'}}
                    penColor="#0f172a"
                  />
                  <button type="button" onClick={clearSignature} className="absolute z-10 top-2 right-4 text-error text-body-sm font-bold uppercase tracking-wider bg-white/80 px-2 py-1 rounded cursor-pointer">Clear</button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Section 6 */}
        <SectionCard number="6" title="Payment Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-on-surface-variant">Room Rate</span>
                <span className="font-bold">${roomType === '1-bed' ? '85.00' : '120.00'}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-on-surface-variant">Taxes & Fees (9%)</span>
                <span className="font-bold">${roomType === '1-bed' ? '7.65' : '10.80'}</span>
              </div>
              <div className="pt-4 border-t border-outline-variant flex justify-between items-center">
                <span className="text-title-sm font-bold">Total Due</span>
                <span className="text-headline-md font-bold text-secondary">${roomType === '1-bed' ? '92.65' : '130.80'}</span>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-label-caps text-on-surface-variant uppercase font-bold">Payment Method</label>
              <div className="flex gap-4">
                <button 
                  type="button" 
                  onClick={() => setPaymentMethod('card')}
                  className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all cursor-pointer ${
                    paymentMethod === 'card' ? 'border-secondary bg-secondary-fixed text-on-surface' : 'border-outline-variant hover:border-secondary/50 text-on-surface'
                  }`}
                >
                  <span className="text-3xl mb-1 font-bold">💳</span>
                  <span className="font-bold">Card</span>
                </button>
                <button 
                  type="button" 
                  onClick={() => setPaymentMethod('cash')}
                  className={`flex-1 flex flex-col items-center justify-center p-4 border-2 rounded-lg transition-all cursor-pointer ${
                    paymentMethod === 'cash' ? 'border-secondary bg-secondary-fixed text-on-surface' : 'border-outline-variant hover:border-secondary/50 text-on-surface'
                  }`}
                >
                  <span className="text-3xl mb-1 font-bold">💵</span>
                  <span className="font-bold">Cash</span>
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        <div className="flex gap-4">
          <button type="button" onClick={() => window.location.reload()} className="flex-1 bg-surface-container-high text-on-surface font-bold py-5 px-8 rounded-xl hover:bg-surface-container-highest transition-colors active:scale-95 cursor-pointer">
            Cancel & Reset
          </button>
          <button type="submit" disabled={isSubmitting || !selectedRoomId} className="flex-[2] bg-secondary text-on-secondary font-bold py-5 px-8 rounded-xl shadow-lg hover:opacity-90 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 cursor-pointer">
            <CheckCircle className="w-6 h-6" />
            <span className="text-lg">{isSubmitting ? 'Processing...' : 'Complete Check-In'}</span>
          </button>
        </div>

      </form>

      {/* QR Code Modal for Digital Key */}
      {showQRModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-outline-variant animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-secondary-fixed text-on-secondary-fixed rounded-full flex items-center justify-center mx-auto mb-6">
              <Smartphone className="w-10 h-10" />
            </div>
            <h3 className="text-[28px] font-bold text-primary mb-2">Digital Key Ready</h3>
            <p className="text-on-surface-variant mb-6 text-body-md">Guest has been checked into Room <strong>{assignedRoomNumber}</strong>.</p>
            
            <div className="bg-white p-4 rounded-xl border border-outline-variant inline-block mx-auto mb-8 shadow-sm">
              <QRCodeCanvas 
                value={digitalKeyData} 
                size={180} 
                level={"H"}
                includeMargin={true}
              />
              <p className="text-label-caps font-bold mt-3 text-outline">SCAN TO ADD TO WALLET</p>
            </div>

            <button 
              onClick={() => navigate('/dashboard')}
              className="w-full bg-primary text-on-primary py-4 rounded-lg font-bold text-title-sm hover:opacity-90 transition-opacity cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Mobile Scan QR Modal */}
      {showMobileScanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-primary/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest p-10 rounded-2xl shadow-2xl max-w-sm w-full text-center border border-outline-variant animate-in zoom-in duration-300 relative">
            <button onClick={closeMobileScanModal} className="absolute top-4 right-4 text-on-surface-variant hover:text-primary cursor-pointer">
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="text-title-lg font-bold text-primary mb-2">Scan to Upload ID</h3>
            <p className="text-on-surface-variant mb-6 text-body-md">Point your phone's camera at this QR code to securely upload the guest's ID.</p>
            
            <div className="bg-white p-4 rounded-xl border border-outline-variant inline-block mx-auto mb-8 shadow-sm">
              <QRCodeCanvas 
                value={`${window.location.protocol}//${window.location.host}/scan?session=${scanSessionId}`} 
                size={180} 
                level={"H"}
                includeMargin={true}
              />
            </div>
            <p className="text-label-caps font-bold text-outline animate-pulse">Waiting for upload...</p>
          </div>
        </div>
      )}
    </div>
  );
}
