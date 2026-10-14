export function validatePaymentAmount(
  amount: number,
  documentTotal: number,
  allowAdvance = false
): { ok: boolean; message?: string } {
  const paid = Number(amount.toFixed(2));
  const total = Number(documentTotal.toFixed(2));
  if (paid < 0) return { ok: false, message: 'Payment amount cannot be negative.' };
  if (paid > total && !allowAdvance) {
    return { ok: false, message: `Payment cannot exceed total due (Rs. ${total.toLocaleString()}).` };
  }
  return { ok: true };
}
