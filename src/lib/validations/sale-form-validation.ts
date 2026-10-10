import { NewSaleInput } from '@/types/sale-data-types';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateSaleInput(input: NewSaleInput, availableStockKg: number): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.crop_id || input.crop_id <= 0) {
    errors.crop_id = 'Please select a crop.';
  }

  if (input.physical_weight_kg <= 0) {
    errors.physical_weight_kg = 'Physical weight delivered must be greater than 0 kg.';
  }

  if (input.physical_weight_kg > availableStockKg) {
    errors.physical_weight_kg = `Insufficient physical stock available (${availableStockKg.toLocaleString()} kg max).`;
  }

  if (input.commission_per_40kg < 0) {
    errors.commission_per_40kg = 'Commission deduction cannot be negative.';
  }

  const commWeight = (input.physical_weight_kg * input.commission_per_40kg) / 40;
  if (commWeight > input.physical_weight_kg) {
    errors.commission_per_40kg = 'Commission weight cannot exceed physical weight.';
  }

  if (input.rate_per_40kg <= 0) {
    errors.rate_per_40kg = 'Selling rate per 40 kg must be greater than 0.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
