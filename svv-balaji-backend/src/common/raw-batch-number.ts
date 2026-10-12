import { Prisma } from '@prisma/client';

/** Date -> YYYYMMDD integer, using local date parts (not UTC). */
export function rawBatchDateKey(date: Date): number {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return Number(`${y}${m}${d}`);
}

/**
 * FRD 15.1 format: RM-YYYYMMDD-NNN, sequential per day.
 *
 * The one counter for every raw material batch, whatever brought it in - a
 * farmer collection or a supplier delivery. Two counters for one number space
 * would issue RM-...-001 twice on a day with both, and the second insert would
 * fail on the unique batch number. Call inside the caller's transaction.
 */
export async function nextRawBatchNumber(tx: Prisma.TransactionClient, date: Date): Promise<string> {
  const dateKey = rawBatchDateKey(date);

  const existing = await tx.batchNumberCounter.findUnique({ where: { dateKey } });
  if (!existing) {
    await tx.batchNumberCounter.create({ data: { dateKey, lastNumber: 0 } });
  }

  const updated = await tx.batchNumberCounter.update({
    where: { dateKey },
    data: { lastNumber: { increment: 1 } },
  });

  return `RM-${dateKey}-${String(updated.lastNumber).padStart(3, '0')}`;
}
