import { kingdomWarMode, kingdomWarMaxSeats, GENERALS_PER_SEAT, MAX_KINGDOM_WAR_SEATS } from './kingdomWar';
import { buildContentRegistry } from '../registry';
import { createGame, resolve, advanceToDecision, getActiveSeatId, getLegalActions, combinedMaxHp } from 'engine';
import type { GameState, CardDefinition, CardInstance, ContentRegistry, Effect } from 'engine';
import { cardsData } from '../../../data/cards';

// Skips general selection by seating fixed pairs directly, for tests about
// in-game rules that must not depend on which candidates a seed deals.
function seated(state: GameState, registry: ContentRegistry, picks: Record<string, [string, string]>): GameState {
  return {
    ...state,
    phase: 'Start',
    generalSelection: null,
    seats: state.seats.map((seat) => {
      const [mainId, deputyId] = picks[seat.id];
      const main = registry.generals.get(mainId)!;
      const deputy = registry.generals.get(deputyId)!;
      const maxCombinedHp = combinedMaxHp(main.maxHp, deputy.maxHp);
      return {
        ...seat,
        kingdom: main.kingdom,
        generals: {
          main: { generalDefinitionId: mainId, revealed: false },
          deputy: { generalDefinitionId: deputyId, revealed: false },
        },
        combinedHp: maxCombinedHp,
        maxCombinedHp,
      };
    }),
  };
}

describe('Kingdom War setup and deal', () => {
  const registry = buildContentRegistry();

  it('starts in GeneralSelection with unchosen seats, 4-card hands, and seat-a first', () => {
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 42);
    expect(state.phase).toBe('GeneralSelection');
    expect(state.turn).toEqual({ turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] });
    expect(getActiveSeatId(state)).toBe('seat-a');
    for (const seat of state.seats) {
      expect(seat.generals).toBeNull();
      expect(seat.kingdom).toBe('hidden');
      expect(seat.combinedHp).toBe(0);
      expect(seat.maxCombinedHp).toBe(0);
      expect(state.zones.find((z) => z.id === seat.hand.zoneId)!.cards).toHaveLength(4);
    }
  });

  it('deals 5 unique registry generals to every seat, each containing a same-kingdom pair', () => {
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e'], 42);
    const candidates = state.generalSelection!.candidates;
    const all = Object.values(candidates).flat();
    expect(Object.keys(candidates).sort()).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e']);
    expect(all).toHaveLength(5 * GENERALS_PER_SEAT);
    expect(new Set(all).size).toBe(all.length);
    for (const ids of Object.values(candidates)) {
      expect(ids).toHaveLength(GENERALS_PER_SEAT);
      const kingdoms = ids.map((id) => registry.generals.get(id)!.kingdom);
      expect(new Set(kingdoms).size).toBeLessThan(kingdoms.length);
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const b = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const c = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 8);
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
    expect(c.generalSelection).not.toEqual(a.generalSelection);
  });

  it('caps the table at 10 seats however large the pool grows', () => {
    const pool = (n: number) => ({ cards: new Map(), generals: new Map(Array.from({ length: n }, (_, i) => [`g${i}`, {} as never])) });
    expect(MAX_KINGDOM_WAR_SEATS).toBe(10);
    expect(kingdomWarMaxSeats(pool(14))).toBe(2);
    expect(kingdomWarMaxSeats(pool(50))).toBe(10);
    expect(kingdomWarMaxSeats(pool(57))).toBe(10);
    expect(kingdomWarMaxSeats(pool(200))).toBe(10);
  });

  it('deals every seat a full starting hand at the largest table, keeping cards in the draw pile', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `seat-${i}`);
    const state = createGame(kingdomWarMode, registry, ten, 1);
    for (const seat of state.seats) {
      expect(state.zones.find((z) => z.id === seat.hand.zoneId)!.cards).toHaveLength(4);
    }
    expect(state.zones.find((z) => z.kind === 'drawPile')!.cards.length).toBeGreaterThan(0);
  });

  it('gives each seat an empty Judgment slot', () => {
    const state = createGame(kingdomWarMode, buildContentRegistry(), ['seat-0', 'seat-1'], 1);
    expect(state.seats.map((s) => s.judgment)).toEqual([{ zoneId: 'seat-0:judgment' }, { zoneId: 'seat-1:judgment' }]);
    expect(state.zones.filter((z) => z.kind === 'judgment')).toEqual([
      { id: 'seat-0:judgment', kind: 'judgment', ownerSeatId: 'seat-0', cards: [] },
      { id: 'seat-1:judgment', kind: 'judgment', ownerSeatId: 'seat-1', cards: [] },
    ]);
  });

  it('sets up an empty processing zone for Harvest', () => {
    const state = createGame(kingdomWarMode, buildContentRegistry(), ['seat-0', 'seat-1'], 1);
    expect(state.zones.find((z) => z.kind === 'processing')).toEqual({ id: 'processing', kind: 'processing', cards: [] });
  });

  it('names each player after its seat position until the app renames it', () => {
    const state = createGame(kingdomWarMode, registry, ['a', 'b', 'c'], 1);
    expect(state.players.map((p) => [p.seatId, p.name])).toEqual([['a', 'Seat 0'], ['b', 'Seat 1'], ['c', 'Seat 2']]);
  });

  it('builds the deck from exactly each card’s printings, at every table size', () => {
    const deckOf = (n: number) =>
      createGame(kingdomWarMode, registry, Array.from({ length: n }, (_, i) => `seat-${i}`), 1)
        .zones.flatMap((z) => z.cards)
        .map((c) => `${c.definitionId} ${c.suit} ${c.rank}`)
        .sort();
    const printed = [...registry.cards.keys()]
      .flatMap((id) => cardsData[id].printings!.filter((p) => !p.expansion).map((p) => `${id} ${p.suit} ${p.rank}`))
      .sort();
    expect(deckOf(2)).toEqual(printed);
    expect(deckOf(10)).toEqual(printed);
    expect(deckOf(2).filter((c) => c.startsWith('silver-lion '))).toEqual(['silver-lion club 1']);
    // The Army and EX copies of Shan, Peach and Wuxie stay out for now.
    expect(deckOf(2).filter((c) => c.startsWith('shan '))).toHaveLength(15);
    expect(deckOf(2).filter((c) => c.startsWith('peach '))).toHaveLength(8);
    expect(deckOf(2).filter((c) => c.startsWith('wuxie '))).toHaveLength(3);
    expect(deckOf(2)).toHaveLength(118);
  });

  it('refuses to build a deck for a card with no printings', () => {
    const withUnprinted: ContentRegistry = {
      ...registry,
      cards: new Map([...registry.cards, ['unprinted', { id: 'unprinted', name: 'Unprinted', category: 'basic', play: () => [] }]]),
    };
    expect(() => createGame(kingdomWarMode, withUnprinted, ['a', 'b'], 1)).toThrow(/unprinted.*no printings/);
  });

  it('caps the table at its seat cap and rejects fewer than 2', () => {
    expect(kingdomWarMaxSeats(registry)).toBe(10);
    expect(kingdomWarMode.maxSeats!(registry)).toBe(10);
    const eleven = Array.from({ length: 11 }, (_, i) => `s${i}`);
    expect(() => createGame(kingdomWarMode, registry, eleven, 1)).toThrow(/between 2 and 10 seats/);
    expect(() => createGame(kingdomWarMode, registry, ['a'], 1)).toThrow(/between 2 and 10 seats/);
  });

  it('a full selection through resolve seats every seat with a same-kingdom pair and starts turn 1', () => {
    let state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c'], 42);
    const ctx = { registry, mode: kingdomWarMode };
    while (state.phase === 'GeneralSelection') {
      const seatId = getActiveSeatId(state)!;
      state = resolve(state, getLegalActions(state, seatId, registry)[0], ctx).state;
    }
    // Rests in turn 1's Play phase, unless the dealt table is already one kingdom and the game ended at Start.
    expect(state.phase).toBe(state.result ? 'Start' : 'Play');
    expect(state.generalSelection).toBeNull();
    for (const seat of state.seats) {
      const main = registry.generals.get(seat.generals!.main.generalDefinitionId)!;
      const deputy = registry.generals.get(seat.generals!.deputy.generalDefinitionId)!;
      expect(seat.kingdom).toBe(main.kingdom);
      expect(deputy.kingdom).toBe(main.kingdom);
      expect(seat.maxCombinedHp).toBe(Math.floor((main.maxHp + deputy.maxHp) / 2));
      expect(seat.combinedHp).toBe(seat.maxCombinedHp);
    }
  });

  it('ends the game right after selection if every seat picked the same non-Qun kingdom (Review Focus 1)', () => {
    // Pins current behavior: the existing win rule (one living non-Qun
    // kingdom) is evaluated as soon as the last seat chooses.
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 1);
    const allWei: GameState = {
      ...state,
      generalSelection: {
        candidates: {
          'seat-a': ['xu-huang', 'zhang-he', 'meng-huo', 'zhang-zhao-and-zhang-hong', 'yuan-shao'],
          'seat-b': ['xun-yu', 'cao-pi', 'meng-huo', 'sun-ce', 'jia-xu'],
        },
      },
    };
    const ctx = { registry, mode: kingdomWarMode };
    const afterA = resolve(allWei, { kind: 'ChooseGeneralsAction', seatId: 'seat-a', mainId: 'xu-huang', deputyId: 'zhang-he' }, ctx).state;
    expect(afterA.result).toBeNull();
    const afterB = resolve(afterA, { kind: 'ChooseGeneralsAction', seatId: 'seat-b', mainId: 'xun-yu', deputyId: 'cao-pi' }, ctx).state;
    expect(afterB.result).toEqual({ endedAt: 1, winningKingdom: 'Wei', winningSeatIds: ['seat-a', 'seat-b'], losingSeatIds: [] });
  });
});

describe('Kingdom War forced reveal, dying and elimination', () => {
  const hit = (amount: number): CardDefinition => ({
    id: `test-hit-${amount}`, name: `Test Hit ${amount}`, category: 'basic',
    play: (_state, ctx) => [{
      kind: 'DamageEffect',
      damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount, nature: 'normal' },
    }],
  });
  const peach = (instanceId: string) => ({ instanceId, definitionId: 'peach', suit: 'heart' as const, rank: 12 });

  // seat-a (its turn) hits seat-b with a test card of `amount` damage. Hands
  // are cleared so only the Peaches given here are in play.
  function hitSeatB(amount: number, hands: { a?: ReturnType<typeof peach>[]; b?: ReturnType<typeof peach>[] } = {}) {
    const registry = buildContentRegistry();
    const created = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    // Added after the deal: it has no printings, so it never goes in the deck.
    const card = hit(amount);
    registry.cards.set(card.id, card);
    const base = seated(created, registry, { 'seat-a': ['xu-huang', 'zhang-he'], 'seat-b': ['jiang-wei', 'meng-huo'] });
    const state: GameState = {
      ...base,
      phase: 'Play',
      zones: base.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'hit-1', definitionId: card.id, suit: 'spade' as const, rank: 1 }, ...(hands.a ?? [])] }
        : z.id === 'seat-b:hand' ? { ...z, cards: hands.b ?? [] }
        : z
      ),
    };
    const ctx = { registry, mode: kingdomWarMode };
    const next = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'hit-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    return { next, ctx, hpBefore: base.seats[1].combinedHp };
  }
  const seatB = (s: GameState) => s.seats.find((x) => x.id === 'seat-b')!;

  it('force-reveals both generals and puts the seat in the dying state instead of eliminating it', () => {
    const { next } = hitSeatB(10);
    expect(seatB(next).generals!.main.revealed).toBe(true);
    expect(seatB(next).generals!.deputy.revealed).toBe(true);
    expect(seatB(next).eliminated).toBe(false);
    expect(seatB(next).combinedHp).toBeLessThan(0);
    expect(next.log.map((e) => e.kind)).toContain('SeatDyingEvent');
    // No one else holds a Peach: the dying seat itself is asked.
    expect(next.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['peach', 'wine'], reason: { kind: 'dying', seatId: 'seat-b' } });
    expect(next.result).toBeNull();
  });

  it('eliminates the dying seat on No Response, ending the game', () => {
    const { next, ctx } = hitSeatB(10);
    const out = resolve(next, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: next.pendingResponse!.id }, ctx).state;
    expect(seatB(out).eliminated).toBe(true);
    expect(out.result).toEqual({ endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] });
  });

  it('asks the turn owner first; the dying seat can still save itself with its own Peach', () => {
    const { next, ctx, hpBefore } = hitSeatB(4, { a: [peach('pa')], b: [peach('pb')] });
    expect(seatB(next).combinedHp).toBe(hpBefore - 4);
    expect(next.pendingResponse!.respondingSeatId).toBe('seat-a');
    const afterA = resolve(next, { kind: 'PassAction', seatId: 'seat-a', pendingResponseId: next.pendingResponse!.id }, ctx).state;
    expect(afterA.pendingResponse!.respondingSeatId).toBe('seat-b');
    const saved = resolve(afterA, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: afterA.pendingResponse!.id, cardInstanceId: 'pb' }, ctx).state;
    expect(seatB(saved).combinedHp).toBe(1);
    expect(seatB(saved).eliminated).toBe(false);
    expect(saved.pendingResponse).toBeNull();
    // Back to seat-a's Play phase, where the hit came from.
    expect(saved.phase).toBe('Play');
    expect(saved.turn.ownerSeatId).toBe('seat-a');
  });
});


describe('Kingdom War win condition', () => {
  const registry = buildContentRegistry();

  it('returns a real draw result — not null — when every seat is eliminated at once', () => {
    const created = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 3), registry, {
      'seat-a': ['xu-huang', 'zhang-he'], 'seat-b': ['jiang-wei', 'meng-huo'],
    });
    const allEliminated: GameState = {
      ...created,
      seats: created.seats.map((s) => ({ ...s, eliminated: true, combinedHp: 0 })),
    };
    expect(kingdomWarMode.checkWinCondition(allEliminated)).toEqual({
      endedAt: allEliminated.turn.turnNumber,
      winningSeatIds: [],
      losingSeatIds: ['seat-a', 'seat-b'],
    });
  });

  it('still returns null while more than one kingdom is alive', () => {
    const created = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 3), registry, {
      'seat-a': ['xu-huang', 'zhang-he'], 'seat-b': ['jiang-wei', 'meng-huo'],
    });
    expect(kingdomWarMode.checkWinCondition(created)).toBeNull();
  });
});

describe('Kingdom War per-turn draw', () => {
  const registry = buildContentRegistry();

  it('draws 2 cards for whichever seat enters the Draw phase', () => {
    // cao-ren and xiahou-yuan have no skills, isolating the mode-level draw.
    const state = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 42), registry, {
      'seat-a': ['xu-huang', 'zhang-he'], 'seat-b': ['jiang-wei', 'meng-huo'],
    });
    const handBefore = state.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handBefore.cards).toHaveLength(4);
    const originalCardIds = new Set(handBefore.cards.map((c) => c.instanceId));

    const { state: next } = advanceToDecision(state, { registry, mode: kingdomWarMode });

    expect(next.phase).toBe('Play');
    const handAfter = next.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handAfter.cards).toHaveLength(6);
    expect(handAfter.cards.map((c) => c.instanceId).filter((id) => !originalCardIds.has(id))).toHaveLength(2);
  });

});

describe('Kingdom War: losing HP', () => {
  // seat-a (its turn) plays a test card that makes seat-b (Huang Zhong and Wei
  // Yan: 4 HP) lose `amount` HP.
  function loseHp(amount: number, bHand: CardInstance[] = []) {
    const registry = buildContentRegistry();
    const created = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const card: CardDefinition = { id: `test-lose-${amount}`, name: 'Test Lose', category: 'basic', play: (_s, ctx) => [{ kind: 'LoseHpEffect', seatId: ctx.targets[0].seatId, amount }] };
    registry.cards.set(card.id, card);
    const base = seated(created, registry, { 'seat-a': ['xu-huang', 'zhang-he'], 'seat-b': ['jiang-wei', 'meng-huo'] });
    const state: GameState = {
      ...base,
      phase: 'Play',
      zones: base.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'lose-1', definitionId: card.id, suit: 'spade' as const, rank: 1 }] }
        : z.id === 'seat-b:hand' ? { ...z, cards: bHand }
        : z
      ),
    };
    const ctx = { registry, mode: kingdomWarMode };
    const next = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'lose-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    return { next, ctx };
  }
  const seatB = (s: GameState) => s.seats.find((x) => x.id === 'seat-b')!;

  it('at 0 HP the seat is dying, its Generals revealed, and a Peach saves it — with no damage at all (Review Focus 4)', () => {
    const { next, ctx } = loseHp(4, [{ instanceId: 'pb', definitionId: 'peach', suit: 'heart', rank: 12 }]);
    expect(seatB(next).combinedHp).toBe(0);
    expect(seatB(next).generals!.main.revealed && seatB(next).generals!.deputy.revealed).toBe(true);
    expect(next.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
    expect(next.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', reason: { kind: 'dying', seatId: 'seat-b' } });
    const saved = resolve(next, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: next.pendingResponse!.id, cardInstanceId: 'pb' }, ctx).state;
    expect(seatB(saved).combinedHp).toBe(1);
    expect(seatB(saved).eliminated).toBe(false);
  });

  it('above half HP nothing is revealed', () => {
    const { next } = loseHp(1);
    expect(seatB(next).generals!.main.revealed).toBe(false);
  });
});

describe('Kingdom War: the Draw Phase step', () => {
  it('is one DrawPhaseEffect of 2, which a skill’s before-trigger can change', () => {
    const registry = buildContentRegistry();
    registry.generals.set('test-scholar', {
      id: 'test-scholar', kingdom: 'Wei', maxHp: 4,
      skills: [{
        id: 'study-hard', compulsory: true,
        triggers: [{
          point: 'before:DrawPhaseEffect',
          condition: (_s, subject, owner) => (subject as Extract<Effect, { kind: 'DrawPhaseEffect' }>).seatId === owner?.seatId,
          effect: (_s, subject) => {
            const draw = subject as Extract<Effect, { kind: 'DrawPhaseEffect' }>;
            return [{ ...draw, count: draw.count + 1 }];
          },
        }],
      }],
    });
    const base = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 42), registry, { 'seat-a': ['test-scholar', 'zhang-he'], 'seat-b': ['jiang-wei', 'meng-huo'] });
    const state: GameState = { ...base, seats: base.seats.map((s) => (s.id === 'seat-a' ? { ...s, generals: { ...s.generals!, main: { ...s.generals!.main, revealed: true } } } : s)) };
    const next = advanceToDecision(state, { registry, mode: kingdomWarMode }).state;
    const draws = next.log.flatMap((e) => (e.kind === 'CardsDrawnEvent' ? [e.cardInstanceIds.length] : []));
    expect(draws).toEqual([3]);
  });
});
