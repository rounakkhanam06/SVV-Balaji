import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface SupportFaqItem {
  id?: string;
  category?: string;
  question: string;
  answer: string;
}

export interface SupportSettingsData {
  id: string;
  tollFreeNumber: string;
  whatsappNumber: string;
  supportEmail: string;
  operatingHours: string;
  officeAddress: string;
  isPhoneSupportActive: boolean;
  isWhatsappSupportActive: boolean;
  isEmailSupportActive: boolean;
  helpCategories: string[];
  customerFaqs: SupportFaqItem[];
  retailerFaqs: SupportFaqItem[];
  updatedAt: string;
  updatedById: string | null;
}

const DEFAULT_CATEGORIES = [
  'Orders & Live Tracking',
  'Delivery & Dispatch Timing',
  'Payments, GST & Invoices',
  'Returns, Refunds & Damaged Items',
  'Account, KYC & Wholesale Margins',
];

const DEFAULT_CUSTOMER_FAQS: SupportFaqItem[] = [
  {
    category: 'Orders & Live Tracking',
    question: 'How can I track the live status of my grocery order?',
    answer:
      'You can track your order in real-time by going to the Orders tab in your profile. You will see stage-by-stage updates: Placed, Packed, Out for Delivery, and Delivered with live driver ETA.',
  },
  {
    category: 'Delivery & Dispatch Timing',
    question: 'What are the delivery slots and how fast do you deliver?',
    answer:
      'We offer express same-day and scheduled next-day morning slots (7:00 AM - 11:00 AM & 5:00 PM - 9:00 PM). Fast local orders within outlet radius are typically fulfilled within 45 to 90 minutes.',
  },
  {
    category: 'Payments, GST & Invoices',
    question: 'What payment modes are accepted on SVV Balaji?',
    answer:
      'We accept UPI (Google Pay, PhonePe, Paytm), Credit/Debit Cards, Net Banking, Desi Reward Coins, and Cash on Delivery (COD up to allowable limit).',
  },
  {
    category: 'Returns, Refunds & Damaged Items',
    question: 'What if I receive a damaged or missing item in my package?',
    answer:
      'We have a 100% No-Questions-Asked fresh guarantee! Simply raise an issue from the order details page or WhatsApp our support line with a photo within 24 hours for instant refund or replacement.',
  },
  {
    category: 'Account, KYC & Wholesale Margins',
    question: 'How do I redeem my Desi Reward Coins on checkout?',
    answer:
      'Your earned loyalty and referral coins are available right on the checkout payment screen. Simply tick "Redeem Desi Coins" to deduct the balance from your final payable total.',
  },
];

const DEFAULT_RETAILER_FAQS: SupportFaqItem[] = [
  {
    category: 'Account, KYC & Wholesale Margins',
    question: 'How long does Kirana / Retailer account approval take after submission?',
    answer:
      'Our trade compliance team verifies your GSTIN and business address within 2 to 4 business hours. You will receive an SMS and WhatsApp notification once approved.',
  },
  {
    category: 'Orders & Live Tracking',
    question: 'What is the Minimum Order Quantity (MOQ) for wholesale delivery?',
    answer:
      'Wholesale bulk pricing is unlocked on orders starting from ₹3,000 or specific master crate quantities per SKU.',
  },
  {
    category: 'Payments, GST & Invoices',
    question: 'How do I download B2B Tax Invoices with Input Tax Credit (ITC)?',
    answer:
      'GST-compliant B2B invoices are auto-generated upon dispatch. You can download PDF copies with GST breakdowns anytime from your Wholesale Orders history.',
  },
  {
    category: 'Delivery & Dispatch Timing',
    question: 'How are bulk consignments and heavy pallet deliveries handled?',
    answer:
      'Bulk trade orders are dispatched via our direct refrigerated and covered fleet to your shop doorstep with verified digital Proof of Delivery (POD).',
  },
  {
    category: 'Returns, Refunds & Damaged Items',
    question: 'What is the procedure for wholesale batch return or mandi transit shrinkage?',
    answer:
      'For trade consignments, report any damaged crates at the time of delivery on the driver POD terminal or raise a B2B Dispute in your portal within 48 hours for immediate credit note issuance.',
  },
];

@Injectable()
export class SupportSettingsService {
  private readonly logger = new Logger(SupportSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Built-in defaults, used until Super Admin first saves the settings. */
  private readonly defaults: SupportSettingsData = {
    id: 'default-support-config',
    tollFreeNumber: '1800-209-DESI (1800-209-3374)',
    whatsappNumber: '+91 98765 43210',
    supportEmail: 'support@svvbalaji.com',
    operatingHours: 'Mon - Sat: 8:00 AM - 9:00 PM IST (Sunday: 9:00 AM - 6:00 PM)',
    officeAddress: 'SVV Balaji Food & Beverages Pvt. Ltd., Agritech Industrial Park, Sector 4, Mandi Hub, India',
    isPhoneSupportActive: true,
    isWhatsappSupportActive: true,
    isEmailSupportActive: true,
    helpCategories: DEFAULT_CATEGORIES,
    customerFaqs: DEFAULT_CUSTOMER_FAQS,
    retailerFaqs: DEFAULT_RETAILER_FAQS,
    updatedAt: new Date().toISOString(),
    updatedById: null,
  };

  /**
   * Read on every storefront page (footer), and the database is a long way
   * off, so the row is cached briefly per API instance. A save on another
   * instance shows here within CACHE_MS.
   */
  private cache: { value: SupportSettingsData; at: number } | null = null;
  private static readonly CACHE_MS = 30_000;

  async getSettings(): Promise<SupportSettingsData> {
    if (this.cache && Date.now() - this.cache.at < SupportSettingsService.CACHE_MS) return this.cache.value;
    const row = await this.prisma.supportSettings.findUnique({ where: { id: 'default' } });
    const value: SupportSettingsData = row
      ? {
          ...this.defaults,
          ...(row.data as Partial<SupportSettingsData>),
          id: this.defaults.id,
          updatedAt: row.updatedAt.toISOString(),
          updatedById: row.updatedById,
        }
      : this.defaults;
    this.cache = { value, at: Date.now() };
    return value;
  }

  /** Only the editable fields are taken from the body; anything else is ignored. */
  async updateSettings(input: Partial<SupportSettingsData>, updatedById?: string): Promise<SupportSettingsData> {
    const current = await this.getSettings();
    const pick = <K extends keyof SupportSettingsData>(key: K, valid: (v: unknown) => boolean) =>
      input[key] !== undefined && valid(input[key]) ? input[key] : current[key];
    const str = (v: unknown) => typeof v === 'string';
    const bool = (v: unknown) => typeof v === 'boolean';
    const list = (v: unknown) => Array.isArray(v);
    const data = {
      tollFreeNumber: pick('tollFreeNumber', str),
      whatsappNumber: pick('whatsappNumber', str),
      supportEmail: pick('supportEmail', str),
      operatingHours: pick('operatingHours', str),
      officeAddress: pick('officeAddress', str),
      isPhoneSupportActive: pick('isPhoneSupportActive', bool),
      isWhatsappSupportActive: pick('isWhatsappSupportActive', bool),
      isEmailSupportActive: pick('isEmailSupportActive', bool),
      helpCategories: pick('helpCategories', list),
      customerFaqs: pick('customerFaqs', list),
      retailerFaqs: pick('retailerFaqs', list),
    };
    const json = data as unknown as Prisma.InputJsonValue;
    await this.prisma.supportSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', data: json, updatedById: updatedById ?? null },
      update: { data: json, updatedById: updatedById ?? null },
    });
    this.cache = null;
    this.logger.log(`Support settings updated by ${updatedById || 'system'}`);
    return this.getSettings();
  }

  async getStorefrontSupport(role?: string) {
    const isRetailer = role === 'RETAILER' || role === 'B2B';
    const [state, company] = await Promise.all([
      this.getSettings(),
      // The registered company name, as on tax invoices (Settings > GST). Null until filled in.
      this.prisma.gstSettings.findFirst({ select: { legalName: true, tradeName: true } }).catch(() => null),
    ]);
    return {
      tollFreeNumber: state.tollFreeNumber,
      whatsappNumber: state.whatsappNumber,
      supportEmail: state.supportEmail,
      operatingHours: state.operatingHours,
      officeAddress: state.officeAddress,
      isPhoneSupportActive: state.isPhoneSupportActive,
      isWhatsappSupportActive: state.isWhatsappSupportActive,
      isEmailSupportActive: state.isEmailSupportActive,
      helpCategories: state.helpCategories,
      faqs: isRetailer ? state.retailerFaqs : state.customerFaqs,
      customerFaqs: state.customerFaqs,
      retailerFaqs: state.retailerFaqs,
      companyName: company?.legalName || company?.tradeName || null,
    };
  }
}
