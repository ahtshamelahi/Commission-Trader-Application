'use client';

import React, { useEffect, useState } from 'react';
import { saveCrop } from '@/lib/actions/crop-actions';
import { saveCropVariety, deleteCropVariety } from '@/lib/actions/crop-variety-actions';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Plus, Sprout, Trash2, Layers, X } from 'lucide-react';

interface CropsClientPageProps {
  initialCrops: Crop[];
  isLoading?: boolean;
}

export function CropsClientPage({ initialCrops, isLoading = false }: CropsClientPageProps) {
  const [crops, setCrops] = useState<Crop[]>(initialCrops);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cropName, setCropName] = useState('');
  const [cropSubmitting, setCropSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null); // error shown inside the popup
  const [successMsg, setSuccessMsg] = useState<string | null>(null); // success shown on the page
  const [cropSearch, setCropSearch] = useState('');
  const [varietyName, setVarietyName] = useState('');
  const [activeCropIdForVariety, setActiveCropIdForVariety] = useState<number | null>(null);
  const [varietySubmitting, setVarietySubmitting] = useState(false);

  useEffect(() => setCrops(initialCrops), [initialCrops]);

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

  const openModal = () => {
    setCropName('');
    setModalError(null);
    setSuccessMsg(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCropName('');
    setModalError(null);
  };

  // stats
  const totalCrops = crops.length;
  const totalVarieties = crops.reduce((sum, c) => sum + (c.varieties?.length ?? 0), 0);

  const filteredCrops = crops.filter((c) => c.name.toLowerCase().includes(cropSearch.toLowerCase()));

  const handleCropSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCropSubmitting(true);
    setModalError(null);
    const res = await saveCrop(cropName);
    setCropSubmitting(false);
    if (res.success) {
      setSuccessMsg(`Crop "${cropName}" added.`);
      setCrops((prev) => [res.data as Crop, ...prev]);
      closeModal();
    } else {
      setModalError(res.message || 'Failed.');
    }
  };

  const handleVarietySubmit = async (e: React.FormEvent, cropId: number) => {
    e.preventDefault();
    if (!varietyName) return;
    setVarietySubmitting(true);
    const res = await saveCropVariety(cropId, varietyName);
    setVarietySubmitting(false);
    if (res.success) {
      setCrops((prev) =>
        prev.map((c) =>
          c.id === cropId ? { ...c, varieties: [...(c.varieties || []), res.data as CropVariety] } : c
        )
      );
      setVarietyName('');
      setActiveCropIdForVariety(null);
    }
  };

  const handleDeleteVariety = async (cropId: number, varietyId: number) => {
    await deleteCropVariety(varietyId);
    setCrops((prev) =>
      prev.map((c) =>
        c.id === cropId ? { ...c, varieties: c.varieties?.filter((v) => v.id !== varietyId) || [] } : c
      )
    );
  };

  return (
    <div className="mt-4 space-y-5">
      {/* TOP ROW: stats cards + Add Crop Type button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="grid grid-cols-2 gap-3 sm:w-auto">
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[150px]">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Sprout className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Crops</p>
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{totalCrops}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm min-w-[150px]">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total Varieties</p>
              <p className="text-xl font-extrabold text-slate-900 leading-tight">{totalVarieties}</p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold px-5 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Crop Type
        </button>
      </div>

      {/* SUCCESS MESSAGE (after the popup closes) */}
      {successMsg && (
        <div className="p-3 rounded-lg text-sm bg-emerald-50 text-emerald-800 border border-emerald-100">
          {successMsg}
        </div>
      )}

      {/* SEARCH */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search crop..."
          value={cropSearch}
          onChange={(e) => setCropSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        />
      </div>

      {/* CROPS LIST (full width) */}
      {isLoading ? (
        <div className="h-40 bg-white border rounded-xl animate-pulse" />
      ) : filteredCrops.length === 0 ? (
        <p className="text-sm text-slate-500 py-10 text-center bg-white border rounded-xl">
          {crops.length === 0 ? 'No crops yet.' : 'No crops found.'}
        </p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase">Crop</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-slate-600 uppercase">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCrops.map((c) => (
                <React.Fragment key={c.id}>
                  <tr>
                    <td className="px-4 py-3 font-semibold">
                      <div className="flex items-center gap-2">
                        <Sprout className="w-4 h-4 text-green-700" /> {c.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-slate-500">
                      {new Date(c.created_at).toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi' })}
                    </td>
                  </tr>
                  <tr className="bg-slate-50/50">
                    <td colSpan={2} className="px-4 py-3 border-b-4 border-slate-200">
                      <div className="pl-6">
                        <div className="flex flex-wrap gap-2 mb-2">
                          {(c.varieties || []).map((v) => (
                            <span key={v.id} className="inline-flex items-center gap-1 bg-white border rounded-md px-2 py-1 text-xs">
                              {v.name}
                              <button type="button" onClick={() => handleDeleteVariety(c.id, v.id)} className="text-slate-300 hover:text-rose-500">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                          {activeCropIdForVariety !== c.id && (
                            <button type="button" onClick={() => setActiveCropIdForVariety(c.id)} className="text-xs text-blue-600 font-semibold">
                              + Add variety
                            </button>
                          )}
                        </div>
                        {activeCropIdForVariety === c.id && (
                          <form onSubmit={(e) => handleVarietySubmit(e, c.id)} className="flex gap-2 max-w-xs">
                            <input value={varietyName} onChange={(e) => setVarietyName(e.target.value)} className="flex-1 text-xs border rounded-lg px-2 py-1.5" placeholder="Variety name" />
                            <button type="submit" disabled={varietySubmitting} className="text-xs bg-blue-600 text-white px-2 rounded-lg">Save</button>
                            <button type="button" onClick={() => setActiveCropIdForVariety(null)} className="text-xs border px-2 rounded-lg">Cancel</button>
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

      {/* ADD CROP POPUP (same form as before) */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          onMouseDown={closeModal}
        >
          <form
            onSubmit={handleCropSubmit}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xl"
          >
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Plus className="w-4 h-4 text-green-600" /> Add Crop Type
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
                autoFocus
                placeholder="e.g. Wheat, Cotton"
                value={cropName}
                onChange={(e) => setCropName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={cropSubmitting}
                className="w-full bg-green-700 hover:bg-green-800 text-white text-sm font-semibold py-2.5 rounded-lg disabled:opacity-50"
              >
                {cropSubmitting ? 'Adding...' : 'Add to Catalog'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}