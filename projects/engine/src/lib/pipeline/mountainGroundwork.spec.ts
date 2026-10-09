import { advanceToDecision } from './resolve';
import { skillsInPlay } from '../skills/generalSkills';
import { gatherTriggeredSkills } from '../skills/triggers';
import { advancePhaseOrTurn } from '../rules/phaseSequence';
import { conversionCards } from '../rules/legality';
import { redactStateForSeat } from '../domain/redact';
import { findSkill } from '../registry/lookup';
import type { ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import type { GameState } from '../domain/types';
import type { Effect } from './effects';

const stub: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const card = (instanceId: string, definitionId = 'x') => ({ instanceId, definitionId, suit: 'spade' as const, rank: 7 });

const plain: SkillDefinition = { id: 'plain' };
const quiet: SkillDefinition = { id: 'quiet', compulsory: true };
const lordly: SkillDefinition = { id: 'lordly', lord: true };
const parting: SkillDefinition = {
  id: 'parting', compulsory: true, afterDeath: true,
  triggers: [{ point: 'after:SeatEliminatedEvent', condition: () => true, effect: () => [] }],
};
const living: SkillDefinition = { id: 'living', compulsory: true, triggers: [{ point: 'after:SeatEliminatedEvent', condition: () => true, effect: () => [] }] };
const registry: ContentRegistry = {
  cards: new Map([['x', { id: 'x', name: 'X', category: 'basic', legalPlayTargets: () => [[]], play: () => [] }]]),
  generals: new Map([
    ['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [plain] }],
    ['h', { id: 'h', kingdom: 'Shu', maxHp: 3, gender: 'female', skills: [quiet, lordly, parting, living] }],
  ]),
};

function table(over: Partial<GameState> = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, eliminated: false,
    generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, stash: { zoneId: `${id}:stash` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1), seat('c', 2)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...['a', 'b', 'c'].flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'a' ? [card('h1')] : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:stash`, kind: 'pile' as const, ownerSeatId: id, cards: id === 'a' ? [card('f1'), card('f2')] : [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...over,
  };
}
const withSeat = (s: GameState, id: string, patch: object): GameState => ({ ...s, seats: s.seats.map((x) => (x.id === id ? { ...x, ...patch } : x)) });
const run = (s: GameState, ...effects: Effect[]) => advanceToDecision({ ...s, resolutionQueue: effects }, { registry, mode: stub }).state;
const ids = (s: GameState, owner: string) => skillsInPlay(s, owner, registry).map((x) => `${x.owner.slot}:${x.skill.id}`);

describe('skill lookup', () => {
  it('finds a skill by id across Generals', () => {
    expect(findSkill(registry, 'quiet')).toBe(quiet);
    expect(findSkill(registry, 'nope')).toBeUndefined();
  });
});

describe('gained skills', () => {
  it('GainSkillEffect adds the skill under the gaining slot, once, and logs it', () => {
    let s = run(table(), { kind: 'GainSkillEffect', seatId: 'a', slot: 'deputy', skillId: 'quiet' });
    s = run(s, { kind: 'GainSkillEffect', seatId: 'a', slot: 'deputy', skillId: 'quiet' });
    expect(s.seats[0].gainedSkills).toEqual([{ slot: 'deputy', skillId: 'quiet' }]);
    expect(ids(s, 'a')).toEqual(['main:plain', 'deputy:plain', 'deputy:quiet']);
    expect(s.log.filter((e) => e.kind === 'SkillGainedEvent')).toHaveLength(1);
  });

  it('a gained compulsory skill is off while its slot is hidden; a gained Lord skill is never in play', () => {
    const hidden = withSeat(table(), 'a', { gainedSkills: [{ slot: 'main', skillId: 'quiet' }, { slot: 'main', skillId: 'lordly' }], generals: { main: { generalDefinitionId: 'g', revealed: false }, deputy: { generalDefinitionId: 'g', revealed: true } } });
    expect(ids(hidden, 'a')).toEqual(['main:plain', 'deputy:plain']);
    const shown = withSeat(table(), 'a', { gainedSkills: [{ slot: 'main', skillId: 'quiet' }, { slot: 'main', skillId: 'lordly' }] });
    expect(ids(shown, 'a')).toEqual(['main:plain', 'deputy:plain', 'main:quiet']);
  });
});

describe('silenced seats', () => {
  it('SilenceSeatEffect leaves the seat with no skills at all, gained ones included', () => {
    const s = run(withSeat(table(), 'b', { gainedSkills: [{ slot: 'main', skillId: 'quiet' }] }), { kind: 'SilenceSeatEffect', seatId: 'b' });
    expect(s.seats[1].silenced).toBe(true);
    expect(ids(s, 'b')).toEqual([]);
    expect(ids(s, 'a')).toHaveLength(2);
    expect(s.log).toContainEqual({ kind: 'SeatSilencedEvent', seatId: 'b' });
  });
});

describe('spare Generals (Forms)', () => {
  const pool = (s: GameState, spare: string[]) => ({ ...s, spareGenerals: spare });

  it('DealSpareGeneralsEffect moves the first ids of the pool to the seat, and logs nothing', () => {
    const s = run(pool(table(), ['g', 'h', 'g2']), { kind: 'DealSpareGeneralsEffect', seatId: 'a', slot: 'main', count: 2 });
    expect(s.seats[0].forms).toEqual({ slot: 'main', held: ['g', 'h'] });
    expect(s.spareGenerals).toEqual(['g2']);
    expect(s.log).toEqual([]);
  });

  it('deals only what the pool holds, and nothing from an empty pool', () => {
    let s = run(pool(table(), ['g']), { kind: 'DealSpareGeneralsEffect', seatId: 'a', slot: 'main', count: 3 });
    expect(s.seats[0].forms?.held).toEqual(['g']);
    s = run(s, { kind: 'DealSpareGeneralsEffect', seatId: 'a', slot: 'main', count: 1 });
    expect(s.seats[0].forms?.held).toEqual(['g']);
  });

  it('a Form deals on top of what is held, keeping the chosen skill', () => {
    const base = withSeat(pool(table(), ['h']), 'a', { forms: { slot: 'main', held: ['g'], chosen: { generalId: 'g', skillId: 'plain' } } });
    const s = run(base, { kind: 'DealSpareGeneralsEffect', seatId: 'a', slot: 'main', count: 1 });
    expect(s.seats[0].forms).toEqual({ slot: 'main', held: ['g', 'h'], chosen: { generalId: 'g', skillId: 'plain' } });
  });

  it('ChooseFormSkillEffect picks the skill, logs it, and puts it in play under the holding slot', () => {
    const base = withSeat(table(), 'a', { forms: { slot: 'deputy', held: ['h'] } });
    const s = run(base, { kind: 'ChooseFormSkillEffect', seatId: 'a', generalId: 'h', skillId: 'quiet' });
    expect(s.seats[0].forms?.chosen).toEqual({ generalId: 'h', skillId: 'quiet' });
    expect(ids(s, 'a')).toEqual(['main:plain', 'deputy:plain', 'deputy:quiet']);
    expect(s.log).toContainEqual({ kind: 'FormChosenEvent', seatId: 'a', generalId: 'h', skillId: 'quiet' });
  });
});

describe('afterDeath skills', () => {
  const dead = (s: GameState) => withSeat(s, 'b', { eliminated: true, generals: { main: { generalDefinitionId: 'h', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } } });
  const gathered = (s: GameState, seatId: string) =>
    gatherTriggeredSkills(s, registry, stub, 'after:SeatEliminatedEvent', { kind: 'SeatEliminatedEvent', seatId }).map((t) => (t.owner as { seatId: string; skillId: string }).skillId);

  it('an afterDeath skill is gathered for its own seat’s elimination, and only that', () => {
    const s = dead(table());
    expect(gathered(s, 'b')).toEqual(['parting']);
    expect(gathered(s, 'c')).toEqual([]);
  });

  it('a living seat’s ordinary trigger is still gathered, and a dead seat’s ordinary trigger is not', () => {
    const s = withSeat(dead(table()), 'c', { generals: { main: { generalDefinitionId: 'h', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } } });
    // seat c (alive) holds it too: its own trigger is gathered as for any living seat.
    expect(gathered(s, 'b').sort()).toEqual(['living', 'parting', 'parting']);
  });
});

describe('the killer', () => {
  it('a dying round carries killerSeatId to the elimination event', () => {
    const s = withSeat(table(), 'b', { combinedHp: 0 });
    const out = run(s, { kind: 'DyingEffect', seatId: 'b', order: [], rescueCardIds: { any: ['peach'], self: [] }, entering: true, killerSeatId: 'a' });
    expect(out.seats[1].eliminated).toBe(true);
    expect(out.log).toContainEqual({ kind: 'SeatEliminatedEvent', seatId: 'b', killerSeatId: 'a' });
  });

  it('with no killer the event names none', () => {
    const out = run(withSeat(table(), 'b', { combinedHp: 0 }), { kind: 'DyingEffect', seatId: 'b', order: [], rescueCardIds: { any: ['peach'], self: [] }, entering: true });
    expect(out.log).toContainEqual({ kind: 'SeatEliminatedEvent', seatId: 'b' });
  });
});

describe('extra turns', () => {
  it('GrantExtraTurnEffect queues the seat; after its turn play resumes after the grantor', () => {
    const s = run(table(), { kind: 'GrantExtraTurnEffect', seatId: 'c', resumeAfterSeatId: 'a' });
    expect(s.turn.extraTurnStack).toEqual(['c']);
    const extra = advancePhaseOrTurn({ ...s, phase: 'End' });
    expect(extra.turn).toMatchObject({ ownerSeatId: 'c', extraTurnStack: [], resumeAfterSeatId: 'a' });
    const after = advancePhaseOrTurn({ ...s, phase: 'End', turn: extra.turn });
    expect(after.turn.ownerSeatId).toBe('b');
    expect(after.turn.resumeAfterSeatId).toBeUndefined();
  });

  it('with no extra turns the order is as before', () => {
    expect(advancePhaseOrTurn({ ...table(), phase: 'End' }).turn.ownerSeatId).toBe('b');
  });
});

describe('Conversion.from stash', () => {
  it('offers only the stash cards, never the hand', () => {
    const conversion = { id: 'c', as: 'x', cards: 1 as const, from: 'stash' as const, when: 'play' as const };
    expect(conversionCards(table(), 'a', conversion, registry).map((c) => c.instanceId)).toEqual(['f1', 'f2']);
  });
});

describe('redaction', () => {
  it('hides other seats’ spare Generals (entirely while the holder is hidden), the pool, and a secret choice’s options; the owner sees its own', () => {
    const s: GameState = {
      ...withSeat(table(), 'a', { forms: { slot: 'main', held: ['g', 'h'], chosen: { generalId: 'h', skillId: 'quiet' } } }),
      spareGenerals: ['g'],
      pendingChoice: { id: 'c', seatId: 'a', verb: 'pick', secret: true, reason: { kind: 'ability', owner: { kind: 'general', seatId: 'a', slot: 'main', skillId: 'quiet' }, abilityId: 'quiet' }, options: [{ id: 'o', shows: { kind: 'label', text: 'Secret' }, effects: [] }] },
    };
    const other = redactStateForSeat(s, 'b');
    expect(other.seats[0].forms).toEqual({ slot: 'main', held: ['hidden', 'hidden'], chosen: { generalId: 'h', skillId: 'quiet' } });
    expect(other.spareGenerals).toEqual([]);
    expect(other.pendingChoice?.options).toEqual([]);
    const hiddenHolder = withSeat(s, 'a', { generals: { main: { generalDefinitionId: 'g', revealed: false }, deputy: { generalDefinitionId: 'g', revealed: true } } });
    expect(redactStateForSeat(hiddenHolder, 'b').seats[0].forms).toBeUndefined();
    const mine = redactStateForSeat(s, 'a');
    expect(mine.seats[0].forms?.held).toEqual(['g', 'h']);
    expect(mine.pendingChoice?.options).toHaveLength(1);
    expect(mine.spareGenerals).toEqual([]);
  });
});
