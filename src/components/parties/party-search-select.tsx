'use client';

import React, { useState, useRef, useEffect } from 'react';
import { User, Phone, X, ChevronDown } from 'lucide-react';
import { Party } from '@/types/party-data-types';

type RoleFilter = 'buyer' | 'supplier' | 'any';

interface PartySearchSelectProps {
  parties: Party[];
  value: number | null;
  onChange: (partyId: number | null) => void;
  roleFilter?: RoleFilter;
  placeholder?: string;
  required?: boolean;
  error?: string;
  disabled?: boolean;
}

function matchesRole(p: Party, role: RoleFilter): boolean {
  if (role === 'any') return true;
  if (role === 'buyer') return p.party_type === 'buyer' || p.party_type === 'both';
  return p.party_type === 'supplier' || p.party_type === 'both';
}

export function PartySearchSelect({
  parties,
  value,
  onChange,
  roleFilter = 'any',
  placeholder = 'Search party...',
  required,
  error,
  disabled,
}: PartySearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const eligible = parties.filter((p) => matchesRole(p, roleFilter));
  const selected = eligible.find((p) => p.id === value) || null;
  const filtered = eligible.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone || '').includes(search)
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left bg-white border rounded-lg transition ${error ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-300 hover:border-slate-400'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <User className="w-4 h-4 text-slate-400 shrink-0" />
        <span className={`flex-1 truncate ${selected ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
          {selected ? selected.name : placeholder}
          {required && !selected && <span className="text-rose-500 ml-0.5">*</span>}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setSearch('');
            }}
            className="p-0.5 hover:bg-slate-100 rounded"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 flex flex-col">
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type name or phone..."
            className="px-3 py-2 text-sm border-b border-slate-100 focus:outline-none"
          />
          <ul className="overflow-y-auto flex-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-xs text-slate-400 text-center">No parties found</li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setSearch('');
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 flex items-center gap-2 ${value === p.id ? 'bg-emerald-50 font-semibold' : ''}`}
                  >
                    <span className="truncate flex-1">{p.name}</span>
                    {p.phone && (
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5 shrink-0">
                        <Phone className="w-3 h-3" />{p.phone}
                      </span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export type { RoleFilter as PartySearchRoleFilter };
