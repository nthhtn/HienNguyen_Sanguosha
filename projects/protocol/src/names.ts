import { DISPLAY_NAME_MAX } from './limits';

// How every bot's name begins, in every language: "[Bot] Zhou Cang". A person's name may not start with it.
export const BOT_NAME_PREFIX = '[Bot] ';
export const botName = (plainName: string): string => `${BOT_NAME_PREFIX}${plainName}`;

// A display name as stored and shown: NFC, trimmed, inner whitespace collapsed
// to one space. Null when it is empty, too long or has control characters.
export function normalizeDisplayName(raw: string): string | null {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > DISPLAY_NAME_MAX) return null;
  if (/\p{Cc}/u.test(name)) return null;
  // "[Bot] " is how a bot's name is shown, so nobody else may start a name with it.
  if (/^\[\s*bot\s*\]/i.test(name)) return null;
  return name;
}
