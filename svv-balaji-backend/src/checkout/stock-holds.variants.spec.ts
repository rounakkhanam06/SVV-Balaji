import { availableByProduct, heldByOthers, stockKey } from './stock-holds';

/**
 * Pack sizes are their own stock (audit 22 Oct 2026). A product id means the
 * product's own pack (batches with no variant); a variant id means only the
 * batches packed as that variant.
 */
describe('stock-holds - stock keys per pack size', () => {
  const batches = [
    { productId: 'atta', variantId: null, quantity: 10, reservedQuantity: 2 }, // own 1 kg pack
    { productId: 'atta', variantId: 'atta-5kg', quantity: 4, reservedQuantity: 0 },
  ];
  const holds = [
    { productId: 'atta', variantId: 'atta-5kg', quantity: 1, orderId: 'o-other' },
    { productId: 'atta', variantId: null, quantity: 3, orderId: 'o-other' },
  ];

  // Evaluates just the key OR-filter the helpers build, enough to prove which rows each key reaches.
  const matchesKey = (row: { productId: string; variantId: string | null }, where: any) =>
    where.OR.some((c: any) =>
      c.variantId?.in ? c.variantId.in.includes(row.variantId) : c.productId.in.includes(row.productId) && row.variantId === null,
    );

  const client: any = {
    finishedGoodsStock: {
      findMany: async ({ where }: any) =>
        batches
          .filter((b) => matchesKey(b, where.fgBatch))
          .map((b) => ({ quantity: b.quantity, reservedQuantity: b.reservedQuantity, fgBatch: { productId: b.productId, variantId: b.variantId } })),
    },
    stockReservation: {
      groupBy: async ({ where }: any) =>
        holds.filter((h) => matchesKey(h, where)).map((h) => ({ productId: h.productId, variantId: h.variantId, _sum: { quantity: h.quantity } })),
      aggregate: async ({ where }: any) => ({
        _sum: { quantity: holds.filter((h) => matchesKey(h, { OR: where.OR }) && h.orderId !== 'mine').reduce((n, h) => n + h.quantity, 0) },
      }),
    },
  };

  it('keys a line by its variant, else by its product', () => {
    expect(stockKey({ productId: 'atta', variantId: 'atta-5kg' })).toBe('atta-5kg');
    expect(stockKey({ productId: 'atta', variantId: null })).toBe('atta');
    expect(stockKey({ productId: 'atta' })).toBe('atta');
  });

  it('counts each pack size separately', async () => {
    const available = await availableByProduct(client, 'w1', ['atta', 'atta-5kg']);
    expect(available.get('atta')).toBe(10 - 2 - 3); // own pack only
    expect(available.get('atta-5kg')).toBe(4 - 1); // 5 kg batches only
  });

  it('holds for one pack size never reduce another', async () => {
    expect(await heldByOthers(client, 'w1', 'atta-5kg', 'mine')).toBe(1);
    expect(await heldByOthers(client, 'w1', 'atta', 'mine')).toBe(3);
  });
});
