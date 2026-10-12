import {
  CustomerServiceOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  GiftOutlined,
  MailOutlined,
  PhoneOutlined,
  QrcodeOutlined,
  RollbackOutlined,
  ShopOutlined,
  WhatsAppOutlined,
} from '@ant-design/icons';
import { Divider, Skeleton, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useStorefrontCategoryTree } from '@shared/hooks/useCategories';
import { useStorefrontSupport } from '@shared/hooks/useSupportSettings';
import { api as storefrontApi } from '../api/client';
import { DOC_LABEL, legalPath, type LegalAudience } from '../api/legal';
import { useCustomerAuth } from '../auth/CustomerAuthContext';

/** Top-level categories listed before "All categories". */
const MAX_CATEGORIES = 8;

const linkStyle = { color: '#a8a29e', textDecoration: 'none' } as const;
const columnTitle = { color: '#ffffff', marginBottom: 16, fontSize: 15 } as const;
const listStyle = { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 } as const;

/**
 * "1800-209-DESI (1800-209-3374)" -> tel:18002093374. The last run of digits
 * wins, so a vanity number followed by its digits dials the digits.
 */
function telHref(text: string): string | null {
  const runs = text.match(/\+?\d[\d\s-]{5,}\d/g);
  const last = runs?.[runs.length - 1]?.replace(/[\s-]/g, '');
  return last ? `tel:${last}` : null;
}

function whatsappHref(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

type FooterLink = { to: string; label: string };

/** Only pages this app routes to, and only those that make sense for who is browsing. */
function accountLinks(role: 'GUEST' | 'CUSTOMER' | 'RETAILER'): { title: string; links: FooterLink[] } {
  if (role === 'RETAILER') {
    return {
      title: 'For Your Store',
      links: [
        { to: '/orders', label: 'Wholesale Orders & Tracking' },
        { to: '/returns', label: 'Returns & Refunds' },
        { to: '/loyalty', label: 'Wholesaler Rewards' },
        { to: '/profile', label: 'Store Profile' },
        { to: '/trace', label: 'Trace a Pack' },
      ],
    };
  }
  if (role === 'CUSTOMER') {
    return {
      title: 'Your Account',
      links: [
        { to: '/orders', label: 'My Orders' },
        { to: '/returns', label: 'Returns & Refunds' },
        { to: '/wishlist', label: 'Wishlist' },
        { to: '/loyalty', label: 'Desi Rewards' },
        { to: '/refer', label: 'Refer & Earn' },
        { to: '/affiliate-program', label: 'Become an Affiliate' },
      ],
    };
  }
  return {
    title: 'Get Started',
    links: [
      { to: '/login', label: 'Sign In' },
      { to: '/retailers/register', label: 'Register Your Store' },
      { to: '/affiliate-program', label: 'Become an Affiliate' },
      { to: '/trace', label: 'Trace a Pack' },
    ],
  };
}

/** Banner of things the app really does, each linking to where it happens. */
function highlights(isRetailer: boolean): Array<{ icon: ReactNode; colour: string; title: string; text: string; to: string }> {
  const trace = { icon: <QrcodeOutlined />, colour: '#34d399', title: 'Farm Traceable', text: 'Scan the QR on any pack to see its farm', to: '/trace' };
  const returns = { icon: <RollbackOutlined />, colour: '#fb923c', title: 'Easy Returns', text: 'Request a return from your order', to: '/returns' };
  const rewards = isRetailer
    ? { icon: <GiftOutlined />, colour: '#c084fc', title: 'Wholesaler Rewards', text: 'Earn coins on every order', to: '/loyalty' }
    : { icon: <GiftOutlined />, colour: '#c084fc', title: 'Desi Rewards', text: 'Earn coins on every order', to: '/loyalty' };
  const fourth = isRetailer
    ? { icon: <FileTextOutlined />, colour: '#60a5fa', title: 'GST Invoices', text: 'A tax invoice with every order', to: '/orders' }
    : { icon: <CustomerServiceOutlined />, colour: '#60a5fa', title: 'Help When You Need It', text: 'FAQs, chat and support tickets', to: '/help' };
  return [trace, returns, rewards, fourth];
}

/**
 * Desktop footer for customers and retailers. Everything in it is live or a
 * real route: categories from Admin > Manage Category (so adding, renaming,
 * hiding or reordering one shows here), contact details from Admin > Helpdesk
 * & Support Settings, legal links to the policies Super Admin publishes, and
 * the company name from the GST settings used on invoices.
 */
export function DesktopFooter() {
  const { role } = useCustomerAuth();
  const isRetailer = role === 'RETAILER';
  const audience: LegalAudience = isRetailer ? 'RETAILER' : 'CUSTOMER';
  const categories = useStorefrontCategoryTree(storefrontApi);
  const support = useStorefrontSupport(isRetailer ? 'RETAILER' : 'CUSTOMER');
  const s = support.data;
  const account = accountLinks(role);
  const topCategories = (categories.data ?? []).slice(0, MAX_CATEGORIES);

  const phone = s?.isPhoneSupportActive && s.tollFreeNumber ? s.tollFreeNumber : null;
  const whatsapp = s?.isWhatsappSupportActive && s.whatsappNumber ? s.whatsappNumber : null;
  const email = s?.isEmailSupportActive && s.supportEmail ? s.supportEmail : null;
  const companyName = s?.companyName ?? null;

  return (
    <footer className="desktop-only" style={{ background: '#1c1917', color: '#d6d3d1', marginTop: 'auto', borderTop: '4px solid #059669' }}>
      <div style={{ background: '#292524', borderBottom: '1px solid #3f3f46', padding: '24px 0' }}>
        <div className="store-container" style={{ paddingTop: 0, paddingBottom: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {highlights(isRetailer).map((h) => (
              <Link key={h.title} to={h.to} style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: h.colour,
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {h.icon}
                </div>
                <div>
                  <Typography.Text strong style={{ color: '#ffffff', fontSize: 14, display: 'block' }}>
                    {h.title}
                  </Typography.Text>
                  <Typography.Text style={{ color: '#a8a29e', fontSize: 12 }}>{h.text}</Typography.Text>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="store-container" style={{ paddingTop: 48, paddingBottom: 40 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.5fr', gap: 40 }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ background: '#ffffff', padding: 4, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src="/images/desi-tokri.png" alt="Desi Tokri" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              </div>
              <div>
                <span className="brand-title-font" style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', letterSpacing: '1.5px', display: 'block' }}>
                  Desi Tokri
                </span>
                {companyName ? (
                  <span className="brand-title-font" style={{ display: 'block', fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginTop: 2 }}>
                    By {companyName}
                  </span>
                ) : null}
              </div>
            </div>

            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#a8a29e', marginBottom: 20 }}>
              Staples milled from crops bought directly from farmers. Every pack carries a batch QR code that traces it back
              to the farm it came from.
            </p>

            <Link
              to="/trace"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#059669',
                color: '#ffffff',
                padding: '8px 16px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <QrcodeOutlined /> Trace Any Batch QR
            </Link>
          </div>

          {/* Categories - live */}
          <div>
            <Typography.Title level={5} style={columnTitle}>
              Shop by Category
            </Typography.Title>
            {categories.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 5, width: ['70%', '60%', '80%', '50%', '65%'] }} />
            ) : (
              <ul style={listStyle}>
                {topCategories.map((cat) => (
                  <li key={cat.id}>
                    <Link to={`/products/${cat.slug}`} style={linkStyle} className="nav-link-hover">
                      {cat.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link to="/categories" style={{ ...linkStyle, color: '#34d399' }} className="nav-link-hover">
                    {topCategories.length ? 'All categories →' : 'Browse categories'}
                  </Link>
                </li>
              </ul>
            )}
          </div>

          {/* Account - by who is browsing */}
          <div>
            <Typography.Title level={5} style={columnTitle}>
              {account.title}
            </Typography.Title>
            <ul style={listStyle}>
              {account.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} style={linkStyle} className="nav-link-hover">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support - from Admin > Helpdesk & Support Settings */}
          <div>
            <Typography.Title level={5} style={columnTitle}>
              {isRetailer ? 'Retailer Support Desk' : 'Customer Support'}
            </Typography.Title>
            {support.isLoading ? (
              <Skeleton active title={false} paragraph={{ rows: 4 }} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: '#a8a29e' }}>
                {phone ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <PhoneOutlined style={{ color: '#34d399', marginTop: 3 }} />
                    <div>
                      {telHref(phone) ? (
                        <a href={telHref(phone)!} style={{ color: '#ffffff', fontWeight: 700, textDecoration: 'none' }}>
                          {phone}
                        </a>
                      ) : (
                        <strong style={{ color: '#ffffff' }}>{phone}</strong>
                      )}
                      {s?.operatingHours ? <span style={{ display: 'block' }}>{s.operatingHours}</span> : null}
                    </div>
                  </div>
                ) : null}

                {whatsapp && whatsappHref(whatsapp) ? (
                  <a href={whatsappHref(whatsapp)!} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, ...linkStyle }} className="nav-link-hover">
                    <WhatsAppOutlined style={{ color: '#34d399' }} />
                    <span>WhatsApp {whatsapp}</span>
                  </a>
                ) : null}

                {email ? (
                  <a href={`mailto:${email}`} style={{ display: 'flex', alignItems: 'center', gap: 10, ...linkStyle }} className="nav-link-hover">
                    <MailOutlined style={{ color: '#34d399' }} />
                    <span>{email}</span>
                  </a>
                ) : null}

                {s?.officeAddress ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <EnvironmentOutlined style={{ color: '#34d399', marginTop: 3 }} />
                    <span>{s.officeAddress}</span>
                  </div>
                ) : null}

                <Link to="/help" style={{ display: 'flex', alignItems: 'center', gap: 10, ...linkStyle, color: '#34d399' }} className="nav-link-hover">
                  <ShopOutlined />
                  <span>Help Centre &amp; FAQs</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        <Divider style={{ borderColor: '#292524', margin: '36px 0 24px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#78716c' }}>
          <div>
            &copy; {new Date().getFullYear()} {companyName ?? 'Desi Tokri'}. All rights reserved.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <Link to={legalPath(audience, 'PRIVACY_POLICY')} style={{ color: '#78716c', textDecoration: 'none' }} className="nav-link-hover">
              {DOC_LABEL.PRIVACY_POLICY}
            </Link>
            <Link to={legalPath(audience, 'TERMS_AND_CONDITIONS')} style={{ color: '#78716c', textDecoration: 'none' }} className="nav-link-hover">
              {DOC_LABEL.TERMS_AND_CONDITIONS}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
