'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  isLoading?: boolean;
  children: React.ReactNode;
}

export function PrimaryButton({
  variant = 'primary',
  isLoading = false,
  children,
  className = '',
  disabled,
  ...props
}: PrimaryButtonProps) {
  let baseStyle = 'inline-flex items-center justify-center font-medium rounded-md px-4 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

  if (variant === 'primary') {
    baseStyle += ' bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs';
  } else if (variant === 'secondary') {
    baseStyle += ' bg-slate-800 text-white hover:bg-slate-900';
  } else if (variant === 'outline') {
    baseStyle += ' border border-slate-300 bg-white text-slate-700 hover:bg-slate-50';
  } else if (variant === 'danger') {
    baseStyle += ' bg-rose-600 text-white hover:bg-rose-700';
  }

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyle} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Processing...
        </>
      ) : (
        children
      )}
    </button>
  );
}
