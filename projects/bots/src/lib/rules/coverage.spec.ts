import { readFileSync } from 'fs';
import { join } from 'path';
import { buildContentRegistry } from 'content';
import { IGNORED, LEGACY_HANDLED } from './coverage';
import { KINGDOM_WARS_RULES } from './kingdom-wars';

// Every Kingdom Wars card, and every skill of a Kingdom Wars General that is not compulsory, not Lord and has an
// active, a conversion or a trigger, is covered by exactly one of: a bot rule, the legacy ladder, or a stated reason.
const deckCardIds = (): string[] => {
  const deck = JSON.parse(readFileSync(join(__dirname, '../../../../content/data/decks/kingdom-wars/deck.json'), 'utf8'));
  return [...new Set<string>(deck.entries.map((e: { cardId: string }) => e.cardId))];
};

const decisionSkillIds = (): string[] => {
  const ids = new Set<string>();
  for (const general of buildContentRegistry().generals.values()) {
    if (!general.id.startsWith('kingdomWars:')) continue;
    for (const skill of general.skills) {
      if (!skill.compulsory && !skill.lord && (skill.active || skill.conversions?.length || skill.triggers?.length)) ids.add(skill.id);
    }
  }
  return [...ids];
};

describe('bot coverage of the Kingdom Wars deck', () => {
  const required = [...deckCardIds(), ...decisionSkillIds()];
  const lists = (id: string): string[] => [
    ...(KINGDOM_WARS_RULES.has(id) ? ['KINGDOM_WARS_RULES'] : []),
    ...(LEGACY_HANDLED.includes(id) ? ['LEGACY_HANDLED'] : []),
    ...(id in IGNORED ? ['IGNORED'] : []),
  ];

  it('finds the deck', () => {
    expect(required.length).toBeGreaterThan(50);
  });

  it('puts every card and skill in a list', () => {
    expect(required.filter((id) => lists(id).length === 0)).toEqual([]);
  });

  it('puts no card or skill in two lists', () => {
    expect(required.filter((id) => lists(id).length > 1).map((id) => `${id}: ${lists(id).join(' + ')}`)).toEqual([]);
  });

  it('lists no id that is not in the deck', () => {
    const known = new Set(required);
    const listed = [...KINGDOM_WARS_RULES.keys(), ...LEGACY_HANDLED, ...Object.keys(IGNORED)];
    expect(listed.filter((id) => !known.has(id))).toEqual([]);
  });

  it('gives every ignored id a reason', () => {
    expect(Object.entries(IGNORED).filter(([, reason]) => !reason.trim())).toEqual([]);
  });
});
