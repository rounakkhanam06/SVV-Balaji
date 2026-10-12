import { BadRequestException } from '@nestjs/common';
import { resolveTransportSource } from './transport-source';

/** The one rule both supplier deliveries and farmer collections use for "who brings it in". */
describe('resolveTransportSource', () => {
  const suppliers: Record<string, { fullName: string; status: string }> = {
    'sup-1': { fullName: 'Agro Traders', status: 'ACTIVE' },
    'sup-2': { fullName: 'Mandi Movers', status: 'PENDING_VERIFICATION' },
    'sup-bad': { fullName: 'Blocked Co', status: 'BLACKLISTED' },
  };
  const transporters: Record<string, { name: string; isActive: boolean }> = {
    'trn-1': { name: 'Raj Roadlines', isActive: true },
    'trn-off': { name: 'Old Logistics', isActive: false },
  };
  const db: any = {
    supplier: { findUnique: jest.fn(async ({ where }) => suppliers[where.id] ?? null) },
    transporter: { findUnique: jest.fn(async ({ where }) => transporters[where.id] ?? null) },
  };
  const delivery = { allowFarmer: false, defaultSupplierId: 'sup-1' };
  const collection = { allowFarmer: true };

  it('a supplier delivery defaults to the delivering supplier', async () => {
    expect(await resolveTransportSource(db, {}, delivery)).toEqual({ transportSource: 'SUPPLIER', transportSupplierId: 'sup-1', transporterId: null });
  });

  it('the supplier can be changed to another one from the master', async () => {
    expect(await resolveTransportSource(db, { transportSource: 'SUPPLIER', transportSupplierId: 'sup-2' }, delivery)).toMatchObject({ transportSupplierId: 'sup-2' });
  });

  it('a registered transporter is stored with no supplier', async () => {
    expect(await resolveTransportSource(db, { transportSource: 'TRANSPORTER', transporterId: 'trn-1' }, delivery)).toEqual({ transportSource: 'TRANSPORTER', transportSupplierId: null, transporterId: 'trn-1' });
  });

  it("the farmer's own vehicle is for collections only", async () => {
    expect(await resolveTransportSource(db, { transportSource: 'FARMER' }, collection)).toEqual({ transportSource: 'FARMER', transportSupplierId: null, transporterId: null });
    await expect(resolveTransportSource(db, { transportSource: 'FARMER' }, delivery)).rejects.toThrow(/only for farmer collections/);
  });

  it('a collection may leave transport out entirely', async () => {
    expect(await resolveTransportSource(db, {}, collection)).toBeUndefined();
  });

  it.each([
    ['a transporter is chosen without one being picked', { transportSource: 'TRANSPORTER' }, /Choose the registered transporter/],
    ['a supplier is needed on a collection but none is picked', { transportSource: 'SUPPLIER' }, /Choose the supplier/],
    ['the transporter is inactive', { transportSource: 'TRANSPORTER', transporterId: 'trn-off' }, /inactive/],
    ['the transporter does not exist', { transportSource: 'TRANSPORTER', transporterId: 'nope' }, /not found/],
    ['the supplier is blacklisted', { transportSource: 'SUPPLIER', transportSupplierId: 'sup-bad' }, /blacklisted/],
    ['an id is sent for the other source', { transportSource: 'SUPPLIER', transportSupplierId: 'sup-1', transporterId: 'trn-1' }, /source is Supplier/],
    ['a supplier id is sent with the transporter source', { transportSource: 'TRANSPORTER', transporterId: 'trn-1', transportSupplierId: 'sup-1' }, /source is Registered Transporter/],
  ])('refuses when %s', async (_label, input, message) => {
    await expect(resolveTransportSource(db, input as any, collection)).rejects.toThrow(message as RegExp);
  });

  it('on an edit, sending nothing leaves the source alone', async () => {
    const current = { transportSource: 'TRANSPORTER' as const, transportSupplierId: null, transporterId: 'trn-1' };
    expect(await resolveTransportSource(db, {}, { ...delivery, current })).toBeUndefined();
  });

  it('on an edit, sending only a new transporter keeps the transporter source', async () => {
    const current = { transportSource: 'TRANSPORTER' as const, transportSupplierId: null, transporterId: 'trn-off' };
    expect(await resolveTransportSource(db, { transporterId: 'trn-1' }, { ...collection, current })).toMatchObject({ transportSource: 'TRANSPORTER', transporterId: 'trn-1' });
  });

  it('switching an edit from transporter to supplier on a delivery falls back to the delivering supplier', async () => {
    const current = { transportSource: 'TRANSPORTER' as const, transportSupplierId: null, transporterId: 'trn-1' };
    expect(await resolveTransportSource(db, { transportSource: 'SUPPLIER' }, { ...delivery, current })).toEqual({ transportSource: 'SUPPLIER', transportSupplierId: 'sup-1', transporterId: null });
  });

  it('errors are 400s the form can show', async () => {
    await expect(resolveTransportSource(db, { transportSource: 'TRANSPORTER' }, collection)).rejects.toBeInstanceOf(BadRequestException);
  });
});
