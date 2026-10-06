import { advanceToDecision, getLegalActions, resolve } from 'engine';
import type { CardDefinition, CardInstance, ContentRegistry, EngineEvent, GameState, Phase } from 'engine';
import { kingdomWarMode } from '../modes/kingdomWar';
import { captureCard } from './capture';
import { starvationCard } from './starvation';
import { wuxieCard } from './wuxie';
import { breakCard } from './break';
import { lightningCard } from './lightning';

const plain = (id: string): CardDefinition => ({ id, name: id, category: 'basic', play: () => [] });
const diLu: CardDefinition = { id: 'di-lu', name: 'Di Lu', category: 'equipment', equipSlot: 'defensiveMount', play: () => [] };

const cards: CardDefinition[] = [captureCard, starvationCard, lightningCard, wuxieCard, breakCard, diLu, plain('sha'), plain('shan'), plain('peach')];
const registry: ContentRegistry = { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
// Kingdom War's own triggers: the Judgment Phase, the Draw Phase's 2 cards, and dying.
const ctx = { registry, mode: kingdomWarMode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 5): CardInstance => ({ instanceId, definitionId, suit, rank });
const filler = (n: number) => Array.from({ length: n }, (_, i) => card(`f${i}`, 'shan', 'diamond', 13));

// Seats a (Wei), b (Shu), c (Wu), all at 4 HP, each with a hand, equipment and
// judgment zone. `cards` fills zones by id; the draw pile defaults to 10 fillers.
function table(cards: Record<string, CardInstance[]> = {}, o: { owner?: string; phase?: Phase; hp?: Record<string, number> } = {}): GameState {
  const seat = (id: string, index: number, kingdom: 'Wei' | 'Shu' | 'Wu') => ({
    id, index, kingdom,
    generals: { main: { generalDefinitionId: `${id}-main`, revealed: true }, deputy: { generalDefinitionId: `${id}-deputy`, revealed: true } },
    combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: 4,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, eliminated: false,
  });
  const ids = ['seat-a', 'seat-b', 'seat-c'];
  return {
    seats: [seat('seat-a', 0, 'Wei'), seat('seat-b', 1, 'Shu'), seat('seat-c', 2, 'Wu')],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: o.owner ?? 'seat-b', extraTurnStack: [] },
    phase: o.phase ?? 'Start',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? filler(10) },
      { id: 'discardPile', kind: 'discardPile', cards: cards['discardPile'] ?? [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: cards[`${id}:judgment`] ?? [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

// From the Start phase (seat-b's by default) on to the next decision.
const run = (s: GameState) => advanceToDecision(s, ctx).state;
const respond = (s: GameState, seatId: string, cardInstanceId: string) =>
  resolve(s, { kind: 'RespondAction', seatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId }, ctx).state;
const pass = (s: GameState, seatId: string) => resolve(s, { kind: 'PassAction', seatId, pendingResponseId: s.pendingResponse!.id }, ctx).state;
const idsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
const judgments = (log: EngineEvent[]) => log.flatMap((e) => (e.kind === 'JudgmentEvent' ? [`${e.tool.as}:${e.card.instanceId}`] : []));
const skips = (log: EngineEvent[]) => log.flatMap((e) => (e.kind === 'PhaseSkippedEvent' ? [`${e.seatId}:${e.phase}`] : []));
const targetsFor = (s: GameState, cardInstanceId: string) =>
  getLegalActions(s, 'seat-a', registry).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardInstanceId ? [a.targets] : []));

describe('Capture', () => {
  it('goes on another living seat that holds no Capture yet', () => {
    const s = table({ 'seat-a:hand': [card('cap', 'capture')], 'seat-c:judgment': [card('cap-2', 'capture')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(s, 'cap')).toEqual([[{ kind: 'seat', seatId: 'seat-b' }]]);
    const next = resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'cap', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    expect(idsIn(next, 'seat-b:judgment')).toEqual(['cap']);
    expect(idsIn(next, 'discardPile')).toEqual([]);
  });

  it('anything but a heart: the seat skips its Play Phase, and Capture is discarded', () => {
    const next = run(table({ 'seat-b:judgment': [card('cap', 'capture')], drawPile: [card('j1', 'shan', 'spade', 5), ...filler(6)] }));
    expect(judgments(next.log)).toEqual(['capture:j1']);
    expect(skips(next.log)).toEqual(['seat-b:Play']);
    expect(next.turn.ownerSeatId).toBe('seat-c');
    expect(next.phase).toBe('Play');
    expect(idsIn(next, 'discardPile')).toEqual(expect.arrayContaining(['cap', 'j1']));
    expect(idsIn(next, 'seat-b:judgment')).toEqual([]);
  });

  it('a heart: the seat plays as usual, and Capture is still discarded', () => {
    const next = run(table({ 'seat-b:judgment': [card('cap', 'capture')], drawPile: [card('j1', 'shan', 'heart', 5), ...filler(6)] }));
    expect(skips(next.log)).toEqual([]);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
    expect(idsIn(next, 'discardPile').sort()).toEqual(['cap', 'j1']);
  });

  it('a Wuxie Kongjie cancels it: no judgment, and Capture is discarded', () => {
    const asked = run(table({ 'seat-b:judgment': [card('cap', 'capture')], 'seat-c:hand': [card('wx', 'wuxie')] }));
    expect(asked.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', reason: { kind: 'wuxie', toolUserSeatId: 'seat-b', target: { kind: 'seat', seatId: 'seat-b' } } });
    const next = respond(asked, 'seat-c', 'wx');
    expect(judgments(next.log)).toEqual([]);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
    expect(idsIn(next, 'discardPile')).toEqual(expect.arrayContaining(['cap', 'wx']));
  });

  it('a game paused on a judgment’s Wuxie check survives a JSON round trip', () => {
    const asked = run(table({ 'seat-b:judgment': [card('cap', 'capture')], 'seat-c:hand': [card('wx', 'wuxie')] }));
    const copy = JSON.parse(JSON.stringify(asked)) as GameState;
    expect(pass(copy, 'seat-c')).toEqual(pass(asked, 'seat-c'));
  });

  it('a Capture broken out of the judgment area is never judged (Review Focus 5)', () => {
    const s = table({ 'seat-a:hand': [card('br', 'break')], 'seat-b:judgment': [card('cap', 'capture')] }, { owner: 'seat-a', phase: 'Play' });
    const choosing = resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'br', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    const broken = resolve(choosing, { kind: 'ChooseOptionAction', seatId: 'seat-a', choiceId: choosing.pendingChoice!.id, optionId: 'cap' }, ctx).state;
    expect(idsIn(broken, 'discardPile')).toEqual(expect.arrayContaining(['cap']));
    const next = resolve(broken, { kind: 'EndPhaseAction', seatId: 'seat-a' }, ctx).state;
    expect(judgments(next.log)).toEqual([]);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
  });
});

describe('Starvation', () => {
  it('goes on another seat at distance 1 (horses count) that holds no Starvation yet', () => {
    const horse = table({ 'seat-a:hand': [card('st', 'starvation')], 'seat-c:equip': [card('dl', 'di-lu')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(horse, 'st')).toEqual([[{ kind: 'seat', seatId: 'seat-b' }]]);
    const held = table({ 'seat-a:hand': [card('st', 'starvation')], 'seat-b:judgment': [card('st-2', 'starvation')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(held, 'st')).toEqual([[{ kind: 'seat', seatId: 'seat-c' }]]);
  });

  it('anything but a club: the seat skips its Draw Phase', () => {
    const next = run(table({ 'seat-b:judgment': [card('st', 'starvation')], drawPile: [card('j1', 'shan', 'heart', 5), ...filler(6)] }));
    expect(skips(next.log)).toEqual(['seat-b:Draw']);
    expect(next.log.some((e) => e.kind === 'CardsDrawnEvent' && e.seatId === 'seat-b')).toBe(false);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
    expect(idsIn(next, 'discardPile').sort()).toEqual(['j1', 'st']);
  });

  it('a club: the seat draws as usual', () => {
    const next = run(table({ 'seat-b:judgment': [card('st', 'starvation')], drawPile: [card('j1', 'shan', 'club', 5), ...filler(6)] }));
    expect(skips(next.log)).toEqual([]);
    expect(idsIn(next, 'seat-b:hand')).toHaveLength(2);
  });
});

describe('the Judgment Phase', () => {
  it('judges a seat’s delayed Tools last in, first out; both landing skip Draw and Play, and the next turn has no flags (Review Focus 3)', () => {
    const next = run(table({
      'seat-b:judgment': [card('st', 'starvation'), card('cap', 'capture')],
      drawPile: [card('j1', 'shan', 'spade', 5), card('j2', 'shan', 'spade', 6), ...filler(6)],
    }));
    expect(judgments(next.log)).toEqual(['capture:j1', 'starvation:j2']);
    expect(skips(next.log)).toEqual(['seat-b:Draw', 'seat-b:Play']);
    expect(next.turn.ownerSeatId).toBe('seat-c');
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'seat-c:hand')).toHaveLength(2);
  });

  it('does nothing for a seat with an empty judgment area', () => {
    const next = run(table());
    expect(judgments(next.log)).toEqual([]);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
  });
});

describe('Lightning', () => {
  const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;

  it('goes in the user’s own judgment area, one per seat', () => {
    const s = table({ 'seat-a:hand': [card('L', 'lightning')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(s, 'L')).toEqual([[]]);
    const next = resolve(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'L', targets: [] }, ctx).state;
    expect(idsIn(next, 'seat-a:judgment')).toEqual(['L']);
    const held = table({ 'seat-a:hand': [card('L', 'lightning')], 'seat-a:judgment': [card('L2', 'lightning')] }, { owner: 'seat-a', phase: 'Play' });
    expect(targetsFor(held, 'L')).toEqual([]);
  });

  it('a spade from 2 to 9 deals 3 damage to its holder, with no source, and Lightning is discarded', () => {
    for (const rank of [2, 9]) {
      const next = run(table({ 'seat-b:judgment': [card('L', 'lightning', 'spade', 1)], drawPile: [card('j1', 'shan', 'spade', rank), ...filler(6)] }));
      expect(hp(next, 'seat-b')).toBe(1);
      expect(next.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({
        damage: { source: null, target: { kind: 'seat', seatId: 'seat-b' }, amount: 3, nature: 'normal' },
      });
      expect(idsIn(next, 'discardPile')).toEqual(expect.arrayContaining(['L', 'j1']));
    }
  });

  it('anything else moves it on to the next living seat that holds no Lightning', () => {
    for (const judged of [card('j1', 'shan', 'spade', 10), card('j1', 'shan', 'spade', 1), card('j1', 'shan', 'heart', 5)]) {
      const next = run(table({ 'seat-b:judgment': [card('L', 'lightning')], drawPile: [judged, ...filler(6)] }));
      expect(hp(next, 'seat-b')).toBe(4);
      expect(idsIn(next, 'seat-c:judgment')).toEqual(['L']);
      expect(next.log).toContainEqual(expect.objectContaining({ kind: 'CardMovedEvent', cardInstanceId: 'L', fromZoneId: 'seat-b:judgment', toZoneId: 'seat-c:judgment' }));
    }
  });

  it('passes over a seat that already holds a Lightning', () => {
    const next = run(table({ 'seat-b:judgment': [card('L', 'lightning')], 'seat-c:judgment': [card('L2', 'lightning')], drawPile: [card('j1', 'shan', 'heart', 5), ...filler(6)] }));
    expect(idsIn(next, 'seat-a:judgment')).toEqual(['L']);
  });

  it('stays put when every other living seat holds a Lightning (Review Focus 4)', () => {
    const next = run(table({
      'seat-a:judgment': [card('L1', 'lightning')], 'seat-b:judgment': [card('L', 'lightning')], 'seat-c:judgment': [card('L2', 'lightning')],
      drawPile: [card('j1', 'shan', 'heart', 5), ...filler(6)],
    }));
    expect(idsIn(next, 'seat-b:judgment')).toEqual(['L']);
    expect(next.turn.ownerSeatId).toBe('seat-b');
    expect(next.phase).toBe('Play');
  });

  it('a Wuxie Kongjie cancels it: no judgment, and it moves on', () => {
    const asked = run(table({ 'seat-b:judgment': [card('L', 'lightning')], 'seat-a:hand': [card('wx', 'wuxie')] }));
    const next = respond(asked, 'seat-a', 'wx');
    expect(judgments(next.log)).toEqual([]);
    expect(idsIn(next, 'seat-c:judgment')).toEqual(['L']);
  });

  it('kills its holder: eliminated, Lightning and the seat’s other delayed Tool discarded, and the next seat plays (Review Focus 1)', () => {
    const dying = run(table(
      { 'seat-b:judgment': [card('cap', 'capture'), card('L', 'lightning')], drawPile: [card('j1', 'shan', 'spade', 5), ...filler(6)] },
      { hp: { 'seat-b': 3 } }
    ));
    expect(dying.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-b' });
    const next = pass(dying, 'seat-b');
    expect(next.seats.find((s) => s.id === 'seat-b')!.eliminated).toBe(true);
    expect(judgments(next.log)).toEqual(['lightning:j1']); // Capture is never judged
    expect(idsIn(next, 'seat-b:judgment')).toEqual([]);
    expect(idsIn(next, 'discardPile')).toEqual(expect.arrayContaining(['L', 'cap', 'j1']));
    expect(next.result).toBeNull();
    expect(next.turn.ownerSeatId).toBe('seat-c');
    expect(next.phase).toBe('Play');
  });
});
