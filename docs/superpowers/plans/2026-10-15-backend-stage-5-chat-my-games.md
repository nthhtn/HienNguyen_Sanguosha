# Backend Stage 5: Chat and My Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members of an open room can chat in the lobby and on the online board, registered players can list their finished games on a read-only My Games screen, and a finished game can be fetched as a replay for debugging.

**Architecture:**

- `protocol` gains the chat and history wire types, the `chat.send` and `chat.message` messages, `welcome.chat`, and five error codes.
- A new `chat_messages` table and `ChatRepository` store every message with the `game_id` and `after_seq` it followed. The game repository gains two per-user queries over finished games.
- `ChatService` (validation, a per-member sliding rate window, storage) is used by `RoomService`, which runs `chat.send` on the room's queue like every other command, broadcasts the stored message, and puts the last 100 messages in `welcome`.
- `GameHistory` backs two HTTP routes, `GET /api/me/games` and `GET /api/games/:id/replay`. Both are for registered users only.
- On the Angular side, a component-scoped `ChatService` (beside `LobbyService`) keeps the messages. `ChatPanel` renders them, always open in the Lobby; `BoardChat` wraps it in a collapsible side panel with an unread badge on the board. The My Games page is a new route.

**Tech Stack:** Node 24, TypeScript ~6.0, Fastify 5, `ws` 8, @sinclair/typebox 0.34, Kysely 0.28 + pg 8, Postgres 17, Jest 30 + ts-jest, Angular 22 + Material.

**Spec:** `docs/superpowers/specs/2026-10-15-backend-stage-5-chat-my-games-design.md` (this stage's decisions), which refines `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`. The sections of the main spec that apply:

- "Database": `chat_messages`
- "Socket protocol": `chat.send`, `chat.message`, `welcome`
- "HTTP API": `GET /me/games`, `GET /games/:id/replay`
- "Angular changes"
- "Retention"
- "Stages", item 5

**Branch:** `feat/backend-stage-5-chat-my-games` (already created; the spec is committed on it).

## Global Constraints

- **Everything in the Stage 2, 3 and 4 Global Constraints still holds.** In particular:
  - the CommonJS-loadable dependency pins;
  - rows map to records only in `persistence/postgres/mappers.ts`;
  - only `server/src/views/` turns records into wire data;
  - user ids never reach a client. Chat messages are known by room player id (`from.playerId`).
- **The local screens stay as they are.** Never modify:
  - `projects/app/src/app/setup/setup.ts`
  - `projects/app/src/app/game-board/**`
  - `projects/app/src/app/game.service.ts`
  - `projects/app/src/app/decision-timer.service.ts`
  - `projects/app/src/app/play-redirect.ts`
- **Chat rules, verbatim from the spec:**
  - a message has 1 to 300 characters (`CHAT_BODY_MAX = 300`), counted in code points after normalizing;
  - at most 5 messages per 10 seconds per member (`CHAT_RATE_LIMIT = 5`, `CHAT_RATE_WINDOW_MS = 10_000`);
  - `welcome.chat` carries the last 100 messages (`CHAT_HISTORY = 100`), oldest first;
  - solo (Play vs Bots) rooms have no chat.
- **Replay rules:**
  - finished games only (`status = 'finished'`);
  - only a registered member of that game may read it;
  - the body is exactly `{ seed, seats, rules, buildId, actions, chat }`.
- **Out of scope** (do not touch): every item deferred from Stages 3 and 4. That is:
  - socket lifetime on session revoke;
  - the client's 401 retry;
  - the "Not found" text for a closed room;
  - the grace-period text;
  - `room_players` rows on close;
  - the lobby rate limit;
  - the membership queue;
  - restore retry;
  - shutdown refusal;
  - JSON target comparison;
  - solo eviction and the 7-day abort;
  - the Leave Game button;
  - the "Draw — No survivors." casing;
  - the manual two-browser check.
- **User-facing text, verbatim:**
  - titles and labels: "Chat", "My Games", "Message", "Send", "Back to Rooms", "Close Chat";
  - sentences: "No messages yet", "No finished games yet", "Loading games…", "Say something…";
  - error messages: see Task 1.
- **UI text** follows `CLAUDE.md`: Title Case for names and short labels, sentence case for anything that reads as a sentence, keywords keep their capitals, and ids are never shown.
- **Code style:**
  - Use bracket access on index signatures.
  - ts-jest only transpiles, so run `npm run typecheck:server` after every protocol or server task, and `npx ng build app` after every Angular task.
  - Run one test file with `npx jest --selectProjects <project> <path>`, where `<project>` is `protocol`, `server` or `app`.
- **Escapes:** where this plan writes `…`, write that character itself. Never write a `\u` escape in a source file (use `String.fromCharCode` or `String.fromCodePoint`, as the tests below do). Check every file you write with `grep -c '\\u' <file>`, which must print `0`.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Decisions This Plan Makes (the spec is silent, or the code's shape needs one)

1. **Chat state lives in a component-scoped `ChatService`, not in `SocketService`.** `SocketService` is transport only and `LobbyService` already holds the room's state, so chat follows the same pattern. The spec was updated to say so.
2. **`ChatService` is server-side too, and `RoomService` owns one.** The spec's `ChatService` has no socket knowledge. `RoomService` calls it from its command switch, so chat runs on the room's serial queue with no extra locking.
3. **Wire shapes.**
   - `ChatMessage` is `{ id: number, from: { playerId, name }, body, at }`, with `at` in epoch milliseconds, like every other server time on the wire.
   - `chat.message` is that object with `type: 'chat.message'` added, flat.
   - `GET /api/me/games` returns `{ games: GameSummary[] }`, an object like `RoomList`, so it can grow.
4. **Error codes.**

   | Code | Where | HTTP | Message |
   |---|---|---|---|
   | `chat_empty` | socket | 400 | Write a message first |
   | `chat_too_long` | socket | 400 | Messages can have at most 300 characters |
   | `chat_rate_limited` | socket | 429 | You are sending messages too fast. Wait a moment |
   | `chat_unavailable` | socket | 409 | There is no chat in this room |
   | `registered_only` | HTTP | 403 | Sign in with an account to see your games |

   A guest on either history route gets `403 registered_only`. A registered user asking for a replay that is unknown, someone else's, unfinished or aborted gets `404 not_found`, so nothing leaks.
5. **Chat counts as activity.** An accepted message resets the lobby idle timer, because people talking in a lobby are not idle.
6. **The rate window counts accepted messages only.** An empty or too-long message is refused before it is counted or stored.
7. **The board's chat panel sits beside `<app-online-game />` in `LobbyPage`.** The shared board is untouched. The toggle is a fixed button, hidden while the panel is open, and the panel has its own Close Chat button.
8. **The My Games link is a button on the Rooms page**, shown to registered players only, and the toolbar's Online item stays highlighted on `/my-games`.

## Review Focus

1. **Odd message bodies:** only whitespace, a newline in the middle, control characters, 300 emoji (600 UTF-16 units), 301 characters, and a body that is not a string. A reasonable person expects whitespace-only to be refused as empty, newlines to become spaces, exactly 300 characters to pass and 301 to be refused, and a non-string to be an `invalid_message`. Tests: Task 1, Task 3, Task 6.
2. **A burst of messages:** a sixth message inside 10 seconds is refused, refused and empty messages are neither stored nor counted, one member's burst never blocks another member, and the window frees after 10 seconds. Tests: Task 3, Task 6.
3. **Chat from someone who should not:** a stranger using a member's player id, a connection that has not said hello, and a member of a solo room. Each is refused and nothing is stored or broadcast. Tests: Task 4, Task 6.
4. **Asking for games that are not yours:** a guest, a registered user asking for another user's game, a running game (its seed is still secret), an aborted game, and a malformed id. None gets the seed or any data. Tests: Task 5.
5. **A reconnect in the middle of a chat:** `welcome` replaces the whole list (no duplicates, nothing lost), a message that arrives twice is shown once, and the history that arrives with the welcome is not counted as unread. Tests: Task 7, Task 8.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `projects/protocol/src/chat.ts` | `ChatMessage`, `normalizeChatBody`, `chatLength` |
| `projects/protocol/src/chat.spec.ts` | tests for both functions |
| `projects/protocol/src/history.ts` | `GameSummary`, `MyGames`, `GameReplay` and their parts |
| `projects/server/src/persistence/migrations/0004_chat.ts` | the `chat_messages` table |
| `projects/server/src/views/chat.ts` | `ChatMessageRecord` → `ChatMessage` |
| `projects/server/src/views/history.ts` | records → `GameSummary` and `GameReplay` |
| `projects/server/src/rooms/chatService.ts` | validation, the rate window, storage |
| `projects/server/src/rooms/chatService.spec.ts` | its tests |
| `projects/server/src/rooms/roomChat.spec.ts` | chat through `RoomService` |
| `projects/server/src/game/history.ts` | `GameHistory`: My Games and replay |
| `projects/server/src/http/gameRoutes.ts` | the two history routes |
| `projects/server/src/http/gameRoutes.spec.ts` | their tests |
| `projects/server/src/socket/chatSocket.spec.ts` | chat over a real socket |
| `projects/app/src/app/online/chat.service.ts` | the Lobby's chat state |
| `projects/app/src/app/online/chat-panel.ts` | messages and the input |
| `projects/app/src/app/online/board-chat.ts` | the board's collapsible side panel |
| `projects/app/src/app/online/game-labels.ts` | My Games result and player labels |
| `projects/app/src/app/online/my-games.service.ts` | `GET /api/me/games` |
| `projects/app/src/app/online/my-games-page.ts` | the My Games screen |
| `*.spec.ts` beside each of the six Angular files above | their tests |

**Modified:**

| File | Change |
|---|---|
| `projects/protocol/src/{limits,errors,socket,public-api}.ts`, `schemas/{socket,game}.ts` | constants, codes, messages, schemas |
| `projects/server/src/persistence/{records,repositories,migrate}.ts`, `postgres/{schema,mappers,postgresRepositories}.ts`, `memory/memoryRepositories.ts`, `repositoryContract.ts` | the chat store and per-user game queries |
| `projects/server/src/rooms/{errors,roomService,roomService.spec}.ts` | chat command, welcome history |
| `projects/server/src/http/{app,errors,guard,roomRoutes}.ts` and the four specs that call `buildApp` | history routes and wiring |
| `projects/server/src/server.ts` | builds `GameHistory` |
| `projects/app/src/app/online/{lobby-page,lobby-page.spec,rooms-page,rooms-page.spec,testing}.ts`, `app/app.routes.ts`, `app/app.ts`, `app/app.spec.ts` | chat in the Lobby and on the board, the My Games link and route |

---

### Task 1: Protocol: chat, history and error codes

**Files:**
- Modify: `projects/protocol/src/limits.ts`
- Create: `projects/protocol/src/chat.ts`
- Create: `projects/protocol/src/history.ts`
- Modify: `projects/protocol/src/errors.ts`
- Modify: `projects/protocol/src/public-api.ts`
- Test: `projects/protocol/src/chat.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (every later task uses these):
  - `CHAT_BODY_MAX`, `CHAT_RATE_LIMIT`, `CHAT_RATE_WINDOW_MS`, `CHAT_HISTORY` (limits).
  - `ChatMessage { id: number; from: { playerId: string; name: string }; body: string; at: number }`.
  - `normalizeChatBody(raw: string): string` (NFC, whitespace and control characters collapse to one space, trimmed; `''` when nothing is left).
  - `chatLength(body: string): number` (code points).
  - `GameSummaryPlayer { seatId; name; kind: MemberKind }`.
  - `GameSummary { gameId; finishedAt: number; players: GameSummaryPlayer[]; result: GameResult | null; yourSeat: string }`.
  - `MyGames { games: GameSummary[] }`.
  - `ReplaySeat { seatId; roomPlayerId; name; kind }`.
  - `ReplayAction { seq; seatId; source: ActionSource; action: Action; stateHash }`.
  - `GameReplay { seed: number; seats: ReplaySeat[]; rules: GameRules; buildId: string; actions: ReplayAction[]; chat: ChatMessage[] }`.
  - `ErrorCode` gains `chat_empty | chat_too_long | chat_rate_limited | chat_unavailable | registered_only`, each with an `ERROR_MESSAGES` entry.

- [ ] **Step 1: Write the failing test**

Create `projects/protocol/src/chat.spec.ts`:

```ts
import { chatLength, normalizeChatBody } from './chat';

const BELL = String.fromCharCode(7);
const GRINNING = String.fromCodePoint(0x1f600);
const COMBINING_ACUTE = String.fromCharCode(0x301);
const E_ACUTE = String.fromCharCode(0xe9);

describe('normalizeChatBody', () => {
  it('trims and turns every run of whitespace, newlines included, into one space', () => {
    expect(normalizeChatBody('  hello \n\n  there\t friend  ')).toBe('hello there friend');
  });

  it('turns control characters into spaces', () => {
    expect(normalizeChatBody(`a${BELL}b`)).toBe('a b');
  });

  it('composes accents (NFC)', () => {
    expect(normalizeChatBody(`e${COMBINING_ACUTE}`)).toBe(E_ACUTE);
  });

  it('is empty when only whitespace and control characters are left', () => {
    expect(normalizeChatBody(` \n\t${BELL} `)).toBe('');
  });
});

describe('chatLength', () => {
  it('counts characters, not UTF-16 units', () => {
    expect(chatLength('abc')).toBe(3);
    expect(chatLength(GRINNING.repeat(3))).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest --selectProjects protocol projects/protocol/src/chat.spec.ts`
Expected: FAIL with "Cannot find module './chat'".

- [ ] **Step 3: Add the limits**

Append to `projects/protocol/src/limits.ts`:

```ts
// The longest chat message, in characters (code points), after normalizing.
export const CHAT_BODY_MAX = 300;
// A member may send at most CHAT_RATE_LIMIT messages in any CHAT_RATE_WINDOW_MS.
export const CHAT_RATE_LIMIT = 5;
export const CHAT_RATE_WINDOW_MS = 10_000;
// How many recent messages a welcome carries.
export const CHAT_HISTORY = 100;
```

- [ ] **Step 4: Write `chat.ts`**

Create `projects/protocol/src/chat.ts`:

```ts
// One chat message as every member of the room sees it. `from.playerId` is the
// room player id (the same id `RoomMemberView.playerId` uses), never a user id.
export interface ChatMessage {
  id: number;
  from: { playerId: string; name: string };
  body: string;
  // When the server stored it, in epoch milliseconds.
  at: number;
}

// A message as stored and shown: NFC, every run of whitespace or control
// characters collapsed to one space, trimmed. Empty when nothing is left.
export function normalizeChatBody(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[\p{Cc}\s]+/gu, ' ')
    .trim();
}

// How many characters a message has: code points, so an emoji counts once.
export function chatLength(body: string): number {
  return [...body].length;
}
```

- [ ] **Step 5: Write `history.ts`**

Create `projects/protocol/src/history.ts`:

```ts
import type { Action, GameResult, GameRules } from 'engine';
import type { ChatMessage } from './chat';
import type { ActionSource } from './game';
import type { MemberKind } from './rooms';

export interface GameSummaryPlayer {
  seatId: string;
  name: string;
  kind: MemberKind;
}

// One row of My Games: a finished game you played in.
export interface GameSummary {
  gameId: string;
  // When the game ended, in epoch milliseconds.
  finishedAt: number;
  players: GameSummaryPlayer[];
  result: GameResult | null;
  // The seat you played.
  yourSeat: string;
}

// GET /api/me/games: your finished games, newest first.
export interface MyGames {
  games: GameSummary[];
}

export interface ReplaySeat {
  seatId: string;
  roomPlayerId: string;
  name: string;
  kind: MemberKind;
}

export interface ReplayAction {
  seq: number;
  seatId: string;
  source: ActionSource;
  action: Action;
  stateHash: string;
}

// GET /api/games/:id/replay: enough to rebuild a finished game exactly. The
// seed is safe to reveal because the game is over.
export interface GameReplay {
  seed: number;
  seats: ReplaySeat[];
  rules: GameRules;
  buildId: string;
  actions: ReplayAction[];
  // Only the messages sent while this game ran.
  chat: ChatMessage[];
}
```

- [ ] **Step 6: Add the error codes and messages**

In `projects/protocol/src/errors.ts`, change the import line to

```ts
import { CHAT_BODY_MAX, DISPLAY_NAME_MAX, PASSWORD_MIN } from './limits';
```

add to the `ErrorCode` union after `| 'solo_exists'` (keeping the semicolon on the last member):

```ts
  | 'solo_exists'
  | 'chat_empty'
  | 'chat_too_long'
  | 'chat_rate_limited'
  | 'chat_unavailable'
  | 'registered_only';
```

and add to `ERROR_MESSAGES` after the `solo_exists` line:

```ts
  chat_empty: 'Write a message first',
  chat_too_long: `Messages can have at most ${CHAT_BODY_MAX} characters`,
  chat_rate_limited: 'You are sending messages too fast. Wait a moment',
  chat_unavailable: 'There is no chat in this room',
  registered_only: 'Sign in with an account to see your games',
```

- [ ] **Step 7: Export the new modules**

Append to `projects/protocol/src/public-api.ts`:

```ts
export * from './chat';
export * from './history';
```

- [ ] **Step 8: Run the tests and the typecheck**

Run: `npx jest --selectProjects protocol` then `npm run typecheck:server`
Expected: PASS, and no type errors.

- [ ] **Step 9: Commit**

```bash
git add projects/protocol/src
git commit -m "feat(protocol): chat and game history wire types

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Persistence: chat messages and per-user finished games

**Files:**
- Create: `projects/server/src/persistence/migrations/0004_chat.ts`
- Modify: `projects/server/src/persistence/migrate.ts`
- Modify: `projects/server/src/persistence/records.ts`
- Modify: `projects/server/src/persistence/repositories.ts`
- Modify: `projects/server/src/persistence/postgres/schema.ts`
- Modify: `projects/server/src/persistence/postgres/mappers.ts`
- Modify: `projects/server/src/persistence/postgres/postgresRepositories.ts`
- Modify: `projects/server/src/persistence/memory/memoryRepositories.ts`
- Test: `projects/server/src/persistence/repositoryContract.ts` (runs against memory always, and Postgres with `TEST_DATABASE_URL`)

**Interfaces:**
- Consumes: nothing from earlier tasks (the store has no protocol dependency).
- Produces:
  - `ChatMessageRecord { id: number; roomId: string; gameId: string | null; afterSeq: number | null; roomPlayerId: string; name: string; body: string; createdAt: Date }` (`name` is the member's `display_name`).
  - `UserGameRecord { game: GameRecord; yourSeatId: string }`.
  - `NewChatMessage { roomId; gameId: string | null; afterSeq: number | null; roomPlayerId: string; body: string; now: Date }`.
  - `ChatRepository`:
    - `add(input: NewChatMessage): Promise<ChatMessageRecord>`
    - `listRecent(roomId: string, limit: number): Promise<ChatMessageRecord[]>` (the last `limit`, oldest first)
    - `listForGame(gameId: string): Promise<ChatMessageRecord[]>` (oldest first)
  - `Repositories.chat: ChatRepository`.
  - `GameRepository.listFinishedForUser(userId: string): Promise<UserGameRecord[]>` (newest finish first, ties by id).
  - `GameRepository.findFinishedForUser(userId: string, gameId: string): Promise<UserGameRecord | null>`.

- [ ] **Step 1: Write the failing contract tests**

In `projects/server/src/persistence/repositoryContract.ts`, add these two blocks at the end of `describeRepositoryContract`, just before the final closing `}` of the function (after the `describe('games', …)` block):

```ts
  describe('chat', () => {
    const newRoom = async () => {
      const room = await repos().rooms.create({ visibility: 'open', seatCount: 4, rules: {}, now: NOW });
      const ann = await repos().rooms.addPlayer({ roomId: room.id, userId: null, kind: 'human', displayName: 'Ann', now: NOW });
      const bo = await repos().rooms.addPlayer({ roomId: room.id, userId: null, kind: 'human', displayName: 'Bo', now: NOW });
      return { room, ann, bo };
    };
    const say = (roomId: string, roomPlayerId: string, body: string, extra: { gameId?: string; afterSeq?: number } = {}) =>
      repos().chat.add({ roomId, gameId: extra.gameId ?? null, afterSeq: extra.afterSeq ?? null, roomPlayerId, body, now: NOW });

    it('stores a message with the sender name and the game it followed', async () => {
      const { room, ann } = await newRoom();
      const game = await repos().games.create({ roomId: room.id, seed: 1, seats: [], rules: {}, buildId: 'build-1', now: NOW });
      const lobby = await say(room.id, ann.id, 'hello');
      const inGame = await say(room.id, ann.id, 'gg', { gameId: game.id, afterSeq: 3 });
      expect(lobby).toEqual({ id: expect.any(Number), roomId: room.id, gameId: null, afterSeq: null, roomPlayerId: ann.id, name: 'Ann', body: 'hello', createdAt: NOW });
      expect(inGame).toMatchObject({ gameId: game.id, afterSeq: 3, body: 'gg' });
      expect(inGame.id).toBeGreaterThan(lobby.id);
    });

    it("lists a room's last messages, oldest first, and no other room's", async () => {
      const { room, ann, bo } = await newRoom();
      const other = await newRoom();
      for (const [i, body] of ['m1', 'm2', 'm3', 'm4', 'm5'].entries()) await say(room.id, i % 2 === 0 ? ann.id : bo.id, body);
      await say(other.room.id, other.ann.id, 'elsewhere');
      expect((await repos().chat.listRecent(room.id, 3)).map((m) => [m.body, m.name])).toEqual([
        ['m3', 'Ann'],
        ['m4', 'Bo'],
        ['m5', 'Ann'],
      ]);
      expect(await repos().chat.listRecent(room.id, 100)).toHaveLength(5);
    });

    it("lists one game's messages only, oldest first", async () => {
      const { room, ann } = await newRoom();
      const first = await repos().games.create({ roomId: room.id, seed: 1, seats: [], rules: {}, buildId: 'build-1', now: NOW });
      await say(room.id, ann.id, 'lobby before');
      await say(room.id, ann.id, 'one', { gameId: first.id, afterSeq: 0 });
      await say(room.id, ann.id, 'two', { gameId: first.id, afterSeq: 5 });
      await repos().games.update(first.id, { status: 'finished', finishedAt: minutes(1) });
      const second = await repos().games.create({ roomId: room.id, seed: 2, seats: [], rules: {}, buildId: 'build-1', now: minutes(2) });
      await say(room.id, ann.id, 'other game', { gameId: second.id, afterSeq: 0 });
      expect((await repos().chat.listForGame(first.id)).map((m) => m.body)).toEqual(['one', 'two']);
    });

    it('refuses a message from someone who is not a member', async () => {
      const { room } = await newRoom();
      await expect(say(room.id, randomUUID(), 'hello')).rejects.toThrow();
    });
  });

  describe('finished games of a user', () => {
    const RESULT = { endedAt: 9, winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0'] };
    // A two-seat game in which the user sits on seat-1 (not the first seat, so
    // the seat can't be found by position).
    const play = async (userId: string | null, status: 'running' | 'finished' | 'aborted', finishedAt: Date | null) => {
      const room = await repos().rooms.create({ visibility: 'open', seatCount: 2, rules: {}, now: NOW });
      const person = await repos().rooms.addPlayer({ roomId: room.id, userId, kind: 'human', displayName: 'Ann', now: NOW });
      const bot = await repos().rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: NOW });
      const seats: GameSeat[] = [
        { seatId: 'seat-0', roomPlayerId: bot.id, name: 'Bot 1', kind: 'bot' },
        { seatId: 'seat-1', roomPlayerId: person.id, name: 'Ann', kind: 'human' },
      ];
      const game = await repos().games.create({ roomId: room.id, seed: 1, seats, rules: {}, buildId: 'build-1', now: NOW });
      if (status !== 'running') await repos().games.update(game.id, { status, result: status === 'finished' ? RESULT : null, finishedAt });
      return game;
    };

    it('lists the finished games the user sat in, newest first, with their own seat', async () => {
      const user = await registered();
      const other = await registered();
      const older = await play(user.id, 'finished', minutes(1));
      const newer = await play(user.id, 'finished', minutes(5));
      await play(other.id, 'finished', minutes(9));
      const list = await repos().games.listFinishedForUser(user.id);
      expect(list.map((entry) => entry.game.id)).toEqual([newer.id, older.id]);
      expect(list.map((entry) => entry.yourSeatId)).toEqual(['seat-1', 'seat-1']);
      expect(list[0].game).toEqual((await repos().games.findById(newer.id))!);
    });

    it('leaves out running and aborted games, and games of a deleted or unknown user', async () => {
      const user = await registered();
      await play(user.id, 'running', null);
      await play(user.id, 'aborted', minutes(2));
      await play(null, 'finished', minutes(3));
      expect(await repos().games.listFinishedForUser(user.id)).toEqual([]);
      expect(await repos().games.listFinishedForUser(randomUUID())).toEqual([]);
    });

    it("finds one finished game of the user, and null for someone else's, an unfinished or an unknown one", async () => {
      const user = await registered();
      const other = await registered();
      const mine = await play(user.id, 'finished', minutes(1));
      const running = await play(user.id, 'running', null);
      const aborted = await play(user.id, 'aborted', minutes(2));
      expect(await repos().games.findFinishedForUser(user.id, mine.id)).toEqual({ game: (await repos().games.findById(mine.id))!, yourSeatId: 'seat-1' });
      expect(await repos().games.findFinishedForUser(other.id, mine.id)).toBeNull();
      expect(await repos().games.findFinishedForUser(user.id, running.id)).toBeNull();
      expect(await repos().games.findFinishedForUser(user.id, aborted.id)).toBeNull();
      expect(await repos().games.findFinishedForUser(user.id, randomUUID())).toBeNull();
    });
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects server projects/server/src/persistence/memory`
Expected: FAIL (the type check reports that `repos().chat` and `listFinishedForUser` don't exist).

- [ ] **Step 3: Add the records**

Append to `projects/server/src/persistence/records.ts`:

```ts
// A chat message with the name its sender had in the room.
export interface ChatMessageRecord {
  id: number;
  roomId: string;
  // The game that was running when it was sent, and how many actions it had
  // then; both null in a lobby.
  gameId: string | null;
  afterSeq: number | null;
  roomPlayerId: string;
  name: string;
  body: string;
  createdAt: Date;
}

// A finished game and the seat a user played in it.
export interface UserGameRecord {
  game: GameRecord;
  yourSeatId: string;
}
```

- [ ] **Step 4: Add the repository interfaces**

In `projects/server/src/persistence/repositories.ts`:

1. Change the records import to
   ```ts
   import { ChatMessageRecord, GameActionRecord, GameRecord, GameSeat, ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserGameRecord, UserRecord } from './records';
   ```
2. Add to `GameRepository`, after `listActions`:
   ```ts
     // The finished games the user sat in, newest finish first (ties by id).
     listFinishedForUser(userId: string): Promise<UserGameRecord[]>;
     // One finished game the user sat in; null for anyone else's, an unfinished or an unknown one.
     findFinishedForUser(userId: string, gameId: string): Promise<UserGameRecord | null>;
   ```
3. Add before `Repositories`:
   ```ts
   export interface NewChatMessage {
     roomId: string;
     gameId: string | null;
     afterSeq: number | null;
     roomPlayerId: string;
     body: string;
     now: Date;
   }

   export interface ChatRepository {
     // Throws when `roomPlayerId` is not a member of any room.
     add(input: NewChatMessage): Promise<ChatMessageRecord>;
     // The room's last `limit` messages, oldest first.
     listRecent(roomId: string, limit: number): Promise<ChatMessageRecord[]>;
     // The messages sent while a game ran, oldest first.
     listForGame(gameId: string): Promise<ChatMessageRecord[]>;
   }
   ```
4. Add `chat: ChatRepository;` to `Repositories`, after `games: GameRepository;`.

- [ ] **Step 5: Write the migration and register it**

Create `projects/server/src/persistence/migrations/0004_chat.ts`:

```ts
import { Kysely, sql } from 'kysely';

// Room chat (spec "Database"). A message names the room member who sent it and,
// while a game runs, the game and how many actions it had.
const UP = [
  `CREATE TABLE chat_messages (
    id bigserial PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    game_id uuid REFERENCES games (id) ON DELETE CASCADE,
    after_seq int CHECK (after_seq >= 0),
    room_player_id uuid NOT NULL REFERENCES room_players (id),
    body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 300),
    created_at timestamptz NOT NULL
  )`,
  `CREATE INDEX chat_messages_room_id ON chat_messages (room_id, id)`,
  `CREATE INDEX chat_messages_game_id ON chat_messages (game_id, id) WHERE game_id IS NOT NULL`,
];

const DOWN = [`DROP TABLE chat_messages`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
```

In `projects/server/src/persistence/migrate.ts` add `import * as chat from './migrations/0004_chat';` after the `games` import, and `'0004_chat': chat,` after `'0003_games': games,`.

- [ ] **Step 6: Add the Postgres row type and mappers**

In `projects/server/src/persistence/postgres/schema.ts`, add before `Database`:

```ts
export interface ChatMessagesTable {
  // bigserial: read back as a string.
  id: Generated<string>;
  room_id: string;
  game_id: string | null;
  after_seq: number | null;
  room_player_id: string;
  body: string;
  created_at: Timestamp;
}
```

and add `chat_messages: ChatMessagesTable;` to `Database`.

In `projects/server/src/persistence/postgres/mappers.ts`:

1. Change the two imports to include the new names:
   ```ts
   import { ChatMessageRecord, GameActionRecord, GameRecord, ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserGameRecord, UserRecord } from '../records';
   import { ChatMessagesTable, GameActionsTable, GamesTable, PasswordResetTokensTable, RoomPlayersTable, RoomsTable, SessionsTable, UsersTable } from './schema';
   ```
2. Append:
   ```ts
   export function toChatMessageRecord(row: Selectable<ChatMessagesTable> & { name: string }): ChatMessageRecord {
     return {
       id: Number(row.id),
       roomId: row.room_id,
       gameId: row.game_id,
       afterSeq: row.after_seq,
       roomPlayerId: row.room_player_id,
       name: row.name,
       body: row.body,
       createdAt: row.created_at,
     };
   }

   // A games row plus the seat found for the user by the query that read it.
   export function toUserGameRecord(row: Selectable<GamesTable> & { your_seat_id: string }): UserGameRecord {
     return { game: toGameRecord(row), yourSeatId: row.your_seat_id };
   }
   ```

- [ ] **Step 7: Implement the Postgres repositories**

In `projects/server/src/persistence/postgres/postgresRepositories.ts`:

1. Change the first import to `import { Kysely, Selectable, sql } from 'kysely';`.
2. Add `ChatMessageRecord`, `UserGameRecord` to the records import, `ChatRepository`, `NewChatMessage` to the repositories import, `toChatMessageRecord`, `toUserGameRecord` to the mappers import, and `GamesTable` to the schema import: `import { Database, GamesTable } from './schema';`.
3. Add `chat: new PostgresChat(db),` to the object `createPostgresRepositories` returns, after `games: new PostgresGames(db),`.
4. Add these two methods to `PostgresGames`, after `listActions`:
   ```ts
     async listFinishedForUser(userId: string): Promise<UserGameRecord[]> {
       const { rows } = await sql<Selectable<GamesTable> & { your_seat_id: string }>`
         SELECT g.*, s.seat ->> 'seatId' AS your_seat_id
         FROM games g
         JOIN room_players rp ON rp.room_id = g.room_id AND rp.user_id = ${userId}::uuid
         CROSS JOIN LATERAL jsonb_array_elements(g.seats) AS s(seat)
         WHERE g.status = 'finished' AND s.seat ->> 'roomPlayerId' = rp.id::text
         ORDER BY g.finished_at DESC, g.id
       `.execute(this.db);
       return rows.map(toUserGameRecord);
     }

     async findFinishedForUser(userId: string, gameId: string): Promise<UserGameRecord | null> {
       const { rows } = await sql<Selectable<GamesTable> & { your_seat_id: string }>`
         SELECT g.*, s.seat ->> 'seatId' AS your_seat_id
         FROM games g
         JOIN room_players rp ON rp.room_id = g.room_id AND rp.user_id = ${userId}::uuid
         CROSS JOIN LATERAL jsonb_array_elements(g.seats) AS s(seat)
         WHERE g.status = 'finished' AND g.id = ${gameId}::uuid AND s.seat ->> 'roomPlayerId' = rp.id::text
       `.execute(this.db);
       return rows[0] ? toUserGameRecord(rows[0]) : null;
     }
   ```
5. Append the chat class at the end of the file:
   ```ts
   class PostgresChat implements ChatRepository {
     constructor(private readonly db: Kysely<Database>) {}

     async add(input: NewChatMessage): Promise<ChatMessageRecord> {
       const { id } = await this.db
         .insertInto('chat_messages')
         .values({ room_id: input.roomId, game_id: input.gameId, after_seq: input.afterSeq, room_player_id: input.roomPlayerId, body: input.body, created_at: input.now })
         .returning('id')
         .executeTakeFirstOrThrow();
       return toChatMessageRecord(await this.withName().where('chat_messages.id', '=', id).executeTakeFirstOrThrow());
     }

     async listRecent(roomId: string, limit: number): Promise<ChatMessageRecord[]> {
       const rows = await this.withName().where('chat_messages.room_id', '=', roomId).orderBy('chat_messages.id', 'desc').limit(limit).execute();
       return rows.reverse().map(toChatMessageRecord);
     }

     async listForGame(gameId: string): Promise<ChatMessageRecord[]> {
       const rows = await this.withName().where('chat_messages.game_id', '=', gameId).orderBy('chat_messages.id').execute();
       return rows.map(toChatMessageRecord);
     }

     // A message row with the sender's name from room_players.
     private withName() {
       return this.db
         .selectFrom('chat_messages')
         .innerJoin('room_players', 'room_players.id', 'chat_messages.room_player_id')
         .selectAll('chat_messages')
         .select('room_players.display_name as name');
     }
   }
   ```

- [ ] **Step 8: Implement the in-memory repositories**

In `projects/server/src/persistence/memory/memoryRepositories.ts`:

1. Add `ChatMessageRecord`, `UserGameRecord` to the records import; `ChatRepository`, `NewChatMessage` to the repositories import.
2. Add `chatMessages: Map<string, ChatMessageRecord>;` to `Store`, and `'chatMessages'` to the end of `TABLES`.
3. In `createMemoryRepositories`, add `chatMessages: new Map()` to the object. In `repositoriesOver`, add `chat: new MemoryChat(store),` after `games`. In `cloneStore`, add `chatMessages: cloneMap(store.chatMessages),`.
4. Add to `MemoryGames`, after `listActions`:
   ```ts
     async listFinishedForUser(userId: string): Promise<UserGameRecord[]> {
       return [...this.store.games.values()]
         .filter((game) => game.status === 'finished')
         .flatMap((game) => {
           const seat = game.seats.find((s) => this.store.roomPlayers.get(s.roomPlayerId)?.userId === userId);
           return seat ? [{ game: deepCopy(game), yourSeatId: seat.seatId }] : [];
         })
         .sort((a, b) => (b.game.finishedAt?.getTime() ?? 0) - (a.game.finishedAt?.getTime() ?? 0) || a.game.id.localeCompare(b.game.id));
     }

     async findFinishedForUser(userId: string, gameId: string): Promise<UserGameRecord | null> {
       return (await this.listFinishedForUser(userId)).find((entry) => entry.game.id === gameId) ?? null;
     }
   ```
5. Append the chat class:
   ```ts
   class MemoryChat implements ChatRepository {
     constructor(private readonly store: Store) {}

     async add(input: NewChatMessage): Promise<ChatMessageRecord> {
       const player = this.store.roomPlayers.get(input.roomPlayerId);
       if (!player) throw new Error(`No room player ${input.roomPlayerId}`);
       const id = [...this.store.chatMessages.values()].reduce((max, m) => Math.max(max, m.id), 0) + 1;
       const record: ChatMessageRecord = {
         id,
         roomId: input.roomId,
         gameId: input.gameId,
         afterSeq: input.afterSeq,
         roomPlayerId: input.roomPlayerId,
         name: player.displayName,
         body: input.body,
         createdAt: input.now,
       };
       this.store.chatMessages.set(String(id), record);
       return { ...record };
     }

     async listRecent(roomId: string, limit: number): Promise<ChatMessageRecord[]> {
       return [...this.store.chatMessages.values()]
         .filter((m) => m.roomId === roomId)
         .sort((a, b) => a.id - b.id)
         .slice(-limit)
         .map((m) => ({ ...m }));
     }

     async listForGame(gameId: string): Promise<ChatMessageRecord[]> {
       return [...this.store.chatMessages.values()]
         .filter((m) => m.gameId === gameId)
         .sort((a, b) => a.id - b.id)
         .map((m) => ({ ...m }));
     }
   }
   ```

- [ ] **Step 9: Run the tests, the typecheck, and the Postgres contract**

Run: `npx jest --selectProjects server projects/server/src/persistence/memory` then `npm run typecheck:server`
Expected: PASS and no type errors.

Then, with the database up (`npm run db:up`): `npm run test:db`
Expected: the Postgres contract passes too (including `chat` and `finished games of a user`). If Docker is not available, say so in the report and do not claim the Postgres run.

- [ ] **Step 10: Commit**

```bash
git add projects/server/src/persistence
git commit -m "feat(server): chat messages and per-user finished games in the store

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: ChatService: validation, the rate window and storage

**Files:**
- Create: `projects/server/src/views/chat.ts`
- Modify: `projects/server/src/rooms/errors.ts`
- Modify: `projects/server/src/http/errors.ts` (the status of each new code)
- Create: `projects/server/src/rooms/chatService.ts`
- Test: `projects/server/src/rooms/chatService.spec.ts`

**Interfaces:**
- Consumes: Task 1 (`ChatMessage`, `normalizeChatBody`, `chatLength`, the limits, the error codes) and Task 2 (`Repositories.chat`, `ChatMessageRecord`).
- Produces:
  - `RoomErrorCode` now includes `chat_empty | chat_too_long | chat_rate_limited | chat_unavailable`.
  - `toChatMessage(record: ChatMessageRecord): ChatMessage` in `views/chat.ts`.
  - ```ts
    interface ChatSender { roomId: string; playerId: string; gameId: string | null; afterSeq: number | null }
    class ChatService {
      constructor(repos: Repositories, now: () => number);
      send(sender: ChatSender, raw: string): Promise<ChatMessage>;   // throws RoomError chat_empty | chat_too_long | chat_rate_limited
      recent(roomId: string): Promise<ChatMessage[]>;                // the last CHAT_HISTORY, oldest first
      forget(playerIds: readonly string[]): void;                    // drops their rate windows
    }
    ```

- [ ] **Step 1: Write the failing tests**

Create `projects/server/src/rooms/chatService.spec.ts`:

```ts
import { CHAT_BODY_MAX, CHAT_HISTORY, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS } from 'protocol';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { ChatService } from './chatService';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const GRINNING = String.fromCodePoint(0x1f600);
const code = (value: string) => expect.objectContaining({ code: value });

async function setup() {
  const repos = createMemoryRepositories();
  let now = T0;
  const chat = new ChatService(repos, () => now);
  const room = await repos.rooms.create({ visibility: 'open', seatCount: 4, rules: {}, now: new Date(now) });
  const member = (name: string) => repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'human', displayName: name, now: new Date(now) });
  const ann = await member('Ann');
  const bo = await member('Bo');
  const as = (player: { id: string }, gameId: string | null = null, afterSeq: number | null = null) => ({ roomId: room.id, playerId: player.id, gameId, afterSeq });
  const advance = (ms: number) => {
    now += ms;
  };
  return { repos, chat, room, ann, bo, as, advance };
}

describe('ChatService', () => {
  it('stores a message and returns it as the wire shape, with the sender name and the time', async () => {
    const { chat, ann, as } = await setup();
    const message = await chat.send(as(ann), 'hello');
    expect(message).toEqual({ id: expect.any(Number), from: { playerId: ann.id, name: 'Ann' }, body: 'hello', at: T0 });
  });

  it('normalizes the body: trims, and turns newlines and runs of spaces into one space (Review Focus 1)', async () => {
    const { chat, ann, as } = await setup();
    expect((await chat.send(as(ann), '  hello \n\n  there  ')).body).toBe('hello there');
  });

  it('refuses a message with nothing in it (Review Focus 1)', async () => {
    const { chat, ann, as, repos, room } = await setup();
    await expect(chat.send(as(ann), '')).rejects.toEqual(code('chat_empty'));
    await expect(chat.send(as(ann), ' \n\t ')).rejects.toEqual(code('chat_empty'));
    expect(await repos.chat.listRecent(room.id, 10)).toEqual([]);
  });

  it('accepts exactly 300 characters and refuses 301, counting an emoji once (Review Focus 1)', async () => {
    const { chat, ann, bo, as, advance } = await setup();
    await expect(chat.send(as(ann), 'a'.repeat(CHAT_BODY_MAX))).resolves.toBeDefined();
    await expect(chat.send(as(ann), 'a'.repeat(CHAT_BODY_MAX + 1))).rejects.toEqual(code('chat_too_long'));
    advance(CHAT_RATE_WINDOW_MS);
    await expect(chat.send(as(bo), GRINNING.repeat(CHAT_BODY_MAX))).resolves.toBeDefined();
    await expect(chat.send(as(bo), GRINNING.repeat(CHAT_BODY_MAX + 1))).rejects.toEqual(code('chat_too_long'));
  });

  it('refuses the sixth message inside the window, and the window frees after it (Review Focus 2)', async () => {
    const { chat, ann, as, advance } = await setup();
    for (let i = 0; i < CHAT_RATE_LIMIT; i += 1) await chat.send(as(ann), `m${i}`);
    await expect(chat.send(as(ann), 'too many')).rejects.toEqual(code('chat_rate_limited'));
    advance(CHAT_RATE_WINDOW_MS - 1);
    await expect(chat.send(as(ann), 'still too many')).rejects.toEqual(code('chat_rate_limited'));
    advance(1);
    await expect(chat.send(as(ann), 'now fine')).resolves.toBeDefined();
  });

  it("limits each member on their own, and doesn't count or store refused messages (Review Focus 2)", async () => {
    const { chat, ann, bo, as, repos, room } = await setup();
    await expect(chat.send(as(ann), '')).rejects.toBeDefined();
    await expect(chat.send(as(ann), 'a'.repeat(CHAT_BODY_MAX + 1))).rejects.toBeDefined();
    for (let i = 0; i < CHAT_RATE_LIMIT; i += 1) await chat.send(as(ann), `m${i}`);
    await expect(chat.send(as(ann), 'one too many')).rejects.toEqual(code('chat_rate_limited'));
    await expect(chat.send(as(bo), 'my turn')).resolves.toBeDefined();
    expect((await repos.chat.listRecent(room.id, 100)).map((m) => m.body)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4', 'my turn']);
  });

  it('stores the game a message followed and how many actions it had', async () => {
    const { chat, ann, as, repos, room } = await setup();
    const game = await repos.games.create({ roomId: room.id, seed: 1, seats: [], rules: {}, buildId: 'b', now: new Date(T0) });
    await chat.send(as(ann), 'lobby');
    await chat.send(as(ann, game.id, 7), 'in game');
    const [lobby, inGame] = await repos.chat.listRecent(room.id, 10);
    expect([lobby.gameId, lobby.afterSeq]).toEqual([null, null]);
    expect([inGame.gameId, inGame.afterSeq]).toEqual([game.id, 7]);
  });

  it('returns the last 100 messages, oldest first', async () => {
    const { chat, ann, as, advance, room } = await setup();
    for (let i = 1; i <= CHAT_HISTORY + 5; i += 1) {
      await chat.send(as(ann), `m${i}`);
      advance(CHAT_RATE_WINDOW_MS + 1);
    }
    const recent = await chat.recent(room.id);
    expect(recent).toHaveLength(CHAT_HISTORY);
    expect(recent[0].body).toBe('m6');
    expect(recent.at(-1)!.body).toBe(`m${CHAT_HISTORY + 5}`);
  });

  it('forgets the rate window of members who left', async () => {
    const { chat, ann, as } = await setup();
    for (let i = 0; i < CHAT_RATE_LIMIT; i += 1) await chat.send(as(ann), `m${i}`);
    chat.forget([ann.id]);
    await expect(chat.send(as(ann), 'fresh start')).resolves.toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects server projects/server/src/rooms/chatService.spec.ts`
Expected: FAIL with "Cannot find module './chatService'".

- [ ] **Step 3: Add the room error codes**

In `projects/server/src/rooms/errors.ts`, add to the `Extract` union, after `| 'solo_exists'`:

```ts
  | 'solo_exists'
  | 'chat_empty'
  | 'chat_too_long'
  | 'chat_rate_limited'
  | 'chat_unavailable'
```

(keep the closing `>;` after the last member).

In `projects/server/src/http/errors.ts`, add to `ROOM_ERROR_STATUS` after `solo_exists: 409,`:

```ts
  chat_empty: 400,
  chat_too_long: 400,
  chat_rate_limited: 429,
  chat_unavailable: 409,
```

- [ ] **Step 4: Write the view**

Create `projects/server/src/views/chat.ts`:

```ts
import type { ChatMessage } from 'protocol';
import { ChatMessageRecord } from '../persistence/records';

// A stored message as every member sees it: the sender is a room player id, never a user id.
export function toChatMessage(record: ChatMessageRecord): ChatMessage {
  return { id: record.id, from: { playerId: record.roomPlayerId, name: record.name }, body: record.body, at: record.createdAt.getTime() };
}
```

- [ ] **Step 5: Write `ChatService`**

Create `projects/server/src/rooms/chatService.ts`:

```ts
import { CHAT_BODY_MAX, CHAT_HISTORY, CHAT_RATE_LIMIT, CHAT_RATE_WINDOW_MS, chatLength, normalizeChatBody } from 'protocol';
import type { ChatMessage } from 'protocol';
import { Repositories } from '../persistence/repositories';
import { toChatMessage } from '../views/chat';
import { RoomError } from './errors';

// Who is sending and what the room was doing: `gameId` and `afterSeq` are set
// while a game runs.
export interface ChatSender {
  roomId: string;
  // The sender's room player id.
  playerId: string;
  gameId: string | null;
  afterSeq: number | null;
}

// Validates, rate-limits and stores chat messages (spec "Socket protocol").
// It knows nothing of sockets. RoomService calls it on the room's queue, so
// one member's calls never interleave.
export class ChatService {
  // When each member's accepted messages were sent, newest last, within the window.
  private readonly sent = new Map<string, number[]>();

  constructor(
    private readonly repos: Repositories,
    private readonly now: () => number
  ) {}

  async send(sender: ChatSender, raw: string): Promise<ChatMessage> {
    const body = normalizeChatBody(raw);
    if (body === '') throw new RoomError('chat_empty');
    if (chatLength(body) > CHAT_BODY_MAX) throw new RoomError('chat_too_long');
    const now = this.now();
    const inWindow = (this.sent.get(sender.playerId) ?? []).filter((at) => now - at < CHAT_RATE_WINDOW_MS);
    if (inWindow.length >= CHAT_RATE_LIMIT) {
      this.sent.set(sender.playerId, inWindow);
      throw new RoomError('chat_rate_limited');
    }
    const record = await this.repos.chat.add({ roomId: sender.roomId, gameId: sender.gameId, afterSeq: sender.afterSeq, roomPlayerId: sender.playerId, body, now: new Date(now) });
    this.sent.set(sender.playerId, [...inWindow, now]);
    return toChatMessage(record);
  }

  // The room's last messages, oldest first.
  async recent(roomId: string): Promise<ChatMessage[]> {
    return (await this.repos.chat.listRecent(roomId, CHAT_HISTORY)).map(toChatMessage);
  }

  // Drops the rate windows of members who are gone.
  forget(playerIds: readonly string[]): void {
    for (const id of playerIds) this.sent.delete(id);
  }
}
```

- [ ] **Step 6: Run the tests and the typecheck**

Run: `npx jest --selectProjects server projects/server/src/rooms/chatService.spec.ts` then `npm run typecheck:server`
Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add projects/server/src
git commit -m "feat(server): ChatService with validation, rate window and storage

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Chat through RoomService: the command, the broadcast and the welcome history

**Files:**
- Modify: `projects/protocol/src/schemas/socket.ts`
- Modify: `projects/protocol/src/socket.ts`
- Modify: `projects/server/src/rooms/roomService.ts`
- Modify: `projects/server/src/rooms/roomService.spec.ts:180`
- Modify: `projects/app/src/app/online/testing.ts:27` (the `welcome()` fixture, so the app still compiles)
- Test: `projects/server/src/rooms/roomChat.spec.ts`

**Interfaces:**
- Consumes: Task 3's `ChatService` and error codes, Task 1's `ChatMessage`.
- Produces:
  - `ChatSendSchema` (`{ type: 'chat.send', reqId?, body: string }`, strict), part of `ClientMessageSchema`; `RoomCommand` now includes `{ type: 'chat.send'; body: string }`.
  - `WelcomeMessage.chat: ChatMessage[]`.
  - `ChatMessageMessage` = `ChatMessage & { type: 'chat.message' }` (flat), part of `ServerMessage`.
  - `RoomService.command(…, { type: 'chat.send', body })` stores, broadcasts `chat.message` to every connected member (the sender included), and counts as activity.
  - `welcome.chat` has the last 100 messages (always `[]` in a solo room).
  - A test fixture for Angular specs: `welcome(room, playerId, game, chat = [])` (Task 7 extends the same file).

- [ ] **Step 1: Write the failing tests**

Create `projects/server/src/rooms/roomChat.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { buildContentRegistry } from 'content';
import type { ChatMessage } from 'protocol';
import { ManualScheduler } from '../game/testing';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import { LOBBY_IDLE_MS, ROOM_TICK_MS, RoomService } from './roomService';
import { FakeConnection } from './testing';

const T0 = Date.parse('2026-10-15T12:00:00.000Z');
const registry = buildContentRegistry();
const code = (value: string) => expect.objectContaining({ code: value });

async function setup() {
  const repos = createMemoryRepositories();
  const scheduler = new ManualScheduler(T0);
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 }, now: scheduler.clock, logError: jest.fn(), registry, buildId: 'test-build', randomSeed: () => 1234, scheduler });
  const registered = (name: string) =>
    repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(scheduler.now) });
  const guest = (name: string) => repos.users.createGuest({ displayName: name, now: new Date(scheduler.now) });
  const connect = async (user: UserRecord, roomId: string) => {
    const connection = new FakeConnection();
    const playerId = await rooms.connect(user, roomId, connection);
    return { user, connection, playerId };
  };
  type Seat = Awaited<ReturnType<typeof connect>>;
  const say = (seat: Seat, roomId: string, body: string) => rooms.command(seat.user, roomId, seat.playerId, { type: 'chat.send', body });
  const chatsOf = (connection: FakeConnection): ChatMessage[] =>
    connection.sent.flatMap((m) => (m.type === 'chat.message' ? [{ id: m.id, from: m.from, body: m.body, at: m.at }] : []));
  // Ann (registered host) and Bo, in a two-seat room, with only Ann connected.
  const lobby = async () => {
    const annUser = await registered('Ann');
    const boUser = await registered('Bo');
    const roomId = await rooms.create(annUser, { seatCount: 2, rules: {}, displayName: 'Ann' });
    await rooms.join(boUser, roomId, 'Bo');
    return { annUser, boUser, roomId, a: await connect(annUser, roomId) };
  };
  return { repos, rooms, scheduler, registered, guest, connect, say, chatsOf, lobby };
}

describe('chat in a room', () => {
  it('sends a stored message to every connected member, the sender included', async () => {
    const { repos, say, chatsOf, connect, lobby } = await setup();
    const { boUser, roomId, a } = await lobby();
    const b = await connect(boUser, roomId);
    await say(a, roomId, '  hello   Bo ');
    const expected = [{ id: expect.any(Number), from: { playerId: a.playerId, name: 'Ann' }, body: 'hello Bo', at: T0 }];
    expect(chatsOf(a.connection)).toEqual(expected);
    expect(chatsOf(b.connection)).toEqual(expected);
    expect((await repos.chat.listRecent(roomId, 10)).map((m) => m.body)).toEqual(['hello Bo']);
  });

  it('gives a member who connects later the recent messages, oldest first, in the welcome', async () => {
    const { say, connect, lobby } = await setup();
    const { boUser, roomId, a } = await lobby();
    await say(a, roomId, 'one');
    await say(a, roomId, 'two');
    const b = await connect(boUser, roomId);
    expect(b.connection.last('welcome')!.chat.map((m) => m.body)).toEqual(['one', 'two']);
  });

  it('refuses a stranger who uses a member player id, and stores and sends nothing (Review Focus 3)', async () => {
    const { rooms, registered, repos, chatsOf, lobby } = await setup();
    const { roomId, a } = await lobby();
    const stranger = await registered('Eve');
    await expect(rooms.command(stranger, roomId, a.playerId, { type: 'chat.send', body: 'hi' })).rejects.toEqual(code('not_member'));
    expect(await repos.chat.listRecent(roomId, 10)).toEqual([]);
    expect(chatsOf(a.connection)).toEqual([]);
  });

  it('refuses a message once the sender has left the room (Review Focus 3)', async () => {
    const { rooms, say, connect, lobby } = await setup();
    const { boUser, roomId, a } = await lobby();
    const b = await connect(boUser, roomId);
    await rooms.command(b.user, roomId, b.playerId, { type: 'room.leave' });
    await expect(say(b, roomId, 'still here?')).rejects.toEqual(code('not_member'));
    await expect(say(a, roomId, 'now alone')).resolves.toBeUndefined();
  });

  it('has no chat in a solo room: refused, and an empty history in the welcome (Review Focus 3)', async () => {
    const { rooms, guest, connect, say } = await setup();
    const gus = await guest('Gus');
    const roomId = await rooms.createSolo(gus, { seatCount: 3, rules: {} });
    const g = await connect(gus, roomId);
    expect(g.connection.last('welcome')!.chat).toEqual([]);
    await expect(say(g, roomId, 'anyone?')).rejects.toEqual(code('chat_unavailable'));
  });

  it('refuses the empty, the over-long and the too-fast with their codes (Review Focus 1 and 2)', async () => {
    const { say, lobby } = await setup();
    const { roomId, a } = await lobby();
    await expect(say(a, roomId, '   ')).rejects.toEqual(code('chat_empty'));
    await expect(say(a, roomId, 'x'.repeat(301))).rejects.toEqual(code('chat_too_long'));
    for (let i = 0; i < 5; i += 1) await say(a, roomId, `m${i}`);
    await expect(say(a, roomId, 'sixth')).rejects.toEqual(code('chat_rate_limited'));
  });

  it("records the game and the action count a message followed", async () => {
    const { rooms, repos, say, connect, lobby } = await setup();
    const { boUser, roomId, a } = await lobby();
    await connect(boUser, roomId);
    await say(a, roomId, 'before');
    await rooms.command(a.user, roomId, a.playerId, { type: 'lobby.start' });
    const game = (await repos.games.listRunning())[0];
    await say(a, roomId, 'during');
    const [before, during] = await repos.chat.listRecent(roomId, 10);
    expect([before.gameId, before.afterSeq]).toEqual([null, null]);
    expect([during.gameId, during.afterSeq]).toEqual([game.id, 0]);
  });

  it('counts as activity, so a lobby where people talk is not idle', async () => {
    const { rooms, scheduler, say, lobby } = await setup();
    const { roomId, a } = await lobby();
    await scheduler.advance(LOBBY_IDLE_MS - ROOM_TICK_MS);
    await say(a, roomId, 'still here');
    await scheduler.advance(2 * ROOM_TICK_MS);
    await rooms.tick();
    expect(rooms.snapshot(a.user, roomId).status).toBe('lobby');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects server projects/server/src/rooms/roomChat.spec.ts`
Expected: FAIL (a type error: `'chat.send'` is not a `RoomCommand`).

- [ ] **Step 3: Add the schema**

In `projects/protocol/src/schemas/socket.ts`:

1. Change the limits import to `import { CHAT_BODY_MAX, MAX_SUBMIT_ACTIONS, REQ_ID_MAX } from '../limits';`.
2. Add after `ResyncSchema`:
   ```ts
   // Shape only: the server normalizes the body and answers with a specific
   // code (empty, too long), so the schema allows more than the limit.
   export const ChatSendSchema = Type.Object({ type: Type.Literal('chat.send'), reqId: ReqId, body: Type.String({ maxLength: CHAT_BODY_MAX * 4 }) }, strict);
   ```
3. Add `ChatSendSchema,` as the last member of the `ClientMessageSchema` union (after `ResyncSchema,`).

- [ ] **Step 4: Add the server messages**

In `projects/protocol/src/socket.ts`:

1. Add `import type { ChatMessage } from './chat';` with the other type imports.
2. Add `chat: ChatMessage[];` to `WelcomeMessage`, after `game`, with the comment `// The room's last 100 messages, oldest first; empty in a solo room.` above it.
3. Add before `ServerMessage`:
   ```ts
   // A chat message was accepted; every connected member gets it, the sender too.
   export interface ChatMessageMessage extends ChatMessage {
     type: 'chat.message';
   }
   ```
4. Add `| ChatMessageMessage` to the `ServerMessage` union (after `GameUpdateMessage`).

- [ ] **Step 5: Wire chat into `RoomService`**

In `projects/server/src/rooms/roomService.ts`:

1. Import: add `import { ChatService } from './chatService';` after the `RoomError` import.
2. Add a field `private readonly chat: ChatService;` after `private readonly botPolicy: BotPolicy;`, and in the constructor, after `this.botPolicy = …;`:
   ```ts
       this.chat = new ChatService(this.repos, this.now);
   ```
3. In `connect`, right after the `if (!member) throw new RoomError('not_member');` line, add:
   ```ts
         // Read first, so a store error leaves the member as they were.
         const chat = entry.room.record.visibility === 'solo' ? [] : await this.chat.recent(roomId);
   ```
   and add `chat,` to the `welcome` object, after `game: runner?.updateFor(member.id, 0) ?? null,`.
4. In `command`, add a case after `case 'game.resync':`'s return:
   ```ts
           case 'chat.send':
             return this.sendChat(entry, actor, command.body);
   ```
5. Add the method after `resync`:
   ```ts
     // A member's chat message: stored, then sent to everyone connected. It
     // counts as activity, so a lobby where people talk is not idle. Solo rooms
     // have no chat.
     private async sendChat(entry: LiveRoom, actor: RoomMember, body: string): Promise<void> {
       if (entry.room.record.visibility === 'solo') throw new RoomError('chat_unavailable');
       const runner = entry.runner;
       const message = await this.chat.send(
         { roomId: entry.room.id, playerId: actor.id, gameId: runner?.id ?? null, afterSeq: runner ? runner.seq : null },
         body
       );
       entry.room.lastActivityAt = this.now();
       const notice: ServerMessage = { type: 'chat.message', ...message };
       for (const connection of entry.connections.values()) connection.send(notice);
     }
   ```
6. In `dropRoom`, add as the first statement:
   ```ts
       this.chat.forget(entry.room.members.map((m) => m.id));
   ```

- [ ] **Step 6: Fix the two existing assertions and the Angular fixture**

In `projects/server/src/rooms/roomService.spec.ts` line 180, add `chat: []` to the expected welcome:

```ts
      expect(guestSide.connection.last('welcome')).toEqual({ type: 'welcome', you: { playerId: guestSide.playerId, seatId: null }, room: expect.any(Object), game: null, chat: [] });
```

In `projects/app/src/app/online/testing.ts`, change the import to include `ChatMessage`:

```ts
import type { ChatMessage, GameUpdate, LastGame, RoomSnapshot, ServerMessage } from 'protocol';
```

and replace the `welcome` function with:

```ts
export function welcome(room: RoomSnapshot = ROOM, playerId = 'p-ann', game: GameUpdate | null = null, chat: ChatMessage[] = []): ServerMessage {
  const seatId = room.members.find((m) => m.playerId === playerId)?.seatId ?? null;
  return { type: 'welcome', you: { playerId, seatId }, room, game, chat };
}
```

- [ ] **Step 7: Run the tests and the typechecks**

Run: `npx jest --selectProjects server projects/server/src/rooms` then `npm run typecheck:server` then `npx ng build app`
Expected: PASS, no type errors, and the app builds.

- [ ] **Step 8: Commit**

```bash
git add projects
git commit -m "feat(server): chat.send, chat.message and the welcome history

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: My Games and the replay endpoint

**Files:**
- Create: `projects/server/src/views/history.ts`
- Create: `projects/server/src/game/history.ts`
- Modify: `projects/protocol/src/schemas/game.ts`
- Modify: `projects/server/src/http/guard.ts`
- Modify: `projects/server/src/http/roomRoutes.ts`
- Create: `projects/server/src/http/gameRoutes.ts`
- Modify: `projects/server/src/http/app.ts`
- Modify: `projects/server/src/server.ts`
- Modify (add `history` to the `buildApp` call): `projects/server/src/http/app.spec.ts:17`, `projects/server/src/http/roomRoutes.spec.ts:18`, `projects/server/src/socket/socketServer.spec.ts:22`, `projects/server/src/socket/gameSocket.spec.ts:58`
- Test: `projects/server/src/http/gameRoutes.spec.ts`

**Interfaces:**
- Consumes: Task 1's `GameSummary`, `MyGames`, `GameReplay`, `registered_only`; Task 2's `findFinishedForUser`, `listFinishedForUser`, `chat.listForGame`; Task 3's `toChatMessage`.
- Produces:
  - `toGameSummary(entry: UserGameRecord): GameSummary` and `toGameReplay(game: GameRecord, actions: GameActionRecord[], chat: ChatMessageRecord[]): GameReplay` in `views/history.ts`.
  - `class GameHistory { constructor(repos: Repositories); myGames(user: UserRecord): Promise<MyGames>; replay(user: UserRecord, gameId: string): Promise<GameReplay | null> }`.
  - `AppDeps.history: GameHistory` (required). Every `buildApp` caller passes it.
  - `GameParamsSchema` (`{ id: uuid }`).
  - `signedIn` moves to `http/guard.ts` (exported), and `registeredOnly` is added beside it.
  - `GET /api/me/games` and `GET /api/games/:id/replay`.

- [ ] **Step 1: Write the failing tests**

Create `projects/server/src/http/gameRoutes.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildContentRegistry } from 'content';
import type { GameReplay, MyGames } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { engineContext, openingState, replay as replayGame, stateHash } from '../game/engineGame';
import { GameHistory } from '../game/history';
import { playBots } from '../game/testing';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { GameSeat } from '../persistence/records';
import { Repositories } from '../persistence/repositories';
import { RoomService } from '../rooms/roomService';
import { buildApp } from './app';

const ORIGIN = 'http://localhost:4200';
const ctx = engineContext(buildContentRegistry());
const NOW = new Date('2026-10-15T12:00:00.000Z');
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

async function setup() {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app = await buildApp({ accounts, rooms, history: new GameHistory(repos), publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
  return { app, repos };
}

const token = (res: LightMyRequestResponse) => res.cookies.find((c) => c.name === 'sgs_session')!.value;
const post = (app: FastifyInstance, url: string, payload: object) => app.inject({ method: 'POST', url, payload, headers: { origin: ORIGIN } });
const get = (app: FastifyInstance, url: string, session?: string) => app.inject({ method: 'GET', url, cookies: session ? { sgs_session: session } : {} });
const signUp = async (app: FastifyInstance, displayName: string) =>
  token(await post(app, '/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName }));
const guest = async (app: FastifyInstance) => token(await post(app, '/api/auth/guest', { displayName: 'Gus' }));
const userId = async (app: FastifyInstance, session: string) => (await get(app, '/api/me', session)).json().id as string;

// A two-seat game that `userId` played on seat-1 against Bot 1 on seat-0, with
// moves played by the rule-based bot, stored the way the server stores them.
async function seedGame(repos: Repositories, user: string, options: { status?: 'finished' | 'aborted' | 'running'; finishedAt?: Date } = {}) {
  const status = options.status ?? 'finished';
  const room = await repos.rooms.create({ visibility: 'open', seatCount: 2, rules: {}, now: NOW });
  const person = await repos.rooms.addPlayer({ roomId: room.id, userId: user, kind: 'human', displayName: 'Ann', now: NOW });
  const bot = await repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: NOW });
  const seats: GameSeat[] = [
    { seatId: 'seat-0', roomPlayerId: bot.id, name: 'Bot 1', kind: 'bot' },
    { seatId: 'seat-1', roomPlayerId: person.id, name: 'Ann', kind: 'human' },
  ];
  const game = await repos.games.create({ roomId: room.id, seed: 1, seats, rules: {}, buildId: 'build-1', now: NOW });
  const { moves } = playBots(ctx, openingState(ctx, 1, seats, {}), 30);
  const rows = moves.map((move, i) => ({ seq: i + 1, seatId: move.seatId, source: 'bot' as const, action: move.action, stateHash: stateHash(move.after) }));
  await repos.transaction((tx) => tx.games.appendActions(game.id, 0, rows, NOW));
  if (status !== 'running') {
    const result = status === 'finished' ? { endedAt: rows.length, winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0'] } : null;
    await repos.games.update(game.id, { status, result, finishedAt: options.finishedAt ?? NOW });
  }
  return { game, room, person, actionCount: rows.length };
}

describe('game history routes', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('answers 401 without a session and 403 to a guest, on both routes (Review Focus 4)', async () => {
    ({ app } = await setup());
    const urls = ['/api/me/games', `/api/games/${randomUUID()}/replay`];
    for (const url of urls) {
      const anonymous = await get(app, url);
      expect(anonymous.statusCode).toBe(401);
      expect(anonymous.json().code).toBe('not_signed_in');
      const asGuest = await get(app, url, await guest(app));
      expect(asGuest.statusCode).toBe(403);
      expect(asGuest.json().code).toBe('registered_only');
    }
  });

  it('lists nothing for a user with no finished games', async () => {
    ({ app } = await setup());
    const res = await get(app, '/api/me/games', await signUp(app, 'Ann'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ games: [] });
  });

  it("lists the user's finished games newest first with their seat, and no other user's, running or aborted game (Review Focus 4)", async () => {
    let repos: Repositories;
    ({ app, repos } = await setup());
    const ann = await signUp(app, 'Ann');
    const bo = await signUp(app, 'Bo');
    const annId = await userId(app, ann);
    const older = await seedGame(repos, annId, { finishedAt: minutes(1) });
    const newer = await seedGame(repos, annId, { finishedAt: minutes(5) });
    await seedGame(repos, annId, { status: 'running' });
    await seedGame(repos, annId, { status: 'aborted', finishedAt: minutes(9) });
    await seedGame(repos, await userId(app, bo), { finishedAt: minutes(7) });
    const body = (await get(app, '/api/me/games', ann)).json() as MyGames;
    expect(body.games.map((g) => g.gameId)).toEqual([newer.game.id, older.game.id]);
    expect(body.games[0]).toEqual({
      gameId: newer.game.id,
      finishedAt: minutes(5).getTime(),
      players: [
        { seatId: 'seat-0', name: 'Bot 1', kind: 'bot' },
        { seatId: 'seat-1', name: 'Ann', kind: 'human' },
      ],
      result: { endedAt: newer.actionCount, winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0'] },
      yourSeat: 'seat-1',
    });
  });

  it("returns a finished game as a replay that rebuilds the same state, with only that game's chat", async () => {
    let repos: Repositories;
    ({ app, repos } = await setup());
    const ann = await signUp(app, 'Ann');
    const { game, room, person, actionCount } = await seedGame(repos, await userId(app, ann));
    await repos.chat.add({ roomId: room.id, gameId: null, afterSeq: null, roomPlayerId: person.id, body: 'lobby hello', now: NOW });
    await repos.chat.add({ roomId: room.id, gameId: game.id, afterSeq: 2, roomPlayerId: person.id, body: 'gg', now: NOW });
    const res = await get(app, `/api/games/${game.id}/replay`, ann);
    expect(res.statusCode).toBe(200);
    const body = res.json() as GameReplay;
    expect(Object.keys(body).sort()).toEqual(['actions', 'buildId', 'chat', 'rules', 'seats', 'seed']);
    expect(body.seed).toBe(1);
    expect(body.buildId).toBe('build-1');
    expect(body.actions).toHaveLength(actionCount);
    expect(body.chat).toEqual([{ id: expect.any(Number), from: { playerId: person.id, name: 'Ann' }, body: 'gg', at: NOW.getTime() }]);
    // Every stored hash must match what the engine computes again from the seed and the actions.
    const record = { id: game.id, roomId: room.id, seed: body.seed, seats: body.seats, rules: body.rules, buildId: body.buildId, status: 'finished' as const, result: null, actionCount, startedAt: NOW, finishedAt: NOW };
    const rows = body.actions.map((action) => ({ ...action, gameId: game.id, createdAt: NOW }));
    expect(() => replayGame(ctx, record, rows, true)).not.toThrow();
  });

  it("answers 404 for a game that is unknown, someone else's, running or aborted, and 400 for a bad id (Review Focus 4)", async () => {
    let repos: Repositories;
    ({ app, repos } = await setup());
    const ann = await signUp(app, 'Ann');
    const bo = await signUp(app, 'Bo');
    const annId = await userId(app, ann);
    const boGame = await seedGame(repos, await userId(app, bo));
    const running = await seedGame(repos, annId, { status: 'running' });
    const aborted = await seedGame(repos, annId, { status: 'aborted' });
    for (const id of [randomUUID(), boGame.game.id, running.game.id, aborted.game.id]) {
      const res = await get(app, `/api/games/${id}/replay`, ann);
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('not_found');
      expect(res.body).not.toContain('seed');
    }
    const bad = await get(app, '/api/games/not-a-uuid/replay', ann);
    expect(bad.statusCode).toBe(400);
    expect(bad.json().code).toBe('invalid_body');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects server projects/server/src/http/gameRoutes.spec.ts`
Expected: FAIL (cannot find `../game/history`).

- [ ] **Step 3: Write the views**

Create `projects/server/src/views/history.ts`:

```ts
import type { GameReplay, GameSummary } from 'protocol';
import { ChatMessageRecord, GameActionRecord, GameRecord, UserGameRecord } from '../persistence/records';
import { toChatMessage } from './chat';

// A row of My Games. A finished game always has a finish time; the start is a
// harmless fallback for the type.
export function toGameSummary({ game, yourSeatId }: UserGameRecord): GameSummary {
  return {
    gameId: game.id,
    finishedAt: (game.finishedAt ?? game.startedAt).getTime(),
    players: game.seats.map((s) => ({ seatId: s.seatId, name: s.name, kind: s.kind })),
    result: game.result,
    yourSeat: yourSeatId,
  };
}

// Everything needed to rebuild a finished game: its seed, seats, rules and
// build, its actions with their state hashes, and the chat sent during it.
export function toGameReplay(game: GameRecord, actions: GameActionRecord[], chat: ChatMessageRecord[]): GameReplay {
  return {
    seed: game.seed,
    seats: game.seats.map((s) => ({ seatId: s.seatId, roomPlayerId: s.roomPlayerId, name: s.name, kind: s.kind })),
    rules: { ...game.rules },
    buildId: game.buildId,
    actions: actions.map((a) => ({ seq: a.seq, seatId: a.seatId, source: a.source, action: a.action, stateHash: a.stateHash })),
    chat: chat.map(toChatMessage),
  };
}
```

- [ ] **Step 4: Write `GameHistory`**

Create `projects/server/src/game/history.ts`:

```ts
import type { GameReplay, MyGames } from 'protocol';
import { UserRecord } from '../persistence/records';
import { Repositories } from '../persistence/repositories';
import { toGameReplay, toGameSummary } from '../views/history';

// What a registered user may read about games that are over: their list, and
// the replay of one they played.
export class GameHistory {
  constructor(private readonly repos: Repositories) {}

  async myGames(user: UserRecord): Promise<MyGames> {
    return { games: (await this.repos.games.listFinishedForUser(user.id)).map(toGameSummary) };
  }

  // Null when the user did not play a finished game with that id (it may be
  // unknown, someone else's, running or aborted: the caller can't tell which).
  async replay(user: UserRecord, gameId: string): Promise<GameReplay | null> {
    const entry = await this.repos.games.findFinishedForUser(user.id, gameId);
    if (!entry) return null;
    const [actions, chat] = await Promise.all([this.repos.games.listActions(gameId), this.repos.chat.listForGame(gameId)]);
    return toGameReplay(entry.game, actions, chat);
  }
}
```

- [ ] **Step 5: Add the params schema**

Append to `projects/protocol/src/schemas/game.ts`, and add `RoomIdSchema` to its import (`import { RoomIdSchema, RoomRulesSchema, SeatCountSchema } from './rooms';`):

```ts
export const GameParamsSchema = Type.Object({ id: RoomIdSchema });
```

- [ ] **Step 6: Share the sign-in guards**

Replace the contents of `projects/server/src/http/guard.ts` with:

```ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { errorBody } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// CSRF guard: a state-changing request must come from our own origin and be
// JSON (which a plain cross-site form can't send).
export function requestGuard(publicOrigin: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (SAFE_METHODS.has(request.method)) return;
    if (request.headers.origin !== publicOrigin) return reply.code(403).send(errorBody('bad_origin'));
    if (!/^application\/json\s*(;|$)/i.test(request.headers['content-type'] ?? '')) return reply.code(415).send(errorBody('unsupported_media_type'));
  };
}

// Route hooks. They run before the body is parsed and validated, so a
// signed-out request is always told to sign in rather than that its body is wrong.
export async function signedIn(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) return reply.code(401).send(errorBody('not_signed_in'));
}

// Signed in with an account: a guest is refused.
export async function registeredOnly(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) return reply.code(401).send(errorBody('not_signed_in'));
  if (request.auth.user.kind !== 'registered') return reply.code(403).send(errorBody('registered_only'));
}
```

In `projects/server/src/http/roomRoutes.ts`, delete the local `signedIn` function and its comment, remove the now-unused `FastifyReply, FastifyRequest` import, and import the shared one: `import { signedIn } from './guard';` (keep the `errorBody` import only if it is still used; if not, remove it).

- [ ] **Step 7: Write the routes**

Create `projects/server/src/http/gameRoutes.ts`:

```ts
import { GameParamsSchema } from 'protocol/schemas';
import { GameHistory } from '../game/history';
import { RoomError } from '../rooms/errors';
import { registeredOnly } from './guard';
import { TypedApp } from './types';

// What a registered user may read about games that are over (spec "HTTP API").
export function registerGameRoutes(app: TypedApp, deps: { history: GameHistory }): void {
  const { history } = deps;

  app.get('/api/me/games', { onRequest: registeredOnly }, async (request) => history.myGames(request.auth!.user));

  app.get('/api/games/:id/replay', { onRequest: registeredOnly, schema: { params: GameParamsSchema } }, async (request) => {
    const replay = await history.replay(request.auth!.user, request.params.id);
    if (!replay) throw new RoomError('not_found');
    return replay;
  });
}
```

- [ ] **Step 8: Wire `buildApp` and `createServer`**

In `projects/server/src/http/app.ts`:

1. Add `import { GameHistory } from '../game/history';` and `import { registerGameRoutes } from './gameRoutes';`.
2. Add to `AppDeps`, after `rooms: RoomService;`: `history: GameHistory;`.
3. After `registerRoomRoutes(app, { rooms: deps.rooms });` add `registerGameRoutes(app, { history: deps.history });`.

In `projects/server/src/server.ts`: add `import { GameHistory } from './game/history';`, and pass `history: new GameHistory(store.repos),` in the `buildApp({ … })` call, after `rooms,`.

In the four specs that call `buildApp`, add `history: new GameHistory(repos),` after `rooms,` and import `GameHistory` from `'../game/history'`. Each already has `repos` in scope.

- [ ] **Step 9: Run the tests and the typecheck**

Run: `npx jest --selectProjects server` then `npm run typecheck:server`
Expected: PASS (the whole server project, since `buildApp` changed) and no type errors.

- [ ] **Step 10: Commit**

```bash
git add projects
git commit -m "feat(server): My Games list and the replay endpoint

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Chat over a real socket

**Files:**
- Test: `projects/server/src/socket/chatSocket.spec.ts` (new)

**Interfaces:**
- Consumes: Task 4's `chat.send` / `chat.message` / `welcome.chat`, Task 5's `history` dependency, the existing `TestClient`.
- Produces: end-to-end coverage only. There is no new production code in this task unless a test exposes a bug.

- [ ] **Step 1: Write the tests**

Create `projects/server/src/socket/chatSocket.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { FastifyInstance } from 'fastify';
import { PROTOCOL_VERSION } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { GameHistory } from '../game/history';
import { buildApp } from '../http/app';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { TestClient } from './testClient';

const ORIGIN = 'http://localhost:4200';

async function setup() {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app: FastifyInstance = await buildApp({ accounts, rooms, history: new GameHistory(repos), publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ws`;
  const clients: TestClient[] = [];

  const post = (path: string, payload: object, session?: string) =>
    app.inject({ method: 'POST', url: path, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
  const signUp = async (displayName: string) => {
    const res = await post('/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName });
    return res.cookies.find((c) => c.name === 'sgs_session')!.value;
  };
  const open = async (session: string) => {
    const client = await TestClient.open(url, { origin: ORIGIN, token: session });
    clients.push(client);
    return client;
  };
  const connect = async (session: string, roomId: string) => {
    const client = await open(session);
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId });
    const welcome = await client.next('welcome');
    return { client, welcome, playerId: welcome.you.playerId };
  };
  // Ann (host) and Bo in a room, both signed up but not yet connected.
  const pair = async () => {
    const ann = await signUp('Ann');
    const bo = await signUp('Bo');
    const roomId = (await post('/api/rooms', { seatCount: 4, rules: {}, displayName: 'Ann' }, ann)).json().id as string;
    await post(`/api/rooms/${roomId}/join`, { displayName: 'Bo' }, bo);
    return { ann, bo, roomId };
  };
  const teardown = async () => {
    for (const client of clients) client.close();
    await rooms.stop();
    await app.close();
  };
  return { repos, open, connect, pair, teardown };
}

describe('chat over the socket', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  afterEach(async () => {
    await ctx?.teardown();
  });

  it('acks the sender and delivers the normalized message to every member', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pair();
    const a = await ctx.connect(ann, roomId);
    const b = await ctx.connect(bo, roomId);
    a.client.send({ type: 'chat.send', reqId: 'c1', body: '  hello   there ' });
    await a.client.next('ack', (m) => m.reqId === 'c1');
    const expected = expect.objectContaining({ id: expect.any(Number), from: { playerId: a.playerId, name: 'Ann' }, body: 'hello there', at: expect.any(Number) });
    expect(await a.client.next('chat.message')).toEqual(expected);
    expect(await b.client.next('chat.message')).toEqual(expected);
  });

  it('gives a member who connects later the recent messages, oldest first, in the welcome', async () => {
    ctx = await setup();
    const { ann, bo, roomId } = await ctx.pair();
    const a = await ctx.connect(ann, roomId);
    for (const body of ['one', 'two']) {
      a.client.send({ type: 'chat.send', reqId: body, body });
      await a.client.next('ack', (m) => m.reqId === body);
    }
    const b = await ctx.connect(bo, roomId);
    expect(b.welcome.chat.map((m) => m.body)).toEqual(['one', 'two']);
  });

  it('answers an empty, an over-long and a too-fast message with their codes, and stores only the accepted ones (Review Focus 1 and 2)', async () => {
    ctx = await setup();
    const { ann, roomId } = await ctx.pair();
    const a = await ctx.connect(ann, roomId);
    const refused = async (reqId: string, body: string, code: string) => {
      a.client.send({ type: 'chat.send', reqId, body });
      const error = await a.client.next('error', (m) => m.reqId === reqId);
      expect(error.code).toBe(code);
    };
    await refused('e1', '   ', 'chat_empty');
    await refused('e2', 'x'.repeat(301), 'chat_too_long');
    for (let i = 0; i < 5; i += 1) {
      a.client.send({ type: 'chat.send', reqId: `ok${i}`, body: `m${i}` });
      await a.client.next('ack', (m) => m.reqId === `ok${i}`);
    }
    await refused('e3', 'sixth', 'chat_rate_limited');
    expect((await ctx.repos.chat.listRecent(roomId, 100)).map((m) => m.body)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
  });

  it('refuses a body that is not text, naming the request (Review Focus 1)', async () => {
    ctx = await setup();
    const { ann, roomId } = await ctx.pair();
    const a = await ctx.connect(ann, roomId);
    a.client.send({ type: 'chat.send', reqId: 'bad', body: 42 });
    const error = await a.client.next('error', (m) => m.reqId === 'bad');
    expect(error.code).toBe('invalid_message');
    expect(await ctx.repos.chat.listRecent(roomId, 10)).toEqual([]);
  });

  it('refuses chat.send from a connection that has not said hello (Review Focus 3)', async () => {
    ctx = await setup();
    const { ann, roomId } = await ctx.pair();
    const client = await ctx.open(ann);
    client.send({ type: 'chat.send', reqId: 'early', body: 'hi' });
    const error = await client.next('error', (m) => m.reqId === 'early');
    expect(error.code).toBe('invalid_message');
    expect(await ctx.repos.chat.listRecent(roomId, 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx jest --selectProjects server projects/server/src/socket/chatSocket.spec.ts`
Expected: PASS. Everything this tests was built in Tasks 3 to 5. If one fails, fix the production code (not the test) and say what you fixed.

- [ ] **Step 3: Run the whole server project and the typecheck**

Run: `npx jest --selectProjects server` then `npm run typecheck:server`
Expected: PASS and no type errors.

- [ ] **Step 4: Commit**

```bash
git add projects/server/src/socket/chatSocket.spec.ts
git commit -m "test(server): chat over a real socket

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Angular: ChatService, ChatPanel and chat in the Lobby

**Files:**
- Modify: `projects/app/src/app/online/testing.ts` (add the `chatMessage` fixture)
- Create: `projects/app/src/app/online/chat.service.ts`
- Create: `projects/app/src/app/online/chat-panel.ts`
- Modify: `projects/app/src/app/online/lobby-page.ts`
- Test: `projects/app/src/app/online/chat.service.spec.ts`
- Test: `projects/app/src/app/online/chat-panel.spec.ts`
- Modify (tests): `projects/app/src/app/online/lobby-page.spec.ts`

**Interfaces:**
- Consumes: Task 4's `welcome.chat`, `chat.message` and `chat.send` (`RoomRequest` now includes it); the existing `SocketService` (`messages`, `request`) and `ApiError`.
- Produces:
  - `chatMessage(id: number, from: string, body: string, playerId?: string): ChatMessage` in `online/testing.ts` (default `playerId` is `p-` plus the lowercased name).
  - ```ts
    @Injectable() class ChatService {
      readonly messages: Signal<ChatMessage[]>;   // oldest first; `welcome` replaces, `chat.message` appends
      readonly error: Signal<string | null>;      // the last refused send
      send(body: string): Promise<boolean>;       // true once the server acked
    }
    ```
    Provided by the component that provides `SocketService` (the Lobby page).
  - `ChatPanel` (selector `app-chat-panel`, inputs `you: string | null`, `canSend: boolean`) that reads and sends through `ChatService`.

- [ ] **Step 1: Add the fixture**

In `projects/app/src/app/online/testing.ts`, add after the `welcome` function:

```ts
// A chat message from the named member; `playerId` defaults to "p-" and the lowercased name.
export function chatMessage(id: number, from: string, body: string, playerId = `p-${from.toLowerCase()}`): ChatMessage {
  return { id, from: { playerId, name: from }, body, at: Date.parse('2026-10-15T12:00:00.000Z') + id * 1000 };
}
```

- [ ] **Step 2: Write the failing `ChatService` tests**

Create `projects/app/src/app/online/chat.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { ERROR_MESSAGES } from 'protocol';
import { ChatService } from './chat.service';
import { SocketService, WEB_SOCKET_FACTORY } from './socket.service';
import { chatMessage, FakeSocket, ROOM, welcome } from './testing';

describe('ChatService', () => {
  let socket: FakeSocket;
  let chat: ChatService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketService, ChatService, { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) }],
    });
    chat = TestBed.inject(ChatService);
    TestBed.inject(SocketService).connect(ROOM.id);
    socket.serverOpens();
  });

  const bodies = () => chat.messages().map((m) => m.body);

  it('starts empty and takes the history from the welcome', () => {
    expect(chat.messages()).toEqual([]);
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one'), chatMessage(2, 'Bo', 'two')]));
    expect(bodies()).toEqual(['one', 'two']);
  });

  it('appends each message that arrives, in order', () => {
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one')]));
    socket.serverSends({ type: 'chat.message', ...chatMessage(2, 'Bo', 'two') });
    socket.serverSends({ type: 'chat.message', ...chatMessage(3, 'Ann', 'three') });
    expect(bodies()).toEqual(['one', 'two', 'three']);
  });

  it('shows a message that arrives twice once (Review Focus 5)', () => {
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one')]));
    socket.serverSends({ type: 'chat.message', ...chatMessage(1, 'Ann', 'one') });
    expect(bodies()).toEqual(['one']);
  });

  it('replaces everything with the history of the next welcome, as after a reconnect (Review Focus 5)', () => {
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one')]));
    socket.serverSends(welcome(ROOM, 'p-ann', null, [chatMessage(1, 'Ann', 'one'), chatMessage(2, 'Bo', 'sent while you were away')]));
    expect(bodies()).toEqual(['one', 'sent while you were away']);
  });

  it('keeps only the newest 300 messages', () => {
    socket.serverSends(welcome(ROOM, 'p-ann'));
    for (let i = 1; i <= 305; i += 1) socket.serverSends({ type: 'chat.message', ...chatMessage(i, 'Ann', `m${i}`) });
    expect(chat.messages()).toHaveLength(300);
    expect(bodies()[0]).toBe('m6');
  });

  it('sends chat.send and resolves true when the server acks', async () => {
    socket.serverSends(welcome());
    const sent = chat.send('hello');
    expect(socket.lastSent).toMatchObject({ type: 'chat.send', body: 'hello' });
    socket.serverSends({ type: 'ack', reqId: socket.lastSent!['reqId'] as string });
    await expect(sent).resolves.toBe(true);
    expect(chat.error()).toBeNull();
  });

  it("resolves false with the server's message when it refuses, and clears the message on the next send", async () => {
    socket.serverSends(welcome());
    const refused = chat.send('too fast');
    socket.serverSends({ type: 'error', reqId: socket.lastSent!['reqId'] as string, code: 'chat_rate_limited', message: ERROR_MESSAGES.chat_rate_limited });
    await expect(refused).resolves.toBe(false);
    expect(chat.error()).toBe('You are sending messages too fast. Wait a moment');
    const next = chat.send('later');
    expect(chat.error()).toBeNull();
    socket.serverSends({ type: 'ack', reqId: socket.lastSent!['reqId'] as string });
    await expect(next).resolves.toBe(true);
  });

  it("resolves false when the socket isn't open", async () => {
    await expect(chat.send('hello')).resolves.toBe(false);
    expect(chat.error()).toBe("Can't reach the server. Check your connection and try again");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest --selectProjects app projects/app/src/app/online/chat.service.spec.ts`
Expected: FAIL (cannot find `./chat.service`).

- [ ] **Step 4: Write `ChatService`**

Create `projects/app/src/app/online/chat.service.ts`:

```ts
import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ERROR_MESSAGES } from 'protocol';
import type { ChatMessage, ServerMessage } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { SocketService } from './socket.service';

// How many messages the screen keeps; older ones scroll away for good.
export const KEPT_MESSAGES = 300;

// The room's chat, kept from the room socket. Provide it in the Lobby
// component together with SocketService. The server decides every rule (length,
// rate); this only shows what it sends and asks for what the player types.
@Injectable()
export class ChatService {
  private readonly socket = inject(SocketService);
  private readonly _messages = signal<ChatMessage[]>([]);
  private readonly _error = signal<string | null>(null);

  // Oldest first.
  readonly messages = this._messages.asReadonly();
  // The last refused message.
  readonly error = this._error.asReadonly();

  constructor() {
    this.socket.messages.pipe(takeUntilDestroyed()).subscribe((message) => this.receive(message));
  }

  // True once the server accepted the message. It then arrives as a `chat.message` like everyone else's.
  async send(body: string): Promise<boolean> {
    this._error.set(null);
    try {
      await this.socket.request({ type: 'chat.send', body });
      return true;
    } catch (err) {
      this._error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
      return false;
    }
  }

  private receive(message: ServerMessage): void {
    if (message.type === 'welcome') {
      this._messages.set(message.chat.slice(-KEPT_MESSAGES));
    } else if (message.type === 'chat.message') {
      const { type: _type, ...chat } = message;
      this._messages.update((all) => (all.some((m) => m.id === chat.id) ? all : [...all, chat].slice(-KEPT_MESSAGES)));
    }
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest --selectProjects app projects/app/src/app/online/chat.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing `ChatPanel` tests**

Create `projects/app/src/app/online/chat-panel.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatMessage } from 'protocol';
import { ChatPanel } from './chat-panel';
import { ChatService } from './chat.service';
import { chatMessage } from './testing';

function fakeChat() {
  return { messages: signal<ChatMessage[]>([]), error: signal<string | null>(null), send: jest.fn(async (_body: string) => true) };
}

describe('ChatPanel', () => {
  let chat: ReturnType<typeof fakeChat>;

  async function render(inputs: { you?: string | null; canSend?: boolean } = {}) {
    await TestBed.configureTestingModule({ imports: [ChatPanel], providers: [{ provide: ChatService, useValue: chat }] }).compileComponents();
    const fixture = TestBed.createComponent(ChatPanel);
    fixture.componentRef.setInput('you', inputs.you ?? 'p-ann');
    fixture.componentRef.setInput('canSend', inputs.canSend ?? true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = () => el.querySelector('input.draft') as HTMLInputElement;
    const type = (text: string) => {
      input().value = text;
      input().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const submit = async () => {
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const button = () => el.querySelector('button.send') as HTMLButtonElement;
    return { fixture, el, input, type, submit, button };
  }

  beforeEach(() => {
    chat = fakeChat();
  });

  it('says there are no messages yet', async () => {
    const { el } = await render();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('No messages yet');
  });

  it('shows each message with its author, and marks your own', async () => {
    chat.messages.set([chatMessage(1, 'Bo', 'hi Ann'), chatMessage(2, 'Ann', 'hi Bo')]);
    const { el } = await render();
    const rows = [...el.querySelectorAll('li.message')];
    expect(rows.map((r) => [r.querySelector('.author')?.textContent?.trim(), r.querySelector('.body')?.textContent?.trim()])).toEqual([
      ['Bo', 'hi Ann'],
      ['Ann', 'hi Bo'],
    ]);
    expect(rows.map((r) => r.classList.contains('mine'))).toEqual([false, true]);
  });

  it('shows message text as text, never as markup', async () => {
    chat.messages.set([chatMessage(1, 'Bo', '<img src=x onerror=alert(1)>')]);
    const { el } = await render();
    expect(el.querySelector('li.message img')).toBeNull();
    expect(el.querySelector('li.message .body')?.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('sends the trimmed text and clears the input once it was sent', async () => {
    const { input, type, submit } = await render();
    type('  hello there  ');
    await submit();
    expect(chat.send).toHaveBeenCalledWith('hello there');
    expect(input().value).toBe('');
  });

  it('keeps the text when the server refuses it, and shows why', async () => {
    chat.send.mockResolvedValue(false);
    chat.error.set('You are sending messages too fast. Wait a moment');
    const { el, input, type, submit } = await render();
    type('hello');
    await submit();
    expect(input().value).toBe('hello');
    expect(el.querySelector('.error')?.textContent?.trim()).toBe('You are sending messages too fast. Wait a moment');
  });

  it('sends nothing for an empty or blank message', async () => {
    const { type, submit, button } = await render();
    expect(button().disabled).toBe(true);
    type('   ');
    await submit();
    expect(chat.send).not.toHaveBeenCalled();
  });

  it('limits the input to 300 characters', async () => {
    const { input } = await render();
    expect(input().getAttribute('maxlength')).toBe('300');
  });

  it('disables typing and sending while it cannot send', async () => {
    const { input, type, submit, button } = await render({ canSend: false });
    expect(input().disabled).toBe(true);
    expect(button().disabled).toBe(true);
    type('hello');
    await submit();
    expect(chat.send).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx jest --selectProjects app projects/app/src/app/online/chat-panel.spec.ts`
Expected: FAIL (cannot find `./chat-panel`).

- [ ] **Step 8: Write `ChatPanel`**

Create `projects/app/src/app/online/chat-panel.ts`:

```ts
import { Component, effect, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CHAT_BODY_MAX } from 'protocol';
import { ChatService } from './chat.service';

// The room's messages and the box to write one. It reads and sends through
// ChatService and decides nothing: length and rate are the server's call, and
// the server's reason is shown when it refuses.
@Component({
  selector: 'app-chat-panel',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <ol class="messages" #list aria-live="polite" aria-label="Chat Messages">
      @for (message of chat.messages(); track message.id) {
        <li class="message" [class.mine]="message.from.playerId === you()">
          <span class="author">{{ message.from.name }}</span>
          <span class="body">{{ message.body }}</span>
        </li>
      } @empty {
        <li class="empty">No messages yet</li>
      }
    </ol>
    @if (chat.error(); as text) {
      <p class="error" role="alert">{{ text }}</p>
    }
    <form class="composer" (submit)="submit($event)">
      <input
        class="draft"
        type="text"
        autocomplete="off"
        aria-label="Message"
        placeholder="Say something…"
        [attr.maxlength]="maxLength"
        [value]="draft()"
        [disabled]="!canSend()"
        (input)="onInput($event)"
      />
      <button mat-icon-button type="submit" class="send" aria-label="Send" [disabled]="!canSend() || draft().trim() === ''">
        <mat-icon>send</mat-icon>
      </button>
    </form>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
    }
    .messages {
      list-style: none;
      margin: 0;
      padding: 8px;
      flex: 1;
      min-height: 120px;
      max-height: 240px;
      overflow-y: auto;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-lowest);
      font: var(--mat-sys-body-medium);
    }
    :host-context(.drawer) .messages {
      max-height: none;
    }
    .message {
      display: flex;
      gap: 8px;
      padding: 2px 0;
      overflow-wrap: anywhere;
    }
    .author {
      flex: none;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    .mine .author {
      color: var(--mat-sys-primary);
    }
    .empty {
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .error {
      margin: 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-medium);
    }
    .composer {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .draft {
      flex: 1;
      min-width: 0;
      padding: 8px 12px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 8px;
      background: var(--mat-sys-surface);
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-body-medium);
    }
  `,
})
export class ChatPanel {
  protected readonly chat = inject(ChatService);
  // Your player id, to mark your own messages.
  readonly you = input<string | null>(null);
  // False while disconnected or after the connection ended.
  readonly canSend = input(true);
  protected readonly maxLength = CHAT_BODY_MAX;
  protected readonly draft = signal('');
  private readonly sending = signal(false);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');

  constructor() {
    // Keep the newest message in view.
    effect(() => {
      this.chat.messages();
      const el = this.list()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  protected onInput(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const body = this.draft().trim();
    if (body === '' || !this.canSend() || this.sending()) return;
    this.sending.set(true);
    try {
      if (await this.chat.send(body)) this.draft.set('');
    } finally {
      this.sending.set(false);
    }
  }
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx jest --selectProjects app projects/app/src/app/online/chat-panel.spec.ts`
Expected: PASS.

- [ ] **Step 10: Put chat in the Lobby**

In `projects/app/src/app/online/lobby-page.ts`:

1. Add imports: `import { ChatPanel } from './chat-panel';` and `import { ChatService } from './chat.service';`.
2. Add `ChatPanel` to the component's `imports` array, and `ChatService` to `providers`: `providers: [SocketService, LobbyService, ChatService, RemoteGameService, RemoteDecisionClock],`.
3. In the lobby view, inside `@if (lobby.room(); as room) { … }`, directly after the `@if (waitingForGame()) { … } @else { … }` block (still inside the room `@if`), add:
   ```html
                 @if (!lobby.isSolo()) {
                   <section class="chat">
                     <h3>Chat</h3>
                     <app-chat-panel [you]="lobby.you()" [canSend]="lobby.canAct()" />
                   </section>
                 }
   ```

- [ ] **Step 11: Update and extend the Lobby page tests**

In `projects/app/src/app/online/lobby-page.spec.ts`:

1. Add imports: `import type { ChatMessage, LastGame, RoomSnapshot } from 'protocol';` (replace the existing protocol import), `import { ChatService } from './chat.service';`.
2. Add after `fakeGame`:
   ```ts
   function fakeChat() {
     return { messages: signal<ChatMessage[]>([]), error: signal<string | null>(null), send: jest.fn(async () => true) };
   }
   ```
3. In `render()`, change the `overrideComponent(LobbyPage, …)` line to also provide the fake chat:
   ```ts
       TestBed.overrideComponent(LobbyPage, {
         set: { providers: [{ provide: LobbyService, useValue: lobby }, { provide: RemoteGameService, useValue: game }, { provide: ChatService, useValue: fakeChat() }] },
       });
   ```
4. Add these tests inside the `describe('LobbyPage', …)`:
   ```ts
     it('shows the chat in the lobby of an open room', async () => {
       const { el } = await render();
       expect(el.querySelector('section.chat h3')?.textContent?.trim()).toBe('Chat');
       expect(el.querySelector('section.chat app-chat-panel')).not.toBeNull();
     });

     it('has no chat in a solo room', async () => {
       lobby.isSolo.set(true);
       const { el } = await render();
       expect(el.querySelector('app-chat-panel')).toBeNull();
     });
   ```

- [ ] **Step 12: Run the tests and the build**

Run: `npx jest --selectProjects app projects/app/src/app/online` then `npx ng build app`
Expected: PASS and a successful build.

- [ ] **Step 13: Commit**

```bash
git add projects/app
git commit -m "feat(app): chat in the Lobby

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Angular: the board's collapsible chat panel

**Files:**
- Create: `projects/app/src/app/online/board-chat.ts`
- Modify: `projects/app/src/app/online/lobby-page.ts`
- Test: `projects/app/src/app/online/board-chat.spec.ts`
- Modify (tests): `projects/app/src/app/online/lobby-page.spec.ts`

**Interfaces:**
- Consumes: Task 7's `ChatService`, `ChatPanel` and the `chatMessage` fixture.
- Produces: `BoardChat` (selector `app-board-chat`, inputs `you: string | null`, `canSend: boolean`): a Chat toggle button with an unread badge, and a side panel (class `drawer`) holding `ChatPanel`, closed by default. Unread counts only other members' messages that arrived while the panel was closed and that the player has not seen.

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/online/board-chat.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ChatMessage } from 'protocol';
import { BoardChat } from './board-chat';
import { ChatService } from './chat.service';
import { chatMessage } from './testing';

function fakeChat(initial: ChatMessage[] = []) {
  return { messages: signal<ChatMessage[]>(initial), error: signal<string | null>(null), send: jest.fn(async (_body: string) => true) };
}

describe('BoardChat', () => {
  async function render(chat: ReturnType<typeof fakeChat>) {
    await TestBed.configureTestingModule({ imports: [BoardChat], providers: [{ provide: ChatService, useValue: chat }] }).compileComponents();
    const fixture = TestBed.createComponent(BoardChat);
    fixture.componentRef.setInput('you', 'p-ann');
    fixture.componentRef.setInput('canSend', true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const toggle = () => el.querySelector('button.chat-toggle') as HTMLButtonElement | null;
    const unread = () => el.querySelector('.unread')?.textContent?.trim() ?? null;
    const click = (button: HTMLButtonElement | null) => {
      button!.click();
      fixture.detectChanges();
    };
    const arrive = (...messages: ChatMessage[]) => {
      chat.messages.update((all) => [...all, ...messages]);
      fixture.detectChanges();
    };
    return { fixture, el, toggle, unread, click, arrive };
  }

  it('starts closed: a Chat toggle and no panel', async () => {
    const { el, toggle } = await render(fakeChat());
    expect(toggle()?.textContent).toContain('Chat');
    expect(toggle()?.getAttribute('aria-label')).toBe('Chat');
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.drawer')).toBeNull();
    expect(el.querySelector('app-chat-panel')).toBeNull();
  });

  it('counts messages from others that arrive while it is closed, and not your own', async () => {
    const { toggle, unread, arrive } = await render(fakeChat());
    expect(unread()).toBeNull();
    arrive(chatMessage(1, 'Bo', 'hi'));
    arrive(chatMessage(2, 'Ann', 'my own message'));
    arrive(chatMessage(3, 'Cy', 'hello'));
    expect(unread()).toBe('2');
    expect(toggle()?.getAttribute('aria-label')).toBe('Chat, 2 unread');
  });

  it('does not count the history it started with (Review Focus 5)', async () => {
    const { unread, arrive } = await render(fakeChat([chatMessage(1, 'Bo', 'old'), chatMessage(2, 'Cy', 'older')]));
    expect(unread()).toBeNull();
    arrive(chatMessage(3, 'Bo', 'new'));
    expect(unread()).toBe('1');
  });

  it('opens the panel with Close Chat, hides the toggle, and clears the count', async () => {
    const { el, toggle, unread, click, arrive } = await render(fakeChat());
    arrive(chatMessage(1, 'Bo', 'hi'));
    click(toggle());
    expect(el.querySelector('.drawer app-chat-panel')).not.toBeNull();
    expect(el.querySelector('.drawer h2')?.textContent?.trim()).toBe('Chat');
    expect(toggle()).toBeNull();
    expect(unread()).toBeNull();
    arrive(chatMessage(2, 'Bo', 'while open'));
    expect(unread()).toBeNull();
  });

  it('closes again, and a message that arrived while open is not unread', async () => {
    const { el, toggle, unread, click, arrive } = await render(fakeChat());
    click(toggle());
    arrive(chatMessage(1, 'Bo', 'while open'));
    click(el.querySelector('button.close-chat') as HTMLButtonElement);
    expect(el.querySelector('.drawer')).toBeNull();
    expect(unread()).toBeNull();
    arrive(chatMessage(2, 'Bo', 'after closing'));
    expect(unread()).toBe('1');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects app projects/app/src/app/online/board-chat.spec.ts`
Expected: FAIL (cannot find `./board-chat`).

- [ ] **Step 3: Write `BoardChat`**

Create `projects/app/src/app/online/board-chat.ts`:

```ts
import { Component, computed, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ChatPanel } from './chat-panel';
import { ChatService } from './chat.service';

// The board's chat: a Chat button (with the count of messages you haven't seen)
// that opens a side panel over the board's edge. Closed by default, so it never
// covers the table. The count is presentation state, kept here.
@Component({
  selector: 'app-board-chat',
  imports: [MatButtonModule, MatIconModule, ChatPanel],
  template: `
    @if (open()) {
      <aside class="drawer" aria-label="Chat">
        <header>
          <h2>Chat</h2>
          <button mat-icon-button type="button" class="close-chat" aria-label="Close Chat" (click)="toggle()"><mat-icon>close</mat-icon></button>
        </header>
        <app-chat-panel [you]="you()" [canSend]="canSend()" />
      </aside>
    } @else {
      <button
        mat-flat-button
        type="button"
        class="chat-toggle"
        aria-expanded="false"
        [attr.aria-label]="unread() > 0 ? 'Chat, ' + unread() + ' unread' : 'Chat'"
        (click)="toggle()"
      >
        <mat-icon>chat</mat-icon> Chat
        @if (unread() > 0) {
          <span class="unread">{{ unread() }}</span>
        }
      </button>
    }
  `,
  styles: `
    .chat-toggle {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 20;
    }
    .unread {
      min-width: 20px;
      margin-left: 8px;
      padding: 0 6px;
      border-radius: 999px;
      background: var(--mat-sys-error);
      color: var(--mat-sys-on-error);
      font: var(--mat-sys-label-medium);
      line-height: 20px;
      text-align: center;
    }
    .drawer {
      position: fixed;
      top: 64px;
      right: 0;
      bottom: 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(360px, 100vw);
      box-sizing: border-box;
      padding: 8px 16px 16px;
      background: var(--mat-sys-surface-container);
      box-shadow: var(--mat-sys-level3);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    app-chat-panel {
      flex: 1;
    }
  `,
})
export class BoardChat {
  private readonly chat = inject(ChatService);
  readonly you = input<string | null>(null);
  readonly canSend = input(true);
  protected readonly open = signal(false);
  // The newest message the player has seen: those at start, and everything up to the moment they opened or closed the panel.
  private readonly seenId = signal(this.latestId());

  protected readonly unread = computed(() =>
    this.open() ? 0 : this.chat.messages().filter((m) => m.id > this.seenId() && m.from.playerId !== this.you()).length
  );

  protected toggle(): void {
    this.seenId.set(this.latestId());
    this.open.update((open) => !open);
  }

  private latestId(): number {
    return this.chat.messages().at(-1)?.id ?? 0;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects app projects/app/src/app/online/board-chat.spec.ts`
Expected: PASS.

- [ ] **Step 5: Put it beside the board**

In `projects/app/src/app/online/lobby-page.ts`:

1. Add `import { BoardChat } from './board-chat';` and add `BoardChat` to the component's `imports`.
2. In the template's `@else if (game.playing()) { … }` branch, change `<app-online-game />` to:
   ```html
         <app-online-game />
         @if (!lobby.isSolo()) {
           <app-board-chat [you]="lobby.you()" [canSend]="lobby.canAct()" />
         }
   ```

- [ ] **Step 6: Extend the Lobby page tests**

In `projects/app/src/app/online/lobby-page.spec.ts`, add inside `describe('LobbyPage', …)` (look at how the existing "board while playing" test sets `game.playing`; follow it):

```ts
  it("shows the board's chat button while a game runs, instead of the Lobby's chat", async () => {
    game.playing.set(true);
    const first = await render();
    expect(first.el.querySelector('app-board-chat button.chat-toggle')).not.toBeNull();
    expect(first.el.querySelector('section.chat')).toBeNull();
  });

  it('has no board chat in a solo room', async () => {
    game.playing.set(true);
    lobby.isSolo.set(true);
    const { el } = await render();
    expect(el.querySelector('app-board-chat')).toBeNull();
  });
```

- [ ] **Step 7: Run the tests and the build**

Run: `npx jest --selectProjects app projects/app/src/app/online` then `npx ng build app`
Expected: PASS and a successful build.

- [ ] **Step 8: Commit**

```bash
git add projects/app
git commit -m "feat(app): collapsible chat panel on the online board

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Angular: the My Games screen

**Files:**
- Create: `projects/app/src/app/online/game-labels.ts`
- Create: `projects/app/src/app/online/my-games.service.ts`
- Create: `projects/app/src/app/online/my-games-page.ts`
- Modify: `projects/app/src/app/app.routes.ts`
- Modify: `projects/app/src/app/app.ts`
- Modify: `projects/app/src/app/online/rooms-page.ts`
- Test: `game-labels.spec.ts`, `my-games.service.spec.ts`, `my-games-page.spec.ts` (all in `projects/app/src/app/online/`)
- Modify (tests): `projects/app/src/app/online/rooms-page.spec.ts`, `projects/app/src/app/app.spec.ts`

**Interfaces:**
- Consumes: Task 1's `GameSummary`, `MyGames`; the existing `kingdomDisplayName` (`labels.ts`), `toApiError`, `requireSignIn`.
- Produces:
  - `gameOutcome(game: GameSummary): 'Won' | 'Lost' | 'Draw'`, `gameHeadline(game: GameSummary): string`, `playerLabel(game: GameSummary, seatId: string): string` in `game-labels.ts`.
  - `MyGamesService` (root): `games: Signal<GameSummary[] | null>`, `error: Signal<string | null>`, `load(): Promise<void>`.
  - `MyGamesPage` at `/my-games` (guarded by `requireSignIn`), and a My Games link on the Rooms page for registered players.

- [ ] **Step 1: Write the failing label tests**

Create `projects/app/src/app/online/game-labels.spec.ts`:

```ts
import type { GameSummary } from 'protocol';
import { gameHeadline, gameOutcome, playerLabel } from './game-labels';

const GAME: GameSummary = {
  gameId: 'g1',
  finishedAt: Date.parse('2026-10-15T12:00:00.000Z'),
  players: [
    { seatId: 'seat-0', name: 'Bot 1', kind: 'bot' },
    { seatId: 'seat-1', name: 'Ann', kind: 'human' },
    { seatId: 'seat-2', name: 'Bo', kind: 'human' },
  ],
  result: { endedAt: 40, winningKingdom: 'Wei', winningSeatIds: ['seat-1', 'seat-2'], losingSeatIds: ['seat-0'] },
  yourSeat: 'seat-1',
};

describe('gameOutcome', () => {
  it('is Won when your seat won and Lost when it lost', () => {
    expect(gameOutcome(GAME)).toBe('Won');
    expect(gameOutcome({ ...GAME, yourSeat: 'seat-0' })).toBe('Lost');
  });

  it('is Draw when your seat is on neither side, or there is no result', () => {
    expect(gameOutcome({ ...GAME, result: { endedAt: 3, winningSeatIds: [], losingSeatIds: [] } })).toBe('Draw');
    expect(gameOutcome({ ...GAME, result: null })).toBe('Draw');
  });
});

describe('gameHeadline', () => {
  it('names the winning force', () => {
    expect(gameHeadline(GAME)).toBe('Wei won');
  });

  it('names the winners when no force won', () => {
    expect(gameHeadline({ ...GAME, result: { endedAt: 9, winningSeatIds: ['seat-1', 'seat-2'], losingSeatIds: ['seat-0'] } })).toBe('Ann, Bo won');
  });

  it('says no survivors when nobody won', () => {
    expect(gameHeadline({ ...GAME, result: { endedAt: 9, winningSeatIds: [], losingSeatIds: ['seat-0', 'seat-1', 'seat-2'] } })).toBe('No survivors');
    expect(gameHeadline({ ...GAME, result: null })).toBe('No survivors');
  });
});

describe('playerLabel', () => {
  it('marks your own seat and the bots', () => {
    expect(playerLabel(GAME, 'seat-1')).toBe('Ann (You)');
    expect(playerLabel(GAME, 'seat-2')).toBe('Bo');
    expect(playerLabel(GAME, 'seat-0')).toBe('Bot 1 (Bot)');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects app projects/app/src/app/online/game-labels.spec.ts`
Expected: FAIL (cannot find `./game-labels`).

- [ ] **Step 3: Write the labels**

Create `projects/app/src/app/online/game-labels.ts`:

```ts
import type { GameSummary } from 'protocol';
import { kingdomDisplayName } from '../labels';

// How a finished game went for the player: the badge of a My Games row.
export function gameOutcome(game: GameSummary): 'Won' | 'Lost' | 'Draw' {
  if (game.result?.winningSeatIds.includes(game.yourSeat)) return 'Won';
  if (game.result?.losingSeatIds.includes(game.yourSeat)) return 'Lost';
  return 'Draw';
}

// Who won, in a short sentence: the winning force, else the winners by name.
export function gameHeadline(game: GameSummary): string {
  const result = game.result;
  if (result?.winningKingdom) return `${kingdomDisplayName(result.winningKingdom)} won`;
  const winners = (result?.winningSeatIds ?? []).map((id) => game.players.find((p) => p.seatId === id)?.name ?? id);
  return winners.length > 0 ? `${winners.join(', ')} won` : 'No survivors';
}

// A player's name with who they are: "Ann (You)", "Bot 1 (Bot)".
export function playerLabel(game: GameSummary, seatId: string): string {
  const player = game.players.find((p) => p.seatId === seatId);
  if (!player) return seatId;
  if (seatId === game.yourSeat) return `${player.name} (You)`;
  return player.kind === 'bot' ? `${player.name} (Bot)` : player.name;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest --selectProjects app projects/app/src/app/online/game-labels.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing service tests**

Create `projects/app/src/app/online/my-games.service.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MyGames } from 'protocol';
import { MyGamesService } from './my-games.service';

const GAMES: MyGames = {
  games: [
    {
      gameId: 'g1',
      finishedAt: Date.parse('2026-10-15T12:00:00.000Z'),
      players: [{ seatId: 'seat-0', name: 'Ann', kind: 'human' }],
      result: { endedAt: 5, winningSeatIds: ['seat-0'], losingSeatIds: [] },
      yourSeat: 'seat-0',
    },
  ],
};

describe('MyGamesService', () => {
  let service: MyGamesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MyGamesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('has no list until it loads', () => {
    expect(service.games()).toBeNull();
    expect(service.error()).toBeNull();
  });

  it('loads the finished games', async () => {
    const done = service.load();
    http.expectOne({ method: 'GET', url: '/api/me/games' }).flush(GAMES);
    await done;
    expect(service.games()).toEqual(GAMES.games);
    expect(service.error()).toBeNull();
  });

  it("shows the server's message when it refuses, as for a guest (Review Focus 4)", async () => {
    const done = service.load();
    http.expectOne('/api/me/games').flush({ code: 'registered_only', message: 'Sign in with an account to see your games' }, { status: 403, statusText: 'Forbidden' });
    await done;
    expect(service.games()).toBeNull();
    expect(service.error()).toBe('Sign in with an account to see your games');
  });

  it('keeps the last list and shows an error when a reload fails', async () => {
    const first = service.load();
    http.expectOne('/api/me/games').flush(GAMES);
    await first;
    const second = service.load();
    http.expectOne('/api/me/games').error(new ProgressEvent('error'), { status: 0 });
    await second;
    expect(service.games()).toEqual(GAMES.games);
    expect(service.error()).toBe("Can't reach the server. Check your connection and try again");
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `npx jest --selectProjects app projects/app/src/app/online/my-games.service.spec.ts`
Expected: FAIL (cannot find `./my-games.service`).

- [ ] **Step 7: Write the service**

Create `projects/app/src/app/online/my-games.service.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { GameSummary, MyGames } from 'protocol';
import { toApiError } from '../auth/auth.service';

// The signed-in player's finished games, from GET /api/me/games. The server
// decides who may ask (registered players only); this only shows its answer.
@Injectable({ providedIn: 'root' })
export class MyGamesService {
  private readonly http = inject(HttpClient);
  private readonly _games = signal<GameSummary[] | null>(null);
  private readonly _error = signal<string | null>(null);

  // Newest first; null until the first load succeeds.
  readonly games = this._games.asReadonly();
  readonly error = this._error.asReadonly();

  async load(): Promise<void> {
    try {
      this._games.set((await firstValueFrom(this.http.get<MyGames>('/api/me/games'))).games);
      this._error.set(null);
    } catch (err) {
      this._error.set(toApiError(err).message);
    }
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest --selectProjects app projects/app/src/app/online/my-games.service.spec.ts`
Expected: PASS.

- [ ] **Step 9: Write the failing page tests**

Create `projects/app/src/app/online/my-games-page.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { GameSummary } from 'protocol';
import { MyGamesPage } from './my-games-page';
import { MyGamesService } from './my-games.service';

const WON: GameSummary = {
  gameId: 'g-won',
  finishedAt: Date.parse('2026-10-15T12:00:00.000Z'),
  players: [
    { seatId: 'seat-0', name: 'Bot 1', kind: 'bot' },
    { seatId: 'seat-1', name: 'Ann', kind: 'human' },
  ],
  result: { endedAt: 40, winningKingdom: 'Wei', winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0'] },
  yourSeat: 'seat-1',
};
const LOST: GameSummary = { ...WON, gameId: 'g-lost', yourSeat: 'seat-0' };

describe('MyGamesPage', () => {
  const games = signal<GameSummary[] | null>(null);
  const error = signal<string | null>(null);
  const service = { games, error, load: jest.fn(async () => undefined) };

  async function render() {
    await TestBed.configureTestingModule({ imports: [MyGamesPage], providers: [{ provide: MyGamesService, useValue: service }, provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(MyGamesPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    games.set(null);
    error.set(null);
    service.load.mockClear();
  });

  it('loads the games when it opens, and says it is loading', async () => {
    const { el } = await render();
    expect(service.load).toHaveBeenCalled();
    expect(el.querySelector('mat-card-title')?.textContent?.trim()).toBe('My Games');
    expect(el.querySelector('.loading')?.textContent?.trim()).toBe('Loading games…');
  });

  it('says there are no finished games yet', async () => {
    games.set([]);
    const { el } = await render();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('No finished games yet');
    expect(el.querySelector('.loading')).toBeNull();
  });

  it('shows each game read-only: outcome, who won, the players with you marked, and when', async () => {
    games.set([WON, LOST]);
    const { el } = await render();
    const rows = [...el.querySelectorAll('li.game')];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.outcome')?.textContent?.trim()).toBe('Won');
    expect(rows[1].querySelector('.outcome')?.textContent?.trim()).toBe('Lost');
    expect(rows[0].querySelector('.headline')?.textContent?.trim()).toBe('Wei won');
    expect(rows[0].querySelector('.players')?.textContent?.trim()).toBe('Bot 1 (Bot), Ann (You)');
    expect(rows[1].querySelector('.players')?.textContent?.trim()).toBe('Bot 1 (You), Ann');
    expect(rows[0].querySelector('.when')?.textContent?.trim()).toBeTruthy();
    expect(el.querySelectorAll('li.game button, li.game a')).toHaveLength(0);
  });

  it('shows why when it could not load', async () => {
    error.set('Sign in with an account to see your games');
    const { el } = await render();
    expect(el.querySelector('.error')?.textContent?.trim()).toBe('Sign in with an account to see your games');
  });

  it('links back to Rooms', async () => {
    const { el } = await render();
    expect((el.querySelector('a.back') as HTMLAnchorElement).getAttribute('href')).toBe('/rooms');
    expect(el.querySelector('a.back')?.textContent?.trim()).toBe('Back to Rooms');
  });
});
```

- [ ] **Step 10: Run the tests to verify they fail**

Run: `npx jest --selectProjects app projects/app/src/app/online/my-games-page.spec.ts`
Expected: FAIL (cannot find `./my-games-page`).

- [ ] **Step 11: Write the page**

Create `projects/app/src/app/online/my-games-page.ts`:

```ts
import { DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import type { GameSummary } from 'protocol';
import { gameHeadline, gameOutcome, playerLabel } from './game-labels';
import { MyGamesService } from './my-games.service';

// Your finished games, newest first. Read-only: there is no replay viewer yet.
@Component({
  selector: 'app-my-games-page',
  imports: [DatePipe, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  styleUrl: './online-page.css',
  template: `
    <div class="online-page">
      <mat-card class="online-card" appearance="raised">
        <mat-card-header><mat-card-title>My Games</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (service.error(); as text) {
            <p class="error" role="alert">{{ text }}</p>
          }
          @if (service.games(); as games) {
            @if (games.length === 0) {
              <p class="empty">No finished games yet</p>
            } @else {
              <ul class="room-list">
                @for (game of games; track game.gameId) {
                  <li class="room game">
                    <mat-icon aria-hidden="true">{{ outcome(game) === 'Won' ? 'emoji_events' : 'flag' }}</mat-icon>
                    <span class="outcome badge">{{ outcome(game) }}</span>
                    <span class="host-name">
                      <span class="headline">{{ headline(game) }}</span>
                      <span class="players hint">{{ players(game) }}</span>
                    </span>
                    <span class="when status">{{ game.finishedAt | date: 'medium' }}</span>
                  </li>
                }
              </ul>
            }
          } @else if (!service.error()) {
            <p class="loading">Loading games…</p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          <a mat-button class="back" routerLink="/rooms">Back to Rooms</a>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: `
    .host-name {
      display: flex;
      flex-direction: column;
    }
  `,
})
export class MyGamesPage {
  protected readonly service = inject(MyGamesService);
  protected readonly outcome = gameOutcome;
  protected readonly headline = gameHeadline;

  constructor() {
    void this.service.load();
  }

  protected players(game: GameSummary): string {
    return game.players.map((p) => playerLabel(game, p.seatId)).join(', ');
  }
}
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `npx jest --selectProjects app projects/app/src/app/online/my-games-page.spec.ts`
Expected: PASS.

- [ ] **Step 13: Add the route, the Rooms link and the toolbar highlight**

In `projects/app/src/app/app.routes.ts`, add after the `rooms/:id` route:

```ts
  { path: 'my-games', canActivate: [requireSignIn], loadComponent: () => import('./online/my-games-page').then((m) => m.MyGamesPage) },
```

In `projects/app/src/app/app.ts`, change the `onlineActive` line to:

```ts
  protected readonly onlineActive = computed(() => /^\/(rooms|my-games)(\/|$|\?)/.test(this.url()));
```

In `projects/app/src/app/online/rooms-page.ts`:

1. Add `import { Router, RouterLink } from '@angular/router';` (replacing the `Router` import) and add `RouterLink` to the component's `imports`.
2. In the toolbar `<div class="toolbar">`, after the Play vs Bots button, add:
   ```html
               @if (auth.isRegistered()) {
                 <a mat-button class="my-games" routerLink="/my-games"><mat-icon>history</mat-icon> My Games</a>
               }
   ```

- [ ] **Step 14: Test the link and the highlight**

In `projects/app/src/app/online/rooms-page.spec.ts`, change `provideRouter([{ path: 'rooms/:id', children: [] }])` to `provideRouter([{ path: 'rooms/:id', children: [] }, { path: 'my-games', children: [] }])` in `create()`, and add inside the `describe`:

```ts
  it('links registered players to My Games, and shows guests no link', async () => {
    const registered = await create();
    const link = registered.el.querySelector('a.my-games') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/my-games');
    expect(link.textContent).toContain('My Games');
    TestBed.resetTestingModule();
    me.set(GUS);
    const guest = await create();
    expect(guest.el.querySelector('a.my-games')).toBeNull();
  });
```

In `projects/app/src/app/app.spec.ts`, add after the existing "links Online to /rooms…" test (inside the same `describe`; the router already knows `/my-games` only if the file's `provideRouter([...])` list has it, so add `{ path: 'my-games', children: [] }` to that list):

```ts
  it('keeps Online highlighted on My Games', async () => {
    const { el } = await render('/my-games');
    expect(el.querySelector('a.nav-online')!.classList).toContain('active');
  });
```

- [ ] **Step 15: Run the app tests and the build**

Run: `npx jest --selectProjects app` then `npx ng build app`
Expected: PASS (the whole app project) and a successful build.

- [ ] **Step 16: Commit**

```bash
git add projects/app
git commit -m "feat(app): My Games screen

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Whole-branch verification

**Files:** none unless a check fails.

- [ ] **Step 1: Run every suite**

Run: `npm test`
Expected: every project passes (engine, content, sim, bots, protocol, server, app). Report the counts.

- [ ] **Step 2: Run the Postgres suite**

Run: `npm run db:up` then `npm run test:db`
Expected: the server project passes against Postgres, including the new `chat` and `finished games of a user` contract blocks and the migration. Do not stop any `staffing-*` container (Postgres for this project is on host port 5433). If Docker is not available, say so and do not claim this step.

- [ ] **Step 3: Typecheck and build**

Run: `npm run typecheck:server` then `npx ng build app`
Expected: no type errors and a successful build.

- [ ] **Step 4: Check the source is clean of escapes and the out-of-scope files are untouched**

Run:

```bash
git diff main --name-only | xargs grep -l '\\u' 2>/dev/null
git diff main --name-only | grep -E 'setup/setup.ts|game-board/|game.service.ts|decision-timer.service.ts|play-redirect.ts'
```

Expected: both print nothing.

- [ ] **Step 5: Smoke the real server**

Run the server (`npm run server`, with `DATABASE_URL` pointing at the Compose Postgres if the config needs it) and check with `curl` that `GET /api/me/games` without a cookie answers `401` with `{"code":"not_signed_in", …}`. Stop the server afterwards. The two-browser check of chat is not part of this stage's automated verification; say it has not been run.

- [ ] **Step 6: Commit any fixes**

If any step needed a fix, commit it with a message naming what was fixed and the `Co-Authored-By` line. Otherwise there is nothing to commit.
