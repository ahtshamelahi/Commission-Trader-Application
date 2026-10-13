'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TextInputField } from '@/components/ui/text-input-field';
import { DropdownSelectField } from '@/components/ui/dropdown-select-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Crop } from '@/types/crop-data-types';
import { Party } from '@/types/party-data-types';
import { StockMovement } from '@/types/stock-data-types';
import { calculateAvailableStock } from '@/lib/calculations/current-stock-calculation';
import { performSaleCalculations } from '@/lib/calculations/sale-amount-calculation';
import { saveSaleTransaction, SaleExpenseInput } from '@/lib/actions/save-sale-transaction';
import {
  Calculator,
  AlertCircle,
  Printer,
  Download,
  X,
  CheckCircle2,
  Store,
  Loader2,
  Plus,
  Phone,
} from 'lucide-react';

interface SaleEntryFormProps {
  crops: Crop[];
  buyers: Party[];
  stockMovements: StockMovement[];
  onSuccess?: () => void;
}

interface ReceiptData {
  invoiceNo: string;
  saleDate: string;
  cropName: string;
  buyerName: string;
  buyerPhone: string;
  physicalWeightKg: number;
  commissionPer40kg: number;
  commissionWeightKg: number;
  billableWeightKg: number;
  ratePer40kg: number;
  saleAmountPkr: number;
  expenses: SaleExpenseInput[];
  totalExpensesNet: number;
  notes: string;
}

const SHOP_NAME = 'Commission Shop';
const SHOP_TAGLINE = 'Crop Commission Agent — Grain & Commodity Trade';

export function SaleEntryForm({ crops, buyers, stockMovements, onSuccess }: SaleEntryFormProps) {
  // Form fields
  const [cropId, setCropId] = useState<string>('');
  const [buyerId, setBuyerId] = useState<string>('');
  const [physicalWeightKg, setPhysicalWeightKg] = useState<number | ''>('');
  const [commissionPer40kg, setCommissionPer40kg] = useState<number | ''>(1.5);
  const [ratePer40kg, setRatePer40kg] = useState<number | ''>('');
  const [notes, setNotes] = useState<string>('');

  // Expenses
  const [expenses, setExpenses] = useState<{ expense_type: string; amount: string; is_income: boolean; notes: string }[]>([
    { expense_type: '', amount: '', is_income: false, notes: '' },
  ]);

  const [availableStockKg, setAvailableStockKg] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cropId) {
      const cropMoves = stockMovements.filter((m) => m.crop_id === Number(cropId));
      setAvailableStockKg(calculateAvailableStock(cropMoves));
    } else {
      setAvailableStockKg(0);
    }
  }, [cropId, stockMovements]);

  const calculations = performSaleCalculations(
    Number(physicalWeightKg) || 0,
    Number(commissionPer40kg) || 0,
    Number(ratePer40kg) || 0
  );

  const isStockInsufficient = Number(physicalWeightKg || 0) > availableStockKg && !!cropId;

  // Expense calculations
  const totalExpensesNet = expenses.reduce((s, e) => {
    const amt = Number(e.amount) || 0;
    return s + (e.is_income ? amt : -amt);
  }, 0);
  const totalExpensesDisplay = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const grandTotal = calculations.saleAmountPkr + totalExpensesNet;

  const resetForm = () => {
    setCropId('');
    setBuyerId('');
    setPhysicalWeightKg('');
    setCommissionPer40kg(1.5);
    setRatePer40kg('');
    setNotes('');
    setExpenses([{ expense_type: '', amount: '', is_income: false, notes: '' }]);
    setErrorMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    if (!cropId) {
      setErrorMsg('Please select a crop.');
      setIsSubmitting(false);
      return;
    }

    if (isStockInsufficient) {
      setErrorMsg(`Physical weight (${physicalWeightKg} kg) exceeds available stock (${availableStockKg} kg).`);
      setIsSubmitting(false);
      return;
    }

    const validExpenses: SaleExpenseInput[] = expenses
      .filter((e) => Number(e.amount) > 0)
      .map((e) => ({
        expense_type: e.expense_type || 'General',
        amount: Number(e.amount),
        is_income: e.is_income,
        notes: e.notes,
      }));

    const res = await saveSaleTransaction({
      crop_id: Number(cropId),
      buyer_id: buyerId ? Number(buyerId) : null,
      physical_weight_kg: Number(physicalWeightKg) || 0,
      commission_per_40kg: Number(commissionPer40kg) || 0,
      rate_per_40kg: Number(ratePer40kg) || 0,
      notes,
      expenses: validExpenses,
    });

    setIsSubmitting(false);

    if (res.success) {
      const crop = crops.find((c) => c.id === Number(cropId));
      const buyer = buyers.find((b) => b.id === Number(buyerId));

      const expNetForReceipt = validExpenses.reduce((s, e) => s + (e.is_income ? e.amount : -e.amount), 0);

      setReceipt({
        invoiceNo: res.invoiceNo || `SALE-${Date.now().toString().slice(-6)}`,
        saleDate: new Date().toLocaleString('en-PK', {
          timeZone: 'Asia/Karachi',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        cropName: crop?.name || '—',
        buyerName: buyer?.name || 'Walk-in / Unknown',
        buyerPhone: buyer?.phone || '',
        physicalWeightKg: Number(physicalWeightKg) || 0,
        commissionPer40kg: Number(commissionPer40kg) || 0,
        commissionWeightKg: calculations.commissionWeightKg,
        billableWeightKg: calculations.billableWeightKg,
        ratePer40kg: Number(ratePer40kg) || 0,
        saleAmountPkr: calculations.saleAmountPkr,
        expenses: validExpenses,
        totalExpensesNet: expNetForReceipt,
        notes,
      });

      resetForm();
      if (onSuccess) onSuccess();
    } else {
      if (res.errors) {
        setErrorMsg(Object.values(res.errors)[0]);
      } else {
        setErrorMsg(res.message || 'Failed to save sale transaction.');
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!receipt) return;
    const content = `
SALE RECEIPT
============================================================
${SHOP_NAME}
${SHOP_TAGLINE}
============================================================

Invoice No : ${receipt.invoiceNo}
Date & Time: ${receipt.saleDate}

PARTY DETAILS
------------------------------------------------------------
Buyer Name : ${receipt.buyerName}
Phone      : ${receipt.buyerPhone || 'N/A'}

SALE DETAILS
------------------------------------------------------------
Crop       : ${receipt.cropName}
Delivered  : ${receipt.physicalWeightKg.toLocaleString()} kg
Commission : ${receipt.commissionPer40kg} kg per 40 kg
             = ${receipt.commissionWeightKg.toLocaleString()} kg total
Billable   : ${receipt.billableWeightKg.toLocaleString()} kg
Rate       : Rs. ${receipt.ratePer40kg.toLocaleString()} per 40 kg
Sale Amt   : Rs. ${receipt.saleAmountPkr.toLocaleString()}
${receipt.expenses.length > 0 ? `\nEXPENSES\n${receipt.expenses.map(e => `${e.expense_type}: ${e.is_income ? '+' : '-'} Rs. ${e.amount}`).join('\n')}` : ''}
============================================================
GRAND TOTAL: Rs. ${(receipt.saleAmountPkr + receipt.totalExpensesNet).toLocaleString()}
============================================================
${receipt.notes ? `\nNotes: ${receipt.notes}` : ''}

This is a computer-generated receipt.
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${receipt.invoiceNo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* ── Receipt Modal ────────────────────────────────────── */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[95vh] overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-emerald-700 text-white rounded-t-2xl shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-sm">Sale Completed!</p>
                  <p className="text-xs text-emerald-100">{receipt.invoiceNo}</p>
                </div>
              </div>
              <button
                onClick={() => setReceipt(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Body (printable) */}
            <div ref={receiptRef} className="overflow-y-auto flex-1 print:overflow-visible">
              <div id="sale-receipt-printable" className="p-6 space-y-4 text-slate-800">

                {/* Shop Header */}
                <div className="text-center border-b-2 border-dashed border-slate-300 pb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Store className="w-5 h-5 text-emerald-700" />
                    <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">{SHOP_NAME}</h1>
                  </div>
                  <p className="text-xs text-slate-500">{SHOP_TAGLINE}</p>
                  <p className="text-xs text-slate-400 mt-1">Pakistan</p>
                </div>

                {/* Invoice Meta */}
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-slate-500 font-medium">Invoice No</span>
                  <span className="font-bold text-right font-mono">{receipt.invoiceNo}</span>
                  <span className="text-slate-500 font-medium">Date & Time</span>
                  <span className="font-semibold text-right text-[11px]">{receipt.saleDate}</span>
                </div>

                {/* Buyer Info */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Buyer / Customer</p>
                  <p className="font-bold text-sm text-slate-900">{receipt.buyerName}</p>
                  {receipt.buyerPhone && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" />{receipt.buyerPhone}</p>
                  )}
                </div>

                {/* Sale Breakdown Table */}
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Sale Details</p>
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-1.5 text-slate-600 font-medium">Crop</td>
                        <td className="py-1.5 font-bold text-right text-slate-900">{receipt.cropName}</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-600 font-medium">Delivered Weight</td>
                        <td className="py-1.5 font-semibold text-right">{receipt.physicalWeightKg.toLocaleString()} kg</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-600 font-medium">
                          Commission ({receipt.commissionPer40kg} kg / 40 kg)
                        </td>
                        <td className="py-1.5 font-semibold text-right text-rose-600">
                          − {receipt.commissionWeightKg.toLocaleString()} kg
                        </td>
                      </tr>
                      <tr className="bg-blue-50">
                        <td className="py-1.5 px-1 text-blue-700 font-bold rounded-l">Billable Weight</td>
                        <td className="py-1.5 px-1 font-bold text-right text-blue-800 rounded-r">
                          {receipt.billableWeightKg.toLocaleString()} kg
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-600 font-medium">Rate per 40 kg</td>
                        <td className="py-1.5 font-semibold text-right">
                          Rs. {receipt.ratePer40kg.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Sale Amount */}
                <div className="flex justify-between text-sm font-semibold border-t border-slate-200 pt-2">
                  <span>Sale Amount</span>
                  <span>Rs. {receipt.saleAmountPkr.toLocaleString()}</span>
                </div>

                {/* Expenses */}
                {receipt.expenses.length > 0 && (
                  <div className="space-y-1 text-xs">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Expenses</p>
                    {receipt.expenses.map((e, i) => (
                      <div key={i} className={`flex justify-between ${e.is_income ? 'text-emerald-700' : 'text-rose-600'}`}>
                        <span>{e.expense_type || 'Expense'}{e.notes ? ` (${e.notes})` : ''}</span>
                        <span>{e.is_income ? '+' : '−'} Rs. {e.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Total Amount */}
                <div className="bg-emerald-700 text-white rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="font-bold text-sm">Grand Total</span>
                  <span className="text-xl font-extrabold tracking-tight">
                    Rs. {(receipt.saleAmountPkr + receipt.totalExpensesNet).toLocaleString()}
                  </span>
                </div>

                {/* Notes */}
                {receipt.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Notes</p>
                    <p className="text-xs text-amber-900">{receipt.notes}</p>
                  </div>
                )}

                {/* Footer */}
                <div className="text-center border-t border-dashed border-slate-300 pt-3">
                  <p className="text-[10px] text-slate-400">Computer-generated receipt — no signature required</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Thank you for your business.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl shrink-0">
              <button
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm py-2.5 rounded-lg transition"
              >
                <Printer className="w-4 h-4" />
                Print Receipt
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-sm py-2.5 rounded-lg transition"
              >
                <Download className="w-4 h-4" />
                Save as File
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-500 transition shrink-0"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #sale-receipt-printable,
          #sale-receipt-printable * { visibility: visible; }
          #sale-receipt-printable {
            position: fixed;
            top: 0; left: 0;
            width: 80mm;
            padding: 12px;
            font-size: 11px;
          }
        }
      `}</style>

      {/* ── Entry Form ───────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide">New Sale Entry</h2>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-lg font-medium">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <DropdownSelectField
              label="Crop *"
              value={cropId}
              onChange={(e) => setCropId(e.target.value)}
              options={crops.map((c) => ({ value: c.id, label: c.name }))}
              required
            />

            <DropdownSelectField
              label="Buyer / Customer"
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              options={buyers.map((b) => ({ value: b.id, label: `${b.name}${b.phone ? ` (${b.phone})` : ''}` }))}
              placeholder="Select Buyer (Optional)"
            />

            {/* Available Stock Indicator */}
            <div className="flex flex-col gap-1 text-left justify-end">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Available Physical Stock
              </span>
              <div className={`w-full rounded-lg border px-3 py-2 text-sm font-bold flex items-center justify-between ${cropId
                ? availableStockKg > 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-slate-100 border-slate-300 text-slate-500'
                }`}>
                <span>{cropId ? `${availableStockKg.toLocaleString()} kg` : 'Select Crop'}</span>
                {cropId && availableStockKg <= 0 && <AlertCircle className="w-4 h-4 text-rose-600" />}
              </div>
            </div>

            <TextInputField
              label="Actual Physical Weight Delivered (kg) *"
              type="number"
              step="0.01"
              min="0.1"
              value={physicalWeightKg}
              onChange={(e) => setPhysicalWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
              error={isStockInsufficient ? 'Exceeds available stock!' : undefined}
              required
            />

            <TextInputField
              label="Commission Deduction per 40 kg (kg)"
              type="number"
              step="0.05"
              min="0"
              value={commissionPer40kg}
              onChange={(e) => setCommissionPer40kg(e.target.value === '' ? '' : Number(e.target.value))}
            />

            <TextInputField
              label="Selling Rate per 40 kg (PKR) *"
              type="number"
              step="0.01"
              min="1"
              value={ratePer40kg}
              onChange={(e) => setRatePer40kg(e.target.value === '' ? '' : Number(e.target.value))}
              required
            />
          </div>

          {/* Live Calculation Summary */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3 text-slate-800 font-bold text-xs uppercase tracking-wider">
              <Calculator className="w-4 h-4 text-emerald-700" /> Live Sale Summary
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 uppercase block">Delivered</span>
                <span className="text-base font-bold text-slate-800">{(Number(physicalWeightKg) || 0).toLocaleString()} kg</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-500 uppercase block">Commission</span>
                <span className="text-base font-bold text-rose-600">−{calculations.commissionWeightKg} kg</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-200">
                <span className="text-[11px] text-slate-500 uppercase block">Billable</span>
                <span className="text-base font-bold text-blue-700">{calculations.billableWeightKg} kg</span>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                <span className="text-[11px] text-slate-600 uppercase font-semibold block">Sale Amount</span>
                <span className="text-lg font-extrabold text-emerald-800">Rs. {calculations.saleAmountPkr.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* ── Expenses Section ── */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Expenses / Income</span>
              <button
                type="button"
                onClick={() => setExpenses((p) => [...p, { expense_type: '', amount: '', is_income: false, notes: '' }])}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Row
              </button>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              <p className="text-[10px] text-slate-400 mb-1">
                Click <span className="font-bold text-emerald-600">+</span> to add income (e.g. freight received), or <span className="font-bold text-rose-500">−</span> for expense (deducted from total).
              </p>
              {expenses.map((exp, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  {/* Income/Expense Toggle */}
                  <button
                    type="button"
                    onClick={() => setExpenses((p) => p.map((x, i) => i === idx ? { ...x, is_income: !x.is_income } : x))}
                    title={exp.is_income ? 'Income (adds to total) — click to switch to expense' : 'Expense (subtracts from total) — click to switch to income'}
                    className={`shrink-0 w-8 h-8 rounded-lg border-2 flex items-center justify-center text-sm font-bold transition ${
                      exp.is_income
                        ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                        : 'border-rose-300 bg-rose-50 text-rose-600'
                    }`}
                  >
                    {exp.is_income ? '+' : '−'}
                  </button>
                  <input
                    type="text"
                    placeholder="Type (e.g. Freight, Labour)"
                    value={exp.expense_type}
                    onChange={(e) => setExpenses((p) => p.map((x, i) => i === idx ? { ...x, expense_type: e.target.value } : x))}
                    className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="PKR"
                    value={exp.amount}
                    onChange={(e) => setExpenses((p) => p.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))}
                    className="w-24 px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {expenses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setExpenses((p) => p.filter((_, i) => i !== idx))}
                      className="text-slate-300 hover:text-rose-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {totalExpensesDisplay > 0 && (
                <div className="flex justify-between text-xs font-semibold text-slate-700 pt-1 border-t border-slate-200 mt-1">
                  <span>Net Adjustment</span>
                  <span className={totalExpensesNet >= 0 ? 'text-emerald-700' : 'text-rose-600'}>
                    {totalExpensesNet >= 0 ? '+' : ''}Rs. {totalExpensesNet.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Grand Total */}
          {(Number(physicalWeightKg) > 0 && Number(ratePer40kg) > 0) && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 font-semibold">Grand Total</p>
                {totalExpensesDisplay > 0 && (
                  <p className="text-[10px] text-emerald-600">
                    Sale {totalExpensesNet >= 0 ? '+' : ''} Rs. {totalExpensesNet.toLocaleString()} adjustments
                  </p>
                )}
              </div>
              <span className="text-xl font-extrabold text-emerald-900">Rs. {grandTotal.toLocaleString()}</span>
            </div>
          )}

          <TextInputField
            label="Additional Notes / Delivery Instructions"
            placeholder="e.g. Delivered to Mill A, Gate Pass # 849"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSubmitting || isStockInsufficient || !cropId}
              className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm px-7 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : (
                'Finalize & Save Sale Invoice'
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
