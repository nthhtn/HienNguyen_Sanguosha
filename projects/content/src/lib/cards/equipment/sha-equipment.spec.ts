import { advanceToDecision, getLegalActions, resolve } from 'engine';
import type { Action, CardInstance, GameModeDefinition, GameState, QueueItem } from 'engine';
import { buildContentRegistry } from '../../registry';
import { cardStep } from '../../shared/steps';

// The real cards and Generals; a mode with no triggers of its own.
const registry = buildContentRegistry();
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });

interface TableOptions {
  hp?: Record<string, number>;
  // A seat's [Main, Deputy, revealed?]. Default: Cao Cao and Dong Zhuo (male,
  // no skills), revealed.
  generals?: Record<string, [string, string, boolean?]>;
  flags?: Record<string, boolean>;
}

// Four seats round the table (Wei, Shu, Wu, Qun) at 4/4 HP; seat-a's Play
// phase. `cards` fills zones by id ('drawPile': top first).
function table(cards: Record<string, CardInstance[]> = {}, o: TableOptions = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => {
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['cao-cao', 'dong-zhuo'];
      return {
        id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], eliminated: false,
        generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: deputy, revealed } },
        combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: 4,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      };
    }),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], ...(o.flags ? { flags: o.flags } : {}) }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
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

const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const play = (s: GameState, cardInstanceId: string, ...targets: string[]) => act(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: targets.map(seat) });
const pass = (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id });
const respond = (s: GameState, cardInstanceId: string) =>
  act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId });
const choose = (s: GameState, optionId: string) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId });
const use = (s: GameState) => choose(s, 'use');
const decline = (s: GameState) => choose(s, 'decline');
const select = (s: GameState, ...ids: string[]) => act(s, { kind: 'SelectAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id, ids });
const cancel = (s: GameState) => act(s, { kind: 'CancelSelectionAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id });
const run = (s: GameState, queue: QueueItem[]) => advanceToDecision({ ...s, resolutionQueue: queue }, ctx).state;
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
const ids = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
// The ability a pending ask is about, if any.
const askedAbout = (s: GameState) => (s.pendingChoice?.reason.kind === 'ability' ? s.pendingChoice.reason.abilityId : null);
const abilityLog = (s: GameState) => s.log.filter((e) => e.kind === 'AbilityUsedEvent');

describe('Black Shield', () => {
  const shield = card('bs', 'black-shield', 'club', 2);

  it('a black Sha has no effect on its wearer, but still counts and still spends Wine', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha', 'spade')], 'seat-b:equip': [shield] }, { flags: { wine: true } }), 's1', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.turn.flags).toBeUndefined();
    expect(abilityLog(s)).toEqual([
      { kind: 'AbilityUsedEvent', owner: { kind: 'equipment', seatId: 'seat-b', cardInstanceId: 'bs' }, abilityId: 'black-shield', outcome: 'no-effect', targetSeatId: 'seat-a' },
    ]);
  });

  it('a red Sha still asks for a Shan', () => {
    expect(play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart')], 'seat-b:equip': [shield] }), 's1', 'seat-b').pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('a Sha with no colour still affects its wearer', () => {
    const s = run(table({ 'seat-b:equip': [shield] }), [cardStep('sha-targeted', { as: 'sha', colour: 'none', physical: [] }, 'seat-a', seat('seat-b'))]);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('is turned off by the attacker’s Black Pommel', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [shield] }), 's1', 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });
});

describe('Wood Armor', () => {
  const armor = card('wa', 'wood-armor', 'spade', 2);

  it('a Sha of any colour has no effect on its wearer', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart')], 'seat-b:equip': [armor] }), 's1', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'wood-armor', outcome: 'no-effect', targetSeatId: 'seat-a' }]);
  });

  it('is turned off by the attacker’s Black Pommel', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [armor] }), 's1', 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('Barbarians and Hail of Arrows skip its wearer: no window and no Wuxie check for it', () => {
    // Turn order from seat-a: b (skipped), c, d. c holds a Wuxie: it is asked about c, never b.
    const s = play(table({ 'seat-a:hand': [card('h', 'hail-of-arrows')], 'seat-b:equip': [armor], 'seat-c:hand': [card('w', 'wuxie')] }), 'h');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', reason: { kind: 'wuxie', target: seat('seat-c') } });
    const barbarians = play(table({ 'seat-a:hand': [card('b', 'barbarians')], 'seat-b:equip': [armor] }), 'b');
    expect(barbarians.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' });
  });
});

describe('Eight Trigrams', () => {
  const trigrams = card('et', 'eight-trigrams', 'spade', 2);
  const attack = (judged: CardInstance, more: Record<string, CardInstance[]> = {}) =>
    play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:equip': [trigrams], drawPile: [judged], ...more }), 's1', 'seat-b');

  it('asks its wearer when a Shan is needed', () => {
    const s = attack(card('j', 'peach', 'heart', 9));
    expect(askedAbout(s)).toBe('eight-trigrams');
    expect(s.pendingChoice!.seatId).toBe('seat-b');
  });

  it('a red judgment counts as a Shan: dodged, with no card from the hand', () => {
    const s = use(attack(card('j', 'peach', 'heart', 9), { 'seat-b:hand': [card('d1', 'shan')] }));
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(ids(s, 'seat-b:hand')).toEqual(['d1']);
    expect(s.log.find((e) => e.kind === 'JudgmentEvent')).toMatchObject({ seatId: 'seat-b', tool: { as: 'eight-trigrams' }, card: { instanceId: 'j' } });
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'eight-trigrams', outcome: 'counts-as-shan' }]);
  });

  it('a black judgment: the Shan window opens as normal, the judged card already discarded (Review Focus 4)', () => {
    const s = use(attack(card('j', 'peach', 'club', 9)));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(ids(s, 'discardPile')).toContain('j');
    expect(ids(s, 'processing')).toEqual([]);
    expect(hp(pass(s), 'seat-b')).toBe(3);
  });

  it('Don’t: the window opens with no judgment, and it isn’t asked again', () => {
    const s = decline(attack(card('j', 'peach', 'heart', 9)));
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    expect(s.log.some((e) => e.kind === 'JudgmentEvent')).toBe(false);
  });

  it('answers Hail of Arrows too', () => {
    let s = play(table({ 'seat-a:hand': [card('h', 'hail-of-arrows')], 'seat-b:equip': [trigrams], drawPile: [card('j', 'peach', 'diamond', 3)] }), 'h');
    expect(askedAbout(s)).toBe('eight-trigrams');
    s = use(s);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' }); // seat-b is covered; on to seat-c
  });

  it('is turned off against a Sha by Black Pommel, so it isn’t asked', () => {
    const s = play(
      table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [trigrams], drawPile: [card('j', 'peach', 'heart', 9)] }),
      's1',
      'seat-b'
    );
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });
});
