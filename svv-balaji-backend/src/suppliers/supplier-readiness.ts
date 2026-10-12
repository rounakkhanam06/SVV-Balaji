import type { Supplier } from '@prisma/client';

/** Same shape as an IFSC everywhere else in the system: four letters, 0, six letters/digits. */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/**
 * What a supplier needs before approval - the Farmer onboarding rule
 * (farmers/registration-completeness.ts) applied to the bank details, because
 * approval is what lets us pay them: without these, a delivery works out what
 * the supplier is owed with nowhere to send it.
 */
export const SUPPLIER_BANK_FIELDS: Array<{ key: keyof Supplier; label: string }> = [
  { key: 'bankAccountName', label: 'Account holder name' },
  { key: 'bankName', label: 'Bank name' },
  { key: 'bankAccountNo', label: 'Account number' },
  { key: 'ifscCode', label: 'IFSC code' },
];

const present = (v: unknown) => typeof v === 'string' && v.trim().length > 0;

/** Labels of what is missing or wrong; empty = ready to approve. */
export function supplierBankGaps(supplier: Pick<Supplier, 'bankAccountName' | 'bankName' | 'bankAccountNo' | 'ifscCode'>): string[] {
  const gaps = SUPPLIER_BANK_FIELDS.filter((f) => !present(supplier[f.key as keyof typeof supplier])).map((f) => f.label);
  if (present(supplier.ifscCode) && !IFSC_PATTERN.test(supplier.ifscCode!.trim().toUpperCase())) gaps.push('a valid IFSC code');
  return gaps;
}
