import { useSyncExternalStore } from 'react';
import type { OrderSummary } from '@shared/api/checkout';
import { isOrderAlarmActive, startOrderAlarm, stopOrderAlarm } from './orderSound';

export interface IncomingOrderAlert {
  order: OrderSummary;
  receivedAt: number;
}

interface IncomingOrderStoreState {
  alerts: IncomingOrderAlert[];
  currentIndex: number;
  isSilenced: boolean;
}

let state: IncomingOrderStoreState = {
  alerts: [],
  currentIndex: 0,
  isSilenced: false,
};

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export const incomingOrderStore = {
  getState() {
    return state;
  },

  add(order: OrderSummary) {
    // Avoid duplicates
    if (state.alerts.some((a) => a.order.id === order.id)) {
      return;
    }

    const newAlert: IncomingOrderAlert = {
      order,
      receivedAt: Date.now(),
    };

    const nextAlerts = [newAlert, ...state.alerts];
    state = {
      alerts: nextAlerts,
      currentIndex: 0,
      isSilenced: false,
    };

    // Trigger audible looping alarm
    startOrderAlarm();
    notify();
  },

  dismiss(orderId: string) {
    const nextAlerts = state.alerts.filter((a) => a.order.id !== orderId);
    let nextIndex = state.currentIndex;
    if (nextIndex >= nextAlerts.length) {
      nextIndex = Math.max(0, nextAlerts.length - 1);
    }

    if (nextAlerts.length === 0) {
      stopOrderAlarm();
      state = {
        alerts: [],
        currentIndex: 0,
        isSilenced: false,
      };
    } else {
      state = {
        ...state,
        alerts: nextAlerts,
        currentIndex: nextIndex,
      };
    }

    notify();
  },

  silence() {
    stopOrderAlarm();
    state = {
      ...state,
      isSilenced: true,
    };
    notify();
  },

  setIndex(index: number) {
    if (index >= 0 && index < state.alerts.length) {
      state = {
        ...state,
        currentIndex: index,
      };
      notify();
    }
  },

  clearAll() {
    stopOrderAlarm();
    state = {
      alerts: [],
      currentIndex: 0,
      isSilenced: false,
    };
    notify();
  },
};

export function useIncomingOrders() {
  const currentState = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );

  const currentAlert = currentState.alerts[currentState.currentIndex] ?? null;

  return {
    alerts: currentState.alerts,
    currentAlert,
    currentIndex: currentState.currentIndex,
    total: currentState.alerts.length,
    isSilenced: currentState.isSilenced || !isOrderAlarmActive(),
    dismiss: (orderId: string) => incomingOrderStore.dismiss(orderId),
    silence: () => incomingOrderStore.silence(),
    setIndex: (index: number) => incomingOrderStore.setIndex(index),
    clearAll: () => incomingOrderStore.clearAll(),
  };
}
