import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductionType, RecipeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto, RecipeCustomFieldDto, SetHowItsMadeUrlDto } from './dto/recipe.dto';

/** Who changed the "how it's made" link, newest first. */
const LINK_LOGS = {
  linkLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
    select: { fromUrl: true, toUrl: true, createdAt: true, changedBy: { select: { id: true, fullName: true } } },
  },
};

/** Same key production matches batches to ingredients on. */
const normaliseCrop = (crop: string) => crop.trim().toLowerCase();

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a recipe at version 1, or a new version if the code already exists.
   * Recipes are never edited in place once approved (FRD 19.6) - production
   * batches pin the version they used, so mutating an approved recipe would
   * silently rewrite the history of everything already made from it.
   */
  async create(dto: CreateRecipeDto, createdById: string) {
    this.validateIngredients(dto);
    const customFields = this.cleanCustomFields(dto.customFields);

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');

    const latest = await this.prisma.recipe.findFirst({
      where: { recipeCode: dto.recipeCode },
      orderBy: { version: 'desc' },
    });
    // A new version is the same recipe revised - it cannot move to another product.
    if (latest && latest.productId !== dto.productId) {
      throw new BadRequestException(
        `Recipe code ${dto.recipeCode} belongs to another product - choose a new code for this product`,
      );
    }
    const version = latest ? latest.version + 1 : 1;

    return this.prisma.recipe.create({
      data: {
        recipeCode: dto.recipeCode,
        version,
        productId: dto.productId,
        name: dto.name,
        category: dto.category,
        description: dto.description,
        productionType: dto.productionType,
        mixingRatio: dto.mixingRatio,
        processingSequence: dto.processingSequence,
        grindingInstructions: dto.grindingInstructions,
        roastingInstructions: dto.roastingInstructions,
        oilExtractionProcess: dto.oilExtractionProcess,
        packagingInstructions: dto.packagingInstructions,
        howItsMadeUrl: dto.howItsMadeUrl?.trim() || null,
        customFields: customFields.length ? (customFields as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        batchYieldQuantity: dto.batchYieldQuantity,
        expectedLossPercent: dto.expectedLossPercent,
        unit: dto.unit ?? 'KG',
        createdById,
        ingredients: {
          create: dto.ingredients.map((i) => ({
            cropName: i.cropName.trim(),
            quantity: i.quantity,
            unit: i.unit ?? 'KG',
            percentage: i.percentage,
          })),
        },
      },
      include: { ingredients: true, product: { select: { id: true, name: true, sku: true } } },
    });
  }

  /**
   * FRD 19.2 - a single-grain recipe has exactly one ingredient; a multigrain
   * blend needs percentages that add up to 100, otherwise the ratio is
   * meaningless and the blend is unreproducible.
   */
  private validateIngredients(dto: CreateRecipeDto) {
    if (dto.productionType === ProductionType.SINGLE_GRAIN) {
      if (dto.ingredients.length !== 1) {
        throw new BadRequestException(
          'A SINGLE_GRAIN recipe must have exactly one ingredient',
        );
      }
      return;
    }

    if (dto.ingredients.length < 2) {
      throw new BadRequestException('A MULTI_GRAIN recipe needs at least two ingredients');
    }

    const missing = dto.ingredients.filter((i) => i.percentage === undefined || i.percentage === null);
    if (missing.length) {
      throw new BadRequestException(
        'Every MULTI_GRAIN ingredient needs a percentage so the blend ratio is reproducible',
      );
    }

    const total = dto.ingredients.reduce((sum, i) => sum + Number(i.percentage), 0);
    // Allow a small rounding tolerance on percentages like 33.33.
    if (Math.abs(total - 100) > 0.05) {
      throw new BadRequestException(
        `MULTI_GRAIN ingredient percentages must total 100 (got ${total.toFixed(2)})`,
      );
    }

    const dupes = dto.ingredients
      .map((i) => i.cropName.trim().toLowerCase())
      .filter((c, idx, arr) => arr.indexOf(c) !== idx);
    if (dupes.length) {
      throw new BadRequestException(`Duplicate ingredient in recipe: ${dupes[0]}`);
    }
  }

  /** Trimmed, blank rows dropped; two fields with the same label would be ambiguous. */
  private cleanCustomFields(fields: RecipeCustomFieldDto[] = []) {
    const rows = fields
      .map((f) => ({ label: f.label.trim(), value: (f.value ?? '').trim() }))
      .filter((f) => f.label && f.value);
    const seen = new Set<string>();
    for (const f of rows) {
      const key = f.label.toLowerCase();
      if (seen.has(key)) throw new BadRequestException(`The field "${f.label}" is added twice`);
      seen.add(key);
    }
    return rows;
  }

  /**
   * What the recipe form can fill in for Super Admin: every crop name already
   * known (raw batches first, as production matches against those, then
   * agreements, procurement plans and earlier recipes), with what is in stock;
   * and labels of extra fields used on earlier recipes.
   */
  async formOptions() {
    const [batches, stock, agreements, plans, ingredients, recipes] = await Promise.all([
      this.prisma.rawMaterialBatch.groupBy({ by: ['cropName'], _count: { _all: true } }),
      this.prisma.warehouseStock.findMany({
        where: { quantity: { gt: 0 } },
        select: { quantity: true, reservedQuantity: true, unit: true, batch: { select: { cropName: true } } },
      }),
      this.prisma.agreement.groupBy({ by: ['cropName'] }),
      this.prisma.procurementPlan.groupBy({ by: ['cropName'] }),
      this.prisma.recipeIngredient.groupBy({ by: ['cropName'] }),
      this.prisma.recipe.findMany({
        where: { customFields: { not: Prisma.DbNull } },
        select: { customFields: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    ]);

    type Crop = { cropName: string; batchCount: number; availableQuantity: number; unit: string; seenIn: Set<string> };
    const crops = new Map<string, Crop>();
    const note = (name: string | null | undefined, source: string) => {
      const cropName = name?.trim();
      if (!cropName) return null;
      const key = normaliseCrop(cropName);
      // The first spelling seen wins, and raw batches are read first.
      const crop = crops.get(key) ?? { cropName, batchCount: 0, availableQuantity: 0, unit: 'KG', seenIn: new Set<string>() };
      crop.seenIn.add(source);
      crops.set(key, crop);
      return crop;
    };
    for (const b of batches) {
      const crop = note(b.cropName, 'Raw batches');
      if (crop) crop.batchCount += b._count._all;
    }
    for (const s of stock) {
      const crop = note(s.batch.cropName, 'Raw batches');
      if (!crop) continue;
      crop.availableQuantity += Math.max(0, Number(s.quantity) - Number(s.reservedQuantity));
      crop.unit = s.unit;
    }
    for (const a of agreements) note(a.cropName, 'Agreements');
    for (const p of plans) note(p.cropName, 'Procurement plans');
    for (const i of ingredients) note(i.cropName, 'Recipes');

    const labels = new Map<string, string>();
    for (const r of recipes) {
      if (!Array.isArray(r.customFields)) continue;
      for (const f of r.customFields as Array<{ label?: unknown }>) {
        const label = typeof f?.label === 'string' ? f.label.trim() : '';
        if (label && !labels.has(label.toLowerCase())) labels.set(label.toLowerCase(), label);
      }
    }

    return {
      crops: [...crops.values()]
        .map((c) => ({ ...c, availableQuantity: Math.round(c.availableQuantity * 100) / 100, seenIn: [...c.seenIn] }))
        .sort((a, b) => b.availableQuantity - a.availableQuantity || b.batchCount - a.batchCount || a.cropName.localeCompare(b.cropName)),
      customFieldLabels: [...labels.values()],
    };
  }

  findAll(filters: { status?: RecipeStatus; productId?: string; recipeCode?: string }) {
    return this.prisma.recipe.findMany({
      where: filters,
      orderBy: [{ recipeCode: 'asc' }, { version: 'desc' }],
      include: {
        ingredients: true,
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        ingredients: true,
        product: { select: { id: true, name: true, sku: true } },
        createdBy: { select: { id: true, fullName: true } },
        approvedBy: { select: { id: true, fullName: true } },
        ...LINK_LOGS,
      },
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    return recipe;
  }

  /** FRD 19.6 - all versions of a code, newest first. */
  findVersions(recipeCode: string) {
    return this.prisma.recipe.findMany({
      where: { recipeCode },
      orderBy: { version: 'desc' },
      include: { ingredients: true, ...LINK_LOGS },
    });
  }

  /**
   * FRD 19.4 - approval gate. Approving a version supersedes any previously
   * approved version of the same code, so exactly one is live at a time.
   */
  async approve(id: string, approvedById: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    if (recipe.status === RecipeStatus.APPROVED) {
      throw new BadRequestException('Recipe is already approved');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.recipe.updateMany({
        where: { recipeCode: recipe.recipeCode, status: RecipeStatus.APPROVED },
        data: { status: RecipeStatus.INACTIVE },
      });

      return tx.recipe.update({
        where: { id },
        data: {
          status: RecipeStatus.APPROVED,
          approvedById,
          approvedAt: new Date(),
        },
        include: { ingredients: true },
      });
    });
  }

  /**
   * Change the "how this is made" link on any version, approved ones included:
   * it is presentation, not formula, so it needs no new version or re-approval.
   */
  async setHowItsMadeUrl(id: string, dto: SetHowItsMadeUrlDto, changedById: string) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id }, select: { id: true, howItsMadeUrl: true } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    const toUrl = dto.howItsMadeUrl?.trim() || null;
    if (toUrl === recipe.howItsMadeUrl) return this.findOne(id);
    // Logged: the link is the one thing that changes on an approved version without a new version.
    return this.prisma.$transaction(async (tx) => {
      await tx.recipeLinkLog.create({ data: { recipeId: id, fromUrl: recipe.howItsMadeUrl, toUrl, changedById } });
      return tx.recipe.update({ where: { id }, data: { howItsMadeUrl: toUrl }, include: { ingredients: true } });
    });
  }

  async setStatus(id: string, status: RecipeStatus) {
    const recipe = await this.prisma.recipe.findUnique({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    if (status === RecipeStatus.APPROVED) {
      throw new BadRequestException('Use the /approve endpoint to approve a recipe');
    }
    // An approved formula of record can be retired, not quietly reopened for
    // editing: a revision is a new version that goes through approval again.
    if (recipe.status === RecipeStatus.APPROVED && status !== RecipeStatus.INACTIVE) {
      throw new BadRequestException(
        'An approved recipe can only be made INACTIVE. To change it, create a new version and approve that.',
      );
    }
    return this.prisma.recipe.update({ where: { id }, data: { status } });
  }
}
