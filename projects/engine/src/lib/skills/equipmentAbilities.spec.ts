import { gatherTriggeredSkills } from './triggers';
import { advanceToDecision } from '../pipeline/resolve';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, QueueItem } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillTrigger } from '../registry/types';

const point = 'before:DamageEffect' as const;
const always = (tag: string): SkillTrigger => ({ point, condition: () => true, effect: () => [tag] });

// A worn charm: one trigger, and on leaving the equip zone its former wearer draws 1.
const charm: CardDefinition = {
  id: 'charm', name: 'Charm', category: 'equipment', equipSlot: 'armor', play: () => [],
  abilities: {
    triggers: [{ point, condition: (_s, _x, _o, registry) => !!registry?.cards.has('charm'), effect: () => ['charm'] }],
    modifiers: { shaLimit: 3 },
  },
  onUnequip: (_state, ctx) => [{ kind: 'DrawCardsEffect', seatId: ctx.seatId, count: 1 }],
};
const plain: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };
const registry: ContentRegistry = {
  cards: new Map([[charm.id, charm], [plain.id, plain]]),
  generals: new Map([['g1', { id: 'g1', kingdom: 'Wei', maxHp: 4, skills: [{ id: 's', activation: 'auto', triggers: [always('general')] }] }]]),
};
const mode = (triggers: SkillTrigger[] = []): GameModeDefinition => ({
  id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers,
});

const card = (instanceId: string, definitionId: string): CardInstance => ({ instanceId, definitionId, suit: 'spade', rank: 5 });

function table(o: { equipA?: CardInstance[]; handA?: CardInstance[]; eliminatedA?: boolean; queue?: QueueItem[] } = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const,
    generals: { main: { generalDefinitionId: 'g1', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, eliminated: id === 'seat-a' && !!o.eliminatedA,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1', 'plain'), card('d2', 'plain')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'seat-a:hand', kind: 'hand', ownerSeatId: 'seat-a', cards: o.handA ?? [] },
      { id: 'seat-a:equip', kind: 'equip', ownerSeatId: 'seat-a', cards: o.equipA ?? [] },
      { id: 'seat-b:hand', kind: 'hand', ownerSeatId: 'seat-b', cards: [] },
      { id: 'seat-b:equip', kind: 'equip', ownerSeatId: 'seat-b', cards: [] },
    ],
    pendingResponse: null, ...(o.queue ? { resolutionQueue: o.queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('equipment abilities', () => {
  it('gathers a worn card’s triggers after the mode’s and the Generals’, with an equipment owner', () => {
    const found = gatherTriggeredSkills(table({ equipA: [card('c1', 'charm')] }), registry, mode([always('mode')]), point, {});
    expect(found.map((g) => g.owner)).toEqual([
      undefined,
      { kind: 'general', seatId: 'seat-a', slot: 'main' },
      { kind: 'general', seatId: 'seat-b', slot: 'main' },
      { kind: 'equipment', seatId: 'seat-a', cardInstanceId: 'c1' },
    ]);
  });

  it('gathers nothing from a card in hand, or from an eliminated wearer', () => {
    const owners = (s: GameState) => gatherTriggeredSkills(s, registry, mode(), point, {}).filter((g) => g.owner?.kind === 'equipment');
    expect(owners(table({ handA: [card('c1', 'charm')] }))).toEqual([]);
    expect(owners(table({ equipA: [card('c1', 'charm')], eliminatedA: true }))).toEqual([]);
  });

  it('passes the registry to a trigger’s condition', () => {
    // The charm's condition is true only when it is given the registry.
    const found = gatherTriggeredSkills(table({ equipA: [card('c1', 'charm')] }), registry, mode(), point, {});
    expect(found.some((g) => g.owner?.kind === 'equipment')).toBe(true);
  });

  it('runs onUnequip for the former wearer after a card leaves an equip zone, after the move’s after-triggers', () => {
    const drawOnMove: SkillTrigger = {
      point: 'after:CardMovedEvent', condition: () => true,
      effect: () => [{ kind: 'DrawCardsEffect', seatId: 'seat-b', count: 1 }],
    };
    const s = table({ equipA: [card('c1', 'charm')], queue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'seat-b:hand' }] });
    const next = advanceToDecision(s, { registry, mode: mode([drawOnMove]) }).state;
    expect(next.log.map((e) => e.kind)).toEqual(['CardMovedEvent', 'CardsDrawnEvent', 'CardsDrawnEvent']);
    expect(next.log[1]).toMatchObject({ kind: 'CardsDrawnEvent', seatId: 'seat-b' });
    expect(next.log[2]).toMatchObject({ kind: 'CardsDrawnEvent', seatId: 'seat-a' });
  });

  it('runs no onUnequip for a move that doesn’t leave an equip zone', () => {
    const s = table({ handA: [card('c1', 'charm')], queue: [{ kind: 'MoveCardEffect', cardInstanceId: 'c1', toZoneId: 'discardPile' }] });
    const next = advanceToDecision(s, { registry, mode: mode() }).state;
    expect(next.log.map((e) => e.kind)).toEqual(['CardMovedEvent']);
  });

  it('runs onUnequip for every worn card a zone discard moves', () => {
    const s = table({ equipA: [card('c1', 'charm'), card('c2', 'charm')], queue: [{ kind: 'DiscardZoneEffect', zoneId: 'seat-a:equip' }] });
    const next = advanceToDecision(s, { registry, mode: mode() }).state;
    expect(next.log.filter((e) => e.kind === 'CardsDrawnEvent')).toHaveLength(2);
  });
});
