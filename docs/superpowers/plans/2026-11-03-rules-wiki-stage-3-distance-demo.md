# Rules Wiki Stage 3: Interactive Distance Demo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static table on the Distance / Range page with an interactive one: click a seat, put Mounts on it, knock seats out, pick a Weapon, and read the real distance and whether a Slash can reach it.

**Architecture:** One new pure helper in the content project, `wikiDistanceTable`, builds a small valid game state and asks the game's own rules (`seatDistance`, `getSeatDistance`, `attackRange`, `shaTargetIds`). One new standalone component, `DistanceDemo`, holds only presentation state (selected seat, who is out, who wears which Mount, the Weapon) in signals and renders what the helper returns. The component computes no distance, range or reach itself.

**Tech Stack:** Angular (standalone components, signals), Jest (`npx jest <path>`), the content and engine projects, the Stage 1 and 2 scene components.

**Spec:** `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-design.md` (section "Distance demo"). Reference draft: `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-drafts/draft-en.html` and `draft-vi.html`, page `#distance`.

**Stacked on Stage 2** (`feat/rules-wiki-stage-2`, PR #40, itself on Stage 1, PR #39). Branch `feat/rules-wiki-stage-3` is cut from it. Open the PR against the Stage 2 branch (retarget as the earlier ones merge).

## Global Constraints

- All Stage 1 and 2 constraints apply: `CLAUDE.md` layering (the UI asks the game layer; it never decides a rule), UI text casing (Title Case labels and captions; sentence case sentences; keywords keep capitals: Seat names, card names, Forces, HP), Vietnamese sentence case with keyword capitals and the agreed terms (Seat is "Người chơi N" via `label.seat`; Tọa kỵ công -1 / Tọa kỵ thủ +1; Tầm; Khoảng cách), art only through `content` helpers, no placeholders, light and dark themes, no sideways scroll at 400px.
- English card names come from `{card:id}` tokens (Red Hare, Shadow Runner, Slash ...), never typed literally.
- **The component must not compute a distance, an attack range, or whether a Slash reaches.** Every such value comes from `wikiDistanceTable`. A reviewer greps `distance-demo.ts` for arithmetic on distances and for imports of `seatDistance`, `attackRange`, `shaTargetIds`.
- The attacker is always Seat 1 and is never out. Seats are numbered 1 to 6 and sit round the table counter-clockwise from the bottom, as turns do on the Game screen.
- Initial state is the Stage 1 static example: Seat 2 out, Shadow Runner on Seat 6, no Weapon, Seat 3 selected. The page at rest looks as it did before.
- Everything operable with a keyboard: seats are buttons, controls are native inputs with labels, the readout is an `aria-live="polite"` region.
- No change to the engine's rules. Adding an export or a helper in `content` is allowed.
- Branch work: commit per task; never merge or push to `main`; do not push the branch until the user chooses to.

## Review Focus

- The selected seat is knocked out: selection must move to the next living seat, and with every other seat out the readout must say so, not show a stale distance.
- A Mount on a seat that is then knocked out, and brought back: the Mount must still be there and still count.
- The Red Hare checkbox on the attacker next to a seat at ring distance 1: the distance stays at least 1 (the engine's rule), and the readout shows the engine's number, not a computed one.
- Switching language with a seat selected: the readout, the control labels, the badges' `aria-label`s and the seat names all change.
- At 400px in Vietnamese the ring, controls and readout fit without overlap or sideways scroll (checked by eye).

---

### Task 1: `wikiDistanceTable`, the game's own answers for a table of seats

**Files:**
- Create: `projects/content/src/lib/wikiDistance.ts`, `projects/content/src/lib/wikiDistance.spec.ts`
- Modify: `projects/content/src/public-api.ts` (export), `projects/app/src/app/wiki/rules/distance-example.spec.ts` (use the helper instead of its own state builder)

**Interfaces:**
- Produces, exported from `content`:
```ts
export interface WikiDistanceSeat { n: number; out?: boolean; mount?: string }   // mount: a horse card id, e.g. 'red-hare', 'shadow-runner'
export interface WikiDistanceInput { seats: WikiDistanceSeat[]; weapon?: string } // seats are numbered 1..N; seat 1 is the attacker; weapon: a weapon card id worn by seat 1
export interface WikiDistanceSeatResult { n: number; steps: number | null; distance: number | null; canReach: boolean } // null for seat 1 and for a seat that is out
export interface WikiDistanceResult { range: number; seats: WikiDistanceSeatResult[] }
export function wikiDistanceTable(input: WikiDistanceInput): WikiDistanceResult;
export function wikiDistanceWeapons(): { id: string; range: number }[];            // the weapons the demo offers, with their range from the registry
```
- `steps` is the number of steps round the living seats (`getSeatDistance`), `distance` is `seatDistance` (Mounts included, never below 1), `range` is `attackRange` of seat 1, `canReach` is whether the seat is among `shaTargetIds(state, 'seat-1', registry)`.
- The helper builds the minimal valid `GameState` (adapt `tableOf` from `projects/app/src/app/wiki/rules/distance-example.spec.ts`: seat ids `seat-N`, index `N - 1`, equip zones holding the Mount and Weapon card instances) and uses `buildContentRegistry()` once (module-level lazy).
- `wikiDistanceWeapons()` returns, in order, `gender-swords` (range 2), `green-dragon-blade` (3), `fire-fan` (4), each range read from the registry's `weaponRange`, and throws if one is missing or has no range.

- [ ] **Step 1: Write the failing spec** `wikiDistance.spec.ts`, comparing the helper with the rules it wraps (build the same states yourself and call `seatDistance`, `getSeatDistance`, `attackRange`, `shaTargetIds` directly for the expected values):
  - `it('reports steps, distance and reach for a plain table of six')`: all seats alive, no Mounts, no Weapon: for Seat 2..6 `steps` are 1,2,3,2,1, `distance` equals `steps`, `range` is 1, and only Seats 2 and 6 `canReach`.
  - `it('a seat that is out has no distance and the seats beside it get closer')`: Seat 2 out gives `distance: null` for it and Seat 3 at 1.
  - `it('a Mount on the target adds 1 and one on the attacker takes 1 off, never below 1')`: Shadow Runner on Seat 3 makes it 3 (steps 2); Red Hare on Seat 1 makes Seat 2 stay at 1; the result equals `seatDistance` for the same state.
  - `it('a Weapon sets the range and decides reach')`: with `gender-swords` the range is 2 and Seat 3 (distance 2) `canReach`; with no Weapon it does not.
  - `it('wikiDistanceWeapons lists the demo weapons with ranges from the registry')`: `[{ id: 'gender-swords', range: 2 }, { id: 'green-dragon-blade', range: 3 }, { id: 'fire-fan', range: 4 }]`.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/wikiDistance.spec.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** `wikiDistance.ts` and the public-api export. Then update `distance-example.spec.ts` to take its expected numbers from `wikiDistanceTable` over `DISTANCE_EXAMPLE` (delete its private `tableOf`).
- [ ] **Step 4: Run** `npx jest projects/content projects/app/src/app/wiki/rules/distance-example.spec.ts`. Expected: PASS. Make each wrapped rule fail once by breaking it in `queries.ts` (for example drop the `defensive` Mount term), see the new spec fail, and revert; record each in the ledger.
- [ ] **Step 5: Commit** `git commit -m "feat: wikiDistanceTable asks the game's own rules for a table of seats"`.

---

### Task 2: `DistanceDemo`, the table you can click

**Files:**
- Create: `projects/app/src/app/wiki/rules/distance-demo.ts`, `projects/app/src/app/wiki/rules/distance-demo.spec.ts`
- Modify: `projects/app/src/app/wiki/rules/distance.ts` (use the demo in place of the static scene), `projects/app/src/app/i18n/en.ts`, `vi.ts`, `rules.vi.spec.ts`, `rules.en.spec.ts` snapshot

**Interfaces:**
- Consumes: `wikiDistanceTable` (Task 1), `DISTANCE_EXAMPLE` (Stage 1, as the initial state), Stage 1 and 2 scene components (`SceneSeat`, `SceneCard`, `SceneFrame`).
- Produces: `DistanceDemo` (selector `app-distance-demo`, standalone, no inputs). State as signals: `out = signal<ReadonlySet<number>>`, `mounts = signal<Record<number, string>>`, `weapon = signal<string | undefined>`, `selected = signal<number | null>`. `result = computed(() => wikiDistanceTable({ seats, weapon }))`.
- The ring keeps the Stage 1 markup that the existing page test reads: `.ring`, one `.spot` per seat, `app-scene-seat` with `.seat.out` for a seat that is out, `.dbadge` for a distance, `.mount img.scene-card` for a Mount.
- Seats 2 to 6 are `<button type="button" [attr.aria-pressed]>` wrapping the seat; a seat that is out is a disabled button. Seat 1 is not a button and is labelled "You" / "Bạn" (new key `rules.distance.demo.you`) on its seat via `SceneSeat.label`.
- A badge's `aria-label` reads "Seat 3, Distance 1" (existing keys `label.seat`, `card.distance`) plus ", in range" / ", out of range" (new keys) from `canReach`.
- Controls (this task): a fieldset "Seats Out of Play" with one checkbox per Seat 2 to 6. The readout (aria-live) says, for the selected seat: "Seat 3: Steps round the table: 2. Distance 3." and the reach sentence "Attack range 1: a {card:sha} cannot reach Seat 3." (keys with `{n}` params; no plural forms), or "Every other seat is out of play." when none is selectable.
- Selection rule: clicking a living seat selects it; when the selected seat is knocked out the selection moves to the first living seat after it in seat order (wrapping), or `null`.

- [ ] **Step 1: Write the failing tests** in `distance-demo.spec.ts` (real DOM events, English and Vietnamese):
  - `it('starts as the Stage 1 example: Seat 2 out, Seat 3 selected, the numbers from the game')`: badges equal `DISTANCE_EXAMPLE`'s distances; one `.seat.out`; Seat 3's button has `aria-pressed="true"`.
  - `it('clicking a seat selects it and the readout names it')`: click Seat 5; readout text starts with `'Seat 5:'` and contains the `distance` that `wikiDistanceTable` returns for it (read from the helper in the test, not hard-coded).
  - `it('knocking out a seat removes its badge and brings its neighbours closer')`: tick Seat 3 out; its badge is gone; Seat 4's badge now equals the helper's value for that table.
  - `it('knocking out the selected seat moves the selection to the next living seat')`: select Seat 3, tick it out; Seat 4 is selected.
  - `it('with every other seat out, the readout says so')`: tick all five; readout is the all-out sentence, no stale number, no button is enabled.
  - `it('a seat that is out cannot be selected')`: its button is disabled.
  - `it('the readout, labels and badge names follow a language switch')`: switch to Vietnamese; the readout starts `'Người chơi 3:'`, a badge's `aria-label` contains `'Khoảng cách'`.
  - `it('seats are reachable with the keyboard')`: seat buttons are focusable (`tabIndex >= 0`) and activate on click.
  - In `rules.vi.spec.ts` the existing `distance: the table scene shows the distances of the example` test must still pass unchanged.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/distance-demo.spec.ts`. Expected: FAIL (component missing).
- [ ] **Step 3: Implement** the component and keys, move the ring CSS from `distance.ts` into it, and have `distance.ts` render `<app-distance-demo>` (keep the existing `rules.distance.exampleCap` / `exampleText` only if they still describe the initial state; otherwise replace them with the demo's own caption and a sentence saying what to try, in both languages).
- [ ] **Step 4: Run** `npx jest projects/app/src/app` and `npx tsc -p projects/app/tsconfig.spec.json --noEmit`. Expected: PASS. Update the English `distance` snapshot and read the diff.
- [ ] **Step 5: Commit** `git commit -m "feat: an interactive table on the Distance page"`.

---

### Task 3: Mounts and Weapon

**Files:** Modify `distance-demo.ts`, `distance-demo.spec.ts`, the catalogs, `rules.en.spec.ts` snapshot.

**Interfaces:**
- Consumes: `wikiDistanceTable`, `wikiDistanceWeapons` (Task 1), `DistanceDemo` state (Task 2).
- Adds controls: a fieldset "Your Attack Range" with a `<select>` "Weapon" whose first option is "No Weapon (range 1)" and then each of `wikiDistanceWeapons()` labelled `{card name} (range {n})` (card name from `cardDisplayData`, range from the helper); a fieldset "Mounts" with a checkbox "You ride Red Hare (minus 1)" (puts `red-hare` on Seat 1) and a checkbox "Selected seat rides Shadow Runner (plus 1)" (puts `shadow-runner` on the selected seat, disabled when no seat is selected, checked state read from `mounts()[selected]`).
- Mount on a seat is kept when the seat is knocked out and counts again when it is brought back; a seat that is out shows no Mount.
- The readout adds "Wearing {card:shadow-runner}" / "You wear {card:red-hare}" sentences from the inputs (no arithmetic), and the reach sentence uses the helper's `range` and `canReach`.
- The tiny Mount card (`SceneCard size="tiny"`) shows beside a seat that wears one, as on the static scene.

- [ ] **Step 1: Write the failing tests**:
  - `it('a Weapon changes the range and which seats a Slash reaches, as the game says')`: choose Gender Swords; every badge's `reach` class and the readout's range equal the helper's result for that input.
  - `it('Shadow Runner on the selected seat lengthens it, as the game says')`: tick it with Seat 3 selected; Seat 3's badge equals the helper's value for that input, and exactly one extra `.mount` appears beside Seat 3.
  - `it('Red Hare on you shortens others but never below 1')`: tick it; the badges equal the helper's values; no badge reads below 1.
  - `it('the Shadow Runner box follows the selection')`: select another seat; the box is unticked unless that seat wears one.
  - `it('a Mount survives its seat being knocked out and brought back')`.
  - `it('the weapon options are named by the game and in the current language')`: option texts are `cardDisplayData` names plus the helper's ranges; switching to Vietnamese changes them.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/wiki/rules/distance-demo.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the controls, state and readout sentences; add keys in both languages (English from the draft, Vietnamese from the draft with the agreed terms).
- [ ] **Step 4: Run** `npx jest projects/app/src/app`, `npx tsc -p projects/app/tsconfig.spec.json --noEmit`, `npx eslint projects/app/src/app`. Expected: PASS. Update the English snapshot and read the diff.
- [ ] **Step 5: Commit** `git commit -m "feat: Weapon and Mount controls on the Distance table"`.

---

### Task 4: Guards, narrow layout and whole-stage verification

**Files:** Modify `rules-scenes.spec.ts` if a guard needs the demo's controls named; `distance-demo.ts` CSS for narrow screens; ledger notes.

**Interfaces:** Consumes everything above.

- [ ] **Step 1: Write the failing tests** (they may already pass; if so, see them fail by mutation, as in Stage 1):
  - The Stage 1 art / id / language-switch guards still pass for `distance` with the demo mounted, and cover the controls: every `select option`, `label`, `legend`, `[aria-label]` and `[title]` on the page changes with the language and carries no internal id.
  - `it('the demo contains no rule: it reads every distance from the game')`: the demo module source (read with `fs` in the spec) does not import `seatDistance`, `getSeatDistance`, `attackRange` or `shaTargetIds`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app`. Expected: green; make each guard fail once by mutation (for example set a control's label to its id) and revert.
- [ ] **Step 3: Narrow layout.** Below 520px the controls stack under the ring and the ring uses the smaller seats from the Stage 1 media query. No test; checked by eye in Step 5.
- [ ] **Step 4: Run** `npm run verify`, then `npm test`, then `npm run i18n:status`. Expected: verify exits 0; all suites pass; the new keys count as draft.
- [ ] **Step 5: Manual browser check** (`npm run web`, headless Chrome or a browser): the Distance page in Vietnamese and English, light and dark, at desktop width and at a true 400px (a 400px iframe inside a wider page works when the browser's minimum window is wider). Operate it: select seats, tick out boxes, pick each Weapon, tick both Mounts, tab through with the keyboard. Record what was checked and what was not in the PR description.
- [ ] **Step 6: Commit** `git commit -m "test: guards and narrow layout for the interactive Distance table"`. Do not push; hand the branch to the user.

---

## Self-Review

- **Spec coverage:** the interactive table with click-a-seat, Mount toggles, knock-outs, attack range and "can your Slash reach" (Tasks 2 and 3); numbers from the game, no rule in the component (Task 1 helper, Global Constraints, Task 4 source guard); initial state equals the Stage 1 example (Task 2 test); the spec's allowance for a content helper is used (Task 1); English and Vietnamese together, keyboard and screen-reader support (Tasks 2 to 4). Not here by design: new pages, video or animation.
- **Type consistency:** `WikiDistanceInput/Result/Seat/SeatResult` and `wikiDistanceWeapons` are defined in Task 1 and used with those names in Tasks 2 and 3; the component's signals are defined in Task 2 and extended in Task 3.
- **Proportion:** the plan states interfaces, behaviours and assertions; the drafts carry the layout and wording; the game's rules carry the numbers.
