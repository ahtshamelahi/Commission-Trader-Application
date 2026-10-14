'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, Banknote, HandCoins, Loader2, Printer, X } from 'lucide-react';
import { correctKhataPayment, recordKhataPayment } from '@/lib/actions/khata-actions';
import { balanceStatus } from '@/lib/khata/ledger-balance';
import { partyTypeLabel, type KhataParty, type LedgerEntry } from '@/types/khata-types';

const money = (n: number) =>
  `Rs. ${Math.abs(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;

const TYPE_LABEL: Record<string, string> = {
  sale: 'Sale',
  purchase: 'Purchase',
  payment_in: 'Received',
  payment_out: 'Paid',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-PK', {
    timeZone: 'Asia/Karachi',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function nowLocalInput() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function KhataPartyStatement({
  party,
  entries,
  openingBalance,
  closingBalance,
  from,
  to,
}: {
  party: KhataParty;
  entries: LedgerEntry[];
  openingBalance: number;
  closingBalance: number;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState<'received' | 'paid'>('received');
  const [amount, setAmount] = useState('');
  const [paidAt, setPaidAt] = useState(nowLocalInput());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editRow, setEditRow] = useState<LedgerEntry | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        (e.reference || '').toLowerCase().includes(q) ||
        (TYPE_LABEL[e.entry_type] || e.entry_type).toLowerCase().includes(q)
    );
  }, [entries, search]);

  const applyDates = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const qs = params.toString();
    router.push(`/khata/party/${party.party_id}${qs ? `?${qs}` : ''}`);
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
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
      request_id: crypto.randomUUID(),
    });
    setSaving(false);
    if (!res.success) {
      setError(res.message);
      return;
    }
    setAmount('');
    setNotes('');
    router.refresh();
  };

  const status = balanceStatus(party.balance);

  return (
    <div className="space-y-3">
      <div className="print:hidden flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{party.name}</h1>
          <p className="text-xs text-slate-500">
            {partyTypeLabel(party.party_type)}
            {party.phone ? ` · ${party.phone}` : ''}
            {party.address ? ` · ${party.address}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50"
        >
          <Printer className="w-3.5 h-3.5" /> Print statement
        </button>
      </div>

      <div className="hidden print:block mb-3">
        <p className="text-lg font-extrabold">M-Shafiq Commission Shop</p>
        <p className="text-sm font-bold">{party.name} — Khata statement</p>
        <p className="text-xs text-slate-600">
          {partyTypeLabel(party.party_type)}
          {party.phone ? ` · ${party.phone}` : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Opening</p>
          <p className="text-sm font-extrabold">{money(openingBalance)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Closing</p>
          <p className="text-sm font-extrabold">{money(closingBalance)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 col-span-2 sm:col-span-1">
          <p className="text-[10px] font-bold text-slate-500 uppercase">Current outstanding</p>
          <p
            className={`text-sm font-extrabold ${
              status === 'settled' ? 'text-slate-500' : status === 'receivable' ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {status === 'settled' ? 'Settled' : `${money(party.balance)} · ${status}`}
          </p>
        </div>
      </div>

      <div className="print:hidden bg-white border border-slate-200 rounded-lg p-3 space-y-2">
        <p className="text-[10px] font-bold text-slate-500 uppercase">Manual entry</p>
        <form onSubmit={submitManual} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Type</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'received' | 'paid')}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
            >
              <option value="received">Money received</option>
              <option value="paid">Money paid</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Date</label>
            <input
              type="datetime-local"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Note</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Short note"
              className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold text-white disabled:opacity-50 ${
              direction === 'received' ? 'bg-emerald-600' : 'bg-blue-700'
            }`}
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : direction === 'received' ? <HandCoins className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
            Save
          </button>
        </form>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>

      <div className="print:hidden flex flex-col sm:flex-row gap-2 sm:items-end">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-md"
          />
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">To</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-2 py-1.5 text-sm border border-slate-300 rounded-md"
          />
        </div>
        <button
          type="button"
          onClick={applyDates}
          className="px-3 py-1.5 text-xs font-bold rounded-md bg-slate-800 text-white"
        >
          Apply dates
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search description or reference..."
          className="flex-1 px-2.5 py-1.5 text-sm border border-slate-300 rounded-md"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full min-w-[700px] text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left font-bold px-3 py-2">Date</th>
              <th className="text-left font-bold px-3 py-2">Ref</th>
              <th className="text-left font-bold px-3 py-2">Description</th>
              <th className="text-right font-bold px-3 py-2">Debit</th>
              <th className="text-right font-bold px-3 py-2">Credit</th>
              <th className="text-right font-bold px-3 py-2">Balance</th>
              <th className="text-right font-bold px-3 py-2 print:hidden"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Math.abs(openingBalance) >= 0.005 && (from || to) && (
              <tr className="bg-slate-50">
                <td className="px-3 py-1.5 text-slate-500" colSpan={5}>
                  Opening balance
                </td>
                <td className="px-3 py-1.5 text-right font-bold">{money(openingBalance)}</td>
                <td className="print:hidden" />
              </tr>
            )}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                  No transactions in this range
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.key} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500">{e.reference || '—'}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      {e.entry_type === 'payment_in' ? (
                        <ArrowDownLeft className="w-3 h-3 text-emerald-600 shrink-0" />
                      ) : e.entry_type === 'payment_out' ? (
                        <ArrowUpRight className="w-3 h-3 text-blue-600 shrink-0" />
                      ) : null}
                      <span className="font-semibold text-slate-800">{TYPE_LABEL[e.entry_type] || e.entry_type}</span>
                    </div>
                    {e.description && <p className="text-[11px] text-slate-500">{e.description}</p>}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-emerald-700">
                    {e.debit > 0 ? e.debit.toLocaleString('en-PK') : ''}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-rose-600">
                    {e.credit > 0 ? e.credit.toLocaleString('en-PK') : ''}
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold whitespace-nowrap">
                    <span className={Math.abs(e.balance) < 0.005 ? 'text-slate-400' : e.balance > 0 ? 'text-emerald-700' : 'text-rose-600'}>
                      {Math.abs(e.balance).toLocaleString('en-PK')}
                      {Math.abs(e.balance) >= 0.005 && (
                        <span className="text-[9px] ml-0.5 opacity-70">{e.balance > 0 ? 'Get' : 'Give'}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right print:hidden">
                    {e.editable && (
                      <button
                        type="button"
                        onClick={() => setEditRow(e)}
                        className="text-[10px] font-semibold text-blue-700 hover:underline"
                      >
                        Correct
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-slate-400 print:hidden">
        Debit increases what the party owes you. Credit is money received or an amount you owe.
        Sale/purchase payments already on the invoice are not entered again as manual payments.
      </p>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          main, main * { visibility: visible; }
          main { position: static !important; padding: 0 !important; max-width: none !important; }
        }
      `}</style>

      {editRow && (
        <CorrectModal
          entry={editRow}
          onClose={() => setEditRow(null)}
          onDone={() => {
            setEditRow(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CorrectModal({
  entry,
  onClose,
  onDone,
}: {
  entry: LedgerEntry;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(String(entry.debit || entry.credit));
  const [notes, setNotes] = useState(entry.description);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!entry.khata_payment_id) return null;

  const save = async () => {
    setSaving(true);
    setError('');
    const res = await correctKhataPayment({
      payment_id: entry.khata_payment_id!,
      amount: Number(amount),
      notes,
    });
    setSaving(false);
    if (!res.success) setError(res.message);
    else onDone();
  };

  const voidEntry = async () => {
    setSaving(true);
    setError('');
    const res = await correctKhataPayment({ payment_id: entry.khata_payment_id!, void: true });
    setSaving(false);
    if (!res.success) setError(res.message);
    else onDone();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white">
          <p className="font-bold text-sm">Correct manual entry</p>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-2">
          <label className="text-[10px] font-semibold text-slate-500 block">Amount</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md"
          />
          <label className="text-[10px] font-semibold text-slate-500 block">Note</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-md"
          />
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 bg-blue-700 text-white text-xs font-bold py-2 rounded-md disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save correction'}
            </button>
            <button
              type="button"
              onClick={voidEntry}
              disabled={saving}
              className="px-3 text-xs font-bold py-2 rounded-md border border-rose-200 text-rose-700"
            >
              Void
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
