'use client';

import React, { useState, useEffect } from 'react';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { saveMultiSaleTransaction, MultiSaleItem } from '@/lib/actions/save-multi-sale-transaction';
import {
  CheckCircle2, AlertCircle, Loader2, User, Printer, Download, X,
  Store, Sprout, Trash2, Plus, Phone, Receipt,
} from 'lucide-react';

interface PosSaleFormProps {
  crops: Crop[];
  buyers: Party[];
  purchases: Purchase[];
  sales: Sale[];
}

interface CartItem extends MultiSaleItem {
  _key: string;
  commissionWeightKg: number;
  bardanaWeightKg: number;
  billableWeightKg: number;
  saleAmountPkr: number;
}

interface ReceiptItem {
  cropName: string;
  varietyName: string;
  bags: number;
  physicalWeightKg: number;
  commissionPer40kg: number;
  commissionWeightKg: number;
  bardanaPerBagKg: number;
  bardanaWeightKg: number;
  billableWeightKg: number;
  ratePer40kg: number;
  saleAmountPkr: number;
}

interface ReceiptData {
  invoiceNo: string;
  saleDate: string;
  buyerName: string;
  buyerPhone: string;
  items: ReceiptItem[];
  expenseAmount: number;
  expenseNotes: string;
  totalSaleAmount: number;
}

const SHOP_NAME = 'M-Shafiq Commission Shop';
const SHOP_TAGLINE = 'Crop Commission Agent — Grain & Commodity Trade';

export function PosSaleForm({ crops, buyers, purchases, sales }: PosSaleFormProps) {
  // Buyer
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [buyerSearch, setBuyerSearch] = useState('');

  // Crop/Variety picker
  const [pickedCropId, setPickedCropId] = useState<number | null>(null);
  const [pickedVarietyId, setPickedVarietyId] = useState<number | null>(null);

  // Item entry fields
  const [itemBags, setItemBags] = useState('');
  const [itemWeight, setItemWeight] = useState('');
  const [itemCommission, setItemCommission] = useState('1.5');
  const [itemBardana, setItemBardana] = useState('');
  const [itemRate, setItemRate] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);

  // Expense (single, shared)
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Mobile tab state: 'items' (Crop & item entry) or 'cart' (Buyer & Cart & Finalize)
  const [mobileTab, setMobileTab] = useState<'items' | 'cart'>('items');
  const [justAddedMsg, setJustAddedMsg] = useState(false);

  const selectedBuyer = buyers.find((b) => b.id === selectedBuyerId) || null;
  const filteredBuyers = buyers.filter(
    (b) => b.name.toLowerCase().includes(buyerSearch.toLowerCase()) || (b.phone || '').includes(buyerSearch)
  );

  const pickedCrop = crops.find((c) => c.id === pickedCropId) || null;
  const pickedVarieties: CropVariety[] = pickedCrop?.varieties || [];
  const pickedVariety = pickedVarieties.find((v) => v.id === pickedVarietyId) || null;

  const getStockForCropAndVariety = (cropId: number, varietyId: number | null) => {
    const vPurchases = purchases.filter((p) => p.crop_id === cropId && p.variety_id === varietyId);
    const vSales = sales.filter((s) => s.crop_id === cropId && s.variety_id === varietyId);
    // Stock = full gross weight purchased (commission = shop profit) minus physical sold
    const totalPurchasedKg = vPurchases.reduce((acc, p) => acc + Number(p.gross_weight_kg), 0);
    const totalSoldKg = vSales.reduce((acc, s) => acc + Number(s.physical_weight_kg), 0);
    return totalPurchasedKg - totalSoldKg;
  };

  // Live calc for current item entry
  const liveCalc = performSaleCalculations(
    Number(itemWeight) || 0,
    Number(itemCommission) || 0,
    Number(itemRate) || 0,
    Number(itemBags) || 0,
    Number(itemBardana) || 0
  );

  const cartTotal = cart.reduce((s, i) => s + i.saleAmountPkr, 0);
  const grandTotal = cartTotal - (Number(expenseAmount) || 0);

  const isItemReady =
    !!pickedCropId &&
    Number(itemWeight) > 0 &&
    Number(itemRate) > 0;

  const handleAddToCart = () => {
    if (!isItemReady || !pickedCrop) return;
    const calc = performSaleCalculations(
      Number(itemWeight),
      Number(itemCommission) || 0,
      Number(itemRate),
      Number(itemBags) || 0,
      Number(itemBardana) || 0
    );
    const item: CartItem = {
      _key: `${Date.now()}`,
      crop_id: pickedCrop.id,
      variety_id: pickedVariety?.id || null,
      crop_name: pickedCrop.name,
      variety_name: pickedVariety?.name || '',
      bags: Number(itemBags) || 0,
      physical_weight_kg: Number(itemWeight),
      commission_per_40kg: Number(itemCommission) || 0,
      bardana_per_bag_kg: Number(itemBardana) || 0,
      rate_per_40kg: Number(itemRate),
      commissionWeightKg: calc.commissionWeightKg,
      bardanaWeightKg: calc.bardanaWeightKg,
      billableWeightKg: calc.billableWeightKg,
      saleAmountPkr: calc.saleAmountPkr,
    };
    setCart((prev) => [...prev, item]);
    setItemBags('');
    setItemWeight('');
    setItemBardana('');
    setItemRate('');
    setErrorMsg('');
    setJustAddedMsg(true);
  };

  const handleRemoveFromCart = (key: string) => {
    setCart((prev) => prev.filter((i) => i._key !== key));
  };

  const resetAll = () => {
    setSelectedBuyerId(null);
    setBuyerSearch('');
    setPickedCropId(null);
    setPickedVarietyId(null);
    setItemBags('');
    setItemWeight('');
    setItemCommission('1.5');
    setItemBardana('');
    setItemRate('');
    setCart([]);
    setExpenseAmount('');
    setExpenseNotes('');
    setInvoiceNotes('');
    setErrorMsg('');
    setMobileTab('items');
    setJustAddedMsg(false);
  };

  const handleFinalize = async () => {
    if (!cart.length) { setErrorMsg('Add at least one item to the sale.'); return; }
    setIsSubmitting(true);
    setErrorMsg('');

    const res = await saveMultiSaleTransaction({
      buyer_id: selectedBuyerId,
      items: cart.map(({ _key, commissionWeightKg, bardanaWeightKg, billableWeightKg, saleAmountPkr, ...item }) => item),
      expense_amount: Number(expenseAmount) || 0,
      expense_notes: expenseNotes,
      notes: invoiceNotes,
    });

    setIsSubmitting(false);

    if (res.success) {
      setReceipt({
        invoiceNo: res.invoiceNo!,
        saleDate: new Date().toLocaleString('en-PK', {
          timeZone: 'Asia/Karachi', day: '2-digit', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
        buyerName: selectedBuyer?.name || 'Walk-in / Unknown',
        buyerPhone: selectedBuyer?.phone || '',
        items: cart.map((i) => ({
          cropName: i.crop_name || '—',
          varietyName: i.variety_name || '',
          bags: i.bags,
          physicalWeightKg: i.physical_weight_kg,
          commissionPer40kg: i.commission_per_40kg,
          commissionWeightKg: i.commissionWeightKg,
          bardanaPerBagKg: i.bardana_per_bag_kg || 0,
          bardanaWeightKg: i.bardanaWeightKg,
          billableWeightKg: i.billableWeightKg,
          ratePer40kg: i.rate_per_40kg,
          saleAmountPkr: i.saleAmountPkr,
        })),
        expenseAmount: Number(expenseAmount) || 0,
        expenseNotes,
        totalSaleAmount: grandTotal,
      });
      resetAll();
    } else {
      setErrorMsg(res.message || 'Failed to save sale.');
    }
  };

  const handleDownloadPdf = () => window.print();

  return (
    <>
      {/* ── Receipt Modal ─────────────────────────────────── */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[96vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-700 text-white rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" />
                <div>
                  <p className="font-bold text-sm">Sale Saved!</p>
                  <p className="text-xs text-emerald-100 font-mono">{receipt.invoiceNo}</p>
                </div>
              </div>
              <button onClick={() => setReceipt(null)} className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div id="sale-receipt-printable" className="overflow-y-auto flex-1 p-5 space-y-3 text-slate-800">
              <div className="text-center border-b-2 border-dashed border-slate-200 pb-3">
                <div className="flex items-center justify-center gap-2 mb-0.5">
                  <Store className="w-4 h-4 text-emerald-700" />
                  <span className="font-extrabold text-slate-900">{SHOP_NAME}</span>
                </div>
                <p className="text-[10px] text-slate-400">{SHOP_TAGLINE}</p>
              </div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <span className="text-slate-500">Invoice</span><span className="font-bold text-right font-mono">{receipt.invoiceNo}</span>
                <span className="text-slate-500">Date</span><span className="font-semibold text-right text-[11px]">{receipt.saleDate}</span>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-xs">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Buyer</p>
                <p className="font-bold text-sm">{receipt.buyerName}</p>
                {receipt.buyerPhone && <p className="text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{receipt.buyerPhone}</p>}
              </div>

              {/* Line items */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items</p>
                {receipt.items.map((item, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-sm text-slate-900">
                        {idx + 1}. {item.cropName}{item.varietyName ? ` — ${item.varietyName}` : ''}
                      </span>
                      <span className="font-extrabold text-emerald-800 text-sm">Rs. {item.saleAmountPkr.toLocaleString()}</span>
                    </div>
                    <table className="w-full text-xs text-slate-600">
                      <tbody>
                        {item.bags > 0 && <tr><td>Bags</td><td className="text-right font-semibold">{item.bags}</td></tr>}
                        <tr><td>Delivered</td><td className="text-right font-semibold">{item.physicalWeightKg.toLocaleString()} kg</td></tr>
                        <tr><td>Commission ({item.commissionPer40kg} kg/40kg)</td><td className="text-right text-rose-600">−{item.commissionWeightKg} kg</td></tr>
                        {item.bardanaWeightKg > 0 && <tr><td>Bardana ({item.bardanaPerBagKg} kg × {item.bags} bags)</td><td className="text-right text-amber-600">−{item.bardanaWeightKg} kg</td></tr>}
                        <tr><td className="text-blue-700 font-semibold">Billable</td><td className="text-right text-blue-700 font-bold">{item.billableWeightKg.toLocaleString()} kg</td></tr>
                        <tr><td>Rate / 40 kg</td><td className="text-right">Rs. {item.ratePer40kg.toLocaleString()}</td></tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-dashed border-slate-200 pt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Sale Total ({receipt.items.length} item{receipt.items.length !== 1 ? 's' : ''})</span>
                  <span className="font-bold">Rs. {receipt.items.reduce((s, i) => s + i.saleAmountPkr, 0).toLocaleString()}</span>
                </div>
                {receipt.expenseAmount > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Expenses{receipt.expenseNotes ? ` (${receipt.expenseNotes})` : ''}</span>
                    <span className="font-semibold">−Rs. {receipt.expenseAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="bg-emerald-700 text-white rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="font-bold text-sm">Net Total</span>
                <span className="text-xl font-extrabold">Rs. {receipt.totalSaleAmount.toLocaleString()}</span>
              </div>
              <p className="text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200 pt-2">Computer-generated receipt</p>
            </div>

            <div className="flex gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
              <button onClick={handleDownloadPdf} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm py-2.5 rounded-lg transition">
                <Download className="w-4 h-4" /> Save PDF
              </button>
              <button onClick={() => setReceipt(null)} className="w-10 h-10 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-400 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #sale-receipt-printable, #sale-receipt-printable * { visibility: visible; }
          #sale-receipt-printable { position: fixed; top: 0; left: 0; width: 80mm; padding: 10px; font-size: 11px; }
        }
      `}</style>

      {/* ── Mobile Tab Navigation (Hidden on Desktop) ────── */}
      <div className="lg:hidden flex border border-slate-200 rounded-lg p-1 bg-slate-100 gap-1 mt-2">
        <button
          type="button"
          onClick={() => setMobileTab('items')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition ${mobileTab === 'items'
            ? 'bg-emerald-700 text-white shadow-xs'
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
            ? 'bg-emerald-700 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
            }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>2. Cart & Finalize</span>
          {cart.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${mobileTab === 'cart' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'
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
            className="text-xs font-bold text-emerald-700 underline ml-2"
          >
            Go to Cart & Finalize →
          </button>
        </div>
      )}

      {/* ── POS Layout ─────────────────────────────────────── */}
      <div className="mt-3 flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-130px)] lg:min-h-[600px]">

        {/* ═══ LEFT: Buyer + Cart + Expense + Finalize ═════ */}
        <div className={`${mobileTab === 'cart' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[360px] lg:shrink-0 flex-col gap-2 overflow-y-auto pb-2`}>

          {/* Buyer */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Buyer / Customer</span>
            </div>
            {selectedBuyer ? (
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">{selectedBuyer.name.charAt(0)}</div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 leading-tight">{selectedBuyer.name}</p>
                    {selectedBuyer.phone && <p className="text-xs text-slate-500">{selectedBuyer.phone}</p>}
                  </div>
                </div>
                <button onClick={() => { setSelectedBuyerId(null); setBuyerSearch(''); }} className="text-slate-300 hover:text-rose-500 transition"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="px-3 py-2.5 space-y-2">
                <input type="text" placeholder="Search buyer..." value={buyerSearch} onChange={(e) => setBuyerSearch(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                {buyerSearch && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-32 overflow-y-auto">
                    {filteredBuyers.length === 0
                      ? <p className="px-3 py-2 text-xs text-slate-400 text-center">No results</p>
                      : filteredBuyers.map((b) => (
                        <button key={b.id} type="button" onClick={() => { setSelectedBuyerId(b.id); setBuyerSearch(''); }}
                          className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <p className="text-sm font-semibold">{b.name}</p>
                          {b.phone && <p className="text-xs text-slate-400">{b.phone}</p>}
                        </button>
                      ))}
                  </div>
                )}
                {/* {!buyerSearch && <p className="text-xs text-slate-400 text-center">Walk-in sale — no buyer required</p>} */}
              </div>
            )}
          </div>

          {/* Cart items */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex-1 flex flex-col min-h-[120px]">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Sale Items</span>
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
                    className="lg:hidden text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200"
                  >
                    ← Select Crop to Add
                  </button>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item._key} className="px-3 py-2.5 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-slate-900 leading-tight truncate">
                        {item.crop_name}{item.variety_name ? <span className="text-emerald-700"> — {item.variety_name}</span> : null}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.bags > 0 ? `${item.bags} bags · ` : ''}{item.physical_weight_kg.toLocaleString()} kg delivered · {item.billableWeightKg.toLocaleString()} kg billable · Rs. {item.rate_per_40kg.toLocaleString()}/40kg
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-emerald-800 text-sm">Rs. {item.saleAmountPkr.toLocaleString()}</span>
                      <button onClick={() => handleRemoveFromCart(item._key)} className="text-slate-300 hover:text-rose-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-700">Subtotal</span>
                <span className="font-extrabold text-slate-900">Rs. {cartTotal.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Shared expense + notes */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Deductions / Expenses (optional)</span>
            </div>
            <div className="px-3 py-3 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Amount (PKR)</label>
                  <input type="number" step="1" min="0" placeholder="0" value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Description</label>
                  <input type="text" placeholder="e.g. Transport" value={expenseNotes}
                    onChange={(e) => setExpenseNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Invoice Notes</label>
                <input type="text" placeholder="Optional notes for this invoice" value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          </div>

          {/* Grand total + finalize */}
          <div className="shrink-0 space-y-2">
            {cart.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 font-semibold">Grand Total</p>
                  {Number(expenseAmount) > 0 && (
                    <p className="text-[10px] text-emerald-600">After Rs. {Number(expenseAmount).toLocaleString()} expense</p>
                  )}
                </div>
                <span className="text-xl font-extrabold text-emerald-900">Rs. {grandTotal.toLocaleString()}</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{errorMsg}
              </div>
            )}
            <button onClick={handleFinalize} disabled={!cart.length || isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : `Finalize Sale (${cart.length} item${cart.length !== 1 ? 's' : ''})`}
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

        {/* ═══ RIGHT: Crop → Variety → Item Entry ═══════════ */}
        <div className={`${mobileTab === 'items' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col gap-2 overflow-y-auto lg:overflow-hidden pb-2`}>

          {/* Step 1: Crop selection */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Sprout className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Step 1 — Select Crop Category
              </span>
            </div>
            <div className="p-3">
              {crops.length === 0 ? (
                <div className="py-6 px-4 text-center">
                  <p className="text-sm font-semibold text-slate-600 mb-1">No crops registered yet</p>
                  <p className="text-xs text-slate-400 mb-3">Add crop types in Parties & Crop Catalog first.</p>
                  <a
                    href="/parties"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800"
                  >
                    Go to Crop Catalog →
                  </a>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {crops.map((crop) => {
                    // Total stock for crop (sum of all varieties + null variety)
                    const stock = getStockForCropAndVariety(crop.id, null) + (crop.varieties?.reduce((acc, v) => acc + getStockForCropAndVariety(crop.id, v.id), 0) || 0);
                    const isSelected = pickedCropId === crop.id;
                    return (
                      <button key={crop.id} type="button"
                        onClick={() => { setPickedCropId(crop.id); setPickedVarietyId(null); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-semibold transition ${isSelected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : stock > 0
                            ? 'border-slate-200 bg-white hover:border-emerald-300 text-slate-700'
                            : 'border-slate-100 bg-slate-50 text-slate-400 opacity-60'
                          }`}
                        title={stock <= 0 ? 'No overall stock' : ''}
                      >
                        <Sprout className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-green-600'}`} />
                        {crop.name}
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>{stock.toLocaleString()} kg total</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Variety selection (only if crop has varieties) */}
          {pickedCrop && pickedVarieties.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Step 2 — Select Variety / Type <span className="text-slate-400 font-normal normal-case">(of {pickedCrop.name})</span>
                </span>
              </div>
              <div className="p-3 flex flex-wrap gap-2">
                {(() => {
                  const nullStock = getStockForCropAndVariety(pickedCrop.id, null);
                  return (
                    <button type="button"
                      onClick={() => setPickedVarietyId(null)}
                      disabled={nullStock <= 0}
                      className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${!pickedVarietyId ? 'border-blue-400 bg-blue-50 text-blue-800' : nullStock > 0 ? 'border-slate-200 text-slate-600 hover:border-slate-300' : 'border-slate-100 text-slate-400 opacity-50'
                        }`}>
                      No Variety ({nullStock} kg)
                    </button>
                  );
                })()}
                {pickedVarieties.map((v) => {
                  const vStock = getStockForCropAndVariety(pickedCrop.id, v.id);
                  return (
                    <button key={v.id} type="button"
                      onClick={() => setPickedVarietyId(v.id)}
                      disabled={vStock <= 0}
                      className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${pickedVarietyId === v.id
                        ? 'border-blue-400 bg-blue-50 text-blue-800'
                        : vStock > 0 ? 'border-slate-200 text-slate-700 hover:border-blue-300' : 'border-slate-100 text-slate-400 opacity-50'
                        }`}>
                      {v.name} ({vStock} kg)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Item entry form */}
          {pickedCrop && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {pickedVarieties.length > 0 ? 'Step 3' : 'Step 2'} — Enter Weight & Rate
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  {pickedCrop.name}{pickedVariety ? ` — ${pickedVariety.name}` : ''}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bags</label>
                    <input type="number" step="1" min="0" placeholder="0"
                      value={itemBags} onChange={(e) => setItemBags(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Physical Weight (kg) <span className="text-rose-500">*</span>
                    </label>
                    <input type="number" step="1" min="1" placeholder="e.g. 1200"
                      value={itemWeight} onChange={(e) => setItemWeight(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Commission / 40 kg (kg)</label>
                    <input type="number" step="0.5" min="0"
                      value={itemCommission} onChange={(e) => setItemCommission(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Rate / 40 kg (PKR) <span className="text-rose-500">*</span>
                    </label>
                    <input type="number" step="1" min="1" placeholder="e.g. 3200"
                      value={itemRate} onChange={(e) => setItemRate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bardana / Bag (kg)</label>
                    <input type="number" step="0.1" min="0" placeholder="e.g. 0.5"
                      value={itemBardana} onChange={(e) => setItemBardana(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>

                {/* Mini calc preview */}
                {Number(itemWeight) > 0 && Number(itemRate) > 0 && (
                  <div className="flex flex-wrap items-center gap-3 text-xs mb-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                    <span className="text-slate-500">Comm: <strong className="text-rose-600">−{liveCalc.commissionWeightKg} kg</strong></span>
                    {liveCalc.bardanaWeightKg > 0 && <><span className="text-slate-300">|</span><span className="text-slate-500">Bardana: <strong className="text-amber-600">−{liveCalc.bardanaWeightKg} kg</strong></span></>}
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">Billable: <strong className="text-blue-700">{liveCalc.billableWeightKg} kg</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">Amount: <strong className="text-emerald-800">Rs. {liveCalc.saleAmountPkr.toLocaleString()}</strong></span>
                  </div>
                )}

                <button type="button" onClick={handleAddToCart} disabled={!isItemReady}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-4 h-4" /> Add to Sale
                </button>
              </div>
            </div>
          )}

          {/* Hint when no crop selected */}
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
