'use client';

import React, { useState, useMemo } from 'react';
import { Sale } from '@/types/sale-data-types';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Search, Filter, X, TrendingUp, Package, ReceiptText } from 'lucide-react';

interface AllSalesViewProps {
  sales: Sale[];
  crops: Crop[];
  buyers: Party[];
}

export function AllSalesView({ sales, crops, buyers }: AllSalesViewProps) {
  const [cropFilter, setCropFilter] = useState<string>('all');
  const [buyerFilter, setBuyerFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (cropFilter !== 'all' && String(s.crop_id) !== cropFilter) return false;
      if (buyerFilter !== 'all' && String(s.buyer_id) !== buyerFilter) return false;
      if (fromDate) {
        const saleDate = new Date(s.created_at);
        if (saleDate < new Date(fromDate)) return false;
      }
      if (toDate) {
        const saleDate = new Date(s.created_at);
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        if (saleDate > to) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchInvoice = (s.invoice_no || '').toLowerCase().includes(q);
        const matchCrop = (s.crops?.name || '').toLowerCase().includes(q);
        const matchBuyer = (s.parties?.name || '').toLowerCase().includes(q);
        if (!matchInvoice && !matchCrop && !matchBuyer) return false;
      }
      return true;
    });
  }, [sales, cropFilter, buyerFilter, fromDate, toDate, search]);

  const totalRevenue = filtered.reduce((acc, s) => acc + Number(s.sale_amount), 0);
  const totalWeight = filtered.reduce((acc, s) => acc + Number(s.physical_weight_kg), 0);

  const hasFilters = cropFilter !== 'all' || buyerFilter !== 'all' || fromDate || toDate || search;
  const clearFilters = () => {
    setCropFilter('all');
    setBuyerFilter('all');
    setFromDate('');
    setToDate('');
    setSearch('');
  };

  return (
    <div className="mt-4 space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <ReceiptText className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Sales</p>
            <p className="text-xl font-extrabold text-slate-900">{filtered.length}</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Weight</p>
            <p className="text-xl font-extrabold text-slate-900">{totalWeight.toLocaleString()} <span className="text-sm font-bold text-slate-500">kg</span></p>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Total Revenue</p>
            <p className="text-xl font-extrabold text-emerald-800">Rs. {totalRevenue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice, crop, buyer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Crop Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={cropFilter}
              onChange={(e) => setCropFilter(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="all">All Crops</option>
              {crops.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>

          {/* Buyer Filter */}
          <select
            value={buyerFilter}
            onChange={(e) => setBuyerFilter(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="all">All Buyers</option>
            {buyers.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </select>

          {/* Date Range */}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            title="From date"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="text-sm border border-slate-300 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            title="To date"
          />

          {/* Clear Filters */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-3 py-2 rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ReceiptText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No sales found</p>
            <p className="text-xs text-slate-400 mt-1">
              {hasFilters ? 'Try adjusting your filters.' : 'No sales recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Crop</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Buyer</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Delivered (kg)</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Commission (kg)</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Billable (kg)</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Rate/40kg</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Sale Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-xs text-slate-800">{s.invoice_no || `SALE-${s.id}`}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(s.created_at).toLocaleDateString('en-PK', {
                        timeZone: 'Asia/Karachi', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                        {s.crops?.name || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{s.parties?.name || 'Walk-in'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 text-xs">{Number(s.physical_weight_kg).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-rose-600 font-semibold text-xs">−{Number(s.commission_weight_kg).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-blue-700 font-bold text-xs">{Number(s.billable_weight_kg).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-600">Rs. {Number(s.rate_per_40kg).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-extrabold text-emerald-800 text-sm">
                        Rs. {Number(s.sale_amount).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Footer totals */}
              <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Total ({filtered.length} records)
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900 text-xs">
                    {totalWeight.toLocaleString()} kg
                  </td>
                  <td colSpan={3} />
                  <td className="px-4 py-3 text-right font-extrabold text-emerald-900">
                    Rs. {totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
