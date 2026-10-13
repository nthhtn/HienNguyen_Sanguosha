import { DISPLAY_NAME_MAX } from './limits';

// A display name as stored and shown: NFC, trimmed, inner whitespace collapsed
// to one space. Null when it is empty, too long or has control characters.
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > DISPLAY_NAME_MAX) return null;
  if (/\p{Cc}/u.test(name)) return null;
  return name;
}
