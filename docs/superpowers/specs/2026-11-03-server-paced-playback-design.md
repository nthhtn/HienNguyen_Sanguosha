# Server-paced playback for online games (design)

Date: 2026-11-03. Follows PR #44 (bot move pause raised to 2.5 s).

## Intent

Online, bots act before the animation of what just happened has finished: the
turn banner is cut short while a bot is already playing cards. The cause is that
the server paces bots (and human decision clocks) on its own timer and never
learns how long the client's animations take. The client cannot slow the server,
so it speeds its animations up to catch up, which is what cuts the banner short.

Online, every player should see the same animations at the same pace, and the
server is the only thing all players share, so the server sets the pace.

## Goals

- A bot's next move waits for the animation of everything that happened since the
  last decision: the self-executing steps (turn advance, phase changes, the Draw
  Phase draw) and the previous move's own beats.
- A human's decision clock online starts only after that same animation finishes,
  as it already does in a local game.
- One source for animation lengths, shared by the server and the client, so the
  two cannot drift apart.
- Bots read as human: a thinking gap on top of the animation.

## Non-goals

- Local games. The local game already waits on the playback gate; leave it as is,
  apart from reading the shared durations.
- Blocking a human from acting early. The clock moves; the controls do not.
- Per-player playback speed. The speed setting is hidden and fixed at Slow, so
  all players share it. If it returns, the server cannot honour every player's
  choice and this design must be revisited.
- Waiting for a slow connection or a backgrounded tab. The server uses the
  nominal animation time.

## Anti-goals

- Animation timing leaking into the engine rules. The engine stays headless and
  deterministic; waiting is the application layer's job.
- The simulator or tests getting slower. Tests and simulation keep zero delay.
- A bot move that lands before the previous batch has finished, in any mode.

## Decisions (the user's, as decided)

- **Formula for a bot's wait:** the batch's animation time at Slow speed, plus a
  1.5 s thinking gap. It replaces the flat 2.5 s of PR #44 (`BOT_MOVE_DELAY_MS`).
  Estimated results (Normal durations doubled for Slow): turn start to first Play
  Phase decision about 7.8 s, a Sha at one target about 4.0 s, a bare Pass
  response about 3.6 s; a whole bot turn about 20 to 25 s. The user agreed these
  sound right. If it proves too slow, shorten the thinking gap first (1.0 s was
  the suggested alternative) before touching animation lengths.
- **A "batch"** is the events since the last decision, the same unit the client
  plays as one batch (`lastOfBatch`, with the 350 ms `BATCH_GAP_MS` at its end).
- **Human clock online:** starts after the batch animation, using the same
  animation length without the thinking gap. A human may still act earlier.
- **The client's catch-up speed-up stays as a fallback** for a late joiner, a
  reconnect, or a human who acts early and builds a queue. It no longer shapes
  normal play.

## Constraints

- Layering (CLAUDE.md): the engine does not depend on Angular or the browser.
  The animation-length table currently lives in the presentation layer
  (`projects/app/src/app/game-board/playback/beats.ts`, `BEATS`, `BATCH_GAP_MS`,
  `stepMs` in the director). Moving the durations into shared, framework-free
  code follows the precedent of `leadInMs` / `describeDecision` in the engine.
  Which project hosts them (engine or protocol) is the builder's call.
- The visuals of a beat (what is drawn) stay in the presentation layer; only the
  duration (which may depend on the event and its neighbours, e.g. a card moved
  right after a play takes 0 ms) is shared.
- Server code: `projects/server/src/game/gameRunner.ts` (`reschedule`, bot timer,
  `leadInMs` and the start hold). Client: `playback-director.ts` (`factor`,
  rush), `pace.ts`, `remote-game.service.ts`.
- `BOT_MOVE_DELAY_MS` (2500, in `protocol`) is replaced by the thinking gap
  (1500); the local game's `botDelayMs` must be reconsidered so that local and
  online bots still feel the same.
- Existing waits (the start hold, the judgment lead-in) must not be waited for
  twice.
- The server's bot-timer clock view (`totalSeconds`, `startsAt`, `endsAt`) feeds
  the "thinking…" marker; it must stay correct with the longer, variable wait.

## Left to the builder

- Where the shared duration function lives and its exact signature.
- How the server knows which events form the batch since the last decision.
- Whether the local game's bot delay is lowered to the thinking gap (its
  playback gate already waits for animation) or left alone.
- How to test the timing deterministically (the runner's fake scheduler).

## Open items

- A manual look in the browser, online with bots, is still needed after building:
  confirm the banner finishes before the first bot play, and the turn pace
  feels right.
