'use client';

import React, { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Store, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)!
  );

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess(false);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
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

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
        <div className="w-full max-w-md space-y-8">
          <div>
            <Link href="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-6 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Login
            </Link>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Forgot Password</h2>
            <p className="mt-2 text-sm text-slate-500">Enter your email address and we will send you a password reset link.</p>
          </div>

          {success ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="font-bold text-emerald-800">Check Your Email</h3>
              <p className="text-sm text-emerald-700">
                We have sent a password reset link to <strong>{email}</strong>. Please check your inbox.
              </p>
            </div>
          ) : (
            <form onSubmit={handleReset} className="mt-8 space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="admin@alshafiq.com"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Reset Link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
