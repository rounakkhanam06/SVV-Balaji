import { useSyncExternalStore } from 'react';
import { checkoutApi, type GeoAddress } from '../api/checkout';

/**
 * Where the shopper says they are, for the header ("📍 Arera Colony, Bhopal").
 * Display only: checkout still decides delivery from the address actually
 * chosen there. Kept per device in localStorage, shared by every header via a
 * tiny store so picking it in one place updates the others at once.
 */
export interface ShopperLocation {
  /** Short line for the header, e.g. "Arera Colony". */
  title: string;
  /** City / full line under it, e.g. "Bhopal, Madhya Pradesh 462016". */
  subtitle: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  source: 'GPS' | 'ADDRESS' | 'SEARCH' | 'MANUAL';
}

const KEY = 'svv.shopperLocation';
const listeners = new Set<() => void>();

function read(): ShopperLocation | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ShopperLocation) : null;
  } catch {
    return null;
  }
}

let current: ShopperLocation | null = read();

export function setShopperLocation(next: ShopperLocation | null) {
  current = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode / blocked storage: it still holds for this session.
  }
  listeners.forEach((l) => l());
}

/** Our header fields from a geocoded address. */
export function fromGeo(g: GeoAddress, source: ShopperLocation['source'], fallbackTitle: string): ShopperLocation {
  const title = g.line2 || g.line1?.split(',')[0] || g.city || fallbackTitle;
  const subtitle = [g.city, g.state, g.pincode].filter(Boolean).join(', ') || g.formatted;
  return { title, subtitle, pincode: g.pincode, latitude: g.latitude, longitude: g.longitude, source };
}

/** Address for a GPS fix, with one retry - the first call can lose a race with a cold API. */
export async function resolveCoordinates(latitude: number, longitude: number): Promise<GeoAddress | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const g = await checkoutApi.reverseGeocode(latitude, longitude).catch(() => null);
    if (g && (g.line2 || g.line1 || g.city)) return { ...g, latitude, longitude };
  }
  return null;
}

/**
 * Locations saved while the address lookup was failing kept the placeholder
 * "Current location" forever. Once per page load, look the saved pin up again
 * and replace the placeholder with the real area name.
 */
let healAttempted = false;
function healPlaceholder() {
  if (healAttempted) return;
  healAttempted = true;
  const l = current;
  if (!l || l.title !== 'Current location' || l.latitude == null || l.longitude == null) return;
  void resolveCoordinates(l.latitude, l.longitude).then((g) => {
    // Only if the shopper has not picked something else meanwhile.
    if (g && current === l) setShopperLocation(fromGeo(g, l.source, l.title));
  });
}

export function useShopperLocation() {
  healPlaceholder();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}

/** "Arera Colony, Bhopal" - what fits in one header line. */
export function locationLine(l: ShopperLocation) {
  const city = l.subtitle?.split(',')[0]?.trim();
  return city && city !== l.title ? `${l.title}, ${city}` : l.title;
}
