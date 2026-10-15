# Vietnamese Localization, Phase 2b (Action History) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Action History build every line except the ability-outcome lines through a translator, with English output byte-identical and Vietnamese available.

**Architecture:** `actionHistory(log, zones, players, seats, tr = englishTranslator)` gains one optional trailing parameter. Every sentence becomes a whole-sentence template called as `tr('history.…', { … })`. Fragments that English glues together (a used card "as" another, a list "a, b and c", a " with X" suffix) become small templates passed in as params. The `AbilityUsedEvent` branch, with its text comparisons, is deliberately left for step 2b-2: it is about 45 templates and holds the only logic that reads finished prose, so it gets its own plan. Until then ability-outcome lines stay English in a Vietnamese game.

**Tech Stack:** Angular 22, Jest (`app` project), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` ("Translator-based builders")

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-2b` on branch `feat/vietnamese-phase-2b`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. The existing `action-history.spec.ts` must pass WITHOUT edits.
- A new catalog key needs an English entry and a Vietnamese entry in the same commit (the `Messages` type and `catalogs.spec.ts` enforce it). Vietnamese follows the spec's glossary (Tướng, Sinh lực, Cẩm nang, phán xét, Người chơi, giai đoạn, dùng làm, Bỏ bài, Lật tướng) and is sentence case.
- Do NOT touch the `AbilityUsedEvent` case, `labels.ts`, or `display.ts`. Seat names ("Seat 3"), card and ability names, General names and judgment-reader names still come from the existing English lookups until later steps.
- Text that arrives inside an engine event (`shows.text` such as "Done", "Doubt") is passed through, and `shows.text === 'Doubt'` is still matched as today. The damage `nature` word (for example "thunder") is passed through as a param.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the project: `npx jest --selectProjects app`.

## Review Focus

- A skipped phase whose name is the raw phase id, including `GeneralSelection`: English must still print the raw id ("skipped the GeneralSelection Phase").
- A seat selection with one pick, and a list of three: "Seat 1" versus "Seat 1, Seat 2 and Seat 3".
- An arrangement with zero cards on both ends: English must still print "Seat 0 put " (trailing space).
- A discard picked from a hand whose card face is unknown: "a card", with the same wording as before; and a take from a card the chooser owns (no "'s" prefix).
- A cancel whose target tool is unknown: it names "Tool"; a Wuxie that cancels a tool aimed at the player themselves leaves out "on …".

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/en.ts`, `vi.ts` | About 80 new `history.*` keys. |
| `app/src/app/game-board/action-history.ts` | Builds through `tr`; `AbilityUsedEvent` untouched. |
| `app/src/app/game-board/action-history.vi.spec.ts` | New: Vietnamese, plus English assertions for the Review Focus cases. |

---

### Task 1: The history through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/game-board/action-history.ts`
- Test: `projects/app/src/app/game-board/action-history.vi.spec.ts` (new); the existing `action-history.spec.ts` must pass unedited

**Interfaces:**
- Consumes: `Translator`, `englishTranslator`, `makeTranslator` (`../i18n/translator`), `vi`, the existing `card.named` key.
- Produces: `actionHistory(log, zones, players?, seats?, tr?)`; unchanged `ActionHistoryEntry`, `ActionLine`, `latestSequence`. Catalog keys `history.*` (listed in Step 3).

- [ ] **Step 1: Write the failing spec**

`projects/app/src/app/game-board/action-history.vi.spec.ts`:

```ts
import { CardInstance, CardZone, EngineEvent, Seat, usedCardOf } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { actionHistory } from './action-history';

const tr = makeTranslator(vi);
const zones: CardZone[] = [
  { id: 'drawPile', kind: 'drawPile', cards: [] },
  { id: 'discardPile', kind: 'discardPile', cards: [] },
  ...['seat-0', 'seat-1'].flatMap((id) => [
    { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:pile`, kind: 'pile' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
  ]),
];
const seats: Seat[] = [{
  id: 'seat-0', index: 0, kingdom: 'Shu', combinedHp: 3, maxCombinedHp: 4, eliminated: false,
  generals: { main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'liu-bei', revealed: false } },
  hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' },
}];

const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
const shan: CardInstance = { instanceId: 'shan-1', definitionId: 'shan', suit: 'heart', rank: 2 };
const peach: CardInstance = { instanceId: 'peach-1', definitionId: 'peach', suit: 'heart', rank: 12 };
const lion: CardInstance = { instanceId: 'lion-1', definitionId: 'silver-lion', suit: 'club', rank: 1 };
const blade: CardInstance = { instanceId: 'blade-1', definitionId: 'green-dragon-blade', suit: 'spade', rank: 5 };
const barbarians: CardInstance = { instanceId: 'barb-1', definitionId: 'barbarians', suit: 'spade', rank: 7 };
const drawTwo: CardInstance = { instanceId: 'dt-1', definitionId: 'draw-two', suit: 'heart', rank: 7 };
const wuxie: CardInstance = { instanceId: 'wx-1', definitionId: 'wuxie', suit: 'spade', rank: 11 };
const counter: CardInstance = { instanceId: 'wx-2', definitionId: 'wuxie', suit: 'club', rank: 3 };

const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });
const move = (card: CardInstance, fromZoneId: string, toZoneId: string): EngineEvent => ({ kind: 'CardMovedEvent', cardInstanceId: card.instanceId, fromZoneId, toZoneId, card });
const general = (seatId: string, skillId: string) => ({ kind: 'general' as const, seatId, slot: 'main' as const, skillId });
const textsOf = (log: EngineEvent[], translator?: typeof tr) =>
  actionHistory(log, zones, [], seats, translator).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
const vi_ = (log: EngineEvent[]) => textsOf(log, tr);
const en_ = (log: EngineEvent[]) => textsOf(log);

describe('card plays in Vietnamese', () => {
  it('a play, an answer against it, an equip, an untargeted use', () => {
    expect(vi_([
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(shan), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'sha-1' } },
    ])).toEqual(['Seat 1 dùng Shan (2 ♥) chống lại Sha của Seat 0', 'Seat 0 dùng Sha (7 ♠) lên Seat 1']);
    expect(vi_([{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(lion), targets: [] }])).toEqual(['Seat 0 trang bị Silver Lion (A ♣)']);
    expect(vi_([{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(peach), targets: [] }])).toEqual(['Seat 0 dùng Peach (Q ♥)']);
  });

  it('an answer to no named seat, and an answer to a seat but no known card', () => {
    const answer = (inResponseTo: object): EngineEvent => ({ kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(shan), targets: [], inResponseTo });
    expect(vi_([answer({ cardInstanceId: 'sha-1' })])).toEqual(['Seat 1 dùng Shan (2 ♥) để đáp lại']);
    expect(en_([answer({ cardInstanceId: 'sha-1' })])).toEqual(['Seat 1 used Shan (2 ♥) in response']);
    expect(vi_([answer({ seatId: 'seat-0' })])).toEqual(['Seat 1 dùng Shan (2 ♥) chống lại Seat 0']);
    expect(en_([answer({ seatId: 'seat-0' })])).toEqual(['Seat 1 used Shan (2 ♥) against Seat 0']);
  });

  it('saving a dying seat, another or oneself', () => {
    const save = (dyingSeatId: string): EngineEvent => ({ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(peach), targets: [], inResponseTo: { dyingSeatId } });
    expect(vi_([save('seat-1')])).toEqual(['Seat 0 dùng Peach (Q ♥) để cứu Seat 1']);
    expect(vi_([save('seat-0')])).toEqual(['Seat 0 dùng Peach (Q ♥) để cứu chính mình']);
    expect(en_([save('seat-0')])).toEqual(['Seat 0 used Peach (Q ♥) to save themselves']);
  });

  it('cancelling a Tool, a counter Wuxie, and a Tool aimed at the player themselves', () => {
    expect(vi_([
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(barbarians), targets: [] },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(wuxie), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'barb-1', targetSeatId: 'seat-2' } },
      { kind: 'CardPlayedEvent', seatId: 'seat-2', card: usedCardOf(counter), targets: [], inResponseTo: { seatId: 'seat-0', counters: true } },
    ])).toEqual([
      'Seat 2 hủy Wuxie của Seat 0 bằng Wuxie (3 ♣)',
      'Seat 0 hủy Barbarians của Seat 1 lên Seat 2 bằng Wuxie (J ♠)',
      'Seat 1 dùng Barbarians (7 ♠)',
    ]);
    const self: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(drawTwo), targets: [] },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(wuxie), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'dt-1', targetSeatId: 'seat-1' } },
    ];
    expect(vi_(self)[0]).toBe('Seat 0 hủy Draw Two của Seat 1 bằng Wuxie (J ♠)');
    expect(en_(self)[0]).toBe("Seat 0 cancelled Seat 1's Draw Two with Wuxie (J ♠)");
  });

  it('cancelling a Tool that is not known names a Tool', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(wuxie), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'never-played', targetSeatId: 'seat-2' } },
    ];
    expect(vi_(log)).toEqual(['Seat 0 hủy Cẩm nang của Seat 1 lên Seat 2 bằng Wuxie (J ♠)']);
    expect(en_(log)).toEqual(["Seat 0 cancelled Seat 1's Tool on Seat 2 with Wuxie (J ♠)"]);
  });
});

describe('moves and picks in Vietnamese', () => {
  it('a discard from hand, and a worn card discarded', () => {
    expect(vi_([move(sha, 'seat-0:hand', 'discardPile')])).toEqual(['Seat 0 bỏ Sha (7 ♠)']);
    expect(vi_([move(lion, 'seat-0:equip', 'discardPile')])).toEqual(['Silver Lion của Seat 0 bị bỏ']);
    expect(en_([move(lion, 'seat-0:equip', 'discardPile')])).toEqual(["Seat 0's Silver Lion was discarded"]);
  });

  it('a worn card handed over, one put under a General, Lightning moving on', () => {
    expect(vi_([move(blade, 'seat-0:equip', 'seat-1:hand')])).toEqual(['Seat 1 lấy Green Dragon Blade (5 ♠) của Seat 0']);
    expect(vi_([move(sha, 'drawPile', 'seat-0:pile')])).toEqual(['Seat 0 đặt Sha (7 ♠) dưới tướng của mình']);
    expect(vi_([move(sha, 'seat-0:judgment', 'seat-1:judgment')])).toEqual(['Sha (7 ♠) chuyển từ Seat 0 sang Seat 1']);
    expect(en_([move(sha, 'seat-0:judgment', 'seat-1:judgment')])).toEqual(['Sha (7 ♠) moved on from Seat 0 to Seat 1']);
  });

  it('a Tool taking a worn card, and a skill taking a hand card', () => {
    const steal = { kind: 'choice' as const, card: { as: 'steal', colour: 'black' as const, physical: [] }, userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    const take: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'take', reason: steal, shows: { kind: 'card', card: lion } },
      move(lion, 'seat-0:equip', 'seat-1:hand'),
    ];
    expect(vi_(take)).toEqual(['Seat 1 lấy Silver Lion (A ♣) của Seat 0 bằng Steal']);
    expect(en_(take)).toEqual(["Seat 1 took Seat 0's Silver Lion (A ♣) with Steal"]);
    const feedback = { kind: 'ability' as const, owner: general('seat-0', 'feedback'), abilityId: 'feedback', targetSeatId: 'seat-1' };
    const hand: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', reason: feedback, shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 2 } },
      { kind: 'CardMovedEvent', cardInstanceId: 'x', fromZoneId: 'seat-1:hand', toZoneId: 'seat-0:hand' },
    ];
    expect(vi_(hand)).toEqual(['Seat 0 lấy một lá bài trên tay của Seat 1 bằng Feedback']);
  });

  it('a discard from a hand, with and without a known face', () => {
    const reason = { kind: 'ability' as const, owner: general('seat-1', 'sudden-attack'), abilityId: 'sudden-attack', targetSeatId: 'seat-0' };
    const pick: EngineEvent = { kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'discard', reason, shows: { kind: 'hidden-hand', seatId: 'seat-0', count: 1 } };
    const known = [pick, move(sha, 'seat-0:hand', 'discardPile')];
    expect(vi_(known)).toEqual(['Seat 1 bỏ Sha (7 ♠) trên tay của Seat 0 bằng Sudden Attack']);
    expect(en_(known)).toEqual(["Seat 1 discarded Sha (7 ♠) from Seat 0's hand with Sudden Attack"]);
    const unknown = [pick, { kind: 'CardMovedEvent' as const, cardInstanceId: 'x', fromZoneId: 'seat-0:hand', toZoneId: 'discardPile' }];
    expect(vi_(unknown)).toEqual(['Seat 1 bỏ một lá bài trên tay của Seat 0 bằng Sudden Attack']);
    expect(en_(unknown)).toEqual(["Seat 1 discarded a card from Seat 0's hand with Sudden Attack"]);
  });

  it('a card taken from the chooser’s own zone has no possessive', () => {
    const reason = { kind: 'ability' as const, owner: general('seat-0', 'x-skill'), abilityId: 'x-skill' };
    const log: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', reason, shows: { kind: 'card', card: peach } },
      move(peach, 'seat-0:pile', 'seat-0:hand'),
    ];
    expect(en_(log)).toEqual(['Seat 0 took Peach (Q ♥) with X Skill']);
    expect(vi_(log)).toEqual(['Seat 0 lấy Peach (Q ♥) bằng X Skill']);
  });
});

describe('status and table lines in Vietnamese', () => {
  it('damage, with and without a source or a nature', () => {
    const hit = (source: ReturnType<typeof seat> | null, amount: number, nature: string): EngineEvent => ({ kind: 'DamageDealtEvent', damage: { source, target: seat('seat-0'), amount, nature } as never });
    expect(vi_([hit(seat('seat-1'), 2, 'normal')])).toEqual(['Seat 0 chịu 2 sát thương từ Seat 1']);
    expect(vi_([hit(null, 1, 'normal')])).toEqual(['Seat 0 chịu 1 sát thương']);
    expect(vi_([hit(null, 3, 'thunder')])).toEqual(['Seat 0 chịu 3 sát thương thunder']);
    expect(vi_([hit(seat('seat-1'), 1, 'thunder')])).toEqual(['Seat 0 chịu 1 sát thương thunder từ Seat 1']);
    expect(en_([hit(seat('seat-1'), 1, 'thunder')])).toEqual(['Seat 0 took 1 thunder damage from Seat 1']);
  });

  it('healing, drawing, dying, saved, eliminated, generals chosen, reshuffle', () => {
    expect(vi_([{ kind: 'HealEvent', target: seat('seat-0'), amount: 1 }])).toEqual(['Seat 0 hồi 1 sinh lực']);
    expect(vi_([{ kind: 'CardsDrawnEvent', seatId: 'seat-0', cardInstanceIds: ['a'] }])).toEqual(['Seat 0 rút 1 lá bài']);
    expect(vi_([{ kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['a', 'b'] }])).toEqual(['Seat 1 rút 2 lá bài']);
    expect(vi_([{ kind: 'SeatDyingEvent', seatId: 'seat-1' }])).toEqual(['Seat 1 cận kề cái chết']);
    expect(vi_([{ kind: 'SeatSavedEvent', seatId: 'seat-1' }])).toEqual(['Seat 1 đã được cứu']);
    expect(vi_([{ kind: 'SeatEliminatedEvent', seatId: 'seat-1' }])).toEqual(['Seat 1 bị loại']);
    expect(vi_([{ kind: 'GeneralsChosenEvent', seatId: 'seat-0' }])).toEqual(['Seat 0 đã chọn tướng của mình']);
    expect(vi_([{ kind: 'DiscardPileReshuffledEvent', cardCount: 9 }])).toEqual(['Chồng bài bỏ (9) đã được xáo vào chồng bài rút']);
  });

  it('keeps the force colour of a status line', () => {
    const history = actionHistory([{ kind: 'HealEvent', target: seat('seat-0'), amount: 1 }], zones, [], seats, tr);
    expect(history[0]).toMatchObject({ text: 'Seat 0 hồi 1 sinh lực', force: 'Shu' });
  });

  it('revealing a General, with and without a skill and a known name', () => {
    expect(vi_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'main' }])).toEqual(['Seat 0 lật Tướng chính của mình']);
    expect(vi_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'deputy' }])).toEqual(['Seat 0 lật Tướng phụ của mình']);
    expect(vi_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'main', forAbilityId: 'fighting-saint' }])).toEqual(['Seat 0 lật Guan Yu để dùng Fighting Saint']);
    expect(vi_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-1', slot: 'main', forAbilityId: 'fighting-saint' }])).toEqual(['Seat 1 lật Tướng chính của mình để dùng Fighting Saint']);
    expect(en_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-1', slot: 'deputy', forAbilityId: 'fighting-saint' }])).toEqual(['Seat 1 revealed their Deputy General to use Fighting Saint']);
  });

  it('skipped phases, including the raw GeneralSelection id', () => {
    expect(vi_([{ kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'Play' }])).toEqual(['Seat 0 bỏ qua giai đoạn ra bài']);
    expect(vi_([{ kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'Judgment' }])).toEqual(['Seat 0 bỏ qua giai đoạn phán xét']);
    expect(en_([{ kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'Judgment' }])).toEqual(['Seat 0 skipped the Judgment Phase']);
    expect(en_([{ kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'GeneralSelection' }])).toEqual(['Seat 0 skipped the GeneralSelection Phase']);
  });
});

describe('choices and skills in Vietnamese', () => {
  const reason = { kind: 'ability' as const, owner: general('seat-0', 'kindness'), abilityId: 'kindness' };

  it('using an ability, with and without a target other than oneself', () => {
    const use = (targetSeatId?: string): EngineEvent => ({ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'use', shows: { kind: 'use' }, reason: { kind: 'ability', owner: general('seat-0', 'ax'), abilityId: 'axe', ...(targetSeatId ? { targetSeatId } : {}) } });
    expect(vi_([use('seat-1')])).toEqual(['Seat 0 dùng Axe lên Seat 1']);
    expect(vi_([use()])).toEqual(['Seat 0 dùng Axe']);
    expect(vi_([use('seat-0')])).toEqual(['Seat 0 dùng Axe']);
  });

  it('letting the user draw, giving cards, choosing a seat, a suit, a label', () => {
    const gs = { kind: 'choice' as const, card: usedCardOf({ instanceId: 'gs', definitionId: 'gender-swords', suit: 'spade', rank: 2 }), userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    expect(vi_([{ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'discard', reason: gs, shows: { kind: 'decline' } }])).toEqual(['Seat 0 để Seat 1 rút một lá bài (Gender Swords)']);
    expect(vi_([
      { kind: 'SelectionMadeEvent', seatId: 'seat-0', reason, of: 'cards', ids: ['a', 'b'] },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'give', shows: { kind: 'seat', seatId: 'seat-1' }, reason },
    ])).toEqual(['Seat 0 đưa 2 lá bài cho Seat 1']);
    expect(vi_([{ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'seat', seatId: 'seat-1' }, reason }])).toEqual(['Seat 0 đã chọn Seat 1']);
    expect(vi_([{ kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'pick', shows: { kind: 'suit', suit: 'heart' }, reason }])).toEqual(['Seat 1 gọi tên ♥']);
    expect(vi_([{ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'label', text: 'Done' }, reason }])).toEqual(['Seat 0 đã chọn Done']);
  });

  it('believing or doubting a claim', () => {
    const answer = (text: string): EngineEvent => ({
      kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'label', text },
      reason: { kind: 'ability', owner: general('seat-1', 'bewilder'), abilityId: 'bewilder', cardId: 'sha' },
    });
    expect(vi_([answer('Doubt')])).toEqual(['Seat 0 nghi ngờ Sha của Seat 1']);
    expect(vi_([answer('Believe')])).toEqual(['Seat 0 tin Sha của Seat 1']);
    expect(en_([answer('Doubt')])).toEqual(["Seat 0 doubted Seat 1's Sha"]);
  });

  it('a list of picked seats: one, two and three', () => {
    const picked = (ids: string[]): EngineEvent => ({ kind: 'SelectionMadeEvent', seatId: 'seat-0', of: 'seats', ids, reason: { kind: 'ability', owner: general('seat-0', 'sk'), abilityId: 'sky-scorcher' } });
    expect(vi_([picked(['seat-1'])])).toEqual(['Seat 0 đã chọn Seat 1 bằng Sky Scorcher']);
    expect(vi_([picked(['seat-1', 'seat-2'])])).toEqual(['Seat 0 đã chọn Seat 1 và Seat 2 bằng Sky Scorcher']);
    expect(vi_([picked(['seat-1', 'seat-2', 'seat-3'])])).toEqual(['Seat 0 đã chọn Seat 1, Seat 2 và Seat 3 bằng Sky Scorcher']);
    expect(en_([picked(['seat-1'])])).toEqual(['Seat 0 picked Seat 1 with Sky Scorcher']);
    expect(en_([picked(['seat-1', 'seat-2', 'seat-3'])])).toEqual(['Seat 0 picked Seat 1, Seat 2 and Seat 3 with Sky Scorcher']);
  });

  it('gaining a skill, choosing a Form, a lower max HP, HP lost', () => {
    expect(vi_([{ kind: 'SkillGainedEvent', seatId: 'seat-0', skillId: 'fighting-saint' }])).toEqual(['Seat 0 nhận được Fighting Saint']);
    expect(vi_([{ kind: 'FormChosenEvent', seatId: 'seat-0', skillId: 'fighting-saint', generalId: 'guan-yu' }])).toEqual(['Seat 0 chọn Fighting Saint từ Guan Yu']);
    expect(vi_([{ kind: 'FormChosenEvent', seatId: 'seat-0', skillId: 'fighting-saint', generalId: 'no-such-general' }])).toEqual(['Seat 0 chọn Fighting Saint từ một Hóa thân']);
    expect(en_([{ kind: 'FormChosenEvent', seatId: 'seat-0', skillId: 'fighting-saint', generalId: 'no-such-general' }])).toEqual(['Seat 0 chose Fighting Saint from a Form']);
    expect(vi_([{ kind: 'MaxHpReducedEvent', seatId: 'seat-0', maxHp: 3 }])).toEqual(['Seat 0 giờ có sinh lực tối đa là 3']);
    expect(vi_([{ kind: 'HpLostEvent', seatId: 'seat-0', amount: 2 }])).toEqual(['Seat 0 mất 2 sinh lực']);
    expect(vi_([{ kind: 'HpLostEvent', seatId: 'seat-0', amount: 1, abilityId: 'battered-body' }])).toEqual(['Seat 0 mất 1 sinh lực (Battered Body)']);
  });

  it('a skill’s judgment, and a changed judgment', () => {
    const five: CardInstance = { instanceId: 'j1', definitionId: 'shan', suit: 'heart', rank: 5 };
    const three: CardInstance = { instanceId: 'r1', definitionId: 'sha', suit: 'spade', rank: 3 };
    expect(vi_([{ kind: 'JudgmentEvent', seatId: 'seat-1', reader: { kind: 'skill', owner: general('seat-1', 'unyielding') }, card: five }])).toEqual(['Phán xét Unyielding của Seat 1: 5 ♥']);
    expect(vi_([{ kind: 'JudgmentChangedEvent', owner: general('seat-0', 'devil'), abilityId: 'devil', judgedSeatId: 'seat-1', card: three, replaced: five }])).toEqual(['Devil của Seat 0 đổi lá phán xét thành 3 ♠']);
  });

  it('arranging the draw pile, including zero on both ends', () => {
    const arranged = (top: number, bottom: number): EngineEvent => ({ kind: 'ArrangementMadeEvent', seatId: 'seat-0', reason: { kind: 'ability', owner: general('seat-0', 'astrology'), abilityId: 'astrology' }, top, bottom });
    expect(vi_([arranged(2, 1)])).toEqual(['Seat 0 đặt 2 lá bài lên trên chồng bài rút và 1 xuống dưới cùng']);
    expect(vi_([arranged(3, 0)])).toEqual(['Seat 0 đặt 3 lá bài lên trên chồng bài rút']);
    expect(vi_([arranged(0, 1)])).toEqual(['Seat 0 đặt 1 lá bài xuống dưới cùng chồng bài rút']);
    expect(en_([arranged(0, 0)])).toEqual(['Seat 0 put ']);
  });

  it('turning over, showing a card and turning cards up', () => {
    expect(vi_([{ kind: 'SeatTurnedEvent', seatId: 'seat-0', faceDown: true }])).toEqual(['Seat 0 úp tướng']);
    expect(vi_([{ kind: 'SeatTurnedEvent', seatId: 'seat-0', faceDown: false }])).toEqual(['Seat 0 lật lại']);
    expect(vi_([{ kind: 'SeatTurnedEvent', seatId: 'seat-0', faceDown: false, passedTurn: true }])).toEqual(['Seat 0 lật lại và bỏ lượt']);
    expect(vi_([{ kind: 'CardShownEvent', seatId: 'seat-1', card: sha, abilityId: 'sow-revolt' }])).toEqual(['Seat 1 cho xem Sha (7 ♠)']);
    expect(vi_([{ kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [peach, sha] }])).toEqual(['Đã lật 2 lá bài: Peach (Q ♥), Sha (7 ♠)']);
    expect(en_([{ kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [peach] }])).toEqual(['Turned up 1 card: Peach (Q ♥)']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/action-history.vi.spec.ts`
Expected: FAIL. The Vietnamese assertions fail (`actionHistory` ignores a fifth argument and returns English). A few English-only assertions may already pass: they pin behaviour that exists. If a test fails on a fixture or type error instead, fix the fixture (compare with `action-history.spec.ts`), not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, append these entries inside the object (after the last existing entry, before `} satisfies`):

```ts
  'history.aCard': 'a card',
  'history.card': 'card',
  'history.aTool': 'Tool',
  'history.aForm': 'a Form',
  'history.themselves': 'themselves',
  'history.theirMain': 'their Main General',
  'history.theirDeputy': 'their Deputy General',
  'history.withSuffix': ' with {tool}',
  'history.possessive': "{owner}'s {thing}",
  'history.and': '{head} and {last}',
  'history.via': '{card} ({ability})',
  'history.usedAs.card': '{card} as {as}',
  'history.usedAs.cards': '{count} cards as {as}',
  'history.cards.one': '{n} card',
  'history.cards.other': '{n} cards',
  'history.useToSave': '{seat} used {used} to save {saved}',
  'history.cancelCounter': "{seat} cancelled {owner}'s {card} with {used}",
  'history.cancelTool': "{seat} cancelled {owner}'s {tool} with {used}",
  'history.cancelToolOn': "{seat} cancelled {owner}'s {tool} on {target} with {used}",
  'history.usedAgainstCard': "{seat} used {used} against {owner}'s {card}",
  'history.usedAgainst': '{seat} used {used} against {owner}',
  'history.usedInResponse': '{seat} used {used} in response',
  'history.equipped': '{seat} equipped {used}',
  'history.usedOn': '{seat} used {used} on {targets}',
  'history.used': '{seat} used {used}',
  'history.pickHandTook': '{chooser} took a hand card from {owner}{tool}',
  'history.pickHandDiscarded': "{chooser} discarded {card} from {owner}'s hand{tool}",
  'history.pickTook': '{chooser} took {what}{tool}',
  'history.pickDiscarded': '{chooser} discarded {what}{tool}',
  'history.tookFrom': "{taker} took {owner}'s {card}",
  'history.putUnder': '{seat} put {card} under their General',
  'history.movedOn': '{card} moved on from {from} to {to}',
  'history.discardedCard': '{seat} discarded {card}',
  'history.wasDiscarded': "{seat}'s {card} was discarded",
  'history.tookDamage': '{target} took {amount} damage',
  'history.tookDamageFrom': '{target} took {amount} damage from {source}',
  'history.tookNatureDamage': '{target} took {amount} {nature} damage',
  'history.tookNatureDamageFrom': '{target} took {amount} {nature} damage from {source}',
  'history.recovered': '{target} recovered {amount} health',
  'history.drew.one': '{seat} drew {n} card',
  'history.drew.other': '{seat} drew {n} cards',
  'history.revealedMain': '{seat} revealed their Main General',
  'history.revealedDeputy': '{seat} revealed their Deputy General',
  'history.revealedToUse': '{seat} revealed {which} to use {ability}',
  'history.dying': '{seat} is dying',
  'history.saved': '{seat} was saved',
  'history.eliminated': '{seat} was eliminated',
  'history.generalsChosen': '{seat} chose their generals',
  'history.usedAbility': '{chooser} used {ability}',
  'history.usedAbilityOn': '{chooser} used {ability} on {target}',
  'history.letDraw': '{chooser} let {user} draw a card ({card})',
  'history.gaveCards': '{chooser} gave {cards} to {target}',
  'history.chose': '{chooser} chose {what}',
  'history.namedSuit': '{chooser} named {suit}',
  'history.doubted': "{chooser} doubted {owner}'s {card}",
  'history.believed': "{chooser} believed {owner}'s {card}",
  'history.pickedWith': '{seat} picked {list} with {ability}',
  'history.gained': '{seat} gained {skill}',
  'history.chosenForm': '{seat} chose {skill} from {general}',
  'history.maxHp': '{seat} now has a max HP of {maxHp}',
  'history.lostHp': '{seat} lost {amount} HP',
  'history.lostHpTo': '{seat} lost {amount} HP ({ability})',
  'history.judgmentChanged': "{owner}'s {ability} changed the judgment to {face}",
  'history.arrangeTop': '{cards} on top of the draw pile',
  'history.arrangeBottom': '{n} at the bottom',
  'history.arrangeBottomOnly': '{cards} at the bottom of the draw pile',
  'history.arranged': '{seat} put {parts}',
  'history.seatDown': '{seat} turned face down',
  'history.seatUp': '{seat} turned face up',
  'history.seatUpPassed': '{seat} turned face up and passed the turn',
  'history.showed': '{seat} showed {card}',
  'history.turnedUp': 'Turned up {cards}: {list}',
  'history.judgment': "{seat}'s {reader} judgment: {face}",
  'history.phaseSkipped': '{seat} skipped the {phase} Phase',
  'history.phase.GeneralSelection': 'GeneralSelection',
  'history.phase.Start': 'Start',
  'history.phase.Judgment': 'Judgment',
  'history.phase.Draw': 'Draw',
  'history.phase.Play': 'Play',
  'history.phase.Discard': 'Discard',
  'history.phase.End': 'End',
  'history.reshuffled': 'The discard pile ({count}) was shuffled into the draw pile',
```

and in `projects/app/src/app/i18n/vi.ts`, append inside the object (after the last existing entry, before `};`):

```ts
  'history.aCard': 'một lá bài',
  'history.card': 'lá bài',
  'history.aTool': 'Cẩm nang',
  'history.aForm': 'một Hóa thân',
  'history.themselves': 'chính mình',
  'history.theirMain': 'Tướng chính của mình',
  'history.theirDeputy': 'Tướng phụ của mình',
  'history.withSuffix': ' bằng {tool}',
  'history.possessive': '{thing} của {owner}',
  'history.and': '{head} và {last}',
  'history.via': '{card} ({ability})',
  'history.usedAs.card': '{card} làm {as}',
  'history.usedAs.cards': '{count} lá bài làm {as}',
  'history.cards.one': '{n} lá bài',
  'history.cards.other': '{n} lá bài',
  'history.useToSave': '{seat} dùng {used} để cứu {saved}',
  'history.cancelCounter': '{seat} hủy {card} của {owner} bằng {used}',
  'history.cancelTool': '{seat} hủy {tool} của {owner} bằng {used}',
  'history.cancelToolOn': '{seat} hủy {tool} của {owner} lên {target} bằng {used}',
  'history.usedAgainstCard': '{seat} dùng {used} chống lại {card} của {owner}',
  'history.usedAgainst': '{seat} dùng {used} chống lại {owner}',
  'history.usedInResponse': '{seat} dùng {used} để đáp lại',
  'history.equipped': '{seat} trang bị {used}',
  'history.usedOn': '{seat} dùng {used} lên {targets}',
  'history.used': '{seat} dùng {used}',
  'history.pickHandTook': '{chooser} lấy một lá bài trên tay của {owner}{tool}',
  'history.pickHandDiscarded': '{chooser} bỏ {card} trên tay của {owner}{tool}',
  'history.pickTook': '{chooser} lấy {what}{tool}',
  'history.pickDiscarded': '{chooser} bỏ {what}{tool}',
  'history.tookFrom': '{taker} lấy {card} của {owner}',
  'history.putUnder': '{seat} đặt {card} dưới tướng của mình',
  'history.movedOn': '{card} chuyển từ {from} sang {to}',
  'history.discardedCard': '{seat} bỏ {card}',
  'history.wasDiscarded': '{card} của {seat} bị bỏ',
  'history.tookDamage': '{target} chịu {amount} sát thương',
  'history.tookDamageFrom': '{target} chịu {amount} sát thương từ {source}',
  'history.tookNatureDamage': '{target} chịu {amount} sát thương {nature}',
  'history.tookNatureDamageFrom': '{target} chịu {amount} sát thương {nature} từ {source}',
  'history.recovered': '{target} hồi {amount} sinh lực',
  'history.drew.one': '{seat} rút {n} lá bài',
  'history.drew.other': '{seat} rút {n} lá bài',
  'history.revealedMain': '{seat} lật Tướng chính của mình',
  'history.revealedDeputy': '{seat} lật Tướng phụ của mình',
  'history.revealedToUse': '{seat} lật {which} để dùng {ability}',
  'history.dying': '{seat} cận kề cái chết',
  'history.saved': '{seat} đã được cứu',
  'history.eliminated': '{seat} bị loại',
  'history.generalsChosen': '{seat} đã chọn tướng của mình',
  'history.usedAbility': '{chooser} dùng {ability}',
  'history.usedAbilityOn': '{chooser} dùng {ability} lên {target}',
  'history.letDraw': '{chooser} để {user} rút một lá bài ({card})',
  'history.gaveCards': '{chooser} đưa {cards} cho {target}',
  'history.chose': '{chooser} đã chọn {what}',
  'history.namedSuit': '{chooser} gọi tên {suit}',
  'history.doubted': '{chooser} nghi ngờ {card} của {owner}',
  'history.believed': '{chooser} tin {card} của {owner}',
  'history.pickedWith': '{seat} đã chọn {list} bằng {ability}',
  'history.gained': '{seat} nhận được {skill}',
  'history.chosenForm': '{seat} chọn {skill} từ {general}',
  'history.maxHp': '{seat} giờ có sinh lực tối đa là {maxHp}',
  'history.lostHp': '{seat} mất {amount} sinh lực',
  'history.lostHpTo': '{seat} mất {amount} sinh lực ({ability})',
  'history.judgmentChanged': '{ability} của {owner} đổi lá phán xét thành {face}',
  'history.arrangeTop': '{cards} lên trên chồng bài rút',
  'history.arrangeBottom': '{n} xuống dưới cùng',
  'history.arrangeBottomOnly': '{cards} xuống dưới cùng chồng bài rút',
  'history.arranged': '{seat} đặt {parts}',
  'history.seatDown': '{seat} úp tướng',
  'history.seatUp': '{seat} lật lại',
  'history.seatUpPassed': '{seat} lật lại và bỏ lượt',
  'history.showed': '{seat} cho xem {card}',
  'history.turnedUp': 'Đã lật {cards}: {list}',
  'history.judgment': 'Phán xét {reader} của {seat}: {face}',
  'history.phaseSkipped': '{seat} bỏ qua giai đoạn {phase}',
  'history.phase.GeneralSelection': 'chọn tướng',
  'history.phase.Start': 'bắt đầu',
  'history.phase.Judgment': 'phán xét',
  'history.phase.Draw': 'rút bài',
  'history.phase.Play': 'ra bài',
  'history.phase.Discard': 'bỏ bài',
  'history.phase.End': 'kết thúc',
  'history.reshuffled': 'Chồng bài bỏ ({count}) đã được xáo vào chồng bài rút',
```

- [ ] **Step 4: Rewrite `action-history.ts`**

Replace the whole of `projects/app/src/app/game-board/action-history.ts` with the file below. It is the current file with every sentence outside the `AbilityUsedEvent` case built through `tr`; the `AbilityUsedEvent` case is copied unchanged.

```ts
import { CardInstance, CardZone, ChoiceMadeEvent, EngineEvent, Player, Seat, UsedCard } from 'engine';
import { abilityName, cardDisplayData, generalDisplayData } from 'content';
import { englishTranslator, Translator } from '../i18n/translator';
import { Force, cardFaceLabel, cardIdDisplayName, forceOf, generalDisplayName, judgmentReaderName, seatName, suitSymbol, targetLabel } from '../labels';

export type ActionHistoryEntry =
  | { kind: 'turn'; turnNumber: number; seatName: string }
  // `force` is set on a line about a player's status (HP lost or recovered,
  // dying, saved, eliminated): that player's force colour. `starts` marks the
  // first line of an action sequence (latestSequence).
  | { kind: 'action'; text: string; card: CardInstance | null; force?: Force; starts?: true };

export type ActionLine = Extract<ActionHistoryEntry, { kind: 'action' }>;

function cardName(definitionId: string): string {
  return cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);
}

// The card shown beside a line: the physical card, when there is exactly one.
const faceOf = (used: UsedCard): CardInstance | null => (used.physical.length === 1 ? used.physical[0] : null);

// What happened at the table, read off the public log, most recent first, with
// a marker at the start of each turn. Phase changes are left out, and so is a
// used card's own trip to the discard pile: the "used" line already says it.
// Sentences are built through `tr`, English unless a translator is passed.
export function actionHistory(
  log: EngineEvent[],
  zones: CardZone[],
  players: readonly Player[] = [],
  seats: readonly Seat[] = [],
  tr: Translator = englishTranslator
): ActionHistoryEntry[] {
  const name = (seatId: string) => seatName(players, seatId);
  const target = (t: Parameters<typeof targetLabel>[0]) => targetLabel(t, players);
  const named = (card: CardInstance) => tr('card.named', { name: cardName(card.definitionId), face: cardFaceLabel(card) });
  // A used card for a history line: "Sha (7 ♠)" for one card used as itself,
  // otherwise its name.
  const usedLabel = (used: UsedCard) => {
    if (used.via) {
      const as = tr('history.via', { card: cardName(used.as), ability: abilityName(used.via.abilityId) });
      return used.physical.length === 1 ? tr('history.usedAs.card', { card: named(used.physical[0]), as }) : tr('history.usedAs.cards', { count: used.physical.length, as });
    }
    return used.physical.length === 1 && used.physical[0].definitionId === used.as ? named(used.physical[0]) : cardName(used.as);
  };
  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const playedCards = new Map<string, UsedCard>();
  // Cards used but not yet moved on: their next move is the play's own.
  const awaitingMove = new Set<string>();
  // A pick waiting for its card's move, which says what was picked.
  let picked: ChoiceMadeEvent | null = null;
  const cards = (n: number) => tr(n === 1 ? 'history.cards.one' : 'history.cards.other', { n });
  // The General in `slot` of a seat, by name, when the viewer can see it.
  const generalIn = (seatId: string, slot: 'main' | 'deputy'): string | null => {
    const id = seats.find((s) => s.id === seatId)?.generals?.[slot].generalDefinitionId;
    return id && id !== 'hidden' ? (generalDisplayData(id)?.name ?? generalDisplayName(id)) : null;
  };
  // How many cards a seat picked last, for "gave 2 cards".
  let lastPicked: { seatId: string; count: number } | null = null;
  // The last face seen of each card, from moves into face-up zones.
  const knownFaces = new Map<string, CardInstance>();
  // The card each seat showed last, and its line (competing folds two into one).
  const lastShown = new Map<string, { card: CardInstance; line: ActionLine }>();
  let swapFirst: string | null = null;
  // "Seat 1 took Hing's Silver Lion (A ♣) with Steal", "Seat 1 took a hand card
  // from Hing with Steal", "Seat 1 discarded Sha (7 ♠) from Hing's hand with Break".
  const pickLine = (made: ChoiceMadeEvent, face: CardInstance | undefined, ownerSeatId: string | undefined): string => {
    const tool =
      made.reason.kind === 'choice'
        ? tr('history.withSuffix', { tool: cardName(made.reason.card.as) })
        : made.reason.kind === 'ability'
          ? tr('history.withSuffix', { tool: abilityName(made.reason.abilityId) })
          : '';
    const chooser = name(made.seatId);
    if (made.shows.kind === 'hidden-hand') {
      return made.verb === 'take'
        ? tr('history.pickHandTook', { chooser, owner: name(made.shows.seatId), tool })
        : tr('history.pickHandDiscarded', { chooser, card: face ? named(face) : tr('history.aCard'), owner: name(made.shows.seatId), tool });
    }
    const what = face ? named(face) : tr('history.aCard');
    const whose = ownerSeatId && ownerSeatId !== made.seatId ? tr('history.possessive', { owner: name(ownerSeatId), thing: what }) : what;
    return tr(made.verb === 'take' ? 'history.pickTook' : 'history.pickDiscarded', { chooser, what: whose, tool });
  };
  const entries: ActionHistoryEntry[] = [];
  // A sequence starts with a phase's first line, or a card used on its user's
  // own initiative (not as an answer).
  let phaseStarted = false;
  let initiative = false;
  const line = (entry: ActionLine) => {
    if (phaseStarted || initiative) entry.starts = true;
    phaseStarted = initiative = false;
    entries.push(entry);
  };
  const forceOfSeat = (seatId: string) => forceOf(seats.find((s) => s.id === seatId)?.kingdom);
  const status = (seatId: string, text: string) => line({ kind: 'action', text, card: null, force: forceOfSeat(seatId) });
  let sawTurn = false;
  const action = (text: string, card: CardInstance | null = null) => line({ kind: 'action', text, card });

  for (const event of log) {
    switch (event.kind) {
      case 'TurnAdvancedEvent':
        sawTurn = true;
        phaseStarted = true;
        entries.push({ kind: 'turn', turnNumber: event.turnNumber, seatName: name(event.seatId) });
        break;
      case 'PhaseChangedEvent':
        phaseStarted = true;
        // Turn 1 starts without a TurnAdvancedEvent.
        if (!sawTurn) {
          sawTurn = true;
          entries.push({ kind: 'turn', turnNumber: 1, seatName: name(event.seatId) });
        }
        break;
      case 'CardPlayedEvent': {
        const used = event.card;
        for (const c of used.physical) {
          playedCards.set(c.instanceId, used);
          awaitingMove.add(c.instanceId);
        }
        const face = faceOf(used);
        const answered = event.inResponseTo;
        if (!answered) initiative = true;
        const seat = name(event.seatId);
        if (answered?.dyingSeatId) {
          const saved = answered.dyingSeatId === event.seatId ? tr('history.themselves') : name(answered.dyingSeatId);
          action(tr('history.useToSave', { seat, used: usedLabel(used), saved }), face);
        } else if (answered?.counters && answered.seatId) {
          action(tr('history.cancelCounter', { seat, owner: name(answered.seatId), card: cardName(used.as), used: usedLabel(used) }), face);
        } else if (answered?.targetSeatId && answered.seatId) {
          const tool = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const params = { seat, owner: name(answered.seatId), tool: tool ? cardName(tool.as) : tr('history.aTool'), used: usedLabel(used) };
          action(answered.targetSeatId === answered.seatId ? tr('history.cancelTool', params) : tr('history.cancelToolOn', { ...params, target: name(answered.targetSeatId) }), face);
        } else if (answered) {
          const answeredCard = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          action(
            answered.seatId
              ? answeredCard
                ? tr('history.usedAgainstCard', { seat, used: usedLabel(used), owner: name(answered.seatId), card: cardName(answeredCard.as) })
                : tr('history.usedAgainst', { seat, used: usedLabel(used), owner: name(answered.seatId) })
              : tr('history.usedInResponse', { seat, used: usedLabel(used) }),
            face
          );
        } else if (cardDisplayData(used.as)?.category === 'equipment') {
          action(tr('history.equipped', { seat, used: usedLabel(used) }), face);
        } else if (event.targets.length > 0) {
          action(tr('history.usedOn', { seat, used: usedLabel(used), targets: event.targets.map(target).join(', ') }), face);
        } else {
          action(tr('history.used', { seat, used: usedLabel(used) }), face);
        }
        break;
      }
      case 'CardMovedEvent': {
        if (event.card) knownFaces.set(event.cardInstanceId, event.card);
        if (awaitingMove.delete(event.cardInstanceId)) break;
        const from = zoneById.get(event.fromZoneId);
        const to = zoneById.get(event.toZoneId);
        if (picked) {
          const face = event.card ?? (picked.shows.kind === 'card' ? picked.shows.card : undefined);
          action(pickLine(picked, face, from?.ownerSeatId), face ?? null);
          picked = null;
          break;
        }
        // A worn card handed to another seat (Coerce's weapon).
        if (from?.kind === 'equip' && to?.kind === 'hand' && from.ownerSeatId && to.ownerSeatId && from.ownerSeatId !== to.ownerSeatId) {
          const face = knownFaces.get(event.cardInstanceId);
          action(tr('history.tookFrom', { taker: name(to.ownerSeatId), owner: name(from.ownerSeatId), card: face ? named(face) : tr('history.card') }), face ?? null);
          break;
        }
        // A card put under a General (Refusing Death).
        if (event.card && to?.kind === 'pile' && to.ownerSeatId) {
          action(tr('history.putUnder', { seat: name(to.ownerSeatId), card: named(event.card) }), event.card);
          break;
        }
        // Lightning moving on to the next seat's judgment area.
        if (event.card && from?.kind === 'judgment' && to?.kind === 'judgment' && from.ownerSeatId && to.ownerSeatId) {
          action(tr('history.movedOn', { card: named(event.card), from: name(from.ownerSeatId), to: name(to.ownerSeatId) }), event.card);
          break;
        }
        if (!event.card || to?.kind !== 'discardPile' || !from?.ownerSeatId) break;
        if (from.kind === 'hand') action(tr('history.discardedCard', { seat: name(from.ownerSeatId), card: named(event.card) }), event.card);
        if (from.kind === 'equip' || from.kind === 'judgment') action(tr('history.wasDiscarded', { seat: name(from.ownerSeatId), card: cardName(event.card.definitionId) }), event.card);
        break;
      }
      case 'DamageDealtEvent': {
        const { source, target: victim, amount, nature } = event.damage;
        const params = { target: target(victim), amount, nature, ...(source ? { source: target(source) } : {}) };
        const key = nature === 'normal' ? (source ? 'history.tookDamageFrom' : 'history.tookDamage') : source ? 'history.tookNatureDamageFrom' : 'history.tookNatureDamage';
        status(victim.seatId, tr(key, params));
        break;
      }
      case 'HealEvent':
        status(event.target.seatId, tr('history.recovered', { target: target(event.target), amount: event.amount }));
        break;
      case 'CardsDrawnEvent': {
        const n = event.cardInstanceIds.length;
        action(tr(n === 1 ? 'history.drew.one' : 'history.drew.other', { seat: name(event.seatId), n }));
        break;
      }
      case 'GeneralRevealedEvent': {
        const seat = name(event.seatId);
        if (event.forAbilityId) {
          const which = generalIn(event.seatId, event.slot) ?? tr(event.slot === 'main' ? 'history.theirMain' : 'history.theirDeputy');
          action(tr('history.revealedToUse', { seat, which, ability: abilityName(event.forAbilityId) }));
        } else {
          action(tr(event.slot === 'main' ? 'history.revealedMain' : 'history.revealedDeputy', { seat }));
        }
        break;
      }
      case 'SeatDyingEvent':
        status(event.seatId, tr('history.dying', { seat: name(event.seatId) }));
        break;
      case 'SeatSavedEvent':
        status(event.seatId, tr('history.saved', { seat: name(event.seatId) }));
        break;
      case 'SeatEliminatedEvent':
        status(event.seatId, tr('history.eliminated', { seat: name(event.seatId) }));
        break;
      case 'GeneralsChosenEvent':
        action(tr('history.generalsChosen', { seat: name(event.seatId) }));
        break;
      case 'ChoiceMadeEvent': {
        const { reason, shows } = event;
        const chooser = name(event.seatId);
        if (shows.kind === 'card' || shows.kind === 'hidden-hand') {
          picked = event;
        } else if (shows.kind === 'use' && reason.kind === 'ability') {
          // A reveal says it on its own line, next.
          if (!shows.reveals) {
            const ability = abilityName(reason.abilityId);
            action(
              reason.targetSeatId && reason.targetSeatId !== event.seatId
                ? tr('history.usedAbilityOn', { chooser, ability, target: name(reason.targetSeatId) })
                : tr('history.usedAbility', { chooser, ability })
            );
          }
        } else if (shows.kind === 'decline' && reason.kind === 'choice') {
          action(tr('history.letDraw', { chooser, user: name(reason.userSeatId), card: cardName(reason.card.as) }));
        } else if (shows.kind === 'seat') {
          const given = lastPicked?.seatId === event.seatId ? lastPicked.count : 0;
          action(event.verb === 'give' ? tr('history.gaveCards', { chooser, cards: cards(given), target: name(shows.seatId) }) : tr('history.chose', { chooser, what: name(shows.seatId) }));
        } else if (shows.kind === 'suit') {
          action(tr('history.namedSuit', { chooser, suit: suitSymbol(shows.suit) }));
        } else if (shows.kind === 'label' && reason.kind === 'ability' && reason.cardId) {
          // Believing or doubting a claim (Bewilder).
          action(tr(shows.text === 'Doubt' ? 'history.doubted' : 'history.believed', { chooser, owner: name(reason.owner.seatId), card: cardName(reason.cardId) }));
        } else if (shows.kind === 'label') {
          action(tr('history.chose', { chooser, what: shows.text }));
        }
        break;
      }
      case 'AbilityUsedEvent': {
        const owner = name(event.owner.seatId);
        const ability = abilityName(event.abilityId);
        if (event.outcome === 'used') {
          action(event.abilityId === 'upheaval' ? `${owner} used ${ability}: every other seat plays a Sha or loses 1 HP` : `${owner} used ${ability}`);
        } else if (event.outcome === 'no-effect' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)}'s Sha has no effect`);
        } else if (event.outcome === 'counts-as-shan') {
          // Said on its judgment's line, which comes just before.
          const last = entries[entries.length - 1];
          if (last?.kind === 'action' && last.text.startsWith(`${owner}'s ${ability} judgment:`)) last.text += ', Counts as Shan';
          else action(`${owner}'s ${ability} counts as Shan`);
        } else if (event.outcome === 'more-damage') {
          action(`${owner}'s ${ability}: 1 more damage`);
        } else if (event.outcome === 'unblockable' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} can't play a Shan`);
        } else if (event.outcome === 'moved' && event.targetSeatId) {
          action(`${owner}'s ${ability} moved the Sha to ${name(event.targetSeatId)}`);
        } else if (event.outcome === 'stays-alive') {
          action(`${owner}'s ${ability}: no match, ${owner} stays alive`);
        } else if (event.outcome === 'matched') {
          action(`${owner}'s ${ability}: a rank matched`);
        } else if ((event.outcome === 'claim-true' || event.outcome === 'claim-false') && event.cardId) {
          action(`${owner}'s ${cardName(event.cardId)} ${event.outcome === 'claim-true' ? 'was true' : 'was a bluff'}`);
        } else if (event.outcome === 'took-hand-card' && event.targetSeatId) {
          action(`${owner} took a hand card from ${name(event.targetSeatId)} (${ability})`);
        } else if ((event.outcome === 'compete-won' || event.outcome === 'compete-lost') && event.targetSeatId) {
          // "Seat 1 competed with Seat 2: 9 ♠ against 7 ♥, Seat 1 won", in place of the two "showed" lines.
          const mine = lastShown.get(event.owner.seatId);
          const theirs = lastShown.get(event.targetSeatId);
          for (const shown of [mine, theirs]) {
            const at = shown ? entries.lastIndexOf(shown.line) : -1;
            if (at >= 0) entries.splice(at, 1);
          }
          const faces = mine && theirs ? `: ${cardFaceLabel(mine.card)} against ${cardFaceLabel(theirs.card)}` : '';
          const winner = event.outcome === 'compete-won' ? owner : name(event.targetSeatId);
          action(`${owner} competed with ${name(event.targetSeatId)}${faces}, ${winner} won`);
          if (event.abilityId === 'heavens-justice') {
            action(`${owner}'s ${ability}: ${event.outcome === 'compete-won' ? 'one more Sha this turn, at any distance, with one more target' : 'no Sha this turn'}`);
          }
        } else if (event.outcome === 'reborn') {
          action(`${owner} used ${ability}: discards every card, draws 3, recovers to 3 HP and turns face up`);
        } else if (event.outcome === 'paid-weapon') {
          action(`${owner} discarded a Weapon for ${ability}`);
        } else if (event.outcome === 'struck' && event.targetSeatId) {
          action(`${owner} struck ${name(event.targetSeatId)} with ${ability}`);
        } else if (event.outcome === 'drew-up' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} draws up to its max HP`);
        } else if (event.outcome === 'judged-red' || event.outcome === 'judged-black') {
          action(`${owner}'s ${ability}: ${event.outcome === 'judged-red' ? 'black' : 'red'} hand cards can be used as Duel this turn`);
        } else if (event.outcome === 'discarded' && event.targetSeatId) {
          action(`${owner}'s ${ability}: discards one of ${name(event.targetSeatId)}'s cards`);
        } else if (event.outcome === 'recast') {
          action(`${owner} recast a club with ${ability}`);
        } else if (event.outcome === 'took-cards' && event.targetSeatId) {
          action(`${owner} took all of ${name(event.targetSeatId)}'s cards (${ability})`);
        } else if (event.outcome === 'exiled' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} turns over and draws cards`);
        } else if (event.outcome === 'revealed') {
          action(`${owner} used ${ability}`);
        } else if (event.outcome === 'culprit' && event.targetSeatId) {
          action(`${owner}'s ${ability}: the damage to ${name(event.targetSeatId)} counts as theirs`);
        } else if (event.outcome === 'took-card') {
          action(`${owner}'s ${ability}: took the Tool card`);
        } else if (event.outcome === 'drew' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} draws and discards`);
        } else if (event.outcome === 'gave' && event.targetSeatId) {
          action(`${owner} gave half of their hand to ${name(event.targetSeatId)} (${ability})`);
        } else if (event.outcome === 'collapsed') {
          action(`${owner} lost 1 HP to ${ability}`);
        } else if (event.outcome === 'collapsed-max') {
          action(`${owner} reduced their max HP with ${ability}`);
        } else if (event.outcome.startsWith('skipped-')) {
          action(`${owner} skipped their ${event.outcome.slice('skipped-'.length).replace(/^./, (c) => c.toUpperCase())} Phase with ${ability}`);
        } else if (event.outcome === 'moved-card' && event.targetSeatId) {
          action(`${owner} moved a card to ${name(event.targetSeatId)} (${ability})`);
        } else if (event.outcome === 'farmed') {
          action(`${owner}'s ${ability}: the judged card becomes a Farm`);
        } else if (event.outcome === 'awakened') {
          action(`${owner} awakened: ${ability}`);
        } else if (event.outcome === 'paid' && event.targetSeatId) {
          action(`${name(event.targetSeatId)} discarded a Basic card for ${owner}'s ${ability}`);
        } else if (event.outcome === 'extra-turn' && event.targetSeatId) {
          action(`${owner} gave ${name(event.targetSeatId)} an extra turn (${ability})`);
        } else if (event.outcome === 'drew') {
          action(`${owner} drew a card (${ability})`);
        } else if (event.outcome === 'placed' && event.targetSeatId) {
          action(`${owner} placed an Equipment card in ${name(event.targetSeatId)}'s equipment (${ability})`);
        } else if (event.outcome === 'gave-back' && event.targetSeatId) {
          action(`${owner} gave a discarded card back to ${name(event.targetSeatId)} and took the rest (${ability})`);
        } else if (event.outcome === 'lamented' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)} judges`);
        } else if (event.outcome === 'silenced' && event.targetSeatId) {
          action(`${name(event.targetSeatId)} loses all skills (${ability})`);
        } else if (event.outcome === 'new-form') {
          action(`${owner} gained a Form (${ability})`);
        } else if (event.outcome === 'swap-first' && event.targetSeatId) {
          swapFirst = event.targetSeatId;
        } else if (event.outcome === 'swapped' && event.targetSeatId) {
          action(`${swapFirst ? name(swapFirst) : 'A seat'} and ${name(event.targetSeatId)} swapped hands (${ability})`);
          swapFirst = null;
        }
        break;
      }
      case 'SelectionMadeEvent':
        if (event.of === 'cards') lastPicked = { seatId: event.seatId, count: event.ids.length };
        if (event.of === 'seats' && event.reason.kind === 'ability') {
          const picks = event.ids.map(name);
          const list = picks.length > 1 ? tr('history.and', { head: picks.slice(0, -1).join(', '), last: picks.at(-1) ?? '' }) : picks[0];
          action(tr('history.pickedWith', { seat: name(event.seatId), list, ability: abilityName(event.reason.abilityId) }));
        }
        break;
      case 'SkillGainedEvent':
        action(tr('history.gained', { seat: name(event.seatId), skill: abilityName(event.skillId) }));
        break;
      case 'FormChosenEvent':
        action(tr('history.chosenForm', { seat: name(event.seatId), skill: abilityName(event.skillId), general: generalDisplayData(event.generalId)?.name ?? tr('history.aForm') }));
        break;
      case 'MaxHpReducedEvent':
        status(event.seatId, tr('history.maxHp', { seat: name(event.seatId), maxHp: event.maxHp }));
        break;
      case 'HpLostEvent':
        status(
          event.seatId,
          event.abilityId
            ? tr('history.lostHpTo', { seat: name(event.seatId), amount: event.amount, ability: abilityName(event.abilityId) })
            : tr('history.lostHp', { seat: name(event.seatId), amount: event.amount })
        );
        break;
      case 'JudgmentChangedEvent':
        action(tr('history.judgmentChanged', { owner: name(event.owner.seatId), ability: abilityName(event.abilityId), face: cardFaceLabel(event.card) }), event.card);
        break;
      case 'ArrangementMadeEvent': {
        const top = event.top > 0 ? tr('history.arrangeTop', { cards: cards(event.top) }) : '';
        const bottom = event.bottom > 0 ? (top ? tr('history.arrangeBottom', { n: event.bottom }) : tr('history.arrangeBottomOnly', { cards: cards(event.bottom) })) : '';
        const parts = [top, bottom].filter(Boolean);
        action(tr('history.arranged', { seat: name(event.seatId), parts: parts.length > 1 ? tr('history.and', { head: parts[0], last: parts[1] }) : (parts[0] ?? '') }));
        break;
      }
      case 'SeatTurnedEvent':
        action(tr(event.faceDown ? 'history.seatDown' : event.passedTurn ? 'history.seatUpPassed' : 'history.seatUp', { seat: name(event.seatId) }));
        break;
      case 'CardShownEvent':
        action(tr('history.showed', { seat: name(event.seatId), card: named(event.card) }), event.card);
        lastShown.set(event.seatId, { card: event.card, line: entries[entries.length - 1] as ActionLine });
        break;
      case 'CardsTurnedUpEvent':
        action(tr('history.turnedUp', { cards: cards(event.cards.length), list: event.cards.map(named).join(', ') }));
        break;
      case 'JudgmentEvent':
        action(tr('history.judgment', { seat: name(event.seatId), reader: judgmentReaderName(event.reader), face: cardFaceLabel(event.card) }), event.card);
        break;
      case 'PhaseSkippedEvent':
        action(tr('history.phaseSkipped', { seat: name(event.seatId), phase: tr(`history.phase.${event.phase}` as const) }));
        break;
      case 'DiscardPileReshuffledEvent':
        action(tr('history.reshuffled', { count: event.cardCount }));
        break;
    }
  }
  return entries.reverse();
}

// The latest action sequence, oldest first: the line that started it and every
// line since (responses, damage, dying, rescues, picks). Turn markers are skipped,
// so it stays on screen until the next sequence starts.
export function latestSequence(history: ActionHistoryEntry[]): ActionLine[] {
  const lines: ActionLine[] = [];
  for (const entry of history) {
    if (entry.kind !== 'action') continue;
    lines.push(entry);
    if (entry.starts) break;
  }
  return lines.reverse();
}
```

- [ ] **Step 5: Run the new spec, the existing spec and the catalog parity**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/action-history.vi.spec.ts projects/app/src/app/game-board/action-history.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with `action-history.spec.ts` unedited. If an existing English assertion fails, a template differs from the old string by a character: fix `en.ts`, never the existing spec. If a Vietnamese assertion fails because of a typo in the plan's expected string, compare it with `vi.ts` and fix whichever is inconsistent with the templates in Step 3 (record a ruling).

- [ ] **Step 6: Typecheck, then run the whole app project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx jest --selectProjects app`
Expected: no type errors (this proves every `as const` template key, and every key in the ternaries, exists in the catalog; if `history.phase.${event.phase}` fails because `event.phase` is wider than the seven phases, widen the catalog or narrow the call and ledger a ruling); every suite passes, with no existing spec edited.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/game-board/action-history.ts projects/app/src/app/game-board/action-history.vi.spec.ts
git commit -m "feat(app): the action history builds through the translator

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (step 2b of the spec's "Translator-based builders", the history without ability outcomes):
- A builder takes a translator with an English default: Task 1.
- Whole-sentence templates for every non-ability line; fragments passed as params: Task 1.
- Existing spec unedited and English byte-identical: Task 1 Steps 5 and 6.
- Vietnamese covered by a new spec: Task 1 Step 1.
- Not in this plan, by design: the `AbilityUsedEvent` outcomes and the prose-comparing logic (`counts-as-shan`, the compete splice), which are step 2b-2; the "Turn n" and "Nothing yet" text in the panel templates (phase 3); seat, card, General and reader names (`labels.ts` step 2e, phase 4).

**Placeholder scan:** none. The full replacement file and every catalog entry are shown.

**Type consistency:** `Translator`, `englishTranslator`, `makeTranslator` come from phase 2a. `tr('card.named', …)` reuses the 2a key. Every `history.*` key used in Step 4 appears in Step 3: `aCard`, `card`, `aTool`, `aForm`, `themselves`, `theirMain`, `theirDeputy`, `withSuffix`, `possessive`, `and`, `via`, `usedAs.card`, `usedAs.cards`, `cards.one/other`, `useToSave`, `cancelCounter`, `cancelTool`, `cancelToolOn`, `usedAgainstCard`, `usedAgainst`, `usedInResponse`, `equipped`, `usedOn`, `used`, `pickHandTook`, `pickHandDiscarded`, `pickTook`, `pickDiscarded`, `tookFrom`, `putUnder`, `movedOn`, `discardedCard`, `wasDiscarded`, the four damage keys, `recovered`, `drew.one/other`, `revealedMain`, `revealedDeputy`, `revealedToUse`, `dying`, `saved`, `eliminated`, `generalsChosen`, `usedAbility`, `usedAbilityOn`, `letDraw`, `gaveCards`, `chose`, `namedSuit`, `doubted`, `believed`, `pickedWith`, `gained`, `chosenForm`, `maxHp`, `lostHp`, `lostHpTo`, `judgmentChanged`, `arrangeTop`, `arrangeBottom`, `arrangeBottomOnly`, `arranged`, `seatDown`, `seatUp`, `seatUpPassed`, `showed`, `turnedUp`, `judgment`, `phaseSkipped`, `phase.*` (seven), `reshuffled`.

**Review Focus:** each line has a test in Task 1's spec: raw `GeneralSelection` phase id; one, two and three picked seats; arrangement 0/0 gives `'Seat 0 put '`; unknown-face discard and the own-zone take; the unknown-tool cancel and the self-aimed tool.
