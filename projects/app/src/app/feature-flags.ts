import { inject, InjectionToken } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DEV_FEATURES } from './dev/dev-routes';
import type { NoAnswerWindow } from './game-board/no-answer-window';

export interface FeatureFlags {
  // Offline play (Setup and Game against bots on this device).
  playOffline: boolean;
  // The playback settings menu.
  playbackSettings: boolean;
  // The phone board for the installed app (and the hint that sends a phone browser to install it). On everywhere; kept
  // as a switch so it can be turned off in one line.
  phoneBoard: boolean;
  // The Tutorial: lessons on the real board against scripted bots. It runs on this device but is not offline play, so it
  // is on in production while Setup and Play vs Bots are not.
  tutorial: boolean;
  // Beginner experiment: the response windows whose popup is skipped (the app passes for the seat) when it has nothing to answer
  // with. Empty: every window opens, as before. Put BEGINNER_SKIP_WINDOWS here to try it. A code constant for now: see
  // docs/deferrals.md, "Experiment flags are code constants, not feature toggles".
  skipNoAnswerWindows: readonly NoAnswerWindow[];
  // Beginner experiment: the Blaze card the target showed is also shown in the "discard a card of the same suit" popup. Off: it
  // shows only in the Resolution notice. See the same deferral as above.
  showBlazeCard: boolean;
}

// Test-only features follow DEV_FEATURES (file-replaced in production builds); the phone board and the Tutorial are on in both.
export function featureFlagsFor(dev: boolean): FeatureFlags {
  return { playOffline: dev, playbackSettings: dev, phoneBoard: true, tutorial: true, skipNoAnswerWindows: [], showBlazeCard: false };
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

// Sends the Tutorial route to the online page when the Tutorial is off.
export const tutorialEnabled: CanActivateFn = () => {
  const router = inject(Router);
  return inject(FEATURE_FLAGS).tutorial ? true : router.parseUrl('/rooms');
};
