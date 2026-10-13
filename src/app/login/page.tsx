'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { Store, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-emerald-950">
      {/* Animation styles */}
      <style>{`
        @keyframes truck-drive {
          from { transform: translateX(-260px); }
          to   { transform: translateX(calc(100vw + 60px)); }
        }
        @keyframes truck-bounce {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-1.5px); }
        }
        @keyframes road-move {
          from { background-position-x: 0; }
          to   { background-position-x: -96px; }
        }
        @keyframes wheel-spin {
          to { transform: rotate(360deg); }
        }
        .truck-drive  { animation: truck-drive 30s linear infinite; }
        .truck-bounce { animation: truck-bounce 0.65s ease-in-out infinite; }
        .road-lines   { animation: road-move 1900s linear infinite; }
        .wheel        { transform-box: fill-box; transform-origin: center; animation: wheel-spin 1.5s linear infinite; }
        @media (prefers-reduced-motion: reduce) {
          .truck-drive, .truck-bounce, .road-lines, .wheel { animation: none; }
          .truck-drive { transform: translateX(20vw); }
        }
      `}</style>

      {/* Background image */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <img src="/images/crop_background.png" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/70 via-emerald-900/45 to-emerald-950/85" />
      </div>

      {/* Content column: login (centered, slightly upward) + road at the bottom */}
      <div className="relative z-10 flex h-full flex-col">
        {/* Login area */}
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 pb-6 pt-4 sm:pb-10">
          <div className="w-full max-w-md -translate-y-6 rounded-3xl bg-white/90 p-6 shadow-2xl shadow-emerald-950/40 ring-1 ring-white/50 backdrop-blur-xl sm:p-8">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 shadow-lg shadow-emerald-900/30">
                <Store className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                M-Shafiq Commission Traders
              </h1>
              <p className="mt-1 text-sm text-slate-500">Sign in to your account to continue</p>
            </div>

            <form onSubmit={handleLogin} className="mt-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1 block text-sm font-bold text-slate-700">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="admin@alshafiq.com"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                      Password
                    </label>
                    <Link
                      href="/forgot-password"
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center rounded-lg border border-transparent bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
              </button>
            </form>
          </div>
        </main>

        {/* Road + truck */}
        <div className="relative h-28 w-full shrink-0 sm:h-32" aria-hidden="true">
          {/* Truck */}
          <div className="truck-drive absolute bottom-[34px] left-0 z-10 sm:bottom-[40px]">
            <div className="truck-bounce">
              <svg width="190" height="95" viewBox="0 0 200 100" className="h-[72px] w-auto sm:h-[90px]">
                {/* cargo box */}
                <rect x="0" y="8" width="124" height="62" rx="5" fill="#059669" />
                <rect x="0" y="8" width="124" height="8" rx="4" fill="#047857" />
                <text x="62" y="46" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ecfdf5" fontFamily="sans-serif">
                  M-SHAFIQ
                </text>
                {/* cab */}
                <path d="M128 70 V30 a6 6 0 0 1 6 -6 h28 q8 0 13 8 l14 20 a8 8 0 0 1 1.5 4.5 V70 Z" fill="#f8fafc" />
                <path d="M138 31 h22 q4 0 7 5 l9 13 H138 Z" fill="#7dd3fc" />
                <rect x="186" y="56" width="8" height="5" rx="1.5" fill="#fde047" />
                {/* chassis */}
                <rect x="0" y="68" width="196" height="7" rx="2" fill="#1e293b" />
                {/* wheels */}
                {[34, 92, 160].map((cx) => (
                  <g key={cx}>
                    <circle cx={cx} cy="78" r="14" fill="#0f172a" />
                    <g className="wheel">
                      <circle cx={cx} cy="78" r="7" fill="#94a3b8" />
                      <rect x={cx - 1} y="72" width="2" height="12" fill="#475569" />
                      <rect x={cx - 6} y="77" width="12" height="2" fill="#475569" />
                    </g>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Road surface */}
          <div className="absolute inset-x-0 bottom-0 h-[52px] border-t-4 border-slate-500 bg-slate-800 shadow-[0_-8px_24px_rgba(0,0,0,0.35)] sm:h-[60px]">
            {/* Moving dashed center line */}
            <div
              className="road-lines absolute inset-x-0 top-1/2 h-1 -translate-y-1/2"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(to right, #fde047 0, #fde047 48px, transparent 48px, transparent 96px)',
                backgroundSize: '96px 100%',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}