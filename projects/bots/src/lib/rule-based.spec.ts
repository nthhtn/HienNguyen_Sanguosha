import type { Action, CardDefinition, EquipSlot, ContentRegistry, GameState, GeneralDefinition, Kingdom, Seat } from 'engine';
import { ruleBasedPolicy } from './rule-based';
import { MAX_BOT_ACTIONS_PER_TURN } from './policy';

function general(id: string, kingdom: Kingdom, maxHp: number): [string, GeneralDefinition] {
  return [id, { id, kingdom, maxHp, skills: [] }];
}
function card(id: string, category: CardDefinition['category'], equipSlot?: EquipSlot): [string, CardDefinition] {
  return [id, { id, name: id, category, equipSlot, play: () => [] }];
}

const registry: ContentRegistry = {
  generals: new Map([general('w1', 'Wei', 4), general('w2', 'Wei', 3), general('s1', 'Shu', 4), general('s2', 'Shu', 5)]),
  cards: new Map([
    card('sha', 'basic'), card('shan', 'basic'), card('peach', 'basic'),
    card('duel', 'trick'), card('wuxie', 'trick'), card('blade', 'equipment', 'weapon'), card('blade-2', 'equipment', 'weapon'), card('lion', 'equipment', 'armor'),
  ]),
};

function seat(id: string, index: number, kingdom: Kingdom, combinedHp = 4, eliminated = false): Seat {
  return {
    id, index, kingdom, combinedHp, maxCombinedHp: 8, eliminated,
    generals: { main: { generalDefinitionId: 'w1', revealed: false }, deputy: { generalDefinitionId: 'w2', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
  };
}

interface ViewOptions {
  phase?: GameState['phase'];
  seats?: Seat[];
  hand?: { instanceId: string; definitionId: string }[];
  equip?: string[];
  pendingFor?: string;
  turnNumber?: number;
}

// seat-0 is the bot. Its own hand and equipment are visible; the rest is redacted.
function view(o: ViewOptions = {}): GameState {
  const seats = o.seats ?? [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'hidden', 6), seat('seat-2', 2, 'hidden', 3)];
  return {
    seats,
    players: [],
    turn: { turnNumber: o.turnNumber ?? 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: o.phase ?? 'Play',
    zones: [
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: (o.hand ?? []).map((c) => ({ ...c, suit: 'spade' as const, rank: 1 })) },
      { id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: (o.equip ?? []).map((d, i) => ({ instanceId: `eq-${i}`, definitionId: d, suit: 'club' as const, rank: 2 })) },
    ],
    pendingResponse: o.pendingFor
      ? { id: 'r1', respondingSeatId: o.pendingFor, allowedActionKinds: ['RespondAction', 'PassAction'], context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-0' }, amount: 1 } } }
      : null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null,
    generalSelection: null,
  };
}

const end: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
const play = (instanceId: string, target?: string): Action => ({
  kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: instanceId, targets: target ? [{ kind: 'seat', seatId: target }] : [],
});
const decide = (v: GameState, legal: Action[], memory = null as Parameters<typeof ruleBasedPolicy.decide>[4]) =>
  ruleBasedPolicy.decide(v, 'seat-0', legal, registry, memory);

describe('ruleBasedPolicy', () => {
  it('has the id "rule-based"', () => {
    expect(ruleBasedPolicy.id).toBe('rule-based');
  });

  it('throws when there is no legal action', () => {
    expect(() => decide(view(), [])).toThrow(/no legal action/);
  });

  it('picks the same-kingdom pair with the highest combined max HP, first on ties', () => {
    const choose = (mainId: string, deputyId: string): Action => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId });
    const legal = [choose('w1', 'w2'), choose('s1', 's2'), choose('s2', 's1')];
    expect(decide(view({ phase: 'GeneralSelection' }), legal).action).toBe(legal[1]);
  });

  it('responds when a response card is legal, and passes otherwise', () => {
    const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 'c-shan' };
    const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
    expect(decide(view({ pendingFor: 'seat-0' }), [pass, respond]).action).toBe(respond);
    expect(decide(view({ pendingFor: 'seat-0' }), [pass]).action).toBe(pass);
  });

  it('ends the phase outside the Play phase', () => {
    const legal = [play('c-sha', 'seat-1'), end];
    expect(decide(view({ phase: 'Draw', hand: [{ instanceId: 'c-sha', definitionId: 'sha' }] }), legal).action).toBe(end);
  });

  it('ends the phase once the per-turn safety cap is reached', () => {
    const legal = [play('c-sha', 'seat-1'), end];
    const memory = { turnNumber: 1, shaPlayed: 0, actionsThisTurn: MAX_BOT_ACTIONS_PER_TURN };
    expect(decide(view({ hand: [{ instanceId: 'c-sha', definitionId: 'sha' }] }), legal, memory).action).toBe(end);
  });

  it('plays Peach only when hurt', () => {
    const hand = [{ instanceId: 'c-peach', definitionId: 'peach' }];
    const legal = [play('c-peach'), end];
    const hurt = view({ hand, seats: [seat('seat-0', 0, 'Wei', 5), seat('seat-1', 1, 'hidden')] });
    const full = view({ hand, seats: [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'hidden')] });
    expect(decide(hurt, legal).action).toBe(legal[0]);
    expect(decide(full, legal).action).toBe(end);
  });

  it('equips equipment it does not already have', () => {
    const hand = [{ instanceId: 'c-blade', definitionId: 'blade' }];
    const legal = [play('c-blade'), end];
    expect(decide(view({ hand }), legal).action).toBe(legal[0]);
    expect(decide(view({ hand, equip: ['blade'] }), legal).action).toBe(end);
  });

  it('plays one Sha per turn, at the lowest-HP non-ally, never untargeted', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha'), play('c-sha', 'seat-1'), play('c-sha', 'seat-2'), end];
    const first = decide(view({ hand }), legal);
    expect(first.action).toBe(legal[2]); // seat-2 has 3 HP, seat-1 has 6
    expect(first.memory.shaPlayed).toBe(1);
    expect(decide(view({ hand }), legal, first.memory).action).toBe(end);
  });

  it('never targets a seat with the same revealed kingdom, but Qun has no allies', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha', 'seat-1'), end];
    const allies = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 2)];
    expect(decide(view({ hand, seats: allies }), legal).action).toBe(end);
    const qun = [seat('seat-0', 0, 'Qun', 8), seat('seat-1', 1, 'Qun', 2)];
    expect(decide(view({ hand, seats: qun }), legal).action).toBe(legal[0]);
  });

  it('ignores eliminated seats as targets', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha', 'seat-1'), play('c-sha', 'seat-2'), end];
    const seats = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'hidden', 6), seat('seat-2', 2, 'hidden', 1, true)];
    expect(decide(view({ hand, seats }), legal).action).toBe(legal[0]);
  });

  it('duels a non-ally once its Sha is spent', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }, { instanceId: 'c-duel', definitionId: 'duel' }];
    const legal = [play('c-sha', 'seat-1'), play('c-duel', 'seat-1'), end];
    const memory = { turnNumber: 1, shaPlayed: 1, actionsThisTurn: 1 };
    expect(decide(view({ hand }), legal, memory).action).toBe(legal[1]);
  });

  it('resets its turn memory on a new turn', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha', 'seat-1'), end];
    const stale = { turnNumber: 1, shaPlayed: 1, actionsThisTurn: MAX_BOT_ACTIONS_PER_TURN };
    const next = decide(view({ hand, turnNumber: 2 }), legal, stale);
    expect(next.action).toBe(legal[0]);
    expect(next.memory).toEqual({ turnNumber: 2, shaPlayed: 1, actionsThisTurn: 1 });
  });

  it('falls back to the first legal action for an action shape it does not know', () => {
    const reveal: Action = { kind: 'RevealGeneralAction', seatId: 'seat-0', slot: 'main' };
    expect(decide(view(), [reveal]).action).toBe(reveal);
  });
  it('does not equip a second weapon over the one it holds', () => {
    const hand = [{ instanceId: 'c-blade2', definitionId: 'blade-2' }];
    const legal = [play('c-blade2'), end];
    expect(decide(view({ hand, equip: ['blade'] }), legal).action).toBe(end);
  });

  it('equips armor while already holding a weapon (Review Focus 4)', () => {
    const hand = [{ instanceId: 'c-lion', definitionId: 'lion' }];
    const legal = [play('c-lion'), end];
    expect(decide(view({ hand, equip: ['blade'] }), legal).action).toBe(legal[0]);
  });
});
