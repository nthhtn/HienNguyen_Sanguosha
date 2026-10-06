import type { Action, CardDefinition, CardZone, DecisionReason, EquipSlot, PendingChoice, ContentRegistry, GameState, GeneralDefinition, Kingdom, Seat } from 'engine';
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
    card('duel', 'tool'), card('wuxie', 'tool'), card('blade', 'equipment', 'weapon'), card('blade-2', 'equipment', 'weapon'), card('lion', 'equipment', 'armor'),
    card('draw-two', 'tool'), card('barbarians', 'tool'), card('hail-of-arrows', 'tool'), card('peach-garden', 'tool'),
    card('steal', 'tool'), card('break', 'tool'), card('coerce', 'tool'), card('harvest', 'tool'),
    card('wine', 'basic'), card('capture', 'tool'), card('starvation', 'tool'), card('lightning', 'tool'),
  ]),
};

function seat(id: string, index: number, kingdom: Kingdom, combinedHp = 4, eliminated = false): Seat {
  return {
    id, index, kingdom, combinedHp, maxCombinedHp: 8, eliminated,
    generals: { main: { generalDefinitionId: 'w1', revealed: false }, deputy: { generalDefinitionId: 'w2', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  };
}

interface ViewOptions {
  phase?: GameState['phase'];
  seats?: Seat[];
  hand?: { instanceId: string; definitionId: string }[];
  equip?: string[];
  pendingFor?: string;
  turnNumber?: number;
  pendingReason?: DecisionReason;
  pendingChoice?: PendingChoice;
  // More zones, e.g. another seat's equipment or the processing zone.
  zones?: CardZone[];
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
      ...(o.zones ?? []),
    ],
    pendingResponse: o.pendingFor
      ? { id: 'r1', respondingSeatId: o.pendingFor, allowedActionKinds: ['RespondAction', 'PassAction'], ...(o.pendingReason ? { reason: o.pendingReason } : {}), context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-0' }, amount: 1 } } }
      : null,
    ...(o.pendingChoice ? { pendingChoice: o.pendingChoice } : {}),
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
const discard = (instanceId: string): Action => ({ kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: instanceId });
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

  it('spends a Peach in a dying round only on itself or a revealed ally', () => {
    const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 'c-peach' };
    const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
    const dyingRound = (dyingSeatId: string, seats: Seat[]): GameState => {
      const v = view({ pendingFor: 'seat-0', seats });
      return { ...v, pendingResponse: { ...v.pendingResponse!, allowedCardIds: ['peach'], reason: { kind: 'dying', seatId: dyingSeatId } } };
    };
    const seats = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 0), seat('seat-2', 2, 'Shu', 0), seat('seat-3', 3, 'hidden', 0)];
    expect(decide(dyingRound('seat-0', [seat('seat-0', 0, 'Wei', 0), ...seats.slice(1)]), [pass, respond]).action).toBe(respond);
    expect(decide(dyingRound('seat-1', seats), [pass, respond]).action).toBe(respond); // revealed ally
    expect(decide(dyingRound('seat-2', seats), [pass, respond]).action).toBe(pass); // enemy
    expect(decide(dyingRound('seat-3', seats), [pass, respond]).action).toBe(pass); // unknown
  });

  describe('in the Discard phase', () => {
    const hand = (...ids: [string, string][]) => ids.map(([instanceId, definitionId]) => ({ instanceId, definitionId }));

    it('discards a tool before equipment, Sha, Shan or Peach', () => {
      const h = hand(['p', 'peach'], ['s', 'sha'], ['d', 'duel'], ['e', 'shan'], ['b', 'blade']);
      const legal = h.map((c) => discard(c.instanceId));
      expect(decide(view({ phase: 'Discard', hand: h }), legal).action).toEqual(discard('d'));
    });

    it('keeps Peach longest, then Shan, then Sha, then equipment', () => {
      const pick = (h: { instanceId: string; definitionId: string }[]) =>
        decide(view({ phase: 'Discard', hand: h }), h.map((c) => discard(c.instanceId))).action;
      expect(pick(hand(['p', 'peach'], ['e', 'shan']))).toEqual(discard('e'));
      expect(pick(hand(['e', 'shan'], ['s', 'sha']))).toEqual(discard('s'));
      expect(pick(hand(['s', 'sha'], ['b', 'blade']))).toEqual(discard('b'));
    });

    it('breaks ties by hand order', () => {
      const h = hand(['d1', 'duel'], ['d2', 'duel']);
      expect(decide(view({ phase: 'Discard', hand: h }), h.map((c) => discard(c.instanceId))).action).toEqual(discard('d1'));
    });

    it('still discards when the per-turn safety cap is reached (Review Focus 5)', () => {
      const h = hand(['d1', 'duel'], ['p', 'peach']);
      const memory = { turnNumber: 1, shaPlayed: 0, actionsThisTurn: MAX_BOT_ACTIONS_PER_TURN };
      expect(decide(view({ phase: 'Discard', hand: h }), h.map((c) => discard(c.instanceId)), memory).action).toEqual(discard('d1'));
    });
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

  it('plays a Sha at the lowest-HP non-ally whenever the engine offers one, never untargeted (Crossbow repeats)', () => {
    const hand = [{ instanceId: 'c-sha', definitionId: 'sha' }];
    const legal = [play('c-sha'), play('c-sha', 'seat-1'), play('c-sha', 'seat-2'), end];
    const first = decide(view({ hand }), legal);
    expect(first.action).toBe(legal[2]); // seat-2 has 3 HP, seat-1 has 6
    expect(decide(view({ hand }), legal, first.memory).action).toBe(legal[2]);
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

  it('duels a non-ally once the engine offers no Sha', () => {
    const hand = [{ instanceId: 'c-duel', definitionId: 'duel' }];
    const legal = [play('c-duel', 'seat-1'), end];
    expect(decide(view({ hand }), legal).action).toBe(legal[0]);
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

describe('ruleBasedPolicy: Tools and Wuxie Kongjie', () => {
  const respond = (id: string): Action => ({ kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: id });
  const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
  const tool = (as: string) => ({ as, colour: 'black' as const, physical: [] });
  const wuxieOn = (as: string, targetSeatId: string) =>
    view({ pendingFor: 'seat-0', hand: [{ instanceId: 'wx', definitionId: 'wuxie' }], pendingReason: { kind: 'wuxie', tool: tool(as), toolUserSeatId: 'seat-1', target: { kind: 'seat', seatId: targetSeatId } } });

  it('cancels a harmful Tool aimed at itself', () => {
    expect(decide(wuxieOn('barbarians', 'seat-0'), [respond('wx'), pass]).action).toEqual(respond('wx'));
  });

  it('lets a Tool aimed at someone else, or a harmless one, through', () => {
    expect(decide(wuxieOn('barbarians', 'seat-2'), [respond('wx'), pass]).action).toEqual(pass);
    expect(decide(wuxieOn('draw-two', 'seat-0'), [respond('wx'), pass]).action).toEqual(pass);
  });

  it('never counters a Wuxie Kongjie', () => {
    const v = view({ pendingFor: 'seat-0', hand: [{ instanceId: 'wx', definitionId: 'wuxie' }], pendingReason: { kind: 'counter-wuxie', wuxieSeatId: 'seat-1' } });
    expect(decide(v, [respond('wx'), pass]).action).toEqual(pass);
  });

  it('answers a Barbarians window with a Sha', () => {
    const v = view({ pendingFor: 'seat-0', hand: [{ instanceId: 's', definitionId: 'sha' }], pendingReason: { kind: 'card-effect', card: tool('barbarians'), userSeatId: 'seat-1' } });
    expect(decide(v, [respond('s'), pass]).action).toEqual(respond('s'));
  });

  it('plays Draw Two before attacking', () => {
    const v = view({ hand: [{ instanceId: 'dt', definitionId: 'draw-two' }, { instanceId: 's', definitionId: 'sha' }] });
    expect(decide(v, [play('dt'), play('s', 'seat-1'), end]).action).toEqual(play('dt'));
  });

  it('plays Barbarians when non-allies are at least as many as allies, and not when allies outnumber them', () => {
    const v = view({ hand: [{ instanceId: 'b', definitionId: 'barbarians' }] });
    expect(decide(v, [play('b'), end]).action).toEqual(play('b'));
    const allied = view({
      hand: [{ instanceId: 'b', definitionId: 'barbarians' }],
      seats: [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 6), seat('seat-2', 2, 'Wei', 3), seat('seat-3', 3, 'hidden', 4)],
    });
    expect(decide(allied, [play('b'), end]).action).toEqual(end);
  });

  it('plays Peach Garden only when hurt', () => {
    const hurt = view({ hand: [{ instanceId: 'pg', definitionId: 'peach-garden' }] }); // seat-0 is at 8/8 by default
    expect(decide(hurt, [play('pg'), end]).action).toEqual(end);
    const v = view({ hand: [{ instanceId: 'pg', definitionId: 'peach-garden' }], seats: [seat('seat-0', 0, 'Wei', 5), seat('seat-1', 1, 'hidden', 6)] });
    expect(decide(v, [play('pg'), end]).action).toEqual(play('pg'));
  });
});

describe('ruleBasedPolicy: picks, Steal, Break and Coerce', () => {
  const pick = (optionId: string): Action => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c1', optionId });
  const faceUp = (instanceId: string, definitionId: string) => ({ instanceId, definitionId, suit: 'spade' as const, rank: 1 });
  const choiceOf = (options: PendingChoice['options']): PendingChoice => ({
    id: 'c1', seatId: 'seat-0', verb: 'take', options,
    reason: { kind: 'choice', card: { as: 'steal', colour: 'black', physical: [] }, userSeatId: 'seat-0', targetSeatId: 'seat-1' },
  });

  it('takes a weapon before armour, and armour before the hand', () => {
    const options: PendingChoice['options'] = [
      { id: 'hand', shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 2 }, effects: [] },
      { id: 'l', shows: { kind: 'card', card: faceUp('l', 'lion') }, effects: [] },
      { id: 'b', shows: { kind: 'card', card: faceUp('b', 'blade') }, effects: [] },
    ];
    const v = view({
      pendingChoice: choiceOf(options),
      zones: [{ id: 'seat-1:equip', kind: 'equip', ownerSeatId: 'seat-1', cards: [faceUp('l', 'lion'), faceUp('b', 'blade')] }],
    });
    expect(decide(v, ['hand', 'l', 'b'].map(pick)).action).toEqual(pick('b'));
    expect(decide(v, ['hand', 'l'].map(pick)).action).toEqual(pick('l'));
  });

  it('takes the Harvest card worth keeping most', () => {
    const options: PendingChoice['options'] = [
      { id: 's', shows: { kind: 'card', card: faceUp('s', 'sha') }, effects: [] },
      { id: 'p', shows: { kind: 'card', card: faceUp('p', 'peach') }, effects: [] },
    ];
    const v = view({ pendingChoice: choiceOf(options), zones: [{ id: 'processing', kind: 'processing', cards: [faceUp('s', 'sha'), faceUp('p', 'peach')] }] });
    expect(decide(v, ['s', 'p'].map(pick)).action).toEqual(pick('p'));
  });

  it('Steals from the lowest-HP non-ally, preferring one that wears equipment', () => {
    // seat-2 (3 HP) wears nothing; seat-1 (6 HP) wears a blade.
    const armed = view({ hand: [{ instanceId: 'st', definitionId: 'steal' }], zones: [{ id: 'seat-1:equip', kind: 'equip', ownerSeatId: 'seat-1', cards: [faceUp('b', 'blade')] }] });
    expect(decide(armed, [play('st', 'seat-1'), play('st', 'seat-2'), end]).action).toEqual(play('st', 'seat-1'));
    const bare = view({ hand: [{ instanceId: 'st', definitionId: 'steal' }] });
    expect(decide(bare, [play('st', 'seat-1'), play('st', 'seat-2'), end]).action).toEqual(play('st', 'seat-2'));
  });

  it('Coerces only when a non-ally’s weapon can reach another non-ally', () => {
    const pair = (holder: string, victim: string): Action => ({
      kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'co', targets: [{ kind: 'seat', seatId: holder }, { kind: 'seat', seatId: victim }],
    });
    const v = view({ hand: [{ instanceId: 'co', definitionId: 'coerce' }] });
    expect(decide(v, [pair('seat-1', 'seat-0'), pair('seat-1', 'seat-2'), end]).action).toEqual(pair('seat-1', 'seat-2'));
    expect(decide(v, [pair('seat-1', 'seat-0'), end]).action).toEqual(end);
  });
});

describe('ruleBasedPolicy: delayed Tools', () => {
  const hand = (n: number, seatId: string) => ({
    id: `${seatId}:hand`, kind: 'hand' as const, ownerSeatId: seatId,
    cards: Array.from({ length: n }, (_, i) => ({ instanceId: `${seatId}-h${i}`, definitionId: 'hidden', suit: 'spade' as const, rank: 0 })),
  });

  it('places Capture on the highest-HP non-ally', () => {
    // seat-1 has 6 HP, seat-2 has 3.
    const v = view({ hand: [{ instanceId: 'cap', definitionId: 'capture' }] });
    expect(decide(v, [play('cap', 'seat-1'), play('cap', 'seat-2'), end]).action).toEqual(play('cap', 'seat-1'));
  });

  it('places Starvation on the non-ally in reach with the most hand cards', () => {
    const v = view({ hand: [{ instanceId: 'st', definitionId: 'starvation' }], zones: [hand(1, 'seat-1'), hand(3, 'seat-2')] });
    expect(decide(v, [play('st', 'seat-1'), play('st', 'seat-2'), end]).action).toEqual(play('st', 'seat-2'));
  });

  it('plays Lightning only at 3 HP or more', () => {
    const at = (hp: number) => view({ seats: [seat('seat-0', 0, 'Wei', hp), seat('seat-1', 1, 'hidden', 6)], hand: [{ instanceId: 'L', definitionId: 'lightning' }] });
    expect(decide(at(3), [play('L'), end]).action).toEqual(play('L'));
    expect(decide(at(2), [play('L'), end]).action).toEqual(end);
  });

  it('cancels a Starvation judged on itself', () => {
    const v = view({
      pendingFor: 'seat-0', hand: [{ instanceId: 'wx', definitionId: 'wuxie' }],
      pendingReason: { kind: 'wuxie', tool: { as: 'starvation', colour: 'black', physical: [] }, toolUserSeatId: 'seat-0', target: { kind: 'seat', seatId: 'seat-0' } },
    });
    const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 'wx' };
    const passIt: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
    expect(decide(v, [respond, passIt]).action).toEqual(respond);
  });
});

describe('ruleBasedPolicy: Wine', () => {
  it('drinks Wine first when a Sha at a non-ally is legal, then plays the Sha', () => {
    const hand = [{ instanceId: 'w', definitionId: 'wine' }, { instanceId: 's', definitionId: 'sha' }];
    expect(decide(view({ hand }), [play('w'), play('s', 'seat-1'), end]).action).toEqual(play('w'));
    expect(decide(view({ hand: [hand[1]] }), [play('s', 'seat-1'), end]).action).toEqual(play('s', 'seat-1'));
  });

  it('keeps its Wine when no Sha at a non-ally is legal', () => {
    const hand = [{ instanceId: 'w', definitionId: 'wine' }];
    expect(decide(view({ hand }), [play('w'), end]).action).toEqual(end);
  });

  it('discards equipment before Wine', () => {
    const hand = [{ instanceId: 'w', definitionId: 'wine' }, { instanceId: 'b', definitionId: 'blade' }];
    expect(decide(view({ phase: 'Discard', hand }), [discard('w'), discard('b')]).action).toEqual(discard('b'));
  });

  it('dying, saves itself with a Peach before a Wine', () => {
    const reason = { kind: 'dying' as const, seatId: 'seat-0' };
    const respond = (id: string): Action => ({ kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: id });
    const passIt: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
    const both = view({ pendingFor: 'seat-0', pendingReason: reason, hand: [{ instanceId: 'w', definitionId: 'wine' }, { instanceId: 'p', definitionId: 'peach' }] });
    expect(decide(both, [respond('w'), respond('p'), passIt]).action).toEqual(respond('p'));
    const wineOnly = view({ pendingFor: 'seat-0', pendingReason: reason, hand: [{ instanceId: 'w', definitionId: 'wine' }] });
    expect(decide(wineOnly, [respond('w'), passIt]).action).toEqual(respond('w'));
  });
});
