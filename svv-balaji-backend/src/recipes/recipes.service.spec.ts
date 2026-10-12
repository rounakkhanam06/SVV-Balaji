import { NotFoundException } from '@nestjs/common';
import { Prisma, ProductionType, RecipeStatus } from '@prisma/client';
import { RecipesService } from './recipes.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Recipes are the formula of record. Two properties matter most: a multigrain
 * blend whose percentages don't total 100 is unreproducible, and approving a
 * version must supersede the previous one so exactly one is live.
 */
describe('RecipesService', () => {
  let prisma: any;
  let service: RecipesService;
  let recipes: any[];

  beforeEach(() => {
    recipes = [];
    prisma = {
      product: { findUnique: jest.fn(async ({ where }) => ({ id: where.id, name: 'Atta' })) },
      recipe: {
        findFirst: jest.fn(async ({ where }) => {
          const matches = recipes
            .filter((r) => r.recipeCode === where.recipeCode)
            .sort((a, b) => b.version - a.version);
          return matches[0] ?? null;
        }),
        findUnique: jest.fn(async ({ where }) => recipes.find((r) => r.id === where.id) ?? null),
        create: jest.fn(async ({ data }) => {
          const row = { id: `r-${recipes.length + 1}`, ...data };
          recipes.push(row);
          return row;
        }),
        update: jest.fn(async ({ where, data }) => {
          const r = recipes.find((x) => x.id === where.id);
          Object.assign(r, data);
          return r;
        }),
        updateMany: jest.fn(async ({ where, data }) => {
          recipes
            .filter((r) => r.recipeCode === where.recipeCode && r.status === where.status)
            .forEach((r) => Object.assign(r, data));
          return { count: 0 };
        }),
      },
      recipeLinkLog: { create: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (cb: any) => cb(prisma)),
    };
    service = new RecipesService(prisma as unknown as PrismaService);
  });

  const singleGrain = {
    recipeCode: 'WF-001',
    productId: 'p-1',
    name: 'Wheat Flour',
    productionType: ProductionType.SINGLE_GRAIN,
    ingredients: [{ cropName: 'Wheat', quantity: 100 }],
  };

  const multiGrain = {
    recipeCode: 'MG-001',
    productId: 'p-1',
    name: 'Multigrain Atta',
    productionType: ProductionType.MULTI_GRAIN,
    ingredients: [
      { cropName: 'Wheat', quantity: 60, percentage: 60 },
      { cropName: 'Barley', quantity: 25, percentage: 25 },
      { cropName: 'Millet', quantity: 15, percentage: 15 },
    ],
  };

  describe('ingredient validation', () => {
    it('accepts a single-grain recipe with exactly one ingredient', async () => {
      const r = await service.create(singleGrain as any, 'u-1');
      expect(r.version).toBe(1);
    });

    it('rejects a single-grain recipe with more than one ingredient', async () => {
      await expect(
        service.create(
          { ...singleGrain, ingredients: [
            { cropName: 'Wheat', quantity: 50 },
            { cropName: 'Barley', quantity: 50 },
          ] } as any,
          'u-1',
        ),
      ).rejects.toThrow(/exactly one ingredient/);
    });

    it('accepts a multigrain blend whose percentages total 100', async () => {
      const r = await service.create(multiGrain as any, 'u-1');
      expect(r.productionType).toBe(ProductionType.MULTI_GRAIN);
    });

    it('rejects a multigrain blend that does not total 100', async () => {
      await expect(
        service.create(
          { ...multiGrain, ingredients: [
            { cropName: 'Wheat', quantity: 60, percentage: 60 },
            { cropName: 'Barley', quantity: 25, percentage: 25 },
          ] } as any,
          'u-1',
        ),
      ).rejects.toThrow(/must total 100/);
    });

    it('tolerates rounding on thirds (33.33 x 3)', async () => {
      const r = await service.create(
        { ...multiGrain, ingredients: [
          { cropName: 'Wheat', quantity: 1, percentage: 33.33 },
          { cropName: 'Barley', quantity: 1, percentage: 33.33 },
          { cropName: 'Millet', quantity: 1, percentage: 33.34 },
        ] } as any,
        'u-1',
      );
      expect(r).toBeDefined();
    });

    it('requires a percentage on every multigrain ingredient', async () => {
      await expect(
        service.create(
          { ...multiGrain, ingredients: [
            { cropName: 'Wheat', quantity: 60, percentage: 60 },
            { cropName: 'Barley', quantity: 40 },
          ] } as any,
          'u-1',
        ),
      ).rejects.toThrow(/needs a percentage/);
    });

    it('rejects duplicate crops in one recipe', async () => {
      await expect(
        service.create(
          { ...multiGrain, ingredients: [
            { cropName: 'Wheat', quantity: 50, percentage: 50 },
            { cropName: 'wheat', quantity: 50, percentage: 50 },
          ] } as any,
          'u-1',
        ),
      ).rejects.toThrow(/Duplicate ingredient/);
    });

    it('rejects a multigrain recipe with only one ingredient', async () => {
      await expect(
        service.create(
          { ...multiGrain, ingredients: [{ cropName: 'Wheat', quantity: 100, percentage: 100 }] } as any,
          'u-1',
        ),
      ).rejects.toThrow(/at least two ingredients/);
    });
  });

  describe('versioning', () => {
    it('starts at version 1 and increments per recipeCode', async () => {
      const v1 = await service.create(singleGrain as any, 'u-1');
      const v2 = await service.create(singleGrain as any, 'u-1');
      const v3 = await service.create(singleGrain as any, 'u-1');
      expect([v1.version, v2.version, v3.version]).toEqual([1, 2, 3]);
    });

    it('versions different codes independently', async () => {
      await service.create(singleGrain as any, 'u-1');
      const other = await service.create({ ...singleGrain, recipeCode: 'WF-002' } as any, 'u-1');
      expect(other.version).toBe(1);
    });
  });

  describe('approval', () => {
    it('marks the version approved and stamps the approver', async () => {
      const r = await service.create(singleGrain as any, 'u-1');
      const approved = await service.approve(r.id, 'admin-1');
      expect(approved.status).toBe(RecipeStatus.APPROVED);
      expect(approved.approvedById).toBe('admin-1');
      expect(approved.approvedAt).toBeInstanceOf(Date);
    });

    it('supersedes the previously approved version of the same code', async () => {
      const v1 = await service.create(singleGrain as any, 'u-1');
      await service.approve(v1.id, 'admin-1');
      const v2 = await service.create(singleGrain as any, 'u-1');
      await service.approve(v2.id, 'admin-1');

      const stored1 = recipes.find((r) => r.id === v1.id);
      const stored2 = recipes.find((r) => r.id === v2.id);
      expect(stored1.status).toBe(RecipeStatus.INACTIVE);
      expect(stored2.status).toBe(RecipeStatus.APPROVED);

      const live = recipes.filter((r) => r.status === RecipeStatus.APPROVED);
      expect(live).toHaveLength(1);
    });

    it('refuses to approve twice', async () => {
      const r = await service.create(singleGrain as any, 'u-1');
      await service.approve(r.id, 'admin-1');
      await expect(service.approve(r.id, 'admin-1')).rejects.toThrow(/already approved/);
    });

    it('throws for an unknown recipe', async () => {
      await expect(service.approve('nope', 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('will not let setStatus be used to approve', async () => {
      const r = await service.create(singleGrain as any, 'u-1');
      await expect(service.setStatus(r.id, RecipeStatus.APPROVED)).rejects.toThrow(
        /use the \/approve endpoint/i,
      );
    });
  });

  describe('custom formula fields', () => {
    it('stores them trimmed and in order, dropping blank rows', async () => {
      const r = await service.create(
        {
          ...singleGrain,
          customFields: [
            { label: ' Sieve size ', value: ' 60 mesh ' },
            { label: 'Moisture', value: '' },
            { label: 'Rest time', value: '2 h' },
          ],
        } as any,
        'u-1',
      );
      expect(r.customFields).toEqual([
        { label: 'Sieve size', value: '60 mesh' },
        { label: 'Rest time', value: '2 h' },
      ]);
    });

    it('stores none as a database null', async () => {
      const r = await service.create(singleGrain as any, 'u-1');
      expect(r.customFields).toBe(Prisma.DbNull);
    });

    it('refuses the same label twice, whatever the case', async () => {
      await expect(
        service.create(
          { ...singleGrain, customFields: [{ label: 'Sieve size', value: 'a' }, { label: 'sieve SIZE', value: 'b' }] } as any,
          'u-1',
        ),
      ).rejects.toThrow(/added twice/);
    });
  });

  describe('form options', () => {
    beforeEach(() => {
      prisma.rawMaterialBatch = {
        groupBy: jest.fn(async () => [
          { cropName: 'Wheat', _count: { _all: 3 } },
          { cropName: 'Ragi', _count: { _all: 1 } },
        ]),
      };
      prisma.warehouseStock = {
        findMany: jest.fn(async () => [
          { quantity: 100, reservedQuantity: 20, unit: 'KG', batch: { cropName: 'Wheat' } },
          { quantity: 50, reservedQuantity: 0, unit: 'KG', batch: { cropName: 'wheat ' } },
        ]),
      };
      prisma.agreement = { groupBy: jest.fn(async () => [{ cropName: 'WHEAT' }, { cropName: 'Bajra' }]) };
      prisma.procurementPlan = { groupBy: jest.fn(async () => [{ cropName: 'Jowar' }]) };
      prisma.recipeIngredient = { groupBy: jest.fn(async () => [{ cropName: 'ragi' }]) };
      prisma.recipe.findMany = jest.fn(async () => [
        { customFields: [{ label: 'Sieve size', value: 'x' }, { label: 'Rest time', value: 'y' }] },
        { customFields: [{ label: 'sieve size', value: 'z' }] },
      ]);
    });

    it('merges spellings the way production matches, keeping the batch spelling', async () => {
      const { crops } = await service.formOptions();
      expect(crops.map((c) => c.cropName)).toEqual(['Wheat', 'Ragi', 'Bajra', 'Jowar']);
      const wheat = crops[0];
      expect(wheat.seenIn).toEqual(['Raw batches', 'Agreements']);
      expect(wheat.batchCount).toBe(3);
    });

    it('counts unreserved stock only, and ranks crops in stock first', async () => {
      const { crops } = await service.formOptions();
      expect(crops[0]).toMatchObject({ cropName: 'Wheat', availableQuantity: 130, unit: 'KG' });
      expect(crops.find((c) => c.cropName === 'Ragi')!.availableQuantity).toBe(0);
    });

    it('offers each earlier field label once', async () => {
      const { customFieldLabels } = await service.formOptions();
      expect(customFieldLabels).toEqual(['Sieve size', 'Rest time']);
    });
  });

  it('refuses a new version of a code that belongs to another product', async () => {
    await service.create(singleGrain as any, 'u-1');
    await expect(service.create({ ...singleGrain, productId: 'p-2' } as any, 'u-1')).rejects.toThrow(/belongs to another product/);
  });

  it('stores the expected processing loss', async () => {
    const r = await service.create({ ...singleGrain, expectedLossPercent: 4.5 } as any, 'u-1');
    expect(r.expectedLossPercent).toBe(4.5);
  });

  describe('how-it-is-made link', () => {
    it('is saved on create, trimmed', async () => {
      const r = await service.create({ ...singleGrain, howItsMadeUrl: ' https://youtu.be/abc ' } as any, 'u-1');
      expect(r.howItsMadeUrl).toBe('https://youtu.be/abc');
    });

    it('can be changed on an approved version without a new version', async () => {
      const r = await service.create(singleGrain as any, 'u-1');
      await service.approve(r.id, 'admin-1');
      await service.setHowItsMadeUrl(r.id, { howItsMadeUrl: 'https://www.instagram.com/reel/x/' }, 'admin-1');
      expect(recipes).toHaveLength(1);
      expect(recipes[0]).toMatchObject({ status: RecipeStatus.APPROVED, howItsMadeUrl: 'https://www.instagram.com/reel/x/' });
      expect(prisma.recipeLinkLog.create).toHaveBeenCalledWith({
        data: { recipeId: r.id, fromUrl: null, toUrl: 'https://www.instagram.com/reel/x/', changedById: 'admin-1' },
      });
    });

    it('is cleared by an empty value', async () => {
      const r = await service.create({ ...singleGrain, howItsMadeUrl: 'https://youtu.be/abc' } as any, 'u-1');
      await service.setHowItsMadeUrl(r.id, { howItsMadeUrl: '' }, 'admin-1');
      expect(recipes[0].howItsMadeUrl).toBeNull();
      expect(prisma.recipeLinkLog.create.mock.calls[0][0].data).toMatchObject({ fromUrl: 'https://youtu.be/abc', toUrl: null });
    });

    it('logs nothing when the link did not change', async () => {
      const r = await service.create({ ...singleGrain, howItsMadeUrl: 'https://youtu.be/abc' } as any, 'u-1');
      await service.setHowItsMadeUrl(r.id, { howItsMadeUrl: ' https://youtu.be/abc ' }, 'admin-1');
      expect(prisma.recipeLinkLog.create).not.toHaveBeenCalled();
    });

    it('throws for an unknown recipe', async () => {
      await expect(service.setHowItsMadeUrl('nope', { howItsMadeUrl: null }, 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });
});
