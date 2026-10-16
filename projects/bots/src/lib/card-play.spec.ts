import type { CardDefinition, GameState } from 'engine';
import { discardRank, isEquipUpgrade, peachWorthPlaying, wineWorthPlaying } from './card-play';
import { card, registry, table } from './testing';

const seatOf = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!;
const hand = (n: number, definitionId = 'shan') => Array.from({ length: n }, (_, i) => card(`${definitionId}${i}`, definitionId));

describe('peachWorthPlaying', () => {
  it('plays at 2 HP or less', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach')] }, { hp: { 'seat-a': 2 }, maxHp: { 'seat-a': 4 } });
    expect(peachWorthPlaying(s, seatOf(s, 'seat-a'))).toBe(true);
  });

  it('plays when holding more cards than its HP, and keeps it otherwise', () => {
    const over = table({ 'seat-a:hand': [card('p', 'peach'), ...hand(3)] }, { hp: { 'seat-a': 3 }, maxHp: { 'seat-a': 4 } });
    expect(peachWorthPlaying(over, seatOf(over, 'seat-a'))).toBe(true); // 4 cards, 3 HP
    const light = table({ 'seat-a:hand': [card('p', 'peach'), ...hand(2)] }, { hp: { 'seat-a': 3 }, maxHp: { 'seat-a': 4 } });
    expect(peachWorthPlaying(light, seatOf(light, 'seat-a'))).toBe(false); // 3 cards, 3 HP
  });

  it('keeps its last Peach while a revealed ally is at 2 HP or less, but plays one of two', () => {
    const opts = { hp: { 'seat-a': 2, 'seat-b': 2 }, maxHp: { 'seat-a': 4 }, kingdoms: { 'seat-b': 'Wei' as const } };
    const one = table({ 'seat-a:hand': [card('p', 'peach')] }, opts);
    expect(peachWorthPlaying(one, seatOf(one, 'seat-a'))).toBe(false);
    const two = table({ 'seat-a:hand': [card('p', 'peach'), card('q', 'peach')] }, opts);
    expect(peachWorthPlaying(two, seatOf(two, 'seat-a'))).toBe(true);
  });

  it('ignores a hurt seat that is not a revealed ally', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach')] }, { hp: { 'seat-a': 2, 'seat-b': 1 }, maxHp: { 'seat-a': 4 } });
    expect(peachWorthPlaying(s, seatOf(s, 'seat-a'))).toBe(true); // seat-b is Shu, a different kingdom
  });
});

describe('wineWorthPlaying', () => {
  const s = table({}, { hp: { 'seat-b': 2, 'seat-c': 3 } });
  it('is for a target at 2 HP or less', () => {
    expect(wineWorthPlaying(seatOf(s, 'seat-b'))).toBe(true);
    expect(wineWorthPlaying(seatOf(s, 'seat-c'))).toBe(false);
  });

  it('is never for no target', () => {
    expect(wineWorthPlaying(undefined)).toBe(false);
  });
});

describe('isEquipUpgrade', () => {
  const weapons = [...registry.cards.values()].filter((c): c is CardDefinition & { weaponRange: number } => c.equipSlot === 'weapon' && c.id !== 'crossbow' && c.weaponRange !== undefined).sort((a, b) => a.weaponRange - b.weaponRange);
  const shortest = weapons[0];
  const longest = weapons[weapons.length - 1];

  it('replaces a weapon with a longer-range one, never the reverse or an equal one', () => {
    expect(longest.weaponRange).toBeGreaterThan(shortest.weaponRange);
    expect(isEquipUpgrade(registry, longest.id, [shortest.id])).toBe(true);
    expect(isEquipUpgrade(registry, shortest.id, [longest.id])).toBe(false);
    expect(isEquipUpgrade(registry, shortest.id, [shortest.id])).toBe(false);
  });

  it('counts Crossbow as range 4', () => {
    const range3 = weapons.find((w) => w.weaponRange === 3)!;
    expect(isEquipUpgrade(registry, 'crossbow', [range3.id])).toBe(true);
    expect(isEquipUpgrade(registry, 'crossbow', ['crossbow'])).toBe(false);
  });

  it('orders armor: Eight Trigrams, Silver Lion, Black Shield, Wood Armor', () => {
    expect(isEquipUpgrade(registry, 'eight-trigrams', ['wood-armor'])).toBe(true);
    expect(isEquipUpgrade(registry, 'silver-lion', ['black-shield'])).toBe(true);
    expect(isEquipUpgrade(registry, 'wood-armor', ['eight-trigrams'])).toBe(false);
  });

  it('never replaces a mount, and has nothing to upgrade in an empty slot', () => {
    expect(isEquipUpgrade(registry, 'red-hare', ['da-yuan'])).toBe(false);
    expect(isEquipUpgrade(registry, longest.id, [])).toBe(false);
    expect(isEquipUpgrade(registry, longest.id, ['eight-trigrams'])).toBe(false); // a different slot
  });

  it('does not treat an unknown card as an upgrade', () => {
    expect(isEquipUpgrade(registry, 'no-such-card', [shortest.id])).toBe(false);
  });
});

describe('discardRank', () => {
  const rankOf = (definitionId: string) => {
    const s = table({ 'seat-a:hand': [card('x', definitionId)] });
    return discardRank(s, registry, 'x');
  };

  it('orders Peach, Shan and Wuxie, Sha, Wine, other Tools, equipment, the rest', () => {
    expect(rankOf('peach')).toBe(6);
    expect(rankOf('shan')).toBe(5);
    expect(rankOf('wuxie')).toBe(5);
    expect(rankOf('sha')).toBe(4);
    expect(rankOf('wine')).toBe(3);
    expect(rankOf('duel')).toBe(2);
    expect(rankOf('axe')).toBe(1);
  });

  it('is 0 for a card it cannot find, and for an unknown definition', () => {
    const s = table({ 'seat-a:hand': [card('x', 'no-such-card')] });
    expect(discardRank(s, registry, 'x')).toBe(0);
    expect(discardRank(s, registry, 'missing-instance')).toBe(0);
  });
});

describe('discardRank: elemental Sha', () => {
  it('ranks Fire Attack and Lightning Attack as Sha, and Chains as a plain Tool', () => {
    const rank = (id: string) => discardRank(table({ 'seat-a:hand': [card('x', id)] }), registry, 'x');
    expect(rank('fire-attack')).toBe(4);
    expect(rank('lightning-attack')).toBe(4);
    expect(rank('chains')).toBe(2);
  });
});
