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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  };

  return (
    <div className="relative min-h-[100dvh] flex bg-slate-50">
      {/* MOBILE BACKGROUND - crop image behind the whole page (hidden on desktop) */}
      <div className="lg:hidden fixed inset-0 z-0" aria-hidden="true">
        <img
          src="/images/crop_background.png"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/70 via-emerald-900/45 to-emerald-950/85" />
      </div>

      {/* LEFT SIDE - Brand & Image (desktop only, unchanged) */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative flex-col justify-center items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/images/crop_background.png"
            alt="Agricultural crops"
            className="w-full h-full object-cover opacity-60"
          />
        </div>
        <div className="relative z-10 flex flex-col items-center justify-center p-12 text-center text-white backdrop-blur-sm bg-black/30 w-full h-full">
          <div className="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-xl">
            <Store className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">Al-Shafiq Commission Shop</h1>
          <p className="text-lg text-slate-200 max-w-md">
            Professional crop trading, inventory management, and financial reporting system.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE - Login Form */}
      <div className="relative z-10 w-full lg:w-1/2 flex flex-col items-center justify-center gap-7 lg:gap-0 px-5 py-10 sm:p-12">
        {/* Mobile brand, sits on top of the crop image */}
        <div className="lg:hidden text-center text-white">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-950/40 ring-4 ring-white/20">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight drop-shadow">Al-Shafiq Commission Shop</h1>
        </div>

        {/* Card on mobile (frosted glass), plain on desktop */}
        <div className="w-full max-w-md space-y-8 rounded-3xl bg-white/90 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-emerald-950/40 ring-1 ring-white/50 lg:bg-transparent lg:backdrop-blur-none lg:shadow-none lg:ring-0 lg:rounded-none lg:p-0">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h2>
            <p className="mt-2 text-sm text-slate-500">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-6">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="admin@alshafiq.com"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-bold text-slate-700 block">Password</label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">
                    Forgot Password?
                  </Link>
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}