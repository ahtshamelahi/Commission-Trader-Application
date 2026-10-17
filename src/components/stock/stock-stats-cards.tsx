'use client';

import React, { useState } from 'react';
import { Sprout, Filter, AlertTriangle } from 'lucide-react';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import {
  calculatePhysicalStockKg,
  calculateWeightedAverageCostPerKg,
  sumPurchasedGrossKg,
  sumSoldPhysicalKg,
} from '@/lib/calculations/current-stock-calculation';

export interface VarietyStockSummary {
  id: string; // crop_id + variety_id
  crop_id: number;
  variety_id: number | null;
  crop_name: string;
  variety_name: string;
  currentStockKg: number;
  totalPurchasedKg: number;
  totalSoldKg: number;
  avgCostPer40kg: number;
}

interface StockStatsCardsProps {
  crops: Crop[];
  varieties: CropVariety[];
  purchases: Purchase[];
  sales: Sale[];
  isLoading?: boolean;
}

export function StockStatsCards({ crops, varieties, purchases, sales, isLoading = false }: StockStatsCardsProps) {
  const [selectedCropId, setSelectedCropId] = useState<number | 'all'>('all');
  const [selectedVarietyId, setSelectedVarietyId] = useState<number | 'all' | null>('all');

  // Build the summaries based on purchases and sales
  // We'll iterate through all crops and their varieties (plus a "no variety" bucket if needed)
  const summaries: VarietyStockSummary[] = [];

  for (const crop of crops) {
    const cropVarieties = varieties.filter((v) => v.crop_id === crop.id);
    const cropBuckets = [...cropVarieties.map((v) => ({ id: v.id, name: v.name })), { id: null, name: 'Standard / Uncategorized' }];

    for (const v of cropBuckets) {
      const vPurchases = purchases.filter((p) => p.crop_id === crop.id && p.variety_id === v.id);
      const vSales = sales.filter((s) => s.crop_id === crop.id && s.variety_id === v.id);

      const totalPurchasedKg = sumPurchasedGrossKg(vPurchases);
      const totalSoldKg = sumSoldPhysicalKg(vSales);
      const currentStockKg = calculatePhysicalStockKg({
        purchasedGrossKg: totalPurchasedKg,
        soldPhysicalKg: totalSoldKg,
      });

      if (totalPurchasedKg > 0 || totalSoldKg > 0 || currentStockKg !== 0) {
        const avgCostPerKg = calculateWeightedAverageCostPerKg(vPurchases as Purchase[]);

        summaries.push({
          id: `${crop.id}-${v.id || 'none'}`,
          crop_id: crop.id,
          variety_id: v.id,
          crop_name: crop.name,
          variety_name: v.name,
          currentStockKg,
          totalPurchasedKg,
          totalSoldKg,
          avgCostPer40kg: Number((avgCostPerKg * 40).toFixed(2)),
        });
      }
    }
  }

  // Filter Logic
  const filteredSummaries = summaries.filter((s) => {
    if (selectedCropId !== 'all' && s.crop_id !== selectedCropId) return false;
    if (selectedVarietyId !== 'all' && s.variety_id !== selectedVarietyId) return false;
    return true;
  });

  const availableVarieties = selectedCropId !== 'all'
    ? varieties.filter((v) => v.crop_id === selectedCropId)
    : varieties;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 border border-slate-200 rounded-lg shadow-2xs">
        <div className="flex items-center gap-2 px-2 border-r border-slate-200 mr-1">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Filters</span>
        </div>

        <select
          value={selectedCropId}
          onChange={(e) => {
            setSelectedCropId(e.target.value === 'all' ? 'all' : Number(e.target.value));
            setSelectedVarietyId('all');
          }}
          className="text-sm bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-medium text-slate-700"
        >
          <option value="all">All Crop Categories</option>
          {crops.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={selectedVarietyId === null ? 'null' : selectedVarietyId}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'all') setSelectedVarietyId('all');
            else if (val === 'null') setSelectedVarietyId(null);
            else setSelectedVarietyId(Number(val));
          }}
          disabled={selectedCropId === 'all'}
          className="text-sm bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-emerald-500 font-medium text-slate-700 disabled:opacity-50"
        >
          <option value="all">All Types / Varieties</option>
          {availableVarieties.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
          <option value="null">Standard / Uncategorized</option>
        </select>

        <div className="ml-auto text-xs font-semibold text-slate-500">
          Showing {filteredSummaries.length} matching item(s)
        </div>
      </div>

      {/* Stats Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-sm p-3 shadow-2xs animate-pulse space-y-2">
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-3 bg-slate-100 rounded w-16" />
              <div className="h-6 bg-slate-200 rounded w-20 mt-2" />
            </div>
          ))}
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="py-12 bg-white border border-dashed border-slate-300 rounded-xl text-center">
          <Sprout className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No stock data found for these filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
          {filteredSummaries.map((s) => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-sm p-2 sm:p-3 shadow-2xs hover:border-slate-300 transition-all flex flex-col relative overflow-hidden">
              {s.currentStockKg <= 0 && (
                <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none">
                  <div className="absolute transform rotate-45 bg-rose-500 text-white text-[9px] font-bold py-0.5 right-[-20px] top-[15px] w-[80px] text-center">
                    OUT OF STOCK
                  </div>
                </div>
              )}

              <div className="mb-1 sm:mb-3 pr-4 sm:pr-6">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">{s.crop_name}</h3>
                <p className="text-[9px] sm:text-[10px] text-blue-700 font-semibold">{s.variety_name}</p>
              </div>

              <div className="flex-1 flex flex-col justify-end space-y-3">
                <div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 sm:mb-1">Available Stock</p>
                  <div className="flex items-baseline gap-1 sm:gap-1.5 mt-1 sm:mt-2">
                    <span className={`text-sm sm:text-lg font-bold tracking-tight ${s.currentStockKg > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                      {s.currentStockKg.toLocaleString()}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500">kg</span>
                  </div>
                </div>

                {/* <div className="bg-slate-50 rounded-md p-2 flex justify-between items-center border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500">Avg Cost</span>
                  <span className="text-xs font-bold text-slate-800">Rs. {s.avgCostPer40kg.toLocaleString()} / 40kg</span>
                </div> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
