'use client';

import React from 'react';

interface TextInputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

export function TextInputField({
  label,
  error,
  helperText,
  className = '',
  id,
  ...props
}: TextInputFieldProps) {
  const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1 text-left">
      <label htmlFor={inputId} className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
        {label}
      </label>
      <input
        id={inputId}
        className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all ${
          error ? 'border-rose-500 ring-rose-200' : 'border-slate-300'
        } ${className}`}
        {...props}
      />
      {error && <span className="text-xs font-medium text-rose-600">{error}</span>}
      {!error && helperText && <span className="text-xs text-slate-500">{helperText}</span>}
    </div>
  );
}
