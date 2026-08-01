import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, CheckCircle, RefreshCcw, Loader2, CameraOff, ShieldAlert, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { BrowserMultiFormatReader } from '@zxing/library';
import { parseIdBarcode } from '../lib/idParser';
import SignatureCanvas from 'react-signature-canvas';
import { TERMS_AND_CONDITIONS, TERMS_HEADER } from '../data/termsAndConditions';

// Camera lifecycle states
const STATUS = {
  REQUESTING: 'requesting',
  READY: 'ready',
  DENIED: 'denied',
  UNAVAILABLE: 'unavailable',
  INSECURE: 'insecure',
};

export default function MobileScanPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const sigCanvas = useRef(null);

  const [status, setStatus] = useState(STATUS.REQUESTING);
  const [errorMsg, setErrorMsg] = useState('');
  const [imageSrc, setImageSrc] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [step, setStep] = useState('camera'); // 'camera', 'signature', 'success'

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMsg('');
    setStatus(STATUS.REQUESTING);
    stopStream();

    if (!window.isSecureContext) {
      setStatus(STATUS.INSECURE);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus(STATUS.UNAVAILABLE);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
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
      setStatus(STATUS.READY);
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
        setStatus(STATUS.DENIED);
      } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
        setStatus(STATUS.UNAVAILABLE);
        setErrorMsg(err.message);
      } else {
        setStatus(STATUS.DENIED);
        setErrorMsg(err.message);
      }
    }
  }, [stopStream]);

  useEffect(() => {
    startCamera();
    return () => stopStream();
  }, [startCamera, stopStream]);

  useEffect(() => {
    if (!sessionId) toast.error('Invalid session link.');
  }, [sessionId]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setImageSrc(dataUrl);

    setIsDecoding(true);
    setParsedData(null);
    try {
      const codeReader = new BrowserMultiFormatReader();
      const img = new Image();
      img.src = dataUrl;
      await new Promise(resolve => img.onload = resolve);
      
      const result = await codeReader.decodeFromImageElement(img);
      if (result && result.text) {
        const pd = parseIdBarcode(result.text);
        if (pd) {
          setParsedData(pd);
          toast.success("Barcode successfully decoded!");
        } else {
          toast.warning("Barcode found but couldn't be parsed.");
        }
      }
    } catch (err) {
      console.log('Barcode decode failed or not found:', err);
      toast.info("Barcode not detected — photo will be sent without auto-fill.");
    } finally {
      setIsDecoding(false);
    }
  }, []);

  const retake = () => {
    setImageSrc(null);
    setParsedData(null);
  };

  const submitAll = async () => {
    if (!imageSrc || !sessionId) return;
    if (sigCanvas.current?.isEmpty()) {
      toast.error('Please provide your signature.');
      return;
    }

    setIsUploading(true);
    try {
      const signatureDataUrl = sigCanvas.current.getCanvas().toDataURL('image/png');

      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const fileName = `id_${sessionId}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('ids')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('ids').getPublicUrl(fileName);

      const channel = supabase.channel(`scan_${sessionId}`);
      await channel.send({
        type: 'broadcast',
        event: 'id_scanned',
        payload: { imageUrl: publicUrl, parsedData, signatureDataUrl },
      });
      supabase.removeChannel(channel);

      stopStream();
      setStep('success');
      toast.success('Successfully uploaded!');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload data.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-[100dvh] bg-surface-container flex items-center justify-center p-6 text-center">
        <div>
          <AlertTriangle className="w-12 h-12 text-error mx-auto mb-4" />
          <h1 className="text-display-md font-bold text-error mb-2">Invalid Link</h1>
          <p className="text-on-surface-variant">Please scan the QR code from the admin dashboard again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden select-none">
      <header className="bg-surface-container-lowest p-4 text-center border-b border-outline-variant z-20 shrink-0">
        <h1 className="text-title-md font-bold text-primary">Airway Motel</h1>
        <p className="text-body-sm text-on-surface-variant">
          {step === 'camera' ? 'Guest ID Scanner' : step === 'signature' ? 'Check-In Agreement' : 'Success'}
        </p>
      </header>

      {/* CAMERA STEP */}
      {step === 'camera' && (
        <div className="relative flex-1 overflow-hidden bg-black flex flex-col">
          <div className="relative flex-1 overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />

            {imageSrc && (
              <img src={imageSrc} alt="Captured ID" className="absolute inset-0 h-full w-full object-contain bg-black z-10" />
            )}

            {!imageSrc && status === STATUS.READY && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center px-6">
                <div className="w-full max-w-md aspect-[1.586/1] relative">
                  <div className="absolute inset-0 rounded-xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
                  <span className="absolute -top-7 left-0 text-label-caps font-bold tracking-widest text-white/80">Align ID within frame</span>
                </div>
              </div>
            )}

            {(status === STATUS.REQUESTING) && !imageSrc && (
              <CenteredOverlay>
                <Loader2 className="w-12 h-12 text-white animate-spin mb-4" />
                <p className="font-bold">Starting camera…</p>
                <p className="text-white/60 text-sm">Allow camera access when prompted.</p>
              </CenteredOverlay>
            )}
            
            {isDecoding && imageSrc && (
              <CenteredOverlay>
                <div className="bg-black/60 p-6 rounded-2xl backdrop-blur-md border border-white/20">
                  <Loader2 className="w-10 h-10 text-white animate-spin mx-auto mb-3" />
                  <p className="font-bold text-white">Decoding barcode…</p>
                </div>
              </CenteredOverlay>
            )}

            {status === STATUS.DENIED && (
              <CenteredOverlay>
                <CameraOff className="w-12 h-12 text-white/80 mb-4" />
                <p className="font-bold text-lg mb-1">Camera blocked</p>
                <p className="text-white/60 text-sm max-w-xs mb-5">
                  Access was denied or the camera is in use by another app. Enable camera permission in your browser settings, then retry.
                </p>
                <button onClick={startCamera} className="px-5 py-2.5 bg-white text-black rounded-lg font-bold flex items-center gap-2 cursor-pointer">
                  <RefreshCcw className="w-4 h-4" /> Retry camera
                </button>
              </CenteredOverlay>
            )}

            {status === STATUS.UNAVAILABLE && (
              <CenteredOverlay>
                <CameraOff className="w-12 h-12 text-white/80 mb-4" />
                <p className="font-bold text-lg mb-1">No camera found</p>
                <p className="text-white/60 text-sm max-w-xs mb-5">{errorMsg || 'This device has no usable camera.'}</p>
                <button onClick={startCamera} className="px-5 py-2.5 bg-white text-black rounded-lg font-bold flex items-center gap-2 cursor-pointer">
                  <RefreshCcw className="w-4 h-4" /> Retry
                </button>
              </CenteredOverlay>
            )}

            {status === STATUS.INSECURE && (
              <CenteredOverlay>
                <ShieldAlert className="w-12 h-12 text-white/80 mb-4" />
                <p className="font-bold text-lg mb-1">Secure connection required</p>
                <p className="text-white/60 text-sm max-w-xs">
                  The camera only works over HTTPS or localhost. Open this page via the secure QR link.
                </p>
              </CenteredOverlay>
            )}
          </div>
          
          <div className="z-20 bg-gradient-to-t from-black/90 to-transparent p-6 pb-10 shrink-0">
            {imageSrc ? (
              <div className="flex gap-4 max-w-md mx-auto">
                <button
                  onClick={retake}
                  disabled={isDecoding}
                  className="flex-1 bg-white/15 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 backdrop-blur-md cursor-pointer disabled:opacity-50"
                >
                  <RefreshCcw className="w-5 h-5" /> Retake
                </button>
                <button
                  onClick={() => setStep('signature')}
                  disabled={isDecoding}
                  className="flex-[2] bg-secondary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" /> Next: Sign
                </button>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={capture}
                  disabled={status !== STATUS.READY}
                  className="w-20 h-20 rounded-full border-4 border-white/40 flex items-center justify-center shadow-2xl active:scale-95 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* SIGNATURE STEP */}
      {step === 'signature' && (
        <div className="flex-1 bg-surface-container-lowest text-on-surface overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <h2 className="text-title-lg font-bold text-primary">Terms & Conditions</h2>
            <div className="bg-surface-container rounded-lg p-4 text-body-sm text-on-surface-variant border border-outline-variant leading-relaxed">
              <p className="mb-3 italic">{TERMS_HEADER}</p>
              <ol className="space-y-2 list-decimal list-inside">
                {TERMS_AND_CONDITIONS.map(term => (
                  <li key={term.number}>{term.text}</li>
                ))}
              </ol>
            </div>
            
            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-label-caps text-on-surface-variant uppercase font-bold">Please sign below</label>
                <button type="button" onClick={() => sigCanvas.current?.clear()} className="text-error text-label-sm font-bold uppercase tracking-wider cursor-pointer">Clear Pad</button>
              </div>
              <div 
                className="w-full h-48 border border-outline rounded-lg bg-white relative overflow-hidden"
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
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-outline-variant bg-surface-container-lowest shrink-0">
            <button
              onClick={submitAll}
              disabled={isUploading}
              className="w-full bg-secondary text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {isUploading ? 'Securely Transmitting...' : 'Agree & Complete Check-In'}
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS STEP */}
      {step === 'success' && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-8 bg-black">
          <CheckCircle className="w-20 h-20 text-secondary mb-4" />
          <h2 className="text-title-lg font-bold mb-2 text-white">All Done!</h2>
          <p className="text-white/70 max-w-xs">Your ID and Signature have been securely transmitted to the front desk. Please hand this device back.</p>
        </div>
      )}
    </div>
  );
}

function CenteredOverlay({ children }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-8">
      {children}
    </div>
  );
}
