'use client';

import React from 'react';

interface Option {
  value: string | number;
  label: string;
}

interface DropdownSelectFieldProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Option[];
  placeholder?: string;
  error?: string;
}

export function DropdownSelectField({
  label,
  options,
  placeholder = 'Select option...',
  error,
  className = '',
  id,
  ...props
}: DropdownSelectFieldProps) {
  const selectId = id || `select-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex flex-col gap-1 text-left">
      <label htmlFor={selectId} className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
        {label}
      </label>
      <select
        id={selectId}
        className={`w-full rounded-md border px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition-all ${
          error ? 'border-rose-500 ring-rose-200' : 'border-slate-300'
        } ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs font-medium text-rose-600">{error}</span>}
    </div>
  );
}
