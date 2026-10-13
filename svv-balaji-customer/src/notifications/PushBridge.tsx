import { useQueryClient } from '@tanstack/react-query';
import { INBOX_KEY, notificationsApi } from '../api/notifications';
import { useCustomerAuth } from '../auth/CustomerAuthContext';
import { isOrderPush, usePushRegistration } from '../push';
import { playNotificationSound } from './notificationSound';

/** Registers this device for push while signed in, removes it on sign-out. Renders nothing. */
export function PushBridge() {
  const { isLoggedIn, initialising, customerProfile, retailerProfile } = useCustomerAuth();
  const qc = useQueryClient();
  usePushRegistration({
    signedIn: initialising ? undefined : isLoggedIn,
    identity: customerProfile?.phone ?? retailerProfile?.phone,
    register: notificationsApi.registerDevice,
    unregister: notificationsApi.unregisterDevice,
    onPush: (p) => {
      void qc.invalidateQueries({ queryKey: INBOX_KEY });
      if (!isOrderPush(p)) playNotificationSound();
    },
  });
  return null;
}
