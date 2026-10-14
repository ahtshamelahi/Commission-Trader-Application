'use client';

// components/sales/pos-sale-form.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { saveMultiSaleTransaction } from '@/lib/actions/save-multi-sale-transaction';
import type { MultiSaleItem } from '@/lib/actions/save-multi-sale-transaction';
import { getSaleReceipt } from '@/lib/actions/sale-receipt-actions';
import type { SaleReceipt } from '@/lib/actions/sale-receipt-actions';
import {
  CheckCircle2, AlertCircle, Loader2, User, Printer, X, Store, Sprout, Trash2,
  Plus, Phone, Receipt, ChevronDown, Wallet, BookOpen,
} from 'lucide-react';

export interface BuyerOption extends Party {
  /** outstanding Khata balance; null when it could not be loaded */
  outstanding: number | null;
}

interface PosSaleFormProps {
  crops: Crop[];
  buyers: BuyerOption[];
  purchases: Purchase[];
  sales: Sale[];
  cropsLoading?: boolean;
  buyersLoading?: boolean;
  stockLoading?: boolean;
  loadError?: string;
}

interface CartItem extends MultiSaleItem {
  _key: string;
  commissionWeightKg: number;
  bardanaWeightKg: number;
  billableWeightKg: number;
  saleAmountPkr: number;
}

type PaymentMode = 'full' | 'partial' | 'none';
type AdjustmentKind = 'deduct' | 'add';

const SHOP_NAME = 'M-Shafiq Commission Shop';
const SHOP_TAGLINE = 'Crop Commission Agent — Grain & Commodity Trade';

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n: number) => n.toLocaleString('en-PK', { maximumFractionDigits: 2 });
const newRequestId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function PosSaleForm({
  crops, buyers, purchases, sales,
  cropsLoading = false, buyersLoading = false, stockLoading = false, loadError = '',
}: PosSaleFormProps) {
  const router = useRouter();

  // Buyer (mandatory, existing parties only)
  const [selectedBuyerId, setSelectedBuyerId] = useState<number | null>(null);
  const [buyerSearch, setBuyerSearch] = useState('');
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [buyerError, setBuyerError] = useState(false);
  const buyerBoxRef = useRef<HTMLDivElement>(null);

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

  // Adjustment (+ or -), vehicle, notes
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentKind, setAdjustmentKind] = useState<AdjustmentKind>('deduct');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');

  // Payment (must be chosen explicitly)
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);
  const [partialAmount, setPartialAmount] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const submitLock = useRef(false); // blocks a second click before React re-renders
  const requestIdRef = useRef('');  // same id for retries of one sale -> no duplicates
  const getRequestId = () => {
    if (!requestIdRef.current) requestIdRef.current = newRequestId();
    return requestIdRef.current;
  };

  // After save
  const [saved, setSaved] = useState<{ invoiceId: number; invoiceNo: string; buyerId: number } | null>(null);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'items' | 'cart'>('items');
  const [justAddedMsg, setJustAddedMsg] = useState(false);

  // close buyer dropdown when clicking outside
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (buyerBoxRef.current && !buyerBoxRef.current.contains(e.target as Node)) setBuyerOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const selectedBuyer = buyers.find((b) => b.id === selectedBuyerId) || null;
  const filteredBuyers = buyers.filter((b) => {
    const q = buyerSearch.trim().toLowerCase();
    return !q || b.name.toLowerCase().includes(q) || (b.phone || '').includes(q);
  });

  const pickedCrop = crops.find((c) => c.id === pickedCropId) || null;
  const pickedVarieties: CropVariety[] = pickedCrop?.varieties || [];
  const pickedVariety = pickedVarieties.find((v) => v.id === pickedVarietyId) || null;

  // existing stock rule (unchanged): gross purchased - physical sold
  const getStockForCropAndVariety = (cropId: number, varietyId: number | null) => {
    const vPurchases = purchases.filter((p) => p.crop_id === cropId && p.variety_id === varietyId);
    const vSales = sales.filter((s) => s.crop_id === cropId && s.variety_id === varietyId);
    const totalPurchasedKg = vPurchases.reduce((acc, p) => acc + Number(p.gross_weight_kg), 0);
    const totalSoldKg = vSales.reduce((acc, s) => acc + Number(s.physical_weight_kg), 0);
    return totalPurchasedKg - totalSoldKg;
  };
  const kgLabel = (n: number) => (stockLoading ? '…' : n.toLocaleString());

  // Live calc for current item entry (existing formula, unchanged)
  const liveCalc = performSaleCalculations(
    Number(itemWeight) || 0,
    Number(itemCommission) || 0,
    Number(itemRate) || 0,
    Number(itemBags) || 0,
    Number(itemBardana) || 0
  );

  // Totals
  const cartTotal = round2(cart.reduce((s, i) => s + i.saleAmountPkr, 0));
  const adjustmentValue = Number(adjustmentAmount) || 0;
  const signedAdjustment = adjustmentKind === 'add' ? adjustmentValue : -adjustmentValue;
  const grandTotal = round2(cartTotal + signedAdjustment);

  // Payment amounts (update instantly with option / amount changes)
  const amountReceived =
    paymentMode === 'full' ? grandTotal
    : paymentMode === 'partial' ? round2(Number(partialAmount) || 0)
    : 0;
  const remainingDue = round2(grandTotal - amountReceived);
  const partialInvalid =
    paymentMode === 'partial' && (amountReceived < 0 || amountReceived > grandTotal);

  const isItemReady = !!pickedCropId && Number(itemWeight) > 0 && Number(itemRate) > 0;

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
      _key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

  const handleRemoveFromCart = (key: string) => setCart((prev) => prev.filter((i) => i._key !== key));

  const resetAll = () => {
    setSelectedBuyerId(null);
    setBuyerSearch('');
    setBuyerOpen(false);
    setBuyerError(false);
    setPickedCropId(null);
    setPickedVarietyId(null);
    setItemBags('');
    setItemWeight('');
    setItemCommission('1.5');
    setItemBardana('');
    setItemRate('');
    setCart([]);
    setAdjustmentAmount('');
    setAdjustmentKind('deduct');
    setAdjustmentNotes('');
    setInvoiceNotes('');
    setVehicleNumber('');
    setPaymentMode(null);
    setPartialAmount('');
    setErrorMsg('');
    setMobileTab('items');
    setJustAddedMsg(false);
    requestIdRef.current = newRequestId(); // next sale gets a fresh id
  };

  const handleSave = async () => {
    if (submitLock.current) return;
    setErrorMsg('');

    // ---- validation ----
    if (!selectedBuyer) {
      setBuyerError(true);
      setErrorMsg('Please select a buyer before saving the sale.');
      return;
    }
    if (!cart.length) { setErrorMsg('Add at least one item to the sale.'); return; }
    if (grandTotal < 0) { setErrorMsg('The adjustment is larger than the sale total.'); return; }
    if (!paymentMode) { setErrorMsg('Choose a payment option: full, partial or no payment.'); return; }
    if (paymentMode === 'partial') {
      if (!partialAmount || Number(partialAmount) < 0 || !Number.isFinite(Number(partialAmount))) {
        setErrorMsg('Enter the amount received (0 or more).');
        return;
      }
      if (amountReceived > grandTotal) {
        setErrorMsg('Amount received cannot be more than the sale total.');
        return;
      }
    }

    submitLock.current = true;
    setIsSubmitting(true);

    try {
      const res = await saveMultiSaleTransaction({
        request_id: getRequestId(),
        buyer_id: selectedBuyer.id,
        items: cart.map(({ _key, commissionWeightKg, bardanaWeightKg, billableWeightKg, saleAmountPkr, ...item }) => item),
        adjustment_amount: adjustmentValue,
        adjustment_is_income: adjustmentKind === 'add',
        adjustment_notes: adjustmentNotes,
        vehicle_number: vehicleNumber || undefined,
        notes: invoiceNotes,
        amount_received: amountReceived,
      });

      if (!res.success || !res.invoiceId || !res.invoiceNo) {
        setErrorMsg(res.message || 'Failed to save sale.');
        return;
      }

      // saved: show success + load the receipt from the saved records
      const buyerId = selectedBuyer.id;
      setSaved({ invoiceId: res.invoiceId, invoiceNo: res.invoiceNo, buyerId });
      setReceipt(null);
      setReceiptError('');
      setReceiptLoading(true);
      resetAll();

      const rec = await getSaleReceipt(res.invoiceId);
      if (rec.success && rec.receipt) setReceipt(rec.receipt);
      else setReceiptError(rec.message || 'Sale saved, but the receipt could not be loaded.');
      setReceiptLoading(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save sale.');
      setReceiptLoading(false);
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const closeSaved = () => {
    setSaved(null);
    setReceipt(null);
    setReceiptError('');
  };

  const payOptions: { id: PaymentMode; title: string; hint: string }[] = [
    { id: 'full', title: 'Full payment', hint: 'Received in full' },
    { id: 'partial', title: 'Partial payment', hint: 'Enter amount received' },
    { id: 'none', title: 'No payment', hint: 'All goes to Khata' },
  ];

  return (
    <>
      {/* ── Saved sale: success + receipt (loaded from saved records) ── */}
      {saved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[96vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-emerald-700 text-white rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5" />
                <div>
                  <p className="font-bold text-sm">Sale Saved!</p>
                  <p className="text-xs text-emerald-100 font-mono">{saved.invoiceNo}</p>
                </div>
              </div>
              <button onClick={closeSaved} aria-label="Close" className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div id="sale-receipt-printable" className="overflow-y-auto flex-1 p-5 space-y-3 text-slate-800">
              {receiptLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading receipt…
                </div>
              )}
              {receiptError && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  {receiptError} Your sale is saved under reference <span className="font-mono font-bold">{saved.invoiceNo}</span>.
                </div>
              )}
              {receipt && (
                <>
                  <div className="text-center border-b-2 border-dashed border-slate-200 pb-3">
                    <div className="flex items-center justify-center gap-2 mb-0.5">
                      <Store className="w-4 h-4 text-emerald-700" />
                      <span className="font-extrabold text-slate-900">{SHOP_NAME}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">{SHOP_TAGLINE}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-slate-500">Receipt No.</span>
                    <span className="font-bold text-right font-mono">{receipt.invoiceNo}</span>
                    <span className="text-slate-500">Date &amp; time</span>
                    <span className="font-semibold text-right text-[11px]">
                      {new Date(receipt.createdAt).toLocaleString('en-PK', {
                        timeZone: 'Asia/Karachi', day: '2-digit', month: 'long', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200 text-xs">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Buyer</p>
                    <p className="font-bold text-sm">{receipt.buyerName}</p>
                    {receipt.buyerPhone && <p className="text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{receipt.buyerPhone}</p>}
                    {receipt.buyerAddress && <p className="text-slate-500 mt-0.5">{receipt.buyerAddress}</p>}
                    {receipt.vehicleNumber && <p className="text-slate-700 font-semibold mt-0.5">Vehicle: <span className="font-bold tracking-wide">{receipt.vehicleNumber}</span></p>}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Items</p>
                    {receipt.items.map((item, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-lg p-2.5">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-sm text-slate-900">
                            {idx + 1}. {item.cropName}{item.varietyName ? ` — ${item.varietyName}` : ''}
                          </span>
                          <span className="font-extrabold text-emerald-800 text-sm">Rs. {fmt(item.saleAmountPkr)}</span>
                        </div>
                        <table className="w-full text-xs text-slate-600">
                          <tbody>
                            {item.bags > 0 && <tr><td>Bags</td><td className="text-right font-semibold">{item.bags}</td></tr>}
                            <tr><td>Physical weight</td><td className="text-right font-semibold">{fmt(item.physicalWeightKg)} kg</td></tr>
                            <tr><td>Commission ({item.commissionPer40kg} kg/40kg)</td><td className="text-right text-rose-600">−{fmt(item.commissionWeightKg)} kg</td></tr>
                            {item.bardanaWeightKg > 0 && <tr><td>Bardana ({item.bardanaPerBagKg} kg × {item.bags} bags)</td><td className="text-right text-amber-600">−{fmt(item.bardanaWeightKg)} kg</td></tr>}
                            <tr><td className="text-blue-700 font-semibold">Billable weight</td><td className="text-right text-blue-700 font-bold">{fmt(item.billableWeightKg)} kg</td></tr>
                            <tr><td>Rate / 40 kg</td><td className="text-right">Rs. {fmt(item.ratePer40kg)}</td></tr>
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Items total</span>
                      <span className="font-bold">Rs. {fmt(receipt.itemsTotal)}</span>
                    </div>
                    {receipt.adjustmentAmount > 0 && (
                      <div className={`flex justify-between ${receipt.adjustmentIsIncome ? 'text-emerald-700' : 'text-rose-600'}`}>
                        <span>{receipt.adjustmentIsIncome ? 'Added' : 'Deducted'}{receipt.adjustmentNotes ? ` (${receipt.adjustmentNotes})` : ''}</span>
                        <span className="font-semibold">{receipt.adjustmentIsIncome ? '+' : '−'}Rs. {fmt(receipt.adjustmentAmount)}</span>
                      </div>
                    )}
                  </div>
                  <div className="bg-emerald-700 text-white rounded-xl px-4 py-3 flex items-center justify-between">
                    <span className="font-bold text-sm">Total Sale Amount</span>
                    <span className="text-xl font-extrabold">Rs. {fmt(receipt.grandTotal)}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">Amount received</span><span className="font-bold text-emerald-700">Rs. {fmt(receipt.amountReceived)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-600">Remaining amount due</span><span className={`font-extrabold ${receipt.remaining > 0 ? 'text-rose-600' : 'text-slate-800'}`}>Rs. {fmt(receipt.remaining)}</span></div>
                  </div>
                  <p className="text-center text-[10px] text-slate-400 border-t border-dashed border-slate-200 pt-2">Computer-generated receipt</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
              <button
                onClick={() => router.push(`/khata/sales?partyId=${saved.buyerId}`)}
                className="flex items-center justify-center gap-1.5 border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs py-2.5 rounded-lg transition"
              >
                <BookOpen className="w-3.5 h-3.5" /> View Sale
              </button>
              <button
                onClick={() => window.print()}
                disabled={!receipt}
                className="flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
              <button
                onClick={closeSaved}
                className="flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs py-2.5 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" /> Start New Sale
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

      {loadError && (
        <div className="mt-2 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-medium">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{loadError} Please refresh the page.
        </div>
      )}

      {/* ── Mobile Tab Navigation ── */}
      <div className="lg:hidden flex border border-slate-200 rounded-lg p-1 bg-slate-100 gap-1 mt-2">
        <button type="button" onClick={() => setMobileTab('items')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition ${mobileTab === 'items' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
          <Sprout className="w-3.5 h-3.5" />
          <span>1. Select Crop &amp; Enter</span>
        </button>
        <button type="button" onClick={() => setMobileTab('cart')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-bold transition relative ${mobileTab === 'cart' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
          <Receipt className="w-3.5 h-3.5" />
          <span>2. Buyer, Payment &amp; Save</span>
          {cart.length > 0 && (
            <span className={`text-[10px] px-1.5 rounded-full font-bold ml-1 ${mobileTab === 'cart' ? 'bg-white text-emerald-700' : 'bg-emerald-600 text-white'}`}>{cart.length}</span>
          )}
        </button>
      </div>

      {justAddedMsg && (
        <div className="lg:hidden flex items-center justify-between p-2.5 mt-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Item added! ({cart.length} in cart)</span>
          </div>
          <button type="button" onClick={() => setMobileTab('cart')} className="text-xs font-bold text-emerald-700 underline ml-2">
            Go to Buyer &amp; Payment →
          </button>
        </div>
      )}

      {/* ── POS Layout ── */}
      <div className="mt-3 flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-170px)] lg:min-h-[600px]">

        {/* ═══ LEFT: Buyer + Cart + Adjustment + Payment + Save ═══ */}
        <div className={`${mobileTab === 'cart' ? 'flex' : 'hidden'} lg:flex w-full lg:w-[380px] lg:shrink-0 flex-col gap-2 overflow-y-auto pb-2`}>

          {/* Buyer (required) */}
          <div className={`bg-white border rounded-xl shrink-0 ${buyerError && !selectedBuyer ? 'border-rose-400' : 'border-slate-200'}`}>
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 rounded-t-xl">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Buyer <span className="text-rose-500">*</span></span>
            </div>
            {selectedBuyer ? (
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">{selectedBuyer.name.charAt(0)}</div>
                  <div>
                    <p className="font-bold text-sm text-slate-900 leading-tight">{selectedBuyer.name}</p>
                    <p className="text-xs text-slate-500">
                      {selectedBuyer.phone || 'No phone'}
                      {selectedBuyer.outstanding !== null && <> · Balance due Rs. {fmt(selectedBuyer.outstanding)}</>}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => { setSelectedBuyerId(null); setBuyerSearch(''); }} aria-label="Change buyer" className="text-slate-300 hover:text-rose-500 transition"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="px-3 py-2.5">
                <div ref={buyerBoxRef} className="relative">
                  <input
                    type="text"
                    placeholder="Search buyer by name or phone…"
                    value={buyerSearch}
                    onFocus={() => setBuyerOpen(true)}
                    onChange={(e) => { setBuyerSearch(e.target.value); setBuyerOpen(true); }}
                    className="w-full pl-3 pr-8 py-1.5 text-sm border border-slate-300 rounded-lg placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                  {buyerOpen && (
                    <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {buyersLoading ? (
                        <p className="px-3 py-3 text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading buyers…</p>
                      ) : filteredBuyers.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-400">No buyers found. Buyers are managed in the Parties section.</p>
                      ) : (
                        filteredBuyers.map((b) => (
                          <button key={b.id} type="button"
                            onClick={() => { setSelectedBuyerId(b.id); setBuyerSearch(''); setBuyerOpen(false); setBuyerError(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                              {b.outstanding !== null && (
                                <span className={`text-[11px] font-semibold ${b.outstanding > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                  Due Rs. {fmt(b.outstanding)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{b.phone || 'No phone'}{b.party_type === 'both' ? ' · Supplier & Buyer' : ''}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {buyerError && <p className="mt-1.5 text-xs font-medium text-rose-600">A buyer must be selected.</p>}
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
                  <button type="button" onClick={() => setMobileTab('items')}
                    className="lg:hidden text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
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
                      <span className="font-bold text-emerald-800 text-sm">Rs. {fmt(item.saleAmountPkr)}</span>
                      <button type="button" onClick={() => handleRemoveFromCart(item._key)} aria-label="Remove item" className="text-slate-300 hover:text-rose-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {cart.length > 0 && (
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                <span className="text-xs font-bold text-slate-700">Items total</span>
                <span className="font-extrabold text-slate-900">Rs. {fmt(cartTotal)}</span>
              </div>
            )}
          </div>

          {/* Adjustment (+ or -), vehicle, notes */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Adjustment / Expense (optional)</span>
            </div>
            <div className="px-3 py-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAdjustmentKind('deduct')}
                  className={`py-1.5 rounded-lg border-2 text-xs font-bold ${adjustmentKind === 'deduct' ? 'border-rose-400 bg-rose-50 text-rose-700' : 'border-slate-200 text-slate-600'}`}>
                  − Deduct from total
                </button>
                <button type="button" onClick={() => setAdjustmentKind('add')}
                  className={`py-1.5 rounded-lg border-2 text-xs font-bold ${adjustmentKind === 'add' ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>
                  + Add to total
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Amount (PKR)</label>
                  <input type="number" step="1" min="0" placeholder="0" value={adjustmentAmount}
                    onChange={(e) => setAdjustmentAmount(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Reason</label>
                  <input type="text" placeholder="e.g. Transport" value={adjustmentNotes}
                    onChange={(e) => setAdjustmentNotes(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Vehicle No.</label>
                <input type="text" placeholder="e.g. LEA-123" value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Invoice Notes</label>
                <input type="text" placeholder="Optional notes for this invoice" value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Wallet className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment <span className="text-rose-500">*</span></span>
            </div>
            <div className="px-3 py-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {payOptions.map((o) => (
                  <button key={o.id} type="button" onClick={() => setPaymentMode(o.id)}
                    className={`p-2 rounded-lg border-2 text-left transition ${paymentMode === o.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                    <p className="text-xs font-bold text-slate-900 leading-tight">{o.title}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{o.hint}</p>
                  </button>
                ))}
              </div>

              {paymentMode === 'partial' && (
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Amount received now (PKR)</label>
                  <input type="number" step="1" min="0" placeholder="0" value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    className={`w-full px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 ${partialInvalid ? 'border-rose-400' : 'border-slate-300'}`} />
                  {partialInvalid && <p className="mt-1 text-xs text-rose-600">Amount must be between 0 and the sale total.</p>}
                </div>
              )}

              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-slate-600">Total sale amount</span><span className="font-bold">Rs. {fmt(grandTotal)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Amount received now</span><span className="font-bold text-emerald-700">Rs. {fmt(amountReceived)}</span></div>
                <div className="flex justify-between border-t border-slate-200 pt-1"><span className="text-slate-700 font-semibold">Remaining amount due</span><span className={`font-extrabold ${remainingDue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>Rs. {fmt(remainingDue)}</span></div>
                {selectedBuyer && selectedBuyer.outstanding !== null && paymentMode && (
                  <p className="text-[10px] text-slate-400 pt-0.5">
                    Buyer's balance after this sale: Rs. {fmt(selectedBuyer.outstanding + remainingDue)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Totals + save */}
          <div className="shrink-0 space-y-2">
            {cart.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-emerald-700 font-semibold">Total Sale Amount</p>
                  {adjustmentValue > 0 && (
                    <p className="text-[10px] text-emerald-600">
                      {adjustmentKind === 'add' ? '+' : '−'} Rs. {fmt(adjustmentValue)} adjustment included
                    </p>
                  )}
                </div>
                <span className="text-xl font-extrabold text-emerald-900">Rs. {fmt(grandTotal)}</span>
              </div>
            )}
            {errorMsg && (
              <div className="flex items-start gap-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{errorMsg}
              </div>
            )}
            <button type="button" onClick={handleSave} disabled={!cart.length || isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm py-3 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : `Save Sale (${cart.length} item${cart.length !== 1 ? 's' : ''})`}
            </button>
            <button type="button" onClick={() => setMobileTab('items')}
              className="lg:hidden w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900 py-1">
              ← Back to Select Crops
            </button>
          </div>
        </div>

        {/* ═══ RIGHT: Crop → Variety → Item Entry ═══ */}
        <div className={`${mobileTab === 'items' ? 'flex' : 'hidden'} lg:flex flex-1 flex-col gap-2 overflow-y-auto lg:overflow-hidden pb-2`}>

          {/* Step 1: Crop selection */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shrink-0">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
              <Sprout className="w-3.5 h-3.5 text-green-600" />
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Step 1 — Select Crop Category</span>
            </div>
            <div className="p-3">
              {cropsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2].map((i) => <div key={i} className="h-10 w-36 rounded-lg bg-slate-100 animate-pulse" />)}
                </div>
              ) : crops.length === 0 ? (
                <div className="py-6 px-4 text-center">
                  <p className="text-sm font-semibold text-slate-600 mb-1">No crops registered yet</p>
                  <p className="text-xs text-slate-400 mb-3">Add crop types in the Crop Catalog first.</p>
                  <a href="/parties" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800">
                    Go to Crop Catalog →
                  </a>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {crops.map((crop) => {
                    const stock = getStockForCropAndVariety(crop.id, null) + (crop.varieties?.reduce((acc, v) => acc + getStockForCropAndVariety(crop.id, v.id), 0) || 0);
                    const isSelected = pickedCropId === crop.id;
                    return (
                      <button key={crop.id} type="button"
                        onClick={() => { setPickedCropId(crop.id); setPickedVarietyId(null); }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-semibold transition ${isSelected
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : stockLoading || stock > 0
                            ? 'border-slate-200 bg-white hover:border-emerald-300 text-slate-700'
                            : 'border-slate-100 bg-slate-50 text-slate-400 opacity-60'}`}
                        title={!stockLoading && stock <= 0 ? 'No overall stock' : ''}
                      >
                        <Sprout className={`w-4 h-4 ${isSelected ? 'text-emerald-600' : 'text-green-600'}`} />
                        {crop.name}
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {kgLabel(stock)} kg total
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Variety selection */}
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
                    <button type="button" onClick={() => setPickedVarietyId(null)}
                      disabled={!stockLoading && nullStock <= 0}
                      className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${!pickedVarietyId ? 'border-blue-400 bg-blue-50 text-blue-800' : stockLoading || nullStock > 0 ? 'border-slate-200 text-slate-600 hover:border-slate-300' : 'border-slate-100 text-slate-400 opacity-50'}`}>
                      No Variety ({kgLabel(nullStock)} kg)
                    </button>
                  );
                })()}
                {pickedVarieties.map((v) => {
                  const vStock = getStockForCropAndVariety(pickedCrop.id, v.id);
                  return (
                    <button key={v.id} type="button" onClick={() => setPickedVarietyId(v.id)}
                      disabled={!stockLoading && vStock <= 0}
                      className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${pickedVarietyId === v.id
                        ? 'border-blue-400 bg-blue-50 text-blue-800'
                        : stockLoading || vStock > 0 ? 'border-slate-200 text-slate-700 hover:border-blue-300' : 'border-slate-100 text-slate-400 opacity-50'}`}>
                      {v.name} ({kgLabel(vStock)} kg)
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
                  {pickedVarieties.length > 0 ? 'Step 3' : 'Step 2'} — Enter Weight &amp; Rate
                </span>
                <span className="text-xs font-semibold text-emerald-700">
                  {pickedCrop.name}{pickedVariety ? ` — ${pickedVariety.name}` : ''}
                </span>
              </div>
              <div className="px-4 py-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bags</label>
                    <input type="number" step="1" min="0" placeholder="0" value={itemBags} onChange={(e) => setItemBags(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Physical Weight (kg) <span className="text-rose-500">*</span>
                    </label>
                    <input type="number" step="1" min="1" placeholder="e.g. 1200" value={itemWeight} onChange={(e) => setItemWeight(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Commission / 40 kg (kg)</label>
                    <input type="number" step="0.5" min="0" value={itemCommission} onChange={(e) => setItemCommission(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Rate / 40 kg (PKR) <span className="text-rose-500">*</span>
                    </label>
                    <input type="number" step="1" min="1" placeholder="e.g. 3200" value={itemRate} onChange={(e) => setItemRate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Bardana / Bag (kg)</label>
                    <input type="number" step="0.1" min="0" placeholder="e.g. 0.5" value={itemBardana} onChange={(e) => setItemBardana(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>

                {Number(itemWeight) > 0 && Number(itemRate) > 0 && (
                  <div className="flex flex-wrap items-center gap-3 text-xs mb-3 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                    <span className="text-slate-500">Comm: <strong className="text-rose-600">−{liveCalc.commissionWeightKg} kg</strong></span>
                    {liveCalc.bardanaWeightKg > 0 && <><span className="text-slate-300">|</span><span className="text-slate-500">Bardana: <strong className="text-amber-600">−{liveCalc.bardanaWeightKg} kg</strong></span></>}
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">Billable: <strong className="text-blue-700">{liveCalc.billableWeightKg} kg</strong></span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">Amount: <strong className="text-emerald-800">Rs. {fmt(liveCalc.saleAmountPkr)}</strong></span>
                  </div>
                )}

                <button type="button" onClick={handleAddToCart} disabled={!isItemReady}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-4 h-4" /> Add to Sale
                </button>
              </div>
            </div>
          )}

          {!pickedCrop && (
            <div className="flex-1 flex items-center justify-center bg-white border border-dashed border-slate-300 rounded-xl min-h-[160px]">
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