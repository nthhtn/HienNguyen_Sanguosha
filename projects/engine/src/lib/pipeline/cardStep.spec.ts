import { advanceToDecision, previewEffect, resolve } from './resolve';
import { Effect } from './effects';
import { createRng } from '../rng/rng';
import { usedCardOf } from '../domain/usedCard';
import { AbilityOwner, CardInstance, GameState, QueueItem } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillTrigger } from '../registry/types';

type Step = Extract<Effect, { kind: 'CardStepEffect' }>;

const bolt: CardInstance = { instanceId: 'bolt-1', definitionId: 'bolt', suit: 'heart', rank: 3 };
const charm: CardInstance = { instanceId: 'charm-1', definitionId: 'charm', suit: 'spade', rank: 1 };
const charmOwner: AbilityOwner = { kind: 'equipment', seatId: 'b', cardInstanceId: 'charm-1' };
const step = (name: string, data: Record<string, unknown> = {}): Step => ({
  kind: 'CardStepEffect', step: name, card: usedCardOf(bolt), userSeatId: 'a', target: { kind: 'seat', seatId: 'b' }, data,
});

// Bolt: 'aim' leads to 'strike'; 'strike' deals 1 damage, plus data.extra, to the target.
const boltCard: CardDefinition = {
  id: 'bolt', name: 'Bolt', category: 'basic', play: () => [],
  onStep: (_state, s) =>
    s.step === 'aim'
      ? [{ ...s, step: 'strike' }]
      : [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: s.userSeatId }, target: s.target, amount: 1 + Number(s.data?.['extra'] ?? 0), nature: 'normal' } }],
};
const plainCard: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };

// Seat b wears a charm whose abilities are `triggers`.
function ctxWith(triggers: SkillTrigger[] = [], more: CardDefinition[] = []) {
  const charmCard: CardDefinition = { id: 'charm', name: 'Charm', category: 'equipment', equipSlot: 'armor', play: () => [], abilities: { triggers } };
  const registry: ContentRegistry = { cards: new Map([boltCard, plainCard, charmCard, ...more].map((c) => [c.id, c])), generals: new Map() };
  const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
  return { registry, mode };
}
const atStrike = (
  effect: SkillTrigger['effect'],
  condition: SkillTrigger['condition'] = (_s, x) => (x as Step).step === 'strike'
): SkillTrigger => ({ point: 'before:CardStepEffect', condition, effect });

function table(queue: QueueItem[] = [], drawPile: CardInstance[] = []): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'none', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: drawPile },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [charm] },
    ],
    pendingResponse: null, ...(queue.length > 0 ? { resolutionQueue: queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
const hpB = (s: GameState) => s.seats[1].combinedHp;
const run = (s: GameState, ctx = ctxWith()) => advanceToDecision(s, ctx).state;
const cardsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);

describe('card steps', () => {
  it('applying a step queues what the card’s onStep says, at the front', () => {
    const next = run(table([step('aim')]));
    expect(hpB(next)).toBe(3);
    expect(next.log.map((e) => e.kind)).toEqual(['DamageDealtEvent']);
  });

  it('a before-trigger may rewrite a step', () => {
    expect(hpB(run(table([step('aim')]), ctxWith([atStrike((_s, x) => [{ ...(x as Step), data: { extra: 1 } }])])))).toBe(2);
  });

  it('a before-trigger returning nothing cancels the step', () => {
    expect(hpB(run(table([step('aim')]), ctxWith([atStrike(() => [])])))).toBe(4);
  });

  it('a card with no onStep can’t take a step', () => {
    const odd: Step = { ...step('aim'), card: usedCardOf({ ...bolt, definitionId: 'plain' }) };
    expect(() => run(table([odd]))).toThrow('Card plain has no onStep');
  });
});

describe('previewing rewrites', () => {
  it('checks each later trigger against the step as rewritten so far', () => {
    const addOne = atStrike((_s, x) => [{ ...(x as Step), data: { extra: 1 } }]);
    // Would make it 5, but only while nothing has been added yet.
    const addFive = atStrike(
      (_s, x) => [{ ...(x as Step), data: { extra: 5 } }],
      (_s, x) => (x as Step).step === 'strike' && (x as Step).data?.['extra'] === undefined
    );
    expect(previewEffect(table(), step('strike'), ctxWith([addOne, addFive]))).toMatchObject({ data: { extra: 1 } });
  });

  it('stops once a trigger turns the step into another kind of effect', () => {
    const ask = atStrike((_s, x) => [{ kind: 'AskUseEffect', owner: charmOwner, abilityId: 'charm', effects: [], otherwise: [x as Step] }]);
    const cancel = atStrike(() => []);
    expect(previewEffect(table(), step('strike'), ctxWith([ask, cancel]))).toMatchObject({ kind: 'AskUseEffect' });
  });
});

describe('asking to use an ability', () => {
  const draw: Effect = { kind: 'DrawCardsEffect', seatId: 'b', count: 1 };
  const ask = (otherwise: Effect[] = []): Effect => ({ kind: 'AskUseEffect', owner: charmOwner, abilityId: 'charm', effects: [draw], otherwise, targetSeatId: 'a' });
  const asked = (otherwise: Effect[] = []) => run(table([ask(otherwise)], [{ ...bolt, instanceId: 'd1' }]));
  const choose = (s: GameState, optionId: string) => resolve(s, { kind: 'ChooseOptionAction', seatId: 'b', choiceId: s.pendingChoice!.id, optionId }, ctxWith()).state;

  it('asks the owner’s seat, with Use and Don’t', () => {
    expect(asked().pendingChoice).toMatchObject({
      seatId: 'b',
      verb: 'use',
      reason: { kind: 'ability', owner: charmOwner, abilityId: 'charm', targetSeatId: 'a' },
      options: [{ id: 'use', shows: { kind: 'use' } }, { id: 'decline', shows: { kind: 'decline' } }],
    });
  });

  it('Use queues the ability’s effects, and the pick is logged', () => {
    const next = choose(asked(), 'use');
    expect(cardsIn(next, 'b:hand')).toEqual(['d1']);
    expect(next.log.find((e) => e.kind === 'ChoiceMadeEvent')).toMatchObject({ seatId: 'b', verb: 'use', shows: { kind: 'use' } });
  });

  it('Don’t queues what happens otherwise', () => {
    const next = choose(asked([{ kind: 'MoveCardEffect', cardInstanceId: 'charm-1', toZoneId: 'a:hand' }]), 'decline');
    expect(cardsIn(next, 'b:hand')).toEqual([]);
    expect(cardsIn(next, 'a:hand')).toEqual(['charm-1']);
  });

  it('an owner who is out isn’t asked: what happens otherwise goes ahead', () => {
    const s = table([{ ...ask([{ kind: 'MoveCardEffect', cardInstanceId: 'charm-1', toZoneId: 'a:hand' }]) }]);
    const next = run({ ...s, seats: [s.seats[0], { ...s.seats[1], eliminated: true }] });
    expect(next.pendingChoice).toBeUndefined();
    expect(cardsIn(next, 'a:hand')).toEqual(['charm-1']);
  });
});

describe('small engine pieces', () => {
  it('AbilityUsedEffect logs who used what, and to what end', () => {
    const next = run(table([{ kind: 'AbilityUsedEffect', owner: charmOwner, abilityId: 'charm', outcome: 'no-effect', targetSeatId: 'a' }]));
    expect(next.log).toEqual([{ kind: 'AbilityUsedEvent', owner: charmOwner, abilityId: 'charm', outcome: 'no-effect', targetSeatId: 'a' }]);
  });

  it('MoveCardEffect with onlyFrom moves the card only while it is still there', () => {
    expect(run(table([{ kind: 'MoveCardEffect', cardInstanceId: 'charm-1', toZoneId: 'discardPile', onlyFrom: 'processing' }])).log).toEqual([]);
    const moved = run(table([{ kind: 'MoveCardEffect', cardInstanceId: 'charm-1', toZoneId: 'a:hand', onlyFrom: 'b:equip' }]));
    expect(cardsIn(moved, 'a:hand')).toEqual(['charm-1']);
  });

  it('a judgment passes its data to the reader, and skips the judged card’s move if the reader already moved it', () => {
    const seen: unknown[] = [];
    const omen: CardDefinition = {
      id: 'omen', name: 'Omen', category: 'basic', play: () => [],
      onJudged: (_state, { judged, data }) => {
        seen.push(data);
        return [{ kind: 'MoveCardEffect', cardInstanceId: judged.instanceId, toZoneId: 'a:hand' }];
      },
    };
    const s = table([{ kind: 'JudgeEffect', seatId: 'a', reader: { kind: 'card', card: { as: 'omen', colour: 'none', physical: [] } }, data: { note: 1 } }], [{ ...bolt, instanceId: 'j1' }]);
    const next = run(s, ctxWith([], [omen]));
    expect(seen).toEqual([{ note: 1 }]);
    expect(cardsIn(next, 'a:hand')).toEqual(['j1']);
    expect(cardsIn(next, 'discardPile')).toEqual([]);
  });
});
