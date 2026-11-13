import { inject, InjectionToken, isDevMode } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export interface FeatureFlags {
  // Offline play (Setup and Game against bots on this device).
  playOffline: boolean;
  // The playback settings menu.
  playbackSettings: boolean;
  // The phone board for the installed app (and the hint that sends a phone browser to install it). Off in production
  // until the board itself is built.
  phoneBoard: boolean;
}

// Test-only features: on under `ng serve`, off in a production build.
export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS', {
  providedIn: 'root',
  factory: () => ({ playOffline: isDevMode(), playbackSettings: isDevMode(), phoneBoard: isDevMode() }),
});

// Sends offline-only routes to the online page when offline play is off.
export const offlineOnly: CanActivateFn = () => {
  const router = inject(Router);
  return inject(FEATURE_FLAGS).playOffline ? true : router.parseUrl('/rooms');
};
