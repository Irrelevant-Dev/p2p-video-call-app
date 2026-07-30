import Link from 'next/link';
import { UserButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { QrCode, Video, ShieldCheck, UserCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Header Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg text-white">
            <Video className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">QR Connect P2P</span>
        </div>
        <div className="flex items-center space-x-4">
          <SignedIn>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition"
            >
              Receiver Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition"
            >
              Receiver Sign In
            </Link>
          </SignedOut>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-16 flex flex-col items-center justify-center text-center">
        <div className="p-4 bg-indigo-950/60 border border-indigo-800/50 rounded-2xl mb-8 inline-flex items-center space-x-2 text-indigo-300 text-sm">
          <QrCode className="w-4 h-4 text-indigo-400" />
          <span>Zero-Install Instant QR Video Calling</span>
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Scan & Connect Direct <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
            Peer-to-Peer Video
          </span>
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Initiate direct browser-to-browser video calls instantly by scanning a QR code. Guests require no registration; authenticated hosts receive background push notifications.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full justify-center max-w-md">
          <Link
            href="/scan"
            className="flex items-center justify-center space-x-2 px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg transition transform hover:-translate-y-0.5"
          >
            <QrCode className="w-5 h-5" />
            <span>Scan QR Code</span>
          </Link>
          <SignedIn>
            <Link
              href="/dashboard"
              className="flex items-center justify-center space-x-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold rounded-xl transition"
            >
              <UserCheck className="w-5 h-5 text-indigo-400" />
              <span>Host Dashboard</span>
            </Link>
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="flex items-center justify-center space-x-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold rounded-xl transition"
            >
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              <span>Host Sign In</span>
            </Link>
          </SignedOut>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-6 text-center text-sm text-slate-500">
        QR Peer-to-Peer Video Calling Engine • Hosted on Railway with Clerk Authentication
      </footer>
    </div>
  );
}
