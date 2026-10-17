'use client';

// components/purchases/purchase-entry-form.tsx
// Spec-A: deduction-rate model, kunda (flat), bags section, stock preview,
// AND full Payment Method (Full / Partial / Credit) with Khata balance calculation.
// Bardana: user enters TOTAL bardana weight (kg), which is subtracted from actual weight.
// Touch: user enters EITHER an amount (Rs.) deducted from the crop amount after bardana,
//        OR a weight (kg) deducted from the weight after bardana. Optional touch note.
//
// UI (v3): dense 12-column grid. Inputs on the left in three blocks, sticky summary + save on the right.
// Only layout / styling changed vs. v2. All state, calculations, validation and saving are untouched.

import React, { useState, useCallback } from 'react';
import { Crop, CropVariety } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { performPurchaseCalculations } from '@/lib/calculations/purchase-amount-calculation';
import { savePurchaseTransactionV2 } from '@/lib/actions/save-purchase-transaction-v2';
import { CheckCircle2, AlertCircle, Loader2, X, Download, ChevronDown } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const r3 = (n: number) => Math.round((n + Number.EPSILON) * 1000) / 1000;

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

// ── types ─────────────────────────────────────────────────────────────────────
export interface SupplierOption extends Party {
  outstanding?: number | null;
}

interface PurchaseEntryFormProps {
  crops: Crop[];
  suppliers: SupplierOption[];
  onSuccess?: () => void;
}

type PaymentMode = 'full' | 'partial' | 'none';

interface ReceiptData {
  invoiceNo: string;
  purchaseDate: string;
  supplierName: string;
  cropName: string;
  varietyName: string;
  actualWeightKg: number;
  deductionRate: number;
  deductionBasisKg: number;
  deductionWeightKg: number;
  bardanaRate: number;
  bardanaBasisKg: number;
  bardanaWeightKg: number;
  touchWeightKg: number;
  touchAmountPkr: number;
  touchNote: string;
  netPayableWeightKg: number;
  pricePerUnit: number;
  cropAmountBeforeTouchPkr: number;
  cropPaymentPkr: number;
  kundaAmountPkr: number;
  numBags: number;
  pricePerBagPkr: number;
  totalBagAmountPkr: number;
  totalPurchaseAmountPkr: number;
  physicalStockToAddKg: number;
  paymentMode: PaymentMode;
  amountPaid: number;
  remainingDue: number;
}

// ── style tokens (compact) ────────────────────────────────────────────────────
const FIELD_LABEL = 'block mb-0.5 text-xs text-slate-500';
const INPUT =
  'h-8 w-full rounded border border-slate-300 bg-white px-2 text-[13px] text-slate-900 text-left tabular-nums placeholder:text-slate-400 ' +
  'focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 ' +
  'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';
const INPUT_ERR = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500';
const SELECT = `${INPUT} appearance-none pr-7 cursor-pointer`;
const NUM = 'text-left tabular-nums';
const RECEIPT_ROW = 'flex items-center justify-between gap-3 border-b border-slate-100 py-1 text-xs last:border-0';
const RECEIPT_LABEL = 'text-slate-500';
const RECEIPT_VALUE = 'font-medium tabular-nums text-slate-800';

const today = () => new Date().toISOString().split('T')[0];

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
export function PurchaseEntryForm({ crops, suppliers, onSuccess }: PurchaseEntryFormProps) {

  // ── section 1: purchase info ───────────────────────────────────────────────
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [supplierId, setSupplierId] = useState('');
  const [cropId, setCropId] = useState('');
  const [varietyId, setVarietyId] = useState('');
  const [actualWeight, setActualWeight] = useState('');

  // ── section 2: deduction + crop payment ───────────────────────────────────
  const [deductionRate, setDeductionRate] = useState('0');
  const [deductionBasisKg, setDeductionBasisKg] = useState('40');
  const [bardanaTotalKg, setBardanaTotalKg] = useState('0'); // total bardana weight (kg)
  const [pricePerUnit, setPricePerUnit] = useState('');

  // touch (either amount OR weight) + note
  const [touchAmount, setTouchAmount] = useState('');
  const [touchWeightKg, setTouchWeightKg] = useState('');
  const [touchNote, setTouchNote] = useState('');

  // ── kunda ─────────────────────────────────────────────────────────────────
  const [kundaAmount, setKundaAmount] = useState('0');

  // ── bags ──────────────────────────────────────────────────────────────────
  const [numBags, setNumBags] = useState('0');
  const [pricePerBag, setPricePerBag] = useState('0');

  // ── payment & khata state ──────────────────────────────────────────────────
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('none');
  const [partialAmount, setPartialAmount] = useState('');
  const [notes, setNotes] = useState('');

  // ── ui state ──────────────────────────────────────────────────────────────
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // ── derived ───────────────────────────────────────────────────────────────
  const pickedCrop = crops.find((c) => c.id === Number(cropId)) || null;
  const varieties: CropVariety[] = pickedCrop?.varieties || [];
  const selectedSupplier = suppliers.find((s) => s.id === Number(supplierId)) || null;

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

  // Total bardana weight entered by user, converted to the rate/basis the calc expects.
  // The Touch WEIGHT (kg) is also a weight deduction after bardana, so it is added to the
  // same total:  rate = (bardana kg + touch kg), basis = actual weight
  //              =>  actual × rate ÷ basis = bardana kg + touch kg
  const actualWeightNum = safeNum(actualWeight);
  const bardanaKgNum = Math.max(0, safeNum(bardanaTotalKg));
  const touchKgNum = Math.max(0, safeNum(touchWeightKg));
  const touchAmountNum = Math.max(0, safeNum(touchAmount));
  const hasTouch = touchKgNum > 0 || touchAmountNum > 0;

  const effBardanaRate = actualWeightNum > 0 ? bardanaKgNum + touchKgNum : 0;
  const effBardanaBasisKg = actualWeightNum > 0 ? actualWeightNum : 40;

  // The Touch AMOUNT (Rs.) is a flat rupee deduction from the crop amount, so it is added to
  // the flat deduction (kunda) that the calc subtracts from the total.
  const effKundaAmount = safeNum(kundaAmount) + touchAmountNum;

  // live calculations — run on every render from controlled inputs
  const calc = performPurchaseCalculations(
    safeNum(actualWeight),
    safeNum(deductionRate),
    safeNum(pricePerUnit),
    effKundaAmount,
    Math.max(0, Math.floor(safeNum(numBags))),
    safeNum(pricePerBag),
    safeNum(deductionBasisKg),
    effBardanaRate,
    effBardanaBasisKg
  );

  // values shown to the user (kept separate so bardana / touch / kunda are not mixed up)
  const bardanaShownKg = actualWeightNum > 0 ? bardanaKgNum : 0;
  const cropAmountBeforeTouch = calc.cropPaymentPkr; // after bardana + touch weight
  const cropPaymentAfterTouch = r2(cropAmountBeforeTouch - touchAmountNum); // after touch amount too

  const grandTotal = calc.totalPurchaseAmountPkr;

  // Live payment numbers
  let amountPaid = 0;
  if (paymentMode === 'full') {
    amountPaid = grandTotal;
  } else if (paymentMode === 'partial') {
    amountPaid = Math.max(0, Math.min(grandTotal, safeNum(partialAmount)));
  } else {
    amountPaid = 0;
  }
  const remainingDue = Math.max(0, r2(grandTotal - amountPaid));

  // Current supplier balance
  // In the Khata system: balance < 0 means shop owes supplier (payable). balance > 0 means supplier owes shop.
  const currentOutstanding = selectedSupplier?.outstanding ?? 0;
  // If we purchase on credit (remainingDue > 0), shop owes more to the supplier:
  // new balance = currentOutstanding - remainingDue
  const projectedBalance = currentOutstanding - remainingDue;

  // ── field-level validation ─────────────────────────────────────────────────
  const deductionWeightKgCalc = calc.deductionWeightKg;

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {};
    if (!purchaseDate) e.purchaseDate = 'Date is required.';
    if (!supplierId) e.supplierId = 'Please select a supplier.';
    if (!cropId) e.cropId = 'Please select a crop.';
    if (!actualWeight || safeNum(actualWeight) <= 0) e.actualWeight = 'Enter a positive actual weight.';
    if (safeNum(deductionRate) < 0) e.deductionRate = 'Deduction rate cannot be negative.';
    if (safeNum(deductionBasisKg) <= 0) e.deductionBasisKg = 'Enter a weight greater than zero.';
    if (safeNum(bardanaTotalKg) < 0) e.bardanaTotalKg = 'Bardana weight cannot be negative.';
    if (safeNum(bardanaTotalKg) > safeNum(actualWeight)) e.bardanaTotalKg = 'Bardana weight cannot exceed actual weight.';
    if (!pricePerUnit || safeNum(pricePerUnit) <= 0) e.pricePerUnit = 'Enter a price per 40 kg.';
    if (safeNum(kundaAmount) < 0) e.kundaAmount = 'Kunda cannot be negative.';
    if (safeNum(numBags) < 0) e.numBags = 'Bags cannot be negative.';
    if (safeNum(pricePerBag) < 0) e.pricePerBag = 'Price per bag cannot be negative.';

    // touch: amount OR weight (never both), never negative, never more than what is left
    if (safeNum(touchAmount) < 0) e.touchAmount = 'Touch amount cannot be negative.';
    if (safeNum(touchWeightKg) < 0) e.touchWeightKg = 'Touch weight cannot be negative.';
    if (safeNum(touchAmount) > 0 && safeNum(touchWeightKg) > 0) {
      e.touch = 'Enter touch either in amount or in weight, not both.';
    }
    if (
      safeNum(touchWeightKg) > 0 &&
      safeNum(actualWeight) > 0 &&
      safeNum(bardanaTotalKg) + safeNum(touchWeightKg) + deductionWeightKgCalc > safeNum(actualWeight)
    ) {
      e.touchWeightKg = 'Bardana + touch weight cannot exceed actual weight.';
    }
    if (
      safeNum(touchAmount) > 0 &&
      safeNum(pricePerUnit) > 0 &&
      safeNum(touchAmount) > cropAmountBeforeTouch
    ) {
      e.touchAmount = 'Touch amount cannot exceed the crop amount after bardana.';
    }

    if (paymentMode === 'partial') {
      const partVal = safeNum(partialAmount, -1);
      if (partVal < 0 || partVal > grandTotal) {
        e.partialAmount = `Partial amount must be between Rs. 0 and Rs. ${grandTotal.toLocaleString()}`;
      }
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  }, [purchaseDate, supplierId, cropId, actualWeight, deductionRate, deductionBasisKg, bardanaTotalKg, pricePerUnit, kundaAmount, numBags, pricePerBag, touchAmount, touchWeightKg, deductionWeightKgCalc, cropAmountBeforeTouch, paymentMode, partialAmount, grandTotal]);

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

    const res = await savePurchaseTransactionV2({
      purchase_date: purchaseDate,
      supplier_id: Number(supplierId),
      crop_id: Number(cropId),
      variety_id: varietyId ? Number(varietyId) : null,
      actual_weight_kg: safeNum(actualWeight),
      deduction_rate: safeNum(deductionRate),
      deduction_basis_kg: safeNum(deductionBasisKg),
      bardana_rate: effBardanaRate,
      bardana_basis_kg: effBardanaBasisKg,
      price_per_40kg: safeNum(pricePerUnit),
      kunda_amount_pkr: effKundaAmount,
      num_bags: Math.max(0, Math.floor(safeNum(numBags))),
      price_per_bag_pkr: safeNum(pricePerBag),
      payment_mode: paymentMode,
      amount_paid: amountPaid,
      notes: combinedNotes || undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      setReceipt({
        invoiceNo: res.invoiceNo!,
        purchaseDate,
        supplierName: selectedSupplier?.name || '—',
        cropName: pickedCrop?.name || '—',
        varietyName: varieties.find((v) => v.id === Number(varietyId))?.name || '',
        actualWeightKg: safeNum(actualWeight),
        deductionRate: safeNum(deductionRate),
        deductionBasisKg: safeNum(deductionBasisKg),
        deductionWeightKg: calc.deductionWeightKg,
        bardanaRate: effBardanaRate,
        bardanaBasisKg: effBardanaBasisKg,
        bardanaWeightKg: bardanaShownKg,
        touchWeightKg: touchKgNum,
        touchAmountPkr: touchAmountNum,
        touchNote: hasTouch ? touchNote.trim() : '',
        netPayableWeightKg: calc.netPayableWeightKg,
        pricePerUnit: safeNum(pricePerUnit),
        cropAmountBeforeTouchPkr: cropAmountBeforeTouch,
        cropPaymentPkr: cropPaymentAfterTouch,
        kundaAmountPkr: safeNum(kundaAmount),
        numBags: Math.max(0, Math.floor(safeNum(numBags))),
        pricePerBagPkr: safeNum(pricePerBag),
        totalBagAmountPkr: calc.totalBagAmountPkr,
        totalPurchaseAmountPkr: calc.totalPurchaseAmountPkr,
        physicalStockToAddKg: calc.physicalStockToAddKg,
        paymentMode,
        amountPaid: res.amountPaid ?? amountPaid,
        remainingDue: res.remainingDue ?? remainingDue,
      });

      // reset form
      setPurchaseDate(today());
      setSupplierId('');
      setCropId('');
      setVarietyId('');
      setActualWeight('');
      setDeductionRate('0');
      setDeductionBasisKg('40');
      setBardanaTotalKg('0');
      setPricePerUnit('');
      setTouchAmount('');
      setTouchWeightKg('');
      setTouchNote('');
      setKundaAmount('0');
      setNumBags('0');
      setPricePerBag('0');
      setPaymentMode('none');
      setPartialAmount('');
      setNotes('');
      setErrors({});
      if (onSuccess) onSuccess();
    } else {
      setErrors({ _form: res.message || 'Failed to save purchase.' });
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
                  <p className="text-sm font-semibold text-slate-900">Purchase saved</p>
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
            <div id="purchase-receipt-printable" className="flex-1 space-y-2 overflow-y-auto px-4 py-2.5 text-slate-800">
              <div className="border-b border-dashed border-slate-200 pb-1.5 text-center">
                <p className="text-sm font-bold text-slate-900">M-Shafiq Commission Shop</p>
                <p className="text-[11px] text-slate-400">Crop Commission Agent — Grain & Commodity Trade</p>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                <span className="text-slate-500">Invoice</span><span className="text-right font-mono font-semibold">{receipt.invoiceNo}</span>
                <span className="text-slate-500">Date</span><span className="text-right font-medium">{receipt.purchaseDate}</span>
                <span className="text-slate-500">Supplier</span><span className="text-right font-semibold">{receipt.supplierName}</span>
                <span className="text-slate-500">Crop</span><span className="text-right font-medium">{receipt.cropName}{receipt.varietyName ? ` — ${receipt.varietyName}` : ''}</span>
              </div>

              <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1">
                <p className="mb-0.5 text-[11px] font-semibold text-slate-500">Weight & settlement</p>
                <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Actual weight</span><span className={RECEIPT_VALUE}>{fmtKg(receipt.actualWeightKg)}</span></div>
                <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Deduction ({receipt.deductionRate} kg/{receipt.deductionBasisKg}kg)</span><span className="font-medium tabular-nums text-rose-600">− {fmtKg(receipt.deductionWeightKg)}</span></div>
                {receipt.bardanaWeightKg > 0 && (
                  <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Bardana weight</span><span className="font-medium tabular-nums text-rose-600">− {fmtKg(receipt.bardanaWeightKg)}</span></div>
                )}
                {receipt.touchWeightKg > 0 && (
                  <div className={RECEIPT_ROW}>
                    <span className={RECEIPT_LABEL}>Touch (weight){receipt.touchNote ? ` — ${receipt.touchNote}` : ''}</span>
                    <span className="font-medium tabular-nums text-rose-600">− {fmtKg(receipt.touchWeightKg)}</span>
                  </div>
                )}
                <div className={RECEIPT_ROW}><span className="font-medium text-emerald-700">Net payable weight</span><span className="font-semibold tabular-nums text-emerald-800">{fmtKg(receipt.netPayableWeightKg)}</span></div>
                <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Rate / 40 kg</span><span className={RECEIPT_VALUE}>{fmtRs(receipt.pricePerUnit)}</span></div>
                {receipt.touchAmountPkr > 0 && (
                  <>
                    <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Crop amount (before touch)</span><span className={RECEIPT_VALUE}>{fmtRs(receipt.cropAmountBeforeTouchPkr)}</span></div>
                    <div className={RECEIPT_ROW}>
                      <span className={RECEIPT_LABEL}>Touch (amount){receipt.touchNote ? ` — ${receipt.touchNote}` : ''}</span>
                      <span className="font-medium tabular-nums text-rose-600">− {fmtRs(receipt.touchAmountPkr)}</span>
                    </div>
                  </>
                )}
                <div className={RECEIPT_ROW}><span className="font-medium text-slate-700">Crop payment</span><span className="font-semibold tabular-nums text-slate-900">{fmtRs(receipt.cropPaymentPkr)}</span></div>
              </div>

              {(receipt.kundaAmountPkr > 0 || receipt.numBags > 0) && (
                <div className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <p className="mb-0.5 text-[11px] font-semibold text-slate-500">Other charges</p>
                  {receipt.kundaAmountPkr > 0 && (
                    <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Kunda deduction</span><span className={`${RECEIPT_VALUE} text-rose-700`}>− {fmtRs(receipt.kundaAmountPkr)}</span></div>
                  )}
                  {receipt.numBags > 0 && (
                    <div className={RECEIPT_ROW}><span className={RECEIPT_LABEL}>Bags ({receipt.numBags} × {fmtRs(receipt.pricePerBagPkr)})</span><span className={RECEIPT_VALUE}>{fmtRs(receipt.totalBagAmountPkr)}</span></div>
                  )}
                </div>
              )}

              <div className="space-y-0.5 border-t-2 border-slate-300 pt-1.5 text-xs">
                <div className="flex justify-between text-sm font-bold">
                  <span>Grand total</span>
                  <span className="tabular-nums text-slate-900">{fmtRs(receipt.totalPurchaseAmountPkr)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Paid now ({receipt.paymentMode === 'full' ? 'Full' : receipt.paymentMode === 'partial' ? 'Partial' : 'Credit'})</span>
                  <span className="font-semibold tabular-nums text-emerald-700">{fmtRs(receipt.amountPaid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Remaining to khata</span>
                  <span className={`font-semibold tabular-nums ${receipt.remainingDue > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                    {fmtRs(receipt.remainingDue)}
                  </span>
                </div>
                <div className="flex justify-between pt-0.5 text-slate-500">
                  <span>Physical stock added</span>
                  <span className="font-medium tabular-nums">{fmtKg(receipt.physicalStockToAddKg)}</span>
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

            {/* ── Purchase information ────────────────────────────────────── */}
            <Section title="Purchase information">
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 md:grid-cols-12">

                <Field label="Purchase date" htmlFor="pur-date" required error={errors.purchaseDate} className="md:col-span-3">
                  <input
                    id="pur-date"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className={`${INPUT} ${errors.purchaseDate ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Supplier" htmlFor="pur-supplier" required error={errors.supplierId} className="col-span-2 md:col-span-5">
                  <div className="relative">
                    <select
                      id="pur-supplier"
                      value={supplierId}
                      onChange={(e) => setSupplierId(e.target.value)}
                      className={`${SELECT} ${errors.supplierId ? INPUT_ERR : ''}`}
                    >
                      <option value="">— Select supplier —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.outstanding !== undefined && s.outstanding !== null
                            ? s.outstanding < 0
                              ? ` (Payable: Rs. ${Math.abs(s.outstanding).toLocaleString()})`
                              : s.outstanding > 0
                                ? ` (Balance: Rs. ${s.outstanding.toLocaleString()})`
                                : ' (Rs. 0)'
                            : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  </div>
                  {selectedSupplier && (
                    <p className="mt-0.5 text-[11px] leading-tight text-slate-500">
                      Khata:{' '}
                      <span className={`font-medium ${currentOutstanding < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                        {currentOutstanding < 0
                          ? `Rs. ${Math.abs(currentOutstanding).toLocaleString()} (shop owes supplier)`
                          : currentOutstanding > 0
                            ? `Rs. ${currentOutstanding.toLocaleString()} (supplier owes shop)`
                            : 'Rs. 0 (settled)'}
                      </span>
                    </p>
                  )}
                </Field>

                <Field label="Actual weight (kg)" htmlFor="pur-actual-weight" required error={errors.actualWeight} className="col-span-2 md:col-span-4">
                  <input
                    id="pur-actual-weight"
                    type="number"
                    step="100"
                    min="0"
                    placeholder="e.g. 4200"
                    value={actualWeight}
                    onChange={(e) => setActualWeight(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.actualWeight ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field
                  label="Crop"
                  htmlFor="pur-crop"
                  required
                  error={errors.cropId}
                  className={varieties.length > 0 ? 'md:col-span-4' : 'md:col-span-8'}
                >
                  <div className="relative">
                    <select
                      id="pur-crop"
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
                  <Field label="Crop variety" htmlFor="pur-variety" className="md:col-span-4">
                    <div className="relative">
                      <select
                        id="pur-variety"
                        value={varietyId}
                        onChange={(e) => setVarietyId(e.target.value)}
                        className={SELECT}
                      >
                        <option value="">— No variety —</option>
                        {varieties.map((v) => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
                  </Field>
                )}

              </div>
            </Section>

            {/* ── Deductions, crop payment & charges ──────────────────────── */}
            <Section
              title="Deductions, crop payment & charges"
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
              {/* Deduction Rate (hidden in the current design — kept as before)
              <div>
                <label htmlFor="pur-deduction-rate">Deduction Rate (kg)</label>
                <input
                  id="pur-deduction-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={deductionRate}
                  onChange={(e) => setDeductionRate(e.target.value)}
                />
                <input
                  id="pur-deduction-basis"
                  type="number"
                  step="0.001"
                  min="0.001"
                  aria-label="Deduction rate basis in kilograms"
                  value={deductionBasisKg}
                  onChange={(e) => setDeductionBasisKg(e.target.value)}
                />
              </div> */}

              {/* row A: bardana · price · touch */}
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5 md:grid-cols-6">
                <Field label="Bardana weight (kg)" htmlFor="pur-bardana-total" error={errors.bardanaTotalKg}>
                  <input
                    id="pur-bardana-total"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 25"
                    value={bardanaTotalKg}
                    onChange={(e) => setBardanaTotalKg(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.bardanaTotalKg ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Price / 40 kg (Rs.)" htmlFor="pur-price" required error={errors.pricePerUnit}>
                  <input
                    id="pur-price"
                    type="number"
                    step="100"
                    min="1"
                    placeholder="e.g. 3000"
                    value={pricePerUnit}
                    onChange={(e) => setPricePerUnit(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.pricePerUnit ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Touch amount (Rs.)" htmlFor="pur-touch-amount" error={errors.touchAmount}>
                  <input
                    id="pur-touch-amount"
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

                <Field label="Touch weight (kg)" htmlFor="pur-touch-weight" error={errors.touchWeightKg}>
                  <input
                    id="pur-touch-weight"
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

                <Field label="Touch note" htmlFor="pur-touch-note" className="col-span-2">
                  <input
                    id="pur-touch-note"
                    type="text"
                    placeholder={hasTouch ? 'Note about touch' : 'Enter touch first'}
                    value={touchNote}
                    disabled={!hasTouch}
                    onChange={(e) => setTouchNote(e.target.value)}
                    className={`${INPUT} text-left`}
                  />
                </Field>
              </div>

              {errors.touch && <p className="mt-1 text-[11px] text-rose-600">{errors.touch}</p>}
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Bardana is subtracted from actual weight. Touch: enter either an amount (deducted from the crop amount
                after bardana) or a weight (deducted after bardana); the note is active only when touch is entered.
              </p>

              {/* row B: kunda · bags */}
              <div className="mt-2 grid grid-cols-2 gap-x-2.5 gap-y-1.5 border-t border-slate-100 pt-2 md:grid-cols-6">
                <Field label="Kunda amount (Rs.)" htmlFor="pur-kunda" error={errors.kundaAmount} hint="Flat deduction from payable">
                  <input
                    id="pur-kunda"
                    type="number"
                    step="10"
                    min="0"
                    value={kundaAmount}
                    onChange={(e) => setKundaAmount(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.kundaAmount ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Number of bags" htmlFor="pur-bags" error={errors.numBags}>
                  <input
                    id="pur-bags"
                    type="number"
                    step="1"
                    min="0"
                    value={numBags}
                    onChange={(e) => setNumBags(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.numBags ? INPUT_ERR : ''}`}
                  />
                </Field>

                <Field label="Price per bag (Rs.)" htmlFor="pur-price-per-bag" error={errors.pricePerBag}>
                  <input
                    id="pur-price-per-bag"
                    type="number"
                    step="10"
                    min="0"
                    value={pricePerBag}
                    onChange={(e) => setPricePerBag(e.target.value)}
                    className={`${INPUT} ${NUM} ${errors.pricePerBag ? INPUT_ERR : ''}`}
                  />
                </Field>

                <div className="min-w-0">
                  <span className={FIELD_LABEL}>Total bag amount</span>
                  <div className="flex h-8 items-center justify-end rounded border border-slate-200 bg-slate-50 px-2 text-[13px] font-semibold tabular-nums text-slate-800">
                    {fmtRs(calc.totalBagAmountPkr)}
                  </div>
                </div>
              </div>

              {/* Live results — one compact line */}
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-0.5 border-t border-slate-100 pt-1.5 text-xs">
                <div className="flex gap-1.5">
                  <dt className="text-slate-500">Bardana</dt>
                  <dd className="font-medium tabular-nums text-rose-600">{fmtKg(bardanaShownKg)}</dd>
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
                  <dt className="text-slate-500">Net payable weight</dt>
                  <dd className="font-medium tabular-nums text-emerald-700">{fmtKg(calc.netPayableWeightKg)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-slate-500">Crop payment</dt>
                  <dd className="font-semibold tabular-nums text-slate-900">{fmtRs(cropPaymentAfterTouch)}</dd>
                </div>
              </dl>
            </Section>

            {/* ── Payment method & khata ──────────────────────────────────── */}
            <Section title="Payment & supplier khata">
              <div className="grid grid-cols-1 gap-x-2.5 gap-y-1.5 md:grid-cols-12">

                {/* Payment mode — segmented control */}
                <div className="min-w-0 md:col-span-5">
                  <span className={FIELD_LABEL}>Payment mode</span>
                  <div role="radiogroup" aria-label="Payment mode" className="grid h-8 grid-cols-3 overflow-hidden rounded border border-slate-300">
                    {[
                      { id: 'full' as PaymentMode, title: 'Full', desc: 'Pay entire bill now' },
                      { id: 'partial' as PaymentMode, title: 'Partial', desc: 'Pay some now, rest to khata' },
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
                  <Field label="Amount paid now (Rs.)" htmlFor="pur-partial-amount" required error={errors.partialAmount} className="md:col-span-3">
                    <input
                      id="pur-partial-amount"
                      type="number"
                      step="100"
                      min="0"
                      max={grandTotal}
                      placeholder="Enter amount paid"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                      className={`${INPUT} ${NUM} ${errors.partialAmount ? INPUT_ERR : ''}`}
                    />
                  </Field>
                )}

                <Field
                  label="Notes / vehicle / reference (optional)"
                  htmlFor="pur-notes"
                  className={paymentMode === 'partial' ? 'md:col-span-4' : 'md:col-span-7'}
                >
                  <input
                    id="pur-notes"
                    type="text"
                    placeholder="e.g. Paid via cash, Truck # 1234"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className={`${INPUT} text-left`}
                  />
                </Field>
              </div>

              {/* Supplier Khata Impact Preview */}
              {selectedSupplier && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-slate-100 pt-1.5 text-[11px] text-slate-500">
                  <span className="font-medium text-slate-700">Khata — {selectedSupplier.name}:</span>
                  <span>
                    Current{' '}
                    {currentOutstanding < 0
                      ? `payable ${fmtRs(Math.abs(currentOutstanding))}`
                      : currentOutstanding > 0
                        ? `balance ${fmtRs(currentOutstanding)}`
                        : 'Rs. 0'}
                  </span>
                  <span>→</span>
                  <span className="font-semibold text-slate-800">
                    After purchase{' '}
                    {projectedBalance < 0
                      ? `payable ${fmtRs(Math.abs(projectedBalance))}`
                      : projectedBalance > 0
                        ? `balance ${fmtRs(projectedBalance)}`
                        : 'Rs. 0'}
                  </span>
                  {remainingDue > 0 && (
                    <span className="rounded bg-rose-50 px-1.5 py-0.5 font-medium text-rose-700">
                      + {fmtRs(remainingDue)} added to supplier&apos;s ledger
                    </span>
                  )}
                </p>
              )}
            </Section>
          </div>

          {/* ═══════════════ RIGHT: summary + save ═══════════════ */}
          <aside className="rounded border border-slate-200 bg-white lg:sticky lg:top-2">
            <h2 className="border-b border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
              Purchase summary
            </h2>

            <dl className="px-3 py-1.5">
              <SummaryRow label="Actual weight" value={fmtKg(actualWeightNum)} />
              {calc.deductionWeightKg > 0 && (
                <SummaryRow label="Deduction" value={`− ${fmtKg(calc.deductionWeightKg)}`} tone="text-rose-600" />
              )}
              {bardanaShownKg > 0 && (
                <SummaryRow label="Bardana" value={`− ${fmtKg(bardanaShownKg)}`} tone="text-rose-600" />
              )}
              {touchKgNum > 0 && (
                <SummaryRow label="Touch (weight)" value={`− ${fmtKg(touchKgNum)}`} tone="text-rose-600" />
              )}
              <SummaryRow label="Net payable weight" value={fmtKg(calc.netPayableWeightKg)} tone="text-emerald-700" />

              <div className="my-1 border-t border-slate-100" />

              <SummaryRow label="Crop payment" value={fmtRs(cropPaymentAfterTouch)} />
              {touchAmountNum > 0 && (
                <SummaryRow label="Touch (amount) deducted" value={`− ${fmtRs(touchAmountNum)}`} tone="text-rose-600" />
              )}
              <SummaryRow
                label="Kunda deduction"
                value={safeNum(kundaAmount) > 0 ? `− ${fmtRs(safeNum(kundaAmount))}` : fmtRs(0)}
                tone={safeNum(kundaAmount) > 0 ? 'text-rose-700' : 'text-slate-800'}
              />
              <SummaryRow label="Bag amount" value={fmtRs(calc.totalBagAmountPkr)} />

              <div className="mt-1 flex items-baseline justify-between border-t-2 border-slate-300 pt-1">
                <dt className="text-xs font-semibold text-slate-700">Total purchase amount</dt>
                <dd className="text-base font-bold tabular-nums text-slate-900">{fmtRs(calc.totalPurchaseAmountPkr)}</dd>
              </div>

              <div className="my-1 border-t border-slate-100" />

              <SummaryRow
                label={`Paid now (${paymentMode === 'full' ? 'full' : paymentMode === 'partial' ? 'partial' : 'credit'})`}
                value={fmtRs(amountPaid)}
                tone="text-emerald-700"
              />
              <SummaryRow
                label="Remaining to khata"
                value={fmtRs(remainingDue)}
                tone={remainingDue > 0 ? 'text-rose-600' : 'text-slate-800'}
              />

              <div className="my-1 border-t border-slate-100" />

              <SummaryRow label="Physical stock to add" value={fmtKg(calc.physicalStockToAddKg)} />
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                Net payable weight ({fmtKg(calc.netPayableWeightKg)}) is for supplier settlement only — stock receives the
                full actual weight.
              </p>
            </dl>

            <div className="border-t border-slate-200 p-2.5">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                className="flex h-9 w-full items-center justify-center gap-2 rounded bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save purchase'
                )}
              </button>
            </div>
          </aside>

        </div>
      </div>
    </>
  );
}