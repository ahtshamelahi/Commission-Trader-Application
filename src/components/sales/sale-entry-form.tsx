'use client';

// components/sales/sale-entry-form.tsx
// Spec-B: bardana by TOTAL weight (kg), bag revenue, buyer commission %, stock preview,
// AND full Payment Method (Full / Partial / Credit) with Khata balance calculation.
// Robust stock resolution: uses stock_movements when available, with fallback to purchases - sales
// Touch: user enters EITHER an amount (Rs.) deducted from the crop sale amount after bardana,
//        OR a weight (kg) deducted from the weight after bardana. Optional touch note.
//
// UI (v3): dense 12-column grid, same system as the purchase form. Inputs on the left in three
// blocks, sticky summary + stock preview + save on the right.
// Only layout / styling changed. All state, calculations, validation and saving are untouched.

import React, { useState, useCallback } from 'react';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { StockMovement } from '@/types/stock-data-types';
import { Purchase } from '@/types/purchase-data-types';
import { Sale } from '@/types/sale-data-types';
import { performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { resolveAvailableStockKg } from '@/lib/calculations/current-stock-calculation';
import { saveSaleTransactionV2 } from '@/lib/actions/save-sale-transaction-v2';
import { CheckCircle2, AlertCircle, Loader2, X, Download, ChevronDown } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const r6 = (n: number) => Math.round((n + Number.EPSILON) * 1000000) / 1000000;

function safeNum(v: string, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function fmtKg(n: number) {
  return `${n.toLocaleString('en-PK', { maximumFractionDigits: 3 })} kg`;
}
function fmtRs(n: number) {
  return `Rs. ${n.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
}
const today = () => new Date().toISOString().split('T')[0];

// ── types ─────────────────────────────────────────────────────────────────────
export interface BuyerOption extends Party {
  outstanding?: number | null;
}

interface SaleEntryFormProps {
  crops: Crop[];
  buyers: BuyerOption[];
  stockMovements?: StockMovement[];
  purchases?: Purchase[];
  sales?: Sale[];
  onSuccess?: () => void;
}

type PaymentMode = 'full' | 'partial' | 'none';

interface ReceiptData {
  invoiceNo: string;
  saleDate: string;
  buyerName: string;
  cropName: string;
  varietyName: string;
  actualWeightSoldKg: number;
  bardanaDeductionKg: number;
  touchWeightKg: number;
  touchAmountPkr: number;
  touchNote: string;
  netSaleWeightKg: number;
  pricePerUnit: number;
  cropSaleBeforeTouchPkr: number;
  cropSaleAmountPkr: number;
  numBags: number;
  pricePerBagPkr: number;
  totalBagRevenuePkr: number;
  baseSaleAmountPkr: number;
  commissionPct: number;
  commissionAmountPkr: number;
  finalAmountReceivablePkr: number;
  paymentMode: PaymentMode;
  amountReceived: number;
  remainingDue: number;
  availableStockBefore: number;
  physicalStockToRemoveKg: number;
  remainingStockKg: number;
}

// ── style tokens (compact) ────────────────────────────────────────────────────
const FIELD_LABEL = 'block mb-0.5 text-xs text-slate-500';
const INPUT =
  'h-8 w-full rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-900 placeholder:text-slate-400 ' +
  'focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
const INPUT_ERR = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500';
const SELECT = `${INPUT} appearance-none pr-7 cursor-pointer`;
const NUM = 'text-right tabular-nums';
const READONLY =
  'flex h-8 items-center justify-end rounded border border-slate-200 bg-slate-50 px-2 text-[13px] font-semibold tabular-nums text-slate-800';
const RECEIPT_ROW = 'flex items-center justify-between gap-3 border-b border-slate-100 py-1 text-xs last:border-0';
const RECEIPT_LABEL = 'text-slate-500';
const RECEIPT_VALUE = 'font-medium tabular-nums text-slate-800';

// ── small layout helpers ──────────────────────────────────────────────────────
function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <label htmlFor={htmlFor} className={FIELD_LABEL}>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-0.5 text-[11px] leading-tight text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-slate-200 px-3 py-2.5 last:border-b-0">
      <h2 className="mb-1.5 flex h-4 items-center justify-between text-xs font-semibold text-slate-700">
        <span>{title}</span>
        {aside}
      </h2>
      {children}
    </section>
  );
}

function SummaryRow({
  label,
  value,
  tone = 'text-slate-800',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-xs">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`font-medium tabular-nums ${tone}`}>{value}</dd>
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────
export function SaleEntryForm({
  crops,
  buyers,
  stockMovements = [],
  purchases = [],
  sales = [],
  onSuccess
}: SaleEntryFormProps) {

  // ── sale info ──────────────────────────────────────────────────────────────
  const [saleDate, setSaleDate] = useState(today());
  const [buyerId, setBuyerId] = useState('');
  const [cropId, setCropId] = useState('');
  const [varietyId, setVarietyId] = useState('');
  const [actualWeightSold, setActualWeightSold] = useState('');

  // ── bardana (total weight) + crop amount ──────────────────────────────────
  const [bardanaTotalKg, setBardanaTotalKg] = useState('0'); // total bardana weight (kg)
  const [pricePerUnit, setPricePerUnit] = useState('');

  // touch (either amount OR weight) + note
  const [touchAmount, setTouchAmount] = useState('');
  const [touchWeightKg, setTouchWeightKg] = useState('');
  const [touchNote, setTouchNote] = useState('');

  // ── bags ──────────────────────────────────────────────────────────────────
  const [numBags, setNumBags] = useState('0');
  const [pricePerBag, setPricePerBag] = useState('0');

  // ── commission ────────────────────────────────────────────────────────────
  const [commissionPct, setCommissionPct] = useState('0');

  // ── payment & khata ────────────────────────────────────────────────────────
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('full');
  const [partialAmount, setPartialAmount] = useState('');
  const [notes, setNotes] = useState('');

  // ── ui state ──────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // ── derived ───────────────────────────────────────────────────────────────
  const pickedCrop = crops.find((c) => c.id === Number(cropId)) || null;
  const varieties: CropVariety[] = pickedCrop?.varieties || [];
  const selectedBuyer = buyers.find((b) => b.id === Number(buyerId)) || null;

  const handleCropChange = (id: string) => {
    setCropId(id);
    setVarietyId(''); // reset variety when crop changes
  };

  // ── touch handlers (only one of amount / weight can be used) ──────────────
  const handleTouchAmountChange = (v: string) => {
    setTouchAmount(v);
    // when touch becomes empty, also clear its note
    if (!(safeNum(v) > 0) && !(safeNum(touchWeightKg) > 0)) setTouchNote('');
  };
  const handleTouchWeightChange = (v: string) => {
    setTouchWeightKg(v);
    if (!(safeNum(v) > 0) && !(safeNum(touchAmount) > 0)) setTouchNote('');
  };
  const clearTouch = () => {
    setTouchAmount('');
    setTouchWeightKg('');
    setTouchNote('');
  };

  // Available stock = gross purchases − physical sales + adjustments (same as Stock page)
  const availableStockKg = (() => {
    if (!cropId) return 0;
    const cid = Number(cropId);
    const vid = varietyId ? Number(varietyId) : null;

    const matchVariety = (rowVid: number | null | undefined) =>
      vid === null ? true : rowVid === vid;

    const relevantPurchases = purchases.filter(
      (p) => p.crop_id === cid && matchVariety(p.variety_id)
    );
    const relevantSales = sales.filter(
      (s) => s.crop_id === cid && matchVariety(s.variety_id)
    );
    const relevantMovements = stockMovements.filter((m) => {
      if (m.crop_id !== cid) return false;
      return matchVariety((m as { variety_id?: number | null }).variety_id);
    });

    return resolveAvailableStockKg({
      purchases: relevantPurchases,
      sales: relevantSales,
      movements: relevantMovements,
    });
  })();

  const actualWeightNum = safeNum(actualWeightSold);
  const priceNum = safeNum(pricePerUnit);

  // Bardana deduction (total kg) — entered directly by the user (shown on screen / receipt)
  const bardanaKgNum = Math.max(0, safeNum(bardanaTotalKg));
  const bardanaDeductionKg = r3(bardanaKgNum);

  const touchKgNum = Math.max(0, safeNum(touchWeightKg));
  const touchAmountNum = Math.max(0, safeNum(touchAmount));
  const hasTouch = touchKgNum > 0 || touchAmountNum > 0;

  // How touch reaches the existing calculation (no change to the calculation itself):
  //  • Touch WEIGHT (kg) is a weight deduction after bardana  → added to the deduction weight.
  //  • Touch AMOUNT (Rs.) is a rupee deduction from the crop sale amount. Crop sale amount is
  //    net weight ÷ 40 × price, so Rs. X equals X ÷ price × 40 kg → added to the deduction weight.
  // Commission % and bag revenue then work on the reduced crop sale amount as usual.
  const touchAmountAsKg = priceNum > 0 ? (touchAmountNum * 40) / priceNum : 0;
  const effBardanaDeductionKg = r6(bardanaKgNum + touchKgNum + touchAmountAsKg);

  // live calculations
  const calc = performSaleCalculations(
    safeNum(actualWeightSold),
    effBardanaDeductionKg,
    safeNum(pricePerUnit),
    Math.max(0, Math.floor(safeNum(numBags))),
    safeNum(pricePerBag),
    safeNum(commissionPct)
  );

  // values shown to the user (kept separate so bardana / touch are not mixed up)
  const netBeforeAmountTouch = Math.max(0, actualWeightNum - bardanaKgNum - touchKgNum);
  const cropSaleBeforeTouch = r2((netBeforeAmountTouch / 40) * priceNum); // before the touch AMOUNT
  const netSaleWeightShown =
    touchAmountNum > 0 ? r3(Math.max(0, actualWeightNum - bardanaKgNum)) : calc.netSaleWeightKg;

  const grandTotal = calc.finalAmountReceivablePkr;

  // Live payment numbers
  let amountReceived = 0;
  if (paymentMode === 'full') {
    amountReceived = grandTotal;
  } else if (paymentMode === 'partial') {
    amountReceived = Math.max(0, Math.min(grandTotal, safeNum(partialAmount)));
  } else {
    amountReceived = 0;
  }
  const remainingDue = Math.max(0, r2(grandTotal - amountReceived));

  // Current buyer balance
  // In the Khata system: balance > 0 means buyer owes shop (receivable). balance < 0 means shop owes buyer.
  const currentOutstanding = selectedBuyer?.outstanding ?? 0;
  // If we sell on credit (remainingDue > 0), buyer owes more to the shop:
  // new balance = currentOutstanding + remainingDue
  const projectedBalance = currentOutstanding + remainingDue;

  const remainingStockKg = Math.max(0, availableStockKg - safeNum(actualWeightSold));
  const isStockInsufficient = !!cropId && safeNum(actualWeightSold) > availableStockKg;

  // ── field-level validation ─────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!saleDate) e.saleDate = 'Date is required.';
    if (!cropId) e.cropId = 'Please select a crop.';
    if (!actualWeightSold || safeNum(actualWeightSold) <= 0) e.actualWeightSold = 'Enter a positive actual weight sold.';
    if (isStockInsufficient) e.actualWeightSold = `Exceeds available stock (${fmtKg(availableStockKg)}).`;
    if (safeNum(bardanaTotalKg) < 0) e.bardanaTotalKg = 'Bardana weight cannot be negative.';
    if (safeNum(bardanaTotalKg) > safeNum(actualWeightSold)) e.bardanaTotalKg = 'Bardana weight cannot exceed actual weight sold.';
    if (!pricePerUnit || safeNum(pricePerUnit) <= 0) e.pricePerUnit = 'Enter a price per 40 kg.';
    if (safeNum(numBags) < 0) e.numBags = 'Bags cannot be negative.';
    if (safeNum(pricePerBag) < 0) e.pricePerBag = 'Price per bag cannot be negative.';
    if (safeNum(commissionPct) < 0) e.commissionPct = 'Commission cannot be negative.';

    // touch: amount OR weight (never both), never negative, never more than what is left
    if (safeNum(touchAmount) < 0) e.touchAmount = 'Touch amount cannot be negative.';
    if (safeNum(touchWeightKg) < 0) e.touchWeightKg = 'Touch weight cannot be negative.';
    if (safeNum(touchAmount) > 0 && safeNum(touchWeightKg) > 0) {
      e.touch = 'Enter touch either in amount or in weight, not both.';
    }
    if (
      safeNum(touchWeightKg) > 0 &&
      safeNum(actualWeightSold) > 0 &&
      safeNum(bardanaTotalKg) + safeNum(touchWeightKg) > safeNum(actualWeightSold)
    ) {
      e.touchWeightKg = 'Bardana + touch weight cannot exceed actual weight sold.';
    }
    if (
      safeNum(touchAmount) > 0 &&
      safeNum(pricePerUnit) > 0 &&
      safeNum(touchAmount) > cropSaleBeforeTouch
    ) {
      e.touchAmount = 'Touch amount cannot exceed the crop sale amount after bardana.';
    }

    if (paymentMode === 'partial') {
      const partVal = safeNum(partialAmount, -1);
      if (partVal < 0 || partVal > grandTotal) {
        e.partialAmount = `Partial amount must be between Rs. 0 and Rs. ${grandTotal.toLocaleString()}`;
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [saleDate, cropId, actualWeightSold, isStockInsufficient, availableStockKg, bardanaTotalKg, pricePerUnit, numBags, pricePerBag, commissionPct, touchAmount, touchWeightKg, cropSaleBeforeTouch, paymentMode, partialAmount, grandTotal]);

  // ── submit ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    // Touch is recorded in the transaction notes so it can be read back later
    const touchLine = hasTouch
      ? `Touch: ${touchAmountNum > 0 ? fmtRs(touchAmountNum) : fmtKg(touchKgNum)}${touchNote.trim() ? ` — ${touchNote.trim()}` : ''
      }`
      : '';
    const combinedNotes = [notes.trim(), touchLine].filter(Boolean).join(' | ');

    const res = await saveSaleTransactionV2({
      sale_date: saleDate,
      buyer_id: buyerId ? Number(buyerId) : null,
      crop_id: Number(cropId),
      variety_id: varietyId ? Number(varietyId) : null,
      actual_weight_sold_kg: safeNum(actualWeightSold),
      bardana_deduction_kg: effBardanaDeductionKg,
      price_per_40kg: safeNum(pricePerUnit),
      num_bags: Math.max(0, Math.floor(safeNum(numBags))),
      price_per_bag_pkr: safeNum(pricePerBag),
      commission_pct: safeNum(commissionPct),
      payment_mode: paymentMode,
      amount_received: amountReceived,
      notes: combinedNotes || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setReceipt({
        invoiceNo: res.invoiceNo!,
        saleDate,
        buyerName: selectedBuyer?.name || 'Walk-in / Cash Buyer',
        cropName: pickedCrop?.name || '—',
        varietyName: varieties.find((v) => v.id === Number(varietyId))?.name || '',
        actualWeightSoldKg: safeNum(actualWeightSold),
        bardanaDeductionKg,
        touchWeightKg: touchKgNum,
        touchAmountPkr: touchAmountNum,
        touchNote: hasTouch ? touchNote.trim() : '',
        netSaleWeightKg: netSaleWeightShown,
        pricePerUnit: safeNum(pricePerUnit),
        cropSaleBeforeTouchPkr: cropSaleBeforeTouch,
        cropSaleAmountPkr: calc.cropSaleAmountPkr,
        numBags: Math.max(0, Math.floor(safeNum(numBags))),
        pricePerBagPkr: safeNum(pricePerBag),
        totalBagRevenuePkr: calc.totalBagRevenuePkr,
        baseSaleAmountPkr: calc.baseSaleAmountPkr,
        commissionPct: safeNum(commissionPct),
        commissionAmountPkr: calc.commissionAmountPkr,
        finalAmountReceivablePkr: calc.finalAmountReceivablePkr,
        paymentMode,
        amountReceived: res.amountReceived ?? amountReceived,
        remainingDue: res.remainingDue ?? remainingDue,
        availableStockBefore: availableStockKg,
        physicalStockToRemoveKg: calc.physicalStockToRemoveKg,
        remainingStockKg,
      });

      // reset form
      setSaleDate(today());
      setBuyerId('');
      setCropId('');
      setVarietyId('');
      setActualWeightSold('');
      setBardanaTotalKg('0');
      setPricePerUnit('');
      setTouchAmount('');
      setTouchWeightKg('');
      setTouchNote('');
      setNumBags('0');
      setPricePerBag('0');
      setCommissionPct('0');
      setPaymentMode('full');
      setPartialAmount('');
      setNotes('');
      setErrors({});
      if (onSuccess) onSuccess();
    } else {
      setErrors({ _form: res.message || 'Failed to save sale.' });
    }
  };

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Receipt Modal ──────────────────────────────────────────────────── */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="flex max-h-[94vh] w-full max-w-sm flex-col overflow-hidden rounded-lg bg-white shadow-xl">
            {/* header */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold text-slate-900">Sale saved</p>
                  <p className="font-mono text-[11px] text-slate-500">{receipt.invoiceNo}</p>
                </div>
              </div>
              <button
                onClick={() => setReceipt(null)}
                aria-label="Close"
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* body */}
            <div id="sale-receipt-printable" className="flex-1 space-y-2 overflow-y-auto px-4 py-2.5 text-slate-800">
              <div className="border-b border-dashed border-slate-200 pb-1.5 text-center">
                <p className="text-sm font-bold text-slate-900">M-Shafiq Commission Shop</p>
                <p className="text-[11px] text-slate-400">Crop Commission Agent — Grain & Commodity Trade</p>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                <span className="text-slate-500">Invoice</span><span className="text-right font-mono font-semibold">{receipt.invoiceNo}</span>
                <span className="text-slate-500">Date</span><span className="text-right font-medium">{receipt.saleDate}</span>
                <span className="text-slate-500">Buyer</span><span className="text-right font-semibold">{receipt.buyerName}</span>
                <span className="text-slate-500">Crop</span><span className="text-right font-medium">{receipt.cropName}{receipt.varietyName ? ` — ${receipt.varietyName}` : ''}</span>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1">
                <p className="mb-0.5 text-[11px] font-semibold text-slate-500">Weight & settlement</p>
                <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Actual weight sold</span><span className={RECEIPT_VALUE}>{fmtKg(receipt.actualWeightSoldKg)}</span></div>
                <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Bardana weight</span><span className="font-medium tabular-nums text-rose-600">− {fmtKg(receipt.bardanaDeductionKg)}</span></div>
                {receipt.touchWeightKg > 0 && (
                  <div className={RECEIPT_ROW}>
                    <span className={RECEIPT_LABEL}>Touch (weight){receipt.touchNote ? ` — ${receipt.touchNote}` : ''}</span>
                    <span className="font-medium tabular-nums text-rose-600">− {fmtKg(receipt.touchWeightKg)}</span>
                  </div>
                )}
                <div className={RECEIPT_ROW}><span className="font-medium text-emerald-700">Net sale weight</span><span className="font-semibold tabular-nums text-emerald-800">{fmtKg(receipt.netSaleWeightKg)}</span></div>
                <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Rate / 40 kg</span><span className={RECEIPT_VALUE}>{fmtRs(receipt.pricePerUnit)}</span></div>
                {receipt.touchAmountPkr > 0 && (
                  <>
                    <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Crop amount (before touch)</span><span className={RECEIPT_VALUE}>{fmtRs(receipt.cropSaleBeforeTouchPkr)}</span></div>
                    <div className={RECEIPT_ROW}>
                      <span className={RECEIPT_LABEL}>Touch (amount){receipt.touchNote ? ` — ${receipt.touchNote}` : ''}</span>
                      <span className="font-medium tabular-nums text-rose-600">− {fmtRs(receipt.touchAmountPkr)}</span>
                    </div>
                  </>
                )}
                <div className={RECEIPT_ROW}><span className="font-medium text-slate-700">Crop sale amount</span><span className="font-semibold tabular-nums text-slate-900">{fmtRs(receipt.cropSaleAmountPkr)}</span></div>
              </div>

              {(receipt.totalBagRevenuePkr > 0 || receipt.commissionAmountPkr > 0) && (
                <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <p className="mb-0.5 text-[11px] font-semibold text-slate-500">Additions & bags</p>
                  {receipt.totalBagRevenuePkr > 0 && (
                    <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Bags ({receipt.numBags} × {fmtRs(receipt.pricePerBagPkr)})</span><span className={RECEIPT_VALUE}>{fmtRs(receipt.totalBagRevenuePkr)}</span></div>
                  )}
                  {receipt.commissionAmountPkr > 0 && (
                    <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Buyer commission ({receipt.commissionPct}%)</span><span className="font-medium tabular-nums text-violet-700">+ {fmtRs(receipt.commissionAmountPkr)}</span></div>
                  )}
                </div>
              )}

              <div className="space-y-0.5 border-t-2 border-slate-300 pt-1.5 text-xs">
                <div className="flex justify-between text-sm font-bold">
                  <span>Grand total receivable</span>
                  <span className="tabular-nums text-slate-900">{fmtRs(receipt.finalAmountReceivablePkr)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Received now ({receipt.paymentMode === 'full' ? 'Full' : receipt.paymentMode === 'partial' ? 'Partial' : 'Credit'})</span>
                  <span className="font-semibold tabular-nums text-emerald-700">{fmtRs(receipt.amountReceived)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Remaining to khata</span>
                  <span className={`font-semibold tabular-nums ${receipt.remainingDue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {fmtRs(receipt.remainingDue)}
                  </span>
                </div>
                <div className="flex justify-between pt-0.5 text-slate-500">
                  <span>Physical stock deducted</span>
                  <span className="font-medium tabular-nums">{fmtKg(receipt.physicalStockToRemoveKg)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Stock remaining</span>
                  <span className="font-medium tabular-nums">{fmtKg(receipt.remainingStockKg)}</span>
                </div>
              </div>

              <p className="border-t border-dashed border-slate-200 pt-1.5 text-center text-[11px] text-slate-400">
                Thank you for your business · Computer generated receipt
              </p>
            </div>

            {/* footer actions */}
            <div className="flex shrink-0 gap-2 border-t border-slate-200 px-4 py-2">
              <button
                onClick={() => window.print()}
                className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded bg-slate-800 text-xs font-medium text-white hover:bg-slate-900"
              >
                <Download className="h-3.5 w-3.5" /> Print receipt
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="h-8 flex-1 rounded border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Form ──────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl">

        {errors._form && (
          <div className="mb-2 flex items-start gap-2 rounded border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {errors._form}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">

          {/* ═══════════════ LEFT: inputs ═══════════════ */}
          <div className="rounded border border-slate-200 bg-white">

            {/* ── Sale information ────────────────────────────────────────── */}
            <Section title="Sale information">
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 md:grid-cols-12">

                <Field label="Sale date" htmlFor="sale-date" required error={errors.saleDate} className="md:col-span-3">
                  <input
                    id="sale-date"
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                    className={`${INPUT} ${errors.saleDate ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Buyer (optional)" htmlFor="sale-buyer" className="col-span-2 md:col-span-5">
                  <div className="relative">
                    <select
                      id="sale-buyer"
                      value={buyerId}
                      onChange={(e) => setBuyerId(e.target.value)}
                      className={SELECT}
                    >
                      <option value="">— Walk-in / Cash buyer —</option>
                      {buyers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                          {b.outstanding !== undefined && b.outstanding !== null
                            ? b.outstanding > 0
                              ? ` (Receivable: Rs. ${b.outstanding.toLocaleString()})`
                              : b.outstanding < 0
                                ? ` (Advance: Rs. ${Math.abs(b.outstanding).toLocaleString()})`
                                : ' (Rs. 0)'
                            : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                  {selectedBuyer && (
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                      Khata:{' '}
                      <span className={`font-medium ${currentOutstanding > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                        {currentOutstanding > 0
                          ? `Rs. ${currentOutstanding.toLocaleString()} (buyer owes shop)`
                          : currentOutstanding < 0
                            ? `Rs. ${Math.abs(currentOutstanding).toLocaleString()} (advance with shop)`
                            : 'Rs. 0 (settled)'}
                      </span>
                    </p>
                  )}
                </Field>

                <Field label="Actual weight sold (kg)" htmlFor="sale-actual-weight" required error={errors.actualWeightSold} className="col-span-2 md:col-span-4">
                  <input
                    id="sale-actual-weight"
                    type="number"
                    step="100"
                    min="0"
                    placeholder="e.g. 2100"
                    value={actualWeightSold}
                    onChange={(e) => setActualWeightSold(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.actualWeightSold || isStockInsufficient ? INPUT_ERR : ''}`}
                  />
                  {isStockInsufficient && !errors.actualWeightSold && (
                    <p className="mt-0.5 text-[11px] font-medium leading-tight text-rose-600">
                      Exceeds available stock of {fmtKg(availableStockKg)}
                    </p>
                  )}
                </Field>

                <Field label="Crop" htmlFor="sale-crop" required error={errors.cropId} className="md:col-span-4">
                  <div className="relative">
                    <select
                      id="sale-crop"
                      value={cropId}
                      onChange={(e) => handleCropChange(e.target.value)}
                      className={`${SELECT} ${errors.cropId ? INPUT_ERR : ''}`}
                    >
                      <option value="">— Select crop —</option>
                      {crops.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                </Field>

                {varieties.length > 0 && (
                  <Field label="Crop variety" htmlFor="sale-variety" className="md:col-span-4">
                    <div className="relative">
                      <select
                        id="sale-variety"
                        value={varietyId}
                        onChange={(e) => setVarietyId(e.target.value)}
                        className={SELECT}
                      >
                        <option value="">— All varieties / unspecified —</option>
                        {varieties.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </Field>
                )}

                {cropId && (
                  <div className="col-span-2 min-w-0 md:col-span-4">
                    <span className={FIELD_LABEL}>Available stock</span>
                    <div
                      className={`${READONLY} ${availableStockKg > 0 ? 'text-emerald-700' : 'text-rose-600'}`}
                    >
                      {fmtKg(availableStockKg)}
                    </div>
                  </div>
                )}

              </div>
            </Section>

            {/* ── Bardana, touch & crop sale amount ───────────────────────── */}
            <Section
              title="Bardana, touch & crop sale amount"
              aside={
                hasTouch ? (
                  <button
                    type="button"
                    onClick={clearTouch}
                    className="text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    Clear touch
                  </button>
                ) : null
              }
            >
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 md:grid-cols-6">
                <Field label="Bardana weight (kg)" htmlFor="sale-bardana-total" error={errors.bardanaTotalKg}>
                  <input
                    id="sale-bardana-total"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 25"
                    value={bardanaTotalKg}
                    onChange={(e) => setBardanaTotalKg(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.bardanaTotalKg ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Price / 40 kg (Rs.)" htmlFor="sale-price" required error={errors.pricePerUnit}>
                  <input
                    id="sale-price"
                    type="number"
                    step="100"
                    min="1"
                    placeholder="e.g. 3200"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.pricePerUnit ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Touch amount (Rs.)" htmlFor="sale-touch-amount" error={errors.touchAmount}>
                  <input
                    id="sale-touch-amount"
                    type="number"
                    step="1"
                    min="0"
                    placeholder="0"
                    value={touchAmount}
                    disabled={touchKgNum > 0}
                    onChange={(e) => handleTouchAmountChange(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.touchAmount || errors.touch ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Touch weight (kg)" htmlFor="sale-touch-weight" error={errors.touchWeightKg}>
                  <input
                    id="sale-touch-weight"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    value={touchWeightKg}
                    disabled={touchAmountNum > 0}
                    onChange={(e) => handleTouchWeightChange(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.touchWeightKg || errors.touch ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Touch note" htmlFor="sale-touch-note" className="col-span-2">
                  <input
                    id="sale-touch-note"
                    type="text"
                    placeholder={hasTouch ? 'Note about touch' : 'Enter touch first'}
                    value={touchNote}
                    disabled={!hasTouch}
                    onChange={(e) => setTouchNote(e.target.value)}
                    className={INPUT}
                  />
                </Field>
              </div>

              {errors.touch && <p className="mt-1 text-[11px] text-rose-600">{errors.touch}</p>}
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Bardana is subtracted from actual weight sold. Touch: enter either an amount (deducted from the crop sale
                amount after bardana) or a weight (deducted after bardana); the note is active only when touch is entered.
              </p>

              {/* Live results — one compact line */}
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-0.5 border-t border-slate-100 pt-1.5 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-slate-500">Bardana</dt>
                  <dd className="font-medium tabular-nums text-rose-600">{fmtKg(bardanaDeductionKg)}</dd>
                </div>
                {touchKgNum > 0 && (
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">Touch weight</dt>
                    <dd className="font-medium tabular-nums text-amber-700">{fmtKg(touchKgNum)}</dd>
                  </div>
                )}
                {touchAmountNum > 0 && (
                  <div className="flex gap-1.5">
                    <dt className="text-slate-500">Touch amount</dt>
                    <dd className="font-medium tabular-nums text-amber-700">{fmtRs(touchAmountNum)}</dd>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <dt className="text-slate-500">Net sale weight</dt>
                  <dd className="font-medium tabular-nums text-emerald-700">{fmtKg(netSaleWeightShown)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-slate-500">
                    Crop sale amount{touchAmountNum > 0 ? ' (after touch)' : ''}
                  </dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{fmtRs(calc.cropSaleAmountPkr)}</dd>
                </div>
              </dl>
            </Section>

            {/* ── Bags & commission ───────────────────────────────────────── */}
            <Section title="Bags & buyer commission (optional)">
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 md:grid-cols-6">
                <Field label="Number of bags" htmlFor="sale-bags" error={errors.numBags}>
                  <input
                    id="sale-bags"
                    type="number"
                    step="1"
                    min="0"
                    value={numBags}
                    onChange={(e) => setNumBags(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.numBags ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Selling price / bag (Rs.)" htmlFor="sale-price-per-bag" error={errors.pricePerBag}>
                  <input
                    id="sale-price-per-bag"
                    type="number"
                    step="10"
                    min="0"
                    value={pricePerBag}
                    onChange={(e) => setPricePerBag(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.pricePerBag ? INPUT_ERR : ''}`}
                  />
                </Field>

                <div className="min-w-0">
                  <span className={FIELD_LABEL}>Total bag revenue</span>
                  <div className={READONLY}>{fmtRs(calc.totalBagRevenuePkr)}</div>
                </div>

                <Field label="Commission (%)" htmlFor="sale-commission-pct" error={errors.commissionPct}>
                  <input
                    id="sale-commission-pct"
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="0"
                    value={commissionPct}
                    onChange={(e) => setCommissionPct(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.commissionPct ? INPUT_ERR : ''}`}
                  />
                </Field>

                <div className="min-w-0">
                  <span className={FIELD_LABEL}>Base amount (crop + bags)</span>
                  <div className={READONLY}>{fmtRs(calc.baseSaleAmountPkr)}</div>
                </div>

                <div className="min-w-0">
                  <span className={FIELD_LABEL}>Commission amount</span>
                  <div className={`${READONLY} text-violet-700`}>{fmtRs(calc.commissionAmountPkr)}</div>
                </div>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Commission increases the amount receivable from the buyer (base × {safeNum(commissionPct) || '0'}%). Default 0.
              </p>
            </Section>

            {/* ── Payment method & khata ──────────────────────────────────── */}
            <Section title="Payment & buyer khata">
              <div className="grid grid-cols-1 gap-x-2.5 gap-y-1.5 md:grid-cols-12">

                {/* Payment mode — segmented control */}
                <div className="min-w-0 md:col-span-5">
                  <span className={FIELD_LABEL}>
                    Payment mode <span className="text-rose-500">*</span>
                  </span>
                  <div role="radiogroup" aria-label="Payment mode" className="grid h-8 grid-cols-3 overflow-hidden rounded border border-slate-300">
                    {[
                      { id: 'full' as PaymentMode, title: 'Full', desc: 'Receive entire amount now' },
                      { id: 'partial' as PaymentMode, title: 'Partial', desc: 'Receive some now, rest to khata' },
                      { id: 'none' as PaymentMode, title: 'Credit', desc: 'No payment — 100% added to khata' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={paymentMode === m.id}
                        title={m.desc}
                        onClick={() => setPaymentMode(m.id)}
                        className={`border-l border-slate-300 px-2 text-xs font-medium first:border-l-0 ${paymentMode === m.id
                          ? 'bg-blue-700 text-white'
                          : 'bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMode === 'partial' && (
                  <Field label="Amount received now (Rs.)" htmlFor="sale-partial-amount" required error={errors.partialAmount} className="md:col-span-3">
                    <input
                      id="sale-partial-amount"
                      type="number"
                      step="1"
                      min="0"
                      max={grandTotal}
                      placeholder="Enter amount received"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      className={`${INPUT} ${NUM} ${errors.partialAmount ? INPUT_ERR : ''}`}
                    />
                  </Field>
                )}

                <Field
                  label="Notes / reference (optional)"
                  htmlFor="sale-notes"
                  className={paymentMode === 'partial' ? 'md:col-span-4' : 'md:col-span-7'}
                >
                  <input
                    id="sale-notes"
                    type="text"
                    placeholder="e.g. Paid via cash, bank transfer ref"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={INPUT}
                  />
                </Field>
              </div>

              {/* Buyer Khata Impact Preview */}
              {selectedBuyer && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700">Khata — {selectedBuyer.name}:</span>
                  <span>
                    Current{' '}
                    {currentOutstanding > 0
                      ? `receivable ${fmtRs(currentOutstanding)}`
                      : currentOutstanding < 0
                        ? `advance ${fmtRs(Math.abs(currentOutstanding))}`
                        : 'Rs. 0'}
                  </span>
                  <span>→</span>
                  <span className="font-semibold text-slate-800">
                    After sale{' '}
                    {projectedBalance > 0
                      ? `receivable ${fmtRs(projectedBalance)}`
                      : projectedBalance < 0
                        ? `advance ${fmtRs(Math.abs(projectedBalance))}`
                        : 'Rs. 0'}
                  </span>
                  {remainingDue > 0 && (
                    <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800">
                      + {fmtRs(remainingDue)} added to buyer&apos;s ledger
                    </span>
                  )}
                </p>
              )}
            </Section>
          </div>

          {/* ═══════════════ RIGHT: summary + stock + save ═══════════════ */}
          <aside className="rounded border border-slate-200 bg-white lg:sticky lg:top-2">
            <h2 className="border-b border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Sales summary
            </h2>

            <dl className="px-3 py-1.5">
              <SummaryRow label="Actual weight sold" value={fmtKg(actualWeightNum)} />
              <SummaryRow label="Bardana" value={`− ${fmtKg(bardanaDeductionKg)}`} tone="text-rose-600" />
              {touchKgNum > 0 && (
                <SummaryRow label="Touch (weight)" value={`− ${fmtKg(touchKgNum)}`} tone="text-rose-600" />
              )}
              <SummaryRow label="Net sale weight" value={fmtKg(netSaleWeightShown)} tone="text-emerald-700" />

              <div className="my-1 border-t border-slate-100" />

              <SummaryRow label="Crop sale amount" value={fmtRs(calc.cropSaleAmountPkr)} />
              {touchAmountNum > 0 && (
                <SummaryRow label="Touch (amount) deducted" value={`− ${fmtRs(touchAmountNum)}`} tone="text-rose-600" />
              )}
              <SummaryRow label="Bag revenue" value={fmtRs(calc.totalBagRevenuePkr)} />
              <SummaryRow label="Base amount" value={fmtRs(calc.baseSaleAmountPkr)} />
              {safeNum(commissionPct) > 0 && (
                <SummaryRow
                  label={`Commission (${safeNum(commissionPct)}%)`}
                  value={`+ ${fmtRs(calc.commissionAmountPkr)}`}
                  tone="text-violet-700"
                />
              )}

              <div className="mt-1 flex items-baseline justify-between border-t-2 border-slate-300 pt-1">
                <dt className="text-xs font-semibold text-slate-700">Final amount receivable</dt>
                <dd className="text-base font-bold tabular-nums text-slate-900">{fmtRs(calc.finalAmountReceivablePkr)}</dd>
              </div>

              <div className="my-1 border-t border-slate-100" />

              <SummaryRow
                label={`Received now (${paymentMode === 'full' ? 'full' : paymentMode === 'partial' ? 'partial' : 'credit'})`}
                value={fmtRs(amountReceived)}
                tone="text-emerald-700"
              />
              <SummaryRow
                label="Remaining to khata"
                value={fmtRs(remainingDue)}
                tone={remainingDue > 0 ? 'text-rose-600' : 'text-slate-800'}
              />

              <div className="my-1 border-t border-slate-100" />

              {/* stock preview */}
              <SummaryRow label="Available stock" value={cropId ? fmtKg(availableStockKg) : '—'} />
              <SummaryRow label="Physical stock to remove" value={fmtKg(calc.physicalStockToRemoveKg)} tone="text-rose-600" />
              <SummaryRow
                label="Remaining after sale"
                value={fmtKg(remainingStockKg)}
                tone={isStockInsufficient ? 'text-rose-600' : 'text-emerald-700'}
              />
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                Stock removed equals the actual weight sold. Bardana and touch deductions are for settlement only.
              </p>
            </dl>

            <div className="border-t border-slate-200 p-2.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting || isStockInsufficient}
                className="flex h-9 w-full items-center justify-center gap-2 rounded bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save sale'
                )}
              </button>
            </div>
          </aside>

        </div>
      </div>
    </>
  );
}