import { CardInstance, CardZone, EngineEvent, UsedCard } from 'engine';
import { BATCH_GAP_MS, BeatContext, planBeat } from './beats';

const context = (kinds: Record<string, CardZone['kind']> = {}, previous?: EngineEvent): BeatContext => ({
  zoneKindOf: (zoneId) => kinds[zoneId],
  previous,
});

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'sha', suit: 'spade', rank: 7 });
const used = (as: string, ...ids: string[]): UsedCard => ({ as, colour: 'black', physical: ids.map(card) });
const played = (as: string, targets: string[], extra: Record<string, unknown> = {}): EngineEvent =>
  ({ kind: 'CardPlayedEvent', seatId: 'seat-0', card: used(as, 'c1'), targets: targets.map((seatId) => ({ kind: 'seat', seatId })), ...extra }) as EngineEvent;

describe('planBeat', () => {
  it('has a batch gap', () => expect(BATCH_GAP_MS).toBe(350));

  const rows: [string, EngineEvent, number, string][] = [
    ['TurnAdvancedEvent', { kind: 'TurnAdvancedEvent', seatId: 'seat-0', turnNumber: 1 }, 1000, 'turn'],
    ['PhaseChangedEvent', { kind: 'PhaseChangedEvent', seatId: 'seat-0', phase: 'Draw' }, 250, 'phase'],
    ['CardsDrawnEvent', { kind: 'CardsDrawnEvent', seatId: 'seat-0', cardInstanceIds: ['a', 'b'] }, 780, 'draw'],
    ['CardPlayedEvent', played('sha', ['seat-1']), 900, 'play'],
    ['ResponsePassedEvent', { kind: 'ResponsePassedEvent', seatId: 'seat-1', pendingResponseId: 'p', allowedCardIds: ['shan'] }, 700, 'pass'],
    ['DamageDealtEvent', { kind: 'DamageDealtEvent', damage: { source: null, target: { kind: 'seat', seatId: 'seat-1' }, amount: 1, nature: 'normal' } } as EngineEvent, 900, 'damage'],
    ['HpLostEvent', { kind: 'HpLostEvent', seatId: 'seat-1', amount: 1 }, 900, 'damage'],
    ['HealEvent', { kind: 'HealEvent', target: { kind: 'seat', seatId: 'seat-1' }, amount: 1 }, 800, 'heal'],
    ['SeatDyingEvent', { kind: 'SeatDyingEvent', seatId: 'seat-1' }, 900, 'dying'],
    ['SeatSavedEvent', { kind: 'SeatSavedEvent', seatId: 'seat-1' }, 300, 'saved'],
    ['GeneralRevealedEvent', { kind: 'GeneralRevealedEvent', seatId: 'seat-1', slot: 'main' }, 700, 'reveal'],
    ['SeatEliminatedEvent', { kind: 'SeatEliminatedEvent', seatId: 'seat-1' }, 1400, 'eliminated'],
    ['AbilityUsedEvent', { kind: 'AbilityUsedEvent', owner: { kind: 'general', seatId: 'seat-1', slot: 'main', skillId: 'x' }, abilityId: 'x', outcome: 'o' }, 700, 'ability'],
  ];
  it.each(rows)('%s takes %i ms', (_name, event, durationMs, visualKind) => {
    const beat = planBeat(event, 3, context());
    expect(beat.logIndex).toBe(3);
    expect(beat.durationMs).toBe(durationMs);
    expect(beat.visual?.kind).toBe(visualKind);
  });

  it('a card move takes 400 ms to a discard pile and 500 ms elsewhere', () => {
    const move = { kind: 'CardMovedEvent', cardInstanceId: 'c1', fromZoneId: 'draw', toZoneId: 'discard' } as EngineEvent;
    const toDiscard = planBeat(move, 0, context({ discard: 'discardPile', draw: 'drawPile' }));
    expect(toDiscard.durationMs).toBe(400);
    expect(toDiscard.visual?.kind).toBe('move');
    expect(planBeat(move, 0, context({ discard: 'hand', draw: 'drawPile' })).durationMs).toBe(500);
  });

  it('a hand-to-discard move straight after its play takes 0 ms', () => {
    const move = { kind: 'CardMovedEvent', cardInstanceId: 'c1', fromZoneId: 'hand', toZoneId: 'discard' } as EngineEvent;
    const beat = planBeat(move, 0, context({ hand: 'hand', discard: 'discardPile' }, played('sha', ['seat-1'])));
    expect(beat.durationMs).toBe(0);
  });

  it('an unknown event kind gets a 0 ms beat with no visual', () => {
    const beat = planBeat({ kind: 'ChainToggledEvent', seatId: 'seat-1', chained: true }, 0, context());
    expect(beat.durationMs).toBe(0);
    expect(beat.visual).toBeNull();
  });

  it('a fan-out to five targets lists them all and runs longer', () => {
    const ids = ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5'];
    const beat = planBeat(played('barbarians', ids), 0, context());
    expect(beat.durationMs).toBe(1050);
    expect(beat.visual).toMatchObject({ kind: 'play', targetSeatIds: ids, response: false });
  });

  it('a Dodge answering a Slash names the Slash user in answersSeatId', () => {
    const beat = planBeat(played('shan', [], { seatId: 'seat-1', inResponseTo: { seatId: 'seat-0' } }), 0, context());
    expect(beat.visual).toMatchObject({ kind: 'play', seatId: 'seat-1', answersSeatId: 'seat-0', response: true });
  });

  it('a Peach answers the dying seat', () => {
    const beat = planBeat(played('peach', [], { inResponseTo: { dyingSeatId: 'seat-2' } }), 0, context());
    expect(beat.visual).toMatchObject({ answersSeatId: 'seat-2', response: true });
  });

  it('a pass shows the first allowed card', () => {
    const beat = planBeat({ kind: 'ResponsePassedEvent', seatId: 'seat-1', pendingResponseId: 'p', allowedCardIds: ['shan', 'x'] }, 0, context());
    expect(beat.visual).toEqual({ kind: 'pass', seatId: 'seat-1', cardId: 'shan' });
  });
});
