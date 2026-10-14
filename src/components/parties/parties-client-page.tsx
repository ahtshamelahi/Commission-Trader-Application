'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { saveParty } from '@/lib/actions/party-actions';
import { PartyType, Party } from '@/types/party-data-types';
import type { PartyTradeTotals } from '@/app/(dashboard)/parties/page';
import { Phone, Plus, Pencil, BookOpen, Users, Truck, X } from 'lucide-react';

interface PartiesClientPageProps {
  initialParties: Party[];
  tradeTotals: PartyTradeTotals;
  isLoading?: boolean;
}

const PARTY_TYPES: { value: PartyType; label: string; desc: string; color: string }[] = [
  { value: 'supplier', label: 'Supplier', desc: 'Farmer / Producer', color: 'blue' },
  { value: 'buyer', label: 'Buyer', desc: 'Trader / Mill', color: 'emerald' },
  { value: 'both', label: 'Both', desc: 'Supplier & Buyer', color: 'purple' },
];

function PartyTypeBadge({ type }: { type: PartyType }) {
  const styles: Record<PartyType, string> = {
    supplier: 'bg-blue-50 text-blue-700 border-blue-200',
    buyer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    both: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase ${styles[type]}`}>
      {type}
    </span>
  );
}

export function PartiesClientPage({ initialParties, tradeTotals, isLoading = false }: PartiesClientPageProps) {
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [partyType, setPartyType] = useState<PartyType>('supplier');
  const [partySubmitting, setPartySubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null); // error shown inside the popup
  const [successMsg, setSuccessMsg] = useState<string | null>(null); // success shown on the page
  const [filterType, setFilterType] = useState<PartyType | 'all'>('all');
  const [partySearch, setPartySearch] = useState('');

  useEffect(() => setParties(initialParties), [initialParties]);

  // auto-hide the success message after 4 seconds
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(null), 4000);
    return () => clearTimeout(t);
  }, [successMsg]);

  // close popup with Escape key
  useEffect(() => {
    if (!isModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPhone('');
    setAddress('');
    setPartyType('supplier');
    setModalError(null);
  };

  const openNewModal = () => {
    resetForm();
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const startEdit = (p: Party) => {
    setEditingId(p.id);
    setName(p.name);
    setPhone(p.phone || '');
    setAddress(p.address || '');
    setPartyType(p.party_type);
    setModalError(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  // stats: parties of type "both" are counted in both cards
  const totalBuyers = parties.filter((p) => p.party_type === 'buyer' || p.party_type === 'both').length;
  const totalSuppliers = parties.filter((p) => p.party_type === 'supplier' || p.party_type === 'both').length;

  const filteredParties = parties.filter((p) => {
    const matchesType = filterType === 'all' || p.party_type === filterType;
    const q = partySearch.toLowerCase();
    return matchesType && (p.name.toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q));
  });

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartySubmitting(true);
    setModalError(null);
    const res = await saveParty({
      id: editingId ?? undefined,
      name,
      phone,
      address,
      party_type: partyType,
    });
    setPartySubmitting(false);
    if (res.success) {
      const saved = res.data as Party;
      setSuccessMsg(editingId ? 'Party updated.' : `"${name}" registered.`);
      if (editingId) {
        setParties((prev) => prev.map((p) => (p.id === editingId ? saved : p)));
      } else {
        setParties((prev) => [saved, ...prev]);
      }
      closeModal();
    } else {
      setModalError(res.message || 'Failed.');
    }
  };

  return (
    <div className="mt-4 space-y-5">
      {/* TOP ROW: stats cards + Register New Party button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="grid grid-cols-2 gap-3 sm:w-auto">
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[150px]">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Buyers</p>
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{totalBuyers}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[150px]">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Suppliers</p>
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{totalSuppliers}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openNewModal}
          className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-5 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Register New Party
        </button>
      </div>

      {/* SUCCESS MESSAGE (after the popup closes) */}
      {successMsg && (
        <div className="p-3 rounded-lg text-sm bg-emerald-50 text-emerald-800 border border-emerald-100">
          {successMsg}
        </div>
      )}

      {/* SEARCH + FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search..."
          value={partySearch}
          onChange={(e) => setPartySearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
        {(['all', 'supplier', 'buyer', 'both'] as const).map((ft) => (
          <button
            key={ft}
            type="button"
            onClick={() => setFilterType(ft)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize ${filterType === ft ? 'bg-slate-800 text-white' : 'bg-white border border-slate-300'}`}
          >
            {ft}
          </button>
        ))}
      </div>

      {/* PARTY LIST (full width) */}
      {isLoading ? (
        <div className="h-32 bg-white border rounded-xl animate-pulse" />
      ) : filteredParties.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-10 bg-white border rounded-xl">No parties found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredParties.map((p) => {
            const t = tradeTotals[p.id] || { salesTotal: 0, purchaseTotal: 0 };
            const showSales = p.party_type === 'buyer' || p.party_type === 'both';
            const showPurch = p.party_type === 'supplier' || p.party_type === 'both';
            return (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-sm text-slate-900">{p.name}</p>
                    {p.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" />
                        {p.phone}
                      </p>
                    )}
                  </div>
                  <PartyTypeBadge type={p.party_type} />
                </div>
                {p.address && <p className="text-xs text-slate-500 mb-2 truncate">{p.address}</p>}
                <div className="text-xs space-y-1 border-t border-slate-100 pt-2 mb-3">
                  {showSales && (
                    <p>
                      <span className="text-slate-500">Sales total (trade):</span>{' '}
                      <span className="font-semibold text-emerald-700">Rs. {t.salesTotal.toLocaleString()}</span>
                    </p>
                  )}
                  {showPurch && (
                    <p>
                      <span className="text-slate-500">Purchase total (trade):</span>{' '}
                      <span className="font-semibold text-blue-700">Rs. {t.purchaseTotal.toLocaleString()}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 italic">Outstanding balance after payments — Phase 4 ledger</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  {showSales && (
                    <Link
                      href={`/khata/sales?partyId=${p.id}`}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1"
                    >
                      <BookOpen className="w-3 h-3" /> Sales Khata
                    </Link>
                  )}
                  {showPurch && (
                    <Link
                      href={`/khata/purchases?partyId=${p.id}`}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100 flex items-center gap-1"
                    >
                      <BookOpen className="w-3 h-3" /> Purchase Khata
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* REGISTER / EDIT POPUP (same form as before) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          onMouseDown={closeModal}
        >
          <form
            onSubmit={handlePartySubmit}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl"
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                {editingId ? (
                  <Pencil className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Plus className="w-4 h-4 text-emerald-600" />
                )}
                {editingId ? 'Edit Party' : 'Register New Party'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close"
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {modalError && <div className="p-3 rounded-lg text-sm bg-rose-50 text-rose-700">{modalError}</div>}
              <input
                type="text"
                required
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <div className="grid grid-cols-3 gap-2">
                {PARTY_TYPES.map((pt) => (
                  <button
                    key={pt.value}
                    type="button"
                    onClick={() => setPartyType(pt.value)}
                    className={`py-2 rounded-lg border-2 text-xs font-bold ${partyType === pt.value ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}
                  >
                    {pt.label}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={partySubmitting}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50"
              >
                {partySubmitting ? 'Saving...' : editingId ? 'Update Party' : 'Register Party'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}