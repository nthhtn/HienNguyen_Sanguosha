// projects/content/src/lib/cards/tools.spec.ts
import { duelCard } from './duel';
import { wuxieCard } from './wuxie';
import { drawTwoCard } from './draw-two';
import { barbariansCard, hailOfArrowsCard } from './mass-attack';
import { peachGardenCard } from './peach-garden';
import { stealCard } from './steal';
import { breakCard } from './break';
import { harvestCard } from './harvest';
import { coerceCard } from './coerce';
import { shaCard } from './sha';
import { silverLionCard } from './equipment';
import { greenDragonBladeCard } from './equipment/green-dragon-blade';
import { getLegalActions, redactStateForSeat, resolve } from 'engine';
import type { CardDefinition, GameState, ContentRegistry, GameModeDefinition, Target } from 'engine';

const plain = (id: string): CardDefinition => ({ id, name: id, category: 'basic', play: () => [] });

function registry(): ContentRegistry {
  const cards = [duelCard, wuxieCard, drawTwoCard, barbariansCard, hailOfArrowsCard, peachGardenCard, stealCard, breakCard, harvestCard, coerceCard, silverLionCard, greenDragonBladeCard, shaCard, plain('shan')];
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
        hand: { zoneId: 'seat-a:hand' }, equipped: { zoneId: 'seat-a:equip' }, judgment: { zoneId: 'seat-a:judgment' }, eliminated: false,
      },
      {
        id: 'seat-b', index: 1, kingdom: 'Shu',
        generals: { main: { generalDefinitionId: 'g3', revealed: false }, deputy: { generalDefinitionId: 'g4', revealed: false } },
        combinedHp: 6, maxCombinedHp: 6,
        hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, judgment: { zoneId: 'seat-b:judgment' }, eliminated: false,
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

  it('deals 1 damage from the user to a target who plays no Slash, and the Duel ends up in the discard pile', () => {
    const next = pass(duel(twoSeatState('duel')), 'seat-b');
    expect(hp(next, 'seat-b')).toBe(5);
    expect(hp(next, 'seat-a')).toBe(7);
    const damage = next.log.find((e) => e.kind === 'DamageDealtEvent')!;
    expect(damage).toMatchObject({ damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1 } });
    expect(next.pendingResponse).toBeNull();
    expect(discardIds(next)).toEqual(['card-1']);
  });

  it('turns back to the user once the target plays a Slash: now the user must play one', () => {
    const opened = duel(withHand(twoSeatState('duel'), 'seat-b', [['sha', 'b-sha-1']]));
    const answered = sha(opened, 'seat-b', 'b-sha-1');
    expect(answered.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', allowedCardIds: ['sha'] });
    expect(hp(answered, 'seat-b')).toBe(6);
  });

  it('hurts the user, from the target, when the user cannot answer the target’s Slash', () => {
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

  it('alternates for as long as both keep playing Slash; the first to stop takes the damage', () => {
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
    // Shas played in a Duel are responses: they don't use up the turn's Slash play.
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
    expect(duelCard.play(state, { seatId: 'seat-a', cardInstanceId: 'card-1', card: { as: 'duel', colour: 'black', physical: [] }, targets: [] }, registry())).toEqual([]);
  });
});

// Four seats in a row, a (user) b c d, each at 3/4 HP; `hands` adds cards per seat.
function fourSeats(userCard: string, hands: Record<string, [string, string][]> = {}): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], combinedHp: 3, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: `${id}1`, revealed: true }, deputy: { generalDefinitionId: `${id}2`, revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [1, 2, 3, 4].map((n) => ({ instanceId: `d${n}`, definitionId: 'shan', suit: 'heart' as const, rank: n })) },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
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

const withEquip = (s: GameState, seatId: string, [definitionId, instanceId]: [string, string]): GameState => ({
  ...s,
  zones: s.zones.map((z) => (z.id === `${seatId}:equip` ? { ...z, cards: [...z.cards, { instanceId, definitionId, suit: 'spade' as const, rank: 5 }] } : z)),
});
// The target lists the engine offers for seat a's card 'tool'.
const aimedTargets = (s: GameState): Target[][] =>
  getLegalActions(s, 'a', registry())
    .filter((x): x is Extract<typeof x, { kind: 'PlayCardAction' }> => x.kind === 'PlayCardAction' && x.cardInstanceId === 'tool')
    .map((x) => x.targets);
const pickOption = (s: GameState, optionId: string): GameState =>
  resolve(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId }, { registry: registry(), mode: stubMode() }).state;
const idsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);

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

  it('Barbarians: each other seat in turn order must play a Slash or take 1 damage from the user', () => {
    let s = use(fourSeats('barbarians', { b: [['sha', 'b-sha']], c: [['sha', 'c-sha']] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', allowedCardIds: ['sha'], reason: { kind: 'card-effect', userSeatId: 'a', card: { as: 'barbarians' } } });
    s = answer(s, 'b-sha');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c' });
    s = pass(s); // c keeps its Slash and takes the damage
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd' });
    s = pass(s);
    expect(hps(s)).toEqual([3, 3, 2, 2]);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent').map((e) => (e as { damage: { source: unknown } }).damage.source)).toEqual([
      { kind: 'seat', seatId: 'a' }, { kind: 'seat', seatId: 'a' },
    ]);
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('Hail of Arrows: the same, answered with a Dodge', () => {
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

describe('Steal and Break', () => {
  const ctx = () => ({ registry: registry(), mode: stubMode() });
  const aim = (s: GameState, seatId: string) =>
    resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [{ kind: 'seat', seatId }] }, ctx()).state;
  const answer = (s: GameState, cardInstanceId: string) =>
    resolve(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx()).state;
  const seat = (seatId: string): Target => ({ kind: 'seat', seatId });

  it('Steal targets only seats at distance 1 that hold a card', () => {
    // a's neighbours are b and d; c is 2 away. d holds nothing.
    expect(aimedTargets(fourSeats('steal', { b: [['shan', 'b-1']], c: [['shan', 'c-1']] }))).toEqual([[seat('b')]]);
  });

  it('Break targets any other seat that holds a card, at any distance', () => {
    expect(aimedTargets(fourSeats('break', { b: [['shan', 'b-1']], c: [['shan', 'c-1']] }))).toEqual([[seat('b')], [seat('c')]]);
  });

  it('Steal: the user picks the hand (face down) or a worn card (face up), and takes it', () => {
    const s = aim(withEquip(fourSeats('steal', { b: [['shan', 'b-1'], ['shan', 'b-2']] }), 'b', ['silver-lion', 'b-lion']), 'b');
    expect(s.pendingChoice).toMatchObject({
      seatId: 'a', verb: 'take', reason: { kind: 'choice', userSeatId: 'a', targetSeatId: 'b', card: { as: 'steal' } },
      options: [
        { id: 'hand', shows: { kind: 'hidden-hand', seatId: 'b', count: 2 } },
        { id: 'b-lion', shows: { kind: 'card', card: { instanceId: 'b-lion', definitionId: 'silver-lion' } } },
      ],
    });
    const taken = pickOption(s, 'b-lion');
    expect(idsIn(taken, 'a:hand')).toEqual(['b-lion']);
    expect(idsIn(taken, 'b:equip')).toEqual([]);
    expect(taken.pendingChoice).toBeUndefined();
  });

  it('Steal from the hand takes one card at random, the same one for the same seed', () => {
    const s = aim(fourSeats('steal', { b: [['shan', 'b-1'], ['shan', 'b-2'], ['shan', 'b-3']] }), 'b');
    const taken = pickOption(s, 'hand');
    expect(idsIn(taken, 'a:hand')).toHaveLength(1);
    expect(idsIn(taken, 'b:hand')).toHaveLength(2);
    expect(idsIn(pickOption(s, 'hand'), 'a:hand')).toEqual(idsIn(taken, 'a:hand'));
  });

  it('Break: the picked card goes to the discard pile', () => {
    const s = aim(withEquip(fourSeats('break', { c: [['shan', 'c-1']] }), 'c', ['silver-lion', 'c-lion']), 'c');
    expect(s.pendingChoice).toMatchObject({ seatId: 'a', verb: 'discard', reason: { targetSeatId: 'c' } });
    const broken = pickOption(s, 'c-lion');
    expect(idsIn(broken, 'discardPile')).toContain('c-lion');
    expect(idsIn(broken, 'a:hand')).toEqual([]);
  });

  it('opens no choice when the target has nothing left by the time Steal takes effect (Review Focus 1)', () => {
    // b's only card is a Wuxie: b cancels the Steal on itself, d cancels b's Wuxie, so the Steal goes ahead on an empty b.
    let s = aim(fourSeats('steal', { b: [['wuxie', 'b-wx']], d: [['wuxie', 'd-wx']] }), 'b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', reason: { kind: 'wuxie' } });
    s = answer(s, 'b-wx');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'd', reason: { kind: 'counter-wuxie' } });
    s = answer(s, 'd-wx');
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toBeNull();
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('a game paused on a Steal survives a JSON round trip, and no one else sees the hand (Review Focus 3)', () => {
    const s = aim(fourSeats('steal', { b: [['shan', 'b-1'], ['shan', 'b-2']] }), 'b');
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(pickOption(copy, 'hand')).toEqual(pickOption(s, 'hand'));
    for (const viewer of ['a', 'c']) {
      const seen = JSON.stringify(redactStateForSeat(s, viewer).pendingChoice);
      expect(seen).not.toContain('b-1');
      expect(seen).not.toContain('shan');
    }
  });
});

describe('Harvest and Coerce', () => {
  const ctx = () => ({ registry: registry(), mode: stubMode() });
  const use = (s: GameState) => resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [] }, ctx()).state;
  const coerce = (s: GameState, holder: string, victim: string) =>
    resolve(s, { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: 'tool', targets: [{ kind: 'seat', seatId: holder }, { kind: 'seat', seatId: victim }] }, ctx()).state;
  const answer = (s: GameState, cardInstanceId: string) =>
    resolve(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx()).state;
  const pass = (s: GameState) =>
    resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, ctx()).state;
  const pickFirst = (s: GameState) => pickOption(s, s.pendingChoice!.options[0].id);
  const hps = (s: GameState) => s.seats.map((x) => x.combinedHp);
  const seat = (seatId: string): Target => ({ kind: 'seat', seatId });
  const armed = (hands: Record<string, [string, string][]> = {}) => withEquip(fourSeats('coerce', hands), 'c', ['green-dragon-blade', 'c-blade']);

  it('Harvest turns up one card per living seat, and each seat from the user takes one in turn', () => {
    let s = use(fourSeats('harvest'));
    expect(idsIn(s, 'processing')).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(s.pendingChoice).toMatchObject({ seatId: 'a', verb: 'take', reason: { kind: 'choice', userSeatId: 'a', card: { as: 'harvest' } } });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['d1', 'd2', 'd3', 'd4']);
    s = pickOption(s, 'd3');
    expect(s.pendingChoice).toMatchObject({ seatId: 'b' });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['d1', 'd2', 'd4']);
    s = pickOption(s, 'd1');
    s = pickOption(s, 'd2');
    expect(s.pendingChoice).toMatchObject({ seatId: 'd' });
    s = pickOption(s, 'd4');
    expect(['a', 'b', 'c', 'd'].map((id) => idsIn(s, `${id}:hand`))).toEqual([['d3'], ['d1'], ['d2'], ['d4']]);
    expect(idsIn(s, 'processing')).toEqual([]);
    expect(s.pendingChoice).toBeUndefined();
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('Harvest: a seat whose pick is cancelled takes nothing, and the leftover is discarded', () => {
    // c holds a Wuxie Kongjie: it lets a's pick through, then cancels b's.
    let s = use(fourSeats('harvest', { c: [['wuxie', 'c-wx']] }));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: seat('a') } });
    s = pass(s);
    s = pickOption(s, 'd1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'c', reason: { kind: 'wuxie', target: seat('b') } });
    s = answer(s, 'c-wx');
    expect(s.pendingChoice).toMatchObject({ seatId: 'c' });
    s = pickOption(s, 'd2');
    s = pickOption(s, 'd3');
    expect(idsIn(s, 'b:hand')).toEqual([]);
    expect(idsIn(s, 'processing')).toEqual([]);
    expect(idsIn(s, 'discardPile')).toEqual(expect.arrayContaining(['tool', 'c-wx', 'd4']));
  });

  it('Harvest with too few cards to go round: the later seats get no pick (Review Focus 2)', () => {
    const start = fourSeats('harvest');
    const short = { ...start, zones: start.zones.map((z) => (z.kind === 'drawPile' ? { ...z, cards: z.cards.slice(0, 2) } : z)) };
    // Two cards left for four seats. The discard pile is shuffled in, but never the Harvest being resolved.
    let s = use(short);
    expect(idsIn(s, 'processing')).toEqual(['d1', 'd2']);
    s = pickFirst(pickFirst(s));
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toBeNull();
    expect(idsIn(s, 'c:hand')).toEqual([]);
    expect(idsIn(s, 'd:hand')).toEqual([]);
    expect(idsIn(s, 'discardPile')).toContain('tool');
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('Coerce pairs each other seat wearing a weapon with every seat it can reach, the user included', () => {
    expect(aimedTargets(armed())).toEqual([
      [seat('c'), seat('a')],
      [seat('c'), seat('b')],
      [seat('c'), seat('d')],
    ]);
    expect(aimedTargets(fourSeats('coerce'))).toEqual([]);
  });

  it('Coerce: a holder who plays no Slash hands its weapon to the user', () => {
    const s = coerce(armed({ c: [['sha', 'c-sha']] }), 'c', 'b');
    expect(s.pendingResponse).toMatchObject({
      respondingSeatId: 'c', allowedCardIds: ['sha'],
      reason: { kind: 'card-effect', userSeatId: 'a', victimSeatId: 'b', card: { as: 'coerce' } },
    });
    const after = pass(s);
    expect(idsIn(after, 'a:hand')).toEqual(['c-blade']);
    expect(idsIn(after, 'c:equip')).toEqual([]);
  });

  it('Coerce: the holder’s Slash is answered like any Slash, and the holder keeps its weapon', () => {
    let s = answer(coerce(armed({ c: [['sha', 'c-sha']] }), 'c', 'b'), 'c-sha');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'b', allowedCardIds: ['shan'] });
    s = pass(s);
    expect(hps(s)).toEqual([3, 2, 3, 3]);
    expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { source: seat('c'), target: seat('b') } });
    expect(idsIn(s, 'c:equip')).toEqual(['c-blade']);
    expect(s.turn.cardPlays?.['sha'] ?? 0).toBe(0);
  });

  it('Coerce can make the holder attack the user (Review Focus 5)', () => {
    let s = answer(coerce(armed({ c: [['sha', 'c-sha']] }), 'c', 'a'), 'c-sha');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'a', allowedCardIds: ['shan'] });
    s = pass(s);
    expect(hps(s)[0]).toBe(2);
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
