import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StorefrontAuthService } from './storefront-auth.service';
import { customerAccessSecret } from './customer-token.config';

/** The under-review screen's status read: works for pending / rejected accounts, and nobody else's. */
describe('StorefrontAuthService.registrationStatus', () => {
  const jwt = new JwtService();
  const later = new Date(Date.now() + 864e5);
  let sessionRow: any;

  const service = () => {
    const svc = Object.create(StorefrontAuthService.prototype) as StorefrontAuthService;
    Object.assign(svc, {
      jwtService: jwt,
      prisma: { customerSession: { findUnique: jest.fn(async () => sessionRow) } },
    });
    return svc;
  };
  const token = (over: object = {}, opts: { expiresIn?: string | number; secret?: string } = {}) =>
    jwt.signAsync(
      { sub: 'acc-1', phone: '+919999999999', channel: 'B2B', typ: 'customer', customerId: null, sid: 'sess-1', ...over },
      { secret: opts.secret ?? customerAccessSecret(), expiresIn: (opts.expiresIn ?? '30m') as any },
    );
  const account = (status: string, rejectionReason: string | null = null) => ({
    status, businessName: 'Sharma Kirana', rejectionReason, reviewedAt: null, createdAt: new Date('2026-10-12T05:00:00Z'),
  });

  beforeEach(() => {
    sessionRow = { accountId: 'acc-1', revokedAt: null, expiresAt: later, account: account('PENDING_APPROVAL') };
  });

  it('tells a pending retailer they are pending', async () => {
    const r = await service().registrationStatus(`Bearer ${await token()}`);
    expect(r).toMatchObject({ status: 'PENDING_APPROVAL', businessName: 'Sharma Kirana', rejectionReason: null });
  });

  it('gives a rejected retailer the reason, even once the access token has expired', async () => {
    sessionRow.account = account('REJECTED', 'GSTIN does not match the shop address');
    const expired = await token({}, { expiresIn: -10 });
    const r = await service().registrationStatus(`Bearer ${expired}`);
    expect(r).toMatchObject({ status: 'REJECTED', rejectionReason: 'GSTIN does not match the shop address' });
  });

  it('only shows a reason when rejected', async () => {
    sessionRow.account = account('ACTIVE', 'old note');
    expect((await service().registrationStatus(`Bearer ${await token()}`)).rejectionReason).toBeNull();
  });

  it.each([
    ['no header', async () => undefined],
    ['a forged token', async () => `Bearer ${await token({}, { secret: 'not-the-secret' })}`],
    ['a staff-style token', async () => `Bearer ${await token({ typ: 'staff' })}`],
  ])('refuses %s', async (_label, header) => {
    await expect(service().registrationStatus(await header())).rejects.toThrow(UnauthorizedException);
  });

  it.each([
    ['a signed-out (revoked) session', () => (sessionRow.revokedAt = new Date())],
    ['a session past its lifetime', () => (sessionRow.expiresAt = new Date(Date.now() - 1000))],
    ['a session that belongs to another account', () => (sessionRow.accountId = 'acc-2')],
    ['an unknown session', () => (sessionRow = null)],
  ])('refuses %s', async (_label, mutate) => {
    mutate();
    await expect(service().registrationStatus(`Bearer ${await token()}`)).rejects.toThrow(UnauthorizedException);
  });
});
