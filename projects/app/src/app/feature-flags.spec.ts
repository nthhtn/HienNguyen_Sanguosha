import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FEATURE_FLAGS, FeatureFlags, offlineOnly } from './feature-flags';

function setup(flags: FeatureFlags) {
  TestBed.configureTestingModule({
    providers: [
      { provide: FEATURE_FLAGS, useValue: flags },
      provideRouter([
        { path: 'setup', canActivate: [offlineOnly], children: [] },
        { path: 'rooms', children: [] },
      ]),
    ],
  });
  return TestBed.inject(Router);
}

describe('feature flags', () => {
  it('are on by default in dev mode', () => {
    expect(TestBed.inject(FEATURE_FLAGS)).toEqual({ playOffline: true, playbackSettings: true, phoneBoard: true });
  });

  it('lets offline routes through when offline play is on', async () => {
    const router = setup({ playOffline: true, playbackSettings: true, phoneBoard: true });
    await router.navigateByUrl('/setup');
    expect(router.url).toBe('/setup');
  });

  it('redirects offline routes to the online page when offline play is off', async () => {
    const router = setup({ playOffline: false, playbackSettings: false, phoneBoard: false });
    await router.navigateByUrl('/setup');
    expect(router.url).toBe('/rooms');
  });
});
