import { Action, ContentRegistry, GameState, Target } from 'engine';
import { buildContentRegistry } from 'content';
import { makeTranslator } from './i18n/translator';
import { vi } from './i18n/vi';
import {
  actionLabel, cardIdDisplayName, conversionLabel, generalDisplayName, kingdomDisplayName, registryCardName, seatName, suitLabel, targetLabel, targetingParts,
} from './labels';

const tr = makeTranslator(vi);

function stateWithZones(): GameState {
  return {
    seats: [],
    players: [{ id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' }],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play',
    zones: [{ id: 'hand-0', kind: 'hand', ownerSeatId: 'seat-0', cards: [{ instanceId: 'card-1', definitionId: 'sha', suit: 'spade', rank: 7 }] }],
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null,
    generalSelection: null,
  };
}
function registryWithSha(): ContentRegistry {
  return { cards: new Map([['sha', { id: 'sha', name: 'Sha', category: 'basic', play: () => [] }]]), generals: new Map() };
}
const state = stateWithZones();
const registry = registryWithSha();

describe('seat and target names', () => {
  it('a player keeps their name; a nameless seat is named in the viewer’s language', () => {
    expect(seatName(state.players, 'seat-0', tr)).toBe('Hing');
    expect(seatName([], 'seat-3', tr)).toBe('Người chơi 3');
    expect(seatName([], 'seat-3')).toBe('Seat 3');
    expect(seatName([], 'seat-12', tr)).toBe('Người chơi 12');
  });

  it('an id that is not seat-<digits> keeps its Title Case, and an empty player name stays empty', () => {
    expect(seatName([], 'seat-a', tr)).toBe('Seat A');
    expect(seatName([], 'p1', tr)).toBe('P1');
    expect(seatName([{ id: 'p', seatId: 'seat-0', kind: 'bot', name: '' }], 'seat-0', tr)).toBe('');
  });

  it('a seat target, and a Main or Deputy General target', () => {
    const seat: Target = { kind: 'seat', seatId: 'seat-0' };
    expect(targetLabel(seat, state.players, tr)).toBe('Hing');
    expect(targetLabel({ kind: 'general', seatId: 'seat-0', generalSlot: 'main' }, state.players, tr)).toBe('Chủ tướng của Hing');
    expect(targetLabel({ kind: 'general', seatId: 'seat-0', generalSlot: 'deputy' }, state.players, tr)).toBe('Phó tướng của Hing');
    expect(targetLabel({ kind: 'general', seatId: 'seat-0', generalSlot: 'deputy' }, state.players)).toBe("Hing's Deputy General");
  });
});

describe('hidden names, kingdoms and suits', () => {
  it('hidden card and General', () => {
    expect(cardIdDisplayName('hidden', tr)).toBe('Lá bài ẩn');
    expect(cardIdDisplayName('hidden')).toBe('Hidden Card');
    expect(cardIdDisplayName('silver-lion', tr)).toBe('Silver Lion');
    expect(generalDisplayName('hidden', tr)).toBe('Tướng ẩn');
    expect(generalDisplayName('hidden')).toBe('Hidden General');
    expect(generalDisplayName('xiahou-dun', tr)).toBe('Xiahou Dun');
  });

  it('the four forces and hidden, and a kingdom outside them prints raw', () => {
    expect((['Wei', 'Shu', 'Wu', 'Qun', 'hidden'] as const).map((k) => kingdomDisplayName(k, tr))).toEqual(['Ngụy', 'Thục', 'Ngô', 'Quần', 'Ẩn']);
    expect((['Wei', 'Shu', 'Wu', 'Qun', 'hidden'] as const).map((k) => kingdomDisplayName(k))).toEqual(['Wei', 'Shu', 'Wu', 'Qun', 'Hidden']);
    expect(kingdomDisplayName('Jin' as never, tr)).toBe('Jin');
  });

  it('all four suits', () => {
    expect((['spade', 'heart', 'club', 'diamond'] as const).map((s) => suitLabel(s, tr))).toEqual(['♠ Bích', '♥ Cơ', '♣ Chuồn', '♦ Rô']);
    expect((['spade', 'heart', 'club', 'diamond'] as const).map((s) => suitLabel(s))).toEqual(['♠ Spade', '♥ Heart', '♣ Club', '♦ Diamond']);
  });
});

describe('action labels', () => {
  const label = (action: Action, translator?: typeof tr) => actionLabel(action, state, registry, translator);
  const rows: Array<[string, Action, string, string]> = [
    ['draw one', { kind: 'DrawCardsAction', seatId: 'seat-0', count: 1 }, 'Draw 1 Card', 'Rút 1 lá bài'],
    ['draw two', { kind: 'DrawCardsAction', seatId: 'seat-0', count: 2 }, 'Draw 2 Cards', 'Rút 2 lá bài'],
    ['play', { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [] }, 'Play Sha', 'Đánh Sha'],
    ['play at a seat', { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-0' }] }, 'Play Sha Targeting Hing', 'Đánh Sha nhắm vào Hing'],
    ['play at two seats', { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-0' }, { kind: 'seat', seatId: 'seat-1' }] }, 'Play Sha Targeting Hing, Seat 1', 'Đánh Sha nhắm vào Hing, Người chơi 1'],
    ['choose Generals', { kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId: 'cao-cao', deputyId: 'xu-chu' }, 'Choose Cao Cao (Main) and Xu Chu (Deputy)', 'Chọn Cao Cao (chính) và Xu Chu (phụ)'],
    ['reveal main', { kind: 'RevealGeneralAction', seatId: 'seat-0', slot: 'main' }, 'Reveal Main General', 'Lật Chủ tướng'],
    ['reveal deputy', { kind: 'RevealGeneralAction', seatId: 'seat-0', slot: 'deputy' }, 'Reveal Deputy General', 'Lật Phó tướng'],
    ['respond', { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 'card-1' }, 'Respond with Sha', 'Phản hồi bằng Sha'],
    ['pass', { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' }, 'Pass', 'Bỏ qua'],
    ['end phase', { kind: 'EndPhaseAction', seatId: 'seat-0' }, 'End Phase', 'Kết thúc giai đoạn'],
    ['choose', { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c', optionId: 'o' }, 'Choose', 'Chọn'],
    ['use a skill', { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'reconsider' } }, 'Use Reconsider', 'Dùng Reconsider'],
    ['use an equipment skill', { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'card-1' } }, 'Use Skill', 'Dùng kỹ năng'],
    ['arrange', { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'a', top: [], bottom: [] }, 'Arrange', 'Sắp xếp'],
    ['select', { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's', ids: [] }, 'Confirm', 'Xác nhận'],
    ['cancel', { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's' }, 'Cancel', 'Hủy'],
    ['discard', { kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'card-1' }, 'Discard Sha', 'Bỏ Sha'],
  ];
  it.each(rows)('%s', (_name, action, english, vietnamese) => {
    expect(label(action)).toBe(english);
    expect(label(action, tr)).toBe(vietnamese);
  });

  it('the targeting prefix is the targetless label plus Targeting, and parts agree with the full label', () => {
    const play: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-0' }] };
    expect(targetingParts(play, state, registry)).toEqual({ prefix: 'Play Sha Targeting', targets: [{ kind: 'seat', seatId: 'seat-0' }] });
    expect(targetingParts(play, state, registry, tr)).toEqual({ prefix: 'Đánh Sha nhắm vào', targets: [{ kind: 'seat', seatId: 'seat-0' }] });
    expect(targetingParts({ ...play, targets: [] }, state, registry, tr)).toBeNull();
    expect(`${targetingParts(play, state, registry)!.prefix} Hing`).toBe(actionLabel(play, state, registry));
  });
});

describe('conversion labels', () => {
  const base = stateWithZones();
  const withSpear: GameState = {
    ...base,
    zones: [...base.zones, { id: 'equip-0', kind: 'equip', ownerSeatId: 'seat-0', cards: [{ instanceId: 'spear', definitionId: 'serpent-spear', suit: 'spade', rank: 12 }] }],
  };
  const spearRegistry = registryWithSha();
  spearRegistry.cards.set('serpent-spear', {
    id: 'serpent-spear', name: 'Serpent Spear', category: 'equipment', equipSlot: 'weapon', play: () => [],
    abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' }] },
  });
  const useSpear = (targets: Target[]): Extract<Action, { kind: 'UseConversionAction' }> => ({
    kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'spear' }, conversionId: 'serpent-spear' }, targets,
  });

  it('a worn card’s conversion, without and with targets', () => {
    expect(conversionLabel(useSpear([]), withSpear, spearRegistry)).toBe('Use 2 Cards as Sha');
    expect(conversionLabel(useSpear([]), withSpear, spearRegistry, tr)).toBe('Dùng 2 lá bài làm Sha');
    const at = [{ kind: 'seat' as const, seatId: 'seat-1' }];
    expect(conversionLabel(useSpear(at), withSpear, spearRegistry)).toBe('Use 2 Cards as Sha Targeting Seat 1');
    expect(conversionLabel(useSpear(at), withSpear, spearRegistry, tr)).toBe('Dùng 2 lá bài làm Sha nhắm vào Người chơi 1');
  });

  it('a conversion that cannot be found falls back to Use Cards', () => {
    const missing = useSpear([]);
    missing.via.conversionId = 'nope';
    expect(conversionLabel(missing, withSpear, spearRegistry)).toBe('Use Cards');
    expect(conversionLabel(missing, withSpear, spearRegistry, tr)).toBe('Dùng các lá bài');
  });

  it('a skill’s conversion names what it makes and the skill', () => {
    const real = buildContentRegistry();
    const seated: GameState = {
      ...base,
      seats: [{
        id: 'seat-0', index: 0, kingdom: 'Shu', eliminated: false, combinedHp: 4, maxCombinedHp: 4,
        generals: { main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'wei-yan', revealed: true } },
        hand: { zoneId: 'hand-0' }, equipped: { zoneId: 'equip-0' }, judgment: { zoneId: 'judgment-0' },
      }],
    };
    const use: Extract<Action, { kind: 'UseConversionAction' }> = {
      kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'fighting-saint' }, conversionId: 'fighting-saint' }, targets: [],
    };
    expect(conversionLabel(use, seated, real)).toBe('As Sha · Fighting Saint');
    expect(conversionLabel(use, seated, real, tr)).toBe('Tính là Sha · Fighting Saint');
  });
});

describe('General and skill names follow the translator locale', () => {
  const trVi = makeTranslator(vi, 'vi');
  const useEvilHero: Action = { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'evil-hero' } };

  it('a skill label uses the Vietnamese skill name, and the English translator the English one', () => {
    expect(actionLabel(useEvilHero, state, registry, trVi)).toBe('Dùng Gian hùng');
    expect(actionLabel(useEvilHero, state, registry, tr)).toBe('Dùng Evil Hero');
    expect(actionLabel(useEvilHero, state, registry)).toBe('Use Evil Hero');
  });

  it('a skill with no Vietnamese name keeps its English name', () => {
    const reconsider: Action = { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'made-up-skill' } };
    expect(actionLabel(reconsider, state, registry, trVi)).toBe('Dùng Made Up Skill');
  });
});

describe('card names in action labels follow the translator locale', () => {
  const trVi = makeTranslator(vi, 'vi');
  it('a registry card reads in Vietnamese, and in English with no translator', () => {
    expect(registryCardName(registry, 'sha', trVi)).toBe('Sát');
    expect(registryCardName(registry, 'sha')).toBe('Sha');
    expect(registryCardName(registry, 'sha', tr)).toBe('Sha');
    expect(registryCardName(registry, 'no-such-card', trVi)).toBe('no-such-card');
  });
});

describe('the mode’s default seat name', () => {
  const players = [
    { id: 'p0', seatId: 'seat-0', kind: 'bot' as const, name: 'Seat 0' },
    { id: 'p1', seatId: 'seat-1', kind: 'human' as const, name: 'Hing' },
    { id: 'p2', seatId: 'seat-2', kind: 'bot' as const, name: 'Seat 5' },
  ];
  it('is a placeholder, shown in the language, while a chosen name is kept', () => {
    expect(seatName(players, 'seat-0', tr)).toBe('Người chơi 0');
    expect(seatName(players, 'seat-0')).toBe('Seat 0');
    expect(seatName(players, 'seat-1', tr)).toBe('Hing');
    expect(seatName(players, 'seat-2', tr)).toBe('Seat 5');
  });
});
