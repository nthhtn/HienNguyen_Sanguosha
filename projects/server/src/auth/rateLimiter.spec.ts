import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  const rule = { limit: 2, windowMs: 1000 };

  it('allows up to the limit in a window, then refuses', () => {
    const limiter = new RateLimiter(rule);
    expect(limiter.hit('a', 0)).toBe(true);
    expect(limiter.hit('a', 10)).toBe(true);
    expect(limiter.hit('a', 20)).toBe(false);
  });

  it('starts a fresh window once the old one ends', () => {
    const limiter = new RateLimiter(rule);
    limiter.hit('a', 0);
    limiter.hit('a', 0);
    expect(limiter.hit('a', 999)).toBe(false);
    expect(limiter.hit('a', 1000)).toBe(true);
  });

  it('counts keys separately', () => {
    const limiter = new RateLimiter(rule);
    limiter.hit('a', 0);
    limiter.hit('a', 0);
    expect(limiter.hit('b', 0)).toBe(true);
  });

  it('prunes ended windows only', () => {
    const limiter = new RateLimiter(rule);
    limiter.hit('old', 0);
    limiter.hit('new', 900);
    limiter.prune(1000);
    expect(limiter.size).toBe(1);
    expect(limiter.hit('new', 950)).toBe(true);
    expect(limiter.hit('new', 960)).toBe(false);
  });
});
