import { withFillers } from '../../generals/fillers.testing';
import { advanceToDecision, getLegalActions, resolve } from 'engine';
import type { Action, CardInstance, GameModeDefinition, GameState, QueueItem } from 'engine';
import { buildContentRegistry } from '../../registry';
import { cardStep } from '../../shared/steps';

// The real cards and Generals; a mode with no triggers of its own.
const registry = withFillers(buildContentRegistry());
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });

interface TableOptions {
  hp?: Record<string, number>;
  // A seat's [Main, Deputy, revealed?]. Default: Xu Huang and Dong Zhuo (male,
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
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['filler-xu-huang', 'filler-dong-zhuo'];
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


describe('Trident Glaive', () => {
  const glaive = card('tg', 'trident-glaive', 'diamond', 12);
  const wearer = { 'seat-a:equip': [glaive] };
  const hitWith = (more: Record<string, CardInstance[]> = {}, o: TableOptions = {}) =>
    pass(play(table({ 'seat-a:hand': [card('s1', 'sha'), card('x1', 'peach')], ...wearer, ...more }, o), 's1', 'seat-b'));
  const options = (s: GameState) => s.pendingChoice!.options.map((o) => o.id);

  it('is a range-3 weapon in the registry', () => {
    expect(registry.cards.get('trident-glaive')).toMatchObject({ equipSlot: 'weapon', weaponRange: 3 });
  });

  it('asks after the Slash damages, and Use discards a hand card, then a neighbour of the target takes 1 damage', () => {
    let s = hitWith();
    expect(hp(s, 'seat-b')).toBe(3);
    expect(askedAbout(s)).toBe('trident-glaive');
    s = use(s);
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', of: 'cards', eligibleIds: ['x1'], min: 1, max: 1 });
    s = select(s, 'x1');
    expect(ids(s, 'discardPile')).toContain('x1');
    expect(options(s)).toEqual(['seat-a', 'seat-c']);
    s = choose(s, 'seat-c');
    expect(hp(s, 'seat-c')).toBe(3);
    expect(hp(s, 'seat-a')).toBe(4);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent').at(-1)).toMatchObject({ damage: { source: { seatId: 'seat-a' }, target: { seatId: 'seat-c' }, amount: 1, nature: 'normal' } });
  });

  it('the wearer may choose themselves: 1 damage with themselves as the source', () => {
    const s = choose(select(use(hitWith()), 'x1'), 'seat-a');
    expect(hp(s, 'seat-a')).toBe(3);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent').at(-1)).toMatchObject({ damage: { source: { seatId: 'seat-a' }, target: { seatId: 'seat-a' } } });
  });

  it('never lists the target itself', () => {
    const s = select(use(hitWith()), 'x1');
    expect(options(s)).not.toContain('seat-b');
  });

  it('leaves out an eliminated seat, and counts the seats that close up as neighbours', () => {
    const t = table({ 'seat-a:hand': [card('s1', 'sha'), card('x1', 'peach')], ...wearer });
    const dead: GameState = { ...t, seats: t.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) };
    const s = select(use(pass(play(dead, 's1', 'seat-b'))), 'x1');
    expect(options(s)).toEqual(['seat-a', 'seat-d']);
  });

  it('Don’t leaves everything unchanged', () => {
    const s = decline(hitWith());
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingSelection).toBeUndefined();
    expect(ids(s, 'seat-a:hand')).toEqual(['x1']);
    expect(hp(s, 'seat-b')).toBe(3);
    expect(hp(s, 'seat-c')).toBe(4);
  });

  it('is not offered with an empty hand', () => {
    const s = pass(play(table({ 'seat-a:hand': [card('s1', 'sha')], ...wearer }), 's1', 'seat-b'));
    expect(s.pendingChoice).toBeUndefined();
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('is not offered when the Slash kills the target', () => {
    const s = hitWith({}, { hp: { 'seat-b': 1 } });
    expect(askedAbout(s)).not.toBe('trident-glaive');
    expect(hp(s, 'seat-c')).toBe(4);
  });

  it('is not offered for Duel damage', () => {
    let s = play(table({ 'seat-a:hand': [card('d1', 'duel'), card('x1', 'peach')], ...wearer }), 'd1', 'seat-b');
    s = pass(s);
    expect(hp(s, 'seat-b')).toBe(3);
    expect(askedAbout(s)).not.toBe('trident-glaive');
    expect(s.pendingChoice).toBeUndefined();
  });

  it('is not offered to another seat’s Slash, nor when the Slash is dodged', () => {
    const dodged = respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha'), card('x1', 'peach')], 'seat-b:hand': [card('d', 'shan')], ...wearer }), 's1', 'seat-b'),
      'd'
    );
    expect(dodged.pendingChoice).toBeUndefined();
    const other = pass(play(table({ 'seat-a:hand': [card('s2', 'sha'), card('y', 'peach')], 'seat-c:equip': [glaive] }), 's2', 'seat-b'));
    expect(other.pendingChoice).toBeUndefined();
  });
});
