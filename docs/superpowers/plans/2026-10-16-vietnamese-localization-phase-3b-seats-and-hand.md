# Vietnamese Localization, Phase 3b (Seats, Hand and Info Dialogs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the second group of Game screen components to the language: the seat tile (the biggest text holder), the avatar and its skill buttons, the hand and its Play and Info buttons, the action list, the rich target label, the Choose Targets dialog, the playing card, and the card and General info dialogs. Their literal text becomes `t` pipe lookups and every label-helper call passes the live translator. English stays identical.

**Architecture:** The same pattern as plan 3a. Each component imports `TPipe` and injects `I18n`; static and attribute text become `{{ 'key' | t }}` and `[attr.…]="'key' | t"`; code that built text or called a helper passes `this.i18n.translator`. Three module-level helpers that built text gain a `tr` parameter (`labeled` and `groupPairs` in `hand-view.ts`, `toHalf` in `seat-avatar.ts`, `conversionAsName` in `action-list.ts`), and so do `avatarSkills` and `CardInfoDialog.nameFor`. Equipment slot names, card categories and card subtypes become catalog keys looked up by a typed `` `slot.${…}` `` or `` `card.category.${…}` `` key, so a missing value fails the compile. Card, ability and General names and the rules texts still come from the content data until phase 4.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Jest (`app` project), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` (phase 3)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-3` on branch `feat/vietnamese-phase-3`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. Every existing spec for these components (`seat-tile`, `hand-view`, `action-list`, `target-label`, `targets-dialog`, `playing-card`, `general-info-dialog`, `seat-avatar`, `avatar-skills`, `round-table`, `game-board`) must pass WITHOUT edits.
- A new catalog key needs an English entry and a Vietnamese entry with the same `{placeholders}` in the same commit (the `Messages` type and `catalogs.spec.ts` enforce it). Vietnamese follows the spec's glossary and is sentence case; Tướng and Sinh lực keep their capitals inside sentences. Existing English text is kept exactly as it is, including its casing and the odd "Choose 1 targets".
- Jest and `tsc` do not type-check Angular templates. The verification step therefore runs `npx ng build app --configuration development`, which does (strict templates). It needs `dist/engine` and `dist/content`, which exist in this worktree; if they are missing run `npx ng build engine && npx ng build content` first.
- Change only the components, `avatar-skills.ts`, `round-table.ts` (one call), `game-board.ts` (one call), the two catalogs and the new spec. Do NOT touch the response, ask, choice, selection, arrange, discard and compete dialogs or the general selection (plan 3c), `labels.ts`, or the builders.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the project: `npx jest --selectProjects app --maxWorkers=50%`.

## Review Focus

- A language switch changes an already-rendered seat tile (the whole stats and slot text) without re-creating it, and equipment slot titles are recomputed, not frozen.
- English wording of every converted piece is unchanged, including `HP 3/4`, `Cards in Hand: 4`, `Judgment Area: Capture as Sha`, `Form: Guan Yu (Fighting Saint)`, `Choose 2 targets for Sha` versus `Choose up to 2 targets for Sha`, and `Play Peach Targeting Seat 1` then `At Seat 2`.
- The typed keys (`slot.*`, `card.category.*`, `card.subtype.*`, `history.phase.*`) cover every value of their unions: all four equipment slots, all three categories, all four subtypes (`weapon`, `armor`, `horse`, `treasure`).
- The hidden sentinels read in the viewer's language: a hidden General ("Tướng ẩn", caption "Ẩn"), an own face-down General ("Guan Yu (ẩn)"), a hidden card ("Lá bài ẩn").
- No literal English is left in the converted components' templates, attribute text or TS-built strings (apart from CSS, icon names and the skill, card and General names that come from content data).

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/en.ts`, `vi.ts` | About 60 new keys: `ui.cancel/confirm`, `seat.*`, `slot.*`, `hand.*`, `actions.*`, `targets.*`, `card.category/subtype/range/noText`, `general.noSkills`, `avatar.*`. |
| `app/src/app/game-board/{seat-tile,hand-view,action-list,target-label,targets-dialog,playing-card,card-info-dialog,general-info-dialog,seat-avatar,avatar-skills}.ts` | Templates and calls go through the translator. |
| `app/src/app/game-board/{round-table,game-board}.ts` | One call each passes the translator on. |
| `app/src/app/game-board/seats-and-hand.vi.spec.ts` | New: each component in Vietnamese, plus a live language switch. |

---

### Task 1: Seats, hand and info dialogs through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, and the twelve files in the table above
- Test: `projects/app/src/app/game-board/seats-and-hand.vi.spec.ts` (new); the existing specs must pass unedited

**Interfaces:**
- Consumes: `TPipe`, `I18n`, the translator-aware `seatName`, `kingdomDisplayName`, `cardIdDisplayName`, `generalDisplayName`, `actionLabel`, `targetingParts`, `conversionLabel`, `targetLabel`; plan 3a's keys `ui.info`, `ui.close`.
- Produces: `avatarSkills(generals, registry, legal, extra?, tr?)`; `CardInfoDialog.nameFor(definitionId, registryName, tr?)`; the catalog keys in Step 3.

- [ ] **Step 1: Write the failing spec**

`projects/app/src/app/game-board/seats-and-hand.vi.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance, ContentRegistry, GameState, Seat } from 'engine';
import { I18n } from '../i18n/i18n.service';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { ActionList } from './action-list';
import { avatarSkills } from './avatar-skills';
import { CardInfoDialog } from './card-info-dialog';
import { GeneralInfoDialog } from './general-info-dialog';
import { HandView } from './hand-view';
import { PlayingCard } from './playing-card';
import { SeatAvatar } from './seat-avatar';
import { SeatTile } from './seat-tile';
import { TargetLabel } from './target-label';
import { TargetsDialog, TargetsDialogData } from './targets-dialog';

const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;
const text = (el: Element | null) => el!.textContent!.replace(/\s+/g, ' ').trim();

const closed: (string[] | undefined)[] = [];
beforeEach(async () => {
  localStorage.clear();
  closed.length = 0;
  TestBed.configureTestingModule({ providers: [{ provide: MatDialogRef, useValue: { close: (ids?: string[]) => closed.push(ids) } }] });
  await TestBed.inject(I18n).setLocale('vi');
});
afterEach(() => {
  localStorage.clear();
  overlay()?.replaceChildren();
});

const makeSeat = (overrides: Partial<Seat> = {}): Seat => ({
  id: 'seat-1', index: 1, kingdom: 'Wei',
  generals: { main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } },
  combinedHp: 3, maxCombinedHp: 4,
  hand: { zoneId: 'hand-1' }, equipped: { zoneId: 'equip-1' }, judgment: { zoneId: 'judgment-1' },
  eliminated: false,
  ...overrides,
});
const crossbow: CardInstance = { instanceId: 'bow', definitionId: 'crossbow', suit: 'diamond', rank: 1 };
const capture: CardInstance = { instanceId: 'cap', definitionId: 'capture', suit: 'spade', rank: 6 };
const sha: CardInstance = { instanceId: 'c-sha', definitionId: 'sha', suit: 'spade', rank: 7 };

describe('SeatTile in Vietnamese', () => {
  const render = (seat: Seat, inputs: Record<string, unknown> = {}) => {
    const fixture = TestBed.createComponent(SeatTile);
    fixture.componentRef.setInput('seat', seat);
    fixture.componentRef.setInput('name', 'Seat 1');
    fixture.componentRef.setInput('handCount', 4);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('sections, tags, stats and the four empty equipment slots', () => {
    const { el } = render(makeSeat(), { isViewer: true, isBot: true });
    expect(el.querySelector('section.general')!.getAttribute('aria-label')).toBe('Tướng');
    expect(text(el.querySelector('.you'))).toBe('(bạn)');
    expect(el.querySelector('.bot-icon')!.getAttribute('aria-label')).toBe('Người chơi máy');
    expect(text(el.querySelector('.kingdom'))).toBe('Ngụy');
    expect(text(el.querySelector('.stats'))).toContain('Sinh lực 3/4');
    expect(el.querySelector('.hand-count')!.getAttribute('title')).toBe('Bài trên tay');
    expect(el.querySelector('.hand-count')!.getAttribute('aria-label')).toBe('Bài trên tay: 4');
    expect(el.querySelector('section.equipment')!.getAttribute('aria-label')).toBe('Trang bị');
    expect(el.querySelector('section.judgment-section')!.getAttribute('aria-label')).toBe('Phán xét');
    expect(el.querySelector('.judgment')!.getAttribute('aria-label')).toBe('Khu phán xét');
    expect(['weapon', 'armor', 'defensiveMount', 'offensiveMount'].map((s) => el.querySelector(`[data-slot="${s}"]`)!.getAttribute('title'))).toEqual([
      'Vũ khí (trống)', 'Giáp (trống)', 'Ngựa phòng thủ (trống)', 'Ngựa tấn công (trống)',
    ]);
    expect(el.querySelector('.slot.empty[title]:not([data-slot])')!.getAttribute('title')).toBe('Khu phán xét (trống)');
  });

  it('a worn card and a judgment card, with and without "counts as"', () => {
    const worn = render(makeSeat(), { equipment: [crossbow] }).el;
    expect(worn.querySelector('[data-slot="weapon"]')!.getAttribute('title')).toBe('Vũ khí: Crossbow');
    expect(worn.querySelector('[data-slot="weapon"] .slot-card')!.getAttribute('aria-label')).toBe('Thông tin: Crossbow');
    const judged = render(makeSeat(), { judgment: [capture], judgmentCountsAs: { cap: 'sha' } }).el;
    expect(judged.querySelector('.judgment .slot')!.getAttribute('title')).toBe('Khu phán xét: Capture làm Sha');
    expect(text(judged.querySelector('.counts-as'))).toBe('Làm Sha');
    expect(render(makeSeat(), { judgment: [capture] }).el.querySelector('.judgment .slot')!.getAttribute('title')).toBe('Khu phán xét: Capture');
  });

  it('status lines, badges, the under-General piles and a chosen Form', () => {
    expect(text(render(makeSeat({ eliminated: true })).el.querySelector('.status'))).toBe('Bị loại');
    expect(text(render(makeSeat({ combinedHp: 0 })).el.querySelector('.status.dying'))).toBe('Cận kề cái chết…');
    expect(text(render(makeSeat(), { isResponding: true }).el.querySelector('.status'))).toBe('Đang đáp lại…');
    expect(text(render(makeSeat({ generals: null as never })).el.querySelector('.choosing'))).toBe('Đang chọn Tướng…');
    expect(text(render(makeSeat({ faceDown: true })).el.querySelector('.face-down-badge'))).toBe('Úp');
    expect(text(render(makeSeat({ silenced: true })).el.querySelector('.silenced-badge'))).toBe('Không có kỹ năng');
    const piles = render(makeSeat(), { pile: [sha], stash: [{ ...sha, instanceId: 'c-2' }] }).el;
    expect([...piles.querySelectorAll('.pile')].map((p) => p.getAttribute('aria-label'))).toEqual(['Dưới Tướng', 'Điền']);
    const form = { slot: 'main', held: [], chosen: { generalId: 'guan-yu', skillId: 'fighting-saint' } } as never;
    expect(text(render(makeSeat({ forms: form })).el.querySelector('.form-badge'))).toBe('Hóa thân: Guan Yu (Fighting Saint)');
  });

  it('follows a language switch without being re-created, slot titles included', async () => {
    const { fixture, el } = render(makeSeat(), { equipment: [crossbow] });
    await TestBed.inject(I18n).setLocale('en');
    await fixture.whenStable();
    expect(text(el.querySelector('.stats'))).toContain('HP 3/4');
    expect(el.querySelector('[data-slot="armor"]')!.getAttribute('title')).toBe('Armor (empty)');
    expect(el.querySelector('[data-slot="weapon"]')!.getAttribute('title')).toBe('Weapon: Crossbow');
    await TestBed.inject(I18n).setLocale('vi');
    await fixture.whenStable();
    expect(el.querySelector('[data-slot="armor"]')!.getAttribute('title')).toBe('Giáp (trống)');
  });
});

describe('SeatAvatar and the skill buttons in Vietnamese', () => {
  it('a hidden seat, an own face-down General, and a revealed one', () => {
    const render = (generals: { main: { generalDefinitionId: string; revealed: boolean }; deputy: { generalDefinitionId: string; revealed: boolean } }) => {
      const fixture = TestBed.createComponent(SeatAvatar);
      fixture.componentRef.setInput('generals', generals);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };
    const half = (el: HTMLElement, slot: string) => el.querySelector(`.half[data-slot="${slot}"]`) as HTMLButtonElement;
    const hidden = render({ main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } });
    expect(text(half(hidden, 'main').querySelector('.caption'))).toBe('Ẩn');
    expect(half(hidden, 'main').getAttribute('aria-label')).toBe('Tướng ẩn');
    const mixed = render({ main: { generalDefinitionId: 'guan-yu', revealed: false }, deputy: { generalDefinitionId: 'zhang-fei', revealed: true } });
    expect(text(half(mixed, 'main').querySelector('.caption'))).toBe('Guan Yu (ẩn)');
    expect(half(mixed, 'main').getAttribute('aria-label')).toBe('Thông tin: Guan Yu');
    expect(text(half(mixed, 'deputy').querySelector('.caption'))).toBe('Zhang Fei');
  });

  it('a hidden General’s skill button reads "Lật Tướng: …"', () => {
    const active = { canUse: () => true, start: () => [] };
    const registry: ContentRegistry = {
      cards: new Map(),
      generals: new Map([['sun-quan', { id: 'sun-quan', kingdom: 'Wu', maxHp: 4, skills: [{ id: 'reconsider', active }] }]]),
    };
    const generals = (revealed: boolean) => ({ main: { generalDefinitionId: 'sun-quan', revealed }, deputy: { generalDefinitionId: 'hidden', revealed: false } });
    const tr = makeTranslator(vi, 'vi');
    expect(avatarSkills(generals(false), registry, [], [], tr)[0].label).toBe('Lật Tướng: Reconsider');
    expect(avatarSkills(generals(false), registry, [])[0].label).toBe('Reveal: Reconsider');
    expect(avatarSkills(generals(true), registry, [], [], tr)[0].label).toBe('Reconsider');
  });
});

describe('HandView in Vietnamese', () => {
  const hand: CardInstance[] = [
    { instanceId: 'c-sha', definitionId: 'sha', suit: 'spade', rank: 7 },
    { instanceId: 'c-bow', definitionId: 'crossbow', suit: 'diamond', rank: 1 },
    { instanceId: 'c-peach', definitionId: 'peach', suit: 'heart', rank: 12 },
  ];
  const state = (): GameState => ({
    seats: [], players: [], log: [], pendingResponse: null, result: null, generalSelection: null,
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase: 'Play',
    zones: [{ id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: hand }], rng: { seed: 1, counter: 0 },
  });
  const registry: ContentRegistry = {
    generals: new Map(),
    cards: new Map([['sha', 'Sha'], ['crossbow', 'Crossbow'], ['peach', 'Peach']].map(([id, name]) => [id, { id, name, category: 'basic' as const, play: () => [] }])),
  };
  const at = (card: string, ...seats: string[]): Action => ({ kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: card, targets: seats.map((seatId) => ({ kind: 'seat' as const, seatId })) });

  const render = (cards: CardInstance[], actions: Action[]) => {
    const fixture = TestBed.createComponent(HandView);
    fixture.componentRef.setInput('cards', cards);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('state', state());
    fixture.componentRef.setInput('registry', registry);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };
  const card = (el: HTMLElement, id: string) => el.querySelector(`[data-card-id="${id}"]`) as HTMLElement;
  const items = () => [...overlay().querySelectorAll('button[mat-menu-item]')] as HTMLButtonElement[];

  it('Play and Info buttons, and the empty hand', () => {
    const { el } = render(hand, []);
    expect(text(card(el, 'c-sha').querySelector('button.play'))).toContain('Ra bài');
    expect(text(card(el, 'c-sha').querySelector('button.info'))).toContain('Thông tin');
    expect(text(render([], []).el.querySelector('.empty'))).toBe('Không có lá bài nào trên tay');
  });

  it('a menu of targets: each entry is the label then the target', async () => {
    const { fixture, el } = render(hand, [at('c-sha', 'seat-1'), at('c-sha', 'seat-2')]);
    (card(el, 'c-sha').querySelector('button.play') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(items().map((i) => text(i))).toEqual(['Ra Sha nhắm vào Người chơi 1', 'Ra Sha nhắm vào Người chơi 2']);
  });

  it('a two-seat play: the first seat, then "Vào" the second', async () => {
    const { fixture, el } = render(hand, [at('c-peach', 'seat-1', 'seat-0'), at('c-peach', 'seat-1', 'seat-2')]);
    (card(el, 'c-peach').querySelector('button.play') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const firsts = items();
    expect(firsts.map((i) => text(i))).toEqual(['Ra Peach nhắm vào Người chơi 1']);
    firsts[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(items().filter((i) => text(i).startsWith('Vào ')).map((i) => text(i))).toEqual(['Vào Người chơi 0', 'Vào Người chơi 2']);
  });

  it('the card info dialog: category, subtype, range and the missing rules text', async () => {
    const { fixture, el } = render(hand, []);
    (card(el, 'c-bow').querySelector('button.info') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = overlay().querySelector('app-card-info-dialog') as HTMLElement;
    expect(text(dialog.querySelector('.kind'))).toBe('Trang bị · Vũ khí · Tầm 1');
    expect(text(dialog.querySelector('button'))).toBe('Đóng');
    overlay().replaceChildren();
    (card(el, 'c-sha').querySelector('button.info') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const basic = overlay().querySelector('app-card-info-dialog') as HTMLElement;
    expect(text(basic.querySelector('.kind'))).toBe('Cơ bản');
    expect(text(basic.querySelector('.text'))).toBe('Chưa có nội dung luật.');
  });
});

describe('ActionList, TargetLabel and the playing card in Vietnamese', () => {
  it('an ordinary action reads in Vietnamese, and a conversion offers its targets under "Nhắm vào"', async () => {
    const state: GameState = {
      seats: [], players: [], log: [], pendingResponse: null, result: null, generalSelection: null,
      turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase: 'Play', rng: { seed: 1, counter: 0 },
      zones: [{ id: 'equip-0', kind: 'equip', ownerSeatId: 'seat-0', cards: [{ instanceId: 'sp', definitionId: 'serpent-spear', suit: 'spade', rank: 12 }] }],
    };
    const registry: ContentRegistry = {
      cards: new Map([
        ['sha', { id: 'sha', name: 'Sha', category: 'basic' as const, play: () => [] }],
        ['serpent-spear', { id: 'serpent-spear', name: 'Serpent Spear', category: 'equipment' as const, equipSlot: 'weapon' as const, play: () => [], abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' as const }] } }],
      ]),
      generals: new Map(),
    };
    const convert: Action = {
      kind: 'UseConversionAction', seatId: 'seat-0', targets: [{ kind: 'seat', seatId: 'seat-1' }],
      via: { owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'sp' }, conversionId: 'serpent-spear' },
    };
    const fixture = TestBed.createComponent(ActionList);
    fixture.componentRef.setInput('actions', [{ kind: 'EndPhaseAction', seatId: 'seat-0' }, convert]);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('registry', registry);
    fixture.detectChanges();
    const buttons = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map((b) => text(b));
    expect(buttons).toEqual(['Kết thúc giai đoạn', 'Dùng 2 lá bài làm Sha']);
    ((fixture.nativeElement as HTMLElement).querySelector('button.conversion') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect([...overlay().querySelectorAll('button[mat-menu-item]')].map((i) => text(i))).toEqual(['Nhắm vào Người chơi 1']);
  });

  it('the target label names a nameless seat and its revealed Generals in Vietnamese', () => {
    const seat = (id: string, kingdom: string, main: string, deputy: string, deputyRevealed: boolean) => ({
      id, kingdom, generals: { main: { generalDefinitionId: main, revealed: true }, deputy: { generalDefinitionId: deputy, revealed: deputyRevealed } },
    });
    const state = { players: [{ seatId: 'seat-2', name: 'Bot' }], seats: [seat('seat-2', 'Wei', 'cao-cao', 'sima-yi', true), seat('seat-3', 'Shu', 'liu-bei', 'hidden', false)] } as unknown as GameState;
    const fixture = TestBed.createComponent(TargetLabel);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('prefix', 'Nhắm vào');
    fixture.componentRef.setInput('targets', [{ kind: 'seat', seatId: 'seat-2' }, { kind: 'seat', seatId: 'seat-3' }]);
    fixture.detectChanges();
    expect(text(fixture.nativeElement as HTMLElement)).toBe('Nhắm vào Bot Cao Cao - Sima Yi, Người chơi 3 Liu Bei');
  });

  it('the playing card names a hidden card in Vietnamese', () => {
    const fixture = TestBed.createComponent(PlayingCard);
    fixture.componentRef.setInput('card', { instanceId: 'h', definitionId: 'hidden', suit: 'spade', rank: 0 });
    fixture.detectChanges();
    expect(text((fixture.nativeElement as HTMLElement).querySelector('.name'))).toBe('Lá bài ẩn');
  });
});

describe('the Choose Targets and General info dialogs in Vietnamese', () => {
  it('Choose Targets: title, both prompts, seat names and buttons', () => {
    const open = (min: number, max: number) => {
      const data: TargetsDialogData = { title: 'Sha', pick: { eligibleIds: ['seat-0', 'seat-2'], min, max }, state: { players: [{ id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' }] } as unknown as GameState };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: () => undefined } }] });
      return TestBed.inject(I18n).setLocale('vi').then(() => {
        const fixture = TestBed.createComponent(TargetsDialog);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
      });
    };
    return open(1, 2).then(async (el) => {
      expect(text(el.querySelector('h2'))).toBe('Chọn mục tiêu');
      expect(text(el.querySelector('p'))).toBe('Chọn tối đa 2 mục tiêu cho Sha');
      expect([...el.querySelectorAll('.seats button')].map((b) => text(b))).toEqual(['Hing', 'Người chơi 2']);
      expect([...el.querySelectorAll('mat-dialog-actions button')].map((b) => text(b))).toEqual(['Hủy', 'Xác nhận']);
      const exact = await open(2, 2);
      expect(text(exact.querySelector('p'))).toBe('Chọn 2 mục tiêu cho Sha');
    });
  });

  it('General info: an unknown General reads as an empty state, with Đóng', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: { generalDefinitionId: 'hidden' } }] });
    return TestBed.inject(I18n).setLocale('vi').then(() => {
      const fixture = TestBed.createComponent(GeneralInfoDialog);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(text(el.querySelector('h2'))).toBe('Tướng ẩn');
      expect(text(el.querySelector('.empty'))).toBe('Không có kỹ năng nào.');
      expect(text(el.querySelector('button'))).toBe('Đóng');
    });
  });
});

describe('CardInfoDialog.nameFor', () => {
  it('names a hidden card in the translator’s language, and keeps English without one', () => {
    expect(CardInfoDialog.nameFor('hidden', undefined)).toBe('Hidden Card');
    expect(CardInfoDialog.nameFor('hidden', undefined, makeTranslator(vi, 'vi'))).toBe('Lá bài ẩn');
    expect(CardInfoDialog.nameFor('sha', undefined, makeTranslator(vi, 'vi'))).toBe('Sha');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/seats-and-hand.vi.spec.ts`
Expected: FAIL: the components still render English and the helpers ignore a translator. If a test fails for a fixture or type reason (a `Seat` field, the `forms` shape, a menu not opening), compare it with `seat-tile.spec.ts`, `hand-view.spec.ts` or `action-list.spec.ts` and fix the fixture, not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, append inside the object (after the last existing entry, before `} satisfies`):

```ts
  'ui.cancel': 'Cancel',
  'ui.confirm': 'Confirm',
  'seat.generalAria': 'General',
  'seat.computerAria': 'Computer player',
  'seat.you': '(you)',
  'seat.choosing': 'Choosing Generals…',
  'seat.faceDown': 'Face Down',
  'seat.underGeneral': 'Under General',
  'seat.farms': 'Farms',
  'seat.form': 'Form: {form}',
  'seat.formName': '{general} ({skill})',
  'seat.formFallback': 'Form',
  'seat.noSkills': 'No Skills',
  'seat.hp': 'HP {hp}/{max}',
  'seat.handTitle': 'Cards in Hand',
  'seat.handAria': 'Cards in Hand: {n}',
  'seat.equipment': 'Equipment',
  'seat.judgment': 'Judgment',
  'seat.judgmentArea': 'Judgment Area',
  'seat.slotTitle': '{slot}: {card}',
  'seat.slotEmpty': '{slot} (empty)',
  'seat.judgmentTitle': 'Judgment Area: {card}',
  'seat.judgmentTitleAs': 'Judgment Area: {card} as {as}',
  'seat.countsAs': 'As {card}',
  'seat.judgmentEmpty': 'Judgment Area (empty)',
  'seat.eliminated': 'Eliminated',
  'seat.dying': 'Dying…',
  'seat.responding': 'Responding…',
  'slot.weapon': 'Weapon',
  'slot.armor': 'Armor',
  'slot.defensiveMount': 'Defensive Mount',
  'slot.offensiveMount': 'Offensive Mount',
  'hand.play': 'Play',
  'hand.info': 'Info',
  'hand.empty': 'No cards in hand',
  'hand.at': 'At',
  'hand.atTarget': 'At {target}',
  'actions.targeting': 'Targeting',
  'actions.targetingList': 'Targeting {targets}',
  'actions.theCard': 'the Card',
  'targets.title': 'Choose Targets',
  'targets.prompt': 'Choose {count} targets for {title}',
  'targets.promptUpTo': 'Choose up to {count} targets for {title}',
  'card.category.basic': 'Basic',
  'card.category.tool': 'Tool',
  'card.category.equipment': 'Equipment',
  'card.subtype.weapon': 'Weapon',
  'card.subtype.armor': 'Armor',
  'card.subtype.horse': 'Horse',
  'card.subtype.treasure': 'Treasure',
  'card.range': 'Range {n}',
  'card.noText': 'No rules text available yet.',
  'general.noSkills': 'No skills listed.',
  'avatar.hidden': 'Hidden',
  'avatar.hiddenOwn': '{name} (hidden)',
  'avatar.revealSkill': 'Reveal: {name}',
```

and in `projects/app/src/app/i18n/vi.ts`, append inside the object (after the last existing entry, before `};`):

```ts
  'ui.cancel': 'Hủy',
  'ui.confirm': 'Xác nhận',
  'seat.generalAria': 'Tướng',
  'seat.computerAria': 'Người chơi máy',
  'seat.you': '(bạn)',
  'seat.choosing': 'Đang chọn Tướng…',
  'seat.faceDown': 'Úp',
  'seat.underGeneral': 'Dưới Tướng',
  'seat.farms': 'Điền',
  'seat.form': 'Hóa thân: {form}',
  'seat.formName': '{general} ({skill})',
  'seat.formFallback': 'Hóa thân',
  'seat.noSkills': 'Không có kỹ năng',
  'seat.hp': 'Sinh lực {hp}/{max}',
  'seat.handTitle': 'Bài trên tay',
  'seat.handAria': 'Bài trên tay: {n}',
  'seat.equipment': 'Trang bị',
  'seat.judgment': 'Phán xét',
  'seat.judgmentArea': 'Khu phán xét',
  'seat.slotTitle': '{slot}: {card}',
  'seat.slotEmpty': '{slot} (trống)',
  'seat.judgmentTitle': 'Khu phán xét: {card}',
  'seat.judgmentTitleAs': 'Khu phán xét: {card} làm {as}',
  'seat.countsAs': 'Làm {card}',
  'seat.judgmentEmpty': 'Khu phán xét (trống)',
  'seat.eliminated': 'Bị loại',
  'seat.dying': 'Cận kề cái chết…',
  'seat.responding': 'Đang đáp lại…',
  'slot.weapon': 'Vũ khí',
  'slot.armor': 'Giáp',
  'slot.defensiveMount': 'Ngựa phòng thủ',
  'slot.offensiveMount': 'Ngựa tấn công',
  'hand.play': 'Ra bài',
  'hand.info': 'Thông tin',
  'hand.empty': 'Không có lá bài nào trên tay',
  'hand.at': 'Vào',
  'hand.atTarget': 'Vào {target}',
  'actions.targeting': 'Nhắm vào',
  'actions.targetingList': 'Nhắm vào {targets}',
  'actions.theCard': 'lá bài',
  'targets.title': 'Chọn mục tiêu',
  'targets.prompt': 'Chọn {count} mục tiêu cho {title}',
  'targets.promptUpTo': 'Chọn tối đa {count} mục tiêu cho {title}',
  'card.category.basic': 'Cơ bản',
  'card.category.tool': 'Cẩm nang',
  'card.category.equipment': 'Trang bị',
  'card.subtype.weapon': 'Vũ khí',
  'card.subtype.armor': 'Giáp',
  'card.subtype.horse': 'Ngựa',
  'card.subtype.treasure': 'Bảo vật',
  'card.range': 'Tầm {n}',
  'card.noText': 'Chưa có nội dung luật.',
  'general.noSkills': 'Không có kỹ năng nào.',
  'avatar.hidden': 'Ẩn',
  'avatar.hiddenOwn': '{name} (ẩn)',
  'avatar.revealSkill': 'Lật Tướng: {name}',
```

- [ ] **Step 4: Convert the components**

Apply this script from the worktree root (`python3 -`). Every replacement asserts its count; a wrong count means a file is not what the plan expects, so stop and ledger it instead of forcing it.

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

def wire(path, pipe=True):
    add_import(path, "import { I18n } from '../i18n/i18n.service';")
    if pipe:
        add_import(path, "import { TPipe } from '../i18n/t.pipe';")
        add_to_imports(path, 'TPipe')
    ensure_core(path, 'inject')

def t(key):
    return "{{ '%s' | t }}" % key

# --- seat-tile.ts
p = G + 'seat-tile.ts'
wire(p)
add_import(p, "import type { MessageKey } from '../i18n/messages';")
swap(p, """const SLOT_LABELS: Record<EquipSlot, { label: string; icon: string }> = {
  weapon: { label: 'Weapon', icon: 'gavel' },
  armor: { label: 'Armor', icon: 'shield' },
  defensiveMount: { label: 'Defensive Mount', icon: 'add' },
  offensiveMount: { label: 'Offensive Mount', icon: 'remove' },
};""", """const SLOT_LABELS: Record<EquipSlot, { label: MessageKey; icon: string }> = {
  weapon: { label: 'slot.weapon', icon: 'gavel' },
  armor: { label: 'slot.armor', icon: 'shield' },
  defensiveMount: { label: 'slot.defensiveMount', icon: 'add' },
  offensiveMount: { label: 'slot.offensiveMount', icon: 'remove' },
};""")
swap(p, '<section class="panel general" aria-label="General">', '<section class="panel general" [attr.aria-label]="\'seat.generalAria\' | t">')
swap(p, '<mat-icon class="bot-icon" aria-label="Computer player">smart_toy</mat-icon>', '<mat-icon class="bot-icon" [attr.aria-label]="\'seat.computerAria\' | t">smart_toy</mat-icon>')
swap(p, '<span class="you">(you)</span>', '<span class="you">' + t('seat.you') + '</span>')
swap(p, '<span class="choosing">Choosing Generals…</span>', '<span class="choosing">' + t('seat.choosing') + '</span>')
swap(p, '<span class="face-down-badge">Face Down</span>', '<span class="face-down-badge">' + t('seat.faceDown') + '</span>')
swap(p, '<div class="pile" aria-label="Under General">', '<div class="pile" [attr.aria-label]="\'seat.underGeneral\' | t">')
swap(p, '<div class="pile" aria-label="Farms">', '<div class="pile" [attr.aria-label]="\'seat.farms\' | t">')
swap(p, '<span class="form-badge">Form: {{ form }}</span>', '<span class="form-badge">{{ \'seat.form\' | t: { form: form } }}</span>')
swap(p, '<span class="silenced-badge">No Skills</span>', '<span class="silenced-badge">' + t('seat.noSkills') + '</span>')
swap(p, '{{ kingdomDisplayName(seat().kingdom) }}', '{{ kingdomName(seat().kingdom) }}')
swap(p, '<span>HP {{ seat().combinedHp }}/{{ seat().maxCombinedHp }}</span>', '<span>{{ \'seat.hp\' | t: { hp: seat().combinedHp, max: seat().maxCombinedHp } }}</span>')
swap(p, """<span class="hand-count" title="Cards in Hand" [attr.aria-label]="'Cards in Hand: ' + handCount()">""",
        """<span class="hand-count" [attr.title]="'seat.handTitle' | t" [attr.aria-label]="'seat.handAria' | t: { n: handCount() }">""")
swap(p, '<section class="panel equipment" aria-label="Equipment">', '<section class="panel equipment" [attr.aria-label]="\'seat.equipment\' | t">')
swap(p, """[attr.title]="s.card ? s.label + ': ' + cardIdDisplayName(s.card.definitionId) : s.label + ' (empty)'\"""",
        """[attr.title]="s.card ? ('seat.slotTitle' | t: { slot: s.label, card: cardName(s.card.definitionId) }) : ('seat.slotEmpty' | t: { slot: s.label })\"""")
swap(p, """[attr.aria-label]="'Info: ' + cardIdDisplayName(card.definitionId)\"""", """[attr.aria-label]="'ui.info' | t: { name: cardName(card.definitionId) }\"""", 2)
swap(p, '<section class="panel judgment-section" aria-label="Judgment">', '<section class="panel judgment-section" [attr.aria-label]="\'seat.judgment\' | t">')
swap(p, '<div class="judgment" aria-label="Judgment Area">', '<div class="judgment" [attr.aria-label]="\'seat.judgmentArea\' | t">')
swap(p, """[attr.title]="'Judgment Area: ' + cardIdDisplayName(card.definitionId) + (countsAs ? ' as ' + cardIdDisplayName(countsAs) : '')\"""",
        """[attr.title]="countsAs ? ('seat.judgmentTitleAs' | t: { card: cardName(card.definitionId), as: cardName(countsAs) }) : ('seat.judgmentTitle' | t: { card: cardName(card.definitionId) })\"""")
swap(p, '<span class="counts-as">As {{ cardIdDisplayName(countsAs) }}</span>', '<span class="counts-as">{{ \'seat.countsAs\' | t: { card: cardName(countsAs) } }}</span>')
swap(p, '<div class="slot empty" title="Judgment Area (empty)">', '<div class="slot empty" [attr.title]="\'seat.judgmentEmpty\' | t">')
swap(p, '[attr.data-force]="force()">Eliminated</div>', '[attr.data-force]="force()">' + t('seat.eliminated') + '</div>')
swap(p, '[attr.data-force]="force()">Dying…</div>', '[attr.data-force]="force()">' + t('seat.dying') + '</div>')
swap(p, '[attr.data-force]="force()">Responding…</div>', '[attr.data-force]="force()">' + t('seat.responding') + '</div>')
swap(p, "    return chosen ? `${generalDisplayData(chosen.generalId)?.name ?? 'Form'} (${abilityName(chosen.skillId)})` : null;",
        "    return chosen ? this.i18n.t('seat.formName', { general: generalDisplayData(chosen.generalId)?.name ?? this.i18n.t('seat.formFallback'), skill: abilityName(chosen.skillId) }) : null;")
swap(p, "  private readonly dialog = inject(MatDialog);\n", "  private readonly dialog = inject(MatDialog);\n  private readonly i18n = inject(I18n);\n")
swap(p, "CardInfoDialog.nameFor(card.definitionId, undefined),", "CardInfoDialog.nameFor(card.definitionId, undefined, this.i18n.translator),")
swap(p, "      ...SLOT_LABELS[slot],\n", "      label: this.i18n.t(SLOT_LABELS[slot].label),\n      icon: SLOT_LABELS[slot].icon,\n")
swap(p, "  protected readonly cardIdDisplayName = cardIdDisplayName;\n\n  protected readonly kingdomDisplayName = kingdomDisplayName;",
        "  protected cardName(definitionId: string): string {\n    return cardIdDisplayName(definitionId, this.i18n.translator);\n  }\n\n"
        "  protected kingdomName(kingdom: Parameters<typeof kingdomDisplayName>[0]): string {\n    return kingdomDisplayName(kingdom, this.i18n.translator);\n  }")

# --- hand-view.ts
p = G + 'hand-view.ts'
wire(p)
add_import(p, "import type { Translator } from '../i18n/translator';")
swap(p, "function labeled(action: Action, state: GameState, registry: ContentRegistry): LabeledPlay {\n  return { action, label: actionLabel(action, state, registry), targeting: targetingParts(action, state, registry) };\n}",
        "function labeled(action: Action, state: GameState, registry: ContentRegistry, tr: Translator): LabeledPlay {\n  return { action, label: actionLabel(action, state, registry, tr), targeting: targetingParts(action, state, registry, tr) };\n}")
swap(p, "function groupPairs(plays: PlayCard[], state: GameState, registry: ContentRegistry): NonNullable<HandCardViewModel['pairs']> {",
        "function groupPairs(plays: PlayCard[], state: GameState, registry: ContentRegistry, tr: Translator): NonNullable<HandCardViewModel['pairs']> {")
swap(p, "labeled({ ...play, targets: [first] }, state, registry)", "labeled({ ...play, targets: [first] }, state, registry, tr)")
swap(p, "label: `At ${targetLabel(second, state.players)}`, targeting: { prefix: 'At', targets: [second] }",
        "label: tr('hand.atTarget', { target: targetLabel(second, state.players, tr) }), targeting: { prefix: tr('hand.at'), targets: [second] }")
swap(p, "<mat-icon>play_arrow</mat-icon> Play", "<mat-icon>play_arrow</mat-icon> " + t('hand.play'), 4)
swap(p, "<mat-icon>info</mat-icon> Info", "<mat-icon>info</mat-icon> " + t('hand.info'))
swap(p, '<span class="empty">No cards in hand</span>', '<span class="empty">' + t('hand.empty') + '</span>')
swap(p, "  private readonly dialog = inject(MatDialog);\n", "  private readonly dialog = inject(MatDialog);\n  private readonly i18n = inject(I18n);\n")
swap(p, "groupPairs(plays, this.state(), this.registry())", "groupPairs(plays, this.state(), this.registry(), this.i18n.translator)")
swap(p, "labeled(action, this.state(), this.registry())", "labeled(action, this.state(), this.registry(), this.i18n.translator)")
swap(p, "this.registry().cards.get(card.definitionId)?.name)", "this.registry().cards.get(card.definitionId)?.name, this.i18n.translator)")

# --- action-list.ts
p = G + 'action-list.ts'
wire(p)
add_import(p, "import type { Translator } from '../i18n/translator';")
swap(p, 'prefix="Targeting"', '[prefix]="\'actions.targeting\' | t"')
swap(p, "  private readonly dialog = inject(MatDialog);\n", "  private readonly dialog = inject(MatDialog);\n  private readonly i18n = inject(I18n);\n")
swap(p, "actionLabel(action, this.state(), this.registry())", "actionLabel(action, this.state(), this.registry(), this.i18n.translator)")
swap(p, "conversionLabel({ ...action, targets: [] }, this.state(), this.registry())", "conversionLabel({ ...action, targets: [] }, this.state(), this.registry(), this.i18n.translator)")
swap(p, "conversionAsName(action, this.state(), this.registry())", "conversionAsName(action, this.state(), this.registry(), this.i18n.translator)")
swap(p, "label: `Targeting ${action.targets.map((t) => targetLabel(t, this.state().players)).join(', ')}`",
        "label: this.i18n.t('actions.targetingList', { targets: action.targets.map((t) => targetLabel(t, this.state().players, this.i18n.translator)).join(', ') })")
swap(p, "function conversionAsName(action: UseConversion, state: GameState, registry: ContentRegistry): string {", "function conversionAsName(action: UseConversion, state: GameState, registry: ContentRegistry, tr: Translator): string {")
swap(p, "?? 'the Card';", "?? tr('actions.theCard');")

# --- target-label.ts (no static text; the helpers take the translator)
p = G + 'target-label.ts'
add_import(p, "import { I18n } from '../i18n/i18n.service';")
ensure_core(p, 'inject')
swap(p, "  readonly state = input.required<GameState>();\n", "  readonly state = input.required<GameState>();\n\n  private readonly i18n = inject(I18n);\n")
swap(p, "targetLabel(target, state.players)", "targetLabel(target, state.players, this.i18n.translator)")
swap(p, "generalDisplayName(g.generalDefinitionId)", "generalDisplayName(g.generalDefinitionId, this.i18n.translator)")

# --- targets-dialog.ts
p = G + 'targets-dialog.ts'
wire(p)
swap(p, '<h2 mat-dialog-title>Choose Targets</h2>', '<h2 mat-dialog-title>' + t('targets.title') + '</h2>')
swap(p, '(click)="ref.close()">Cancel</button>', '(click)="ref.close()">' + t('ui.cancel') + '</button>')
swap(p, '(click)="confirm()">Confirm</button>', '(click)="confirm()">' + t('ui.confirm') + '</button>')
swap(p, "  protected readonly ref = inject<MatDialogRef<TargetsDialog, string[]>>(MatDialogRef);\n", "  protected readonly ref = inject<MatDialogRef<TargetsDialog, string[]>>(MatDialogRef);\n  private readonly i18n = inject(I18n);\n")
swap(p, "  protected readonly prompt = `Choose ${this.data.pick.min === this.data.pick.max ? '' : 'up to '}${this.data.pick.max} targets for ${this.data.title}`;",
        "  protected readonly prompt = this.i18n.t(this.data.pick.min === this.data.pick.max ? 'targets.prompt' : 'targets.promptUpTo', { count: this.data.pick.max, title: this.data.title });")
swap(p, "seatName(this.data.state.players, id)", "seatName(this.data.state.players, id, this.i18n.translator)")

# --- playing-card.ts
p = G + 'playing-card.ts'
wire(p)
swap(p, """[attr.title]="name() + ' (' + face() + ')'\"""", """[attr.title]="'card.named' | t: { name: name(), face: face() }\"""")
swap(p, "  readonly size = input<'normal' | 'small' | 'large'>('normal');\n", "  readonly size = input<'normal' | 'small' | 'large'>('normal');\n\n  private readonly i18n = inject(I18n);\n")
swap(p, "cardIdDisplayName(this.card().definitionId)", "cardIdDisplayName(this.card().definitionId, this.i18n.translator)")

# --- card-info-dialog.ts
p = G + 'card-info-dialog.ts'
wire(p)
add_import(p, "import { englishTranslator, Translator } from '../i18n/translator';")
swap(p, "{{ capitalise(d.category) }}@if (d.subtype) { · {{ capitalise(d.subtype) }} }@if (d.range !== null) { · Range {{ d.range }} }",
        "{{ categoryName(d.category) }}@if (d.subtype) { · {{ subtypeName(d.subtype) }} }@if (d.range !== null) { · {{ 'card.range' | t: { n: d.range } }} }")
swap(p, "<p class=\"text\">{{ d.text ?? 'No rules text available yet.' }}</p>", "<p class=\"text\">{{ d.text ?? ('card.noText' | t) }}</p>")
swap(p, '<p class="text">No rules text available yet.</p>', '<p class="text">' + t('card.noText') + '</p>')
swap(p, '<button mat-button mat-dialog-close type="button">Close</button>', '<button mat-button mat-dialog-close type="button">' + t('ui.close') + '</button>')
swap(p, "  protected readonly data = inject<CardInfoDialogData>(MAT_DIALOG_DATA);\n", "  protected readonly data = inject<CardInfoDialogData>(MAT_DIALOG_DATA);\n  private readonly i18n = inject(I18n);\n")
swap(p, "  protected capitalise(word: string): string {\n    return word.charAt(0).toUpperCase() + word.slice(1);\n  }",
        "  protected categoryName(category: CardDisplayData['category']): string {\n    return this.i18n.t(`card.category.${category}` as const);\n  }\n\n"
        "  protected subtypeName(subtype: NonNullable<CardDisplayData['subtype']>): string {\n    return this.i18n.t(`card.subtype.${subtype}` as const);\n  }")
swap(p, "  static nameFor(definitionId: string, registryName: string | undefined): string {\n    return cardDisplayData(definitionId)?.name ?? registryName ?? cardIdDisplayName(definitionId);",
        "  static nameFor(definitionId: string, registryName: string | undefined, tr: Translator = englishTranslator): string {\n    return cardDisplayData(definitionId)?.name ?? registryName ?? cardIdDisplayName(definitionId, tr);")
swap(p, "import { cardDisplayData } from 'content';", "import { CardDisplayData, cardDisplayData } from 'content';")

# --- general-info-dialog.ts
p = G + 'general-info-dialog.ts'
wire(p)
swap(p, '<p class="empty">No skills listed.</p>', '<p class="empty">' + t('general.noSkills') + '</p>')
swap(p, '<button mat-button mat-dialog-close>Close</button>', '<button mat-button mat-dialog-close>' + t('ui.close') + '</button>')
swap(p, "  protected readonly data = inject<GeneralInfoDialogData>(MAT_DIALOG_DATA);\n", "  protected readonly data = inject<GeneralInfoDialogData>(MAT_DIALOG_DATA);\n  private readonly i18n = inject(I18n);\n")
swap(p, "generalDisplayName(this.data.generalDefinitionId)", "generalDisplayName(this.data.generalDefinitionId, this.i18n.translator)")

# --- seat-avatar.ts
p = G + 'seat-avatar.ts'
wire(p)
add_import(p, "import type { Translator } from '../i18n/translator';")
swap(p, "function toHalf(slot: 'main' | 'deputy', general: GeneralInstance): AvatarHalf {", "function toHalf(slot: 'main' | 'deputy', general: GeneralInstance, tr: Translator): AvatarHalf {")
swap(p, "caption: 'Hidden', name: 'Hidden General' }", "caption: tr('avatar.hidden'), name: generalDisplayName(id, tr) }")
swap(p, "generalDisplayData(id)?.name ?? generalDisplayName(id);", "generalDisplayData(id)?.name ?? generalDisplayName(id, tr);")
swap(p, "caption: ownHidden ? `${name} (hidden)` : name", "caption: ownHidden ? tr('avatar.hiddenOwn', { name }) : name")
swap(p, """[attr.aria-label]="h.masked ? h.name : 'Info: ' + h.name\"""", """[attr.aria-label]="h.masked ? h.name : ('ui.info' | t: { name: h.name })\"""")
swap(p, "  protected readonly slots = ['main', 'deputy'] as const;\n", "  private readonly i18n = inject(I18n);\n  protected readonly slots = ['main', 'deputy'] as const;\n")
swap(p, "[toHalf('main', this.generals().main), toHalf('deputy', this.generals().deputy)]", "[toHalf('main', this.generals().main, this.i18n.translator), toHalf('deputy', this.generals().deputy, this.i18n.translator)]")

# --- avatar-skills.ts
p = G + 'avatar-skills.ts'
add_import(p, "import { englishTranslator, Translator } from '../i18n/translator';")
swap(p, "extra: readonly ExtraSkill[] = []): AvatarSkill[] {", "extra: readonly ExtraSkill[] = [], tr: Translator = englishTranslator): AvatarSkill[] {")
swap(p, "label: general.revealed ? name : `Reveal: ${name}`", "label: general.revealed ? name : tr('avatar.revealSkill', { name })")

# --- the two callers
swap(G + 'game-board.ts', "extraSkillsOf(seat, this.gameService.registry)) : [];", "extraSkillsOf(seat, this.gameService.registry), this.i18n.translator) : [];")
swap(G + 'round-table.ts', "CardInfoDialog.nameFor(card.definitionId, undefined);", "CardInfoDialog.nameFor(card.definitionId, undefined, this.i18n.translator);")
```

Notes on the script: `wire()` adds `TPipe` to the first `imports: […]` array of the component (each file has exactly one `@Component`, except `action-history-panel` and `discard-pile`, which this plan does not touch); `target-label.ts` has no static text, so it only gets `I18n`. `card-info-dialog.ts` imports `CardDisplayData` from `content`, where it is already exported.

- [ ] **Step 5: Run the new spec and every existing spec for these components**

Run: `npx jest --selectProjects app --maxWorkers=50% --runTestsByPath projects/app/src/app/game-board/seats-and-hand.vi.spec.ts projects/app/src/app/game-board/seat-tile.spec.ts projects/app/src/app/game-board/hand-view.spec.ts projects/app/src/app/game-board/action-list.spec.ts projects/app/src/app/game-board/target-label.spec.ts projects/app/src/app/game-board/targets-dialog.spec.ts projects/app/src/app/game-board/playing-card.spec.ts projects/app/src/app/game-board/general-info-dialog.spec.ts projects/app/src/app/game-board/seat-avatar.spec.ts projects/app/src/app/game-board/avatar-skills.spec.ts projects/app/src/app/game-board/round-table.spec.ts projects/app/src/app/game-board/game-board.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with the existing specs unedited. If an existing English assertion fails, a template or a param differs from the old string by a character: fix the replacement, never the existing spec.

- [ ] **Step 6: Typecheck, build the app (strict templates), check the specs, then run the whole project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx ng build app --configuration development && npx tsc -p projects/app/tsconfig.spec.json --noEmit; npx jest --selectProjects app --maxWorkers=50%`
Expected: no type errors; the build completes (it proves every pipe key, the typed `slot.*`/`card.category.*`/`card.subtype.*` keys and the `{ form: form }` object literal under strict templates); the spec typecheck reports only the one older `selection-dialog.spec.ts` error (anything in the new spec is yours to fix); every suite passes. If the build reports a nullable value passed to a pipe parameter (as `seconds()` did in plan 3a), add a `!` only where an enclosing `@if` guarantees it, and ledger a ruling.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/game-board/seat-tile.ts projects/app/src/app/game-board/hand-view.ts projects/app/src/app/game-board/action-list.ts projects/app/src/app/game-board/target-label.ts projects/app/src/app/game-board/targets-dialog.ts projects/app/src/app/game-board/playing-card.ts projects/app/src/app/game-board/card-info-dialog.ts projects/app/src/app/game-board/general-info-dialog.ts projects/app/src/app/game-board/seat-avatar.ts projects/app/src/app/game-board/avatar-skills.ts projects/app/src/app/game-board/game-board.ts projects/app/src/app/game-board/round-table.ts projects/app/src/app/game-board/seats-and-hand.vi.spec.ts
git commit -m "feat(app): seats, hand and info dialogs follow the language

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (the second group of phase 3):
- The seat tile, avatar and skill buttons, hand, action list, target label, Choose Targets dialog, playing card and the card and General info dialogs take their text from the catalog and pass the translator to every label helper: Step 4.
- Equipment slots, card categories and subtypes are typed catalog keys: Steps 3 and 4.
- English is identical and the existing specs are unedited: Steps 5 and 6.
- Vietnamese is exercised on every component, including a live switch on the seat tile: Step 1.
- Not in this plan, by design: the response, ask, choice, selection, arrange, discard and compete dialogs and the general selection (plan 3c); card, ability and General names and rules text (phase 4).

**Placeholder scan:** none. Every key, every replacement and the whole spec are shown.

**Type consistency:** every key used by the script appears in Step 3 with the same placeholders in both languages. `labeled`, `groupPairs`, `toHalf`, `conversionAsName`, `avatarSkills` and `CardInfoDialog.nameFor` each gain a trailing `tr` and every caller passes it. `categoryName` and `subtypeName` use the typed `CardDisplayData` unions.

**Review Focus:** each line has a test in Step 1: the live switch with recomputed slot titles; the English-unchanged wording via the existing specs; all four slots (empty and worn), the category, subtype and range line; the hidden General, own face-down General and hidden card in Vietnamese; the two target-prompt forms; and the two-step "Vào" menu.
