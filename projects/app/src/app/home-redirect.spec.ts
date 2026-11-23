import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { Me } from 'protocol';
import { AuthService } from './auth/auth.service';
import { homeRedirect } from './home-redirect';
import { clearDisplayMode, stubDisplayMode } from './layout.testing';

describe('homeRedirect', () => {
  const me = signal<Me | null>(null);
  const loaded = signal(true);
  const auth = { me, loaded, load: jest.fn(async () => me()) };

  beforeEach(() => {
    me.set(null);
    loaded.set(true);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'play', children: [] },
          { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },
        ]),
      ],
    });
  });
  afterEach(() => clearDisplayMode());

  async function open(): Promise<string> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    return TestBed.inject(Router).url;
  }

  it('shows the landing page to a signed-out visitor in a browser tab', async () => {
    stubDisplayMode('browser');
    expect(await open()).toBe('/');
  });

  it('sends the installed app straight to Play', async () => {
    stubDisplayMode('fullscreen');
    expect(await open()).toBe('/play');
  });

  it('sends a signed-in player straight to Play, a guest included', async () => {
    stubDisplayMode('browser');
    me.set({ id: 'p-ann', kind: 'guest', displayName: 'Ann' } as Me);
    expect(await open()).toBe('/play');
  });

  it('asks the server who is signed in before deciding, when that is not known yet', async () => {
    stubDisplayMode('browser');
    loaded.set(false);
    auth.load.mockImplementationOnce(async () => {
      loaded.set(true);
      me.set({ id: 'p-bo', kind: 'registered', displayName: 'Bo' } as Me);
      return me();
    });
    expect(await open()).toBe('/play');
  });
});
