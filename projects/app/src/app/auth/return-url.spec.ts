import { returnUrlParams, safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps an in-app path', () => {
    expect(safeReturnUrl('/game?x=1')).toBe('/game?x=1');
  });

  it('falls back to Setup for nothing, an absolute URL or a protocol-relative one', () => {
    expect(safeReturnUrl(null)).toBe('/setup');
    expect(safeReturnUrl('https://evil.example')).toBe('/setup');
    expect(safeReturnUrl('//evil.example')).toBe('/setup');
    expect(safeReturnUrl('/\\evil.example')).toBe('/setup');
  });

  it('carries only a safe returnUrl between auth screens', () => {
    expect(returnUrlParams('/game')).toEqual({ returnUrl: '/game' });
    expect(returnUrlParams('//evil.example')).toEqual({});
    expect(returnUrlParams(null)).toEqual({});
  });
});
