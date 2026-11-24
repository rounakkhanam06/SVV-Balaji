import { BadRequestException } from '@nestjs/common';
import { ProductionType } from '@prisma/client';
import { checkConsumptionLimit, expectedInputKg } from './consumption-limit.logic';
import { ProductionService } from './production.service';

/**
 * Consumption limit (client decision 24 Nov 2026): raw material used may differ
 * from the recipe by at most the Super Admin's tolerance, over or under, unless
 * a Production Manager approves.
 */
describe('consumption limit - calculation', () => {
  const base = { plannedQuantity: 100, unit: 'KG', batchYieldQuantity: null, expectedLossPercent: 2, ingredients: [] };

  it('grosses the planned output up by the loss: 100 kg FG at 2% loss needs 102.04 kg', () => {
    expect(expectedInputKg(base)).toBeCloseTo(102.04, 2);
  });

  it('uses ingredient quantities scaled by batch yield when the recipe has them', () => {
    // Y = 100, wheat 105.3 per batch, run of 500 -> 526.5
    expect(expectedInputKg({ ...base, plannedQuantity: 500, batchYieldQuantity: 100, ingredients: [{ quantity: 105.3, unit: 'KG' }] })).toBeCloseTo(526.5, 3);
  });

  it('flags over and under alike, and passes inside the band', () => {
    const at = (kg: number) => checkConsumptionLimit({ ...base, consumed: [{ quantity: kg, unit: 'KG' }], tolerancePercent: 2 })!;
    expect(at(102.04).withinLimit).toBe(true);
    expect(at(104).withinLimit).toBe(true); // +1.92%
    expect(at(105).withinLimit).toBe(false); // +2.9%
    expect(at(99).withinLimit).toBe(false); // -2.98%
    expect(at(105).minKg).toBeCloseTo(100, 0);
  });

  it('applies no limit when the output is not a mass (oil in litres, no density yet)', () => {
    expect(checkConsumptionLimit({ ...base, unit: 'LITRE', consumed: [{ quantity: 500, unit: 'KG' }], tolerancePercent: 2 })).toBeNull();
  });
});

describe('consumption limit - production flow', () => {
  let prisma: any;
  let tx: any;
  let alerts: { notify: jest.Mock };
  let service: ProductionService;
  let run: any;

  const create = (quantityUsed: number, extra: Record<string, unknown> = {}) =>
    service.createProductionBatch(
      { recipeId: 'r1', warehouseId: 'w1', branchId: 'b1', productionDate: '2026-11-24', plannedQuantity: 100, consumptions: [{ rawMaterialBatchId: 'rm1', quantityUsed }], ...extra } as any,
      'operator',
    );

  beforeEach(() => {
    run = null;
    tx = {
      productionBatch: {
        create: jest.fn(async ({ data }: any) => (run = { id: 'pb1', productionBatchNumber: 'PB-20261124-001', ...data })),
        findUnique: jest.fn(async () => run),
        update: jest.fn(async ({ data }: any) => Object.assign(run, data)),
      },
      productionConsumption: { create: jest.fn(async () => ({})) },
      warehouseStock: { update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({})), findUnique: jest.fn(async () => ({})) },
      stockMovement: { create: jest.fn(async () => ({})) },
      rawMaterialBatch: { update: jest.fn(async () => ({})) },
    };
    prisma = {
      recipe: {
        findUnique: jest.fn(async () => ({
          id: 'r1', recipeCode: 'ATTA', version: 1, status: 'APPROVED', productId: 'p1', unit: 'KG',
          productionType: ProductionType.SINGLE_GRAIN, batchYieldQuantity: null, expectedLossPercent: 2,
          ingredients: [{ cropName: 'Wheat', quantity: 102.04, unit: 'KG', percentage: 100 }],
        })),
      },
      rawMaterialBatch: {
        findMany: jest.fn(async () => [{ id: 'rm1', batchNumber: 'RM-1', cropName: 'Wheat', status: 'STORED', stock: [{ warehouseId: 'w1', quantity: 10000, reservedQuantity: 0 }] }]),
      },
      cleaningGradingRecord: { findFirst: jest.fn(async () => null) },
      qualityInspection: { findFirst: jest.fn(async () => null) },
      productionSettings: { findFirst: jest.fn(async () => ({ id: 's', consumptionTolerancePercent: 2 })) },
      productionBatch: {
        findUnique: jest.fn(async () => run),
        findFirst: jest.fn(async () => null),
        update: tx.productionBatch.update,
      },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    alerts = { notify: jest.fn() };
    service = new ProductionService(prisma, { next: jest.fn(async () => 'PB-20261124-001') } as any, {} as any, alerts as any);
  });

  it('within the limit: runs as asked, no approval, no alert', async () => {
    await create(102);
    expect(run.status).toBe('IN_PROGRESS');
    expect(run.consumptionApproval).toBeNull();
    expect(Number(run.expectedInputQuantity)).toBeCloseTo(102.04, 2);
    expect(alerts.notify).not.toHaveBeenCalled();
  });

  it('outside the limit without a reason: refused, with the allowed range in the message', async () => {
    await expect(create(110)).rejects.toThrow(/over the recipe's 102\.04 kg/);
    await expect(create(90)).rejects.toThrow(BadRequestException);
  });

  it('outside the limit with a reason: held as PLANNED + PENDING (stock reserved, not consumed) and the PM is alerted', async () => {
    await create(110, { status: 'IN_PROGRESS', consumptionReason: 'Moist grain' });
    expect(run.status).toBe('PLANNED');
    expect(run.consumptionApproval).toBe('PENDING');
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.warehouseStock.update).toHaveBeenCalledWith(expect.objectContaining({ data: { reservedQuantity: { increment: 110 } } }));
    expect(alerts.notify).toHaveBeenCalledWith(expect.objectContaining({ type: 'CONSUMPTION_APPROVAL', permission: 'production.approveConsumption' }));
  });

  it('a pending run cannot start; after approval it can', async () => {
    await create(110, { status: 'PLANNED', consumptionReason: 'Moist grain' });
    run.consumptions = [{ rawMaterialBatchId: 'rm1', quantityUsed: 110 }];
    run.recipe = { status: 'APPROVED', recipeCode: 'ATTA' };
    await expect(service.startProduction('pb1', 'operator')).rejects.toThrow(/waiting for a Production Manager/);

    await expect(service.decideConsumption('pb1', { decision: 'APPROVED' }, { sub: 'operator', role: 'PRODUCTION_MANAGER' } as any)).rejects.toThrow(/another Production Manager/);
    await service.decideConsumption('pb1', { decision: 'APPROVED' }, { sub: 'pm2', role: 'PRODUCTION_MANAGER' } as any);
    expect(run.consumptionApproval).toBe('APPROVED');
    await expect(service.startProduction('pb1', 'operator')).resolves.toBeDefined();
    expect(run.status).toBe('IN_PROGRESS');
  });

  it('rejection needs a note, cancels the run and releases the reservation', async () => {
    await create(110, { status: 'PLANNED', consumptionReason: 'Moist grain' });
    run.consumptions = [{ rawMaterialBatchId: 'rm1', quantityUsed: 110 }];
    const pm = { sub: 'pm2', role: 'PRODUCTION_MANAGER' } as any;
    await expect(service.decideConsumption('pb1', { decision: 'REJECTED' }, pm)).rejects.toThrow(/reason/);
    await service.decideConsumption('pb1', { decision: 'REJECTED', note: 'Re-weigh' }, pm);
    expect(run.status).toBe('CANCELLED');
    expect(run.consumptionApproval).toBe('REJECTED');
  });
});
