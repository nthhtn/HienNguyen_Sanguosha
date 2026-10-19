import { withFillers } from '../../generals/fillers.testing';
import { advanceToDecision, getLegalActions, resolve } from 'engine';
import type { Action, CardInstance, GameModeDefinition, GameState, QueueItem } from 'engine';
import { buildContentRegistry } from '../../registry';
import { cardStep } from '../../shared/steps';

// The real cards and Generals; a mode with no triggers of its own.
const registry = withFillers(buildContentRegistry());
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });

interface TableOptions {
  hp?: Record<string, number>;
  // A seat's [Main, Deputy, revealed?]. Default: Xu Huang and Dong Zhuo (male,
  // no skills), revealed.
  generals?: Record<string, [string, string, boolean?]>;
  flags?: Record<string, boolean>;
}

// Four seats round the table (Wei, Shu, Wu, Qun) at 4/4 HP; seat-a's Play
// phase. `cards` fills zones by id ('drawPile': top first).
function table(cards: Record<string, CardInstance[]> = {}, o: TableOptions = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => {
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['filler-xu-huang', 'filler-dong-zhuo'];
      return {
        id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], eliminated: false,
        generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: deputy, revealed } },
        combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: 4,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      };
    }),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], ...(o.flags ? { flags: o.flags } : {}) }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const play = (s: GameState, cardInstanceId: string, ...targets: string[]) => act(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: targets.map(seat) });
const pass = (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id });
const respond = (s: GameState, cardInstanceId: string) =>
  act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId });
const choose = (s: GameState, optionId: string) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId });
const use = (s: GameState) => choose(s, 'use');
const decline = (s: GameState) => choose(s, 'decline');
const select = (s: GameState, ...ids: string[]) => act(s, { kind: 'SelectAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id, ids });
const cancel = (s: GameState) => act(s, { kind: 'CancelSelectionAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id });
const run = (s: GameState, queue: QueueItem[]) => advanceToDecision({ ...s, resolutionQueue: queue }, ctx).state;
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
const ids = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
// The ability a pending ask is about, if any.
const askedAbout = (s: GameState) => (s.pendingChoice?.reason.kind === 'ability' ? s.pendingChoice.reason.abilityId : null);
const abilityLog = (s: GameState) => s.log.filter((e) => e.kind === 'AbilityUsedEvent');

describe('Black Shield', () => {
  const shield = card('bs', 'black-shield', 'club', 2);

  it('a black Slash has no effect on its wearer, but still counts and still spends Wine', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha', 'spade')], 'seat-b:equip': [shield] }, { flags: { wine: true } }), 's1', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.turn.flags).toBeUndefined();
    expect(abilityLog(s)).toEqual([
      { kind: 'AbilityUsedEvent', owner: { kind: 'equipment', seatId: 'seat-b', cardInstanceId: 'bs' }, abilityId: 'black-shield', outcome: 'no-effect', targetSeatId: 'seat-a' },
    ]);
  });

  it('a red Slash still asks for a Dodge', () => {
    expect(play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart')], 'seat-b:equip': [shield] }), 's1', 'seat-b').pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('a Slash with no colour still affects its wearer', () => {
    const s = run(table({ 'seat-b:equip': [shield] }), [cardStep('sha-targeted', { as: 'sha', colour: 'none', physical: [] }, 'seat-a', seat('seat-b'))]);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('is turned off by the attacker’s Black Pommel', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [shield] }), 's1', 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });
});

describe('Wood Armor', () => {
  const armor = card('wa', 'wood-armor', 'spade', 2);

  it('a Slash of any colour has no effect on its wearer', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart')], 'seat-b:equip': [armor] }), 's1', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'wood-armor', outcome: 'no-effect', targetSeatId: 'seat-a' }]);
  });

  it('is turned off by the attacker’s Black Pommel', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [armor] }), 's1', 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('Barbarians and Hail of Arrows skip its wearer: no window and no Wuxie check for it', () => {
    // Turn order from seat-a: b (skipped), c, d. c holds a Wuxie: it is asked about c, never b.
    const s = play(table({ 'seat-a:hand': [card('h', 'hail-of-arrows')], 'seat-b:equip': [armor], 'seat-c:hand': [card('w', 'wuxie')] }), 'h');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', reason: { kind: 'wuxie', target: seat('seat-c') } });
    const barbarians = play(table({ 'seat-a:hand': [card('b', 'barbarians')], 'seat-b:equip': [armor] }), 'b');
    expect(barbarians.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' });
  });
});

describe('Eight Trigrams', () => {
  const trigrams = card('et', 'eight-trigrams', 'spade', 2);
  const attack = (judged: CardInstance, more: Record<string, CardInstance[]> = {}) =>
    play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:equip': [trigrams], drawPile: [judged], ...more }), 's1', 'seat-b');

  it('asks its wearer when a Dodge is needed', () => {
    const s = attack(card('j', 'peach', 'heart', 9));
    expect(askedAbout(s)).toBe('eight-trigrams');
    expect(s.pendingChoice!.seatId).toBe('seat-b');
  });

  it('with nothing left to judge, the Dodge is asked for as normal (stage 5 follow-up)', () => {
    const s = attack(card('j', 'peach', 'heart', 9));
    const judge = s.pendingChoice!.options.find((o) => o.id === 'use')!.effects.find((e) => e.kind === 'JudgeEffect');
    expect(judge).toMatchObject({ otherwise: [{ kind: 'CardStepEffect', step: 'sha-shan', target: { seatId: 'seat-b' } }] });
  });

  it('a red judgment counts as a Dodge: dodged, with no card from the hand', () => {
    const s = use(attack(card('j', 'peach', 'heart', 9), { 'seat-b:hand': [card('d1', 'shan')] }));
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(ids(s, 'seat-b:hand')).toEqual(['d1']);
    expect(s.log.find((e) => e.kind === 'JudgmentEvent')).toMatchObject({ seatId: 'seat-b', reader: { kind: 'card', card: { as: 'eight-trigrams' } }, card: { instanceId: 'j' } });
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'eight-trigrams', outcome: 'counts-as-shan' }]);
  });

  it('a black judgment: the Dodge window opens as normal, the judged card already discarded (Review Focus 4)', () => {
    const s = use(attack(card('j', 'peach', 'club', 9)));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(ids(s, 'discardPile')).toContain('j');
    expect(ids(s, 'processing')).toEqual([]);
    expect(hp(pass(s), 'seat-b')).toBe(3);
  });

  it('Don’t: the window opens with no judgment, and it isn’t asked again', () => {
    const s = decline(attack(card('j', 'peach', 'heart', 9)));
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    expect(s.log.some((e) => e.kind === 'JudgmentEvent')).toBe(false);
  });

  it('answers Hail of Arrows too', () => {
    let s = play(table({ 'seat-a:hand': [card('h', 'hail-of-arrows')], 'seat-b:equip': [trigrams], drawPile: [card('j', 'peach', 'diamond', 3)] }), 'h');
    expect(askedAbout(s)).toBe('eight-trigrams');
    s = use(s);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' }); // seat-b is covered; on to seat-c
  });

  it('is turned off against a Slash by Black Pommel, so it isn’t asked', () => {
    const s = play(
      table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [trigrams], drawPile: [card('j', 'peach', 'heart', 9)] }),
      's1',
      'seat-b'
    );
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });
});
describe('Gender Swords', () => {
  const swords = card('gs', 'gender-swords', 'spade', 2);
  const female: TableOptions['generals'] = { 'seat-b': ['filler-zhu-rong', 'filler-dong-zhuo'] };
  const attack = (more: Record<string, CardInstance[]> = {}, generals: TableOptions['generals'] = female) =>
    play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [swords], drawPile: [card('d1', 'peach')], ...more }, { generals }), 's1', 'seat-b');

  it('asks when the target’s gender differs', () => {
    expect(askedAbout(attack())).toBe('gender-swords');
  });

  it('doesn’t when it doesn’t, or when the target has no gender (both Generals hidden)', () => {
    expect(attack({}, {}).pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    const hidden = attack({}, { 'seat-b': ['filler-zhu-rong', 'filler-dong-zhuo', false] });
    expect(hidden.pendingChoice).toBeUndefined();
    expect(hidden.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('Use: the target discards a hand card of its choice, then the Slash goes on', () => {
    const s = use(attack({ 'seat-b:hand': [card('b1', 'peach')] }));
    expect(s.pendingChoice).toMatchObject({
      seatId: 'seat-b', verb: 'discard',
      reason: { kind: 'choice', card: { as: 'gender-swords' }, userSeatId: 'seat-a', targetSeatId: 'seat-b' },
      options: [{ id: 'b1' }, { id: 'decline', shows: { kind: 'decline' } }],
    });
    const after = choose(s, 'b1');
    expect(ids(after, 'discardPile')).toContain('b1');
    expect(after.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('…or lets the user draw 1', () => {
    const after = choose(use(attack({ 'seat-b:hand': [card('b1', 'peach')] })), 'decline');
    expect(ids(after, 'seat-a:hand')).toEqual(['d1']);
    expect(ids(after, 'seat-b:hand')).toEqual(['b1']);
    expect(after.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('a target with no hand cards must let the user draw', () => {
    const after = use(attack());
    expect(ids(after, 'seat-a:hand')).toEqual(['d1']);
    expect(after.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });
});

describe('Ancient Scimitar', () => {
  const scimitar = card('as', 'ancient-scimitar', 'spade', 1);
  const hit = (more: Record<string, CardInstance[]> = {}, o: TableOptions = {}) =>
    pass(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [scimitar], ...more }, o), 's1', 'seat-b'));

  it('deals 1 extra damage to a target with no hand cards', () => {
    expect(hp(hit(), 'seat-b')).toBe(2);
  });

  it('none to a target holding a card', () => {
    expect(hp(hit({ 'seat-b:hand': [card('b1', 'peach')] }), 'seat-b')).toBe(3);
  });

  it('adds to Wine’s +1', () => {
    expect(hp(hit({}, { flags: { wine: true } }), 'seat-b')).toBe(1);
  });

  it('comes before Silver Lion’s cap, which brings it back to 1', () => {
    expect(hp(hit({ 'seat-b:equip': [card('sl', 'silver-lion', 'club', 1)] }), 'seat-b')).toBe(3);
  });
});

describe('Ice Sword', () => {
  const sword = card('is', 'ice-sword', 'spade', 2);
  const hitWith = (more: Record<string, CardInstance[]> = {}) => pass(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [sword], ...more }), 's1', 'seat-b'));

  it('asks before the damage, when the target holds a card', () => {
    expect(askedAbout(hitWith({ 'seat-b:hand': [card('b1', 'peach')] }))).toBe('ice-sword');
  });

  it('isn’t asked when the target holds nothing', () => {
    expect(hp(hitWith(), 'seat-b')).toBe(3);
  });

  it('Use: no damage; the user discards 2 of the target’s cards, one pick at a time', () => {
    let s = use(hitWith({ 'seat-b:hand': [card('b1', 'peach')], 'seat-b:equip': [card('h1', 'di-lu', 'club', 5)] }));
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', verb: 'discard', reason: { kind: 'choice', card: { as: 'ice-sword' }, targetSeatId: 'seat-b' } });
    s = choose(s, 'h1');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['hand']);
    s = choose(s, 'hand');
    expect(ids(s, 'discardPile')).toEqual(expect.arrayContaining(['h1', 'b1']));
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
  });

  it('a target with only 1 card loses just that one', () => {
    const s = choose(use(hitWith({ 'seat-b:hand': [card('b1', 'peach')] })), 'hand');
    expect(s.pendingChoice).toBeUndefined();
    expect(ids(s, 'seat-b:hand')).toEqual([]);
  });

  it('Don’t: the damage is dealt', () => {
    expect(hp(decline(hitWith({ 'seat-b:hand': [card('b1', 'peach')] })), 'seat-b')).toBe(3);
  });
});

describe('Longbow', () => {
  const bow = card('lb', 'longbow', 'heart', 5);
  const hitWith = (more: Record<string, CardInstance[]> = {}) => pass(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [bow], ...more }), 's1', 'seat-b'));

  it('after damage, may discard the target’s only Mount', () => {
    const s = hitWith({ 'seat-b:equip': [card('h1', 'di-lu', 'club', 5)] });
    expect(hp(s, 'seat-b')).toBe(3);
    expect(askedAbout(s)).toBe('longbow');
    expect(ids(use(s), 'seat-b:equip')).toEqual([]);
  });

  it('the user picks which, of two Mounts', () => {
    let s = use(hitWith({ 'seat-b:equip': [card('h1', 'di-lu', 'club', 5), card('h2', 'red-hare', 'heart', 5)] }));
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['h1', 'h2']);
    s = choose(s, 'h2');
    expect(ids(s, 'seat-b:equip')).toEqual(['h1']);
  });

  it('isn’t asked without a Mount, or when the Slash is dodged', () => {
    expect(hitWith().pendingChoice).toBeUndefined();
    const dodged = respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [bow], 'seat-b:hand': [card('d', 'shan')], 'seat-b:equip': [card('h1', 'di-lu')] }), 's1', 'seat-b'),
      'd'
    );
    expect(dodged.pendingChoice).toBeUndefined();
  });
});
describe('Axe', () => {
  const axe = card('ax', 'axe', 'diamond', 5);
  const dodgedWith = (more: Record<string, CardInstance[]> = {}, o: TableOptions = {}) =>
    respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha'), card('k1', 'peach'), card('k2', 'duel')], 'seat-a:equip': [axe], 'seat-b:hand': [card('d', 'shan')], ...more }, o), 's1', 'seat-b'),
      'd'
    );

  it('asks when the Slash is dodged and 2 other cards can be paid', () => {
    expect(askedAbout(dodgedWith())).toBe('axe');
  });

  it('Use: discard 2 cards from hand or equipment (never the Axe), and the Slash hits', () => {
    let s = use(dodgedWith({ 'seat-a:equip': [axe, card('h1', 'red-hare', 'heart', 5)] }));
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', of: 'cards', min: 2, max: 2, eligibleIds: ['k1', 'k2', 'h1'], reason: { abilityId: 'axe', targetSeatId: 'seat-b' } });
    s = select(s, 'k1', 'h1');
    expect(ids(s, 'discardPile')).toEqual(expect.arrayContaining(['k1', 'h1']));
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('isn’t asked with fewer than 2 other cards', () => {
    const s = respond(play(table({ 'seat-a:hand': [card('s1', 'sha'), card('k1', 'peach')], 'seat-a:equip': [axe], 'seat-b:hand': [card('d', 'shan')] }), 's1', 'seat-b'), 'd');
    expect(s.pendingChoice).toBeUndefined();
  });

  it('Don’t, or cancelling the discard, leaves the Slash dodged', () => {
    expect(hp(decline(dodgedWith()), 'seat-b')).toBe(4);
    const cancelled = cancel(use(dodgedWith()));
    expect(cancelled.pendingSelection).toBeUndefined();
    expect(cancelled.pendingChoice).toBeUndefined();
    expect(hp(cancelled, 'seat-b')).toBe(4);
  });

  it('discarding its wearer’s own Silver Lion heals the wearer', () => {
    const s = select(use(dodgedWith({ 'seat-a:equip': [axe, card('sl', 'silver-lion', 'club', 1)] }, { hp: { 'seat-a': 3 } })), 'k1', 'sl');
    expect(hp(s, 'seat-a')).toBe(4);
    expect(hp(s, 'seat-b')).toBe(3);
  });
});

describe('Green Dragon Blade', () => {
  const blade = card('gdb', 'green-dragon-blade', 'spade', 5);
  const dodgedWith = (more: Record<string, CardInstance[]> = {}, o: TableOptions = {}) =>
    respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha', 'heart')], 'seat-a:equip': [blade], 'seat-b:hand': [card('d', 'shan'), card('d2', 'shan')], ...more }, o), 's1', 'seat-b'),
      'd'
    );

  it('asks when the Slash is dodged and its user holds another Slash', () => {
    expect(askedAbout(dodgedWith())).toBe('green-dragon-blade');
  });

  it('Use: another Slash at the same target, uncounted, with Wine already spent', () => {
    let s = use(dodgedWith({}, { flags: { wine: true } }));
    expect(s.pendingSelection).toMatchObject({ of: 'cards', eligibleIds: ['s2'], min: 1, max: 1 });
    s = select(s, 's2');
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    expect(hp(pass(s), 'seat-b')).toBe(3);
  });

  it('dodged again, it asks again (while a Slash is left)', () => {
    let s = select(use(dodgedWith({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha', 'heart'), card('s3', 'sha')] })), 's2');
    s = respond(s, 'd2');
    expect(askedAbout(s)).toBe('green-dragon-blade');
  });

  it('the follow-up gets its own armour check', () => {
    // The first Slash is red, so Black Shield lets it through to be dodged; the black follow-up is stopped.
    let s = respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart'), card('s2', 'sha', 'spade')], 'seat-a:equip': [blade], 'seat-b:hand': [card('d', 'shan')], 'seat-b:equip': [card('bs', 'black-shield', 'club', 2)] }), 's1', 'seat-b'),
      'd'
    );
    s = select(use(s), 's2');
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'black-shield' }]);
  });

  it('isn’t asked without another Slash', () => {
    expect(respond(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [blade], 'seat-b:hand': [card('d', 'shan')] }), 's1', 'seat-b'), 'd').pendingChoice).toBeUndefined();
  });
});

describe('Sky Scorcher', () => {
  const scorcher = card('sk', 'sky-scorcher', 'diamond', 12);
  const plays = (s: GameState) => getLegalActions(s, 'seat-a', registry).filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 's1');
  const lastShaTable = () => table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [scorcher] });

  it('with the last hand card, the play is one template of up to 3 targets in range', () => {
    expect(plays(lastShaTable())).toEqual([
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: [], pickTargets: { eligibleIds: ['seat-b', 'seat-c', 'seat-d'], min: 1, max: 3 } },
    ]);
  });

  it('a Slash that isn’t the last hand card has one target per action', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha'), card('k', 'peach')], 'seat-a:equip': [scorcher] });
    expect(plays(s).map((a) => (a.kind === 'PlayCardAction' ? a.targets : []))).toEqual([[seat('seat-b')], [seat('seat-c')], [seat('seat-d')]]);
  });

  it('never asks; each target is asked in seat order from the user', () => {
    let s = play(lastShaTable(), 's1', 'seat-d', 'seat-c', 'seat-b');
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-b');
    s = pass(s);
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-c');
    s = pass(s);
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-d');
    s = pass(s);
    expect([hp(s, 'seat-b'), hp(s, 'seat-c'), hp(s, 'seat-d')]).toEqual([3, 3, 3]);
  });

  it('a target gone before its turn in the steps is skipped (Review Focus 2)', () => {
    let s = play(lastShaTable(), 's1', 'seat-b', 'seat-c', 'seat-d');
    s = { ...s, seats: s.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) };
    s = pass(s); // seat-b
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-d');
  });
});

describe('Serpent Spear', () => {
  const spear = card('sp', 'serpent-spear', 'spade', 12);
  const hand = [card('h1', 'peach', 'heart', 3), card('c1', 'duel', 'club', 4)];
  const conversions = (s: GameState, seatId = s.turn.ownerSeatId) => getLegalActions(s, seatId, registry).filter((a) => a.kind === 'UseConversionAction');
  const ownTurn = (s: GameState, seatId: string): GameState => ({ ...s, turn: { ...s.turn, ownerSeatId: seatId } });

  it('in the Play Phase: 2 hand cards as one Slash at a target in range; it has no colour, and it counts', () => {
    const t = table({ 'seat-a:hand': hand, 'seat-a:equip': [spear] });
    expect(conversions(t).map((a) => (a.kind === 'UseConversionAction' ? a.targets : []))).toEqual([[seat('seat-b')], [seat('seat-c')], [seat('seat-d')]]);
    let s = select(act(t, conversions(t)[0]), 'h1', 'c1');
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'sha', colour: 'none', physical: [{ instanceId: 'h1' }, { instanceId: 'c1' }] } });
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    s = pass(s);
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('a Slash with no colour still hits a Black Shield wearer (Review Focus 1)', () => {
    const t = table({ 'seat-a:hand': hand, 'seat-a:equip': [spear], 'seat-b:equip': [card('bs', 'black-shield', 'club', 2)] });
    const s = select(act(t, conversions(t)[0]), 'h1', 'c1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    expect(abilityLog(s)).toEqual([]);
  });

  it('answers a Duel with 2 hand cards: the Duel turns back', () => {
    let s = play(ownTurn(table({ 'seat-a:hand': hand, 'seat-a:equip': [spear], 'seat-b:hand': [card('du', 'duel')] }), 'seat-b'), 'du', 'seat-a');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', allowedCardIds: ['sha'] });
    s = select(act(s, conversions(s, 'seat-a')[0]), 'h1', 'c1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['sha'] });
  });

  it('answers Barbarians', () => {
    let s = play(ownTurn(table({ 'seat-a:hand': hand, 'seat-a:equip': [spear], 'seat-d:hand': [card('ba', 'barbarians')] }), 'seat-d'), 'ba');
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-a');
    s = select(act(s, conversions(s, 'seat-a')[0]), 'h1', 'c1');
    expect(hp(s, 'seat-a')).toBe(4);
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-b');
  });
});

describe('pausing on the new decisions (Review Focus 5)', () => {
  it('a game paused on an ask, or on a selection, survives a JSON round trip and resumes identically', () => {
    const asking = respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha'), card('k1', 'peach'), card('k2', 'duel')], 'seat-a:equip': [card('ax', 'axe', 'diamond', 5)], 'seat-b:hand': [card('d', 'shan')] }), 's1', 'seat-b'),
      'd'
    );
    const roundTrip = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
    expect(use(roundTrip(asking))).toEqual(use(asking));
    const selecting = use(asking);
    expect(select(roundTrip(selecting), 'k1', 'k2')).toEqual(select(selecting, 'k1', 'k2'));
  });
});
