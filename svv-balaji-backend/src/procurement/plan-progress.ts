import { Prisma, PrismaClient, ProcurementPlanStatus } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export interface PlanProgress {
  /** Net weight collected against the plan, in the plan's unit. */
  collectedQuantity: number;
  collectionCount: number;
  /** 0-100+, rounded to 1 dp. Can exceed 100 when the target is beaten. */
  progressPercent: number;
}

/**
 * Collected-vs-planned for each plan, computed live from collections
 * (collection -> inspection -> plan). Only collections in the plan's own unit
 * are summed: converting KG to QUINTAL etc. would be a guess.
 *
 * Kept as a separate top-level query rather than a nested include filter
 * (see the relationJoins nested-filter issue).
 */
export async function planProgress(
  db: Db,
  plans: { id: string; plannedQuantity: Prisma.Decimal | number; unit: string }[],
): Promise<Map<string, PlanProgress>> {
  const out = new Map<string, PlanProgress>();
  if (!plans.length) return out;
  const rows = await db.rawMaterialCollection.findMany({
    where: { inspection: { procurementPlanId: { in: plans.map((p) => p.id) } } },
    select: { netWeight: true, unit: true, inspection: { select: { procurementPlanId: true } } },
  });
  for (const p of plans) {
    const mine = rows.filter(
      (r) => r.inspection.procurementPlanId === p.id && r.unit.toUpperCase() === p.unit.toUpperCase(),
    );
    const collected = mine.reduce((s, r) => s + Number(r.netWeight), 0);
    const planned = Number(p.plannedQuantity);
    out.set(p.id, {
      collectedQuantity: Math.round(collected * 100) / 100,
      collectionCount: mine.length,
      progressPercent: planned > 0 ? Math.round((collected / planned) * 1000) / 10 : 0,
    });
  }
  return out;
}

/**
 * Moves a plan forward when work happens against it:
 *   DRAFT / SCHEDULED -> IN_PROGRESS  once an inspection or collection is recorded
 *   IN_PROGRESS       -> COMPLETED    once the collected quantity reaches the target
 * Never moves a plan backwards and never touches COMPLETED / CANCELLED, so a
 * manual status choice is not overridden.
 */
export async function advancePlanStatus(db: Db, planId: string | null | undefined): Promise<void> {
  if (!planId) return;
  const plan = await db.procurementPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  if (plan.status === ProcurementPlanStatus.COMPLETED || plan.status === ProcurementPlanStatus.CANCELLED) return;

  const progress = (await planProgress(db, [plan])).get(plan.id)!;
  let next: ProcurementPlanStatus = plan.status;
  if (plan.status === ProcurementPlanStatus.DRAFT || plan.status === ProcurementPlanStatus.SCHEDULED) {
    next = ProcurementPlanStatus.IN_PROGRESS;
  }
  if (next === ProcurementPlanStatus.IN_PROGRESS && progress.collectedQuantity >= Number(plan.plannedQuantity) && Number(plan.plannedQuantity) > 0) {
    next = ProcurementPlanStatus.COMPLETED;
  }
  if (next !== plan.status) {
    await db.procurementPlan.update({ where: { id: plan.id }, data: { status: next } });
  }
}
