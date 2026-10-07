import { advanceToDecision, getLegalActions, redactStateForSeat, resolve } from 'engine';
import type { Action, CardInstance, Effect, GameModeDefinition, GameState, GeneralOwner, Kingdom, PendingChoice, PendingSelection } from 'engine';
import { buildContentRegistry } from 'content';
import { ruleBasedPolicy } from './rule-based';

const registry = buildContentRegistry();
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };
const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });

interface Options {
  generals?: Record<string, [string, string, boolean?]>;
  kingdoms?: Record<string, Kingdom>;
  hp?: Record<string, number>;
  maxHp?: Record<string, number>;
  owner?: string;
}
// Four seats (Wei, Shu, Wu, Qun by default) at 4/4 HP, all Generals revealed; seat-a's Play Phase.
function table(cards: Record<string, CardInstance[]> = {}, o: Options = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  const kingdoms: Kingdom[] = ['Wei', 'Shu', 'Wu', 'Qun'];
  return {
    seats: ids.map((id, index) => {
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['xu-huang', 'dong-zhuo'];
      return {
        id, index, kingdom: o.kingdoms?.[id] ?? kingdoms[index], eliminated: false,
        generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: deputy, revealed } },
        combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: o.maxHp?.[id] ?? 4,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      };
    }),
    players: [], turn: { turnNumber: 1, ownerSeatId: o.owner ?? 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: cards['processing'] ?? [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const actor = (s: GameState) => s.pendingChoice?.seatId ?? s.pendingSelection?.seatId ?? s.pendingResponse?.respondingSeatId ?? s.turn.ownerSeatId;
const decide = (s: GameState): Action => {
  const seatId = actor(s);
  return ruleBasedPolicy.decide(redactStateForSeat(s, seatId), seatId, getLegalActions(s, seatId, registry), registry, null).action;
};
const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const general = (seatId: string, skillId: string): GeneralOwner => ({ kind: 'general', seatId, slot: 'main', skillId });
// An ask of `skillId` for seat-a, about `targetSeatId`; Don't queues `otherwise`.
const asking = (s: GameState, skillId: string, targetSeatId?: string, otherwise: Effect[] = []): GameState => {
  const choice: PendingChoice = {
    id: 'ask', seatId: 'seat-a', verb: 'use',
    reason: { kind: 'ability', owner: general('seat-a', skillId), abilityId: skillId, ...(targetSeatId ? { targetSeatId } : {}) },
    options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: otherwise }],
  };
  return { ...s, pendingChoice: choice };
};
const picked = (a: Action) => (a.kind === 'ChooseOptionAction' ? a.optionId : a.kind === 'SelectAction' ? a.ids : a.kind);
const useSkill = (s: GameState, skillId: string) => {
  const action = getLegalActions(s, 'seat-a', registry).find((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId)!;
  return act(s, action);
};

describe('may-skills the bot always uses', () => {
  it.each(['evil-hero', 'feedback', 'heavens-envy', 'bestowed-rouse', 'gathering-wisdom', 'brave-gesture', 'self-restraint', 'river-goddess', 'iron-cavalry', 'astrology'])('%s', (skillId) => {
    expect(picked(decide(asking(table(), skillId)))).toBe('use');
  });

  it('keeps both Bestowed Rouse cards (cancels the giving)', () => {
    const selection: PendingSelection = { id: 'sel', seatId: 'seat-a', reason: { kind: 'ability', owner: general('seat-a', 'bestowed-rouse'), abilityId: 'bestowed-rouse' }, of: 'cards', eligibleIds: ['d1'], min: 1, max: 1, then: { kind: 'give', toSeatIds: ['seat-b'] }, onCancel: [] };
    expect(picked(decide({ ...table({ 'seat-a:hand': [card('d1', 'shan')] }), pendingSelection: selection }))).toBe('CancelSelectionAction');
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

  it('Bare the Chest when holding 2 or more Sha', () => {
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha')] }), 'bare-the-chest')))).toBe('use');
    expect(picked(decide(asking(table({ 'seat-a:hand': [card('s1', 'sha')] }), 'bare-the-chest')))).toBe('decline');
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
      table({ 'seat-a:hand': hand, drawPile: [card('d1', 'shan'), card('d2', 'shan')] }, { generals: { 'seat-a': ['huang-gai', 'sun-jian'] }, kingdoms: { 'seat-a': 'Wu' }, hp: { 'seat-a': combinedHp }, maxHp: { 'seat-a': maxHp } });
    expect(decide(huangGai(4))).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'battered-body' } });
    expect(decide(huangGai(3, [card('p', 'peach', 'heart')], 3))).toMatchObject({ kind: 'UseSkillAction' });
    expect(decide(huangGai(3)).kind).toBe('EndPhaseAction');
  });

  it('Reconsider discards every hand card ranked below Shan, never a Peach or worn cards', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach', 'heart'), card('n', 'shan'), card('x', 'harvest', 'heart', 3), card('s', 'sha')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)] }, { generals: { 'seat-a': ['sun-quan', 'sun-jian'] }, kingdoms: { 'seat-a': 'Wu' } });
    const selecting = useSkill(s, 'reconsider');
    expect(picked(decide(selecting))).toEqual(['x', 's']);
  });

  it('Kindness gives the cards above 3 to a revealed ally', () => {
    const hand = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id) => card(id, 'shan'));
    const s = table({ 'seat-a:hand': hand }, { generals: { 'seat-a': ['liu-bei', 'meng-huo'], 'seat-b': ['jiang-wei', 'liu-shan'] }, kingdoms: { 'seat-a': 'Shu', 'seat-b': 'Shu' } });
    expect(decide(s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'kindness' } });
    const selecting = useSkill(s, 'kindness');
    expect(picked(decide(selecting))).toHaveLength(2);
    const giving = act(selecting, decide(selecting));
    expect(picked(decide(giving))).toBe('seat-b');
  });

  it('Sow Revolt at the non-ally with the lowest HP', () => {
    // seat-c is Wu too (an ally); seat-d is the weakest non-ally.
    const s = table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: { 'seat-a': ['zhou-yu', 'sun-jian'] }, kingdoms: { 'seat-a': 'Wu' }, hp: { 'seat-c': 1, 'seat-d': 2 } });
    const selecting = useSkill(s, 'sow-revolt');
    expect(picked(decide(selecting))).toEqual(['seat-d']);
  });

  it('Green Vesicle heals itself first', () => {
    const s = table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: { 'seat-a': ['hua-tuo', 'jia-xu'] }, kingdoms: { 'seat-a': 'Qun' }, hp: { 'seat-a': 2, 'seat-b': 2 } });
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
  it('with a card to spare and a non-ally to move the Sha to', () => {
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
  it('Fighting Saint as a Sha when no real Sha is in hand, never spending a Peach', () => {
    const guanYu = (hand: CardInstance[]) => table({ 'seat-a:hand': hand }, { generals: { 'seat-a': ['guan-yu', 'meng-huo'] }, kingdoms: { 'seat-a': 'Shu' } });
    expect(decide(guanYu([card('h', 'shan', 'heart')]))).toMatchObject({ kind: 'UseConversionAction', via: { conversionId: 'fighting-saint' } });
    expect(decide(guanYu([card('p', 'peach', 'heart')])).kind).toBe('EndPhaseAction');
  });

  it('a hidden General’s conversion only when the bot may reveal', () => {
    const hidden = table({ 'seat-a:hand': [card('h', 'shan', 'heart')] }, { generals: { 'seat-a': ['guan-yu', 'meng-huo', false] }, kingdoms: { 'seat-a': 'Shu' }, hp: { 'seat-a': 3 } });
    expect(decide(hidden).kind).toBe('EndPhaseAction');
  });
});
