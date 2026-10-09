import type { Action, CardDefinition, CardZone, DecisionReason, EquipSlot, PendingArrangement, PendingChoice, PendingSelection, ContentRegistry, GameState, GeneralDefinition, Kingdom, Seat } from 'engine';
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
    card('wine', 'basic'), ['serpent-spear', { id: 'serpent-spear', name: 'serpent-spear', category: 'equipment', equipSlot: 'weapon', play: () => [], abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' }] } }], card('capture', 'tool'), card('starvation', 'tool'), card('lightning', 'tool'), card('gender-swords', 'equipment', 'weapon'),
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
  pendingSelection?: PendingSelection;
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
    ...(o.pendingSelection ? { pendingSelection: o.pendingSelection } : {}),
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

describe('selections', () => {
  const sel = (over: Partial<PendingSelection> = {}): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'eq-0' }, abilityId: 'unknown' },
    of: 'cards', eligibleIds: ['p1', 's1', 'x1'], min: 2, max: 2, then: { kind: 'discard' }, ...over,
  });
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const hand = [{ instanceId: 'p1', definitionId: 'peach' }, { instanceId: 's1', definitionId: 'sha' }, { instanceId: 'x1', definitionId: 'duel' }];

  it('cancels an unknown ability’s selection when it can', () => {
    expect(ruleBasedPolicy.decide(view({ hand, pendingSelection: sel({ onCancel: [] }) }), 'seat-0', [template, cancel], registry, null).action).toEqual(cancel);
  });

  it('otherwise picks the least useful eligible cards', () => {
    const { action } = ruleBasedPolicy.decide(view({ hand, pendingSelection: sel() }), 'seat-0', [template], registry, null);
    expect(action).toEqual({ ...template, ids: ['x1', 's1'] });
  });
});

describe('optional abilities', () => {
  const ask = (abilityId: string, targetSeatId?: string): PendingChoice => ({
    id: 'ask', seatId: 'seat-0', verb: 'use',
    reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'eq-0' }, abilityId, ...(targetSeatId ? { targetSeatId } : {}) },
    options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
  });
  const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));
  // seat-1 is an ally (Wei, revealed); seat-2 is not.
  const seats = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 6), seat('seat-2', 2, 'hidden', 3)];
  const answer = (choice: PendingChoice, zones: CardZone[] = []) => {
    const action = ruleBasedPolicy.decide(view({ seats, pendingChoice: choice, zones }), 'seat-0', asked, registry, null).action;
    return action.kind === 'ChooseOptionAction' ? action.optionId : action.kind;
  };

  it('always uses Eight Trigrams, Longbow, Gender Swords and Green Dragon Blade', () => {
    for (const id of ['eight-trigrams', 'longbow', 'gender-swords', 'green-dragon-blade']) {
      expect(answer(ask(id, 'seat-1'))).toBe('use');
    }
  });

  it('uses Axe only against a non-ally', () => {
    expect(answer(ask('axe', 'seat-2'))).toBe('use');
    expect(answer(ask('axe', 'seat-1'))).toBe('decline');
  });

  it('uses Ice Sword only on a non-ally above 1 HP who wears equipment', () => {
    const worn = (seatId: string): CardZone => ({ id: `${seatId}:equip`, kind: 'equip', ownerSeatId: seatId, cards: [{ instanceId: 'w', definitionId: 'blade', suit: 'club', rank: 2 }] });
    expect(answer(ask('ice-sword', 'seat-2'), [worn('seat-2')])).toBe('use');
    expect(answer(ask('ice-sword', 'seat-2'))).toBe('decline'); // wears nothing
    expect(answer(ask('ice-sword', 'seat-1'), [worn('seat-1')])).toBe('decline'); // an ally
    const lowSeats = [seats[0], seats[1], seat('seat-2', 2, 'hidden', 1)];
    const low = ruleBasedPolicy.decide(view({ seats: lowSeats, pendingChoice: ask('ice-sword', 'seat-2'), zones: [worn('seat-2')] }), 'seat-0', asked, registry, null).action;
    expect(low).toMatchObject({ optionId: 'decline' }); // at 1 HP the damage would do more
  });

  it('declines an ability it has no rule for', () => {
    expect(answer(ask('something-new', 'seat-2'))).toBe('decline');
  });

  it('as Gender Swords’ target: discards its least useful card when holding more than 2, else lets them draw', () => {
    const choiceFor = (hand: string[]): PendingChoice => ({
      id: 'gs', seatId: 'seat-0', verb: 'discard',
      reason: { kind: 'choice', card: { as: 'gender-swords', colour: 'black', physical: [] }, userSeatId: 'seat-2', targetSeatId: 'seat-0' },
      options: [
        ...hand.map((id) => ({ id, shows: { kind: 'card' as const, card: { instanceId: id, definitionId: id.split('-')[0], suit: 'spade' as const, rank: 1 } }, effects: [] })),
        { id: 'decline', shows: { kind: 'decline' }, effects: [] },
      ],
    });
    const pick = (hand: string[]) => {
      const legal: Action[] = [...hand, 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'gs', optionId }));
      const cards = hand.map((id) => ({ instanceId: id, definitionId: id.split('-')[0] }));
      return ruleBasedPolicy.decide(view({ hand: cards, pendingChoice: choiceFor(hand) }), 'seat-0', legal, registry, null).action;
    };
    expect(pick(['peach-1', 'duel-1', 'sha-1'])).toMatchObject({ optionId: 'duel-1' });
    expect(pick(['peach-1', 'duel-1'])).toMatchObject({ optionId: 'decline' });
  });
});

describe('ability selections', () => {
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const sel = (abilityId: string, over: Partial<PendingSelection> = {}): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'eq-0' }, abilityId },
    of: 'cards', eligibleIds: [], min: 2, max: 2, then: { kind: 'discard' }, onCancel: [], ...over,
  });

  it('Axe: discards the 2 least useful cards', () => {
    const hand = [{ instanceId: 'p1', definitionId: 'peach' }, { instanceId: 's1', definitionId: 'sha' }, { instanceId: 'x1', definitionId: 'duel' }];
    const { action } = ruleBasedPolicy.decide(view({ hand, pendingSelection: sel('axe', { eligibleIds: ['p1', 's1', 'x1'] }) }), 'seat-0', [template, cancel], registry, null);
    expect(action).toEqual({ ...template, ids: ['x1', 's1'] });
  });

  it('a seat selection: only non-allies; with none, cancels', () => {
    const seats = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 6), seat('seat-2', 2, 'hidden', 3)];
    const seatSel = (eligibleIds: string[]) => sel('sky-scorcher', { of: 'seats', eligibleIds, min: 1, max: 2, then: { kind: 'card-step', step: { kind: 'CardStepEffect', step: 'sha-use', card: { as: 'sha', colour: 'black', physical: [] }, userSeatId: 'seat-0', target: { kind: 'seat', seatId: 'seat-2' } } } });
    expect(ruleBasedPolicy.decide(view({ seats, pendingSelection: seatSel(['seat-1', 'seat-2']) }), 'seat-0', [template, cancel], registry, null).action).toEqual({ ...template, ids: ['seat-2'] });
    expect(ruleBasedPolicy.decide(view({ seats, pendingSelection: seatSel(['seat-1']) }), 'seat-0', [template, cancel], registry, null).action).toEqual(cancel);
  });
});

describe('Serpent Spear', () => {
  const via = { owner: { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'eq-0' }, conversionId: 'serpent-spear' };
  const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
  const convertAnswer: Action = { kind: 'UseConversionAction', seatId: 'seat-0', via, targets: [], pendingResponseId: 'r1' };
  const barbarians: DecisionReason = { kind: 'card-effect', card: { as: 'barbarians', colour: 'black', physical: [] }, userSeatId: 'seat-2' };

  it('answers with 2 cards only with no real answer, and not when a Peach would go', () => {
    const cheap = [{ instanceId: 'x1', definitionId: 'duel' }, { instanceId: 'x2', definitionId: 'draw-two' }];
    expect(ruleBasedPolicy.decide(view({ hand: cheap, equip: ['serpent-spear'], pendingFor: 'seat-0', pendingReason: barbarians }), 'seat-0', [pass, convertAnswer], registry, null).action).toEqual(convertAnswer);
    const dear = [{ instanceId: 'p1', definitionId: 'peach' }, { instanceId: 'x1', definitionId: 'duel' }];
    expect(ruleBasedPolicy.decide(view({ hand: dear, equip: ['serpent-spear'], pendingFor: 'seat-0', pendingReason: barbarians }), 'seat-0', [pass, convertAnswer], registry, null).action).toEqual(pass);
    const realSha: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 's1' };
    const withSha = [...cheap, { instanceId: 's1', definitionId: 'sha' }];
    expect(ruleBasedPolicy.decide(view({ hand: withSha, equip: ['serpent-spear'], pendingFor: 'seat-0', pendingReason: barbarians }), 'seat-0', [pass, realSha, convertAnswer], registry, null).action).toEqual(realSha);
  });

  it('in the Play Phase, converts only with no real Sha, at the weakest non-ally', () => {
    const cheap = [{ instanceId: 'x1', definitionId: 'duel' }, { instanceId: 'x2', definitionId: 'wuxie' }];
    const at = (seatId: string): Action => ({ kind: 'UseConversionAction', seatId: 'seat-0', via, targets: [{ kind: 'seat', seatId }] });
    expect(ruleBasedPolicy.decide(view({ hand: cheap, equip: ['serpent-spear'] }), 'seat-0', [end, at('seat-1'), at('seat-2')], registry, null).action).toEqual(at('seat-2'));
  });
});

describe('reveal to use', () => {
  // An ask from the bot's own hidden Main General. 'eight-trigrams' is an id the bot always wants to use.
  const revealAsk: PendingChoice = {
    id: 'ask', seatId: 'seat-0', verb: 'use',
    reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'eight-trigrams' }, abilityId: 'eight-trigrams' },
    options: [{ id: 'use', shows: { kind: 'use', reveals: 'main' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
  };
  const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));
  const answer = (me: Seat) => {
    const action = ruleBasedPolicy.decide(view({ seats: [me, seat('seat-1', 1, 'hidden', 6)], pendingChoice: revealAsk }), 'seat-0', asked, registry, null).action;
    return action.kind === 'ChooseOptionAction' ? action.optionId : action.kind;
  };

  it('reveals with 4 HP or more', () => {
    expect(answer(seat('seat-0', 0, 'Wei', 4))).toBe('use');
  });

  it('keeps hidden below 4 HP while both Generals are hidden', () => {
    expect(answer(seat('seat-0', 0, 'Wei', 3))).toBe('decline');
  });

  it('reveals below 4 HP once its kingdom is known (a General already revealed)', () => {
    const shown = seat('seat-0', 0, 'Wei', 3);
    expect(answer({ ...shown, generals: { ...shown.generals!, deputy: { ...shown.generals!.deputy, revealed: true } } })).toBe('use');
  });
});

describe('arranging the draw pile', () => {
  it('keeps Peach, Shan and Sha on top and sends the rest to the bottom', () => {
    const arrangement: PendingArrangement = {
      id: 'arr', seatId: 'seat-0', cardInstanceIds: ['a1', 'a2', 'a3', 'a4'],
      reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'astrology' }, abilityId: 'astrology' },
    };
    const pile: CardZone = {
      id: 'drawPile', kind: 'drawPile',
      cards: [
        { instanceId: 'a1', definitionId: 'duel', suit: 'spade', rank: 1 },
        { instanceId: 'a2', definitionId: 'shan', suit: 'heart', rank: 2 },
        { instanceId: 'a3', definitionId: 'lion', suit: 'club', rank: 3 },
        { instanceId: 'a4', definitionId: 'peach', suit: 'heart', rank: 4 },
      ],
    };
    const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
    const s = { ...view({ zones: [pile] }), pendingArrangement: arrangement };
    expect(ruleBasedPolicy.decide(s, 'seat-0', [template], registry, null).action).toEqual({ ...template, top: ['a2', 'a4'], bottom: ['a1', 'a3'] });
  });
});
