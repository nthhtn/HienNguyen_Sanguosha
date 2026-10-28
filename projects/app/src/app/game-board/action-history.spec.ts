import { CardInstance, CardZone, EngineEvent, Seat, usedCardFrom, usedCardOf } from 'engine';
import { actionHistory, latestSequence } from './action-history';

const zones: CardZone[] = [
  { id: 'drawPile', kind: 'drawPile', cards: [] },
  { id: 'discardPile', kind: 'discardPile', cards: [] },
  ...['seat-0', 'seat-1'].flatMap((id) => [
    { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:pile`, kind: 'pile' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:stash`, kind: 'pile' as const, ownerSeatId: id, cards: [] },
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
      'Seat 1 used Dodge (2 ♥) against Seat 0\'s Slash',
      'Seat 0 used Slash (7 ♠) on Seat 1',
    ]);
  });

  it('names damage with its source, and a Duel answered with a Slash', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(duel), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'duel-1' } },
      { kind: 'DamageDealtEvent', damage: { source: seat('seat-1'), target: seat('seat-0'), amount: 2, nature: 'normal' } },
      { kind: 'DamageDealtEvent', damage: { source: null, target: seat('seat-0'), amount: 3, nature: 'thunder' } },
    ];
    expect(texts(log)).toEqual([
      'Seat 0 took 3 thunder damage',
      'Seat 0 took 2 damage from Seat 1',
      "Seat 1 used Slash (7 ♠) against Seat 0's Duel",
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
      'Seat 0 discarded Slash (7 ♠)',
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
      "Seat 1 used Dodge (2 ♥) against Hing's Slash",
      'Hing used Slash (7 ♠) on Seat 1',
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
      ])).toEqual(["Seat 1 discarded Slash (7 ♠) from Hing's hand with Break"]);
    });

    it('tells the Harvest: what was turned up, and who took what', () => {
      expect(lines([
        { kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [peach, sha] },
        {
          kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', shows: { kind: 'card', card: peach },
          reason: { kind: 'choice', card: { as: 'harvest', colour: 'red', physical: [] }, userSeatId: 'seat-0' },
        },
        { kind: 'CardMovedEvent', cardInstanceId: 'peach-1', fromZoneId: 'processing', toZoneId: 'seat-0:hand' },
      ])).toEqual(['Hing took Peach (Q ♥) with Harvest', 'Turned up 2 cards: Peach (Q ♥), Slash (7 ♠)']);
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
      ['Seat 1 used Slash (7 ♠) on Seat 0', null],
    ]);
  });

  it('keeps the card on each card line, and none on the others', () => {
    const entries = actionHistory([
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      { kind: 'SeatEliminatedEvent', seatId: 'seat-1' },
    ], zones);
    expect(entries).toEqual([
      { kind: 'action', text: 'Seat 1 was eliminated', card: null, force: 'none' },
      { kind: 'action', text: 'Seat 0 used Slash (7 ♠) on Seat 1', card: sha, starts: true },
    ]);
  });
});

describe('latestSequence', () => {
  const sequence = (log: EngineEvent[]) => latestSequence(actionHistory(log, zones)).map((e) => e.text);
  const phase = (phase: 'Judgment' | 'Draw' | 'Play' | 'Discard', seatId = 'seat-0'): EngineEvent => ({ kind: 'PhaseChangedEvent', seatId, phase });

  it('is empty before anything has happened', () => {
    expect(sequence([])).toEqual([]);
    expect(sequence([phase('Play')])).toEqual([]);
  });

  it('is the latest card played on its user\'s own initiative, and everything that answered or followed it, oldest first', () => {
    const log: EngineEvent[] = [
      phase('Play'),
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(duel), targets: [seat('seat-1')] },
      { kind: 'DamageDealtEvent', damage: { source: seat('seat-0'), target: seat('seat-1'), amount: 1, nature: 'normal' } },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(shan), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'sha-1' } },
    ];
    expect(sequence(log)).toEqual(['Seat 0 used Slash (7 ♠) on Seat 1', "Seat 1 used Dodge (2 ♥) against Seat 0's Slash"]);
  });

  it('keeps a dying seat\'s rescue in the sequence that brought it down', () => {
    const log: EngineEvent[] = [
      phase('Play'),
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      { kind: 'DamageDealtEvent', damage: { source: seat('seat-0'), target: seat('seat-1'), amount: 1, nature: 'normal' } },
      { kind: 'SeatDyingEvent', seatId: 'seat-1' },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(peach), targets: [], inResponseTo: { dyingSeatId: 'seat-1' } },
      { kind: 'SeatSavedEvent', seatId: 'seat-1' },
    ];
    expect(sequence(log)).toEqual([
      'Seat 0 used Slash (7 ♠) on Seat 1',
      'Seat 1 took 1 damage from Seat 0',
      'Seat 1 is dying',
      'Seat 1 used Peach (Q ♥) to save themselves',
      'Seat 1 was saved',
    ]);
  });

  it('starts afresh with each phase: a Draw Phase draw, a Discard Phase\'s discards', () => {
    const drawn: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      phase('Draw'),
      { kind: 'CardsDrawnEvent', seatId: 'seat-0', cardInstanceIds: ['a', 'b'] },
    ];
    expect(sequence(drawn)).toEqual(['Seat 0 drew 2 cards']);
    const discarded: EngineEvent[] = [
      ...drawn,
      phase('Discard'),
      move(duel, 'seat-0:hand', 'discardPile'),
      move(shan, 'seat-0:hand', 'discardPile'),
    ];
    expect(sequence(discarded)).toEqual(['Seat 0 discarded Duel (A ♠)', 'Seat 0 discarded Dodge (2 ♥)']);
  });

  it('keeps showing the latest sequence until the next one starts', () => {
    const log: EngineEvent[] = [
      phase('Play'),
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      phase('Discard'),
      { kind: 'TurnAdvancedEvent', seatId: 'seat-1', turnNumber: 2 },
    ];
    expect(sequence(log)).toEqual(['Seat 0 used Slash (7 ♠) on Seat 1']);
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
      { kind: 'JudgmentEvent', seatId: 'seat-0', reader: { kind: 'card', card: used(capture) }, card: judged },
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

describe('equipment abilities in the history', () => {
  const owner = (seatId: string, cardInstanceId: string) => ({ kind: 'equipment' as const, seatId, cardInstanceId });
  const h1: CardInstance = { instanceId: 'h1', definitionId: 'peach', suit: 'heart', rank: 3 };
  const c1: CardInstance = { instanceId: 'c1', definitionId: 'duel', suit: 'club', rank: 4 };

  it('names a Slash made from 2 cards, and where it came from', () => {
    const used = usedCardFrom([h1, c1], 'sha', { owner: owner('seat-0', 'sp'), abilityId: 'serpent-spear', conversionId: 'serpent-spear' });
    expect(texts([{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: used, targets: [seat('seat-1')] }])).toContain('Seat 0 used 2 cards as Slash (Serpent Spear) on Seat 1');
  });

  it('says when an armour stops a Slash', () => {
    expect(texts([{ kind: 'AbilityUsedEvent', owner: owner('seat-1', 'bs'), abilityId: 'black-shield', outcome: 'no-effect', targetSeatId: 'seat-0' }])).toContain(
      "Seat 1's Black Shield: Seat 0's Slash has no effect"
    );
  });

  it('names the card a skill cancelled (Kingdom Wars Humility, Behind the Curtain)', () => {
    const general = (skillId: string) => ({ kind: 'general' as const, seatId: 'seat-1', slot: 'main' as const, skillId });
    for (const [skillId, cardId, text] of [
      ['kingdomWars:humility', 'steal', "Seat 1's Humility: Seat 0's Steal has no effect"],
      ['kingdomWars:behind-the-curtain', 'duel', "Seat 1's Behind the Curtain: Seat 0's Duel has no effect"],
    ]) {
      expect(texts([{ kind: 'AbilityUsedEvent', owner: general(skillId), abilityId: skillId, outcome: 'no-effect', targetSeatId: 'seat-0', cardId }])).toContain(text);
    }
  });

  it('adds "counts as Dodge" to an Eight Trigrams judgment', () => {
    const judged: CardInstance = { instanceId: 'j', definitionId: 'peach', suit: 'heart', rank: 9 };
    const log: EngineEvent[] = [
      { kind: 'JudgmentEvent', seatId: 'seat-1', reader: { kind: 'card', card: usedCardOf({ instanceId: 'et', definitionId: 'eight-trigrams', suit: 'spade', rank: 2 }) }, card: judged },
      { kind: 'AbilityUsedEvent', owner: owner('seat-1', 'et'), abilityId: 'eight-trigrams', outcome: 'counts-as-shan' },
    ];
    expect(texts(log)).toEqual(["Seat 1's Eight Trigrams judgment: 9 ♥, Counts as Dodge"]);
  });

  it('says who used an ability, on whom; a Don’t says nothing', () => {
    const made = (shows: { kind: 'use' } | { kind: 'decline' }): EngineEvent => ({
      kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'use', shows,
      reason: { kind: 'ability', owner: owner('seat-0', 'ax'), abilityId: 'axe', targetSeatId: 'seat-1' },
    });
    expect(texts([made({ kind: 'use' })])).toEqual(['Seat 0 used Axe on Seat 1']);
    expect(texts([made({ kind: 'decline' })])).toEqual([]);
  });

  it('Gender Swords’ target: letting the user draw, or discarding its own card', () => {
    const reason = { kind: 'choice' as const, card: usedCardOf({ instanceId: 'gs', definitionId: 'gender-swords', suit: 'spade', rank: 2 }), userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    expect(texts([{ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'discard', reason, shows: { kind: 'decline' } }])).toEqual(['Seat 0 let Seat 1 draw a card (Gender Swords)']);
    const discard: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'discard', reason, shows: { kind: 'card', card: h1 } },
      move(h1, 'seat-0:hand', 'discardPile'),
    ];
    expect(texts(discard)).toEqual(['Seat 0 discarded Peach (3 ♥) with Gender Swords']);
  });

  it('names the seats picked as extra targets', () => {
    const picked: EngineEvent = {
      kind: 'SelectionMadeEvent', seatId: 'seat-0', of: 'seats', ids: ['seat-1', 'seat-2'],
      reason: { kind: 'ability', owner: owner('seat-0', 'sk'), abilityId: 'sky-scorcher' },
    };
    expect(texts([picked])).toEqual(['Seat 0 picked Seat 1 and Seat 2 with Sky Scorcher']);
  });
});

describe('skill lines', () => {
  const general = (seatId: string, slot: 'main' | 'deputy', skillId: string) => ({ kind: 'general' as const, seatId, slot, skillId });
  const seats: Seat[] = [{
    id: 'seat-0', index: 0, kingdom: 'Shu', combinedHp: 3, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'liu-bei', revealed: false } },
    hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' },
  }];
  const lines = (log: EngineEvent[]) => actionHistory(log, zones, [], seats).flatMap((e) => (e.kind === 'action' ? [e.text] : []));

  it('a reveal to use a skill names the General and the skill, once', () => {
    expect(lines([
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'use', shows: { kind: 'use', reveals: 'main' }, reason: { kind: 'ability', owner: general('seat-0', 'main', 'fighting-saint'), abilityId: 'fighting-saint' } },
      { kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'main', forAbilityId: 'fighting-saint' },
    ])).toEqual(['Seat 0 revealed Guan Yu to use Fighting Saint']);
  });

  it('an active skill’s use, and HP lost to a skill', () => {
    expect(lines([
      { kind: 'AbilityUsedEvent', owner: general('seat-0', 'main', 'battered-body'), abilityId: 'battered-body', outcome: 'used' },
      { kind: 'HpLostEvent', seatId: 'seat-0', amount: 1, abilityId: 'battered-body' },
      { kind: 'HpLostEvent', seatId: 'seat-0', amount: 2 },
    ])).toEqual(['Seat 0 lost 2 HP', 'Seat 0 lost 1 HP (Battered Body)', 'Seat 0 used Battered Body']);
    expect(actionHistory([{ kind: 'HpLostEvent', seatId: 'seat-0', amount: 1 }], zones, [], seats)[0]).toMatchObject({ force: 'Shu' });
  });

  it('a changed judgment, and a skill’s judgment', () => {
    const three: CardInstance = { instanceId: 'r1', definitionId: 'sha', suit: 'spade', rank: 3 };
    const five: CardInstance = { instanceId: 'j1', definitionId: 'shan', suit: 'heart', rank: 5 };
    const history = actionHistory([
      { kind: 'JudgmentEvent', seatId: 'seat-1', reader: { kind: 'skill', owner: general('seat-1', 'main', 'unyielding') }, card: five },
      { kind: 'JudgmentChangedEvent', owner: general('seat-0', 'main', 'devil'), abilityId: 'devil', judgedSeatId: 'seat-1', card: three, replaced: five },
    ], zones, [], seats);
    expect(history.flatMap((e) => (e.kind === 'action' ? [e.text] : []))).toEqual(["Seat 0's Devil changed the judgment to 3 ♠", "Seat 1's Unyielding judgment: 5 ♥"]);
    expect(history[0]).toMatchObject({ card: three });
  });

  it('giving cards, picking a seat, naming a suit, choosing a label', () => {
    const reason = { kind: 'ability' as const, owner: general('seat-0', 'deputy', 'kindness'), abilityId: 'kindness' };
    expect(lines([
      { kind: 'SelectionMadeEvent', seatId: 'seat-0', reason, of: 'cards', ids: ['a', 'b'] },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'give', shows: { kind: 'seat', seatId: 'seat-1' }, reason },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'seat', seatId: 'seat-1' }, reason },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'pick', shows: { kind: 'suit', suit: 'heart' }, reason },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'label', text: 'Done' }, reason },
    ])).toEqual(['Seat 0 chose Done', 'Seat 1 named ♥', 'Seat 0 chose Seat 1', 'Seat 0 gave 2 cards to Seat 1']);
  });

  it('an arrangement of the draw pile, by its counts', () => {
    const reason = { kind: 'ability' as const, owner: general('seat-0', 'main', 'astrology'), abilityId: 'astrology' };
    expect(lines([
      { kind: 'ArrangementMadeEvent', seatId: 'seat-0', reason, top: 2, bottom: 1 },
      { kind: 'ArrangementMadeEvent', seatId: 'seat-0', reason, top: 3, bottom: 0 },
      { kind: 'ArrangementMadeEvent', seatId: 'seat-0', reason, top: 0, bottom: 1 },
    ])).toEqual([
      'Seat 0 put 1 card at the bottom of the draw pile',
      'Seat 0 put 3 cards on top of the draw pile',
      'Seat 0 put 2 cards on top of the draw pile and 1 at the bottom',
    ]);
  });
});

describe('actionHistory: the base Generals’ skills', () => {
  const general = (seatId: string, skillId: string) => ({ kind: 'general' as const, seatId, slot: 'main' as const, skillId });
  const used = (seatId: string, skillId: string, outcome: string, targetSeatId?: string): EngineEvent => ({
    kind: 'AbilityUsedEvent', owner: general(seatId, skillId), abilityId: skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}),
  });

  it('names a one-card conversion by the card, what it counted as, and the skill', () => {
    const red: CardInstance = { instanceId: 'r', definitionId: 'peach', suit: 'heart', rank: 9 };
    const via = { owner: general('seat-0', 'fighting-saint'), abilityId: 'fighting-saint', conversionId: 'fighting-saint' };
    expect(texts([{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardFrom([red], 'sha', via), targets: [seat('seat-1')] }])).toEqual([
      'Seat 0 used Peach (9 ♥) as Slash (Fighting Saint) on Seat 1',
    ]);
  });

  it('says what a skill did', () => {
    expect(texts([used('seat-0', 'linked-camps', 'used')])).toEqual(['Seat 0 used Linked Camps']);
    expect(texts([used('seat-0', 'bare-the-chest', 'more-damage', 'seat-1')])).toEqual(["Seat 0's Bare the Chest: 1 more damage"]);
    expect(texts([used('seat-0', 'iron-cavalry', 'unblockable', 'seat-1')])).toEqual(["Seat 0's Iron Cavalry: Seat 1 can't play a Dodge"]);
    expect(texts([used('seat-0', 'displace', 'moved', 'seat-1')])).toEqual(["Seat 0's Displace moved the Slash to Seat 1"]);
    expect(texts([used('seat-0', 'raid', 'took-hand-card', 'seat-1')])).toEqual(['Seat 0 took a hand card from Seat 1 (Raid)']);
  });

  it('says a shown card, and a card taken with a skill', () => {
    expect(texts([{ kind: 'CardShownEvent', seatId: 'seat-1', card: sha, abilityId: 'sow-revolt' }])).toEqual(['Seat 1 showed Slash (7 ♠)']);
    const took: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', reason: { kind: 'ability', owner: general('seat-0', 'feedback'), abilityId: 'feedback', targetSeatId: 'seat-1' }, shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 2 } },
      { kind: 'CardMovedEvent', cardInstanceId: 'x', fromZoneId: 'seat-1:hand', toZoneId: 'seat-0:hand' },
    ];
    expect(texts(took)).toEqual(['Seat 0 took a hand card from Seat 1 with Feedback']);
  });
});

describe('actionHistory: the Wind skills', () => {
  const general = (seatId: string, skillId: string) => ({ kind: 'general' as const, seatId, slot: 'main' as const, skillId });
  const used = (seatId: string, skillId: string, outcome: string): EngineEvent => ({ kind: 'AbilityUsedEvent', owner: general(seatId, skillId), abilityId: skillId, outcome });

  it('turning face down and up', () => {
    expect(texts([{ kind: 'SeatTurnedEvent', seatId: 'seat-0', faceDown: true }])).toEqual(['Seat 0 turned face down']);
    expect(texts([{ kind: 'SeatTurnedEvent', seatId: 'seat-0', faceDown: false, passedTurn: true }])).toEqual(['Seat 0 turned face up and passed the turn']);
  });

  it('Refusing Death', () => {
    expect(texts([move(sha, 'drawPile', 'seat-0:pile')])).toEqual(['Seat 0 put Slash (7 ♠) under their General']);
    const put = move(sha, 'drawPile', 'seat-0:pile');
    expect(texts([put, used('seat-0', 'refusing-death', 'stays-alive')]).slice(0, 1)).toEqual(["Seat 0's Refusing Death: 7 ♠ (no match)"]);
    expect(texts([put, used('seat-0', 'refusing-death', 'matched')]).slice(0, 1)).toEqual(["Seat 0's Refusing Death: 7 ♠ matched"]);
  });

  it('Fantasy says where the damage went, in place of the plain choice line', () => {
    const chose: EngineEvent = { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', reason: { kind: 'ability', owner: general('seat-0', 'fantasy'), abilityId: 'fantasy' }, shows: { kind: 'seat', seatId: 'seat-3' } };
    const moved: EngineEvent = { kind: 'AbilityUsedEvent', owner: general('seat-0', 'fantasy'), abilityId: 'fantasy', outcome: 'moved-damage', targetSeatId: 'seat-3' };
    expect(texts([chose, moved])).toEqual(["Seat 0's Fantasy moved the damage to Seat 3"]);
  });

  it('Bewilder', () => {
    const answer = (text: string): EngineEvent => ({
      kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'label', text },
      reason: { kind: 'ability', owner: general('seat-1', 'bewilder'), abilityId: 'bewilder', cardId: 'sha' },
    });
    expect(texts([answer('Doubt')])).toEqual(["Seat 0 doubted Seat 1's Slash"]);
    expect(texts([answer('Believe')])).toEqual(["Seat 0 believed Seat 1's Slash"]);
    expect(texts([{ kind: 'AbilityUsedEvent', owner: general('seat-1', 'bewilder'), abilityId: 'bewilder', outcome: 'claim-true', cardId: 'sha' }])).toEqual(["Seat 1's Slash was true"]);
    expect(texts([{ kind: 'AbilityUsedEvent', owner: general('seat-1', 'bewilder'), abilityId: 'bewilder', outcome: 'claim-false', cardId: 'sha' }])).toEqual(["Seat 1's Slash was a bluff"]);
    expect(texts([{ kind: 'AbilityUsedEvent', owner: general('seat-1', 'bewilder'), abilityId: 'bewilder', outcome: 'claim-believed', cardId: 'sha' }])).toEqual([]);
  });

  describe('Fire Generals', () => {
    const nine: CardInstance = { instanceId: 'n', definitionId: 'shan', suit: 'spade', rank: 9 };
    const seven: CardInstance = { instanceId: 's', definitionId: 'sha', suit: 'heart', rank: 7 };
    const competed = (skillId: string, outcome: 'compete-won' | 'compete-lost'): EngineEvent[] => [
      { kind: 'CardShownEvent', seatId: 'seat-0', card: nine, abilityId: skillId },
      { kind: 'CardShownEvent', seatId: 'seat-1', card: seven, abilityId: skillId },
      { kind: 'AbilityUsedEvent', owner: general('seat-0', skillId), abilityId: skillId, outcome, targetSeatId: 'seat-1' },
    ];

    it('one line for competing, naming both cards and the winner', () => {
      expect(texts(competed('rouse-the-tiger', 'compete-won'))).toEqual(['Seat 0 competed with Seat 1: 9 ♠ against 7 ♥, Seat 0 won']);
      expect(texts(competed('rouse-the-tiger', 'compete-lost'))).toEqual(['Seat 0 competed with Seat 1: 9 ♠ against 7 ♥, Seat 1 won']);
    });

    it("Heaven's Justice says what the win or loss means", () => {
      expect(texts(competed('heavens-justice', 'compete-won'))).toEqual([
        "Seat 0's Heaven's Justice: one more Slash this turn, at any distance, with one more target",
        'Seat 0 competed with Seat 1: 9 ♠ against 7 ♥, Seat 0 won',
      ]);
      expect(texts(competed('heavens-justice', 'compete-lost'))[0]).toBe("Seat 0's Heaven's Justice: no Slash this turn");
    });

    it('Nirvana, Assault, Eternal Loyalty, Dueling Heroes and Sudden Attack', () => {
      const line = (skillId: string, outcome: string, targetSeatId?: string) =>
        texts([{ kind: 'AbilityUsedEvent', owner: general('seat-0', skillId), abilityId: skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}) }]);
      expect(line('nirvana', 'reborn')).toEqual(['Seat 0 used Nirvana: discards every card, draws 3, recovers to 3 HP and turns face up']);
      expect(line('assault', 'paid-weapon')).toEqual(['Seat 0 discarded a Weapon for Assault']);
      expect(line('assault', 'paid-hp')).toEqual([]); // the HP line says it
      expect(line('assault', 'struck', 'seat-1')).toEqual(['Seat 0 struck Seat 1 with Assault']);
      expect(line('eternal-loyalty', 'drew-up', 'seat-1')).toEqual(["Seat 0's Eternal Loyalty: Seat 1 draws up to its max HP"]);
      expect(line('dueling-heroes', 'judged-red')).toEqual(["Seat 0's Dueling Heroes: black hand cards can be used as Duel this turn"]);
      expect(line('dueling-heroes', 'judged-black')).toEqual(["Seat 0's Dueling Heroes: red hand cards can be used as Duel this turn"]);
      expect(line('sudden-attack', 'discarded', 'seat-1')).toEqual(["Seat 0's Sudden Attack: discards one of Seat 1's cards"]);
      expect(line('shackle', 'recast')).toEqual(['Seat 0 recast a club with Shackle']);
    });

    it('the Forest skills', () => {
      const line = (skillId: string, outcome: string, targetSeatId?: string) =>
        texts([{ kind: 'AbilityUsedEvent', owner: general('seat-0', skillId), abilityId: skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}) }]);
      expect(line('unnatural-death', 'took-cards', 'seat-1')).toEqual(["Seat 0 took all of Seat 1's cards (Unnatural Death)"]);
      expect(line('exile', 'exiled', 'seat-1')).toEqual(["Seat 0's Exile: Seat 1 turns over and draws cards"]);
      expect(line('resurgence', 'revealed')).toEqual(['Seat 0 used Resurgence']);
      expect(line('culprit', 'culprit', 'seat-1')).toEqual(["Seat 0's Culprit: the damage to Seat 1 counts as theirs"]);
      expect(line('giant-elephant', 'took-card')).toEqual(["Seat 0's Giant Elephant: took the Tool card"]);
      expect(line('brave-spirit', 'drew', 'seat-1')).toEqual(["Seat 0's Brave Spirit: Seat 1 draws and discards"]);
      expect(line('charity', 'gave', 'seat-1')).toEqual(['Seat 0 gave half of their hand to Seat 1 (Charity)']);
      expect(line('collapse', 'collapsed')).toEqual(['Seat 0 lost 1 HP to Collapse']);
      expect(line('collapse', 'collapsed-max')).toEqual(["Seat 0 reduced their max HP with Collapse"]);
      expect(line('upheaval', 'used')).toEqual(['Seat 0 used Upheaval: every other seat plays a Slash or loses 1 HP']);
      expect(texts([
        { kind: 'AbilityUsedEvent', owner: general('seat-0', 'alliance'), abilityId: 'alliance', outcome: 'swap-first', targetSeatId: 'seat-1' },
        { kind: 'AbilityUsedEvent', owner: general('seat-0', 'alliance'), abilityId: 'alliance', outcome: 'swapped', targetSeatId: 'seat-2' },
      ])).toEqual(['Seat 1 and Seat 2 swapped hands (Alliance)']);
    });

    it('the Mountain skills', () => {
      const line = (skillId: string, outcome: string, targetSeatId?: string) =>
        texts([{ kind: 'AbilityUsedEvent', owner: general('seat-0', skillId), abilityId: skillId, outcome, ...(targetSeatId ? { targetSeatId } : {}) }]);
      expect(line('clever-change', 'skipped-judgment')).toEqual(['Seat 0 skipped their Judgment Phase with Clever Change']);
      expect(line('clever-change', 'skipped-draw')).toEqual(['Seat 0 skipped their Draw Phase with Clever Change']);
      expect(line('clever-change', 'skipped-play')).toEqual(['Seat 0 skipped their Play Phase with Clever Change']);
      expect(line('clever-change', 'skipped-discard')).toEqual(['Seat 0 skipped their Discard Phase with Clever Change']);
      expect(line('clever-change', 'moved-card', 'seat-1')).toEqual(['Seat 0 moved a card to Seat 1 (Clever Change)']);
      expect(line('military-farm', 'farmed')).toEqual(["Seat 0's Military Farm: the judged card becomes a Farm"]);
      expect(line('strategic-pass', 'awakened')).toEqual(['Seat 0 awakened: Strategic Pass']);
      expect(line('pleasure', 'paid', 'seat-1')).toEqual(["Seat 1 discarded a Basic card for Seat 0's Pleasure"]);
      expect(line('decentralization', 'extra-turn', 'seat-1')).toEqual(['Seat 0 gave Seat 1 an extra turn (Decentralization)']);
      expect(line('passion', 'drew')).toEqual(['Seat 0 drew a card (Passion)']);
      expect(line('direct-instruction', 'placed', 'seat-1')).toEqual(["Seat 0 placed an Equipment card in Seat 1's equipment (Direct Instruction)"]);
      expect(line('stubborn', 'gave-back', 'seat-1')).toEqual(['Seat 0 gave a discarded card back to Seat 1 and took the rest (Stubborn)']);
      expect(line('lament', 'lamented', 'seat-1')).toEqual(["Seat 0's Lament: Seat 1 judges"]);
      expect(line('heartbroken', 'silenced', 'seat-1')).toEqual(['Seat 1 loses all skills (Heartbroken)']);
      expect(line('kingdomWars:sorrow', 'silenced-main', 'seat-1')).toEqual(["Seat 1's Main General loses all skills (Sorrow)"]);
      expect(line('kingdomWars:sorrow', 'silenced-deputy', 'seat-1')).toEqual(["Seat 1's Deputy General loses all skills (Sorrow)"]);
      expect(line('new-life', 'new-form')).toEqual(['Seat 0 gained a Form (New Life)']);
      expect(texts([{ kind: 'SkillGainedEvent', seatId: 'seat-0', slot: 'main', skillId: 'astrology' }])).toEqual(['Seat 0 gained Astrology']);
      expect(texts([{ kind: 'FormChosenEvent', seatId: 'seat-0', generalId: 'zhou-yu', skillId: 'brave-gesture' }])).toEqual(['Seat 0 chose Brave Gesture from Zhou Yu']);
      // The events these lines already say.
      expect(texts([{ kind: 'SeatSilencedEvent', seatId: 'seat-1' }, { kind: 'SeatSilencedEvent', seatId: 'seat-1', slot: 'main' }, { kind: 'ExtraTurnGrantedEvent', seatId: 'seat-1' }])).toEqual([]);
    });


    it('max HP reduced', () => {
      expect(texts([{ kind: 'MaxHpReducedEvent', seatId: 'seat-0', amount: 1, maxHp: 3 }])).toEqual(['Seat 0 now has a max HP of 3']);
    });
  });
});


describe('actionHistory: elemental Slash, Chains and chain toggles', () => {
  const players = [0, 1, 2].map((i) => ({ id: `p${i}`, seatId: `seat-${i}`, kind: 'human' as const, name: i === 0 ? 'Hing' : `Seat ${i}` }));
  const lines = (log: EngineEvent[]) => actionHistory(log, zones, players).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
  const fire: CardInstance = { instanceId: 'fa-1', definitionId: 'fire-attack', suit: 'heart', rank: 4 };
  const chains: CardInstance = { instanceId: 'ch-1', definitionId: 'chains', suit: 'club', rank: 12 };
  // A Fire Attack is played as a Slash with the fire nature.
  const fireAsSha = { ...usedCardOf(fire), as: 'sha', nature: 'fire' as const };

  it('names a played Fire Attack by its own name, and a Dodge against it', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: fireAsSha, targets: [seat('seat-0')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(shan), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'fa-1' } },
    ];
    expect(lines(log)).toEqual(["Hing used Dodge (2 ♥) against Seat 1's Fire Attack", 'Seat 1 used Fire Attack (4 ♥) on Hing']);
  });

  it('says a Chains Recast is a recast, not a use', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(chains), targets: [] },
      move(chains, 'seat-1:hand', 'discardPile'),
      { kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['x'] },
    ];
    expect(lines(log)).toEqual(['Seat 1 drew 1 card', 'Seat 1 recast Chains (Q ♣)']);
  });

  it('says an Ascertain Recast is a recast, and an Ascertain look only that it was used (Review Focus 3)', () => {
    const ascertain = { instanceId: 'as-1', definitionId: 'ascertain', suit: 'club' as const, rank: 3 };
    const recast: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(ascertain), targets: [] },
      move(ascertain, 'seat-1:hand', 'discardPile'),
      { kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['x'] },
    ];
    expect(lines(recast)).toEqual(['Seat 1 drew 1 card', 'Seat 1 recast Ascertain (3 ♣)']);
    const reason = { kind: 'choice' as const, card: usedCardOf(ascertain), userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    const looked: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(ascertain), targets: [seat('seat-0')] },
      move(ascertain, 'seat-1:hand', 'discardPile'),
      { kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'pick', reason, shows: { kind: 'label', text: '' }, secret: true },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'pick', reason, shows: { kind: 'label', text: '' }, secret: true },
    ];
    expect(lines(looked)).toEqual(['Seat 1 used Ascertain (3 ♣) on Hing']);
  });

  it('one line per chain toggle, by the Chains user, and a seat unchained by its damage', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(chains), targets: [seat('seat-0'), seat('seat-1')] },
      move(chains, 'seat-1:hand', 'discardPile'),
      { kind: 'ChainToggledEvent', seatId: 'seat-0', chained: true },
      { kind: 'ChainToggledEvent', seatId: 'seat-1', chained: false },
      { kind: 'DamageDealtEvent', damage: { source: seat('seat-2'), target: seat('seat-0'), amount: 1, nature: 'fire' } },
      { kind: 'ChainToggledEvent', seatId: 'seat-0', chained: false },
    ];
    expect(lines(log)).toEqual([
      'Hing was unchained',
      'Hing took 1 fire damage from Seat 2',
      'Seat 1 unchained themselves',
      'Seat 1 chained Hing',
      'Seat 1 used Chains (Q ♣) on Hing, Seat 1',
    ]);
  });
});
