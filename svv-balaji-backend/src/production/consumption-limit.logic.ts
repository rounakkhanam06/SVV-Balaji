import { kgOf } from '../packaging/packaging.service';

/**
 * Consumption limit (client decision 24 Nov 2026).
 *
 * The recipe says how much raw material a run of a given size needs. Using more
 * or less than that by more than the Super Admin's tolerance is not allowed
 * without a Production Manager's approval.
 *
 *   expected input = sum over ingredients of q x (planned / batch yield)
 *   fallback (no batch yield / ingredient qty) = planned / (1 - loss%)
 *   variance %     = (actual - expected) / expected x 100
 *
 * Everything is compared in kg. If any figure is not a mass (oil in litres
 * before density is recorded) the limit cannot be computed and returns null:
 * the run is not blocked on a number the system cannot work out.
 */
export interface ConsumptionLimitInput {
  plannedQuantity: number;
  unit: string;
  batchYieldQuantity: number | null;
  expectedLossPercent: number | null;
  ingredients: Array<{ quantity: number; unit: string }>;
  /** Actual raw quantities entered, in their units (raw stock is KG). */
  consumed: Array<{ quantity: number; unit: string }>;
  tolerancePercent: number;
}

export interface ConsumptionLimitResult {
  expectedKg: number;
  actualKg: number;
  minKg: number;
  maxKg: number;
  variancePercent: number;
  tolerancePercent: number;
  withinLimit: boolean;
}

const round = (n: number, dp: number) => Number(n.toFixed(dp));

export function expectedInputKg(i: Omit<ConsumptionLimitInput, 'consumed' | 'tolerancePercent'>): number | null {
  const yieldQty = i.batchYieldQuantity ?? 0;
  if (yieldQty > 0 && i.ingredients.length > 0) {
    const perBatch = i.ingredients.map((g) => kgOf(g.quantity, g.unit));
    const yieldKg = kgOf(yieldQty, i.unit);
    const plannedKg = kgOf(i.plannedQuantity, i.unit);
    if (perBatch.every((q) => q !== null) && yieldKg && plannedKg !== null) {
      const total = (perBatch as number[]).reduce((s, q) => s + q, 0);
      if (total > 0) return (total * plannedKg) / yieldKg;
    }
  }
  const plannedKg = kgOf(i.plannedQuantity, i.unit);
  const loss = i.expectedLossPercent ?? 0;
  if (plannedKg === null || loss >= 100) return null;
  return plannedKg / (1 - loss / 100);
}

export function checkConsumptionLimit(i: ConsumptionLimitInput): ConsumptionLimitResult | null {
  const expected = expectedInputKg(i);
  const actual = i.consumed.map((c) => kgOf(c.quantity, c.unit));
  if (expected === null || expected <= 0 || actual.some((q) => q === null)) return null;
  const actualKg = (actual as number[]).reduce((s, q) => s + q, 0);
  const tol = Math.max(0, i.tolerancePercent);
  const variance = ((actualKg - expected) / expected) * 100;
  return {
    expectedKg: round(expected, 2),
    actualKg: round(actualKg, 2),
    minKg: round(expected * (1 - tol / 100), 2),
    maxKg: round(expected * (1 + tol / 100), 2),
    variancePercent: round(variance, 2),
    tolerancePercent: tol,
    // Small epsilon so 102.04 vs a 102.040001 limit does not flag.
    withinLimit: Math.abs(variance) <= tol + 1e-6,
  };
}
