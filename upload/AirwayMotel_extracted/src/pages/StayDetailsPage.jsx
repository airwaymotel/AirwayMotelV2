import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, CreditCard, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

export default function StayDetailsPage() {
  const { stayId } = useParams();
  const navigate = useNavigate();
  
  const [stay, setStay] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStayDetails();
  }, [stayId]);

  const fetchStayDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('stays')
        .select(`
          *,
          guests(*),
          rooms(*),
          signatures(*),
          payments(*)
        `)
        .eq('id', stayId)
        .single();

      if (error) throw error;
      setStay(data);
    } catch (err) {
      console.error('Error fetching stay details:', err);
      toast.error('Could not load stay details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-container-padding flex items-center justify-center">
        <p className="text-on-surface-variant font-bold">Loading details...</p>
      </div>
    );
  }

  if (!stay) {
    return (
      <div className="flex-1 p-container-padding flex flex-col items-center justify-center">
        <h2 className="text-title-lg font-bold text-error mb-4">Stay Not Found</h2>
        <button onClick={() => navigate(-1)} className="text-secondary font-bold underline">Go Back</button>
      </div>
    );
  }

  const { guests: guest, rooms: room, signatures, payments } = stay;
  const signature = signatures?.[0]; // Usually one signature per stay

  const formatCurrency = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  return (
    <div className="flex-1 p-container-padding max-w-7xl mx-auto w-full pb-20">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-surface-container rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-on-surface" />
        </button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-sm font-bold text-primary">
              {guest.first_name} {guest.last_name}
            </h1>
            <span className={`px-3 py-1 text-sm font-bold rounded-full uppercase tracking-widest ${
              stay.status === 'active' ? 'bg-green-100 text-green-800' :
              stay.status === 'checked_out' ? 'bg-surface-container-high text-on-surface' :
              'bg-red-100 text-red-800'
            }`}>
              {stay.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-body-lg text-on-surface-variant mt-1">
            Room {room.room_number} • {room.type} Premium
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Guest Profile & Stay Info */}
        <div className="xl:col-span-1 space-y-6">
          
          {/* Contact Details Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
            <h3 className="text-title-md font-bold text-primary mb-4 flex items-center gap-2">
              <User className="w-5 h-5" /> Guest Profile
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-body-md text-on-surface">
                <Phone className="w-5 h-5 text-on-surface-variant" />
                {guest.phone || 'No phone provided'}
              </div>
              <div className="flex items-center gap-3 text-body-md text-on-surface">
                <Mail className="w-5 h-5 text-on-surface-variant" />
                {guest.email || 'No email provided'}
              </div>
              <div className="flex items-start gap-3 text-body-md text-on-surface">
                <MapPin className="w-5 h-5 text-on-surface-variant mt-0.5" />
                <span>
                  {guest.address ? (
                    <>
                      {guest.address}<br />
                      {guest.city}, {guest.state} {guest.zip}
                    </>
                  ) : 'No address provided'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-body-md text-on-surface">
                <Calendar className="w-5 h-5 text-on-surface-variant" />
                DOB: {guest.date_of_birth || 'N/A'}
              </div>
            </div>
          </div>

          {/* Stay Details Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
            <h3 className="text-title-md font-bold text-primary mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Stay Details
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant">
                <span className="text-on-surface-variant">Check-In</span>
                <span className="font-bold">{stay.check_in_date} at {stay.check_in_time}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant">
                <span className="text-on-surface-variant">Expected Check-Out</span>
                <span className="font-bold">{stay.check_out_date} at {stay.check_out_time}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-outline-variant">
                <span className="text-on-surface-variant">Rate Type</span>
                <span className="font-bold capitalize">{stay.rate_type}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Rate Amount</span>
                <span className="font-bold">{formatCurrency(stay.rate_amount)} / night</span>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Verification & Payments */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* Identity & Verification Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
            <h3 className="text-title-md font-bold text-primary mb-6 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" /> Identity & Verification
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* ID Photo */}
              <div className="space-y-3">
                <h4 className="text-label-caps font-bold text-on-surface-variant uppercase">Scanned ID ({guest.id_number || 'No ID Number'})</h4>
                <div className="h-64 bg-surface-container rounded-xl border border-outline flex items-center justify-center overflow-hidden">
                  {guest.id_photo_url ? (
                    <img src={guest.id_photo_url} alt="ID Document" className="w-full h-full object-contain" />
                  ) : (
                    <p className="text-on-surface-variant text-sm font-bold">No ID Image Uploaded</p>
                  )}
                </div>
              </div>

              {/* Signature */}
              <div className="space-y-3">
                <h4 className="text-label-caps font-bold text-on-surface-variant uppercase">Agreement Signature</h4>
                <div className="h-64 bg-white rounded-xl border border-outline flex items-center justify-center overflow-hidden" style={{
                  backgroundImage: 'repeating-linear-gradient(#f1f5f9 0px, #f1f5f9 1px, transparent 1px, transparent 20px)',
                  backgroundSize: '100% 20px'
                }}>
                  {signature?.signature_data_url ? (
                    <img src={signature.signature_data_url} alt="Guest Signature" className="max-h-full max-w-full object-contain mix-blend-multiply" />
                  ) : (
                    <p className="text-on-surface-variant text-sm font-bold">No Signature on File</p>
                  )}
                </div>
                {signature && <p className="text-xs text-on-surface-variant text-right">Signed at: {new Date(signature.signed_at).toLocaleString()}</p>}
              </div>
            </div>
          </div>

          {/* Payment History Card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-sm">
            <h3 className="text-title-md font-bold text-primary mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5" /> Payment History
            </h3>
            
            {payments && payments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant text-label-caps text-on-surface-variant">
                      <th className="py-3 px-2 font-bold uppercase">Date</th>
                      <th className="py-3 px-2 font-bold uppercase">Method</th>
                      <th className="py-3 px-2 font-bold uppercase text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(payment => (
                      <tr key={payment.id} className="border-b border-outline-variant/50 last:border-0 text-body-md text-on-surface">
                        <td className="py-4 px-2">{new Date(payment.paid_at).toLocaleString()}</td>
                        <td className="py-4 px-2 capitalize">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-container-high text-on-surface">
                            {payment.method}
                          </span>
                        </td>
                        <td className="py-4 px-2 text-right font-bold text-primary">{formatCurrency(payment.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-on-surface-variant italic">No payments recorded for this stay yet.</p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
