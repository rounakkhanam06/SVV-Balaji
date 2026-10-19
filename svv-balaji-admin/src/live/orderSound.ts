import { useSyncExternalStore } from 'react';
import { playNotificationSound } from './notificationSound';

/**
 * The new-order chime for the staff panel (public/sounds/new-order.mp3).
 *
 * Browsers refuse to play audio until the person has interacted with the page,
 * so the first click / key press anywhere unlocks it. After that it plays even
 * while the dashboard tab is in the background, as long as the tab is open.
 * Each browser can mute it (top bar toggle); the choice is kept per browser.
 */

const SOUND_URL = `${import.meta.env.BASE_URL}sounds/new-order.mp3`;
const MUTE_KEY = 'svv.orderSound.muted';

let audio: HTMLAudioElement | null = null;
let unlocked = false;
let lastPlayed = 0;
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function player(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.preload = 'auto';
  }
  return audio;
}

/** Call once at start-up: the first user gesture primes the audio element. */
export function installOrderSoundUnlock() {
  if (unlocked || typeof window === 'undefined') return;
  const unlock = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume();
      }
    } catch {
      // ignore
    }
    const a = player();
    if (!a) return;
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
        unlocked = true;
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      })
      .catch(() => {
        a.muted = false; // not allowed yet - try again on the next interaction
      });
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

// ---------------------------------------------------------------- mute

const listeners = new Set<() => void>();
let muted = (() => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
})();

export function setOrderSoundMuted(next: boolean) {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* private mode: holds for this session */
  }
  if (next) {
    const a = player();
    if (a) a.pause();
  } else if (alarmActive) {
    startOrderAlarm();
  }
  listeners.forEach((l) => l());
}

export function useOrderSoundMuted() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => muted,
  );
}

/**
 * Play the chime once. Several orders landing together ring once, not once each.
 */
export function playOrderSound(force = false) {
  if (muted && !force) return;
  const now = Date.now();
  if (!force && now - lastPlayed < 3000) return;
  lastPlayed = now;
  const a = player();
  if (!a) return;
  a.currentTime = 0;
  void a.play().catch(() => undefined);
}

let loopInterval: number | null = null;
let alarmActive = false;

/** Continuous ringing alarm for new broadcast order until acknowledged */
export function startOrderAlarm() {
  alarmActive = true;
  if (muted) return;
  try {
    navigator.vibrate?.([400, 200, 400, 200, 400]);
  } catch {
    // ignore
  }
  const a = player();
  if (!a) return;
  a.loop = true;
  a.currentTime = 0;
  void a.play().catch(() => undefined);

  if (loopInterval) clearInterval(loopInterval);
  loopInterval = window.setInterval(() => {
    if (!alarmActive || muted) return;
    const aud = player();
    if (aud && aud.paused) {
      aud.currentTime = 0;
      void aud.play().catch(() => undefined);
    }
  }, 3500);
}

export function stopOrderAlarm() {
  alarmActive = false;
  if (loopInterval) {
    clearInterval(loopInterval);
    loopInterval = null;
  }
  const a = player();
  if (a) {
    a.pause();
    a.loop = false;
    a.currentTime = 0;
  }
  try {
    navigator.vibrate?.(0);
  } catch {
    // ignore
  }
}

export function isOrderAlarmActive(): boolean {
  return alarmActive;
}

/**
 * Every non-order alert (support tickets and messages, staff alerts, pushes):
 * public/sounds/notification.mp3 - see notificationSound.ts. Orders keep
 * playOrderSound above. The top-bar mute switch silences both.
 */
export function playMessageSound(force = false) {
  if (muted && !force) return;
  playNotificationSound();
}
