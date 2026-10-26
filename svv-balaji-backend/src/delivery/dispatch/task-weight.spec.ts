import { taskWeight } from './task-weight';

/** A pack-size line weighs its variant's pack, else the product's (audit 22 Oct 2026). */
describe('taskWeight', () => {
  const task = { orderId: 'o1', returnRequestId: null, kind: 'ORDER_DELIVERY' } as any;
  const client = (items: any[]) => ({ orderItem: { findMany: async () => items } }) as any;

  it('uses the variant pack weight when set, the product weight otherwise', async () => {
    const w = await taskWeight(client([
      { quantity: 2, product: { packWeightKg: 1 }, variant: { packWeightKg: 5 } },
      { quantity: 3, product: { packWeightKg: 1 }, variant: null },
      { quantity: 1, product: { packWeightKg: 1 }, variant: { packWeightKg: null } },
    ]), task);
    expect(w).toBe(2 * 5 + 3 * 1 + 1 * 1);
  });

  it('is unknown when any line has no weight at all', async () => {
    expect(await taskWeight(client([{ quantity: 1, product: { packWeightKg: null }, variant: null }]), task)).toBeNull();
  });
});
