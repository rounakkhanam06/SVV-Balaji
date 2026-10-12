import { SupplierVerificationAction } from '@prisma/client';
import { SuppliersService } from './suppliers.service';
import { supplierBankGaps } from './supplier-readiness';

/** Supplier onboarding follows the Farmer rule: no approval without bank details to pay into. */
describe('supplier approval needs bank details', () => {
  const complete = { bankAccountName: 'Agro Traders', bankName: 'SBI', bankAccountNo: '12345678901', ifscCode: 'SBIN0001234' };
  let supplier: any;
  let prisma: any;

  beforeEach(() => {
    supplier = { id: 's-1', status: 'PENDING_VERIFICATION', supplierCode: null, ...complete };
    prisma = {
      supplier: {
        findUnique: jest.fn(async () => supplier),
        update: jest.fn(async ({ data }) => ({ ...supplier, ...data })),
      },
      supplierCodeCounter: { upsert: jest.fn(async () => ({ lastNumber: 7 })) },
      supplierVerificationLog: { create: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
  });
  const svc = () => new SuppliersService(prisma);

  it('approves a supplier whose bank details are complete', async () => {
    const r = await svc().verify('s-1', { action: SupplierVerificationAction.APPROVED } as any, 'admin-1');
    expect(r.status).toBe('ACTIVE');
    expect(r.supplierCode).toMatch(/^SUP-\d{4}-000007$/);
  });

  it('refuses approval and names what is missing', async () => {
    supplier = { ...supplier, bankAccountNo: '', ifscCode: null };
    await expect(svc().verify('s-1', { action: SupplierVerificationAction.APPROVED } as any, 'admin-1')).rejects.toThrow(
      'Add the bank details before approving - missing: Account number, IFSC code',
    );
    expect(prisma.supplier.update).not.toHaveBeenCalled();
  });

  it('refuses an IFSC in the wrong format', async () => {
    supplier = { ...supplier, ifscCode: 'SBIN1234' };
    await expect(svc().verify('s-1', { action: SupplierVerificationAction.APPROVED } as any, 'admin-1')).rejects.toThrow(/valid IFSC/);
  });

  it('rejecting a supplier does not need bank details', async () => {
    supplier = { ...supplier, bankAccountNo: null };
    const r = await svc().verify('s-1', { action: SupplierVerificationAction.REJECTED } as any, 'admin-1');
    expect(r.status).toBe('BLACKLISTED');
  });

  it('treats whitespace as missing and accepts a lower-case IFSC', () => {
    expect(supplierBankGaps({ ...complete, bankName: '   ' })).toEqual(['Bank name']);
    expect(supplierBankGaps({ ...complete, ifscCode: 'sbin0001234' })).toEqual([]);
  });
});
