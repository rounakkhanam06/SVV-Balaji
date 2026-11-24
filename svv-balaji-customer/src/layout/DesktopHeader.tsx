import {
  BarcodeOutlined,
  BellOutlined,
  CompassOutlined,
  CreditCardOutlined,
  DownOutlined,
  EnvironmentOutlined,
  GiftFilled,
  HeartOutlined,
  LogoutOutlined,
  PhoneOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TrophyOutlined,
  TruckOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Badge, Button, Dropdown, Input, type MenuProps, Tag, Typography, Skeleton } from 'antd';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { useCart } from '../cart/useCart';
import { useLoyalty } from '../loyalty/useLoyalty';

import { formatInr } from '../utils/money';
import { useUnreadNotifications } from '../notifications/useUnreadNotifications';
import { useStorefrontSupport } from '@shared/hooks/useSupportSettings';
import { LocationPicker } from '../location/LocationPicker';
import { locationLine, useShopperLocation } from '../location/useShopperLocation';


const MENU_ICON = { color: '#78716c' };

export function DesktopHeader() {
  const shopperLocation = useShopperLocation();
  const [pickingLocation, setPickingLocation] = useState(false);
  const cart = useCart();
  const navigate = useNavigate();
  const { role, customerProfile, retailerProfile, logout, isLoggedIn, initialising } = useCustomerAuth();
  const loyalty = useLoyalty();
  const unreadNotifications = useUnreadNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  // Helpline from Admin > Helpdesk & Support Settings - the same source as the footer.
  const support = useStorefrontSupport(role === 'RETAILER' ? 'RETAILER' : 'CUSTOMER');
  const helpline = support.data?.isPhoneSupportActive ? support.data.tollFreeNumber?.split(' (')[0] : null;
  const isRetailer = role === 'RETAILER';
  const isCustomer = role === 'CUSTOMER';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Account Menu for Retailer
  const retailerAccountMenu: MenuProps['items'] = [
    {
      key: 'profile-header',
      label: (
        <div style={{ padding: '6px 4px', minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <Typography.Text strong style={{ fontSize: 14 }}>
              {retailerProfile?.storeName || 'My Store'}
            </Typography.Text>
            <Tag color="green" style={{ margin: 0, fontSize: 10, fontWeight: 600 }}>Verified</Tag>
          </div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            GST: {retailerProfile?.gstin || '—'}
          </Typography.Text>
          <Tag color="gold" style={{ margin: '8px 0 0', fontSize: 11 }}>
            {loyalty.points.toLocaleString('en-IN')} loyalty pts
          </Tag>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'orders',
      icon: <TruckOutlined style={MENU_ICON} />,
      label: <Link to="/orders">Orders &amp; invoices</Link>,
    },
    {
      key: 'loyalty',
      icon: <TrophyOutlined style={MENU_ICON} />,
      label: <Link to="/loyalty">Rewards</Link>,
    },
    {
      key: 'profile',
      icon: <UserOutlined style={MENU_ICON} />,
      label: <Link to="/profile">Store profile</Link>,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined style={{ color: '#dc2626' }} />,
      label: <span onClick={logout} style={{ color: '#dc2626' }}>Sign out</span>,
    },
  ];

  // Account Menu for Customer
  const customerAccountMenu: MenuProps['items'] = [
    {
      key: 'profile-header',
      label: (
        <div style={{ padding: '6px 4px', minWidth: 200 }}>
          <Typography.Text strong style={{ display: 'block', fontSize: 14 }}>
            {customerProfile?.name ?? ''}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {customerProfile?.phone ?? ''}
          </Typography.Text>
          <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
            <Tag color="gold" style={{ margin: 0, fontSize: 11 }}>
              {loyalty.points.toLocaleString('en-IN')} pts
            </Tag>
          </div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'orders',
      icon: <TruckOutlined style={MENU_ICON} />,
      label: <Link to="/orders">My orders</Link>,
    },
    {
      key: 'loyalty',
      icon: <TrophyOutlined style={MENU_ICON} />,
      label: <Link to="/loyalty">Rewards</Link>,
    },
    {
      key: 'wishlist',
      icon: <HeartOutlined style={MENU_ICON} />,
      label: <Link to="/wishlist">Wishlist</Link>,
    },
    {
      key: 'addresses',
      icon: <EnvironmentOutlined style={MENU_ICON} />,
      label: <Link to="/addresses">Addresses</Link>,
    },
    {
      key: 'partner',
      icon: <ShopOutlined style={MENU_ICON} />,
      label: (
        <Link to="/retailers/register" style={{ color: '#c2410c', fontWeight: 600 }}>
          Buy wholesale for your shop
        </Link>
      ),
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined style={{ color: '#dc2626' }} />,
      label: <span onClick={logout} style={{ color: '#dc2626' }}>Sign out</span>,
    },
  ];

  return (
    <header className="desktop-only" style={{ background: '#ffffff', borderBottom: '1px solid #e7e5e4', position: 'sticky', top: 0, zIndex: 100 }}>
      {/* Top utility announcement bar */}
      <div
        style={{
          background: '#065f46',
          color: '#ecfdf5',
          fontSize: 12,
          padding: '6px 0',
        }}
      >
        <div
          className="store-container"
          style={{
            paddingTop: 0,
            paddingBottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div className="hdr-top-left" style={{ display: 'flex', alignItems: 'center', gap: 16, overflow: 'hidden', whiteSpace: 'nowrap', minWidth: 0 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <SafetyCertificateOutlined style={{ color: '#a7f3d0' }} />
              Farm-traceable staples, milled direct
            </span>
          </div>

          <div className="hdr-top-right" style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
            {!isRetailer && (
              <Link
                to="/retailers/register"
                style={{
                  color: '#ffffff',
                  textDecoration: 'none',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <ShopOutlined /> Buy wholesale
              </Link>
            )}
            {isRetailer && (
              <span style={{ color: '#ffffff', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <ShopOutlined /> Retailer account
              </span>
            )}
            <Link
              to="/trace"
              style={{
                color: '#ffffff',
                textDecoration: 'none',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <QrcodeOutlined /> Trace a pack
            </Link>
            {helpline ? (
              <a href={`tel:${helpline.replace(/[^0-9+]/g, '')}`} className="hdr-phone" style={{ color: '#ffffff', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <PhoneOutlined /> {helpline}
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main desktop header bar */}
      <div style={{ padding: '12px 0' }}>
        <div
          className="store-container"
          style={{
            paddingTop: 0,
            paddingBottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
          data-hdr-main=""
        >
          {/* Logo & Delivering To */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <Link
              to="/"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none',
              }}
            >
              <img
                src="/images/desi-tokri-horizontal.png"
                alt="Desi Tokri"
                className="hdr-logo"
                style={{
                  height: 34,
                  width: 'auto',
                  display: 'block',
                  objectFit: 'contain',
                }}
              />
            </Link>

            {/* Location Pill */}
            <div
              className="header-location-pill"
              role="button"
              tabIndex={0}
              onClick={() => setPickingLocation(true)}
              onKeyDown={(e) => e.key === 'Enter' && setPickingLocation(true)}
              title="Change location"
              style={{
                cursor: 'pointer',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 10,
                background: '#ffffff',
                border: '1px solid #e7e5e4',
              }}
            >
              <EnvironmentOutlined style={{ color: '#059669', fontSize: 15 }} />
              <div>
                <span style={{ fontSize: 10, color: '#78716c', display: 'block', lineHeight: 1 }}>Delivering to</span>
                <strong style={{ fontSize: 12, color: shopperLocation ? '#1c1917' : '#ea580c' }}>
                  {shopperLocation ? locationLine(shopperLocation) : 'Set location'} ▾
                </strong>
              </div>
            </div>
            <LocationPicker open={pickingLocation} onClose={() => setPickingLocation(false)} />
          </div>

          {/* Clean Omnibar Search */}
          <div className="hdr-search" style={{ flex: '1 1 280px', maxWidth: 640, minWidth: 160 }}>
            <form onSubmit={handleSearch}>
              <Input
                size="large"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for atta, dal, spices, snacks, edible oils..."
                prefix={<SearchOutlined style={{ color: '#9ca3af', fontSize: 16, marginRight: 6 }} />}
                suffix={
                  <Button
                    type="primary"
                    htmlType="submit"
                    style={{
                      height: 34,
                      padding: '0 16px',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    Search
                  </Button>
                }
                style={{
                  borderRadius: 12,
                  borderColor: '#e7e5e4',
                  background: '#fafaf9',
                  paddingRight: 4,
                  height: 42,
                }}
              />
            </form>
          </div>

          {/* Right Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {/* User Profile / Retailer Dropdown or Sign In */}
            {initialising ? (
              // Session being restored: hold the account slot instead of flashing "Sign In".
              <Skeleton.Button active style={{ width: 132, height: 42, borderRadius: 10 }} />
            ) : isLoggedIn ? (
              <Dropdown menu={{ items: isRetailer ? retailerAccountMenu : customerAccountMenu }} placement="bottomRight" arrow>
                <Link to="/profile" style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 10,
                      background: '#ffffff',
                      border: '1px solid #e7e5e4',
                      cursor: 'pointer',
                      height: 42,
                    }}
                    className="category-pill-hover"
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: '#ecfdf5',
                        color: '#047857',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      <UserOutlined />
                    </div>
                    <div className="hdr-account-text" style={{ textAlign: 'left', lineHeight: 1.15 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1c1917', display: 'block' }}>
                        {isRetailer ? 'Store Profile' : 'My Account'}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', maxWidth: 90, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isRetailer ? retailerProfile?.storeName || 'Store' : customerProfile?.name || 'Customer'}
                      </span>
                    </div>
                    <DownOutlined className="hdr-account-text" style={{ fontSize: 9, color: '#94a3b8', marginLeft: 2 }} />
                  </div>
                </Link>
              </Dropdown>
            ) : (
              <Link to="/login" style={{ textDecoration: 'none' }}>
                <Button
                  style={{
                    borderRadius: 10,
                    fontWeight: 600,
                    height: 42,
                    padding: '0 18px',
                  }}
                >
                  Sign In
                </Button>
              </Link>
            )}

            {/* Cart Button */}
            <Link to="/cart" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  background: '#f97316',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 14px 0 10px',
                  height: 42,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
                className="hdr-cart"
              >
                {/* Cart Icon Container with crisp, non-overlapping floating Badge */}
                <div
                  style={{
                    position: 'relative',
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: 'rgba(255, 255, 255, 0.22)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <ShoppingCartOutlined style={{ fontSize: 17, color: '#ffffff' }} />
                  {cart.count > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: -5,
                        right: -6,
                        minWidth: 17,
                        height: 17,
                        padding: '0 4px',
                        borderRadius: 999,
                        background: '#ffffff',
                        color: '#ea580c',
                        fontSize: 10.5,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                        lineHeight: 1,
                      }}
                    >
                      {cart.count > 99 ? '99+' : cart.count}
                    </span>
                  )}
                </div>

                {/* Text Content */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    textAlign: 'left',
                    lineHeight: 1.15,
                  }}
                >
                  <span
                    className="hdr-cart-label"
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: 'rgba(255, 255, 255, 0.9)',
                      letterSpacing: '0.02em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    My Cart
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#ffffff',
                      letterSpacing: '-0.01em',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cart.indicativeTotal != null && cart.indicativeTotal > 0
                      ? formatInr(cart.indicativeTotal)
                      : '₹0'}
                  </span>
                </div>

                {/* Subtle Right Arrow */}
                <RightOutlined
                  className="hdr-cart-arrow"
                  style={{
                    fontSize: 10,
                    color: 'rgba(255, 255, 255, 0.8)',
                    marginLeft: 2,
                  }}
                />
              </div>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
