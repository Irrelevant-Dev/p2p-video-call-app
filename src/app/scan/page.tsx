'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, ArrowLeft, Camera, AlertCircle } from 'lucide-react';

export default function QrScannerPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const html5QrCode = new Html5Qrcode('qr-reader');
    scannerRef.current = html5QrCode;

    html5QrCode
      .start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Success callback
          console.log('Decoded QR Code:', decodedText);
          try {
            // Extract QR ID from decoded URL or raw text
            let qrId = decodedText;
            if (decodedText.includes('/scan/')) {
              qrId = decodedText.split('/scan/')[1].split('/')[0].split('?')[0];
            }
            if (html5QrCode.isScanning) {
              html5QrCode.stop().then(() => {
                router.push(`/scan/${qrId}`);
              });
            } else {
              router.push(`/scan/${qrId}`);
            }
          } catch (err) {
            console.error('Failed to parse QR URL:', err);
          }
        },
        () => {
          // Ignore frame decode failures
        }
      )
      .then(() => setScanning(true))
      .catch((err) => {
        console.error('Failed to start scanner:', err);
        setError('Camera access denied or no camera device found. Please allow camera permissions.');
      });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch((e) => console.error('Error stopping scanner:', e));
      }
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center space-x-2 text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </Link>
        <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
          <QrCode className="w-5 h-5" />
          <span>QR Scanner</span>
        </div>
      </header>

      {/* Main Scanner Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Scan Host QR Code</h1>
        <p className="text-slate-400 text-sm mb-6 max-w-sm">
          Position the host's QR code within the camera frame below to view available recipients.
        </p>

        <div className="relative w-full max-w-sm aspect-square bg-slate-900 border-2 border-indigo-500/50 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center">
          <div id="qr-reader" className="w-full h-full"></div>
          {!scanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400">
              <Camera className="w-10 h-10 mb-2 animate-pulse text-indigo-400" />
              <span className="text-sm">Initializing camera...</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 max-w-sm p-4 bg-red-950/50 border border-red-800/50 rounded-xl text-red-300 text-sm flex items-start space-x-3 text-left">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </main>
    </div>
  );
}
