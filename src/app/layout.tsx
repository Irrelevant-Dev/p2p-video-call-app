import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'QR Peer-to-Peer Video Call App',
  description: 'QR Code initiated direct P2P WebRTC video calls with Clerk authenticated hosts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="bg-slate-900 text-slate-100 min-h-screen antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
