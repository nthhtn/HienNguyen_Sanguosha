import { CardInstance, CardZone, EngineEvent, usedCardOf } from 'engine';
import { actionHistory } from './action-history';

const zones: CardZone[] = [
  { id: 'drawPile', kind: 'drawPile', cards: [] },
  { id: 'discardPile', kind: 'discardPile', cards: [] },
  ...['seat-0', 'seat-1'].flatMap((id) => [
    { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
  ]),
];

const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
const shan: CardInstance = { instanceId: 'shan-1', definitionId: 'shan', suit: 'heart', rank: 2 };
const duel: CardInstance = { instanceId: 'duel-1', definitionId: 'duel', suit: 'spade', rank: 1 };
const lion: CardInstance = { instanceId: 'lion-1', definitionId: 'silver-lion', suit: 'club', rank: 1 };
const blade: CardInstance = { instanceId: 'blade-1', definitionId: 'green-dragon-blade', suit: 'spade', rank: 5 };
const peach: CardInstance = { instanceId: 'peach-1', definitionId: 'peach', suit: 'heart', rank: 12 };

const move = (card: CardInstance, fromZoneId: string, toZoneId: string): EngineEvent => ({
  kind: 'CardMovedEvent', cardInstanceId: card.instanceId, fromZoneId, toZoneId, card,
});
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });
const texts = (log: EngineEvent[]) =>
  actionHistory(log, zones).map((e) => (e.kind === 'turn' ? `— Turn ${e.turnNumber} · ${e.seatName}` : e.text));

describe('actionHistory', () => {
  it('says who used which card on whom, and what a response answered', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(shan), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'sha-1' } },
      move(shan, 'seat-1:hand', 'discardPile'),
      move(sha, 'seat-0:hand', 'discardPile'),
    ];
    expect(texts(log)).toEqual([
      'Seat 1 used Shan (2 ♥) against Seat 0\'s Sha',
      'Seat 0 used Sha (7 ♠) on Seat 1',
    ]);
  });

  it('names damage with its source, and a Duel answered with a Sha', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(duel), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'duel-1' } },
      { kind: 'DamageDealtEvent', damage: { source: seat('seat-1'), target: seat('seat-0'), amount: 2, nature: 'normal' } },
      { kind: 'DamageDealtEvent', damage: { source: null, target: seat('seat-0'), amount: 3, nature: 'thunder' } },
    ];
    expect(texts(log)).toEqual([
      'Seat 0 took 3 thunder damage',
      'Seat 0 took 2 damage from Seat 1',
      "Seat 1 used Sha (7 ♠) against Seat 0's Duel",
      'Seat 0 used Duel (A ♠) on Seat 1',
    ]);
  });

  it('tells equips, untargeted uses, Discard-phase discards and replaced equipment apart', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(lion), targets: [] },
      move(blade, 'seat-0:equip', 'discardPile'),
      move(lion, 'seat-0:hand', 'seat-0:equip'),
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(peach), targets: [] },
      { kind: 'HealEvent', target: seat('seat-0'), amount: 1 },
      move(peach, 'seat-0:hand', 'discardPile'),
      move(sha, 'seat-0:hand', 'discardPile'),
    ];
    expect(texts(log)).toEqual([
      'Seat 0 discarded Sha (7 ♠)',
      'Seat 0 recovered 1 health',
      'Seat 0 used Peach (Q ♥)',
      "Seat 0's Green Dragon Blade was discarded",
      'Seat 0 equipped Silver Lion (A ♣)',
    ]);
  });

  it('marks each turn, turn 1 included, and leaves phase changes out', () => {
    const log: EngineEvent[] = [
      { kind: 'GeneralsChosenEvent', seatId: 'seat-0' },
      { kind: 'PhaseChangedEvent', seatId: 'seat-0', phase: 'Start' },
      { kind: 'CardsDrawnEvent', seatId: 'seat-0', cardInstanceIds: ['a', 'b'] },
      { kind: 'PhaseChangedEvent', seatId: 'seat-0', phase: 'Play' },
      { kind: 'TurnAdvancedEvent', seatId: 'seat-1', turnNumber: 2 },
      { kind: 'PhaseChangedEvent', seatId: 'seat-1', phase: 'Start' },
      { kind: 'DiscardPileReshuffledEvent', cardCount: 9 },
      { kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['c'] },
    ];
    expect(texts(log)).toEqual([
      'Seat 1 drew 1 card',
      'The discard pile (9) was shuffled into the draw pile',
      '— Turn 2 · Seat 1',
      'Seat 0 drew 2 cards',
      '— Turn 1 · Seat 0',
      'Seat 0 chose their generals',
    ]);
  });

  it('uses the players’ names wherever a seat appears', () => {
    const players = [
      { id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot' as const, name: 'Seat 1' },
    ];
    const log: EngineEvent[] = [
      { kind: 'TurnAdvancedEvent', seatId: 'seat-0', turnNumber: 4 },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(shan), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'sha-1' } },
      { kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'deputy' },
    ];
    expect(actionHistory(log, zones, players).map((e) => (e.kind === 'turn' ? `Turn ${e.turnNumber} · ${e.seatName}` : e.text))).toEqual([
      'Hing revealed their Deputy General',
      "Seat 1 used Shan (2 ♥) against Hing's Sha",
      'Hing used Sha (7 ♠) on Seat 1',
      'Turn 4 · Hing',
    ]);
  });

  it('says whose Tool a Wuxie Kongjie cancelled, on whom, and when it cancelled another Wuxie Kongjie', () => {
    const players = [
      { id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot' as const, name: 'Seat 1' },
      { id: 'p2', seatId: 'seat-2', kind: 'bot' as const, name: 'Seat 2' },
    ];
    const barbarians: CardInstance = { instanceId: 'barb-1', definitionId: 'barbarians', suit: 'spade', rank: 7 };
    const drawTwo: CardInstance = { instanceId: 'dt-1', definitionId: 'draw-two', suit: 'heart', rank: 7 };
    const wuxie: CardInstance = { instanceId: 'wx-1', definitionId: 'wuxie', suit: 'spade', rank: 11 };
    const counter: CardInstance = { instanceId: 'wx-2', definitionId: 'wuxie', suit: 'club', rank: 3 };
    const lines = (log: EngineEvent[]) => actionHistory(log, zones, players).map((e) => (e.kind === 'turn' ? '' : e.text));

    expect(lines([
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(barbarians), targets: [] },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(wuxie), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'barb-1', targetSeatId: 'seat-2' } },
      { kind: 'CardPlayedEvent', seatId: 'seat-2', card: usedCardOf(counter), targets: [], inResponseTo: { seatId: 'seat-0', counters: true } },
    ])).toEqual([
      "Seat 2 cancelled Hing's Wuxie with Wuxie (3 ♣)",
      "Hing cancelled Seat 1's Barbarians on Seat 2 with Wuxie (J ♠)",
      'Seat 1 used Barbarians (7 ♠)',
    ]);
    expect(lines([
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(drawTwo), targets: [] },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(wuxie), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'dt-1', targetSeatId: 'seat-1' } },
    ])[0]).toBe("Hing cancelled Seat 1's Draw Two with Wuxie (J ♠)");
  });

  describe('picks and handed-over cards', () => {
    const players = [
      { id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot' as const, name: 'Seat 1' },
    ];
    const withProcessing = [...zones, { id: 'processing', kind: 'processing' as const, cards: [] }];
    const lines = (log: EngineEvent[]) => actionHistory(log, withProcessing, players).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
    const reason = (as: string) => ({ kind: 'choice' as const, card: { as, colour: 'black' as const, physical: [] }, userSeatId: 'seat-1', targetSeatId: 'seat-0' });

    it('says what a Steal took, by face when worn, unnamed from the hand', () => {
      expect(lines([
        { kind: 'ChoiceMadeEvent', seatId: 'seat-1', reason: reason('steal'), verb: 'take', shows: { kind: 'card', card: lion } },
        { kind: 'CardMovedEvent', cardInstanceId: 'lion-1', fromZoneId: 'seat-0:equip', toZoneId: 'seat-1:hand' },
      ])).toEqual(["Seat 1 took Hing's Silver Lion (A ♣) with Steal"]);
      expect(lines([
        { kind: 'ChoiceMadeEvent', seatId: 'seat-1', reason: reason('steal'), verb: 'take', shows: { kind: 'hidden-hand', seatId: 'seat-0', count: 2 } },
        { kind: 'CardMovedEvent', cardInstanceId: 'x', fromZoneId: 'seat-0:hand', toZoneId: 'seat-1:hand' },
      ])).toEqual(['Seat 1 took a hand card from Hing with Steal']);
    });

    it('names a card broken from the hand, since the discard shows it', () => {
      expect(lines([
        { kind: 'ChoiceMadeEvent', seatId: 'seat-1', reason: reason('break'), verb: 'discard', shows: { kind: 'hidden-hand', seatId: 'seat-0', count: 2 } },
        move(sha, 'seat-0:hand', 'discardPile'),
      ])).toEqual(["Seat 1 discarded Sha (7 ♠) from Hing's hand with Break"]);
    });

    it('tells the Harvest: what was turned up, and who took what', () => {
      expect(lines([
        { kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [peach, sha] },
        {
          kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', shows: { kind: 'card', card: peach },
          reason: { kind: 'choice', card: { as: 'harvest', colour: 'red', physical: [] }, userSeatId: 'seat-0' },
        },
        { kind: 'CardMovedEvent', cardInstanceId: 'peach-1', fromZoneId: 'processing', toZoneId: 'seat-0:hand' },
      ])).toEqual(['Hing took Peach (Q ♥) with Harvest', 'Turned up 2 cards: Peach (Q ♥), Sha (7 ♠)']);
    });

    it('says who took a worn card handed over (Coerce’s weapon)', () => {
      expect(lines([
        move(blade, 'seat-1:hand', 'seat-1:equip'),
        { kind: 'CardMovedEvent', cardInstanceId: 'blade-1', fromZoneId: 'seat-1:equip', toZoneId: 'seat-0:hand' },
      ])).toEqual(["Hing took Seat 1's Green Dragon Blade (5 ♠)"]);
    });
  });

  it('tells the story of a dying seat: dying, the Peach that saved it, and saved', () => {
    const log: EngineEvent[] = [
      { kind: 'SeatDyingEvent', seatId: 'seat-1' },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(peach), targets: [], inResponseTo: { dyingSeatId: 'seat-1' } },
      { kind: 'HealEvent', target: seat('seat-1'), amount: 1 },
      { kind: 'SeatSavedEvent', seatId: 'seat-1' },
      { kind: 'SeatDyingEvent', seatId: 'seat-0' },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf({ ...peach, instanceId: 'peach-2' }), targets: [], inResponseTo: { dyingSeatId: 'seat-0' } },
    ];
    expect(texts(log)).toEqual([
      'Seat 0 used Peach (Q ♥) to save themselves',
      'Seat 0 is dying',
      'Seat 1 was saved',
      'Seat 1 recovered 1 health',
      'Seat 0 used Peach (Q ♥) to save Seat 1',
      'Seat 1 is dying',
    ]);
  });

  it('colours a line about a player’s status in that player’s force, and no other line', () => {
    const seats = [
      { id: 'seat-0', index: 0, kingdom: 'Shu' as const }, { id: 'seat-1', index: 1, kingdom: 'hidden' as const },
    ].map((s) => ({ ...s, eliminated: false, combinedHp: 3, maxCombinedHp: 4, generals: null, hand: { zoneId: `${s.id}:hand` }, equipped: { zoneId: `${s.id}:equip` }, judgment: { zoneId: `${s.id}:judgment` } }));
    const entries = actionHistory([
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [seat('seat-0')] },
      { kind: 'DamageDealtEvent', damage: { source: seat('seat-1'), target: seat('seat-0'), amount: 1, nature: 'normal' } },
      { kind: 'SeatDyingEvent', seatId: 'seat-0' },
      { kind: 'SeatEliminatedEvent', seatId: 'seat-1' },
    ], zones, [], seats);
    expect(entries.map((e) => (e.kind === 'action' ? [e.text, e.force ?? null] : null))).toEqual([
      ['Seat 1 was eliminated', 'none'],
      ['Seat 0 is dying', 'Shu'],
      ['Seat 0 took 1 damage from Seat 1', 'Shu'],
      ['Seat 1 used Sha (7 ♠) on Seat 0', null],
    ]);
  });

  it('keeps the card on each card line, and none on the others', () => {
    const entries = actionHistory([
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      { kind: 'SeatEliminatedEvent', seatId: 'seat-1' },
    ], zones);
    expect(entries).toEqual([
      { kind: 'action', text: 'Seat 1 was eliminated', card: null, force: 'none' },
      { kind: 'action', text: 'Seat 0 used Sha (7 ♠) on Seat 1', card: sha },
    ]);
  });
});

describe('actionHistory: judgments', () => {
  const judgmentZones: CardZone[] = [
    ...zones,
    { id: 'processing', kind: 'processing', cards: [] },
    { id: 'seat-0:judgment', kind: 'judgment', ownerSeatId: 'seat-0', cards: [] },
    { id: 'seat-1:judgment', kind: 'judgment', ownerSeatId: 'seat-1', cards: [] },
  ];
  const lines = (log: EngineEvent[]) => actionHistory(log, judgmentZones).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
  const lightning: CardInstance = { instanceId: 'L', definitionId: 'lightning', suit: 'spade', rank: 1 };
  const capture: CardInstance = { instanceId: 'cap', definitionId: 'capture', suit: 'heart', rank: 6 };
  const judged: CardInstance = { instanceId: 'j1', definitionId: 'shan', suit: 'heart', rank: 5 };
  const used = (card: CardInstance) => ({ as: card.definitionId, colour: 'black' as const, suit: card.suit, rank: card.rank, physical: [card] });

  it('tells the judgment, the skipped phase, and the delayed Tool discarded', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(capture), targets: [seat('seat-0')] },
      move(capture, 'seat-1:hand', 'seat-0:judgment'),
      { kind: 'JudgmentEvent', seatId: 'seat-0', tool: used(capture), card: judged },
      move(judged, 'processing', 'discardPile'),
      move(capture, 'seat-0:judgment', 'discardPile'),
      { kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'Play' },
    ];
    expect(lines(log)).toEqual([
      'Seat 0 skipped the Play Phase',
      "Seat 0's Capture was discarded",
      "Seat 0's Capture judgment: 5 ♥",
      'Seat 1 used Capture (6 ♥) on Seat 0',
    ]);
  });

  it('says where Lightning moved on to', () => {
    expect(lines([move(lightning, 'seat-0:judgment', 'seat-1:judgment')])).toEqual(['Lightning (A ♠) moved on from Seat 0 to Seat 1']);
  });
});
