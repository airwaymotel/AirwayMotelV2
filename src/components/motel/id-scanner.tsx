'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, ScanLine, Upload, Loader2, CheckCircle, AlertCircle,
  X, RotateCcw, Image, SwitchCamera,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

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

type ScanMode = 'barcode' | 'vision';
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

    // Parse AAMVA subfiles
    const lines = rawText.split(/\r?\n/);

    // Extract issuer ID (first 2 chars after ANSI/AAMVA)
    const headerMatch = rawText.match(/ANSI(\d{6})/);
    if (headerMatch) {
      const issuerId = headerMatch[1].substring(0, 2);
      // Map common issuer IDs to state codes
      const stateMap: Record<string, string> = {
        '08': 'CO', '06': 'CA', '12': 'FL', '17': 'IL',
        '36': 'NY', '42': 'PA', '48': 'TX', '26': 'MI',
        '39': 'OH', '13': 'GA', '27': 'MN', '25': 'MA',
        '34': 'NJ', '04': 'AR', '29': 'MO', '32': 'NV',
        '01': 'AL', '02': 'AK', '05': 'AZ', '09': 'CT',
        '10': 'DE', '11': 'DC', '15': 'HI', '16': 'ID',
        '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
        '22': 'LA', '23': 'ME', '24': 'MD', '28': 'MS',
        '30': 'MT', '31': 'NE', '33': 'NH', '35': 'NM',
        '37': 'NC', '38': 'ND', '40': 'OK', '41': 'OR',
        '44': 'RI', '45': 'SC', '46': 'SD', '47': 'TN',
        '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
        '54': 'WV', '55': 'WI', '56': 'WY',
      };
      result.issuingState = stateMap[issuerId] || issuerId;
    }

    // Parse each line for AAMVA elements
    for (const line of lines) {
      // DAA - Full Name (Last, First Middle)
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

      // DAC - First Name
      const dacMatch = line.match(/^DAC(.+)/);
      if (dacMatch) result.firstName = dacMatch[1].trim();

      // DAD - Middle Name
      const dadMatch = line.match(/^DAD(.+)/);
      if (dadMatch) result.middleName = dadMatch[1].trim();

      // DCB - Last Name
      const dcbMatch = line.match(/^DCB(.+)/);
      if (dcbMatch) result.lastName = dcbMatch[1].trim();

      // DCS - Last Name
      const dcsMatch = line.match(/^DCS(.+)/);
      if (dcsMatch) result.lastName = dcsMatch[1].trim();

      // DBB - Date of Birth (YYYYMMDD or MMDDYYYY)
      const dbbMatch = line.match(/^DBB(.+)/);
      if (dbbMatch) {
        const dobRaw = dbbMatch[1].trim();
        if (dobRaw.length === 8) {
          // Could be YYYYMMDD or MMDDYYYY
          if (dobRaw.startsWith('19') || dobRaw.startsWith('20')) {
            result.dateOfBirth = `${dobRaw.slice(0,4)}-${dobRaw.slice(4,6)}-${dobRaw.slice(6,8)}`;
          } else {
            // MMDDYYYY
            result.dateOfBirth = `${dobRaw.slice(4,8)}-${dobRaw.slice(0,2)}-${dobRaw.slice(2,4)}`;
          }
        }
      }

      // DBC - Gender
      const dbcMatch = line.match(/^DBC(.+)/);
      if (dbcMatch) {
        const g = dbcMatch[1].trim().toUpperCase();
        result.gender = g === '1' || g === 'M' ? 'Male' : g === '2' || g === 'F' ? 'Female' : g;
      }

      // DAG - Street Address
      const dagMatch = line.match(/^DAG(.+)/);
      if (dagMatch) result.address.street = dagMatch[1].trim();

      // DAI - City
      const daiMatch = line.match(/^DAI(.+)/);
      if (daiMatch) result.address.city = daiMatch[1].trim();

      // DAJ - State
      const dajMatch = line.match(/^DAJ(.+)/);
      if (dajMatch) result.address.state = dajMatch[1].trim();

      // DAK - ZIP + Country
      const dakMatch = line.match(/^DAK(.+)/);
      if (dakMatch) {
        const zipRaw = dakMatch[1].trim();
        result.address.zipCode = zipRaw.substring(0, 5);
      }

      // DAQ - ID Number
      const daqMatch = line.match(/^DAQ(.+)/);
      if (daqMatch) result.idNumber = daqMatch[1].trim();

      // DBA - Expiration Date
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

      // DBD - Issue Date
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

      // DAY - Eye Color
      const dayMatch = line.match(/^DAY(.+)/);
      if (dayMatch) {
        const eyeMap: Record<string, string> = {
          'BLK': 'Black', 'BLU': 'Blue', 'BRO': 'Brown', 'GRY': 'Gray',
          'GRN': 'Green', 'HAZ': 'Hazel', 'MAR': 'Maroon', 'DIC': 'Dichromatic',
        };
        result.eyeColor = eyeMap[dayMatch[1].trim().toUpperCase()] || dayMatch[1].trim();
      }

      // DAZ - Hair Color
      const dazMatch = line.match(/^DAZ(.+)/);
      if (dazMatch) {
        const hairMap: Record<string, string> = {
          'BAL': 'Bald', 'BLK': 'Black', 'BLN': 'Blond', 'BRO': 'Brown',
          'GRY': 'Gray', 'RED': 'Red/Auburn', 'SDY': 'Sandy', 'WHI': 'White',
        };
        result.hairColor = hairMap[dazMatch[1].trim().toUpperCase()] || dazMatch[1].trim();
      }

      // DAU - Height
      const dauMatch = line.match(/^DAU(.+)/);
      if (dauMatch) result.height = dauMatch[1].trim();

      // DAW - Weight
      const dawMatch = line.match(/^DAW(.+)/);
      if (dawMatch) result.weight = dawMatch[1].trim();

      // DCF - Document Discriminator
      // DCK - Inventory Control Number

      // Check for ID type
      if (line.includes('ID') || line.includes('IDENTIFICATION')) {
        result.idType = 'State ID';
      }
    }

    // Build full name if not set from DAA
    if (!result.fullName) {
      result.fullName = `${result.firstName} ${result.middleName} ${result.lastName}`.replace(/\s+/g, ' ').trim();
    }

    // Set issuing state from address state if not found
    if (!result.issuingState && result.address.state) {
      result.issuingState = result.address.state;
    }

    // Check if we got enough data
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
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let scanner: any = null;
    let mounted = true;

    const startScanner = async () => {
      if (!scannerRef.current) return;

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode('id-barcode-scanner');
        html5QrRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 280, height: 200 },
            formatsToSupport: [
              // @ts-expect-error - PDF417 format constant
              0, // QR_CODE
              // The library auto-detects PDF417
            ],
          },
          (decodedText: string) => {
            // Try to parse as AAMVA
            const parsed = parseAAMVA(decodedText);
            if (parsed) {
              scanner.stop().catch(() => {});
              onScanSuccess(parsed);
            } else {
              // Even if not AAMVA, the barcode might contain useful data
              // Try to use it as an ID number
              if (decodedText.length > 3) {
                const partial: ScannedIdData = {
                  firstName: '',
                  middleName: '',
                  lastName: '',
                  fullName: '',
                  dateOfBirth: '',
                  gender: '',
                  address: { street: '', city: '', state: '', zipCode: '' },
                  idNumber: decodedText,
                  idType: 'State ID',
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
                scanner.stop().catch(() => {});
                onScanSuccess(partial);
              }
            }
          },
          () => {
            // Scan failure - ignore, keep scanning
          }
        );

        if (mounted) setStatus('scanning');
      } catch (err: any) {
        console.error('Scanner error:', err);
        if (mounted) {
          setStatus('error');
          setErrorMsg(err?.message || 'Failed to start camera. Please check permissions.');
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scanner) {
        scanner.stop().catch(() => {});
        scanner.clear().catch(() => {});
      }
    };
  }, [onScanSuccess]);

  const handleRetry = async () => {
    setStatus('starting');
    setErrorMsg('');
    if (html5QrRef.current) {
      try {
        await html5QrRef.current.stop();
        html5QrRef.current.clear();
      } catch {}
    }
    // The useEffect will restart
  };

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

      <p className="text-xs text-muted-foreground text-center">
        Position the <strong>PDF417 barcode</strong> on the back of the ID within the frame
      </p>
    </div>
  );
}

// ── Vision Scanner Component ───────────────────────────────────────

function VisionScanner({ onScanSuccess }: { onScanSuccess: (data: ScannedIdData, imageBase64: string) => void }) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    setStatus('processing');
    setErrorMsg('');

    try {
      // Convert to base64
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setPreview(dataUrl);

      // Send to AI Vision API
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
    if (file) processImage(file);
  };

  const handleRetry = () => {
    setStatus('idle');
    setPreview(null);
    setErrorMsg('');
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {status === 'idle' && !preview && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center gap-2"
            >
              <Camera className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium">Take Photo</span>
              <span className="text-xs text-muted-foreground">Use camera</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm font-medium">Upload</span>
              <span className="text-xs text-muted-foreground">From gallery</span>
            </button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Take a clear photo of the <strong>front of the ID</strong>
          </p>
        </div>
      )}

      {status === 'processing' && preview && (
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
      )}

      {status === 'error' && (
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
      )}
    </div>
  );
}

// ── Main ID Scanner Component ──────────────────────────────────────

export default function IdScanner({ onScanComplete, onClose }: IdScannerProps) {
  const [mode, setMode] = useState<ScanMode>('barcode');
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
  };

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      {status === 'idle' && (
        <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
          <button
            onClick={() => setMode('barcode')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              mode === 'barcode'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ScanLine className="w-4 h-4" />
            Scan Barcode
          </button>
          <button
            onClick={() => setMode('vision')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
              mode === 'vision'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Image className="w-4 h-4" />
            Scan Front
          </button>
        </div>
      )}

      {/* Scanner Area */}
      {status === 'idle' && mode === 'barcode' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScanLine className="w-5 h-5" /> Scan Barcode (Back of ID)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Scan the PDF417 barcode on the back of the ID for instant, 100% accurate data extraction.
            </p>
          </CardHeader>
          <CardContent>
            <BarcodeScanner onScanSuccess={handleBarcodeScan} />
          </CardContent>
        </Card>
      )}

      {status === 'idle' && mode === 'vision' && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Image className="w-5 h-5" /> Scan Front of ID
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Take a photo of the front of the ID. AI will extract all the information automatically.
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
            {/* Name */}
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Full Name</p>
              <p className="text-sm font-medium">{scannedData.fullName || `${scannedData.firstName} ${scannedData.middleName} ${scannedData.lastName}`.trim()}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* ID Number */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">ID Number</p>
                <p className="text-sm font-medium font-mono">{scannedData.idNumber}</p>
              </div>
              {/* Date of Birth */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Date of Birth</p>
                <p className="text-sm font-medium">{scannedData.dateOfBirth}</p>
              </div>
              {/* Gender */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">Gender</p>
                <p className="text-sm font-medium">{scannedData.gender}</p>
              </div>
              {/* ID Type & State */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mb-1">ID Type</p>
                <p className="text-sm font-medium">{scannedData.idType}{scannedData.issuingState ? ` — ${scannedData.issuingState}` : ''}</p>
              </div>
            </div>

            {/* Address */}
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

            {/* Physical Details */}
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

            {/* Dates */}
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

            {/* Badges */}
            {(scannedData.veteran || scannedData.organDonor || scannedData.realId) && (
              <div className="flex gap-2 flex-wrap">
                {scannedData.veteran && <Badge variant="secondary" className="text-[10px]">Veteran</Badge>}
                {scannedData.organDonor && <Badge variant="secondary" className="text-[10px]">Organ Donor</Badge>}
                {scannedData.realId && <Badge variant="secondary" className="text-[10px]">REAL ID</Badge>}
              </div>
            )}

            <Separator />

            {/* Actions */}
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
