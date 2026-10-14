'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  User,
  Phone,
  ChevronRight,
  Receipt,
  History,
  Search,
  X,
} from 'lucide-react';

interface KhataTransaction {
  id: number;
  invoice_no: string;
  created_at: string;
  amount: number;
  crop_name: string;
  notes?: string | null;
  // For sales
  physical_weight_kg?: number;
  sale_amount?: number;
  // For purchases
  gross_weight_kg?: number;
  crop_amount?: number;
  bags?: number;
}

interface KhataParty {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  transactions: KhataTransaction[];
  totalAmount: number;
  txCount: number;
}

interface KhataPartyListProps {
  parties: KhataParty[];
  type: 'sales' | 'purchases';
  title: string;
  colorScheme?: 'emerald' | 'blue';
  initialPartyId?: number | null;
}

export function KhataPartyList({ parties, type, title, colorScheme = 'emerald', initialPartyId }: KhataPartyListProps) {
  const [search, setSearch] = useState('');
  const [selectedParty, setSelectedParty] = useState<KhataParty | null>(() => {
    if (initialPartyId == null) return null;
    return parties.find((p) => p.id === initialPartyId) || null;
  });
  const [receiptTx, setReceiptTx] = useState<KhataTransaction | null>(null);

  const filtered = parties.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone || '').includes(search)
  );

  const accentBg = colorScheme === 'blue' ? 'bg-blue-700' : 'bg-emerald-700';
  const accentText = colorScheme === 'blue' ? 'text-blue-700' : 'text-emerald-700';
  const accentBorder = colorScheme === 'blue' ? 'border-blue-200' : 'border-emerald-200';
  const accentBg50 = colorScheme === 'blue' ? 'bg-blue-50' : 'bg-emerald-50';
  const accentAvatar = colorScheme === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700';

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">

      {/* Party List Panel */}
      <div className={`w-full lg:w-80 shrink-0 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden ${selectedParty ? 'hidden lg:flex' : 'flex'}`}>
        <div className={`${accentBg} text-white px-4 py-3`}>
          <h2 className="font-bold text-sm">{title}</h2>
          <p className="text-xs opacity-75">{parties.length} {type === 'sales' ? 'buyers' : 'suppliers'} found</p>
        </div>
        {/* Search */}
        <div className="px-3 py-2 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No results found</p>
            </div>
          ) : (
            filtered.map((party) => (
              <button
                key={party.id}
                onClick={() => setSelectedParty(party)}
                className={`w-full text-left px-3 py-3 hover:bg-slate-50 transition flex items-center gap-3 ${selectedParty?.id === party.id ? 'bg-slate-50 border-l-2 border-emerald-500' : ''}`}
              >
                <div className={`w-9 h-9 rounded-full ${accentAvatar} flex items-center justify-center font-bold text-sm shrink-0`}>
                  {party.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-900 truncate">{party.name}</p>
                  {party.phone && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Phone className="w-3 h-3" />{party.phone}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-0.5">{party.txCount} transaction{party.txCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-bold text-xs ${accentText}`}>Rs. {party.totalAmount.toLocaleString()}</p>
                  <ChevronRight className="w-4 h-4 text-slate-300 ml-auto mt-1" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* History Panel */}
      <div className={`flex-1 flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden ${!selectedParty ? 'hidden lg:flex' : 'flex'}`}>
        {!selectedParty ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">Select a {type === 'sales' ? 'buyer' : 'supplier'} to view history</p>
            </div>
          </div>
        ) : (
          <>
            {/* Party Header */}
            <div className={`${accentBg} text-white px-4 py-3 flex items-center justify-between`}>
              <div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedParty(null)}
                    className="lg:hidden text-white/70 hover:text-white text-xs mr-1"
                  >
                    ← Back
                  </button>
                  <h2 className="font-bold">{selectedParty.name}</h2>
                </div>
                {selectedParty.phone && (
                  <p className="text-xs opacity-75 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />{selectedParty.phone}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs opacity-75">Total {type === 'sales' ? 'Sales' : 'Purchases'}</p>
                <p className="font-extrabold text-lg">Rs. {selectedParty.totalAmount.toLocaleString()}</p>
              </div>
            </div>

            {/* Summary Bar */}
            <div className={`px-4 py-2 ${accentBg50} border-b ${accentBorder} flex items-center gap-4 text-xs`}>
              <span className={`font-semibold ${accentText}`}>{selectedParty.txCount} Transactions</span>
              {selectedParty.address && <span className="text-slate-500">{selectedParty.address}</span>}
            </div>

            {/* Transactions List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {selectedParty.transactions.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs text-slate-400">No transactions yet</p>
                </div>
              ) : (
                selectedParty.transactions.map((tx) => (
                  <div key={tx.id} className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-bold text-xs text-slate-900 font-mono">{tx.invoice_no}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${accentBg50} ${accentText}`}>
                          {tx.crop_name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {new Date(tx.created_at).toLocaleDateString('en-PK', {
                          day: '2-digit', month: 'short', year: 'numeric',
                          timeZone: 'Asia/Karachi',
                        })}
                        {type === 'purchases' && tx.bags ? ` · ${tx.bags} bags` : ''}
                        {type === 'purchases' && tx.gross_weight_kg ? ` · ${tx.gross_weight_kg.toLocaleString()} kg gross` : ''}
                        {type === 'sales' && tx.physical_weight_kg ? ` · ${tx.physical_weight_kg.toLocaleString()} kg` : ''}
                      </p>
                      {tx.notes && <p className="text-[11px] text-slate-400 mt-0.5 italic truncate">{tx.notes}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`font-extrabold text-sm ${accentText}`}>
                        Rs. {tx.amount.toLocaleString()}
                      </p>
                      <button
                        onClick={() => setReceiptTx(tx)}
                        className={`text-[11px] font-semibold flex items-center gap-1 mt-1 ml-auto ${accentText} hover:underline`}
                      >
                        <Receipt className="w-3 h-3" /> Receipt
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* Receipt Modal */}
      {receiptTx && selectedParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className={`${accentBg} text-white px-5 py-3.5 flex items-center justify-between`}>
              <div>
                <p className="font-bold text-sm">Transaction Receipt</p>
                <p className="text-xs opacity-75 font-mono">{receiptTx.invoice_no}</p>
              </div>
              <button onClick={() => setReceiptTx(null)} className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div id="khata-receipt-printable" className="p-5 space-y-3 text-slate-800">
              {/* Party */}
              <div className={`${accentBg50} rounded-lg p-3 border ${accentBorder}`}>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                  {type === 'sales' ? 'Buyer' : 'Supplier'}
                </p>
                <p className="font-bold">{selectedParty.name}</p>
                {selectedParty.phone && (
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3" />{selectedParty.phone}
                  </p>
                )}
              </div>

              {/* Details */}
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-1.5 text-slate-500">Invoice No</td>
                    <td className="py-1.5 font-bold text-right font-mono">{receiptTx.invoice_no}</td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-500">Date</td>
                    <td className="py-1.5 font-semibold text-right">
                      {new Date(receiptTx.created_at).toLocaleDateString('en-PK', {
                        day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Karachi',
                      })}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 text-slate-500">Crop</td>
                    <td className="py-1.5 font-bold text-right">{receiptTx.crop_name}</td>
                  </tr>
                  {type === 'purchases' && receiptTx.bags != null && receiptTx.bags > 0 && (
                    <tr>
                      <td className="py-1.5 text-slate-500">Bags</td>
                      <td className="py-1.5 font-semibold text-right">{receiptTx.bags}</td>
                    </tr>
                  )}
                  {type === 'purchases' && receiptTx.gross_weight_kg != null && (
                    <tr>
                      <td className="py-1.5 text-slate-500">Gross Weight</td>
                      <td className="py-1.5 font-semibold text-right">{receiptTx.gross_weight_kg.toLocaleString()} kg</td>
                    </tr>
                  )}
                  {type === 'sales' && receiptTx.physical_weight_kg != null && (
                    <tr>
                      <td className="py-1.5 text-slate-500">Delivered Weight</td>
                      <td className="py-1.5 font-semibold text-right">{receiptTx.physical_weight_kg.toLocaleString()} kg</td>
                    </tr>
                  )}
                  {receiptTx.notes && (
                    <tr>
                      <td className="py-1.5 text-slate-500">Notes</td>
                      <td className="py-1.5 text-right text-slate-700 italic">{receiptTx.notes}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Total */}
              <div className={`${accentBg} text-white rounded-xl px-4 py-3 flex justify-between items-center`}>
                <span className="font-bold text-sm">{type === 'sales' ? 'Sale Amount' : 'Crop Amount'}</span>
                <span className="text-xl font-extrabold">Rs. {receiptTx.amount.toLocaleString()}</span>
              </div>

              <p className="text-center text-[10px] text-slate-400">Computer-generated — M Shafiq Commission Shop</p>
            </div>

            <div className="flex gap-2 px-5 py-3 bg-slate-50 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm py-2.5 rounded-lg transition"
              >
                Print
              </button>
              <button onClick={() => setReceiptTx(null)} className="w-10 h-10 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-400 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
