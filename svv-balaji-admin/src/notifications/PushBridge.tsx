import { useQueryClient } from '@tanstack/react-query';
import { PUSH_KEYS, pushNotificationsApi } from '@shared/api/pushNotifications';
import { useAuth } from '../auth/useAuth';
import { usePushRegistration } from '../push';
import { playMessageSound } from '../live/orderSound';

/**
 * Keeps this browser's push registration in step with the session: registered while someone
 * is signed in, removed at sign-out. Renders nothing; mounted once inside AuthProvider.
 */
export function PushBridge() {
  const { user, initialising } = useAuth();
  const qc = useQueryClient();
  usePushRegistration({
    signedIn: initialising ? undefined : Boolean(user),
    identity: user?.id,
    register: (token) => pushNotificationsApi.registerDevice(token, 'ADMIN'),
    unregister: (token) => pushNotificationsApi.unregisterDevice(token),
    onPush: (p) => {
      void qc.invalidateQueries({ queryKey: PUSH_KEYS.inbox });
      // New orders already rang new-order.mp3 from the live socket.
      if (!p.tag?.startsWith('new_order')) playMessageSound();
    },
  });
  return null;
}
