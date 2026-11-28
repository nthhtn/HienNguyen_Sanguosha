import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FEATURE_FLAGS, FeatureFlags, featureFlagsFor, offlineOnly, tutorialEnabled } from './feature-flags';

function setup(flags: FeatureFlags) {
  TestBed.configureTestingModule({
    providers: [
      { provide: FEATURE_FLAGS, useValue: flags },
      provideRouter([
        { path: 'setup', canActivate: [offlineOnly], children: [] },
        { path: 'tutorial', canActivate: [tutorialEnabled], children: [] },
        { path: 'rooms', children: [] },
      ]),
    ],
  });
  return TestBed.inject(Router);
}

describe('feature flags', () => {
  it('turn the phone board and the Tutorial on in a production build, and keep the test-only features off', () => {
    expect(featureFlagsFor(false)).toEqual({ playOffline: false, playbackSettings: false, phoneBoard: true, tutorial: true, skipNoAnswerWindows: [], showBlazeCard: false });
  });

  it('are on by default in dev mode', () => {
    expect(TestBed.inject(FEATURE_FLAGS)).toEqual({ playOffline: true, playbackSettings: true, phoneBoard: true, tutorial: true, skipNoAnswerWindows: [], showBlazeCard: false });
  });

  it('lets offline routes through when offline play is on', async () => {
    const router = setup({ playOffline: true, playbackSettings: true, phoneBoard: true, tutorial: true, skipNoAnswerWindows: [], showBlazeCard: false });
    await router.navigateByUrl('/setup');
    expect(router.url).toBe('/setup');
  });

  it('redirects offline routes to the online page when offline play is off', async () => {
    const router = setup({ playOffline: false, playbackSettings: false, phoneBoard: false, tutorial: false, skipNoAnswerWindows: [], showBlazeCard: false });
    await router.navigateByUrl('/setup');
    expect(router.url).toBe('/rooms');
  });

  it('lets the Tutorial route through when offline play is off, as it is in production', async () => {
    const router = setup({ playOffline: false, playbackSettings: false, phoneBoard: true, tutorial: true, skipNoAnswerWindows: [], showBlazeCard: false });
    await router.navigateByUrl('/tutorial');
    expect(router.url).toBe('/tutorial');
  });

  it('redirects the Tutorial route to the online page when the Tutorial is off', async () => {
    const router = setup({ playOffline: true, playbackSettings: true, phoneBoard: true, tutorial: false, skipNoAnswerWindows: [], showBlazeCard: false });
    await router.navigateByUrl('/tutorial');
    expect(router.url).toBe('/rooms');
  });
});
