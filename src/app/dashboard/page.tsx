'use client';

import { useEffect, useState } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { Bell, BellRing, Video, ShieldCheck, QrCode, Loader2, PhoneCall, PhoneOff } from 'lucide-react';

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

  const [incomingCall, setIncomingCall] = useState<IncomingCallInfo | null>(null);

  const receiverId = user?.id || 'user_mock_receiver_123';

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) {
            setPushEnabled(true);
          }
        });
      });
    }

    // Connect socket for live in-app incoming call alerts
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

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
        <span className="text-slate-400 text-sm">Loading host session...</span>
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
              <span className="font-semibold text-indigo-300">{incomingCall.guestName}</span> is calling from a QR Station...
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

      {/* Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Video className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">Host Dashboard</span>
        </div>

        <div className="flex items-center space-x-4">
          <Link href="/scan" className="text-sm font-medium text-slate-400 hover:text-white transition">
            Test QR Scanner
          </Link>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 py-12">
        {/* Host Welcome Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-400 text-sm font-semibold mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Clerk Authenticated Host</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, {user?.firstName || user?.emailAddresses[0]?.emailAddress || 'Host'}!
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              You are ready to receive incoming QR video calls from visitors.
            </p>
          </div>
        </div>

        {/* Web Push Configuration Card */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex space-x-4">
              <div className={`p-3 rounded-xl ${pushEnabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50' : 'bg-indigo-950 text-indigo-400 border border-indigo-800/50'}`}>
                {pushEnabled ? <BellRing className="w-6 h-6" /> : <Bell className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Background Push Call Alerts</h3>
                <p className="text-slate-400 text-sm mt-1 max-w-md">
                  Receive background web push alerts with an instant join link whenever a caller scans a QR code and selects your profile.
                </p>
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
                  <span>Push Active</span>
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4" />
                  <span>Enable Push Alerts</span>
                </>
              )}
            </button>
          </div>

          {statusMessage && (
            <p className={`mt-4 text-xs font-medium ${pushEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
              {statusMessage}
            </p>
          )}
        </div>

        {/* Action Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/scan"
            className="p-6 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-2xl transition group"
          >
            <QrCode className="w-8 h-8 text-indigo-400 mb-3 group-hover:scale-110 transition" />
            <h4 className="font-bold text-white">Scan QR Code</h4>
            <p className="text-xs text-slate-400 mt-1">Open camera scanner to test the caller experience.</p>
          </Link>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl">
            <Video className="w-8 h-8 text-emerald-400 mb-3" />
            <h4 className="font-bold text-white">Call Readiness</h4>
            <p className="text-xs text-slate-400 mt-1">WebRTC peer-to-peer media stream engine active.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
