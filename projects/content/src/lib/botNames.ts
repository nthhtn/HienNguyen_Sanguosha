import botNames from '../../data/botNames.json';
import viBotNames from '../../data/locales/vi/bot-names.json';

// The names bots play under: Three Kingdoms figures who are not Generals in any deck. The pool is flat on
// purpose: a name says nothing about a force, and a bot's force comes only from the Generals it is dealt.
// Ids are the keys of botNames.json; each language's file is keyed by the same ids, and a missing entry reads English.
const ENGLISH: Readonly<Record<string, string>> = botNames;
const BOT_NAME_TEXT: Record<string, Readonly<Record<string, string>>> = { vi: viBotNames };

export const botNameIds = (): string[] => Object.keys(ENGLISH);

// The plain name (no "Bot: " prefix) in a language; null when the id is not in the pool.
export function botNameDisplay(id: string, locale: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(ENGLISH, id)) return null;
  const table = Object.prototype.hasOwnProperty.call(BOT_NAME_TEXT, locale) ? BOT_NAME_TEXT[locale] : undefined;
  return table && Object.prototype.hasOwnProperty.call(table, id) ? table[id] : ENGLISH[id];
}

// `count` distinct ids that are not in `exclude`, in random order. The caller supplies the randomness, so the
// engine's own RNG is never consumed and a seeded caller gets the same names every time.
export function drawBotNameIds(count: number, exclude: readonly string[], random: () => number = Math.random): string[] {
  const taken = new Set(exclude);
  const free = botNameIds().filter((id) => !taken.has(id));
  if (count > free.length) throw new RangeError(`Cannot draw ${count} bot names from ${free.length} free names`);
  for (let i = free.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [free[i], free[j]] = [free[j], free[i]];
  }
  return free.slice(0, count);
}
