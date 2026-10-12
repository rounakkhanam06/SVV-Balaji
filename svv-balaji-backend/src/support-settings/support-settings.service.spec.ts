import { SupportSettingsService } from './support-settings.service';

/** Settings used to live in API memory and reset on restart; these pin the persisted behaviour. */
describe('SupportSettingsService', () => {
  let row: { data: object; updatedById: string | null; updatedAt: Date } | null;
  let prisma: any;
  const make = () => new SupportSettingsService(prisma);

  beforeEach(() => {
    row = null;
    prisma = {
      supportSettings: {
        findUnique: jest.fn(async () => row),
        upsert: jest.fn(async ({ create, update }) => {
          row = { ...(row ? update : create), updatedAt: new Date('2026-10-12T10:00:00Z') };
          return row;
        }),
      },
      gstSettings: { findFirst: jest.fn(async () => ({ legalName: 'SVV Balaji Food & Beverages Pvt. Ltd.', tradeName: 'Desi Tokri' })) },
    };
  });

  it('serves the built-in defaults until first saved', async () => {
    const s = await make().getSettings();
    expect(s.supportEmail).toBe('support@svvbalaji.com');
    expect(s.customerFaqs.length).toBeGreaterThan(0);
  });

  it('keeps a saved change across a restart (a new service instance)', async () => {
    await make().updateSettings({ supportEmail: 'help@desitokri.in', isWhatsappSupportActive: false }, 'admin-1');
    const after = await make().getSettings();
    expect(after).toMatchObject({ supportEmail: 'help@desitokri.in', isWhatsappSupportActive: false, updatedById: 'admin-1' });
    expect(after.tollFreeNumber).toBe('1800-209-DESI (1800-209-3374)'); // untouched fields keep their value
  });

  it('ignores unknown fields and wrongly typed values', async () => {
    await make().updateSettings({ id: 'hijack', supportEmail: 42, evil: 'x', customerFaqs: 'nope' } as any, 'admin-1');
    const saved = prisma.supportSettings.upsert.mock.calls[0][0].create.data;
    expect(saved).not.toHaveProperty('id');
    expect(saved).not.toHaveProperty('evil');
    expect(saved.supportEmail).toBe('support@svvbalaji.com');
    expect(Array.isArray(saved.customerFaqs)).toBe(true);
  });

  it('a save is visible at once on the instance that made it', async () => {
    const svc = make();
    await svc.getSettings(); // warms the cache with defaults
    await svc.updateSettings({ officeAddress: 'Plot 7, Indore' }, 'admin-1');
    expect((await svc.getSettings()).officeAddress).toBe('Plot 7, Indore');
  });

  it('gives the storefront the registered company name, and audience FAQs', async () => {
    const pub = await make().getStorefrontSupport('RETAILER');
    expect(pub.companyName).toBe('SVV Balaji Food & Beverages Pvt. Ltd.');
    expect(pub.faqs).toBe(pub.retailerFaqs);
  });

  it('has no company name when GST settings are empty', async () => {
    prisma.gstSettings.findFirst = jest.fn(async () => null);
    expect((await make().getStorefrontSupport()).companyName).toBeNull();
  });
});
