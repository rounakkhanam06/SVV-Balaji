import { BadRequestException } from '@nestjs/common';
import { ProductionStatus } from '@prisma/client';
import { ProductionService, PRODUCTION_TRANSITIONS } from './production.service';

/**
 * Production run lifecycle (audit 22 Oct 2026).
 *
 * Each case below was reachable before: a planned run completed without its
 * raw material ever leaving the shelf, a planned run paused and resumed past
 * /start, a started run deleted with its stock lost, two runs on one machine.
 */
describe('ProductionService - run lifecycle', () => {
  let run: any;
  let otherRunOnMachine: any;
  let stockUpdates: any[];
  let deleted: string[];
  let prisma: any;
  let service: ProductionService;
  const cost: any = { refreshAfterCompletion: jest.fn(async () => undefined) };

  beforeEach(() => {
    run = {
      id: 'pb1',
      productionBatchNumber: 'PB-20261022-001',
      status: ProductionStatus.PLANNED,
      startedAt: null,
      warehouseId: 'w1',
      machineId: 'm1',
      recipeVersion: 1,
      recipe: { status: 'APPROVED', recipeCode: 'ATTA' },
      consumptions: [{ rawMaterialBatchId: 'rm1', quantityUsed: 100 }],
      finishedGoodsBatches: [],
    };
    otherRunOnMachine = null;
    stockUpdates = [];
    deleted = [];

    const tx: any = {
      warehouseStock: {
        findUnique: jest.fn(async () => ({ quantity: 500, reservedQuantity: 100 })),
        update: jest.fn(async (a: any) => void stockUpdates.push(a.data)),
        updateMany: jest.fn(async (a: any) => void stockUpdates.push(a.data)),
      },
      stockMovement: { create: jest.fn(async () => ({})) },
      rawMaterialBatch: { update: jest.fn(async () => ({})) },
      productionConsumption: { deleteMany: jest.fn(async () => void deleted.push('consumptions')) },
      productionBatch: {
        update: jest.fn(async ({ data }: any) => Object.assign(run, data)),
        delete: jest.fn(async () => void deleted.push('run')),
      },
    };
    prisma = {
      ...tx,
      productionBatch: {
        ...tx.productionBatch,
        findUnique: jest.fn(async () => run),
        findFirst: jest.fn(async () => otherRunOnMachine),
      },
      productionConsumption: { aggregate: jest.fn(async () => ({ _sum: { quantityUsed: 100 } })) },
      qualityInspection: { findFirst: jest.fn(async () => null) },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    service = new ProductionService(prisma, {} as any, cost);
  });

  describe('completing', () => {
    it('refuses a run that was never started - nothing was consumed', async () => {
      await expect(service.completeProduction('pb1', { actualQuantity: 90 } as any)).rejects.toThrow(/has not been started/);
      run.status = ProductionStatus.PAUSED;
      await expect(service.completeProduction('pb1', { actualQuantity: 90 } as any)).rejects.toThrow(/has not been started/);
    });

    it('completes a started run, and does not count the by-product as loss', async () => {
      Object.assign(run, { status: ProductionStatus.IN_PROGRESS, startedAt: new Date() });
      await service.completeProduction('pb1', { actualQuantity: 80, byProductQuantity: 15 } as any);
      expect(run.productionLoss).toBe(5);
      expect(run.status).toBe(ProductionStatus.COMPLETED);
    });

    it('refuses output plus by-product above what was consumed', async () => {
      Object.assign(run, { status: ProductionStatus.IN_PROGRESS, startedAt: new Date() });
      await expect(
        service.completeProduction('pb1', { actualQuantity: 90, byProductQuantity: 20 } as any),
      ).rejects.toThrow(/exceeds the 100 consumed/);
    });
  });

  describe('status moves', () => {
    it.each([
      [ProductionStatus.PLANNED, ProductionStatus.PAUSED],
      [ProductionStatus.CANCELLED, ProductionStatus.IN_PROGRESS],
      [ProductionStatus.CANCELLED, ProductionStatus.PLANNED],
      [ProductionStatus.IN_PROGRESS, ProductionStatus.PLANNED],
      [ProductionStatus.COMPLETED, ProductionStatus.PAUSED],
    ])('refuses %s -> %s', async (from, to) => {
      run.status = from;
      await expect(service.setStatus('pb1', to)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows pause and resume of a started run', async () => {
      Object.assign(run, { status: ProductionStatus.IN_PROGRESS, startedAt: new Date() });
      await service.setStatus('pb1', ProductionStatus.PAUSED);
      expect(run.status).toBe(ProductionStatus.PAUSED);
      await service.setStatus('pb1', ProductionStatus.IN_PROGRESS);
      expect(run.status).toBe(ProductionStatus.IN_PROGRESS);
    });

    it('releases the reservation when a planned run is cancelled', async () => {
      await service.setStatus('pb1', ProductionStatus.CANCELLED);
      expect(stockUpdates).toEqual([{ reservedQuantity: { decrement: 100 } }]);
    });

    it('keeps the transition table final for COMPLETED and CANCELLED', () => {
      expect(PRODUCTION_TRANSITIONS[ProductionStatus.COMPLETED]).toBeUndefined();
      expect(PRODUCTION_TRANSITIONS[ProductionStatus.CANCELLED]).toBeUndefined();
    });
  });

  describe('deleting', () => {
    it('refuses a started run - its consumption is in the ledger', async () => {
      Object.assign(run, { status: ProductionStatus.IN_PROGRESS, startedAt: new Date() });
      await expect(service.deleteProductionBatch('pb1')).rejects.toThrow(/cancel the run instead/);
      run.status = ProductionStatus.CANCELLED;
      await expect(service.deleteProductionBatch('pb1')).rejects.toThrow(/cancel the run instead/);
      expect(deleted).toEqual([]);
    });

    it('deletes a planned run and gives its reservation back, never touching quantity', async () => {
      await service.deleteProductionBatch('pb1');
      expect(stockUpdates).toEqual([{ reservedQuantity: { decrement: 100 } }]);
      expect(deleted).toEqual(['consumptions', 'run']);
    });
  });

  describe('starting', () => {
    it('refuses when the machine is already running another batch', async () => {
      otherRunOnMachine = { productionBatchNumber: 'PB-20261022-002' };
      await expect(service.startProduction('pb1', 'u1')).rejects.toThrow(/already running PB-20261022-002/);
    });

    it('refuses when the recipe was retired after planning', async () => {
      run.recipe.status = 'INACTIVE';
      await expect(service.startProduction('pb1', 'u1')).rejects.toThrow(/now INACTIVE/);
    });

    it('turns the reservation into consumption in one step', async () => {
      await service.startProduction('pb1', 'u1');
      expect(stockUpdates).toEqual([{ reservedQuantity: { decrement: 100 }, quantity: { decrement: 100 } }]);
      expect(run.status).toBe(ProductionStatus.IN_PROGRESS);
    });
  });
});
