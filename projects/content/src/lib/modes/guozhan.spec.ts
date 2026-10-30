import { withFillers } from '../generals/fillers.testing';
import { table, kwMode, harness, card } from '../generals/skills.testing';
import { guozhanMode, guozhanMaxSeats, generalPool, generalsPerSeat, MAX_GUOZHAN_SEATS } from './guozhan';
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

describe('Guozhan setup and deal', () => {
  const registry = withFillers(buildContentRegistry());

  it('starts in GeneralSelection with unchosen seats, 4-card hands, and seat-a first', () => {
    const state = createGame(guozhanMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 42);
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

  it('deals 7 generals each at 2-8 seats and 5 each at 9-12', () => {
    expect([2, 5, 8].map((n) => generalsPerSeat(n))).toEqual([7, 7, 7]);
    expect([9, 10, 12].map((n) => generalsPerSeat(n))).toEqual([5, 5, 5]);
    expect([2, 8, 9, 10].map((n) => generalsPerSeat(n, 'identity'))).toEqual([5, 5, 5, 5]);
    for (const n of [2, 8, 9, 12]) {
      const ids = Array.from({ length: n }, (_, i) => `s${i}`);
      const dealt = createGame(guozhanMode, registry, ids, 3).generalSelection!.candidates;
      expect(Object.values(dealt).every((c) => c.length === generalsPerSeat(n))).toBe(true);
      expect(new Set(Object.values(dealt).flat()).size).toBe(n * generalsPerSeat(n));
    }
  });

  it('deals an Identity table 5 Generals a seat at any size', () => {
    for (const n of [2, 6, 9]) {
      const ids = Array.from({ length: n }, (_, i) => `s${i}`);
      const dealt = createGame(guozhanMode, registry, ids, 3, { deck: 'identity' }).generalSelection!.candidates;
      expect(Object.values(dealt).every((c) => c.length === 5)).toBe(true);
    }
  });

  it('deals unique registry generals to every seat, each containing a same-kingdom pair', () => {
    const state = createGame(guozhanMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e'], 42);
    const candidates = state.generalSelection!.candidates;
    const all = Object.values(candidates).flat();
    expect(Object.keys(candidates).sort()).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e']);
    expect(all).toHaveLength(5 * generalsPerSeat(5));
    expect(new Set(all).size).toBe(all.length);
    for (const ids of Object.values(candidates)) {
      expect(ids).toHaveLength(generalsPerSeat(5));
      const kingdoms = ids.map((id) => registry.generals.get(id)!.kingdom);
      expect(new Set(kingdoms).size).toBeLessThan(kingdoms.length);
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 7);
    const b = createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 7);
    const c = createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 8);
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
    expect(c.generalSelection).not.toEqual(a.generalSelection);
  });

  it('caps a Kingdom Wars table at 12 seats and an Identity table at 10, however large the pool grows', () => {
    const pool = (n: number, prefix: string) => ({ cards: new Map(), generals: new Map(Array.from({ length: n }, (_, i) => [`${prefix}g${i}`, {} as never])) });
    const kw = (n: number) => pool(n, 'kingdomWars:');
    expect(MAX_GUOZHAN_SEATS).toBe(12);
    expect(guozhanMaxSeats(kw(14), 'kingdomWars')).toBe(2);
    expect(guozhanMaxSeats(kw(50), 'kingdomWars')).toBe(10);
    expect(guozhanMaxSeats(kw(56), 'kingdomWars')).toBe(11);
    expect(guozhanMaxSeats(kw(60), 'kingdomWars')).toBe(12);
    expect(guozhanMaxSeats(kw(200), 'kingdomWars')).toBe(12);
    expect(guozhanMaxSeats(pool(14, ''), 'identity')).toBe(2);
    expect(guozhanMaxSeats(pool(50, ''), 'identity')).toBe(10);
    expect(guozhanMaxSeats(pool(200, ''), 'identity')).toBe(10);
  });

  it('deals every seat a full starting hand at the largest table, keeping cards in the draw pile', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `seat-${i}`);
    const state = createGame(guozhanMode, registry, ten, 1);
    for (const seat of state.seats) {
      expect(state.zones.find((z) => z.id === seat.hand.zoneId)!.cards).toHaveLength(4);
    }
    expect(state.zones.find((z) => z.kind === 'drawPile')!.cards.length).toBeGreaterThan(0);
  });

  it('gives each seat an empty Judgment slot', () => {
    const state = createGame(guozhanMode, buildContentRegistry(), ['seat-0', 'seat-1'], 1);
    expect(state.seats.map((s) => s.judgment)).toEqual([{ zoneId: 'seat-0:judgment' }, { zoneId: 'seat-1:judgment' }]);
    expect(state.zones.filter((z) => z.kind === 'judgment')).toEqual([
      { id: 'seat-0:judgment', kind: 'judgment', ownerSeatId: 'seat-0', cards: [] },
      { id: 'seat-1:judgment', kind: 'judgment', ownerSeatId: 'seat-1', cards: [] },
    ]);
  });

  it('sets up an empty processing zone for Harvest', () => {
    const state = createGame(guozhanMode, buildContentRegistry(), ['seat-0', 'seat-1'], 1);
    expect(state.zones.find((z) => z.kind === 'processing')).toEqual({ id: 'processing', kind: 'processing', cards: [] });
  });

  it('names each player after its seat position until the app renames it', () => {
    const state = createGame(guozhanMode, registry, ['a', 'b', 'c'], 1);
    expect(state.players.map((p) => [p.seatId, p.name])).toEqual([['a', 'Seat 0'], ['b', 'Seat 1'], ['c', 'Seat 2']]);
  });

  describe('the deck rule', () => {
    const seats = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];
    const dealt = (rules?: { deck?: string }) =>
      createGame(guozhanMode, registry, seats, 1, rules)
        .zones.flatMap((z) => z.cards)
        .map((c) => `${c.definitionId} ${c.suit} ${c.rank}`)
        .sort();

    it('deals the same cards with no deck, with {}, and with Kingdom Wars', () => {
      expect(dealt({})).toEqual(dealt());
      expect(dealt({ deck: 'kingdomWars' })).toEqual(dealt());
      expect(dealt()).toHaveLength(108);
    });

    it('deals the whole Identity deck', () => {
      expect(dealt({ deck: 'identity' })).toHaveLength(142);
    });

    it('deals the whole Kingdom Wars deck', () => {
      const cards = dealt({ deck: 'kingdomWars' });
      expect(cards.filter((c) => c.startsWith('wu-six-swords '))).toHaveLength(1);
      expect(cards.filter((c) => c.startsWith('trident-glaive '))).toHaveLength(1);
      expect(cards.filter((c) => c.startsWith('wuxie-guo '))).toHaveLength(2);
      expect(cards).toHaveLength(108);
      expect(cards.filter((c) => c.startsWith('amass '))).toHaveLength(2);
      expect(cards.filter((c) => c.startsWith('ally-far-attack-near '))).toHaveLength(1);
      expect(cards.filter((c) => c.startsWith('ascertain '))).toHaveLength(2);
      expect(cards.filter((c) => c.startsWith('fire-fan '))).toHaveLength(1);
      expect(cards.filter((c) => c.startsWith('sha '))).toHaveLength(21);
      expect(cards.filter((c) => c.startsWith('shan '))).toHaveLength(14);
      expect(cards.filter((c) => c.startsWith('peach '))).toHaveLength(8);
    });

    it('refuses a deck it does not know', () => {
      expect(() => dealt({ deck: 'bogus' })).toThrow('Unknown deck "bogus"');
    });

    describe('the General pool', () => {
      const full = withFillers(buildContentRegistry());
      const dealtGenerals = (rules?: { deck?: string }) => {
        const state = createGame(guozhanMode, full, seats, 7, rules);
        return [...Object.values(state.generalSelection!.candidates).flat(), ...state.spareGenerals!];
      };

      it('deals only Kingdom Wars Generals from the Kingdom Wars deck, given or not', () => {
        expect(dealtGenerals().every((id) => id.startsWith('kingdomWars:'))).toBe(true);
        const ids = dealtGenerals({ deck: 'kingdomWars' });
        expect(ids.length).toBeGreaterThan(0);
        expect(ids.every((id) => id.startsWith('kingdomWars:'))).toBe(true);
      });

      it('deals no Kingdom Wars General from Identity', () => {
        expect(dealtGenerals({ deck: 'identity' }).some((id) => id.startsWith('kingdomWars:'))).toBe(false);
      });

      it('sizes the pool and the seat limit by deck', () => {
        expect(generalPool(full, 'kingdomWars')).toHaveLength(60);
        expect(guozhanMaxSeats(full, 'kingdomWars')).toBe(12);
      });

      it('Identity deal for seed 42 is unchanged', () => {
        const state = createGame(guozhanMode, full, ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 42, { deck: 'identity' });
        expect(state.generalSelection!.candidates).toEqual({"seat-a":["deng-ai","zhang-zhao-and-zhang-hong","filler-jiang-wei","filler-deng-ai","zhang-he"],"seat-b":["da-qiao","sun-jian","zhou-tai","xun-yu","zhuge-liang"],"seat-c":["hua-tuo","taishi-ci","liu-shan","yan-liang-and-wen-chou","zuo-ci"],"seat-d":["huang-gai","fire-zhuge-liang","xiao-qiao","zhu-rong","lu-su"]});
      });
    });

    it('keeps the deck in the saved state', () => {
      const state = createGame(guozhanMode, registry, seats, 1, { deck: 'kingdomWars' });
      expect(state.rules?.deck).toBe('kingdomWars');
      expect(JSON.parse(JSON.stringify(state)).rules.deck).toBe('kingdomWars');
    });
  });

  it('builds the Identity deck from exactly each card’s printings, at every table size', () => {
    const deckOf = (n: number) =>
      createGame(guozhanMode, registry, Array.from({ length: n }, (_, i) => `seat-${i}`), 1, { deck: 'identity' })
        .zones.flatMap((z) => z.cards)
        .map((c) => `${c.definitionId} ${c.suit} ${c.rank}`)
        .sort();
    const printed = [...registry.cards.keys()]
      .filter((id) => !registry.cards.get(id)!.outOfDeck && cardsData[id])
      .flatMap((id) => cardsData[id].printings!.filter((p) => !p.expansion).map((p) => `${id} ${p.suit} ${p.rank}`))
      .sort();
    expect(deckOf(2)).toEqual(printed);
    expect(deckOf(10)).toEqual(printed);
    expect(deckOf(2).filter((c) => c.startsWith('silver-lion '))).toEqual(['silver-lion club 1']);
    // The Army and EX copies of Dodge, Peach and Wuxie stay out for now.
    expect(deckOf(2).filter((c) => c.startsWith('shan '))).toHaveLength(15);
    expect(deckOf(2).filter((c) => c.startsWith('peach '))).toHaveLength(8);
    expect(deckOf(2).filter((c) => c.startsWith('wuxie '))).toHaveLength(3);
    // The elemental Slash: 5 Fire Attack, 9 Lightning Attack.
    expect(deckOf(2).filter((c) => c.startsWith('fire-attack '))).toHaveLength(5);
    expect(deckOf(2).filter((c) => c.startsWith('lightning-attack '))).toHaveLength(9);
    expect(deckOf(2).filter((c) => c.startsWith('blaze '))).toHaveLength(3); // Blaze is dealt
    expect(deckOf(2).filter((c) => c.startsWith('chains '))).toHaveLength(6); // Chains is dealt
    expect(deckOf(2)).toHaveLength(142);
  });

  it('refuses to build a deck for a card with no printings', () => {
    const withUnprinted: ContentRegistry = {
      ...registry,
      cards: new Map([...registry.cards, ['unprinted', { id: 'unprinted', name: 'Unprinted', category: 'basic', play: () => [] }]]),
    };
    expect(() => createGame(guozhanMode, withUnprinted, ['a', 'b'], 1, { deck: 'identity' })).toThrow(/unprinted.*no printings/);
  });

  it('caps the table at its seat cap and rejects fewer than 2', () => {
    expect(guozhanMaxSeats(registry)).toBe(12);
    expect(guozhanMode.maxSeats!(registry)).toBe(12);
    const thirteen = Array.from({ length: 13 }, (_, i) => `s${i}`);
    expect(() => createGame(guozhanMode, registry, thirteen, 1)).toThrow(/between 2 and 12 seats/);
    expect(() => createGame(guozhanMode, registry, ['a'], 1)).toThrow(/between 2 and 12 seats/);
  });

  it('a full selection through resolve seats every seat with a same-kingdom pair and starts turn 1', () => {
    let state = createGame(guozhanMode, registry, ['seat-a', 'seat-b', 'seat-c'], 42);
    const ctx = { registry, mode: guozhanMode };
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

  it('does not end the game after selection when every seat picked the same Kingdom: hidden seats keep it going', () => {
    // A Kingdom wins only once every survivor has revealed into it.
    const state = createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 1);
    const allWei: GameState = {
      ...state,
      generalSelection: {
        candidates: {
          'seat-a': ['filler-xu-huang', 'filler-zhang-he', 'filler-meng-huo', 'filler-zhang-zhao-and-zhang-hong', 'filler-yuan-shao'],
          'seat-b': ['filler-xun-yu', 'filler-cao-pi', 'filler-meng-huo', 'filler-sun-ce', 'filler-jia-xu'],
        },
      },
    };
    const ctx = { registry, mode: guozhanMode };
    const afterA = resolve(allWei, { kind: 'ChooseGeneralsAction', seatId: 'seat-a', mainId: 'filler-xu-huang', deputyId: 'filler-zhang-he' }, ctx).state;
    expect(afterA.result).toBeNull();
    const afterB = resolve(afterA, { kind: 'ChooseGeneralsAction', seatId: 'seat-b', mainId: 'filler-xun-yu', deputyId: 'filler-cao-pi' }, ctx).state;
    expect(afterB.result).toBeNull();
  });
});

describe('Guozhan forced reveal, dying and elimination', () => {
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
    const registry = withFillers(buildContentRegistry());
    const created = createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 7);
    // Added after the deal: it has no printings, so it never goes in the deck.
    const card = hit(amount);
    registry.cards.set(card.id, card);
    const base = seated(created, registry, { 'seat-a': ['filler-xu-huang', 'filler-zhang-he'], 'seat-b': ['filler-jiang-wei', 'filler-meng-huo'] });
    const state: GameState = {
      ...base,
      phase: 'Play',
      zones: base.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'hit-1', definitionId: card.id, suit: 'spade' as const, rank: 1 }, ...(hands.a ?? [])] }
        : z.id === 'seat-b:hand' ? { ...z, cards: hands.b ?? [] }
        : z
      ),
    };
    const ctx = { registry, mode: guozhanMode };
    const next = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'hit-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    return { next, ctx, hpBefore: base.seats[1].combinedHp };
  }
  const seatB = (s: GameState) => s.seats.find((x) => x.id === 'seat-b')!;

  it('reveals nothing by itself: a seat that drops below 0 HP is dying, its Generals still hidden', () => {
    const { next } = hitSeatB(10);
    expect(seatB(next).generals!.main.revealed).toBe(false);
    expect(seatB(next).generals!.deputy.revealed).toBe(false);
    expect(next.log.some((e) => e.kind === 'GeneralRevealedEvent')).toBe(false);
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

  it('a death reveals both Generals, logged before the elimination and marked as a death reveal', () => {
    const { next, ctx } = hitSeatB(10);
    const out = resolve(next, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: next.pendingResponse!.id }, ctx).state;
    expect(seatB(out).generals!.main.revealed && seatB(out).generals!.deputy.revealed).toBe(true);
    const tail = out.log.map((e) => e.kind);
    const revealed = out.log.filter((e) => e.kind === 'GeneralRevealedEvent');
    expect(revealed).toEqual([
      { kind: 'GeneralRevealedEvent', seatId: 'seat-b', slot: 'main', onDeath: true },
      { kind: 'GeneralRevealedEvent', seatId: 'seat-b', slot: 'deputy', onDeath: true },
    ]);
    expect(tail.indexOf('GeneralRevealedEvent')).toBeLessThan(tail.indexOf('SeatEliminatedEvent'));
  });

  it('a death reveals only the General that is still hidden, and draws no reveal bonus for the dead', () => {
    const { next, ctx } = hitSeatB(10);
    const half: GameState = { ...next, seats: next.seats.map((x) => (x.id === 'seat-b' ? { ...x, generals: { ...x.generals!, main: { ...x.generals!.main, revealed: true } } } : x)), rules: { firstRevealDraw: true } };
    const out = resolve(half, { kind: 'PassAction', seatId: 'seat-b', pendingResponseId: half.pendingResponse!.id }, ctx).state;
    expect(out.log.filter((e) => e.kind === 'GeneralRevealedEvent')).toEqual([{ kind: 'GeneralRevealedEvent', seatId: 'seat-b', slot: 'deputy', onDeath: true }]);
    expect(out.zones.find((z) => z.id === 'seat-b:hand')!.cards).toHaveLength(0);
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


describe('Guozhan win condition', () => {
  const registry = withFillers(buildContentRegistry());

  it('returns a real draw result — not null — when every seat is eliminated at once', () => {
    const created = seated(createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 3), registry, {
      'seat-a': ['filler-xu-huang', 'filler-zhang-he'], 'seat-b': ['filler-jiang-wei', 'filler-meng-huo'],
    });
    const allEliminated: GameState = {
      ...created,
      seats: created.seats.map((s) => ({ ...s, eliminated: true, combinedHp: 0 })),
    };
    expect(guozhanMode.checkWinCondition(allEliminated)).toEqual({
      endedAt: allEliminated.turn.turnNumber,
      winningSeatIds: [],
      losingSeatIds: ['seat-a', 'seat-b'],
    });
  });

  it('still returns null while more than one kingdom is alive', () => {
    const created = seated(createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 3), registry, {
      'seat-a': ['filler-xu-huang', 'filler-zhang-he'], 'seat-b': ['filler-jiang-wei', 'filler-meng-huo'],
    });
    expect(guozhanMode.checkWinCondition(created)).toBeNull();
  });
});

describe('Guozhan per-turn draw', () => {
  const registry = withFillers(buildContentRegistry());

  it('draws 2 cards for whichever seat enters the Draw phase', () => {
    // cao-ren and xiahou-yuan have no skills, isolating the mode-level draw.
    const state = seated(createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 42), registry, {
      'seat-a': ['filler-xu-huang', 'filler-zhang-he'], 'seat-b': ['filler-jiang-wei', 'filler-meng-huo'],
    });
    const handBefore = state.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handBefore.cards).toHaveLength(4);
    const originalCardIds = new Set(handBefore.cards.map((c) => c.instanceId));

    const { state: next } = advanceToDecision(state, { registry, mode: guozhanMode });

    expect(next.phase).toBe('Play');
    const handAfter = next.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handAfter.cards).toHaveLength(6);
    expect(handAfter.cards.map((c) => c.instanceId).filter((id) => !originalCardIds.has(id))).toHaveLength(2);
  });

});

describe('Guozhan: losing HP', () => {
  // seat-a (its turn) plays a test card that makes seat-b (Huang Zhong and Wei
  // Yan: 4 HP) lose `amount` HP.
  function loseHp(amount: number, bHand: CardInstance[] = []) {
    const registry = withFillers(buildContentRegistry());
    const created = createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 7);
    const card: CardDefinition = { id: `test-lose-${amount}`, name: 'Test Lose', category: 'basic', play: (_s, ctx) => [{ kind: 'LoseHpEffect', seatId: ctx.targets[0].seatId, amount }] };
    registry.cards.set(card.id, card);
    const base = seated(created, registry, { 'seat-a': ['filler-xu-huang', 'filler-zhang-he'], 'seat-b': ['filler-jiang-wei', 'filler-meng-huo'] });
    const state: GameState = {
      ...base,
      phase: 'Play',
      zones: base.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'lose-1', definitionId: card.id, suit: 'spade' as const, rank: 1 }] }
        : z.id === 'seat-b:hand' ? { ...z, cards: bHand }
        : z
      ),
    };
    const ctx = { registry, mode: guozhanMode };
    const next = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'lose-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    return { next, ctx };
  }
  const seatB = (s: GameState) => s.seats.find((x) => x.id === 'seat-b')!;

  it('at 0 HP the seat is dying, its Generals still hidden, and a Peach saves it — with no damage at all (Review Focus 4)', () => {
    const { next, ctx } = loseHp(4, [{ instanceId: 'pb', definitionId: 'peach', suit: 'heart', rank: 12 }]);
    expect(seatB(next).combinedHp).toBe(0);
    expect(seatB(next).generals!.main.revealed || seatB(next).generals!.deputy.revealed).toBe(false);
    expect(next.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
    expect(next.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', reason: { kind: 'dying', seatId: 'seat-b' } });
    const saved = resolve(next, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: next.pendingResponse!.id, cardInstanceId: 'pb' }, ctx).state;
    expect(seatB(saved).combinedHp).toBe(1);
    expect(seatB(saved).eliminated).toBe(false);
  });

  it('at half HP or below, nothing is revealed either', () => {
    const { next } = loseHp(2);
    expect(seatB(next).combinedHp).toBe(2);
    expect(seatB(next).generals!.main.revealed).toBe(false);
  });
});

describe('Guozhan: the Draw Phase step', () => {
  it('is one DrawPhaseEffect of 2, which a skill’s before-trigger can change', () => {
    const registry = withFillers(buildContentRegistry());
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
    const base = seated(createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 42), registry, { 'seat-a': ['test-scholar', 'filler-zhang-he'], 'seat-b': ['filler-jiang-wei', 'filler-meng-huo'] });
    const state: GameState = { ...base, seats: base.seats.map((s) => (s.id === 'seat-a' ? { ...s, generals: { ...s.generals!, main: { ...s.generals!.main, revealed: true } } } : s)) };
    const next = advanceToDecision(state, { registry, mode: guozhanMode }).state;
    const draws = next.log.flatMap((e) => (e.kind === 'CardsDrawnEvent' ? [e.cardInstanceIds.length] : []));
    expect(draws).toEqual([3]);
  });
});

describe('Guozhan: the dying round knows how far below 1 HP a drop went', () => {
  it('the mode’s dying trigger sets pointsBelowOne from the drop', () => {
    const s = table({}, { hp: { 'seat-b': -1 } });
    const event = { kind: 'DamageDealtEvent' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-b' }, amount: 2, nature: 'normal' as const } };
    const dying = kwMode.triggers.filter((t) => t.point === 'after:DamageDealtEvent' && t.condition(s, event)).flatMap((t) => t.effect(s, event)).find((e) => (e as { kind: string }).kind === 'DyingEffect');
    expect(dying).toMatchObject({ kind: 'DyingEffect', seatId: 'seat-b', entering: true, pointsBelowOne: 2 });
    const later = { ...event, damage: { ...event.damage, amount: 1 } };
    const s2 = table({}, { hp: { 'seat-b': -2 } });
    expect(kwMode.triggers.filter((t) => t.point === 'after:DamageDealtEvent' && t.condition(s2, later)).flatMap((t) => t.effect(s2, later)).find((e) => (e as { kind: string }).kind === 'DyingEffect')).toMatchObject({ pointsBelowOne: 1 });
  });
});

describe('Guozhan reveal bonuses', () => {
  const makeTable = table;
  const h = harness(kwMode);
  // Revealed the way a skill's use does it (the effect), since no action reveals a General by itself any more.
  const reveal = (s: GameState, seatId: string, slot: 'main' | 'deputy') => h.run(s, [{ kind: 'RevealGeneralEffect', seatId, slot }]);
  const handSize = (s: GameState, seatId: string) => s.zones.find((z) => z.id === `${seatId}:hand`)!.cards.length;
  const deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((id) => card(id, 'sha'));
  // Both Generals hidden on every seat; Xu Huang (4) + Dong Zhuo (4) is even, Xu Huang (4) + Jia Xu (3) is odd.
  const hidden = { generals: Object.fromEntries(['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e'].map((id) => [id, ['filler-xu-huang', 'filler-dong-zhuo', false] as [string, string, boolean]])) };
  const oddPair = (id: string): Record<string, [string, string, boolean]> => ({ [id]: ['filler-xu-huang', 'filler-jia-xu', false] });

  it('the first seat to reveal a General draws 2 when the option is on at 5 seats', () => {
    const s = { ...makeTable({ drawPile: deck }, { seats: 5, ...hidden }), rules: { firstRevealDraw: true } };
    const after = reveal(s, 'seat-b', 'main');
    expect(handSize(after, 'seat-b')).toBe(2);
  });

  it('only the first reveal at the table gets the bonus', () => {
    const s = { ...makeTable({ drawPile: deck }, { seats: 5, ...hidden }), rules: { firstRevealDraw: true } };
    const after = reveal(reveal(s, 'seat-b', 'main'), 'seat-c', 'main');
    expect(handSize(after, 'seat-b')).toBe(2);
    expect(handSize(after, 'seat-c')).toBe(0);
  });

  it('gives nothing with the option off, unset, or below 5 seats', () => {
    for (const s of [
      { ...makeTable({ drawPile: deck }, { seats: 5, ...hidden }), rules: { firstRevealDraw: false } },
      makeTable({ drawPile: deck }, { seats: 5, ...hidden }),
      { ...makeTable({ drawPile: deck }, { seats: 4, ...hidden }), rules: { firstRevealDraw: true } },
    ]) {
      expect(handSize(reveal(s, 'seat-b', 'main'), 'seat-b')).toBe(0);
    }
  });

  it('revealing the second General draws 1 when the printed HP sum is odd', () => {
    const s = makeTable({ drawPile: deck }, { seats: 4, generals: { ...hidden.generals, ...oddPair('seat-b') } });
    const once = reveal(s, 'seat-b', 'main');
    expect(handSize(once, 'seat-b')).toBe(0);
    expect(handSize(reveal(once, 'seat-b', 'deputy'), 'seat-b')).toBe(1);
  });

  it('draws 1 on the second reveal whichever General is revealed second', () => {
    const s = makeTable({ drawPile: deck }, { seats: 4, generals: { ...hidden.generals, ...oddPair('seat-b') } });
    expect(handSize(reveal(reveal(s, 'seat-b', 'deputy'), 'seat-b', 'main'), 'seat-b')).toBe(1);
  });

  it('draws nothing on the second reveal when the HP sum is even', () => {
    const s = makeTable({ drawPile: deck }, { seats: 4, generals: hidden.generals });
    expect(handSize(reveal(reveal(s, 'seat-b', 'main'), 'seat-b', 'deputy'), 'seat-b')).toBe(0);
  });

  it('a General hidden and revealed again draws no second bonus', () => {
    const s = makeTable({ drawPile: deck }, { seats: 4, generals: { ...hidden.generals, ...oddPair('seat-b') } });
    const both = reveal(reveal(s, 'seat-b', 'main'), 'seat-b', 'deputy');
    expect(handSize(both, 'seat-b')).toBe(1);
    const again = reveal(h.run(both, [{ kind: 'HideGeneralEffect', seatId: 'seat-b', slot: 'main' }]), 'seat-b', 'main');
    expect(again.seats.find((x) => x.id === 'seat-b')!.generals!.main.revealed).toBe(true);
    expect(handSize(again, 'seat-b')).toBe(1);
  });

  it('a General hidden before the second was ever revealed: the bonus still comes once', () => {
    const s = makeTable({ drawPile: deck }, { seats: 4, generals: { ...hidden.generals, ...oddPair('seat-b') } });
    const hiddenAgain = h.run(reveal(s, 'seat-b', 'main'), [{ kind: 'HideGeneralEffect', seatId: 'seat-b', slot: 'main' }]);
    const both = reveal(reveal(hiddenAgain, 'seat-b', 'deputy'), 'seat-b', 'main');
    expect(handSize(both, 'seat-b')).toBe(1);
  });

  it('a re-revealed General is never the table’s first reveal', () => {
    const s = { ...makeTable({ drawPile: deck }, { seats: 5, ...hidden }), rules: { firstRevealDraw: true } };
    const again = reveal(h.run(reveal(s, 'seat-b', 'main'), [{ kind: 'HideGeneralEffect', seatId: 'seat-b', slot: 'main' }]), 'seat-b', 'main');
    expect(handSize(again, 'seat-b')).toBe(2);
  });

  it('both bonuses stack for the first revealer', () => {
    const s = { ...makeTable({ drawPile: deck }, { seats: 5, generals: { ...hidden.generals, ...oddPair('seat-b') } }), rules: { firstRevealDraw: true } };
    expect(handSize(reveal(reveal(s, 'seat-b', 'main'), 'seat-b', 'deputy'), 'seat-b')).toBe(3);
  });
});

describe('Guozhan game rules option', () => {
  const registry = withFillers(buildContentRegistry());
  const ids = ['a', 'b', 'c', 'd', 'e'];
  it('stores the first-reveal option on the state', () => {
    expect(createGame(guozhanMode, registry, ids, 1, { firstRevealDraw: true }).rules).toEqual({ firstRevealDraw: true });
  });
  it('stores no rules when none are given', () => {
    expect(createGame(guozhanMode, registry, ids, 1).rules).toBeUndefined();
  });
});

describe('Guozhan kill reward and penalty', () => {
  const h = harness(kwMode);
  const rescue = { any: ['peach'], self: ['wine'] };
  const deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((id) => card(id, 'sha'));
  const handOf = (s: GameState, id: string) => s.zones.find((z) => z.id === `${id}:hand`)!.cards;
  // Five seats: a Wei, b Shu, c Shu, d Shu, e Wei. Seat b is at 0 HP and nobody can save it.
  const kill = (killer: string | undefined, o: { kingdoms?: Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'>; hidden?: string[]; eliminated?: string[] } = {}) => {
    const kingdoms = { 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Shu', 'seat-d': 'Shu', 'seat-e': 'Wei', ...o.kingdoms } as const;
    const generals = Object.fromEntries((o.hidden ?? []).map((id) => [id, ['filler-xu-huang', 'filler-dong-zhuo', false] as [string, string, boolean]]));
    let s = table({ drawPile: deck, 'seat-a:hand': [card('h1', 'sha'), card('h2', 'sha')], 'seat-c:hand': [card('c1', 'sha')] }, { seats: 5, kingdoms, generals, hp: { 'seat-b': 0 } });
    s = { ...s, seats: s.seats.map((x) => (o.eliminated?.includes(x.id) ? { ...x, eliminated: true } : x)) };
    return h.run(s, [{ kind: 'DyingEffect', seatId: 'seat-b', order: [], rescueCardIds: rescue, ...(killer ? { killerSeatId: killer } : {}) }]);
  };

  it('rewards a killer of another Kingdom with the dead seat\'s Kingdom count, the dead seat included', () => {
    const out = kill('seat-a');
    expect(out.seats.find((x) => x.id === 'seat-b')!.eliminated).toBe(true);
    expect(handOf(out, 'seat-a')).toHaveLength(2 + 3);
  });

  it('counts only exposed seats of that Kingdom: a face-down seat is not counted', () => {
    // Seat-b (dead, revealed by its death), seat-c and seat-d are Shu; seat-d is face-down: 2 cards, not 3.
    expect(handOf(kill('seat-a', { hidden: ['seat-d'] }), 'seat-a')).toHaveLength(2 + 2);
  });

  it('counts only living seats of that Kingdom besides the dead one', () => {
    expect(handOf(kill('seat-a', { eliminated: ['seat-d'] }), 'seat-a')).toHaveLength(2 + 2);
  });

  it('makes a same-Kingdom killer discard its entire hand', () => {
    const out = kill('seat-c');
    expect(handOf(out, 'seat-c')).toHaveLength(0);
    expect(out.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toContain('c1');
  });

  it('treats Qun as one Kingdom: Qun killing Qun is penalized, Qun killing another is rewarded', () => {
    const qun = { kingdoms: { 'seat-b': 'Qun', 'seat-c': 'Qun', 'seat-d': 'Wu' } as const };
    expect(handOf(kill('seat-c', qun), 'seat-c')).toHaveLength(0);
    expect(handOf(kill('seat-a', qun), 'seat-a')).toHaveLength(2 + 2);
  });

  it('rewards a killer with no revealed General even when it shares the Kingdom', () => {
    // Shu: seat-b (dead, shown by its death), seat-c (the face-down killer, not counted) and seat-d: 2 cards.
    const out = kill('seat-c', { hidden: ['seat-c'] });
    expect(handOf(out, 'seat-c')).toHaveLength(1 + 2);
  });

  it('does nothing without a killer', () => {
    expect(handOf(kill(undefined), 'seat-a')).toHaveLength(2);
  });

  it('does nothing when the killer is the dead seat or is out too', () => {
    expect(handOf(kill('seat-b'), 'seat-b')).toHaveLength(0);
    expect(handOf(kill('seat-a', { eliminated: ['seat-a'] }), 'seat-a')).toHaveLength(2);
  });
});

describe('Guozhan Ambitionists: allegiance is decided at the first reveal', () => {
  const h = harness(kwMode);
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'];
  // Six seats (cap 3): a, b, c, d are Wei, e and f Shu, every General hidden.
  const hiddenTable = (kingdoms: Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'> = {}) =>
    table({}, {
      seats: 6,
      kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Wei', 'seat-d': 'Wei', 'seat-e': 'Shu', 'seat-f': 'Shu', ...kingdoms },
      generals: Object.fromEntries(ids.map((id) => [id, ['filler-xu-huang', 'filler-dong-zhuo', false] as [string, string, boolean]])),
    });
  const reveal = (s: GameState, seatId: string, slot: 'main' | 'deputy' = 'main') => h.run(s, [{ kind: 'RevealGeneralEffect', seatId, slot }]);
  const allegiance = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!.allegiance;

  it('the cap-th seat of a Kingdom is a Kingdom seat, the next is an Ambitionist', () => {
    let s = hiddenTable();
    for (const id of ['seat-a', 'seat-b', 'seat-c']) s = reveal(s, id);
    expect(['seat-a', 'seat-b', 'seat-c'].map((id) => allegiance(s, id))).toEqual(['kingdom', 'kingdom', 'kingdom']);
    s = reveal(s, 'seat-d');
    expect(allegiance(s, 'seat-d')).toBe('ambitionist');
  });

  it('a dead seat still holds its slot', () => {
    let s = hiddenTable();
    for (const id of ['seat-a', 'seat-b', 'seat-c']) s = reveal(s, id);
    s = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, eliminated: true } : x)) };
    expect(allegiance(reveal(s, 'seat-d'), 'seat-d')).toBe('ambitionist');
  });

  it('other Kingdoms are counted separately, and Qun is capped like the rest', () => {
    let s = hiddenTable({ 'seat-a': 'Qun', 'seat-b': 'Qun', 'seat-c': 'Qun', 'seat-d': 'Qun' });
    for (const id of ['seat-e', 'seat-f']) s = reveal(s, id);
    expect(['seat-e', 'seat-f'].map((id) => allegiance(s, id))).toEqual(['kingdom', 'kingdom']);
    for (const id of ['seat-a', 'seat-b', 'seat-c', 'seat-d']) s = reveal(s, id);
    expect(['seat-a', 'seat-b', 'seat-c', 'seat-d'].map((id) => allegiance(s, id))).toEqual(['kingdom', 'kingdom', 'kingdom', 'ambitionist']);
  });

  it('revealing the second General, or revealing again after hiding, never re-decides', () => {
    let s = hiddenTable();
    s = reveal(s, 'seat-a');
    s = reveal(s, 'seat-a', 'deputy');
    expect(allegiance(s, 'seat-a')).toBe('kingdom');
    for (const id of ['seat-b', 'seat-c']) s = reveal(s, id);
    s = h.run(s, [{ kind: 'HideGeneralEffect', seatId: 'seat-d', slot: 'main' }]);
    s = reveal(s, 'seat-d');
    expect(allegiance(s, 'seat-d')).toBe('ambitionist');
    s = h.run(s, [{ kind: 'HideGeneralEffect', seatId: 'seat-d', slot: 'main' }, { kind: 'HideGeneralEffect', seatId: 'seat-a', slot: 'main' }, { kind: 'HideGeneralEffect', seatId: 'seat-a', slot: 'deputy' }]);
    s = reveal(s, 'seat-a');
    expect(allegiance(s, 'seat-a')).toBe('kingdom');
  });

  it('a hidden seat revealed by its death in a full Kingdom becomes an Ambitionist', () => {
    let s = hiddenTable();
    for (const id of ['seat-a', 'seat-b', 'seat-c']) s = reveal(s, id);
    s = h.run(s, [{ kind: 'EliminateSeatEffect', seatId: 'seat-d' }]);
    expect(allegiance(s, 'seat-d')).toBe('ambitionist');
  });
});

describe('Guozhan Ambitionists: kill reward', () => {
  const h = harness(kwMode);
  const rescue = { any: ['peach'], self: ['wine'] };
  const deck = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'].map((id) => card(id, 'sha'));
  const handOf = (s: GameState, id: string) => s.zones.find((z) => z.id === `${id}:hand`)!.cards;
  // Six seats: a, b, c, d Wei, e, f Shu. Seat b is at 0 HP and nobody can save it.
  const kill = (killer: string, o: { allegiance?: Record<string, 'kingdom' | 'ambitionist'>; hidden?: string[] } = {}) => {
    const kingdoms = { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Wei', 'seat-d': 'Wei', 'seat-e': 'Shu', 'seat-f': 'Shu' } as const;
    const generals = Object.fromEntries((o.hidden ?? []).map((id) => [id, ['filler-xu-huang', 'filler-dong-zhuo', false] as [string, string, boolean]]));
    let s = table({ drawPile: deck, 'seat-a:hand': [card('h1', 'sha'), card('h2', 'sha')], 'seat-c:hand': [card('c1', 'sha')] }, { seats: 6, kingdoms, generals, hp: { 'seat-b': 0 } });
    s = { ...s, seats: s.seats.map((x) => (o.allegiance?.[x.id] ? { ...x, allegiance: o.allegiance[x.id] } : x)) };
    return h.run(s, [{ kind: 'DyingEffect', seatId: 'seat-b', order: [], rescueCardIds: rescue, killerSeatId: killer }]);
  };

  it('killing an Ambitionist draws 3, though its Kingdom has other living seats', () => {
    const out = kill('seat-e', { allegiance: { 'seat-b': 'ambitionist' } });
    expect(handOf(out, 'seat-e')).toHaveLength(0 + 3);
  });

  it('an Ambitionist killer is rewarded even for a seat of its printed Kingdom, and never discards', () => {
    const out = kill('seat-c', { allegiance: { 'seat-c': 'ambitionist' } });
    expect(handOf(out, 'seat-c')).toHaveLength(1 + 3);
  });

  it('killing a hidden seat of a full Kingdom (revealed by its death) draws 3, not the Kingdom count', () => {
    const out = kill('seat-e', { hidden: ['seat-b'], allegiance: { 'seat-a': 'kingdom', 'seat-c': 'kingdom', 'seat-d': 'kingdom' } });
    expect(out.seats.find((x) => x.id === 'seat-b')!.allegiance).toBe('ambitionist');
    expect(handOf(out, 'seat-e')).toHaveLength(0 + 3);
  });
});

describe('Guozhan Ambitionists: win check', () => {
  const h = harness(guozhanMode);
  const win = guozhanMode.checkWinCondition;
  type Alle = 'kingdom' | 'ambitionist' | undefined;
  type K = 'Wei' | 'Shu' | 'Wu' | 'Qun';
  // Seats a.. in order, each `[kingdom, allegiance, state]`: 'out' eliminated, 'hidden' face-down, else revealed.
  const seats = (spec: [K, Alle, ('out' | 'hidden' | 'up')?][]): GameState => {
    const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'];
    const s = table({}, {
      seats: spec.length,
      kingdoms: Object.fromEntries(spec.map(([k], i) => [ids[i], k])),
      generals: Object.fromEntries(spec.map(([, , st], i) => [ids[i], ['filler-xu-huang', 'filler-dong-zhuo', st !== 'hidden'] as [string, string, boolean]])),
    });
    return { ...s, seats: s.seats.map((x, i) => ({ ...x, ...(spec[i][1] ? { allegiance: spec[i][1] } : {}), eliminated: spec[i][2] === 'out' })) };
  };

  it('an Ambitionist wins as the sole survivor, with no winning Kingdom', () => {
    const r = win(seats([['Wei', 'ambitionist'], ['Wei', 'kingdom', 'out'], ['Shu', 'kingdom', 'out']]));
    expect(r).toEqual({ endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b', 'seat-c'] });
  });

  it('a Kingdom wins when every survivor is a Kingdom seat of it', () => {
    const r = win(seats([['Wei', 'kingdom'], ['Wei', 'kingdom'], ['Shu', 'kingdom', 'out']]));
    expect(r).toMatchObject({ winningKingdom: 'Wei', winningSeatIds: ['seat-a', 'seat-b'] });
  });

  it('Qun wins as a group', () => {
    expect(win(seats([['Qun', 'kingdom'], ['Qun', 'kingdom'], ['Wei', 'kingdom', 'out']]))).toMatchObject({ winningKingdom: 'Qun' });
  });

  it('a Kingdom and an Ambitionist alive: no result', () => {
    expect(win(seats([['Wei', 'kingdom'], ['Wei', 'kingdom'], ['Wei', 'ambitionist']]))).toBeNull();
  });

  it('a hidden or undecided survivor blocks a Kingdom win', () => {
    expect(win(seats([['Wei', 'kingdom'], ['Wei', undefined, 'hidden'], ['Shu', 'kingdom', 'out']]))).toBeNull();
    expect(win(seats([['Wei', 'kingdom'], ['Wei', undefined, 'up'], ['Shu', 'kingdom', 'out']]))).toBeNull();
  });

  it('the game ends at the reveal of the last hidden seat when it fits under the cap', () => {
    // Six seats, cap 3: a, b Wei revealed, c Wei hidden; d, e, f out.
    const s = seats([['Wei', 'kingdom'], ['Wei', 'kingdom'], ['Wei', undefined, 'hidden'], ['Shu', 'kingdom', 'out'], ['Shu', 'kingdom', 'out'], ['Shu', 'kingdom', 'out']]);
    expect(s.result).toBeNull();
    const after = h.run(s, [{ kind: 'RevealGeneralEffect', seatId: 'seat-c', slot: 'main' }]);
    expect(after.result).toMatchObject({ winningKingdom: 'Wei', winningSeatIds: ['seat-a', 'seat-b', 'seat-c'] });
  });

  it('an over-cap hidden seat revealing as an Ambitionist does not end the game', () => {
    const s = seats([['Wei', 'kingdom'], ['Wei', 'kingdom'], ['Wei', 'kingdom'], ['Wei', undefined, 'hidden'], ['Shu', 'kingdom', 'out'], ['Shu', 'kingdom', 'out']]);
    const after = h.run(s, [{ kind: 'RevealGeneralEffect', seatId: 'seat-d', slot: 'main' }]);
    expect(after.seats[3].allegiance).toBe('ambitionist');
    expect(after.result).toBeNull();
  });

  it('killing the blocking hidden seat ends the game for the revealed Kingdom', () => {
    const s = seats([['Wei', 'kingdom'], ['Wei', 'kingdom'], ['Wei', 'kingdom'], ['Wei', undefined, 'hidden'], ['Shu', 'kingdom', 'out'], ['Shu', 'kingdom', 'out']]);
    const after = h.run(s, [{ kind: 'EliminateSeatEffect', seatId: 'seat-d' }]);
    // Revealed by death into a full Kingdom it is an Ambitionist, but it is out: Wei is all that is left.
    expect(after.result).toMatchObject({ winningKingdom: 'Wei', winningSeatIds: ['seat-a', 'seat-b', 'seat-c'] });
  });
});

describe('Guozhan Ambitionists: small tables', () => {
  const h = harness(guozhanMode);
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  // `n` seats, every General hidden and every printed Kingdom Wei.
  const allWei = (n: number) =>
    table({}, {
      seats: n,
      kingdoms: Object.fromEntries(ids.slice(0, n).map((id) => [id, 'Wei' as const])),
      generals: Object.fromEntries(ids.slice(0, n).map((id) => [id, ['filler-xu-huang', 'filler-dong-zhuo', false] as [string, string, boolean]])),
    });
  const reveal = (s: GameState, seatId: string) => h.run(s, [{ kind: 'RevealGeneralEffect', seatId, slot: 'main' }]);
  const allegiances = (s: GameState) => s.seats.map((x) => x.allegiance);

  it('2 seats (cap 1): the second Wei is an Ambitionist', () => {
    const s = reveal(reveal(allWei(2), 'seat-a'), 'seat-b');
    expect(allegiances(s)).toEqual(['kingdom', 'ambitionist']);
    expect(s.result).toBeNull();
  });

  it('3 seats (cap 1): only the first Wei is a Kingdom seat', () => {
    const s = ['seat-a', 'seat-b', 'seat-c'].reduce(reveal, allWei(3));
    expect(allegiances(s)).toEqual(['kingdom', 'ambitionist', 'ambitionist']);
  });

  it('4 seats (cap 2): the third Wei is an Ambitionist', () => {
    const s = ['seat-a', 'seat-b', 'seat-c', 'seat-d'].reduce(reveal, allWei(4));
    expect(allegiances(s)).toEqual(['kingdom', 'kingdom', 'ambitionist', 'ambitionist']);
  });

  it('4 seats: two Wei and two others, the two Wei win as a Kingdom once the others are out', () => {
    const base = allWei(4);
    const s0 = { ...base, seats: base.seats.map((x, i) => (i >= 2 ? { ...x, kingdom: 'Shu' as const } : x)) };
    let s = ['seat-a', 'seat-b', 'seat-c', 'seat-d'].reduce(reveal, s0);
    expect(allegiances(s)).toEqual(['kingdom', 'kingdom', 'kingdom', 'kingdom']);
    s = h.run(s, [{ kind: 'EliminateSeatEffect', seatId: 'seat-c' }, { kind: 'EliminateSeatEffect', seatId: 'seat-d' }]);
    expect(s.result).toMatchObject({ winningKingdom: 'Wei', winningSeatIds: ['seat-a', 'seat-b'] });
  });

  it('2 seats: an Ambitionist wins as the last survivor, with no winning Kingdom', () => {
    let s = reveal(reveal(allWei(2), 'seat-a'), 'seat-b');
    s = h.run(s, [{ kind: 'EliminateSeatEffect', seatId: 'seat-a' }]);
    expect(s.result).toMatchObject({ winningSeatIds: ['seat-b'] });
    expect(s.result!.winningKingdom).toBeUndefined();
  });
});
