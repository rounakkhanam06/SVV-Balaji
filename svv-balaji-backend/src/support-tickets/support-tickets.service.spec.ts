import { SupportTicketsService } from './support-tickets.module';

/**
 * Staff actions on a ticket must reach the customer's app: a reply (and a
 * resolve / close) creates an inbox notification + push for the customer
 * account that raised it, and never fails the staff action if that breaks.
 */
describe('SupportTicketsService customer notifications', () => {
  const ticket = {
    id: 't-1',
    ticketNumber: 'TKT-20261013-001',
    subject: 'Broken pack',
    description: 'The pack arrived torn',
    orderNumber: null,
    status: 'OPEN',
    priority: 'MEDIUM',
    customer: { id: 'c-1', name: 'Raunak', account: { id: 'acc-1', status: 'ACTIVE' } },
    createdAt: new Date(),
    resolvedAt: null,
    resolvedBy: null,
    messages: [] as any[],
    evidenceImages: [],
  };

  let prisma: any;
  let notifications: { notifyCustomerAccount: jest.Mock };
  let service: SupportTicketsService;
  const flush = () => new Promise((r) => setImmediate(r));

  beforeEach(() => {
    prisma = {
      supportTicket: {
        findUnique: jest.fn(async () => ticket),
        update: jest.fn(async () => ticket),
      },
      supportTicketMessage: { create: jest.fn(async () => ({})) },
      order: { findUnique: jest.fn(async () => null) },
      product: { findFirst: jest.fn(async () => null) },
      $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    };
    notifications = { notifyCustomerAccount: jest.fn(async () => undefined) };
    service = new SupportTicketsService(prisma, undefined, notifications as any);
  });

  it('notifies the customer account when staff reply, linking to the ticket', async () => {
    await service.reply('t-1', 'staff-1', 'We are sending a replacement');
    await flush();

    expect(notifications.notifyCustomerAccount).toHaveBeenCalledWith('acc-1', {
      title: 'Support replied · TKT-20261013-001',
      body: 'We are sending a replacement',
      link: '/support?ticket=t-1',
    });
  });

  it('notifies when a ticket is marked resolved, not on a priority change', async () => {
    await service.update('t-1', 'staff-1', { priority: 'HIGH' as any });
    await flush();
    expect(notifications.notifyCustomerAccount).not.toHaveBeenCalled();

    await service.update('t-1', 'staff-1', { status: 'RESOLVED' as any });
    await flush();
    expect(notifications.notifyCustomerAccount).toHaveBeenCalledTimes(1);
  });

  it('skips customers with no active storefront account', async () => {
    prisma.supportTicket.findUnique = jest.fn(async () => ({ ...ticket, customer: { ...ticket.customer, account: null } }));
    await service.reply('t-1', 'staff-1', 'Hello');
    await flush();
    expect(notifications.notifyCustomerAccount).not.toHaveBeenCalled();
  });

  it('never fails the reply when the notification throws', async () => {
    notifications.notifyCustomerAccount.mockRejectedValue(new Error('fcm down'));
    await expect(service.reply('t-1', 'staff-1', 'Hello')).resolves.toBeDefined();
    await flush();
  });
});
