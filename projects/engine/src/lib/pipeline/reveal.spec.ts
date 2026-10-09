import { advanceToDecision, resolve } from './resolve';
import { Effect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner, PendingSelection } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { getLegalActions } from '../rules/legality';

// Bolt: no target; played, its user draws 1.
const bolt: CardDefinition = { id: 'bolt', name: 'Bolt', category: 'basic', legalPlayTargets: () => [[]], play: (_s, ctx) => [{ kind: 'DrawCardsEffect', seatId: ctx.seatId, count: 1 }] };
const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', legalPlayTargets: () => [], play: () => [] };
// Forge: 2 hand cards as a Bolt, in the Play Phase or to answer.
const forge: SkillDefinition = { id: 'forge', conversions: [{ id: 'forge', as: 'bolt', cards: 2, when: 'both' }] };
const hint: SkillDefinition = { id: 'hint' };
const registry: ContentRegistry = {
  cards: new Map([[bolt.id, bolt], [filler.id, filler]]),
  generals: new Map([
    ['smith', { id: 'smith', kingdom: 'Wei', maxHp: 4, skills: [forge] }],
    ['seer', { id: 'seer', kingdom: 'Wei', maxHp: 4, skills: [hint] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit: 'club', rank: 5 });
const hintOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'deputy', skillId: 'hint' };
const forgeOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'forge' };

// Seat a (turn owner, Play Phase): Main 'smith', Deputy 'seer', both hidden; holds k1, k2.
function table(queue: Effect[] = [], revealed = false): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'smith', revealed }, deputy: { generalDefinitionId: 'seer', revealed } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const s: GameState = {
    seats: [seat('a', 0), { ...seat('b', 1), generals: null }], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('k1'), card('k2')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, ...(queue.length ? { resolutionQueue: queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
  return advanceToDecision(s, ctx).state;
}
const ask: Effect = { kind: 'AskUseEffect', owner: hintOwner, abilityId: 'hint', effects: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] };
const choose = (s: GameState, optionId: string) => resolve(s, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: s.pendingChoice!.id, optionId }, ctx).state;
const kinds = (s: GameState) => s.log.map((e) => e.kind);

describe('reveal to use: asks (Review Focus 1)', () => {
  it('a hidden General’s ask says it reveals; Use reveals the General first, naming the skill', () => {
    const s = table([ask]);
    expect(s.pendingChoice!.options[0].shows).toEqual({ kind: 'use', reveals: 'deputy' });
    const used = choose(s, 'use');
    expect(used.seats[0].generals!.deputy.revealed).toBe(true);
    expect(used.log.filter((e) => e.kind !== 'ChoiceMadeEvent')).toEqual([
      { kind: 'GeneralRevealedEvent', seatId: 'a', slot: 'deputy', forAbilityId: 'hint' },
      { kind: 'CardsDrawnEvent', seatId: 'a', cardInstanceIds: ['d1'] },
    ]);
  });

  it('Don’t leaves the General hidden and logs no reveal', () => {
    const declined = choose(table([ask]), 'decline');
    expect(declined.seats[0].generals!.deputy.revealed).toBe(false);
    expect(kinds(declined)).toEqual(['ChoiceMadeEvent']);
  });

  it('a revealed General’s ask needs no reveal', () => {
    expect(table([ask], true).pendingChoice!.options[0].shows).toEqual({ kind: 'use' });
  });

  it('a paused reveal ask survives a JSON round trip', () => {
    const s = table([ask]);
    expect(choose(JSON.parse(JSON.stringify(s)), 'use')).toEqual(choose(s, 'use'));
  });
});

describe('reveal to use: conversions', () => {
  const convert = (s: GameState) => {
    const action = getLegalActions(s, 'a', registry).find((a) => a.kind === 'UseConversionAction')!;
    return resolve(s, action, ctx).state;
  };

  it('a hidden General’s conversion is offered, and reveals only when its cards are confirmed', () => {
    const opened = convert(table());
    expect(opened.seats[0].generals!.main.revealed).toBe(false);
    expect(opened.pendingSelection!.onSelect).toEqual([{ kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main', forAbilityId: 'forge' }]);
    const used = resolve(opened, { kind: 'SelectAction', seatId: 'a', selectionId: opened.pendingSelection!.id, ids: ['k1', 'k2'] }, ctx).state;
    expect(used.seats[0].generals!.main.revealed).toBe(true);
    expect(kinds(used)).toEqual(['SelectionMadeEvent', 'GeneralRevealedEvent', 'CardPlayedEvent', 'CardMovedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
    expect(used.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'bolt', via: { owner: forgeOwner, abilityId: 'forge' } } });
  });

  it('Cancel leaves the General hidden', () => {
    const opened = convert(table());
    const cancelled = resolve(opened, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: opened.pendingSelection!.id }, ctx).state;
    expect(cancelled.seats[0].generals!.main.revealed).toBe(false);
    expect(cancelled.log).toEqual([]);
  });
});

describe('onSelect', () => {
  it('runs when the picks are confirmed, before the continuation', () => {
    const selection: PendingSelection = {
      id: 'sel', seatId: 'a', reason: { kind: 'ability', owner: hintOwner, abilityId: 'hint' }, of: 'cards', eligibleIds: ['k1'], min: 1, max: 1,
      then: { kind: 'discard' }, onSelect: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }],
    };
    const s = table([{ kind: 'OpenSelectionEffect', selection }]);
    const next = resolve(s, { kind: 'SelectAction', seatId: 'a', selectionId: 'sel', ids: ['k1'] }, ctx).state;
    expect(kinds(next)).toEqual(['SelectionMadeEvent', 'CardsDrawnEvent', 'CardMovedEvent']);
  });
});
