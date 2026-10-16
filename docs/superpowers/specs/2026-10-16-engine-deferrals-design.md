# Engine Deferrals — Design Spec

Status: Draft for review
Date: 2026-10-16

## Purpose

Close the deferred review items that still reproduce in the engine and in the
engine-adjacent content code. Every item below was re-checked against the
current code on 2026-10-16; items that turned out already fixed were dropped
(see "Dropped"). This is the first of four deferral specs (Engine, Skills,
Backend, Frontend), written in that order because Backend and Frontend touch
what Engine changes.

## Goals

1. **No hidden General's skill is readable by another seat.** Skill ids must not
   appear in any state or event that `redactStateForSeat` or the server's game
   view hands to a seat that may not know them.
2. **Rules the UI should not hold move into the engine** (`seatIsDying`).
3. **Fix the five engine defects that still reproduce** (after-damage step,
   `JSON.stringify` target comparison, `HealEffect`, judging a card that has
   left its slot, a judged card left in `processing`).

## Non-goals and anti-goals

- **No change to the decision-id scheme** (`ask-…`, `convert-…`, `wuxie-check-…`,
  `dying-…`, built from `state.log.length`). Stored games are event-sourced and
  their recorded actions refer to these ids (`selectionId`, choice ids); a new
  scheme would turn every saved game "outdated". The old note about
  `log.length` ids found no concrete collision bug.
- Card instance ids are already opaque (`card-<position>` after the shuffle,
  commit `e8ae44f`). Nothing to do.
- Kill reward and penalty are already implemented as the user specified
  (`content/src/lib/modes/kingdomWar.ts`, the `after:SeatEliminatedEvent`
  triggers). Nothing to do.
- `ReduceMaxHpEffect` reaching 0 max HP eliminates the seat at once, with no
  dying round. The user confirmed this is correct (official rule). Keep it, and
  state it in the effect's comment.
- Anti-goal: any fix that changes a recorded action's shape, or that makes an
  existing saved game replay differently.

## Decisions

### 1. Hidden-skill leak (one redaction pass)

Two places leak, and both are fixed here:

- **Id strings.** `AskUseEffect` builds `ask-${abilityId}-${seatId}-${n}` and
  conversions build `convert-${conversionId}-…`. `maskSkills` in
  `domain/redact.ts` rewrites only values under the keys `skillId`, `abilityId`,
  `forAbilityId` and `conversionId`; it never touches an `id` string. Fix:
  redact any hidden skill id that occurs inside an `id` string of a pending
  choice, selection, response or queued effect, replacing it with the same
  `hidden` token. The stored id stays unchanged (see non-goals), so the viewer
  that owns the decision still answers with the real id.
- **The event stream.** `server/src/views/game.ts` sends
  `state.log.slice(logFrom)` unredacted. A declined ask logs `ChoiceMadeEvent`
  with `reason.owner.skillId` and `abilityId`. Fix: redact log events per viewer
  with the same function, so the engine owns the rule and the server only calls
  it. The local game board reads the log too, so it must apply the same
  redaction where the viewer is not the seat's owner (pass and play shows the
  current seat's view only).

**Rules for the redaction** (my calls, not discussed with the user):

- It is view-time only. The stored state and the stored log keep the real ids,
  so replay is untouched.
- "Hidden for this viewer" is what `maskSkills` already uses: a skill belonging
  to an unrevealed General slot of a seat other than the viewer's.
- The ids to scrub are every skill, ability and conversion id of every
  unrevealed slot on seats other than the viewer, not only those a given
  decision mentions. Matching is on whole `-`-separated tokens inside an `id`,
  so a skill id that is a substring of an unrelated id is left alone (one
  false-positive spec).
- The shared view code does the redaction (`game.service.ts` for the local
  board, the server's game view for online). The Setup and Game screens are not
  modified.

**Acceptance:** for a hidden General, no string anywhere in the redacted state
or events, for another seat, contains its skill id, ability id or conversion
id. Add one spec per place a skill id can appear (pending choice id, pending
selection id, pending response reason, queued effect, `ChoiceMadeEvent`,
`UsedCard.via`). The owner's view is unchanged.

### 2. `seatIsDying` moves into the engine

Today `seatIsDying` in `app/src/app/game-board/seat-tile.ts` holds a rule: a
seat is dying when it is not eliminated, its `combinedHp` is 0 or below, and
either a dying rescue window is pending for it or it has no cards under its
General. Two faults: it treats any `seat.pile` as Refusing Death, and it ignores
`seat.stash`.

Move the derivation into the engine as one exported function. The engine must
not name Refusing Death: content tells the engine, through a registry hook, that
a skill keeps a seat alive below 1 HP. The UI calls the engine function only.
The builder decides the hook's shape; the behaviour is fixed:

- A seat at 0 HP or below with a rescue window pending is dying.
- A seat at 0 HP or below kept alive by a skill (Refusing Death) is not dying.
- Any other seat at 0 HP or below is dying. An eliminated seat is never dying.
- Piles or stashes that belong to other skills do not count as "kept alive".

### 3. After-damage step

`sha.ts` queues `sha-after-damage` right after the damage step, whether or not
damage landed. Fantasy redirects the damage to another seat, so Longbow can still
discard a Mount from a seat that took none. Fix: `DamageEffect` reports whether
the original target took damage (cancelled, redirected or prevented all mean
no), and `sha-after-damage` runs only when it did. Spec for a cancelled damage
and for a redirect.

### 4. Target comparison

Replace the remaining `JSON.stringify` target comparisons in
`pipeline/resolve.ts` (the conversion offered-check), `rules/legality.ts`
(`targetsAllowed`, `playConversionCards`) and the test helper in
`content/src/lib/generals/skills.testing.ts` with the key-order-independent
`sameValue` already used by `isOfferedAction`. A client that sends the same
target with its keys in another order must be accepted.

### 5. Elimination and judgment hygiene

- `HealEffect` is a no-op on an eliminated seat (the callers' own guards stay).
- `judgeTarget` (`shared/delayed.ts`) re-checks, when its turn comes, that the
  delayed card is still in the judgment slot and that its holder is still
  living. If not, it judges nothing and the cleanup still runs.
- When a game ends mid-resolution, any card still in `processing` (a judged card
  whose `JudgmentDoneEffect` was dropped) is swept to the discard pile in the
  final state. The sweep runs only once the game result is set, not when one
  seat is eliminated, and logs no event (my call).

## Recorded games

Items 3 and 5 change engine state in some situations. Replay checks a sha256
state hash after every recorded action, and a mismatch stops the game as
`outdated` (`roomService.ts`). The user chose to accept that: no rules version
field, no version gating. A game in progress when this deploys may stop as
`outdated`; finished games stay viewable. Acceptance includes a spec that a
normal game, touching none of these situations, replays to the same hashes. Run
`npm run test:db` and, where a replay fixture legitimately changes, regenerate it.

## Dropped (already fixed or confirmed correct)

Opaque card ids; kill reward and penalty; Eight Trigrams losing its step;
`atStep` on an eliminated target; `ReduceMaxHp` skipping the dying round
(correct as is).

## Moved to other specs

The dying prompt saying "Peaches" when the viewer can drink Wine (E5) is wording
in the app, so it goes to the Frontend spec. The Instigate wording (S8) and the
`STEP_SELECTION_TEXT` `pay` key (S15d) go to the Skills and Frontend specs.

## Constraints

- The engine stays framework-free; redaction is a pure function over plain data.
- Existing saved games must replay to the same state; run the Postgres replay
  specs (`npm run test:db`) as part of acceptance.
- Rule text for item 2's hook and item 3's semantics is written before code, per
  CLAUDE.md.

## Left to the builder

The exact registry hook for "kept alive below 1 HP"; how `DamageEffect` reports
"damage landed"; the shape of redacted log events; where the end-of-game sweep
runs in the pipeline; spec file names.
