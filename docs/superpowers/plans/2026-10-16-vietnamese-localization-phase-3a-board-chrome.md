# Vietnamese Localization, Phase 3a (Board Chrome) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the first group of Game screen components to the language: the board itself, the phase bar, the game-over card, the round table's centre, the action-history and discard-pile panels and dialogs, the decision countdown and the pass-the-device overlay. Their literal text becomes `t` pipe lookups, and every call to a builder or label helper passes the live translator, so switching to Vietnamese changes this part of the screen. English stays identical.

**Architecture:** Each component imports the existing `TPipe` and injects `I18n`. Static template text becomes `{{ 'key' | t }}` (with params where the text has values in it), attribute text becomes `[attr.aria-label]="'key' | t"`, and component code that built text, or called a builder or label helper, passes `this.i18n.translator`. The translator's `locale` getter reads the language signal, so a `computed` that calls a builder re-runs on a language change; template expressions re-run because the pipe is impure and reads the same signal. Dialogs opened from `game-board.ts` build their description inside `untracked`, so a dialog keeps the language it was opened in; that is accepted, since a decision window is short and the switch is in the toolbar.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Jest (`app` project), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md` (phase 3)

## Global Constraints

- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work in the worktree `/Users/hing/Workspace/my_sanguosha-i18n-3` on branch `feat/vietnamese-phase-3`. Always `git add` explicit paths, never `git commit -a`. Never edit files in `/Users/hing/Workspace/my_sanguosha` (the shared checkout).
- English output stays byte-identical. Every existing spec for these components (`game-board`, `phase-indicator`, `game-over`, `round-table`, `action-history-panel`, `discard-pile`, `reveal-gate-overlay`, and any that render them) must pass WITHOUT edits. The component tests run in English because a fresh `I18n` reads an empty `localStorage`.
- A new catalog key needs an English entry and a Vietnamese entry with the same `{placeholders}` in the same commit (the `Messages` type and `catalogs.spec.ts` enforce it). Vietnamese follows the spec's glossary and is sentence case; Tướng and Sinh lực keep their capitals inside sentences.
- UI text style (CLAUDE.md) governs the English: Title Case for names and short labels, sentence case for sentences. Existing English text is kept exactly as it is, including its casing.
- Change only the eight components below, the two catalogs and the new spec. Do NOT touch the other game-board components (the seat tile, hand, dialogs and the rest are the next two plans), `labels.ts`, the builders, or `game.service.ts`. The error text in `lastError()` comes from the game service and stays English for now.
- Components that use `{{ 'key' | t }}` must list `TPipe` in their `imports`.
- Run one test file: `npx jest --selectProjects app --runTestsByPath <file>`. Run the project: `npx jest --selectProjects app --maxWorkers=50%`.

## Review Focus

- A language switch changes already-rendered text without re-creating the component: the phase bar, the game-over card, the history panel and the discard pile re-render on `setLocale`.
- Every pluralised or conditional piece still reads exactly as before in English: "1 card shuffled…" versus "2 cards shuffled…", "Winners: None", the "(you)" tag only on the viewer's turn, "– discard N more" only while over the limit.
- No literal English is left in the eight components' templates or attribute text (apart from CSS, icon names, and the unit `s` in the countdown).
- The builder calls in `game-board.ts` and `round-table.ts` all pass the translator, so the history lines, the waiting line and every dialog description follow the language, including a nameless seat ("Người chơi 0").
- A nameless-seat fallback and a card name that is the hidden sentinel are translated by the label helpers once `tr` is passed.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/app/i18n/en.ts`, `vi.ts` | About 45 new keys: `ui.*`, `board.*`, `phase.*`, `over.*`, `table.*`, `history.*` (panel), `discard.*`, `countdown.*`, `reveal.*`. |
| `app/src/app/game-board/{game-board,phase-indicator,game-over,round-table,action-history-panel,discard-pile,decision-countdown,reveal-gate-overlay}.ts` | Templates and calls go through the translator. |
| `app/src/app/game-board/board-chrome.vi.spec.ts` | New: each component rendered in Vietnamese, plus a live language switch. |

---

### Task 1: The board chrome through the translator

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, and the eight components above
- Test: `projects/app/src/app/game-board/board-chrome.vi.spec.ts` (new); the existing component specs must pass unedited

**Interfaces:**
- Consumes: `TPipe` (`../i18n/t.pipe`), `I18n` (`../i18n/i18n.service`, `.translator`, `.t`), the translator-aware `seatName`, `kingdomDisplayName`, `cardIdDisplayName`, `waitingLine`, `actionHistory`, `describe*`, `choiceDialogOptions`, `conversionLabel`.
- Produces: the catalog keys listed in Step 3 (reused by the next two plans: `ui.close`, `ui.info`, `ui.newGame`).

- [ ] **Step 1: Write the failing spec**

`projects/app/src/app/game-board/board-chrome.vi.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CardInstance, CardZone, EngineEvent, GameResult, GameState, Seat } from 'engine';
import { I18n } from '../i18n/i18n.service';
import { ActionHistoryEntry } from './action-history';
import { ActionHistoryPanel } from './action-history-panel';
import { DiscardPile } from './discard-pile';
import { DiscardHistoryEntry } from './discard-history';
import { GameBoard } from './game-board';
import { GameOver } from './game-over';
import { PhaseIndicator } from './phase-indicator';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { RoundTable } from './round-table';

const overlay = () => document.querySelector('.cdk-overlay-container') as HTMLElement;
const text = (el: HTMLElement) => el.textContent!.replace(/\s+/g, ' ').trim();

beforeEach(async () => {
  localStorage.clear();
  await TestBed.configureTestingModule({ imports: [GameBoard], providers: [provideRouter([{ path: 'setup', children: [] }])] }).compileComponents();
  await TestBed.inject(I18n).setLocale('vi');
});
afterEach(() => {
  localStorage.clear();
  overlay()?.replaceChildren();
});

const seat = (id: string, index: number, eliminated = false): Seat => ({
  id, index, kingdom: 'Wei', eliminated,
  generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
  combinedHp: 4, maxCombinedHp: 4,
  hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
});
const cards = (n: number) => Array.from({ length: n }, (_, i) => ({ instanceId: `c${i}`, definitionId: 'sha', suit: 'spade' as const, rank: 1 }));
function state(phase: GameState['phase'], handSize = 0, log: EngineEvent[] = []): GameState {
  const zones: CardZone[] = [
    { id: 'drawPile', kind: 'drawPile', cards: cards(9) },
    { id: 'discardPile', kind: 'discardPile', cards: [] },
    ...[0, 1, 2].flatMap((i) => [{ id: `seat-${i}:hand`, kind: 'hand' as const, ownerSeatId: `seat-${i}`, cards: i === 0 ? cards(handSize) : [] }]),
  ];
  return {
    seats: [seat('seat-0', 0), seat('seat-1', 1), seat('seat-2', 2, true)],
    players: [], turn: { turnNumber: 2, ownerSeatId: 'seat-0', extraTurnStack: [] }, phase,
    zones, pendingResponse: null, log, rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

describe('GameBoard in Vietnamese', () => {
  it('the empty board offers a new game', () => {
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toContain('Chưa có ván nào đang chơi.');
    expect(text(el.querySelector('a[href="/setup"]') as HTMLElement)).toBe('Bắt đầu ván mới');
  });
});

describe('PhaseIndicator in Vietnamese', () => {
  const render = (s: GameState, viewerSeatId: string | null) => {
    const fixture = TestBed.createComponent(PhaseIndicator);
    fixture.componentRef.setInput('state', s);
    fixture.componentRef.setInput('viewerSeatId', viewerSeatId);
    fixture.detectChanges();
    return { fixture, bar: text(fixture.nativeElement as HTMLElement) };
  };

  it('names the turn, the owner (a nameless seat in Vietnamese), you, the phase and the draw pile', () => {
    expect(render(state('Play'), 'seat-0').bar).toBe('Lượt 2 Người chơi 0 (bạn) – Giai đoạn ra bài Chồng bài rút 9');
    expect(render(state('Judgment'), 'seat-1').bar).toBe('Lượt 2 Người chơi 0 – Giai đoạn phán xét Chồng bài rút 9');
  });

  it('says how many cards are left to discard', () => {
    expect(render(state('Discard', 6), 'seat-0').bar).toContain('– bỏ thêm 2 lá bài');
  });

  it('follows a language switch without being re-created', async () => {
    const { fixture } = render(state('Play'), 'seat-0');
    await TestBed.inject(I18n).setLocale('en');
    await fixture.whenStable();
    expect(text(fixture.nativeElement as HTMLElement)).toBe('Turn 2 Seat 0 (you) – Play Phase Draw Pile 9');
    await TestBed.inject(I18n).setLocale('vi');
    await fixture.whenStable();
    expect(text(fixture.nativeElement as HTMLElement)).toBe('Lượt 2 Người chơi 0 (bạn) – Giai đoạn ra bài Chồng bài rút 9');
  });
});

describe('GameOver in Vietnamese', () => {
  const render = (result: GameResult, players: { id: string; seatId: string; kind: 'human' | 'bot'; name: string }[] = []) => {
    const fixture = TestBed.createComponent(GameOver);
    fixture.componentRef.setInput('result', result);
    fixture.componentRef.setInput('players', players);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('a winning kingdom, with the winners and losers and the New Game button', () => {
    const el = render({ endedAt: 12, winningKingdom: 'Wei', winningSeatIds: ['seat-0', 'seat-2'], losingSeatIds: ['seat-1'] });
    expect(text(el.querySelector('h2') as HTMLElement)).toBe('Hết ván');
    expect(text(el.querySelector('.headline') as HTMLElement)).toBe('Ngụy thắng!');
    expect(text(el)).toContain('Người thắng: Người chơi 0, Người chơi 2');
    expect(text(el)).toContain('Người thua: Người chơi 1');
    expect(text(el.querySelector('button') as HTMLElement)).toContain('Ván mới');
  });

  it('winners by seat, a draw, and an empty list', () => {
    expect(text(render({ endedAt: 1, winningKingdom: null, winningSeatIds: ['seat-3'], losingSeatIds: [] }, [{ id: 'p', seatId: 'seat-3', kind: 'human', name: 'Hing' }]).querySelector('.headline') as HTMLElement)).toBe('Hing thắng!');
    const draw = render({ endedAt: 1, winningKingdom: null, winningSeatIds: [], losingSeatIds: [] });
    expect(text(draw.querySelector('.headline') as HTMLElement)).toBe('Hòa — không còn ai sống sót.');
    expect(text(draw)).toContain('Người thắng: Không có');
    expect(text(draw)).toContain('Người thua: Không có');
  });
});

describe('RoundTable in Vietnamese', () => {
  const render = (s: GameState, thinkingSeatId: string | null = null) => {
    const fixture = TestBed.createComponent(RoundTable);
    fixture.componentRef.setInput('state', s);
    fixture.componentRef.setInput('viewerSeatId', 'seat-1');
    fixture.componentRef.setInput('thinkingSeatId', thinkingSeatId);
    fixture.componentRef.setInput('botSeatIds', []);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('the latest steps, the thinking line and the aria labels are Vietnamese', () => {
    const log: EngineEvent[] = [
      { kind: 'GeneralsChosenEvent', seatId: 'seat-0' },
      { kind: 'SeatEliminatedEvent', seatId: 'seat-2' },
    ];
    const el = render(state('Play', 0, log), 'seat-1');
    const steps = [...el.querySelectorAll('.sequence .text')].map((e) => text(e as HTMLElement));
    expect(steps).toContain('Người chơi 2 bị loại');
    expect(steps).toContain('Người chơi 0 đã chọn Tướng của mình');
    expect(el.querySelector('.sequence')!.getAttribute('aria-label')).toBe('Chuỗi hành động');
    expect(text(el.querySelector('.centre .thinking') as HTMLElement)).toBe('Người chơi 1 đang suy nghĩ…');
  });
});

describe('the action history and discard pile in Vietnamese', () => {
  const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };

  it('the panel label, its empty state, and the dialog with a turn marker', async () => {
    const history: ActionHistoryEntry[] = [
      { kind: 'action', text: 'Người chơi 1 rút 2 lá bài', card: null },
      { kind: 'turn', turnNumber: 2, seatName: 'Người chơi 0' },
    ];
    const fixture = TestBed.createComponent(ActionHistoryPanel);
    fixture.componentRef.setInput('history', history);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('.label') as HTMLElement)).toBe('Lịch sử hành động');
    expect(el.querySelector('button.latest')!.getAttribute('aria-label')).toBe('Xem lịch sử hành động');
    (el.querySelector('button.latest') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = overlay().querySelector('app-action-history-dialog') as HTMLElement;
    expect(text(dialog.querySelector('h2') as HTMLElement)).toBe('Lịch sử hành động');
    expect(text(dialog.querySelector('.turn') as HTMLElement)).toContain('Lượt 2 · Người chơi 0');
    expect(text(dialog.querySelector('button') as HTMLElement)).toBe('Đóng');

    const empty = TestBed.createComponent(ActionHistoryPanel);
    empty.componentRef.setInput('history', []);
    empty.detectChanges();
    expect(text(empty.nativeElement as HTMLElement)).toContain('Chưa có gì');
  });

  it('the discard pile: label, count aria, empty states and the history dialog', async () => {
    const full = TestBed.createComponent(DiscardPile);
    full.componentRef.setInput('cards', [sha, { ...sha, instanceId: 'sha-2' }]);
    full.componentRef.setInput('history', [{ kind: 'card', card: sha, inPile: true }, { kind: 'reshuffle', cardCount: 1 }, { kind: 'reshuffle', cardCount: 3 }] as DiscardHistoryEntry[]);
    full.detectChanges();
    const el = full.nativeElement as HTMLElement;
    expect(text(el.querySelector('.label') as HTMLElement)).toBe('Chồng bài bỏ');
    expect(el.querySelector('button.pile')!.getAttribute('aria-label')).toBe('Chồng bài bỏ, 2 lá. Xem lịch sử bỏ bài');
    (el.querySelector('button.pile') as HTMLButtonElement).click();
    full.detectChanges();
    await full.whenStable();
    const dialog = overlay().querySelector('app-discard-history-dialog') as HTMLElement;
    expect(text(dialog.querySelector('h2') as HTMLElement)).toBe('Lịch sử bỏ bài');
    expect(text(dialog.querySelector('.summary') as HTMLElement)).toBe('1 lá trong chồng · 1 lá đã bỏ trong ván này');
    expect([...dialog.querySelectorAll('.reshuffle')].map((e) => text(e as HTMLElement))).toEqual([
      expect.stringContaining('1 lá bài được xáo vào chồng bài rút'),
      expect.stringContaining('3 lá bài được xáo vào chồng bài rút'),
    ]);

    const none = TestBed.createComponent(DiscardPile);
    none.componentRef.setInput('cards', []);
    none.componentRef.setInput('history', []);
    none.detectChanges();
    const noneEl = none.nativeElement as HTMLElement;
    expect(text(noneEl.querySelector('.top-name') as HTMLElement)).toBe('Trống');
    expect(noneEl.querySelector('.pile')!.getAttribute('aria-label')).toBe('Chồng bài bỏ, trống');

    const reshuffled = TestBed.createComponent(DiscardPile);
    reshuffled.componentRef.setInput('cards', []);
    reshuffled.componentRef.setInput('history', [{ kind: 'reshuffle', cardCount: 2 }] as DiscardHistoryEntry[]);
    reshuffled.detectChanges();
    expect((reshuffled.nativeElement as HTMLElement).querySelector('button.pile')!.getAttribute('aria-label')).toBe('Chồng bài bỏ, trống. Xem lịch sử bỏ bài');
  });
});

describe('RevealGateOverlay in Vietnamese', () => {
  it('asks to pass the device and shows the tap button', () => {
    const fixture = TestBed.createComponent(RevealGateOverlay);
    fixture.componentRef.setInput('name', 'Hing');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el.querySelector('h2') as HTMLElement)).toBe('Chuyển thiết bị cho Hing');
    expect(text(el.querySelector('p') as HTMLElement)).toBe('Mọi người khác hãy quay đi — màn hình tiếp theo hiện bài riêng của Hing.');
    expect(text(el.querySelector('button') as HTMLElement)).toContain('Chạm để lật');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/board-chrome.vi.spec.ts`
Expected: FAIL: the components still render English. If a test fails for a fixture or type reason (a discard-history entry shape, a `GameResult` field), compare it with `discard-pile.spec.ts` or `game-over.spec.ts` and fix the fixture, not the production code.

- [ ] **Step 3: Add the catalog entries**

In `projects/app/src/app/i18n/en.ts`, append inside the object (after the last existing entry, before `} satisfies`):

```ts
  'ui.newGame': 'New Game',
  'ui.dismiss': 'Dismiss',
  'ui.close': 'Close',
  'ui.info': 'Info: {name}',
  'board.botsChoosing': 'Bots are choosing their Generals…',
  'board.yourHand': 'Your Hand',
  'board.noGame': 'No game in progress.',
  'board.startNewGame': 'Start a New Game',
  'phase.turn': 'Turn {n}',
  'phase.you': '(you)',
  'phase.indicator': '{phase} Phase',
  'phase.discardMore': '– discard {n} more',
  'phase.drawPile': 'Draw Pile {n}',
  'over.title': 'Game Over',
  'over.kingdomWins': '{kingdom} wins!',
  'over.namesWin': '{names} wins!',
  'over.draw': 'Draw — No survivors.',
  'over.winners': 'Winners: {names}',
  'over.losers': 'Losers: {names}',
  'over.none': 'None',
  'table.turnedUp': 'Turned Up Cards',
  'table.sequence': 'Action Sequence',
  'table.earlier': '{n} earlier steps',
  'table.thinking': '{seat} is thinking…',
  'history.title': 'Action History',
  'history.show': 'Show Action History',
  'history.turnMarker': 'Turn {n} · {seat}',
  'history.empty': 'Nothing has happened yet.',
  'history.nothingYet': 'Nothing yet',
  'discard.title': 'Discard History',
  'discard.summary': '{inPile} in the pile · {total} discarded this game',
  'discard.reshuffled.one': '{n} card shuffled into the draw pile',
  'discard.reshuffled.other': '{n} cards shuffled into the draw pile',
  'discard.pile': 'Discard Pile',
  'discard.pileAria': 'Discard pile, {n} cards. Show discard history',
  'discard.empty': 'Empty',
  'discard.emptyAria': 'Discard pile, Empty',
  'discard.emptyShowAria': 'Discard pile, Empty. Show discard history',
  'countdown.aria': '{n} seconds left',
  'reveal.pass': 'Pass the device to {name}',
  'reveal.lookAway': "Everyone else, Look away — The next screen shows {name}'s private cards.",
  'reveal.tap': 'Tap to Reveal',
```

and in `projects/app/src/app/i18n/vi.ts`, append inside the object (after the last existing entry, before `};`):

```ts
  'ui.newGame': 'Ván mới',
  'ui.dismiss': 'Đóng',
  'ui.close': 'Đóng',
  'ui.info': 'Thông tin: {name}',
  'board.botsChoosing': 'Các bot đang chọn Tướng…',
  'board.yourHand': 'Bài trên tay của bạn',
  'board.noGame': 'Chưa có ván nào đang chơi.',
  'board.startNewGame': 'Bắt đầu ván mới',
  'phase.turn': 'Lượt {n}',
  'phase.you': '(bạn)',
  'phase.indicator': 'Giai đoạn {phase}',
  'phase.discardMore': '– bỏ thêm {n} lá bài',
  'phase.drawPile': 'Chồng bài rút {n}',
  'over.title': 'Hết ván',
  'over.kingdomWins': '{kingdom} thắng!',
  'over.namesWin': '{names} thắng!',
  'over.draw': 'Hòa — không còn ai sống sót.',
  'over.winners': 'Người thắng: {names}',
  'over.losers': 'Người thua: {names}',
  'over.none': 'Không có',
  'table.turnedUp': 'Các lá bài đã lật',
  'table.sequence': 'Chuỗi hành động',
  'table.earlier': '{n} bước trước đó',
  'table.thinking': '{seat} đang suy nghĩ…',
  'history.title': 'Lịch sử hành động',
  'history.show': 'Xem lịch sử hành động',
  'history.turnMarker': 'Lượt {n} · {seat}',
  'history.empty': 'Chưa có gì xảy ra.',
  'history.nothingYet': 'Chưa có gì',
  'discard.title': 'Lịch sử bỏ bài',
  'discard.summary': '{inPile} lá trong chồng · {total} lá đã bỏ trong ván này',
  'discard.reshuffled.one': '{n} lá bài được xáo vào chồng bài rút',
  'discard.reshuffled.other': '{n} lá bài được xáo vào chồng bài rút',
  'discard.pile': 'Chồng bài bỏ',
  'discard.pileAria': 'Chồng bài bỏ, {n} lá. Xem lịch sử bỏ bài',
  'discard.empty': 'Trống',
  'discard.emptyAria': 'Chồng bài bỏ, trống',
  'discard.emptyShowAria': 'Chồng bài bỏ, trống. Xem lịch sử bỏ bài',
  'countdown.aria': 'Còn {n} giây',
  'reveal.pass': 'Chuyển thiết bị cho {name}',
  'reveal.lookAway': 'Mọi người khác hãy quay đi — màn hình tiếp theo hiện bài riêng của {name}.',
  'reveal.tap': 'Chạm để lật',
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

def wire(path):
    add_import(path, "import { I18n } from '../i18n/i18n.service';")
    add_import(path, "import { TPipe } from '../i18n/t.pipe';")
    ensure_core(path, 'inject')

T = "{{ '%s' | t }}"

# --- game-board.ts
p = G + 'game-board.ts'
wire(p)
swap(p, "imports: [RevealGateOverlay,", "imports: [TPipe, RevealGateOverlay,")
swap(p, '(click)="goToSetup()">New Game</button>', '(click)="goToSetup()">' + T % 'ui.newGame' + '</button>')
swap(p, '(click)="dismissError()">Dismiss</button>', '(click)="dismissError()">' + T % 'ui.dismiss' + '</button>')
swap(p, '<span>Bots are choosing their Generals…</span>', '<span>' + T % 'board.botsChoosing' + '</span>')
swap(p, '<h3>Your Hand</h3>', '<h3>' + T % 'board.yourHand' + '</h3>')
swap(p, '<p>No game in progress.</p>', '<p>' + T % 'board.noGame' + '</p>')
swap(p, '<a mat-flat-button routerLink="/setup">Start a New Game</a>', '<a mat-flat-button routerLink="/setup">' + T % 'board.startNewGame' + '</a>')
swap(p, "  private readonly sounds = inject(SoundEffects);\n", "  private readonly sounds = inject(SoundEffects);\n  private readonly i18n = inject(I18n);\n")
swap(p, "actionHistory(visible.log, visible.zones, visible.players, visible.seats)", "actionHistory(visible.log, visible.zones, visible.players, visible.seats, this.i18n.translator)")
swap(p, "return seatName(this.gameService.state()?.players ?? [], seatId);", "return seatName(this.gameService.state()?.players ?? [], seatId, this.i18n.translator);")
swap(p, "describeResponse(visible, seatId, (effect) => this.gameService.previewEffect(visible, effect));", "describeResponse(visible, seatId, (effect) => this.gameService.previewEffect(visible, effect), this.i18n.translator);")
swap(p, "conversionLabel(action, visible, this.gameService.registry)", "conversionLabel(action, visible, this.gameService.registry, this.i18n.translator)")
swap(p, "describeAsk(visible, seatId, this.gameService.legalActions())", "describeAsk(visible, seatId, this.gameService.legalActions(), this.i18n.translator)")
swap(p, "describeChoice(visible, seatId)", "describeChoice(visible, seatId, this.i18n.translator)")
swap(p, "description.declineLabel, visible.seats)", "description.declineLabel, visible.seats, this.i18n.translator)")
swap(p, "describeSelection(visible, seatId, this.gameService.legalActions())", "describeSelection(visible, seatId, this.gameService.legalActions(), this.i18n.translator)")
swap(p, "describeArrangement(visible, seatId, this.gameService.legalActions())", "describeArrangement(visible, seatId, this.gameService.legalActions(), this.i18n.translator)")

# --- phase-indicator.ts
p = G + 'phase-indicator.ts'
wire(p)
swap(p, "imports: [DecisionCountdown],", "imports: [DecisionCountdown, TPipe],")
swap(p, '<span class="count turn">Turn {{ state().turn.turnNumber }}</span>', '<span class="count turn">{{ \'phase.turn\' | t: { n: state().turn.turnNumber } }}</span>')
swap(p, '<span class="you">(you)</span>', '<span class="you">' + T % 'phase.you' + '</span>')
swap(p, '<span class="phase">{{ state().phase }} Phase</span>', '<span class="phase">{{ \'phase.indicator\' | t: { phase: phaseName() } }}</span>')
swap(p, '<span class="discard">– discard {{ discardsLeft() }} more</span>', '<span class="discard">{{ \'phase.discardMore\' | t: { n: discardsLeft() } }}</span>')
swap(p, '<span class="count draw-pile">Draw Pile {{ drawPileCount() }}</span>', '<span class="count draw-pile">{{ \'phase.drawPile\' | t: { n: drawPileCount() } }}</span>')
swap(p, "  protected readonly ownerName = computed(() => seatName(this.state().players, this.state().turn.ownerSeatId));",
        "  private readonly i18n = inject(I18n);\n\n  protected readonly ownerName = computed(() => seatName(this.state().players, this.state().turn.ownerSeatId, this.i18n.translator));\n"
        "  protected readonly phaseName = computed(() => this.i18n.t(`history.phase.${this.state().phase}` as const));")

# --- game-over.ts
p = G + 'game-over.ts'
wire(p)
swap(p, "imports: [MatButtonModule, MatCardModule, MatIconModule],", "imports: [MatButtonModule, MatCardModule, MatIconModule, TPipe],")
swap(p, '<h2>Game Over</h2>', '<h2>' + T % 'over.title' + '</h2>')
swap(p, "{{ kingdomDisplayName(result().winningKingdom!) }} wins!", "{{ 'over.kingdomWins' | t: { kingdom: kingdomName(result().winningKingdom!) } }}")
swap(p, "{{ names(result().winningSeatIds) }} wins!", "{{ 'over.namesWin' | t: { names: names(result().winningSeatIds) } }}")
swap(p, "Draw — No survivors.", T % 'over.draw')
swap(p, "<p>Winners: {{ names(result().winningSeatIds) || 'None' }}</p>", "<p>{{ 'over.winners' | t: { names: names(result().winningSeatIds) || ('over.none' | t) } }}</p>")
swap(p, "<p>Losers: {{ names(result().losingSeatIds) || 'None' }}</p>", "<p>{{ 'over.losers' | t: { names: names(result().losingSeatIds) || ('over.none' | t) } }}</p>")
swap(p, "<mat-icon>replay</mat-icon> New Game", "<mat-icon>replay</mat-icon> " + T % 'ui.newGame')
swap(p, "  protected names(seatIds: string[]): string {\n    return seatIds.map((id) => seatName(this.players(), id)).join(', ');\n  }\n\n  protected readonly kingdomDisplayName = kingdomDisplayName;",
        "  private readonly i18n = inject(I18n);\n\n  protected names(seatIds: string[]): string {\n    return seatIds.map((id) => seatName(this.players(), id, this.i18n.translator)).join(', ');\n  }\n\n"
        "  protected kingdomName(kingdom: Parameters<typeof kingdomDisplayName>[0]): string {\n    return kingdomDisplayName(kingdom, this.i18n.translator);\n  }")

# --- round-table.ts
p = G + 'round-table.ts'
wire(p)
swap(p, "imports: [SeatTile, PlayingCard, CardArt, MatProgressSpinnerModule],", "imports: [SeatTile, PlayingCard, CardArt, MatProgressSpinnerModule, TPipe],")
swap(p, 'aria-label="Turned Up Cards"', '[attr.aria-label]="\'table.turnedUp\' | t"')
swap(p, 'aria-label="Action Sequence"', '[attr.aria-label]="\'table.sequence\' | t"')
swap(p, "{{ shown().earlier }} earlier steps", "{{ 'table.earlier' | t: { n: shown().earlier } }}")
swap(p, """[attr.aria-label]="'Info: ' + cardName(card)\"""", """[attr.aria-label]="'ui.info' | t: { name: cardName(card) }\"""")
swap(p, "{{ name(thinking) }} is thinking…", "{{ 'table.thinking' | t: { seat: name(thinking) } }}")
swap(p, "  readonly botSeatIds = input<string[]>([]);\n", "  readonly botSeatIds = input<string[]>([]);\n\n  private readonly i18n = inject(I18n);\n")
swap(p, "waitingLine(this.state())", "waitingLine(this.state(), this.i18n.translator)")
swap(p, "actionHistory(this.state().log, this.state().zones, this.state().players, this.state().seats)", "actionHistory(this.state().log, this.state().zones, this.state().players, this.state().seats, this.i18n.translator)")
swap(p, "return seatName(this.state().players, seatId);", "return seatName(this.state().players, seatId, this.i18n.translator);")

# --- action-history-panel.ts (two components)
p = G + 'action-history-panel.ts'
wire(p)
swap(p, "imports: [MatDialogModule, MatButtonModule, MatIconModule, CardArt],", "imports: [MatDialogModule, MatButtonModule, MatIconModule, CardArt, TPipe],")
swap(p, "imports: [PlayingCard, MatIconModule],", "imports: [PlayingCard, MatIconModule, TPipe],")
swap(p, '<h2 mat-dialog-title>Action History</h2>', '<h2 mat-dialog-title>' + T % 'history.title' + '</h2>')
swap(p, "Turn {{ entry.turnNumber }} · {{ entry.seatName }}", "{{ 'history.turnMarker' | t: { n: entry.turnNumber, seat: entry.seatName } }}")
swap(p, '<li class="empty">Nothing has happened yet.</li>', '<li class="empty">' + T % 'history.empty' + '</li>')
swap(p, '<button mat-button mat-dialog-close type="button">Close</button>', '<button mat-button mat-dialog-close type="button">' + T % 'ui.close' + '</button>')
swap(p, '<div class="label">Action History</div>', '<div class="label">' + T % 'history.title' + '</div>')
swap(p, 'aria-label="Show Action History"', '[attr.aria-label]="\'history.show\' | t"')
swap(p, '<span class="text">Nothing yet</span>', '<span class="text">' + T % 'history.nothingYet' + '</span>')
swap(p, "  protected readonly data = inject<ActionHistoryDialogData>(MAT_DIALOG_DATA);\n", "  protected readonly data = inject<ActionHistoryDialogData>(MAT_DIALOG_DATA);\n  private readonly i18n = inject(I18n);\n")
swap(p, "  private readonly dialog = inject(MatDialog);\n", "  private readonly dialog = inject(MatDialog);\n  private readonly i18n = inject(I18n);\n")
swap(p, "cardIdDisplayName(card.definitionId);", "cardIdDisplayName(card.definitionId, this.i18n.translator);", 2)

# --- discard-pile.ts (two components)
p = G + 'discard-pile.ts'
wire(p)
swap(p, "imports: [MatDialogModule, MatButtonModule, MatIconModule, PlayingCard],", "imports: [MatDialogModule, MatButtonModule, MatIconModule, PlayingCard, TPipe],")
swap(p, "imports: [PlayingCard],", "imports: [PlayingCard, TPipe],")
swap(p, '<h2 mat-dialog-title>Discard History</h2>', '<h2 mat-dialog-title>' + T % 'discard.title' + '</h2>')
swap(p, '<p class="summary">{{ inPileCount() }} in the pile · {{ discardCount() }} discarded this game</p>', '<p class="summary">{{ \'discard.summary\' | t: { inPile: inPileCount(), total: discardCount() } }}</p>')
swap(p, "{{ entry.cardCount }} {{ entry.cardCount === 1 ? 'card' : 'cards' }} shuffled into the draw pile", "{{ (entry.cardCount === 1 ? 'discard.reshuffled.one' : 'discard.reshuffled.other') | t: { n: entry.cardCount } }}")
swap(p, '<button mat-button mat-dialog-close type="button">Close</button>', '<button mat-button mat-dialog-close type="button">' + T % 'ui.close' + '</button>')
swap(p, '<div class="label">Discard Pile</div>', '<div class="label">' + T % 'discard.pile' + '</div>')
swap(p, """[attr.aria-label]="'Discard pile, ' + cards().length + ' cards. Show discard history'\"""", """[attr.aria-label]="'discard.pileAria' | t: { n: cards().length }\"""")
swap(p, 'aria-label="Discard pile, Empty. Show discard history"', '[attr.aria-label]="\'discard.emptyShowAria\' | t"')
swap(p, 'aria-label="Discard pile, Empty"', '[attr.aria-label]="\'discard.emptyAria\' | t"')
swap(p, '<div class="top-name">Empty</div>', '<div class="top-name">' + T % 'discard.empty' + '</div>', 2)
swap(p, "  private readonly dialog = inject(MatDialog);\n", "  private readonly dialog = inject(MatDialog);\n  private readonly i18n = inject(I18n);\n")
swap(p, "cardIdDisplayName(card.definitionId);", "cardIdDisplayName(card.definitionId, this.i18n.translator);")

# --- decision-countdown.ts
p = G + 'decision-countdown.ts'
add_import(p, "import { TPipe } from '../i18n/t.pipe';")
swap(p, "imports: [MatIconModule],", "imports: [MatIconModule, TPipe],")
swap(p, """[attr.aria-label]="seconds() + ' seconds left'\"""", """[attr.aria-label]="'countdown.aria' | t: { n: seconds() }\"""")

# --- reveal-gate-overlay.ts
p = G + 'reveal-gate-overlay.ts'
add_import(p, "import { TPipe } from '../i18n/t.pipe';")
swap(p, "imports: [MatButtonModule, MatCardModule, MatIconModule],", "imports: [MatButtonModule, MatCardModule, MatIconModule, TPipe],")
swap(p, "<h2>Pass the device to {{ name() }}</h2>", "<h2>{{ 'reveal.pass' | t: { name: name() } }}</h2>")
swap(p, "<p>Everyone else, Look away — The next screen shows {{ name() }}'s private cards.</p>", "<p>{{ 'reveal.lookAway' | t: { name: name() } }}</p>")
swap(p, "<mat-icon>visibility</mat-icon> Tap to Reveal", "<mat-icon>visibility</mat-icon> " + T % 'reveal.tap')
```

Notes on the script: `wire()` is not used for the last two files (no builder calls or `I18n` use there), and `decision-countdown.ts` and `reveal-gate-overlay.ts` get only the `TPipe` import. If a file already imports `inject` from `@angular/core`, `ensure_core` leaves the line alone.

- [ ] **Step 5: Run the new spec and every existing spec for these components**

Run: `npx jest --selectProjects app --runTestsByPath projects/app/src/app/game-board/board-chrome.vi.spec.ts projects/app/src/app/game-board/game-board.spec.ts projects/app/src/app/game-board/phase-indicator.spec.ts projects/app/src/app/game-board/game-over.spec.ts projects/app/src/app/game-board/round-table.spec.ts projects/app/src/app/game-board/action-history-panel.spec.ts projects/app/src/app/game-board/discard-pile.spec.ts projects/app/src/app/game-board/reveal-gate-overlay.spec.ts projects/app/src/app/i18n/catalogs.spec.ts`
Expected: PASS everywhere, with the existing specs unedited. If an existing English assertion fails, a template or a param differs from the old string by a character (spaces inside a template matter: `{{ ' ' }}` separators stay): fix the replacement, never the existing spec. If the new spec's language-switch test fails to update, check that the template reads the translation through the `t` pipe and that `phaseName` reads `i18n.t`.

- [ ] **Step 6: Typecheck app and specs, then run the whole app project**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npx tsc -p projects/app/tsconfig.spec.json --noEmit; npx jest --selectProjects app --maxWorkers=50%`
Expected: no type errors in the app build (this proves each pipe key is a catalog key under strict templates, including the `entry.cardCount === 1 ? … : …` ternary and the `history.phase.${…}` key); the spec typecheck reports only the one older `selection-dialog.spec.ts` error (anything in the new spec is yours to fix); every suite passes.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/i18n/en.ts projects/app/src/app/i18n/vi.ts projects/app/src/app/game-board/game-board.ts projects/app/src/app/game-board/phase-indicator.ts projects/app/src/app/game-board/game-over.ts projects/app/src/app/game-board/round-table.ts projects/app/src/app/game-board/action-history-panel.ts projects/app/src/app/game-board/discard-pile.ts projects/app/src/app/game-board/decision-countdown.ts projects/app/src/app/game-board/reveal-gate-overlay.ts projects/app/src/app/game-board/board-chrome.vi.spec.ts
git commit -m "feat(app): the board chrome follows the language

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage** (the first group of phase 3):
- The board, phase bar, game-over card, round table centre, history and discard panels and dialogs, the countdown and the reveal overlay take their text from the catalog through `t` or the translator: Step 4.
- Every builder and label call in `game-board.ts` and `round-table.ts` passes the translator, so history lines, the waiting line and the dialog descriptions follow the language: Step 4.
- English is identical and the existing specs are unedited: Steps 5 and 6.
- Vietnamese is exercised end to end, including a live switch on one component: Step 1.
- Not in this plan, by design: the seat tile, hand, action list, target label, targets dialog, card and general dialogs, avatar (plan 3b); the response, ask, choice, selection, arrange, discard and compete dialogs and the general selection (plan 3c); card, ability and General names (phase 4); the error banner text from the game service.

**Placeholder scan:** none. Every key, every replacement and the whole spec are shown.

**Type consistency:** every key used by the script appears in Step 3 with the same placeholders in both languages (`ui.*`, `board.*`, `phase.*`, `over.*`, `table.*`, `history.title/show/turnMarker/empty/nothingYet`, `discard.*`, `countdown.aria`, `reveal.*`). `kingdomName` is the new method the template calls in place of the old `kingdomDisplayName` property. `phaseName` uses the existing `history.phase.*` keys.

**Review Focus:** each line has a test in Step 1: the live language switch (phase indicator); the pluralised reshuffle, "None", "(you)" and the discard-more suffix; the nameless-seat fallbacks in the history lines, game-over and phase bar; and the aria labels. The "no literal English left" check is by reading the eight components after the script ran.
