import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Me } from 'protocol';
import { ApiError, AuthService } from './auth.service';

const ANN: Me = { id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' };
const GUEST: Me = { id: 'u2', kind: 'guest', displayName: 'Guest' };

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('load() reads /api/me', async () => {
    const done = auth.load();
    http.expectOne({ method: 'GET', url: '/api/me' }).flush(ANN);
    expect(await done).toEqual(ANN);
    expect(auth.me()).toEqual(ANN);
    expect(auth.loaded()).toBe(true);
    expect(auth.isRegistered()).toBe(true);
  });

  it('load() leaves me null when signed out', async () => {
    const done = auth.load();
    http.expectOne('/api/me').flush({ code: 'not_signed_in', message: 'Please sign in first' }, { status: 401, statusText: 'Unauthorized' });
    expect(await done).toBeNull();
    expect(auth.me()).toBeNull();
    expect(auth.loaded()).toBe(true);
  });

  it('signIn posts the body and sets me', async () => {
    const done = auth.signIn({ email: 'ann@example.com', password: 'secret-pass' });
    const req = http.expectOne({ method: 'POST', url: '/api/auth/signin' });
    expect(req.request.body).toEqual({ email: 'ann@example.com', password: 'secret-pass' });
    req.flush(ANN);
    expect(await done).toEqual(ANN);
    expect(auth.me()).toEqual(ANN);
  });

  it('signUp, playAsGuest and resetPassword set me from their endpoints', async () => {
    const up = auth.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
    http.expectOne({ method: 'POST', url: '/api/auth/signup' }).flush(ANN);
    await up;
    const guest = auth.playAsGuest({ displayName: 'Guest' });
    http.expectOne({ method: 'POST', url: '/api/auth/guest' }).flush(GUEST);
    await guest;
    expect(auth.isRegistered()).toBe(false);
    const reset = auth.resetPassword({ token: 't', password: 'brand-new-pass' });
    http.expectOne({ method: 'POST', url: '/api/auth/reset-password' }).flush(ANN);
    await reset;
    expect(auth.me()).toEqual(ANN);
  });

  it("turns the server's error body into an ApiError with its message", async () => {
    const done = auth.signIn({ email: 'ann@example.com', password: 'wrong' });
    http.expectOne('/api/auth/signin').flush({ code: 'invalid_credentials', message: 'Email or password is incorrect' }, { status: 401, statusText: 'Unauthorized' });
    const err = await done.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'invalid_credentials', message: 'Email or password is incorrect', status: 401 });
    expect(auth.me()).toBeNull();
  });

  it('reports an unreachable server as a network error', async () => {
    const done = auth.signIn({ email: 'ann@example.com', password: 'x' });
    http.expectOne('/api/auth/signin').error(new ProgressEvent('error'), { status: 0 });
    expect(await done.catch((e: unknown) => e)).toMatchObject({ code: 'network', message: "Can't reach the server. Check your connection and try again" });
  });

  it('signOut posts {} and clears me', async () => {
    const signIn = auth.signIn({ email: 'ann@example.com', password: 'secret-pass' });
    http.expectOne('/api/auth/signin').flush(ANN);
    await signIn;
    const done = auth.signOut();
    const req = http.expectOne({ method: 'POST', url: '/api/auth/signout' });
    expect(req.request.body).toEqual({});
    req.flush(null, { status: 204, statusText: 'No Content' });
    await done;
    expect(auth.me()).toBeNull();
  });

  it("forgotPassword returns the server's message", async () => {
    const done = auth.forgotPassword({ email: 'ann@example.com' });
    http.expectOne({ method: 'POST', url: '/api/auth/forgot-password' }).flush({ message: 'If that email has an account, we sent a link' });
    expect(await done).toBe('If that email has an account, we sent a link');
  });
});
