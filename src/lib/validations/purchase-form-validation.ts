import { NewPurchaseInput } from '@/types/purchase-data-types';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validatePurchaseInput(input: NewPurchaseInput): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input.crop_id || input.crop_id <= 0) {
    errors.crop_id = 'Please select a crop.';
  }

  if (input.gross_weight_kg <= 0) {
    errors.gross_weight_kg = 'Gross weight must be greater than 0 kg.';
  }

  if (input.commission_per_40kg < 0) {
    errors.commission_per_40kg = 'Commission deduction cannot be negative.';
  }

  // Ensure commission weight does not exceed gross weight
  const commWeight = (input.gross_weight_kg * input.commission_per_40kg) / 40;
  if (commWeight > input.gross_weight_kg) {
    errors.commission_per_40kg = 'Commission weight cannot exceed total gross weight.';
  }

  if (input.rate_per_40kg <= 0) {
    errors.rate_per_40kg = 'Purchase rate per 40 kg must be greater than 0.';
  }

  if (input.bags < 0) {
    errors.bags = 'Number of bags cannot be negative.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
