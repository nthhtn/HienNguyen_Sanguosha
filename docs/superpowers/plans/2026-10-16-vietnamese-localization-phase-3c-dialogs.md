# Vietnamese Localization, Phase 3c (Decision Dialogs and General Selection) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish wiring the Game screen to the language: the Response, Ask, Arrange, Discard and Compete dialogs, the Compete result reader, and the General selection screen. After this plan no component under `game-board/` shows literal English that belongs to the UI, so switching to Vietnamese changes the whole Game screen. English stays identical.

**Architecture:** The same pattern as plans 3a and 3b: components import `TPipe` and inject `I18n`; static and attribute text become `{{ 'key' | t }}` and `[attr.…]="'key' | t"`; text built in code goes through `this.i18n`. The Compete result reader (`competeResults`) is a pure builder, so it takes a trailing `tr` like the earlier builders, and passes `localeOf(tr)` to the content prose. `ResponseDialog.cardLabel` gains an optional translator. `game-board.ts` passes the translator to those two calls and gets a one-line comment that states the dialog snapshot rule. The Choice and Selection dialogs have no literal text of their own (their words come from the builders translated earlier), so they need no change.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Jest (`app` project), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` (phase 3)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-3` on branch `feat/vietnamese-phase-3`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. Every existing spec for these components (`response-dialog`, `ask-dialog`, `arrange-dialog`, `discard-dialog`, `compete-dialog`, `compete-result`, `general-selection`, `game-board`) must pass WITHOUT edits.
- A new catalog key needs an English entry and a Vietnamese entry with the same `{placeholders}` in the same commit (the `Messages` type and `catalogs.spec.ts` enforce it). Vietnamese follows the spec's glossary and is sentence case; Tướng and Sinh lực keep their capitals inside sentences; compete is "đấu điểm". Existing English text is kept exactly as it is, including its casing ("Seat 0, Choose your Generals").
- Jest and `tsc` do not type-check Angular templates. The verification step therefore runs `npx ng build app --configuration development` (strict templates). If the build reports a nullable value passed to a pipe parameter, add a `!` only where an enclosing `@if` guarantees it, and ledger a ruling.
- Change only the seven components below, `compete-result.ts`, `game-board.ts` (two calls and one comment), the two catalogs and the new spec. Do NOT touch `choice-dialog.ts`, `selection-dialog.ts`, `force-dialog.ts`, `labels.ts`, the builders, or the online screens.
- Dialogs describe their decision in the language that is on when they open (they are opened inside `untracked`); a switch changes the next dialog, not an open one. That is intended.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the project: `npx jest --selectProjects app --maxWorkers=50%`.

## Review Focus

- Each dialog reads exactly as before in English: `Response Needed`, `Skills`, `Cards`, `No skills can respond`, `No Response` with `— {outcome}`, `Respond with Shan`; `Discard 1 Card` versus `Discard 2 Cards` and the hint `Your hand is over its limit. Choose 2 to discard · 0/2 chosen`; `Where 3 ♥ goes`, `Move 3 ♥ left`; `Tied: … Seat 1 won, as a tie counts as a loss for Hing` versus `…, Hing won`.
- The General selection keeps its logic on the English role values (`'Main'`, `'Deputy'` drive the `deputy` CSS class and the chip) and only translates what is displayed; its tooltip reasons and slot names follow a language switch because they are computed.
- `competeResults` with a Vietnamese translator names a nameless seat "Người chơi N", a hidden source General "Tướng ẩn", and reads the Vietnamese compete outcome; with no translator it is unchanged.
- `ResponseDialog.cardLabel` for a hidden card reads "Lá bài ẩn (…)" in Vietnamese.
- No literal English is left in the seven components' templates, attribute text or TS-built strings (apart from CSS, icon names, the unit `s`, and General, card and skill names from content data).

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/en.ts`, `vi.ts` | About 45 new keys: `ui.discard`, `respDialog.*`, `arrangeDialog.*`, `discardDialog.*`, `compete.*`, `select.*`. |
| `app/src/app/game-board/{response-dialog,ask-dialog,arrange-dialog,discard-dialog,compete-dialog,general-selection}.ts` | Templates and TS-built text go through the translator. |
| `app/src/app/game-board/compete-result.ts` | `competeResults(..., tr?)`. |
| `app/src/app/game-board/game-board.ts` | Two calls pass the translator; one comment. |
| `app/src/app/game-board/dialogs.vi.spec.ts` | New: each dialog and the selection screen in Vietnamese, plus a live switch. |

---

### Task 1: Dialogs and General selection through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, and the eight files in the table above
- Test: `projects/app/src/app/game-board/dialogs.vi.spec.ts` (new); the existing specs must pass unedited

**Interfaces:**
- Consumes: `TPipe`, `I18n`, `Translator`, `localeOf`, the translator-aware `seatName`, `generalDisplayName`, `kingdomDisplayName`, `cardIdDisplayName`, `competeOutcomeText(…, locale)`; keys `ui.confirm`, `countdown.aria`, `label.action.respond`, `choice.option.decline`, `card.named`.
- Produces: `competeResults(log, from, seats, players?, tr?)`; `ResponseDialog.cardLabel(card, tr?)`; the catalog keys in Step 3.

- [ ] **Step 1: Write the failing spec**

`projects/app/src/app/game-board/dialogs.vi.spec.ts`:

```ts
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatTooltip } from '@angular/material/tooltip';
import { Action, CardInstance, ChooseGeneralsAction, ContentRegistry, EngineEvent, GeneralDefinition, GeneralOwner, Kingdom, Seat } from 'engine';
import { I18n } from '../i18n/i18n.service';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { ArrangeDialog } from './arrange-dialog';
import { AskDialog } from './ask-dialog';
import { AUTO_CLOSE_SECONDS, CompeteDialog } from './compete-dialog';
import { CompeteResult, competeResults } from './compete-result';
import { DiscardDialog } from './discard-dialog';
import { GeneralSelection } from './general-selection';
import { ResponseDialog, ResponseDialogData } from './response-dialog';

const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

// A fresh testing module with Vietnamese on, the dialog data provided, and the component inputs set.
async function mount<T>(component: Type<T>, data?: unknown, inputs: Record<string, unknown> = {}) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: jest.fn() } }] });
  await TestBed.inject(I18n).setLocale('vi');
  const fixture = TestBed.createComponent(component);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const shan: CardInstance = { instanceId: 'shan-1', definitionId: 'shan', suit: 'heart', rank: 2 };
const respond: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'w1', cardInstanceId: 'shan-1' };
const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'w1' };
const description = {
  source: 'Seat 1 played Sha against Hing', latest: null, prompt: 'Your turn to respond to Sha', outcome: 'You lose 1 HP (1 damage from Seat 1)', outcomeForce: 'Shu' as const,
};

describe('ResponseDialog in Vietnamese', () => {
  const data = (cards: ResponseDialogData['cards'], skills: ResponseDialogData['skills'] = []): ResponseDialogData => ({ description, cards, skills, noResponse: pass });

  it('the title, the section headings, the options and the confirm button', async () => {
    const { fixture, el } = await mount(ResponseDialog, data([{ id: 'shan-1', action: respond, card: shan, label: 'Shan (2 ♥)' }]));
    expect(text(el.querySelector('h2'))).toBe('Cần đáp lại');
    expect([...el.querySelectorAll('.options h3')].map(text)).toEqual(['Kỹ năng', 'Bài']);
    expect(el.querySelector('.options')!.getAttribute('aria-label')).toBe('Chọn cách đáp lại');
    expect(text(el.querySelector('.empty'))).toBe('Không có kỹ năng nào có thể đáp lại');
    expect(text(el.querySelector('.no-response'))).toContain('Không đáp lại');
    expect(text(el.querySelector('.no-response'))).toContain('— You lose 1 HP (1 damage from Seat 1)');
    expect(text(el.querySelector('button.confirm'))).toBe('Đáp lại bằng Shan');
    (el.querySelector('.no-response input') as HTMLInputElement).click();
    fixture.detectChanges();
    expect(text(el.querySelector('button.confirm'))).toBe('Không đáp lại');
  });

  it('with nothing to answer with, both lists are empty and the button says No Response', async () => {
    const { el } = await mount(ResponseDialog, data([]));
    expect([...el.querySelectorAll('.empty')].map(text)).toEqual(['Không có kỹ năng nào có thể đáp lại', 'Không có lá bài nào có thể đáp lại']);
    expect(text(el.querySelector('button.confirm'))).toBe('Không đáp lại');
  });

  it('a skill answer confirms with its own label', async () => {
    const convert: Action = { kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'sp' }, conversionId: 'serpent-spear' }, targets: [] };
    const { el } = await mount(ResponseDialog, data([], [{ id: 'convert-0', action: convert, label: 'Dùng 2 lá bài làm Sha' }]));
    expect(text(el.querySelector('button.confirm'))).toBe('Dùng 2 lá bài làm Sha');
  });

  it('cardLabel names a card, and a hidden card in the translator’s language', () => {
    expect(ResponseDialog.cardLabel(shan)).toBe('Shan (2 ♥)');
    const hidden: CardInstance = { instanceId: 'h', definitionId: 'hidden', suit: 'spade', rank: 1 };
    expect(ResponseDialog.cardLabel(hidden)).toBe('Hidden Card (A ♠)');
    expect(ResponseDialog.cardLabel(hidden, makeTranslator(vi, 'vi'))).toBe('Lá bài ẩn (A ♠)');
  });
});

describe('AskDialog, ArrangeDialog and DiscardDialog in Vietnamese', () => {
  it('Ask: the decline button', async () => {
    const use: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId: 'use' };
    const decline: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId: 'decline' };
    const { el } = await mount(AskDialog, { description: { title: 'Axe', prompt: 'Dùng Axe?', hint: null, card: null, generalId: null, useLabel: 'Dùng', use, decline } });
    expect(text(el.querySelector('button.decline'))).toBe('Không');
    expect(text(el.querySelector('button.use'))).toBe('Dùng');
  });

  it('Arrange: the place buttons, the aria labels and Confirm', async () => {
    const cards: CardInstance[] = [{ instanceId: 't1', definitionId: 'peach', suit: 'heart', rank: 3 }, { instanceId: 't2', definitionId: 'duel', suit: 'spade', rank: 1 }];
    const template: Extract<Action, { kind: 'ArrangeCardsAction' }> = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
    const { el } = await mount(ArrangeDialog, { description: { title: 'Astrology', prompt: 'Đặt…', cards, template } });
    const first = el.querySelector('[data-card-id="t1"]') as HTMLElement;
    expect(first.querySelector('.place')!.getAttribute('aria-label')).toBe('Đặt 3 ♥ ở đâu');
    expect(text(first.querySelector('button.top'))).toBe('Trên');
    expect(text(first.querySelector('button.bottom'))).toBe('Dưới');
    expect(first.querySelector('button.right')!.getAttribute('aria-label')).toBe('Dời 3 ♥ sang phải');
    expect((el.querySelector('[data-card-id="t2"] button.left') as HTMLElement).getAttribute('aria-label')).toBe('Dời A ♠ sang trái');
    expect(text(el.querySelector('button.confirm'))).toBe('Xác nhận');
  });

  it('Discard: the title for one and several, the hint and the button', async () => {
    const hand: CardInstance[] = [{ instanceId: 'c1', definitionId: 'sha', suit: 'spade', rank: 7 }, { instanceId: 'c2', definitionId: 'shan', suit: 'heart', rank: 2 }];
    const two = await mount(DiscardDialog, { cards: hand, count: 2 });
    expect(text(two.el.querySelector('h2'))).toBe('Bỏ 2 lá bài');
    expect(text(two.el.querySelector('.hint'))).toBe('Bài trên tay của bạn vượt giới hạn. Chọn 2 lá để bỏ · đã chọn 0/2');
    expect(text(two.el.querySelector('button.discard'))).toContain('Bỏ bài');
    const one = await mount(DiscardDialog, { cards: hand, count: 1 });
    expect(text(one.el.querySelector('h2'))).toBe('Bỏ 1 lá bài');
  });
});

describe('CompeteDialog and competeResults in Vietnamese', () => {
  const nine: CardInstance = { instanceId: 'c9', definitionId: 'sha', suit: 'spade', rank: 9 };
  const seven: CardInstance = { instanceId: 'c7', definitionId: 'shan', suit: 'heart', rank: 7 };
  const result = (over: Partial<CompeteResult> = {}): CompeteResult => ({
    id: 'compete-3', abilityId: 'heavens-justice', abilityName: "Heaven's Justice", skillText: null,
    generalId: 'taishi-ci', generalName: 'Taishi Ci', force: 'Wu',
    user: { seatId: 'seat-0', name: 'Hing', generalId: 'taishi-ci', card: nine },
    target: { seatId: 'seat-1', name: 'Seat 1', generalId: null, card: seven },
    won: true, tie: false, winnerName: 'Hing', outcome: 'Hing thắng',
    ...over,
  });

  it('the title, the winner badge, the versus mark, the result and the outcome label', async () => {
    const { el } = await mount(CompeteDialog, result());
    expect(text(el.querySelector('h2'))).toBe('Đấu điểm');
    expect(el.querySelector('.versus')!.getAttribute('aria-label')).toBe('Các người chơi đấu điểm');
    expect(text(el.querySelector('.badge'))).toContain('Thắng');
    expect(text(el.querySelector('.vs'))).toBe('vs');
    expect(text(el.querySelector('.result'))).toBe('9 ♠ so với 7 ♥, Hing thắng');
    expect(text(el.querySelector('.outcome .label'))).toBe('Kết quả');
    expect(text(el.querySelector('button.continue'))).toBe('Tiếp tục');
    expect(el.querySelector('.timer')!.getAttribute('aria-label')).toBe(`Còn ${AUTO_CLOSE_SECONDS} giây`);
  });

  it('a tie counts as a loss for the challenger', async () => {
    const { el } = await mount(CompeteDialog, result({ won: false, tie: true, winnerName: 'Seat 1' }));
    expect(text(el.querySelector('.result'))).toBe('Hòa: 9 ♠ so với 7 ♥. Seat 1 thắng, vì hòa tính là thua đối với Hing');
  });

  const seat = (id: string, index: number, kingdom: Seat['kingdom'], main: string): Seat => ({
    id, index, kingdom, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: main, revealed: true }, deputy: { generalDefinitionId: 'cao-cao', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const owner: GeneralOwner = { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'heavens-justice' };
  const log: EngineEvent[] = [
    { kind: 'CardShownEvent', seatId: 'seat-0', card: nine, abilityId: 'heavens-justice' },
    { kind: 'CardShownEvent', seatId: 'seat-1', card: seven, abilityId: 'heavens-justice' },
    { kind: 'AbilityUsedEvent', owner, abilityId: 'heavens-justice', outcome: 'compete-won', targetSeatId: 'seat-1' },
  ];

  it('competeResults names a nameless seat, a hidden source General and the outcome in Vietnamese', () => {
    const tr = makeTranslator(vi, 'vi');
    const [shown] = competeResults(log, 0, [seat('seat-0', 0, 'Wu', 'taishi-ci'), seat('seat-1', 1, 'Shu', 'guan-yu')], [], tr);
    expect(shown).toMatchObject({
      winnerName: 'Người chơi 0',
      generalName: 'Taishi Ci',
      user: { name: 'Người chơi 0' },
      target: { name: 'Người chơi 1' },
      outcome: 'Người chơi 0 có thể ra thêm một Sát trong lượt này, ở mọi khoảng cách, thêm một mục tiêu',
    });
    const [hidden] = competeResults(log, 0, [seat('seat-0', 0, 'Wu', 'hidden'), seat('seat-1', 1, 'Shu', 'guan-yu')], [], tr);
    expect(hidden.generalName).toBe('Tướng ẩn');
    const [english] = competeResults(log, 0, [seat('seat-0', 0, 'Wu', 'hidden'), seat('seat-1', 1, 'Shu', 'guan-yu')], []);
    expect(english).toMatchObject({ generalName: 'Hidden General', winnerName: 'Seat 0', outcome: 'Seat 0 can play one more Sha this turn, at any distance, with one more target' });
  });
});

describe('GeneralSelection in Vietnamese', () => {
  const general = (id: string, kingdom: Kingdom, maxHp: number): [string, GeneralDefinition] => [id, { id, kingdom, maxHp, skills: [] }];
  const registry: ContentRegistry = { cards: new Map(), generals: new Map([general('w1', 'Wei', 4), general('w2', 'Wei', 3), general('s1', 'Shu', 4)]) };
  const pair = (mainId: string, deputyId: string): ChooseGeneralsAction => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId });
  const inputs = (seatName = '') => ({ candidates: ['w1', 'w2', 's1'], actions: [pair('w1', 'w2'), pair('w2', 'w1')], registry, seatName });
  const card = (el: HTMLElement, id: string) => el.querySelector(`[data-general-id="${id}"]`) as HTMLElement;

  it('the title with and without a name, the hint, the kingdom tag and the HP', async () => {
    const named = await mount(GeneralSelection, undefined, inputs('Hing'));
    expect(text(named.el.querySelector('h2'))).toBe('Hing, hãy chọn Tướng của bạn');
    expect(text(named.el.querySelector('.hint'))).toBe('Chọn hai Tướng cùng thế lực. Lựa chọn đầu tiên là Tướng chính của bạn.');
    expect(text(card(named.el, 'w1').querySelector('.kingdom-tag'))).toBe('Ngụy');
    expect(text(card(named.el, 'w1').querySelector('.hp-label'))).toBe('Sinh lực 4');
    expect(card(named.el, 'w1').querySelector('.hearts')!.getAttribute('aria-label')).toBe('Sinh lực 4');
    const anonymous = await mount(GeneralSelection, undefined, inputs());
    expect(text(anonymous.el.querySelector('h2'))).toBe('Hãy chọn Tướng của bạn');
  });

  it('the role chips, the slot labels, the empty slot, the swap button, the summary and Confirm', async () => {
    const { fixture, el } = await mount(GeneralSelection, undefined, inputs());
    expect(text(el.querySelector('.slot.main .slot-name'))).toBe('Chọn một Tướng');
    card(el, 'w1').click();
    fixture.detectChanges();
    card(el, 'w2').click();
    fixture.detectChanges();
    expect(text(card(el, 'w1').querySelector('.role-chip'))).toBe('Chính');
    expect(text(card(el, 'w2').querySelector('.role-chip'))).toBe('Phụ');
    expect(card(el, 'w2').querySelector('.role-chip')!.classList).toContain('deputy');
    expect(text(el.querySelector('.slot.main .slot-label'))).toBe('Chính');
    expect(text(el.querySelector('.slot.deputy .slot-label'))).toBe('Phụ');
    expect(el.querySelector('button.swap')!.getAttribute('aria-label')).toBe('Đổi Tướng chính và Tướng phụ');
    expect(text(el.querySelector('.summary'))).toContain('Thế lực: Ngụy · Sinh lực tổng: ');
    expect(text(el.querySelector('button.confirm'))).toContain('Xác nhận');
  });

  it('the tooltip reasons, and a language switch that updates computed text', async () => {
    const { fixture, el } = await mount(GeneralSelection, undefined, inputs());
    const tooltip = (id: string) => fixture.debugElement.query(By.css(`[data-general-id="${id}"]`)).injector.get(MatTooltip).message;
    expect(tooltip('s1')).toBe('Không có ứng viên nào khác cùng thế lực');
    card(el, 'w1').click();
    fixture.detectChanges();
    expect(tooltip('s1')).toBe('Phải cùng thế lực với lựa chọn đầu tiên');
    await TestBed.inject(I18n).setLocale('en');
    await fixture.whenStable();
    expect(tooltip('s1')).toBe('Must share a kingdom with your first pick');
    expect(text(el.querySelector('.slot.deputy .slot-name'))).toBe('Pick a General');
    expect(text(card(el, 'w1').querySelector('.role-chip'))).toBe('Main');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --maxWorkers=50% --runTestsByPath projects/app/src/app/game-board/dialogs.vi.spec.ts`
Expected: FAIL: the dialogs still render English and `competeResults` and `cardLabel` ignore a translator. If a test fails for a fixture or type reason (a `CompeteResult` field, the dialog data shapes, the tooltip lookup), compare it with `response-dialog.spec.ts`, `compete-dialog.spec.ts` or `general-selection.spec.ts` and fix the fixture, not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, append inside the object (after the last existing entry, before `} satisfies`):

```ts
  'ui.discard': 'Discard',
  'respDialog.title': 'Response Needed',
  'respDialog.choose': 'Choose a response',
  'respDialog.skills': 'Skills',
  'respDialog.noSkills': 'No skills can respond',
  'respDialog.cards': 'Cards',
  'respDialog.noCards': 'No cards can respond',
  'respDialog.none': 'No Response',
  'respDialog.outcome': '— {outcome}',
  'arrangeDialog.where': 'Where {card} goes',
  'arrangeDialog.top': 'Top',
  'arrangeDialog.bottom': 'Bottom',
  'arrangeDialog.left': 'Move {card} left',
  'arrangeDialog.right': 'Move {card} right',
  'discardDialog.title.one': 'Discard {n} Card',
  'discardDialog.title.other': 'Discard {n} Cards',
  'discardDialog.hint': 'Your hand is over its limit. Choose {count} to discard · {chosen}/{count} chosen',
  'compete.title': 'Compete',
  'compete.players': 'Competing players',
  'compete.winner': 'Winner',
  'compete.vs': 'vs',
  'compete.outcome': 'Outcome',
  'compete.continue': 'Continue',
  'compete.faces': '{mine} against {theirs}',
  'compete.result': '{faces}, {winner} won',
  'compete.tied': 'Tied: {faces}. {winner} won, as a tie counts as a loss for {user}',
  'select.title': 'Choose your Generals',
  'select.titleFor': '{name}, Choose your Generals',
  'select.hint': 'Pick two Generals of the same kingdom. Your first pick is your Main General.',
  'select.main': 'Main',
  'select.deputy': 'Deputy',
  'select.noPartner': 'No other candidate shares this kingdom',
  'select.mustShare': 'Must share a kingdom with your first pick',
  'select.hp': 'HP {n}',
  'select.pick': 'Pick a General',
  'select.swap': 'Swap Main and Deputy',
  'select.kingdom': 'Kingdom:',
  'select.combinedHp': '· Combined HP: {hp}',
```

and in `projects/app/src/app/i18n/vi.ts`, append inside the object (after the last existing entry, before `};`):

```ts
  'ui.discard': 'Bỏ bài',
  'respDialog.title': 'Cần đáp lại',
  'respDialog.choose': 'Chọn cách đáp lại',
  'respDialog.skills': 'Kỹ năng',
  'respDialog.noSkills': 'Không có kỹ năng nào có thể đáp lại',
  'respDialog.cards': 'Bài',
  'respDialog.noCards': 'Không có lá bài nào có thể đáp lại',
  'respDialog.none': 'Không đáp lại',
  'respDialog.outcome': '— {outcome}',
  'arrangeDialog.where': 'Đặt {card} ở đâu',
  'arrangeDialog.top': 'Trên',
  'arrangeDialog.bottom': 'Dưới',
  'arrangeDialog.left': 'Dời {card} sang trái',
  'arrangeDialog.right': 'Dời {card} sang phải',
  'discardDialog.title.one': 'Bỏ {n} lá bài',
  'discardDialog.title.other': 'Bỏ {n} lá bài',
  'discardDialog.hint': 'Bài trên tay của bạn vượt giới hạn. Chọn {count} lá để bỏ · đã chọn {chosen}/{count}',
  'compete.title': 'Đấu điểm',
  'compete.players': 'Các người chơi đấu điểm',
  'compete.winner': 'Thắng',
  'compete.vs': 'vs',
  'compete.outcome': 'Kết quả',
  'compete.continue': 'Tiếp tục',
  'compete.faces': '{mine} so với {theirs}',
  'compete.result': '{faces}, {winner} thắng',
  'compete.tied': 'Hòa: {faces}. {winner} thắng, vì hòa tính là thua đối với {user}',
  'select.title': 'Hãy chọn Tướng của bạn',
  'select.titleFor': '{name}, hãy chọn Tướng của bạn',
  'select.hint': 'Chọn hai Tướng cùng thế lực. Lựa chọn đầu tiên là Tướng chính của bạn.',
  'select.main': 'Chính',
  'select.deputy': 'Phụ',
  'select.noPartner': 'Không có ứng viên nào khác cùng thế lực',
  'select.mustShare': 'Phải cùng thế lực với lựa chọn đầu tiên',
  'select.hp': 'Sinh lực {n}',
  'select.pick': 'Chọn một Tướng',
  'select.swap': 'Đổi Tướng chính và Tướng phụ',
  'select.kingdom': 'Thế lực:',
  'select.combinedHp': '· Sinh lực tổng: {hp}',
```

- [ ] **Step 4: Convert the components**

Apply this script from the worktree root (`python3 -`). Every replacement asserts its count; a wrong count means a file is not what the plan expects, so stop and ledger it instead of forcing it (revert the file with `git checkout -- <path>`, fix the plan text, and re-run only the script).

```python
import re

G = 'projects/app/src/app/game-board/'

def read(p):
    return open(p).read()

def swap(path, old, new, count=1):
    s = read(path)
    assert s.count(old) == count, (path, old, s.count(old))
    open(path, 'w').write(s.replace(old, new))

def add_import(path, line):
    s = read(path)
    last = list(re.finditer(r"^import[\s\S]*?;\n", s, re.M))[-1]
    open(path, 'w').write(s[:last.end()] + line + "\n" + s[last.end():])

def ensure_core(path, name):
    s = read(path)
    m = re.search(r"import \{([^}]*)\} from '@angular/core';", s)
    assert m, path
    names = [n.strip() for n in m.group(1).split(',') if n.strip()]
    if name not in names:
        names.append(name)
        open(path, 'w').write(s[:m.start()] + "import { " + ", ".join(names) + " } from '@angular/core';" + s[m.end():])

def add_to_imports(path, name):
    s = read(path)
    m = re.search(r"imports:\s*\[([^\]]*)\]", s)
    assert m, path
    inner = m.group(1).strip()
    new = f"{inner}, {name}" if inner else name
    open(path, 'w').write(s[:m.start(1)] + new + s[m.end(1):])

def add_name_to_import(path, module, name):
    s = read(path)
    m = re.search(r"import \{([^}]*)\} from '%s';" % re.escape(module), s)
    assert m, (path, module)
    names = [n.strip() for n in m.group(1).split(',') if n.strip()]
    if name not in names:
        names.append(name)
        open(path, 'w').write(s[:m.start()] + "import { " + ", ".join(names) + " } from '" + module + "';" + s[m.end():])

def wire(path, i18n=True):
    add_import(path, "import { TPipe } from '../i18n/t.pipe';")
    add_to_imports(path, 'TPipe')
    if i18n:
        add_import(path, "import { I18n } from '../i18n/i18n.service';")
        ensure_core(path, 'inject')

def t(key):
    return "{{ '%s' | t }}" % key

# --- response-dialog.ts
p = G + 'response-dialog.ts'
wire(p)
add_import(p, "import { englishTranslator, Translator } from '../i18n/translator';")
swap(p, '<h2 mat-dialog-title>Response Needed</h2>', '<h2 mat-dialog-title>' + t('respDialog.title') + '</h2>')
swap(p, 'aria-label="Choose a response">', '[attr.aria-label]="\'respDialog.choose\' | t">')
swap(p, '<h3>Skills</h3>', '<h3>' + t('respDialog.skills') + '</h3>')
swap(p, '<p class="empty">No skills can respond</p>', '<p class="empty">' + t('respDialog.noSkills') + '</p>')
swap(p, '<h3>Cards</h3>', '<h3>' + t('respDialog.cards') + '</h3>')
swap(p, '<p class="empty">No cards can respond</p>', '<p class="empty">' + t('respDialog.noCards') + '</p>')
swap(p, '<span>No Response</span>', '<span>' + t('respDialog.none') + '</span>')
swap(p, "— {{ data.description.outcome }}", "{{ 'respDialog.outcome' | t: { outcome: data.description.outcome } }}")
swap(p, "  private readonly dialogRef = inject<MatDialogRef<ResponseDialog, Action>>(MatDialogRef);\n", "  private readonly dialogRef = inject<MatDialogRef<ResponseDialog, Action>>(MatDialogRef);\n  private readonly i18n = inject(I18n);\n")
swap(p, "    if (!option) return 'No Response';\n    return option.card ? `Respond with ${this.name(option.card)}` : option.label;",
        "    if (!option) return this.i18n.t('respDialog.none');\n    return option.card ? this.i18n.t('label.action.respond', { card: this.name(option.card) }) : option.label;")
swap(p, "    return cardIdDisplayName(card.definitionId);\n  }\n\n  protected confirm", "    return cardIdDisplayName(card.definitionId, this.i18n.translator);\n  }\n\n  protected confirm")
swap(p, "  static cardLabel(card: CardInstance): string {\n    return `${cardIdDisplayName(card.definitionId)} (${cardFaceLabel(card)})`;",
        "  static cardLabel(card: CardInstance, tr: Translator = englishTranslator): string {\n    return tr('card.named', { name: cardIdDisplayName(card.definitionId, tr), face: cardFaceLabel(card) });")

# --- ask-dialog.ts (only the pipe: its other text comes from the description)
p = G + 'ask-dialog.ts'
wire(p, i18n=False)
swap(p, "(click)=\"close(data.description.decline)\">Don't</button>", "(click)=\"close(data.description.decline)\">" + t('choice.option.decline') + "</button>")

# --- arrange-dialog.ts
p = G + 'arrange-dialog.ts'
wire(p, i18n=False)
swap(p, """[attr.aria-label]="'Where ' + faceOf(item.card) + ' goes'\"""", """[attr.aria-label]="'arrangeDialog.where' | t: { card: faceOf(item.card) }\"""")
swap(p, "(click)=\"place(i, 'top')\">Top</button>", "(click)=\"place(i, 'top')\">" + t('arrangeDialog.top') + "</button>")
swap(p, "(click)=\"place(i, 'bottom')\">Bottom</button>", "(click)=\"place(i, 'bottom')\">" + t('arrangeDialog.bottom') + "</button>")
swap(p, """[attr.aria-label]="'Move ' + faceOf(item.card) + ' left'\"""", """[attr.aria-label]="'arrangeDialog.left' | t: { card: faceOf(item.card) }\"""")
swap(p, """[attr.aria-label]="'Move ' + faceOf(item.card) + ' right'\"""", """[attr.aria-label]="'arrangeDialog.right' | t: { card: faceOf(item.card) }\"""")
swap(p, '(click)="confirm()">Confirm</button>', '(click)="confirm()">' + t('ui.confirm') + '</button>')

# --- discard-dialog.ts
p = G + 'discard-dialog.ts'
wire(p, i18n=False)
swap(p, "<h2 mat-dialog-title>Discard {{ data.count }} {{ data.count === 1 ? 'Card' : 'Cards' }}</h2>",
        "<h2 mat-dialog-title>{{ (data.count === 1 ? 'discardDialog.title.one' : 'discardDialog.title.other') | t: { n: data.count } }}</h2>")
swap(p, '<p class="hint">Your hand is over its limit. Choose {{ data.count }} to discard · {{ chosen().size }}/{{ data.count }} chosen</p>',
        '<p class="hint">{{ \'discardDialog.hint\' | t: { count: data.count, chosen: chosen().size } }}</p>')
swap(p, "<mat-icon>delete</mat-icon> Discard", "<mat-icon>delete</mat-icon> " + t('ui.discard'))

# --- compete-dialog.ts
p = G + 'compete-dialog.ts'
wire(p)
swap(p, '<h2 mat-dialog-title>Compete</h2>', '<h2 mat-dialog-title>' + t('compete.title') + '</h2>')
swap(p, 'aria-label="Competing players"', '[attr.aria-label]="\'compete.players\' | t"')
swap(p, '<mat-icon>emoji_events</mat-icon> Winner', '<mat-icon>emoji_events</mat-icon> ' + t('compete.winner'))
swap(p, '<span class="vs" aria-hidden="true">vs</span>', '<span class="vs" aria-hidden="true">' + t('compete.vs') + '</span>')
swap(p, '<span class="label">Outcome</span>', '<span class="label">' + t('compete.outcome') + '</span>')
swap(p, """[attr.aria-label]="seconds() + ' seconds left'\"""", """[attr.aria-label]="'countdown.aria' | t: { n: seconds() }\"""")
swap(p, '(click)="close()">Continue</button>', '(click)="close()">' + t('compete.continue') + '</button>')
swap(p, "  private readonly dialogRef = inject<MatDialogRef<CompeteDialog>>(MatDialogRef);\n", "  private readonly dialogRef = inject<MatDialogRef<CompeteDialog>>(MatDialogRef);\n  private readonly i18n = inject(I18n);\n")
swap(p, "    const faces = `${cardFaceLabel(user.card)} against ${cardFaceLabel(target.card)}`;\n    return tie ? `Tied: ${faces}. ${winnerName} won, as a tie counts as a loss for ${user.name}` : `${faces}, ${winnerName} won`;",
        "    const faces = this.i18n.t('compete.faces', { mine: cardFaceLabel(user.card), theirs: cardFaceLabel(target.card) });\n"
        "    return tie ? this.i18n.t('compete.tied', { faces, winner: winnerName, user: user.name }) : this.i18n.t('compete.result', { faces, winner: winnerName });")

# --- compete-result.ts
p = G + 'compete-result.ts'
add_import(p, "import { englishTranslator, localeOf, Translator } from '../i18n/translator';")
swap(p, "players: readonly Player[] = []): CompeteResult[] {", "players: readonly Player[] = [], tr: Translator = englishTranslator): CompeteResult[] {")
swap(p, "seatName(players, event.owner.seatId)", "seatName(players, event.owner.seatId, tr)")
swap(p, "seatName(players, event.targetSeatId)", "seatName(players, event.targetSeatId, tr)")
swap(p, "(display?.name ?? generalDisplayName(generalId)) : 'Hidden General'", "(display?.name ?? generalDisplayName(generalId, tr)) : generalDisplayName('hidden', tr)")
swap(p, "{ user: userName, target: targetName })", "{ user: userName, target: targetName }, localeOf(tr))")

# --- general-selection.ts
p = G + 'general-selection.ts'
wire(p)
add_name_to_import(p, '../labels', 'kingdomDisplayName')
swap(p, "<h2>{{ seatName() ? seatName() + ', Choose your Generals' : 'Choose your Generals' }}</h2>",
        "<h2>{{ seatName() ? ('select.titleFor' | t: { name: seatName() }) : ('select.title' | t) }}</h2>")
swap(p, '<p class="hint">Pick two Generals of the same kingdom. Your first pick is your Main General.</p>', '<p class="hint">' + t('select.hint') + '</p>')
swap(p, """<span class="role-chip" [class.deputy]="role === 'Deputy'">{{ role }}</span>""", """<span class="role-chip" [class.deputy]="role === 'Deputy'">{{ roleName(role) }}</span>""")
swap(p, '<span class="kingdom-tag">{{ vm.kingdom }}</span>', '<span class="kingdom-tag">{{ kingdomName(vm.kingdom) }}</span>')
swap(p, """[attr.aria-label]="'HP ' + vm.maxHp\"""", """[attr.aria-label]="'select.hp' | t: { n: vm.maxHp }\"""")
swap(p, '<span class="hp-label">HP {{ vm.maxHp }}</span>', '<span class="hp-label">{{ \'select.hp\' | t: { n: vm.maxHp } }}</span>')
swap(p, '<span class="slot-label">Main</span>', '<span class="slot-label">' + t('select.main') + '</span>')
swap(p, '<span class="slot-label">Deputy</span>', '<span class="slot-label">' + t('select.deputy') + '</span>')
swap(p, 'aria-label="Swap Main and Deputy"', '[attr.aria-label]="\'select.swap\' | t"')
swap(p, """Kingdom: <span class="force-name" [attr.data-force]="s.kingdom">{{ s.kingdom }}</span> · Combined HP: {{ s.hp }}""",
        """{{ 'select.kingdom' | t }} <span class="force-name" [attr.data-force]="s.kingdom">{{ kingdomName(s.kingdom) }}</span> {{ 'select.combinedHp' | t: { hp: s.hp } }}""")
swap(p, "<mat-icon>check</mat-icon> Confirm", "<mat-icon>check</mat-icon> " + t('ui.confirm'))
swap(p, "  readonly chosen = output<ChooseGeneralsAction>();\n", "  readonly chosen = output<ChooseGeneralsAction>();\n\n  private readonly i18n = inject(I18n);\n")
swap(p, "    const disabledReason =\n      selected.length === 0 ? 'No other candidate shares this kingdom' : 'Must share a kingdom with your first pick';",
        "    const disabledReason = this.i18n.t(selected.length === 0 ? 'select.noPartner' : 'select.mustShare');")
swap(p, "name: display?.name ?? generalDisplayName(id),", "name: display?.name ?? generalDisplayName(id, this.i18n.translator),")
swap(p, "    if (!id) return 'Pick a General';\n    return generalDisplayData(id)?.name ?? generalDisplayName(id);",
        "    if (!id) return this.i18n.t('select.pick');\n    return generalDisplayData(id)?.name ?? generalDisplayName(id, this.i18n.translator);")
swap(p, "  protected slotName(position: 0 | 1): string {",
        "  // What the chip says; the role values themselves ('Main', 'Deputy') stay the logic's.\n"
        "  protected roleName(role: string): string {\n    return this.i18n.t(role === 'Main' ? 'select.main' : 'select.deputy');\n  }\n\n"
        "  protected kingdomName(kingdom: Parameters<typeof kingdomDisplayName>[0]): string {\n    return kingdomDisplayName(kingdom, this.i18n.translator);\n  }\n\n"
        "  protected slotName(position: 0 | 1): string {")

# --- game-board.ts
p = G + 'game-board.ts'
swap(p, "competeResults(log, competesSeen, visible.seats, visible.players)", "competeResults(log, competesSeen, visible.seats, visible.players, this.i18n.translator)")
swap(p, "ResponseDialog.cardLabel(card)", "ResponseDialog.cardLabel(card, this.i18n.translator)")
swap(p, "  // The Discard phase in one step: the dialog returns exactly `count` cards,",
        "  // The dialogs below describe their decision in the language that is on when they open\n"
        "  // (the open* methods run untracked): a language switch changes the next dialog, not\n"
        "  // an open one.\n"
        "  // The Discard phase in one step: the dialog returns exactly `count` cards,")
```

Notes on the script: `ask-dialog.ts`, `arrange-dialog.ts` and `discard-dialog.ts` only need the pipe (their other text comes from the description or the builders), so `wire(..., i18n=False)` adds `TPipe` to their `imports` and nothing else. In `general-selection.ts` the role values `'Main'` and `'Deputy'` stay as the logic's own, and `roleName` is only for display.

- [ ] **Step 5: Run the new spec and every existing spec for these components**

Run: `npx jest --selectProjects app --maxWorkers=50% --runTestsByPath projects/app/src/app/game-board/dialogs.vi.spec.ts projects/app/src/app/game-board/response-dialog.spec.ts projects/app/src/app/game-board/ask-dialog.spec.ts projects/app/src/app/game-board/arrange-dialog.spec.ts projects/app/src/app/game-board/discard-dialog.spec.ts projects/app/src/app/game-board/compete-dialog.spec.ts projects/app/src/app/game-board/compete-result.spec.ts projects/app/src/app/game-board/general-selection.spec.ts projects/app/src/app/game-board/game-board.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with the existing specs unedited. If an existing English assertion fails, a template or a param differs from the old string by a character: fix the replacement, never the existing spec.

- [ ] **Step 6: Typecheck, build the app (strict templates), check the specs, then run the whole project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx ng build app --configuration development && npx tsc -p projects/app/tsconfig.spec.json --noEmit; npx jest --selectProjects app --maxWorkers=50%`
Expected: no type errors; the build completes; the spec typecheck reports only the one older `selection-dialog.spec.ts` error (anything in the new spec is yours to fix); every suite passes.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/game-board/response-dialog.ts projects/app/src/app/game-board/ask-dialog.ts projects/app/src/app/game-board/arrange-dialog.ts projects/app/src/app/game-board/discard-dialog.ts projects/app/src/app/game-board/compete-dialog.ts projects/app/src/app/game-board/compete-result.ts projects/app/src/app/game-board/general-selection.ts projects/app/src/app/game-board/game-board.ts projects/app/src/app/game-board/dialogs.vi.spec.ts
git commit -m "feat(app): the decision dialogs and General selection follow the language

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (the last group of phase 3):
- The Response, Ask, Arrange, Discard and Compete dialogs and the General selection take their text from the catalog; the Compete result reader and `ResponseDialog.cardLabel` take the translator: Step 4.
- English is identical and the existing specs are unedited: Steps 5 and 6.
- Vietnamese is exercised on each dialog, the compete reader and the selection screen, including a live switch on the selection screen: Step 1.
- The dialog snapshot rule is written down in `game-board.ts`: Step 4.
- Not in this plan, by design: the Choice and Selection dialogs (no literal text of their own), card, ability and General names and rules text (phase 4), and the online screens.

**Placeholder scan:** none. Every key, every replacement and the whole spec are shown.

**Type consistency:** every key used by the script appears in Step 3 with the same placeholders in both languages (`discardDialog.hint` uses `{count}` twice in both). `competeResults` and `ResponseDialog.cardLabel` take a trailing `tr`, and `game-board.ts` passes `this.i18n.translator` to both. `roleName` takes the role value as a string; `kingdomName` takes the `Kingdom` type through `Parameters<typeof kingdomDisplayName>[0]`.

**Review Focus:** each line has a test in Step 1: the Response dialog's headings, empty states, outcome line and confirm label; the singular and plural Discard title; the aria labels of the Arrange dialog; the tie and winner results of the Compete dialog; `competeResults` for a nameless seat, a hidden General and English; the role chips, tooltip reasons and live switch of the General selection.
