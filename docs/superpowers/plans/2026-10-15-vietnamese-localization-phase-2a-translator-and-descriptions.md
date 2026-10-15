# Vietnamese Localization, Phase 2a (Translator and Descriptions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `Translator` contract, and make the choice, ask, selection and arrange descriptions build their text through it, with English output byte-identical and Vietnamese available.

**Architecture:** A `Translator` is `(key, params?) => string`. `makeTranslator(messages)` builds one from a catalog; `englishTranslator` is the default for every builder, so existing callers and specs are untouched. Builders gain one optional trailing `tr` parameter and call `tr('some.key', { ... })` where they used to template English. `I18n.translator` is the live translator components will pass in phase 3. Names inside sentences (seats, cards, abilities, Generals) still come from the existing English lookups until later steps.

**Tech Stack:** Angular 22, Jest (`app` project), TypeScript strict with `noPropertyAccessFromIndexSignature`.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` ("Translator-based builders", amended 2026-10-15)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n` on branch `feat/vietnamese-localization`. Always `git add` explicit paths, never `git commit -a`. The shared checkout at `/Users/hing/Workspace/my_sanguosha` holds another workstream's uncommitted files: never edit or stage anything there.
- Do NOT edit `labels.ts`, `game-board/action-list.ts`, `game-board/hand-view.ts` or `game-board/action-history.ts` in this plan. `labels.ts`, `action-list.ts` and `hand-view.ts` have uncommitted edits in the other checkout (`targetingParts` in `labels.ts` composes "Targeting" by hand and must become a template later), so they wait for a later step. The history is step 2b.
- English output stays byte-identical. The existing specs `choice-description.spec.ts` and `ability-description.spec.ts` must pass WITHOUT edits.
- A new catalog key needs an English entry and a Vietnamese entry in the same commit (the `Messages` type and `catalogs.spec.ts` enforce this). Vietnamese follows the glossary in the spec: Tướng, Sinh lực, Cẩm nang, phán xét, Người chơi, giai đoạn. Vietnamese is sentence case.
- Not in this plan, by design: prose that lives in `content/src/lib/display.ts` (`abilityHint`, `selectionText`, `stepSelectionText`, `seatPickText`, `choicePromptText`: step 2d), `labels.ts` helpers such as `seatName`'s "Seat 3" fallback and `suitLabel` (a later step), card, ability and General names (phase 4), and the text an engine event carries (such as `shows.text`). A Vietnamese prompt may therefore still hold an English name or hint.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the project: `npx jest --selectProjects app`.

## Review Focus

- A card prompt whose verb is not `take` or `discard` (`use`, `pick`, `give`): the English must read exactly as before ("Choose a card to use").
- A skill pick or ask with no target seat: the `{target}` fallback reads "a seat" in a pick and "the target" in a hint, in both languages.
- Counts at the boundary: a selection with `min === max` shows the bare number ("2"), one with `min < max` shows "up to 3", and `max === 1` picks the singular key.
- A face-down hand of 1 card versus 2 or more: singular and plural keys, each with its own count.
- An unmatched `{placeholder}` in a hint with no `{target}` in it: `abilityHint` text without a placeholder passes through unchanged.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/format.ts` | The pure `format` function, moved out of the service so builders can use it without Angular. |
| `app/src/app/i18n/translator.ts` | `Translator`, `makeTranslator`, `englishTranslator`. |
| `app/src/app/i18n/i18n.service.ts` | Re-exports `format`; gains `readonly translator`. |
| `app/src/app/i18n/en.ts`, `vi.ts` | New keys for `card.`, `choice.`, `ask.`, `selection.`, `arrange.`. |
| `app/src/app/game-board/choice-description.ts` | Builds through `tr`. |
| `app/src/app/game-board/ability-description.ts` | Builds through `tr`. |

New specs: `i18n/translator.spec.ts`, `game-board/choice-description.vi.spec.ts`, `game-board/ability-description.vi.spec.ts` (separate files, so the existing specs stay unedited).

---

### Task 1: The Translator contract

**Files:**
- Create: `projects/app/src/app/i18n/format.ts`, `projects/app/src/app/i18n/translator.ts`
- Modify: `projects/app/src/app/i18n/i18n.service.ts`
- Test: `projects/app/src/app/i18n/translator.spec.ts`, `projects/app/src/app/i18n/i18n.service.spec.ts` (add one test)

**Interfaces:**
- Consumes: `en`, `MessageKey`, `MessageParams`, `Messages`, `I18n`.
- Produces: `format(template, params?)` from `format.ts` (still re-exported by `i18n.service.ts`); `Translator`, `makeTranslator(messages: Messages): Translator`, `englishTranslator` from `translator.ts`; `I18n.translator: Translator`.

- [ ] **Step 1: Write the failing tests**

`projects/app/src/app/i18n/translator.spec.ts`:

```ts
import { makeTranslator, englishTranslator } from './translator';
import type { Messages } from './messages';

describe('translator', () => {
  it('englishTranslator reads the English catalog', () => {
    expect(englishTranslator('nav.language')).toBe('Language');
  });

  it('makeTranslator reads the catalog it is given and fills placeholders', () => {
    const tr = makeTranslator({ 'nav.language': '{a} and {b}' } as Messages);
    expect(tr('nav.language', { a: 1, b: 'x' })).toBe('1 and x');
  });

  it('leaves a placeholder visible when its param is missing', () => {
    const tr = makeTranslator({ 'nav.language': '{a} and {b}' } as Messages);
    expect(tr('nav.language', { a: 1 })).toBe('1 and {b}');
  });
});
```

Append inside the `describe('I18n', ...)` block of `projects/app/src/app/i18n/i18n.service.spec.ts` (before its closing `});`):

```ts
  it('offers a translator that follows the current language', async () => {
    const i18n = setup();
    expect(i18n.translator('nav.language')).toBe('Language');
    await i18n.setLocale('vi');
    expect(i18n.translator('nav.language')).toBe('Ngôn ngữ');
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/translator.spec.ts projects/app/src/app/i18n/i18n.service.spec.ts`
Expected: FAIL (`Cannot find module './translator'`, and `i18n.translator is not a function`).

- [ ] **Step 3: Write the code**

`projects/app/src/app/i18n/format.ts`:

```ts
import type { MessageParams } from './messages';

// Fills {name} placeholders. A missing param leaves its placeholder visible, and
// a function replacer keeps '$&' and friends in a value from being interpreted.
export function format(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder
  );
}
```

`projects/app/src/app/i18n/translator.ts`:

```ts
import { en } from './en';
import { format } from './format';
import type { MessageKey, MessageParams, Messages } from './messages';

// What a builder is handed to turn a key into text. I18n.translator is the live
// one; englishTranslator is every builder's default, so callers that pass none
// get today's English.
export type Translator = (key: MessageKey, params?: MessageParams) => string;

export const makeTranslator =
  (messages: Messages): Translator =>
  (key, params) =>
    format(messages[key], params);

export const englishTranslator: Translator = makeTranslator(en);
```

In `projects/app/src/app/i18n/i18n.service.ts`: delete the `format` function and its comment, and replace the imports and the head of the class so they read:

```ts
import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { CATALOG_LOADERS } from './catalogs';
import { en } from './en';
import { format } from './format';
import { DEFAULT_LOCALE, LocaleCode, isLocaleCode } from './locales';
import type { MessageKey, MessageParams, Messages } from './messages';
import type { Translator } from './translator';

export { format };
```

and add, directly after the `readonly locale = signal<LocaleCode>(readLocale());` line:

```ts
  // For the pure builders (history, descriptions): follows the current language.
  readonly translator: Translator = (key, params) => this.t(key, params);
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/i18n/translator.spec.ts projects/app/src/app/i18n/i18n.service.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS (every test, including the existing `format` tests that still import `format` from `./i18n.service`).

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/i18n/format.ts projects/app/src/app/i18n/translator.ts projects/app/src/app/i18n/translator.spec.ts projects/app/src/app/i18n/i18n.service.ts projects/app/src/app/i18n/i18n.service.spec.ts
git commit -m "feat(app): Translator contract with an English default

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The choice description through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/game-board/choice-description.ts`
- Test: `projects/app/src/app/game-board/choice-description.vi.spec.ts` (new); the existing `choice-description.spec.ts` must pass unedited

**Interfaces:**
- Consumes: `Translator`, `makeTranslator`, `englishTranslator`, `vi`, `MessageKey`.
- Produces: `describeChoice(state, viewerSeatId, tr?)`, `choiceOptionLabel(shows, players, declineLabel?, tr?)`, `choiceDialogOptions(options, legal, players, declineLabel?, seats?, tr?)`; `ChoiceDescription.confirmLabel` becomes `string`. Catalog keys: `card.named`, `choice.claim`, `choice.cardTo.{take,discard,use,pick,give}` and the same with `.from`, `choice.confirm.{take,discard,give,choose}`, `choice.give`, `choice.aSeat`, `choice.pick.{seat,suit,one}`, `choice.discardOrDraw`, `choice.letDraw`, `choice.option.{use,decline,handCard}`, `choice.option.hand.{one,other}`.

- [ ] **Step 1: Write the failing Vietnamese spec**

`projects/app/src/app/game-board/choice-description.vi.spec.ts`:

```ts
import { ChoiceOption, GameState, PendingChoice } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { choiceDialogOptions, choiceOptionLabel, describeChoice } from './choice-description';

const tr = makeTranslator(vi);
const players = [
  { id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' },
  { id: 'p1', seatId: 'seat-1', kind: 'bot' as const, name: 'Seat 1' },
];
const state = (pendingChoice: PendingChoice): GameState => ({
  seats: [], zones: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play', players,
  turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 }, pendingChoice,
});
const seatOption: ChoiceOption = { id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] };
const skill = (skillId: string, verb: PendingChoice['verb'], targetSeatId?: string, options: ChoiceOption[] = [seatOption], cardId?: string): PendingChoice => ({
  id: 'k', seatId: 'seat-0', verb, options,
  reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId }, abilityId: skillId, ...(targetSeatId ? { targetSeatId } : {}), ...(cardId ? { cardId } : {}) },
});
const toolChoice = (verb: PendingChoice['verb'], targetSeatId?: string, options: ChoiceOption[] = []): PendingChoice => ({
  id: 'c', seatId: 'seat-0', verb, options,
  reason: { kind: 'choice', card: { as: 'steal', colour: 'black', physical: [] }, userSeatId: 'seat-1', ...(targetSeatId ? { targetSeatId } : {}) },
});

describe('describeChoice in Vietnamese', () => {
  it('a skill discarding from another seat', () => {
    expect(describeChoice(state(skill('sudden-attack', 'discard', 'seat-1')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài để bỏ từ Seat 1', confirmLabel: 'Bỏ' });
  });

  it('a Tool taking from another seat', () => {
    expect(describeChoice(state(toolChoice('take', 'seat-1')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài để lấy từ Seat 1', confirmLabel: 'Lấy' });
  });

  it('a verb other than take or discard keeps its own wording, in English and Vietnamese', () => {
    expect(describeChoice(state(toolChoice('use')), 'seat-0')).toMatchObject({ prompt: 'Choose a card to use' });
    expect(describeChoice(state(toolChoice('use')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài để dùng' });
    expect(describeChoice(state(toolChoice('give', 'seat-1')), 'seat-0')).toMatchObject({ prompt: 'Choose a card to give from Seat 1' });
  });

  it('believe or doubt a claim', () => {
    const doubt = skill('bewilder', 'pick', undefined, [{ id: 'believe', shows: { kind: 'label', text: 'Believe' }, effects: [] }], 'sha');
    doubt.reason = { kind: 'ability', owner: { kind: 'general', seatId: 'seat-1', slot: 'main', skillId: 'bewilder' }, abilityId: 'bewilder', cardId: 'sha' };
    expect(describeChoice(state(doubt), 'seat-0', tr)).toMatchObject({ prompt: 'Seat 1 tuyên bố có Sha. Tin hay nghi ngờ?', confirmLabel: 'Chọn' });
  });

  it('gives cards, and picks a seat, a suit or one of several', () => {
    expect(describeChoice(state(skill('some-skill', 'give')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn người nhận các lá bài', confirmLabel: 'Đưa' });
    expect(describeChoice(state(skill('some-skill', 'pick')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một người chơi' });
    const suit: ChoiceOption = { id: 'heart', shows: { kind: 'suit', suit: 'heart' }, effects: [] };
    expect(describeChoice(state(skill('some-skill', 'pick', undefined, [suit])), 'seat-0', tr)).toMatchObject({ prompt: 'Gọi tên một chất' });
    expect(describeChoice(state(skill('some-skill', 'pick', undefined, [suit, seatOption])), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một' });
  });

  it('Gender Swords: discard a hand card or let the user draw', () => {
    const options: ChoiceOption[] = [{ id: 'decline', shows: { kind: 'decline' }, effects: [] }];
    expect(describeChoice(state(toolChoice('discard', 'seat-0', options)), 'seat-0', tr)).toMatchObject({
      prompt: 'Bỏ một lá bài trên tay, hoặc để Seat 1 rút 1 lá bài',
      confirmLabel: 'Bỏ',
      declineLabel: 'Để Seat 1 rút bài',
    });
  });
});

describe('choice options in Vietnamese', () => {
  it('labels use and decline', () => {
    expect(choiceOptionLabel({ kind: 'use' }, players, undefined, tr)).toBe('Dùng');
    expect(choiceOptionLabel({ kind: 'decline' }, players, undefined, tr)).toBe('Không');
    expect(choiceOptionLabel({ kind: 'decline' }, players)).toBe("Don't");
  });

  it('labels a face-down hand by its owner and size, singular and plural', () => {
    const hand = (count: number) => choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count }, players, undefined, tr);
    expect(hand(1)).toBe('Bài trên tay của Seat 1 (1 lá)');
    expect(hand(2)).toBe('Bài trên tay của Seat 1 (2 lá)');
    expect(choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count: 1 }, players)).toBe("Seat 1's Hand (1 Card)");
    expect(choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count: 2 }, players)).toBe("Seat 1's Hand (2 Cards)");
  });

  it('numbers the face-down cards of a hand', () => {
    const option: ChoiceOption = { id: 'h', shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 2 }, effects: [] };
    const legal = [{ kind: 'ChooseOptionAction' as const, seatId: 'seat-0', choiceId: 'c', optionId: 'h' }];
    expect(choiceDialogOptions([option], legal, players, undefined, [], tr).map((o) => o.label)).toEqual(['Lá bài trên tay 1', 'Lá bài trên tay 2']);
    expect(choiceDialogOptions([option], legal, players).map((o) => o.label)).toEqual(['Hand Card 1', 'Hand Card 2']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/choice-description.vi.spec.ts`
Expected: FAIL. TypeScript reports that the functions take too few arguments, which is the missing `tr` parameter. If it fails for another reason (a fixture type error), fix the fixture, not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, replace the object with:

```ts
export const en = {
  'nav.language': 'Language',
  'card.named': '{name} ({face})',
  'choice.claim': '{claimer} claims {card}. Believe or doubt?',
  'choice.cardTo.take': 'Choose a card to take',
  'choice.cardTo.take.from': 'Choose a card to take from {seat}',
  'choice.cardTo.discard': 'Choose a card to discard',
  'choice.cardTo.discard.from': 'Choose a card to discard from {seat}',
  'choice.cardTo.use': 'Choose a card to use',
  'choice.cardTo.use.from': 'Choose a card to use from {seat}',
  'choice.cardTo.pick': 'Choose a card to pick',
  'choice.cardTo.pick.from': 'Choose a card to pick from {seat}',
  'choice.cardTo.give': 'Choose a card to give',
  'choice.cardTo.give.from': 'Choose a card to give from {seat}',
  'choice.confirm.take': 'Take',
  'choice.confirm.discard': 'Discard',
  'choice.confirm.give': 'Give',
  'choice.confirm.choose': 'Choose',
  'choice.give': 'Choose who gets the cards',
  'choice.aSeat': 'a seat',
  'choice.pick.seat': 'Choose a seat',
  'choice.pick.suit': 'Name a suit',
  'choice.pick.one': 'Choose one',
  'choice.discardOrDraw': 'Discard a hand card, Or let {user} draw 1 card',
  'choice.letDraw': 'Let {user} Draw',
  'choice.option.use': 'Use',
  'choice.option.decline': "Don't",
  'choice.option.handCard': 'Hand Card {n}',
  'choice.option.hand.one': "{seat}'s Hand ({count} Card)",
  'choice.option.hand.other': "{seat}'s Hand ({count} Cards)",
} satisfies Record<string, string>;
```

(Keep the file's header comment above it.) In `projects/app/src/app/i18n/vi.ts`, replace the object with:

```ts
export const vi: Messages = {
  'nav.language': 'Ngôn ngữ',
  'card.named': '{name} ({face})',
  'choice.claim': '{claimer} tuyên bố có {card}. Tin hay nghi ngờ?',
  'choice.cardTo.take': 'Chọn một lá bài để lấy',
  'choice.cardTo.take.from': 'Chọn một lá bài để lấy từ {seat}',
  'choice.cardTo.discard': 'Chọn một lá bài để bỏ',
  'choice.cardTo.discard.from': 'Chọn một lá bài để bỏ từ {seat}',
  'choice.cardTo.use': 'Chọn một lá bài để dùng',
  'choice.cardTo.use.from': 'Chọn một lá bài của {seat} để dùng',
  'choice.cardTo.pick': 'Chọn một lá bài',
  'choice.cardTo.pick.from': 'Chọn một lá bài của {seat}',
  'choice.cardTo.give': 'Chọn một lá bài để đưa',
  'choice.cardTo.give.from': 'Chọn một lá bài của {seat} để đưa',
  'choice.confirm.take': 'Lấy',
  'choice.confirm.discard': 'Bỏ',
  'choice.confirm.give': 'Đưa',
  'choice.confirm.choose': 'Chọn',
  'choice.give': 'Chọn người nhận các lá bài',
  'choice.aSeat': 'một người chơi',
  'choice.pick.seat': 'Chọn một người chơi',
  'choice.pick.suit': 'Gọi tên một chất',
  'choice.pick.one': 'Chọn một',
  'choice.discardOrDraw': 'Bỏ một lá bài trên tay, hoặc để {user} rút 1 lá bài',
  'choice.letDraw': 'Để {user} rút bài',
  'choice.option.use': 'Dùng',
  'choice.option.decline': 'Không',
  'choice.option.handCard': 'Lá bài trên tay {n}',
  'choice.option.hand.one': 'Bài trên tay của {seat} ({count} lá)',
  'choice.option.hand.other': 'Bài trên tay của {seat} ({count} lá)',
};
```

- [ ] **Step 4: Rewrite `choice-description.ts` to build through `tr`**

Replace the whole of `projects/app/src/app/game-board/choice-description.ts` with:

```ts
import { Action, ChoiceOption, GameState, PendingChoice, Player, Seat } from 'engine';
import { abilityName, cardDisplayData, choicePromptText, seatPickText } from 'content';
import { englishTranslator, Translator } from '../i18n/translator';
import { cardFaceLabel, cardIdDisplayName, forceOf, seatName, suitLabel } from '../labels';
import type { ChoiceDialogOption } from './choice-dialog';

export interface ChoiceDescription {
  // The Tool's name, e.g. "Steal".
  title: string;
  // What to do, e.g. "Choose a card to take from Seat 1".
  prompt: string;
  // The primary button: "Take", "Discard", "Give" or "Choose".
  confirmLabel: string;
  // The label of a "decline" option, when the choice has one (Gender Swords: "Let Seat 1 Draw").
  declineLabel?: string;
}

const cardName = (definitionId: string) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);

// "Choose a card to take from Seat 1", or without "from ..." when no seat is named.
const chooseCardTo = (tr: Translator, verb: PendingChoice['verb'], from: string | null): string =>
  from === null ? tr(`choice.cardTo.${verb}` as const) : tr(`choice.cardTo.${verb}.from` as const, { seat: from });

// What the Choice window says, read off the pending choice. Null unless the
// viewer is the one choosing.
export function describeChoice(state: GameState, viewerSeatId: string, tr: Translator = englishTranslator): ChoiceDescription | null {
  const choice = state.pendingChoice;
  if (!choice || choice.seatId !== viewerSeatId) return null;
  // A claim to believe or doubt (Bewilder).
  if (choice.reason.kind === 'ability' && choice.reason.cardId && choice.verb === 'pick') {
    const claimer = seatName(state.players, choice.reason.owner.seatId);
    return { title: abilityName(choice.reason.abilityId), prompt: tr('choice.claim', { claimer, card: cardName(choice.reason.cardId) }), confirmLabel: tr('choice.confirm.choose') };
  }
  // A skill's take from, or discard of, another seat's card (Feedback, Sudden Attack).
  if (choice.reason.kind === 'ability' && (choice.verb === 'take' || choice.verb === 'discard')) {
    const from = choice.reason.targetSeatId ? seatName(state.players, choice.reason.targetSeatId) : null;
    const take = choice.verb === 'take';
    return { title: abilityName(choice.reason.abilityId), prompt: chooseCardTo(tr, choice.verb, from), confirmLabel: tr(take ? 'choice.confirm.take' : 'choice.confirm.discard') };
  }
  // A skill's pick (a seat, a suit, one of several labels) or who gets given cards.
  if (choice.reason.kind === 'ability' && (choice.verb === 'pick' || choice.verb === 'give')) {
    const title = abilityName(choice.reason.abilityId);
    if (choice.verb === 'give') return { title, prompt: tr('choice.give'), confirmLabel: tr('choice.confirm.give') };
    const fixed = choicePromptText(choice.reason.abilityId);
    // A seat pick keeps the seat wording (Exile, Alliance); a mixed or label pick uses its own prompt.
    const onlySeats = choice.options.every((o) => o.shows.kind === 'seat');
    if (fixed && !(onlySeats && seatPickText(choice.reason.abilityId))) return { title, prompt: fixed, confirmLabel: tr('choice.confirm.choose') };
    const kinds = new Set(choice.options.map((o) => o.shows.kind));
    const only = kinds.size === 1 ? [...kinds][0] : null;
    // A skill's own words for its seat pick (Rouse the Tiger), its target named.
    const own = seatPickText(choice.reason.abilityId);
    const target = choice.reason.targetSeatId;
    const seatPrompt = own ? own.replace('{target}', target ? seatName(state.players, target) : tr('choice.aSeat')) : tr('choice.pick.seat');
    const prompt = only === 'seat' ? seatPrompt : only === 'suit' ? tr('choice.pick.suit') : tr('choice.pick.one');
    return { title, prompt, confirmLabel: tr('choice.confirm.choose') };
  }
  if (choice.reason.kind !== 'choice') return null;
  const { card, targetSeatId } = choice.reason;
  // Choosing among your own cards (Gender Swords): discard one, or let the user draw.
  if (targetSeatId === viewerSeatId && choice.options.some((o) => o.shows.kind === 'decline')) {
    const user = seatName(state.players, choice.reason.userSeatId);
    return { title: cardName(card.as), prompt: tr('choice.discardOrDraw', { user }), confirmLabel: tr('choice.confirm.discard'), declineLabel: tr('choice.letDraw', { user }) };
  }
  const from = targetSeatId ? seatName(state.players, targetSeatId) : null;
  return {
    title: cardName(card.as),
    prompt: chooseCardTo(tr, choice.verb, from),
    confirmLabel: tr(choice.verb === 'take' ? 'choice.confirm.take' : 'choice.confirm.discard'),
  };
}

// An option's label: a hand by its owner and size, a card by its name and face.
export function choiceOptionLabel(shows: ChoiceOption['shows'], players: readonly Player[], declineLabel?: string, tr: Translator = englishTranslator): string {
  if (shows.kind === 'seat') return seatName(players, shows.seatId);
  if (shows.kind === 'suit') return suitLabel(shows.suit);
  if (shows.kind === 'label') return shows.text;
  if (shows.kind === 'use') return tr('choice.option.use');
  if (shows.kind === 'decline') return declineLabel ?? tr('choice.option.decline');
  if (shows.kind === 'hidden-hand') {
    return tr(shows.count === 1 ? 'choice.option.hand.one' : 'choice.option.hand.other', { seat: seatName(players, shows.seatId), count: shows.count });
  }
  return tr('card.named', { name: cardName(shows.card.definitionId), face: cardFaceLabel(shows.card) });
}

// What the Choice window offers: the engine's options it can legally pick. A
// hand shows as one face-down card per card in it; every one of them picks the
// hand, and the engine takes a card from it at random.
export function choiceDialogOptions(
  options: readonly ChoiceOption[],
  legal: readonly Action[],
  players: readonly Player[],
  declineLabel?: string,
  seats: readonly Seat[] = [],
  tr: Translator = englishTranslator
): ChoiceDialogOption[] {
  return options.flatMap((option): ChoiceDialogOption[] => {
    const action = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === option.id);
    if (!action) return [];
    if (option.shows.kind === 'hidden-hand') {
      return Array.from({ length: option.shows.count }, (_, i) => ({ id: `${option.id}#${i + 1}`, action, faceDown: true as const, label: tr('choice.option.handCard', { n: i + 1 }) }));
    }
    if (option.shows.kind === 'card') {
      return [{ id: option.id, action, card: option.shows.card, label: choiceOptionLabel(option.shows, players, undefined, tr) }];
    }
    const label = choiceOptionLabel(option.shows, players, declineLabel, tr);
    if (option.shows.kind === 'seat') {
      const seatId = option.shows.seatId;
      return [{ id: option.id, action, label, force: forceOf(seats.find((s) => s.id === seatId)?.kingdom) }];
    }
    if (option.shows.kind === 'suit') return [{ id: option.id, action, label, suit: option.shows.suit }];
    return [{ id: option.id, action, label }];
  });
}
```

- [ ] **Step 5: Run the new spec, the existing spec and the catalog parity**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/choice-description.vi.spec.ts projects/app/src/app/game-board/choice-description.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with `choice-description.spec.ts` unedited. If an existing English assertion fails, the template text differs from the old string by a character: fix `en.ts`, never the existing spec.

- [ ] **Step 6: Typecheck the app**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit`
Expected: no errors. (`confirmLabel` is now `string`; no component narrowed on its literal type, since they only print it.)

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/game-board/choice-description.ts projects/app/src/app/game-board/choice-description.vi.spec.ts
git commit -m "feat(app): choice descriptions build through the translator

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The ask, selection and arrange descriptions through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/game-board/ability-description.ts`
- Test: `projects/app/src/app/game-board/ability-description.vi.spec.ts` (new); the existing `ability-description.spec.ts` must pass unedited

**Interfaces:**
- Consumes: Task 1's translator; Task 2's `card.named` key.
- Produces: `describeAsk(state, viewerSeatId, legal, tr?)`, `describeSelection(state, viewerSeatId, legal, tr?)`, `describeArrangement(state, viewerSeatId, legal, tr?)`. Catalog keys: `ask.use`, `ask.use.on`, `ask.reveal`, `ask.reveal.on`, `ask.theTarget`, `ask.button.use`, `ask.button.revealAndUse`, `selection.upTo`, `selection.discard.{one,other}`, `selection.useAs.{one,other}`, `selection.anyCard`, `selection.play`, `selection.play.at`, `selection.targets.{one,other}`, `selection.give.{one,other}`, `selection.replaceJudgment`, `selection.skill.{seat,card}.{one,other}`, `selection.confirm.{discard,use,cardStep,give,replace,skillStep}`, `selection.cancel`, `selection.title`, `selection.cardFallback`, `arrange.title`, `arrange.prompt`.

- [ ] **Step 1: Write the failing Vietnamese spec**

`projects/app/src/app/game-board/ability-description.vi.spec.ts`:

```ts
import { Action, CardInstance, GameState, PendingChoice, PendingSelection } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { describeArrangement, describeAsk, describeSelection } from './ability-description';

const tr = makeTranslator(vi);
const axe: CardInstance = { instanceId: 'ax', definitionId: 'axe', suit: 'diamond', rank: 5 };
const peach: CardInstance = { instanceId: 'p1', definitionId: 'peach', suit: 'heart', rank: 3 };
const sha: CardInstance = { instanceId: 's2', definitionId: 'sha', suit: 'spade', rank: 7 };
const owner = { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'ax' };

function state(o: { pendingChoice?: PendingChoice; pendingSelection?: PendingSelection } = {}): GameState {
  return {
    seats: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play',
    players: [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Seat 1' },
    ],
    zones: [
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: [peach, sha] },
      { id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [axe] },
    ],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
    ...o,
  };
}
const ask = (abilityId: string, targetSeatId?: string): PendingChoice => ({
  id: 'ask', seatId: 'seat-0', verb: 'use',
  reason: { kind: 'ability', owner, abilityId, ...(targetSeatId ? { targetSeatId } : {}) },
  options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
});
const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));

describe('describeAsk in Vietnamese', () => {
  it('names the ability and its target', () => {
    expect(describeAsk(state({ pendingChoice: ask('axe', 'seat-1') }), 'seat-0', asked, tr)).toMatchObject({
      prompt: 'Dùng Axe lên Seat 1?',
      hint: 'Discard 2 cards to make your Sha hit Seat 1',
      useLabel: 'Dùng',
    });
  });

  it('asks without a target, and a hint falls back to "the target"', () => {
    const description = describeAsk(state({ pendingChoice: ask('axe') }), 'seat-0', asked, tr);
    expect(description).toMatchObject({ prompt: 'Dùng Axe?', hint: 'Discard 2 cards to make your Sha hit mục tiêu' });
    expect(describeAsk(state({ pendingChoice: ask('axe') }), 'seat-0', asked)).toMatchObject({ prompt: 'Use Axe?', hint: 'Discard 2 cards to make your Sha hit the target' });
  });

  it('a hidden General’s skill asks to reveal it', () => {
    const general = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'fighting-saint' };
    const revealAsk: PendingChoice = {
      id: 'ask', seatId: 'seat-0', verb: 'use',
      reason: { kind: 'ability', owner: general, abilityId: 'fighting-saint' },
      options: [{ id: 'use', shows: { kind: 'use', reveals: 'main' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
    };
    const seated = state({ pendingChoice: revealAsk });
    seated.seats = [{
      id: 'seat-0', index: 0, kingdom: 'Shu', combinedHp: 4, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: 'guan-yu', revealed: false }, deputy: { generalDefinitionId: 'zhang-fei', revealed: true } },
      hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' },
    }];
    expect(describeAsk(seated, 'seat-0', asked, tr)).toMatchObject({ prompt: 'Lật Guan Yu để dùng Fighting Saint?', useLabel: 'Lật và dùng' });
  });
});

describe('describeSelection in Vietnamese', () => {
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const selection = (over: Partial<PendingSelection>): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner, abilityId: 'axe' }, of: 'cards', eligibleIds: ['p1', 's2'], min: 2, max: 2, then: { kind: 'discard' }, ...over,
  });
  const describe2 = (sel: PendingSelection, translator = tr) => describeSelection(state({ pendingSelection: sel }), 'seat-0', [template, cancel], translator);

  it('discard: an exact count, an "up to" count, and one card', () => {
    expect(describe2(selection({}))).toMatchObject({ title: 'Axe', prompt: 'Chọn 2 lá bài để bỏ', confirmLabel: 'Bỏ bài', cancelLabel: 'Hủy' });
    expect(describe2(selection({ min: 1, max: 3 }))).toMatchObject({ prompt: 'Chọn tối đa 3 lá bài để bỏ' });
    expect(describe2(selection({ min: 1, max: 1 }))).toMatchObject({ prompt: 'Chọn 1 lá bài để bỏ' });
    expect(describe2(selection({ min: 1, max: 3 }), undefined)).toMatchObject({ prompt: 'Choose up to 3 cards to discard', confirmLabel: 'Discard', cancelLabel: 'Cancel' });
    expect(describe2(selection({ min: 1, max: 1 }), undefined)).toMatchObject({ prompt: 'Choose 1 card to discard' });
  });

  it('use as a Tool, and play a card at a seat', () => {
    expect(describe2(selection({ then: { kind: 'use-card', as: 'sha', targets: [], counted: true } }))).toMatchObject({ prompt: 'Chọn 2 lá bài trên tay để dùng như Sha', confirmLabel: 'Dùng' });
    expect(describe2(selection({ min: 1, max: 1, eligibleIds: ['s2'], then: { kind: 'use-card', targets: [{ kind: 'seat', seatId: 'seat-1' }], counted: false, free: true } }))).toMatchObject({ prompt: 'Chọn Sha để đánh vào Seat 1' });
    expect(describe2(selection({ min: 1, max: 1, eligibleIds: ['s2'], then: { kind: 'use-card', targets: [{ kind: 'seat', seatId: 'seat-1' }], counted: false, free: true } }), undefined)).toMatchObject({ prompt: 'Choose a Sha to play at Seat 1' });
  });

  it('give, replace the judgment, and more targets', () => {
    expect(describe2(selection({ min: 1, max: 1, then: { kind: 'give', toSeatIds: ['seat-1'] } }))).toMatchObject({ prompt: 'Chọn một lá bài để đưa', confirmLabel: 'Đưa' });
    expect(describe2(selection({ then: { kind: 'give', toSeatIds: ['seat-1'] } }), undefined)).toMatchObject({ prompt: 'Choose cards to give' });
  });

  it('labels each card of the selection by name and face', () => {
    expect(describe2(selection({})).items).toEqual([{ id: 'p1', card: peach, label: 'Peach (3 ♥)' }, { id: 's2', card: sha, label: 'Sha (7 ♠)' }]);
  });
});

describe('describeArrangement in Vietnamese', () => {
  const owner2 = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'astrology' };
  const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
  it('says where each card goes', () => {
    const s = state();
    s.zones = [...s.zones, { id: 'drawPile', kind: 'drawPile', cards: [sha, peach] }];
    s.pendingArrangement = { id: 'arr', seatId: 'seat-0', reason: { kind: 'ability', owner: owner2, abilityId: 'astrology' }, cardInstanceIds: ['s2', 'p1'] };
    expect(describeArrangement(s, 'seat-0', [template], tr)).toMatchObject({
      title: 'Astrology',
      prompt: 'Đặt mỗi lá bài lên trên chồng bài rút hoặc xuống dưới cùng. Từ trái sang phải là thứ tự đặt.',
    });
  });
});
```

Note: `describe2(sel, undefined)` passes `undefined` so the default English translator applies (a default parameter takes over for `undefined`).

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/ability-description.vi.spec.ts`
Expected: FAIL (type errors: the describe functions take 3 arguments, not 4). If a fixture does not type-check (for example `PendingSelection.then` shapes), copy the shape from `ability-description.spec.ts`.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, add these entries to the object, after the `choice.option.hand.other` line:

```ts
  'ask.use': 'Use {ability}?',
  'ask.use.on': 'Use {ability} on {target}?',
  'ask.reveal': 'Reveal {general} to use {ability}?',
  'ask.reveal.on': 'Reveal {general} to use {ability} on {target}?',
  'ask.theTarget': 'the target',
  'ask.button.use': 'Use',
  'ask.button.revealAndUse': 'Reveal and Use',
  'selection.upTo': 'up to {max}',
  'selection.discard.one': 'Choose {count} card to discard',
  'selection.discard.other': 'Choose {count} cards to discard',
  'selection.useAs.one': 'Choose a card to use as {card}',
  'selection.useAs.other': 'Choose {count} hand cards to use as {card}',
  'selection.anyCard': 'card',
  'selection.play': 'Choose a {what} to play',
  'selection.play.at': 'Choose a {what} to play at {seat}',
  'selection.targets.one': 'Choose {count} more target',
  'selection.targets.other': 'Choose {count} more targets',
  'selection.give.one': 'Choose a card to give',
  'selection.give.other': 'Choose cards to give',
  'selection.replaceJudgment': 'Choose a hand card to replace the judgment',
  'selection.skill.seat.one': 'Choose {count} seat',
  'selection.skill.seat.other': 'Choose {count} seats',
  'selection.skill.card.one': 'Choose {count} card',
  'selection.skill.card.other': 'Choose {count} cards',
  'selection.confirm.discard': 'Discard',
  'selection.confirm.use': 'Use',
  'selection.confirm.cardStep': 'Add Targets',
  'selection.confirm.give': 'Give',
  'selection.confirm.replace': 'Replace',
  'selection.confirm.skillStep': 'Confirm',
  'selection.cancel': 'Cancel',
  'selection.title': 'Choose',
  'selection.cardFallback': 'Card',
  'arrange.title': 'Arrange',
  'arrange.prompt': 'Put each card on top of the draw pile or at the bottom. Left to right is the order they go in.',
```

and to `vi.ts`, after its `choice.option.hand.other` line:

```ts
  'ask.use': 'Dùng {ability}?',
  'ask.use.on': 'Dùng {ability} lên {target}?',
  'ask.reveal': 'Lật {general} để dùng {ability}?',
  'ask.reveal.on': 'Lật {general} để dùng {ability} lên {target}?',
  'ask.theTarget': 'mục tiêu',
  'ask.button.use': 'Dùng',
  'ask.button.revealAndUse': 'Lật và dùng',
  'selection.upTo': 'tối đa {max}',
  'selection.discard.one': 'Chọn {count} lá bài để bỏ',
  'selection.discard.other': 'Chọn {count} lá bài để bỏ',
  'selection.useAs.one': 'Chọn một lá bài để dùng như {card}',
  'selection.useAs.other': 'Chọn {count} lá bài trên tay để dùng như {card}',
  'selection.anyCard': 'lá bài',
  'selection.play': 'Chọn {what} để đánh',
  'selection.play.at': 'Chọn {what} để đánh vào {seat}',
  'selection.targets.one': 'Chọn thêm {count} mục tiêu',
  'selection.targets.other': 'Chọn thêm {count} mục tiêu',
  'selection.give.one': 'Chọn một lá bài để đưa',
  'selection.give.other': 'Chọn các lá bài để đưa',
  'selection.replaceJudgment': 'Chọn một lá bài trên tay để thay lá phán xét',
  'selection.skill.seat.one': 'Chọn {count} người chơi',
  'selection.skill.seat.other': 'Chọn {count} người chơi',
  'selection.skill.card.one': 'Chọn {count} lá bài',
  'selection.skill.card.other': 'Chọn {count} lá bài',
  'selection.confirm.discard': 'Bỏ bài',
  'selection.confirm.use': 'Dùng',
  'selection.confirm.cardStep': 'Thêm mục tiêu',
  'selection.confirm.give': 'Đưa',
  'selection.confirm.replace': 'Thay thế',
  'selection.confirm.skillStep': 'Xác nhận',
  'selection.cancel': 'Hủy',
  'selection.title': 'Chọn',
  'selection.cardFallback': 'Lá bài',
  'arrange.title': 'Sắp xếp',
  'arrange.prompt': 'Đặt mỗi lá bài lên trên chồng bài rút hoặc xuống dưới cùng. Từ trái sang phải là thứ tự đặt.',
```

- [ ] **Step 4: Rewrite `ability-description.ts` to build through `tr`**

Make these edits to `projects/app/src/app/game-board/ability-description.ts`.

Imports: add `import { englishTranslator, Translator } from '../i18n/translator';` after the `labels` import.

`describeAsk`: change the signature to `(state: GameState, viewerSeatId: string, legal: readonly Action[], tr: Translator = englishTranslator)`, delete the line `const on = target ? \` on ${target}\` : '';`, and replace the returned object's `prompt`, `hint` and `useLabel` lines so the object reads:

```ts
  return {
    title: name,
    prompt: reveals && generalName
      ? target ? tr('ask.reveal.on', { general: generalName, ability: name, target }) : tr('ask.reveal', { general: generalName, ability: name })
      : target ? tr('ask.use.on', { ability: name, target }) : tr('ask.use', { ability: name }),
    hint: hint ? hint.replace('{target}', target ?? tr('ask.theTarget')) : null,
    card: owner.kind === 'equipment' ? (findCard(state, owner.cardInstanceId) ?? null) : null,
    generalId,
    useLabel: reveals ? tr('ask.button.revealAndUse') : tr('ask.button.use'),
    use,
    decline,
  };
```

`selectionPrompt`: replace the whole function with:

```ts
function selectionPrompt(state: GameState, selection: PendingSelection, items: SelectionItem[], tr: Translator): string {
  const one = selection.max === 1;
  const count = selection.min === selection.max ? `${selection.min}` : tr('selection.upTo', { max: selection.max });
  const then = selection.then;
  switch (then.kind) {
    case 'discard':
      return tr(one ? 'selection.discard.one' : 'selection.discard.other', { count });
    case 'use-card': {
      if (then.as) return one ? tr('selection.useAs.one', { card: cardName(then.as) }) : tr('selection.useAs.other', { count, card: cardName(then.as) });
      const kinds = new Set(items.map((i) => i.card?.definitionId));
      const [only] = [...kinds];
      const what = kinds.size === 1 && only ? cardName(only) : tr('selection.anyCard');
      const target = then.targets[0];
      return target ? tr('selection.play.at', { what, seat: seatName(state.players, target.seatId) }) : tr('selection.play', { what });
    }
    case 'card-step':
      return tr(one ? 'selection.targets.one' : 'selection.targets.other', { count });
    case 'give':
      return tr(one ? 'selection.give.one' : 'selection.give.other');
    case 'replace-judgment':
      return tr('selection.replaceJudgment');
    case 'skill-step': {
      const what = selection.of === 'seats' ? 'seat' : 'card';
      return tr(`selection.skill.${what}.${one ? 'one' : 'other'}` as const, { count });
    }
  }
}
```

Replace `CONFIRM_LABELS` with a map of keys:

```ts
const CONFIRM_KEYS = {
  discard: 'selection.confirm.discard',
  'use-card': 'selection.confirm.use',
  'card-step': 'selection.confirm.cardStep',
  give: 'selection.confirm.give',
  'replace-judgment': 'selection.confirm.replace',
  'skill-step': 'selection.confirm.skillStep',
} as const satisfies Record<PendingSelection['then']['kind'], MessageKey>;
```

(add `import type { MessageKey } from '../i18n/messages';` to the imports.)

`describeSelection`: change the signature to end with `tr: Translator = englishTranslator`, then change these lines inside it:
- the unseen-card fallback: `{ id, label: tr('selection.cardFallback') }`
- the card label: `label: tr('card.named', { name: cardName(card.definitionId), face: cardFaceLabel(card) })`
- `title: reason.kind === 'ability' ? abilityName(reason.abilityId) : reason.kind === 'choice' ? cardName(reason.card.as) : tr('selection.title')`
- `prompt: text?.prompt ?? selectionPrompt(state, selection, items, tr)`
- `confirmLabel: text?.confirm ?? tr(CONFIRM_KEYS[selection.then.kind])`
- `cancelLabel: text?.cancel ?? tr('selection.cancel')`

`describeArrangement`: change the signature to end with `tr: Translator = englishTranslator`, and use `title: arrangement.reason.kind === 'ability' ? abilityName(arrangement.reason.abilityId) : tr('arrange.title')` and `prompt: tr('arrange.prompt')`.

- [ ] **Step 5: Run the new spec, the existing spec and the parity test**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/ability-description.vi.spec.ts projects/app/src/app/game-board/ability-description.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with `ability-description.spec.ts` unedited. A mismatch in an existing English assertion means a template differs from the old string by a character: fix the catalog, not the existing spec.

- [ ] **Step 6: Typecheck and run the whole app project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx jest --selectProjects app`
Expected: no type errors; every suite passes, with no existing spec edited.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/game-board/ability-description.ts projects/app/src/app/game-board/ability-description.vi.spec.ts
git commit -m "feat(app): ask, selection and arrange descriptions build through the translator

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (the spec's "Translator-based builders" section, step 2a only):
- `Translator` type, English default, passed as a parameter: Task 1.
- `I18n` provides a live translator that follows the language signal: Task 1.
- Builders build through it; whole-sentence templates; plural handled per key: Tasks 2 and 3.
- Existing specs unedited, English byte-identical: asserted in Task 2 Step 5 and Task 3 Steps 5 and 6.
- Vietnamese covered by new specs: Tasks 2 and 3.
- Not in this plan, by design: `labels.ts` (waits for the other workstream's uncommitted edits to land), the Action History (step 2b), the response description (step 2c), `display.ts` tables (step 2d), and wiring components to pass the live translator (phase 3). Until phase 3 nothing passes `tr`, so the running app is unchanged.

**Placeholder scan:** none. Every code step shows the code. Edits to `ability-description.ts` are shown as exact replacements.

**Type consistency:** `Translator`, `makeTranslator`, `englishTranslator` are defined in Task 1 and used by name in Tasks 2 and 3. `choiceDialogOptions` places `tr` after `seats`, as the spec's call in the Vietnamese test does. `CONFIRM_KEYS` is checked against `PendingSelection['then']['kind']` by `satisfies Record<..., MessageKey>`, so a missing confirm key fails the compile.

**Review Focus:** each line has a test: other verbs (Task 2 spec "a verb other than take or discard"), `{target}` fallback (Task 3 spec "asks without a target"), count boundaries (Task 3 spec "discard: an exact count..."), hand of 1 versus 2 (Task 2 spec "labels a face-down hand"), hint without a placeholder (covered by the existing English spec for hints and by the unchanged `hint.replace` call).
