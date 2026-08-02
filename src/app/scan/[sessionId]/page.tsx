'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Camera, CheckCircle, RefreshCcw, Loader2, CameraOff, AlertTriangle, Upload, AlertCircle } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { supabase } from '@/lib/supabase';

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
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const mode = searchParams.get('mode'); // 'id-scan' or null (full check-in)

  const isIdScanOnly = mode === 'id-scan';

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const [camStatus, setCamStatus] = useState<CamStatus>(CAM_STATUS.REQUESTING);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>('');
  const [step, setStep] = useState<'camera' | 'signature' | 'success'>('camera');

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

  // Capture photo from video
  const capture = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setImageSrc(dataUrl);
    stopStream();
  }, [stopStream]);

  const retake = useCallback(async () => {
    setImageSrc(null);
    setStep('camera');
    setUploadError('');
    await startCamera();
  }, [startCamera]);

  // ── ID-Scan Only: Upload just the photo via API ──
  const submitIdScan = useCallback(async () => {
    if (!imageSrc || !sessionId) return;
    setIsUploading(true);
    setUploadError('');

    try {
      // Upload the image to the scan-session API (works without Supabase)
      const res = await fetch('/api/scan-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          sessionId,
          imageBase64: imageSrc,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to upload photo');
      }

      console.log('[Scan] ID photo uploaded successfully via API');

      // Also try Supabase Realtime broadcast if available (for full check-in flow)
      if (supabase) {
        try {
          // Upload to Supabase Storage for the record
          const blobRes = await fetch(imageSrc);
          const blob = await blobRes.blob();
          const fileName = `id_${sessionId}_${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('ids')
            .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

          if (!uploadError) {
            const { data } = supabase.storage.from('ids').getPublicUrl(fileName);
            console.log('[Scan] Also stored in Supabase:', data.publicUrl);
          }
        } catch {
          // Non-critical — the API upload already succeeded
        }
      }

      setStep('success');
    } catch (error) {
      console.error('[Scan] Submit error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to submit. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [imageSrc, sessionId]);

  // ── Full Check-In: Upload photo + signature and broadcast ──
  const submitAll = async () => {
    if (!imageSrc || !sessionId) return;
    if (sigCanvas.current?.isEmpty()) {
      alert('Please provide your signature before submitting.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const signatureDataUrl = sigCanvas.current!.getCanvas().toDataURL('image/png');

      let idPhotoUrl = '';

      if (supabase) {
        const res = await fetch(imageSrc);
        const blob = await res.blob();
        const fileName = `id_${sessionId}_${Date.now()}.jpg`;

        console.log('[Scan] Uploading ID photo to Supabase Storage bucket "ids"...');

        const { error: uploadError } = await supabase.storage
          .from('ids')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

        if (uploadError) {
          console.error('[Scan] Storage upload error:', uploadError);
          setUploadError(`Upload failed: ${uploadError.message}. Retrying...`);

          const fileName2 = `id_${sessionId}_${Date.now()}_retry.jpg`;
          const { error: retryError } = await supabase.storage
            .from('ids')
            .upload(fileName2, blob, { contentType: 'image/jpeg', upsert: false });

          if (retryError) {
            throw new Error(`Storage upload failed: ${retryError.message}`);
          }

          const { data: retryData } = supabase.storage.from('ids').getPublicUrl(fileName2);
          idPhotoUrl = retryData.publicUrl;
        } else {
          const { data } = supabase.storage.from('ids').getPublicUrl(fileName);
          idPhotoUrl = data.publicUrl;
        }

        console.log('[Scan] ID photo uploaded. URL:', idPhotoUrl);

        console.log('[Scan] Sending data via Realtime broadcast on channel:', `scan_${sessionId}`);

        const channel = supabase.channel(`scan_${sessionId}`, {
          config: { broadcast: { self: true } },
        });

        await new Promise<void>((resolve) => {
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              resolve();
            }
          });
        });

        const sendResult = await channel.send({
          type: 'broadcast',
          event: 'id_scanned',
          payload: {
            imageUrl: idPhotoUrl,
            signatureDataUrl,
            timestamp: Date.now(),
          },
        });

        console.log('[Scan] Broadcast send result:', sendResult);

        await new Promise((r) => setTimeout(r, 2000));
        supabase.removeChannel(channel);

      } else {
        console.error('[Scan] No Supabase client available! Cannot upload or broadcast.');
        setUploadError('Not connected to Supabase. Please check your configuration.');
        setIsUploading(false);
        return;
      }

      setStep('success');
    } catch (error) {
      console.error('[Scan] Submit error:', error);
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

  return (
    <div className="fixed inset-0 bg-zinc-950 text-white flex flex-col overflow-hidden select-none">
      {/* Header */}
      <header className="bg-zinc-900 p-4 text-center border-b border-zinc-800 z-20 shrink-0">
        <h1 className="text-lg font-bold text-amber-500">Airway Motel</h1>
        <p className="text-xs text-zinc-400">
          {isIdScanOnly ? (
            step === 'camera' && !imageSrc ? 'ID Scanner' : step === 'camera' && imageSrc ? 'Review Photo' : 'Success'
          ) : (
            step === 'camera' && !imageSrc && 'Guest ID Scanner' ||
            step === 'camera' && imageSrc && 'Review Photo' ||
            step === 'signature' && 'Check-In Agreement' ||
            step === 'success' && 'Success'
          )}
        </p>
      </header>

      {/* ── CAMERA STEP ── */}
      {step === 'camera' && (
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
                <div className="w-full max-w-md aspect-[1.586/1] relative">
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
          </div>

          {/* Bottom action area */}
          <div className="z-20 bg-gradient-to-t from-black/90 to-transparent p-6 pb-10 shrink-0">
            {imageSrc ? (
              /* Review buttons after capture */
              <div className="flex gap-4 max-w-md mx-auto">
                <button
                  onClick={retake}
                  className="flex-1 bg-white/15 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 backdrop-blur-md"
                >
                  <RefreshCcw className="w-5 h-5" /> Retake
                </button>
                {isIdScanOnly ? (
                  /* ID-Scan mode: send photo directly */
                  <button
                    onClick={submitIdScan}
                    disabled={isUploading}
                    className="flex-[2] bg-amber-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Upload className="w-5 h-5" />
                    )}
                    {isUploading ? 'Sending...' : 'Send Photo'}
                  </button>
                ) : (
                  /* Full check-in mode: go to signature */
                  <button
                    onClick={() => setStep('signature')}
                    className="flex-[2] bg-amber-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> Next: Sign
                  </button>
                )}
              </div>
            ) : (
              /* Capture button */
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

      {/* ── SIGNATURE STEP (only in full check-in mode) ── */}
      {!isIdScanOnly && step === 'signature' && (
        <div className="flex-1 bg-zinc-900 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {imageSrc && (
              <div className="rounded-lg overflow-hidden border border-zinc-700">
                <p className="text-[10px] text-zinc-500 px-2 pt-1.5 font-bold uppercase tracking-wider">ID Photo Captured</p>
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
              onClick={submitAll}
              disabled={isUploading}
              className="w-full bg-amber-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Upload className="w-5 h-5" />
              )}
              {isUploading ? 'Securely Transmitting...' : 'Agree & Complete Check-In'}
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
            {isIdScanOnly
              ? 'Your ID photo has been sent to the front desk. You can close this page.'
              : 'Your ID and signature have been securely transmitted to the front desk. Please hand this device back to the clerk.'}
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
