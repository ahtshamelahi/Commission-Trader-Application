'use client';

import React, { useState } from 'react';
import { saveParty } from '@/lib/actions/party-actions';
import { saveCrop } from '@/lib/actions/crop-actions';
import { saveCropVariety, deleteCropVariety } from '@/lib/actions/crop-variety-actions';
import { PartyType, Party } from '@/types/party-data-types';
import { Crop, CropVariety } from '@/types/crop-data-types';
import {
  User,
  Phone,
  MapPin,
  Briefcase,
  CheckCircle2,
  XCircle,
  Plus,
  Loader2,
  Sprout,
  ChevronDown,
  Trash2,
} from 'lucide-react';

interface PartiesClientPageProps {
  initialParties: Party[];
  initialCrops: Crop[];
  isLoading?: boolean;
}

const PARTY_TYPES: { value: PartyType; label: string; desc: string; color: string }[] = [
  { value: 'supplier', label: 'Supplier', desc: 'Farmer / Producer', color: 'blue' },
  { value: 'buyer', label: 'Buyer', desc: 'Trader / Mill Owner', color: 'emerald' },
  { value: 'both', label: 'Both', desc: 'Supplier & Buyer', color: 'purple' },
];

function PartyTypeBadge({ type }: { type: PartyType }) {
  const styles: Record<PartyType, string> = {
    supplier: 'bg-blue-50 text-blue-700 border-blue-200',
    buyer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    both: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  const labels: Record<PartyType, string> = {
    supplier: 'Supplier',
    buyer: 'Buyer',
    both: 'Both',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wide ${styles[type]}`}>
      {labels[type]}
    </span>
  );
}

export function PartiesClientPage({ initialParties, initialCrops, isLoading = false }: PartiesClientPageProps) {
  // Party Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [partyType, setPartyType] = useState<PartyType>('supplier');
  const [partySubmitting, setPartySubmitting] = useState(false);
  const [partyMsg, setPartyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [parties, setParties] = useState<Party[]>(initialParties);

  // Crop Form State
  const [cropName, setCropName] = useState('');
  const [cropSubmitting, setCropSubmitting] = useState(false);
  const [cropMsg, setCropMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [crops, setCrops] = useState<Crop[]>(initialCrops);

  React.useEffect(() => {
    setParties(initialParties);
  }, [initialParties]);

  React.useEffect(() => {
    setCrops(initialCrops);
  }, [initialCrops]);

  // Variety Form State
  const [varietyName, setVarietyName] = useState('');
  const [activeCropIdForVariety, setActiveCropIdForVariety] = useState<number | null>(null);
  const [varietySubmitting, setVarietySubmitting] = useState(false);

  // Party filter
  const [filterType, setFilterType] = useState<PartyType | 'all'>('all');
  const [partySearch, setPartySearch] = useState('');

  const filteredParties = parties.filter((p) => {
    const matchesType = filterType === 'all' || p.party_type === filterType;
    const matchesSearch = p.name.toLowerCase().includes(partySearch.toLowerCase()) ||
      (p.phone || '').toLowerCase().includes(partySearch.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPartySubmitting(true);
    setPartyMsg(null);

    const res = await saveParty({ name, phone, address, party_type: partyType });
    setPartySubmitting(false);

    if (res.success) {
      setPartyMsg({ type: 'success', text: `"${name}" has been registered successfully.` });
      setParties((prev) => [res.data as Party, ...prev]);
      setName('');
      setPhone('');
      setAddress('');
      setPartyType('supplier');
    } else {
      setPartyMsg({ type: 'error', text: res.message || 'Failed to save party.' });
    }
  };

  const handleCropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCropSubmitting(true);
    setCropMsg(null);

    const res = await saveCrop(cropName);
    setCropSubmitting(false);

    if (res.success) {
      setCropMsg({ type: 'success', text: `Crop "${cropName}" added to catalog.` });
      setCrops((prev) => [res.data as Crop, ...prev]);
      setCropName('');
    } else {
      setCropMsg({ type: 'error', text: res.message || 'Failed to add crop.' });
    }
  };

  const handleVarietySubmit = async (e: React.FormEvent, cropId: number) => {
    e.preventDefault();
    if (!varietyName) return;
    setVarietySubmitting(true);
    const res = await saveCropVariety(cropId, varietyName);
    setVarietySubmitting(false);
    if (res.success) {
      setCrops((prev) => prev.map(c => c.id === cropId ? { ...c, varieties: [...(c.varieties || []), res.data as CropVariety] } : c));
      setVarietyName('');
      setActiveCropIdForVariety(null);
    }
  };

  const handleDeleteVariety = async (cropId: number, varietyId: number) => {
    await deleteCropVariety(varietyId);
    setCrops((prev) => prev.map(c => c.id === cropId ? { ...c, varieties: c.varieties?.filter(v => v.id !== varietyId) || [] } : c));
  };

  return (
    <div className="mt-6 space-y-10">

      {/* ─── PARTIES SECTION ─────────────────────────────────────── */}
      <section>
        {/* Section header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Suppliers & Buyers</h2>
            <p className="text-xs text-slate-500">{parties.length} registered parties</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Form Panel */}
          <div className="xl:col-span-2">
            <form onSubmit={handlePartySubmit} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Form header */}
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Register New Party
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Add a farmer, supplier, buyer, or trading party</p>
              </div>

              <div className="p-5 space-y-4">
                {/* Feedback */}
                {partyMsg && (
                  <div className={`flex items-start gap-2.5 p-3 rounded-lg text-sm font-medium ${partyMsg.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                    }`}>
                    {partyMsg.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                      : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />}
                    <span>{partyMsg.text}</span>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Malik Muhammad Tariq"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="tel"
                      placeholder="e.g. 0300-1234567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">Address / Village</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. Chak 45 NB, Sargodha"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Party Role — segmented picker */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-slate-500" /> Role <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PARTY_TYPES.map((pt) => (
                      <button
                        key={pt.value}
                        type="button"
                        onClick={() => setPartyType(pt.value)}
                        className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-lg border-2 text-center transition-all ${partyType === pt.value
                          ? pt.color === 'blue'
                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                            : pt.color === 'emerald'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                              : 'border-purple-500 bg-purple-50 text-purple-800'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                      >
                        <span className="font-bold text-xs">{pt.label}</span>
                        <span className="text-[10px] font-medium opacity-70 mt-0.5">{pt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={partySubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                >
                  {partySubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Register Party</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Parties List Panel */}
          <div className="xl:col-span-3 flex flex-col gap-4">
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={partySearch}
                  onChange={(e) => setPartySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                {(['all', 'supplier', 'buyer', 'both'] as const).map((ft) => (
                  <button
                    key={ft}
                    onClick={() => setFilterType(ft)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition capitalize ${filterType === ft
                      ? 'bg-slate-800 text-white'
                      : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-50'
                      }`}
                  >
                    {ft === 'all' ? 'All' : ft.charAt(0).toUpperCase() + ft.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Party Cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <div className="h-4 bg-slate-200 rounded w-24" />
                        <div className="h-3 bg-slate-100 rounded w-16" />
                      </div>
                    </div>
                    <div className="h-3 bg-slate-100 rounded w-32 mt-2" />
                  </div>
                ))}
              </div>
            ) : filteredParties.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 bg-white border border-slate-200 rounded-xl text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <User className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600">No parties found</p>
                <p className="text-xs text-slate-400 mt-1">
                  {partySearch ? 'Try a different search term.' : 'Register your first supplier or buyer using the form.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredParties.map((p) => (
                  <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${p.party_type === 'supplier' ? 'bg-blue-100 text-blue-700' :
                          p.party_type === 'buyer' ? 'bg-emerald-100 text-emerald-700' :
                            'bg-purple-100 text-purple-700'
                          }`}>
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-sm truncate leading-tight">{p.name}</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Added {new Date(p.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <PartyTypeBadge type={p.party_type} />
                    </div>

                    <div className="space-y-1.5 border-t border-slate-100 pt-3">
                      {p.phone && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{p.phone}</span>
                        </div>
                      )}
                      {p.address && (
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{p.address}</span>
                        </div>
                      )}
                      {!p.phone && !p.address && (
                        <p className="text-xs text-slate-400 italic">No contact details added</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── CROPS SECTION ───────────────────────────────────────── */}
      <section className="border-t border-slate-200 pt-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-100 text-green-700">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">Crop Catalog</h2>
            <p className="text-xs text-slate-500">{crops.length} crop type(s) registered</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

          {/* Crop Add Form */}
          <div className="xl:col-span-2">
            <form onSubmit={handleCropSubmit} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-600" />
                  Add Crop Type
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Crops available for purchase and sale transactions</p>
              </div>

              <div className="p-5 space-y-4">
                {cropMsg && (
                  <div className={`flex items-start gap-2.5 p-3 rounded-lg text-sm font-medium ${cropMsg.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-700'
                    }`}>
                    {cropMsg.type === 'success'
                      ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                      : <XCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />}
                    <span>{cropMsg.text}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                    Crop Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Sprout className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Wheat (Gandum), Super Basmati, Cotton"
                      value={cropName}
                      onChange={(e) => setCropName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 pl-1">Use local names where applicable (Gandum, Dhan, Kapas)</p>
                </div>

                <button
                  type="submit"
                  disabled={cropSubmitting}
                  className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold text-sm py-2.5 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cropSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Adding...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Add to Catalog</>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Crops List */}
          <div className="xl:col-span-3">
            {crops.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 bg-white border border-slate-200 rounded-xl text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                  <Sprout className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-slate-600">No crops added yet</p>
                <p className="text-xs text-slate-400 mt-1">Add your first crop to start recording purchases and sales.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Crop Name</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Added On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {crops.map((c, idx) => (
                      <React.Fragment key={c.id}>
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-xs font-mono text-slate-400">{String(idx + 1).padStart(2, '0')}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                                <Sprout className="w-3.5 h-3.5 text-green-700" />
                              </div>
                              <span className="font-semibold text-slate-900">{c.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-xs text-slate-500">
                            {new Date(c.created_at).toLocaleDateString('en-PK', {
                              timeZone: 'Asia/Karachi',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                        </tr>
                        {/* Varieties Section */}
                        <tr className="bg-slate-50/50">
                          <td colSpan={3} className="px-4 py-3 border-b-4 border-slate-200">
                            <div className="pl-12 pr-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Types / Varieties</span>
                                {activeCropIdForVariety !== c.id && (
                                  <button onClick={() => { setActiveCropIdForVariety(c.id); setVarietyName(''); }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Add Type
                                  </button>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {(c.varieties || []).length === 0 && activeCropIdForVariety !== c.id && (
                                  <span className="text-xs text-slate-400 italic">No types added</span>
                                )}
                                {(c.varieties || []).map(v => (
                                  <div key={v.id} className="flex items-center gap-1 bg-white border border-slate-200 rounded-md pl-2.5 pr-1 py-1 text-xs font-semibold text-slate-700">
                                    {v.name}
                                    <button onClick={() => handleDeleteVariety(c.id, v.id)} className="p-1 text-slate-300 hover:text-rose-500 transition rounded hover:bg-slate-50">
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>

                              {activeCropIdForVariety === c.id && (
                                <form onSubmit={(e) => handleVarietySubmit(e, c.id)} className="mt-3 flex items-center gap-2 max-w-sm">
                                  <input type="text" placeholder="e.g. Super Basmati" autoFocus value={varietyName} onChange={(e) => setVarietyName(e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                  <button type="submit" disabled={varietySubmitting} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50">
                                    {varietySubmitting ? 'Saving...' : 'Save'}
                                  </button>
                                  <button type="button" onClick={() => setActiveCropIdForVariety(null)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-semibold rounded-lg">
                                    Cancel
                                  </button>
                                </form>
                              )}
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
