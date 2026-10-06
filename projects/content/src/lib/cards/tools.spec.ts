// projects/content/src/lib/cards/tools.spec.ts
import { duelCard } from './duel';
import { wuxieCard } from './wuxie';
import { drawTwoCard } from './draw-two';
import { barbariansCard, hailOfArrowsCard } from './mass-attack';
import { peachGardenCard } from './peach-garden';
import { silverLionCard, greenDragonBladeCard } from './equipment';
import { resolve } from 'engine';
import type { CardDefinition, GameState, ContentRegistry, GameModeDefinition } from 'engine';

const plain = (id: string): CardDefinition => ({ id, name: id, category: 'basic', play: () => [] });

function registry(): ContentRegistry {
  const cards = [duelCard, wuxieCard, drawTwoCard, barbariansCard, hailOfArrowsCard, peachGardenCard, silverLionCard, greenDragonBladeCard, plain('sha'), plain('shan')];
  return { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
}

function stubMode(): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
}

function twoSeatState(seatAHandCardId: string): GameState {
  return {
    seats: [
      {
        id: 'seat-a', index: 0, kingdom: 'Wei',
        generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
        combinedHp: 7, maxCombinedHp: 7,
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
      },
    ],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [1, 2, 3, 4].map((n) => ({ instanceId: `d${n}`, definitionId: 'shan', suit: 'heart' as const, rank: n })) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: [{ instanceId: 'card-1', definitionId: seatAHandCardId, suit: 'spade', rank: 1 }] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

function withSeatBHand(state: GameState, cardId: string, instanceId: string): GameState {
  return {
    ...state,
    zones: state.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [{ instanceId, definitionId: cardId, suit: 'club' as const, rank: 3 }] } : z)),
  };
}

describe('Duel and Wuxie Kongjie', () => {
  const ctx = () => ({ registry: registry(), mode: stubMode() });
  const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
  const discardIds = (s: GameState) => s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId).sort();
  const withHand = (state: GameState, seatId: string, cards: [string, string][]): GameState => ({
    ...state,
    zones: state.zones.map((z) =>
      z.id === `${seatId}:hand`
        ? { ...z, cards: [...z.cards, ...cards.map(([definitionId, instanceId]) => ({ instanceId, definitionId, suit: 'club' as const, rank: 3 }))] }
        : z
    ),
  });
  const duel = (state: GameState) =>
    resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx()).state;
  const sha = (state: GameState, seatId: string, cardInstanceId: string) =>
    resolve(state, { kind: 'RespondAction', seatId, pendingResponseId: state.pendingResponse!.id, cardInstanceId }, ctx()).state;
  const pass = (state: GameState, seatId: string) =>
    resolve(state, { kind: 'PassAction', seatId, pendingResponseId: state.pendingResponse!.id }, ctx()).state;

  it('deals 1 damage from the user to a target who plays no Sha, and the Duel ends up in the discard pile', () => {
    const next = pass(duel(twoSeatState('duel')), 'seat-b');
    expect(hp(next, 'seat-b')).toBe(5);
    expect(hp(next, 'seat-a')).toBe(7);
    const damage = next.log.find((e) => e.kind === 'DamageDealtEvent')!;
    expect(damage).toMatchObject({ damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1 } });
    expect(next.pendingResponse).toBeNull();
    expect(discardIds(next)).toEqual(['card-1']);
  });

  it('turns back to the user once the target plays a Sha: now the user must play one', () => {
    const opened = duel(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']]));
    const answered = sha(opened, 'seat-b', 'b-sha-1');
    expect(answered.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', allowedCardIds: ['sha'] });
    expect(hp(answered, 'seat-b')).toBe(6);
  });

  it('hurts the user, from the target, when the user cannot answer the target’s Sha', () => {
    const answered = sha(duel(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']])), 'seat-b', 'b-sha-1');
    const next = pass(answered, 'seat-a');
    expect(hp(next, 'seat-a')).toBe(6);
    expect(hp(next, 'seat-b')).toBe(6);
    expect(next.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({
      damage: { source: { kind: 'seat', seatId: 'seat-b' }, target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 },
    });
    expect(next.pendingResponse).toBeNull();
    expect(discardIds(next)).toEqual(['b-sha-1', 'card-1']);
  });

  it('alternates for as long as both keep playing Sha; the first to stop takes the damage', () => {
    let state = withHand(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1'], ['sha', 'b-sha-2']]), 'seat-a', [['sha', 'a-sha-1']]);
    state = duel(state);
    state = sha(state, 'seat-b', 'b-sha-1');
    state = sha(state, 'seat-a', 'a-sha-1');
    expect(state.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    state = sha(state, 'seat-b', 'b-sha-2');
    expect(state.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' });
    state = pass(state, 'seat-a');
    expect(hp(state, 'seat-a')).toBe(6);
    expect(hp(state, 'seat-b')).toBe(6);
    expect(discardIds(state)).toEqual(['a-sha-1', 'b-sha-1', 'b-sha-2', 'card-1']);
    // Shas played in a Duel are responses: they don't use up the turn's Sha play.
    expect(state.turn.cardPlays?.['sha'] ?? 0).toBe(0);
  });

  it('can be cancelled by any Wuxie Kongjie holder before its first window, never by the window itself', () => {
    // The user (seat-a) may cancel its own Duel too: its Wuxie check asks seat-a first.
    const asked = duel(withHand(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']]), 'seat-a', [['wuxie', 'a-wuxie']]));
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', reason: { kind: 'wuxie' }, allowedCardIds: ['wuxie'] });
    const cancelled = sha(asked, 'seat-a', 'a-wuxie');
    expect(cancelled.pendingResponse).toBeNull();
    expect(hp(cancelled, 'seat-b')).toBe(6);
    expect(cancelled.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);

    const opened = duel(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']]));
    expect(opened.pendingResponse!.allowedCardIds).toEqual(['sha']);
  });

  it('an untargeted Duel is not a legal play, and its play() stays a defensive no-op', () => {
    const state = twoSeatState('duel');
    expect(() =>
      resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() })
    ).toThrow('Card duel cannot be played with those targets');
    expect(duelCard.play(state, { seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] })).toEqual([]);
  });
});

// Four seats in a row, a (user) b c d, each at 3/4 HP; `hands` adds cards per seat.
function fourSeats(userCard: string, hands: Record<string, [string, string][]> = {}): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], combinedHp: 3, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: `${id}1`, revealed: true }, deputy: { generalDefinitionId: `${id}2`, revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
    })),
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [1, 2, 3, 4].map((n) => ({ instanceId: `d${n}`, definitionId: 'shan', suit: 'heart' as const, rank: n })) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        {
          id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id,
          cards: [
            ...(id === 'a' ? [{ instanceId: 'tool', definitionId: userCard, suit: 'spade' as const, rank: 7 }] : []),
            ...(hands[id] ?? []).map(([definitionId, instanceId]) => ({ instanceId, definitionId, suit: 'club' as const, rank: 3 })),
          ],
        },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('Draw Two, Barbarians, Hail of Arrows, Peach Garden', () => {
  const ctx = () => ({ registry: registry(), mode: stubMode() });
  const use = (s: GameState) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [] }, ctx()).state;
  const answer = (s: GameState, cardInstanceId: string) =>
    resolve(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx()).state;
  const pass = (s: GameState) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx()).state;
  const hps = (s: GameState) => s.seats.map((x) => x.combinedHp);
  const handSize = (s: GameState, id: string) => s.zones.find((z) => z.id === `${id}:hand`)!.cards.length;

  it('Draw Two: the user draws 2, and the card goes to the discard pile first', () => {
    const next = use(fourSeats('draw-two'));
    expect(handSize(next, 'a')).toBe(2);
    expect(next.log.map((e) => e.kind)).toEqual(['CardPlayedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
  });

  it('Draw Two can be cancelled by another seat’s Wuxie Kongjie', () => {
    const asked = use(fourSeats('draw-two', { c: [['wuxie', 'c-wuxie']] }));
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'a' } } });
    expect(handSize(answer(asked, 'c-wuxie'), 'a')).toBe(0);
  });

  it('Barbarians: each other seat in turn order must play a Sha or take 1 damage from the user', () => {
    let s = use(fourSeats('barbarians', { b: [['sha', 'b-sha']], c: [['sha', 'c-sha']] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', allowedCardIds: ['sha'], reason: { kind: 'card-effect', userSeatId: 'a', card: { as: 'barbarians' } } });
    s = answer(s, 'b-sha');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c' });
    s = pass(s); // c keeps its Sha and takes the damage
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd' });
    s = pass(s);
    expect(hps(s)).toEqual([3, 3, 2, 2]);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent').map((e) => (e as { damage: { source: unknown } }).damage.source)).toEqual([
      { kind: 'seat', seatId: 'a' }, { kind: 'seat', seatId: 'a' },
    ]);
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('Hail of Arrows: the same, answered with a Shan', () => {
    let s = use(fourSeats('hail-of-arrows', { c: [['shan', 'c-shan']] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', allowedCardIds: ['shan'] });
    s = pass(s);
    s = answer(s, 'c-shan');
    s = pass(s);
    expect(hps(s)).toEqual([3, 2, 3, 2]);
  });

  it('a Wuxie Kongjie cancels Barbarians for one target only', () => {
    let s = use(fourSeats('barbarians', { c: [['wuxie', 'c-wuxie']] }));
    // b's Wuxie check: c is the only holder; c cancels the Barbarians on b.
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'b' } } });
    s = answer(s, 'c-wuxie');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'card-effect' } }); // on to c itself
    s = pass(s);
    s = pass(s);
    expect(hps(s)).toEqual([3, 3, 2, 2]);
  });

  it('Peach Garden heals each seat below max HP, starting with the user; full-HP seats are not targets', () => {
    const start = fourSeats('peach-garden', { b: [['wuxie', 'b-wuxie']] });
    const withCFull = { ...start, seats: start.seats.map((x) => (x.id === 'c' ? { ...x, combinedHp: 4 } : x)) };
    let s = use(withCFull);
    // The first target is a (the user): b, a Wuxie holder, is asked about it.
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'a' } } });
    s = pass(s); // a heals; then b's own target — b is asked again
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'b' } } });
    s = pass(s); // b heals; c is full (not a target, no check); b is asked about d
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie', target: { kind: 'seat', seatId: 'd' } } });
    s = pass(s); // d heals
    expect(hps(s)).toEqual([4, 4, 4, 4]);
    expect(s.pendingResponse).toBeNull();
  });

  it('a game paused mid-Barbarians survives a JSON round trip and resumes identically (Review Focus 4)', () => {
    const paused = use(fourSeats('barbarians', { c: [['wuxie', 'c-wuxie']] }));
    expect(paused.resolutionQueue!.length).toBeGreaterThan(0);
    const copy = JSON.parse(JSON.stringify(paused)) as GameState;
    expect(pass(pass(pass(copy)))).toEqual(pass(pass(pass(paused))));
  });

  it('Duel cancelled by a seat other than its target never opens its window (Review Focus 5)', () => {
    const s = fourSeats('duel', { c: [['wuxie', 'c-wuxie']] });
    const asked = resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [{ kind: 'seat', seatId: 'b' }] }, ctx()).state;
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie' } });
    const done = answer(asked, 'c-wuxie');
    expect(done.pendingResponse).toBeNull();
    expect(done.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
  });
});

describe('Equipment', () => {
  it('Silver Lion moves from hand to the equip zone when played', () => {
    const state = twoSeatState('silver-lion');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.zones.find((z) => z.id === 'seat-a:hand')!.cards).toHaveLength(0);
    expect(next.zones.find((z) => z.id === 'seat-a:equip')!.cards.map((c) => c.instanceId)).toEqual(['card-1']);
    // equipment is exempt from discard-after-play
    expect(next.zones.find((z) => z.id === 'discardPile')!.cards).toHaveLength(0);
  });

  it('Green Dragon Blade moves from hand to the equip zone when played', () => {
    const state = twoSeatState('green-dragon-blade');
    const { state: next } = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [] }, { registry: registry(), mode: stubMode() });
    expect(next.zones.find((z) => z.id === 'seat-a:equip')!.cards.map((c) => c.instanceId)).toEqual(['card-1']);
  });
});
