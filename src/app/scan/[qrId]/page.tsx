'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, User, PhoneCall, Loader2, QrCode } from 'lucide-react';

interface Receiver {
  clerkUserId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface QrData {
  qrCode: { id: string; label: string };
  receivers: Receiver[];
}

export default function QrReceiverSelectionPage() {
  const params = useParams();
  const router = useRouter();
  const qrId = params.qrId as string;

  const [data, setData] = useState<QrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [guestName, setGuestName] = useState('Guest Caller');
  const [callingUserId, setCallingUserId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchReceivers() {
      try {
        const res = await fetch(`/api/qr/${qrId}/receivers`);
        if (!res.ok) {
          throw new Error('Invalid or expired QR code');
        }
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message || 'Failed to load QR code data');
      } finally {
        setLoading(false);
      }
    }
    if (qrId) fetchReceivers();
  }, [qrId]);

  async function handleInitiateCall(targetReceiverId: string) {
    setCallingUserId(targetReceiverId);
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCodeId: qrId,
          targetReceiverId,
          guestName: guestName.trim() || 'Guest Caller',
        }),
      });

      if (!res.ok) throw new Error('Failed to initiate call');
      const { callId } = await res.json();

      // Navigate guest directly to call room
      router.push(`/call/${callId}?role=guest`);
    } catch (err: any) {
      alert(err.message || 'Call placement failed');
      setCallingUserId(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
        <span className="text-slate-400 text-sm">Loading host options...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <QrCode className="w-12 h-12 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">QR Code Not Found</h1>
        <p className="text-slate-400 text-sm max-w-sm mb-6">{error || 'Unable to resolve QR code details.'}</p>
        <Link href="/scan" className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl">
          Scan Another QR Code
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="p-4 border-b border-slate-800 flex items-center justify-between">
        <Link href="/scan" className="flex items-center space-x-2 text-slate-400 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" />
          <span>Rescan</span>
        </Link>
        <span className="text-indigo-400 text-sm font-semibold">{data.qrCode.label}</span>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-md w-full mx-auto p-6 flex flex-col justify-center">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Select Recipient</h1>
          <p className="text-slate-400 text-sm">Choose who you would like to call from this QR station.</p>
        </div>

        {/* Optional Guest Name Input */}
        <div className="mb-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Your Name (Optional)
          </label>
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Guest Caller"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Receiver List */}
        <div className="space-y-3">
          {data.receivers.length === 0 ? (
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400 text-sm">
              No hosts currently assigned to this QR code.
            </div>
          ) : (
            data.receivers.map((receiver) => (
              <div
                key={receiver.clerkUserId}
                className="bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 flex items-center justify-between transition group"
              >
                <div className="flex items-center space-x-3">
                  {receiver.avatarUrl ? (
                    <Image
                      src={receiver.avatarUrl}
                      alt={receiver.displayName}
                      width={44}
                      height={44}
                      className="rounded-full border border-slate-700 object-cover"
                    />
                  ) : (
                    <div className="w-11 h-11 bg-indigo-950 border border-indigo-800 rounded-full flex items-center justify-center text-indigo-300 font-bold">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-white group-hover:text-indigo-300 transition">
                      {receiver.displayName}
                    </h3>
                    <span className="text-xs text-slate-500">Host / Agent</span>
                  </div>
                </div>

                <button
                  onClick={() => handleInitiateCall(receiver.clerkUserId)}
                  disabled={callingUserId !== null}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-medium text-sm rounded-lg shadow transition transform active:scale-95"
                >
                  {callingUserId === receiver.clerkUserId ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <>
                      <PhoneCall className="w-4 h-4" />
                      <span>Call</span>
                    </>
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
