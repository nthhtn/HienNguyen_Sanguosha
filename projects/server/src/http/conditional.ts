// The HTTP rules for conditional and partial requests on a static file, kept free of Fastify so they can be tested alone.

export type RangeResult = { kind: 'none' } | { kind: 'unsatisfiable' } | { kind: 'range'; start: number; end: number };

const NONE: RangeResult = { kind: 'none' };
const UNSATISFIABLE: RangeResult = { kind: 'unsatisfiable' };

// A weak validator from the size and modification time: right across content codings, and a file in a
// deployed image never changes under a running server.
export function weakEtag(size: number, mtimeMs: number): string {
  return `W/"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
}

const opaqueTag = (tag: string): string => tag.trim().replace(/^W\//, '');

// Whether a GET can be answered 304. If-None-Match decides alone when present (weak comparison);
// otherwise If-Modified-Since, at the one-second resolution of HTTP dates.
export function isNotModified(conditions: { ifNoneMatch?: string; ifModifiedSince?: string }, etag: string, mtimeMs: number): boolean {
  if (conditions.ifNoneMatch !== undefined) {
    const header = conditions.ifNoneMatch.trim();
    return header === '*' || header.split(',').some((tag) => opaqueTag(tag) === opaqueTag(etag));
  }
  if (conditions.ifModifiedSince !== undefined) {
    const since = Date.parse(conditions.ifModifiedSince);
    return !Number.isNaN(since) && Math.floor(mtimeMs / 1000) <= Math.floor(since / 1000);
  }
  return false;
}

// A single `bytes=` range of a file of `size` bytes. A header that is not one satisfiable-or-not single byte
// range (several ranges, another unit, last < first) is ignored, and the whole file is sent.
export function parseRange(header: string | undefined, size: number): RangeResult {
  const match = /^bytes=(\d*)-(\d*)$/.exec((header ?? '').trim());
  if (!match) return NONE;
  const [, first, last] = match;
  if (first === '' && last === '') return NONE;
  if (first === '') {
    const length = Number(last);
    if (length === 0 || size === 0) return UNSATISFIABLE;
    return { kind: 'range', start: Math.max(0, size - length), end: size - 1 };
  }
  const start = Number(first);
  if (last !== '' && Number(last) < start) return NONE;
  if (start >= size) return UNSATISFIABLE;
  return { kind: 'range', start, end: last === '' ? size - 1 : Math.min(Number(last), size - 1) };
}

// If-Range: the range applies only if the validator still matches. A weak ETag never does (it needs a strong
// comparison), so only the Last-Modified date can; without the header the range always applies.
export function ifRangeMatches(ifRange: string | undefined, lastModified: string): boolean {
  if (ifRange === undefined) return true;
  const date = Date.parse(ifRange);
  return !ifRange.trim().startsWith('W/') && !ifRange.trim().startsWith('"') && !Number.isNaN(date) && date === Date.parse(lastModified);
}
