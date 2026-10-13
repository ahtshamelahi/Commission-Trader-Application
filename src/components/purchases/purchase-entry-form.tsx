'use client';

import React, { useState } from 'react';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { performPurchaseCalculations } from '@/lib/calculations/purchase-amount-calculation';
import { saveMultiPurchaseTransaction, MultiPurchaseItem } from '@/lib/actions/save-multi-purchase-transaction';
import {
  CheckCircle2, AlertCircle, Loader2, User, Printer, Download, X,
  Store, Sprout, Trash2, Plus, Phone, ShoppingCart, Receipt,
} from 'lucide-react';

interface PurchaseEntryFormProps {
  crops: Crop[];
  suppliers: Party[];
  onSuccess?: () => void;
}

interface CartItem extends MultiPurchaseItem {
  _key: string;
  commissionWeightKg: number;
  netWeightKg: number;
  cropAmountPkr: number;
}

interface ReceiptItem {
  cropName: string;
  varietyName: string;
  bags: number;
  grossWeightKg: number;
  commissionPer40kg: number;
  commissionWeightKg: number;
  netWeightKg: number;
  ratePer40kg: number;
  cropAmountPkr: number;
}

interface ReceiptData {
  invoiceNo: string;
  purchaseDate: string;
  supplierName: string;
  supplierPhone: string;
  items: ReceiptItem[];
  expenses: { expense_type: string; amount: number; is_income: boolean; notes: string }[];
  totalCropAmount: number;
  totalExpensesNet: number;
  totalExpensesDisplay: number;
}

const SHOP_NAME = 'M-Shafiq Commission Shop';
const SHOP_TAGLINE = 'Crop Commission Agent — Grain & Commodity Trade';

export function PurchaseEntryForm({ crops, suppliers, onSuccess }: PurchaseEntryFormProps) {
  // Supplier
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Crop/Variety picker
  const [pickedCropId, setPickedCropId] = useState<number | null>(null);
  const [pickedVarietyId, setPickedVarietyId] = useState<number | null>(null);

  // Item entry
  const [itemBags, setItemBags] = useState('');
  const [itemGrossWeight, setItemGrossWeight] = useState('');
  const [itemCommission, setItemCommission] = useState('1.5');
  const [itemRate, setItemRate] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Expenses (multiple lines)
  const [expenses, setExpenses] = useState<{ expense_type: string; amount: string; is_income: boolean; notes: string }[]>([
    { expense_type: '', amount: '', is_income: false, notes: '' },
  ]);
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Mobile tab state: 'items' (Crop & item entry) or 'cart' (Supplier & Cart & Finalize)
  const [mobileTab, setMobileTab] = useState<'items' | 'cart'>('items');
  const [justAddedMsg, setJustAddedMsg] = useState(false);

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId) || null;
  const filteredSuppliers = suppliers.filter(
    (s) => s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || (s.phone || '').includes(supplierSearch)
  );

  const pickedCrop = crops.find((c) => c.id === pickedCropId) || null;
  const pickedVarieties: CropVariety[] = pickedCrop?.varieties || [];
  const pickedVariety = pickedVarieties.find((v) => v.id === pickedVarietyId) || null;

  // Live calc for current item
  const liveCalc = performPurchaseCalculations(
    Number(itemGrossWeight) || 0,
    Number(itemCommission) || 0,
    Number(itemRate) || 0
  );

  const cartTotal = cart.reduce((s, i) => s + i.cropAmountPkr, 0);
  // Expenses: income ones ADD to total, regular ones SUBTRACT
  const totalExpensesNet = expenses.reduce((s, e) => {
    const amt = Number(e.amount) || 0;
    return s + (e.is_income ? amt : -amt);
  }, 0);
  const totalExpensesDisplay = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const isItemReady = !!pickedCropId && Number(itemGrossWeight) > 0 && Number(itemRate) > 0;

  const handleAddToCart = () => {
    if (!isItemReady || !pickedCrop) return;
    const calc = performPurchaseCalculations(
      Number(itemGrossWeight),
      Number(itemCommission) || 0,
      Number(itemRate)
    );
    setCart((prev) => [...prev, {
      _key: `${Date.now()}`,
      crop_id: pickedCrop.id,
      variety_id: pickedVariety?.id || null,
      crop_name: pickedCrop.name,
      variety_name: pickedVariety?.name || '',
      bags: Number(itemBags) || 0,
      gross_weight_kg: Number(itemGrossWeight),
      commission_per_40kg: Number(itemCommission) || 0,
      rate_per_40kg: Number(itemRate),
      commissionWeightKg: calc.commissionWeightKg,
      netWeightKg: calc.netWeightKg,
      cropAmountPkr: calc.cropAmountPkr,
    }]);
    setItemBags('');
    setItemGrossWeight('');
    setItemRate('');
    setErrorMsg('');
    setJustAddedMsg(true);
  };

  const resetAll = () => {
    setSelectedSupplierId(null);
    setSupplierSearch('');
    setPickedCropId(null);
    setPickedVarietyId(null);
    setItemBags('');
    setItemGrossWeight('');
    setItemCommission('1.5');
    setItemRate('');
    setCart([]);
    setExpenses([{ expense_type: '', amount: '', is_income: false, notes: '' }]);
    setInvoiceNotes('');
    setErrorMsg('');
    setMobileTab('items');
    setJustAddedMsg(false);
  };

  const handleFinalize = async () => {
    if (!cart.length) { setErrorMsg('Add at least one item.'); return; }
    setIsSubmitting(true);
    setErrorMsg('');

    const validExpenses = expenses
      .filter((e) => Number(e.amount) > 0)
      .map((e) => ({ expense_type: e.expense_type || 'General', amount: Number(e.amount), is_income: e.is_income, notes: e.notes }));

    const res = await saveMultiPurchaseTransaction({
      supplier_id: selectedSupplierId,
      items: cart.map(({ _key, commissionWeightKg, netWeightKg, cropAmountPkr, ...item }) => item),
      expenses: validExpenses,
      notes: invoiceNotes,
    });

    setIsSubmitting(false);

    if (res.success) {
      setReceipt({
        invoiceNo: res.invoiceNo!,
        purchaseDate: new Date().toLocaleString('en-PK', {
          timeZone: 'Asia/Karachi', day: '2-digit', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        supplierName: selectedSupplier?.name || 'Unknown Supplier',
        supplierPhone: selectedSupplier?.phone || '',
        items: cart.map((i) => ({
          cropName: i.crop_name || '—',
          varietyName: i.variety_name || '',
          bags: i.bags,
          grossWeightKg: i.gross_weight_kg,
          commissionPer40kg: i.commission_per_40kg,
          commissionWeightKg: i.commissionWeightKg,
          netWeightKg: i.netWeightKg,
          ratePer40kg: i.rate_per_40kg,
          cropAmountPkr: i.cropAmountPkr,
        })),
        expenses: validExpenses,
        totalCropAmount: cartTotal,
        totalExpensesNet,
        totalExpensesDisplay,
      });
      resetAll();
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.message || 'Failed to save purchase.');
    }
  };

  const handleDownloadPdf = () => window.print();

  return (
    <>
      {/* ── Receipt Modal ───────────────────────── */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[96vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-blue-700 text-white rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" />
                <div>
                  <p className="font-bold text-sm">Purchase Saved!</p>
                  <p className="text-xs text-blue-100 font-mono">{receipt.invoiceNo}</p>
                </div>
              </div>
              <button onClick={() => setReceipt(null)} className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>

            <div id="purchase-receipt-printable" className="overflow-y-auto flex-1 p-5 space-y-3 text-slate-800">
              <div className="text-center border-b-2 border-dashed border-slate-200 pb-3">
                <div className="flex items-center justify-center gap-2 mb-0.5">
                  <Store className="w-4 h-4 text-blue-700" />
                  <span className="font-extrabold text-slate-900">{SHOP_NAME}</span>
                </div>
                <p className="text-[10px] text-slate-400">{SHOP_TAGLINE}</p>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-slate-500">Invoice</span><span className="font-bold text-right font-mono">{receipt.invoiceNo}</span>
                <span className="text-slate-500">Date</span><span className="font-semibold text-right text-[11px]">{receipt.purchaseDate}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Supplier</p>
                <p className="font-bold text-sm">{receipt.supplierName}</p>
                {receipt.supplierPhone && <p className="text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{receipt.supplierPhone}</p>}
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items</p>
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm">{idx + 1}. {item.cropName}{item.varietyName ? ` — ${item.varietyName}` : ''}</span>
                      <span className="font-extrabold text-blue-800 text-sm">Rs. {item.cropAmountPkr.toLocaleString()}</span>
                    </div>
                    <table className="w-full text-xs text-slate-600">
                      <tbody>
                        {item.bags > 0 && <tr><td>Bags</td><td className="text-right font-semibold">{item.bags}</td></tr>}
                        <tr><td>Gross Weight</td><td className="text-right font-semibold">{item.grossWeightKg.toLocaleString()} kg</td></tr>
                        <tr><td>Commission ({item.commissionPer40kg} kg/40kg)</td><td className="text-right text-rose-600">−{item.commissionWeightKg} kg</td></tr>
                        <tr><td className="text-emerald-700 font-semibold">Net Weight (Stock)</td><td className="text-right text-emerald-700 font-bold">{item.netWeightKg.toLocaleString()} kg</td></tr>
                        <tr><td>Rate / 40 kg</td><td className="text-right">Rs. {item.ratePer40kg.toLocaleString()}</td></tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-slate-200 pt-2 space-y-1 text-xs">
                <div className="flex justify-between font-semibold">
                  <span>Crop Total</span><span>Rs. {receipt.totalCropAmount.toLocaleString()}</span>
                </div>
                {receipt.expenses.map((e, i) => (
                  <div key={i} className={`flex justify-between ${e.is_income ? 'text-emerald-700' : 'text-rose-600'}`}>
                    <span>{e.expense_type || 'Expense'}{e.notes ? ` (${e.notes})` : ''}</span>
                    <span>{e.is_income ? '+' : '−'} Rs. {e.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-700 text-white rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="font-bold text-sm">Grand Total</span>
                <span className="text-xl font-extrabold">Rs. {(receipt.totalCropAmount + receipt.totalExpensesNet).toLocaleString()}</span>
              </div>
              <p className="text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200 pt-2">Computer-generated receipt</p>
            </div>

            <div className="flex gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
              <button onClick={handleDownloadPdf} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm py-2.5 rounded-lg transition">
                <Download className="w-4 h-4" /> Save PDF
              </button>
              <button onClick={() => setReceipt(null)} className="w-10 h-10 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-400 flex items-center justify-center"><X className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #purchase-receipt-printable, #purchase-receipt-printable * { visibility: visible; }
          #purchase-receipt-printable { position: fixed; top: 0; left: 0; width: 80mm; padding: 10px; font-size: 11px; }
        }
      `}</style>

      {/* ── Mobile Tab Navigation (Hidden on Desktop) ────── */}
      <div className="lg:hidden flex border border-slate-200 rounded-lg p-1 bg-slate-100 gap-1 mt-2">
        <button
          type="button"
          onClick={() => setMobileTab('items')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition ${mobileTab === 'items'
            ? 'bg-blue-700 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Sprout className="w-3.5 h-3.5" />
          <span>1. Select Crop & Enter ({crops.length} crops)</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('cart')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition relative ${mobileTab === 'cart'
            ? 'bg-blue-700 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>2. Cart & Finalize</span>
          {cart.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${mobileTab === 'cart' ? 'bg-white text-blue-700' : 'bg-blue-600 text-white'
              }`}>
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {justAddedMsg && (
        <div className="lg:hidden flex items-center justify-between p-2.5 mt-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Item added! ({cart.length} in cart)</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className="text-xs font-bold text-blue-700 underline ml-2"
          >
            Go to Cart & Finalize →
          </button>
        </div>
      )}

      {/* ── Purchase Layout ───────────────────────── */}
      <div className="mt-3 flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-130px)] lg:min-h-[600px]">

        {/* LEFT: Supplier + Cart + Expenses + Finalize */}
        <div className={`${mobileTab === 'cart' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[360px] lg:shrink-0 flex-col gap-2 overflow-y-auto pb-2`}>

          {/* Supplier */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Supplier / Farmer</span>
            </div>
            {selectedSupplier ? (
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">{selectedSupplier.name.charAt(0)}</div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 leading-tight">{selectedSupplier.name}</p>
                    {selectedSupplier.phone && <p className="text-xs text-slate-500">{selectedSupplier.phone}</p>}
                  </div>
                </div>
                <button onClick={() => { setSelectedSupplierId(null); setSupplierSearch(''); }} className="text-slate-300 hover:text-rose-500 transition"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="px-3 py-2.5 space-y-2">
                <input type="text" placeholder="Search supplier..." value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {supplierSearch && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                    {filteredSuppliers.length === 0
                      ? <p className="px-3 py-2 text-xs text-slate-400 text-center">No results</p>
                      : filteredSuppliers.map((s) => (
                        <button key={s.id} type="button" onClick={() => { setSelectedSupplierId(s.id); setSupplierSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <p className="text-sm font-semibold">{s.name}</p>
                          {s.phone && <p className="text-xs text-slate-400">{s.phone}</p>}
                        </button>
                      ))}
                  </div>
                )}
                {/* {!supplierSearch && <p className="text-xs text-slate-400 text-center">Optional — select if known</p>} */}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col min-h-[120px]">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Purchase Items</span>
              </div>
              <span className="text-xs font-semibold text-slate-500">{cart.length} item{cart.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <p className="text-xs text-slate-400 mb-2">No items added yet</p>
                  <button
                    type="button"
                    onClick={() => setMobileTab('items')}
                    className="lg:hidden text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200"
                  >
                    ← Select Crop to Add
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item._key} className="px-3 py-2.5 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 leading-tight truncate">
                        {item.crop_name}{item.variety_name ? <span className="text-blue-700"> — {item.variety_name}</span> : null}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.bags > 0 ? `${item.bags} bags · ` : ''}{item.gross_weight_kg.toLocaleString()} kg gross · {item.netWeightKg.toLocaleString()} kg net · Rs. {item.rate_per_40kg.toLocaleString()}/40kg
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-blue-800 text-sm">Rs. {item.cropAmountPkr.toLocaleString()}</span>
                      <button onClick={() => setCart((p) => p.filter((i) => i._key !== item._key))} className="text-slate-300 hover:text-rose-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-700">Crop Total</span>
                <span className="font-extrabold text-slate-900">Rs. {cartTotal.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Expenses (Transport, Labour etc.)</span>
              <button type="button" onClick={() => setExpenses((p) => [...p, { expense_type: '', amount: '', is_income: false, notes: '' }])}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              {expenses.map((exp, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  {/* Income/Expense Toggle */}
                  <button
                    type="button"
                    onClick={() => setExpenses((p) => p.map((x, i) => i === idx ? { ...x, is_income: !x.is_income } : x))}
                    title={exp.is_income ? 'Income (adds to total) — click to switch to expense' : 'Expense (subtracts from total) — click to switch to income'}
                    className={`shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center text-sm font-bold transition ${
                      exp.is_income
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : 'border-rose-300 bg-rose-50 text-rose-600'
                    }`}
                  >
                    {exp.is_income ? '+' : '−'}
                  </button>
                  <input type="text" placeholder="Type (e.g. Truck Rent)" value={exp.expense_type}
                    onChange={(e) => setExpenses((p) => p.map((x, i) => i === idx ? { ...x, expense_type: e.target.value } : x))}
                    className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  <input type="number" step="1" min="0" placeholder="PKR" value={exp.amount}
                    onChange={(e) => setExpenses((p) => p.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                    className="w-24 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {expenses.length > 1 && (
                    <button type="button" onClick={() => setExpenses((p) => p.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-rose-500">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {totalExpensesDisplay > 0 && (
                <div className="flex justify-between text-xs font-semibold text-slate-700 pt-1 border-t border-slate-100 mt-1">
                  <span>Net Adjustment</span>
                  <span className={totalExpensesNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                    {totalExpensesNet >= 0 ? '+' : ''}Rs. {totalExpensesNet.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Notes + Finalize */}
          <div className="shrink-0 space-y-2">
            <input type="text" placeholder="Invoice notes (optional)" value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {cart.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-700 font-semibold">Grand Total</p>
                  {totalExpensesDisplay > 0 && (
                    <p className="text-[10px] text-blue-600">
                      Crops {totalExpensesNet >= 0 ? '+' : ''} Rs. {totalExpensesNet.toLocaleString()} expenses
                    </p>
                  )}
                </div>
                <span className="text-xl font-extrabold text-blue-900">Rs. {(cartTotal + totalExpensesNet).toLocaleString()}</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{errorMsg}
              </div>
            )}
            <button onClick={handleFinalize} disabled={!cart.length || isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : `Finalize Purchase (${cart.length} item${cart.length !== 1 ? 's' : ''})`}
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('items')}
              className="lg:hidden w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900 py-1"
            >
              ← Back to Select Crops
            </button>
          </div>
        </div>

        {/* RIGHT: Crop → Variety → Item Entry */}
        <div className={`${mobileTab === 'items' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col gap-2 overflow-y-auto lg:overflow-hidden pb-2`}>

          {/* Crop selection */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Sprout className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Step 1 — Select Crop Category</span>
            </div>
            <div className="p-3">
              {crops.length === 0 ? (
                <div className="py-6 px-4 text-center">
                  <p className="text-sm font-semibold text-slate-600 mb-1">No crops registered yet</p>
                  <p className="text-xs text-slate-400 mb-3">Add crop types in Parties & Crop Catalog first.</p>
                  <a
                    href="/parties"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-green-700 hover:bg-green-800"
                  >
                    Go to Crop Catalog →
                  </a>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {crops.map((crop) => {
                    const isSelected = pickedCropId === crop.id;
                    return (
                      <button key={crop.id} type="button"
                        onClick={() => { setPickedCropId(crop.id); setPickedVarietyId(null); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-semibold transition ${isSelected ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-white hover:border-blue-300 text-slate-700'
                          }`}>
                        <Sprout className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-green-600'}`} />
                        {crop.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Variety selection */}
          {pickedCrop && pickedVarieties.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Step 2 — Variety / Type <span className="text-slate-400 font-normal normal-case">(of {pickedCrop.name})</span>
                </span>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setPickedVarietyId(null)}
                  className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${!pickedVarietyId ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  No Variety
                </button>
                {pickedVarieties.map((v) => (
                  <button key={v.id} type="button" onClick={() => setPickedVarietyId(v.id)}
                    className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${pickedVarietyId === v.id ? 'border-blue-400 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:border-blue-300'}`}>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Item entry */}
          {pickedCrop && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {pickedVarieties.length > 0 ? 'Step 3' : 'Step 2'} — Enter Weights & Rate
                </span>
                <span className="text-xs font-semibold text-blue-700">
                  {pickedCrop.name}{pickedVarieties.find((v) => v.id === pickedVarietyId)?.name ? ` — ${pickedVarieties.find((v) => v.id === pickedVarietyId)?.name}` : ''}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bags</label>
                    <input type="number" step="1" min="0" placeholder="0" value={itemBags}
                      onChange={(e) => setItemBags(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Gross Weight (kg) <span className="text-rose-500">*</span></label>
                    <input type="number" step="1" min="1" placeholder="e.g. 4200" value={itemGrossWeight}
                      onChange={(e) => setItemGrossWeight(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Commission / 40 kg (kg)</label>
                    <input type="number" step="1.5" min="0" value={itemCommission}
                      onChange={(e) => setItemCommission(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Rate / 40 kg (PKR) <span className="text-rose-500">*</span></label>
                    <input type="number" step="1" min="1" placeholder="e.g. 3000" value={itemRate}
                      onChange={(e) => setItemRate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                {Number(itemGrossWeight) > 0 && Number(itemRate) > 0 && (
                  <div className="flex items-center gap-3 text-xs mb-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                    <span className="text-slate-500">Comm: <strong className="text-rose-600">−{liveCalc.commissionWeightKg} kg</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">Net Stock: <strong className="text-emerald-700">+{liveCalc.netWeightKg} kg</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">Amount: <strong className="text-blue-800">Rs. {liveCalc.cropAmountPkr.toLocaleString()}</strong></span>
                  </div>
                )}

                <button type="button" onClick={handleAddToCart} disabled={!isItemReady}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-4 h-4" /> Add to Purchase
                </button>
              </div>
            </div>
          )}

          {!pickedCrop && (
            <div className="flex-1 flex items-center justify-center bg-white border border-dashed border-slate-300 rounded-xl">
              <div className="text-center">
                <Sprout className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">Select a crop above to begin</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
