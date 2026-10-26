import { redactEventsForSeat, redactStateForSeat } from './redact';
import type { EngineEvent } from '../pipeline/events';
import { createSeat, createPlayer } from './factories';
import { GameState, CardZone, ChoiceOption, PendingChoice } from './types';

function makeZones(): CardZone[] {
  return [
    {
      id: 'hand-a',
      kind: 'hand',
      ownerSeatId: 'seat-a',
      cards: [{ instanceId: 'card-1', definitionId: 'sha', suit: 'spade', rank: 7 }],
    },
    {
      id: 'hand-b',
      kind: 'hand',
      ownerSeatId: 'seat-b',
      cards: [
        { instanceId: 'card-2', definitionId: 'shan', suit: 'heart', rank: 3 },
        { instanceId: 'card-3', definitionId: 'peach', suit: 'club', rank: 9 },
      ],
    },
    {
      id: 'draw-pile',
      kind: 'drawPile',
      cards: [{ instanceId: 'card-4', definitionId: 'duel', suit: 'diamond', rank: 5 }],
    },
    {
      id: 'discard-pile',
      kind: 'discardPile',
      cards: [{ instanceId: 'card-5', definitionId: 'wuxie', suit: 'spade', rank: 2 }],
    },
    {
      id: 'equip-a',
      kind: 'equip',
      ownerSeatId: 'seat-a',
      cards: [{ instanceId: 'card-6', definitionId: 'silver-lion', suit: 'club', rank: 11 }],
    },
    { id: 'judgment-b', kind: 'judgment', ownerSeatId: 'seat-b', cards: [] },
  ];
}

function makeState(): GameState {
  const maxHp = () => 4;
  const seatA = createSeat('seat-a', 0, 'Wei', 'general-x', 'general-y', maxHp);
  const seatB = createSeat('seat-b', 1, 'Shu', 'general-z', 'general-w', maxHp);
  return {
    seats: [seatA, seatB],
    players: [createPlayer('p1', 'seat-a', 'human'), createPlayer('p2', 'seat-b', 'bot')],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: makeZones(),
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null, generalSelection: null,
  };
}

describe('redactStateForSeat', () => {
  it('hides unrevealed generals from other seats but keeps them visible to the owner', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const ownSeat = viewFromA.seats.find((s) => s.id === 'seat-a')!;
    expect(ownSeat.generals!.main.generalDefinitionId).toBe('general-x');

    const otherSeat = viewFromA.seats.find((s) => s.id === 'seat-b')!;
    expect(otherSeat.generals!.main.generalDefinitionId).toBe('hidden');
    expect(otherSeat.generals!.deputy.generalDefinitionId).toBe('hidden');
  });

  it('reveals a general to everyone once revealed is true', () => {
    const state = makeState();
    state.seats[1].generals!.main.revealed = true;
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const otherSeat = viewFromA.seats.find((s) => s.id === 'seat-b')!;
    expect(otherSeat.generals!.main.generalDefinitionId).toBe('general-z');
    expect(otherSeat.generals!.deputy.generalDefinitionId).toBe('hidden');
  });

  it("masks another seat's hand contents but preserves card count and instance ids", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const handB = viewFromA.zones.find((z) => z.id === 'hand-b')!;
    expect(handB.cards).toHaveLength(2);
    expect(handB.cards.map((c) => c.instanceId)).toEqual(['card-2', 'card-3']);
    expect(handB.cards.every((c) => c.definitionId === 'hidden')).toBe(true);
    expect(handB.cards.every((c) => c.suit === 'spade' && c.rank === 0)).toBe(true);
  });

  it('never masks the viewer\'s own hand', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    const handA = viewFromA.zones.find((z) => z.id === 'hand-a')!;
    expect(handA.cards[0].definitionId).toBe('sha');
  });

  it('masks the draw pile for every viewer, including seat-a', () => {
    const state = makeState();

    for (const viewerSeatId of ['seat-a', 'seat-b']) {
      const view = redactStateForSeat(state, viewerSeatId);
      const drawPile = view.zones.find((z) => z.id === 'draw-pile')!;
      expect(drawPile.cards[0].definitionId).toBe('hidden');
    }
  });

  it('leaves discard pile, equip zones, and judgment zones untouched', () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.zones.find((z) => z.id === 'discard-pile')!.cards[0].definitionId).toBe('wuxie');
    expect(viewFromA.zones.find((z) => z.id === 'equip-a')!.cards[0].definitionId).toBe('silver-lion');
  });

  it("masks another seat's kingdom while both generals are hidden", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-b')!.kingdom).toBe('hidden');
  });

  it('reveals a kingdom once either of that seat\'s generals is revealed', () => {
    const state = makeState();
    state.seats[1].generals!.deputy.revealed = true;
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-b')!.kingdom).toBe('Shu');
  });

  it("never masks the viewer's own kingdom", () => {
    const state = makeState();
    const viewFromA = redactStateForSeat(state, 'seat-a');

    expect(viewFromA.seats.find((s) => s.id === 'seat-a')!.kingdom).toBe('Wei');
  });
});

describe('redactStateForSeat with seats that have not chosen generals', () => {
  it('passes an unchosen seat through without masking', () => {
    const state = makeState();
    state.seats[1] = { ...state.seats[1], generals: null, kingdom: 'hidden' };
    const redacted = redactStateForSeat(state, 'seat-a');
    expect(redacted.seats[1].generals).toBeNull();
    expect(redacted.seats[1].kingdom).toBe('hidden');
  });
});

describe('redactStateForSeat: hidden cards in the queue and pending decisions (Review Focus 3)', () => {
  const secret = { instanceId: 'b-secret', definitionId: 'peach', suit: 'heart' as const, rank: 3 };
  const used = { as: 'mystery', colour: 'red' as const, physical: [secret] };
  const leaky: GameState = {
    seats: [], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [secret] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    resolutionQueue: [{ kind: 'ToolRuleEffect', tool: used, userSeatId: 'b', target: { kind: 'seat', seatId: 'b' } }],
    pendingChoice: {
      id: 'c', seatId: 'a', verb: 'take', reason: { kind: 'choice', card: used, userSeatId: 'b' },
      options: [{ id: 'x', shows: { kind: 'card', card: secret }, effects: [] }],
    },
  };

  it('masks another seat’s hand card wherever the queue or a pending choice mentions it', () => {
    const forA = redactStateForSeat(leaky, 'a');
    expect(JSON.stringify(forA.resolutionQueue)).not.toContain('"definitionId":"peach"');
    expect(forA.pendingChoice!.options[0].shows).toEqual({ kind: 'card', card: { instanceId: 'b-secret', definitionId: 'hidden', suit: 'spade', rank: 0 } });
  });

  it('leaves the card visible to its owner', () => {
    const forB = redactStateForSeat(leaky, 'b');
    expect(forB.resolutionQueue).toEqual(leaky.resolutionQueue);
    expect(forB.pendingChoice).toEqual(leaky.pendingChoice);
  });
});

describe('redactStateForSeat: a hidden General’s decision seen by another seat (final review #2)', () => {
  const owner = { kind: 'general' as const, seatId: 'b', slot: 'main' as const, skillId: 'dragon-courage' };
  const black = { instanceId: 'b-black', definitionId: 'sha', suit: 'club' as const, rank: 4 };
  const red = { instanceId: 'b-red', definitionId: 'peach', suit: 'heart' as const, rank: 3 };
  const seatOf = (id: string, mainRevealed: boolean) => ({
    id, index: id === 'a' ? 0 : 1, kingdom: 'Shu' as const, eliminated: false, combinedHp: 4, maxCombinedHp: 4,
    generals: { main: { generalDefinitionId: 'zhao-yun', revealed: mainRevealed }, deputy: { generalDefinitionId: 'x', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const state = (mainRevealed: boolean): GameState => ({
    seats: [seatOf('a', true), seatOf('b', mainRevealed)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [black, red] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    pendingSelection: {
      id: 's', seatId: 'b', reason: { kind: 'ability', owner, abilityId: 'dragon-courage' }, of: 'cards', eligibleIds: ['b-black'], min: 1, max: 1,
      then: { kind: 'use-card', as: 'shan', via: { owner, abilityId: 'dragon-courage', conversionId: 'sha-as-shan' }, targets: [], counted: false },
      onCancel: [], onSelect: [{ kind: 'RevealGeneralEffect', seatId: 'b', slot: 'main', forAbilityId: 'dragon-courage' }],
    },
  });

  it('hides which skill it is, and which hand cards it may use', () => {
    const forA = redactStateForSeat(state(false), 'a');
    expect(JSON.stringify(forA.pendingSelection)).not.toContain('dragon-courage');
    expect(JSON.stringify(forA.pendingSelection)).not.toContain('sha-as-shan');
    expect(forA.pendingSelection!.reason).toEqual({ kind: 'ability', owner: { ...owner, skillId: 'hidden' }, abilityId: 'hidden' });
    expect(forA.pendingSelection!.eligibleIds).toEqual([]);
  });

  it('shows it all to its own seat, and to others once the General is revealed', () => {
    expect(redactStateForSeat(state(false), 'b').pendingSelection).toEqual(state(false).pendingSelection);
    expect(redactStateForSeat(state(true), 'a').pendingSelection!.reason).toEqual({ kind: 'ability', owner, abilityId: 'dragon-courage' });
  });
});

describe('redactStateForSeat: skill ids inside id strings', () => {
  const ownerOf = (skillId: string) => ({ kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId });
  const build = (skillId: string, ids: { choice?: string; selection?: string; other?: string }, revealed = false): GameState => {
    const state = makeState();
    state.seats[1].generals!.main.revealed = revealed;
    const reason = { kind: 'ability', owner: ownerOf(skillId), abilityId: skillId };
    if (ids.choice) state.pendingChoice = { id: ids.choice, seatId: 'seat-b', reason, options: [] } as unknown as GameState['pendingChoice'];
    if (ids.selection) state.pendingSelection = { id: ids.selection, seatId: 'seat-b', reason, of: 'cards', eligibleIds: [], min: 1, max: 1, then: { kind: 'use-card', targets: [] }, onCancel: [], onSelect: [] } as unknown as GameState['pendingSelection'];
    if (ids.other) state.pendingArrangement = { id: ids.other, seatId: 'seat-b', cardInstanceIds: [] } as unknown as GameState['pendingArrangement'];
    return state;
  };

  it('masks a hidden skill id inside a pending choice id', () => {
    const view = redactStateForSeat(build('refusing-death', { choice: 'ask-refusing-death-seat-b-12' }), 'seat-a');
    expect(view.pendingChoice!.id).toBe('ask-hidden-seat-b-12');
  });

  it('masks it inside a pending selection id', () => {
    const view = redactStateForSeat(build('refusing-death', { selection: 'convert-refusing-death-seat-b-3' }), 'seat-a');
    expect(view.pendingSelection!.id).toBe('convert-hidden-seat-b-3');
  });

  it('leaves the owner’s own view unchanged', () => {
    const view = redactStateForSeat(build('refusing-death', { choice: 'ask-refusing-death-seat-b-12' }), 'seat-b');
    expect(view.pendingChoice!.id).toBe('ask-refusing-death-seat-b-12');
  });

  it('leaves a revealed General’s skill id visible', () => {
    const view = redactStateForSeat(build('refusing-death', { choice: 'ask-refusing-death-seat-b-12' }, true), 'seat-a');
    expect(view.pendingChoice!.id).toBe('ask-refusing-death-seat-b-12');
  });

  it('does not rewrite a skill id inside a longer word', () => {
    const view = redactStateForSeat(build('fire', { choice: 'ask-fire-seat-b-1', other: 'firewall-3' }), 'seat-a');
    expect(view.pendingChoice!.id).toBe('ask-hidden-seat-b-1');
    expect((view.pendingArrangement as unknown as { id: string }).id).toBe('firewall-3');
  });
});

describe('redactEventsForSeat', () => {
  const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'refusing-death' };
  const event = (): EngineEvent =>
    ({ kind: 'ChoiceMadeEvent', seatId: 'seat-b', reason: { kind: 'ability', owner, abilityId: 'refusing-death' }, verb: 'use', shows: 'none' }) as unknown as EngineEvent;

  it('masks a hidden General’s skill in a ChoiceMadeEvent for other seats', () => {
    const [masked] = redactEventsForSeat(makeState(), [event()], 'seat-a') as unknown as { reason: { owner: { skillId: string }; abilityId: string } }[];
    expect(masked.reason.owner.skillId).toBe('hidden');
    expect(masked.reason.abilityId).toBe('hidden');
    const [own] = redactEventsForSeat(makeState(), [event()], 'seat-b') as unknown as { reason: { owner: { skillId: string }; abilityId: string } }[];
    expect(own.reason.owner.skillId).toBe('refusing-death');
    expect(own.reason.abilityId).toBe('refusing-death');
  });

  it('does not change the events passed in', () => {
    const events = [event()];
    redactEventsForSeat(makeState(), events, 'seat-a');
    expect(events).toEqual([event()]);
  });
});

describe('redactStateForSeat: the log', () => {
  it('leaves a hidden skill id out of the whole view, log included, but not the owner’s', () => {
    const state = makeState();
    const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'refusing-death' };
    state.log = [{ kind: 'ChoiceMadeEvent', seatId: 'seat-b', reason: { kind: 'ability', owner, abilityId: 'refusing-death' }, verb: 'use', shows: 'none' } as unknown as EngineEvent];
    expect(JSON.stringify(redactStateForSeat(state, 'seat-a'))).not.toContain('refusing-death');
    expect(JSON.stringify(redactStateForSeat(state, 'seat-b'))).toContain('refusing-death');
  });
});

describe('redactStateForSeat: ability keys in `acted` lists and use counters (final-fix F1, F2)', () => {
  const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'refusing-death' };
  const dying = () => ({ kind: 'DyingEffect', seatId: 'seat-b', order: [], rescueCardIds: { any: [], self: [] }, acted: ['seat-b:main:refusing-death'] });
  const asked = () => ({ kind: 'ChoiceMadeEvent', seatId: 'seat-b', reason: { kind: 'ability', owner, abilityId: 'refusing-death' }, verb: 'use', shows: 'none' }) as unknown as EngineEvent;
  const views = (state: GameState) => [JSON.stringify(redactStateForSeat(state, 'seat-a')), JSON.stringify(redactStateForSeat(state, 'seat-b'))];

  it('masks the ask’s options, which carry the skill’s `acted` key', () => {
    const state = makeState();
    state.pendingChoice = {
      id: 'ask-refusing-death-seat-b-3', seatId: 'seat-b', reason: { kind: 'ability', owner, abilityId: 'refusing-death' }, verb: 'use',
      options: [{ id: 'use', shows: { kind: 'label', text: 'Use' }, effects: [] }, { id: 'no', shows: { kind: 'label', text: "Don't" }, effects: [dying()] }],
    } as unknown as GameState['pendingChoice'];
    const [forA, forB] = views(state);
    expect(forA).not.toContain('refusing-death');
    expect(forA).toContain('seat-b:main:hidden');
    expect(forB).toContain('seat-b:main:refusing-death');
  });

  it('masks a queued DyingEffect’s `acted` key after a declined ask (the log holds the choice)', () => {
    const state = makeState();
    state.log = [asked()];
    state.resolutionQueue = [dying()] as unknown as GameState['resolutionQueue'];
    const [forA, forB] = views(state);
    expect(forA).not.toContain('refusing-death');
    expect(forB).toContain('seat-b:main:refusing-death');
  });

  it('masks the `acted` key even when nothing else names the skill', () => {
    const state = makeState();
    state.resolutionQueue = [dying()] as unknown as GameState['resolutionQueue'];
    const [forA, forB] = views(state);
    expect(forA).not.toContain('refusing-death');
    expect(forB).toContain('seat-b:main:refusing-death');
  });

  it('masks the use counter key in a cancellable active skill’s onSelect', () => {
    const state = makeState();
    const benevolence = { ...owner, skillId: 'benevolence' };
    state.pendingSelection = {
      id: 'sel-1', seatId: 'seat-b', reason: { kind: 'ability', owner: benevolence, abilityId: 'benevolence' }, of: 'cards', eligibleIds: [], min: 1, max: 2, then: { kind: 'discard' }, onCancel: [],
      onSelect: [
        { kind: 'RevealGeneralEffect', seatId: 'seat-b', slot: 'main', forAbilityId: 'benevolence' },
        { kind: 'IncrementEffect', scope: 'turn', key: 'seat-b/main/benevolence', by: 1 },
        { kind: 'AbilityUsedEffect', owner: benevolence, abilityId: 'benevolence', outcome: 'used' },
      ],
    } as unknown as GameState['pendingSelection'];
    const [forA, forB] = views(state);
    expect(forA).not.toContain('benevolence');
    expect(forA).toContain('seat-b/main/hidden');
    expect(forB).toContain('seat-b/main/benevolence');
  });
});

describe('redactStateForSeat: card and General ids are not skill tokens (final-fix F3)', () => {
  it('leaves another seat’s Wine card intact while hidden Dong Zhuo’s Wine skill is masked', () => {
    const state = makeState();
    const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'wine' };
    state.log = [
      { kind: 'CardPlayedEvent', seatId: 'seat-a', cardInstanceId: 'card-9', definitionId: 'wine', targets: [] },
      { kind: 'SelectionMadeEvent', seatId: 'seat-b', reason: { kind: 'ability', owner, abilityId: 'wine' }, cancelled: true },
    ] as unknown as EngineEvent[];
    const log = redactStateForSeat(state, 'seat-a').log as unknown as { definitionId?: string; reason?: { abilityId: string } }[];
    expect(log[0].definitionId).toBe('wine');
    expect(log[1].reason!.abilityId).toBe('hidden');
  });
});

describe('redactStateForSeat: overlapping skill ids (final-fix F4)', () => {
  it('masks the longer of two hidden skill ids whole, not its prefix', () => {
    const state = makeState();
    const ownerOf = (slot: 'main' | 'deputy', skillId: string) => ({ kind: 'general' as const, seatId: 'seat-b', slot, skillId });
    state.log = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-b', reason: { kind: 'ability', owner: ownerOf('main', 'fire'), abilityId: 'fire' }, verb: 'use', shows: 'none' },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-b', reason: { kind: 'ability', owner: ownerOf('deputy', 'fire-attack'), abilityId: 'fire-attack' }, verb: 'use', shows: 'none' },
    ] as unknown as EngineEvent[];
    state.pendingResponse = { reason: { kind: 'ability', owner: ownerOf('main', 'fire'), abilityId: 'fire' } } as unknown as GameState['pendingResponse'];
    state.pendingChoice = { id: 'ask-fire-attack-seat-b-1', seatId: 'seat-b', reason: { kind: 'ability', owner: ownerOf('deputy', 'fire-attack'), abilityId: 'fire-attack' }, options: [] } as unknown as GameState['pendingChoice'];
    expect(redactStateForSeat(state, 'seat-a').pendingChoice!.id).toBe('ask-hidden-seat-b-1');
  });
});

describe('redactStateForSeat: turn flags named after a skill (final-fix F5)', () => {
  it('masks a hidden skill’s turn flag in the ask’s options', () => {
    const state = makeState();
    const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'decentralization' };
    state.pendingChoice = {
      id: 'ask-decentralization-seat-b-2', seatId: 'seat-b', reason: { kind: 'ability', owner, abilityId: 'decentralization' }, verb: 'use',
      options: [{ id: 'use', shows: { kind: 'label', text: 'Use' }, effects: [{ kind: 'SetTurnFlagEffect', flag: 'decentralization' }, { kind: 'SetTurnFlagEffect', flag: 'skip-Play' }] }],
    } as unknown as GameState['pendingChoice'];
    const forA = redactStateForSeat(state, 'seat-a');
    expect(JSON.stringify(forA)).not.toContain('decentralization');
    expect(forA.pendingChoice!.options[0].effects).toEqual([{ kind: 'SetTurnFlagEffect', flag: 'hidden' }, { kind: 'SetTurnFlagEffect', flag: 'skip-Play' }]);
    expect(JSON.stringify(redactStateForSeat(state, 'seat-b'))).toContain('"flag":"decentralization"');
  });
});

describe('redactStateForSeat: a give selection’s tally key (final-fix F5)', () => {
  it('masks a hidden skill inside the tally counter key', () => {
    const state = makeState();
    const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'deputy' as const, skillId: 'kindness' };
    state.pendingSelection = {
      id: 'sel-2', seatId: 'seat-b', reason: { kind: 'ability', owner, abilityId: 'kindness' }, of: 'cards', eligibleIds: [], min: 1, max: 2,
      then: { kind: 'give', toSeatIds: ['seat-a'], tally: 'seat-b/deputy/kindness/given' }, onCancel: [], onSelect: [],
    } as unknown as GameState['pendingSelection'];
    const forA = redactStateForSeat(state, 'seat-a');
    expect(JSON.stringify(forA)).not.toContain('kindness');
    expect((forA.pendingSelection!.then as { tally?: string }).tally).toBe('seat-b/deputy/hidden/given');
    expect((redactStateForSeat(state, 'seat-b').pendingSelection!.then as { tally?: string }).tally).toBe('seat-b/deputy/kindness/given');
  });
});

describe('redactStateForSeat: a judgment on show', () => {
  const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'refusing-death' };
  const judged = { instanceId: 'j1', definitionId: 'x', suit: 'club' as const, rank: 3 };
  const withView = (): GameState => ({
    ...makeState(),
    judgmentView: { seatId: 'seat-a', reader: { kind: 'skill', owner }, card: judged, changes: [{ owner, abilityId: 'refusing-death', card: judged, replaced: { ...judged, instanceId: 'j0' } }], settled: true },
  });

  it('does not reveal another seat’s hidden skill through the reader or a change', () => {
    const forA = redactStateForSeat(withView(), 'seat-a');
    expect(JSON.stringify(forA.judgmentView)).not.toContain('refusing-death');
    expect(forA.judgmentView).toMatchObject({ settled: true, card: judged });
  });

  it('shows the owner their own skill', () => {
    expect(JSON.stringify(redactStateForSeat(withView(), 'seat-b').judgmentView)).toContain('refusing-death');
  });
});


describe('redactStateForSeat: a secret look at another seat’s hand and hidden General (Review Focus 3)', () => {
  const peach = { instanceId: 'b-1', definitionId: 'peach', suit: 'heart' as const, rank: 3 };
  const duel = { instanceId: 'b-2', definitionId: 'duel', suit: 'club' as const, rank: 9 };
  const used = { as: 'mystery', colour: 'black' as const, physical: [] };
  const look = (seatId: string, shows: ChoiceOption['shows'][]): PendingChoice => ({
    id: 'look', seatId, verb: 'pick', secret: true, reason: { kind: 'choice', card: used, userSeatId: 'seat-a', targetSeatId: 'seat-b' },
    options: [...shows.map((s, i) => ({ id: `o${i}`, shows: s, effects: [] })), { id: 'done', shows: { kind: 'label', text: 'Done' }, effects: [] }],
  });
  const withC = (state: GameState): GameState => ({
    ...state,
    seats: [...state.seats, createSeat('seat-c', 2, 'Wu', 'general-c', 'general-d', () => 4)],
    zones: [...state.zones.filter((z) => z.id !== 'hand-b'), { id: 'hand-b', kind: 'hand', ownerSeatId: 'seat-b', cards: [peach, duel] }, { id: 'hand-c', kind: 'hand', ownerSeatId: 'seat-c', cards: [] }],
  });
  const lookState = withC({
    ...makeState(),
    pendingChoice: look('seat-a', [{ kind: 'card', card: peach }, { kind: 'card', card: duel }, { kind: 'general', generalId: 'general-w' }]),
  });

  it('shows its chooser the real cards and the General', () => {
    const forA = redactStateForSeat(lookState, 'seat-a');
    expect(forA.pendingChoice!.options.map((o) => o.shows)).toEqual([
      { kind: 'card', card: peach },
      { kind: 'card', card: duel },
      { kind: 'general', generalId: 'general-w' },
      { kind: 'label', text: 'Done' },
    ]);
    // The hand itself stays masked: only the look shows the cards.
    expect(forA.zones.find((z) => z.id === 'hand-b')!.cards.map((c) => c.definitionId)).toEqual(['hidden', 'hidden']);
  });

  it('shows every other seat none of it, the looked-at seat included', () => {
    for (const viewer of ['seat-b', 'seat-c']) {
      const view = redactStateForSeat(lookState, viewer);
      expect(view.pendingChoice!.options).toEqual([]);
      expect(JSON.stringify(view.pendingChoice)).not.toContain('Done');
    }
    // seat-b knows its own Generals and hand; seat-c learns none of them anywhere in its view.
    const forC = JSON.stringify(redactStateForSeat(lookState, 'seat-c'));
    expect(forC).not.toContain('general-w');
    expect(forC).not.toContain('"peach"');
    expect(forC).not.toContain('"duel"');
  });

  it('hides a queued secret choice from other seats too', () => {
    const queued: GameState = { ...lookState, pendingChoice: undefined, resolutionQueue: [{ kind: 'OpenChoiceEffect', choice: look('seat-a', [{ kind: 'general', generalId: 'general-w' }]) }] };
    const forC = redactStateForSeat(queued, 'seat-c');
    expect(JSON.stringify(forC)).not.toContain('general-w');
    expect(JSON.stringify(redactStateForSeat(queued, 'seat-a'))).toContain('general-w');
  });
});

describe('redactStateForSeat allegiance', () => {
  it('a seat with no revealed General shows no allegiance to other viewers; the owner still sees it', () => {
    const state = makeState();
    const seats = state.seats.map((s) => (s.id === 'seat-b' ? { ...s, allegiance: 'ambitionist' as const } : s));
    const withAllegiance = { ...state, seats };
    expect(redactStateForSeat(withAllegiance, 'seat-a').seats.find((s) => s.id === 'seat-b')!.allegiance).toBeUndefined();
    expect(redactStateForSeat(withAllegiance, 'seat-b').seats.find((s) => s.id === 'seat-b')!.allegiance).toBe('ambitionist');
  });
});
