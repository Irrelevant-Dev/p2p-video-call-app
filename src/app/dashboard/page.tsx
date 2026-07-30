'use client';

import { useEffect, useState } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import {
  Bell,
  BellRing,
  Video,
  ShieldCheck,
  QrCode,
  Loader2,
  PhoneCall,
  PhoneOff,
  Copy,
  Check,
  Maximize2,
  X,
  History,
  Clock,
  ExternalLink,
} from 'lucide-react';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface AssignedQrCode {
  id: string;
  label: string;
  createdAt: string;
}

interface CallRecord {
  id: string;
  guestName: string;
  status: string;
  createdAt: string;
}

interface IncomingCallInfo {
  callId: string;
  guestName: string;
}

export default function ReceiverDashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [qrCodes, setQrCodes] = useState<AssignedQrCode[]>([]);
  const [recentCalls, setRecentCalls] = useState<CallRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);
  const [copiedQrId, setCopiedQrId] = useState<string | null>(null);
  const [modalQrCode, setModalQrCode] = useState<AssignedQrCode | null>(null);

  const receiverId = user?.id || 'user_mock_receiver_123';

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const res = await fetch('/api/receivers/dashboard');
        if (res.ok) {
          const json = await res.json();
          setQrCodes(json.qrCodes || []);
          setRecentCalls(json.recentCalls || []);
        }
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setDataLoading(false);
      }
    }
    loadDashboardData();

    // Register service worker for push
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setPushEnabled(true);
          }
        });
      });
    }

    // Connect Socket for live incoming call alerts
    const socket = io();
    socket.emit('register-receiver', { receiverId });

    socket.on('incoming-call', (callData: IncomingCallInfo) => {
      console.log('Incoming live call event:', callData);
      setIncomingCall(callData);
    });

    return () => {
      socket.disconnect();
    };
  }, [receiverId]);

  async function enablePushNotifications() {
    setLoading(true);
    setStatusMessage(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Web Push notifications are not supported in this browser.');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission was denied.');
      }

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        throw new Error('VAPID public key is not configured.');
      }

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch('/api/receivers/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      });

      if (!res.ok) throw new Error('Failed to register subscription with server.');

      setPushEnabled(true);
      setStatusMessage('Web Push notifications enabled successfully!');
    } catch (err: any) {
      console.error('Push setup error:', err);
      setStatusMessage(err.message || 'Failed to enable Web Push notifications.');
    } finally {
      setLoading(false);
    }
  }

  function copyScanUrl(qrId: string) {
    const origin = window.location.origin;
    const url = `${origin}/scan/${qrId}`;
    navigator.clipboard.writeText(url);
    setCopiedQrId(qrId);
    setTimeout(() => setCopiedQrId(null), 2000);
  }

  function handleAcceptCall(callId: string) {
    setIncomingCall(null);
    router.push(`/call/${callId}?role=host`);
  }

  async function handleDeclineCall(callId: string) {
    setIncomingCall(null);
    try {
      await fetch(`/api/calls/${callId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'declined' }),
      });
    } catch (err) {
      console.error('Decline error:', err);
    }
  }

  if (!isLoaded || dataLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
        <span className="text-slate-400 text-sm">Loading host dashboard...</span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Incoming Call Ringing Modal Overlay */}
      {incomingCall && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-slate-900 border-2 border-indigo-500/60 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
            <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <div className="absolute inset-0 bg-indigo-600 rounded-full animate-ping opacity-75"></div>
              <div className="relative w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-xl">
                <PhoneCall className="w-8 h-8" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-1">Incoming Video Call</h2>
            <p className="text-slate-400 text-sm mb-8">
              <span className="font-semibold text-indigo-300">{incomingCall.guestName}</span> is calling from a QR station...
            </p>

            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => handleDeclineCall(incomingCall.callId)}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 transition"
              >
                <PhoneOff className="w-5 h-5" />
                <span>Decline</span>
              </button>

              <button
                onClick={() => handleAcceptCall(incomingCall.callId)}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 transition shadow-lg transform active:scale-95"
              >
                <PhoneCall className="w-5 h-5" />
                <span>Answer Call</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Projection Modal */}
      {modalQrCode && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center relative shadow-2xl">
            <button
              onClick={() => setModalQrCode(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-1">{modalQrCode.label}</h3>
            <p className="text-xs text-slate-400 mb-6">Scan with mobile camera to initiate a call to this host.</p>

            <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                  typeof window !== 'undefined' ? `${window.location.origin}/scan/${modalQrCode.id}` : ''
                )}`}
                alt={modalQrCode.label}
                width={220}
                height={220}
                className="mx-auto"
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => copyScanUrl(modalQrCode.id)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white font-medium text-sm rounded-xl flex items-center justify-center space-x-2 transition"
              >
                {copiedQrId === modalQrCode.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copiedQrId === modalQrCode.id ? 'Copied Link' : 'Copy Link'}</span>
              </button>

              <a
                href={`/scan/${modalQrCode.id}`}
                target="_blank"
                rel="noreferrer"
                className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl flex items-center space-x-2 transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Test Link</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Video className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Host Dashboard</span>
        </div>

        <div className="flex items-center space-x-4">
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 py-10 space-y-8">
        {/* Host Profile & Readiness Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-indigo-950 border border-indigo-700/50 rounded-full flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Active & Ready to Receive Calls</span>
              </div>
              <h1 className="text-2xl font-bold text-white">
                {user?.firstName ? `${user.firstName} ${user.lastName || ''}` : user?.emailAddresses[0]?.emailAddress || 'Front Desk Host'}
              </h1>
            </div>
          </div>

          <button
            onClick={enablePushNotifications}
            disabled={loading || pushEnabled}
            className={`px-5 py-2.5 font-semibold text-sm rounded-xl transition flex items-center space-x-2 ${
              pushEnabled
                ? 'bg-emerald-950 border border-emerald-800 text-emerald-300 cursor-default'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg'
            }`}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-white" />
            ) : pushEnabled ? (
              <>
                <BellRing className="w-4 h-4" />
                <span>Push Alerts Active</span>
              </>
            ) : (
              <>
                <Bell className="w-4 h-4" />
                <span>Enable Push Alerts</span>
              </>
            )}
          </button>
        </div>

        {/* Assigned QR Code Stations Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-indigo-400" />
                <span>My Station QR Codes</span>
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Project or print these QR codes for visitors to initiate calls directly to your profile.
              </p>
            </div>
          </div>

          {qrCodes.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-sm">
              No QR code stations currently assigned to your account.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {qrCodes.map((qr) => (
                <div
                  key={qr.id}
                  className="bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 flex items-center justify-between transition group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="bg-white p-2 rounded-xl shrink-0">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                          typeof window !== 'undefined' ? `${window.location.origin}/scan/${qr.id}` : ''
                        )}`}
                        alt={qr.label}
                        width={64}
                        height={64}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-white group-hover:text-indigo-300 transition">{qr.label}</h3>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {qr.id.slice(0, 8)}...</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setModalQrCode(qr)}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition"
                      title="Display / Project Full QR Code"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => copyScanUrl(qr.id)}
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition"
                      title="Copy QR Call Link"
                    >
                      {copiedQrId === qr.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>

                    <a
                      href={`/scan/${qr.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl transition"
                      title="Test Call Link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Call History Log Section */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <History className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Call History Log</h2>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            {recentCalls.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No recent calls recorded yet. Incoming calls will log here automatically.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {recentCalls.map((call) => (
                  <div key={call.id} className="p-4 flex items-center justify-between hover:bg-slate-800/40 transition">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-slate-800 rounded-xl text-slate-300">
                        <PhoneCall className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm">{call.guestName}</h4>
                        <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(call.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                        call.status === 'active'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : call.status === 'declined'
                          ? 'bg-red-950 text-red-400 border border-red-800/50'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {call.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
