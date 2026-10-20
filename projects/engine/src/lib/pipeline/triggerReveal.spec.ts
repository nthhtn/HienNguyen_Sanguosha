import { advanceToDecision, resolve } from './resolve';
import { Effect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition, SkillTrigger } from '../registry/types';

// Seat a's Deputy 'seer' holds 'hint', an optional skill whose trigger reacts to
// seat b drawing. The trigger's output is set per test.
let output: (owner: GeneralOwner) => Effect[] = () => [];
const whenBDraws = (subject: unknown) => (subject as { seatId?: string }).seatId === 'b';
const afterDraw: SkillTrigger = { point: 'after:CardsDrawnEvent', condition: (_s, subject) => whenBDraws(subject), effect: (_s, _x, owner) => output(owner as GeneralOwner) };
const beforeDraw: SkillTrigger = { point: 'before:DrawCardsEffect', condition: (_s, subject) => whenBDraws(subject), effect: (_s, _x, owner) => output(owner as GeneralOwner) };
let trigger: SkillTrigger = afterDraw;
const hint: SkillDefinition = { id: 'hint', get triggers() { return [trigger]; } };
const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', legalPlayTargets: () => [], play: () => [] };
const registry: ContentRegistry = {
  cards: new Map([[filler.id, filler]]),
  generals: new Map([
    ['plain', { id: 'plain', kingdom: 'Wei', maxHp: 4, skills: [] }],
    ['seer', { id: 'seer', kingdom: 'Wei', maxHp: 4, skills: [hint] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'filler', suit: 'club', rank: 5 });
const bDraws: Effect = { kind: 'DrawCardsEffect', seatId: 'b', count: 1 };
const aDraws: Effect = { kind: 'DrawCardsEffect', seatId: 'a', count: 1 };

// Seat a (turn owner, Play Phase): Main 'plain', Deputy 'seer' (hidden unless
// `revealed`). The queue makes seat b draw 1.
function table(revealed = false): GameState {
  const seat = (id: string, index: number, deputy: string, shown: boolean) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'plain', revealed: true }, deputy: { generalDefinitionId: deputy, revealed: shown } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const s: GameState = {
    seats: [seat('a', 0, 'seer', revealed), seat('b', 1, 'plain', true)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, resolutionQueue: [bDraws],
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
  return advanceToDecision(s, ctx).state;
}
const kinds = (s: GameState) => s.log.map((e) => e.kind);

describe('a hidden General’s triggers reveal it (S1)', () => {
  beforeEach(() => { trigger = afterDraw; });

  it('asks before a non-ask after-trigger of a hidden General; Use reveals it, then the effects run', () => {
    output = () => [aDraws];
    const s = table();
    expect(s.seats[0].generals!.deputy.revealed).toBe(false);
    expect(s.pendingChoice).toMatchObject({ seatId: 'a', verb: 'use', reason: { kind: 'ability', abilityId: 'hint' } });
    expect(s.pendingChoice!.options[0].shows).toEqual({ kind: 'use', reveals: 'deputy' });
    const used = resolve(s, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: s.pendingChoice!.id, optionId: 'use' }, ctx).state;
    expect(used.seats[0].generals!.deputy.revealed).toBe(true);
    expect(kinds(used)).toEqual(['CardsDrawnEvent', 'ChoiceMadeEvent', 'GeneralRevealedEvent', 'CardsDrawnEvent']);
    expect(used.log[2]).toEqual({ kind: 'GeneralRevealedEvent', seatId: 'a', slot: 'deputy', forAbilityId: 'hint' });
  });

  it('Don’t leaves the General hidden and nothing happens', () => {
    output = () => [aDraws];
    const s = table();
    const declined = resolve(s, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: s.pendingChoice!.id, optionId: 'decline' }, ctx).state;
    expect(declined.seats[0].generals!.deputy.revealed).toBe(false);
    expect(kinds(declined)).toEqual(['CardsDrawnEvent', 'ChoiceMadeEvent']);
  });

  it('a hidden compulsory skill is asked the same way', () => {
    output = () => [aDraws];
    const compulsory: SkillDefinition = { id: 'must', compulsory: true, triggers: [{ ...afterDraw }] };
    const reg: ContentRegistry = { ...registry, generals: new Map([...registry.generals, ['seer', { id: 'seer', kingdom: 'Wei', maxHp: 4, skills: [compulsory] }]]) };
    const s = advanceToDecision({ ...table(), pendingChoice: undefined, resolutionQueue: [bDraws] } as GameState, { registry: reg, mode }).state;
    expect(s.pendingChoice).toMatchObject({ verb: 'use', reason: { abilityId: 'must' } });
  });

  it('does not reveal twice for an ask-based trigger', () => {
    output = (owner) => [{ kind: 'AskUseEffect', owner, abilityId: owner.skillId, effects: [aDraws] }];
    const s = table();
    expect(s.seats[0].generals!.deputy.revealed).toBe(false);
    const used = resolve(s, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: s.pendingChoice!.id, optionId: 'use' }, ctx).state;
    expect(used.seats[0].generals!.deputy.revealed).toBe(true);
    expect(kinds(used).filter((k) => k === 'GeneralRevealedEvent')).toHaveLength(1);
  });

  it('does not reveal a General that is already face up', () => {
    output = () => [aDraws];
    expect(kinds(table(true))).toEqual(['CardsDrawnEvent', 'CardsDrawnEvent']);
  });

  it('throws for a before-trigger of a hidden General that returns direct effects', () => {
    trigger = beforeDraw;
    output = () => [{ kind: 'DrawCardsEffect', seatId: 'b', count: 2 }];
    expect(() => table()).toThrow('hint needs a reveal but returns direct effects from a before-trigger');
  });
});
