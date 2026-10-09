import { lookupCard, lookupGeneral, lookupMode } from './lookup';
import { ContentRegistry, ModeRegistry, CardDefinition, GeneralDefinition, GameModeDefinition } from './types';

describe('registry lookups', () => {
  it('finds a registered card definition by id', () => {
    const sha: CardDefinition = { id: 'sha', name: 'Sha', category: 'basic', play: () => [] };
    const registry: ContentRegistry = { cards: new Map([['sha', sha]]), generals: new Map() };
    expect(lookupCard(registry, 'sha')).toBe(sha);
  });

  it('throws a clear error for an unregistered card id', () => {
    const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
    expect(() => lookupCard(registry, 'does-not-exist')).toThrow(/does-not-exist/);
  });

  it('finds a registered general definition by id', () => {
    const general: GeneralDefinition = { id: 'g1', kingdom: 'Wei', maxHp: 4, skills: [] };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['g1', general]]) };
    expect(lookupGeneral(registry, 'g1')).toBe(general);
  });

  it('finds a registered game mode by id', () => {
    const mode: GameModeDefinition = {
      id: 'kingdom-war',
      setup: (() => { throw new Error('not used in this test'); }) as GameModeDefinition['setup'],
      checkWinCondition: () => null,
      triggers: [],
    };
    const modes: ModeRegistry = new Map([['kingdom-war', mode]]);
    expect(lookupMode(modes, 'kingdom-war')).toBe(mode);
  });
});
