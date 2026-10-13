/**
 * The general notification sound (public/sounds/notification.mp3) - every
 * alert EXCEPT order ones, which keep their own sound. Same file in every app.
 *
 * Browsers refuse to play audio until the person has interacted with the page,
 * so the first click / tap / key press anywhere unlocks it. With the app closed
 * or in the background the device's own notification sound plays instead (web
 * push cannot choose a custom sound).
 */

const SOUND_URL = `${import.meta.env.BASE_URL}sounds/notification.mp3`;

let audio: HTMLAudioElement | null = null;
let unlockInstalled = false;
let lastPlayed = 0;

function player(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio(SOUND_URL);
    audio.preload = 'auto';
  }
  return audio;
}

/** Call once at start-up: the first user gesture primes the audio element. */
export function installNotificationSoundUnlock() {
  if (unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  const unlock = () => {
    const a = player();
    if (!a) return;
    a.muted = true;
    a.play()
      .then(() => {
        a.pause();
        a.currentTime = 0;
        a.muted = false;
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

/**
 * Play the sound. The same alert often arrives twice while the app is open
 * (socket + push), and a burst rings once - so repeats within 1.5 s are dropped.
 */
export function playNotificationSound() {
  const now = Date.now();
  if (now - lastPlayed < 1500) return;
  lastPlayed = now;
  const a = player();
  if (!a) return;
  a.currentTime = 0;
  void a.play().catch(() => undefined);
}
