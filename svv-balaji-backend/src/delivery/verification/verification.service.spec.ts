import { RiderVerificationService } from './verification.service';

const NOW = new Date('2026-10-12T06:30:00Z'); // 12:00 IST

function setup(due: object[], claimCounts: number[], renewals: object[] = []) {
  const prisma = {
    riderDocument: {
      findMany: jest.fn().mockResolvedValueOnce(due).mockResolvedValue(renewals),
      updateMany: jest.fn().mockImplementation(() => Promise.resolve({ count: claimCounts.shift() ?? 0 })),
    },
  };
  const dispatch = { notify: jest.fn().mockResolvedValue(undefined) };
  const staffAlerts = { notify: jest.fn().mockResolvedValue(undefined) };
  const svc = new RiderVerificationService(prisma as never, {} as never, dispatch as never, staffAlerts as never);
  const recompute = jest.spyOn(svc, 'recompute').mockResolvedValue(new Map());
  return { svc, prisma, dispatch, staffAlerts, recompute };
}

const doc = (id: string, mandatory = true) => ({
  id, riderId: `r-${id}`, expiresOn: new Date('2026-10-10T00:00:00Z'),
  rider: { fullName: `Rider ${id}` }, type: { name: 'Driving Licence', isMandatory: mandatory, isSystem: false },
});

describe('RiderVerificationService.notifyExpired', () => {
  it('only looks at approved, in-force, un-notified documents that expired before today (IST)', async () => {
    const { svc, prisma } = setup([], []);
    await svc.notifyExpired(NOW);
    const where = prisma.riderDocument.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ status: 'APPROVED', supersededAt: null, expiryNotifiedAt: null, expiresOn: { lt: new Date('2026-10-12T00:00:00Z') } });
  });

  it('tells the rider and Super Admin only, once per document', async () => {
    const { svc, prisma, dispatch, staffAlerts } = setup([doc('a')], [1]);
    expect(await svc.notifyExpired(NOW)).toEqual({ notified: 1 });

    expect(prisma.riderDocument.updateMany).toHaveBeenCalledWith({ where: { id: 'a', expiryNotifiedAt: null }, data: { expiryNotifiedAt: NOW } });
    expect(dispatch.notify).toHaveBeenCalledWith('r-a', 'VERIFICATION', 'Driving Licence expired', expect.stringContaining('expired on 2026-10-10'));
    expect(dispatch.notify.mock.calls[0][3]).toContain('cannot take orders');
    expect(staffAlerts.notify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'RIDER_DOCUMENT_EXPIRED', superAdminOnly: true, link: '/riders/r-a', body: expect.stringContaining("Rider a's Driving Licence expired on 2026-10-10"),
    }));
  });

  it('skips a document another instance already claimed', async () => {
    const { svc, dispatch, staffAlerts } = setup([doc('a'), doc('b')], [0, 1]);
    expect(await svc.notifyExpired(NOW)).toEqual({ notified: 1 });
    expect(dispatch.notify).toHaveBeenCalledTimes(1);
    expect(dispatch.notify.mock.calls[0][0]).toBe('r-b');
    expect(staffAlerts.notify).toHaveBeenCalledTimes(1);
  });

  it('does not say an optional document blocks orders', async () => {
    const { svc, dispatch, staffAlerts } = setup([doc('a', false)], [1]);
    await svc.notifyExpired(NOW);
    expect(dispatch.notify.mock.calls[0][3]).not.toContain('cannot take orders');
    expect(staffAlerts.notify.mock.calls[0][0].body).not.toContain('cannot take orders');
  });

  it('a failed rider notice still alerts Super Admin', async () => {
    const { svc, dispatch, staffAlerts } = setup([doc('a')], [1]);
    dispatch.notify.mockRejectedValueOnce(new Error('socket down'));
    expect(await svc.notifyExpired(NOW)).toEqual({ notified: 1 });
    expect(staffAlerts.notify).toHaveBeenCalledTimes(1);
  });

  it('takes the rider off orders quietly first, so the app refresh does not send a second notice', async () => {
    const { svc, recompute, dispatch } = setup([doc('a')], [1]);
    await svc.notifyExpired(NOW);
    expect(recompute).toHaveBeenCalledWith(['r-a'], undefined, { quiet: true });
    expect(recompute.mock.invocationCallOrder[0]).toBeLessThan(dispatch.notify.mock.invocationCallOrder[0]);
    expect(dispatch.notify).toHaveBeenCalledTimes(1);
  });
});

describe('RiderVerificationService.remindExpiring', () => {
  const soon = (id: string, expires: string, mandatory = true) => ({
    id, riderId: `r-${id}`, typeId: 'dl', expiresOn: new Date(`${expires}T00:00:00Z`),
    type: { name: 'Driving Licence', isMandatory: mandatory, isSystem: false },
  });

  it('looks at approved documents expiring from today to 7 days out, not yet reminded', async () => {
    const { svc, prisma } = setup([], []);
    await svc.remindExpiring(NOW);
    expect(prisma.riderDocument.findMany.mock.calls[0][0].where).toMatchObject({
      status: 'APPROVED', supersededAt: null, expiryReminderSentAt: null,
      expiresOn: { gte: new Date('2026-10-12T00:00:00Z'), lte: new Date('2026-10-19T00:00:00Z') },
    });
  });

  it('reminds the rider once, saying when', async () => {
    const { svc, prisma, dispatch, staffAlerts } = setup([soon('a', '2026-10-15')], [1]);
    expect(await svc.remindExpiring(NOW)).toEqual({ reminded: 1 });
    expect(prisma.riderDocument.updateMany).toHaveBeenCalledWith({ where: { id: 'a', expiryReminderSentAt: null }, data: { expiryReminderSentAt: NOW } });
    expect(dispatch.notify).toHaveBeenCalledWith('r-a', 'VERIFICATION', 'Driving Licence expires soon', expect.stringContaining('in 3 days (2026-10-15)'));
    expect(dispatch.notify.mock.calls[0][3]).toContain('keep taking orders');
    expect(staffAlerts.notify).not.toHaveBeenCalled();
  });

  it('says today / tomorrow plainly', async () => {
    const { svc, dispatch } = setup([soon('a', '2026-10-12'), soon('b', '2026-10-13')], [1, 1]);
    await svc.remindExpiring(NOW);
    expect(dispatch.notify.mock.calls[0][2]).toBe('Driving Licence expires today');
    expect(dispatch.notify.mock.calls[1][2]).toBe('Driving Licence expires tomorrow');
  });

  it('skips a rider who already uploaded the renewal', async () => {
    const { svc, dispatch, prisma } = setup([soon('a', '2026-10-15')], [1], [{ riderId: 'r-a', typeId: 'dl' }]);
    expect(await svc.remindExpiring(NOW)).toEqual({ reminded: 0 });
    expect(prisma.riderDocument.updateMany).not.toHaveBeenCalled();
    expect(dispatch.notify).not.toHaveBeenCalled();
  });
});
