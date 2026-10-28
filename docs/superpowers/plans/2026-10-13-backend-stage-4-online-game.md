# Backend Stage 4: Online Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Games run on the server: the host starts a game from the Lobby, every player plays it on their own device through the room socket, bots and timeouts keep it moving, a seat whose player is gone goes to a bot until they return, games survive a restart, and Play vs Bots becomes a server-side solo room.

**Architecture:**

- The engine gains `isOfferedAction`, so the server accepts only actions the engine offered. The engine's `resolve` trusts its caller here: it would, for example, deal cards for a `DrawCardsAction` sent by anyone.
- `protocol` gains the game wire types (`SeatView`, `GameUpdate`, `LastGame`), the `lobby.start`, `game.submit` and `game.resync` messages, the solo-room body and new error codes.
- Two new tables, `games` and `game_actions`, hold every game as its seed, its seats and its ordered actions. This is the event-sourced log.
- `server/src/game/` holds:
  - `engineGame.ts`: pure engine calls (seating, the opening state, applying a move, replay, state hashes);
  - `GameRunner`: one per running game. It owns the state, the decision clock, bot moves, takeover, reclaim and the solo pause.
- `RoomService` owns each room's queue, connections and persistence. It starts, finishes and restores games, and wires the runner's timers onto the room queue through a `Scheduler`. Tests drive that scheduler by hand.
- The Angular Lobby page keeps one socket for the lobby and the game:
  - while a game runs, it shows the existing `GameBoard`, unchanged, inside an `OnlineGame` wrapper. The wrapper provides `RemoteGameService` in place of `GameService`, and `RemoteDecisionClock` in place of `DecisionTimer`;
  - when the game ends, it shows the result.
- The Rooms page gains Play vs Bots.

**Tech Stack:** Node 24, TypeScript ~6.0, Fastify 5, `ws` 8, @sinclair/typebox 0.34, Kysely 0.28 + pg 8, Postgres 17, Jest 30 + ts-jest, Angular 22 + Material. Engine, content and bots are the workspace packages.

**Spec:** `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`. The sections that apply:

- "Rooms": Start Game, step by step; Host rules (in a game); Solo rooms
- "Socket protocol": `lobby.start`, `game.submit`, `game.resync`, `game.update`, `GameUpdate`
- "Game runner": all of it
- "Database": `games` and `game_actions`
- "HTTP API": `POST /rooms/solo`
- "Angular changes": `RemoteGameService`, the online board
- "Testing"
- "Stages", item 4

**Branch:** `feat/backend-stage-4-online-game`

## Global Constraints

- **Everything in the Stage 2 and Stage 3 Global Constraints still holds.** In particular:
  - the CommonJS-loadable dependency pins;
  - `ws` ^8 with no Fastify WebSocket plugin;
  - rows map to records only in `persistence/postgres/mappers.ts`;
  - user ids never reach a client.
- **The local screens stay as they are.** Never modify:
  - `projects/app/src/app/setup/setup.ts`
  - `projects/app/src/app/game-board/**`
  - `projects/app/src/app/game.service.ts`
  - `projects/app/src/app/decision-timer.service.ts`
  - `projects/app/src/app/play-redirect.ts`

  The online board reuses `GameBoard` and its children as they are, through dependency injection.
- **Only `server/src/views/` turns game state into wire data.** A client gets `redactStateForSeat(state, seatId)` without `rng` and without `log` (the log goes as `events`). The seed and the full state never leave the server.
- **The server accepts only offered actions.** Every action in a `game.submit` must pass `isOfferedAction(action, getLegalActions(state, seat, registry))` at its point in the move, and must name the active seat.
- **What a throw means:**
  - When the engine throws on a client's move, the client gets `illegal_action`, and nothing changes.
  - When it throws on a move the server made (a bot, a timeout or a takeover), or while restoring, the game is `broken`.
- **Timings:**
  - bot move delay: 700 ms (`BOT_DELAY_MS`);
  - takeover:
    - after 60 s away (`TAKEOVER_AWAY_MS`), checked on the 5 s room tick;
    - or after 2 timeouts in a row while away (`TAKEOVER_TIMEOUTS`);
  - decision budgets: the engine's `DECISION_SECONDS`, through `describeDecision` and `switchClock`, with the clock key `String(seq)`.
- **Seeds:** `randomInt(0, 2 ** 31)` from `node:crypto`. Seating uses `shuffle(members, createRng(seed ^ SEATING_SALT))` with `SEATING_SALT = 0x5eed5ea7`, over the members in join order.
- **State hash:** sha256 (hex) of the state's canonical JSON (object keys sorted recursively, so jsonb's key order doesn't matter) after each action.
- **User-facing text, verbatim:**
  - "This game hit an error and has stopped"
  - "This game can't continue after an update"
  - "Hing is back" (the `{name} is back` pattern)
  - "Fill every seat to start"
  - "You have a game against bots in progress"
  - buttons: "Start Game", "Play Again", "Back to Rooms", "Back to Lobby", "Play vs Bots", "Resume Game", "Abandon and Start New"
  - "Reconnecting…"
- **UI text** follows `CLAUDE.md`: Title Case for titles, buttons and labels, and sentence case for messages.
- **Code style:**
  - Use bracket access on index signatures.
  - ts-jest only transpiles, so run `npm run typecheck:server` after every engine, protocol or server task, and `npx ng build app` after every Angular task.
- **Escapes:** where this plan writes `…`, write that character itself. Never use a `\u` escape. Check every file you write with `grep -c '\\u2026' <file>`, which must print `0`.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions This Plan Makes (spec is silent, or the stage boundary needs one)

1. **Stage boundary.** Stage 5 brings the following, with chat:
   - My Games;
   - the replay endpoint;
   - evicting a solo runner after 30 minutes away;
   - aborting a solo game after 7 days without activity.

   This stage has no in-game "Leave Game" button. The server supports leaving a running game (`room.leave`), and Play vs Bots' "Abandon and Start New" uses it. Closing the tab still works: the seat goes to a bot after 60 s, and a solo game pauses.
2. **Only offered actions are accepted** (see Global Constraints). A selection's ids, an arrangement's `top` and `bottom`, and the targets on a template that carries `pickTargets` are the only fields a player fills in. The engine checks those when it resolves.
3. **One route and one socket for the lobby and the game.** `/rooms/:id` shows one of three things:
   - the Lobby;
   - the board (`OnlineGame`), while the room is `playing`;
   - the result of the last game, until the player dismisses it.

   No second socket is opened when a game starts.
4. **The board is reused as it is.** `OnlineGame` provides these tokens:
   - `GameService` → `RemoteGameService` and `DecisionTimer` → `RemoteDecisionClock` (`useExisting`);
   - its own `MatDialog` and CDK `Dialog`, so the board's dialogs and their countdowns resolve the remote services.

   `RemoteGameService.mode()` is always `'pass-and-play'`, because the board offers New Game (to the local Setup) only in `'vs-bots'`. `humanSeatId()` is the player's seat, so the pass-and-play gate never shows. The board's own Game Over card never shows: the page swaps the board for the result as soon as the state has a result.
5. **`RoomSnapshot.lastResult` becomes `lastGame: LastGame | null`**, and each member gains `seatId` (null in the lobby).
   - `LastGame` is `{ gameId, outcome: 'finished' | 'broken' | 'outdated', result, seats }`, so the result can name the players after a reload.
   - It is kept in memory only. After a restart it is null, except when a restore fails (`outdated`).
6. **A broken game is reported through `lastGame.outcome`, not an unasked error.** When a game breaks, the room returns to `lobby` with `outcome: 'broken'` ("This game hit an error and has stopped"), and its members can start again. A failed restore gives `outcome: 'outdated'` ("This game can't continue after an update"). The error code `game_broken` is not added.
7. **New error codes:**

   | Code | HTTP | Message |
   |---|---|---|
   | `not_full` | 409 | Fill every seat to start |
   | `no_game` | 409 | No game is running in this room |
   | `not_your_turn` | 409 | It's not your turn |
   | `stale` | 409 | The game moved on. Try again |
   | `illegal_action` | 400 | That move isn't allowed |
   | `solo_exists` | 409 | You already have a game against bots in progress |

   `game.submit` carrying another game's `gameId` is `stale`.
8. **Leaving a running game.**
   - A member of an open room who leaves while others remain:
     - is `markLeft`;
     - their seat is played by a bot for the rest of the game (`source = 'takeover'`);
     - if they were the host, the role passes at once to `successor(false)`, or to nobody.
   - When the game ends with no host, it passes then, or the room closes with `host_left`.
   - When the last human leaves (always so in a solo room), the game is `aborted` and the room closes.
9. **Solo rooms.**
   - `POST /api/rooms/solo { seatCount, rules, replace? }`.
   - The user's live solo room is closed first, and its running game aborted, in two cases:
     - it has no running game;
     - `replace: true`.
   - When it is playing and `replace` isn't set, the request gets `409 solo_exists`. The client learns the existing room from the room list (`youAreMember` and `visibility: 'solo'`).
   - The human's room name is their display name. Bots take "Bot 1", "Bot 2" and so on.
   - Play Again is `lobby.start`, which the solo room's human may send although a solo room has no host. Back to Rooms is `room.leave`, which closes the room.
10. **Restore trusts `games.seats`.** The spec's recomputed-seating check is dropped, because members who left aren't loaded. The replay is checked by hashes when the build differs. Members whose `room_players` row has left get a bot seat.
11. **Server moves that can't be stored are retried.** If storing a bot, timeout or takeover move fails:
    - the error is logged;
    - the runner reschedules, so a bot tries again after its delay, and a timed-out human gets a fresh clock.

    A human move that can't be stored is refused with `internal`.
12. **The bot's "thinking…".** While a bot move is pending, `GameUpdate.clock` carries the bot's own timer: the bot's seat, the decision kind, `endsAt` and `totalSeconds = 0.7`. The client shows "thinking…" for a clock on a bot-played seat. It shows a countdown only for the viewer's own seat.
13. **Graceful shutdown.** `RoomService.stop()` stops every runner's timers and waits for every room queue to drain. `server.close()` calls it before closing the app.
14. **`PROTOCOL_VERSION` stays 1.** Nothing has been deployed yet.

## Review Focus

1. **A client submits what it was never offered:** a `DrawCardsAction`, a discard of a card it doesn't hold, a known action with an extra field, or a move for another seat. Each gets `illegal_action` (or `not_your_turn`). Nothing is stored and `seq` doesn't move. Tests: Task 1 (engine), Task 6 (runner) and Task 9 (socket).
2. **A move arrives after the game moved on**, with an old `baseSeq` or the previous game's `gameId`. It gets `stale`, and the state is unchanged. A multi-action move whose second action is illegal changes nothing. Tests: Task 6 and Task 9.
3. **The player returns while a bot is about to move for them.** The pending bot move is cancelled and the player gets the decision, with a clock and legal actions. No `takeover` row is written after the reconnect. Test: Task 6.
4. **The server restarts mid-game.**
   - The restored game has the same `seq` and the same state hash. Every human is away: an open room takes over after 60 s, and a solo room is paused.
   - A different build with a diverging hash marks the game `broken`, and the room shows `outdated`. The same build with a diverging hash is trusted.

   Tests: Task 8 and Task 9.
5. **The last human leaves a running game.** The game is `aborted`, the room closes, and no runner timer fires afterwards (no further rows are stored). Test: Task 7.

---

### Task 1: Engine: `isOfferedAction`

**Files:**
- Create: `projects/engine/src/lib/rules/offered.ts`
- Modify: `projects/engine/src/public-api.ts` (export it)
- Test: `projects/engine/src/lib/rules/offered.spec.ts`

**Interfaces:**
- Consumes: `Action` from `projects/engine/src/lib/pipeline/actions.ts`.
- Produces: `isOfferedAction(action: Action, legal: readonly Action[]): boolean`, exported from `engine`.

- [ ] **Step 1: Write the failing test**

Create `projects/engine/src/lib/rules/offered.spec.ts`:

```ts
import { Action } from '../pipeline/actions';
import { isOfferedAction } from './offered';

type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;

const endPhase: Action = { kind: 'EndPhaseAction', seatId: 'seat-0' };
const discard = (cardInstanceId: string): Action => ({ kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId });
const sha: Action = { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-3', targets: [{ kind: 'seat', seatId: 'seat-1' }] };
const template: PlayCard = {
  kind: 'PlayCardAction',
  seatId: 'seat-0',
  cardInstanceId: 'card-4',
  targets: [],
  pickTargets: { eligibleIds: ['seat-1', 'seat-2'], min: 1, max: 2 },
};
const select: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 'sel-1', ids: [] };
const arrange: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr-1', top: [], bottom: [] };

describe('isOfferedAction', () => {
  it('accepts an offered action exactly as offered, in any key order', () => {
    expect(isOfferedAction({ seatId: 'seat-0', kind: 'EndPhaseAction' }, [discard('card-1'), endPhase])).toBe(true);
    const reordered = { targets: [{ seatId: 'seat-1', kind: 'seat' }], cardInstanceId: 'card-3', seatId: 'seat-0', kind: 'PlayCardAction' } as Action;
    expect(isOfferedAction(reordered, [sha])).toBe(true);
  });

  it('refuses a kind the engine did not offer, such as drawing cards', () => {
    expect(isOfferedAction({ kind: 'DrawCardsAction', seatId: 'seat-0', count: 5 }, [endPhase, discard('card-1')])).toBe(false);
    expect(isOfferedAction(endPhase, [])).toBe(false);
  });

  it('refuses an offered kind with other values', () => {
    expect(isOfferedAction(discard('card-9'), [discard('card-1')])).toBe(false);
    expect(isOfferedAction({ ...sha, targets: [{ kind: 'seat', seatId: 'seat-2' }] } as Action, [sha])).toBe(false);
    expect(isOfferedAction({ kind: 'EndPhaseAction', seatId: 'seat-1' }, [endPhase])).toBe(false);
  });

  it('refuses an offered action with an extra field', () => {
    expect(isOfferedAction({ ...endPhase, count: 3 } as Action, [endPhase])).toBe(false);
  });

  it('lets the player fill in a selection and an arrangement, and nothing else on them', () => {
    expect(isOfferedAction({ ...select, ids: ['card-1'] } as Action, [select])).toBe(true);
    expect(isOfferedAction({ ...select, selectionId: 'sel-2', ids: ['card-1'] } as Action, [select])).toBe(false);
    expect(isOfferedAction({ ...arrange, top: ['card-2'], bottom: ['card-1'] } as Action, [arrange])).toBe(true);
    expect(isOfferedAction({ ...arrange, arrangementId: 'arr-2' } as Action, [arrange])).toBe(false);
  });

  it('lets the player pick targets on a template that offers a pick, with or without the pick itself', () => {
    const { pickTargets: _pick, ...use } = template;
    expect(isOfferedAction({ ...use, targets: [{ kind: 'seat', seatId: 'seat-2' }] }, [template])).toBe(true);
    expect(isOfferedAction({ ...template, targets: [{ kind: 'seat', seatId: 'seat-1' }] }, [template])).toBe(true);
    expect(isOfferedAction({ ...use, cardInstanceId: 'card-5', targets: [{ kind: 'seat', seatId: 'seat-2' }] }, [template])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --selectProjects engine offered`
Expected: FAIL, because `./offered` does not exist.

- [ ] **Step 3: Write the implementation**

Create `projects/engine/src/lib/rules/offered.ts`:

```ts
import { Action } from '../pipeline/actions';

// The fields a player fills in on an offered template. The engine checks them
// when it resolves the action.
function freeKeys(offered: Action): readonly string[] {
  switch (offered.kind) {
    case 'SelectAction':
      return ['ids'];
    case 'ArrangeCardsAction':
      return ['top', 'bottom'];
    case 'PlayCardAction':
    case 'UseConversionAction':
      return offered.pickTargets ? ['targets', 'pickTargets'] : [];
    default:
      return [];
  }
}

// Structural equality for plain data (what JSON carries), ignoring key order.
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameValue(x, b[i]));
  }
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => sameValue(left[key], right[key]));
}

// Whether `action` is one the engine offered in `legal`: the same action, or
// an offered template with only its free fields filled in. A remote player may
// submit only what it was offered, because resolve trusts its caller on this
// (it would deal cards for a DrawCardsAction from anyone).
export function isOfferedAction(action: Action, legal: readonly Action[]): boolean {
  return legal.some((offered) => {
    if (offered.kind !== action.kind) return false;
    const free = new Set(freeKeys(offered));
    const submitted = action as Record<string, unknown>;
    const expected = offered as Record<string, unknown>;
    const keys = new Set([...Object.keys(submitted), ...Object.keys(expected)]);
    return [...keys].every((key) => free.has(key) || sameValue(submitted[key], expected[key]));
  });
}
```

Add to `projects/engine/src/public-api.ts`, after the `defaultActions` export:

```ts
export * from './lib/rules/offered';
```

- [ ] **Step 4: Run tests and the type check**

Run: `npx jest --selectProjects engine offered && npm run typecheck:server`
Expected: PASS, and no type errors.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/rules/offered.ts projects/engine/src/lib/rules/offered.spec.ts projects/engine/src/public-api.ts
git commit -m "feat(engine): isOfferedAction, so a server accepts only offered actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Protocol: game types, game messages, the solo body and error codes

**Files:**
- Create:
  - `projects/protocol/src/game.ts`
  - `projects/protocol/src/schemas/game.ts`
- Modify:
  - `projects/protocol/src/limits.ts`
  - `projects/protocol/src/errors.ts`
  - `projects/protocol/src/rooms.ts`
  - `projects/protocol/src/socket.ts`
  - `projects/protocol/src/public-api.ts`
  - `projects/protocol/src/schemas/index.ts`
  - `projects/protocol/src/schemas/socket.ts`
  - `projects/server/src/views/room.ts`
  - `projects/server/src/rooms/errors.ts`
  - `projects/server/src/http/errors.ts`
  - `projects/server/src/rooms/roomService.spec.ts`
  - `projects/app/src/app/online/testing.ts`
  - `projects/app/src/app/online/lobby-page.spec.ts`
- Test:
  - `projects/protocol/src/schemas/socket.spec.ts`
  - `projects/protocol/src/schemas/game.spec.ts`

**Interfaces:**
- Consumes: from `engine` (types only): `Action`, `DecisionKind`, `EngineEvent`, `GameResult` and `GameState`.
- Produces, from `protocol`:
  - `MAX_SUBMIT_ACTIONS = 50`
  - `SeatView = Omit<GameState, 'rng' | 'log'>`
  - `GameStatus = 'running' | 'finished' | 'aborted' | 'broken'`
  - `ActionSource = 'human' | 'bot' | 'timeout' | 'takeover'`
  - `GameClockView { seatId, kind: DecisionKind, endsAt, totalSeconds, serverNow }`
  - `GameUpdate { gameId, seq, view, legalActions, logFrom, events, clock, paused }`
  - `GameSeatView { seatId, playerId, name }`
  - `GameOutcome = 'finished' | 'broken' | 'outdated'`
  - `LastGame { gameId, outcome, result: GameResult | null, seats: GameSeatView[] }`
  - `GAME_OUTCOME_MESSAGES` (the texts for `broken` and `outdated`)
  - `SoloRoomBody` (`{ seatCount, rules, replace? }`)
  - `RoomMemberView.seatId: string | null`
  - `RoomSnapshot.lastGame: LastGame | null`, replacing `lastResult`
  - `WelcomeMessage.game: GameUpdate | null`
  - `GameUpdateMessage { type: 'game.update'; game: GameUpdate }`, added to `ServerMessage`
  - client messages `lobby.start`, `game.submit { gameId, baseSeq, actions }` and `game.resync`, which join `RoomCommand` and `RoomRequest` through the schema union
  - `ErrorCode` adds `not_full`, `no_game`, `not_your_turn`, `stale`, `illegal_action` and `solo_exists`
- Produces, from `protocol/schemas`: `ActionSchema`, `SoloRoomBodySchema`, `StartSchema`, `SubmitSchema` and `ResyncSchema`.
- Server: `RoomErrorCode` adds the six new codes. `ROOM_ERROR_STATUS` maps them per Decision 7. `toRoomSnapshot` emits `seatId: null` and `lastGame: null` for now (Task 7 fills them).

- [ ] **Step 1: Write the failing schema tests**

Create `projects/protocol/src/schemas/game.spec.ts`:

```ts
import { Value } from '@sinclair/typebox/value';
import { ActionSchema, SoloRoomBodySchema } from './index';

describe('game schemas', () => {
  it('accepts any object with a kind and a seat as an action, extra fields included', () => {
    expect(Value.Check(ActionSchema, { kind: 'EndPhaseAction', seatId: 'seat-0' })).toBe(true);
    expect(Value.Check(ActionSchema, { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [] })).toBe(true);
  });

  it('refuses an action without a kind or a seat, or with an empty one', () => {
    expect(Value.Check(ActionSchema, { kind: 'EndPhaseAction' })).toBe(false);
    expect(Value.Check(ActionSchema, { seatId: 'seat-0' })).toBe(false);
    expect(Value.Check(ActionSchema, { kind: '', seatId: 'seat-0' })).toBe(false);
    expect(Value.Check(ActionSchema, 'EndPhaseAction')).toBe(false);
  });

  it('accepts a solo-room body, with or without replace', () => {
    expect(Value.Check(SoloRoomBodySchema, { seatCount: 4, rules: {} })).toBe(true);
    expect(Value.Check(SoloRoomBodySchema, { seatCount: 5, rules: { firstRevealDraw: true }, replace: true })).toBe(true);
    expect(Value.Check(SoloRoomBodySchema, { seatCount: 4 })).toBe(false);
    expect(Value.Check(SoloRoomBodySchema, { seatCount: 4, rules: {}, replace: 'yes' })).toBe(false);
  });
});
```

In `projects/protocol/src/schemas/socket.spec.ts`, add `const GAME_ID = '9a1e7c52-1b0f-4f7e-8d2a-3c4b5d6e7f80';` under `ROOM_ID`. Then:

- In the first test (`'accepts every client message, with or without a reqId'`), add:

```ts
    expect(valid({ type: 'lobby.start', reqId: 'r4' })).toBe(true);
    expect(valid({ type: 'game.resync' })).toBe(true);
    expect(valid({ type: 'game.submit', reqId: 'r5', gameId: GAME_ID, baseSeq: 0, actions: [{ kind: 'EndPhaseAction', seatId: 'seat-0' }] })).toBe(true);
```

- In `'refuses an unknown type, extra fields and missing fields'`, replace `expect(valid({ type: 'lobby.start' })).toBe(false);` with `expect(valid({ type: 'lobby.kick' })).toBe(false);`, because `lobby.start` is now a real message.
- Add this test:

```ts
  it('refuses a game.submit with no actions, too many, a bad action, a negative baseSeq or a bad game id', () => {
    const submit = (fields: object) => valid({ type: 'game.submit', gameId: GAME_ID, baseSeq: 3, actions: [{ kind: 'EndPhaseAction', seatId: 'seat-0' }], ...fields });
    expect(submit({})).toBe(true);
    expect(submit({ actions: [] })).toBe(false);
    expect(submit({ actions: Array.from({ length: 51 }, () => ({ kind: 'DiscardCardAction', seatId: 'seat-0' })) })).toBe(false);
    expect(submit({ actions: [{ kind: 'EndPhaseAction' }] })).toBe(false);
    expect(submit({ actions: ['EndPhaseAction'] })).toBe(false);
    expect(submit({ baseSeq: -1 })).toBe(false);
    expect(submit({ baseSeq: 1.5 })).toBe(false);
    expect(submit({ gameId: 'abc' })).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --selectProjects protocol`
Expected: FAIL. `ActionSchema` and `SoloRoomBodySchema` are not exported, and the new messages are refused.

- [ ] **Step 3: Write the protocol code**

Append to `projects/protocol/src/limits.ts`:

```ts
// The most actions one game.submit may carry (a whole Discard phase is one move).
export const MAX_SUBMIT_ACTIONS = 50;
```

Create `projects/protocol/src/schemas/game.ts`:

```ts
import { Type } from '@sinclair/typebox';
import { RoomRulesSchema, SeatCountSchema } from './rooms';

// Shape only: an engine action is an object with a kind and a seat. The server
// accepts only actions the engine offered, so it checks the rest itself.
export const ActionSchema = Type.Object(
  { kind: Type.String({ minLength: 1, maxLength: 64 }), seatId: Type.String({ minLength: 1, maxLength: 64 }) },
  { additionalProperties: true }
);

// POST /api/rooms/solo. `replace` abandons a running solo game first.
export const SoloRoomBodySchema = Type.Object({ seatCount: SeatCountSchema, rules: RoomRulesSchema, replace: Type.Optional(Type.Boolean()) });
```

In `projects/protocol/src/schemas/socket.ts`:

- import `MAX_SUBMIT_ACTIONS` alongside `REQ_ID_MAX` from `'../limits'`;
- add `import { ActionSchema } from './game';`;
- add these schemas before `ClientMessageSchema`:

```ts
export const StartSchema = Type.Object({ type: Type.Literal('lobby.start'), reqId: ReqId }, strict);
export const SubmitSchema = Type.Object(
  {
    type: Type.Literal('game.submit'),
    reqId: ReqId,
    gameId: RoomIdSchema,
    baseSeq: Type.Integer({ minimum: 0 }),
    actions: Type.Array(ActionSchema, { minItems: 1, maxItems: MAX_SUBMIT_ACTIONS }),
  },
  strict
);
export const ResyncSchema = Type.Object({ type: Type.Literal('game.resync'), reqId: ReqId }, strict);
```

Then replace the union:

```ts
export const ClientMessageSchema = Type.Union([
  HelloSchema,
  AddBotSchema,
  RemovePlayerSchema,
  SetRulesSchema,
  MakeHostSchema,
  LeaveSchema,
  StartSchema,
  SubmitSchema,
  ResyncSchema,
]);
```

Add `export * from './game';` to `projects/protocol/src/schemas/index.ts`.

Create `projects/protocol/src/game.ts`:

```ts
import type { Static } from '@sinclair/typebox';
import type { Action, DecisionKind, EngineEvent, GameResult, GameState } from 'engine';
import type { SoloRoomBodySchema } from './schemas/game';

// A game as one seat may see it: the engine's redaction without the RNG (it
// holds the seed) and without the log (sent as `events`).
export type SeatView = Omit<GameState, 'rng' | 'log'>;

export type GameStatus = 'running' | 'finished' | 'aborted' | 'broken';
// Who made a stored move: a seated person, a bot seat, the clock running out,
// or a bot playing a person's seat.
export type ActionSource = 'human' | 'bot' | 'timeout' | 'takeover';

// The clock that is running, in server time. On a bot-played seat it is the
// bot's move delay, which drives the "thinking…" indicator.
export interface GameClockView {
  seatId: string;
  kind: DecisionKind;
  endsAt: number;
  totalSeconds: number;
  serverNow: number;
}

export interface GameUpdate {
  gameId: string;
  // How many actions the game has applied.
  seq: number;
  view: SeatView;
  // For the receiving seat; empty unless it must act now.
  legalActions: Action[];
  // The index of events[0] in the full log. A client whose log is not this long
  // asks for game.resync, which answers with logFrom 0.
  logFrom: number;
  events: EngineEvent[];
  clock: GameClockView | null;
  // A solo game while its player is away: nothing moves.
  paused: boolean;
}

export interface GameSeatView {
  seatId: string;
  playerId: string;
  name: string;
}

// How the room's last game ended. 'broken': the engine failed during play.
// 'outdated': the game could not be restored after a server update.
export type GameOutcome = 'finished' | 'broken' | 'outdated';

export interface LastGame {
  gameId: string;
  outcome: GameOutcome;
  result: GameResult | null;
  seats: GameSeatView[];
}

export type SoloRoomBody = Static<typeof SoloRoomBodySchema>;

export const GAME_OUTCOME_MESSAGES: Record<Exclude<GameOutcome, 'finished'>, string> = {
  broken: 'This game hit an error and has stopped',
  outdated: "This game can't continue after an update",
};
```

In `projects/protocol/src/rooms.ts`:

- change the engine import to `import type { GameRules } from 'engine';`;
- add `import type { LastGame } from './game';`;
- add to `RoomMemberView`, after `kind`:

```ts
  // The seat this member plays in the running game; null in the lobby.
  seatId: string | null;
```

- change the comment on `botControlled` to `// A bot is playing this human's seat in the running game.`;
- in `RoomSnapshot`, replace `lastResult: GameResult | null;` with:

```ts
  // The room's last game, until another starts. Kept in memory only.
  lastGame: LastGame | null;
```

In `projects/protocol/src/socket.ts`:

- add `import type { GameUpdate } from './game';`;
- in `WelcomeMessage`, replace the `game` field and its comment with:

```ts
  // The running game with its full log (logFrom 0), or null.
  game: GameUpdate | null;
```

- add this message:

```ts
// The game moved on (or the client asked for game.resync).
export interface GameUpdateMessage {
  type: 'game.update';
  game: GameUpdate;
}
```

- add `GameUpdateMessage` to the `ServerMessage` union, after `RoomUpdatedMessage`.

In `projects/protocol/src/errors.ts`, append the six codes to `ErrorCode`, in this order: `not_full`, `no_game`, `not_your_turn`, `stale`, `illegal_action`, `solo_exists`. Append to `ERROR_MESSAGES`:

```ts
  not_full: 'Fill every seat to start',
  no_game: 'No game is running in this room',
  not_your_turn: "It's not your turn",
  stale: 'The game moved on. Try again',
  illegal_action: "That move isn't allowed",
  solo_exists: 'You already have a game against bots in progress',
```

Add `export * from './game';` to `projects/protocol/src/public-api.ts`, after `./rooms`.

- [ ] **Step 4: Bring the server and app up to the new shapes**

In `projects/server/src/views/room.ts`, add `seatId: null,` after `kind: m.kind,` in the member mapping, and replace `lastResult: null,` with `lastGame: null,`.

In `projects/server/src/rooms/errors.ts`, add these lines to the `Extract` union, after `| 'invalid_message'`:

```ts
  | 'not_full'
  | 'no_game'
  | 'not_your_turn'
  | 'stale'
  | 'illegal_action'
  | 'solo_exists'
```

In `projects/server/src/http/errors.ts`, add to `ROOM_ERROR_STATUS`:

```ts
  not_full: 409,
  no_game: 409,
  not_your_turn: 409,
  stale: 409,
  illegal_action: 400,
  solo_exists: 409,
```

Then update the tests and fixtures that spell out a member or a snapshot:

- In `projects/server/src/rooms/roomService.spec.ts`, find the `create` test that expects the full snapshot. Change `lastResult: null` to `lastGame: null`. In its member object, add `seatId: null,` after `kind: 'human',`.
- In `projects/app/src/app/online/testing.ts`, add `seatId: null,` to both members, after `kind: 'human',`, and change `lastResult: null,` to `lastGame: null,`.
- Run `grep -rn "botControlled: false" projects/app/src/app/online/lobby-page.spec.ts`. Add `seatId: null,` after `kind: …,` in every member object literal it finds.

Run `grep -rn "lastResult" projects`. It must print nothing.

- [ ] **Step 5: Run all affected tests and both builds**

Run: `npx jest --selectProjects protocol server app && npm run typecheck:server && npx ng build app`
Expected: PASS, and both builds succeed.

- [ ] **Step 6: Commit**

```bash
git add projects/protocol projects/server/src/views/room.ts projects/server/src/rooms/errors.ts projects/server/src/http/errors.ts projects/server/src/rooms/roomService.spec.ts projects/app/src/app/online/testing.ts projects/app/src/app/online/lobby-page.spec.ts
git commit -m "feat(protocol): game updates, game messages, solo-room body and game error codes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Game records, the repository contract and the in-memory store

**Files:**
- Modify:
  - `projects/server/src/persistence/records.ts`
  - `projects/server/src/persistence/repositories.ts`
  - `projects/server/src/persistence/memory/memoryRepositories.ts`
  - `projects/server/src/persistence/repositoryContract.ts`
- Test: `projects/server/src/persistence/memory/memoryRepositories.spec.ts`, which runs the contract unchanged.

**Interfaces:**
- Consumes: `Action`, `GameResult` and `GameRules` (engine types); `ActionSource`, `GameStatus` and `MemberKind` (protocol types).
- Produces:
  - records `GameSeat { seatId, roomPlayerId, name, kind }`, `GameRecord` and `GameActionRecord` (the fields are below)
  - `StaleGameError`
  - `GameChanges = Partial<Pick<GameRecord, 'status' | 'result' | 'finishedAt'>>`
  - `NewGameAction = Omit<GameActionRecord, 'gameId' | 'createdAt'>`
  - `GameRepository`:
    - `create`
    - `appendActions(gameId, afterSeq, actions, now)`
    - `update(gameId, changes)`
    - `findById`
    - `listRunning`
    - `listActions`
  - `Repositories.games`

- [ ] **Step 1: Write the failing contract tests**

In `projects/server/src/persistence/repositoryContract.ts`:

- change the import to:

```ts
import { randomUUID } from 'node:crypto';
import type { ActionSource } from 'protocol';
import { GameSeat } from './records';
import { EmailTakenError, NameTakenError, NewGameAction, RepositoryHarness, StaleGameError } from './repositories';
```

- add this block inside `describeRepositoryContract`, after the `rooms` block:

```ts
  describe('games', () => {
    const SEATS: GameSeat[] = [
      { seatId: 'seat-0', roomPlayerId: randomUUID(), name: 'Ann', kind: 'human' },
      { seatId: 'seat-1', roomPlayerId: randomUUID(), name: 'Bot 1', kind: 'bot' },
    ];
    const newRoom = () => repos().rooms.create({ visibility: 'open', seatCount: 2, rules: {}, now: NOW });
    const newGame = async (roomId?: string) =>
      repos().games.create({ roomId: roomId ?? (await newRoom()).id, seed: 2 ** 31 - 1, seats: SEATS, rules: { firstRevealDraw: true }, buildId: 'build-1', now: NOW });
    const row = (seq: number, source: ActionSource = 'human'): NewGameAction => ({
      seq,
      seatId: 'seat-0',
      source,
      action: { kind: 'EndPhaseAction', seatId: 'seat-0' },
      stateHash: `hash-${seq}`,
    });
    const append = (gameId: string, afterSeq: number, rows: NewGameAction[], at = NOW) =>
      repos().transaction((tx) => tx.games.appendActions(gameId, afterSeq, rows, at));

    it('creates a running game with no actions, and finds and lists it', async () => {
      const game = await newGame();
      expect(game).toEqual({
        id: expect.any(String),
        roomId: expect.any(String),
        seed: 2 ** 31 - 1,
        seats: SEATS,
        rules: { firstRevealDraw: true },
        buildId: 'build-1',
        status: 'running',
        result: null,
        actionCount: 0,
        startedAt: NOW,
        finishedAt: null,
      });
      expect(await repos().games.findById(game.id)).toEqual(game);
      expect((await repos().games.listRunning()).map((g) => g.id)).toContain(game.id);
      expect(await repos().games.listActions(game.id)).toEqual([]);
    });

    it('refuses a second running game in one room', async () => {
      const game = await newGame();
      await expect(newGame(game.roomId)).rejects.toThrow();
    });

    it('lets a room start a new game once its last one has ended', async () => {
      const game = await newGame();
      await repos().games.update(game.id, { status: 'aborted', finishedAt: minutes(1) });
      await expect(newGame(game.roomId)).resolves.toMatchObject({ status: 'running' });
    });

    it('appends actions in order, stamps them, and counts them', async () => {
      const game = await newGame();
      await append(game.id, 0, [row(1), row(2, 'bot')], minutes(1));
      await append(game.id, 2, [row(3, 'timeout')], minutes(2));
      expect(await repos().games.listActions(game.id)).toEqual([
        { gameId: game.id, seq: 1, seatId: 'seat-0', source: 'human', action: { kind: 'EndPhaseAction', seatId: 'seat-0' }, stateHash: 'hash-1', createdAt: minutes(1) },
        expect.objectContaining({ seq: 2, source: 'bot', createdAt: minutes(1) }),
        expect.objectContaining({ seq: 3, source: 'timeout', createdAt: minutes(2) }),
      ]);
      expect((await repos().games.findById(game.id))?.actionCount).toBe(3);
    });

    it('refuses actions after a stale count, and stores none of them (Review Focus 2)', async () => {
      const game = await newGame();
      await append(game.id, 0, [row(1)]);
      await expect(append(game.id, 0, [row(1), row(2)])).rejects.toBeInstanceOf(StaleGameError);
      expect((await repos().games.listActions(game.id)).map((a) => a.seq)).toEqual([1]);
      expect((await repos().games.findById(game.id))?.actionCount).toBe(1);
    });

    it('lets exactly one of two racing appends at the same count win', async () => {
      const game = await newGame();
      const results = await Promise.allSettled([append(game.id, 0, [row(1)]), append(game.id, 0, [row(1, 'bot')])]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await repos().games.listActions(game.id)).toHaveLength(1);
    });

    it('finishes a game with its result, and drops it from the running list', async () => {
      const game = await newGame();
      const result = { endedAt: 12, winningKingdom: 'Wei' as const, winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] };
      await repos().games.update(game.id, { status: 'finished', result, finishedAt: minutes(5) });
      expect(await repos().games.findById(game.id)).toMatchObject({ status: 'finished', result, finishedAt: minutes(5), actionCount: 0 });
      expect((await repos().games.listRunning()).map((g) => g.id)).not.toContain(game.id);
    });

    it('rolls back appended actions in a failed transaction', async () => {
      const game = await newGame();
      const failure = new Error('boom');
      await expect(
        repos().transaction(async (tx) => {
          await tx.games.appendActions(game.id, 0, [row(1)], NOW);
          throw failure;
        })
      ).rejects.toBe(failure);
      expect(await repos().games.listActions(game.id)).toEqual([]);
      expect((await repos().games.findById(game.id))?.actionCount).toBe(0);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --selectProjects server memoryRepositories`
Expected: FAIL. `repos().games` is undefined, and `StaleGameError` and `NewGameAction` are not exported.

- [ ] **Step 3: Add the records and the repository interface**

In `projects/server/src/persistence/records.ts`, replace the two import lines with:

```ts
import type { Action, GameResult, GameRules } from 'engine';
import type { ActionSource, GameStatus, MemberKind, RoomStatus, RoomVisibility, UserKind } from 'protocol';
```

Append:

```ts
// Who played each seat of a game, fixed when it starts.
export interface GameSeat {
  seatId: string;
  roomPlayerId: string;
  name: string;
  kind: MemberKind;
}

// One Start Game. Its actions (GameActionRecord) are the event-sourced log.
export interface GameRecord {
  id: string;
  roomId: string;
  // Drives seating and all of the game's randomness. Secret while it runs.
  seed: number;
  seats: GameSeat[];
  rules: GameRules;
  // The engine + content build the game started on.
  buildId: string;
  status: GameStatus;
  result: GameResult | null;
  // How many actions are stored: the seq of the last one.
  actionCount: number;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface GameActionRecord {
  gameId: string;
  // 1, 2, 3, … in the order the actions applied.
  seq: number;
  seatId: string;
  source: ActionSource;
  action: Action;
  // sha256 of the state's canonical JSON (keys sorted) after this action.
  stateHash: string;
  createdAt: Date;
}
```

In `projects/server/src/persistence/repositories.ts`:

- change the first import to:

```ts
import type { GameRules } from 'engine';
import { GameActionRecord, GameRecord, GameSeat, ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserRecord } from './records';
```

- add this class after `NameTakenError`:

```ts
export class StaleGameError extends Error {
  constructor() {
    super('The game has moved past the expected action count');
    this.name = 'StaleGameError';
  }
}
```

- add these types and the interface after `RoomRepository`:

```ts
export type GameChanges = Partial<Pick<GameRecord, 'status' | 'result' | 'finishedAt'>>;
// An action to store; the repository stamps the game and the time.
export type NewGameAction = Omit<GameActionRecord, 'gameId' | 'createdAt'>;

export interface GameRepository {
  // A new 'running' game with no actions. Throws when the room already has a running game.
  create(input: { roomId: string; seed: number; seats: GameSeat[]; rules: GameRules; buildId: string; now: Date }): Promise<GameRecord>;
  // Stores `actions`, numbered afterSeq + 1, afterSeq + 2, …, and sets
  // actionCount to the last. Throws StaleGameError when actionCount isn't
  // `afterSeq`. It makes two writes, so call it inside `transaction`.
  appendActions(gameId: string, afterSeq: number, actions: NewGameAction[], now: Date): Promise<void>;
  update(gameId: string, changes: GameChanges): Promise<void>;
  findById(gameId: string): Promise<GameRecord | null>;
  // Every running game, oldest first.
  listRunning(): Promise<GameRecord[]>;
  // A game's actions in seq order.
  listActions(gameId: string): Promise<GameActionRecord[]>;
}
```

- add `games: GameRepository;` to `Repositories`, after `rooms`.

- [ ] **Step 4: Implement the in-memory store**

In `projects/server/src/persistence/memory/memoryRepositories.ts`:

- import `GameActionRecord` and `GameRecord` from `'../records'`. Import `GameChanges`, `GameRepository`, `NewGameAction` and `StaleGameError` from `'../repositories'`.
- add `games: Map<string, GameRecord>;` and `gameActions: Map<string, GameActionRecord>;` to `Store`.
- set `TABLES` to `['users', 'sessions', 'resetTokens', 'rooms', 'roomPlayers', 'games', 'gameActions']`.
- in `createMemoryRepositories`, add `games: new Map(), gameActions: new Map()` to the store literal.
- in `repositoriesOver`, add `games: new MemoryGames(store),` after `rooms`.
- in `cloneStore`, add `games: cloneMap(store.games),` and `gameActions: cloneMap(store.gameActions),`.
- replace the comment above `cloneMap` with:

```ts
// Records hold dates and objects (rules, seats, results, actions). These are
// replaced, never mutated in place, so copying each record is a deep enough copy.
```

- append the class:

```ts
const actionKey = (gameId: string, seq: number) => `${gameId}:${seq}`;

class MemoryGames implements GameRepository {
  constructor(private readonly store: Store) {}

  async create(input: { roomId: string; seed: number; seats: GameRecord['seats']; rules: GameRecord['rules']; buildId: string; now: Date }): Promise<GameRecord> {
    if (!this.store.rooms.has(input.roomId)) throw new Error(`No room ${input.roomId}`);
    if ([...this.store.games.values()].some((g) => g.roomId === input.roomId && g.status === 'running')) throw new Error('That room already has a running game');
    const game: GameRecord = {
      id: randomUUID(),
      roomId: input.roomId,
      seed: input.seed,
      seats: structuredClone(input.seats),
      rules: { ...input.rules },
      buildId: input.buildId,
      status: 'running',
      result: null,
      actionCount: 0,
      startedAt: input.now,
      finishedAt: null,
    };
    this.store.games.set(game.id, game);
    return structuredClone(game);
  }

  async appendActions(gameId: string, afterSeq: number, actions: NewGameAction[], now: Date): Promise<void> {
    const game = this.store.games.get(gameId);
    if (!game) throw new Error(`No game ${gameId}`);
    if (game.actionCount !== afterSeq) throw new StaleGameError();
    actions.forEach((action, i) => {
      if (action.seq !== afterSeq + 1 + i) throw new Error(`Action ${action.seq} is out of order`);
    });
    for (const action of actions) this.store.gameActions.set(actionKey(gameId, action.seq), { ...structuredClone(action), gameId, createdAt: now });
    this.store.games.set(gameId, { ...game, actionCount: afterSeq + actions.length });
  }

  async update(gameId: string, changes: GameChanges): Promise<void> {
    const game = this.store.games.get(gameId);
    if (game) this.store.games.set(gameId, { ...game, ...structuredClone(changes) });
  }

  async findById(gameId: string): Promise<GameRecord | null> {
    const game = this.store.games.get(gameId);
    return game ? structuredClone(game) : null;
  }

  async listRunning(): Promise<GameRecord[]> {
    return [...this.store.games.values()]
      .filter((game) => game.status === 'running')
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map((game) => structuredClone(game));
  }

  async listActions(gameId: string): Promise<GameActionRecord[]> {
    return [...this.store.gameActions.values()]
      .filter((action) => action.gameId === gameId)
      .sort((a, b) => a.seq - b.seq)
      .map((action) => structuredClone(action));
  }
}
```

The checks in `appendActions` finish before its first write, and no `await` comes between them. That keeps a refused append from writing anything.

- [ ] **Step 5: Run tests and the type check**

Run: `npx jest --selectProjects server memoryRepositories && npm run typecheck:server`
Expected: PASS. The Postgres store doesn't implement `games` yet, so `typecheck:server` reports that `PostgresRepositories` lacks `games`. That one error is expected here, and Task 4 fixes it. Every other error must be fixed now.

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/persistence
git commit -m "feat(server): game records, the games repository contract and the in-memory store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Postgres games: migration and Kysely repository

**Files:**
- Create: `projects/server/src/persistence/migrations/0003_games.ts`
- Modify:
  - `projects/server/src/persistence/migrate.ts`
  - `projects/server/src/persistence/postgres/schema.ts`
  - `projects/server/src/persistence/postgres/mappers.ts`
  - `projects/server/src/persistence/postgres/postgresRepositories.ts`
- Test: `projects/server/src/persistence/postgres/postgresRepositories.spec.ts`, which runs the Task 3 contract unchanged against Postgres.

**Interfaces:**
- Consumes: `GameRepository`, `StaleGameError`, `GameRecord`, `GameActionRecord` and `GameSeat` (Task 3).
- Produces:
  - tables `games` and `game_actions`;
  - `toGameRecord` and `toGameActionRecord` mappers;
  - a `PostgresGames` repository wired into `createPostgresRepositories`.

- [ ] **Step 1: Confirm the contract fails against Postgres**

Run: `npm run db:up && npm run test:db -- postgresRepositories`
Expected: FAIL (or a type error), because `createPostgresRepositories` has no `games`.

- [ ] **Step 2: Write the migration**

Create `projects/server/src/persistence/migrations/0003_games.ts`:

```ts
import { Kysely, sql } from 'kysely';

// Games and their event-sourced action log (spec "Database"). A room runs at
// most one game at a time.
const UP = [
  `CREATE TABLE games (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    seed bigint NOT NULL CHECK (seed >= 0),
    seats jsonb NOT NULL,
    rules jsonb NOT NULL,
    build_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('running', 'finished', 'aborted', 'broken')),
    result jsonb,
    action_count int NOT NULL DEFAULT 0 CHECK (action_count >= 0),
    started_at timestamptz NOT NULL,
    finished_at timestamptz
  )`,
  `CREATE UNIQUE INDEX games_one_running_per_room ON games (room_id) WHERE status = 'running'`,
  `CREATE INDEX games_room_id ON games (room_id)`,
  `CREATE TABLE game_actions (
    game_id uuid NOT NULL REFERENCES games (id) ON DELETE CASCADE,
    seq int NOT NULL CHECK (seq >= 1),
    seat_id text NOT NULL,
    source text NOT NULL CHECK (source IN ('human', 'bot', 'timeout', 'takeover')),
    action jsonb NOT NULL,
    state_hash text NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (game_id, seq)
  )`,
];

const DOWN = [`DROP TABLE game_actions`, `DROP TABLE games`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
```

In `projects/server/src/persistence/migrate.ts`, add `import * as games from './migrations/0003_games';`, and add `'0003_games': games,` to `MIGRATIONS`.

- [ ] **Step 3: Add the row types and mappers**

In `projects/server/src/persistence/postgres/schema.ts`:

- change the engine import to `import type { Action, GameResult, GameRules } from 'engine';`;
- add `import type { GameSeat } from '../records';`;
- add these tables before `Database`:

```ts
export interface GamesTable {
  id: Generated<string>;
  room_id: string;
  // bigint: read back as a string, written as a number. Never updated.
  seed: ColumnType<string, number, never>;
  seats: ColumnType<GameSeat[], string, never>;
  rules: ColumnType<GameRules, string, never>;
  build_id: string;
  status: 'running' | 'finished' | 'aborted' | 'broken';
  result: ColumnType<GameResult | null, string | null, string | null>;
  action_count: ColumnType<number, number | undefined, number>;
  started_at: Timestamp;
  finished_at: NullableTimestamp;
}

export interface GameActionsTable {
  game_id: string;
  seq: number;
  seat_id: string;
  source: 'human' | 'bot' | 'timeout' | 'takeover';
  action: ColumnType<Action, string, never>;
  state_hash: string;
  created_at: Timestamp;
}
```

- add `games: GamesTable;` and `game_actions: GameActionsTable;` to `Database`.

In `projects/server/src/persistence/postgres/mappers.ts`:

- import `GameActionRecord` and `GameRecord` from `'../records'`, and `GameActionsTable` and `GamesTable` from `'./schema'`;
- append:

```ts
export function toGameRecord(row: Selectable<GamesTable>): GameRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    seed: Number(row.seed),
    seats: row.seats,
    rules: row.rules,
    buildId: row.build_id,
    status: row.status,
    result: row.result,
    actionCount: row.action_count,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

export function toGameActionRecord(row: Selectable<GameActionsTable>): GameActionRecord {
  return {
    gameId: row.game_id,
    seq: row.seq,
    seatId: row.seat_id,
    source: row.source,
    action: row.action,
    stateHash: row.state_hash,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 4: Implement the repository**

In `projects/server/src/persistence/postgres/postgresRepositories.ts`:

- import `GameActionRecord` and `GameRecord` from `'../records'`;
- add `GameChanges`, `GameRepository`, `NewGameAction` and `StaleGameError` to the `'../repositories'` import;
- add `toGameActionRecord` and `toGameRecord` to the mappers import;
- add `games: new PostgresGames(db),` to `createPostgresRepositories`, after `rooms`;
- append the class:

```ts
class PostgresGames implements GameRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: { roomId: string; seed: number; seats: GameRecord['seats']; rules: GameRecord['rules']; buildId: string; now: Date }): Promise<GameRecord> {
    const row = await this.db
      .insertInto('games')
      .values({
        room_id: input.roomId,
        seed: input.seed,
        seats: JSON.stringify(input.seats),
        rules: JSON.stringify(input.rules),
        build_id: input.buildId,
        status: 'running',
        result: null,
        started_at: input.now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toGameRecord(row);
  }

  async appendActions(gameId: string, afterSeq: number, actions: NewGameAction[], now: Date): Promise<void> {
    actions.forEach((action, i) => {
      if (action.seq !== afterSeq + 1 + i) throw new Error(`Action ${action.seq} is out of order`);
    });
    // The row lock this takes makes a racing append wait, then find the count moved.
    const updated = await this.db
      .updateTable('games')
      .set({ action_count: afterSeq + actions.length })
      .where('id', '=', gameId)
      .where('action_count', '=', afterSeq)
      .executeTakeFirst();
    if (Number(updated.numUpdatedRows) !== 1) throw new StaleGameError();
    await this.db
      .insertInto('game_actions')
      .values(
        actions.map((action) => ({
          game_id: gameId,
          seq: action.seq,
          seat_id: action.seatId,
          source: action.source,
          action: JSON.stringify(action.action),
          state_hash: action.stateHash,
          created_at: now,
        }))
      )
      .execute();
  }

  async update(gameId: string, changes: GameChanges): Promise<void> {
    const set = {
      ...(changes.status !== undefined ? { status: changes.status } : {}),
      ...(changes.result !== undefined ? { result: changes.result === null ? null : JSON.stringify(changes.result) } : {}),
      ...(changes.finishedAt !== undefined ? { finished_at: changes.finishedAt } : {}),
    };
    if (Object.keys(set).length === 0) return;
    await this.db.updateTable('games').set(set).where('id', '=', gameId).execute();
  }

  async findById(gameId: string): Promise<GameRecord | null> {
    const row = await this.db.selectFrom('games').selectAll().where('id', '=', gameId).executeTakeFirst();
    return row ? toGameRecord(row) : null;
  }

  async listRunning(): Promise<GameRecord[]> {
    const rows = await this.db.selectFrom('games').selectAll().where('status', '=', 'running').orderBy('started_at').orderBy('id').execute();
    return rows.map(toGameRecord);
  }

  async listActions(gameId: string): Promise<GameActionRecord[]> {
    const rows = await this.db.selectFrom('game_actions').selectAll().where('game_id', '=', gameId).orderBy('seq').execute();
    return rows.map(toGameActionRecord);
  }
}
```

- [ ] **Step 5: Run the Postgres suite, the full server suite and the type check**

Run: `npm run test:db && npx jest --selectProjects server && npm run typecheck:server`
Expected: PASS, and no type errors. The Postgres run includes the new games contract.

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/persistence
git commit -m "feat(server): Postgres games and game_actions tables and repository

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The engine on the server: seating, opening state, moves, replay and views

**Files:**
- Create:
  - `projects/server/src/game/engineGame.ts`
  - `projects/server/src/views/game.ts`
- Modify: `jest.config.js` (the `server` project maps `bots`)
- Test: `projects/server/src/game/engineGame.spec.ts`

**Interfaces:**
- Consumes, from `engine`:
  - `createGame`, `createRng`, `shuffle`, `resolve`, `getActiveSeatId`, `getLegalActions`, `isOfferedAction` (Task 1) and `redactStateForSeat`
  - types `Action`, `ContentRegistry`, `EngineContext`, `GameRules` and `GameState`
- Consumes: `guozhanMode` from `content`; `GameSeat`, `GameRecord` and `GameActionRecord` (Task 3); `GameUpdate`, `GameClockView`, `SeatView` and `MemberKind` from `protocol`.
- Produces:
  - `SEATING_SALT = 0x5eed5ea7`
  - `engineContext(registry): EngineContext`
  - `SeatCandidate { id; name; kind }`
  - `drawSeats(members: readonly SeatCandidate[], seed: number): GameSeat[]`
  - `openingState(ctx, seed, seats, rules): GameState`
  - `stateHash(state): string`
  - `IllegalMoveError`
  - `applyMove(ctx, state, seatId, actions): GameState[]`: the state after each action. It throws `IllegalMoveError` on any problem.
  - `applyActions(ctx, state, actions): GameState[]`: no checks; it throws whatever the engine throws.
  - `replay(ctx, game, actions, checkHashes): GameState`
  - in `views/game.ts`:
    - `toSeatView(state, seatId): SeatView`
    - `GameUpdateInput`
    - `toGameUpdate(input): GameUpdate`

- [ ] **Step 1: Map `bots` for the server tests**

In `jest.config.js`, add this line to the `server` project's `moduleNameMapper`, after `'^content$'`:

```js
        '^bots$': '<rootDir>/../../bots/src/public-api.ts',
```

- [ ] **Step 2: Write the failing test**

Create `projects/server/src/game/engineGame.spec.ts`:

```ts
import { ruleBasedPolicy } from 'bots';
import type { BotTurnMemory } from 'bots';
import { buildContentRegistry } from 'content';
import { getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import type { Action, GameState } from 'engine';
import { GameActionRecord, GameRecord, GameSeat } from '../persistence/records';
import { toGameUpdate, toSeatView } from '../views/game';
import { applyActions, applyMove, drawSeats, engineContext, IllegalMoveError, openingState, replay, stateHash } from './engineGame';

const registry = buildContentRegistry();
const ctx = engineContext(registry);
const SEED = 1234;
const SEATS: GameSeat[] = [
  { seatId: 'seat-0', roomPlayerId: 'p-ann', name: 'Ann', kind: 'human' },
  { seatId: 'seat-1', roomPlayerId: 'p-bot', name: 'Bot 1', kind: 'bot' },
];

// Plays `count` moves, the rule-based bot choosing for whoever must act.
function botMoves(state: GameState, count: number): { state: GameState; moves: { seatId: string; action: Action; after: GameState }[] } {
  const memories = new Map<string, BotTurnMemory>();
  const moves: { seatId: string; action: Action; after: GameState }[] = [];
  let current = state;
  for (let i = 0; i < count && !current.result; i += 1) {
    const seatId = getActiveSeatId(current)!;
    const decision = ruleBasedPolicy.decide(redactStateForSeat(current, seatId), seatId, getLegalActions(current, seatId, registry), registry, memories.get(seatId) ?? null);
    memories.set(seatId, decision.memory);
    current = applyActions(ctx, current, [decision.action]).at(-1)!;
    moves.push({ seatId, action: decision.action, after: current });
  }
  return { state: current, moves };
}

const record = (): GameRecord => ({
  id: 'game-1',
  roomId: 'room-1',
  seed: SEED,
  seats: SEATS,
  rules: {},
  buildId: 'build-1',
  status: 'running',
  result: null,
  actionCount: 0,
  startedAt: new Date(0),
  finishedAt: null,
});

describe('engineGame', () => {
  describe('drawSeats', () => {
    const members = ['Ann', 'Bo', 'Cy', 'Di'].map((name) => ({ id: `p-${name}`, name, kind: 'human' as const }));

    it('seats every member once, as seat-0, seat-1, … in a seeded order', () => {
      const seats = drawSeats(members, 7);
      expect(seats.map((s) => s.seatId)).toEqual(['seat-0', 'seat-1', 'seat-2', 'seat-3']);
      expect(seats.map((s) => s.roomPlayerId).sort()).toEqual(members.map((m) => m.id).sort());
      expect(drawSeats(members, 7)).toEqual(seats);
      expect(seats[0]).toEqual({ seatId: 'seat-0', roomPlayerId: expect.any(String), name: expect.any(String), kind: 'human' });
    });

    it('does not always keep the join order', () => {
      const orders = new Set(Array.from({ length: 20 }, (_, seed) => drawSeats(members, seed).map((s) => s.name).join(',')));
      expect(orders.size).toBeGreaterThan(1);
    });
  });

  describe('openingState', () => {
    it("gives each seat its member's name and kind, the same way for the same seed", () => {
      const state = openingState(ctx, SEED, SEATS, {});
      expect(state.players.map((p) => ({ seatId: p.seatId, name: p.name, kind: p.kind }))).toEqual([
        { seatId: 'seat-0', name: 'Ann', kind: 'human' },
        { seatId: 'seat-1', name: 'Bot 1', kind: 'bot' },
      ]);
      expect(stateHash(openingState(ctx, SEED, SEATS, {}))).toBe(stateHash(state));
      expect(stateHash(state)).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('applyMove', () => {
    const opening = () => openingState(ctx, SEED, SEATS, {});

    it('applies an offered move and returns the state after each action', () => {
      const state = opening();
      const [move] = getLegalActions(state, 'seat-0', registry);
      const steps = applyMove(ctx, state, 'seat-0', [move]);
      expect(steps).toHaveLength(1);
      expect(getActiveSeatId(steps[0])).toBe('seat-1');
      expect(stateHash(steps[0])).not.toBe(stateHash(state));
    });

    it('refuses an action the engine did not offer, such as drawing cards (Review Focus 1)', () => {
      expect(() => applyMove(ctx, opening(), 'seat-0', [{ kind: 'DrawCardsAction', seatId: 'seat-0', count: 5 }])).toThrow(IllegalMoveError);
    });

    it('refuses a move for a seat that is not the one to act, or that names another seat', () => {
      const state = opening();
      const [move] = getLegalActions(state, 'seat-0', registry);
      expect(() => applyMove(ctx, state, 'seat-1', [move])).toThrow(IllegalMoveError);
      expect(() => applyMove(ctx, state, 'seat-0', [{ ...move, seatId: 'seat-1' } as Action])).toThrow(IllegalMoveError);
    });

    it('changes nothing when a later action is refused (Review Focus 2)', () => {
      const state = opening();
      const before = stateHash(state);
      const [move] = getLegalActions(state, 'seat-0', registry);
      expect(() => applyMove(ctx, state, 'seat-0', [move, move])).toThrow(IllegalMoveError);
      expect(stateHash(state)).toBe(before);
    });
  });

  describe('applyActions', () => {
    it('throws what the engine throws', () => {
      expect(() => applyActions(ctx, openingState(ctx, SEED, SEATS, {}), [{ kind: 'EndPhaseAction', seatId: 'seat-0' }])).toThrow('general selection');
    });
  });

  describe('replay', () => {
    const stored = (moves: ReturnType<typeof botMoves>['moves']): GameActionRecord[] =>
      moves.map((move, i) => ({ gameId: 'game-1', seq: i + 1, seatId: move.seatId, source: 'bot', action: move.action, stateHash: stateHash(move.after), createdAt: new Date(0) }));

    it('rebuilds the same state from the stored actions, checking every hash', () => {
      const { state, moves } = botMoves(openingState(ctx, SEED, SEATS, {}), 30);
      expect(stateHash(replay(ctx, record(), stored(moves), true))).toBe(stateHash(state));
    });

    it('throws on a hash that differs when checking, and trusts it when not', () => {
      const { moves } = botMoves(openingState(ctx, SEED, SEATS, {}), 10);
      const actions = stored(moves);
      actions[4] = { ...actions[4], stateHash: 'tampered' };
      expect(() => replay(ctx, record(), actions, true)).toThrow('State hash differs after action 5');
      expect(() => replay(ctx, record(), actions, false)).not.toThrow();
    });

    it('throws on a gap in the actions', () => {
      const { moves } = botMoves(openingState(ctx, SEED, SEATS, {}), 3);
      expect(() => replay(ctx, record(), stored(moves).filter((a) => a.seq !== 2), false)).toThrow('Action 2 is missing');
    });
  });

  describe('views', () => {
    it("shows a seat its own hand and masks the other's, without the RNG or the log", () => {
      const { state } = botMoves(openingState(ctx, SEED, SEATS, {}), 2);
      const view = toSeatView(state, 'seat-0');
      expect(view).not.toHaveProperty('rng');
      expect(view).not.toHaveProperty('log');
      const hand = (seatId: string) => view.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === seatId)!.cards;
      expect(hand('seat-1').length).toBeGreaterThan(0);
      expect(hand('seat-1').every((card) => card.definitionId === 'hidden')).toBe(true);
      expect(hand('seat-0').some((card) => card.definitionId !== 'hidden')).toBe(true);
    });

    it('carries the log from logFrom, and the given legal actions and clock', () => {
      const { state } = botMoves(openingState(ctx, SEED, SEATS, {}), 2);
      const update = toGameUpdate({ gameId: 'game-1', seq: 2, state, seatId: 'seat-0', legalActions: [], logFrom: 1, clock: null, paused: false });
      expect(update.events).toEqual(state.log.slice(1));
      expect(update).toMatchObject({ gameId: 'game-1', seq: 2, logFrom: 1, legalActions: [], clock: null, paused: false });
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --selectProjects server engineGame`
Expected: FAIL, because `./engineGame` does not exist.

- [ ] **Step 4: Write the implementation**

Create `projects/server/src/game/engineGame.ts`:

```ts
import { createHash } from 'node:crypto';
import { guozhanMode } from 'content';
import { createGame, createRng, getActiveSeatId, getLegalActions, isOfferedAction, resolve, shuffle } from 'engine';
import type { Action, ContentRegistry, EngineContext, GameRules, GameState } from 'engine';
import type { MemberKind } from 'protocol';
import { GameActionRecord, GameRecord, GameSeat } from '../persistence/records';

// Seating draws from its own stream of the seed, apart from the game's own
// (spec "Start Game, step by step").
export const SEATING_SALT = 0x5eed5ea7;

export function engineContext(registry: ContentRegistry): EngineContext {
  return { registry, mode: guozhanMode };
}

export interface SeatCandidate {
  id: string;
  name: string;
  kind: MemberKind;
}

// Members (in join order) to seats seat-0, seat-1, … in a seeded random order.
export function drawSeats(members: readonly SeatCandidate[], seed: number): GameSeat[] {
  const { items } = shuffle(members, createRng(seed ^ SEATING_SALT));
  return items.map((member, i) => ({ seatId: `seat-${i}`, roomPlayerId: member.id, name: member.name, kind: member.kind }));
}

// The engine's opening state with each seat's name and kind, as
// GameService.startGame sets them.
export function openingState(ctx: EngineContext, seed: number, seats: readonly GameSeat[], rules: GameRules): GameState {
  const created = createGame(ctx.mode, ctx.registry, seats.map((s) => s.seatId), seed, rules);
  const players = created.players.map((player) => {
    const seat = seats.find((s) => s.seatId === player.seatId);
    return seat ? { ...player, kind: seat.kind, name: seat.name } : player;
  });
  return { ...created, players };
}

export function stateHash(state: GameState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

// A player's move that the engine refuses or never offered. Nothing changed.
export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

// A seated player's actions as one move. Before each action, its seat must be
// the one to act and the action must be one the engine offers it. Returns the
// state after each action, or throws IllegalMoveError and changes nothing.
export function applyMove(ctx: EngineContext, state: GameState, seatId: string, actions: readonly Action[]): GameState[] {
  const steps: GameState[] = [];
  let current = state;
  for (const action of actions) {
    if (getActiveSeatId(current) !== seatId || action.seatId !== seatId) throw new IllegalMoveError(`Seat ${seatId} can't act now`);
    if (!isOfferedAction(action, getLegalActions(current, seatId, ctx.registry))) throw new IllegalMoveError(`${action.kind} was not offered to ${seatId}`);
    try {
      current = resolve(current, action, ctx).state;
    } catch (err) {
      throw new IllegalMoveError(err instanceof Error ? err.message : String(err));
    }
    steps.push(current);
  }
  return steps;
}

// Actions the server chose itself (a bot's, or a timeout's defaults). No
// checks: the engine's own errors are thrown as they are.
export function applyActions(ctx: EngineContext, state: GameState, actions: readonly Action[]): GameState[] {
  const steps: GameState[] = [];
  let current = state;
  for (const action of actions) {
    current = resolve(current, action, ctx).state;
    steps.push(current);
  }
  return steps;
}

// Rebuilds a game from its stored actions. With `checkHashes`, every step's
// hash must match the stored one (spec "Restore on startup").
export function replay(ctx: EngineContext, game: GameRecord, actions: readonly GameActionRecord[], checkHashes: boolean): GameState {
  let state = openingState(ctx, game.seed, game.seats, game.rules);
  actions.forEach((row, i) => {
    if (row.seq !== i + 1) throw new Error(`Action ${i + 1} is missing`);
    state = resolve(state, row.action, ctx).state;
    if (checkHashes && stateHash(state) !== row.stateHash) throw new Error(`State hash differs after action ${row.seq}`);
  });
  return state;
}
```

Create `projects/server/src/views/game.ts`:

```ts
import { redactStateForSeat } from 'engine';
import type { Action, GameState } from 'engine';
import type { GameClockView, GameUpdate, SeatView } from 'protocol';

// What one seat may see: the engine's redaction, without the RNG (it holds the
// seed) and without the log (sent as events). The only game data a client gets.
export function toSeatView(state: GameState, seatId: string): SeatView {
  const { rng: _rng, log: _log, ...view } = redactStateForSeat(state, seatId);
  return view;
}

export interface GameUpdateInput {
  gameId: string;
  seq: number;
  state: GameState;
  seatId: string;
  legalActions: Action[];
  logFrom: number;
  clock: GameClockView | null;
  paused: boolean;
}

export function toGameUpdate(input: GameUpdateInput): GameUpdate {
  return {
    gameId: input.gameId,
    seq: input.seq,
    view: toSeatView(input.state, input.seatId),
    legalActions: input.legalActions,
    logFrom: input.logFrom,
    events: input.state.log.slice(input.logFrom),
    clock: input.clock,
    paused: input.paused,
  };
}
```

- [ ] **Step 5: Run tests and the type check**

Run: `npx jest --selectProjects server engineGame && npm run typecheck:server`
Expected: PASS, and no type errors.

- [ ] **Step 6: Commit**

```bash
git add jest.config.js projects/server/src/game projects/server/src/views/game.ts
git commit -m "feat(server): seating, opening state, checked moves, replay and seat views

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: `GameRunner`: moves, clocks, bots, takeover, reclaim and the solo pause

**Files:**
- Create:
  - `projects/server/src/game/scheduler.ts`
  - `projects/server/src/game/testing.ts` (a test helper)
  - `projects/server/src/game/gameRunner.ts`
- Test: `projects/server/src/game/gameRunner.spec.ts`

**Interfaces:**
- Consumes:
  - Task 5: `applyMove`, `applyActions`, `IllegalMoveError`, `stateHash`, `openingState`, `engineContext` and `toGameUpdate`.
  - From `engine`: `EMPTY_CLOCK`, `switchClock`, `expireClock`, `describeDecision`, `defaultActionsFor`, `getActiveSeatId`, `getLegalActions` and `redactStateForSeat`.
  - From `bots`: `ruleBasedPolicy`, and the types `BotPolicy` and `BotTurnMemory`.
  - `RoomError` (its codes include `not_your_turn`, `stale` and `illegal_action` since Task 2), and `NewGameAction` and `GameRecord` (Task 3).
- Produces:
  - `scheduler.ts`:
    - `Scheduler { schedule(delayMs, run: () => Promise<void>): () => void }`
    - `realScheduler`
  - `testing.ts`: `ManualScheduler`, with:
    - `now`
    - `clock()`
    - `schedule`
    - `pending`
    - `nextAt`
    - `advance(ms)`
    - `runUntil(done, limit?)`
  - `gameRunner.ts`:
    - `BOT_DELAY_MS = 700`, `TAKEOVER_AWAY_MS = 60_000`, `TAKEOVER_TIMEOUTS = 2`
    - `RunnerHost`, `RunnerOptions` and `RunnerInput`
    - `GameRunner`, with:
      - `state`, `seq`, `record`, `id` and `paused`
      - `seatOf(playerId)`, `botControlled(playerId)` and `isBotPlayed(seatId)`
      - `start()` and `stop()`
      - `submit(playerId, gameId, baseSeq, actions)`
      - `connected(playerId)`, `disconnected(playerId)`, `left(playerId)` and `tick()`
      - `updateFor(playerId, logFrom): GameUpdate | null`

Every call into a runner, and all the work its timers run, must happen on its room's queue. Task 7 does that. In this task's tests, nothing else runs at the same time.

- [ ] **Step 1: Write the scheduler and the manual test scheduler**

Create `projects/server/src/game/scheduler.ts`:

```ts
// Timers for a room's game. The room wraps `run` so it runs on its queue.
export interface Scheduler {
  // Calls `run` after `delayMs`, unless cancelled first. Returns the cancel.
  schedule(delayMs: number, run: () => Promise<void>): () => void;
}

export const realScheduler: Scheduler = {
  schedule(delayMs, run) {
    const timer = setTimeout(() => void run(), delayMs);
    timer.unref();
    return () => clearTimeout(timer);
  },
};
```

Create `projects/server/src/game/testing.ts`:

```ts
import { Scheduler } from './scheduler';

interface Task {
  at: number;
  order: number;
  run: () => Promise<void>;
}

// A clock and timers that a test moves by hand. `advance` runs every task that
// falls due, in time order, and waits for each before the next.
export class ManualScheduler implements Scheduler {
  private tasks: Task[] = [];
  private order = 0;

  constructor(public now: number) {}

  readonly clock = (): number => this.now;

  schedule(delayMs: number, run: () => Promise<void>): () => void {
    const task: Task = { at: this.now + delayMs, order: this.order++, run };
    this.tasks.push(task);
    return () => {
      this.tasks = this.tasks.filter((t) => t !== task);
    };
  }

  get pending(): number {
    return this.tasks.length;
  }

  // When the next task falls due, or null.
  get nextAt(): number | null {
    return this.tasks.length === 0 ? null : Math.min(...this.tasks.map((t) => t.at));
  }

  async advance(ms: number): Promise<void> {
    const until = this.now + ms;
    for (;;) {
      const due = this.tasks.filter((t) => t.at <= until).sort((a, b) => a.at - b.at || a.order - b.order)[0];
      if (!due) break;
      this.tasks = this.tasks.filter((t) => t !== due);
      this.now = Math.max(this.now, due.at);
      await due.run();
    }
    this.now = until;
  }

  // Runs task after task until `done()` holds, nothing is pending, or `limit` tasks ran.
  async runUntil(done: () => boolean, limit = 20_000): Promise<void> {
    for (let i = 0; i < limit && !done(); i += 1) {
      const at = this.nextAt;
      if (at === null) return;
      await this.advance(Math.max(0, at - this.now));
    }
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `projects/server/src/game/gameRunner.spec.ts`:

```ts
import { ruleBasedPolicy } from 'bots';
import type { BotPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import { defaultActionsFor, getActiveSeatId, getLegalActions } from 'engine';
import type { Action } from 'engine';
import type { MemberKind } from 'protocol';
import { GameRecord, GameSeat } from '../persistence/records';
import { NewGameAction } from '../persistence/repositories';
import { engineContext, openingState, stateHash } from './engineGame';
import { BOT_DELAY_MS, GameRunner, RunnerHost, TAKEOVER_AWAY_MS } from './gameRunner';
import { ManualScheduler } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const GAME_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const SEED = 1234;
const registry = buildContentRegistry();
const ctx = engineContext(registry);
const code = (value: string) => expect.objectContaining({ code: value });

class FakeHost implements RunnerHost {
  readonly scheduler = new ManualScheduler(T0);
  readonly stored: NewGameAction[] = [];
  readonly published: number[] = [];
  readonly errors: unknown[] = [];
  seatsChangedCount = 0;
  finishedCount = 0;
  broken: unknown = null;
  failPersist = false;
  now = () => this.scheduler.now;
  schedule = (delayMs: number, work: () => Promise<void>) => this.scheduler.schedule(delayMs, work);
  async persist(actions: NewGameAction[]): Promise<void> {
    if (this.failPersist) throw new Error('database down');
    this.stored.push(...actions);
  }
  publish(logFrom: number): void {
    this.published.push(logFrom);
  }
  seatsChanged(): void {
    this.seatsChangedCount += 1;
  }
  async finished(): Promise<void> {
    this.finishedCount += 1;
  }
  async broke(err: unknown): Promise<void> {
    this.broken = err;
  }
  logError(err: unknown): void {
    this.errors.push(err);
  }
}

// Seat i is played by member `p${i}`. Every human in `connected` starts connected.
function setup(options: { kinds?: MemberKind[]; solo?: boolean; connected?: string[]; policy?: BotPolicy } = {}) {
  const kinds = options.kinds ?? ['human', 'bot'];
  const seats: GameSeat[] = kinds.map((kind, i) => ({ seatId: `seat-${i}`, roomPlayerId: `p${i}`, name: kind === 'bot' ? `Bot ${i}` : `Player ${i}`, kind }));
  const record: GameRecord = {
    id: GAME_ID,
    roomId: 'room-1',
    seed: SEED,
    seats,
    rules: {},
    buildId: 'test',
    status: 'running',
    result: null,
    actionCount: 0,
    startedAt: new Date(T0),
    finishedAt: null,
  };
  const host = new FakeHost();
  const runner = new GameRunner(
    {
      record,
      state: openingState(ctx, SEED, seats, {}),
      seq: 0,
      connected: new Set(options.connected ?? ['p0']),
      present: new Set(seats.map((s) => s.roomPlayerId)),
    },
    ctx,
    host,
    { solo: options.solo ?? false, botDelayMs: BOT_DELAY_MS, takeoverAwayMs: TAKEOVER_AWAY_MS, policy: options.policy ?? ruleBasedPolicy }
  );
  runner.start();
  return { runner, host, scheduler: host.scheduler, legal: () => runner.updateFor('p0', 0)!.legalActions };
}

describe('GameRunner', () => {
  it("starts the first decision on its human seat's clock, offering moves to that seat only", () => {
    const { runner } = setup();
    const update = runner.updateFor('p0', 0)!;
    expect(update.clock).toEqual({ seatId: 'seat-0', kind: 'selection', endsAt: T0 + 300_000, totalSeconds: 300, serverNow: T0 });
    expect(update.legalActions.length).toBeGreaterThan(0);
    expect(update.events).toEqual(runner.state.log);
    expect(update.view).not.toHaveProperty('rng');
    expect(runner.updateFor('p1', 0)!.legalActions).toEqual([]);
    expect(runner.updateFor('nobody', 0)).toBeNull();
  });

  it('applies an offered move, stores it with its state hash, and publishes from the old log length', async () => {
    const { runner, host, legal } = setup();
    const logBefore = runner.state.log.length;
    const [move] = legal();
    await runner.submit('p0', GAME_ID, 0, [move]);
    expect(runner.seq).toBe(1);
    expect(host.stored).toEqual([{ seq: 1, seatId: 'seat-0', source: 'human', action: move, stateHash: stateHash(runner.state) }]);
    expect(host.published).toEqual([logBefore]);
  });

  it('refuses moves out of turn, stale or never offered, and changes nothing (Review Focus 1 and 2)', async () => {
    const { runner, host, legal } = setup();
    const before = runner.state;
    const [move] = legal();
    await expect(runner.submit('p1', GAME_ID, 0, [{ ...move, seatId: 'seat-1' } as Action])).rejects.toEqual(code('not_your_turn'));
    await expect(runner.submit('p0', GAME_ID, 1, [move])).rejects.toEqual(code('stale'));
    await expect(runner.submit('p0', 'aaaaaaaa-0000-4000-8000-000000000002', 0, [move])).rejects.toEqual(code('stale'));
    await expect(runner.submit('p0', GAME_ID, 0, [{ kind: 'DrawCardsAction', seatId: 'seat-0', count: 5 }])).rejects.toEqual(code('illegal_action'));
    await expect(runner.submit('p0', GAME_ID, 0, [{ ...move, extra: 1 } as Action])).rejects.toEqual(code('illegal_action'));
    await expect(runner.submit('p0', GAME_ID, 0, [move, move])).rejects.toEqual(code('illegal_action'));
    expect(runner.seq).toBe(0);
    expect(runner.state).toBe(before);
    expect(host.stored).toEqual([]);
    expect(host.published).toEqual([]);
  });

  it('refuses a human move that cannot be stored, and keeps the state', async () => {
    const { runner, host, legal } = setup();
    host.failPersist = true;
    await expect(runner.submit('p0', GAME_ID, 0, [legal()[0]])).rejects.toThrow('database down');
    expect(runner.seq).toBe(0);
  });

  it("moves a bot seat after the bot delay, and shows the bot's timer as its clock", async () => {
    const { runner, host, scheduler, legal } = setup();
    await runner.submit('p0', GAME_ID, 0, [legal()[0]]);
    expect(runner.updateFor('p0', 0)!.clock).toEqual({ seatId: 'seat-1', kind: 'selection', endsAt: T0 + BOT_DELAY_MS, totalSeconds: BOT_DELAY_MS / 1000, serverNow: T0 });
    await scheduler.advance(BOT_DELAY_MS - 1);
    expect(host.stored).toHaveLength(1);
    await scheduler.advance(1);
    expect(host.stored[1]).toMatchObject({ seq: 2, seatId: 'seat-1', source: 'bot' });
  });

  it("submits the engine's default when the clock runs out", async () => {
    const { runner, host, scheduler } = setup();
    const opening = runner.state;
    await scheduler.advance(300_000);
    expect(host.stored).toEqual([
      { seq: 1, seatId: 'seat-0', source: 'timeout', action: defaultActionsFor(opening, getLegalActions(opening, 'seat-0', registry))[0], stateHash: stateHash(runner.state) },
    ]);
  });

  it('hands a seat to a bot after two timeouts in a row while its player is away', async () => {
    const { runner, host, scheduler } = setup({ connected: [] });
    await scheduler.runUntil(() => runner.botControlled('p0'));
    expect(runner.botControlled('p0')).toBe(true);
    expect(host.seatsChangedCount).toBe(1);
    expect(host.stored.filter((a) => a.source === 'takeover')).toEqual([]);
    expect(host.stored.filter((a) => a.seatId === 'seat-0').every((a) => a.source === 'timeout')).toBe(true);
    await scheduler.runUntil(() => host.stored.some((a) => a.source === 'takeover'));
    expect(host.stored.find((a) => a.source === 'takeover')?.seatId).toBe('seat-0');
  });

  it('never hands a connected player\'s seat to a bot for timing out', async () => {
    const { runner, host, scheduler } = setup();
    await scheduler.runUntil(() => host.stored.filter((a) => a.source === 'timeout').length >= 3);
    expect(runner.botControlled('p0')).toBe(false);
  });

  it('gives the seat back when its player returns, cancelling a pending bot move (Review Focus 3)', async () => {
    const { runner, host, scheduler } = setup({ connected: [] });
    await scheduler.runUntil(() => runner.botControlled('p0'));
    await scheduler.runUntil(() => getActiveSeatId(runner.state) === 'seat-0' && !runner.state.result);
    const storedBefore = host.stored.length;
    runner.connected('p0');
    expect(runner.botControlled('p0')).toBe(false);
    expect(host.seatsChangedCount).toBe(2);
    const update = runner.updateFor('p0', 0)!;
    expect(update.legalActions.length).toBeGreaterThan(0);
    expect(update.clock?.seatId).toBe('seat-0');
    expect(update.clock?.totalSeconds).not.toBe(BOT_DELAY_MS / 1000);
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored.slice(storedBefore).filter((a) => a.source === 'takeover')).toEqual([]);
  });

  it("hands an open room's seat to a bot once its player has been away 60 s, on the tick", async () => {
    const { runner, host, scheduler } = setup();
    runner.disconnected('p0');
    await scheduler.advance(TAKEOVER_AWAY_MS - 1);
    runner.tick();
    expect(runner.botControlled('p0')).toBe(false);
    await scheduler.advance(1);
    runner.tick();
    expect(runner.botControlled('p0')).toBe(true);
    expect(host.seatsChangedCount).toBe(1);
    expect(runner.updateFor('p0', 0)!.legalActions).toEqual([]);
    expect(runner.updateFor('p0', 0)!.clock).toMatchObject({ seatId: 'seat-0', totalSeconds: BOT_DELAY_MS / 1000 });
  });

  it("never hands a solo room's seat to a bot", async () => {
    const { runner, scheduler } = setup({ solo: true });
    runner.disconnected('p0');
    await scheduler.advance(2 * TAKEOVER_AWAY_MS);
    runner.tick();
    expect(runner.botControlled('p0')).toBe(false);
  });

  it('pauses a solo game while its player is away, and resumes the clock where it stopped', async () => {
    const { runner, host, scheduler } = setup({ solo: true });
    await scheduler.advance(100_000);
    runner.disconnected('p0');
    expect(runner.paused).toBe(true);
    expect(scheduler.pending).toBe(0);
    expect(runner.updateFor('p0', 0)).toMatchObject({ paused: true, clock: null, legalActions: [] });
    await scheduler.advance(3_600_000);
    expect(host.stored).toEqual([]);
    runner.connected('p0');
    expect(runner.paused).toBe(false);
    expect(runner.updateFor('p0', 0)!.clock).toMatchObject({ seatId: 'seat-0', endsAt: scheduler.now + 200_000 });
  });

  it('keeps bots still while a solo game is paused', async () => {
    const { runner, host, scheduler, legal } = setup({ solo: true });
    await runner.submit('p0', GAME_ID, 0, [legal()[0]]);
    runner.disconnected('p0');
    await scheduler.advance(10_000);
    expect(host.stored).toHaveLength(1);
    runner.connected('p0');
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored).toHaveLength(2);
  });

  it('plays a game to its end and reports it finished once', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['bot', 'bot'], connected: [] });
    await scheduler.runUntil(() => host.finishedCount > 0);
    expect(runner.state.result).not.toBeNull();
    expect(host.finishedCount).toBe(1);
    expect(host.stored.map((a) => a.seq)).toEqual(Array.from({ length: runner.seq }, (_, i) => i + 1));
    expect(host.stored.at(-1)?.stateHash).toBe(stateHash(runner.state));
    expect(scheduler.pending).toBe(0);
    expect(runner.updateFor('p0', 0)).toMatchObject({ legalActions: [], clock: null });
  }, 60_000);

  it('reports the game broken when the engine or a bot fails on a move the server makes', async () => {
    const failing: BotPolicy = {
      id: 'failing',
      decide: () => {
        throw new Error('bot bug');
      },
    };
    const { host, scheduler } = setup({ kinds: ['bot', 'human'], connected: ['p1'], policy: failing });
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.broken).toEqual(new Error('bot bug'));
    expect(scheduler.pending).toBe(0);
  });

  it('retries a bot move that could not be stored', async () => {
    const { runner, host, scheduler } = setup({ kinds: ['bot', 'human'], connected: ['p1'] });
    host.failPersist = true;
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.errors).toHaveLength(1);
    expect(runner.seq).toBe(0);
    expect(scheduler.pending).toBe(1);
    host.failPersist = false;
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored).toEqual([expect.objectContaining({ seq: 1, seatId: 'seat-0', source: 'bot' })]);
  });

  it("gives a departed member's seat to a bot for the rest of the game", async () => {
    const { runner, host, scheduler } = setup();
    runner.left('p0');
    expect(runner.botControlled('p0')).toBe(true);
    runner.connected('p0');
    expect(runner.botControlled('p0')).toBe(true);
    await scheduler.advance(BOT_DELAY_MS);
    expect(host.stored[0]).toMatchObject({ seatId: 'seat-0', source: 'takeover' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --selectProjects server gameRunner`
Expected: FAIL, because `./gameRunner` does not exist.

- [ ] **Step 4: Write the implementation**

Create `projects/server/src/game/gameRunner.ts`:

```ts
import type { BotPolicy, BotTurnMemory } from 'bots';
import { defaultActionsFor, describeDecision, EMPTY_CLOCK, expireClock, getActiveSeatId, getLegalActions, redactStateForSeat, switchClock } from 'engine';
import type { Action, ClockState, DecisionKind, EngineContext, GameState } from 'engine';
import type { ActionSource, GameClockView, GameUpdate } from 'protocol';
import { GameRecord } from '../persistence/records';
import { NewGameAction } from '../persistence/repositories';
import { RoomError } from '../rooms/errors';
import { toGameUpdate } from '../views/game';
import { applyActions, applyMove, IllegalMoveError, stateHash } from './engineGame';

// Delay before each bot move, so people can follow along.
export const BOT_DELAY_MS = 700;
// An open room's seat goes to a bot once its player has been away this long…
export const TAKEOVER_AWAY_MS = 60_000;
// …or after this many timeouts in a row while they are away (spec "Takeover").
export const TAKEOVER_TIMEOUTS = 2;

// What a runner needs from its room.
export interface RunnerHost {
  now(): number;
  // Runs `work` on the room's queue after `delayMs`. Returns the cancel.
  schedule(delayMs: number, work: () => Promise<void>): () => void;
  // Stores the actions, or throws and stores none.
  persist(actions: NewGameAction[]): Promise<void>;
  // Sends every member their update, with the log from `logFrom`.
  publish(logFrom: number): void;
  // A seat was taken over or given back: members' botControlled changed.
  seatsChanged(): void;
  // The game has a result. Called once, after the final publish.
  finished(): Promise<void>;
  // The engine (or a bot) failed on a move the server made.
  broke(err: unknown): Promise<void>;
  logError(err: unknown, message: string): void;
}

export interface RunnerOptions {
  // A solo game pauses while its player is away, and never takes a seat over.
  solo: boolean;
  botDelayMs: number;
  takeoverAwayMs: number;
  policy: BotPolicy;
}

export interface RunnerInput {
  record: GameRecord;
  state: GameState;
  // How many actions `state` has applied.
  seq: number;
  // Members connected now. Every other human starts away.
  connected: ReadonlySet<string>;
  // Current members. A human seat whose member is gone is a bot's to the end.
  present: ReadonlySet<string>;
}

type Timer = { kind: 'clock' } | { kind: 'bot'; seatId: string; decision: DecisionKind; endsAt: number };

// One running game (spec "Game runner"): the only code that moves its state.
// Every call and every timer runs on the room's queue, one at a time.
export class GameRunner {
  readonly record: GameRecord;
  state: GameState;
  seq: number;
  private clock: ClockState = EMPTY_CLOCK;
  private timer: Timer | null = null;
  private cancelTimer: (() => void) | null = null;
  // Bumped whenever timers are cancelled, so work scheduled before is ignored.
  private generation = 0;
  private stopped = false;
  private readonly memories = new Map<string, BotTurnMemory>();
  // Humans without a connection, and since when (ms).
  private readonly away = new Map<string, number>();
  // Human seats a bot plays until their player returns.
  private readonly controlled = new Set<string>();
  // Human seats whose player left: a bot plays them to the end.
  private readonly gone = new Set<string>();
  // Per seat: timeouts in a row while its player was away.
  private readonly timeouts = new Map<string, number>();

  constructor(
    input: RunnerInput,
    private readonly ctx: EngineContext,
    private readonly host: RunnerHost,
    private readonly options: RunnerOptions
  ) {
    this.record = input.record;
    this.state = input.state;
    this.seq = input.seq;
    const now = host.now();
    for (const seat of input.record.seats) {
      if (seat.kind !== 'human') continue;
      if (!input.present.has(seat.roomPlayerId)) this.gone.add(seat.seatId);
      else if (!input.connected.has(seat.roomPlayerId)) this.away.set(seat.roomPlayerId, now);
    }
  }

  get id(): string {
    return this.record.id;
  }

  // A solo game waits while its player is away: no clock, no bot moves.
  get paused(): boolean {
    return this.options.solo && this.record.seats.some((s) => s.kind === 'human' && this.away.has(s.roomPlayerId));
  }

  seatOf(playerId: string): string | null {
    return this.record.seats.find((s) => s.roomPlayerId === playerId)?.seatId ?? null;
  }

  // Whether a bot plays this member's seat now (RoomSnapshot.botControlled).
  botControlled(playerId: string): boolean {
    const seatId = this.seatOf(playerId);
    return seatId !== null && (this.controlled.has(seatId) || this.gone.has(seatId));
  }

  // Whether a bot moves for this seat: a bot's seat, or a human's it took over.
  isBotPlayed(seatId: string): boolean {
    const seat = this.record.seats.find((s) => s.seatId === seatId);
    return seat?.kind !== 'human' || this.controlled.has(seatId) || this.gone.has(seatId);
  }

  // Sets the first clock or bot move. Call once, after construction.
  start(): void {
    this.reschedule();
  }

  // No more moves or timers: the game ended, or the room is going away.
  stop(): void {
    this.stopped = true;
    this.cancel();
  }

  // A seated member's move (spec "Processing an action input"). A refusal
  // throws a RoomError and changes nothing.
  async submit(playerId: string, gameId: string, baseSeq: number, actions: Action[]): Promise<void> {
    if (gameId !== this.record.id) throw new RoomError('stale');
    const seatId = this.seatOf(playerId);
    if (this.stopped || !seatId || this.isBotPlayed(seatId) || getActiveSeatId(this.state) !== seatId) throw new RoomError('not_your_turn');
    if (baseSeq !== this.seq) throw new RoomError('stale');
    let steps: GameState[];
    try {
      steps = applyMove(this.ctx, this.state, seatId, actions);
    } catch (err) {
      if (err instanceof IllegalMoveError) throw new RoomError('illegal_action');
      throw err;
    }
    this.timeouts.delete(seatId);
    await this.commit(seatId, 'human', actions, steps);
  }

  // The member has a connection again. A taken-over seat comes back now (no
  // bot move is under way: the queue runs one input at a time), and a solo
  // game resumes.
  connected(playerId: string): void {
    if (this.stopped) return;
    this.away.delete(playerId);
    const seatId = this.seatOf(playerId);
    if (seatId) this.timeouts.delete(seatId);
    const reclaimed = seatId !== null && this.controlled.delete(seatId);
    if (reclaimed) this.host.seatsChanged();
    if (reclaimed || this.options.solo) this.refresh();
  }

  disconnected(playerId: string): void {
    if (this.stopped || !this.seatOf(playerId)) return;
    this.away.set(playerId, this.host.now());
    if (this.options.solo) this.refresh();
  }

  // The member left the room: a bot plays their seat for the rest of the game.
  left(playerId: string): void {
    const seatId = this.seatOf(playerId);
    if (this.stopped || !seatId) return;
    this.away.delete(playerId);
    this.controlled.delete(seatId);
    this.gone.add(seatId);
    this.refresh();
  }

  // The room tick. In an open room, a seat whose player has been away long
  // enough goes to a bot.
  tick(): void {
    if (this.stopped || this.options.solo) return;
    const now = this.host.now();
    let changed = false;
    for (const [playerId, since] of this.away) {
      const seatId = this.seatOf(playerId);
      if (!seatId || this.isBotPlayed(seatId) || now - since < this.options.takeoverAwayMs) continue;
      this.controlled.add(seatId);
      changed = true;
    }
    if (!changed) return;
    this.host.seatsChanged();
    this.refresh();
  }

  // What this member is sent: their seat's view, their moves when they must
  // act, the log from `logFrom`, and the clock. Null for a member with no seat.
  updateFor(playerId: string, logFrom: number): GameUpdate | null {
    const seatId = this.seatOf(playerId);
    if (!seatId) return null;
    const acting = !this.stopped && !this.paused && getActiveSeatId(this.state) === seatId && !this.isBotPlayed(seatId);
    return toGameUpdate({
      gameId: this.record.id,
      seq: this.seq,
      state: this.state,
      seatId,
      legalActions: acting ? getLegalActions(this.state, seatId, this.ctx.registry) : [],
      logFrom,
      clock: this.clockView(),
      paused: this.paused,
    });
  }

  // The clock or the pause changed, not the state: reschedule and tell everyone.
  private refresh(): void {
    this.reschedule();
    this.host.publish(this.state.log.length);
  }

  // Stores a move, then applies it. A human move that can't be stored throws.
  // A server move that can't be stored is logged and retried.
  private async commit(seatId: string, source: ActionSource, actions: Action[], steps: GameState[]): Promise<boolean> {
    const rows: NewGameAction[] = actions.map((action, i) => ({ seq: this.seq + 1 + i, seatId, source, action, stateHash: stateHash(steps[i]) }));
    try {
      await this.host.persist(rows);
    } catch (err) {
      if (source === 'human') throw err;
      this.host.logError(err, `Game ${this.record.id}: a ${source} move could not be stored; retrying`);
      this.reschedule();
      return false;
    }
    const logFrom = this.state.log.length;
    this.state = steps[steps.length - 1];
    this.seq += rows.length;
    if (this.state.result) {
      this.stop();
      this.host.publish(logFrom);
      await this.host.finished();
      return true;
    }
    this.reschedule();
    this.host.publish(logFrom);
    return true;
  }

  // Cancels the timer, then sets the next one: a bot move for a bot-played
  // seat, or the human's decision clock. A paused solo game sets none.
  private reschedule(): void {
    this.cancel();
    if (this.stopped) return;
    const now = this.host.now();
    const seatId = getActiveSeatId(this.state);
    if (!seatId) {
      this.clock = switchClock(this.clock, null, now);
      return;
    }
    const decision = describeDecision(this.state, seatId, getLegalActions(this.state, seatId, this.ctx.registry), String(this.seq));
    const generation = this.generation;
    if (this.isBotPlayed(seatId)) {
      // A human's Play phase clock waits while a bot responds.
      this.clock = switchClock(this.clock, null, now);
      if (this.paused) return;
      this.timer = { kind: 'bot', seatId, decision: decision?.kind ?? 'response', endsAt: now + this.options.botDelayMs };
      this.cancelTimer = this.host.schedule(this.options.botDelayMs, () => this.botMove(generation));
      return;
    }
    this.clock = switchClock(this.clock, this.paused ? null : decision, now);
    const running = this.clock.running;
    if (!running) return;
    this.timer = { kind: 'clock' };
    this.cancelTimer = this.host.schedule(Math.max(0, running.endsAt - now), () => this.timeout(generation));
  }

  private cancel(): void {
    this.generation += 1;
    this.cancelTimer?.();
    this.cancelTimer = null;
    this.timer = null;
  }

  private async botMove(generation: number): Promise<void> {
    if (this.stopped || generation !== this.generation) return;
    const seatId = getActiveSeatId(this.state);
    if (!seatId || !this.isBotPlayed(seatId)) return this.reschedule();
    let action: Action;
    let memory: BotTurnMemory;
    let steps: GameState[];
    try {
      const legal = getLegalActions(this.state, seatId, this.ctx.registry);
      const decision = this.options.policy.decide(redactStateForSeat(this.state, seatId), seatId, legal, this.ctx.registry, this.memories.get(seatId) ?? null);
      action = decision.action;
      memory = decision.memory;
      steps = applyActions(this.ctx, this.state, [action]);
    } catch (err) {
      return this.breakDown(err);
    }
    const isBotSeat = this.record.seats.find((s) => s.seatId === seatId)?.kind === 'bot';
    if (await this.commit(seatId, isBotSeat ? 'bot' : 'takeover', [action], steps)) this.memories.set(seatId, memory);
  }

  // The clock ran out: the engine's default for the decision, as one move.
  private async timeout(generation: number): Promise<void> {
    if (this.stopped || generation !== this.generation) return;
    const seatId = getActiveSeatId(this.state);
    if (!seatId || this.isBotPlayed(seatId)) return this.reschedule();
    this.clock = expireClock(this.clock);
    let actions: Action[];
    let steps: GameState[];
    try {
      actions = defaultActionsFor(this.state, getLegalActions(this.state, seatId, this.ctx.registry));
      steps = applyActions(this.ctx, this.state, actions);
    } catch (err) {
      return this.breakDown(err);
    }
    const playerId = this.record.seats.find((s) => s.seatId === seatId)?.roomPlayerId ?? null;
    const inARow = playerId !== null && this.away.has(playerId) ? (this.timeouts.get(seatId) ?? 0) + 1 : 0;
    this.timeouts.set(seatId, inARow);
    const takeOver = !this.options.solo && inARow >= TAKEOVER_TIMEOUTS;
    // Before the commit, so the seat's next decision already goes to the bot.
    if (takeOver) this.controlled.add(seatId);
    await this.commit(seatId, 'timeout', actions, steps);
    if (takeOver) this.host.seatsChanged();
  }

  private async breakDown(err: unknown): Promise<void> {
    this.stop();
    await this.host.broke(err);
  }

  private clockView(): GameClockView | null {
    const now = this.host.now();
    const timer = this.timer;
    if (timer?.kind === 'bot') return { seatId: timer.seatId, kind: timer.decision, endsAt: timer.endsAt, totalSeconds: this.options.botDelayMs / 1000, serverNow: now };
    const running = this.clock.running;
    if (timer?.kind !== 'clock' || !running) return null;
    return { seatId: running.decision.seatId, kind: running.decision.kind, endsAt: running.endsAt, totalSeconds: running.totalMs / 1000, serverNow: now };
  }
}
```

- [ ] **Step 5: Run tests and the type check**

Run: `npx jest --selectProjects server gameRunner && npm run typecheck:server`
Expected: PASS, and no type errors.

If `'gives the seat back when its player returns…'` fails because the game ended before seat 0 was due again, raise the seed's game length by changing `SEED` for that test only. Don't loosen the assertions.

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/game
git commit -m "feat(server): GameRunner with clocks, bot moves, takeover, reclaim and the solo pause

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: `RoomService` runs games: Start Game, moves, resync, takeover, leaving, and the end of a game

**Files:**
- Create:
  - `projects/server/src/rooms/testing.ts` (`FakeConnection`, moved out of `roomService.spec.ts`)
  - `projects/server/src/rooms/roomGames.spec.ts`
- Modify:
  - `projects/server/src/rooms/room.ts`
  - `projects/server/src/rooms/roomService.ts`
  - `projects/server/src/rooms/roomService.spec.ts`
  - `projects/server/src/views/room.ts`
- Test: `projects/server/src/rooms/roomGames.spec.ts`, and the existing `roomService.spec.ts`, unchanged except for its `FakeConnection` import.

**Interfaces:**
- Consumes: Task 5's `drawSeats`, `openingState` and `engineContext`; Task 6's `GameRunner`, `RunnerHost`, `BOT_DELAY_MS`, `TAKEOVER_AWAY_MS`, `Scheduler`, `realScheduler` and `ManualScheduler`; Task 3's `repos.games`.
- Produces:
  - `RoomServiceDeps` gains these optional fields:
    - `registry`
    - `buildId` (default `'dev'`)
    - `randomSeed` (default `randomInt(0, 2 ** 31)`)
    - `scheduler` (default `realScheduler`)
    - `botDelayMs`
    - `takeoverAwayMs`
    - `botPolicy` (default `ruleBasedPolicy`)
  - `RoomService.command` handles `lobby.start`, `game.submit` and `game.resync`.
  - `room.leave` works while playing (Decision 8).
  - `connect` sends `welcome` with `you.seatId` and `game`.
  - `tick` runs `runner.tick()` for playing rooms.
  - `Room.lastGame: LastGame | null`.
  - `toRoomSnapshot(room, seatLimits, seating: SeatingView | null)` fills `seatId`, `botControlled` and `lastGame`.
  - private helpers that Task 8 reuses:
    - `startGame(entry)`
    - `run(entry, game, state, seq)`
    - `closeGame(entry, game, outcome, result)`
    - `dropRoom(entry, reason)`, which now also stops a runner
  - `rooms/testing.ts`: `FakeConnection`, with `sent`, `closed`, `last(type)`, `room` and `game`.

- [ ] **Step 1: Move `FakeConnection` into a shared test helper**

Create `projects/server/src/rooms/testing.ts`:

```ts
import type { GameUpdate, RoomSnapshot, ServerMessage } from 'protocol';
import { MemberConnection } from './roomService';

// A member connection that records what the room sent it.
export class FakeConnection implements MemberConnection {
  readonly sent: ServerMessage[] = [];
  closed = false;

  send(message: ServerMessage): void {
    this.sent.push(message);
  }

  close(): void {
    this.closed = true;
  }

  last<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }> | undefined {
    return [...this.sent].reverse().find((m) => m.type === type) as Extract<ServerMessage, { type: T }> | undefined;
  }

  // The room as this connection last saw it.
  get room(): RoomSnapshot | undefined {
    const message = [...this.sent].reverse().find((m) => m.type === 'room.updated' || m.type === 'welcome');
    return message && (message.type === 'room.updated' || message.type === 'welcome') ? message.room : undefined;
  }

  // The game as this connection last saw it, from a welcome or an update.
  get game(): GameUpdate | undefined {
    for (const message of [...this.sent].reverse()) {
      if (message.type === 'game.update') return message.game;
      if (message.type === 'welcome' && message.game) return message.game;
    }
    return undefined;
  }
}
```

In `projects/server/src/rooms/roomService.spec.ts`, delete the `FakeConnection` class and add `import { FakeConnection } from './testing';`. Remove `MemberConnection` from the `./roomService` import if nothing else uses it. Remove `ServerMessage` from the `protocol` import if nothing else uses it.

- [ ] **Step 2: Write the failing test**

Create `projects/server/src/rooms/roomGames.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { BotPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import type { RoomCommand } from 'protocol';
import { TAKEOVER_AWAY_MS } from '../game/gameRunner';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import { RoomService, RoomServiceDeps } from './roomService';
import { FakeConnection } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const LIMITS = { min: 2, max: 6 };
const registry = buildContentRegistry();
const code = (value: string) => expect.objectContaining({ code: value });
const failing: BotPolicy = {
  id: 'failing',
  decide: () => {
    throw new Error('bot bug');
  },
};

async function setup(options: Partial<RoomServiceDeps> = {}) {
  const repos = createMemoryRepositories();
  const scheduler = new ManualScheduler(T0);
  const logError = jest.fn();
  const rooms = new RoomService({
    repos,
    seatLimits: LIMITS,
    now: scheduler.clock,
    logError,
    registry,
    buildId: 'test-build',
    randomSeed: () => 1234,
    scheduler,
    ...options,
  });
  const registered = (name: string) =>
    repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(scheduler.now) });
  const guest = (name: string) => repos.users.createGuest({ displayName: name, now: new Date(scheduler.now) });
  const connect = async (user: UserRecord, roomId: string) => {
    const connection = new FakeConnection();
    const playerId = await rooms.connect(user, roomId, connection);
    return { user, connection, playerId };
  };
  type Seat = Awaited<ReturnType<typeof connect>>;
  const command = (seat: Seat, roomId: string, message: RoomCommand) => rooms.command(seat.user, roomId, seat.playerId, message);
  const start = (seat: Seat, roomId: string) => command(seat, roomId, { type: 'lobby.start' });
  // Ann (registered host) and Bo, both connected, in a two-seat room.
  const pair = async (bo: 'registered' | 'guest' = 'registered') => {
    const annUser = await registered('Ann');
    const boUser = bo === 'registered' ? await registered('Bo') : await guest('Bo');
    const roomId = await rooms.create(annUser, { seatCount: 2, rules: {}, displayName: 'Ann' });
    await rooms.join(boUser, roomId, 'Bo');
    return { roomId, a: await connect(annUser, roomId), b: await connect(boUser, roomId) };
  };
  // Ann (registered host, connected) and Bot 1 in a two-seat room.
  const withBot = async () => {
    const annUser = await registered('Ann');
    const roomId = await rooms.create(annUser, { seatCount: 2, rules: {}, displayName: 'Ann' });
    const a = await connect(annUser, roomId);
    await command(a, roomId, { type: 'lobby.addBot' });
    return { roomId, a };
  };
  // Whichever of these seats has moves offered now.
  const mover = (...seats: Seat[]) => seats.find((s) => (s.connection.game?.legalActions.length ?? 0) > 0)!;
  return { repos, rooms, scheduler, logError, registered, guest, connect, command, start, pair, withBot, mover };
}

describe('RoomService games', () => {
  it('starts a full room for its host: seats drawn at random, and each member gets their own view', async () => {
    const { repos, pair, start } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    const room = a.connection.room!;
    expect(room.status).toBe('playing');
    expect(room.members.map((m) => m.seatId).sort()).toEqual(['seat-0', 'seat-1']);
    const annSeat = room.members.find((m) => m.playerId === a.playerId)!.seatId!;
    expect(a.connection.game).toMatchObject({ seq: 0, logFrom: 0, paused: false });
    expect(a.connection.game!.view).not.toHaveProperty('rng');
    expect(a.connection.game!.view.players.find((p) => p.seatId === annSeat)?.name).toBe('Ann');
    expect([a, b].filter((s) => s.connection.game!.legalActions.length > 0)).toHaveLength(1);
    const [game] = await repos.games.listRunning();
    expect(game).toMatchObject({ roomId, seed: 1234, buildId: 'test-build', status: 'running' });
    expect(game.seats.map((s) => s.name).sort()).toEqual(['Ann', 'Bo']);
  });

  it('refuses Start Game from a member who is not the host, and while a game runs', async () => {
    const { pair, start } = await setup();
    const { roomId, a, b } = await pair();
    await expect(start(b, roomId)).rejects.toEqual(code('not_host'));
    await start(a, roomId);
    await expect(start(a, roomId)).rejects.toEqual(code('in_progress'));
  });

  it('refuses Start Game until every seat is filled', async () => {
    const { rooms, registered, connect, start } = await setup();
    const ann = await registered('Ann');
    const roomId = await rooms.create(ann, { seatCount: 3, rules: {}, displayName: 'Ann' });
    const a = await connect(ann, roomId);
    await expect(start(a, roomId)).rejects.toEqual(code('not_full'));
  });

  it("applies a member's move, stores it, and sends everyone the new events", async () => {
    const { repos, pair, start, command, mover } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    const seat = mover(a, b);
    const before = seat.connection.game!;
    const move = before.legalActions[0];
    await command(seat, roomId, { type: 'game.submit', gameId: before.gameId, baseSeq: 0, actions: [move] });
    for (const each of [a, b]) expect(each.connection.game).toMatchObject({ seq: 1, logFrom: before.events.length });
    expect(await repos.games.listActions(before.gameId)).toEqual([expect.objectContaining({ seq: 1, source: 'human', action: move })]);
  });

  it('refuses a move out of turn or stale, and game messages with no game running', async () => {
    const { pair, start, command, mover } = await setup();
    const { roomId, a, b } = await pair();
    const someGame = randomUUID();
    await expect(command(a, roomId, { type: 'game.submit', gameId: someGame, baseSeq: 0, actions: [{ kind: 'EndPhaseAction', seatId: 'seat-0' }] })).rejects.toEqual(code('no_game'));
    await expect(command(a, roomId, { type: 'game.resync' })).rejects.toEqual(code('no_game'));
    await start(a, roomId);
    const seat = mover(a, b);
    const other = seat === a ? b : a;
    const { gameId, legalActions } = seat.connection.game!;
    await expect(command(other, roomId, { type: 'game.submit', gameId, baseSeq: 0, actions: [legalActions[0]] })).rejects.toEqual(code('not_your_turn'));
    await expect(command(seat, roomId, { type: 'game.submit', gameId, baseSeq: 3, actions: [legalActions[0]] })).rejects.toEqual(code('stale'));
  });

  it('answers game.resync with the full game again', async () => {
    const { pair, start, command } = await setup();
    const { roomId, a } = await pair();
    await start(a, roomId);
    const first = a.connection.last('game.update')!;
    await command(a, roomId, { type: 'game.resync' });
    const again = a.connection.last('game.update')!;
    expect(again).not.toBe(first);
    expect(again.game).toEqual(first.game);
  });

  it('welcomes a returning member with their seat and the whole game', async () => {
    const { rooms, pair, start, connect } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    await rooms.disconnect(roomId, b.playerId, b.connection);
    const back = await connect(b.user, roomId);
    const seatId = a.connection.room!.members.find((m) => m.playerId === b.playerId)!.seatId;
    const welcome = back.connection.last('welcome')!;
    expect(welcome.you).toEqual({ playerId: b.playerId, seatId });
    expect(welcome.game).toMatchObject({ logFrom: 0, seq: 0 });
  });

  it("hands an away member's seat to a bot after 60 s, and gives it back when they return", async () => {
    const { rooms, scheduler, pair, start, connect } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    await rooms.disconnect(roomId, b.playerId, b.connection);
    await scheduler.advance(TAKEOVER_AWAY_MS);
    await rooms.tick();
    const bo = () => a.connection.room!.members.find((m) => m.playerId === b.playerId)!;
    expect(bo().botControlled).toBe(true);
    const back = await connect(b.user, roomId);
    expect(bo().botControlled).toBe(false);
    expect(back.connection.last('welcome')!.room.members.find((m) => m.playerId === b.playerId)!.botControlled).toBe(false);
  });

  it('lets a member leave a running game: a bot plays their seat, and the host role passes', async () => {
    const { repos, scheduler, pair, start, command } = await setup();
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await command(a, roomId, { type: 'room.leave' });
    expect(b.connection.room).toMatchObject({ status: 'playing', hostPlayerId: b.playerId });
    expect(b.connection.room!.members.map((m) => m.name)).toEqual(['Bo']);
    const tookOver = async () => (await repos.games.listActions(gameId)).some((x) => x.source === 'takeover');
    for (let i = 0; i < 100 && !(await tookOver()); i += 1) await scheduler.advance(10_000);
    expect(await tookOver()).toBe(true);
  });

  it('ends the game and closes the room when the last human leaves (Review Focus 5)', async () => {
    const { rooms, repos, scheduler, withBot, start, command } = await setup();
    const { roomId, a } = await withBot();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await command(a, roomId, { type: 'room.leave' });
    expect(rooms.list(a.user).rooms).toEqual([]);
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'aborted', finishedAt: expect.any(Date) });
    const stored = (await repos.games.listActions(gameId)).length;
    expect(scheduler.pending).toBe(0);
    await scheduler.advance(3_600_000);
    expect(await repos.games.listActions(gameId)).toHaveLength(stored);
  });

  it('returns the room to the lobby with the result when the game ends, keeping its members', async () => {
    const { rooms, repos, scheduler, withBot, start, connect } = await setup();
    const { roomId, a } = await withBot();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    // Away, Ann times out twice and a bot takes her seat; the bots finish the game.
    await rooms.disconnect(roomId, a.playerId, a.connection);
    await scheduler.runUntil(() => rooms.snapshot(a.user, roomId).status === 'lobby', 50_000);
    const room = rooms.snapshot(a.user, roomId);
    expect(room.members.map((m) => m.name)).toEqual(['Ann', 'Bot 1']);
    expect(room.members.every((m) => m.seatId === null && !m.botControlled)).toBe(true);
    expect(room.lastGame).toMatchObject({ gameId, outcome: 'finished', result: expect.objectContaining({ winningSeatIds: expect.any(Array) }) });
    expect(room.lastGame!.seats.map((s) => s.name).sort()).toEqual(['Ann', 'Bot 1']);
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'finished', result: room.lastGame!.result, finishedAt: expect.any(Date) });
    const back = await connect(a.user, roomId);
    expect(back.connection.last('welcome')).toMatchObject({ game: null, you: { seatId: null } });
  }, 60_000);

  it('gives a host who is away when the game ends 60 s before the role passes', async () => {
    const { rooms, scheduler, pair, start } = await setup({ botPolicy: failing });
    const { roomId, a, b } = await pair();
    await start(a, roomId);
    await rooms.disconnect(roomId, a.playerId, a.connection);
    // The failing bot breaks the game as soon as one plays: Ann's seat, once she has been away 60 s.
    await scheduler.advance(TAKEOVER_AWAY_MS);
    await rooms.tick();
    await scheduler.runUntil(() => b.connection.room!.status === 'lobby');
    expect(b.connection.room!.hostPlayerId).toBe(a.playerId);
    await rooms.tick();
    expect(b.connection.room!.hostPlayerId).toBe(a.playerId);
    await scheduler.advance(60_000);
    await rooms.tick();
    expect(b.connection.room!.hostPlayerId).toBe(b.playerId);
  });

  it('marks the game broken when a bot fails, and returns the room to the lobby', async () => {
    const { repos, scheduler, logError, withBot, start } = await setup({ botPolicy: failing });
    const { roomId, a } = await withBot();
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await scheduler.runUntil(() => a.connection.room!.status === 'lobby');
    expect(a.connection.room!.lastGame).toMatchObject({ gameId, outcome: 'broken', result: null });
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'broken' });
    expect(logError).toHaveBeenCalled();
  });

  it('closes the room when its game ends with no registered member left to host', async () => {
    const { rooms, repos, scheduler, pair, start, command } = await setup();
    const { roomId, a, b } = await pair('guest');
    await start(a, roomId);
    const gameId = a.connection.game!.gameId;
    await command(a, roomId, { type: 'room.leave' });
    expect(b.connection.room!.hostPlayerId).toBeNull();
    await rooms.disconnect(roomId, b.playerId, b.connection);
    await scheduler.runUntil(() => rooms.list(b.user).rooms.length === 0, 50_000);
    expect(await repos.games.findById(gameId)).toMatchObject({ status: 'finished' });
    expect((await repos.rooms.listLive()).map((entry) => entry.room.id)).not.toContain(roomId);
  }, 60_000);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --selectProjects server roomGames`
Expected: FAIL. `RoomServiceDeps` has no `scheduler` or `registry`, and `lobby.start` isn't handled.

- [ ] **Step 4: Give `Room` its last game, and the snapshot its seats**

In `projects/server/src/rooms/room.ts`:

- change the protocol import to `import type { LastGame, MemberKind } from 'protocol';`;
- add this field to the `Room` class, after `lastActivityAt`:

```ts
  // The last game's outcome, until another starts. In memory only.
  lastGame: LastGame | null = null;
```

Replace `projects/server/src/views/room.ts` with:

```ts
import type { RoomListItem, RoomSnapshot, SeatLimits } from 'protocol';
import { Room } from '../rooms/room';

// What the running game says about each member (a GameRunner is one).
export interface SeatingView {
  seatOf(playerId: string): string | null;
  botControlled(playerId: string): boolean;
}

// The room every member sees. Never user ids: members are known by player id.
export function toRoomSnapshot(room: Room, seatLimits: SeatLimits, seating: SeatingView | null = null): RoomSnapshot {
  const { record } = room;
  return {
    id: record.id,
    visibility: record.visibility,
    status: record.status,
    seatCount: record.seatCount,
    rules: { ...record.rules },
    hostPlayerId: record.hostPlayerId,
    members: room.members.map((m) => ({
      playerId: m.id,
      name: m.name,
      kind: m.kind,
      seatId: seating?.seatOf(m.id) ?? null,
      isRegistered: m.isRegistered,
      connected: m.connected,
      botControlled: seating?.botControlled(m.id) ?? false,
    })),
    lastGame: room.lastGame ? structuredClone(room.lastGame) : null,
    seatLimits: { ...seatLimits },
  };
}

export function toRoomListItem(room: Room, userId: string): RoomListItem {
  const { record } = room;
  return {
    id: record.id,
    visibility: record.visibility,
    hostName: room.host?.name ?? null,
    memberCount: room.members.length,
    capacity: record.seatCount,
    status: record.status,
    youAreMember: room.memberForUser(userId) !== null,
  };
}
```

- [ ] **Step 5: Run games in `RoomService`**

Replace `projects/server/src/rooms/roomService.ts` with the version below. Every Stage 3 method keeps its behaviour. The changes are:

- the new deps;
- `LiveRoom.runner`;
- `connect`, `disconnect`, `command`, `tick`, `leave` and `dropRoom`;
- the new game methods.

```ts
import { randomInt } from 'node:crypto';
import { ruleBasedPolicy } from 'bots';
import type { BotPolicy } from 'bots';
import { buildContentRegistry, FIRST_REVEAL_MIN_SEATS } from 'content';
import type { Action, ContentRegistry, EngineContext, GameResult, GameRules, GameState } from 'engine';
import { normalizeDisplayName } from 'protocol';
import type { CreateRoomBody, GameOutcome, RoomCommand, RoomLeftReason, RoomList, RoomSnapshot, SeatLimits, ServerMessage } from 'protocol';
import { drawSeats, engineContext, openingState } from '../game/engineGame';
import { BOT_DELAY_MS, GameRunner, RunnerHost, TAKEOVER_AWAY_MS } from '../game/gameRunner';
import { realScheduler, Scheduler } from '../game/scheduler';
import { GameRecord, RoomPlayerRecord, UserRecord } from '../persistence/records';
import { NameTakenError, Repositories } from '../persistence/repositories';
import { toRoomListItem, toRoomSnapshot } from '../views/room';
import { RoomError } from './errors';
import { memberFrom, Room, RoomMember } from './room';
import { SerialQueue } from './serialQueue';

// A host away this long in the lobby hands the role on (spec "Host rules").
export const HOST_AWAY_MS = 60_000;
// A lobby with no input for this long closes.
export const LOBBY_IDLE_MS = 30 * 60_000;
// How often the server calls tick().
export const ROOM_TICK_MS = 5_000;

// One member's socket, as the room sees it.
export interface MemberConnection {
  send(message: ServerMessage): void;
  // Ends the connection from the server side.
  close(): void;
}

export interface RoomServiceDeps {
  repos: Repositories;
  seatLimits: SeatLimits;
  // Clock in ms.
  now?: () => number;
  // Where failures of background work (tick, game timers) go.
  logError?: (err: unknown, message: string) => void;
  // The engine's content. Built on first use when not given.
  registry?: ContentRegistry;
  // Stored on each game: the engine + content build (config BUILD_ID).
  buildId?: string;
  // Seeds for new games.
  randomSeed?: () => number;
  // Game timers. Tests pass a ManualScheduler.
  scheduler?: Scheduler;
  botDelayMs?: number;
  takeoverAwayMs?: number;
  botPolicy?: BotPolicy;
}

interface LiveRoom {
  room: Room;
  queue: SerialQueue;
  // The current connection of each connected human, by player id.
  connections: Map<string, MemberConnection>;
  // The running game, while the room is playing.
  runner: GameRunner | null;
}

// The rules the engine reads. Unknown keys never get stored, and First Reveal
// Bonus is dropped below the seat count where it applies.
function rulesFrom(rules: GameRules, seatCount: number): GameRules {
  return rules.firstRevealDraw === undefined || seatCount < FIRST_REVEAL_MIN_SEATS ? {} : { firstRevealDraw: rules.firstRevealDraw };
}

function requireName(raw: string): string {
  const name = normalizeDisplayName(raw);
  if (name === null) throw new RoomError('invalid_name');
  return name;
}

// Every live room, held in memory. Each room's inputs run one at a time on
// its queue: check, persist, commit in memory, publish. A playing room's
// GameRunner moves its game, and its timers run on the same queue.
export class RoomService {
  private readonly repos: Repositories;
  private readonly seatLimits: SeatLimits;
  private readonly now: () => number;
  private readonly logError: (err: unknown, message: string) => void;
  private readonly registry: ContentRegistry | null;
  private readonly buildId: string;
  private readonly randomSeed: () => number;
  private readonly scheduler: Scheduler;
  private readonly botDelayMs: number;
  private readonly takeoverAwayMs: number;
  private readonly botPolicy: BotPolicy;
  private engine: EngineContext | null = null;
  private readonly live = new Map<string, LiveRoom>();
  // Create and join check memberships across rooms, so they run one at a time.
  private readonly membership = new SerialQueue();

  constructor(deps: RoomServiceDeps) {
    this.repos = deps.repos;
    this.seatLimits = deps.seatLimits;
    this.now = deps.now ?? Date.now;
    this.logError = deps.logError ?? ((err, message) => console.error(message, err));
    this.registry = deps.registry ?? null;
    this.buildId = deps.buildId ?? 'dev';
    this.randomSeed = deps.randomSeed ?? (() => randomInt(0, 2 ** 31));
    this.scheduler = deps.scheduler ?? realScheduler;
    this.botDelayMs = deps.botDelayMs ?? BOT_DELAY_MS;
    this.takeoverAwayMs = deps.takeoverAwayMs ?? TAKEOVER_AWAY_MS;
    this.botPolicy = deps.botPolicy ?? ruleBasedPolicy;
  }

  // The engine, built on first use: lobby-only tests never need the content.
  private get ctx(): EngineContext {
    this.engine ??= engineContext(this.registry ?? buildContentRegistry());
    return this.engine;
  }

  // Reloads every lobby from the store after a restart. Nobody is connected
  // yet, so every human starts away and the usual host and idle rules apply.
  async restore(): Promise<void> {
    const now = this.now();
    for (const { room, players } of await this.repos.rooms.listLive()) {
      // Rooms with a running game come back with their game in Task 8.
      if (room.status !== 'lobby') continue;
      const members = await Promise.all(players.map(async (player) => memberFrom(player, await this.isRegistered(player), now)));
      const entry = this.track(new Room(room, members, now));
      if (entry.room.humans().length === 0) await entry.queue.run(() => this.closeRoom(entry, 'idle'));
    }
  }

  // Your rooms first, then the other open rooms; newest first within each.
  list(user: UserRecord): RoomList {
    const rooms = [...this.live.values()]
      .map((entry) => entry.room)
      .filter((room) => room.record.visibility === 'open' || room.memberForUser(user.id))
      .sort((a, b) => b.record.createdAt.getTime() - a.record.createdAt.getTime());
    const items = rooms.map((room) => toRoomListItem(room, user.id));
    items.sort((a, b) => Number(b.youAreMember) - Number(a.youAreMember));
    return { rooms: items, seatLimits: { ...this.seatLimits } };
  }

  snapshot(user: UserRecord, roomId: string): RoomSnapshot {
    const entry = this.live.get(roomId);
    if (!entry) throw new RoomError('not_found');
    if (!entry.room.memberForUser(user.id)) throw new RoomError(entry.room.record.visibility === 'open' ? 'not_member' : 'not_found');
    return this.snapshotOf(entry);
  }

  create(user: UserRecord, body: CreateRoomBody): Promise<string> {
    return this.membership.run(async () => {
      if (user.kind !== 'registered') throw new RoomError('host_must_be_registered');
      const name = requireName(body.displayName);
      this.requireSeatCount(body.seatCount, 1);
      this.requireNoOtherRoom(user.id, null);
      const now = this.now();
      const at = new Date(now);
      const rules = rulesFrom(body.rules, body.seatCount);
      const { room, host } = await this.repos.transaction(async (tx) => {
        const created = await tx.rooms.create({ visibility: 'open', seatCount: body.seatCount, rules, now: at });
        const player = await tx.rooms.addPlayer({ roomId: created.id, userId: user.id, kind: 'human', displayName: name, now: at });
        await tx.rooms.update(created.id, { hostPlayerId: player.id }, at);
        return { room: { ...created, hostPlayerId: player.id }, host: player };
      });
      this.track(new Room(room, [memberFrom(host, true, now)], now));
      return room.id;
    });
  }

  join(user: UserRecord, roomId: string, displayName: string): Promise<void> {
    return this.membership.run(() =>
      this.inRoom(roomId, async (entry) => {
        const { room } = entry;
        if (room.record.visibility !== 'open') throw new RoomError('not_found');
        // A member joining again is coming back: they keep their membership and name.
        if (room.memberForUser(user.id)) return;
        if (room.record.status !== 'lobby') throw new RoomError('in_progress');
        if (room.isFull()) throw new RoomError('room_full');
        this.requireNoOtherRoom(user.id, roomId);
        const name = requireName(displayName);
        if (room.nameTaken(name)) throw new RoomError('name_taken');
        const now = this.now();
        const player = await this.addPlayer({ roomId, userId: user.id, kind: 'human', displayName: name, now: new Date(now) });
        room.members.push(memberFrom(player, user.kind === 'registered', now));
        this.touched(entry, now);
      })
    );
  }

  // A member's socket said hello. The newest connection wins: an older one is
  // told it was replaced and closed. In a game, a returning member takes their
  // seat back (the others hear first), then gets `welcome` with the game.
  connect(user: UserRecord, roomId: string, connection: MemberConnection): Promise<string> {
    return this.inRoom(roomId, async (entry) => {
      const member = entry.room.memberForUser(user.id);
      if (!member) throw new RoomError('not_member');
      const previous = entry.connections.get(member.id);
      entry.connections.delete(member.id);
      if (previous) {
        previous.send({ type: 'replaced' });
        previous.close();
      }
      member.connected = true;
      member.awaySince = null;
      entry.room.lastActivityAt = this.now();
      const runner = entry.runner;
      runner?.connected(member.id);
      entry.connections.set(member.id, connection);
      connection.send({
        type: 'welcome',
        you: { playerId: member.id, seatId: runner?.seatOf(member.id) ?? null },
        room: this.snapshotOf(entry),
        game: runner?.updateFor(member.id, 0) ?? null,
      });
      this.broadcast(entry, member.id);
      return member.id;
    });
  }

  // A socket closed. Ignored unless it is the member's current connection:
  // a replaced connection closes after its successor registered.
  disconnect(roomId: string, playerId: string, connection: MemberConnection): Promise<void> {
    const entry = this.live.get(roomId);
    if (!entry) return Promise.resolve();
    return entry.queue.run(async () => {
      if (entry.connections.get(playerId) !== connection) return;
      entry.connections.delete(playerId);
      const member = entry.room.member(playerId);
      if (!member) return;
      member.connected = false;
      member.awaySince = this.now();
      entry.runner?.disconnected(playerId);
      this.broadcast(entry);
    });
  }

  // A connected member's request. Queued synchronously, so one connection's
  // requests run in the order they arrived.
  command(user: UserRecord, roomId: string, playerId: string, command: RoomCommand): Promise<void> {
    return this.inRoom(roomId, async (entry) => {
      const actor = entry.room.member(playerId);
      if (!actor || actor.userId !== user.id) throw new RoomError('not_member');
      switch (command.type) {
        case 'lobby.addBot':
          return this.addBot(entry, actor);
        case 'lobby.removePlayer':
          return this.removePlayer(entry, actor, command.playerId);
        case 'lobby.setRules':
          return this.setRules(entry, actor, command.seatCount, command.rules);
        case 'lobby.makeHost':
          return this.makeHost(entry, actor, command.playerId);
        case 'lobby.start':
          return this.start(entry, actor);
        case 'room.leave':
          return this.leave(entry, actor);
        case 'game.submit':
          // The schema checks only each action's shape; the runner accepts only offered actions.
          return this.submit(entry, actor, command.gameId, command.baseSeq, command.actions as unknown as Action[]);
        case 'game.resync':
          return this.resync(entry, actor);
      }
    });
  }

  // Timed rules, run every ROOM_TICK_MS. A lobby that is idle closes, and a
  // host away for HOST_AWAY_MS hands the role to a connected registered
  // member. In a game, an away player's seat goes to a bot.
  tick(): Promise<void> {
    const work = [...this.live.values()].map((entry) =>
      entry.queue
        .run(async () => {
          if (this.live.get(entry.room.id) !== entry) return;
          if (entry.room.record.status === 'playing') return entry.runner?.tick();
          if (entry.room.record.status !== 'lobby') return;
          const now = this.now();
          if (now - entry.room.lastActivityAt >= LOBBY_IDLE_MS) return this.closeRoom(entry, 'idle');
          const host = entry.room.host;
          if (!host || host.connected || host.awaySince === null || now - host.awaySince < HOST_AWAY_MS) return;
          const next = entry.room.successor(true);
          if (!next) return;
          // Not activity: a room nobody touches still closes when idle.
          await this.setHost(entry, next.id, now);
          this.broadcast(entry);
        })
        .catch((err: unknown) => this.logError(err, `Room ${entry.room.id} housekeeping failed`))
    );
    return Promise.all(work).then(() => undefined);
  }

  private async addBot(entry: LiveRoom, actor: RoomMember): Promise<void> {
    this.requireHostInLobby(entry, actor);
    const { room } = entry;
    if (room.isFull()) throw new RoomError('room_full');
    const now = this.now();
    const bot = await this.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: room.nextBotName(), now: new Date(now) });
    room.members.push(memberFrom(bot, false, now));
    this.touched(entry, now);
  }

  private async removePlayer(entry: LiveRoom, actor: RoomMember, playerId: string): Promise<void> {
    this.requireHostInLobby(entry, actor);
    const target = entry.room.member(playerId);
    if (!target) throw new RoomError('not_found');
    // The host leaves with room.leave instead.
    if (target.id === actor.id) throw new RoomError('invalid_message');
    const now = this.now();
    await this.repos.rooms.markLeft(target.id, new Date(now));
    entry.room.remove(target.id);
    this.dropConnection(entry, target.id, 'removed');
    this.touched(entry, now);
  }

  private async setRules(entry: LiveRoom, actor: RoomMember, seatCount: number, rules: GameRules): Promise<void> {
    this.requireHostInLobby(entry, actor);
    this.requireSeatCount(seatCount, entry.room.members.length);
    const now = this.now();
    const clean = rulesFrom(rules, seatCount);
    await this.repos.rooms.update(entry.room.id, { seatCount, rules: clean }, new Date(now));
    entry.room.record = { ...entry.room.record, seatCount, rules: clean, updatedAt: new Date(now) };
    this.touched(entry, now);
  }

  private async makeHost(entry: LiveRoom, actor: RoomMember, playerId: string): Promise<void> {
    this.requireHostInLobby(entry, actor);
    const target = entry.room.member(playerId);
    if (!target) throw new RoomError('not_found');
    if (target.kind !== 'human' || !target.isRegistered) throw new RoomError('host_must_be_registered');
    const now = this.now();
    if (target.id !== actor.id) await this.setHost(entry, target.id, now);
    this.touched(entry, now);
  }

  // Start Game: the host of an open room, or the player of a solo room, once
  // every seat is filled.
  private async start(entry: LiveRoom, actor: RoomMember): Promise<void> {
    const { room } = entry;
    const solo = room.record.visibility === 'solo';
    if (solo ? actor.kind !== 'human' : room.record.hostPlayerId !== actor.id) throw new RoomError('not_host');
    if (room.record.status !== 'lobby') throw new RoomError('in_progress');
    if (room.members.length !== room.record.seatCount) throw new RoomError('not_full');
    this.requireSeatCount(room.record.seatCount, room.members.length);
    await this.startGame(entry);
  }

  // Start Game, step by step (spec "Rules"): the seed, the seats drawn from
  // it, the opening state; then store the game, and run it.
  private async startGame(entry: LiveRoom): Promise<void> {
    const { room } = entry;
    const now = this.now();
    const at = new Date(now);
    const seed = this.randomSeed();
    const seats = drawSeats(
      room.members.map((m) => ({ id: m.id, name: m.name, kind: m.kind })),
      seed
    );
    const state = openingState(this.ctx, seed, seats, room.record.rules);
    const game = await this.repos.transaction(async (tx) => {
      const created = await tx.games.create({ roomId: room.id, seed, seats, rules: room.record.rules, buildId: this.buildId, now: at });
      await tx.rooms.update(room.id, { status: 'playing' }, at);
      return created;
    });
    room.record = { ...room.record, status: 'playing', updatedAt: at };
    room.lastGame = null;
    room.lastActivityAt = now;
    this.run(entry, game, state, 0);
    this.broadcast(entry);
    this.publishGame(entry, 0);
  }

  // Puts a runner on the room and sets its first clock or bot move.
  private run(entry: LiveRoom, game: GameRecord, state: GameState, seq: number): void {
    const runner = new GameRunner(
      {
        record: game,
        state,
        seq,
        connected: new Set(entry.connections.keys()),
        present: new Set(entry.room.members.map((m) => m.id)),
      },
      this.ctx,
      this.runnerHost(entry, game.id),
      { solo: entry.room.record.visibility === 'solo', botDelayMs: this.botDelayMs, takeoverAwayMs: this.takeoverAwayMs, policy: this.botPolicy }
    );
    entry.runner = runner;
    runner.start();
  }

  private runnerHost(entry: LiveRoom, gameId: string): RunnerHost {
    return {
      now: this.now,
      schedule: (delayMs, work) => this.scheduler.schedule(delayMs, () => this.onQueue(entry, work)),
      persist: (actions) => this.repos.transaction((tx) => tx.games.appendActions(gameId, actions[0].seq - 1, actions, new Date(this.now()))),
      publish: (logFrom) => this.publishGame(entry, logFrom),
      seatsChanged: () => this.broadcast(entry),
      finished: () => this.endGame(entry, 'finished'),
      broke: (err) => {
        this.logError(err, `Game ${gameId} broke`);
        return this.endGame(entry, 'broken');
      },
      logError: this.logError,
    };
  }

  // A game timer's work: on the room's queue, and only while the room is live.
  private onQueue(entry: LiveRoom, work: () => Promise<void>): Promise<void> {
    return entry.queue
      .run(async () => {
        if (this.live.get(entry.room.id) === entry) await work();
      })
      .catch((err: unknown) => this.logError(err, `Room ${entry.room.id} game timer failed`));
  }

  private async submit(entry: LiveRoom, actor: RoomMember, gameId: string, baseSeq: number, actions: Action[]): Promise<void> {
    if (!entry.runner) throw new RoomError('no_game');
    entry.room.lastActivityAt = this.now();
    await entry.runner.submit(actor.id, gameId, baseSeq, actions);
  }

  private async resync(entry: LiveRoom, actor: RoomMember): Promise<void> {
    const game = entry.runner?.updateFor(actor.id, 0);
    if (!game) throw new RoomError('no_game');
    entry.connections.get(actor.id)?.send({ type: 'game.update', game });
  }

  // The runner's game ended (a result, or a failure): store that, and the room returns to the lobby.
  private async endGame(entry: LiveRoom, outcome: 'finished' | 'broken'): Promise<void> {
    const runner = entry.runner;
    if (!runner) return;
    runner.stop();
    entry.runner = null;
    await this.closeGame(entry, runner.record, outcome, outcome === 'finished' ? runner.state.result : null);
  }

  // Stores how a game ended and returns its room to the lobby with the result
  // shown. An open room left with no host passes the role on, or closes.
  private async closeGame(entry: LiveRoom, game: GameRecord, outcome: GameOutcome, result: GameResult | null): Promise<void> {
    const { room } = entry;
    const now = this.now();
    const at = new Date(now);
    await this.repos.transaction(async (tx) => {
      await tx.games.update(game.id, { status: outcome === 'finished' ? 'finished' : 'broken', result, finishedAt: at });
      await tx.rooms.update(room.id, { status: 'lobby' }, at);
    });
    room.record = { ...room.record, status: 'lobby', updatedAt: at };
    room.lastGame = { gameId: game.id, outcome, result, seats: game.seats.map((s) => ({ seatId: s.seatId, playerId: s.roomPlayerId, name: s.name })) };
    room.lastActivityAt = now;
    // A host away when the game ends gets the lobby's 60 s from now (spec "Host rules").
    for (const member of room.members) if (!member.connected && member.kind === 'human') member.awaySince = now;
    if (room.record.visibility === 'open' && !room.host) {
      const successor = room.successor(false);
      if (!successor) return this.closeRoom(entry, 'host_left');
      await this.setHost(entry, successor.id, now);
    }
    this.broadcast(entry);
  }

  private async leave(entry: LiveRoom, actor: RoomMember): Promise<void> {
    if (entry.room.record.status === 'playing') return this.leaveGame(entry, actor);
    const { room } = entry;
    const now = this.now();
    const at = new Date(now);
    // Decide from the room as it is, then persist it all at once, then change memory.
    const lastHuman = room.humans().length === 1;
    const wasHost = room.record.hostPlayerId === actor.id;
    const successor = wasHost && !lastHuman ? room.successor(false) : null;
    const closeReason: RoomLeftReason | null = lastHuman ? 'idle' : wasHost && !successor ? 'host_left' : null;
    await this.repos.transaction(async (tx) => {
      await tx.rooms.markLeft(actor.id, at);
      if (closeReason) await tx.rooms.update(room.id, { status: 'closed' }, at);
      else if (successor) await tx.rooms.update(room.id, { hostPlayerId: successor.id }, at);
    });
    room.remove(actor.id);
    // The socket layer acks, then closes the leaver's connection.
    entry.connections.delete(actor.id);
    if (closeReason) return this.dropRoom(entry, closeReason);
    if (successor) room.record = { ...room.record, hostPlayerId: successor.id, updatedAt: at };
    this.touched(entry, now);
  }

  // Leaving a running game: a bot plays the seat to the end, and a leaving
  // host passes the role on at once (or to nobody until the game ends). The
  // last human leaving (always so in a solo room) ends the game unfinished
  // and closes the room.
  private async leaveGame(entry: LiveRoom, actor: RoomMember): Promise<void> {
    const { room } = entry;
    const runner = entry.runner;
    const now = this.now();
    const at = new Date(now);
    if (room.humans().length === 1) {
      await this.repos.transaction(async (tx) => {
        await tx.rooms.markLeft(actor.id, at);
        if (runner) await tx.games.update(runner.record.id, { status: 'aborted', finishedAt: at });
        await tx.rooms.update(room.id, { status: 'closed' }, at);
      });
      room.remove(actor.id);
      entry.connections.delete(actor.id);
      return this.dropRoom(entry, 'idle');
    }
    const wasHost = room.record.hostPlayerId === actor.id;
    const successor = wasHost ? room.successor(false) : null;
    await this.repos.transaction(async (tx) => {
      await tx.rooms.markLeft(actor.id, at);
      if (wasHost) await tx.rooms.update(room.id, { hostPlayerId: successor?.id ?? null }, at);
    });
    room.remove(actor.id);
    entry.connections.delete(actor.id);
    if (wasHost) room.record = { ...room.record, hostPlayerId: successor?.id ?? null, updatedAt: at };
    runner?.left(actor.id);
    this.touched(entry, now);
  }

  private async setHost(entry: LiveRoom, playerId: string, now: number): Promise<void> {
    await this.repos.rooms.update(entry.room.id, { hostPlayerId: playerId }, new Date(now));
    entry.room.record = { ...entry.room.record, hostPlayerId: playerId, updatedAt: new Date(now) };
  }

  private async closeRoom(entry: LiveRoom, reason: RoomLeftReason): Promise<void> {
    await this.repos.rooms.update(entry.room.id, { status: 'closed' }, new Date(this.now()));
    this.dropRoom(entry, reason);
  }

  // The in-memory part of closing: stop the game, forget the room, and tell
  // and close every connection.
  private dropRoom(entry: LiveRoom, reason: RoomLeftReason): void {
    entry.runner?.stop();
    entry.runner = null;
    this.live.delete(entry.room.id);
    for (const playerId of [...entry.connections.keys()]) this.dropConnection(entry, playerId, reason);
  }

  // Tells a member's connection why it is no longer in the room, and closes it.
  private dropConnection(entry: LiveRoom, playerId: string, reason: RoomLeftReason): void {
    const connection = entry.connections.get(playerId);
    if (!connection) return;
    entry.connections.delete(playerId);
    connection.send({ type: 'room.left', reason });
    connection.close();
  }

  private async addPlayer(input: { roomId: string; userId: string | null; kind: RoomPlayerRecord['kind']; displayName: string; now: Date }): Promise<RoomPlayerRecord> {
    try {
      return await this.repos.rooms.addPlayer(input);
    } catch (err) {
      if (err instanceof NameTakenError) throw new RoomError('name_taken');
      throw err;
    }
  }

  private async isRegistered(player: RoomPlayerRecord): Promise<boolean> {
    if (player.userId === null) return false;
    return (await this.repos.users.findById(player.userId))?.kind === 'registered';
  }

  // Runs work on the room's queue, once the room is still live when its turn comes.
  private inRoom<T>(roomId: string, work: (entry: LiveRoom) => Promise<T>): Promise<T> {
    const entry = this.live.get(roomId);
    if (!entry) return Promise.reject(new RoomError('not_found'));
    return entry.queue.run(async () => {
      if (this.live.get(roomId) !== entry) throw new RoomError('not_found');
      return work(entry);
    });
  }

  private requireHostInLobby(entry: LiveRoom, actor: RoomMember): void {
    if (entry.room.record.hostPlayerId !== actor.id) throw new RoomError('not_host');
    if (entry.room.record.status !== 'lobby') throw new RoomError('in_progress');
  }

  private requireSeatCount(seatCount: number, members: number): void {
    const { min, max } = this.seatLimits;
    if (!Number.isInteger(seatCount) || seatCount < min || seatCount > max || seatCount < members) throw new RoomError('invalid_seat_count');
  }

  // One live open room per user (a solo room doesn't count).
  private requireNoOtherRoom(userId: string, exceptRoomId: string | null): void {
    for (const { room } of this.live.values()) {
      if (room.id !== exceptRoomId && room.record.visibility === 'open' && room.memberForUser(userId)) throw new RoomError('already_in_room');
    }
  }

  private track(room: Room): LiveRoom {
    const entry: LiveRoom = { room, queue: new SerialQueue(), connections: new Map(), runner: null };
    this.live.set(room.id, entry);
    return entry;
  }

  // An input changed the room: it counts as activity, and everyone hears of it.
  private touched(entry: LiveRoom, now: number): void {
    entry.room.lastActivityAt = now;
    this.broadcast(entry);
  }

  private broadcast(entry: LiveRoom, exceptPlayerId?: string): void {
    const message: ServerMessage = { type: 'room.updated', room: this.snapshotOf(entry) };
    for (const [playerId, connection] of entry.connections) if (playerId !== exceptPlayerId) connection.send(message);
  }

  // Each connected member's update: their own view and moves.
  private publishGame(entry: LiveRoom, logFrom: number): void {
    const runner = entry.runner;
    if (!runner) return;
    for (const [playerId, connection] of entry.connections) {
      const game = runner.updateFor(playerId, logFrom);
      if (game) connection.send({ type: 'game.update', game });
    }
  }

  private snapshotOf(entry: LiveRoom): RoomSnapshot {
    return toRoomSnapshot(entry.room, this.seatLimits, entry.runner);
  }
}
```

- [ ] **Step 6: Run the room tests and the type check**

Run: `npx jest --selectProjects server rooms && npm run typecheck:server`
Expected: PASS. Both `roomService.spec.ts` (unchanged behaviour) and `roomGames.spec.ts` pass, with no type errors.

- [ ] **Step 7: Commit**

```bash
git add projects/server/src/rooms projects/server/src/views/room.ts
git commit -m "feat(server): rooms start and run games, with takeover, leaving and the game's end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Solo rooms, restoring running games, `POST /api/rooms/solo` and the server wiring

**Files:**
- Modify:
  - `projects/server/src/rooms/roomService.ts`
  - `projects/server/src/http/roomRoutes.ts`
  - `projects/server/src/server.ts`
  - `projects/server/README.md`
- Create: `projects/server/src/rooms/soloRooms.spec.ts`, `projects/server/src/rooms/restore.spec.ts`
- Test: those two, plus `projects/server/src/http/roomRoutes.spec.ts`

**Interfaces:**
- Consumes:
  - Task 7's `startGame`, `run`, `closeGame` and `dropRoom`;
  - Task 5's `replay`, `drawSeats`, `openingState`, `applyActions` and `stateHash`;
  - `SoloRoomBody` (Task 2).
- Produces:
  - `RoomService.createSolo(user, body: SoloRoomBody): Promise<string>`;
  - `RoomService.restore()` now also restores playing rooms;
  - `RoomService.stop(): Promise<void>`;
  - the route `POST /api/rooms/solo` → `201 { id }`, or `409 solo_exists`;
  - `createServer` builds the registry once and passes `registry` and `buildId: config.buildId`. It calls `rooms.stop()` on close.

- [ ] **Step 1: Write the failing solo-room tests**

Create `projects/server/src/rooms/soloRooms.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { BotPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import { TAKEOVER_AWAY_MS } from '../game/gameRunner';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import { RoomService, RoomServiceDeps } from './roomService';
import { FakeConnection } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const registry = buildContentRegistry();
const code = (value: string) => expect.objectContaining({ code: value });
const failing: BotPolicy = {
  id: 'failing',
  decide: () => {
    throw new Error('bot bug');
  },
};

async function setup(options: Partial<RoomServiceDeps> = {}) {
  const repos = createMemoryRepositories();
  const scheduler = new ManualScheduler(T0);
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 }, now: scheduler.clock, logError: jest.fn(), registry, buildId: 'test-build', randomSeed: () => 1234, scheduler, ...options });
  const registered = (name: string) =>
    repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(scheduler.now) });
  const guest = (name: string) => repos.users.createGuest({ displayName: name, now: new Date(scheduler.now) });
  const connect = async (user: UserRecord, roomId: string) => {
    const connection = new FakeConnection();
    const playerId = await rooms.connect(user, roomId, connection);
    return { connection, playerId };
  };
  const gameOf = async (roomId: string) => (await repos.games.listRunning()).find((g) => g.roomId === roomId)!;
  return { repos, rooms, scheduler, registered, guest, connect, gameOf };
}

describe('solo rooms', () => {
  it('seats the player with bots and starts at once, unlisted, paused until the player connects', async () => {
    const { rooms, repos, scheduler, guest, registered, connect, gameOf } = await setup();
    const gus = await guest('Gus');
    const id = await rooms.createSolo(gus, { seatCount: 3, rules: {} });
    const room = rooms.snapshot(gus, id);
    expect(room).toMatchObject({ visibility: 'solo', status: 'playing', hostPlayerId: null });
    expect(room.members.map((m) => [m.name, m.kind])).toEqual([
      ['Gus', 'human'],
      ['Bot 1', 'bot'],
      ['Bot 2', 'bot'],
    ]);
    expect(room.members.every((m) => m.seatId !== null)).toBe(true);
    expect(rooms.list(await registered('Ann')).rooms).toEqual([]);
    expect(rooms.list(gus).rooms.map((r) => r.id)).toEqual([id]);
    const game = await gameOf(id);
    await scheduler.advance(3_600_000);
    expect(await repos.games.listActions(game.id)).toEqual([]);
    const { connection } = await connect(gus, id);
    expect(connection.last('welcome')!.game).toMatchObject({ paused: false });
  });

  it('names the bots around a player called Bot 1', async () => {
    const { rooms, registered } = await setup();
    const user = await registered('Bot 1');
    const id = await rooms.createSolo(user, { seatCount: 3, rules: {} });
    expect(rooms.snapshot(user, id).members.map((m) => m.name)).toEqual(['Bot 1', 'Bot 2', 'Bot 3']);
  });

  it('refuses a second solo game while one runs, and replaces it when asked', async () => {
    const { rooms, repos, registered, connect, gameOf } = await setup();
    const ann = await registered('Ann');
    const first = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    const firstGame = await gameOf(first);
    const { connection } = await connect(ann, first);
    await expect(rooms.createSolo(ann, { seatCount: 2, rules: {} })).rejects.toEqual(code('solo_exists'));
    const second = await rooms.createSolo(ann, { seatCount: 4, rules: {}, replace: true });
    expect(second).not.toBe(first);
    expect(() => rooms.snapshot(ann, first)).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(await repos.games.findById(firstGame.id)).toMatchObject({ status: 'aborted' });
    expect(connection.last('room.left')).toEqual({ type: 'room.left', reason: 'left' });
    expect(rooms.snapshot(ann, second).seatCount).toBe(4);
  });

  it('replaces a solo room with no game running without asking', async () => {
    const { rooms, scheduler, registered, connect } = await setup({ botPolicy: failing });
    const ann = await registered('Ann');
    const first = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    await connect(ann, first);
    await scheduler.runUntil(() => rooms.snapshot(ann, first).status === 'lobby');
    const second = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    expect(() => rooms.snapshot(ann, first)).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(rooms.snapshot(ann, second).status).toBe('playing');
  });

  it("doesn't count toward the one open room a user may be in", async () => {
    const { rooms, registered } = await setup();
    const ann = await registered('Ann');
    await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    await expect(rooms.create(ann, { seatCount: 4, rules: {}, displayName: 'Ann' })).resolves.toEqual(expect.any(String));
  });

  it('starts again on Play Again, and closes on Back to Rooms', async () => {
    const { rooms, repos, scheduler, registered, connect } = await setup({ botPolicy: failing });
    const ann = await registered('Ann');
    const id = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    const { playerId } = await connect(ann, id);
    await scheduler.runUntil(() => rooms.snapshot(ann, id).status === 'lobby');
    await rooms.command(ann, id, playerId, { type: 'lobby.start' });
    expect(rooms.snapshot(ann, id).status).toBe('playing');
    const game = (await repos.games.listRunning()).find((g) => g.roomId === id)!;
    await rooms.command(ann, id, playerId, { type: 'room.leave' });
    expect(() => rooms.snapshot(ann, id)).toThrow(expect.objectContaining({ code: 'not_found' }));
    expect(await repos.games.findById(game.id)).toMatchObject({ status: 'aborted' });
  });

  it('pauses while the player is away, and never hands their seat to a bot', async () => {
    const { rooms, repos, scheduler, registered, connect, gameOf } = await setup();
    const ann = await registered('Ann');
    const id = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    const game = await gameOf(id);
    const { connection, playerId } = await connect(ann, id);
    await rooms.disconnect(id, playerId, connection);
    const stored = (await repos.games.listActions(game.id)).length;
    await scheduler.advance(2 * TAKEOVER_AWAY_MS);
    await rooms.tick();
    expect(await repos.games.listActions(game.id)).toHaveLength(stored);
    expect(rooms.snapshot(ann, id).members[0].botControlled).toBe(false);
  });

  it('refuses a seat count outside the limits', async () => {
    const { rooms, registered } = await setup();
    await expect(rooms.createSolo(await registered('Ann'), { seatCount: 9, rules: {} })).rejects.toEqual(code('invalid_seat_count'));
  });
});
```

- [ ] **Step 2: Write the failing restore tests**

Create `projects/server/src/rooms/restore.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { ruleBasedPolicy } from 'bots';
import { buildContentRegistry } from 'content';
import { getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import type { GameState } from 'engine';
import { applyActions, drawSeats, engineContext, openingState, stateHash } from '../game/engineGame';
import { TAKEOVER_AWAY_MS } from '../game/gameRunner';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { Repositories, NewGameAction } from '../persistence/repositories';
import { UserRecord } from '../persistence/records';
import { RoomService } from './roomService';
import { FakeConnection } from './testing';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const registry = buildContentRegistry();
const ctx = engineContext(registry);

function service(repos: Repositories, scheduler: ManualScheduler, buildId: string, logError = jest.fn()) {
  return new RoomService({ repos, seatLimits: { min: 2, max: 6 }, now: scheduler.clock, logError, registry, buildId, randomSeed: () => 1234, scheduler });
}

const registered = (repos: Repositories, name: string) =>
  repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(T0) });

async function connect(rooms: RoomService, user: UserRecord, roomId: string) {
  const connection = new FakeConnection();
  const playerId = await rooms.connect(user, roomId, connection);
  return { connection, playerId };
}

// Stores a playing open room (Ann and Bot 1) whose game has three bot-chosen
// actions, as a crash would leave it. `tamper` changes the second hash, and
// `badAction` replaces the third action with one the engine refuses.
async function storedGame(repos: Repositories, options: { buildId?: string; tamper?: boolean; badAction?: boolean; annLeft?: boolean } = {}) {
  const at = new Date(T0);
  const ann = await registered(repos, 'Ann');
  const room = await repos.rooms.create({ visibility: 'open', seatCount: 2, rules: {}, now: at });
  const host = await repos.rooms.addPlayer({ roomId: room.id, userId: ann.id, kind: 'human', displayName: 'Ann', now: at });
  const bot = await repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: new Date(T0 + 1) });
  await repos.rooms.update(room.id, { hostPlayerId: host.id, status: 'playing' }, at);
  const seats = drawSeats(
    [
      { id: host.id, name: 'Ann', kind: 'human' },
      { id: bot.id, name: 'Bot 1', kind: 'bot' },
    ],
    99
  );
  const game = await repos.games.create({ roomId: room.id, seed: 99, seats, rules: {}, buildId: options.buildId ?? 'old-build', now: at });
  let state: GameState = openingState(ctx, 99, seats, {});
  const rows: NewGameAction[] = [];
  for (let seq = 1; seq <= 3; seq += 1) {
    const seatId = getActiveSeatId(state)!;
    const action = ruleBasedPolicy.decide(redactStateForSeat(state, seatId), seatId, getLegalActions(state, seatId, registry), registry, null).action;
    state = applyActions(ctx, state, [action]).at(-1)!;
    rows.push({ seq, seatId, source: 'bot', action, stateHash: stateHash(state) });
  }
  if (options.tamper) rows[1] = { ...rows[1], stateHash: 'tampered' };
  if (options.badAction) rows[2] = { ...rows[2], action: { kind: 'RespondAction', seatId: rows[2].seatId, pendingResponseId: 'missing', cardInstanceId: 'missing' } };
  await repos.transaction((tx) => tx.games.appendActions(game.id, 0, rows, at));
  if (options.annLeft) await repos.rooms.markLeft(host.id, at);
  return { ann, roomId: room.id, game, hash: stateHash(state) };
}

describe('RoomService.restore', () => {
  it('restores a running game at the same point, every human away, and an open room takes over after 60 s (Review Focus 4)', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId, game } = await storedGame(repos, { buildId: 'test-build' });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    const room = rooms.snapshot(ann, roomId);
    expect(room.status).toBe('playing');
    expect(room.members.find((m) => m.name === 'Ann')).toMatchObject({ connected: false, botControlled: false });
    await scheduler.advance(TAKEOVER_AWAY_MS);
    await rooms.tick();
    expect(rooms.snapshot(ann, roomId).members.find((m) => m.name === 'Ann')!.botControlled).toBe(true);
    const { connection } = await connect(rooms, ann, roomId);
    expect(connection.last('welcome')!.game).toMatchObject({ gameId: game.id, logFrom: 0 });
    expect(connection.last('welcome')!.game!.seq).toBeGreaterThanOrEqual(3);
  });

  it('restores exactly the stored actions: the restored seq is the stored log length', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId } = await storedGame(repos, { buildId: 'test-build' });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    const { connection } = await connect(rooms, ann, roomId);
    const restored = connection.last('welcome')!.game!;
    // 3 stored actions; a bot may have moved since, and stored that too.
    expect((await repos.games.listActions(restored.gameId)).length).toBe(restored.seq);
  });

  it('trusts the replay on the same build even when a stored hash differs', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId } = await storedGame(repos, { buildId: 'test-build', tamper: true });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    expect(rooms.snapshot(ann, roomId).status).toBe('playing');
  });

  it('checks the hashes on another build, and continues when they match', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId } = await storedGame(repos, { buildId: 'old-build' });
    const rooms = service(repos, scheduler, 'new-build');
    await rooms.restore();
    expect(rooms.snapshot(ann, roomId).status).toBe('playing');
  });

  it("stops a game whose hash differs on another build: the room shows it can't continue (Review Focus 4)", async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const logError = jest.fn();
    const { ann, roomId, game } = await storedGame(repos, { buildId: 'old-build', tamper: true });
    const rooms = service(repos, scheduler, 'new-build', logError);
    await rooms.restore();
    const room = rooms.snapshot(ann, roomId);
    expect(room.status).toBe('lobby');
    expect(room.lastGame).toMatchObject({ gameId: game.id, outcome: 'outdated', result: null });
    expect(await repos.games.findById(game.id)).toMatchObject({ status: 'broken' });
    expect(logError).toHaveBeenCalled();
  });

  it('stops a game whose stored action the engine refuses, whatever the build', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { ann, roomId } = await storedGame(repos, { buildId: 'test-build', badAction: true });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    expect(rooms.snapshot(ann, roomId).lastGame?.outcome).toBe('outdated');
  });

  it('ends a game with no humans left unfinished, and closes its room', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const { roomId, game } = await storedGame(repos, { buildId: 'test-build', annLeft: true });
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    expect((await repos.rooms.listLive()).map((entry) => entry.room.id)).not.toContain(roomId);
    expect(await repos.games.findById(game.id)).toMatchObject({ status: 'aborted' });
  });

  it('restores a solo game paused, and it resumes when the player returns', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const first = service(repos, scheduler, 'test-build');
    const ann = await registered(repos, 'Ann');
    const id = await first.createSolo(ann, { seatCount: 2, rules: {} });
    await first.stop();
    const rooms = service(repos, scheduler, 'test-build');
    await rooms.restore();
    const game = (await repos.games.listRunning()).find((g) => g.roomId === id)!;
    await scheduler.advance(3_600_000);
    expect(await repos.games.listActions(game.id)).toEqual([]);
    const { connection } = await connect(rooms, ann, id);
    expect(connection.last('welcome')!.game).toMatchObject({ paused: false });
  });

  it('stop() leaves no game timer behind', async () => {
    const repos = createMemoryRepositories();
    const scheduler = new ManualScheduler(T0);
    const rooms = service(repos, scheduler, 'test-build');
    const ann = await registered(repos, 'Ann');
    const id = await rooms.createSolo(ann, { seatCount: 2, rules: {} });
    await connect(rooms, ann, id);
    expect(scheduler.pending).toBeGreaterThan(0);
    await rooms.stop();
    expect(scheduler.pending).toBe(0);
  });
});
```

Add these tests inside the `describe('room routes', …)` block of `projects/server/src/http/roomRoutes.spec.ts`. They use that file's own `setup`, `post`, `signUp` and `guest` helpers:

```ts
  it('creates a solo room for any signed-in user, guests included', async () => {
    ({ app } = await setup());
    const res = await post(app, '/api/rooms/solo', { seatCount: 3, rules: {} }, await guest(app, 'Gus'));
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ id: expect.any(String) });
  });

  it('refuses a second running solo game with 409 solo_exists, and replaces it when asked', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    expect((await post(app, '/api/rooms/solo', { seatCount: 2, rules: {} }, ann)).statusCode).toBe(201);
    const again = await post(app, '/api/rooms/solo', { seatCount: 2, rules: {} }, ann);
    expect(again.statusCode).toBe(409);
    expect(again.json()).toEqual({ code: 'solo_exists', message: 'You already have a game against bots in progress' });
    expect((await post(app, '/api/rooms/solo', { seatCount: 2, rules: {}, replace: true }, ann)).statusCode).toBe(201);
  });

  it('needs a signed-in user and a valid body for a solo room', async () => {
    ({ app } = await setup());
    expect((await post(app, '/api/rooms/solo', { seatCount: 2, rules: {} })).statusCode).toBe(401);
    expect((await post(app, '/api/rooms/solo', { seatCount: 2 }, await signUp(app, 'Ann'))).statusCode).toBe(400);
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest --selectProjects server soloRooms restore roomRoutes`
Expected: FAIL. There is no `createSolo`, no `stop` and no solo route, and `restore` skips playing rooms.

- [ ] **Step 4: Add solo rooms, game restore and `stop` to `RoomService`**

In `projects/server/src/rooms/roomService.ts`:

- add `SoloRoomBody` to the `protocol` type import;
- change the `./room` import to `import { memberFrom, Room, RoomMember, sameName } from './room';`;
- add `replay` to the `../game/engineGame` import;
- add this helper below `requireName`:

```ts
// "Bot 1", "Bot 2", … skipping the player's own name.
function botNamesBeside(name: string, count: number): string[] {
  const names: string[] = [];
  for (let n = 1; names.length < count; n += 1) if (!sameName(`Bot ${n}`, name)) names.push(`Bot ${n}`);
  return names;
}
```

- replace `restore()` with:

```ts
  // Reloads every live room from the store after a restart. Nobody is
  // connected yet, so every human starts away: lobbies follow the usual host
  // and idle rules, and running games are rebuilt from their stored actions.
  async restore(): Promise<void> {
    const now = this.now();
    const running = new Map((await this.repos.games.listRunning()).map((game) => [game.roomId, game]));
    for (const { room, players } of await this.repos.rooms.listLive()) {
      const members = await Promise.all(players.map(async (player) => memberFrom(player, await this.isRegistered(player), now)));
      const entry = this.track(new Room(room, members, now));
      await entry.queue
        .run(async () => {
          if (room.status === 'playing') await this.restoreGame(entry, running.get(room.id) ?? null);
          else if (entry.room.humans().length === 0) await this.closeRoom(entry, 'idle');
        })
        .catch((err: unknown) => this.logError(err, `Restoring room ${room.id} failed`));
    }
  }

  // Graceful shutdown: no more game timers, and every queued input finishes.
  async stop(): Promise<void> {
    await Promise.all([...this.live.values()].map((entry) => entry.queue.run(async () => entry.runner?.stop()).catch(() => undefined)));
  }
```

- add `createSolo` after `join`:

```ts
  // Play vs Bots (spec "Solo rooms"): an unlisted room with the user and
  // bots, whose game starts at once. One per user. A solo room with no
  // running game is replaced without asking; a running one only with
  // `replace`, which ends its game unfinished.
  createSolo(user: UserRecord, body: SoloRoomBody): Promise<string> {
    return this.membership.run(async () => {
      this.requireSeatCount(body.seatCount, 1);
      const name = requireName(user.displayName);
      const existing = [...this.live.values()].find((entry) => entry.room.record.visibility === 'solo' && entry.room.memberForUser(user.id));
      if (existing) {
        if (existing.room.record.status === 'playing' && !body.replace) throw new RoomError('solo_exists');
        await existing.queue.run(async () => {
          if (this.live.get(existing.room.id) === existing) await this.abortAndClose(existing, 'left');
        });
      }
      const now = this.now();
      const rules = rulesFrom(body.rules, body.seatCount);
      const { room, players } = await this.repos.transaction(async (tx) => {
        const created = await tx.rooms.create({ visibility: 'solo', seatCount: body.seatCount, rules, now: new Date(now) });
        const added = [await tx.rooms.addPlayer({ roomId: created.id, userId: user.id, kind: 'human', displayName: name, now: new Date(now) })];
        for (const [i, botName] of botNamesBeside(name, body.seatCount - 1).entries()) {
          added.push(await tx.rooms.addPlayer({ roomId: created.id, userId: null, kind: 'bot', displayName: botName, now: new Date(now + i + 1) }));
        }
        return { room: created, players: added };
      });
      const members = players.map((player) => memberFrom(player, player.kind === 'human' && user.kind === 'registered', now));
      const entry = this.track(new Room(room, members, now));
      await entry.queue.run(() => this.startGame(entry));
      return room.id;
    });
  }
```

- add these private methods after `closeGame`:

```ts
  // Rebuilds a room's running game from its stored actions (spec "Restore on
  // startup"). Hashes are checked only when the build changed. A replay that
  // fails, or a hash that differs, stops the game as 'outdated'.
  private async restoreGame(entry: LiveRoom, game: GameRecord | null): Promise<void> {
    const { room } = entry;
    if (!game) {
      // Playing, but its game is gone: back to the lobby.
      const at = new Date(this.now());
      await this.repos.rooms.update(room.id, { status: 'lobby' }, at);
      room.record = { ...room.record, status: 'lobby', updatedAt: at };
      return;
    }
    if (room.humans().length === 0) return this.abortAndClose(entry, 'idle', game);
    const actions = await this.repos.games.listActions(game.id);
    let state: GameState;
    try {
      state = replay(this.ctx, game, actions, game.buildId !== this.buildId);
    } catch (err) {
      this.logError(err, `Game ${game.id} can't continue after an update`);
      return this.closeGame(entry, game, 'outdated', null);
    }
    if (state.result) return this.closeGame(entry, game, 'finished', state.result);
    this.run(entry, game, state, actions.length);
  }

  // Ends the room's running game unfinished (the runner's, or `game`), and closes the room.
  private async abortAndClose(entry: LiveRoom, reason: RoomLeftReason, game: GameRecord | null = entry.runner?.record ?? null): Promise<void> {
    const at = new Date(this.now());
    await this.repos.transaction(async (tx) => {
      if (game) await tx.games.update(game.id, { status: 'aborted', finishedAt: at });
      await tx.rooms.update(entry.room.id, { status: 'closed' }, at);
    });
    this.dropRoom(entry, reason);
  }
```

Restore runs `restoreGame` on the room's queue, and a restored runner starts with nobody connected. So an open room's humans get the 60 s grace, and a solo game starts paused. Every clock gets its full budget.

- [ ] **Step 5: Add the route and wire the server**

In `projects/server/src/http/roomRoutes.ts`, add `SoloRoomBodySchema` to the `protocol/schemas` import, and add this route after `POST /api/rooms`:

```ts
  app.post('/api/rooms/solo', { onRequest: signedIn, schema: { body: SoloRoomBodySchema } }, async (request, reply) => {
    const created: RoomCreated = { id: await rooms.createSolo(request.auth!.user, request.body) };
    return reply.code(201).send(created);
  });
```

In `projects/server/src/server.ts`:

- build the registry once, before `new RoomService`: `const registry = buildContentRegistry();`;
- pass `registry`, `buildId: config.buildId`, and `seatLimits: { min: MIN_SEATS, max: guozhanMaxSeats(registry) }`;
- in `close`, call `await rooms.stop();` after `clearInterval(housekeeping);` and before `await app.close();`;
- update the comment above `createServer` to mention that running games are restored with the rooms, and that closing stops game timers first.

In `projects/server/README.md`, add a short "Games" section after the rooms section:

```markdown
## Games

A room's host starts a game with `lobby.start`. The server keeps each running game in a `GameRunner` (`src/game/`), stores every action in `game_actions` (with the state's sha256 after it), and restores running games on start: the same build replays the log as stored, another build checks every hash and stops a game whose hash differs. `POST /api/rooms/solo` starts Play vs Bots, which pauses while its player is away. `BUILD_ID` (default `dev`) tags each game with the build it started on.
```

- [ ] **Step 6: Run the server suite and the type check**

Run: `npx jest --selectProjects server && npm run typecheck:server`
Expected: PASS, and no type errors.

- [ ] **Step 7: Commit**

```bash
git add projects/server
git commit -m "feat(server): solo rooms, restoring running games, and graceful stop

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: End to end over the socket: whole games, refusals, takeover, the solo pause and a restart

**Files:**
- Modify: `projects/server/src/socket/testClient.ts` (an `onMessage` hook, and `BotSeat`)
- Create: `projects/server/src/socket/gameSocket.spec.ts`
- Test: `projects/server/src/socket/gameSocket.spec.ts`

**Interfaces:**
- Consumes:
  - everything above;
  - `buildApp`;
  - `TestClient`;
  - `RoomService` with `botDelayMs` and `takeoverAwayMs` (Task 7);
  - `createSolo` and `stop` (Task 8).
- Produces:
  - `TestClient.onMessage(listener)`;
  - `BotSeat(client, registry)`, with `resyncs` and `lastUpdate`, which plays a seat over the socket the way a person's client would.

`socketServer.ts` needs no change. The new client messages pass the schema union (Task 2), and they reach `RoomService.command` like the lobby commands. If a test here shows otherwise, fix `socketServer.ts` and say so in the report.

- [ ] **Step 1: Add the message hook and `BotSeat` to the test client**

In `projects/server/src/socket/testClient.ts`:

- add `private readonly messageListeners: ((message: ServerMessage) => void)[] = [];` to `TestClient`;
- change the `'message'` handler in the constructor to:

```ts
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;
      this.received.push(message);
      for (const listener of this.messageListeners) listener(message);
      this.notify();
    });
```

- add this method to `TestClient`:

```ts
  // Called with every message as it arrives, before any `next` sees it.
  onMessage(listener: (message: ServerMessage) => void): void {
    this.messageListeners.push(listener);
  }
```

- add these imports at the top:

```ts
import { ruleBasedPolicy } from 'bots';
import type { BotTurnMemory } from 'bots';
import type { ContentRegistry, EngineEvent, GameState } from 'engine';
import type { GameUpdate } from 'protocol';
```

  (`ServerMessage` is already imported as a type.)

- append this class:

```ts
// Plays a seat over the socket the way a person's client would (spec
// "Testing": bots acting as humans). It keeps the log from each update's
// events, asks for game.resync when one is missing, and answers each update
// that offers it moves with the rule-based bot's pick.
export class BotSeat {
  resyncs = 0;
  lastUpdate: GameUpdate | null = null;
  private log: EngineEvent[] = [];
  private memory: BotTurnMemory | null = null;
  private answered: string | null = null;
  private nextReqId = 1;

  constructor(
    private readonly client: TestClient,
    private readonly registry: ContentRegistry
  ) {
    client.onMessage((message) => this.receive(message));
  }

  private receive(message: ServerMessage): void {
    const game = message.type === 'welcome' || message.type === 'game.update' ? message.game : null;
    if (!game) return;
    if (game.logFrom === 0) this.log = [];
    if (game.logFrom !== this.log.length) {
      this.resyncs += 1;
      this.client.send({ type: 'game.resync' });
      return;
    }
    this.log = [...this.log, ...game.events];
    this.lastUpdate = game;
    // One answer per state: a repeated update (a clock change) gets none.
    const key = `${game.gameId}:${game.seq}`;
    if (game.legalActions.length === 0 || this.answered === key) return;
    this.answered = key;
    const view = { ...game.view, log: this.log, rng: { seed: 0, counter: 0 } } as GameState;
    const seatId = game.legalActions[0].seatId;
    const decision = ruleBasedPolicy.decide(view, seatId, game.legalActions, this.registry, this.memory);
    this.memory = decision.memory;
    this.client.send({ type: 'game.submit', reqId: `bot-${this.nextReqId++}`, gameId: game.gameId, baseSeq: game.seq, actions: [decision.action] });
  }
}
```

- [ ] **Step 2: Write the end-to-end tests**

Create `projects/server/src/socket/gameSocket.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { FastifyInstance } from 'fastify';
import { buildContentRegistry } from 'content';
import { PROTOCOL_VERSION } from 'protocol';
import type { GameUpdate } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { buildApp } from '../http/app';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { BotSeat, TestClient } from './testClient';

const ORIGIN = 'http://localhost:4200';
const registry = buildContentRegistry();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One in-memory store across restarts. Bots move at once, and a seat goes to
// a bot after 300 ms away, so whole games and takeovers run in test time.
async function setup() {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const clients: TestClient[] = [];
  let rooms!: RoomService;
  let app!: FastifyInstance;
  let url = '';

  const startServer = async () => {
    rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 }, registry, buildId: 'test-build', botDelayMs: 0, takeoverAwayMs: 300 });
    await rooms.restore();
    app = await buildApp({ accounts, rooms, publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
    await app.listen({ port: 0, host: '127.0.0.1' });
    url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ws`;
  };
  const stopServer = async () => {
    await rooms.stop();
    await app.close();
  };
  await startServer();

  const post = (path: string, payload: object, session?: string) =>
    app.inject({ method: 'POST', url: path, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
  const signUp = async (displayName: string) => {
    const res = await post('/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName });
    return res.cookies.find((c) => c.name === 'sgs_session')!.value;
  };
  // Ann (host) and Bo in a two-seat room.
  const pairRoom = async () => {
    const ann = await signUp('Ann');
    const bo = await signUp('Bo');
    const roomId = (await post('/api/rooms', { seatCount: 2, rules: {}, displayName: 'Ann' }, ann)).json().id as string;
    await post(`/api/rooms/${roomId}/join`, { displayName: 'Bo' }, bo);
    return { ann, bo, roomId };
  };
  const open = async (session: string) => {
    const client = await TestClient.open(url, { origin: ORIGIN, token: session });
    clients.push(client);
    return client;
  };
  const hello = (client: TestClient, roomId: string) => client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId });
  const connect = async (session: string, roomId: string) => {
    const client = await open(session);
    hello(client, roomId);
    return { client, welcome: await client.next('welcome') };
  };
  const connectBot = async (session: string, roomId: string) => {
    const client = await open(session);
    const seat = new BotSeat(client, registry);
    hello(client, roomId);
    await client.next('welcome');
    return { client, seat };
  };
  const startGame = async (client: TestClient) => {
    client.send({ type: 'lobby.start', reqId: 'start' });
    await client.next('ack', (m) => m.reqId === 'start');
  };
  const teardown = async () => {
    for (const client of clients) client.close();
    await stopServer();
  };
  return { repos, rooms: () => rooms, post, signUp, pairRoom, connect, connectBot, startGame, startServer, stopServer, teardown };
}

describe('games over the socket', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  afterEach(async () => {
    await ctx?.teardown();
  });

  it('two people play a whole game to its end, each from their own view', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pairRoom();
    const a = await ctx.connectBot(ann, roomId);
    const b = await ctx.connectBot(bo, roomId);
    await ctx.startGame(a.client);
    const ended = await a.client.next('room.updated', (m) => m.room.status === 'lobby' && m.room.lastGame !== null, 60_000);
    expect(ended.room.lastGame).toMatchObject({ outcome: 'finished', result: expect.objectContaining({ winningSeatIds: expect.any(Array) }) });
    expect(a.seat.resyncs + b.seat.resyncs).toBe(0);
    expect([...a.client.received, ...b.client.received].filter((m) => m.type === 'error')).toEqual([]);
    const final = a.seat.lastUpdate!;
    expect(final.view.result).not.toBeNull();
    const actions = await ctx.repos.games.listActions(final.gameId);
    expect(actions).toHaveLength(final.seq);
    expect(actions.every((x) => x.source === 'human')).toBe(true);
  }, 60_000);

  it('refuses moves out of turn, stale or never offered, and a bad second action undoes the first (Review Focus 1 and 2)', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pairRoom();
    const a = await ctx.connect(ann, roomId);
    const b = await ctx.connect(bo, roomId);
    await ctx.startGame(a.client);
    const [forA, forB] = await Promise.all([a.client.next('game.update'), b.client.next('game.update')]);
    const [mover, other, game] = forA.game.legalActions.length > 0 ? [a, b, forA.game] : [b, a, forB.game];
    const move = game.legalActions[0];
    const submit = (client: TestClient, reqId: string, fields: object = {}) =>
      client.send({ type: 'game.submit', reqId, gameId: game.gameId, baseSeq: 0, actions: [move], ...fields });
    const refusal = (client: TestClient, reqId: string) => client.next('error', (m) => m.reqId === reqId);

    submit(other.client, 'x1');
    expect(await refusal(other.client, 'x1')).toMatchObject({ code: 'not_your_turn', message: "It's not your turn" });
    submit(mover.client, 'x2', { baseSeq: 5 });
    expect(await refusal(mover.client, 'x2')).toMatchObject({ code: 'stale' });
    submit(mover.client, 'x3', { actions: [{ kind: 'DrawCardsAction', seatId: move.seatId, count: 5 }] });
    expect(await refusal(mover.client, 'x3')).toMatchObject({ code: 'illegal_action' });
    submit(mover.client, 'x4', { actions: [move, move] });
    expect(await refusal(mover.client, 'x4')).toMatchObject({ code: 'illegal_action' });
    submit(mover.client, 'x5', { gameId: randomUUID() });
    expect(await refusal(mover.client, 'x5')).toMatchObject({ code: 'stale' });

    mover.client.send({ type: 'game.resync', reqId: 'x6' });
    const resynced = await mover.client.next('game.update');
    expect(resynced.game).toMatchObject({ seq: 0, logFrom: 0 });
    expect(mover.client.isOpen).toBe(true);

    submit(mover.client, 'x7');
    await mover.client.next('ack', (m) => m.reqId === 'x7');
    expect((await other.client.next('game.update')).game.seq).toBe(1);
    expect(await ctx.repos.games.listActions(game.gameId)).toHaveLength(1);
  });

  it("hands an away player's seat to a bot, and gives it back when they return", async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pairRoom();
    const a = await ctx.connect(ann, roomId);
    const b = await ctx.connect(bo, roomId);
    await ctx.startGame(a.client);
    b.client.close();
    await a.client.next('room.updated', (m) => m.room.members.some((x) => x.name === 'Bo' && !x.connected));
    await wait(350);
    await ctx.rooms().tick();
    await a.client.next('room.updated', (m) => m.room.members.some((x) => x.name === 'Bo' && x.botControlled));
    const back = await ctx.connect(bo, roomId);
    expect(back.welcome.room.members.find((x) => x.name === 'Bo')).toMatchObject({ botControlled: false, connected: true });
    expect(back.welcome.you.seatId).toMatch(/^seat-[01]$/);
    expect(back.welcome.game).toMatchObject({ logFrom: 0 });
    await a.client.next('room.updated', (m) => m.room.members.some((x) => x.name === 'Bo' && !x.botControlled));
  });

  it('pauses a solo game while its player is away, and resumes when they return', async () => {
    ctx = await setup();
    const ann = await ctx.signUp('Ann');
    const created = await ctx.post('/api/rooms/solo', { seatCount: 2, rules: {} }, ann);
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    const first = await ctx.connect(ann, id);
    const game = first.welcome.game as GameUpdate;
    expect(game.paused).toBe(false);
    first.client.close();
    await wait(100);
    const stored = (await ctx.repos.games.listActions(game.gameId)).length;
    await wait(200);
    expect(await ctx.repos.games.listActions(game.gameId)).toHaveLength(stored);
    const again = await ctx.connect(ann, id);
    expect(again.welcome.game).toMatchObject({ gameId: game.gameId, paused: false, seq: stored });
  });

  it('restores a game after a restart: the same seq and the same view (Review Focus 4)', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pairRoom();
    const a = await ctx.connect(ann, roomId);
    const b = await ctx.connect(bo, roomId);
    await ctx.startGame(a.client);
    const [forA, forB] = await Promise.all([a.client.next('game.update'), b.client.next('game.update')]);
    const [mover, game] = forA.game.legalActions.length > 0 ? [a, forA.game] : [b, forB.game];
    mover.client.send({ type: 'game.submit', reqId: 'm1', gameId: game.gameId, baseSeq: 0, actions: [game.legalActions[0]] });
    await mover.client.next('ack', (m) => m.reqId === 'm1');
    const annBefore = (await a.client.next('game.update', (m) => m.game.seq === 1)).game;

    a.client.close();
    b.client.close();
    await ctx.stopServer();
    await ctx.startServer();

    const again = await ctx.connect(ann, roomId);
    expect(again.welcome.room.status).toBe('playing');
    expect(again.welcome.game).toMatchObject({ gameId: game.gameId, seq: 1, logFrom: 0 });
    expect(again.welcome.game!.view).toEqual(annBefore.view);
  });
});
```

- [ ] **Step 3: Run the new tests, the whole server suite and the type check**

Run: `npx jest --selectProjects server gameSocket && npx jest --selectProjects server && npm run typecheck:server`
Expected: PASS, and no type errors.

If a test fails on timing (a message missed, for example), fix it with `next(type, match)` or `wait`. Never weaken an assertion. If the full game exceeds 60 s, report the time it took; don't raise the limit silently.

- [ ] **Step 4: Commit**

```bash
git add projects/server/src/socket
git commit -m "test(server): whole games, refusals, takeover, solo pause and restore over the socket

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## The Angular side

Tasks 10 to 12 add the online board, using the same pieces as the local one:

- `RemoteGameService` mirrors the part of `GameService` that `GameBoard` uses.
- `RemoteDecisionClock` mirrors the part of `DecisionTimer` that the board and its dialogs use.
- `OnlineGame` provides both in place of the local services, and renders `<app-game-board />` unchanged.

The Lobby page keeps its one socket and decides what to show from the room and the game: the lobby, the board or the result.

### Task 10: Angular: `RemoteGameService` and `RemoteDecisionClock`

**Files:**
- Create: `projects/app/src/app/online/remote-game.service.ts`
- Modify: `projects/app/src/app/online/testing.ts` (game fixtures)
- Test: `projects/app/src/app/online/remote-game.service.spec.ts`

**Interfaces:**
- Consumes:
  - `SocketService` (Stage 3): `status`, `messages` and `request`;
  - the protocol's `GameUpdate`, `LastGame`, `RoomSnapshot` and `ServerMessage`;
  - `GameService`, `GameMode` and `DecisionTimer` (types only);
  - from the engine: `getActiveSeatId` and `previewEffect`.
- Produces:
  - `BoardGame`: the `Pick` of `GameService` that `GameBoard` reads;
  - `RemoteGameService implements BoardGame`, injectable, provided by the Lobby page. Besides `BoardGame` it has:
    - `clock: Signal<LocalClock | null>`
    - `paused: Signal<boolean>`
    - `ending: Signal<LastGame | null>`
    - `playing: Signal<boolean>`
    - `dismiss(): void`
  - `LocalClock { seatId, endsAt, totalSeconds }`, in this device's time;
  - `RemoteDecisionClock`, which implements `Pick<DecisionTimer, 'secondsLeft' | 'totalSeconds' | 'attach' | 'setTimeoutChoice'>`;
  - in `testing.ts`:
    - `GAME_ID`
    - `gameUpdates(): [GameUpdate, GameUpdate]`: Ann's (seat-0) view at the start, then after her first move
    - `PLAYING: RoomSnapshot`
    - `LAST_GAME: LastGame`
    - `welcome(room?, playerId?, game?)`, which now takes an optional game

- [ ] **Step 1: Add the game fixtures**

In `projects/app/src/app/online/testing.ts`:

- add these imports:

```ts
import { buildContentRegistry, guozhanMode } from 'content';
import { createGame, getLegalActions, redactStateForSeat, resolve } from 'engine';
import type { Action, GameState } from 'engine';
import type { GameUpdate, LastGame } from 'protocol';
```

- replace `welcome` with:

```ts
export function welcome(room: RoomSnapshot = ROOM, playerId = 'p-ann', game: GameUpdate | null = null): ServerMessage {
  const seatId = room.members.find((m) => m.playerId === playerId)?.seatId ?? null;
  return { type: 'welcome', you: { playerId, seatId }, room, game };
}
```

- append:

```ts
export const GAME_ID = '9a1e7c52-1b0f-4f7e-8d2a-3c4b5d6e7f80';

// ROOM while a two-seat game runs: Ann on seat-0, Bo on seat-1.
export const PLAYING: RoomSnapshot = {
  ...ROOM,
  status: 'playing',
  seatCount: 2,
  members: ROOM.members.map((m, i) => ({ ...m, seatId: `seat-${i}` })),
};

export const LAST_GAME: LastGame = {
  gameId: GAME_ID,
  outcome: 'finished',
  result: { endedAt: 40, winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] },
  seats: [
    { seatId: 'seat-0', playerId: 'p-ann', name: 'Ann' },
    { seatId: 'seat-1', playerId: 'p-bo', name: 'Bo' },
  ],
};

// What Ann (seat-0) is sent in a two-seat game: at the start, when she
// chooses her Generals first, and after she chose (Bo to choose).
export function gameUpdates(): [GameUpdate, GameUpdate] {
  const registry = buildContentRegistry();
  const created = createGame(guozhanMode, registry, ['seat-0', 'seat-1'], 7);
  const opening: GameState = { ...created, players: created.players.map((p) => ({ ...p, name: p.seatId === 'seat-0' ? 'Ann' : 'Bo' })) };
  const next = resolve(opening, getLegalActions(opening, 'seat-0', registry)[0], { registry, mode: guozhanMode }).state;
  const update = (state: GameState, seq: number, logFrom: number, legalActions: Action[]): GameUpdate => {
    const { rng: _rng, log, ...view } = redactStateForSeat(state, 'seat-0');
    return { gameId: GAME_ID, seq, view, legalActions, logFrom, events: log.slice(logFrom), clock: null, paused: false };
  };
  return [update(opening, 0, 0, getLegalActions(opening, 'seat-0', registry)), update(next, 1, opening.log.length, [])];
}
```

- [ ] **Step 2: Write the failing test**

Create `projects/app/src/app/online/remote-game.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import type { GameUpdate, RoomSnapshot } from 'protocol';
import { RemoteDecisionClock, RemoteGameService } from './remote-game.service';
import { SocketService, WEB_SOCKET_FACTORY } from './socket.service';
import { FakeSocket, GAME_ID, gameUpdates, LAST_GAME, PLAYING, ROOM, welcome } from './testing';

describe('RemoteGameService', () => {
  let socket: FakeSocket;
  let game: RemoteGameService;
  const [opening, afterMove] = gameUpdates();
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    game = TestBed.inject(RemoteGameService);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
  });

  it('has no game until one arrives', () => {
    socket.serverSends(welcome(ROOM));
    expect(game.state()).toBeNull();
    expect(game.legalActions()).toEqual([]);
    expect(game.playing()).toBe(false);
  });

  it("builds the board's state from the welcome's game: the view, the full log and your seat", () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    expect(game.state()).toEqual({ ...opening.view, log: opening.events, rng: { seed: 0, counter: 0 } });
    expect(game.visibleState()).toBe(game.state());
    expect(game.humanSeatId()).toBe('seat-0');
    expect(game.revealedSeatId()).toBe('seat-0');
    expect(game.activeSeatId()).toBe('seat-0');
    expect(game.legalActions()).toEqual(opening.legalActions);
    expect(game.mode()).toBe('pass-and-play');
    expect(game.playing()).toBe(true);
  });

  it("appends each update's events to the log, and asks for a resync when some are missing", () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    socket.serverSends({ type: 'game.update', game: afterMove });
    expect(game.state()!.log).toEqual([...opening.events, ...afterMove.events]);
    expect(game.activeSeatId()).toBe('seat-1');
    const before = game.state();
    socket.serverSends({ type: 'game.update', game: { ...afterMove, seq: 2, logFrom: afterMove.logFrom + afterMove.events.length + 5 } });
    expect(socket.lastSent).toMatchObject({ type: 'game.resync' });
    expect(game.state()).toBe(before);
  });

  it('starts the log afresh for a new game', () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    socket.serverSends({ type: 'game.update', game: afterMove });
    socket.serverSends({ type: 'game.update', game: { ...opening, gameId: 'another-game' } });
    expect(game.state()!.log).toEqual(opening.events);
  });

  it('sends a move as one game.submit with the game and seq it saw, and offers no moves until answered', async () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    const [first, second] = opening.legalActions;
    game.submitAll([first, second]);
    expect(socket.lastSent).toEqual({ type: 'game.submit', gameId: GAME_ID, baseSeq: 0, actions: [first, second], reqId: expect.any(String) });
    expect(game.legalActions()).toEqual([]);
    socket.serverSends({ type: 'ack', reqId: socket.lastSent!['reqId'] as string });
    await flush();
    expect(game.legalActions()).toEqual(opening.legalActions);
    game.submit(first);
    expect(socket.lastSent).toMatchObject({ type: 'game.submit', actions: [first] });
  });

  it("shows a refused move's message, and resyncs after a stale one", async () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    game.submit(opening.legalActions[0]);
    socket.serverSends({ type: 'error', reqId: socket.lastSent!['reqId'] as string, code: 'stale', message: 'The game moved on. Try again' });
    await flush();
    expect(game.lastError()).toBe('The game moved on. Try again');
    expect(socket.lastSent).toMatchObject({ type: 'game.resync' });
    game.clearError();
    expect(game.lastError()).toBeNull();
  });

  it('offers no moves while the socket is down', () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    socket.serverCloses();
    expect(game.legalActions()).toEqual([]);
  });

  it("counts bot seats and taken-over seats as bots, and a clock on one as that bot's thinking", () => {
    const takenOver: RoomSnapshot = { ...PLAYING, members: PLAYING.members.map((m) => (m.playerId === 'p-bo' ? { ...m, botControlled: true } : m)) };
    // A welcome carries the whole log.
    const events = [...opening.events, ...afterMove.events];
    socket.serverSends(welcome(takenOver, 'p-ann', { ...afterMove, logFrom: 0, events }));
    expect(game.botSeatIds()).toEqual(['seat-1']);
    expect(game.botThinkingSeatId()).toBeNull();
    socket.serverSends({ type: 'game.update', game: { ...afterMove, logFrom: events.length, events: [], clock: { seatId: 'seat-1', kind: 'selection', endsAt: 700, totalSeconds: 0.7, serverNow: 0 } } });
    expect(game.botThinkingSeatId()).toBe('seat-1');
  });

  it("ends with the final state's result, then the room's last game, until dismissed", () => {
    socket.serverSends(welcome(PLAYING, 'p-ann', opening));
    const final: GameUpdate = { ...afterMove, view: { ...afterMove.view, result: LAST_GAME.result } };
    socket.serverSends({ type: 'game.update', game: final });
    expect(game.ending()).toEqual(LAST_GAME);
    expect(game.playing()).toBe(false);
    socket.serverSends({ type: 'room.updated', room: { ...ROOM, lastGame: LAST_GAME } });
    expect(game.ending()).toEqual(LAST_GAME);
    game.dismiss();
    expect(game.ending()).toBeNull();
  });
});

describe('RemoteDecisionClock', () => {
  let socket: FakeSocket;
  const [opening, afterMove] = gameUpdates();

  afterEach(() => jest.useRealTimers());

  it("counts down the viewer's own clock in this device's time, and shows no other seat's", () => {
    jest.useFakeTimers({ now: 1_000_000 });
    TestBed.configureTestingModule({
      providers: [SocketService, RemoteGameService, RemoteDecisionClock, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    const clock = TestBed.inject(RemoteDecisionClock);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
    // The server's clock runs 4 000 s ahead of this device's: only the difference matters.
    socket.serverSends(welcome(PLAYING, 'p-ann', { ...opening, clock: { seatId: 'seat-0', kind: 'selection', endsAt: 5_030_000, totalSeconds: 300, serverNow: 5_000_000 } }));
    TestBed.tick();
    expect(clock.secondsLeft()).toBe(30);
    expect(clock.totalSeconds()).toBe(300);
    jest.advanceTimersByTime(10_000);
    expect(clock.secondsLeft()).toBe(20);
    socket.serverSends({ type: 'game.update', game: { ...afterMove, clock: { seatId: 'seat-1', kind: 'selection', endsAt: 5_100_000, totalSeconds: 300, serverNow: 5_000_000 } } });
    TestBed.tick();
    expect(clock.secondsLeft()).toBeNull();
    expect(clock.totalSeconds()).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest --selectProjects app remote-game`
Expected: FAIL, because `./remote-game.service` does not exist.

- [ ] **Step 4: Write the implementation**

Create `projects/app/src/app/online/remote-game.service.ts`:

```ts
import { computed, DestroyRef, effect, inject, Injectable, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { buildContentRegistry, guozhanMode } from 'content';
import { getActiveSeatId, previewEffect } from 'engine';
import type { Action, ContentRegistry, Effect, EngineContext, EngineEvent, GameState } from 'engine';
import { ERROR_MESSAGES } from 'protocol';
import type { GameUpdate, LastGame, RoomSnapshot, ServerMessage } from 'protocol';
import { ApiError } from '../auth/auth.service';
import type { DecisionTimer } from '../decision-timer.service';
import type { GameMode, GameService } from '../game.service';
import { SocketService } from './socket.service';

// What GameBoard reads from GameService. The online board provides
// RemoteGameService in its place, so the board itself stays as it is.
export type BoardGame = Pick<
  GameService,
  | 'registry'
  | 'mode'
  | 'state'
  | 'visibleState'
  | 'humanSeatId'
  | 'revealedSeatId'
  | 'activeSeatId'
  | 'legalActions'
  | 'botSeatIds'
  | 'botThinkingSeatId'
  | 'lastError'
  | 'previewEffect'
  | 'reveal'
  | 'submit'
  | 'submitAll'
  | 'clearError'
>;

// The running clock, moved onto this device's time.
export interface LocalClock {
  seatId: string;
  endsAt: number;
  totalSeconds: number;
}

// The seed stays on the server. Nothing on the client draws from this.
const NO_RNG = { seed: 0, counter: 0 };

// The server's game as the board sees it, kept from the room socket. The
// server decides every move: this shows what it sends and submits what the
// player picks. Previews run on the received view with the local engine.
@Injectable()
export class RemoteGameService implements BoardGame {
  private readonly socket = inject(SocketService);
  readonly registry: ContentRegistry = buildContentRegistry();
  private readonly ctx: EngineContext = { registry: this.registry, mode: guozhanMode };
  private log: EngineEvent[] = [];
  private readonly _update = signal<GameUpdate | null>(null);
  private readonly _state = signal<GameState | null>(null);
  private readonly _room = signal<RoomSnapshot | null>(null);
  private readonly _you = signal<string | null>(null);
  private readonly _lastError = signal<string | null>(null);
  private readonly _waiting = signal(false);
  private readonly _clock = signal<LocalClock | null>(null);
  private readonly _dismissed = signal<string | null>(null);

  // Never 'vs-bots': in that mode the board offers New Game, which goes to the local Setup.
  readonly mode: Signal<GameMode> = signal<GameMode>('pass-and-play').asReadonly();
  readonly state: Signal<GameState | null> = this._state.asReadonly();
  readonly visibleState: Signal<GameState | null> = this._state.asReadonly();
  readonly lastError: Signal<string | null> = this._lastError.asReadonly();
  readonly clock: Signal<LocalClock | null> = this._clock.asReadonly();
  readonly paused = computed(() => this._update()?.paused ?? false);

  readonly humanSeatId: Signal<string | null> = computed(() => {
    const you = this._you();
    return this._room()?.members.find((m) => m.playerId === you)?.seatId ?? null;
  });
  // Always the player's own seat, so the board never shows the pass-and-play gate.
  readonly revealedSeatId: Signal<string | null> = this.humanSeatId;

  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    return state ? getActiveSeatId(state) : null;
  });

  // The server's offer, while the socket is up and no move is waiting for its answer.
  readonly legalActions: Signal<Action[]> = computed(() => (this.socket.status() === 'open' && !this._waiting() ? (this._update()?.legalActions ?? []) : []));

  // Bot seats, and human seats a bot plays for now.
  readonly botSeatIds: Signal<string[]> = computed(() => {
    const bots = new Set(this._state()?.players.filter((p) => p.kind === 'bot').map((p) => p.seatId) ?? []);
    for (const member of this._room()?.members ?? []) if (member.botControlled && member.seatId) bots.add(member.seatId);
    return [...bots];
  });

  // A clock on a bot-played seat is that bot about to move.
  readonly botThinkingSeatId: Signal<string | null> = computed(() => {
    const clock = this._clock();
    return clock && this.botSeatIds().includes(clock.seatId) ? clock.seatId : null;
  });

  // How the last game ended, until the player dismisses it. It comes from
  // the room's last game, or from the final update, which arrives just
  // before the room says so.
  readonly ending: Signal<LastGame | null> = computed(() => {
    const room = this._room();
    const dismissed = this._dismissed();
    if (room?.status === 'lobby' && room.lastGame && room.lastGame.gameId !== dismissed) return room.lastGame;
    const update = this._update();
    const state = this._state();
    if (room?.status !== 'playing' || !update || !state?.result || update.gameId === dismissed) return null;
    return {
      gameId: update.gameId,
      outcome: 'finished',
      result: state.result,
      seats: state.players.map((p) => ({ seatId: p.seatId, playerId: room.members.find((m) => m.seatId === p.seatId)?.playerId ?? '', name: p.name })),
    };
  });

  // A game is on and still going: the board shows.
  readonly playing: Signal<boolean> = computed(() => this._room()?.status === 'playing' && this._state() !== null && this.ending() === null);

  constructor() {
    this.socket.messages.pipe(takeUntilDestroyed()).subscribe((message) => this.receive(message));
  }

  dismiss(): void {
    const ending = this.ending();
    if (ending) this._dismissed.set(ending.gameId);
  }

  // The board never gates a remote seat.
  reveal(_seatId: string): void {}

  submit(action: Action): void {
    this.submitAll([action]);
  }

  // One move: the server applies all of it or none of it.
  submitAll(actions: Action[]): void {
    const update = this._update();
    if (!update || actions.length === 0 || this._waiting()) return;
    this._waiting.set(true);
    this._lastError.set(null);
    this.socket
      .request({ type: 'game.submit', gameId: update.gameId, baseSeq: update.seq, actions })
      .catch((err: unknown) => {
        this._lastError.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
        if (err instanceof ApiError && err.code === 'stale') this.resync();
      })
      .finally(() => this._waiting.set(false));
  }

  clearError(): void {
    this._lastError.set(null);
  }

  previewEffect(state: GameState, effect: Effect): Effect | null {
    return previewEffect(state, effect, this.ctx);
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this._you.set(message.you.playerId);
        this._room.set(message.room);
        this.log = [];
        if (message.game) this.apply(message.game);
        else this.clear();
        return;
      case 'room.updated':
        this._room.set(message.room);
        return;
      case 'game.update':
        this.apply(message.game);
        return;
    }
  }

  private apply(update: GameUpdate): void {
    if (update.logFrom === 0 || this._update()?.gameId !== update.gameId) this.log = [];
    if (update.logFrom !== this.log.length) {
      this.resync();
      return;
    }
    this.log = [...this.log, ...update.events];
    this._update.set(update);
    this._state.set({ ...update.view, log: this.log, rng: NO_RNG });
    const clock = update.clock;
    this._clock.set(clock && { seatId: clock.seatId, endsAt: Date.now() + (clock.endsAt - clock.serverNow), totalSeconds: clock.totalSeconds });
  }

  private clear(): void {
    this._update.set(null);
    this._state.set(null);
    this._clock.set(null);
  }

  private resync(): void {
    this.socket.request({ type: 'game.resync' }).catch(() => undefined);
  }
}

// The countdown the board and its dialogs show, from the server's clock: the
// viewer's own decisions only (a bot's clock shows as "thinking…" instead).
// The server times out with the engine's default, so a half-made pick is not
// sent ahead.
@Injectable()
export class RemoteDecisionClock implements Pick<DecisionTimer, 'secondsLeft' | 'totalSeconds' | 'attach' | 'setTimeoutChoice'> {
  private readonly game = inject(RemoteGameService);
  private readonly now = signal(Date.now());
  private readonly own = computed(() => {
    const clock = this.game.clock();
    return clock && clock.seatId === this.game.humanSeatId() && !this.game.paused() ? clock : null;
  });

  readonly secondsLeft: Signal<number | null> = computed(() => {
    const clock = this.own();
    return clock ? Math.max(0, Math.ceil((clock.endsAt - this.now()) / 1000)) : null;
  });
  readonly totalSeconds: Signal<number | null> = computed(() => this.own()?.totalSeconds ?? null);

  constructor() {
    // Ticks only while there is a countdown to show.
    effect((onCleanup) => {
      if (!this.own()) return;
      this.now.set(Date.now());
      const interval = setInterval(() => this.now.set(Date.now()), 250);
      onCleanup(() => clearInterval(interval));
    });
  }

  // The online board is always on screen while it exists: nothing to pause.
  attach(_destroyRef: DestroyRef): void {}

  setTimeoutChoice(_actions: Action[]): void {}
}
```

- [ ] **Step 5: Run tests and the build**

Run: `npx jest --selectProjects app remote-game && npx ng build app`
Expected: PASS, and the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/online/remote-game.service.ts projects/app/src/app/online/remote-game.service.spec.ts projects/app/src/app/online/testing.ts
git commit -m "feat(app): RemoteGameService and RemoteDecisionClock for the online board

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Angular: the online board, the result, Start Game and "is back"

**Files:**
- Create:
  - `projects/app/src/app/online/online-game.ts`
  - `projects/app/src/app/online/online-result.ts`
- Modify:
  - `projects/app/src/app/online/lobby.service.ts`
  - `projects/app/src/app/online/lobby-page.ts`
  - `projects/app/src/app/online/online-page.css`
- Test:
  - `projects/app/src/app/online/online-game.spec.ts`
  - `projects/app/src/app/online/online-result.spec.ts`
  - `projects/app/src/app/online/lobby.service.spec.ts`
  - `projects/app/src/app/online/lobby-page.spec.ts`

**Interfaces:**
- Consumes:
  - Task 10's `RemoteGameService` (`ending`, `playing` and `dismiss`) and `RemoteDecisionClock`, plus its fixtures;
  - `GameBoard`, `GameService` and `DecisionTimer`, all unchanged;
  - `GAME_OUTCOME_MESSAGES`;
  - from `labels.ts`: `forceOf`, `kingdomDisplayName` and `seatName`.
- Produces:
  - `OnlineGame`: the `<app-online-game>` component;
  - `OnlineResult`: `<app-online-result [ending] [solo] [canAct] (backToLobby) (playAgain) (backToRooms)>`;
  - `LobbyService` gains:
    - `isSolo`
    - `canStart`
    - `start(): Promise<boolean>`
    - the "{name} is back" notice
  - The Lobby page shows the result, the board or the lobby. It provides `RemoteGameService` and `RemoteDecisionClock`.

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/online/online-game.spec.ts`:

```ts
import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { DecisionTimer } from '../decision-timer.service';
import { GameBoard } from '../game-board/game-board';
import { OnlineGame } from './online-game';
import { RemoteDecisionClock, RemoteGameService } from './remote-game.service';
import { SocketService, WEB_SOCKET_FACTORY } from './socket.service';
import { FakeSocket, gameUpdates, PLAYING, ROOM, welcome } from './testing';

@Component({ selector: 'app-clock-probe', template: '' })
class ClockProbe {
  readonly timer = inject(DecisionTimer);
}

describe('OnlineGame', () => {
  let socket: FakeSocket;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OnlineGame],
      providers: [
        SocketService,
        RemoteGameService,
        RemoteDecisionClock,
        { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) },
        provideRouter([]),
      ],
    });
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
    socket.serverSends(welcome(PLAYING, 'p-ann', gameUpdates()[0]));
  });

  it("shows the shared board on the server's game, from the player's own seat", async () => {
    const fixture = TestBed.createComponent(OnlineGame);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-game-board app-general-selection')).not.toBeNull();
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
  });

  it('lets the dialogs the board opens find the online clock', async () => {
    const fixture = TestBed.createComponent(OnlineGame);
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = fixture.debugElement.query(By.directive(GameBoard)).injector.get(MatDialog);
    const ref = dialog.open(ClockProbe);
    expect(ref.componentInstance.timer).toBe(TestBed.inject(RemoteDecisionClock));
    ref.close();
  });
});
```

Create `projects/app/src/app/online/online-result.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import type { LastGame } from 'protocol';
import { OnlineResult } from './online-result';
import { LAST_GAME } from './testing';

describe('OnlineResult', () => {
  function render(ending: LastGame, solo = false) {
    TestBed.configureTestingModule({ imports: [OnlineResult] });
    const fixture = TestBed.createComponent(OnlineResult);
    fixture.componentRef.setInput('ending', ending);
    fixture.componentRef.setInput('solo', solo);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const text = (el: HTMLElement, selector: string) => el.querySelector(selector)?.textContent?.trim();

  it('names the winners and losers of a finished game', () => {
    const el = render(LAST_GAME);
    expect(text(el, 'mat-card-title')).toBe('Game Over');
    expect(text(el, '.headline')).toBe('Ann wins!');
    expect(text(el, '.winners')).toBe('Winners: Ann');
    expect(text(el, '.losers')).toBe('Losers: Bo');
    expect(text(el, 'button.back-to-lobby')).toBe('Back to Lobby');
  });

  it('names a winning Force', () => {
    const el = render({ ...LAST_GAME, result: { ...LAST_GAME.result!, winningKingdom: 'Wei' } });
    expect(text(el, '.headline')).toBe('Wei wins!');
  });

  it("says why a game stopped when it didn't finish", () => {
    expect(text(render({ ...LAST_GAME, outcome: 'broken', result: null }), '.stopped')).toBe('This game hit an error and has stopped');
    TestBed.resetTestingModule();
    const el = render({ ...LAST_GAME, outcome: 'outdated', result: null });
    expect(text(el, 'mat-card-title')).toBe('Game Stopped');
    expect(text(el, '.stopped')).toBe("This game can't continue after an update");
  });

  it('offers Play Again and Back to Rooms after a solo game', () => {
    const el = render(LAST_GAME, true);
    expect(el.querySelector('button.back-to-lobby')).toBeNull();
    expect(text(el, 'button.play-again')).toContain('Play Again');
    expect(text(el, 'button.back-to-rooms')).toBe('Back to Rooms');
  });
});
```

In `projects/app/src/app/online/lobby.service.spec.ts`, add `PLAYING` to the `./testing` import, and add:

```ts
  it('lets the host start the game, and a solo room its player', async () => {
    socket.serverSends(welcome(ROOM, 'p-ann'));
    expect(lobby.canStart()).toBe(true);
    void lobby.start();
    expect(socket.lastSent).toMatchObject({ type: 'lobby.start' });
    socket.serverSends(welcome(ROOM, 'p-bo'));
    expect(lobby.canStart()).toBe(false);
    socket.serverSends(welcome({ ...ROOM, visibility: 'solo', hostPlayerId: null }, 'p-bo'));
    expect(lobby.isSolo()).toBe(true);
    expect(lobby.canStart()).toBe(true);
    socket.serverSends({ type: 'room.updated', room: { ...PLAYING, visibility: 'solo', hostPlayerId: null } });
    expect(lobby.canStart()).toBe(false);
  });

  it('announces a player who takes their seat back from a bot', () => {
    const takenOver = { ...PLAYING, members: PLAYING.members.map((m) => (m.playerId === 'p-bo' ? { ...m, botControlled: true } : m)) };
    socket.serverSends(welcome(takenOver, 'p-ann'));
    expect(lobby.notice()).toBeNull();
    socket.serverSends({ type: 'room.updated', room: PLAYING });
    expect(lobby.notice()).toBe('Bo is back');
  });
```

In `projects/app/src/app/online/lobby-page.spec.ts`:

- import `LastGame` (type) from `protocol`, `OnlineGame` from `./online-game`, `RemoteGameService` from `./remote-game.service`, and `LAST_GAME` from `./testing`;
- in `fakeLobby`:
  - add `const isSolo = signal(false);`;
  - return `isSolo`;
  - return `canStart: computed(() => room()?.status === 'lobby' && (room()?.hostPlayerId === you() || isSolo()))`;
  - return `start: jest.fn(async () => true)`;
- add:

```ts
function fakeGame() {
  return { ending: signal<LastGame | null>(null), playing: signal(false), dismiss: jest.fn() };
}
```

- add `let game: ReturnType<typeof fakeGame>;`, and set `game = fakeGame();` in `beforeEach`;
- in `render`, change the override to `{ set: { providers: [{ provide: LobbyService, useValue: lobby }, { provide: RemoteGameService, useValue: game }] } }`. Before it, add `TestBed.overrideComponent(OnlineGame, { set: { imports: [], providers: [], template: '' } });` so the board stays out of these tests;
- add:

```ts
  it('gives the host Start Game, held back with a hint until every seat is filled', async () => {
    const { el, harness } = await render();
    const start = () => el.querySelector('button.start') as HTMLButtonElement;
    expect(start().textContent).toContain('Start Game');
    expect(start().disabled).toBe(true);
    expect(el.querySelector('.start-hint')?.textContent?.trim()).toBe('Fill every seat to start');
    lobby.room.set({ ...MIXED, seatCount: 4 });
    harness.detectChanges();
    expect(start().disabled).toBe(false);
    expect(el.querySelector('.start-hint')).toBeNull();
    start().click();
    expect(lobby.start).toHaveBeenCalled();
  });

  it("shows Start Game to a solo room's player, and to no other member", async () => {
    lobby.you.set('p-bo');
    const { el, harness } = await render();
    expect(el.querySelector('button.start')).toBeNull();
    lobby.isSolo.set(true);
    harness.detectChanges();
    expect(el.querySelector('button.start')).not.toBeNull();
  });

  it('shows the board instead of the lobby while the game runs', async () => {
    game.playing.set(true);
    const { el } = await render();
    expect(el.querySelector('app-online-game')).not.toBeNull();
    expect(el.querySelector('.member-list')).toBeNull();
  });

  it('shows how the last game ended, and Back to Lobby returns to the lobby', async () => {
    game.ending.set(LAST_GAME);
    const { el } = await render();
    expect(el.querySelector('app-online-result .headline')?.textContent?.trim()).toBe('Ann wins!');
    expect(el.querySelector('.member-list')).toBeNull();
    (el.querySelector('button.back-to-lobby') as HTMLButtonElement).click();
    expect(game.dismiss).toHaveBeenCalled();
  });

  it('offers Play Again and Back to Rooms after a solo game', async () => {
    lobby.isSolo.set(true);
    game.ending.set(LAST_GAME);
    const { el } = await render();
    (el.querySelector('button.play-again') as HTMLButtonElement).click();
    expect(lobby.start).toHaveBeenCalled();
    (el.querySelector('button.back-to-rooms') as HTMLButtonElement).click();
    expect(lobby.leave).toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --selectProjects app online`
Expected: FAIL. `./online-game` and `./online-result` don't exist, and `LobbyService` has no `start`.

- [ ] **Step 3: Write `OnlineGame` and `OnlineResult`**

Create `projects/app/src/app/online/online-game.ts`:

```ts
import { Dialog } from '@angular/cdk/dialog';
import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DecisionTimer } from '../decision-timer.service';
import { GameService } from '../game.service';
import { GameBoard } from '../game-board/game-board';
import { RemoteDecisionClock, RemoteGameService } from './remote-game.service';

// The running game on the shared board. GameBoard and its children are the
// local ones, unchanged: under this component, GameService is the server's
// game and DecisionTimer its clock. The board's dialogs open through this
// component's own Dialog and MatDialog, so they find the same two (a root
// MatDialog would give them the local ones).
@Component({
  selector: 'app-online-game',
  imports: [GameBoard],
  providers: [{ provide: GameService, useExisting: RemoteGameService }, { provide: DecisionTimer, useExisting: RemoteDecisionClock }, Dialog, MatDialog],
  template: `<app-game-board />`,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class OnlineGame {}
```

Create `projects/app/src/app/online/online-result.ts`:

```ts
import { Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { GameResult } from 'engine';
import { GAME_OUTCOME_MESSAGES } from 'protocol';
import type { LastGame } from 'protocol';
import { forceOf, kingdomDisplayName } from '../labels';

// How the room's last game ended, named by the seats it was played with. An
// open room goes back to its lobby; a solo room offers Play Again or Back to Rooms.
@Component({
  selector: 'app-online-result',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  styleUrl: './online-page.css',
  template: `
    <div class="online-page">
      <mat-card class="online-card result" appearance="raised">
        <mat-card-header>
          <mat-card-title>{{ ending().outcome === 'finished' ? 'Game Over' : 'Game Stopped' }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          @if (ending().result; as result) {
            <p class="headline" [attr.data-force]="result.winningKingdom ? forceOf(result.winningKingdom) : null">{{ headline(result) }}</p>
            <p class="winners">Winners: {{ names(result.winningSeatIds) || 'None' }}</p>
            <p class="losers">Losers: {{ names(result.losingSeatIds) || 'None' }}</p>
          } @else {
            <p class="banner stopped" role="alert">{{ stopped() }}</p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          @if (solo()) {
            <button mat-button type="button" class="back-to-rooms" [disabled]="!canAct()" (click)="backToRooms.emit()">Back to Rooms</button>
            <button mat-flat-button type="button" class="play-again" [disabled]="!canAct()" (click)="playAgain.emit()"><mat-icon>replay</mat-icon> Play Again</button>
          } @else {
            <button mat-flat-button type="button" class="back-to-lobby" (click)="backToLobby.emit()">Back to Lobby</button>
          }
        </mat-card-actions>
      </mat-card>
    </div>
  `,
})
export class OnlineResult {
  readonly ending = input.required<LastGame>();
  readonly solo = input(false);
  readonly canAct = input(true);
  readonly backToLobby = output<void>();
  readonly playAgain = output<void>();
  readonly backToRooms = output<void>();
  protected readonly forceOf = forceOf;

  protected readonly stopped = computed(() => {
    const outcome = this.ending().outcome;
    return outcome === 'finished' ? '' : GAME_OUTCOME_MESSAGES[outcome];
  });

  protected names(seatIds: string[]): string {
    return seatIds.map((id) => this.ending().seats.find((s) => s.seatId === id)?.name ?? id).join(', ');
  }

  protected headline(result: GameResult): string {
    if (result.winningKingdom) return `${kingdomDisplayName(result.winningKingdom)} wins!`;
    if (result.winningSeatIds.length > 0) return `${this.names(result.winningSeatIds)} wins!`;
    return 'Draw — No survivors.';
  }
}
```

Every game's seats are in `LastGame.seats`, so the `?? id` fallback never shows a raw id in practice.

- [ ] **Step 4: Give `LobbyService` Start Game and the "is back" notice**

In `projects/app/src/app/online/lobby.service.ts`:

- add these after `waitingForHost`:

```ts
  readonly isSolo = computed(() => this._room()?.visibility === 'solo');
  // Who may press Start Game: the host, or a solo room's player, in the lobby.
  readonly canStart = computed(() => this._room()?.status === 'lobby' && (this.isHost() || this.isSolo()));
```

- add after `setRules`:

```ts
  start(): Promise<boolean> {
    return this.run({ type: 'lobby.start' });
  }
```

- in `receive`, call `this.noteChanges(this._room(), message.room);` in place of both `this.noteHostChange(…)` calls;
- replace `noteHostChange` with:

```ts
  // What changed hands, as a notice: "Hing is now the host", "Hing is back".
  private noteChanges(before: RoomSnapshot | null, after: RoomSnapshot): void {
    if (!before) return;
    const host = after.hostPlayerId && before.hostPlayerId !== after.hostPlayerId ? after.members.find((m) => m.playerId === after.hostPlayerId) : undefined;
    if (host) return this.announce(`${host.name} is now the host`);
    const back = after.members.find(
      (m) => m.playerId !== this._you() && !m.botControlled && before.members.some((b) => b.playerId === m.playerId && b.botControlled)
    );
    if (back) this.announce(`${back.name} is back`);
  }

  private announce(text: string): void {
    this._notice.set(text);
    this.clearNoticeTimer();
    this.noticeTimer = setTimeout(() => {
      this.noticeTimer = null;
      this._notice.set(null);
    }, NOTICE_MS);
  }
```

- update the comment on `notice` to `// The latest change of hands, as "Hing is now the host" or "Hing is back".`

- [ ] **Step 5: Let the Lobby page show the result, the board or the lobby**

In `projects/app/src/app/online/lobby-page.ts`:

- import `OnlineGame` from `./online-game`, `OnlineResult` from `./online-result`, and `RemoteDecisionClock` and `RemoteGameService` from `./remote-game.service`;
- add `OnlineGame` and `OnlineResult` to `imports`;
- set `providers: [SocketService, LobbyService, RemoteGameService, RemoteDecisionClock]`;
- add `protected readonly game = inject(RemoteGameService);` below `lobby`;
- change the class comment to: `// A room over its socket: the lobby (members, host controls, Start Game, Leave Room), the board while a game runs, and how the last game ended.`;
- wrap the existing template's outer `<div class="online-page">…</div>` as the last branch of this:

```html
    @if (game.ending(); as ending) {
      <app-online-result
        [ending]="ending"
        [solo]="lobby.isSolo()"
        [canAct]="lobby.canAct()"
        (backToLobby)="game.dismiss()"
        (playAgain)="lobby.start()"
        (backToRooms)="lobby.leave()"
      />
    } @else if (game.playing()) {
      <div class="game-banners">
        @if (lobby.ended(); as text) {
          <p class="banner ended" role="alert">{{ text }}</p>
        } @else if (lobby.status() === 'reconnecting') {
          <p class="banner reconnecting" role="status">Reconnecting…</p>
        }
        @if (lobby.notice(); as text) {
          <p class="notice" role="status">{{ text }}</p>
        }
      </div>
      <app-online-game />
    } @else {
      <!-- the existing <div class="online-page">…</div>, unchanged except for Start Game below -->
    }
```

- inside the lobby's `.players` section, after the `</ul>`, add:

```html
              @if (lobby.canStart() && isFull() === false) {
                <p class="hint start-hint">Fill every seat to start</p>
              }
```

- in `<mat-card-actions>`, in the branch that isn't `lobby.ended()`, add before the Add Bot button:

```html
            @if (lobby.canStart()) {
              <button mat-flat-button type="button" class="start" [disabled]="!lobby.canAct() || !isFull()" (click)="lobby.start()">
                <mat-icon>play_arrow</mat-icon> Start Game
              </button>
            }
```

`isFull()` is `members.length >= seatCount`, which the existing `computed` already gives.

Append to `projects/app/src/app/online/online-page.css`:

```css
/* The notices above the online board. */
.game-banners:empty {
  display: none;
}
```

- [ ] **Step 6: Run the app tests and the build**

Run: `npx jest --selectProjects app && npx ng build app`
Expected: PASS, and the build succeeds. Also run `git diff --stat main -- projects/app/src/app/game-board projects/app/src/app/game.service.ts projects/app/src/app/decision-timer.service.ts projects/app/src/app/setup`. It must print nothing.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/online
git commit -m "feat(app): the online board, the game's result, Start Game and seat-return notices

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Angular: Play vs Bots on the Rooms screen

**Files:**
- Create: `projects/app/src/app/online/play-vs-bots-dialog.ts`
- Modify:
  - `projects/app/src/app/online/rooms.service.ts`
  - `projects/app/src/app/online/rooms-page.ts`
  - `projects/app/src/app/online/room-labels.ts`
- Test:
  - `projects/app/src/app/online/play-vs-bots-dialog.spec.ts`
  - `projects/app/src/app/online/rooms-page.spec.ts`
  - `projects/app/src/app/online/rooms.service.spec.ts`
  - `projects/app/src/app/online/room-labels.spec.ts`

**Interfaces:**
- Consumes: `POST /api/rooms/solo` (Task 8), `SoloRoomBody`, and the room list's `visibility` and `youAreMember`.
- Produces:
  - `RoomsService.createSolo(body: SoloRoomBody): Promise<string>`
  - `PlayVsBotsDialogData { seatLimits; existingRoomId: string | null }`
  - `PlayVsBotsDialog`, which closes with a room id to open, or nothing
  - `roomTitle(room)`
  - a **Play vs Bots** button on the Rooms screen

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/online/play-vs-bots-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiError } from '../auth/auth.service';
import { PlayVsBotsDialog, PlayVsBotsDialogData } from './play-vs-bots-dialog';
import { RoomsService } from './rooms.service';

describe('PlayVsBotsDialog', () => {
  const rooms = { createSolo: jest.fn() };
  const dialogRef = { close: jest.fn() };

  async function create(existingRoomId: string | null = null) {
    const data: PlayVsBotsDialogData = { seatLimits: { min: 2, max: 8 }, existingRoomId };
    await TestBed.configureTestingModule({
      imports: [PlayVsBotsDialog],
      providers: [
        { provide: RoomsService, useValue: rooms },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PlayVsBotsDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    rooms.createSolo.mockReset();
    dialogRef.close.mockReset();
  });

  it('offers the seat counts the server allows, and starts a game against bots', async () => {
    rooms.createSolo.mockResolvedValue('r-solo');
    const { el, component } = await create();
    expect(el.querySelector('[mat-dialog-title]')?.textContent).toContain('Play vs Bots');
    expect([...el.querySelectorAll('.seats mat-button-toggle')].map((t) => t.textContent?.trim())).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    expect(component.seatCount()).toBe(4);
    component.seatCount.set(5);
    await component.submit();
    expect(rooms.createSolo).toHaveBeenCalledWith({ seatCount: 5, rules: { firstRevealDraw: true } });
    expect(dialogRef.close).toHaveBeenCalledWith('r-solo');
  });

  it('offers Resume Game or Abandon and Start New when a game against bots is running', async () => {
    rooms.createSolo.mockResolvedValue('r-new');
    const { fixture, component, el } = await create('r-old');
    expect(el.querySelector('.in-progress')?.textContent?.trim()).toBe('You have a game against bots in progress');
    expect(el.querySelector('.seats')).toBeNull();
    (el.querySelector('button.resume') as HTMLButtonElement).click();
    expect(dialogRef.close).toHaveBeenCalledWith('r-old');
    (el.querySelector('button.abandon') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.seats')).not.toBeNull();
    await component.submit();
    expect(rooms.createSolo).toHaveBeenCalledWith({ seatCount: 4, rules: {}, replace: true });
  });

  it("stays open with the server's message when it refuses", async () => {
    rooms.createSolo.mockRejectedValue(new ApiError('solo_exists', 'You already have a game against bots in progress', 409));
    const { fixture, component, el } = await create();
    await component.submit();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(el.querySelector('.error')?.textContent?.trim()).toBe('You already have a game against bots in progress');
  });
});
```

`create('r-old')` starts with 4 seats, so First Reveal Bonus doesn't apply (`rules: {}`).

In `projects/app/src/app/online/rooms-page.spec.ts`, import `PlayVsBotsDialog` from `./play-vs-bots-dialog`, and add:

```ts
  it('opens Play vs Bots with the seat limits, and goes to the new room', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of('r-solo') });
    const { el, router } = await create();
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const button = el.querySelector('button.play-vs-bots') as HTMLButtonElement;
    expect(button.textContent).toContain('Play vs Bots');
    expect(button.disabled).toBe(false);
    button.click();
    expect(dialog.open).toHaveBeenCalledWith(PlayVsBotsDialog, expect.objectContaining({ data: { seatLimits: LIST.seatLimits, existingRoomId: null } }));
    expect(navigate).toHaveBeenCalledWith(['/rooms', 'r-solo']);
  });

  it('lets a guest play vs bots, and names a running game against bots as such', async () => {
    me.set(GUS);
    list.set({ ...LIST, rooms: [{ id: 'r-solo', visibility: 'solo', hostName: null, memberCount: 3, capacity: 3, status: 'playing', youAreMember: true }, ...LIST.rooms] });
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const { el } = await create();
    expect(row(el, 'Play vs Bots')).toBeTruthy();
    (el.querySelector('button.play-vs-bots') as HTMLButtonElement).click();
    expect(dialog.open).toHaveBeenCalledWith(PlayVsBotsDialog, expect.objectContaining({ data: { seatLimits: LIST.seatLimits, existingRoomId: 'r-solo' } }));
  });
```

Adapt the `dialog.open` return values to the shape the file's existing Create Room test uses, if it differs. In `room-labels.spec.ts`, add:

```ts
  it('names a room by its host, and a solo room as Play vs Bots', () => {
    const room: RoomListItem = { id: 'r', visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: false };
    expect(roomTitle(room)).toBe('Ann');
    expect(roomTitle({ ...room, hostName: null })).toBe('Room');
    expect(roomTitle({ ...room, visibility: 'solo', hostName: null })).toBe('Play vs Bots');
  });
```

(Import `roomTitle`, and the `RoomListItem` type if the file doesn't already.)

In `rooms.service.spec.ts`, follow the existing `create` test's pattern (HttpTestingController) and add:

```ts
  it('creates a solo room and returns its id, or throws the API error', async () => {
    const created = service.createSolo({ seatCount: 3, rules: {} });
    const req = http.expectOne('/api/rooms/solo');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ seatCount: 3, rules: {} });
    req.flush({ id: 'r-solo' });
    await expect(created).resolves.toBe('r-solo');
  });
```

Use that spec's own names for the service and `HttpTestingController` variables.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --selectProjects app online`
Expected: FAIL. `./play-vs-bots-dialog`, `createSolo` and `roomTitle` don't exist yet.

- [ ] **Step 3: Write the service method, the label and the dialog**

In `projects/app/src/app/online/rooms.service.ts`, add `SoloRoomBody` to the type import, and add after `create`:

```ts
  // Play vs Bots: a solo room whose game starts at once.
  async createSolo(body: SoloRoomBody): Promise<string> {
    try {
      return (await firstValueFrom(this.http.post<RoomCreated>('/api/rooms/solo', body))).id;
    } catch (err) {
      throw toApiError(err);
    }
  }
```

In `projects/app/src/app/online/room-labels.ts`, append:

```ts
// The name column of the Rooms list: the host, or Play vs Bots for your solo room.
export function roomTitle(room: RoomListItem): string {
  return room.visibility === 'solo' ? 'Play vs Bots' : (room.hostName ?? 'Room');
}
```

Create `projects/app/src/app/online/play-vs-bots-dialog.ts`:

```ts
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import { ERROR_MESSAGES } from 'protocol';
import type { SeatLimits } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { RoomsService } from './rooms.service';

export interface PlayVsBotsDialogData {
  seatLimits: SeatLimits;
  // Your running game against bots, if there is one.
  existingRoomId: string | null;
}

// The seat count and table rules for a game against bots, played on the
// server. With one already running, it offers that game first. Closes with
// the room to open.
@Component({
  selector: 'app-play-vs-bots-dialog',
  imports: [MatDialogModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule],
  template: `
    <h2 mat-dialog-title>Play vs Bots</h2>
    <mat-dialog-content>
      @if (offerResume()) {
        <p class="in-progress">You have a game against bots in progress</p>
      } @else {
        <form id="play-vs-bots-form" (submit)="$event.preventDefault(); submit()">
          <div class="field">
            <span class="label" id="play-vs-bots-seats">Seats</span>
            <mat-button-toggle-group
              class="seats"
              aria-labelledby="play-vs-bots-seats"
              [hideSingleSelectionIndicator]="true"
              [value]="seatCount()"
              (change)="seatCount.set($event.value)"
            >
              @for (n of seatOptions; track n) {
                <mat-button-toggle [value]="n">{{ n }}</mat-button-toggle>
              }
            </mat-button-toggle-group>
          </div>
          @if (seatCount() >= firstRevealMinSeats) {
            <mat-checkbox class="first-reveal" [checked]="firstRevealDraw()" (change)="firstRevealDraw.set($event.checked)">First Reveal Bonus</mat-checkbox>
            <p class="hint">The first seat to reveal a General draws 2 cards.</p>
          }
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
        </form>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      @if (offerResume()) {
        <button mat-stroked-button type="button" class="abandon" (click)="startingNew.set(true)">Abandon and Start New</button>
        <button mat-flat-button type="button" class="resume" (click)="resume()">Resume Game</button>
      } @else {
        <button mat-flat-button type="submit" class="submit" form="play-vs-bots-form" [disabled]="busy()">Start Game</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .field { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
    .label { font: var(--mat-sys-title-small); }
    .hint { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
    .error { margin: 0 0 12px; color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
  `,
})
export class PlayVsBotsDialog {
  protected readonly data = inject<PlayVsBotsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<PlayVsBotsDialog, string>>(MatDialogRef);
  private readonly rooms = inject(RoomsService);
  protected readonly firstRevealMinSeats = FIRST_REVEAL_MIN_SEATS;
  protected readonly seatOptions = Array.from({ length: this.data.seatLimits.max - this.data.seatLimits.min + 1 }, (_, i) => this.data.seatLimits.min + i);

  readonly seatCount = signal(Math.min(Math.max(4, this.data.seatLimits.min), this.data.seatLimits.max));
  readonly firstRevealDraw = signal(true);
  readonly startingNew = signal(false);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly offerResume = () => this.data.existingRoomId !== null && !this.startingNew();

  resume(): void {
    if (this.data.existingRoomId) this.dialogRef.close(this.data.existingRoomId);
  }

  async submit(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const seatCount = this.seatCount();
    try {
      const id = await this.rooms.createSolo({
        seatCount,
        rules: seatCount >= FIRST_REVEAL_MIN_SEATS ? { firstRevealDraw: this.firstRevealDraw() } : {},
        ...(this.data.existingRoomId ? { replace: true } : {}),
      });
      this.dialogRef.close(id);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
```

The first test expects `rules: { firstRevealDraw: true }` at 5 seats, and `rules: {}` at 4. That matches the code above.

- [ ] **Step 4: Add the button to the Rooms screen**

In `projects/app/src/app/online/rooms-page.ts`:

- import `PlayVsBotsDialog` and `PlayVsBotsDialogData` from `./play-vs-bots-dialog`, and `roomTitle` from `./room-labels`;
- add `protected readonly roomTitle = roomTitle;`;
- in the `.toolbar`, after the Create Room button and its hint, add:

```html
            <button mat-stroked-button type="button" class="play-vs-bots" [disabled]="!rooms.list()" (click)="playVsBots()">
              <mat-icon>smart_toy</mat-icon> Play vs Bots
            </button>
```

- replace `{{ room.hostName ?? 'Room' }}` with `{{ roomTitle(room) }}`;
- add the method:

```ts
  // Your running game against bots is offered first; otherwise a new one.
  playVsBots(): void {
    const list = this.rooms.list();
    if (!list) return;
    const running = list.rooms.find((room) => room.visibility === 'solo' && room.youAreMember && room.status === 'playing');
    const data: PlayVsBotsDialogData = { seatLimits: list.seatLimits, existingRoomId: running?.id ?? null };
    this.dialog
      .open<PlayVsBotsDialog, PlayVsBotsDialogData, string>(PlayVsBotsDialog, { data, width: '440px' })
      .afterClosed()
      .subscribe((id) => {
        if (id) void this.router.navigate(['/rooms', id]);
      });
  }
```

- update the class comment to mention Play vs Bots, which any signed-in player can start.

- [ ] **Step 5: Run the app tests and the build**

Run: `npx jest --selectProjects app && npx ng build app`
Expected: PASS, and the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add projects/app/src/app/online
git commit -m "feat(app): Play vs Bots on the Rooms screen, with Resume Game and Abandon and Start New

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Manual check after the last task (executor, before the final review)

Run `npm run db:up`, `npm run server` and `npm start`, then use two browsers (or one normal window and one private one):

1. Sign up as Ann in one browser and Bo in the other. Ann creates a 2-seat room and Bo joins. Ann's Start Game is enabled only once Bo is in. Ann starts.
2. Both boards appear, each from its own seat. Only the seat to act gets moves and a countdown. The other sees "thinking…" only for bot seats.
3. Bo closes his tab. After about 60 s, Ann sees Bo's seat played by a bot. Bo reopens `/rooms` and presses Rejoin. Ann sees "Bo is back", and Bo's board returns with his moves.
4. Play to the end, or let bots finish: both see the result card. Back to Lobby shows the lobby with the same members.
5. Play vs Bots as a guest. A game against bots starts at once. Close the tab, wait, and come back: the game resumes where it was. Play vs Bots again offers Resume Game and Abandon and Start New.
6. Stop the server mid-game and start it again. Rejoining shows the same board.
7. `/setup` and `/game` (local Play) behave exactly as before.

Report what you saw. Fix only what is broken, with a test, and commit.
