import { useQueryClient } from '@tanstack/react-query';
import { riderApi } from './api/rider';
import { useAuth } from './auth/AuthContext';
import { playNotificationSound } from './live/notificationSound';
import { isOrderPush, usePushRegistration } from './push';

/** Registers this phone for push while a rider is signed in, removes it on sign-out. Renders nothing. */
export function PushBridge() {
  const { rider, initialising } = useAuth();
  const qc = useQueryClient();
  usePushRegistration({
    signedIn: initialising ? undefined : Boolean(rider),
    identity: rider?.id,
    register: riderApi.registerPushDevice,
    unregister: riderApi.unregisterPushDevice,
    onPush: (p) => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      if (!isOrderPush(p)) playNotificationSound();
    },
  });
  return null;
}
