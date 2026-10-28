import { CardInstance, EngineEvent, usedCardOf } from 'engine';
import { abilityName } from 'content';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { actionHistory } from './action-history';

const tr = makeTranslator(vi);
const lines = (log: EngineEvent[], translator?: typeof tr) =>
  actionHistory(log, [], players, [], translator).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
const en_ = (log: EngineEvent[]) => lines(log);
const vi_ = (log: EngineEvent[]) => lines(log, tr);

const general = (seatId: string, skillId: string) => ({ kind: 'general' as const, seatId, slot: 'main' as const, skillId });
const used = (outcome: string, extra: { targetSeatId?: string; cardId?: string; seatId?: string; abilityId?: string } = {}): EngineEvent => ({
  kind: 'AbilityUsedEvent',
  owner: general(extra.seatId ?? 'seat-0', extra.abilityId ?? 'axe'),
  abilityId: extra.abilityId ?? 'axe',
  outcome,
  ...(extra.targetSeatId ? { targetSeatId: extra.targetSeatId } : {}),
  ...(extra.cardId ? { cardId: extra.cardId } : {}),
});
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });
const players = [0, 1, 2, 3].map((i) => ({ id: `p${i}`, seatId: `seat-${i}`, kind: 'bot' as const, name: `Seat ${i}` }));

type Row = [name: string, outcome: string, targeted: boolean, cardId: string | null, english: string, vietnamese: string];
const rows: Row[] = [
  ['used', 'used', false, null, 'Seat 0 used Axe', 'Người chơi 0 dùng Axe'],
  ['no-effect', 'no-effect', true, null, "Seat 0's Axe: Seat 1's Slash has no effect", 'Axe của Người chơi 0: Slash của Người chơi 1 không có hiệu lực'],
  ['counts-as-shan, not folded', 'counts-as-shan', false, null, "Seat 0's Axe counts as Dodge", 'Axe của Người chơi 0 tính là Dodge'],
  ['more-damage', 'more-damage', false, null, "Seat 0's Axe: 1 more damage", 'Axe của Người chơi 0: thêm 1 sát thương'],
  ['unblockable', 'unblockable', true, null, "Seat 0's Axe: Seat 1 can't play a Dodge", 'Axe của Người chơi 0: Người chơi 1 không thể đánh Dodge'],
  ['moved', 'moved', true, null, "Seat 0's Axe moved the Slash to Seat 1", 'Axe của Người chơi 0 chuyển Slash sang Người chơi 1'],
  ['claim-true', 'claim-true', false, 'sha', "Seat 0's Slash was true", 'Slash của Người chơi 0 là thật'],
  ['claim-false', 'claim-false', false, 'sha', "Seat 0's Slash was a bluff", 'Slash của Người chơi 0 là nói dối'],
  ['took-hand-card', 'took-hand-card', true, null, 'Seat 0 took a hand card from Seat 1 (Axe)', 'Người chơi 0 lấy một lá bài trên tay của Người chơi 1 (Axe)'],
  ['reborn', 'reborn', false, null, 'Seat 0 used Axe: discards every card, draws 3, recovers to 3 HP and turns face up', 'Người chơi 0 dùng Axe: bỏ mọi lá bài, rút 3, hồi Sinh lực lên 3 và lật lại'],
  ['paid-weapon', 'paid-weapon', false, null, 'Seat 0 discarded a Weapon for Axe', 'Người chơi 0 bỏ một Vũ khí để dùng Axe'],
  ['struck', 'struck', true, null, 'Seat 0 struck Seat 1 with Axe', 'Người chơi 0 đánh Người chơi 1 bằng Axe'],
  ['drew-up', 'drew-up', true, null, "Seat 0's Axe: Seat 1 draws up to its max HP", 'Axe của Người chơi 0: Người chơi 1 rút bài đến Sinh lực tối đa'],
  ['judged-red', 'judged-red', false, null, "Seat 0's Axe: black hand cards can be used as Duel this turn", 'Axe của Người chơi 0: các lá bài đen trên tay có thể dùng làm Duel trong lượt này'],
  ['judged-black', 'judged-black', false, null, "Seat 0's Axe: red hand cards can be used as Duel this turn", 'Axe của Người chơi 0: các lá bài đỏ trên tay có thể dùng làm Duel trong lượt này'],
  ['discarded', 'discarded', true, null, "Seat 0's Axe: discards one of Seat 1's cards", 'Axe của Người chơi 0: bỏ một lá bài của Người chơi 1'],
  ['recast', 'recast', false, null, 'Seat 0 recast a club with Axe', 'Người chơi 0 đổi lại một lá ♣ bằng Axe'],
  ['took-cards', 'took-cards', true, null, "Seat 0 took all of Seat 1's cards (Axe)", 'Người chơi 0 lấy toàn bộ bài của Người chơi 1 (Axe)'],
  ['exiled', 'exiled', true, null, "Seat 0's Axe: Seat 1 turns over and draws cards", 'Axe của Người chơi 0: Người chơi 1 lật mặt và rút bài'],
  ['revealed', 'revealed', false, null, 'Seat 0 used Axe', 'Người chơi 0 dùng Axe'],
  ['culprit', 'culprit', true, null, "Seat 0's Axe: the damage to Seat 1 counts as theirs", 'Axe của Người chơi 0: sát thương lên Người chơi 1 tính là của họ'],
  ['took-card', 'took-card', false, null, "Seat 0's Axe: took the Tool card", 'Axe của Người chơi 0: lấy lá Cẩm nang'],
  ['drew, with a target', 'drew', true, null, "Seat 0's Axe: Seat 1 draws and discards", 'Axe của Người chơi 0: Người chơi 1 rút bài rồi bỏ bài'],
  ['drew, no target', 'drew', false, null, 'Seat 0 drew a card (Axe)', 'Người chơi 0 rút một lá bài (Axe)'],
  ['gave', 'gave', true, null, 'Seat 0 gave half of their hand to Seat 1 (Axe)', 'Người chơi 0 đưa một nửa bài trên tay cho Người chơi 1 (Axe)'],
  ['collapsed', 'collapsed', false, null, 'Seat 0 lost 1 HP to Axe', 'Người chơi 0 mất 1 Sinh lực vì Axe'],
  ['collapsed-max', 'collapsed-max', false, null, 'Seat 0 reduced their max HP with Axe', 'Người chơi 0 giảm Sinh lực tối đa bằng Axe'],
  ['skipped-draw', 'skipped-draw', false, null, 'Seat 0 skipped their Draw Phase with Axe', 'Người chơi 0 bỏ qua giai đoạn rút bài của mình bằng Axe'],
  ['skipped-judgment', 'skipped-judgment', false, null, 'Seat 0 skipped their Judgment Phase with Axe', 'Người chơi 0 bỏ qua giai đoạn phán xét của mình bằng Axe'],
  ['skipped-play', 'skipped-play', false, null, 'Seat 0 skipped their Play Phase with Axe', 'Người chơi 0 bỏ qua giai đoạn ra bài của mình bằng Axe'],
  ['skipped-discard', 'skipped-discard', false, null, 'Seat 0 skipped their Discard Phase with Axe', 'Người chơi 0 bỏ qua giai đoạn bỏ bài của mình bằng Axe'],
  ['skipped, an unknown phase', 'skipped-start', false, null, 'Seat 0 skipped their Start Phase with Axe', 'Người chơi 0 bỏ qua giai đoạn Start của mình bằng Axe'],
  ['moved-card', 'moved-card', true, null, 'Seat 0 moved a card to Seat 1 (Axe)', 'Người chơi 0 chuyển một lá bài cho Người chơi 1 (Axe)'],
  ['farmed', 'farmed', false, null, "Seat 0's Axe: the judged card becomes a Farm", 'Axe của Người chơi 0: lá phán xét trở thành Điền'],
  ['awakened', 'awakened', false, null, 'Seat 0 awakened: Axe', 'Người chơi 0 thức tỉnh: Axe'],
  ['paid', 'paid', true, null, "Seat 1 discarded a Basic card for Seat 0's Axe", 'Người chơi 1 bỏ một lá bài Cơ bản cho Axe của Người chơi 0'],
  ['extra-turn', 'extra-turn', true, null, 'Seat 0 gave Seat 1 an extra turn (Axe)', 'Người chơi 0 cho Người chơi 1 thêm một lượt (Axe)'],
  ['placed', 'placed', true, null, "Seat 0 placed an Equipment card in Seat 1's equipment (Axe)", 'Người chơi 0 đặt một lá bài Trang bị vào trang bị của Người chơi 1 (Axe)'],
  ['gave-back', 'gave-back', true, null, 'Seat 0 gave a discarded card back to Seat 1 and took the rest (Axe)', 'Người chơi 0 trả lại một lá bài đã bỏ cho Người chơi 1 và lấy phần còn lại (Axe)'],
  ['lamented', 'lamented', true, null, "Seat 0's Axe: Seat 1 judges", 'Axe của Người chơi 0: Người chơi 1 phán xét'],
  ['silenced', 'silenced', true, null, 'Seat 1 loses all skills (Axe)', 'Người chơi 1 mất mọi kỹ năng (Axe)'],
  ['silenced-main', 'silenced-main', true, null, "Seat 1's Main General loses all skills (Axe)", 'Chủ tướng của Người chơi 1 mất mọi kỹ năng (Axe)'],
  ['silenced-deputy', 'silenced-deputy', true, null, "Seat 1's Deputy General loses all skills (Axe)", 'Phó tướng của Người chơi 1 mất mọi kỹ năng (Axe)'],
  ['new-form', 'new-form', false, null, 'Seat 0 gained a Form (Axe)', 'Người chơi 0 nhận một Hóa thân (Axe)'],
];

describe('ability outcomes in English and Vietnamese', () => {
  it.each(rows)('%s', (_name, outcome, targeted, cardId, english, vietnamese) => {
    const log = [used(outcome, { ...(targeted ? { targetSeatId: 'seat-1' } : {}), ...(cardId ? { cardId } : {}) })];
    expect(en_(log)).toEqual([english]);
    expect(vi_(log)).toEqual([vietnamese]);
  });

  it('an outcome that needs a target prints nothing without one', () => {
    for (const outcome of ['no-effect', 'unblockable', 'moved', 'took-hand-card', 'struck', 'took-cards', 'gave', 'paid', 'silenced', 'silenced-main', 'silenced-deputy']) {
      expect({ outcome, lines: en_([used(outcome)]) }).toEqual({ outcome, lines: [] });
    }
  });

  it('Upheaval says what every other seat must do', () => {
    const upheaval = abilityName('upheaval');
    const log = [used('used', { abilityId: 'upheaval' })];
    expect(en_(log)).toEqual([`Seat 0 used ${upheaval}: every other seat plays a Slash or loses 1 HP`]);
    expect(vi_(log)).toEqual([`Người chơi 0 dùng ${upheaval}: mỗi người chơi khác phải đánh một Slash hoặc mất 1 Sinh lực`]);
  });

  it('Kingdom Wars Descend into Chaos says the same', () => {
    const chaos = abilityName('kingdomWars:descend-into-chaos');
    const log = [used('used', { abilityId: 'kingdomWars:descend-into-chaos' })];
    expect(en_(log)).toEqual([`Seat 0 used ${chaos}: every other seat plays a Slash or loses 1 HP`]);
  });
});

describe('Refusing Death and Fantasy', () => {
  const turned: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
  const put: EngineEvent = { kind: 'CardMovedEvent', cardInstanceId: 'sha-1', fromZoneId: 'drawPile', toZoneId: 'seat-0:pile', card: turned };
  const zones = [{ id: 'seat-0:pile', kind: 'pile' as const, ownerSeatId: 'seat-0', cards: [] }];
  const of = (log: EngineEvent[], translator?: typeof tr) => actionHistory(log, zones, players, [], translator).flatMap((e) => (e.kind === 'action' ? [e.text] : [])).slice(0, 1);

  it('names the turned card, then no match or a match', () => {
    const death = (outcome: string) => [put, used(outcome, { abilityId: 'refusing-death' })];
    expect(of(death('stays-alive'))).toEqual(["Seat 0's Refusing Death: 7 ♠ (no match)"]);
    expect(of(death('stays-alive'), tr)).toEqual([`${abilityName('refusing-death')} của Người chơi 0: 7 ♠ (không trùng khớp)`]);
    expect(of(death('matched'))).toEqual(["Seat 0's Refusing Death: 7 ♠ matched"]);
    expect(of(death('matched'), tr)).toEqual([`${abilityName('refusing-death')} của Người chơi 0: 7 ♠ trùng khớp`]);
  });

  it('Fantasy moved the damage', () => {
    const moved = [used('moved-damage', { abilityId: 'fantasy', targetSeatId: 'seat-3' })];
    expect(of(moved)).toEqual(["Seat 0's Fantasy moved the damage to Seat 3"]);
    expect(of(moved, tr)).toEqual([`${abilityName('fantasy')} của Người chơi 0 chuyển sát thương sang Người chơi 3`]);
  });
});

describe('swapping hands', () => {
  it('names both seats, or "a seat" when the first was never named', () => {
    const both = [used('swap-first', { targetSeatId: 'seat-2' }), used('swapped', { targetSeatId: 'seat-1' })];
    expect(en_(both)).toEqual(['Seat 2 and Seat 1 swapped hands (Axe)']);
    expect(vi_(both)).toEqual(['Người chơi 2 và Người chơi 1 đổi bài trên tay cho nhau (Axe)']);
    const alone = [used('swapped', { targetSeatId: 'seat-1' })];
    expect(en_(alone)).toEqual(['A seat and Seat 1 swapped hands (Axe)']);
    expect(vi_(alone)).toEqual(['Một người chơi và Người chơi 1 đổi bài trên tay cho nhau (Axe)']);
  });
});

describe('competing', () => {
  const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
  const peach: CardInstance = { instanceId: 'peach-1', definitionId: 'peach', suit: 'heart', rank: 12 };
  const shown: EngineEvent[] = [
    { kind: 'CardShownEvent', seatId: 'seat-0', card: sha },
    { kind: 'CardShownEvent', seatId: 'seat-1', card: peach },
  ];
  const justice = abilityName('heavens-justice');

  it('folds the two shown cards into one line, and names the winner', () => {
    const won = [...shown, used('compete-won', { targetSeatId: 'seat-1', abilityId: 'heavens-justice' })];
    expect(en_(won)).toEqual([
      `Seat 0's ${justice}: one more Slash this turn, at any distance, with one more target`,
      'Seat 0 competed with Seat 1: 7 ♠ against Q ♥, Seat 0 won',
    ]);
    expect(vi_(won)).toEqual([
      `${justice} của Người chơi 0: thêm một Slash trong lượt này, ở mọi khoảng cách, thêm một mục tiêu`,
      'Người chơi 0 đấu điểm với Người chơi 1: 7 ♠ so với Q ♥, Người chơi 0 thắng',
    ]);
  });

  it('a lost compete names the other seat as the winner, and bars the Slash', () => {
    const lost = [...shown, used('compete-lost', { targetSeatId: 'seat-1', abilityId: 'heavens-justice' })];
    expect(en_(lost)).toEqual([`Seat 0's ${justice}: no Slash this turn`, 'Seat 0 competed with Seat 1: 7 ♠ against Q ♥, Seat 1 won']);
    expect(vi_(lost)).toEqual([`${justice} của Người chơi 0: không có Slash trong lượt này`, 'Người chơi 0 đấu điểm với Người chơi 1: 7 ♠ so với Q ♥, Người chơi 1 thắng']);
  });

  it('with no shown cards prints no faces, and no follow-up for another skill', () => {
    const bare = [used('compete-won', { targetSeatId: 'seat-1' })];
    expect(en_(bare)).toEqual(['Seat 0 competed with Seat 1, Seat 0 won']);
    expect(vi_(bare)).toEqual(['Người chơi 0 đấu điểm với Người chơi 1, Người chơi 0 thắng']);
  });
});

describe('Counts as Dodge folds into its judgment line', () => {
  const judged: CardInstance = { instanceId: 'j', definitionId: 'sha', suit: 'heart', rank: 9 };
  const trigramsReader = { kind: 'card' as const, card: usedCardOf({ instanceId: 'et', definitionId: 'eight-trigrams', suit: 'spade', rank: 2 }) };
  const judgment = (seatId: string): EngineEvent => ({ kind: 'JudgmentEvent', seatId, reader: trigramsReader, card: judged });
  const counts = (seatId: string, abilityId: string): EngineEvent => used('counts-as-shan', { seatId, abilityId });

  it('is one line when the judgment is the last line, on the owner’s seat, from the same reader', () => {
    const log = [judgment('seat-1'), counts('seat-1', 'eight-trigrams')];
    expect(en_(log)).toEqual(["Seat 1's Eight Trigrams judgment: 9 ♥, Counts as Dodge"]);
    expect(vi_(log)).toEqual(['Phán xét Eight Trigrams của Người chơi 1: 9 ♥, tính là Dodge']);
  });

  it('keeps the judged card on the folded line', () => {
    const history = actionHistory([judgment('seat-1'), counts('seat-1', 'eight-trigrams')], [], players, [], tr);
    expect(history[0]).toMatchObject({ card: judged });
  });

  it('is a separate line when another line came in between', () => {
    const log = [judgment('seat-1'), { kind: 'HealEvent', target: seat('seat-1'), amount: 1 } as EngineEvent, counts('seat-1', 'eight-trigrams')];
    expect(en_(log)).toEqual(["Seat 1's Eight Trigrams counts as Dodge", 'Seat 1 recovered 1 health', "Seat 1's Eight Trigrams judgment: 9 ♥"]);
    expect(vi_(log)).toEqual(['Eight Trigrams của Người chơi 1 tính là Dodge', 'Người chơi 1 hồi 1 Sinh lực', 'Phán xét Eight Trigrams của Người chơi 1: 9 ♥']);
  });

  it('is a separate line for another seat, or another reader', () => {
    expect(en_([judgment('seat-1'), counts('seat-0', 'eight-trigrams')])).toEqual(["Seat 0's Eight Trigrams counts as Dodge", "Seat 1's Eight Trigrams judgment: 9 ♥"]);
    expect(vi_([judgment('seat-1'), counts('seat-0', 'eight-trigrams')])).toEqual(['Eight Trigrams của Người chơi 0 tính là Dodge', 'Phán xét Eight Trigrams của Người chơi 1: 9 ♥']);
    expect(en_([judgment('seat-1'), counts('seat-1', 'axe')])).toEqual(["Seat 1's Axe counts as Dodge", "Seat 1's Eight Trigrams judgment: 9 ♥"]);
  });

  it('a skill’s judgment folds too', () => {
    const skill: EngineEvent = { kind: 'JudgmentEvent', seatId: 'seat-1', reader: { kind: 'skill', owner: general('seat-1', 'unyielding') }, card: judged };
    const log = [skill, counts('seat-1', 'unyielding')];
    expect(en_(log)).toEqual(["Seat 1's Unyielding judgment: 9 ♥, Counts as Dodge"]);
  });
});
