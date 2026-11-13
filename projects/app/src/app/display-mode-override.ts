import { InjectionToken, isDevMode } from '@angular/core';
import type { DisplayMode } from './layout.service';

const KEY = 'sgs.display';
const MODES: readonly DisplayMode[] = ['fullscreen', 'standalone', 'browser'];

function isMode(value: string | null): value is DisplayMode {
  return MODES.includes(value as DisplayMode);
}

// Dev only: `?display=fullscreen` (or standalone, or browser) makes this tab act as that display mode until
// `?display=auto`, so the phone board can be opened in a desktop browser. Kept for the tab in session storage so it
// survives navigation. A production build ignores the address and the storage.
export function readDisplayModeOverride(search: string, storage: Storage | null, dev: boolean): DisplayMode | null {
  if (!dev) return null;
  const asked = new URLSearchParams(search).get('display');
  try {
    if (asked === 'auto') {
      storage?.removeItem(KEY);
      return null;
    }
    if (isMode(asked)) {
      storage?.setItem(KEY, asked);
      return asked;
    }
    const stored = storage?.getItem(KEY) ?? null;
    return isMode(stored) ? stored : null;
  } catch {
    return isMode(asked) ? asked : null;
  }
}

function sessionStorageOrNull(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const DISPLAY_MODE_OVERRIDE = new InjectionToken<DisplayMode | null>('DISPLAY_MODE_OVERRIDE', {
  providedIn: 'root',
  factory: () => readDisplayModeOverride(window.location.search, sessionStorageOrNull(), isDevMode()),
});
