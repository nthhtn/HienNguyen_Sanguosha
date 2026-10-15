# Vietnamese Localization, Phase 2e (labels.ts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the text in `labels.ts` (seat fallback names, target labels, hidden card and General names, kingdom names, action labels, conversion labels, suit labels) through the translator, and make the builders translated in phases 2a and 2b pass their translator on to these helpers, so a Vietnamese sentence no longer holds "Seat 3" or "Hidden General".

**Architecture:** Every exported text helper in `labels.ts` gains one optional trailing `tr: Translator = englishTranslator` parameter, so all ~28 existing callers and every existing spec are untouched. Sentences become whole-sentence templates (`label.action.playTargeting`, …); a seat without a player name becomes `label.seat` with the number as a param. The three builder files from earlier phases then pass `tr` into `seatName`, `targetLabel`, `suitLabel`, `generalDisplayName` and `cardIdDisplayName` by a mechanical, count-checked edit. Card, ability and General names that come from content data stay English until phase 4.

**Tech Stack:** Angular 22, Jest (`app` project), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` ("Translator-based builders", step 2e)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-2cde` on branch `feat/vietnamese-phase-2cde`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. The existing `labels.spec.ts`, `choice-description.spec.ts`, `ability-description.spec.ts` and `action-history.spec.ts` must pass WITHOUT edits.
- A new catalog key needs an English entry and a Vietnamese entry with the same `{placeholders}` in the same commit (the `Messages` type and `catalogs.spec.ts` enforce it). Vietnamese follows the spec's glossary and is sentence case; Tướng and Sinh lực keep their capitals inside sentences; Seat is Người chơi.
- Change only: `labels.ts`, `choice-description.ts`, `ability-description.ts`, `action-history.ts` (and the new and edited specs, and the catalogs). Do NOT touch `response-description.ts` (step 2c), `display.ts` (step 2d), any component, or `hand-view.ts` (its "At" text is phase 3).
- The two earlier Vietnamese history specs use explicit player names, so their expectations ("Seat 0 dùng …") stay valid; only one new test exercises the nameless-seat fallback.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the project: `npx jest --selectProjects app`.

## Review Focus

- A seat id that is not `seat-<digits>` (for example `seat-a` or `p1`) falls back to the old Title Case in both languages; a player whose name is the empty string still shows the empty string (the old `??` behaviour).
- `targetingParts(...).prefix` equals the targetless label plus " Targeting" in English, and the full targeted label equals "Play X Targeting Y".
- A kingdom value outside the five known (a cast from data) prints raw instead of failing.
- All four suits give their own Vietnamese suit name (Bích, Cơ, Chuồn, Rô).
- Builders still print English unchanged with no translator, and Vietnamese seat fallbacks with one.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/en.ts`, `vi.ts` | About 45 new `label.*` keys. |
| `app/src/app/labels.ts` | Text helpers build through `tr`. |
| `app/src/app/game-board/{choice-description,ability-description,action-history}.ts` | Pass `tr` into the label helpers. |
| `app/src/app/labels.vi.spec.ts` | New: every helper in English and Vietnamese. |
| `app/src/app/game-board/action-history.vi.spec.ts`, `action-history.abilities.vi.spec.ts` | Pass explicit players; one new nameless-seat test. |

---

### Task 1: Labels through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/labels.ts`, `projects/app/src/app/game-board/choice-description.ts`, `projects/app/src/app/game-board/ability-description.ts`, `projects/app/src/app/game-board/action-history.ts`, `projects/app/src/app/game-board/action-history.vi.spec.ts`, `projects/app/src/app/game-board/action-history.abilities.vi.spec.ts`
- Test: `projects/app/src/app/labels.vi.spec.ts` (new)

**Interfaces:**
- Consumes: `Translator`, `englishTranslator`, `MessageKey`.
- Produces: `seatName(players, seatId, tr?)`, `targetLabel(target, players?, tr?)`, `cardIdDisplayName(id, tr?)`, `generalDisplayName(id, tr?)`, `kingdomDisplayName(kingdom, tr?)`, `actionLabel(action, state, registry, tr?)`, `targetingParts(action, state, registry, tr?)`, `conversionLabel(action, state, registry, tr?)`, `suitLabel(suit, tr?)`. Unchanged: `forceOf`, `Force`, `cardDefinitionId`, `suitSymbol`, `cardFaceLabel`, `judgmentReaderName`. Catalog keys `label.*` (Step 3).

- [ ] **Step 1: Write the failing labels spec**

`projects/app/src/app/labels.vi.spec.ts`:

```ts
import { Action, ContentRegistry, GameState, Target } from 'engine';
import { buildContentRegistry } from 'content';
import { makeTranslator } from './i18n/translator';
import { vi } from './i18n/vi';
import {
  actionLabel, cardIdDisplayName, conversionLabel, generalDisplayName, kingdomDisplayName, seatName, suitLabel, targetLabel, targetingParts,
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
    expect(targetLabel({ kind: 'general', seatId: 'seat-0', generalSlot: 'main' }, state.players, tr)).toBe('Tướng chính của Hing');
    expect(targetLabel({ kind: 'general', seatId: 'seat-0', generalSlot: 'deputy' }, state.players, tr)).toBe('Tướng phụ của Hing');
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
    ['play', { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [] }, 'Play Sha', 'Ra Sha'],
    ['play at a seat', { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-0' }] }, 'Play Sha Targeting Hing', 'Ra Sha nhắm vào Hing'],
    ['play at two seats', { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-0' }, { kind: 'seat', seatId: 'seat-1' }] }, 'Play Sha Targeting Hing, Seat 1', 'Ra Sha nhắm vào Hing, Người chơi 1'],
    ['choose Generals', { kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId: 'cao-cao', deputyId: 'xu-chu' }, 'Choose Cao Cao (Main) and Xu Chu (Deputy)', 'Chọn Cao Cao (chính) và Xu Chu (phụ)'],
    ['reveal main', { kind: 'RevealGeneralAction', seatId: 'seat-0', slot: 'main' }, 'Reveal Main General', 'Lật Tướng chính'],
    ['reveal deputy', { kind: 'RevealGeneralAction', seatId: 'seat-0', slot: 'deputy' }, 'Reveal Deputy General', 'Lật Tướng phụ'],
    ['respond', { kind: 'RespondAction', seatId: 'seat-0', cardInstanceId: 'card-1' }, 'Respond with Sha', 'Đáp lại bằng Sha'],
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
    expect(targetingParts(play, state, registry, tr)).toEqual({ prefix: 'Ra Sha nhắm vào', targets: [{ kind: 'seat', seatId: 'seat-0' }] });
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
    expect(conversionLabel(use, seated, real, tr)).toBe('Làm Sha · Fighting Saint');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/labels.vi.spec.ts`
Expected: FAIL: the Vietnamese assertions fail because `labels.ts` ignores the extra argument. English-only lines may pass already. If a test fails on a fixture or type reason instead (an action shape), compare it with `labels.spec.ts` and fix the fixture, not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, append inside the object (after the last existing entry, before `} satisfies`):

```ts
  'label.seat': 'Seat {n}',
  'label.target.main': "{seat}'s Main General",
  'label.target.deputy': "{seat}'s Deputy General",
  'label.hiddenCard': 'Hidden Card',
  'label.hiddenGeneral': 'Hidden General',
  'label.kingdom.hidden': 'Hidden',
  'label.kingdom.Wei': 'Wei',
  'label.kingdom.Shu': 'Shu',
  'label.kingdom.Wu': 'Wu',
  'label.kingdom.Qun': 'Qun',
  'label.action.draw.one': 'Draw {n} Card',
  'label.action.draw.other': 'Draw {n} Cards',
  'label.action.play': 'Play {card}',
  'label.action.playTargeting': 'Play {card} Targeting {targets}',
  'label.action.chooseGenerals': 'Choose {main} (Main) and {deputy} (Deputy)',
  'label.action.revealMain': 'Reveal Main General',
  'label.action.revealDeputy': 'Reveal Deputy General',
  'label.action.respond': 'Respond with {card}',
  'label.action.pass': 'Pass',
  'label.action.endPhase': 'End Phase',
  'label.action.choose': 'Choose',
  'label.action.useSkill': 'Use {ability}',
  'label.action.useSkillGeneric': 'Use Skill',
  'label.action.arrange': 'Arrange',
  'label.action.confirm': 'Confirm',
  'label.action.cancel': 'Cancel',
  'label.action.discard': 'Discard {card}',
  'label.targetingPrefix': '{label} Targeting',
  'label.useCards': 'Use Cards',
  'label.useCardsAs': 'Use {count} Cards as {card}',
  'label.asCardVia': 'As {card} · {ability}',
  'label.withTargets': '{base} Targeting {targets}',
  'label.suit.spade': 'Spade',
  'label.suit.heart': 'Heart',
  'label.suit.club': 'Club',
  'label.suit.diamond': 'Diamond',
  'label.suitLabel': '{symbol} {name}',
```

and in `projects/app/src/app/i18n/vi.ts`, append inside the object (after the last existing entry, before `};`):

```ts
  'label.seat': 'Người chơi {n}',
  'label.target.main': 'Tướng chính của {seat}',
  'label.target.deputy': 'Tướng phụ của {seat}',
  'label.hiddenCard': 'Lá bài ẩn',
  'label.hiddenGeneral': 'Tướng ẩn',
  'label.kingdom.hidden': 'Ẩn',
  'label.kingdom.Wei': 'Ngụy',
  'label.kingdom.Shu': 'Thục',
  'label.kingdom.Wu': 'Ngô',
  'label.kingdom.Qun': 'Quần',
  'label.action.draw.one': 'Rút {n} lá bài',
  'label.action.draw.other': 'Rút {n} lá bài',
  'label.action.play': 'Ra {card}',
  'label.action.playTargeting': 'Ra {card} nhắm vào {targets}',
  'label.action.chooseGenerals': 'Chọn {main} (chính) và {deputy} (phụ)',
  'label.action.revealMain': 'Lật Tướng chính',
  'label.action.revealDeputy': 'Lật Tướng phụ',
  'label.action.respond': 'Đáp lại bằng {card}',
  'label.action.pass': 'Bỏ qua',
  'label.action.endPhase': 'Kết thúc giai đoạn',
  'label.action.choose': 'Chọn',
  'label.action.useSkill': 'Dùng {ability}',
  'label.action.useSkillGeneric': 'Dùng kỹ năng',
  'label.action.arrange': 'Sắp xếp',
  'label.action.confirm': 'Xác nhận',
  'label.action.cancel': 'Hủy',
  'label.action.discard': 'Bỏ {card}',
  'label.targetingPrefix': '{label} nhắm vào',
  'label.useCards': 'Dùng các lá bài',
  'label.useCardsAs': 'Dùng {count} lá bài làm {card}',
  'label.asCardVia': 'Làm {card} · {ability}',
  'label.withTargets': '{base} nhắm vào {targets}',
  'label.suit.spade': 'Bích',
  'label.suit.heart': 'Cơ',
  'label.suit.club': 'Chuồn',
  'label.suit.diamond': 'Rô',
  'label.suitLabel': '{symbol} {name}',
```

- [ ] **Step 4: Rewrite `labels.ts`**

Replace the whole of `projects/app/src/app/labels.ts` with:

```ts
import { Action, CardInstance, ContentRegistry, GameState, JudgmentReader, Kingdom, Player, Target, findSkill } from 'engine';
import { abilityName } from 'content';
import type { MessageKey } from './i18n/messages';
import { englishTranslator, Translator } from './i18n/translator';

function findCardInstance(state: GameState, cardInstanceId: string): CardInstance | undefined {
  for (const zone of state.zones) {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (found) return found;
  }
  return undefined;
}

function cardDisplayName(state: GameState, registry: ContentRegistry, cardInstanceId: string): string {
  const card = findCardInstance(state, cardInstanceId);
  if (!card) return cardInstanceId;
  return registry.cards.get(card.definitionId)?.name ?? card.definitionId;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// "seat-0" → "Seat 0": the fallback for a seat with no player name.
function titleCaseId(id: string): string {
  return id.split('-').map(capitalise).join(' ');
}

// The name shown for a seat: its player's name, else "Seat N" in the viewer's
// language for a `seat-<n>` id, else the id in Title Case.
export function seatName(players: readonly Player[], seatId: string, tr: Translator = englishTranslator): string {
  const numbered = /^seat-(\d+)$/.exec(seatId);
  return players.find((p) => p.seatId === seatId)?.name ?? (numbered ? tr('label.seat', { n: numbered[1] }) : titleCaseId(seatId));
}

export function targetLabel(target: Target, players: readonly Player[] = [], tr: Translator = englishTranslator): string {
  const seat = seatName(players, target.seatId, tr);
  if (target.kind === 'seat') return seat;
  return tr(target.generalSlot === 'main' ? 'label.target.main' : 'label.target.deputy', { seat });
}

export function cardIdDisplayName(cardDefinitionId: string, tr: Translator = englishTranslator): string {
  if (cardDefinitionId === 'hidden') return tr('label.hiddenCard');
  return titleCaseId(cardDefinitionId);
}

export function cardDefinitionId(state: GameState, cardInstanceId: string): string | undefined {
  return findCardInstance(state, cardInstanceId)?.definitionId;
}

export function generalDisplayName(generalDefinitionId: string, tr: Translator = englishTranslator): string {
  if (generalDefinitionId === 'hidden') return tr('label.hiddenGeneral');
  return titleCaseId(generalDefinitionId);
}

// The force colour a seat is shown in: its kingdom once known, else 'none'
// (hidden, or a seat that belongs to no force).
export type Force = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'none';
export function forceOf(kingdom: Kingdom | undefined): Force {
  return kingdom === 'Wei' || kingdom === 'Shu' || kingdom === 'Wu' || kingdom === 'Qun' ? kingdom : 'none';
}

const KINGDOM_KEYS = {
  hidden: 'label.kingdom.hidden',
  Wei: 'label.kingdom.Wei',
  Shu: 'label.kingdom.Shu',
  Wu: 'label.kingdom.Wu',
  Qun: 'label.kingdom.Qun',
} as const satisfies Record<Kingdom, MessageKey>;

// A kingdom outside the five known (data cast) is shown as it is.
export function kingdomDisplayName(kingdom: Kingdom, tr: Translator = englishTranslator): string {
  const key = KINGDOM_KEYS[kingdom];
  return key ? tr(key) : kingdom;
}

export function actionLabel(action: Action, state: GameState, registry: ContentRegistry, tr: Translator = englishTranslator): string {
  switch (action.kind) {
    case 'DrawCardsAction':
      return tr(action.count === 1 ? 'label.action.draw.one' : 'label.action.draw.other', { n: action.count });
    case 'PlayCardAction': {
      const card = cardDisplayName(state, registry, action.cardInstanceId);
      if (action.targets.length === 0) return tr('label.action.play', { card });
      return tr('label.action.playTargeting', { card, targets: action.targets.map((t) => targetLabel(t, state.players, tr)).join(', ') });
    }
    case 'ChooseGeneralsAction':
      return tr('label.action.chooseGenerals', { main: generalDisplayName(action.mainId, tr), deputy: generalDisplayName(action.deputyId, tr) });
    case 'RevealGeneralAction':
      return tr(action.slot === 'main' ? 'label.action.revealMain' : 'label.action.revealDeputy');
    case 'RespondAction':
      return tr('label.action.respond', { card: cardDisplayName(state, registry, action.cardInstanceId) });
    case 'PassAction':
      return tr('label.action.pass');
    case 'EndPhaseAction':
      return tr('label.action.endPhase');
    case 'ChooseOptionAction':
      return tr('label.action.choose');
    case 'UseConversionAction':
      return conversionLabel(action, state, registry, tr);
    case 'UseSkillAction':
      return action.owner.kind === 'general' ? tr('label.action.useSkill', { ability: abilityName(action.owner.skillId) }) : tr('label.action.useSkillGeneric');
    case 'ArrangeCardsAction':
      return tr('label.action.arrange');
    case 'SelectAction':
      return tr('label.action.confirm');
    case 'CancelSelectionAction':
      return tr('label.action.cancel');
    case 'DiscardCardAction':
      return tr('label.action.discard', { card: cardDisplayName(state, registry, action.cardInstanceId) });
  }
}

// An action's label split where its targets begin, so the targets can be shown
// richly: "Play Sha Targeting" + [Seat 1]. Null for an action with no seat to name.
export function targetingParts(action: Action, state: GameState, registry: ContentRegistry, tr: Translator = englishTranslator): { prefix: string; targets: Target[] } | null {
  if ((action.kind !== 'PlayCardAction' && action.kind !== 'UseConversionAction') || action.targets.length === 0) return null;
  return { prefix: tr('label.targetingPrefix', { label: actionLabel({ ...action, targets: [] }, state, registry, tr) }), targets: action.targets };
}

// "Use 2 Cards as Sha" (a worn card's), "As Sha · Fighting Saint" (a skill's),
// with its targets for a play.
export function conversionLabel(
  action: Extract<Action, { kind: 'UseConversionAction' }>,
  state: GameState,
  registry: ContentRegistry,
  tr: Translator = englishTranslator
): string {
  const owner = action.via.owner;
  const cardName = (id: string) => registry.cards.get(id)?.name ?? id;
  let base = tr('label.useCards');
  if (owner.kind === 'equipment') {
    const worn = findCardInstance(state, owner.cardInstanceId);
    const conversion = worn && registry.cards.get(worn.definitionId)?.abilities?.conversions?.find((c) => c.id === action.via.conversionId);
    if (conversion) base = tr('label.useCardsAs', { count: conversion.cards, card: cardName(conversion.as) });
  } else {
    const generalId = state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot].generalDefinitionId;
    const skill = (generalId ? registry.generals.get(generalId)?.skills.find((s) => s.id === owner.skillId) : undefined) ?? findSkill(registry, owner.skillId);
    const conversion = skill?.conversions?.find((c) => c.id === action.via.conversionId);
    if (conversion) base = tr('label.asCardVia', { card: cardName(conversion.as), ability: abilityName(owner.skillId) });
  }
  return action.targets.length > 0 ? tr('label.withTargets', { base, targets: action.targets.map((t) => targetLabel(t, state.players, tr)).join(', ') }) : base;
}

const SUIT_SYMBOLS: Record<CardInstance['suit'], string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };
// "♥": a suit's symbol alone.
export function suitSymbol(suit: CardInstance['suit']): string {
  return SUIT_SYMBOLS[suit];
}

const SUIT_KEYS = {
  spade: 'label.suit.spade',
  heart: 'label.suit.heart',
  club: 'label.suit.club',
  diamond: 'label.suit.diamond',
} as const satisfies Record<CardInstance['suit'], MessageKey>;

// "♥ Heart": a suit as an option to pick.
export function suitLabel(suit: CardInstance['suit'], tr: Translator = englishTranslator): string {
  return tr('label.suitLabel', { symbol: SUIT_SYMBOLS[suit], name: tr(SUIT_KEYS[suit]) });
}
const FACE_RANKS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

// "A ♦", "7 ♠", "Q ♥" — a card's printed corner.
export function cardFaceLabel(card: Pick<CardInstance, 'suit' | 'rank'>): string {
  return `${FACE_RANKS[card.rank] ?? card.rank} ${SUIT_SYMBOLS[card.suit]}`;
}

// What a judgment is for: the card's name, or the skill's.
export function judgmentReaderName(reader: JudgmentReader): string {
  return abilityName(reader.kind === 'card' ? reader.card.as : reader.owner.skillId);
}
```

- [ ] **Step 5: Pass `tr` on in the three builders**

Apply this script from the worktree root (`python3 -`). Every replacement asserts its count; a wrong count means the file is not what the plan expects, so stop and ledger it instead of forcing it.

```python
import re

def edit(path, steps):
    s = open(path).read()
    for kind, old, new, count in steps:
        if kind == 'lit':
            assert s.count(old) == count, (path, old, s.count(old))
            s = s.replace(old, new)
        else:
            found = len(re.findall(old, s))
            assert found == count, (path, old, found)
            s = re.sub(old, new, s)
    open(path, 'w').write(s)

G = 'projects/app/src/app/game-board/'
CALL_CARD = r'cardName\((?!definitionId: string)([^()]*)\)'
CALL_SEAT = r'seatName\(([^()]*)\)'

edit(G + 'choice-description.ts', [
    ('lit', "const cardName = (definitionId: string) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);",
            "const cardName = (definitionId: string, tr: Translator) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId, tr);", 1),
    ('re', CALL_CARD, r'cardName(\1, tr)', 4),
    ('re', CALL_SEAT, r'seatName(\1, tr)', 7),
    ('lit', "suitLabel(shows.suit)", "suitLabel(shows.suit, tr)", 1),
])
edit(G + 'ability-description.ts', [
    ('lit', "const cardName = (definitionId: string) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);",
            "const cardName = (definitionId: string, tr: Translator) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId, tr);", 1),
    ('re', CALL_CARD, r'cardName(\1, tr)', 5),
    ('re', CALL_SEAT, r'seatName(\1, tr)', 3),
    ('lit', "generalDisplayName(generalId)", "generalDisplayName(generalId, tr)", 1),
])
edit(G + 'action-history.ts', [
    ('lit', "function cardName(definitionId: string): string {\n  return cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);\n}",
            "function cardName(definitionId: string, tr: Translator): string {\n  return cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId, tr);\n}", 1),
    ('re', CALL_CARD, r'cardName(\1, tr)', 14),
    ('lit', "seatName(players, seatId)", "seatName(players, seatId, tr)", 1),
    ('lit', "targetLabel(t, players)", "targetLabel(t, players, tr)", 1),
    ('lit', "generalDisplayName(id)", "generalDisplayName(id, tr)", 1),
])
```

Why the counts are what they are: `choice-description.ts` has 4 `cardName(` calls and 7 `seatName(` calls, `ability-description.ts` has 5 and 3, and `action-history.ts` has 14 calls plus the one definition. All of those calls sit inside functions that already have `tr` in scope.

- [ ] **Step 6: Give the two history Vietnamese specs explicit players, and add the nameless-seat test**

In `projects/app/src/app/game-board/action-history.vi.spec.ts`:
- Add this after the `const seats: Seat[] = [...]` declaration:

```ts
const players = [0, 1, 2, 3].map((i) => ({ id: `p${i}`, seatId: `seat-${i}`, kind: 'bot' as const, name: `Seat ${i}` }));
```

- Change `actionHistory(log, zones, [], seats, translator)` in `textsOf` to `actionHistory(log, zones, players, seats, translator)`.
- Change `actionHistory([{ kind: 'HealEvent', target: seat('seat-0'), amount: 1 }], zones, [], seats, tr)` to use `players` in place of the `[]`.
- Append this block at the end of the file:

```ts
describe('seats without a player name', () => {
  it('are named in the viewer’s language', () => {
    const log: EngineEvent[] = [{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(peach), targets: [] }];
    const texts = (translator?: typeof tr) => actionHistory(log, zones, [], seats, translator).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
    expect(texts(tr)).toEqual(['Người chơi 0 dùng Peach (Q ♥)']);
    expect(texts()).toEqual(['Seat 0 used Peach (Q ♥)']);
  });
});
```

In `projects/app/src/app/game-board/action-history.abilities.vi.spec.ts`:
- Add after the `seat` helper: `const players = [0, 1, 2, 3].map((i) => ({ id: \`p${i}\`, seatId: \`seat-${i}\`, kind: 'bot' as const, name: \`Seat ${i}\` }));`
- Change `actionHistory(log, [], [], [], translator)` in `lines` to `actionHistory(log, [], players, [], translator)`.
- Change `actionHistory([judgment('seat-1'), counts('seat-1', 'eight-trigrams')], [], [], [], tr)` to use `players` in place of the second `[]`.

- [ ] **Step 7: Run everything that touches the labels**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/labels.vi.spec.ts projects/app/src/app/labels.spec.ts projects/app/src/app/game-board/choice-description.spec.ts projects/app/src/app/game-board/choice-description.vi.spec.ts projects/app/src/app/game-board/ability-description.spec.ts projects/app/src/app/game-board/ability-description.vi.spec.ts projects/app/src/app/game-board/action-history.spec.ts projects/app/src/app/game-board/action-history.vi.spec.ts projects/app/src/app/game-board/action-history.abilities.vi.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with the four existing English specs unedited. If an English assertion fails, a template differs from the old string by a character: fix `en.ts`, never the existing spec.

- [ ] **Step 8: Typecheck app and specs, then run the whole app project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx tsc -p projects/app/tsconfig.spec.json --noEmit; npx jest --selectProjects app`
Expected: no type errors in the app build (this proves every key in the ternaries and the two `as const satisfies` maps exist in the catalog). The spec typecheck may report only the one error that existed before this plan, in `selection-dialog.spec.ts`; anything else is yours to fix. Every suite passes.

- [ ] **Step 9: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/labels.ts projects/app/src/app/labels.vi.spec.ts projects/app/src/app/game-board/choice-description.ts projects/app/src/app/game-board/ability-description.ts projects/app/src/app/game-board/action-history.ts projects/app/src/app/game-board/action-history.vi.spec.ts projects/app/src/app/game-board/action-history.abilities.vi.spec.ts
git commit -m "feat(app): labels build through the translator; the earlier builders pass it on

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (step 2e of the spec's "Translator-based builders"):
- `labels.ts` text helpers build through `tr` with an English default: Step 4.
- A nameless seat is named in the viewer's language ("Người chơi N", the user's glossary term): Steps 3 and 4, tested in Steps 1 and 6.
- Earlier builders now pass the translator to these helpers: Step 5.
- English byte-identical, existing specs unedited: Steps 7 and 8.
- Not in this plan, by design: the response description (2c), the `display.ts` prose (2d), card, ability and General names (phase 4), and the "At" text in `hand-view.ts` and the "Targeting" text in `target-label.ts` (phase 3).

**Placeholder scan:** none. Every file, key and script is shown in full.

**Type consistency:** every helper adds `tr` as its last parameter with the same default; the builder edits call `cardName(id, tr)`, `seatName(players, id, tr)`, `generalDisplayName(id, tr)`, `targetLabel(t, players, tr)` and `suitLabel(suit, tr)`, matching the signatures in Step 4. Catalog keys used in Step 4 all appear in Step 3 with the same placeholders in both languages.

**Review Focus:** each line has a test in Step 1: non-`seat-<digits>` ids and the empty name; the prefix agreeing with the full label; the unknown kingdom; all four suits; and builders printing English with no translator and Vietnamese fallbacks with one (Step 6).
