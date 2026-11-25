import { sessionCookieSecure } from './session';

describe('sessionCookieSecure', () => {
  it('in production follows PUBLIC_ORIGIN', () => {
    expect(sessionCookieSecure(true, true, {})).toBe(true);
    expect(sessionCookieSecure(true, false, { origin: 'https://tunnel.trycloudflare.com' })).toBe(false);
  });

  it('in development uses Secure cookies when the browser uses https', () => {
    expect(sessionCookieSecure(false, false, { origin: 'https://foo.trycloudflare.com' })).toBe(true);
    expect(sessionCookieSecure(false, false, { referer: 'https://foo.trycloudflare.com/rooms' })).toBe(true);
    expect(sessionCookieSecure(false, false, { 'x-forwarded-proto': 'https' })).toBe(true);
    expect(sessionCookieSecure(false, false, { origin: 'http://localhost:4200' })).toBe(false);
  });
});