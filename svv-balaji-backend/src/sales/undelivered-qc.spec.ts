import { BadRequestException } from '@nestjs/common';
import { SalesService } from './sales.service';

/**
 * QC of packs back from an undelivered order (audit 22 Oct 2026). They are
 * quarantined at close; only QC puts them back on sale, and never from a batch
 * that is no longer sellable.
 */
describe('SalesService - undelivered QC', () => {
  let batch: any;
  let moves: any[];
  let stockUpdates: any[];
  let created: any[];
  let service: SalesService;

  beforeEach(() => {
    batch = { id: 'fg1', fgBatchNumber: 'FG-20261022-001', holdStatus: 'ACTIVE', qaReleased: true, expiryDate: null };
    moves = [{ fgBatchId: 'fg1', toWarehouseId: 'w1', movementType: 'UNDELIVERED_QUARANTINE', quantity: 5, fgBatch: { fgBatchNumber: batch.fgBatchNumber } }];
    stockUpdates = [];
    created = [];
    const tx: any = {
      finishedGoodsStock: { update: jest.fn(async (a: any) => void stockUpdates.push(a.data)) },
      stockMovement: { create: jest.fn(async (a: any) => void created.push(a.data)) },
    };
    const prisma: any = {
      order: { findUnique: jest.fn(async () => ({ orderNumber: 'SO-1' })) },
      stockMovement: { findMany: jest.fn(async () => moves) },
      finishedGoodsBatch: { findMany: jest.fn(async () => [batch]) },
      orderEvent: { create: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    service = Object.create(SalesService.prototype);
    Object.assign(service, { prisma, record: jest.fn(async () => undefined) });
  });

  it('lists quarantined packs net of earlier QC', async () => {
    moves.push({ fgBatchId: 'fg1', toWarehouseId: 'w1', movementType: 'QUARANTINE_RELEASE', quantity: 2, fgBatch: moves[0].fgBatch });
    const p = await service.undeliveredQcPending('o1');
    expect(p.lines).toEqual([{ fgBatchId: 'fg1', fgBatchNumber: batch.fgBatchNumber, warehouseId: 'w1', quantity: 3 }]);
  });

  it('puts good packs back on sale and damaged ones in the damaged bucket', async () => {
    await service.undeliveredQc('o1', [{ fgBatchId: 'fg1', good: 4, damaged: 1 }], 'qa1');
    expect(stockUpdates).toEqual([{ quarantineQuantity: { decrement: 5 }, quantity: { increment: 4 }, damagedQuantity: { increment: 1 } }]);
    expect(created.map((m) => [m.movementType, m.quantity])).toEqual([['QUARANTINE_RELEASE', 4], ['RETURN_DAMAGED', 1]]);
  });

  it('refuses more packs than are waiting', async () => {
    await expect(service.undeliveredQc('o1', [{ fgBatchId: 'fg1', good: 5, damaged: 1 }], 'qa1')).rejects.toThrow(/only 5/);
  });

  it.each([
    ['recalled', { holdStatus: 'RECALLED' }],
    ['QA-withdrawn', { qaReleased: false }],
    ['expired', { expiryDate: new Date('2020-01-01') }],
  ])('never puts packs of a %s batch back on sale, but accepts them as damaged', async (_label, change) => {
    Object.assign(batch, change);
    await expect(service.undeliveredQc('o1', [{ fgBatchId: 'fg1', good: 1, damaged: 0 }], 'qa1')).rejects.toBeInstanceOf(BadRequestException);
    await service.undeliveredQc('o1', [{ fgBatchId: 'fg1', good: 0, damaged: 5 }], 'qa1');
    expect(stockUpdates).toEqual([{ quarantineQuantity: { decrement: 5 }, damagedQuantity: { increment: 5 } }]);
  });
});
