import { StorefrontOrdersService } from './storefront-orders.service';

const at = (d: string) => new Date(`${d}T10:00:00Z`);
const customer = { id: 'c-1', channel: 'B2B' as const, type: 'RETAILER' as const };

function setup(orders: Array<{ createdAt: Date; items: Array<{ productId: string; quantity: number }> }>, live: string[]) {
  const prisma = { order: { findMany: jest.fn(async (_args: { where: unknown }) => orders) } };
  const catalogue = {
    // Mirrors listProductsByIds: keeps the requested order, drops what is not on sale.
    listProductsByIds: jest.fn(async (ids: string[]) => ids.filter((id) => live.includes(id)).map((id) => ({ id, name: id }))),
  };
  const svc = new StorefrontOrdersService(prisma as never, {} as never, catalogue as never);
  return { svc, prisma, catalogue };
}

describe('StorefrontOrdersService.buyAgain', () => {
  it('is empty for a shopper with no orders, without asking the catalogue', async () => {
    const { svc, catalogue } = setup([], []);
    expect(await svc.buyAgain(customer)).toEqual([]);
    expect(catalogue.listProductsByIds).not.toHaveBeenCalled();
  });

  it('only reads this shopper\'s real orders - not drafts or cancelled ones', async () => {
    const { svc, prisma } = setup([], []);
    await svc.buyAgain(customer);
    expect(prisma.order.findMany.mock.calls[0][0].where).toEqual({
      customerId: 'c-1', source: 'STOREFRONT', status: { notIn: ['DRAFT', 'CANCELLED'] },
    });
  });

  it('lists products most recently ordered first, with when, how many and how often', async () => {
    const { svc } = setup(
      [
        { createdAt: at('2026-10-10'), items: [{ productId: 'atta', quantity: 2 }, { productId: 'atta', quantity: 1 }] },
        { createdAt: at('2026-10-05'), items: [{ productId: 'dal', quantity: 1 }, { productId: 'atta', quantity: 5 }] },
      ],
      ['atta', 'dal'],
    );
    expect(await svc.buyAgain(customer)).toEqual([
      { id: 'atta', name: 'atta', lastOrderedAt: at('2026-10-10'), lastQuantity: 3, timesOrdered: 2 },
      { id: 'dal', name: 'dal', lastOrderedAt: at('2026-10-05'), lastQuantity: 1, timesOrdered: 1 },
    ]);
  });

  it('prices for the shopper\'s own channel and type', async () => {
    const { svc, catalogue } = setup([{ createdAt: at('2026-10-10'), items: [{ productId: 'atta', quantity: 1 }] }], ['atta']);
    await svc.buyAgain(customer);
    expect(catalogue.listProductsByIds).toHaveBeenCalledWith(['atta'], { channel: 'B2B', customerType: 'RETAILER' });
  });

  it('drops products no longer on sale and still fills the row', async () => {
    const orders = ['p1', 'p2', 'p3', 'p4'].map((id, i) => ({ createdAt: at(`2026-10-0${9 - i}`), items: [{ productId: id, quantity: 1 }] }));
    const { svc } = setup(orders, ['p2', 'p3', 'p4']);
    expect((await svc.buyAgain(customer, 2)).map((p) => p.id)).toEqual(['p2', 'p3']);
  });
});
