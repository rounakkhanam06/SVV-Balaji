import { LockOutlined, ShopOutlined } from '@ant-design/icons';
import { Button, Result, Space, Typography } from 'antd';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCustomerAuth } from './CustomerAuthContext';

import { PageSkeleton } from '../layout/PageSkeleton';
/**
 * The gate for every screen that is about the signed-in shopper: profile, cart,
 * checkout, orders, returns, wishlist, addresses, rewards, referrals,
 * affiliate dashboard and notifications. A guest sees a "Please sign in" page.
 *
 * Reads the storefront's own session (`useCustomerAuth`, backed by
 * `CustomerAccount`) rather than `@shared/auth/useAuth`, which is the staff
 * panel's session — a customer has no `User` row, so that hook can never
 * report them signed in. Separate from `@shared/auth/RequireAuth` on purpose
 * too: the staff guard redirects to a login screen and that is the end of it;
 * here the person is usually mid-purchase, so where they were going has to
 * survive the round trip or they land on a home page with a full cart and no
 * idea what happened. `state.from` is what LoginPage sends them back to.
 *
 * There is no permission check. A customer's access is decided by ownership —
 * your orders are yours — and that is enforced on the server. Hiding a route is
 * not access control and must not be mistaken for it.
 */
export function RequireAccount({ children }: { children: ReactNode }) {
  const { isLoggedIn, initialising } = useCustomerAuth();
  const location = useLocation();
  const navigate = useNavigate();

  if (initialising) return <PageSkeleton kind="account" />;

  if (!isLoggedIn) {
    // A page rather than a bare redirect: the shopper sees why, and picks the right door
    // (customer or retailer). Either way they come back here after signing in.
    const from = location.pathname + location.search;
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '60vh', padding: '32px 16px' }}>
        <Result
          icon={<LockOutlined style={{ color: '#ea580c' }} />}
          title="Please sign in"
          subTitle={`Sign in to see your ${PAGE_NAMES[location.pathname.split('/')[1]] ?? 'account'}.`}
          extra={
            <Space direction="vertical" size={12} style={{ width: '100%', maxWidth: 320 }}>
              <Button
                type="primary"
                size="large"
                block
                style={{ background: '#ea580c', borderColor: '#ea580c' }}
                onClick={() => navigate('/login', { state: { from } })}
              >
                Sign in
              </Button>
              <Button size="large" block icon={<ShopOutlined />} onClick={() => navigate('/retailers/login', { state: { from } })}>
                Retailer sign in
              </Button>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                New here? Signing in with your mobile number creates your account.{' '}
                <Link to="/">Continue shopping</Link>
              </Typography.Text>
            </Space>
          }
        />
      </div>
    );
  }

  return <>{children}</>;
}

/** What the page is called, for "Sign in to see your ...". */
const PAGE_NAMES: Record<string, string> = {
  profile: 'profile',
  cart: 'cart',
  checkout: 'checkout',
  wishlist: 'wishlist',
  orders: 'orders',
  'order-support': 'order support',
  'order-placed': 'order',
  'order-success': 'order',
  returns: 'returns',
  addresses: 'saved addresses',
  loyalty: 'rewards',
  refer: 'referrals',
  'refer-and-earn': 'referrals',
  affiliate: 'affiliate dashboard',
  notifications: 'notifications',
};
