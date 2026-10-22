import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { refreshOnce } from '../api/client';
import { tokenStore } from '../api/tokenStore';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { playNotificationSound } from './notificationSound';

function socketOrigin(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';
  if (/^https?:\/\//i.test(base)) return new URL(base).origin;
  return window.location.origin; // dev: the Vite proxy forwards /socket.io
}

interface OrderPing {
  orderNumber: string;
  status: string;
}

/**
 * Live link to the server while signed in (namespace /customer). Order status
 * changes refetch the orders screens at once, so nobody has to pull to refresh.
 * When the rider at the door asks for the delivery OTP, the order screen
 * (which shows the code) is brought up. Renders nothing.
 */
export function OrderLiveBridge() {
  const { isLoggedIn } = useCustomerAuth();
  const qc = useQueryClient();
  // useNavigate changes on every route change; a ref keeps the socket from reconnecting each time.
  const nav = useNavigate();
  const navigate = useRef(nav);
  navigate.current = nav;
  const { notification } = App.useApp();

  useEffect(() => {
    if (!isLoggedIn) return;
    const s = io(`${socketOrigin()}/customer`, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: (cb) => cb({ token: tokenStore.getAccessToken() ?? '' }),
      reconnectionDelayMax: 10_000,
    });
    const refresh = () => void qc.invalidateQueries({ queryKey: ['storefront', 'orders'] });

    s.on('order:updated', refresh);
    s.on('order:otp-requested', (p: OrderPing) => {
      refresh();
      playNotificationSound();
      notification.info({
        key: `otp-${p.orderNumber}`,
        message: 'Your delivery partner is at the door',
        description: 'Share the delivery OTP shown on your order screen.',
        duration: 8,
      });
      navigate.current(`/orders/${p.orderNumber}`);
    });
    // Events sent while disconnected are gone: catch up on (re)connect.
    s.on('ready', refresh);
    s.on('unauthorized', async () => {
      try {
        await refreshOnce();
        s.connect();
      } catch {
        /* signed out - the auth context handles it */
      }
    });
    return () => {
      s.disconnect();
    };
  }, [isLoggedIn, qc, notification]);

  return null;
}
