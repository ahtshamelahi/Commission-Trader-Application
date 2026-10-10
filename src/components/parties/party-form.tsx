'use client';

import React, { useState } from 'react';
import { TextInputField } from '@/components/ui/text-input-field';
import { DropdownSelectField } from '@/components/ui/dropdown-select-field';
import { PrimaryButton } from '@/components/ui/primary-button';
import { saveParty } from '@/lib/actions/party-actions';
import { PartyType } from '@/types/party-data-types';

interface PartyFormProps {
  onSuccess?: () => void;
  initialData?: {
    id?: number;
    name?: string;
    phone?: string;
    address?: string;
    party_type?: PartyType;
  };
}

export function PartyForm({ onSuccess, initialData }: PartyFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [address, setAddress] = useState(initialData?.address || '');
  const [partyType, setPartyType] = useState<PartyType>(initialData?.party_type || 'supplier');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    const res = await saveParty({
      id: initialData?.id,
      name,
      phone,
      address,
      party_type: partyType,
    });

    setIsSubmitting(false);

    if (res.success) {
      setSuccessMsg(`Party ${initialData?.id ? 'updated' : 'added'} successfully!`);
      if (!initialData?.id) {
        setName('');
        setPhone('');
        setAddress('');
      }
      if (onSuccess) onSuccess();
    } else {
      setErrorMsg(res.message || 'Failed to save party record.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-md p-4 space-y-4 shadow-2xs">
      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
        {initialData?.id ? 'Edit Party' : 'Add New Party (Supplier / Buyer)'}
      </h3>

      {errorMsg && (
        <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-md font-medium">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-3 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md font-medium">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextInputField
          label="Party Full Name *"
          placeholder="e.g. Malik Muhammad Tariq"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <TextInputField
          label="Phone Number"
          placeholder="e.g. 0300-1234567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <DropdownSelectField
          label="Party Role *"
          value={partyType}
          onChange={(e) => setPartyType(e.target.value as PartyType)}
          options={[
            { value: 'supplier', label: 'Supplier (Farmer / Producer)' },
            { value: 'buyer', label: 'Buyer (Trader / Mill Owner)' },
            { value: 'both', label: 'Both Supplier & Buyer' },
          ]}
        />

        <TextInputField
          label="Address / Location"
          placeholder="e.g. Chak 45 NB, Sargodha"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div className="flex justify-end pt-2">
        <PrimaryButton type="submit" isLoading={isSubmitting}>
          {initialData?.id ? 'Update Party' : 'Save Party Record'}
        </PrimaryButton>
      </div>
    </form>
  );
}
