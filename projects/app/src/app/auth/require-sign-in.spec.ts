import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Me } from 'protocol';
import { AuthService } from './auth.service';
import { requireSignIn } from './require-sign-in';

describe('requireSignIn', () => {
  const me = signal<Me | null>(null);
  const loaded = signal(true);
  const auth = {
    me,
    loaded,
    load: jest.fn(async () => {
      loaded.set(true);
      return me();
    }),
  };

  beforeEach(() => {
    me.set(null);
    loaded.set(true);
    auth.load.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'rooms', canActivate: [requireSignIn], children: [] },
          { path: 'sign-in', children: [] },
        ]),
      ],
    });
  });

  it('lets a signed-in user through', async () => {
    me.set({ id: 'u2', kind: 'guest', displayName: 'Gus' });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rooms');
    expect(router.url).toBe('/rooms');
  });

  it('sends a signed-out user to Sign In, coming back afterwards', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rooms');
    expect(router.url).toBe('/sign-in?returnUrl=%2Frooms');
  });

  it('waits for the first answer about who is signed in', async () => {
    loaded.set(false);
    auth.load.mockImplementationOnce(async () => {
      me.set({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
      loaded.set(true);
      return me();
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rooms');
    expect(auth.load).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/rooms');
  });
});
