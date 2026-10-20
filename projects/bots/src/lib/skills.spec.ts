import type { CardInstance, Effect, GameState, PendingSelection } from 'engine';
import { getLegalActions } from 'engine';
import { conversionSpare } from './skills';
import { registry, mode, ctx, card, Options, table, actor, decide, act, general, asking, picked, useSkill } from './testing';

describe('may-skills the bot always uses', () => {
  it.each(['evil-hero', 'feedback', 'heavens-envy', 'bestowed-rouse', 'gathering-wisdom', 'brave-gesture', 'self-restraint', 'river-goddess', 'iron-cavalry', 'astrology'])('%s', (skillId) => {
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
