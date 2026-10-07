import { advanceToDecision, resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { Action, } from './actions';
import { CardInstance, GameState, PendingResponse } from '../domain/types';
import { Effect } from './effects';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
// 'ward' answers a window; 'mend' heals its target when played.
const ward: CardDefinition = { id: 'ward', name: 'Ward', category: 'basic', legalPlayTargets: () => [], play: () => [] };
const mend: CardDefinition = { id: 'mend', name: 'Mend', category: 'basic', legalPlayTargets: () => [[{ kind: 'seat', seatId: 'b' }]], play: (_s, ctx) => (ctx.respondingTo ? [] : [{ kind: 'HealEffect', target: ctx.targets[0], amount: 1 }]) };
const nay: CardDefinition = { id: 'nay', name: 'Nay', category: 'tool', legalPlayTargets: () => [], play: () => [] };
// Trick: any hand card as a Ward or a Mend, decided later by the skill's own step.
const trick: SkillDefinition = {
  id: 'trick',
  conversions: [
    { id: 'as-ward', as: 'ward', cards: 1, when: 'respond', deferred: true },
    { id: 'as-mend', as: 'mend', cards: 1, when: 'play', deferred: true },
  ],
  onStep: (state, step) => {
    const data = step.data as { as: string; targets: { kind: 'seat'; seatId: string }[]; picked: string[]; window?: PendingResponse };
    const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === data.picked[0])!;
    // Logs what it was handed, so a test can tell the step decided (not an immediate use).
    return [
      { kind: 'AbilityUsedEffect', owner: step.owner, abilityId: 'trick', outcome: `decided:${data.as}:${data.picked[0]}:${data.window?.id ?? 'play'}` },
      { kind: 'UseCardEffect', seatId: step.owner.seatId, card: { as: data.as, colour: 'none', physical: [card] }, targets: data.targets, counted: !data.window, ...(data.window ? { answering: data.window } : {}) },
    ];
  },
};
// Nay-er: any hand card as a Nay, at once.
const nayer: SkillDefinition = { id: 'nayer', conversions: [{ id: 'as-nay', as: 'nay', cards: 1, when: 'respond' }] };
const registry: ContentRegistry = {
  cards: new Map([['ward', ward], ['mend', mend], ['nay', nay]]),
  generals: new Map([['g', { id: 'g', kingdom: 'Qun', maxHp: 4, skills: [trick] }], ['n', { id: 'n', kingdom: 'Qun', maxHp: 4, skills: [nayer] }], ['v', { id: 'v', kingdom: 'Qun', maxHp: 4, skills: [] }]]),
};
const ctx = { registry, mode };
const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'junk', suit: 'club', rank: 2 });

function table(bGeneral = 'g'): GameState {
  const seat = (id: string, index: number, general: string) => ({
    id, index, kingdom: 'Qun' as const, eliminated: false, combinedHp: 3, maxCombinedHp: 4,
    generals: { main: { generalDefinitionId: general, revealed: true }, deputy: { generalDefinitionId: 'v', revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0, 'g'), seat('b', 1, bGeneral)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('a1')] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [card('b1')] }, { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] }, { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
const convert = (s: GameState, seatId: string, conversionId: string) =>
  resolve(s, getLegalActions(s, seatId, registry).find((a): a is Extract<Action, { kind: 'UseConversionAction' }> => a.kind === 'UseConversionAction' && a.via.conversionId === conversionId)!, ctx).state;
const select = (s: GameState, id: string) => resolve(s, { kind: 'SelectAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id, ids: [id] }, ctx).state;

describe('a deferred conversion', () => {
  it('in the Play Phase: the skill’s step decides, and its use counts as a play', () => {
    const s = select(convert(table(), 'a', 'as-mend'), 'a1');
    expect(s.log.find((e) => e.kind === 'AbilityUsedEvent')).toMatchObject({ outcome: 'decided:mend:a1:play' });
    expect(s.seats[1].combinedHp).toBe(4);
    expect(s.turn.cardPlays).toEqual({ mend: 1 });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'a', card: { as: 'mend' }, targets: [{ kind: 'seat', seatId: 'b' }] });
  });

  it('answering: the window is set aside while the skill decides, then answered', () => {
    const window: Effect = {
      kind: 'OpenResponseEffect',
      pendingResponse: { id: 'w', respondingSeatId: 'b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['ward'], context: { effect: { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'b' }, amount: 1, nature: 'normal' } } } },
    };
    const open = advanceToDecision({ ...table(), resolutionQueue: [window] }, ctx).state;
    const selecting = convert(open, 'b', 'as-ward');
    expect(selecting.pendingResponse?.id).toBe('w');
    const answered = select(selecting, 'b1');
    expect(answered.log.find((e) => e.kind === 'AbilityUsedEvent')).toMatchObject({ outcome: 'decided:ward:b1:w' });
    expect(answered.pendingResponse).toBeNull();
    expect(answered.seats[1].combinedHp).toBe(3); // the damage was answered
    expect(answered.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'b', card: { as: 'ward' } });
    expect(answered.turn.cardPlays).toBeUndefined();
  });
});

describe('a Wuxie check', () => {
  it('asks a seat with no counter card that can make one by conversion', () => {
    const check: Effect = { kind: 'WuxieCheckEffect', subject: { kind: 'tool', tool: { as: 'mend', colour: 'none', physical: [] }, userSeatId: 'a', target: { kind: 'seat', seatId: 'b' } }, order: ['b'], counterCardIds: ['nay'] };
    expect(advanceToDecision({ ...table('n'), resolutionQueue: [check] }, ctx).state.pendingResponse?.respondingSeatId).toBe('b');
    expect(advanceToDecision({ ...table('v'), resolutionQueue: [check] }, ctx).state.pendingResponse).toBeNull();
  });
});
