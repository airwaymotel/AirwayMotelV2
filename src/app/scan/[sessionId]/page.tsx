'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Camera, CheckCircle, RefreshCcw, Loader2, CameraOff, AlertTriangle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const TERMS_HEADER =
  'By signing below, as a guest of AIRWAY MOTEL you state that you have fully read the statements, conditions below and agree to abide by them, without exception, while staying at AIRWAY MOTEL.';

const TERMS = [
  'Checkout time is 10 AM on date of checkout.',
  'A fee of $10 per hour will be assessed for each hour guest stays past checkout time.',
  'Deposits for key and T.V. remote will not be returned unless each is returned in serviceable condition.',
  'Guests may request refund of room rent and deposits within five (5) minutes of check-in if room unsatisfactory.',
  'No illicit drug activity, solicitation, illegal weapon possession, or dangerous activities tolerated.',
  'Management reserves the right to evict any guest at any time without refund for policy violations.',
  'Management reserves the right to enter any room at any time for inspection or repairs.',
  'Airway Motel assumes no responsibility for lost, stolen, or damaged personal items.',
];

const CAM_STATUS = {
  REQUESTING: 'requesting',
  READY: 'ready',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
} as const;

type CamStatus = (typeof CAM_STATUS)[keyof typeof CAM_STATUS];

export default function MobileScanPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [camStatus, setCamStatus] = useState<CamStatus>(CAM_STATUS.REQUESTING);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<'camera' | 'review' | 'signature' | 'success'>('camera');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCamStatus(CAM_STATUS.REQUESTING);
    stopStream();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();
      }
      setCamStatus(CAM_STATUS.READY);
    } catch (err: unknown) {
      const name = (err as Error).name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCamStatus(CAM_STATUS.DENIED);
      } else {
        setCamStatus(CAM_STATUS.UNAVAILABLE);
      }
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = canvasRef.current!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setImageSrc(dataUrl);
  }, []);

  const retake = () => {
    setImageSrc(null);
    setStep('camera');
  };

  const submitAll = async () => {
    if (!imageSrc || !sessionId) return;
    if (sigCanvas.current?.isEmpty()) {
      alert('Please provide your signature before submitting.');
      return;
    }

    setIsUploading(true);
    try {
      const signatureDataUrl = sigCanvas.current!.getCanvas().toDataURL('image/png');

      // Upload ID photo to Supabase Storage
      let idPhotoUrl = '';

      if (supabase) {
        const res = await fetch(imageSrc);
        const blob = await res.blob();
        const fileName = `id_${sessionId}_${Date.now()}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('ids')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

        if (uploadError) {
          console.error('Upload error:', uploadError);
        } else {
          const { data } = supabase.storage.from('ids').getPublicUrl(fileName);
          idPhotoUrl = data.publicUrl;
        }

        // Send data via Supabase Realtime broadcast
        const channel = supabase.channel(`scan_${sessionId}`);
        await channel.send({
          type: 'broadcast',
          event: 'id_scanned',
          payload: {
            imageUrl: idPhotoUrl,
            signatureDataUrl,
            timestamp: Date.now(),
          },
        });
        // Allow time for the message to be sent before removing channel
        setTimeout(() => supabase.removeChannel(channel), 2000);
      } else {
        // No Supabase - just send via broadcast simulation (for dev)
        console.log('No Supabase connected. ID scan data:', { signatureDataUrl, sessionId });
      }

      stopStream();
      setStep('success');
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-dvh bg-zinc-900 flex items-center justify-center p-6 text-center text-white">
        <div>
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Invalid Link</h1>
          <p className="text-zinc-400">Please scan the QR code from the admin dashboard again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="bg-zinc-900 p-4 text-center border-b border-zinc-800 z-20 shrink-0">
        <h1 className="text-lg font-bold text-amber-500">Airway Motel</h1>
        <p className="text-xs text-zinc-400">
          {step === 'camera' ? 'Guest ID Scanner' : step === 'review' ? 'Review Photo' : step === 'signature' ? 'Check-In Agreement' : 'Success'}
        </p>
      </header>

      {/* CAMERA STEP */}
      {step === 'camera' && (
        <div className="relative flex-1 overflow-hidden bg-black flex flex-col">
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {/* ID frame guide */}
            {camStatus === CAM_STATUS.READY && !imageSrc && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-6">
                <div className="w-full max-w-md aspect-[1.586/1] relative">
                  <div className="absolute inset-0 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                  <span className="absolute -top-7 left-0 text-[10px] font-bold tracking-widest text-white/80 uppercase">
                    Align ID within frame
                  </span>
                </div>
              </div>
            )}

            {/* Status overlays */}
            {camStatus === CAM_STATUS.REQUESTING && (
              <Overlay>
                <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                <p className="font-bold">Starting camera...</p>
                <p className="text-white/60 text-sm">Allow camera access when prompted.</p>
              </Overlay>
            )}

            {camStatus === CAM_STATUS.DENIED && (
              <Overlay>
                <CameraOff className="w-12 h-12 text-white/80 mb-4" />
                <p className="font-bold text-lg mb-1">Camera blocked</p>
                <p className="text-white/60 text-sm max-w-xs mb-5">
                  Camera access was denied. Enable it in your browser settings.
                </p>
                <button
                  onClick={startCamera}
                  className="px-5 py-2.5 bg-white text-black rounded-lg font-bold flex items-center gap-2"
                >
                  <RefreshCcw className="w-4 h-4" /> Retry camera
                </button>
              </Overlay>
            )}

            {camStatus === CAM_STATUS.UNAVAILABLE && (
              <Overlay>
                <CameraOff className="w-12 h-12 text-white/80 mb-4" />
                <p className="font-bold text-lg mb-1">No camera found</p>
                <button
                  onClick={startCamera}
                  className="px-5 py-2.5 bg-white text-black rounded-lg font-bold flex items-center gap-2 mt-4"
                >
                  <RefreshCcw className="w-4 h-4" /> Retry
                </button>
              </Overlay>
            )}
          </div>

          {/* Capture button */}
          <div className="z-20 bg-gradient-to-t from-black/90 to-transparent p-6 pb-10 shrink-0">
            <div className="flex justify-center">
              <button
                onClick={capture}
                disabled={camStatus !== CAM_STATUS.READY}
                className="w-20 h-20 rounded-full border-4 border-white/40 flex items-center justify-center shadow-2xl active:scale-95 transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
                  <Camera className="w-7 h-7 text-black" />
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW STEP */}
      {step === 'review' && imageSrc && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          <div className="flex-1 flex items-center justify-center p-4 bg-black">
            <img src={imageSrc} alt="Captured ID" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
          </div>
          <div className="p-4 bg-zinc-900 border-t border-zinc-800 shrink-0">
            <p className="text-center text-sm text-zinc-400 mb-3">Is this ID photo clear and readable?</p>
            <div className="flex gap-3">
              <button
                onClick={retake}
                className="flex-1 bg-zinc-800 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <RefreshCcw className="w-4 h-4" /> Retake
              </button>
              <button
                onClick={() => setStep('signature')}
                className="flex-[2] bg-amber-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" /> Looks Good
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIGNATURE STEP */}
      {step === 'signature' && (
        <div className="flex-1 bg-zinc-900 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h2 className="text-lg font-bold text-amber-500">Terms & Conditions</h2>
            <div className="bg-zinc-800 rounded-lg p-4 text-sm text-zinc-300 border border-zinc-700 leading-relaxed max-h-52 overflow-y-auto">
              <p className="mb-3 italic text-zinc-400">{TERMS_HEADER}</p>
              <ol className="space-y-2 list-decimal list-inside">
                {TERMS.map((term, i) => (
                  <li key={i}>{term}</li>
                ))}
              </ol>
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">
                  Please sign below
                </label>
                <button
                  type="button"
                  onClick={() => sigCanvas.current?.clear()}
                  className="text-red-400 text-xs font-bold uppercase tracking-wider"
                >
                  Clear Pad
                </button>
              </div>
              <div
                className="w-full h-44 border border-zinc-600 rounded-lg bg-white relative overflow-hidden"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(#f1f5f9 0px, #f1f5f9 1px, transparent 1px, transparent 20px)',
                  backgroundSize: '100% 20px',
                }}
              >
                <SignatureCanvas
                  ref={sigCanvas}
                  canvasProps={{ className: 'w-full h-full absolute inset-0 cursor-crosshair' }}
                  penColor="#0f172a"
                />
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-zinc-700 bg-zinc-900 shrink-0">
            <button
              onClick={submitAll}
              disabled={isUploading}
              className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {isUploading ? 'Securely Transmitting...' : 'Agree & Complete Check-In'}
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS STEP */}
      {step === 'success' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
          <CheckCircle className="w-20 h-20 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">All Done!</h2>
          <p className="text-zinc-400 max-w-xs">
            Your ID and signature have been securely transmitted to the front desk. Please hand this device back to the
            clerk.
          </p>
        </div>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-8">{children}</div>
  );
}
