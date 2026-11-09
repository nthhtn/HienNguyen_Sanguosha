import { ifRangeMatches, isNotModified, parseRange, weakEtag } from './conditional';

describe('weakEtag', () => {
  it('is weak and built from the size and the modification time, in hex', () => {
    expect(weakEtag(255, 4096)).toBe('W/"ff-1000"');
  });

  it('ignores the sub-millisecond part of the time', () => {
    expect(weakEtag(1, 4096.9)).toBe(weakEtag(1, 4096));
  });
});

describe('isNotModified', () => {
  const etag = 'W/"ff-1000"';
  const mtime = Date.UTC(2026, 10, 6, 12, 0, 0, 500);

  it('matches an equal If-None-Match, from a list, or *', () => {
    expect(isNotModified({ ifNoneMatch: etag }, etag, mtime)).toBe(true);
    expect(isNotModified({ ifNoneMatch: 'W/"x", W/"ff-1000"' }, etag, mtime)).toBe(true);
    expect(isNotModified({ ifNoneMatch: '*' }, etag, mtime)).toBe(true);
  });

  it('compares weakly: a strong form of the same tag matches', () => {
    expect(isNotModified({ ifNoneMatch: '"ff-1000"' }, etag, mtime)).toBe(true);
  });

  it('does not match a different tag', () => {
    expect(isNotModified({ ifNoneMatch: 'W/"ff-1001"' }, etag, mtime)).toBe(false);
  });

  it('lets If-None-Match decide: a later If-Modified-Since does not rescue a different tag', () => {
    expect(isNotModified({ ifNoneMatch: 'W/"other"', ifModifiedSince: new Date(mtime + 100000).toUTCString() }, etag, mtime)).toBe(false);
  });

  it('uses If-Modified-Since at one-second resolution when there is no If-None-Match', () => {
    expect(isNotModified({ ifModifiedSince: new Date(mtime).toUTCString() }, etag, mtime)).toBe(true);
    expect(isNotModified({ ifModifiedSince: new Date(mtime + 5000).toUTCString() }, etag, mtime)).toBe(true);
    expect(isNotModified({ ifModifiedSince: new Date(mtime - 2000).toUTCString() }, etag, mtime)).toBe(false);
  });

  it('is false with no conditions, and for a date it cannot read', () => {
    expect(isNotModified({}, etag, mtime)).toBe(false);
    expect(isNotModified({ ifModifiedSince: 'yesterday-ish' }, etag, mtime)).toBe(false);
  });
});

describe('parseRange', () => {
  it.each([
    ['bytes=0-9', { kind: 'range', start: 0, end: 9 }],
    ['bytes=90-', { kind: 'range', start: 90, end: 99 }],
    ['bytes=-10', { kind: 'range', start: 90, end: 99 }],
    ['bytes=50-500', { kind: 'range', start: 50, end: 99 }],
    ['bytes=0-0', { kind: 'range', start: 0, end: 0 }],
    ['bytes=-500', { kind: 'range', start: 0, end: 99 }],
    ['bytes=100-', { kind: 'unsatisfiable' }],
    ['bytes=100-120', { kind: 'unsatisfiable' }],
    ['bytes=-0', { kind: 'unsatisfiable' }],
  ])('%s on a 100-byte file', (header, expected) => {
    expect(parseRange(header, 100)).toEqual(expected);
  });

  it.each([undefined, '', 'items=0-9', 'bytes=abc', 'bytes=9-5', 'bytes=0-9,20-29', 'bytes=', 'bytes=-'])('ignores %p', (header) => {
    expect(parseRange(header, 100)).toEqual({ kind: 'none' });
  });

  it('cannot satisfy any range of an empty file', () => {
    expect(parseRange('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' });
  });
});

describe('ifRangeMatches', () => {
  const lastModified = 'Fri, 06 Nov 2026 12:00:00 GMT';

  it('is true with no If-Range', () => {
    expect(ifRangeMatches(undefined, lastModified)).toBe(true);
  });

  it('is true for the same Last-Modified date', () => {
    expect(ifRangeMatches(lastModified, lastModified)).toBe(true);
  });

  it('is false for another date, a weak ETag (If-Range needs a strong one) or garbage', () => {
    expect(ifRangeMatches('Fri, 06 Nov 2026 12:00:01 GMT', lastModified)).toBe(false);
    expect(ifRangeMatches('W/"ff-1000"', lastModified)).toBe(false);
    expect(ifRangeMatches('"ff-1000"', lastModified)).toBe(false);
    expect(ifRangeMatches('nonsense', lastModified)).toBe(false);
  });
});
