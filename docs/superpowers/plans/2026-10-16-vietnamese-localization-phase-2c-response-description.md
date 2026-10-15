# Vietnamese Localization, Phase 2c (Response Description) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Response window's text (what started it, the latest answer, the prompt, what No Response costs) and the table centre's "Waiting on …" line through the translator, with English output byte-identical and Vietnamese available.

**Architecture:** `describeResponse(state, viewerSeatId, preview?, tr?)` and `waitingLine(state, tr?)` gain an optional trailing translator that defaults to English. Every sentence becomes a whole-sentence `response.*` template. Fragments that English glues (the damage detail "(2 damage from Seat 1)", the "needs 3 Peaches" suffix, a list of targets) become small templates passed in as params; the card names a sentence mentions (Peach, Wine, Sha) are passed in from the card lookup. The helpers from `labels.ts` are called with `tr` (step 2e), so a nameless seat and a Main General target are already localized.

**Tech Stack:** Angular 22, Jest (`app` project), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` ("Translator-based builders", step 2c)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-2cde` on branch `feat/vietnamese-phase-2cde`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. The existing `response-description.spec.ts` must pass WITHOUT edits.
- A new catalog key needs an English entry and a Vietnamese entry with the same `{placeholders}` in the same commit (the `Messages` type and `catalogs.spec.ts` enforce it). Vietnamese follows the spec's glossary and is sentence case; Tướng and Sinh lực keep their capitals inside sentences; "you" is "bạn".
- Change only: `response-description.ts`, the two catalogs, and the new spec. Do NOT touch `labels.ts`, `display.ts`, any component, or `response-dialog.ts` (components are phase 3).
- The control flow of `describeResponse` is unchanged: the same branches in the same order with the same guards.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the project: `npx jest --selectProjects app`.

## Review Focus

- A seat that is the viewer reads "you"/"bạn" as a target and "You"/"Bạn" as a subject, in every sentence that distinguishes them (dying, judging, losing HP, discarding, Wuxie targets, "at you").
- The "(needs N Peaches)" suffix appears only when more than one Peach is needed, and "Peaches" is built as `{peach}es` in English.
- Damage text: with and without a source, with a non-normal nature word, for a seat target and for a Main General target (which is never "You").
- Move text: a card that is not found reads "A card"; a destination with no owner reads "The effect goes ahead".
- `waitingLine` returns null with nothing pending, and covers every reason (selection, ability ask, choice, dying, Wuxie, counter-Wuxie, card effect, Upheaval, Instigate, default).

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/en.ts`, `vi.ts` | About 60 new `response.*` keys. |
| `app/src/app/game-board/response-description.ts` | Builds through `tr`. |
| `app/src/app/game-board/response-description.vi.spec.ts` | New: every sentence in English and Vietnamese. |

---

### Task 1: The Response window through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/game-board/response-description.ts`
- Test: `projects/app/src/app/game-board/response-description.vi.spec.ts` (new); the existing `response-description.spec.ts` must pass unedited

**Interfaces:**
- Consumes: `Translator`, `englishTranslator`, `makeTranslator`, and the `tr`-aware `seatName`, `targetLabel`, `cardIdDisplayName` from `labels.ts` (step 2e).
- Produces: `describeResponse(state, viewerSeatId, preview?, tr?)`, `waitingLine(state, tr?)`; unchanged `ResponseDescription`, `startsOnNoResponse`.

- [ ] **Step 1: Write the failing spec**

`projects/app/src/app/game-board/response-description.vi.spec.ts`:

```ts
import { CardInstance, Effect, EngineEvent, GameState, PendingResponse, usedCardOf } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { describeResponse, waitingLine } from './response-description';

const tr = makeTranslator(vi);
const both = <T>(build: (translator?: typeof tr) => T): { en: T; vi: T } => ({ en: build(), vi: build(tr) });

const duel: CardInstance = { instanceId: 'duel-1', definitionId: 'duel', suit: 'spade', rank: 1 };
const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });
const used = (card: CardInstance) => ({ as: card.definitionId, colour: 'black' as const, suit: card.suit, rank: card.rank, physical: [card] });
const noop = { kind: 'SkipNextEffect' as const };

function state(log: EngineEvent[], pendingResponse: PendingResponse | null): GameState {
  return {
    seats: [], zones: [], log, pendingResponse, result: null, generalSelection: null, phase: 'Play',
    players: [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Seat 1' },
      { id: 'p2', seatId: 'seat-2', kind: 'bot', name: 'Seat 2' },
    ],
    turn: { turnNumber: 1, ownerSeatId: 'seat-1', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
  };
}
const damageWindow = (id: string, responder: string, from: string, cause: string, sourceCard?: CardInstance): PendingResponse => ({
  id, respondingSeatId: responder, allowedActionKinds: ['RespondAction', 'PassAction'],
  context: { effect: { kind: 'DamageEffect', damage: { source: seat(from), target: seat(responder), amount: 1, nature: 'normal', cause: { cardInstanceId: cause } } } },
  ...(sourceCard ? { sourceCard: { instanceId: sourceCard.instanceId, definitionId: sourceCard.definitionId } } : {}),
});
const wuxieWindow = (responder: string, reason: PendingResponse['reason']): PendingResponse => ({
  id: 'x1', respondingSeatId: responder, allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['wuxie'], reason, context: { effect: noop },
});

describe('what started the window, in English and Vietnamese', () => {
  const playLog = (targets: ReturnType<typeof seat>[]): EngineEvent[] => [{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets }];

  it('a Sha played at the viewer', () => {
    const s = state(playLog([seat('seat-0')]), damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
    expect(both((t) => describeResponse(s, 'seat-0', undefined, t))).toEqual({
      en: { source: 'Seat 1 played Sha against Hing', latest: null, prompt: 'Your turn to respond to Sha', outcome: 'You lose 1 HP (1 damage from Seat 1)', outcomeForce: 'none' },
      vi: { source: 'Seat 1 ra Sha nhắm vào Hing', latest: null, prompt: 'Đến lượt bạn đáp lại Sha', outcome: 'Bạn mất 1 Sinh lực (1 sát thương từ Seat 1)', outcomeForce: 'none' },
    });
  });

  it('a card with no target, and a window whose card was never seen played', () => {
    const none = state(playLog([]), damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
    expect(both((t) => describeResponse(none, 'seat-0', undefined, t)!.source)).toEqual({ en: 'Seat 1 played Sha', vi: 'Seat 1 ra Sha' });
    const unseen = state([], damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
    expect(both((t) => { const d = describeResponse(unseen, 'seat-0', undefined, t)!; return [d.source, d.prompt]; })).toEqual({
      en: ['A response is needed', 'Your turn to respond'],
      vi: ['Cần một phản hồi', 'Đến lượt bạn đáp lại'],
    });
  });

  it('a Duel’s latest answer', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(duel), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'duel-1' } },
    ];
    const s = state(log, damageWindow('w2', 'seat-0', 'seat-1', 'duel-1', duel));
    expect(both((t) => describeResponse(s, 'seat-0', undefined, t)!.latest)).toEqual({ en: 'Seat 1 answered with Sha', vi: 'Seat 1 đáp lại bằng Sha' });
  });

  it('an armour’s judgment as the latest, for the viewer and for another seat', () => {
    const et = usedCardOf({ instanceId: 'et', definitionId: 'eight-trigrams', suit: 'spade', rank: 2 });
    const judged: CardInstance = { instanceId: 'j', definitionId: 'peach', suit: 'club', rank: 3 };
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [seat('seat-0')] },
      { kind: 'JudgmentEvent', seatId: 'seat-0', reader: { kind: 'card', card: et }, card: judged },
      { kind: 'CardMovedEvent', cardInstanceId: 'j', fromZoneId: 'processing', toZoneId: 'discardPile', card: judged },
    ];
    const s = state(log, damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
    expect(both((t) => describeResponse(s, 'seat-0', undefined, t)!.latest)).toEqual({ en: 'Your Eight Trigrams judgment: 3 ♣', vi: 'Phán xét Eight Trigrams của bạn: 3 ♣' });
    expect(both((t) => describeResponse(s, 'seat-2', undefined, t)!.latest)).toEqual({ en: "Hing's Eight Trigrams judgment: 3 ♣", vi: 'Phán xét Eight Trigrams của Hing: 3 ♣' });
  });

  it('is null when nothing is pending', () => {
    expect(describeResponse(state([], null), 'seat-0', undefined, tr)).toBeNull();
  });
});

describe('what No Response costs, in English and Vietnamese', () => {
  const base = state([{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [seat('seat-0')] }], damageWindow('w1', 'seat-0', 'seat-1', 'sha-1'));
  const withZones: GameState = {
    ...base,
    zones: [
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: [sha] },
      { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
    ],
  };
  const outcome = (viewer: string, effect: Effect) => both((t) => describeResponse(withZones, viewer, () => effect, t)!.outcome);

  it('damage to another seat, from nowhere, with a nature word', () => {
    const hit = { kind: 'DamageEffect', damage: { source: null, target: seat('seat-1'), amount: 3, nature: 'thunder' } } as Effect;
    expect(outcome('seat-0', hit)).toEqual({ en: 'Seat 1 loses 3 HP (3 thunder damage)', vi: 'Seat 1 mất 3 Sinh lực (3 sát thương thunder)' });
  });

  it('damage to a Main General is never "You"', () => {
    const hit = { kind: 'DamageEffect', damage: { source: seat('seat-2'), target: { kind: 'general', seatId: 'seat-0', generalSlot: 'main' }, amount: 1, nature: 'normal' } } as Effect;
    expect(outcome('seat-0', hit)).toEqual({
      en: "Hing's Main General loses 1 HP (1 damage from Seat 2)",
      vi: 'Tướng chính của Hing mất 1 Sinh lực (1 sát thương từ Seat 2)',
    });
  });

  it('healing and drawing, one card and several', () => {
    expect(outcome('seat-0', { kind: 'HealEffect', target: seat('seat-1'), amount: 2 } as Effect)).toEqual({ en: 'Seat 1 recovers 2 HP', vi: 'Seat 1 hồi 2 Sinh lực' });
    expect(outcome('seat-0', { kind: 'DrawCardsEffect', seatId: 'seat-1', count: 1 } as Effect)).toEqual({ en: 'Seat 1 draws 1 card', vi: 'Seat 1 rút 1 lá bài' });
    expect(outcome('seat-0', { kind: 'DrawCardsEffect', seatId: 'seat-1', count: 2 } as Effect)).toEqual({ en: 'Seat 1 draws 2 cards', vi: 'Seat 1 rút 2 lá bài' });
  });

  it('a card moving to another seat or to the viewer, an unknown card, no owner, another effect', () => {
    expect(outcome('seat-0', { kind: 'MoveCardEffect', cardInstanceId: 'sha-1', toZoneId: 'seat-1:hand' } as Effect)).toEqual({ en: 'Sha goes to Seat 1', vi: 'Sha chuyển cho Seat 1' });
    expect(outcome('seat-0', { kind: 'MoveCardEffect', cardInstanceId: 'sha-1', toZoneId: 'seat-0:hand' } as Effect)).toEqual({ en: 'Sha goes to you', vi: 'Sha chuyển cho bạn' });
    expect(outcome('seat-0', { kind: 'MoveCardEffect', cardInstanceId: 'nobody', toZoneId: 'seat-1:hand' } as Effect)).toEqual({ en: 'A card goes to Seat 1', vi: 'Một lá bài chuyển cho Seat 1' });
    expect(outcome('seat-0', { kind: 'MoveCardEffect', cardInstanceId: 'sha-1', toZoneId: 'discardPile' } as Effect)).toEqual({ en: 'The effect goes ahead', vi: 'Hiệu ứng được thực hiện' });
    expect(outcome('seat-0', noop as Effect)).toEqual({ en: 'The effect goes ahead', vi: 'Hiệu ứng được thực hiện' });
  });
});

describe('the dying round, in English and Vietnamese', () => {
  const dyingWindow = (seatId: string, allowedCardIds = ['peach']): PendingResponse => ({
    id: 'd1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds,
    reason: { kind: 'dying', seatId },
    context: { effect: { kind: 'DyingEffect', seatId, order: [], rescueCardIds: { any: ['peach'], self: ['wine'] } } },
  });
  const seated = (s: GameState, hp: number, hand: CardInstance[] = []): GameState => ({
    ...s,
    seats: ['seat-0', 'seat-1'].map((id, index) => ({
      id, index, kingdom: 'Wei' as const, eliminated: false, combinedHp: hp, maxCombinedHp: 4, generals: null,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    zones: [{ id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: hand }],
  });
  const wine: CardInstance = { instanceId: 'w1', definitionId: 'wine', suit: 'spade', rank: 9 };

  it('another seat is dying', () => {
    expect(both((t) => describeResponse(seated(state([], dyingWindow('seat-1')), 0), 'seat-0', undefined, t))).toEqual({
      en: { source: 'Seat 1 is dying (HP 0)', latest: null, prompt: 'Play a Peach to save Seat 1?', outcome: 'Seat 1 is eliminated', outcomeForce: 'Wei' },
      vi: { source: 'Seat 1 cận kề cái chết (Sinh lực 0)', latest: null, prompt: 'Ra Peach để cứu Seat 1?', outcome: 'Seat 1 bị loại', outcomeForce: 'Wei' },
    });
  });

  it('the viewer is dying and needs three Peaches', () => {
    expect(both((t) => describeResponse(seated(state([], dyingWindow('seat-0')), -2), 'seat-0', undefined, t))).toEqual({
      en: { source: 'You are dying (HP -2)', latest: null, prompt: 'Play a Peach to save yourself? (needs 3 Peaches)', outcome: 'You are eliminated', outcomeForce: 'Wei' },
      vi: { source: 'Bạn cận kề cái chết (Sinh lực -2)', latest: null, prompt: 'Ra Peach để cứu chính bạn? (cần 3 Peach)', outcome: 'Bạn bị loại', outcomeForce: 'Wei' },
    });
  });

  it('one Peach needed prints no suffix, and Wine is offered only when held', () => {
    const holding = seated(state([], dyingWindow('seat-0', ['peach', 'wine'])), 0, [wine]);
    const empty = seated(state([], dyingWindow('seat-0', ['peach', 'wine'])), 0);
    expect(both((t) => describeResponse(holding, 'seat-0', undefined, t)!.prompt)).toEqual({ en: 'Play a Peach or Wine to save yourself?', vi: 'Ra Peach hoặc Wine để cứu chính bạn?' });
    expect(both((t) => describeResponse(empty, 'seat-0', undefined, t)!.prompt)).toEqual({ en: 'Play a Peach to save yourself?', vi: 'Ra Peach để cứu chính bạn?' });
  });
});

describe('Wuxie and Coerce windows, in English and Vietnamese', () => {
  const barbarians: CardInstance = { instanceId: 'barb-1', definitionId: 'barbarians', suit: 'spade', rank: 7 };
  const drawTwo: CardInstance = { instanceId: 'dt-1', definitionId: 'draw-two', suit: 'heart', rank: 7 };
  const capture: CardInstance = { instanceId: 'cap-1', definitionId: 'capture', suit: 'spade', rank: 6 };
  const cancel = { en: 'Play Wuxie to cancel it?', vi: 'Ra Wuxie để hủy?' };

  it('a Tool aimed at the viewer, at another seat, and at its own user', () => {
    const aimed = (target: string) => state([], wuxieWindow('seat-0', { kind: 'wuxie', tool: used(barbarians), toolUserSeatId: 'seat-1', target: seat(target) }));
    expect(both((t) => describeResponse(aimed('seat-0'), 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 used Barbarians on you', prompt: cancel.en, outcome: 'Barbarians takes effect on you' },
      vi: { source: 'Seat 1 dùng Barbarians lên bạn', prompt: cancel.vi, outcome: 'Barbarians có hiệu lực lên bạn' },
    });
    expect(both((t) => describeResponse(aimed('seat-2'), 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 used Barbarians on Seat 2', outcome: 'Barbarians takes effect on Seat 2' },
      vi: { source: 'Seat 1 dùng Barbarians lên Seat 2', outcome: 'Barbarians có hiệu lực lên Seat 2' },
    });
    const own = state([], wuxieWindow('seat-0', { kind: 'wuxie', tool: used(drawTwo), toolUserSeatId: 'seat-1', target: seat('seat-1') }));
    expect(both((t) => describeResponse(own, 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 used Draw Two', outcome: 'Draw Two takes effect' },
      vi: { source: 'Seat 1 dùng Draw Two', outcome: 'Draw Two có hiệu lực' },
    });
  });

  it('another seat’s counter Wuxie', () => {
    const counter = state([], wuxieWindow('seat-0', { kind: 'counter-wuxie', wuxieSeatId: 'seat-2' }));
    expect(both((t) => describeResponse(counter, 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 2 played Wuxie', prompt: cancel.en, outcome: "Seat 2's Wuxie stands" },
      vi: { source: 'Seat 2 ra Wuxie', prompt: cancel.vi, outcome: 'Wuxie của Seat 2 có hiệu lực' },
    });
  });

  it('a delayed Tool in a judgment area, for another seat and for the viewer', () => {
    const judging = (owner: string): GameState => ({
      ...state([], wuxieWindow('seat-0', { kind: 'wuxie', tool: used(capture), toolUserSeatId: owner, target: seat(owner) })),
      zones: [{ id: `${owner}:judgment`, kind: 'judgment', ownerSeatId: owner, cards: [capture] }],
    });
    expect(both((t) => describeResponse(judging('seat-1'), 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 is about to judge Capture', outcome: 'Seat 1 judges Capture' },
      vi: { source: 'Seat 1 sắp phán xét Capture', outcome: 'Seat 1 phán xét Capture' },
    });
    expect(both((t) => describeResponse(judging('seat-0'), 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'You are about to judge Capture', outcome: 'You judge Capture' },
      vi: { source: 'Bạn sắp phán xét Capture', outcome: 'Bạn phán xét Capture' },
    });
  });

  it('Coerce: play a Sha at the victim, or hand over the weapon', () => {
    const coerce: CardInstance = { instanceId: 'co-1', definitionId: 'coerce', suit: 'club', rank: 12 };
    const blade: CardInstance = { instanceId: 'blade-1', definitionId: 'green-dragon-blade', suit: 'spade', rank: 5 };
    const pending = (victimSeatId: string): PendingResponse => ({
      id: 'k1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
      reason: { kind: 'card-effect', card: used(coerce), userSeatId: 'seat-1', victimSeatId },
      sourceCard: { instanceId: 'co-1', definitionId: 'coerce' },
      context: { effect: { kind: 'MoveCardEffect', cardInstanceId: 'blade-1', toZoneId: 'seat-1:hand' } },
    });
    const zones: GameState['zones'] = [
      { id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [blade] },
      { id: 'seat-1:hand', kind: 'hand', ownerSeatId: 'seat-1', cards: [] },
    ];
    expect(both((t) => describeResponse({ ...state([], pending('seat-2')), zones }, 'seat-0', undefined, t))).toMatchObject({
      en: { source: 'Seat 1 used Coerce on you', prompt: 'Play Sha at Seat 2?', outcome: 'Green Dragon Blade goes to Seat 1' },
      vi: { source: 'Seat 1 dùng Coerce lên bạn', prompt: 'Ra Sha vào Seat 2?', outcome: 'Green Dragon Blade chuyển cho Seat 1' },
    });
    expect(both((t) => describeResponse({ ...state([], pending('seat-0')), zones }, 'seat-0', undefined, t)!.prompt)).toEqual({ en: 'Play Sha at you?', vi: 'Ra Sha vào bạn?' });
  });
});

describe('the Upheaval and Instigate windows, in English and Vietnamese', () => {
  const upheavalOwner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'upheaval' };
  const upheaval = (targetSeatId?: string): PendingResponse => ({
    id: 'u', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
    reason: { kind: 'ability', owner: upheavalOwner, abilityId: 'upheaval', ...(targetSeatId ? { targetSeatId } : {}) },
    context: { effect: { kind: 'SkillStepEffect', owner: upheavalOwner, step: 'penalty', data: {} } },
  });
  const instigateOwner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'instigate' };
  const instigate: PendingResponse = {
    id: 'i', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
    reason: { kind: 'ability', owner: instigateOwner, abilityId: 'instigate', targetSeatId: 'seat-0' },
    context: { effect: { kind: 'SkillStepEffect', owner: instigateOwner, step: 'penalty', data: { seatId: 'seat-1' } } },
  };

  it('Upheaval: the seat picked, the viewer, and no seat picked yet', () => {
    expect(both((t) => describeResponse(state([], upheaval('seat-2')), 'seat-1', undefined, t))).toMatchObject({
      en: { source: 'Hing used Upheaval', prompt: 'Play a Sha at Seat 2, or lose 1 HP?', outcome: 'You lose 1 HP' },
      vi: { source: 'Hing dùng Upheaval', prompt: 'Ra Sha vào Seat 2, hoặc mất 1 Sinh lực?', outcome: 'Bạn mất 1 Sinh lực' },
    });
    expect(both((t) => describeResponse(state([], upheaval('seat-1')), 'seat-1', undefined, t)!.prompt)).toEqual({ en: 'Play a Sha at you, or lose 1 HP?', vi: 'Ra Sha vào bạn, hoặc mất 1 Sinh lực?' });
    expect(both((t) => describeResponse(state([], upheaval()), 'seat-1', undefined, t)!.prompt)).toEqual({
      en: 'Play a Sha at the seat you picked, or lose 1 HP?',
      vi: 'Ra Sha vào người chơi bạn đã chọn, hoặc mất 1 Sinh lực?',
    });
    expect(both((t) => describeResponse(state([], upheaval('seat-2')), 'seat-0', undefined, t)!.outcome)).toEqual({ en: 'Seat 1 loses 1 HP', vi: 'Seat 1 mất 1 Sinh lực' });
  });

  it('Instigate: to the responder, to the instigator, and to a bystander', () => {
    expect(both((t) => describeResponse(state([], instigate), 'seat-1', undefined, t))).toMatchObject({
      en: { source: 'Hing used Instigate', prompt: 'Play a Sha at Hing, or discard a card?', outcome: 'Hing discards one of your cards' },
      vi: { source: 'Hing dùng Instigate', prompt: 'Ra Sha vào Hing, hoặc bỏ một lá bài?', outcome: 'Hing bỏ một lá bài của bạn' },
    });
    expect(both((t) => describeResponse(state([], instigate), 'seat-0', undefined, t)!.prompt)).toEqual({ en: 'Play a Sha at you, or discard a card?', vi: 'Ra Sha vào bạn, hoặc bỏ một lá bài?' });
    expect(both((t) => describeResponse(state([], instigate), 'seat-2', undefined, t)!.outcome)).toEqual({ en: "Hing discards one of Seat 1's cards", vi: 'Hing bỏ một lá bài của Seat 1' });
  });
});

describe('waitingLine, in English and Vietnamese', () => {
  const owner = { kind: 'equipment' as const, seatId: 'seat-1', cardInstanceId: 'ax' };

  it('a selection, an ability ask and a card choice', () => {
    const selecting: GameState = {
      ...state([], null),
      pendingSelection: { id: 's1', seatId: 'seat-1', reason: { kind: 'ability', owner, abilityId: 'axe' }, of: 'cards', eligibleIds: [], min: 2, max: 2, then: { kind: 'discard' } },
    };
    expect(both((t) => waitingLine(selecting, t))).toEqual({ en: 'Waiting on Seat 1 to choose', vi: 'Đang chờ Seat 1 chọn' });
    const asking: GameState = {
      ...state([], null),
      pendingChoice: { id: 'ask', seatId: 'seat-1', verb: 'use', reason: { kind: 'ability', owner, abilityId: 'axe' }, options: [] },
    };
    expect(both((t) => waitingLine(asking, t))).toEqual({ en: 'Waiting on Seat 1: Axe?', vi: 'Đang chờ Seat 1: Axe?' });
    const choosing: GameState = {
      ...state([], null),
      pendingChoice: { id: 'c', seatId: 'seat-0', verb: 'take', options: [], reason: { kind: 'choice', card: { as: 'steal', colour: 'black', physical: [] }, userSeatId: 'seat-0' } },
    };
    expect(both((t) => waitingLine(choosing, t))).toEqual({ en: 'Waiting on Hing to choose a card', vi: 'Đang chờ Hing chọn một lá bài' });
  });

  it('nothing pending is null', () => {
    expect(waitingLine(state([], null), tr)).toBeNull();
  });

  it('a response window for each reason', () => {
    const barbarians: CardInstance = { instanceId: 'barb-1', definitionId: 'barbarians', suit: 'spade', rank: 7 };
    const dying: PendingResponse = {
      id: 'd1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'],
      reason: { kind: 'dying', seatId: 'seat-2' }, context: { effect: noop },
    };
    expect(both((t) => waitingLine(state([], dying), t))).toEqual({ en: 'Waiting on Hing to save Seat 2', vi: 'Đang chờ Hing cứu Seat 2' });
    const wuxie = wuxieWindow('seat-0', { kind: 'wuxie', tool: used(barbarians), toolUserSeatId: 'seat-1', target: seat('seat-0') });
    expect(both((t) => waitingLine(state([], wuxie), t))).toEqual({ en: 'Waiting on Hing: Wuxie?', vi: 'Đang chờ Hing: Wuxie?' });
    const answer: PendingResponse = {
      id: 'b1', respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
      reason: { kind: 'card-effect', card: used(barbarians), userSeatId: 'seat-0' }, context: { effect: noop },
    };
    expect(both((t) => waitingLine(state([], answer), t))).toEqual({ en: 'Waiting on Seat 1 to answer Barbarians', vi: 'Đang chờ Seat 1 đáp lại Barbarians' });
    expect(both((t) => waitingLine(state([], damageWindow('s1', 'seat-1', 'seat-0', 'sha-1')), t))).toEqual({ en: 'Waiting on Seat 1', vi: 'Đang chờ Seat 1' });
    const abilityWindow = (skillId: string, abilityOwner: ReturnType<typeof upheavalOwnerFor>): PendingResponse => ({
      id: skillId, respondingSeatId: 'seat-1', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
      reason: { kind: 'ability', owner: abilityOwner, abilityId: skillId, targetSeatId: 'seat-2' },
      context: { effect: { kind: 'SkillStepEffect', owner: abilityOwner, step: 'penalty', data: {} } },
    });
    expect(both((t) => waitingLine(state([], abilityWindow('upheaval', upheavalOwnerFor('upheaval'))), t))).toEqual({
      en: 'Waiting on Seat 1 to play a Sha for Upheaval',
      vi: 'Đang chờ Seat 1 ra Sha cho Upheaval',
    });
    expect(both((t) => waitingLine(state([], abilityWindow('instigate', upheavalOwnerFor('instigate'))), t))).toEqual({
      en: 'Waiting on Seat 1 to play a Sha for Instigate',
      vi: 'Đang chờ Seat 1 ra Sha cho Instigate',
    });
  });
});

function upheavalOwnerFor(skillId: string) {
  return { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId };
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/response-description.vi.spec.ts`
Expected: FAIL: the Vietnamese assertions fail because `describeResponse` and `waitingLine` ignore a translator. English-only sides may match already. If a test fails on a fixture or type reason instead, compare the fixture with `response-description.spec.ts` and fix the fixture, not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, append inside the object (after the last existing entry, before `} satisfies`):

```ts
  'response.you': 'you',
  'response.yourself': 'yourself',
  'response.aCard': 'A card',
  'response.anyCard': 'a card',
  'response.seatYouPicked': 'the seat you picked',
  'response.damage': 'damage',
  'response.natureDamage': '{nature} damage',
  'response.damageDetail': '{amount} {kind}',
  'response.damageDetailFrom': '{amount} {kind} from {source}',
  'response.outcome.youLose': 'You lose {amount} HP ({detail})',
  'response.outcome.loses': '{who} loses {amount} HP ({detail})',
  'response.outcome.recovers': '{target} recovers {amount} HP',
  'response.outcome.draws.one': '{seat} draws {count} card',
  'response.outcome.draws.other': '{seat} draws {count} cards',
  'response.outcome.goesAhead': 'The effect goes ahead',
  'response.outcome.cardGoesTo': '{card} goes to {to}',
  'response.dying.you': 'You are dying (HP {hp})',
  'response.dying.other': '{seat} is dying (HP {hp})',
  'response.dying.prompt': 'Play a {peach} to save {who}?',
  'response.dying.promptWine': 'Play a {peach} or {wine} to save {who}?',
  'response.dying.needs': ' (needs {n} {peaches})',
  'response.peaches': '{peach}es',
  'response.eliminated.you': 'You are eliminated',
  'response.eliminated.other': '{seat} is eliminated',
  'response.judge.source.you': 'You are about to judge {tool}',
  'response.judge.source.other': '{seat} is about to judge {tool}',
  'response.judge.outcome.you': 'You judge {tool}',
  'response.judge.outcome.other': '{seat} judges {tool}',
  'response.cancelIt': 'Play {card} to cancel it?',
  'response.used': '{seat} used {tool}',
  'response.usedOn': '{seat} used {tool} on {target}',
  'response.takesEffect': '{tool} takes effect',
  'response.takesEffectOn': '{tool} takes effect on {target}',
  'response.played': '{seat} played {card}',
  'response.playedAgainst': '{seat} played {card} against {targets}',
  'response.stands': "{seat}'s {card} stands",
  'response.playAt': 'Play {card} at {target}?',
  'response.usedAbility': '{seat} used {ability}',
  'response.upheaval.prompt': 'Play a {sha} at {target}, or lose 1 HP?',
  'response.loseOne.you': 'You lose 1 HP',
  'response.loseOne.other': '{seat} loses 1 HP',
  'response.instigate.prompt': 'Play a {sha} at {target}, or discard a card?',
  'response.instigate.outcome.you': '{owner} discards one of your cards',
  'response.instigate.outcome.other': "{owner} discards one of {target}'s cards",
  'response.needed': 'A response is needed',
  'response.yourTurn': 'Your turn to respond',
  'response.respondTo': 'Your turn to respond to {card}',
  'response.answeredWith': '{seat} answered with {card}',
  'response.judgment.you': 'Your {reader} judgment: {face}',
  'response.judgment.other': "{seat}'s {reader} judgment: {face}",
  'response.waiting.choose': 'Waiting on {seat} to choose',
  'response.waiting.ask': 'Waiting on {seat}: {what}?',
  'response.waiting.chooseCard': 'Waiting on {seat} to choose a card',
  'response.waiting.on': 'Waiting on {seat}',
  'response.waiting.toSave': 'Waiting on {seat} to save {dying}',
  'response.waiting.answer': 'Waiting on {seat} to answer {card}',
  'response.waiting.playSha': 'Waiting on {seat} to play a {sha} for {ability}',
```

and in `projects/app/src/app/i18n/vi.ts`, append inside the object (after the last existing entry, before `};`):

```ts
  'response.you': 'bạn',
  'response.yourself': 'chính bạn',
  'response.aCard': 'Một lá bài',
  'response.anyCard': 'một lá bài',
  'response.seatYouPicked': 'người chơi bạn đã chọn',
  'response.damage': 'sát thương',
  'response.natureDamage': 'sát thương {nature}',
  'response.damageDetail': '{amount} {kind}',
  'response.damageDetailFrom': '{amount} {kind} từ {source}',
  'response.outcome.youLose': 'Bạn mất {amount} Sinh lực ({detail})',
  'response.outcome.loses': '{who} mất {amount} Sinh lực ({detail})',
  'response.outcome.recovers': '{target} hồi {amount} Sinh lực',
  'response.outcome.draws.one': '{seat} rút {count} lá bài',
  'response.outcome.draws.other': '{seat} rút {count} lá bài',
  'response.outcome.goesAhead': 'Hiệu ứng được thực hiện',
  'response.outcome.cardGoesTo': '{card} chuyển cho {to}',
  'response.dying.you': 'Bạn cận kề cái chết (Sinh lực {hp})',
  'response.dying.other': '{seat} cận kề cái chết (Sinh lực {hp})',
  'response.dying.prompt': 'Ra {peach} để cứu {who}?',
  'response.dying.promptWine': 'Ra {peach} hoặc {wine} để cứu {who}?',
  'response.dying.needs': ' (cần {n} {peaches})',
  'response.peaches': '{peach}',
  'response.eliminated.you': 'Bạn bị loại',
  'response.eliminated.other': '{seat} bị loại',
  'response.judge.source.you': 'Bạn sắp phán xét {tool}',
  'response.judge.source.other': '{seat} sắp phán xét {tool}',
  'response.judge.outcome.you': 'Bạn phán xét {tool}',
  'response.judge.outcome.other': '{seat} phán xét {tool}',
  'response.cancelIt': 'Ra {card} để hủy?',
  'response.used': '{seat} dùng {tool}',
  'response.usedOn': '{seat} dùng {tool} lên {target}',
  'response.takesEffect': '{tool} có hiệu lực',
  'response.takesEffectOn': '{tool} có hiệu lực lên {target}',
  'response.played': '{seat} ra {card}',
  'response.playedAgainst': '{seat} ra {card} nhắm vào {targets}',
  'response.stands': '{card} của {seat} có hiệu lực',
  'response.playAt': 'Ra {card} vào {target}?',
  'response.usedAbility': '{seat} dùng {ability}',
  'response.upheaval.prompt': 'Ra {sha} vào {target}, hoặc mất 1 Sinh lực?',
  'response.loseOne.you': 'Bạn mất 1 Sinh lực',
  'response.loseOne.other': '{seat} mất 1 Sinh lực',
  'response.instigate.prompt': 'Ra {sha} vào {target}, hoặc bỏ một lá bài?',
  'response.instigate.outcome.you': '{owner} bỏ một lá bài của bạn',
  'response.instigate.outcome.other': '{owner} bỏ một lá bài của {target}',
  'response.needed': 'Cần một phản hồi',
  'response.yourTurn': 'Đến lượt bạn đáp lại',
  'response.respondTo': 'Đến lượt bạn đáp lại {card}',
  'response.answeredWith': '{seat} đáp lại bằng {card}',
  'response.judgment.you': 'Phán xét {reader} của bạn: {face}',
  'response.judgment.other': 'Phán xét {reader} của {seat}: {face}',
  'response.waiting.choose': 'Đang chờ {seat} chọn',
  'response.waiting.ask': 'Đang chờ {seat}: {what}?',
  'response.waiting.chooseCard': 'Đang chờ {seat} chọn một lá bài',
  'response.waiting.on': 'Đang chờ {seat}',
  'response.waiting.toSave': 'Đang chờ {seat} cứu {dying}',
  'response.waiting.answer': 'Đang chờ {seat} đáp lại {card}',
  'response.waiting.playSha': 'Đang chờ {seat} ra {sha} cho {ability}',
```

- [ ] **Step 4: Rewrite `response-description.ts`**

Replace the whole of `projects/app/src/app/game-board/response-description.ts` with:

```ts
import { CardInstance, Effect, EngineEvent, GameState } from 'engine';
import { abilityName, cardDisplayData } from 'content';
import { englishTranslator, Translator } from '../i18n/translator';
import { Force, cardFaceLabel, cardIdDisplayName, forceOf, judgmentReaderName, seatName, targetLabel } from '../labels';

export interface ResponseDescription {
  // What started it, e.g. "Seat 1 played Duel against Hing".
  source: string;
  // What has happened since, e.g. "Seat 1 answered with Sha" (Duel's back-and-forth).
  latest: string | null;
  // What is asked of the viewer, e.g. "Your turn to respond to Duel".
  prompt: string;
  // What happens on No Response, e.g. "You lose 1 HP (1 damage from Seat 1)".
  outcome: string;
  // The force colour of the player that outcome befalls.
  outcomeForce: Force;
}

type CardPlayed = Extract<EngineEvent, { kind: 'CardPlayedEvent' }>;

function cardName(card: Pick<CardInstance, 'definitionId'>, tr: Translator): string {
  return cardDisplayData(card.definitionId)?.name ?? cardIdDisplayName(card.definitionId, tr);
}

// The card a window asks for, by name ("Wuxie Kongjie"), when it names one.
function askedCardName(state: GameState, tr: Translator): string {
  const id = state.pendingResponse?.allowedCardIds?.[0];
  return id ? cardName({ definitionId: id }, tr) : tr('response.anyCard');
}

// The card whose effect the window holds back: the window's own source card,
// else the card its reason names, else the cause of the damage it would deal.
function causeInstanceId(state: GameState): string | undefined {
  const pending = state.pendingResponse;
  if (!pending) return undefined;
  if (pending.sourceCard) return pending.sourceCard.instanceId;
  if (pending.reason?.kind === 'card-effect') return pending.reason.card.physical[0]?.instanceId;
  const effect = pending.outcome ?? pending.context.effect;
  return effect.kind === 'DamageEffect' ? effect.damage.cause?.cardInstanceId : undefined;
}

function lastPlayOf(log: EngineEvent[], instanceId: string): CardPlayed | undefined {
  for (let i = log.length - 1; i >= 0; i--) {
    const event = log[i];
    if (event.kind === 'CardPlayedEvent' && event.card.physical.some((c) => c.instanceId === instanceId)) return event;
  }
  return undefined;
}

// The seat a held-back effect would befall.
function affectedSeatOf(effect: Effect): string | undefined {
  if (effect.kind === 'DamageEffect') return effect.damage.target.seatId;
  if (effect.kind === 'HealEffect') return effect.target.seatId;
  if (effect.kind === 'DrawCardsEffect') return effect.seatId;
  return undefined;
}

function outcomeOf(effect: Effect, viewerSeatId: string, state: GameState, tr: Translator): string {
  const name = (seatId: string) => seatName(state.players, seatId, tr);
  switch (effect.kind) {
    case 'DamageEffect': {
      const { target, amount, source, nature } = effect.damage;
      const kind = nature === 'normal' ? tr('response.damage') : tr('response.natureDamage', { nature });
      const detail = source
        ? tr('response.damageDetailFrom', { amount, kind, source: targetLabel(source, state.players, tr) })
        : tr('response.damageDetail', { amount, kind });
      return target.kind === 'seat' && target.seatId === viewerSeatId
        ? tr('response.outcome.youLose', { amount, detail })
        : tr('response.outcome.loses', { who: targetLabel(target, state.players, tr), amount, detail });
    }
    case 'HealEffect':
      return tr('response.outcome.recovers', { target: targetLabel(effect.target, state.players, tr), amount: effect.amount });
    case 'DrawCardsEffect':
      return tr(effect.count === 1 ? 'response.outcome.draws.one' : 'response.outcome.draws.other', { seat: name(effect.seatId), count: effect.count });
    case 'MoveCardEffect': {
      const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === effect.cardInstanceId);
      const owner = state.zones.find((z) => z.id === effect.toZoneId)?.ownerSeatId;
      if (!owner) return tr('response.outcome.goesAhead');
      return tr('response.outcome.cardGoesTo', {
        card: card ? cardName(card, tr) : tr('response.aCard'),
        to: owner === viewerSeatId ? tr('response.you') : name(owner),
      });
    }
    default:
      return tr('response.outcome.goesAhead');
  }
}

// Everything the Response window says, read off the (redacted) state and its
// public log. Null when no response is pending.
// `preview` shows a pending effect as it would really land (e.g. after Silver
// Lion's cap); without one, the effect is described as it stands.
export function describeResponse(
  state: GameState,
  viewerSeatId: string,
  preview: (effect: Effect) => Effect | null = (effect) => effect,
  tr: Translator = englishTranslator
): ResponseDescription | null {
  const pending = state.pendingResponse;
  if (!pending) return null;
  const name = (seatId: string) => seatName(state.players, seatId, tr);
  // A seat as a target of a sentence: "you" for the viewer, else its name.
  const whom = (seatId: string) => (seatId === viewerSeatId ? tr('response.you') : name(seatId));
  // The card names the sentences mention.
  const sha = cardName({ definitionId: 'sha' }, tr);
  // What not answering leads to, as the window shows it.
  const shown = pending.outcome ?? pending.context.effect;

  // The dying round: save the seat, or it is out.
  if (pending.reason?.kind === 'dying') {
    const dyingId = pending.reason.seatId;
    const dying = state.seats.find((s) => s.id === dyingId);
    const hp = dying?.combinedHp ?? 0;
    const self = dyingId === viewerSeatId;
    const needed = 1 - hp;
    // Wine is offered only to the dying seat itself; name it when you hold one.
    const viewerHand = state.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === viewerSeatId)?.cards ?? [];
    const canDrink = self && !!pending.allowedCardIds?.includes('wine') && viewerHand.some((c) => c.definitionId === 'wine');
    const peach = cardName({ definitionId: 'peach' }, tr);
    const who = self ? tr('response.yourself') : name(dyingId);
    const ask = canDrink
      ? tr('response.dying.promptWine', { peach, wine: cardName({ definitionId: 'wine' }, tr), who })
      : tr('response.dying.prompt', { peach, who });
    return {
      source: self ? tr('response.dying.you', { hp }) : tr('response.dying.other', { seat: name(dyingId), hp }),
      latest: null,
      prompt: ask + (needed > 1 ? tr('response.dying.needs', { n: needed, peaches: tr('response.peaches', { peach }) }) : ''),
      outcome: self ? tr('response.eliminated.you') : tr('response.eliminated.other', { seat: name(dyingId) }),
      outcomeForce: forceOf(dying?.kingdom),
    };
  }

  if (pending.reason?.kind === 'wuxie') {
    const { tool, toolUserSeatId, target } = pending.reason;
    const toolName = cardName({ definitionId: tool.as }, tr);
    // A delayed Tool still lying in a judgment area is being judged there.
    const toolCardId = tool.physical[0]?.instanceId;
    const judgedOwner = state.zones.find((z) => z.kind === 'judgment' && z.cards.some((c) => c.instanceId === toolCardId))?.ownerSeatId;
    if (judgedOwner) {
      const you = judgedOwner === viewerSeatId;
      return {
        source: you ? tr('response.judge.source.you', { tool: toolName }) : tr('response.judge.source.other', { seat: name(judgedOwner), tool: toolName }),
        latest: null,
        prompt: tr('response.cancelIt', { card: askedCardName(state, tr) }),
        outcome: you ? tr('response.judge.outcome.you', { tool: toolName }) : tr('response.judge.outcome.other', { seat: name(judgedOwner), tool: toolName }),
        outcomeForce: forceOf(state.seats.find((s) => s.id === judgedOwner)?.kingdom),
      };
    }
    const targetId = target.kind === 'seat' ? target.seatId : undefined;
    // Named only when the Tool is aimed at a seat other than its own user.
    const aimedAt = targetId && targetId !== toolUserSeatId ? targetId : undefined;
    return {
      source: aimedAt ? tr('response.usedOn', { seat: name(toolUserSeatId), tool: toolName, target: whom(aimedAt) }) : tr('response.used', { seat: name(toolUserSeatId), tool: toolName }),
      latest: null,
      prompt: tr('response.cancelIt', { card: askedCardName(state, tr) }),
      outcome: aimedAt ? tr('response.takesEffectOn', { tool: toolName, target: whom(aimedAt) }) : tr('response.takesEffect', { tool: toolName }),
      outcomeForce: forceOf(state.seats.find((s) => s.id === targetId)?.kingdom),
    };
  }

  if (pending.reason?.kind === 'counter-wuxie') {
    const { wuxieSeatId } = pending.reason;
    const counter = askedCardName(state, tr);
    return {
      source: tr('response.played', { seat: name(wuxieSeatId), card: counter }),
      latest: null,
      prompt: tr('response.cancelIt', { card: counter }),
      outcome: tr('response.stands', { seat: name(wuxieSeatId), card: counter }),
      outcomeForce: forceOf(state.seats.find((s) => s.id === wuxieSeatId)?.kingdom),
    };
  }

  if (pending.reason?.kind === 'card-effect' && pending.reason.victimSeatId) {
    const { card, userSeatId, victimSeatId } = pending.reason;
    const holder = pending.respondingSeatId;
    return {
      source: tr('response.usedOn', { seat: name(userSeatId), tool: cardName({ definitionId: card.as }, tr), target: whom(holder) }),
      latest: null,
      prompt: tr('response.playAt', { card: askedCardName(state, tr), target: whom(victimSeatId) }),
      outcome: outcomeOf(preview(shown) ?? shown, viewerSeatId, state, tr),
      outcomeForce: forceOf(state.seats.find((s) => s.id === holder)?.kingdom),
    };
  }

  // Upheaval: play a Sha at the seat this seat picked, or lose 1 HP.
  if (pending.reason?.kind === 'ability' && pending.reason.abilityId === 'upheaval') {
    const { owner, targetSeatId } = pending.reason;
    const you = pending.respondingSeatId === viewerSeatId;
    return {
      source: tr('response.usedAbility', { seat: name(owner.seatId), ability: abilityName('upheaval') }),
      latest: null,
      prompt: tr('response.upheaval.prompt', { sha, target: targetSeatId ? whom(targetSeatId) : tr('response.seatYouPicked') }),
      outcome: you ? tr('response.loseOne.you') : tr('response.loseOne.other', { seat: name(pending.respondingSeatId) }),
      outcomeForce: forceOf(state.seats.find((s) => s.id === pending.respondingSeatId)?.kingdom),
    };
  }

  // Instigate: play a Sha at its user, or have a card discarded.
  if (pending.reason?.kind === 'ability' && pending.reason.abilityId === 'instigate') {
    const { owner } = pending.reason;
    const you = pending.respondingSeatId === viewerSeatId;
    return {
      source: tr('response.usedAbility', { seat: name(owner.seatId), ability: abilityName('instigate') }),
      latest: null,
      prompt: tr('response.instigate.prompt', { sha, target: whom(owner.seatId) }),
      outcome: you
        ? tr('response.instigate.outcome.you', { owner: name(owner.seatId) })
        : tr('response.instigate.outcome.other', { owner: name(owner.seatId), target: name(pending.respondingSeatId) }),
      outcomeForce: forceOf(state.seats.find((s) => s.id === pending.respondingSeatId)?.kingdom),
    };
  }

  const causeId = causeInstanceId(state);
  const played = causeId ? lastPlayOf(state.log, causeId) : undefined;

  let source = tr('response.needed');
  let prompt = tr('response.yourTurn');
  if (played) {
    const card = cardName({ definitionId: played.card.as }, tr);
    source =
      played.targets.length > 0
        ? tr('response.playedAgainst', { seat: name(played.seatId), card, targets: played.targets.map((t) => targetLabel(t, state.players, tr)).join(', ') })
        : tr('response.played', { seat: name(played.seatId), card });
    prompt = tr('response.respondTo', { card });
  }

  // The latest answer to that same card, if the window follows one (a Duel's Sha).
  let latest: string | null = null;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const event = state.log[i];
    if (event.kind !== 'CardPlayedEvent') continue;
    if (causeId && event.inResponseTo?.cardInstanceId === causeId) {
      latest = tr('response.answeredWith', { seat: name(event.seatId), card: cardName({ definitionId: event.card.as }, tr) });
    }
    break;
  }

  // An armour's judgment for the responder just before the window (Eight Trigrams on black).
  if (!latest) {
    for (let i = state.log.length - 1; i >= 0; i--) {
      const event = state.log[i];
      if (event.kind === 'CardMovedEvent') continue;
      if (event.kind === 'JudgmentEvent' && event.seatId === pending.respondingSeatId) {
        const params = { reader: judgmentReaderName(event.reader), face: cardFaceLabel(event.card) };
        latest = event.seatId === viewerSeatId ? tr('response.judgment.you', params) : tr('response.judgment.other', { ...params, seat: name(event.seatId) });
      }
      break;
    }
  }

  return {
    source,
    latest,
    prompt,
    outcome: outcomeOf(preview(shown) ?? shown, viewerSeatId, state, tr),
    outcomeForce: forceOf(state.seats.find((s) => s.id === affectedSeatOf(shown))?.kingdom),
  };
}

// The table centre's "Waiting on …" line, with what the seat is being asked.
export function waitingLine(state: GameState, tr: Translator = englishTranslator): string | null {
  const name = (seatId: string) => seatName(state.players, seatId, tr);
  const selection = state.pendingSelection;
  if (selection) return tr('response.waiting.choose', { seat: name(selection.seatId) });
  const asking = state.pendingChoice;
  if (asking?.reason.kind === 'ability') {
    return tr('response.waiting.ask', { seat: name(asking.seatId), what: cardName({ definitionId: asking.reason.abilityId }, tr) });
  }
  const choice = state.pendingChoice;
  if (choice) return tr('response.waiting.chooseCard', { seat: name(choice.seatId) });
  const pending = state.pendingResponse;
  if (!pending) return null;
  const seat = name(pending.respondingSeatId);
  const reason = pending.reason;
  if (reason?.kind === 'dying') return tr('response.waiting.toSave', { seat, dying: name(reason.seatId) });
  if (reason?.kind === 'wuxie' || reason?.kind === 'counter-wuxie') return tr('response.waiting.ask', { seat, what: askedCardName(state, tr) });
  if (reason?.kind === 'card-effect') return tr('response.waiting.answer', { seat, card: cardName({ definitionId: reason.card.as }, tr) });
  const sha = cardName({ definitionId: 'sha' }, tr);
  if (reason?.kind === 'ability' && reason.abilityId === 'upheaval') return tr('response.waiting.playSha', { seat, sha, ability: abilityName('upheaval') });
  if (reason?.kind === 'ability' && reason.abilityId === 'instigate') return tr('response.waiting.playSha', { seat, sha, ability: abilityName('instigate') });
  return tr('response.waiting.on', { seat });
}

// Whether the Response window should start on No Response rather than the
// first answer: true for Wuxie questions, where answering cancels a Tool
// (possibly the viewer's own), so a hasty click must not do it.
export function startsOnNoResponse(state: GameState): boolean {
  const kind = state.pendingResponse?.reason?.kind;
  return kind === 'wuxie' || kind === 'counter-wuxie';
}
```

- [ ] **Step 5: Run the new spec, the existing spec and the parity test**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/response-description.vi.spec.ts projects/app/src/app/game-board/response-description.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with `response-description.spec.ts` unedited. If an English assertion fails, a template or a param differs from the old string by a character: fix `en.ts` or the code, never the existing spec. If a new Vietnamese assertion fails on a typo in the plan's expected string, compare it with `vi.ts` and fix whichever disagrees with the Step 3 templates, and ledger a ruling.

- [ ] **Step 6: Typecheck app and specs, then run the whole app project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx tsc -p projects/app/tsconfig.spec.json --noEmit; npx jest --selectProjects app`
Expected: no type errors in the app build (this proves every key in the ternaries exists in the catalog). The spec typecheck may report only the one error that existed before (`selection-dialog.spec.ts`); anything in the new spec is yours to fix (an effect or window fixture shape: copy it from `response-description.spec.ts`). Every suite passes.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/game-board/response-description.ts projects/app/src/app/game-board/response-description.vi.spec.ts
git commit -m "feat(app): the response description and waiting line build through the translator

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (step 2c of the spec's "Translator-based builders"):
- `describeResponse` and `waitingLine` take a translator with an English default; every sentence is a whole-sentence template: Task 1 Steps 3 and 4.
- The "you"/"bạn" subject and target forms, damage detail, the Peach suffix and the card names are handled as params: Step 4.
- Existing spec unedited, English byte-identical: Steps 5 and 6.
- Vietnamese covered for every branch: Step 1.
- Not in this plan, by design: `response-dialog.ts` and other components (phase 3), card and ability names (phase 4).

**Placeholder scan:** none. The whole new file, every catalog entry and the whole spec are shown.

**Type consistency:** the new file calls `seatName(players, id, tr)`, `targetLabel(t, players, tr)` and `cardIdDisplayName(id, tr)` with the signatures from step 2e. Every `response.*` key used in Step 4 appears in Step 3 with the same placeholders in both languages (`response.outcome.draws.one/other`, `response.dying.*`, `response.waiting.*`, and the rest). `describeResponse`'s new `tr` follows the existing `preview` parameter, as the spec calls it (`describeResponse(s, viewer, undefined, t)`).

**Review Focus:** each line has a test in Step 1: the you/bạn forms across the dying, judging, Wuxie, Coerce, Upheaval and Instigate cases; the Peach suffix only when more than one is needed; damage with and without a source, with a nature word, and to a Main General; the move cases (found card, unknown card, no owner, other effect); and every `waitingLine` reason plus null.
