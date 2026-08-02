'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, ScanLine, Upload, Loader2, CheckCircle, AlertCircle,
  X, RotateCcw, SwitchCamera, ArrowLeft, Zap, Smartphone, QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────

export interface ScannedIdData {
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  idNumber: string;
  idType: string;
  issuingState: string;
  expirationDate: string;
  issueDate: string;
  eyeColor: string;
  hairColor: string;
  height: string;
  weight: string;
  veteran: boolean;
  organDonor: boolean;
  realId: boolean;
}

type ScanMode = 'choose' | 'barcode' | 'vision';
type ScanStatus = 'idle' | 'scanning' | 'processing' | 'success' | 'error';

interface IdScannerProps {
  onScanComplete: (data: ScannedIdData, imageBase64?: string) => void;
  onClose?: () => void;
}

// ── AAMVA PDF417 Parser ────────────────────────────────────────────

function parseAAMVA(rawText: string): ScannedIdData | null {
  try {
    // AAMVA format starts with @\n followed by ANSI or AAMVA
    if (!rawText.includes('ANSI') && !rawText.includes('AAMVA')) {
      return null;
    }

    const result: ScannedIdData = {
      firstName: '',
      middleName: '',
      lastName: '',
      fullName: '',
      dateOfBirth: '',
      gender: '',
      address: { street: '', city: '', state: '', zipCode: '' },
      idNumber: '',
      idType: 'Driver License',
      issuingState: '',
      expirationDate: '',
      issueDate: '',
      eyeColor: '',
      hairColor: '',
      height: '',
      weight: '',
      veteran: false,
      organDonor: false,
      realId: false,
    };

    const lines = rawText.split(/\n|\r/).map(l => l.trim()).filter(Boolean);

    // Extract issuer ID from header
    const headerMatch = rawText.match(/ANSI\s*(\d{6})/);
    if (headerMatch) {
      const issuerId = headerMatch[1].substring(0, 2);
      const stateMap: Record<string, string> = {
        '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR',
        '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
        '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
        '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
        '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
        '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
        '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE',
        '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
        '36': 'NY', '37': 'NC', '38': 'ND', '40': 'OK',
        '41': 'OR', '44': 'RI', '45': 'SC', '46': 'SD',
        '47': 'TN', '49': 'UT', '50': 'VT', '51': 'VA',
        '53': 'WA', '54': 'WV', '55': 'WI', '56': 'WY',
      };
      result.issuingState = stateMap[issuerId] || issuerId;
    }

    // Parse each line for AAMVA elements
    for (const line of lines) {
      const daaMatch = line.match(/^DAA(.+)/);
      if (daaMatch) {
        const nameParts = daaMatch[1].split(',').map(s => s.trim());
        if (nameParts.length >= 1) result.lastName = nameParts[0];
        if (nameParts.length >= 2) {
          const firstMiddle = nameParts[1].split(' ').map(s => s.trim());
          result.firstName = firstMiddle[0] || '';
          result.middleName = firstMiddle.slice(1).join(' ');
        }
        result.fullName = `${result.firstName} ${result.middleName} ${result.lastName}`.replace(/\s+/g, ' ').trim();
      }
      const dacMatch = line.match(/^DAC(.+)/);
      if (dacMatch) result.firstName = dacMatch[1].trim();
      const dadMatch = line.match(/^DAD(.+)/);
      if (dadMatch) result.middleName = dadMatch[1].trim();
      const dcbMatch = line.match(/^DCB(.+)/);
      if (dcbMatch) result.lastName = dcbMatch[1].trim();
      const dcsMatch = line.match(/^DCS(.+)/);
      if (dcsMatch) result.lastName = dcsMatch[1].trim();
      const dbbMatch = line.match(/^DBB(.+)/);
      if (dbbMatch) {
        const dobRaw = dbbMatch[1].trim();
        if (dobRaw.length === 8) {
          if (dobRaw.startsWith('19') || dobRaw.startsWith('20')) {
            result.dateOfBirth = `${dobRaw.slice(0,4)}-${dobRaw.slice(4,6)}-${dobRaw.slice(6,8)}`;
          } else {
            result.dateOfBirth = `${dobRaw.slice(4,8)}-${dobRaw.slice(0,2)}-${dobRaw.slice(2,4)}`;
          }
        }
      }
      const dbcMatch = line.match(/^DBC(.+)/);
      if (dbcMatch) {
        const g = dbcMatch[1].trim().toUpperCase();
        result.gender = g === '1' || g === 'M' ? 'Male' : g === '2' || g === 'F' ? 'Female' : g;
      }
      const dagMatch = line.match(/^DAG(.+)/);
      if (dagMatch) result.address.street = dagMatch[1].trim();
      const daiMatch = line.match(/^DAI(.+)/);
      if (daiMatch) result.address.city = daiMatch[1].trim();
      const dajMatch = line.match(/^DAJ(.+)/);
      if (dajMatch) result.address.state = dajMatch[1].trim();
      const dakMatch = line.match(/^DAK(.+)/);
      if (dakMatch) {
        result.address.zipCode = dakMatch[1].trim().substring(0, 5);
      }
      const daqMatch = line.match(/^DAQ(.+)/);
      if (daqMatch) result.idNumber = daqMatch[1].trim();
      const dbaMatch = line.match(/^DBA(.+)/);
      if (dbaMatch) {
        const expRaw = dbaMatch[1].trim();
        if (expRaw.length === 8) {
          if (expRaw.startsWith('20')) {
            result.expirationDate = `${expRaw.slice(0,4)}-${expRaw.slice(4,6)}-${expRaw.slice(6,8)}`;
          } else {
            result.expirationDate = `${expRaw.slice(4,8)}-${expRaw.slice(0,2)}-${expRaw.slice(2,4)}`;
          }
        }
      }
      const dbdMatch = line.match(/^DBD(.+)/);
      if (dbdMatch) {
        const issRaw = dbdMatch[1].trim();
        if (issRaw.length === 8) {
          if (issRaw.startsWith('20')) {
            result.issueDate = `${issRaw.slice(0,4)}-${issRaw.slice(4,6)}-${issRaw.slice(6,8)}`;
          } else {
            result.issueDate = `${issRaw.slice(4,8)}-${issRaw.slice(0,2)}-${issRaw.slice(2,4)}`;
          }
        }
      }
      const dayMatch = line.match(/^DAY(.+)/);
      if (dayMatch) {
        const eyeMap: Record<string, string> = {
          'BLK': 'Black', 'BLU': 'Blue', 'BRO': 'Brown', 'GRY': 'Gray',
          'GRN': 'Green', 'HAZ': 'Hazel', 'MAR': 'Maroon', 'DIC': 'Dichromatic',
        };
        result.eyeColor = eyeMap[dayMatch[1].trim().toUpperCase()] || dayMatch[1].trim();
      }
      const dazMatch = line.match(/^DAZ(.+)/);
      if (dazMatch) {
        const hairMap: Record<string, string> = {
          'BAL': 'Bald', 'BLK': 'Black', 'BLN': 'Blond', 'BRO': 'Brown',
          'GRY': 'Gray', 'RED': 'Red/Auburn', 'SDY': 'Sandy', 'WHI': 'White',
        };
        result.hairColor = hairMap[dazMatch[1].trim().toUpperCase()] || dazMatch[1].trim();
      }
      const dauMatch = line.match(/^DAU(.+)/);
      if (dauMatch) result.height = dauMatch[1].trim();
      const dawMatch = line.match(/^DAW(.+)/);
      if (dawMatch) result.weight = dawMatch[1].trim();
      if (line.includes('ID') || line.includes('IDENTIFICATION')) {
        result.idType = 'State ID';
      }
    }

    if (!result.fullName) {
      result.fullName = `${result.firstName} ${result.middleName} ${result.lastName}`.replace(/\s+/g, ' ').trim();
    }
    if (!result.issuingState && result.address.state) {
      result.issuingState = result.address.state;
    }
    if (!result.lastName && !result.firstName && !result.idNumber) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

// ── Barcode Scanner Component ──────────────────────────────────────

function BarcodeScanner({ onScanSuccess }: { onScanSuccess: (data: ScannedIdData) => void }) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<any>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return;
    setStatus('starting');
    setErrorMsg('');

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('id-barcode-scanner');
      html5QrRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 200 },
          formatsToSupport: [
            // @ts-expect-error - PDF417 format constant
            0,
          ],
        },
        (decodedText: string) => {
          const parsed = parseAAMVA(decodedText);
          if (parsed) {
            scanner.stop().catch(() => {});
            onScanSuccess(parsed);
          } else {
            if (decodedText.length > 3) {
              const partial: ScannedIdData = {
                firstName: '', middleName: '', lastName: '', fullName: '',
                dateOfBirth: '', gender: '',
                address: { street: '', city: '', state: '', zipCode: '' },
                idNumber: decodedText, idType: 'State ID', issuingState: '',
                expirationDate: '', issueDate: '', eyeColor: '', hairColor: '',
                height: '', weight: '', veteran: false, organDonor: false, realId: false,
              };
              scanner.stop().catch(() => {});
              onScanSuccess(partial);
            }
          }
        },
        () => {}
      );

      setStatus('scanning');
    } catch (err: any) {
      console.error('Scanner error:', err);
      setStatus('error');
      setErrorMsg(err?.message || 'Failed to start camera. Please check permissions.');
    }
  }, [onScanSuccess]);

  const stopScanner = useCallback(() => {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
      html5QrRef.current.clear().catch(() => {});
      html5QrRef.current = null;
    }
    setStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (html5QrRef.current) {
        html5QrRef.current.stop().catch(() => {});
        html5QrRef.current.clear().catch(() => {});
      }
    };
  }, []);

  const handleRetry = () => {
    if (html5QrRef.current) {
      html5QrRef.current.stop().catch(() => {});
      html5QrRef.current.clear().catch(() => {});
      html5QrRef.current = null;
    }
    setStatus('idle');
    setErrorMsg('');
  };

  if (status === 'idle') {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-8 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center">
            <ScanLine className="w-8 h-8" />
          </div>
          <div className="text-center">
            <p className="font-medium text-sm">Barcode Scanner</p>
            <p className="text-xs text-muted-foreground mt-1">
              Position the PDF417 barcode on the back of the ID within the camera frame
            </p>
          </div>
          <Button onClick={startScanner} className="gap-2">
            <Camera className="w-4 h-4" />
            Start Scanning
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Tap <strong>Start Scanning</strong> to open the camera and scan the barcode
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
        <div id="id-barcode-scanner" ref={scannerRef} className="w-full h-full" />
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Starting camera...</p>
            </div>
          </div>
        )}
        {status === 'scanning' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-white/30 rounded-lg">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white/80 text-xs bg-black/50 inline-block px-3 py-1 rounded-full">
                Hold the back of the ID to the camera
              </p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white px-4">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
              <p className="text-sm mb-3">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RotateCcw className="w-4 h-4 mr-1" /> Retry
              </Button>
            </div>
          </div>
        )}
      </div>
      {status === 'scanning' && (
        <Button variant="outline" size="sm" className="w-full" onClick={stopScanner}>
          <X className="w-4 h-4 mr-2" /> Stop Scanner
        </Button>
      )}
      <p className="text-xs text-muted-foreground text-center">
        Position the <strong>PDF417 barcode</strong> on the back of the ID within the frame
      </p>
    </div>
  );
}

// ── Phone QR Code Scanner Component ────────────────────────────────
// Shows a QR code — user scans with phone, takes photo on phone, image comes back to computer.

function PhoneQrScanner({ onImageReceived }: { onImageReceived: (dataUrl: string) => void }) {
  const [sessionId, setSessionId] = useState<string>('');
  const [scanUrl, setScanUrl] = useState<string>('');
  const [status, setStatus] = useState<'generating' | 'waiting' | 'received' | 'error'>('generating');
  const [errorMsg, setErrorMsg] = useState('');
  const channelRef = useRef<any>(null);

  // Generate session and set up Realtime listener
  useEffect(() => {
    const id = crypto.randomUUID();
    setSessionId(id);

    // Build the URL for the phone to open
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/scan/${id}?mode=id-scan`;
    setScanUrl(url);
    setStatus('waiting');

    // If Supabase is available, listen for the broadcast from the phone
    if (supabase) {
      const channel = supabase.channel(`scan_${id}`, {
        config: { broadcast: { self: true } },
      });

      channel.on('broadcast', { event: 'id_scanned' }, (payload: any) => {
        console.log('[IdScanner] Received id_scanned broadcast:', payload);
        const imageUrl = payload?.imageUrl;
        if (imageUrl) {
          setStatus('received');
          // Fetch the image and convert to data URL
          fetchImageAsDataUrl(imageUrl).then((dataUrl) => {
            if (dataUrl) {
              onImageReceived(dataUrl);
            } else {
              // If we can't fetch as data URL, use the URL directly
              onImageReceived(imageUrl);
            }
          });
        }
      });

      channel.subscribe((status: string) => {
        console.log('[IdScanner] Channel status:', status);
      });

      channelRef.current = channel;

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setStatus('error');
      setErrorMsg('Supabase is not configured. QR code scanning requires a server connection.');
    }
  }, [onImageReceived]);

  // Helper: fetch an image URL and convert to data URL
  const fetchImageAsDataUrl = async (url: string): Promise<string | null> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const handleCancel = () => {
    if (channelRef.current && supabase) {
      supabase.removeChannel(channelRef.current);
    }
    setStatus('generating');
  };

  if (status === 'error') {
    return (
      <div className="space-y-4">
        <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">{errorMsg}</p>
          <p className="text-xs text-muted-foreground">
            Connect to Supabase to use the QR code scanning feature, or use the Upload option instead.
          </p>
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
            Open your phone&apos;s camera and scan this QR code to take a photo of the ID
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
              Scan the QR code with your phone, then take a photo of the ID
            </p>
          </div>
        </div>
      )}

      {status === 'received' && (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-medium text-green-700 dark:text-green-400">Photo received from phone!</p>
            <p className="text-[11px] text-green-600/70 dark:text-green-400/60">Processing with AI...</p>
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
          <span>The photo is sent back here automatically</span>
        </div>
      </div>
    </div>
  );
}

// ── Camera Viewfinder Component ────────────────────────────────────
// Fallback: live camera feed on the PC with a capture button.

function CameraViewfinder({ onCapture }: { onCapture: (dataUrl: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setStatus('starting');
    setErrorMsg('');
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
    } catch (err: any) {
      console.error('Camera error:', err);
      setStatus('error');
      setErrorMsg(err?.message || 'Could not access camera.');
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    onCapture(dataUrl);
  };

  const handleSwitchCamera = () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    startCamera(newFacing);
  };

  return (
    <div className="space-y-4">
      <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />
        {status === 'starting' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p className="text-sm">Opening camera...</p>
            </div>
          </div>
        )}
        {status === 'ready' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-4 border-2 border-white/30 rounded-lg">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-lg" />
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-white/80 text-xs bg-black/50 inline-block px-3 py-1 rounded-full">
                Align the front of the ID within the frame
              </p>
            </div>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white px-4">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-400" />
              <p className="text-sm mb-3">{errorMsg}</p>
              <Button variant="outline" size="sm" onClick={() => startCamera(facingMode)}>
                <RotateCcw className="w-4 h-4 mr-1" /> Retry
              </Button>
            </div>
          </div>
        )}
      </div>
      {status === 'ready' && (
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={handleSwitchCamera} className="shrink-0" title="Switch camera">
            <SwitchCamera className="w-4 h-4" />
          </Button>
          <Button onClick={handleCapture} className="flex-1 gap-2">
            <Zap className="w-4 h-4" /> Capture Photo
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Vision Scanner Component ───────────────────────────────────────
// Three options: Scan QR code (phone), Upload file, or Use PC camera

function VisionScanner({ onScanSuccess }: { onScanSuccess: (data: ScannedIdData, imageBase64: string) => void }) {
  const [subMode, setSubMode] = useState<'choose' | 'phone' | 'camera' | 'upload'>('choose');
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
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
    reader.onload = () => processImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (dataUrl: string) => {
    processImage(dataUrl);
  };

  const handlePhoneImage = (dataUrl: string) => {
    processImage(dataUrl);
  };

  const handleRetry = () => {
    setStatus('idle');
    setPreview(null);
    setErrorMsg('');
    setSubMode('choose');
  };

  const handleBackToChoose = () => {
    setSubMode('choose');
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
                  Scan a QR code with your phone, take a photo of the ID, and it&apos;s sent back here.
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
                  Select an existing photo of the ID from your device.
                </p>
              </div>
            </div>
          </button>

          {/* Option 3: Use PC camera */}
          <button
            onClick={() => setSubMode('camera')}
            className="w-full p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                <Camera className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-base">Use PC Camera</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Use this computer&apos;s camera to take a photo of the ID.
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
        <PhoneQrScanner onImageReceived={handlePhoneImage} />
      </div>
    );
  }

  // ── Camera mode ──
  if (subMode === 'camera' && status === 'idle') {
    return (
      <div className="space-y-3">
        <button
          onClick={handleBackToChoose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to options
        </button>
        <CameraViewfinder onCapture={handleCameraCapture} />
      </div>
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

// ── Main ID Scanner Component ──────────────────────────────────────

export default function IdScanner({ onScanComplete, onClose }: IdScannerProps) {
  const [mode, setMode] = useState<ScanMode>('choose');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [scannedData, setScannedData] = useState<ScannedIdData | null>(null);
  const [scannedImage, setScannedImage] = useState<string | undefined>();

  const handleBarcodeScan = useCallback((data: ScannedIdData) => {
    setScannedData(data);
    setStatus('success');
    toast.success('ID barcode scanned successfully!');
  }, []);

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
            {/* Option 1: Scan Barcode */}
            <button
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
            </button>

            {/* Option 2: Scan Front with AI */}
            <button
              onClick={() => setMode('vision')}
              className="w-full p-5 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer text-left"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-base">Scan Front of ID</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Take a photo of the front. AI extracts all fields automatically. Use if barcode is damaged.
                  </p>
                  <Badge variant="outline" className="mt-2 text-[10px]">AI Powered</Badge>
                </div>
              </div>
            </button>
          </CardContent>
        </Card>
      )}

      {/* Scanner Area */}
      {mode === 'barcode' && status === 'idle' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="w-5 h-5" /> Scan Barcode (Back of ID)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Hold the back of the ID so the barcode is visible in the camera.
            </p>
          </CardHeader>
          <CardContent>
            <BarcodeScanner onScanSuccess={handleBarcodeScan} />
          </CardContent>
        </Card>
      )}

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
            <VisionScanner onScanSuccess={handleVisionScan} />
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
                {mode === 'barcode' ? 'Barcode' : 'AI Vision'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
