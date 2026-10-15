# Vietnamese Localization, Phase 2b-2 (Ability Lines in the History) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `AbilityUsedEvent` lines of the Action History through the translator, and replace the one place that reads a finished sentence (the "Counts as Shan" fold) with a structured check on ids, so it keeps working in Vietnamese. English output stays byte-identical.

**Architecture:** The `AbilityUsedEvent` case in `actionHistory` becomes whole-sentence `tr('history.…')` calls. Card names that the sentences mention (Sha, Shan, Duel) are passed as params (`cardName('sha')` and so on) instead of being typed into the templates, so they follow the locale once card names are translated (phase 4). The fold used `last.text.startsWith("{owner}'s {ability} judgment:")` and `last.text += ', Counts as Shan'`. It now remembers the last judgment line as data (`lastJudgment`: the line, the judged seat id, the reader id, and the pieces) and, on `counts-as-shan`, rewrites that line from a whole-sentence template.

**Tech Stack:** Angular 22, Jest (`app` project), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` ("Translator-based builders")

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-2b2` on branch `feat/vietnamese-phase-2b2`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. The existing `action-history.spec.ts` (which already covers nearly every ability outcome, and the Eight Trigrams fold) must pass WITHOUT edits.
- A new catalog key needs an English entry and a Vietnamese entry with the same `{placeholders}` in the same commit (the `Messages` type and `catalogs.spec.ts` enforce it). Vietnamese follows the spec's glossary and is sentence case; Tướng and Sinh lực keep their capitals inside sentences.
- Change only: the `AbilityUsedEvent` case, the `JudgmentEvent` case, and one new `let` in `action-history.ts`. Do NOT touch any other case, `labels.ts` or `display.ts`.
- Control flow of the `AbilityUsedEvent` chain is unchanged: the same branches in the same order (note `'drew'` with a target comes before plain `'drew'`; an outcome that needs `targetSeatId` and has none prints nothing).
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the project: `npx jest --selectProjects app`.

## Review Focus

- The fold must fire only when the judgment line is still the LAST line, the judgment was on the ability owner's seat, and the reader is the same ability. Another line in between, another seat, or another reader gives a separate "counts as Shan" line.
- A compete with no shown cards prints no faces; a lost compete names the other seat as the winner; Heaven's Justice adds its follow-up line for both results.
- `skipped-` with an unknown suffix prints the capitalised raw suffix, as before.
- A swap with no earlier `swap-first` names "A seat".
- An outcome that requires a target but has none prints nothing.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/en.ts`, `vi.ts` | About 50 new `history.*` keys for ability outcomes. |
| `app/src/app/game-board/action-history.ts` | `AbilityUsedEvent` and `JudgmentEvent` cases; one new `lastJudgment` variable. |
| `app/src/app/game-board/action-history.abilities.vi.spec.ts` | New: every outcome in English and Vietnamese, the fold, compete, swap, skipped phases. |

---

### Task 1: Ability lines through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/game-board/action-history.ts`
- Test: `projects/app/src/app/game-board/action-history.abilities.vi.spec.ts` (new); the existing `action-history.spec.ts` must pass unedited

**Interfaces:**
- Consumes: `tr` (the `Translator` parameter of `actionHistory`), `cardName`, `name`, `cardFaceLabel`, `abilityName`, `entries`, `lastShown`, `swapFirst` (all already in `action-history.ts`).
- Produces: unchanged `actionHistory(log, zones, players?, seats?, tr?)`; catalog keys listed in Step 3.

- [ ] **Step 1: Write the failing spec**

`projects/app/src/app/game-board/action-history.abilities.vi.spec.ts`:

```ts
import { CardInstance, EngineEvent, usedCardOf } from 'engine';
import { abilityName } from 'content';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { actionHistory } from './action-history';

const tr = makeTranslator(vi);
const lines = (log: EngineEvent[], translator?: typeof tr) =>
  actionHistory(log, [], [], [], translator).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
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

type Row = [name: string, outcome: string, targeted: boolean, cardId: string | null, english: string, vietnamese: string];
const rows: Row[] = [
  ['used', 'used', false, null, 'Seat 0 used Axe', 'Seat 0 dùng Axe'],
  ['no-effect', 'no-effect', true, null, "Seat 0's Axe: Seat 1's Sha has no effect", 'Axe của Seat 0: Sha của Seat 1 không có hiệu lực'],
  ['counts-as-shan, not folded', 'counts-as-shan', false, null, "Seat 0's Axe counts as Shan", 'Axe của Seat 0 tính là Shan'],
  ['more-damage', 'more-damage', false, null, "Seat 0's Axe: 1 more damage", 'Axe của Seat 0: thêm 1 sát thương'],
  ['unblockable', 'unblockable', true, null, "Seat 0's Axe: Seat 1 can't play a Shan", 'Axe của Seat 0: Seat 1 không thể đánh Shan'],
  ['moved', 'moved', true, null, "Seat 0's Axe moved the Sha to Seat 1", 'Axe của Seat 0 chuyển Sha sang Seat 1'],
  ['stays-alive', 'stays-alive', false, null, "Seat 0's Axe: no match, Seat 0 stays alive", 'Axe của Seat 0: không trùng khớp, Seat 0 vẫn sống'],
  ['matched', 'matched', false, null, "Seat 0's Axe: a rank matched", 'Axe của Seat 0: một điểm trùng khớp'],
  ['claim-true', 'claim-true', false, 'sha', "Seat 0's Sha was true", 'Sha của Seat 0 là thật'],
  ['claim-false', 'claim-false', false, 'sha', "Seat 0's Sha was a bluff", 'Sha của Seat 0 là nói dối'],
  ['took-hand-card', 'took-hand-card', true, null, 'Seat 0 took a hand card from Seat 1 (Axe)', 'Seat 0 lấy một lá bài trên tay của Seat 1 (Axe)'],
  ['reborn', 'reborn', false, null, 'Seat 0 used Axe: discards every card, draws 3, recovers to 3 HP and turns face up', 'Seat 0 dùng Axe: bỏ mọi lá bài, rút 3, hồi Sinh lực lên 3 và lật lại'],
  ['paid-weapon', 'paid-weapon', false, null, 'Seat 0 discarded a Weapon for Axe', 'Seat 0 bỏ một Vũ khí để dùng Axe'],
  ['struck', 'struck', true, null, 'Seat 0 struck Seat 1 with Axe', 'Seat 0 đánh Seat 1 bằng Axe'],
  ['drew-up', 'drew-up', true, null, "Seat 0's Axe: Seat 1 draws up to its max HP", 'Axe của Seat 0: Seat 1 rút bài đến Sinh lực tối đa'],
  ['judged-red', 'judged-red', false, null, "Seat 0's Axe: black hand cards can be used as Duel this turn", 'Axe của Seat 0: các lá bài đen trên tay có thể dùng làm Duel trong lượt này'],
  ['judged-black', 'judged-black', false, null, "Seat 0's Axe: red hand cards can be used as Duel this turn", 'Axe của Seat 0: các lá bài đỏ trên tay có thể dùng làm Duel trong lượt này'],
  ['discarded', 'discarded', true, null, "Seat 0's Axe: discards one of Seat 1's cards", 'Axe của Seat 0: bỏ một lá bài của Seat 1'],
  ['recast', 'recast', false, null, 'Seat 0 recast a club with Axe', 'Seat 0 đổi lại một lá ♣ bằng Axe'],
  ['took-cards', 'took-cards', true, null, "Seat 0 took all of Seat 1's cards (Axe)", 'Seat 0 lấy toàn bộ bài của Seat 1 (Axe)'],
  ['exiled', 'exiled', true, null, "Seat 0's Axe: Seat 1 turns over and draws cards", 'Axe của Seat 0: Seat 1 lật mặt và rút bài'],
  ['revealed', 'revealed', false, null, 'Seat 0 used Axe', 'Seat 0 dùng Axe'],
  ['culprit', 'culprit', true, null, "Seat 0's Axe: the damage to Seat 1 counts as theirs", 'Axe của Seat 0: sát thương lên Seat 1 tính là của họ'],
  ['took-card', 'took-card', false, null, "Seat 0's Axe: took the Tool card", 'Axe của Seat 0: lấy lá Cẩm nang'],
  ['drew, with a target', 'drew', true, null, "Seat 0's Axe: Seat 1 draws and discards", 'Axe của Seat 0: Seat 1 rút bài rồi bỏ bài'],
  ['drew, no target', 'drew', false, null, 'Seat 0 drew a card (Axe)', 'Seat 0 rút một lá bài (Axe)'],
  ['gave', 'gave', true, null, 'Seat 0 gave half of their hand to Seat 1 (Axe)', 'Seat 0 đưa một nửa bài trên tay cho Seat 1 (Axe)'],
  ['collapsed', 'collapsed', false, null, 'Seat 0 lost 1 HP to Axe', 'Seat 0 mất 1 Sinh lực vì Axe'],
  ['collapsed-max', 'collapsed-max', false, null, 'Seat 0 reduced their max HP with Axe', 'Seat 0 giảm Sinh lực tối đa bằng Axe'],
  ['skipped-draw', 'skipped-draw', false, null, 'Seat 0 skipped their Draw Phase with Axe', 'Seat 0 bỏ qua giai đoạn rút bài của mình bằng Axe'],
  ['skipped-judgment', 'skipped-judgment', false, null, 'Seat 0 skipped their Judgment Phase with Axe', 'Seat 0 bỏ qua giai đoạn phán xét của mình bằng Axe'],
  ['skipped-play', 'skipped-play', false, null, 'Seat 0 skipped their Play Phase with Axe', 'Seat 0 bỏ qua giai đoạn ra bài của mình bằng Axe'],
  ['skipped-discard', 'skipped-discard', false, null, 'Seat 0 skipped their Discard Phase with Axe', 'Seat 0 bỏ qua giai đoạn bỏ bài của mình bằng Axe'],
  ['skipped, an unknown phase', 'skipped-start', false, null, 'Seat 0 skipped their Start Phase with Axe', 'Seat 0 bỏ qua giai đoạn Start của mình bằng Axe'],
  ['moved-card', 'moved-card', true, null, 'Seat 0 moved a card to Seat 1 (Axe)', 'Seat 0 chuyển một lá bài cho Seat 1 (Axe)'],
  ['farmed', 'farmed', false, null, "Seat 0's Axe: the judged card becomes a Farm", 'Axe của Seat 0: lá phán xét trở thành Farm'],
  ['awakened', 'awakened', false, null, 'Seat 0 awakened: Axe', 'Seat 0 thức tỉnh: Axe'],
  ['paid', 'paid', true, null, "Seat 1 discarded a Basic card for Seat 0's Axe", 'Seat 1 bỏ một lá bài Cơ bản cho Axe của Seat 0'],
  ['extra-turn', 'extra-turn', true, null, 'Seat 0 gave Seat 1 an extra turn (Axe)', 'Seat 0 cho Seat 1 thêm một lượt (Axe)'],
  ['placed', 'placed', true, null, "Seat 0 placed an Equipment card in Seat 1's equipment (Axe)", 'Seat 0 đặt một lá bài Trang bị vào trang bị của Seat 1 (Axe)'],
  ['gave-back', 'gave-back', true, null, 'Seat 0 gave a discarded card back to Seat 1 and took the rest (Axe)', 'Seat 0 trả lại một lá bài đã bỏ cho Seat 1 và lấy phần còn lại (Axe)'],
  ['lamented', 'lamented', true, null, "Seat 0's Axe: Seat 1 judges", 'Axe của Seat 0: Seat 1 phán xét'],
  ['silenced', 'silenced', true, null, 'Seat 1 loses all skills (Axe)', 'Seat 1 mất mọi kỹ năng (Axe)'],
  ['new-form', 'new-form', false, null, 'Seat 0 gained a Form (Axe)', 'Seat 0 nhận một Hóa thân (Axe)'],
];

describe('ability outcomes in English and Vietnamese', () => {
  it.each(rows)('%s', (_name, outcome, targeted, cardId, english, vietnamese) => {
    const log = [used(outcome, { ...(targeted ? { targetSeatId: 'seat-1' } : {}), ...(cardId ? { cardId } : {}) })];
    expect(en_(log)).toEqual([english]);
    expect(vi_(log)).toEqual([vietnamese]);
  });

  it('an outcome that needs a target prints nothing without one', () => {
    for (const outcome of ['no-effect', 'unblockable', 'moved', 'took-hand-card', 'struck', 'took-cards', 'gave', 'paid', 'silenced']) {
      expect({ outcome, lines: en_([used(outcome)]) }).toEqual({ outcome, lines: [] });
    }
  });

  it('Upheaval says what every other seat must do', () => {
    const upheaval = abilityName('upheaval');
    const log = [used('used', { abilityId: 'upheaval' })];
    expect(en_(log)).toEqual([`Seat 0 used ${upheaval}: every other seat plays a Sha or loses 1 HP`]);
    expect(vi_(log)).toEqual([`Seat 0 dùng ${upheaval}: mỗi người chơi khác phải đánh một Sha hoặc mất 1 Sinh lực`]);
  });
});

describe('swapping hands', () => {
  it('names both seats, or "a seat" when the first was never named', () => {
    const both = [used('swap-first', { targetSeatId: 'seat-2' }), used('swapped', { targetSeatId: 'seat-1' })];
    expect(en_(both)).toEqual(['Seat 2 and Seat 1 swapped hands (Axe)']);
    expect(vi_(both)).toEqual(['Seat 2 và Seat 1 đổi bài trên tay cho nhau (Axe)']);
    const alone = [used('swapped', { targetSeatId: 'seat-1' })];
    expect(en_(alone)).toEqual(['A seat and Seat 1 swapped hands (Axe)']);
    expect(vi_(alone)).toEqual(['Một người chơi và Seat 1 đổi bài trên tay cho nhau (Axe)']);
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
      `Seat 0's ${justice}: one more Sha this turn, at any distance, with one more target`,
      'Seat 0 competed with Seat 1: 7 ♠ against Q ♥, Seat 0 won',
    ]);
    expect(vi_(won)).toEqual([
      `${justice} của Seat 0: thêm một Sha trong lượt này, ở mọi khoảng cách, thêm một mục tiêu`,
      'Seat 0 so tài với Seat 1: 7 ♠ đấu Q ♥, Seat 0 thắng',
    ]);
  });

  it('a lost compete names the other seat as the winner, and bars the Sha', () => {
    const lost = [...shown, used('compete-lost', { targetSeatId: 'seat-1', abilityId: 'heavens-justice' })];
    expect(en_(lost)).toEqual([`Seat 0's ${justice}: no Sha this turn`, 'Seat 0 competed with Seat 1: 7 ♠ against Q ♥, Seat 1 won']);
    expect(vi_(lost)).toEqual([`${justice} của Seat 0: không có Sha trong lượt này`, 'Seat 0 so tài với Seat 1: 7 ♠ đấu Q ♥, Seat 1 thắng']);
  });

  it('with no shown cards prints no faces, and no follow-up for another skill', () => {
    const bare = [used('compete-won', { targetSeatId: 'seat-1' })];
    expect(en_(bare)).toEqual(['Seat 0 competed with Seat 1, Seat 0 won']);
    expect(vi_(bare)).toEqual(['Seat 0 so tài với Seat 1, Seat 0 thắng']);
  });
});

describe('Counts as Shan folds into its judgment line', () => {
  const judged: CardInstance = { instanceId: 'j', definitionId: 'sha', suit: 'heart', rank: 9 };
  const trigramsReader = { kind: 'card' as const, card: usedCardOf({ instanceId: 'et', definitionId: 'eight-trigrams', suit: 'spade', rank: 2 }) };
  const judgment = (seatId: string): EngineEvent => ({ kind: 'JudgmentEvent', seatId, reader: trigramsReader, card: judged });
  const counts = (seatId: string, abilityId: string): EngineEvent => used('counts-as-shan', { seatId, abilityId });

  it('is one line when the judgment is the last line, on the owner’s seat, from the same reader', () => {
    const log = [judgment('seat-1'), counts('seat-1', 'eight-trigrams')];
    expect(en_(log)).toEqual(["Seat 1's Eight Trigrams judgment: 9 ♥, Counts as Shan"]);
    expect(vi_(log)).toEqual(['Phán xét Eight Trigrams của Seat 1: 9 ♥, tính là Shan']);
  });

  it('keeps the judged card on the folded line', () => {
    const history = actionHistory([judgment('seat-1'), counts('seat-1', 'eight-trigrams')], [], [], [], tr);
    expect(history[0]).toMatchObject({ card: judged });
  });

  it('is a separate line when another line came in between', () => {
    const log = [judgment('seat-1'), { kind: 'HealEvent', target: seat('seat-1'), amount: 1 } as EngineEvent, counts('seat-1', 'eight-trigrams')];
    expect(en_(log)).toEqual(["Seat 1's Eight Trigrams counts as Shan", 'Seat 1 recovered 1 health', "Seat 1's Eight Trigrams judgment: 9 ♥"]);
    expect(vi_(log)).toEqual(['Eight Trigrams của Seat 1 tính là Shan', 'Seat 1 hồi 1 Sinh lực', 'Phán xét Eight Trigrams của Seat 1: 9 ♥']);
  });

  it('is a separate line for another seat, or another reader', () => {
    expect(en_([judgment('seat-1'), counts('seat-0', 'eight-trigrams')])).toEqual(["Seat 0's Eight Trigrams counts as Shan", "Seat 1's Eight Trigrams judgment: 9 ♥"]);
    expect(vi_([judgment('seat-1'), counts('seat-0', 'eight-trigrams')])).toEqual(['Eight Trigrams của Seat 0 tính là Shan', 'Phán xét Eight Trigrams của Seat 1: 9 ♥']);
    expect(en_([judgment('seat-1'), counts('seat-1', 'axe')])).toEqual(["Seat 1's Axe counts as Shan", "Seat 1's Eight Trigrams judgment: 9 ♥"]);
  });

  it('a skill’s judgment folds too', () => {
    const skill: EngineEvent = { kind: 'JudgmentEvent', seatId: 'seat-1', reader: { kind: 'skill', owner: general('seat-1', 'unyielding') }, card: judged };
    const log = [skill, counts('seat-1', 'unyielding')];
    expect(en_(log)).toEqual(["Seat 1's Unyielding judgment: 9 ♥, Counts as Shan"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/action-history.abilities.vi.spec.ts`
Expected: FAIL. Every Vietnamese assertion fails (the ability case ignores `tr`), and the Vietnamese fold test fails. The English-only tests ("prints nothing without a target", the English fold cases) may already pass: they pin existing behaviour. If a test fails for a fixture or type reason, fix the fixture (compare with `action-history.spec.ts`), not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, append inside the object (after the last existing entry, before `} satisfies`):

```ts
  'history.abilityUsed': '{owner} used {ability}',
  'history.upheaval': '{owner} used {ability}: every other seat plays a {sha} or loses 1 HP',
  'history.noEffect': "{owner}'s {ability}: {target}'s {sha} has no effect",
  'history.countsAsShan': "{owner}'s {ability} counts as {shan}",
  'history.judgmentCountsAsShan': "{seat}'s {reader} judgment: {face}, Counts as {shan}",
  'history.moreDamage': "{owner}'s {ability}: 1 more damage",
  'history.unblockable': "{owner}'s {ability}: {target} can't play a {shan}",
  'history.movedSha': "{owner}'s {ability} moved the {sha} to {target}",
  'history.staysAlive': "{owner}'s {ability}: no match, {owner} stays alive",
  'history.rankMatched': "{owner}'s {ability}: a rank matched",
  'history.claimTrue': "{owner}'s {card} was true",
  'history.claimFalse': "{owner}'s {card} was a bluff",
  'history.tookHandCard': '{owner} took a hand card from {target} ({ability})',
  'history.competed': '{owner} competed with {target}, {winner} won',
  'history.competedFaces': '{owner} competed with {target}: {mine} against {theirs}, {winner} won',
  'history.heavensWon': "{owner}'s {ability}: one more {sha} this turn, at any distance, with one more target",
  'history.heavensLost': "{owner}'s {ability}: no {sha} this turn",
  'history.reborn': '{owner} used {ability}: discards every card, draws 3, recovers to 3 HP and turns face up',
  'history.paidWeapon': '{owner} discarded a Weapon for {ability}',
  'history.struck': '{owner} struck {target} with {ability}',
  'history.drewUp': "{owner}'s {ability}: {target} draws up to its max HP",
  'history.blackAsDuel': "{owner}'s {ability}: black hand cards can be used as {duel} this turn",
  'history.redAsDuel': "{owner}'s {ability}: red hand cards can be used as {duel} this turn",
  'history.discardedOne': "{owner}'s {ability}: discards one of {target}'s cards",
  'history.recast': '{owner} recast a club with {ability}',
  'history.tookAllCards': "{owner} took all of {target}'s cards ({ability})",
  'history.exiled': "{owner}'s {ability}: {target} turns over and draws cards",
  'history.culprit': "{owner}'s {ability}: the damage to {target} counts as theirs",
  'history.tookToolCard': "{owner}'s {ability}: took the Tool card",
  'history.drawsAndDiscards': "{owner}'s {ability}: {target} draws and discards",
  'history.gaveHalf': '{owner} gave half of their hand to {target} ({ability})',
  'history.collapsed': '{owner} lost 1 HP to {ability}',
  'history.collapsedMax': '{owner} reduced their max HP with {ability}',
  'history.skippedOwnPhase': '{owner} skipped their {phase} Phase with {ability}',
  'history.movedCard': '{owner} moved a card to {target} ({ability})',
  'history.farmed': "{owner}'s {ability}: the judged card becomes a Farm",
  'history.awakened': '{owner} awakened: {ability}',
  'history.paidBasic': "{target} discarded a Basic card for {owner}'s {ability}",
  'history.extraTurn': '{owner} gave {target} an extra turn ({ability})',
  'history.drewCard': '{owner} drew a card ({ability})',
  'history.placedEquipment': "{owner} placed an Equipment card in {target}'s equipment ({ability})",
  'history.gaveBack': '{owner} gave a discarded card back to {target} and took the rest ({ability})',
  'history.lamented': "{owner}'s {ability}: {target} judges",
  'history.silenced': '{target} loses all skills ({ability})',
  'history.newForm': '{owner} gained a Form ({ability})',
  'history.swapped': '{first} and {second} swapped hands ({ability})',
  'history.aSeat': 'A seat',
```

and in `projects/app/src/app/i18n/vi.ts`, append inside the object (after the last existing entry, before `};`):

```ts
  'history.abilityUsed': '{owner} dùng {ability}',
  'history.upheaval': '{owner} dùng {ability}: mỗi người chơi khác phải đánh một {sha} hoặc mất 1 Sinh lực',
  'history.noEffect': '{ability} của {owner}: {sha} của {target} không có hiệu lực',
  'history.countsAsShan': '{ability} của {owner} tính là {shan}',
  'history.judgmentCountsAsShan': 'Phán xét {reader} của {seat}: {face}, tính là {shan}',
  'history.moreDamage': '{ability} của {owner}: thêm 1 sát thương',
  'history.unblockable': '{ability} của {owner}: {target} không thể đánh {shan}',
  'history.movedSha': '{ability} của {owner} chuyển {sha} sang {target}',
  'history.staysAlive': '{ability} của {owner}: không trùng khớp, {owner} vẫn sống',
  'history.rankMatched': '{ability} của {owner}: một điểm trùng khớp',
  'history.claimTrue': '{card} của {owner} là thật',
  'history.claimFalse': '{card} của {owner} là nói dối',
  'history.tookHandCard': '{owner} lấy một lá bài trên tay của {target} ({ability})',
  'history.competed': '{owner} so tài với {target}, {winner} thắng',
  'history.competedFaces': '{owner} so tài với {target}: {mine} đấu {theirs}, {winner} thắng',
  'history.heavensWon': '{ability} của {owner}: thêm một {sha} trong lượt này, ở mọi khoảng cách, thêm một mục tiêu',
  'history.heavensLost': '{ability} của {owner}: không có {sha} trong lượt này',
  'history.reborn': '{owner} dùng {ability}: bỏ mọi lá bài, rút 3, hồi Sinh lực lên 3 và lật lại',
  'history.paidWeapon': '{owner} bỏ một Vũ khí để dùng {ability}',
  'history.struck': '{owner} đánh {target} bằng {ability}',
  'history.drewUp': '{ability} của {owner}: {target} rút bài đến Sinh lực tối đa',
  'history.blackAsDuel': '{ability} của {owner}: các lá bài đen trên tay có thể dùng làm {duel} trong lượt này',
  'history.redAsDuel': '{ability} của {owner}: các lá bài đỏ trên tay có thể dùng làm {duel} trong lượt này',
  'history.discardedOne': '{ability} của {owner}: bỏ một lá bài của {target}',
  'history.recast': '{owner} đổi lại một lá ♣ bằng {ability}',
  'history.tookAllCards': '{owner} lấy toàn bộ bài của {target} ({ability})',
  'history.exiled': '{ability} của {owner}: {target} lật mặt và rút bài',
  'history.culprit': '{ability} của {owner}: sát thương lên {target} tính là của họ',
  'history.tookToolCard': '{ability} của {owner}: lấy lá Cẩm nang',
  'history.drawsAndDiscards': '{ability} của {owner}: {target} rút bài rồi bỏ bài',
  'history.gaveHalf': '{owner} đưa một nửa bài trên tay cho {target} ({ability})',
  'history.collapsed': '{owner} mất 1 Sinh lực vì {ability}',
  'history.collapsedMax': '{owner} giảm Sinh lực tối đa bằng {ability}',
  'history.skippedOwnPhase': '{owner} bỏ qua giai đoạn {phase} của mình bằng {ability}',
  'history.movedCard': '{owner} chuyển một lá bài cho {target} ({ability})',
  'history.farmed': '{ability} của {owner}: lá phán xét trở thành Farm',
  'history.awakened': '{owner} thức tỉnh: {ability}',
  'history.paidBasic': '{target} bỏ một lá bài Cơ bản cho {ability} của {owner}',
  'history.extraTurn': '{owner} cho {target} thêm một lượt ({ability})',
  'history.drewCard': '{owner} rút một lá bài ({ability})',
  'history.placedEquipment': '{owner} đặt một lá bài Trang bị vào trang bị của {target} ({ability})',
  'history.gaveBack': '{owner} trả lại một lá bài đã bỏ cho {target} và lấy phần còn lại ({ability})',
  'history.lamented': '{ability} của {owner}: {target} phán xét',
  'history.silenced': '{target} mất mọi kỹ năng ({ability})',
  'history.newForm': '{owner} nhận một Hóa thân ({ability})',
  'history.swapped': '{first} và {second} đổi bài trên tay cho nhau ({ability})',
  'history.aSeat': 'Một người chơi',
```

- [ ] **Step 4: Replace the `AbilityUsedEvent` case**

In `projects/app/src/app/game-board/action-history.ts`, replace everything from the line `      case 'AbilityUsedEvent': {` up to, but not including, the line `      case 'SelectionMadeEvent':` with:

```ts
      case 'AbilityUsedEvent': {
        const owner = name(event.owner.seatId);
        const ability = abilityName(event.abilityId);
        // The card names the sentences mention, looked up so they follow the locale.
        const sha = cardName('sha');
        const shan = cardName('shan');
        const duel = cardName('duel');
        if (event.outcome === 'used') {
          action(event.abilityId === 'upheaval' ? tr('history.upheaval', { owner, ability, sha }) : tr('history.abilityUsed', { owner, ability }));
        } else if (event.outcome === 'no-effect' && event.targetSeatId) {
          action(tr('history.noEffect', { owner, ability, target: name(event.targetSeatId), sha }));
        } else if (event.outcome === 'counts-as-shan') {
          // Said on its judgment's line when that is still the last line: the
          // same judged seat and reader, matched on ids, never on the text.
          const last = entries[entries.length - 1];
          if (lastJudgment && last === lastJudgment.line && lastJudgment.seatId === event.owner.seatId && lastJudgment.readerId === event.abilityId) {
            lastJudgment.line.text = tr('history.judgmentCountsAsShan', { seat: owner, reader: lastJudgment.reader, face: lastJudgment.face, shan });
          } else {
            action(tr('history.countsAsShan', { owner, ability, shan }));
          }
        } else if (event.outcome === 'more-damage') {
          action(tr('history.moreDamage', { owner, ability }));
        } else if (event.outcome === 'unblockable' && event.targetSeatId) {
          action(tr('history.unblockable', { owner, ability, target: name(event.targetSeatId), shan }));
        } else if (event.outcome === 'moved' && event.targetSeatId) {
          action(tr('history.movedSha', { owner, ability, target: name(event.targetSeatId), sha }));
        } else if (event.outcome === 'stays-alive') {
          action(tr('history.staysAlive', { owner, ability }));
        } else if (event.outcome === 'matched') {
          action(tr('history.rankMatched', { owner, ability }));
        } else if ((event.outcome === 'claim-true' || event.outcome === 'claim-false') && event.cardId) {
          action(tr(event.outcome === 'claim-true' ? 'history.claimTrue' : 'history.claimFalse', { owner, card: cardName(event.cardId) }));
        } else if (event.outcome === 'took-hand-card' && event.targetSeatId) {
          action(tr('history.tookHandCard', { owner, target: name(event.targetSeatId), ability }));
        } else if ((event.outcome === 'compete-won' || event.outcome === 'compete-lost') && event.targetSeatId) {
          // "Seat 1 competed with Seat 2: 9 ♠ against 7 ♥, Seat 1 won", in place of the two "showed" lines.
          const rival = name(event.targetSeatId);
          const mine = lastShown.get(event.owner.seatId);
          const theirs = lastShown.get(event.targetSeatId);
          for (const shown of [mine, theirs]) {
            const at = shown ? entries.lastIndexOf(shown.line) : -1;
            if (at >= 0) entries.splice(at, 1);
          }
          const winner = event.outcome === 'compete-won' ? owner : rival;
          action(
            mine && theirs
              ? tr('history.competedFaces', { owner, target: rival, mine: cardFaceLabel(mine.card), theirs: cardFaceLabel(theirs.card), winner })
              : tr('history.competed', { owner, target: rival, winner })
          );
          if (event.abilityId === 'heavens-justice') {
            action(tr(event.outcome === 'compete-won' ? 'history.heavensWon' : 'history.heavensLost', { owner, ability, sha }));
          }
        } else if (event.outcome === 'reborn') {
          action(tr('history.reborn', { owner, ability }));
        } else if (event.outcome === 'paid-weapon') {
          action(tr('history.paidWeapon', { owner, ability }));
        } else if (event.outcome === 'struck' && event.targetSeatId) {
          action(tr('history.struck', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'drew-up' && event.targetSeatId) {
          action(tr('history.drewUp', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'judged-red' || event.outcome === 'judged-black') {
          action(tr(event.outcome === 'judged-red' ? 'history.blackAsDuel' : 'history.redAsDuel', { owner, ability, duel }));
        } else if (event.outcome === 'discarded' && event.targetSeatId) {
          action(tr('history.discardedOne', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'recast') {
          action(tr('history.recast', { owner, ability }));
        } else if (event.outcome === 'took-cards' && event.targetSeatId) {
          action(tr('history.tookAllCards', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'exiled' && event.targetSeatId) {
          action(tr('history.exiled', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'revealed') {
          action(tr('history.abilityUsed', { owner, ability }));
        } else if (event.outcome === 'culprit' && event.targetSeatId) {
          action(tr('history.culprit', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'took-card') {
          action(tr('history.tookToolCard', { owner, ability }));
        } else if (event.outcome === 'drew' && event.targetSeatId) {
          action(tr('history.drawsAndDiscards', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'gave' && event.targetSeatId) {
          action(tr('history.gaveHalf', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'collapsed') {
          action(tr('history.collapsed', { owner, ability }));
        } else if (event.outcome === 'collapsed-max') {
          action(tr('history.collapsedMax', { owner, ability }));
        } else if (event.outcome.startsWith('skipped-')) {
          const raw = event.outcome.slice('skipped-'.length).replace(/^./, (c) => c.toUpperCase());
          const phase = raw === 'Judgment' || raw === 'Draw' || raw === 'Play' || raw === 'Discard' ? tr(`history.phase.${raw}` as const) : raw;
          action(tr('history.skippedOwnPhase', { owner, phase, ability }));
        } else if (event.outcome === 'moved-card' && event.targetSeatId) {
          action(tr('history.movedCard', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'farmed') {
          action(tr('history.farmed', { owner, ability }));
        } else if (event.outcome === 'awakened') {
          action(tr('history.awakened', { owner, ability }));
        } else if (event.outcome === 'paid' && event.targetSeatId) {
          action(tr('history.paidBasic', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'extra-turn' && event.targetSeatId) {
          action(tr('history.extraTurn', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'drew') {
          action(tr('history.drewCard', { owner, ability }));
        } else if (event.outcome === 'placed' && event.targetSeatId) {
          action(tr('history.placedEquipment', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'gave-back' && event.targetSeatId) {
          action(tr('history.gaveBack', { owner, target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'lamented' && event.targetSeatId) {
          action(tr('history.lamented', { owner, ability, target: name(event.targetSeatId) }));
        } else if (event.outcome === 'silenced' && event.targetSeatId) {
          action(tr('history.silenced', { target: name(event.targetSeatId), ability }));
        } else if (event.outcome === 'new-form') {
          action(tr('history.newForm', { owner, ability }));
        } else if (event.outcome === 'swap-first' && event.targetSeatId) {
          swapFirst = event.targetSeatId;
        } else if (event.outcome === 'swapped' && event.targetSeatId) {
          action(tr('history.swapped', { first: swapFirst ? name(swapFirst) : tr('history.aSeat'), second: name(event.targetSeatId), ability }));
          swapFirst = null;
        }
        break;
      }
```

- [ ] **Step 5: Remember the last judgment, as data**

In the same file, add this line directly after the line `  let swapFirst: string | null = null;`:

```ts
  // The latest judgment line, remembered as data so "Counts as Shan" can fold into it
  // by seat and reader id instead of by reading its text.
  let lastJudgment: { line: ActionLine; seatId: string; readerId: string; reader: string; face: string } | null = null;
```

and replace the whole `case 'JudgmentEvent':` block (the `case` line, its `action(...)` line and its `break;`) with:

```ts
      case 'JudgmentEvent': {
        const reader = judgmentReaderName(event.reader);
        const face = cardFaceLabel(event.card);
        action(tr('history.judgment', { seat: name(event.seatId), reader, face }), event.card);
        lastJudgment = {
          line: entries[entries.length - 1] as ActionLine,
          seatId: event.seatId,
          readerId: event.reader.kind === 'card' ? event.reader.card.as : event.reader.owner.skillId,
          reader,
          face,
        };
        break;
      }
```

- [ ] **Step 6: Run the new spec, the existing history spec and the parity test**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/action-history.abilities.vi.spec.ts projects/app/src/app/game-board/action-history.vi.spec.ts projects/app/src/app/game-board/action-history.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with `action-history.spec.ts` unedited. If an existing English assertion fails, a template differs from the old string by a character: fix `en.ts`, never the existing spec. If a new Vietnamese assertion fails on a typo in the plan's expected string, compare it with `vi.ts` and fix whichever disagrees with the Step 3 templates, and ledger a ruling.

- [ ] **Step 7: Typecheck, then run the whole app project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx jest --selectProjects app`
Expected: no type errors (this proves every key in the ternaries and the `history.phase.${raw}` key exist in the catalog) and every suite passes, with no existing spec edited.

- [ ] **Step 8: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/game-board/action-history.ts projects/app/src/app/game-board/action-history.abilities.vi.spec.ts
git commit -m "feat(app): the history's ability lines build through the translator; Counts as Shan folds on ids

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (step 2b-2 of the spec's "Translator-based builders", plus the spec's rule that logic must not read finished sentences):
- Every `AbilityUsedEvent` line builds through `tr`, with card names passed as params: Task 1 Step 4.
- The `startsWith` and `+= ', Counts as Shan'` pair is replaced by `lastJudgment` and a whole-sentence template: Task 1 Step 5 and Step 4 (`counts-as-shan` branch).
- English byte-identical and the existing spec unedited: Step 6 and Step 7.
- Vietnamese covered for every outcome, the fold, compete and swap: Step 1.
- Not in this plan, by design: seat, card, ability, General and judgment-reader names (later steps); the panel templates (phase 3); `shows.text` engine labels.

**Placeholder scan:** none. Every replaced block, catalog entry and test is shown in full.

**Type consistency:** `lastJudgment` is declared in Step 5 and used in Step 4 by the same names (`line`, `seatId`, `readerId`, `reader`, `face`). Catalog keys used in Step 4 all appear in Step 3 (`abilityUsed`, `upheaval`, `noEffect`, `countsAsShan`, `judgmentCountsAsShan`, `moreDamage`, `unblockable`, `movedSha`, `staysAlive`, `rankMatched`, `claimTrue`, `claimFalse`, `tookHandCard`, `competed`, `competedFaces`, `heavensWon`, `heavensLost`, `reborn`, `paidWeapon`, `struck`, `drewUp`, `blackAsDuel`, `redAsDuel`, `discardedOne`, `recast`, `tookAllCards`, `exiled`, `culprit`, `tookToolCard`, `drawsAndDiscards`, `gaveHalf`, `collapsed`, `collapsedMax`, `skippedOwnPhase`, `movedCard`, `farmed`, `awakened`, `paidBasic`, `extraTurn`, `drewCard`, `placedEquipment`, `gaveBack`, `lamented`, `silenced`, `newForm`, `swapped`, `aSeat`), and each key has the same placeholders in English and Vietnamese. `history.phase.Judgment/Draw/Play/Discard` already exist from step 2b.

**Review Focus:** each line has a test in Step 1: the fold's three negative cases (line in between, other seat, other reader) and the positive and skill-reader cases; compete with no faces, a lost compete and the Heaven's Justice follow-up; the unknown `skipped-start` phase; the swap with no `swap-first`; and the "prints nothing without a target" loop.
