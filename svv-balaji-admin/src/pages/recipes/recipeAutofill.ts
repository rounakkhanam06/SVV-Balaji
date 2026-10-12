/**
 * The arithmetic the recipe form fills in for Super Admin, kept pure so the
 * form only decides *when* to apply it.
 */

const round = (value: number, places: number) => {
  const f = 10 ** places;
  return Math.round(value * f) / f;
};

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * "40, 30, 20, 10" -> "4:3:2:1". Percentages are taken to two decimals, so
 * 33.33 / 33.33 / 33.34 stays exact rather than being rounded into 1:1:1.
 * Empty when any share is missing or not positive.
 */
export function mixingRatioFrom(percentages: Array<number | null | undefined>): string {
  if (percentages.length < 2) return '';
  const parts = percentages.map((p) => Math.round(Number(p ?? 0) * 100));
  if (parts.some((p) => !Number.isFinite(p) || p <= 0)) return '';
  const divisor = parts.reduce((acc, p) => gcd(acc, p));
  return parts.map((p) => p / divisor).join(':');
}

/**
 * Raw material needed to end with `batchYield` of finished product: the yield
 * is OUTPUT, and processing loses weight, so input = yield / (1 - loss%).
 */
export function inputForYield(batchYield: number | null | undefined, lossPercent?: number | null) {
  if (!batchYield || batchYield <= 0) return undefined;
  const loss = Number(lossPercent ?? 0);
  if (!Number.isFinite(loss) || loss < 0 || loss >= 100) return undefined;
  return batchYield / (1 - loss / 100);
}

/** Quantity of one ingredient for a batch of `batchYield` output, from its share of the blend. */
export function quantityFromShare(
  batchYield: number | null | undefined,
  percentage: number | null | undefined,
  lossPercent?: number | null,
) {
  const input = inputForYield(batchYield, lossPercent);
  if (input === undefined || percentage === null || percentage === undefined) return undefined;
  return round((input * percentage) / 100, 3);
}

/**
 * Shares of the blend from ingredient quantities (60 kg + 25 kg + 15 kg ->
 * 60 / 25 / 15). Rounded to two decimals with the remainder put on the
 * largest share so the total is exactly 100. Undefined until every row has a
 * positive quantity.
 */
export function sharesFromQuantities(quantities: Array<number | null | undefined>): number[] | undefined {
  if (quantities.length < 2) return undefined;
  const qty = quantities.map((q) => Number(q ?? 0));
  if (qty.some((q) => !Number.isFinite(q) || q <= 0)) return undefined;
  const total = qty.reduce((a, b) => a + b, 0);
  const shares = qty.map((q) => round((q / total) * 100, 2));
  const largest = shares.indexOf(Math.max(...shares));
  shares[largest] = round(shares[largest] + 100 - shares.reduce((a, b) => a + b, 0), 2);
  return shares;
}

/** What is left of 100% for the next ingredient, if anything. */
export function remainingShare(percentages: Array<number | null | undefined>) {
  const left = round(100 - percentages.reduce<number>((sum, p) => sum + Number(p ?? 0), 0), 2);
  return left > 0 ? left : undefined;
}

/** Ingredients are weighed in the recipe's own unit where that unit is a weight or volume. */
export function ingredientUnitFor(recipeUnit: string | undefined) {
  return recipeUnit === 'LITRE' ? 'LITRE' : recipeUnit === 'KG' ? 'KG' : undefined;
}
