import { inject, InjectionToken } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DEV_FEATURES } from './dev/dev-routes';

export interface FeatureFlags {
  // Offline play (Setup and Game against bots on this device).
  playOffline: boolean;
  // The playback settings menu.
  playbackSettings: boolean;
  // The phone board for the installed app (and the hint that sends a phone browser to install it). On everywhere; kept
  // as a switch so it can be turned off in one line.
  phoneBoard: boolean;
}

// Test-only features follow DEV_FEATURES (file-replaced in production builds); the phone board is on in both.
export function featureFlagsFor(dev: boolean): FeatureFlags {
  return { playOffline: dev, playbackSettings: dev, phoneBoard: true };
}

export const FEATURE_FLAGS = new InjectionToken<FeatureFlags>('FEATURE_FLAGS', {
  providedIn: 'root',
  factory: () => featureFlagsFor(DEV_FEATURES),
});

// Sends offline-only routes to the online page when offline play is off.
export const offlineOnly: CanActivateFn = () => {
  const router = inject(Router);
  return inject(FEATURE_FLAGS).playOffline ? true : router.parseUrl('/rooms');
};
