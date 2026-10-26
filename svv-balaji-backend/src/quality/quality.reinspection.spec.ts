import { QualityService } from './quality.service';

/** A PASS re-inspection brings a rejected raw batch back (audit 22 Oct 2026). */
describe('QualityService - raw material re-inspection', () => {
  const make = (batch: any) => {
    const updates: any[] = [];
    const tx: any = {
      qualityInspection: { create: jest.fn(async ({ data }: any) => data) },
      rawMaterialBatch: {
        findUnique: jest.fn(async () => batch),
        update: jest.fn(async ({ data }: any) => void updates.push(data)),
      },
      finishedGoodsBatch: { update: jest.fn() },
    };
    const prisma: any = {
      rawMaterialBatch: { findUnique: jest.fn(async () => ({ id: 'rm1' })) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    return { svc: new QualityService(prisma), updates };
  };
  const inspect = (result: string) => ({ stage: 'RAW_MATERIAL', rawMaterialBatchId: 'rm1', result } as any);

  it('restores a rejected, warehoused batch to STORED on PASS', async () => {
    const { svc, updates } = make({ status: 'REJECTED', warehouseId: 'w1' });
    await svc.create(inspect('PASS'), 'qa1');
    expect(updates).toEqual([{ status: 'STORED' }]);
  });

  it('restores an unwarehoused batch to COLLECTED', async () => {
    const { svc, updates } = make({ status: 'REJECTED', warehouseId: null });
    await svc.create(inspect('PASS'), 'qa1');
    expect(updates).toEqual([{ status: 'COLLECTED' }]);
  });

  it('leaves a batch that was never rejected alone, and still rejects on FAIL', async () => {
    const ok = make({ status: 'UNDER_PRODUCTION', warehouseId: 'w1' });
    await ok.svc.create(inspect('PASS'), 'qa1');
    expect(ok.updates).toEqual([]);
    const bad = make({ status: 'STORED', warehouseId: 'w1' });
    await bad.svc.create(inspect('FAIL'), 'qa1');
    expect(bad.updates).toEqual([{ status: 'REJECTED' }]);
  });
});
