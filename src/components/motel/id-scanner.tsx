'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Upload, Loader2, CheckCircle, AlertCircle,
  X, RotateCcw, ArrowLeft, Zap, QrCode,
} from 'lucide-react';
// import { ScanLine } from 'lucide-react'; // BARCODE: uncomment when re-enabling barcode scanning
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
// import { parseAAMVA, partialScannedIdFromRaw } from '@/lib/parse-aamva'; // BARCODE: uncomment when re-enabling barcode scanning
import type { ScannedIdData } from '@/lib/parse-aamva';

// Re-export the shared type so existing importers (check-in.tsx) keep working.
export type { ScannedIdData } from '@/lib/parse-aamva';

// Detect if the user is on a mobile/tablet device
function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 1024;
}

// BARCODE: Uncomment 'barcode' when re-enabling barcode scanning
type ScanMode = 'choose' | 'vision';
type ScanStatus = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface IdScannerProps {
  onScanComplete: (data: ScannedIdData, imageBase64?: string) => void;
  /** Called when the phone flow also delivered a guest signature + terms acceptance. */
  onSignatureReceived?: (signatureDataUrl: string, termsAccepted: boolean) => void;
  onClose?: () => void;
}

// Payload returned by the phone flow (mirrors GET /api/scan-session 'received' shape).
interface PhoneReceived {
  imageBase64?: string | null;
  imageStorageUrl?: string | null;
  parsedData?: ScannedIdData | null;
  signatureDataUrl?: string | null;
  termsAccepted?: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// BARCODE SCANNER — COMMENTED OUT (not currently used)
// Re-enable when PDF417 barcode scanning is needed in the future.
// ══════════════════════════════════════════════════════════════════════════════
//
// function BarcodeScanner({ onScanSuccess }: { onScanSuccess: (data: ScannedIdData) => void }) {
//   const scannerRef = useRef<HTMLDivElement>(null);
//   const html5QrRef = useRef<any>(null);
//   const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
//   const [errorMsg, setErrorMsg] = useState('');
//
//   const startScanner = useCallback(async () => {
//     if (!scannerRef.current) return;
//     setStatus('starting');
//     setErrorMsg('');
//
//     try {
//       const { Html5Qrcode } = await import('html5-qrcode');
//       const scanner = new Html5Qrcode('id-barcode-scanner');
//       html5QrRef.current = scanner;
//
//       await scanner.start(
//         { facingMode: 'environment' },
//         {
//           fps: 10,
//           qrbox: { width: 280, height: 200 },
//           // @ts-expect-error - PDF417 format constant
//           formatsToSupport: [0],
//         },
//         (decodedText: string) => {
//           const parsed = parseAAMVA(decodedText);
//           const result = parsed || partialScannedIdFromRaw(decodedText);
//           scanner.stop().catch(() => {});
//           onScanSuccess(result);
//         },
//         () => {}
//       );
//
//       setStatus('scanning');
//     } catch (err: any) {
//       console.error('Scanner error:', err);
//       setStatus('error');
//       setErrorMsg(err?.message || 'Failed to start camera. Please check permissions.');
//     }
//   }, [onScanSuccess]);
//
//   const stopScanner = useCallback(() => {
//     if (html5QrRef.current) {
//       html5QrRef.current.stop().catch(() => {});
//       html5QrRef.current.clear().catch(() => {});
//       html5QrRef.current = null;
//     }
//     setStatus('idle');
//   }, []);
//
//   useEffect(() => {
//     return () => {
//       if (html5QrRef.current) {
//         html5QrRef.current.stop().catch(() => {});
//         html5QrRef.current.clear().catch(() => {});
//       }
//     };
//   }, []);
//
//   const handleRetry = () => {
//     if (html5QrRef.current) {
//       html5QrRef.current.stop().catch(() => {});
//       html5QrRef.current.clear().catch(() => {});
//       html5QrRef.current = null;
//     }
//     setStatus('idle');
//     setErrorMsg('');
//   };
//
//   if (status === 'idle') {
//     return (
//       <div className="space-y-4">
//         <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 flex flex-col items-center gap-4">
//           <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
//             <ScanLine className="w-8 h-8" />
//           </div>
//           <div className="text-center">
//             <p className="font-medium text-sm">Barcode Scanner</p>
//             <p className="text-xs text-muted-foreground mt-1">
//               Position the PDF417 barcode on the back of the ID within the camera frame
//             </p>
//           </div>
//           <Button onClick={startScanner} className="gap-2">
//             <Camera className="w-4 h-4" />
//             Start Scanning
//           </Button>
//         </div>
//         <p className="text-xs text-muted-foreground text-center">
//           Tap <strong>Start Scanning</strong> to open the camera and scan the barcode
//         </p>
//       </div>
//     );
//   }
//
//   return (
//     <div className="space-y-4">
//       <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
//         <div id="id-barcode-scanner" ref={scannerRef} className="w-full h-full" />
//         {status === 'starting' && (
//           <div className="absolute inset-0 flex items-center justify-center bg-black/80">
//             <div className="text-center text-white">
//               <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
//               <p className="text-sm">Starting camera...</p>
//             </div>
//           </div>
//         )}
//         {status === 'scanning' && (
//           <div className="absolute inset-0 pointer-events-none">
//             <div className="absolute inset-4 border-2 border-white/30 rounded-lg">
//               <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
//               <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
//               <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
//               <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
//             </div>
//             <div className="absolute bottom-4 left-0 right-0 text-center">
//               <p className="text-white/80 text-xs bg-black/50 inline-block px-3 py-1 rounded-full">
//                 Hold the back of the ID to the camera
//               </p>
//             </div>
//           </div>
//         )}
//         {status === 'error' && (
//           <div className="absolute inset-0 flex items-center justify-center bg-black/80">
//             <div className="text-center text-white px-4">
//               <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
//               <p className="text-sm mb-3">{errorMsg}</p>
//               <Button variant="outline" size="sm" onClick={handleRetry}>
//                 <RotateCcw className="w-4 h-4 mr-1" /> Retry
//               </Button>
//             </div>
//           </div>
//         )}
//       </div>
//       {status === 'scanning' && (
//         <Button variant="outline" size="sm" className="w-full" onClick={stopScanner}>
//           <X className="w-4 h-4 mr-2" /> Stop Scanner
//         </Button>
//       )}
//       <p className="text-xs text-muted-foreground text-center">
//         Position the <strong>PDF417 barcode</strong> on the back of the ID within the frame
//       </p>
//     </div>
//   );
// }
// ══════════════════════════════════════════════════════════════════════════════
// END BARCODE SCANNER
// ══════════════════════════════════════════════════════════════════════════════

// ── Mobile ID Camera ───────────────────────────────────────────────
// Opens device camera with a frame guide for ID positioning.
// Captures and crops the image to the frame region.

function MobileIdCamera({
  onCapture,
  onBack,
}: {
  onCapture: (dataUrl: string) => void;
  onBack: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camStatus, setCamStatus] = useState<'starting' | 'ready' | 'denied' | 'error'>('starting');

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    stopStream();
    setCamStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCamStatus('ready');
      }
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCamStatus('denied');
      } else {
        setCamStatus('error');
      }
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  const capture = useCallback(() => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !video.videoWidth || !frame) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const videoRect = video.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();

    const intrinsicWidth = video.videoWidth;
    const intrinsicHeight = video.videoHeight;

    const scale = Math.max(videoRect.width / intrinsicWidth, videoRect.height / intrinsicHeight);
    const renderedWidth = intrinsicWidth * scale;
    const renderedHeight = intrinsicHeight * scale;
    const offsetX = (videoRect.width - renderedWidth) / 2;
    const offsetY = (videoRect.height - renderedHeight) / 2;

    const frameX = frameRect.left - videoRect.left;
    const frameY = frameRect.top - videoRect.top;

    const sx = (frameX - offsetX) / scale;
    const sy = (frameY - offsetY) / scale;
    const sw = frameRect.width / scale;
    const sh = frameRect.height / scale;

    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    stopStream();
    onCapture(dataUrl);
  }, [stopStream, onCapture]);

  const handleGalleryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      stopStream();
      onCapture(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/80 p-4 flex items-center gap-3 z-20 shrink-0">
        <button
          onClick={() => { stopStream(); onBack(); }}
          className="text-white/80 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-white font-semibold text-sm">Scan ID Card</p>
          <p className="text-white/60 text-xs">Align the front of your ID within the frame</p>
        </div>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Frame overlay */}
        {camStatus === 'ready' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-6">
            <div ref={frameRef} className="w-full max-w-sm aspect-[1.586/1] relative">
              <div className="absolute inset-0 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              <span className="absolute -top-7 left-0 text-[10px] font-bold tracking-widest text-white/80 uppercase">
                Align ID within frame
              </span>
            </div>
          </div>
        )}

        {camStatus === 'starting' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-3" />
              <p className="font-semibold">Starting camera...</p>
              <p className="text-white/60 text-sm mt-1">Allow camera access when prompted</p>
            </div>
          </div>
        )}

        {camStatus === 'denied' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center px-6">
            <div className="text-center text-white">
              <Camera className="w-10 h-10 mx-auto mb-3 text-white/60" />
              <p className="font-semibold text-lg mb-1">Camera blocked</p>
              <p className="text-white/60 text-sm mb-4">Enable camera access in your browser settings</p>
              <button
                onClick={startCamera}
                className="px-5 py-2.5 bg-white text-black rounded-lg font-bold"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {camStatus === 'error' && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center px-6">
            <div className="text-center text-white">
              <Camera className="w-10 h-10 mx-auto mb-3 text-white/60" />
              <p className="font-semibold text-lg mb-1">Camera not available</p>
              <button
                onClick={startCamera}
                className="px-5 py-2.5 bg-white text-black rounded-lg font-bold mt-4"
              >
                Retry
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Capture button */}
      {camStatus === 'ready' && (
        <div className="bg-black/80 p-8 flex flex-col items-center gap-4 shrink-0 z-20">
          <button
            onClick={capture}
            className="w-20 h-20 rounded-full border-4 border-white/40 flex items-center justify-center shadow-2xl active:scale-95 transition-transform"
          >
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center">
              <Camera className="w-7 h-7 text-black" />
            </div>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-white/60 text-xs flex items-center gap-1.5 hover:text-white/80 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            Or upload from gallery
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleGalleryUpload}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}

// ── Phone Scan Panel ───────────────────────────────────────────────
// Shows a QR code linking to /scan/{id}?mode=photo
// Desktop polls GET /api/scan-session until the phone submits, then fires onReceived.

function PhoneScanPanel({
  onReceived,
}: {
  onReceived: (payload: PhoneReceived) => void;
}) {
  const [sessionId, setSessionId] = useState<string>('');
  const [scanUrl, setScanUrl] = useState<string>('');
  const [status, setStatus] = useState<'generating' | 'waiting' | 'received' | 'error'>('generating');
  const [errorMsg, setErrorMsg] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep the latest onReceived in a ref so the polling interval is stable.
  const onReceivedRef = useRef(onReceived);
  useEffect(() => {
    onReceivedRef.current = onReceived;
  }, [onReceived]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const id = crypto.randomUUID();

      // Create the session row in the database
      try {
        const res = await fetch('/api/scan-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', sessionId: id, mode: 'photo' }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to create scan session');
        }
      } catch (err: any) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err?.message || 'Failed to create scan session. Please try again.');
        }
        return;
      }

      if (cancelled) return;

      setSessionId(id);

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const url = `${origin}/scan/${id}?mode=photo`;
      setScanUrl(url);
      setStatus('waiting');

      // Poll until the phone uploads
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

            // Mark the row consumed so it can't be read again
            fetch(`/api/scan-session?sessionId=${id}`, { method: 'DELETE' }).catch(() => {});

            if (!cancelled) {
              setStatus('received');
              onReceivedRef.current({
                imageBase64: data.imageBase64,
                imageStorageUrl: data.imageStorageUrl,
                parsedData: data.parsedData,
                signatureDataUrl: data.signatureDataUrl,
                termsAccepted: data.termsAccepted,
              });
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
            <RotateCcw className="w-4 h-4 mr-1" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* QR Code */}
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
            Open your phone&apos;s camera and scan this QR code to take a photo of the front of the ID
          </p>
        </div>
      </div>

      {/* Status indicator */}
      {status === 'waiting' && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Waiting for phone...</p>
            <p className="text-[11px] text-amber-600/70 dark:text-amber-400/60">
              Scan the QR code with your phone, then capture the ID and sign the agreement.
            </p>
          </div>
        </div>
      )}

      {status === 'received' && (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">Received from phone!</p>
            <p className="text-[11px] text-green-600/70 dark:text-green-400/60">
              Processing ID photo with AI...
            </p>
          </div>
        </div>
      )}

      {/* Cancel button */}
      {status === 'waiting' && (
        <Button variant="outline" size="sm" className="w-full" onClick={handleCancel}>
          <X className="w-4 h-4 mr-2" /> Cancel
        </Button>
      )}

      {/* How it works */}
      <div className="text-[11px] text-muted-foreground space-y-1.5 px-1">
        <p className="font-semibold text-foreground/70">How it works:</p>
        <div className="flex items-start gap-2">
          <span className="text-amber-500 font-bold">1</span>
          <span>Scan the QR code with your phone</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-500 font-bold">2</span>
          <span>Take a clear photo of the front of the ID</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-500 font-bold">3</span>
          <span>Review and agree to the terms, then sign on the phone</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-amber-500 font-bold">4</span>
          <span>The ID and signature are sent back here automatically</span>
        </div>
      </div>
    </div>
  );
}

// ── Vision Scanner Component ───────────────────────────────────────
// Front-of-ID scan. Two options: Scan with Phone (recommended) or Upload Photo.

function VisionScanner({
  onScanSuccess,
  onSignatureReceived,
}: {
  onScanSuccess: (data: ScannedIdData, imageBase64: string) => void;
  onSignatureReceived?: (signatureDataUrl: string, termsAccepted: boolean) => void;
}) {
  const isMobile = isMobileDevice();
  const [subMode, setSubMode] = useState<'choose' | 'phone' | 'upload' | 'camera'>(isMobile ? 'camera' : 'choose');
  const [status, setStatus] = useState<'idle' | 'processing' | 'error' | 'preview'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (dataUrl: string) => {
    setStatus('processing');
    setErrorMsg('');
    setPreview(dataUrl);

    try {
      const res = await fetch('/api/scan-id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('[VisionScanner] API Error Details:', err);
        throw new Error(err.error || 'Failed to process ID image');
      }

      const { data } = await res.json();
      if (!data) {
        throw new Error('No data extracted from ID');
      }

      onScanSuccess(data, dataUrl);
      setStatus('idle');
    } catch (err: any) {
      console.error('Vision scan error:', err);
      setStatus('error');
      setErrorMsg(err?.message || 'Failed to scan ID. Please try again.');
    }
  }, [onScanSuccess]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      processImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePhoneReceived = useCallback(
    (payload: PhoneReceived) => {
      // Phone already sent a signature + terms — bubble it up to check-in.tsx.
      if (payload.signatureDataUrl) {
        onSignatureReceived?.(payload.signatureDataUrl, !!payload.termsAccepted);
      }

      // Phone sent a photo — process it with AI
      const imageUrl = payload.imageStorageUrl || payload.imageBase64;
      if (imageUrl) {
        processImage(imageUrl);
      } else {
        setStatus('error');
        setErrorMsg('No image received from phone.');
      }
    },
    [processImage, onSignatureReceived]
  );

  const handleRetry = () => {
    setStatus('idle');
    setPreview(null);
    setErrorMsg('');
    setSubMode(isMobile ? 'camera' : 'choose');
  };

  const handleBackToChoose = () => {
    setSubMode(isMobile ? 'camera' : 'choose');
    setStatus('idle');
    setPreview(null);
    setErrorMsg('');
  };

  // ── Choose sub-mode ──
  if (subMode === 'choose' && status === 'idle') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3">
          {/* Option 1: Scan QR code with phone (primary) */}
          <button
            onClick={() => setSubMode('phone')}
            className="w-full p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                <QrCode className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base">Scan with Phone</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Scan a QR code with your phone, take a photo of the ID, agree to the terms and sign — all sent back here.
                </p>
                <Badge variant="secondary" className="mt-2 text-[10px]">Recommended</Badge>
              </div>
            </div>
          </button>

          {/* Option 2: Upload from file */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center shrink-0">
                <Upload className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base">Upload Photo</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Select an existing photo of the ID from this computer.
                </p>
              </div>
            </div>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="text-xs text-muted-foreground text-center">
          Take a clear photo of the <strong>front of the ID</strong>
        </p>
      </div>
    );
  }

  // ── Phone QR code mode ──
  if (subMode === 'phone' && status === 'idle') {
    return (
      <div className="space-y-3">
        <button
          onClick={handleBackToChoose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to options
        </button>
        <PhoneScanPanel onReceived={handlePhoneReceived} />
      </div>
    );
  }

  // ── Mobile Camera mode (direct camera access with frame guide) ──
  if (subMode === 'camera' && status === 'idle') {
    return (
      <MobileIdCamera
        onCapture={(dataUrl) => processImage(dataUrl)}
        onBack={handleBackToChoose}
      />
    );
  }

  // ── Processing ──
  if (status === 'processing' && preview) {
    return (
      <div className="space-y-3">
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt="ID Preview" className="w-full max-h-48 object-contain bg-muted/30" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center text-white">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm font-medium">Analyzing ID...</p>
              <p className="text-xs opacity-80">Extracting information with AI</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview ──
  if (status === 'preview' && preview) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl overflow-hidden border border-border bg-black">
          <img src={preview} alt="ID Preview" className="w-full max-h-64 object-contain" />
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Button 
            className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white" 
            onClick={() => processImage(preview)}
          >
            <Zap className="w-4 h-4" /> Extract Info with AI
          </Button>
          <Button 
            variant="outline" 
            className="w-full gap-2"
            onClick={() => onScanSuccess({} as ScannedIdData, preview)}
          >
            <CheckCircle className="w-4 h-4" /> Just Use Photo
          </Button>
          <Button 
            variant="ghost" 
            className="w-full gap-2 text-muted-foreground"
            onClick={handleRetry}
          >
            <RotateCcw className="w-4 h-4" /> Retake Photo
          </Button>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (status === 'error') {
    return (
      <div className="space-y-3">
        {preview && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img src={preview} alt="ID Preview" className="w-full max-h-48 object-contain bg-muted/30" />
          </div>
        )}
        <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600 dark:text-red-400">{errorMsg}</p>
        </div>
        <Button variant="outline" className="w-full" onClick={handleRetry}>
          <RotateCcw className="w-4 h-4 mr-2" /> Try Again
        </Button>
      </div>
    );
  }

  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// BARCODE SCANNER SECTION — COMMENTED OUT (not currently used)
// Re-enable when PDF417 barcode scanning is needed in the future.
// ══════════════════════════════════════════════════════════════════════════════
//
// function BarcodeScannerSection({
//   onScanSuccess,
//   onSignatureReceived,
//   processImage,
// }: {
//   onScanSuccess: (data: ScannedIdData, imageBase64?: string) => void;
//   onSignatureReceived?: (signatureDataUrl: string, termsAccepted: boolean) => void;
//   processImage: (dataUrl: string) => Promise<void>;
// }) {
//   const [subMode, setSubMode] = useState<'choose' | 'phone' | 'pc'>('choose');
//
//   const handlePhoneReceived = useCallback(
//     (payload: PhoneReceived) => {
//       if (payload.signatureDataUrl) {
//         onSignatureReceived?.(payload.signatureDataUrl, !!payload.termsAccepted);
//       }
//       // If phone sent parsed barcode data, use it directly
//       if (payload.parsedData) {
//         onScanSuccess(payload.parsedData, payload.imageStorageUrl || payload.imageBase64 || undefined);
//         return;
//       }
//       // Otherwise, phone sent a photo — process it with AI
//       const imageUrl = payload.imageStorageUrl || payload.imageBase64;
//       if (imageUrl) {
//         processImage(imageUrl);
//       } else {
//         toast.error('No image received from phone. Please try again.');
//         setSubMode('choose');
//       }
//     },
//     [onScanSuccess, onSignatureReceived, processImage]
//   );
//
//   if (subMode === 'choose') {
//     return (
//       <div className="space-y-3">
//         <div className="grid grid-cols-1 gap-3">
//           {/* Option 1: Scan with phone (primary) */}
//           <button
//             onClick={() => setSubMode('phone')}
//             className="w-full p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left"
//           >
//             <div className="flex items-start gap-4">
//               <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
//                 <QrCode className="w-6 h-6" />
//               </div>
//               <div className="flex-1">
//                 <p className="font-semibold text-base">Scan with Phone</p>
//                 <p className="text-sm text-muted-foreground mt-0.5">
//                   Scan a QR code with your phone, scan the PDF417 barcode on the back of the ID, agree to the terms and sign — all sent back here. Instant, 100% accurate.
//                 </p>
//                 <Badge variant="secondary" className="mt-2 text-[10px]">Recommended</Badge>
//               </div>
//             </div>
//           </button>
//
//           {/* Option 2: Use this PC's camera */}
//           <button
//             onClick={() => setSubMode('pc')}
//             className="w-full p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left"
//           >
//             <div className="flex items-start gap-4">
//               <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
//                 <ScanLine className="w-6 h-6" />
//               </div>
//               <div className="flex-1">
//                 <p className="font-semibold text-base">Use this PC&apos;s Camera</p>
//                 <p className="text-sm text-muted-foreground mt-0.5">
//                   Hold the back of the ID to this computer&apos;s camera. No terms/signature captured on the phone.
//                 </p>
//               </div>
//             </div>
//           </button>
//         </div>
//       </div>
//     );
//   }
//
//   return (
//     <div className="space-y-3">
//       <button
//         onClick={() => setSubMode('choose')}
//         className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
//       >
//         <ArrowLeft className="w-4 h-4" />
//         Back to options
//       </button>
//       {subMode === 'phone' ? (
//         <PhoneScanPanel mode="barcode" onReceived={handlePhoneReceived} />
//       ) : (
//         <BarcodeScanner onScanSuccess={onScanSuccess} />
//       )}
//     </div>
//   );
// }
// ══════════════════════════════════════════════════════════════════════════════
// END BARCODE SCANNER SECTION
// ══════════════════════════════════════════════════════════════════════════════

// ── Main ID Scanner Component ──────────────────────────────────────

export default function IdScanner({ onScanComplete, onSignatureReceived, onClose }: IdScannerProps) {
  const [mode, setMode] = useState<ScanMode>('choose');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [scannedData, setScannedData] = useState<ScannedIdData | null>(null);
  const [scannedImage, setScannedImage] = useState<string | undefined>();

  // BARCODE: Uncomment when re-enabling barcode scanning
  // const handleBarcodeScan = useCallback((data: ScannedIdData, imageBase64?: string) => {
  //   setScannedData(data);
  //   if (imageBase64) setScannedImage(imageBase64);
  //   setStatus('success');
  //   toast.success('ID barcode scanned successfully!');
  // }, []);

  const handleVisionScan = useCallback((data: ScannedIdData, imageBase64?: string) => {
    setScannedData(data);
    setScannedImage(imageBase64);
    setStatus('success');
    toast.success('ID scanned successfully with AI!');
  }, []);

  const handleConfirm = () => {
    if (scannedData) {
      onScanComplete(scannedData, scannedImage);
    }
  };

  const handleReset = () => {
    setScannedData(null);
    setScannedImage(undefined);
    setStatus('idle');
    setMode('choose');
  };

  const handleBackToChoose = () => {
    setStatus('idle');
    setMode('choose');
  };

  return (
    <div className="space-y-4">
      {mode !== 'choose' && status === 'idle' && (
        <button
          onClick={handleBackToChoose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to scan options
        </button>
      )}

      {/* ── Choose Scan Method ── */}
      {mode === 'choose' && status === 'idle' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Scan Guest ID</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose how to scan the guest&apos;s ID to auto-fill their information.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* BARCODE: Uncomment when re-enabling barcode scanning */}
            {/* <button
              onClick={() => setMode('barcode')}
              className="w-full p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center shrink-0">
                  <ScanLine className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">Scan Barcode (Back)</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Scan the PDF417 barcode on the back of the ID. Instant, 100% accurate.
                  </p>
                  <Badge variant="secondary" className="mt-2 text-[10px]">Recommended</Badge>
                </div>
              </div>
            </button> */}

            {/* Option 1: Scan Front with AI (Primary) */}
            <button
              onClick={() => setMode('vision')}
              className="w-full p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">Scan Front of ID</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Take a photo of the front of the ID. AI extracts all fields automatically.
                  </p>
                  <Badge variant="secondary" className="mt-2 text-[10px]">Recommended</Badge>
                </div>
              </div>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Scanner Area */}
      {/* BARCODE: Uncomment when re-enabling barcode scanning */}
      {/* {mode === 'barcode' && status === 'idle' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="w-5 h-5" /> Scan Barcode (Back of ID)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Hold the back of the ID so the barcode is visible, or scan it with a phone.
            </p>
          </CardHeader>
          <CardContent>
            <BarcodeScannerSection
              onScanSuccess={handleBarcodeScan}
              onSignatureReceived={onSignatureReceived}
              processImage={processImageForAI}
            />
          </CardContent>
        </Card>
      )} */}

      {mode === 'vision' && status === 'idle' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-5 h-5" /> Scan Front of ID
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Take a clear photo of the front of the ID. AI will extract all the information.
            </p>
          </CardHeader>
          <CardContent>
            <VisionScanner
              onScanSuccess={handleVisionScan}
              onSignatureReceived={onSignatureReceived}
            />
          </CardContent>
        </Card>
      )}

      {/* Processing - AI extracting data */}
      {status === 'processing' && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium">Analyzing ID with AI...</p>
              <p className="text-xs text-muted-foreground mt-1">Extracting information from the photo</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success - Show Extracted Data */}
      {status === 'success' && scannedData && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" /> ID Scanned Successfully
              </CardTitle>
              <Badge variant="secondary" className="text-[10px]">
                AI Vision
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {scannedImage && (
              <div className="rounded-lg overflow-hidden border border-border">
                <img src={scannedImage} alt="Scanned ID" className="w-full max-h-40 object-contain bg-muted/30" />
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Full Name</p>
              <p className="text-sm font-medium">{scannedData.fullName || `${scannedData.firstName} ${scannedData.middleName} ${scannedData.lastName}`.trim()}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">ID Number</p>
                <p className="text-sm font-medium font-mono">{scannedData.idNumber}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Date of Birth</p>
                <p className="text-sm font-medium">{scannedData.dateOfBirth}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Gender</p>
                <p className="text-sm font-medium">{scannedData.gender}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">ID Type</p>
                <p className="text-sm font-medium">{scannedData.idType}{scannedData.issuingState ? ` — ${scannedData.issuingState}` : ''}</p>
              </div>
            </div>
            {scannedData.address.street && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Address</p>
                <p className="text-sm font-medium">
                  {scannedData.address.street}
                  {scannedData.address.city && `, ${scannedData.address.city}`}
                  {scannedData.address.state && `, ${scannedData.address.state}`}
                  {scannedData.address.zipCode && ` ${scannedData.address.zipCode}`}
                </p>
              </div>
            )}
            {(scannedData.eyeColor || scannedData.height || scannedData.weight) && (
              <div className="grid grid-cols-3 gap-3">
                {scannedData.eyeColor && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Eyes</p>
                    <p className="text-sm font-medium">{scannedData.eyeColor}</p>
                  </div>
                )}
                {scannedData.height && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Height</p>
                    <p className="text-sm font-medium">{scannedData.height}</p>
                  </div>
                )}
                {scannedData.weight && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Weight</p>
                    <p className="text-sm font-medium">{scannedData.weight}</p>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {scannedData.expirationDate && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Expires</p>
                  <p className="text-sm font-medium">{scannedData.expirationDate}</p>
                </div>
              )}
              {scannedData.issueDate && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Issued</p>
                  <p className="text-sm font-medium">{scannedData.issueDate}</p>
                </div>
              )}
            </div>
            {(scannedData.veteran || scannedData.organDonor || scannedData.realId) && (
              <div className="flex gap-2 flex-wrap">
                {scannedData.veteran && <Badge variant="secondary" className="text-[10px]">Veteran</Badge>}
                {scannedData.organDonor && <Badge variant="secondary" className="text-[10px]">Organ Donor</Badge>}
                {scannedData.realId && <Badge variant="secondary" className="text-[10px]">REAL ID</Badge>}
              </div>
            )}
            <Separator />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleReset}>
                <RotateCcw className="w-4 h-4 mr-2" /> Rescan
              </Button>
              <Button className="flex-1" onClick={handleConfirm}>
                <CheckCircle className="w-4 h-4 mr-2" /> Use This Data
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
