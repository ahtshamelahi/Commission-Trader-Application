'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, HandCoins, Banknote, History, X, Loader2, AlertCircle } from 'lucide-react';
import { recordKhataPayment } from '@/lib/actions/khata-actions';
import { balanceLabel, balanceStatus } from '@/lib/khata/ledger-balance';
import {
  isBuyer,
  isSupplier,
  partyTypeLabel,
  type KhataParty,
} from '@/types/khata-types';

type Filter = 'all' | 'buyers' | 'suppliers';

const money = (n: number) =>
  `Rs. ${Math.abs(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

function nowLocalInput() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function BalanceCell({ balance }: { balance: number }) {
  const status = balanceStatus(balance);
  if (status === 'settled') return <span className="text-xs font-semibold text-slate-400">Settled</span>;
  const get = status === 'receivable';
  return (
    <div className="text-right leading-tight">
      <p className={`text-sm font-extrabold ${get ? 'text-emerald-700' : 'text-rose-600'}`}>{money(balance)}</p>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${get ? 'text-emerald-600' : 'text-rose-500'}`}>
        {get ? 'Receivable' : 'Payable'}
      </p>
    </div>
  );
}

export function KhataTable({
  parties,
  initialFilter = 'all',
}: {
  parties: KhataParty[];
  initialFilter?: Filter;
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [payParty, setPayParty] = useState<KhataParty | null>(null);
  const [payDirection, setPayDirection] = useState<'received' | 'paid'>('received');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parties.filter((p) => {
      if (filter === 'buyers' && !isBuyer(p.party_type)) return false;
      if (filter === 'suppliers' && !isSupplier(p.party_type)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.phone || '').includes(q);
    });
  }, [parties, search, filter]);

  const totalGet = parties.reduce((s, p) => s + (p.balance > 0 ? p.balance : 0), 0);
  const totalGive = parties.reduce((s, p) => s + (p.balance < 0 ? -p.balance : 0), 0);

  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: parties.length },
    { id: 'buyers', label: 'Buyers', count: parties.filter((p) => isBuyer(p.party_type)).length },
    { id: 'suppliers', label: 'Suppliers', count: parties.filter((p) => isSupplier(p.party_type)).length },
  ];

  const openPay = (p: KhataParty, direction: 'received' | 'paid') => {
    setPayDirection(direction);
    setPayParty(p);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white border border-emerald-200 rounded-lg px-3 py-2">
          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Receivable (you&apos;ll get)</p>
          <p className="text-lg font-extrabold text-emerald-700">{money(totalGet)}</p>
        </div>
        <div className="bg-white border border-rose-200 rounded-lg px-3 py-2">
          <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wide">Payable (you&apos;ll give)</p>
          <p className="text-lg font-extrabold text-rose-600">{money(totalGive)}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex border border-slate-200 rounded-lg p-0.5 bg-slate-100 gap-0.5 self-start">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1 rounded-md text-xs font-bold transition ${
                filter === t.id ? 'bg-blue-700 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label} <span className="opacity-70">({t.count})</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="text-left font-bold px-3 py-2">Name</th>
              <th className="text-left font-bold px-3 py-2">Phone</th>
              <th className="text-left font-bold px-3 py-2">Party type</th>
              <th className="text-right font-bold px-3 py-2">Outstanding</th>
              <th className="text-left font-bold px-3 py-2">Status</th>
              <th className="text-right font-bold px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-xs text-slate-400">
                  No parties found
                </td>
              </tr>
            )}
            {rows.map((p) => {
              return (
                <tr
                  key={p.party_id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => router.push(`/khata/party/${p.party_id}`)}
                >
                  <td className="px-3 py-1.5 font-bold text-slate-900 whitespace-nowrap">{p.name}</td>
                  <td className="px-3 py-1.5 text-xs text-slate-600 whitespace-nowrap">{p.phone || '—'}</td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.party_type === 'supplier'
                          ? 'bg-amber-50 text-amber-700'
                          : p.party_type === 'both'
                            ? 'bg-violet-50 text-violet-700'
                            : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {partyTypeLabel(p.party_type)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    <BalanceCell balance={p.balance} />
                  </td>
                  <td className="px-3 py-1.5 text-xs font-semibold text-slate-600">{balanceLabel(p.balance)}</td>
                  <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openPay(p, 'received')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                      >
                        <HandCoins className="w-3.5 h-3.5" /> Receive
                      </button>
                      <button
                        type="button"
                        onClick={() => openPay(p, 'paid')}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold text-white bg-blue-700 hover:bg-blue-800"
                      >
                        <Banknote className="w-3.5 h-3.5" /> Pay
                      </button>
                      <Link
                        href={`/khata/party/${p.party_id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-100"
                      >
                        <History className="w-3.5 h-3.5" /> History
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400">Click a row for the full statement. Receive / Pay records a manual entry (not an invoice payment).</p>

      {payParty && (
        <PaymentModal
          party={payParty}
          direction={payDirection}
          onClose={() => setPayParty(null)}
          onSaved={() => {
            setPayParty(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function PaymentModal({
  party,
  direction,
  onClose,
  onSaved,
}: {
  party: KhataParty;
  direction: 'received' | 'paid';
  onClose: () => void;
  onSaved: () => void;
}) {
  const receive = direction === 'received';
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(nowLocalInput());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [requestId] = useState(() => crypto.randomUUID());

  const amt = Number(amount) || 0;
  const after = receive ? party.balance - amt : party.balance + amt;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amt <= 0) {
      setError('Enter an amount greater than 0.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await recordKhataPayment({
      party_id: party.party_id,
      direction,
      amount: amt,
      paid_at: new Date(paidAt).toISOString(),
      notes,
      request_id: requestId,
    });
    setSaving(false);
    if (res.success) onSaved();
    else setError(res.message);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className={`flex items-center justify-between px-4 py-2.5 text-white ${receive ? 'bg-emerald-600' : 'bg-blue-700'}`}>
          <div>
            <p className="font-bold text-sm">{receive ? 'Money received' : 'Money paid'}</p>
            <p className="text-xs opacity-80">{party.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-0.5">
              Amount (PKR) <span className="text-rose-500">*</span>
            </label>
            <input
              autoFocus
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full px-2.5 py-2 text-base font-bold border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-0.5">Date</label>
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-0.5">Note (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cash / Bank transfer"
              className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {amt > 0 && (
            <div className="flex items-center justify-between text-xs border-t border-dashed border-slate-200 pt-2">
              <span className="text-slate-500">Balance after</span>
              <span
                className={`font-bold ${
                  Math.abs(after) < 0.005 ? 'text-slate-500' : after > 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                {Math.abs(after) < 0.005
                  ? 'Settled'
                  : `${money(after)} ${after > 0 ? 'receivable' : 'payable'}`}
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md font-medium">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || amt <= 0}
            className={`w-full flex items-center justify-center gap-2 text-white font-bold text-sm py-2 rounded-lg transition disabled:opacity-40 ${
              receive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : receive ? (
              'Save money received'
            ) : (
              'Save money paid'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
