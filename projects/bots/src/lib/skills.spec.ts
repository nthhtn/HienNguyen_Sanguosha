import type { Action, CardInstance, Effect, GameState, PendingChoice, PendingSelection } from 'engine';
import { advanceToDecision, getLegalActions } from 'engine';
import { fillPick, weakestFirst } from './helpers';
import { conversionSpare, pickActiveSkill } from './skills';
import { registry, ctx, card, table, actor, decide, act, general, asking, picked, useSkill } from './testing';

describe('may-skills the bot always uses', () => {
  it.each(['evil-hero', 'feedback', 'heavens-envy', 'bestowed-rouse', 'gathering-wisdom', 'brave-gesture', 'self-restraint', 'river-goddess', 'kingdomWars:goddess-luo', 'iron-cavalry', 'astrology'])('%s', (skillId) => {
    expect(picked(decide(asking(table(), skillId)))).toBe('use');
  });

  it('keeps both Bestowed Rouse cards (cancels the giving)', () => {
    const selection: PendingSelection = { id: 'sel', seatId: 'seat-a', reason: { kind: 'ability', owner: general('seat-a', 'bestowed-rouse'), abilityId: 'bestowed-rouse' }, of: 'cards', eligibleIds: ['d1'], min: 1, max: 1, then: { kind: 'give', toSeatIds: ['seat-b'] }, onCancel: [] };
    expect(picked(decide({ ...table({ 'seat-a:hand': [card('d1', 'shan')] }), pendingSelection: selection }))).toBe('CancelSelectionAction');
  });
});

describe('a compulsory skill’s ask', () => {
  it('is only about revealing: the bot says Use', () => {
    expect(picked(decide(asking(table(), 'armed-consorts')))).toBe('use');
  });

  it('Kingdom Wars Warrior Lady, a may ask, gets the same legal answer', () => {
    expect(picked(decide(asking(table(), 'kingdomWars:warrior-lady')))).toBe('use');
  });

  it('Kingdom Wars Envious Moon draws, as Dynasty Wars does', () => {
    expect(picked(decide(asking(table(), 'kingdomWars:envious-moon')))).toBe('use');
  });
});

describe('Kingdom Wars Bequeathed Strategy', () => {
  const id = 'kingdomWars:bequeathed-strategy';
  const picking = (options: PendingChoice['options']): GameState => ({
    ...table(),
    pendingChoice: { id: 'pick', seatId: 'seat-a', verb: 'pick', secret: true, reason: { kind: 'ability', owner: general('seat-a', id), abilityId: id }, options },
  });

  it('uses the ask, picks a seen card, then gives it to an ally, else keeps it', () => {
    expect(picked(decide(asking(table(), id)))).toBe('use');
    expect(picked(decide(picking([{ id: 'c1', shows: { kind: 'card', card: card('c1', 'shan') }, effects: [] }, { id: 'c2', shows: { kind: 'card', card: card('c2', 'sha') }, effects: [] }])))).toBe('c1');
    const seats = ['seat-a', 'seat-b', 'seat-c', 'seat-d'].map((seatId) => ({ id: seatId, shows: { kind: 'seat' as const, seatId }, effects: [] }));
    // No ally known: it keeps the card (its own seat).
    expect(picked(decide(picking(seats)))).toBe('seat-a');
    // An ally (same kingdom as the bot, seat-c): the card goes to that exact seat.
    const allied = { ...table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-c': 'Wei' } }), pendingChoice: picking(seats).pendingChoice };
    expect(picked(decide(allied))).toBe('seat-c');
  });
});

describe('Kingdom Wars Ding Feng', () => {
  const swift = 'kingdomWars:swift-and-deadly';
  const sixSeats = (hand: CardInstance[], equip: CardInstance[] = []) =>
    table({ 'seat-a:hand': hand, 'seat-a:equip': equip }, { seats: 6, generals: { 'seat-a': ['kingdomWars:ding-feng', 'filler-meng-huo', true] } });
  const offered = (s: GameState) => getLegalActions(s, 'seat-a', registry).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === swift);

  it('Swift and Deadly is used with a Sha in hand and a spare card, discarding the spare and aiming at a far foe', () => {
    let s = sixSeats([card('s1', 'sha'), card('k1', 'break', 'heart')]);
    expect(offered(s)).toBe(true);
    expect(pickActiveSkill(s, s.seats[0], getLegalActions(s, 'seat-a', registry), registry, 'early')).toMatchObject({ owner: { skillId: swift } });
    s = useSkill(s, swift);
    expect(picked(decide(s))).toEqual(['k1']);
    s = act(s, decide(s));
    expect(s.pendingSelection).toMatchObject({ of: 'seats' });
    const [seatPick] = [picked(decide(s))] as string[][];
    expect(['seat-c', 'seat-d', 'seat-e']).toContain(seatPick[0]);
  });

  it('Swift and Deadly is left alone with no Sha to use', () => {
    const s = sixSeats([card('k1', 'shan', 'heart'), card('k2', 'shan', 'heart')]);
    expect(pickActiveSkill(s, s.seats[0], getLegalActions(s, 'seat-a', registry), registry, 'early')).toBeUndefined();
  });

  it('the bot’s Sha at Close Combat is a legal play within the cap: one far target at most, so never two far ones', () => {
    const s = sixSeats([card('s1', 'sha'), card('pc', 'peach', 'heart')], [card('gd', 'green-dragon-blade', 'spade', 5)]);
    const template = getLegalActions(s, 'seat-a', registry).find((a) => a.kind === 'PlayCardAction' && a.pickTargets);
    expect(template).toMatchObject({ pickTargets: { max: 2, capped: { max: 1 } } });
    const action = fillPick(s, s.seats[0], template as Extract<Action, { kind: 'PlayCardAction' }>, weakestFirst)!;
    expect(action).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 's1' });
    const targets = action.targets.map((t) => (t.kind === 'seat' ? t.seatId : ''));
    expect(targets).toHaveLength(2);
    expect(targets.filter((id) => !['seat-b', 'seat-f'].includes(id))).toHaveLength(1);
    expect(() => act(s, action)).not.toThrow();
  });
});

describe('Kingdom Wars Gan Fu Ren', () => {
  it('Prudence is always used, and the card goes to an ally of her Kingdom', () => {
    expect(picked(decide(asking(table(), 'kingdomWars:prudence')))).toBe('use');
    const options = ['seat-b', 'seat-c'].map((seatId) => ({ id: seatId, shows: { kind: 'seat' as const, seatId }, effects: [] }));
    const s = table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-c': 'Wei' } });
    const pick = { ...s, pendingChoice: { id: 'pick', seatId: 'seat-a', verb: 'pick' as const, reason: { kind: 'ability' as const, owner: general('seat-a', 'kingdomWars:prudence'), abilityId: 'kingdomWars:prudence' }, options } };
    expect(picked(decide(pick))).toBe('seat-c');
  });

  it('Divine Wisdom is used when the discard heals her, or costs at most 1 card, else declined', () => {
    const hand = (n: number) => Array.from({ length: n }, (_, i) => card(`h${i}`, 'shan'));
    const id = 'kingdomWars:divine-wisdom';
    expect(picked(decide(asking(table({ 'seat-a:hand': hand(3) }, { hp: { 'seat-a': 3 } }), id)))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': hand(2) }, { hp: { 'seat-a': 3 } }), id)))).toBe('decline');
    expect(picked(decide(asking(table({ 'seat-a:hand': hand(1) }, { hp: { 'seat-a': 3 } }), id)))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': hand(5) }), id)))).toBe('decline');
  });
});

describe('Kingdom Wars Pan Feng, Insanity Axe', () => {
  const id = 'kingdomWars:insanity-axe';
  it('is used against a non-ally only', () => {
    expect(picked(decide(asking(table(), id, 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-b': 'Wei' } }), id, 'seat-b')))).toBe('decline');
  });

  const pick = (options: PendingChoice['options']): GameState => ({
    ...table(),
    pendingChoice: { id: 'pick', seatId: 'seat-a', verb: 'pick', reason: { kind: 'ability', owner: general('seat-a', id), abilityId: id, targetSeatId: 'seat-b' }, options },
  });
  const moves = (n: number): Effect[] => Array.from({ length: n }, (_, i) => ({ kind: 'MoveCardEffect', cardInstanceId: `c${i}`, toZoneId: 'z' }));
  const label = (optionId: string, effects: Effect[]) => ({ id: optionId, shows: { kind: 'label' as const, text: optionId }, effects });

  it('moves the card when that replaces nothing, discards it when it would replace a card', () => {
    expect(picked(decide(pick([label('move-card', moves(1)), label('discard-card', moves(1))])))).toBe('move-card');
    expect(picked(decide(pick([label('move-card', moves(2)), label('discard-card', moves(1))])))).toBe('discard-card');
  });

  it('picks the first worn card', () => {
    const cards = [card('e1', 'crossbow'), card('e2', 'black-shield')];
    const options = cards.map((c) => ({ id: c.instanceId, shows: { kind: 'card' as const, card: c }, effects: [] }));
    expect(picked(decide(pick(options)))).toBe('e1');
  });
});

describe('Unyielding', () => {
  it('only against a non-ally; the target discards 2 with more than 3 hand cards, else takes the damage above 1 HP', () => {
    expect(picked(decide(asking(table(), 'unyielding', 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-b': 'Wei' } }), 'unyielding', 'seat-b')))).toBe('decline');
    const choice = (hand: number, combinedHp: number): GameState => {
      const s = table({ 'seat-b:hand': Array.from({ length: hand }, (_, i) => card(`h${i}`, 'shan')) }, { hp: { 'seat-b': combinedHp } });
      return { ...s, pendingChoice: { id: 'u', seatId: 'seat-b', verb: 'pick', reason: { kind: 'ability', owner: general('seat-a', 'unyielding'), abilityId: 'unyielding', targetSeatId: 'seat-b' }, options: [{ id: 'discard', shows: { kind: 'label', text: 'Discard 2 Hand Cards' }, effects: [] }, { id: 'damage', shows: { kind: 'label', text: 'Take 1 Damage' }, effects: [] }] } };
    };
    expect(picked(decide(choice(4, 4)))).toBe('discard');
    expect(picked(decide(choice(2, 3)))).toBe('damage');
    expect(picked(decide(choice(2, 1)))).toBe('discard');
  });
});

describe('the Draw Phase', () => {
  it('Raid when two non-allies hold hand cards', () => {
    expect(picked(decide(asking(table({ 'seat-b:hand': [card('x', 'shan')], 'seat-c:hand': [card('y', 'shan')] }), 'raid')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-b:hand': [card('x', 'shan')] }), 'raid')))).toBe('decline');
  });

  it('Bare the Chest when holding 2 or more Slash', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha')] }), 'bare-the-chest')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('s1', 'sha')] }), 'bare-the-chest')))).toBe('decline');
  });

  it('Bare the Chest counts a Fire Attack and a Lightning Attack as Slash', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('s1', 'fire-attack'), card('s2', 'lightning-attack')] }), 'bare-the-chest')))).toBe('use');
  });
});

describe('Devil', () => {
  // A Capture judgment on `judgedSeatId`, turned up as a club (it lands).
  const capture = { as: 'capture', colour: 'black' as const, suit: 'spade' as const, rank: 6, physical: [card('cp', 'capture', 'spade', 6)] };
  const shown = (judgedSeatId: string): Effect => ({ kind: 'JudgmentShownEffect', judgment: { seatId: judgedSeatId, reader: { kind: 'card', card: capture }, card: card('j', 'sha', 'club', 9) }, acted: ['seat-a'] });
  const hand = [card('p', 'peach', 'heart', 1), card('h', 'shan', 'heart', 2), card('k', 'sha', 'spade', 3)];

  it('replaces a judgment that hurts itself or an ally, with the least useful card that flips it', () => {
    const s = asking(table({ 'seat-a:hand': hand, processing: [card('j', 'sha', 'club', 9)] }), 'devil', 'seat-a', [shown('seat-a')]);
    expect(picked(decide(s))).toBe('use');
    const selection: PendingSelection = {
      id: 'sel', seatId: 'seat-a', reason: { kind: 'ability', owner: general('seat-a', 'devil'), abilityId: 'devil' }, of: 'cards', eligibleIds: ['p', 'h', 'k'], min: 1, max: 1,
      then: { kind: 'replace-judgment', judgment: (shown('seat-a') as Extract<Effect, { kind: 'JudgmentShownEffect' }>).judgment, owner: general('seat-a', 'devil'), abilityId: 'devil' }, onCancel: [],
    };
    expect(picked(decide({ ...table({ 'seat-a:hand': hand }), pendingSelection: selection }))).toEqual(['h']);
  });

  it('only picks among the cards the selection allows', () => {
    const selection: PendingSelection = {
      id: 'sel', seatId: 'seat-a', reason: { kind: 'ability', owner: general('seat-a', 'devil'), abilityId: 'devil' }, of: 'cards', eligibleIds: ['p', 'k'], min: 1, max: 1,
      then: { kind: 'replace-judgment', judgment: (shown('seat-a') as Extract<Effect, { kind: 'JudgmentShownEffect' }>).judgment, owner: general('seat-a', 'devil'), abilityId: 'devil' }, onCancel: [],
    };
    // The Dodge would flip the judgment too, but it is not allowed: the Peach is the only eligible flip.
    expect(picked(decide({ ...table({ 'seat-a:hand': hand }), pendingSelection: selection }))).toEqual(['p']);
  });

  it('saves itself only from Lightning, Capture or Starvation: never re-judges its own River Goddess', () => {
    const owner = { kind: 'general' as const, seatId: 'seat-a', slot: 'deputy' as const, skillId: 'river-goddess' };
    const riverGoddess: Effect = { kind: 'JudgmentShownEffect', judgment: { seatId: 'seat-a', reader: { kind: 'skill', owner }, card: card('j', 'peach', 'heart', 9) }, acted: [] };
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('k', 'sha', 'spade', 3)] }), 'devil', 'seat-a', [riverGoddess])))).toBe('decline');
  });

  it('lets a judgment that hurts a non-ally stand', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': hand }), 'devil', 'seat-b', [shown('seat-b')])))).toBe('decline');
  });
});

describe('active skills in the Play Phase', () => {
  it('Battered Body above 3 HP, or above 2 holding a Peach', () => {
    // At full HP (max 3 in the second case) so the bot doesn't just eat the Peach.
    const huangGai = (combinedHp: number, hand: CardInstance[] = [], maxHp = 4) =>
      table({ 'seat-a:hand': hand, drawPile: [card('d1', 'shan'), card('d2', 'shan')] }, { generals: { 'seat-a': ['huang-gai', 'filler-sun-jian'] }, kingdoms: { 'seat-a': 'Wu' }, hp: { 'seat-a': combinedHp }, maxHp: { 'seat-a': maxHp } });
    expect(decide(huangGai(4))).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'battered-body' } });
    expect(decide(huangGai(3, [card('p', 'peach', 'heart')], 3))).toMatchObject({ kind: 'UseSkillAction' });
    expect(decide(huangGai(3)).kind).toBe('EndPhaseAction');
  });

  it('Reconsider discards every hand card ranked below Dodge, never a Peach or worn cards', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach', 'heart'), card('n', 'shan'), card('x', 'harvest', 'heart', 3), card('s', 'sha')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)] }, { generals: { 'seat-a': ['sun-quan', 'filler-sun-jian'] }, kingdoms: { 'seat-a': 'Wu' } });
    const selecting = useSkill(s, 'reconsider');
    expect(picked(decide(selecting))).toEqual(['x', 's']);
  });

  it('Kindness gives the cards above 3 to a revealed ally', () => {
    const hand = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id) => card(id, 'shan'));
    const s = table({ 'seat-a:hand': hand }, { generals: { 'seat-a': ['liu-bei', 'filler-meng-huo'], 'seat-b': ['filler-jiang-wei', 'filler-liu-shan'] }, kingdoms: { 'seat-a': 'Shu', 'seat-b': 'Shu' } });
    expect(decide(s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'kindness' } });
    const selecting = useSkill(s, 'kindness');
    expect(picked(decide(selecting))).toHaveLength(2);
    const giving = act(selecting, decide(selecting));
    expect(picked(decide(giving))).toBe('seat-b');
  });

  it('Sow Revolt at the non-ally with the lowest HP', () => {
    // seat-c is Wu too (an ally); seat-d is the weakest non-ally.
    const s = table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: { 'seat-a': ['zhou-yu', 'filler-sun-jian'] }, kingdoms: { 'seat-a': 'Wu' }, hp: { 'seat-c': 1, 'seat-d': 2 } });
    const selecting = useSkill(s, 'sow-revolt');
    expect(picked(decide(selecting))).toEqual(['seat-d']);
  });

  it('Green Vesicle heals itself first', () => {
    const s = table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: { 'seat-a': ['hua-tuo', 'filler-jia-xu'] }, kingdoms: { 'seat-a': 'Qun' }, hp: { 'seat-a': 2, 'seat-b': 2 } });
    expect(decide(s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'green-vesicle' } });
    const choosing = act(useSkill(s, 'green-vesicle'), { kind: 'SelectAction', seatId: 'seat-a', selectionId: useSkill(s, 'green-vesicle').pendingSelection!.id, ids: ['k'] });
    expect(picked(decide(choosing))).toBe('seat-a');
  });
});

describe('Sow Discord’s picks', () => {
  // seat-a shares its kingdom with none of the others, so all three are non-allies.
  const pick = (targetSeatId?: string): GameState => ({
    ...table({}, { hp: { 'seat-b': 3, 'seat-c': 2, 'seat-d': 4 } }),
    pendingChoice: {
      id: 'p', seatId: 'seat-a', verb: 'pick',
      reason: { kind: 'ability', owner: general('seat-a', 'sow-discord'), abilityId: 'sow-discord', ...(targetSeatId ? { targetSeatId } : {}) },
      options: ['seat-b', 'seat-c', 'seat-d'].filter((id) => id !== targetSeatId).map((id) => ({ id, shows: { kind: 'seat' as const, seatId: id }, effects: [] })),
    },
  });

  it('the first is the weakest non-ally; the second, the likelier winner (more HP)', () => {
    expect(picked(decide(pick()))).toBe('seat-c');
    expect(picked(decide(pick('seat-c')))).toBe('seat-d');
  });
});

describe('Displace', () => {
  it('with a card to spare and a non-ally to move the Slash to', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('x', 'harvest', 'heart', 3)] }), 'displace', 'seat-b')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('p', 'peach', 'heart')] }), 'displace', 'seat-b')))).toBe('decline');
  });
});

describe('Sow Revolt’s suit', () => {
  it('names the suit Zhou Yu has shown least, hearts on a tie', () => {
    const s = table();
    const played = { kind: 'CardPlayedEvent' as const, seatId: 'seat-b', card: { as: 'sha', colour: 'black' as const, physical: [card('a', 'sha', 'spade'), card('b', 'sha', 'heart')] }, targets: [] };
    const naming = (log: GameState['log']): GameState => ({
      ...s, log,
      pendingChoice: { id: 'n', seatId: 'seat-a', verb: 'pick', reason: { kind: 'ability', owner: general('seat-b', 'sow-revolt'), abilityId: 'sow-revolt', targetSeatId: 'seat-a' }, options: (['spade', 'heart', 'club', 'diamond'] as const).map((suit) => ({ id: suit, shows: { kind: 'suit' as const, suit }, effects: [] })) },
    });
    expect(picked(decide(naming([])))).toBe('heart');
    expect(picked(decide(naming([played])))).toBe('club');
  });
});

describe('conversions', () => {
  it('Fighting Saint as a Slash when no real Slash is in hand, never spending a Peach', () => {
    const guanYu = (hand: CardInstance[]) => table({ 'seat-a:hand': hand }, { generals: { 'seat-a': ['guan-yu', 'filler-meng-huo'] }, kingdoms: { 'seat-a': 'Shu' } });
    expect(decide(guanYu([card('h', 'shan', 'heart')]))).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: 'fighting-saint' } });
    expect(decide(guanYu([card('p', 'peach', 'heart')])).kind).toBe('EndPhaseAction');
  });

  it('a hidden General is revealed by using its conversion, whatever the HP', () => {
    const hidden = table({ 'seat-a:hand': [card('h', 'shan', 'heart')] }, { generals: { 'seat-a': ['guan-yu', 'filler-meng-huo', false] }, kingdoms: { 'seat-a': 'Shu' }, hp: { 'seat-a': 3 } });
    expect(decide(hidden)).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: 'fighting-saint' } });
  });
});

describe('Sow Revolt’s suit counts shown cards', () => {
  it('leastShownSuit counts shown cards', () => {
    const shown = (id: string) => ({ kind: 'CardShownEvent' as const, seatId: 'seat-b', card: card(id, 'sha', 'heart') });
    const played = { kind: 'CardPlayedEvent' as const, seatId: 'seat-b', card: { as: 'sha', colour: 'black' as const, physical: [card('p', 'sha', 'spade')] }, targets: [] };
    const naming: GameState = {
      ...table(), log: [shown('a'), shown('b'), shown('c'), played],
      pendingChoice: { id: 'n', seatId: 'seat-a', verb: 'pick', reason: { kind: 'ability', owner: general('seat-b', 'sow-revolt'), abilityId: 'sow-revolt', targetSeatId: 'seat-a' }, options: (['spade', 'heart', 'club', 'diamond'] as const).map((suit) => ({ id: suit, shows: { kind: 'suit' as const, suit }, effects: [] })) },
    };
    expect(picked(decide(naming))).toBe('club');
  });
});

describe('Bewilder claims (conversionSpare)', () => {
  const yuJi = (hand: CardInstance[]) => table({ 'seat-a:hand': hand }, { generals: { 'seat-a': ['yu-ji', 'filler-zuo-ci'] }, kingdoms: { 'seat-a': 'Qun' } });
  const claim = (s: GameState, as: string) =>
    getLegalActions(s, 'seat-a', registry).find((a) => a.kind === 'UseConversionAction' && a.via.conversionId === `bewilder-${as}`) as Extract<import('engine').Action, { kind: 'UseConversionAction' }>;
  const filler = (n: number) => Array.from({ length: n }, (_, i) => card(`x${i}`, 'shan', 'club', i + 2));

  it('a bot with 3 cards makes a true Bewilder claim', () => {
    const s = yuJi([card('real', 'duel', 'heart', 5), ...filler(2)]);
    expect(conversionSpare(s, s.seats[0], claim(s, 'duel'), registry)).toBe(true);
  });
  it('does not bluff with 3 cards', () => {
    const s = yuJi(filler(3));
    expect(conversionSpare(s, s.seats[0], claim(s, 'duel'), registry)).toBe(false);
  });
  it('may bluff with 5', () => {
    const s = yuJi(filler(5));
    expect(conversionSpare(s, s.seats[0], claim(s, 'duel'), registry)).toBe(true);
  });
});

describe('fallbacks when no suitable seat is offered', () => {
  const choice = (abilityId: string, ids: string[], opts: Parameters<typeof table>[1] = {}, extra: string[] = []): GameState => ({
    ...table({}, opts),
    pendingChoice: {
      id: 'p', seatId: 'seat-a', verb: 'pick',
      reason: { kind: 'ability', owner: general('seat-a', abilityId), abilityId },
      options: [...ids.map((id) => ({ id, shows: { kind: 'seat' as const, seatId: id }, effects: [] })), ...extra.map((id) => ({ id, shows: { kind: 'label' as const, text: id }, effects: [] }))],
    },
  });
  const allies = { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Wei' } as const };
  it('Marriage with no ally offered cancels when it can', () => {
    expect(picked(decide(choice('marriage', ['seat-d'], {}, ['cancel'])))).toBe('cancel');
  });
  it('Displace with only allies offered cancels when it can', () => {
    expect(picked(decide(choice('displace', ['seat-b', 'seat-c'], allies, ['cancel'])))).toBe('cancel');
  });
  it('Displace with only allies and no cancel picks an ally rather than failing', () => {
    expect(picked(decide(choice('displace', ['seat-b', 'seat-c'], allies)))).toMatch(/^seat-[bc]$/);
  });
});

describe('a Kingdom Wars variant is used like its base', () => {
  const seatWith = (generalId: string, n: number) => table(
    { 'seat-a:hand': Array.from({ length: n }, (_, i) => card(`k${i}`, 'shan')) },
    { generals: { 'seat-a': [generalId, 'filler-meng-huo'], 'seat-b': ['filler-jiang-wei', 'filler-liu-shan'] }, kingdoms: { 'seat-a': 'Shu', 'seat-b': 'Shu' } },
  );

  it.each([5, 1])('Kingdom Wars Liu Bei with %i cards decides as Liu Bei does', (n) => {
    const base = decide(seatWith('liu-bei', n));
    const alt = decide(seatWith('kingdomWars:liu-bei', n));
    expect(alt.kind).toBe(base.kind);
    if (n === 5) expect(alt).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'kingdomWars:benevolence' } });
  });

  it('gives the cards to an ally like Kindness', () => {
    const selecting = useSkill(seatWith('kingdomWars:liu-bei', 5), 'kingdomWars:benevolence');
    expect(picked(decide(selecting))).toHaveLength(2);
    const giving = act(selecting, decide(selecting));
    expect(picked(decide(giving))).toBe('seat-b');
  });
});

describe('Kingdom Wars Yue Jin, Dauntless', () => {
  const id = 'kingdomWars:dauntless';
  const sel = (step: string, eligibleIds: string[], seatId = 'seat-a'): PendingSelection => ({
    id: 'sel', seatId, reason: { kind: 'ability', owner: general('seat-b', id), abilityId: id }, of: 'cards', eligibleIds, min: 1, max: 1,
    then: { kind: 'skill-step', step: { kind: 'SkillStepEffect', owner: general('seat-b', id), step, data: { victim: 'seat-a' } } }, onCancel: [],
  });
  const ask = (kingdoms: Record<string, 'Wei' | 'Shu' | 'Wu' | 'Qun'>, hand: CardInstance[]) =>
    ({ ...asking(table({ 'seat-a:hand': hand }, { kingdoms }), id, 'seat-b') });

  it('is used against a non-ally while a Basic card is spare (below Dodge), else declined', () => {
    expect(picked(decide(ask({ 'seat-a': 'Wei', 'seat-b': 'Shu' }, [card('b1', 'sha')])))).toBe('use');
    expect(picked(decide(ask({ 'seat-a': 'Wei', 'seat-b': 'Wei' }, [card('b1', 'sha')])))).toBe('decline');
    expect(picked(decide(ask({ 'seat-a': 'Wei', 'seat-b': 'Shu' }, [card('b1', 'shan')])))).toBe('decline');
    expect(picked(decide(ask({ 'seat-a': 'Wei', 'seat-b': 'Shu' }, [card('t1', 'dismantle')])))).toBe('decline');
  });

  it('discards a card of her own pick; as the victim discards a spare Equipment card or takes the damage', () => {
    const s = table({ 'seat-a:hand': [card('b1', 'shan'), card('b2', 'sha')], 'seat-a:equip': [card('e1', 'crossbow')] });
    expect(decide({ ...s, pendingSelection: sel('discarded', ['b1', 'b2']) })).toMatchObject({ kind: 'SelectAction', ids: [expect.stringMatching(/^b[12]$/)] });
    const low = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, combinedHp: 1 } : x)), pendingSelection: sel('paid', ['e1']) };
    expect(decide(low)).toMatchObject({ kind: 'SelectAction', ids: ['e1'] });
  });
});

describe('Kingdom Wars Tian Feng, Deathly Counsel', () => {
  const id = 'kingdomWars:deathly-counsel';
  it('is used only when a non-ally has a hand or equipment card', () => {
    const foes = { kingdoms: { 'seat-b': 'Wei', 'seat-c': 'Wei', 'seat-d': 'Wei' } } as const;
    expect(picked(decide(asking(table({ 'seat-b:hand': [card('b1', 'sha')] }, { kingdoms: { 'seat-a': 'Qun' } }), id)))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-b:equip': [card('cb', 'crossbow')] }, { kingdoms: { 'seat-a': 'Qun' } }), id)))).toBe('use');
    expect(picked(decide(asking(table({}, foes), id)))).toBe('decline');
    // Only an ally has cards: declines.
    const allied = table({ 'seat-b:hand': [card('b1', 'sha')] }, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'Wu' } });
    expect(picked(decide(asking(allied, id)))).toBe('decline');
  });

  it('picks a non-ally seat, then its first offered card', () => {
    const seats = ['seat-b', 'seat-c'].map((seatId) => ({ id: seatId, shows: { kind: 'seat' as const, seatId }, effects: [] }));
    const base = table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Shu' } });
    const ask = (options: PendingChoice['options']): GameState => ({ ...base, pendingChoice: { id: 'p', seatId: 'seat-a', verb: 'pick', reason: { kind: 'ability', owner: general('seat-a', id), abilityId: id }, options } });
    expect(picked(decide(ask(seats)))).toBe('seat-c');
    const cards = [card('e1', 'crossbow'), card('e2', 'black-shield')].map((c) => ({ id: c.instanceId, shows: { kind: 'card' as const, card: c }, effects: [] }));
    expect(picked(decide(ask(cards)))).toBe('e1');
  });
});

describe('Kingdom Wars Kong Rong, Comity', () => {
  const id = 'kingdomWars:comity';
  it('is used only when an ally is alive to take the cards', () => {
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'Wu' } }), id)))).toBe('use');
    expect(picked(decide(asking(table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Shu', 'seat-d': 'Wu' } }), id)))).toBe('decline');
  });

  it('gives the cards to an ally', () => {
    const seats = ['seat-b', 'seat-c'].map((seatId) => ({ id: seatId, shows: { kind: 'seat' as const, seatId }, effects: [] }));
    const base = table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Wei' } });
    const ask: GameState = { ...base, pendingChoice: { id: 'p', seatId: 'seat-a', verb: 'give', reason: { kind: 'ability', owner: general('seat-a', id), abilityId: id }, options: seats } };
    expect(picked(decide(ask))).toBe('seat-c');
  });
});

describe('Kingdom Wars Ma Teng, Call of Valour', () => {
  const id = 'kingdomWars:call-of-valour';
  const pick = (s: GameState) => pickActiveSkill(s, s.seats[0], getLegalActions(s, 'seat-a', registry), registry, 'late');

  it('is used once, in the Play Phase, and not again', () => {
    const s = table({}, { hp: { 'seat-a': 3 }, generals: { 'seat-a': ['kingdomWars:ma-teng', 'filler-meng-huo', true] } });
    const action = pick(s);
    expect(action).toMatchObject({ owner: { skillId: id } });
    expect(pick(act(s, action!))).toBeUndefined();
  });

  it('is kept for later at full HP with no ally of his Kingdom', () => {
    expect(pick(table({}, { generals: { 'seat-a': ['kingdomWars:ma-teng', 'filler-meng-huo', true] } }))).toBeUndefined();
  });
});

describe('Kingdom Wars Ji Ling, Double Edged', () => {
  const id = 'kingdomWars:double-edged';
  const kingdoms = { 'seat-a': 'Wei', 'seat-b': 'Qun', 'seat-c': 'Wu', 'seat-d': 'Qun' } as const;
  // Seat-a's Play Phase begins (no Draw); he holds a K, seat-d (Qun, like seat-b) a 5.
  const starting = (mine = 13): GameState => {
    const t = table({ 'seat-a:hand': [card('k', 'peach', 'heart', mine)], 'seat-d:hand': [card('x', 'shan', 'spade', 5)] }, { kingdoms, hp: { 'seat-b': 2 }, generals: { 'seat-a': ['kingdomWars:ji-ling', 'filler-meng-huo', true] } });
    return advanceToDecision({ ...t, phase: 'Draw', turn: { ...t.turn, flags: { skipDraw: true } } }, ctx).state;
  };
  // Every decision made by the bots until nothing is pending.
  const played = (s: GameState): GameState => {
    for (let i = 0; i < 20 && (s.pendingChoice || s.pendingSelection || s.pendingResponse); i++) s = act(s, decide(s));
    return s;
  };

  it('with a high card, uses it, competes, and aims the Sha at the weakest non-ally of the loser’s Kingdom', () => {
    const s = starting();
    expect(s.pendingChoice?.reason).toMatchObject({ abilityId: id });
    expect(picked(decide(s))).toBe('use');
    const done = played(s);
    expect(done.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'seat-a', card: { as: 'sha' }, targets: [{ seatId: 'seat-b' }] });
    expect(done.seats.find((x) => x.id === 'seat-b')!.combinedHp).toBe(1);
  });

  it('declines without a high card', () => {
    expect(picked(decide(starting(6)))).toBe('decline');
  });
});

describe('Kingdom Wars Zou Shi', () => {
  // The bot leaves both her active skills alone (legal: they are optional); a hidden Zou Shi plays on hidden.
  it.each([true, false])('never uses Femme Fatale or Impetus for Conflicts (revealed: %s)', (revealed) => {
    let s = table({ 'seat-a:hand': [card('e1', 'red-hare'), card('e2', 'axe')] }, { generals: { 'seat-a': ['kingdomWars:zou-shi', 'filler-meng-huo', revealed] } });
    expect(getLegalActions(s, 'seat-a', registry).some((a) => a.kind === 'UseSkillAction')).toBe(true);
    for (let i = 0; i < 10 && s.turn.ownerSeatId === 'seat-a' && s.phase === 'Play' && actor(s) === 'seat-a'; i++) {
      const action = decide(s);
      expect(action.kind).not.toBe('UseSkillAction');
      s = act(s, action);
    }
  });
});
