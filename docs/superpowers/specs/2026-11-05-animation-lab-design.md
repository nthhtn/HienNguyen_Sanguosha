# Animation lab — design

Date: 2026-11-05. Status: implemented. Builds on
`2026-11-05-dev-scenario-previews-design.md` (the `/preview` pages, dev-only).

## Intent

Animations only show up when the matching event happens in a game, so checking one means playing until
it occurs. This adds a dev-only page, `/preview/animations`, where one button fires one animation on the
real board, and it can be replayed as often as wanted.

## Goals

- A gallery page: the real `GameBoard` on a prepared four-seat table, and a panel of buttons grouped by
  kind. Clicking a button plays that animation on the board through the real playback director.
- Coverage (the developer's choice): the 13 battle playback beats (turn, phase, draw, play, pass, move,
  damage, heal, dying, saved, reveal, eliminated, ability); the seat sprite effects (damage per source,
  as the sprite plan defines them, and the chain effect with its sound); the Victory reveal (replayable); the Judgment popup
  flow and the Compete result.
- Options where an animation has parameters (target seat, amount, damage kind), as small controls next
  to the button.
- Adding an animation is one registry entry.

## Non-goals and anti-goals

- No separate renderer and no copy of animation code: if the board would not show it that way in a real
  game, the lab is wrong.
- Not an event timeline editor (the developer chose a gallery of buttons).
- No new rules and no engine change. The lab only describes facts that already happened.
- Not shipped to production (same exclusion as `/preview`), English only.

## Constraints

- Dev code stays in `projects/app/src/app/dev/`. The one allowed production-code change is a tiny
  `GameService` method that swaps in a new state without resetting the game (see below).
- Follows CLAUDE.md layering and the UI text style.

## Design

**Route and entry.** `/preview/animations`, listed on the `/preview` index as its own section (a link
card), and registered in `dev-routes.ts` with the other dev pages.

**How an animation plays.** The playback director (provided by the board) watches the visible state and
plays the log's new events as beats. An animation entry is
`LabAnimation { id; group; title; params?; events(state, params): EngineEvent[]; patch?(state, params): GameState }`:
pressing Play builds those events, appends them to `state.log`, applies any state facts the board reads
alongside them (for example HP after a damage event, `judgmentView` for the judgment popup), and shows
that state through `GameService.showState(state)`. The director sees a longer log and plays the new
events; the board returns to the real state when it finishes. Because events carry recorded facts, no
rules run.

**`GameService.showState(state: GameState): void`.** Sets the state signal only (no reset of bot memories,
move start or game number), so the director treats it as the same game with new events. Dev lab only; it
is the one production-code addition. The lab game has no bot due (all four seats idle on seat-0's turn)
and calls `stop()` on leaving.

**Page layout.** The board fills the page; the button panel is a collapsible side panel, so it never
covers the table. A "New Table" button restarts the lab game; a speed control is the toolbar's existing
playback speed menu.

**Groups and entries (first version, the builder fixes the exact list from the event types).**
- Beats: one entry per beat kind, with the parameters that change what shows (seat, count, card, phase).
- Sprite effects: damage for each source the sprite plan has a sheet for, the chain turning on, and the
  chain sound.
- Victory reveal: shows the Game Over screen with the real `VictoryBoard`, with Replay (the component is
  recreated, so the reveal sequence runs again) and a choice of ending (the Game Over fixtures).
- Judgment and Compete: these are popups driven by pending engine decisions, so they are not played by
  appending events. Their entries open the existing `/preview` scenarios (`choice-judgment`,
  `choice-compete`) in place of the board, fully interactive, with Reset to see them again.

**Coverage guard.** One test checks that every key of the beat registry (`BEATS`) and every damage source
of the sprite plan has at least one lab entry, so a new animation cannot be added to the game without the
lab noticing. Each entry's `events` is also checked to produce events the director plans into a non-zero
beat (except kinds the registry defines as 0 ms).

## Calls made while writing (the developer can override any)

- The lab uses the existing `playableGame` recipe for its table, seat-0 human, 4 seats, seed 7.
- The lab game rests in seat-0's Play Phase with nothing pending; Pass and Play gating does not apply.
- Sound plays as in a real game (the toolbar's mute controls apply).
- The side panel is English only.

## Calls made after the builder check (the developer can override any)

- No drift between plays: every Play first shows the clean base table (a new game as far as the director
  is concerned, so nothing plays), then, on the next tick, shows the base table with the entry's events
  and facts appended. Each run therefore starts from the same table, and replays are identical.
- The board in the lab is the real, live board, but the table is reset on every Play and on "New Table",
  so a stray click cannot drift it for long.
- An entry's patch only sets facts the events record (HP, a revealed General, a seat eliminated, the
  `chained` flag) and never a pending decision, so no bot or human decision is due and no bot moves.
  Dying and Saved are shown as events only.
- Victory reveal is a separate view on the lab page: it replaces the board with the standalone Game Over
  screen using the existing Game Over fixtures, with a Replay button that recreates the component.
- Sprite effects follow the sprite plan's own sources (the project has no elements); entries are
  listed from the sprite plan, and the coverage test enforces it.
- Judgment and Compete use the scenario mechanism, not `showState` (see Groups).

## Left to the builder

- The exact event shapes and which `GameState` facts each beat reads (read `beats.ts`,
  `displayed-state.ts`, `seat-cues.ts`).
- Which damage kinds and sprite sheets exist (read `sprite-plan.ts`, `damage-effects.ts`).
- How the Judgment popup and Compete result are opened by the board, and the smallest state that opens
  them.
- Control widgets for parameters.
