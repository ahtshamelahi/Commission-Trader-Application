'use client';

import React, { useState } from 'react';
import { TextInputField } from '@/components/ui/text-input-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { saveCrop } from '@/lib/actions/crop-actions';

interface CropFormProps {
  onSuccess?: () => void;
}

export function CropForm({ onSuccess }: CropFormProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await saveCrop(name);
    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(`Crop '${name}' added successfully!`);
      setName('');
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.message || 'Failed to save crop.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-md p-4 space-y-4 shadow-2xs">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Add New Crop Type</h3>

      {errorMsg && <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-md">{errorMsg}</div>}
      {successMsg && <div className="p-3 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md">{successMsg}</div>}

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <TextInputField
            label="Crop Name *"
            placeholder="e.g. Wheat (Gandum), Super Basmati Rice, Cotton (Kapas)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <PrimaryButton type="submit" isLoading={isSubmitting}>
          Add Crop
        </PrimaryButton>
      </div>
    </form>
  );
}
