import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="p-4 border-b border-slate-800">
        <Link href="/" className="inline-flex items-center space-x-2 text-slate-400 hover:text-white text-sm transition">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <SignUp
          appearance={{
            elements: {
              card: 'bg-slate-900 border border-slate-800 text-white shadow-2xl',
              headerTitle: 'text-white font-bold',
              headerSubtitle: 'text-slate-400',
              socialButtonsBlockButton: 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700',
              formFieldLabel: 'text-slate-300',
              formFieldInput: 'bg-slate-800 border-slate-700 text-white focus:border-indigo-500',
              formButtonPrimary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold',
              footerActionText: 'text-slate-400',
              footerActionLink: 'text-indigo-400 hover:text-indigo-300 font-medium',
            },
          }}
        />
      </main>
    </div>
  );
}
