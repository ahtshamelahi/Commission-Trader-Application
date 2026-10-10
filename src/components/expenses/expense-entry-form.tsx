'use client';

import React, { useState } from 'react';
import { TextInputField } from '@/components/ui/text-input-field';
import { DropdownSelectField } from '@/components/ui/dropdown-select-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { saveExpenseTransaction } from '@/lib/actions/save-expense-transaction';
import { Purchase } from '@/types/purchase-data-types';

interface ExpenseEntryFormProps {
  purchases?: Purchase[];
  onSuccess?: () => void;
}

const expenseCategories = [
  { value: 'Truck Rent', label: 'Truck Rent / Transportation' },
  { value: 'Fuel', label: 'Fuel / Diesel' },
  { value: 'Loading & Unloading', label: 'Loading & Unloading' },
  { value: 'Labour', label: 'Labour / Mazdoori' },
  { value: 'Other Transport', label: 'Other Transport Costs' },
  { value: 'Shop Maintenance', label: 'Shop Maintenance / Utilities' },
  { value: 'General Business', label: 'General Business Expense' },
];

export function ExpenseEntryForm({ purchases = [], onSuccess }: ExpenseEntryFormProps) {
  const [category, setCategory] = useState<string>('Truck Rent');
  const [amount, setAmount] = useState<number>(0);
  const [purchaseId, setPurchaseId] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (amount <= 0) {
      setErrorMsg('Expense amount must be greater than 0 PKR.');
      setIsSubmitting(false);
      return;
    }

    const res = await saveExpenseTransaction({
      category,
      amount: Number(amount),
      expense_date: new Date(expenseDate).toISOString(),
      purchase_id: purchaseId ? Number(purchaseId) : null,
      notes,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(`Expense of Rs. ${amount.toLocaleString()} recorded successfully!`);
      setAmount(0);
      setNotes('');
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.message || 'Failed to record expense.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-md p-5 space-y-4 shadow-2xs">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Record Business Expense</h3>

      {errorMsg && <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-md font-medium">{errorMsg}</div>}
      {successMsg && <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md font-medium">{successMsg}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DropdownSelectField
          label="Category *"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={expenseCategories}
          required
        />

        <TextInputField
          label="Amount (PKR) *"
          type="number"
          min="1"
          step="0.01"
          value={amount || ''}
          onChange={(e) => setAmount(Number(e.target.value))}
          required
        />

        <TextInputField
          label="Expense Date"
          type="date"
          value={expenseDate}
          onChange={(e) => setExpenseDate(e.target.value)}
        />

        <DropdownSelectField
          label="Related Purchase (Optional)"
          value={purchaseId}
          onChange={(e) => setPurchaseId(e.target.value)}
          options={purchases.map((p) => ({
            value: p.id,
            label: `${p.invoice_no || `PUR-${p.id}`} (${p.crops?.name || 'Crop'})`,
          }))}
          placeholder="General / Not linked to purchase"
        />
      </div>

      <TextInputField
        label="Description / Notes"
        placeholder="e.g. Paid cash to mazdoor for loading 100 bags of Wheat"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex justify-end pt-2">
        <PrimaryButton type="submit" isLoading={isSubmitting}>
          Save Expense
        </PrimaryButton>
      </div>
    </form>
  );
}
