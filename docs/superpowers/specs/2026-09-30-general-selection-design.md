# General Selection — Design Spec

Status: Approved for implementation planning
Date: 2026-09-30

## Purpose

Let each seat in a Kingdom War (Guozhan) game choose its two generals
before play starts. Today `kingdomWarMode.setup` hands out generals
deterministically (sorted ids, two per seat) and assigns each seat's
kingdom round-robin by seat index, unrelated to its generals. This
milestone replaces that with the real Guozhan rule: every seat is dealt
5 candidate generals and picks 2 of the same kingdom, choosing which is
Main and which is Deputy. The seat's kingdom comes from that pair.

Decisions settled during brainstorming:

- **Rule:** real Guozhan pick. The two chosen generals must share a
  kingdom, and the seat's kingdom is that kingdom.
- **Supply:** first merge the 25 base-set generals from
  `projects/content/data/generals` into the registry (per the content data
  pipeline spec), then deal 5 unique candidates per seat from that pool.
- **Main/Deputy:** the player picks 2, then can swap their order before
  confirming.
- **UI library:** Angular Material, installed app-wide with one Material 3
  theme but used only by the new General Selection view. Existing Setup and
  Board screens are not restyled in this milestone.
- **Architecture:** selection is a real pre-game phase inside `GameState`,
  driven by the existing `getLegalActions` → `resolve` loop. This was chosen
  over a separate `DraftState` type because it keeps one explicit pipeline,
  and because redaction, the reveal gate, serializability and the sim bot
  all work unchanged.

## Scope

In scope:

- Content: registry merge of the 25 data-driven generals.
- Engine: the `GeneralSelection` phase, `ChooseGeneralsAction`,
  `GeneralsChosenEvent`, `getActiveSeatId`, nullable `Seat.generals`, and
  candidate redaction.
- Content: `kingdomWarMode` deal logic, seat cap, and kingdom derived from
  generals.
- Sim: new invariants; the bot needs no change.
- App: Angular Material setup, the `GeneralSelection` component, `GameBoard`
  integration, and the Setup seat cap.

Out of scope:

- Implementing skills for the 19 newly added generals (they get
  `skills: []`, per the pipeline spec's inclusion rule 1).
- Restyling Setup/Board with Material.
- Guozhan's "yin-yang fish" HP halves. HP stays the sum of both generals'
  `maxHp`, as today.
- The real-game "Ambition" (野心家) rule for more than half the table
  sharing a kingdom. The existing win condition is unchanged.
- Resolving the pipeline spec's open items (Lu Bu HP, Dong Zhuo HP, and so
  on).

## Content: registry merge

`buildContentRegistry()` builds generals from `generalsData`
(`projects/content/data/generals/index.ts`) exactly as the content data
pipeline spec's "Registry integration" section describes:

- `kingdom` and `maxHp` come from the data. A general with
  `maxHp === null` is excluded with a warning.
- `skills` come from the hand-coded skill map keyed by general id, with
  `skills: []` if absent. `setOne.ts`/`setTwo.ts` are refactored to export
  `{ id, skills }` entries instead of full `GeneralDefinition`s.
- Dong Zhuo, the one hand-coded general with no crawled data (he is not
  base-set), gets a migrated `data/generals/qun/dong-zhuo.json`. It carries
  his existing `maxHp: 4` forward as-is, per the pipeline spec's
  migration rule. The registry therefore holds 26 generals.
- Where the hand-coded definition and the crawled data disagree, the data
  wins. The only such case is Zhao Yun's kingdom: `setTwo.ts` says Wei, the
  data says Shu. This is a deliberate exception to the pipeline spec's
  "behavior-neutral" refactor, and the Zhao Yun skill test's fixtures are
  updated to match.

`content` also exports
`generalDisplayData(id): { name, title, skills: { name, text }[] } | null`,
so the app never imports raw JSON.

## Engine: domain model changes

```ts
export type Phase = 'GeneralSelection' | 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End';

export interface SeatGenerals { main: GeneralInstance; deputy: GeneralInstance }

export interface Seat {
  // ...unchanged fields...
  generals: SeatGenerals | null;      // null only while phase === 'GeneralSelection' and not yet chosen
}

export interface GeneralSelectionState {
  // Candidate general ids still awaiting a choice, keyed by seat id.
  // A seat's entry is deleted once it chooses.
  candidates: Record<string, string[]>;
}

export interface GameState {
  // ...unchanged fields...
  generalSelection: GeneralSelectionState | null; // null once every seat has chosen
}

// Action union gains:
| { kind: 'ChooseGeneralsAction'; seatId: string; mainId: string; deputyId: string }

// Event union gains (deliberately carries NO general ids — the log is public):
| { kind: 'GeneralsChosenEvent'; seatId: string }
```

`PHASE_ORDER` in `phaseSequence.ts` is unchanged (it doesn't contain
`GeneralSelection`). `advancePhaseOrTurn` throws if called during
`GeneralSelection`, since that phase is left only by resolving the last
`ChooseGeneralsAction`.

Every reader of `seat.generals` (`effects.ts`, `triggers.ts`, `redact.ts`,
`kingdomWar.ts`, `seat-summary.ts`) handles `null`. `triggers.ts` gathers
no general-skill triggers for a seat with `generals === null`.

## Rule text

### Deal (in `kingdomWarMode.setup`)

1. `kingdomWarMode` exposes `generalsPerSeat = 5` and
   `maxSeats(registry) = floor(registry.generals.size / generalsPerSeat)`
   (5 with 26 generals). `GameModeDefinition` gains the optional member
   `maxSeats?(registry: ContentRegistry): number`.
2. If `seatIds.length < 2` or `> maxSeats(registry)`, setup throws.
3. Shuffle all registry general ids (sorted first, for determinism) with
   the seeded RNG. Deal consecutive blocks of 5 to seats in seat order, and
   store them in `generalSelection.candidates[seatId]`. No general is dealt
   to two seats.
4. Five candidates across four kingdoms always contain at least one
   same-kingdom pair (pigeonhole), so no re-deal rule exists. Setup still
   asserts that each seat has at least one legal pair and throws otherwise,
   which guards against a future fifth kingdom or a smaller deal.
5. Seats start with `generals: null`, `kingdom: 'hidden'`,
   `combinedHp: 0`, and `maxCombinedHp: 0`.
6. The deck is built and 4 starting cards are drawn per seat, as today.
7. The state starts with `phase: 'GeneralSelection'` and
   `turn: { turnNumber: 1, ownerSeatId: seatIds[0], extraTurnStack: [] }`.

### Whose move it is

The engine exports `getActiveSeatId(state): string | null`:

- `null` if `state.result` is set.
- During `GeneralSelection`: the first seat, in seat order, that still has
  an entry in `generalSelection.candidates`.
- Otherwise: `pendingResponse?.respondingSeatId ?? turn.ownerSeatId`.
  This is the formula currently computed in `GameService`, which now
  delegates to the engine instead.

### Legal actions during `GeneralSelection`

`getLegalActions(state, seatId)` returns `[]` unless
`seatId === getActiveSeatId(state)`. For the active seat, it returns one
`ChooseGeneralsAction` for **each ordered pair** `(mainId, deputyId)` of
distinct candidates with the same registry kingdom, in candidate order
(main-major). No other action kind is legal during this phase.
`getLegalActions` needs the registry to read kingdoms, so it gains an
optional third parameter `registry?: ContentRegistry`. During
`GeneralSelection` it is required, and the function throws if it is
missing.

### Resolving `ChooseGeneralsAction`

`resolve` rejects the action (throws) unless: the phase is
`GeneralSelection`, `seatId` is the active seat, both ids are in that
seat's candidates, they are distinct, and they share a kingdom. On
success:

1. `seat.generals = { main: { generalDefinitionId: mainId, revealed: false }, deputy: { generalDefinitionId: deputyId, revealed: false } }`.
2. `seat.kingdom` becomes the pair's kingdom.
3. `seat.maxCombinedHp = seat.combinedHp = maxHp(main) + maxHp(deputy)`.
4. That seat's entry is deleted from `generalSelection.candidates`. Unchosen
   candidates are discarded and never reused.
5. Append `GeneralsChosenEvent { seatId }` to the log.
6. If no entries remain: `generalSelection = null` and `phase = 'Judgment'`.
   Turn 1 then proceeds exactly as games do today.

`checkWinCondition` is not evaluated during `GeneralSelection`, because
seats with kingdom `'hidden'` must not be read as a single-kingdom win.

### Redaction

`redactStateForSeat(state, viewer)` replaces every
`generalSelection.candidates[seatId]` with `seatId !== viewer` by an
array of the same length filled with `'hidden'`. The count is public,
the identities are not. The viewer's own candidates are untouched. A seat
with `generals === null` is passed through as-is, since there is nothing
to mask.

## Sim

The bot picks uniformly from `getLegalActions`, so it chooses generals
without changes. `runGame` passes the registry to `getLegalActions`. New
invariants:

- Once `phase !== 'GeneralSelection'`: every seat has non-null generals,
  both generals' registry kingdom equals `seat.kingdom`, and
  `generalSelection === null`.
- No general id appears on two seats.

## App

### Angular Material

Run `ng add @angular/material --project app`: one Material 3 theme in the
app's global styles, plus typography and the Roboto font. Only the
`GeneralSelection` component imports Material modules (`MatCardModule`,
`MatButtonModule`, `MatBadgeModule`, `MatChipsModule`, `MatTooltipModule`).

### `GameService`

- `activeSeatId` becomes `computed(() => state ? getActiveSeatId(state) : null)`.
- `legalActions` passes `this.registry` to `getLegalActions`.
- New `maxSeats = kingdomWarMode.maxSeats!(this.registry)`.

### `GameBoard`

The reveal gate works as today. After the reveal, if
`visibleState().phase === 'GeneralSelection'`, render
`<app-general-selection>` instead of the seats/actions/log. Pass it the
viewer's candidates and the `ChooseGeneralsAction`s filtered from
`legalActions()`. On `chosen`, call `gameService.submit(action)`. Because
submit resets the reveal, the gate reappears for the next seat.

### `GeneralSelection` component (standalone, presentational)

- **Inputs:** `candidates: string[]`, `actions: ChooseGeneralsAction[]`,
  `registry: ContentRegistry`. **Output:** `chosen: ChooseGeneralsAction`.
- **UI state only:** `selected = signal<string[]>([])`, ordered
  `[main, deputy]`.
- **Layout:** a responsive grid (wrapping, one column at phone width) of one
  `mat-card` per candidate. Each card shows `CardArt` (general art from the
  asset manifest), name and title, a kingdom `mat-chip`, max HP, and skill
  names with their text from `generalDisplayData`.
- **Clicking a card:**
  - If the card is selected, deselect it.
  - Else, with fewer than 2 selected, append it.
  - Else, with 2 selected, replace the second.
- **Enabled cards:** a card is enabled iff nothing is selected, it is
  itself selected, or some action in `actions` contains both it and
  `selected[0]`. This is a lookup against the engine's actions, and the UI
  never compares kingdoms itself. Disabled cards dim, with the
  `matTooltip` "Must share a kingdom with your first pick".
- **Badges:** selected cards show a `matBadge` reading "Main" or "Deputy",
  plus a raised outline.
- **Swap** (`mat-stroked-button`, enabled when 2 are selected) reverses
  `selected`.
- **Confirm** (`mat-flat-button`) is enabled iff an action with
  `mainId === selected[0] && deputyId === selected[1]` exists, and emits
  that exact action object.
- **Summary line** (when 2 are selected): kingdom and combined HP, read
  from the registry definitions of the selected ids.

### Setup

The seat-count input uses `max = gameService.maxSeats` instead of the
hard-coded 8. Its label ("Seat count (2-N)") and the clamp in `startGame`
use the same value.

## Error handling

The UI only emits actions the engine returned, so the illegal-choice
guards in `resolve` are defensive. If one fires, `GameService.submit`'s
existing try/catch shows it in the error banner and the state stays
unchanged. A seat count above `maxSeats` cannot be entered through Setup.
If it is reached anyway, `createGame` throws and `startGame` surfaces the
error the same way.

## Testing strategy

TDD throughout, using the Jest runner.

- **Content:**
  - The registry has 26 generals (25 base-set + migrated Dong Zhuo).
  - Zhao Yun's kingdom is Shu.
  - Hand-coded skills are still attached to their generals.
  - `generalDisplayData` returns names and skill text.
- **Engine / mode:**
  - The deal is unique across seats and deterministic for a seed.
  - Setup throws for 1 seat and for 6 seats.
  - Legal actions are exactly the same-kingdom ordered pairs, and only the
    active seat gets any.
  - Resolving a choice sets generals, kingdom and HP, and removes the
    candidates.
  - Each illegal-choice variant throws.
  - The last choice moves the phase to Judgment and clears
    `generalSelection`.
  - `GeneralsChosenEvent` carries no general ids.
  - Other seats' candidates are redacted with their count preserved.
  - `getActiveSeatId` is correct in both phases.
  - No win is detected during selection.
- **Sim:** the new invariants hold across the existing property-test seeds.
- **App:**
  - `GameService` drives a 2-seat selection to Judgment.
  - `GeneralSelection`:
    - Badge order follows click order.
    - Swap reverses the order.
    - Cards that don't share a kingdom with the first pick are disabled.
    - Confirm stays disabled until a legal pair is selected, then emits the
      matching action.
  - `GameBoard` renders the selection view during `GeneralSelection` and the
    board afterward.
  - Setup caps at `maxSeats`.
- **Manual check:** click through Setup → selection for every seat → the
  first turn in `ng serve app`.
