import { advanceToDecision, getLegalActions, previewEffect, resolve, usedCardOf } from 'engine';
import type { CardDefinition, CardInstance, ContentRegistry, GameState } from 'engine';
import { kingdomWarMode, RESCUE_CARD_IDS } from '../modes/kingdomWar';
import { wineCard } from './wine';
import { shaCard } from './sha';
import { peachCard } from './peach';
import { crossbowCard, blackPommelCard, silverLionCard } from './equipment';

const plain = (id: string): CardDefinition => ({ id, name: id, category: 'basic', play: () => [] });
const cards = [wineCard, shaCard, peachCard, crossbowCard, blackPommelCard, silverLionCard, plain('shan')];
const registry: ContentRegistry = { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
const ctx = { registry, mode: kingdomWarMode };

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 9 });

// Three seats (Wei, Shu, Wu) at 4/4 HP; seat-a's Play phase.
function table(cards: Record<string, CardInstance[]> = {}, hp: Record<string, number> = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu'] as const)[index], eliminated: false,
      generals: { main: { generalDefinitionId: `${id}-m`, revealed: true }, deputy: { generalDefinitionId: `${id}-d`, revealed: true } },
      combinedHp: hp[id] ?? 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const play = (s: GameState, cardInstanceId: string, target?: string) =>
  resolve(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: target ? [{ kind: 'seat', seatId: target }] : [] }, ctx).state;
const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const respond = (s: GameState, cardInstanceId: string) =>
  resolve(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx).state;
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
const wineOffered = (s: GameState) => getLegalActions(s, 'seat-a', registry).some((a) => a.kind === 'PlayCardAction' && a.cardInstanceId.startsWith('w'));

describe('Wine', () => {
  it('is played with no target, at most once a turn', () => {
    const s = table({ 'seat-a:hand': [card('w1', 'wine'), card('w2', 'wine')] });
    expect(getLegalActions(s, 'seat-a', registry)).toContainEqual({ kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'w1', targets: [] });
    const once = play(s, 'w1');
    expect(once.turn.flags).toEqual({ wine: true });
    expect(wineOffered(once)).toBe(false);
  });

  it('makes the next Slash deal 2', () => {
    const s = play(table({ 'seat-a:hand': [card('w1', 'wine'), card('s1', 'sha')] }), 'w1');
    expect(hp(pass(play(s, 's1', 'seat-b')), 'seat-b')).toBe(2);
  });

  it('is spent when the Slash is played, even if it is dodged (Review Focus 3)', () => {
    const s = table({ 'seat-a:hand': [card('w1', 'wine'), card('s1', 'sha'), card('s2', 'sha')], 'seat-a:equip': [card('x', 'crossbow')], 'seat-b:hand': [card('d1', 'shan')] });
    const dodged = respond(play(play(s, 'w1'), 's1', 'seat-b'), 'd1');
    expect(hp(dodged, 'seat-b')).toBe(4);
    expect(dodged.turn).not.toHaveProperty('flags');
    expect(hp(pass(play(dodged, 's2', 'seat-b')), 'seat-b')).toBe(3);
  });

  it('doesn’t boost a Slash played as a response, and keeps the boost for later', () => {
    const boosted = { ...table(), turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], flags: { wine: true } } };
    expect(shaCard.play(boosted, { seatId: 'seat-a', cardInstanceId: 's1', card: usedCardOf(card('s1', 'sha')), targets: [], respondingTo: 'x' }, registry)).toEqual([]);
  });

  it('lapses at the end of the turn', () => {
    const s = play(table({ 'seat-a:hand': [card('w1', 'wine')] }), 'w1');
    const next = resolve(s, { kind: 'EndPhaseAction', seatId: 'seat-a' }, ctx).state;
    expect(next.turn.ownerSeatId).not.toBe('seat-a');
    expect(next.turn).not.toHaveProperty('flags');
  });

  it('a boosted Slash against Silver Lion deals 1; with Black Pommel it deals 2', () => {
    const plainSha = table({ 'seat-a:hand': [card('w1', 'wine'), card('s1', 'sha')], 'seat-b:equip': [card('l', 'silver-lion')] });
    expect(hp(pass(play(play(plainSha, 'w1'), 's1', 'seat-b')), 'seat-b')).toBe(3);
    const pommel = table({ 'seat-a:hand': [card('w1', 'wine'), card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [card('l', 'silver-lion')] });
    expect(hp(pass(play(play(pommel, 'w1'), 's1', 'seat-b')), 'seat-b')).toBe(2);
  });
});

describe('Wine saves only yourself', () => {
  // seat-b at 0 HP enters its dying round with Kingdom War's rescue cards, asked from the turn owner, seat-a.
  const dying = (cards: Record<string, CardInstance[]>) =>
    advanceToDecision({ ...table(cards, { 'seat-b': 0 }), resolutionQueue: [{ kind: 'DyingEffect', seatId: 'seat-b', order: ['seat-a', 'seat-b', 'seat-c'], rescueCardIds: RESCUE_CARD_IDS, entering: true }] }, ctx).state;

  it('the dying seat may play a Wine on itself to recover 1 HP; no flag, no play counted', () => {
    const asked = dying({ 'seat-b:hand': [card('w1', 'wine')] });
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['peach', 'wine'] });
    const saved = respond(asked, 'w1');
    expect(hp(saved, 'seat-b')).toBe(1);
    expect(saved.turn).not.toHaveProperty('flags');
    expect(saved.turn.cardPlays?.['wine'] ?? 0).toBe(0);
  });

  it('another seat’s Wine can’t save it (Review Focus 4)', () => {
    const asked = dying({ 'seat-c:hand': [card('w1', 'wine')] });
    expect(asked.pendingResponse?.respondingSeatId).toBe('seat-b');
    const next = pass(asked);
    expect(next.seats.find((x) => x.id === 'seat-b')!.eliminated).toBe(true);
  });

  it('Kingdom War’s dying round offers Wine to the dying seat only', () => {
    const asked = dying({ 'seat-a:hand': [card('p1', 'peach'), card('w1', 'wine')] });
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', allowedCardIds: ['peach'] });
  });
});

describe('previewing damage against Silver Lion', () => {
  const boostedSha = (s: GameState) => ({
    kind: 'DamageEffect' as const,
    damage: { source: { kind: 'seat' as const, seatId: 'seat-a' }, target: { kind: 'seat' as const, seatId: 'seat-b' }, amount: 2, nature: 'normal' as const, cause: { cardInstanceId: 's1', card: usedCardOf(card('s1', 'sha')) } },
  });

  it('shows a Wine-boosted Slash landing as 1 on a Silver Lion wearer, and as 2 with Black Pommel', () => {
    const lion = table({ 'seat-b:equip': [card('l', 'silver-lion')] });
    const withSha = { ...lion, zones: lion.zones.map((z) => (z.id === 'discardPile' ? { ...z, cards: [card('s1', 'sha')] } : z)) };
    expect(previewEffect(withSha, boostedSha(withSha), ctx)).toMatchObject({ damage: { amount: 1 } });
    const pommel = { ...withSha, zones: withSha.zones.map((z) => (z.id === 'seat-a:equip' ? { ...z, cards: [card('bp', 'black-pommel')] } : z)) };
    expect(previewEffect(pommel, boostedSha(pommel), ctx)).toMatchObject({ damage: { amount: 2 } });
  });
});
