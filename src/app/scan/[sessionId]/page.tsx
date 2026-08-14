'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import {
  Camera, CheckCircle, RefreshCcw, Loader2, CameraOff, AlertTriangle, ShieldAlert,
  Upload, AlertCircle,
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/lib/supabase';

const TERMS_HEADER =
  'By signing below, as a guest of AIRWAY MOTEL, you state that you have fully read the statements and conditions below and agree to abide by them, without exception, while staying at AIRWAY MOTEL.';

const TERMS = [
  'Checkout time is 10 AM on the date of checkout.',
  'A fee of $10 dollars per hour will be assessed for each hour the guest stays past checkout time.',
  'Deposits for key and T.V. remote will not be returned unless each is returned in serviceable condition.',
  'Guests may request refund of room rent and deposits for key and T.V remote, within five (5) minutes of check-in time if room unsatisfactory. NO refunds will be given outside this time for any reason.',
  'The following WILL NOT be tolerated during your stay at AIRWAY MOTEL, for any reason: Illicit drug activity, solicitation (prostitution), illegal weapon possession, or any activities that would pose a danger to guests, staff, general public or in violation of any state/county/city municipal code.',
  'Management reserves the right to EVICT any guest or visitors AT ANY TIME, without refund, for any damaging of property, harassment of other guests or staff, causing harm to others, refusal to pay rent fees, allowing/having unregistered visitors in room, participating in any illegal or suspicious activities or any other management policies/verbal directions. Any person(s) can be barred from entering AIRWAY MOTEL property at any time.',
  'Management reserves the right to enter any room at any time, for inspection, for repairs, for cleaning, pest control measures, or other actions to maintain room/facilities. Management/staff will knock before entering room.',
  'AIRWAY MOTEL, management/staff, does not/will not assume any responsibility for any; lost, stolen, or damage to personal items/valuables or vehicles. AIRWAY MOTEL, management/staff does not/will not assume any responsibility for any accident(s), personal injury or death(s) occurring on property and shall not be held liable for any of the for mentioned reason(s).',
  'Upon check-out, eviction, or nonpayment of room rental fee, AIRWAY MOTEL/management/staff will assume any and all properties including valuables left in room/on property were left intentionally and assumes the right to discard the a for mentioned items. Should guest/tenant leave by circumstances beyond their control, management, at their discretion, will pack and store guest/tenant belongings for a period of 30 days at a fee of $200 dollars, paid at time of recovery of items. Note: Any items that are excessively large (furniture and appliances), non-servable, perishable, or unsafe will not be stored.',
  'Any tenant who commits, conducts, facilitates, allows, permits, or fails on Airway Motel property any public nuisance as defined in section 37-50 (c) or (d) of the Denver Revised Municipal Code, or any other activity prohibited by state law or the Denver Revised Municipal Code shall be subject to immediate eviction.',
];

const CAM_STATUS = {
  REQUESTING: 'requesting',
  READY: 'ready',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  INSECURE: 'insecure',
} as const;

type CamStatus = (typeof CAM_STATUS)[keyof typeof CAM_STATUS];

type Step = 'capture' | 'signature' | 'success';

export default function MobileScanPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const rawMode = searchParams.get('mode');

  // 'barcode' mode now falls back to photo capture (phones can't scan PDF417 reliably).
  // 'photo' mode = front-of-ID AI scan. 'signature' mode = terms + signature only.
  const isBarcodeMode = rawMode === 'barcode';
  const isSignatureMode = rawMode === 'signature';
  // Treat barcode mode as photo mode on the phone — take a picture, let desktop AI extract data.
  const usePhotoCapture = !isSignatureMode;

  // Detect admin flow: if the session was created by VisionScanner on this device
  const isAdminFlow = typeof window !== 'undefined' && localStorage.getItem('airway_scan_session') === sessionId;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [camStatus, setCamStatus] = useState<CamStatus>(CAM_STATUS.REQUESTING);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [step, setStep] = useState<Step>(isSignatureMode ? 'signature' : 'capture');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Photo mode: start the back camera ──
  const startCamera = useCallback(async () => {
    setCamStatus(CAM_STATUS.REQUESTING);
    stopStream();

    // Camera requires a Secure Context (HTTPS or localhost) on mobile browsers.
    // Without it, navigator.mediaDevices is undefined and getUserMedia will throw.
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setCamStatus(CAM_STATUS.INSECURE);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamStatus(CAM_STATUS.INSECURE);
      return;
    }

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
      const name = (err as Error)?.name;
      if (name === 'TypeError') {
        // navigator.mediaDevices is undefined — not a secure context
        setCamStatus(CAM_STATUS.INSECURE);
      } else if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCamStatus(CAM_STATUS.DENIED);
      } else {
        setCamStatus(CAM_STATUS.UNAVAILABLE);
      }
    }
  }, [stopStream]);

  useEffect(() => {
    if (usePhotoCapture) {
      startCamera();
    }
    return () => {
      stopStream();
    };
  }, [usePhotoCapture, startCamera, stopStream]);

  // ── Capture a frame from the video stream (photo mode) ──
  const capture = useCallback(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !video.videoWidth || !frame) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Calculate crop coordinates based on object-cover math
    const videoRect = video.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();

    const intrinsicWidth = video.videoWidth;
    const intrinsicHeight = video.videoHeight;
    
    // object-cover scaling factor
    const scale = Math.max(videoRect.width / intrinsicWidth, videoRect.height / intrinsicHeight);
    
    // Displayed dimensions of the video on screen
    const renderedWidth = intrinsicWidth * scale;
    const renderedHeight = intrinsicHeight * scale;
    
    // Offset of the top-left corner of the video relative to the container
    const offsetX = (videoRect.width - renderedWidth) / 2;
    const offsetY = (videoRect.height - renderedHeight) / 2;
    
    // Frame coordinates relative to the video container
    const frameX = frameRect.left - videoRect.left;
    const frameY = frameRect.top - videoRect.top;
    
    // Map frame coordinates to intrinsic video coordinates
    const sx = (frameX - offsetX) / scale;
    const sy = (frameY - offsetY) / scale;
    const sw = frameRect.width / scale;
    const sh = frameRect.height / scale;

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the cropped section
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setImageSrc(dataUrl);
    stopStream();
  }, [stopStream]);

  const retake = useCallback(async () => {
    setImageSrc(null);
    setStep('capture');
    setUploadError('');
    // Restart camera for photo capture
    await startCamera();
  }, [startCamera]);

  const advanceToSignature = () => {
    if (!imageSrc) return;
    setStep('signature');
  };

  // ── Submit: upload image to storage, then write the scan_sessions row ──
  const submit = async () => {
    if (!sessionId) return;
    if (sigCanvas.current?.isEmpty()) {
      alert('Please provide your signature before submitting.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const signatureDataUrl = sigCanvas.current!.getCanvas().toDataURL('image/png');
      let imageStorageUrl = '';

      // Upload the image to the 'ids' bucket for the permanent record
      if (supabase && imageSrc) {
        try {
          const res = await fetch(imageSrc);
          const blob = await res.blob();
          const fileName = `id_${sessionId}_${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('ids')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

          if (!uploadError) {
            const { data } = supabase.storage.from('ids').getPublicUrl(fileName);
            imageStorageUrl = data.publicUrl;
          } else {
            console.error('[Scan] storage upload error:', uploadError.message);
          }
        } catch (e) {
          console.error('[Scan] storage upload failed:', e);
        }
      }

      // Write everything to the scan_sessions row so the desktop can pick it up
      const res = await fetch('/api/scan-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          sessionId,
          imageBase64: imageSrc || undefined,
          imageStorageUrl: imageStorageUrl || undefined,
          parsedData: undefined, // Phone doesn't parse — desktop AI does
          signatureDataUrl,
          termsAccepted: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to submit. Please try again.');
      }

      // Admin flow: store result in localStorage and redirect back to home
      if (isAdminFlow) {
        localStorage.setItem('airway_scan_result', JSON.stringify({
          sessionId,
          imageBase64: imageSrc || undefined,
          imageStorageUrl: imageStorageUrl || undefined,
          signatureDataUrl,
          termsAccepted: true,
        }));
        localStorage.removeItem('airway_scan_session');
        router.push('/');
        return;
      }

      setStep('success');
    } catch (error) {
      console.error('[Scan] submit error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to submit. Please try again.');
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

  const subHeaderText = (() => {
    if (step === 'success') return 'Success';
    if (step === 'signature') return 'Check-In Agreement';
    if (isSignatureMode) return 'Sign the Agreement';
    return imageSrc ? 'Review Photo' : 'ID Scanner';
  })();

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="bg-zinc-900 p-4 text-center border-b border-zinc-800 z-20 shrink-0">
        <h1 className="text-lg font-bold text-amber-500">Airway Motel</h1>
        <p className="text-xs text-zinc-400">{subHeaderText}</p>
      </header>

      {/* ── CAPTURE STEP (Photo mode - works for both photo and barcode) ── */}
      {step === 'capture' && usePhotoCapture && (
        <div className="relative flex-1 overflow-hidden bg-black flex flex-col">
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`absolute inset-0 h-full w-full object-cover ${imageSrc ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {imageSrc && (
              <img
                src={imageSrc}
                alt="Captured ID"
                className="absolute inset-0 h-full w-full object-contain bg-black z-10"
              />
            )}

            {camStatus === CAM_STATUS.READY && !imageSrc && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-6">
                <div ref={frameRef} className="w-full max-w-md aspect-[1.586/1] relative">
                  <div className="absolute inset-0 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                  <span className="absolute -top-7 left-0 text-[10px] font-bold tracking-widest text-white/80 uppercase">
                    Align ID within frame
                  </span>
                </div>
              </div>
            )}

            {camStatus === CAM_STATUS.REQUESTING && !imageSrc && (
              <Overlay>
                <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                <p className="font-bold">Starting camera...</p>
                <p className="text-white/60 text-sm">Allow camera access when prompted.</p>
              </Overlay>
            )}

            {camStatus === CAM_STATUS.DENIED && !imageSrc && (
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

            {camStatus === CAM_STATUS.UNAVAILABLE && !imageSrc && (
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

            {camStatus === CAM_STATUS.INSECURE && !imageSrc && (
              <Overlay>
                <ShieldAlert className="w-12 h-12 text-white/80 mb-4" />
                <p className="font-bold text-lg mb-1">Secure connection required</p>
                <p className="text-white/60 text-sm max-w-xs">
                  The camera only works over HTTPS or localhost. Please open this page via a secure QR link.
                </p>
              </Overlay>
            )}
          </div>

          {/* Bottom action area */}
          <div className="z-20 bg-gradient-to-t from-black/90 to-transparent p-6 pb-10 shrink-0">
            {imageSrc ? (
              <div className="flex gap-4 max-w-md mx-auto">
                <button
                  onClick={retake}
                  className="flex-1 bg-white/15 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 backdrop-blur-md"
                >
                  <RefreshCcw className="w-5 h-5" /> Retake
                </button>
                <button
                  onClick={advanceToSignature}
                  className="flex-[2] bg-amber-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" /> Next: Sign
                </button>
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}

      {/* ── SIGNATURE STEP ── */}
      {step === 'signature' && (
        <div className="flex-1 bg-zinc-900 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {imageSrc && (
              <div className="rounded-lg overflow-hidden border border-zinc-700">
                <p className="text-[10px] text-zinc-500 px-2 pt-1.5 font-bold uppercase tracking-wider">
                  ID Photo Captured
                </p>
                <img src={imageSrc} alt="Captured ID" className="w-full max-h-32 object-contain bg-black" />
              </div>
            )}

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

            {uploadError && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{uploadError}</p>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-zinc-700 bg-zinc-900 shrink-0">
            <button
              onClick={submit}
              disabled={isUploading}
              className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {isUploading ? 'Securely Transmitting...' : 'Agree & Submit'}
            </button>
          </div>
        </div>
      )}

      {/* ── SUCCESS STEP ── */}
      {step === 'success' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8 bg-zinc-950">
          <CheckCircle className="w-20 h-20 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">All Done!</h2>
          <p className="text-zinc-400 max-w-xs">
            Your ID {isBarcodeMode ? 'and signature ' : ''}have been securely transmitted to the front desk.
            Please hand this device back to the clerk.
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
