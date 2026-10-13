# Backend Stage 3: Rooms and Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open rooms that registered users host and anyone signed in joins, a lobby kept live over a WebSocket (members, host controls, host rules), and the Angular Rooms and Lobby screens.

**Architecture:**

- `protocol` gains the room wire types, the socket message types and their TypeBox schemas.
- The server keeps every live room in memory in a `RoomService`. Each room has a serial queue, and every input follows the same steps: check, persist (`rooms` and `room_players` tables), commit in memory, publish.
- Room rules that need no I/O (names, capacity, who the host passes to) live in a pure `Room` class.
- HTTP routes cover listing, creating, joining and reading rooms. A `ws` server on `/api/ws`, attached to Fastify's HTTP server, handles the handshake, heartbeat and lobby commands.
- The Angular app gets `RoomsService` (polling), `SocketService` (reconnecting socket), `LobbyService` and the Rooms and Lobby screens, behind a sign-in guard.

**Tech Stack:** Node 24, TypeScript ~6.0, Fastify 5, `ws` 8, @sinclair/typebox 0.34 (`TypeCompiler` for socket messages), Kysely 0.28 + pg 8, Postgres 17, Jest 30 + ts-jest, Angular 22 + Material.

**Spec:** `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`. The sections that apply: "Rooms" (Screens, Lifecycle, Names, Rules, Host rules), "Socket protocol", "Database" (`rooms`, `room_players`), "HTTP API" (the room routes), "Angular changes", "Testing", and "Stages" item 3.

**Branch:** `feat/backend-stage-3-rooms-lobby`

## Global Constraints

- **Everything in Stage 2's Global Constraints still holds**, in particular the CommonJS-loadable dependency pins (`@sinclair/typebox` ^0.34, `kysely` ~0.28, `@fastify/type-provider-typebox` ^5, `@fastify/cookie` 11.0.2, the `light-my-request` 6.6.0 override).
- **`ws` ^8** (CommonJS) with `@types/ws`. Use no Fastify WebSocket plugin.
- **The local screens stay as they are.** Never modify `projects/app/src/app/setup/setup.ts`, `projects/app/src/app/game-board/**`, `projects/app/src/app/play-redirect.ts` or `projects/app/src/app/game.service.ts`. The online screens are new components on their own routes.
- **What `protocol` may import:** type-only imports from `engine` (`GameRules`, `GameResult`). The main entry still has no runtime TypeBox import.
- **Database rows never cross the wire.** Rows map to records in `persistence/postgres/mappers.ts`. Records and the in-memory `Room` map to wire shapes only in `server/src/views/`. User ids are never sent in a `RoomSnapshot`.
- **Timings:**
  - host away in the lobby: 60 s (`HOST_AWAY_MS`);
  - lobby idle close: 30 min (`LOBBY_IDLE_MS`);
  - room housekeeping tick: every 5 s;
  - socket ping: every 15 s, and two missed pongs drop the connection;
  - hello timeout: 10 s;
  - client reconnect backoff: 1 s, doubling, up to 15 s;
  - Rooms list poll: every 5 s.
- **Names:**
  - A room name is normalized with `normalizeDisplayName`.
  - It is unique among the room's current members, bots included, compared case-insensitively.
  - Bots take the first free name in "Bot 1", "Bot 2", and so on.
- **The host is always a registered human.** Creating an open room needs a registered user.
- **User-facing text, verbatim:**
  - "That name is already taken in this room. Choose another." (`name_taken`)
  - "Sign in to host a room" (the hint on a disabled Create Room button)
  - "No rooms yet"
  - Rooms list statuses: "Waiting for Players", "Full", "In Progress"
  - "The host removed you from the room"
  - "The host closed the room"
  - "Hing is now the host" (the `{name} is now the host` pattern)
  - "Waiting for Hing to return…" (the `Waiting for {name} to return…` pattern)
  - "This room is open in another tab"
  - "Please reload to get the latest version"
  - "Reconnecting…"
- **UI text** follows `CLAUDE.md`: Title Case for titles, buttons and labels ("Create Room", "Add Bot", "Make Host", "Leave Room", "Your Name"), and sentence case for messages and hints.
- **Angular style:** standalone components, signals, lazy `loadComponent` routes, and Angular Material as the auth screens use it.
- **Code style:** use bracket access on index signatures (`noPropertyAccessFromIndexSignature`). ts-jest only transpiles (the root tsconfig sets `isolatedModules`), so tests don't catch type errors. **Run `npm run typecheck:server` after every server or protocol task**, and run `npx ng build app` after every Angular task.
- **Escapes:** where this plan writes `…`, write that character itself. Never use a `\u` escape. After writing a file that contains one, check with `grep -c '\\u2026' <file>`, which must print `0`.
- **Commits:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Decisions This Plan Makes (spec is silent, or the stage boundary needs one)

1. **Stage boundary.** Each of the following arrives in a later stage, with what it depends on:
   - Start Game (`lobby.start`), seating and the `games` table: Stage 4, with the `GameRunner`;
   - solo rooms and Play vs Bots: Stage 4;
   - chat: Stage 5.

   In this stage a room is always in `lobby`, and the Lobby has no Start Game button. The types already carry `status: 'playing'`, `lastResult` and `botControlled`, so Stage 4 adds no new fields.
2. **One live open room per user.** Creating or joining an open room while already a member of another non-closed open room fails with `already_in_room` ("You're already in another room. Leave it first"). This keeps one person from piling up memberships and ghost hosts. Rejoining your own room is unaffected.
3. **Lobbies survive a restart.** On startup, `RoomService.restore()` reloads every room in `lobby` from the store, with every human away (bots count as connected). The normal host-away and idle rules then apply. A restored room with no human members closes.
4. **What counts as idle.** A lobby is idle when no input has arrived for 30 minutes. Inputs are a join, a socket `hello` and a lobby command. A host transfer made by the timer doesn't count as input.
5. **Who the host role passes to.** It passes to a registered human other than the host: a connected one first, then the earliest joined.
   - **Host offline for 60 s:** only connected candidates count. With none, the host keeps the role and the Lobby shows "Waiting for {host} to return…".
   - **Host leaves:** away candidates also count. The room closes only when no registered member is left.
6. **New server message `room.left { reason }`.** It tells a connection that it is no longer in the room, just before the server closes it. The reasons and their texts:
   - `removed`: "The host removed you from the room"
   - `host_left`: "The host closed the room"
   - `idle`: "The room closed after 30 minutes without activity"
   - `left`: sent after the member's own leave; no notice is shown
7. **Seat limits come from the server.** `GET /api/rooms` answers `{ rooms, seatLimits }`, and `RoomSnapshot` carries `seatLimits`. The UI never computes the maximum itself. The server uses min 2 and max `kingdomWarMaxSeats(buildContentRegistry())`.
8. **Reaching the Rooms screen.** A new toolbar item, **Online** (icon `public`), links to `/rooms`. The online Play screen, with Play vs Bots, arrives with solo rooms in Stage 4.
9. **`PROTOCOL_VERSION` stays 1.** Nothing has been deployed yet.
10. **New error codes**, with their messages and HTTP statuses:

    | Code | HTTP | Message |
    |---|---|---|
    | `version` | n/a | Please reload to get the latest version |
    | `not_member` | 403 | You're not in this room |
    | `not_host` | 403 | Only the host can do that |
    | `room_full` | 409 | This room is full |
    | `in_progress` | 409 | This room is already playing |
    | `name_taken` | 409 | That name is already taken in this room. Choose another. |
    | `host_must_be_registered` | 403 | Only registered players can host a room |
    | `already_in_room` | 409 | You're already in another room. Leave it first |
    | `invalid_seat_count` | 400 | That seat count doesn't fit this room |
    | `invalid_message` | n/a | That request was not understood |

    The existing `not_found` (404) and `invalid_name` (400) are reused.
11. **Socket limits.** A message may be at most 16 KiB. The first message must be a `hello`, sent within 10 s. A `hello` whose `protocolVersion` differs gets `version` and the socket closes, checked before the schema so any client version gets that answer. Any message before a `hello` gets `invalid_message`.
12. **The host can't remove themselves.** A `lobby.removePlayer` naming the host is `invalid_message`. The host uses Leave Room instead.
13. **Kick and leave are final for that membership.** A removed or departed member's `room_players` row gets `left_at`. Joining again creates a new membership, subject to the normal join rules.

## Review Focus

1. **Two people join for the last seat at the same moment.** Exactly one gets in, and the other gets `room_full`, never a room with more members than seats. Test: Task 5.
2. **Names compared loosely.** `" ann "` collides with `Ann`, and `"bot 1"` collides with the bot `Bot 1`, so both get `name_taken`. Once a member leaves, their name is free again. Tests: the store contract (Task 2, which runs against Postgres in Task 3) and Task 5 (service).
3. **The host leaves while only guests and bots remain.** The room closes. Each guest's socket receives `room.left { reason: 'host_left' }` and then closes, and the room drops out of `GET /api/rooms`. Test: Task 5.
4. **A second tab, then the first tab's late close.** The old connection receives `replaced` and closes. Its close event, which arrives after the new connection registered, must not mark the member away. Tests: Task 5 (unit) and Task 7 (end to end).
5. **Malformed socket input.** All of these get `error invalid_message` (with `reqId` when the client sent one) and the socket stays open:
   - non-JSON text;
   - a binary frame;
   - an unknown `type`;
   - extra fields;
   - a command before `hello`.

   A message over 16 KiB closes the socket (the `ws` library does this). Test: Task 7.

---

### Task 1: Protocol: room and socket types, schemas and error codes

**Files:**
- Modify:
  - `projects/protocol/src/limits.ts`
  - `projects/protocol/src/errors.ts`
  - `projects/protocol/src/public-api.ts`
  - `projects/protocol/src/schemas/index.ts`
  - `jest.config.js` (the `protocol` and `server` projects map `engine` and `content`)
- Create:
  - `projects/protocol/src/rooms.ts`
  - `projects/protocol/src/socket.ts`
  - `projects/protocol/src/schemas/rooms.ts`
  - `projects/protocol/src/schemas/socket.ts`
- Test: `projects/protocol/src/schemas/rooms.spec.ts`, `projects/protocol/src/schemas/socket.spec.ts`

**Interfaces:**
- Consumes: `GameRules`, `GameResult` (types) from `engine`; the Stage 2 `ErrorCode` and `ERROR_MESSAGES`.
- Produces, from `protocol`:
  - `MIN_SEATS = 2` and `REQ_ID_MAX = 64`
  - types `RoomVisibility`, `RoomStatus`, `MemberKind`, `SeatLimits`, `RoomMemberView`, `RoomSnapshot`, `RoomListItem`, `RoomList`, `RoomCreated`, `CreateRoomBody` and `JoinRoomBody`
  - types `ClientMessage`, `HelloMessage`, `RoomCommand` and `RoomRequest` (a `RoomCommand` without `reqId`)
  - types `WelcomeMessage`, `RoomUpdatedMessage`, `RoomLeftReason`, `RoomLeftMessage`, `ReplacedMessage`, `AckMessage`, `ErrorMessage` and `ServerMessage`
  - `ROOM_LEFT_MESSAGES`, `REPLACED_MESSAGE` and `SOCKET_PATH = '/api/ws'`
  - the new `ErrorCode` members
- Produces, from `protocol/schemas`: `SeatCountSchema`, `RoomRulesSchema`, `RoomIdSchema`, `RoomParamsSchema`, `CreateRoomBodySchema`, `JoinRoomBodySchema` and `ClientMessageSchema` (plus one schema per client message).

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/backend-stage-3-rooms-lobby
```

- [ ] **Step 2: Write the failing schema tests**

Create `projects/protocol/src/schemas/rooms.spec.ts`:

```ts
import { Value } from '@sinclair/typebox/value';
import { CreateRoomBodySchema, JoinRoomBodySchema, RoomParamsSchema, RoomRulesSchema } from './index';

describe('room schemas', () => {
  it('accepts a create-room body', () => {
    expect(Value.Check(CreateRoomBodySchema, { seatCount: 4, rules: { firstRevealDraw: true }, displayName: 'Ann' })).toBe(true);
    expect(Value.Check(CreateRoomBodySchema, { seatCount: 4, rules: {}, displayName: 'Ann' })).toBe(true);
  });

  it('refuses a fractional seat count or a missing field', () => {
    expect(Value.Check(CreateRoomBodySchema, { seatCount: 4.5, rules: {}, displayName: 'Ann' })).toBe(false);
    expect(Value.Check(CreateRoomBodySchema, { seatCount: 4, displayName: 'Ann' })).toBe(false);
  });

  it('refuses unknown rule keys and non-boolean rule values', () => {
    expect(Value.Check(RoomRulesSchema, { firstRevealDraw: true, extra: 1 })).toBe(false);
    expect(Value.Check(RoomRulesSchema, { firstRevealDraw: 'yes' })).toBe(false);
  });

  it('requires a display name to join', () => {
    expect(Value.Check(JoinRoomBodySchema, {})).toBe(false);
    expect(Value.Check(JoinRoomBodySchema, { displayName: 'Bo' })).toBe(true);
  });

  it('accepts only a uuid as a room id', () => {
    expect(Value.Check(RoomParamsSchema, { id: '5b0d6c1e-2f43-4a8e-9a57-0c7d0c4f8e21' })).toBe(true);
    expect(Value.Check(RoomParamsSchema, { id: 'room-1' })).toBe(false);
  });
});
```

Create `projects/protocol/src/schemas/socket.spec.ts`:

```ts
import { Value } from '@sinclair/typebox/value';
import { ClientMessageSchema } from './index';

const ROOM_ID = '5b0d6c1e-2f43-4a8e-9a57-0c7d0c4f8e21';
const valid = (message: unknown) => Value.Check(ClientMessageSchema, message);

describe('client message schema', () => {
  it('accepts every client message, with or without a reqId', () => {
    expect(valid({ type: 'hello', protocolVersion: 1, roomId: ROOM_ID })).toBe(true);
    expect(valid({ type: 'lobby.addBot', reqId: 'r1' })).toBe(true);
    expect(valid({ type: 'lobby.removePlayer', reqId: 'r2', playerId: 'p1' })).toBe(true);
    expect(valid({ type: 'lobby.setRules', seatCount: 5, rules: { firstRevealDraw: false } })).toBe(true);
    expect(valid({ type: 'lobby.makeHost', playerId: 'p1' })).toBe(true);
    expect(valid({ type: 'room.leave', reqId: 'r3' })).toBe(true);
  });

  it('refuses an unknown type, extra fields and missing fields', () => {
    expect(valid({ type: 'lobby.start' })).toBe(false);
    expect(valid({ type: 'lobby.addBot', extra: true })).toBe(false);
    expect(valid({ type: 'lobby.removePlayer' })).toBe(false);
    expect(valid({ type: 'hello', protocolVersion: 1 })).toBe(false);
  });

  it('refuses a reqId that is empty or longer than 64 characters', () => {
    expect(valid({ type: 'lobby.addBot', reqId: '' })).toBe(false);
    expect(valid({ type: 'lobby.addBot', reqId: 'x'.repeat(65) })).toBe(false);
  });

  it('refuses values that are not objects', () => {
    expect(valid(null)).toBe(false);
    expect(valid('hello')).toBe(false);
    expect(valid([{ type: 'room.leave' }])).toBe(false);
  });
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `npx jest --selectProjects protocol`
Expected: FAIL. `CreateRoomBodySchema` and `ClientMessageSchema` are not exported.

- [ ] **Step 4: Add the limits and error codes**

Append to `projects/protocol/src/limits.ts`:

```ts
// The fewest seats a room may have. The most depends on the content, so the
// server sends it as SeatLimits.
export const MIN_SEATS = 2;
// The longest request id a client may attach to a socket message.
export const REQ_ID_MAX = 64;
```

Replace `projects/protocol/src/errors.ts` with:

```ts
import { DISPLAY_NAME_MAX, PASSWORD_MIN } from './limits';

export type ErrorCode =
  | 'invalid_body'
  | 'invalid_name'
  | 'weak_password'
  | 'email_taken'
  | 'invalid_credentials'
  | 'invalid_reset_token'
  | 'not_signed_in'
  | 'rate_limited'
  | 'bad_origin'
  | 'unsupported_media_type'
  | 'not_found'
  | 'internal'
  | 'version'
  | 'not_member'
  | 'not_host'
  | 'room_full'
  | 'in_progress'
  | 'name_taken'
  | 'host_must_be_registered'
  | 'already_in_room'
  | 'invalid_seat_count'
  | 'invalid_message';

// Every error the server sends: a stable code for code, a message for people.
export interface ErrorBody {
  code: ErrorCode;
  message: string;
}

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  invalid_body: 'Some fields are missing or invalid',
  invalid_name: `Names need 1 to ${DISPLAY_NAME_MAX} characters`,
  weak_password: `Passwords need at least ${PASSWORD_MIN} characters`,
  email_taken: 'That email already has an account',
  invalid_credentials: 'Email or password is incorrect',
  invalid_reset_token: 'This reset link is invalid or has expired',
  not_signed_in: 'Please sign in first',
  rate_limited: 'Too many attempts. Wait a few minutes and try again',
  bad_origin: 'Request blocked',
  unsupported_media_type: 'Requests must be sent as JSON',
  not_found: 'Not found',
  internal: 'Something went wrong. Please try again',
  version: 'Please reload to get the latest version',
  not_member: "You're not in this room",
  not_host: 'Only the host can do that',
  room_full: 'This room is full',
  in_progress: 'This room is already playing',
  name_taken: 'That name is already taken in this room. Choose another.',
  host_must_be_registered: 'Only registered players can host a room',
  already_in_room: "You're already in another room. Leave it first",
  invalid_seat_count: "That seat count doesn't fit this room",
  invalid_message: 'That request was not understood',
};
```

- [ ] **Step 5: Add the schemas**

Create `projects/protocol/src/schemas/rooms.ts`:

```ts
import { Type } from '@sinclair/typebox';
import { DISPLAY_NAME_MAX } from '../limits';

// Shape checks only. The server checks the seat count against its limits and
// normalizes the name, so it can answer with a specific error code.
const DisplayName = Type.String({ maxLength: DISPLAY_NAME_MAX * 4 });

export const SeatCountSchema = Type.Integer({ minimum: 0, maximum: 100 });
// The engine's GameRules. Unknown keys never reach the store: the socket
// refuses them, and Fastify strips them from HTTP bodies.
export const RoomRulesSchema = Type.Object({ firstRevealDraw: Type.Optional(Type.Boolean()) }, { additionalProperties: false });
export const RoomIdSchema = Type.String({ pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' });
export const RoomParamsSchema = Type.Object({ id: RoomIdSchema });

export const CreateRoomBodySchema = Type.Object({ seatCount: SeatCountSchema, rules: RoomRulesSchema, displayName: DisplayName });
export const JoinRoomBodySchema = Type.Object({ displayName: DisplayName });
```

Create `projects/protocol/src/schemas/socket.ts`:

```ts
import { Type } from '@sinclair/typebox';
import { REQ_ID_MAX } from '../limits';
import { RoomIdSchema, RoomRulesSchema, SeatCountSchema } from './rooms';

// Every client message is an object with a `type`, and may carry a `reqId`
// that the server echoes in its `ack` or `error`. Extra fields are refused.
const ReqId = Type.Optional(Type.String({ minLength: 1, maxLength: REQ_ID_MAX }));
const PlayerId = Type.String({ minLength: 1, maxLength: 64 });
const strict = { additionalProperties: false } as const;

export const HelloSchema = Type.Object({ type: Type.Literal('hello'), reqId: ReqId, protocolVersion: Type.Integer(), roomId: RoomIdSchema }, strict);
export const AddBotSchema = Type.Object({ type: Type.Literal('lobby.addBot'), reqId: ReqId }, strict);
export const RemovePlayerSchema = Type.Object({ type: Type.Literal('lobby.removePlayer'), reqId: ReqId, playerId: PlayerId }, strict);
export const SetRulesSchema = Type.Object({ type: Type.Literal('lobby.setRules'), reqId: ReqId, seatCount: SeatCountSchema, rules: RoomRulesSchema }, strict);
export const MakeHostSchema = Type.Object({ type: Type.Literal('lobby.makeHost'), reqId: ReqId, playerId: PlayerId }, strict);
export const LeaveSchema = Type.Object({ type: Type.Literal('room.leave'), reqId: ReqId }, strict);

export const ClientMessageSchema = Type.Union([HelloSchema, AddBotSchema, RemovePlayerSchema, SetRulesSchema, MakeHostSchema, LeaveSchema]);
```

Replace `projects/protocol/src/schemas/index.ts` with:

```ts
// Server-side entry: TypeBox schemas for validating requests. The app never
// imports this, so TypeBox stays out of the browser bundle.
export * from './auth';
export * from './rooms';
export * from './socket';
```

- [ ] **Step 6: Add the wire types**

Create `projects/protocol/src/rooms.ts`:

```ts
import type { Static } from '@sinclair/typebox';
import type { GameResult, GameRules } from 'engine';
import type { CreateRoomBodySchema, JoinRoomBodySchema } from './schemas/rooms';

export type RoomVisibility = 'open' | 'solo';
export type RoomStatus = 'lobby' | 'playing' | 'closed';
export type MemberKind = 'human' | 'bot';

export type CreateRoomBody = Static<typeof CreateRoomBodySchema>;
export type JoinRoomBody = Static<typeof JoinRoomBodySchema>;

// How many seats a room may have. The server decides; clients only offer it.
export interface SeatLimits {
  min: number;
  max: number;
}

export interface RoomMemberView {
  playerId: string;
  name: string;
  kind: MemberKind;
  isRegistered: boolean;
  connected: boolean;
  // A bot is playing this human's seat (from Stage 4); false in the lobby.
  botControlled: boolean;
}

// A room as every member sees it. Nothing in it is secret: no user ids.
export interface RoomSnapshot {
  id: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  seatCount: number;
  rules: GameRules;
  hostPlayerId: string | null;
  // In join order. Seat order is only drawn when a game starts.
  members: RoomMemberView[];
  lastResult: GameResult | null;
  seatLimits: SeatLimits;
}

export interface RoomListItem {
  id: string;
  visibility: RoomVisibility;
  hostName: string | null;
  memberCount: number;
  capacity: number;
  status: RoomStatus;
  youAreMember: boolean;
}

// GET /api/rooms: your rooms first, then the other open rooms, newest first.
export interface RoomList {
  rooms: RoomListItem[];
  seatLimits: SeatLimits;
}

export interface RoomCreated {
  id: string;
}
```

Create `projects/protocol/src/socket.ts`:

```ts
import type { Static } from '@sinclair/typebox';
import type { ErrorCode } from './errors';
import type { RoomSnapshot } from './rooms';
import type { ClientMessageSchema } from './schemas/socket';

export const SOCKET_PATH = '/api/ws';

// Every message a client may send.
export type ClientMessage = Static<typeof ClientMessageSchema>;
export type HelloMessage = Extract<ClientMessage, { type: 'hello' }>;
// What a member asks for once connected.
export type RoomCommand = Exclude<ClientMessage, HelloMessage>;
// A command before the client numbers it.
export type RoomRequest = RoomCommand extends infer C ? (C extends unknown ? Omit<C, 'reqId'> : never) : never;

export interface WelcomeMessage {
  type: 'welcome';
  you: { playerId: string; seatId: string | null };
  room: RoomSnapshot;
  // The running game: always null until online games arrive (Stage 4).
  game: null;
}

export interface RoomUpdatedMessage {
  type: 'room.updated';
  room: RoomSnapshot;
}

export type RoomLeftReason = 'left' | 'removed' | 'host_left' | 'idle';

// This connection is no longer in the room; the server closes it next.
export interface RoomLeftMessage {
  type: 'room.left';
  reason: RoomLeftReason;
}

// A newer connection for the same member took over; the server closes this one next.
export interface ReplacedMessage {
  type: 'replaced';
}

export interface AckMessage {
  type: 'ack';
  reqId: string;
}

export interface ErrorMessage {
  type: 'error';
  reqId?: string;
  code: ErrorCode;
  message: string;
}

export type ServerMessage = WelcomeMessage | RoomUpdatedMessage | RoomLeftMessage | ReplacedMessage | AckMessage | ErrorMessage;

export const ROOM_LEFT_MESSAGES: Record<RoomLeftReason, string> = {
  left: 'You left the room',
  removed: 'The host removed you from the room',
  host_left: 'The host closed the room',
  idle: 'The room closed after 30 minutes without activity',
};

export const REPLACED_MESSAGE = 'This room is open in another tab';
```

Replace `projects/protocol/src/public-api.ts` with:

```ts
// Browser-safe entry: types, constants and pure functions. No runtime imports
// from TypeBox (see `protocol/schemas` for the schemas).
export * from './version';
export * from './limits';
export * from './names';
export * from './errors';
export * from './auth';
export * from './rooms';
export * from './socket';
```

- [ ] **Step 7: Map `engine` and `content` for the protocol and server tests**

In `jest.config.js`, give the `protocol` project a `moduleNameMapper`:

```js
      moduleNameMapper: {
        '^engine$': '<rootDir>/../../engine/src/public-api.ts',
      },
```

In the `server` project's `moduleNameMapper`, add these two lines above the `protocol` lines (the server reads the content registry from Task 6 on):

```js
        '^engine$': '<rootDir>/../../engine/src/public-api.ts',
        '^content$': '<rootDir>/../../content/src/public-api.ts',
```

- [ ] **Step 8: Run the tests and the type check**

Run: `npx jest --selectProjects protocol && npm run typecheck:server`
Expected: PASS, and the type check prints nothing.

- [ ] **Step 9: Commit**

```bash
git add projects/protocol jest.config.js
git commit -m "feat(protocol): room and socket wire types, schemas and error codes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Room records, the repository contract and the in-memory store

**Files:**
- Modify:
  - `projects/server/src/persistence/records.ts`
  - `projects/server/src/persistence/repositories.ts`
  - `projects/server/src/persistence/repositoryContract.ts`
  - `projects/server/src/persistence/memory/memoryRepositories.ts`
- Test: the contract, through `projects/server/src/persistence/memory/memoryRepositories.spec.ts` (unchanged)

**Interfaces:**
- Consumes: `RoomVisibility`, `RoomStatus` and `MemberKind` from `protocol`; `GameRules` from `engine`.
- Produces:
  - `RoomRecord { id, visibility, status, seatCount, rules: GameRules, hostPlayerId: string | null, createdAt, updatedAt }`
  - `RoomPlayerRecord { id, roomId, userId: string | null, kind: MemberKind, displayName, joinedAt, leftAt: Date | null }`
  - `RoomChanges = Partial<Pick<RoomRecord, 'status' | 'seatCount' | 'rules' | 'hostPlayerId'>>`
  - `LiveRoomRecord { room: RoomRecord; players: RoomPlayerRecord[] }`
  - `class NameTakenError`
  - `interface RoomRepository`, with these methods:
    - `create({ visibility, seatCount, rules, now }): Promise<RoomRecord>`. The room starts in `lobby` with `hostPlayerId: null`.
    - `update(roomId, changes: RoomChanges, now): Promise<void>`. It also sets `updatedAt`.
    - `addPlayer({ roomId, userId, kind, displayName, now }): Promise<RoomPlayerRecord>`. It throws `NameTakenError` when a current member has the name, compared case-insensitively. It throws a plain `Error` for a second current membership of one user.
    - `markLeft(playerId, now): Promise<void>`.
    - `listLive(): Promise<LiveRoomRecord[]>`. It returns every room not `closed`, each with its current members in join order.
  - `Repositories.rooms: RoomRepository`
  - Deleting an idle guest keeps their memberships, with `userId: null`.

- [ ] **Step 1: Add the records and the repository interface**

Append to `projects/server/src/persistence/records.ts` (and add the two imports at the top):

```ts
import type { GameRules } from 'engine';
import type { MemberKind, RoomStatus, RoomVisibility, UserKind } from 'protocol';
```

(Replace the existing `import type { UserKind } from 'protocol';` line with the second import.)

```ts
export interface RoomRecord {
  id: string;
  visibility: RoomVisibility;
  status: RoomStatus;
  seatCount: number;
  rules: GameRules;
  // A registered human member; null only while a room is being created, and for solo rooms.
  hostPlayerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// A member of a room: a person or a bot. One row per membership: leaving sets
// `leftAt`, and joining again adds a new row.
export interface RoomPlayerRecord {
  id: string;
  roomId: string;
  userId: string | null; // null for bots, and for a deleted guest
  kind: MemberKind;
  displayName: string;
  joinedAt: Date;
  leftAt: Date | null;
}
```

In `projects/server/src/persistence/repositories.ts`, change the records import to:

```ts
import { ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserRecord } from './records';
```

and add, after `EmailTakenError`:

```ts
export class NameTakenError extends Error {
  constructor() {
    super('A current member of the room already has that name');
    this.name = 'NameTakenError';
  }
}
```

and, after `ResetTokenRepository`:

```ts
export type RoomChanges = Partial<Pick<RoomRecord, 'status' | 'seatCount' | 'rules' | 'hostPlayerId'>>;

export interface LiveRoomRecord {
  room: RoomRecord;
  // Current members (leftAt null), in join order.
  players: RoomPlayerRecord[];
}

export interface RoomRepository {
  // A new room in 'lobby' with no host yet.
  create(input: { visibility: RoomRecord['visibility']; seatCount: number; rules: RoomRecord['rules']; now: Date }): Promise<RoomRecord>;
  // Applies the changes and sets updatedAt.
  update(roomId: string, changes: RoomChanges, now: Date): Promise<void>;
  // Throws NameTakenError when a current member has the name (compared
  // case-insensitively), and an Error when the user is already a current member.
  addPlayer(input: { roomId: string; userId: string | null; kind: RoomPlayerRecord['kind']; displayName: string; now: Date }): Promise<RoomPlayerRecord>;
  markLeft(playerId: string, now: Date): Promise<void>;
  // Every room that is not closed, with its current members.
  listLive(): Promise<LiveRoomRecord[]>;
}
```

and add `rooms: RoomRepository;` to `Repositories`, after `resetTokens`.

- [ ] **Step 2: Write the failing contract tests**

In `projects/server/src/persistence/repositoryContract.ts`, change the repositories import to:

```ts
import { EmailTakenError, NameTakenError, RepositoryHarness } from './repositories';
```

and add this `describe` block inside `describeRepositoryContract`, after the `transactions` block:

```ts
  describe('rooms', () => {
    const newRoom = (rules = { firstRevealDraw: true }) => repos().rooms.create({ visibility: 'open', seatCount: 4, rules, now: NOW });
    const addHuman = (roomId: string, userId: string, displayName: string, at = NOW) =>
      repos().rooms.addPlayer({ roomId, userId, kind: 'human', displayName, now: at });
    const addBot = (roomId: string, displayName: string, at = NOW) => repos().rooms.addPlayer({ roomId, userId: null, kind: 'bot', displayName, now: at });
    const live = async (roomId: string) => (await repos().rooms.listLive()).find((entry) => entry.room.id === roomId);

    it('creates a room in the lobby with no host yet', async () => {
      const room = await newRoom();
      expect(room).toEqual({
        id: expect.any(String),
        visibility: 'open',
        status: 'lobby',
        seatCount: 4,
        rules: { firstRevealDraw: true },
        hostPlayerId: null,
        createdAt: NOW,
        updatedAt: NOW,
      });
      expect((await live(room.id))?.room).toEqual(room);
    });

    it('adds members and lists them in join order, a bot with no user', async () => {
      const room = await newRoom();
      const ann = await registered();
      const host = await addHuman(room.id, ann.id, 'Ann', minutes(1));
      const bot = await addBot(room.id, 'Bot 1', minutes(2));
      expect(host).toEqual({ id: expect.any(String), roomId: room.id, userId: ann.id, kind: 'human', displayName: 'Ann', joinedAt: minutes(1), leftAt: null });
      expect(bot).toMatchObject({ userId: null, kind: 'bot', displayName: 'Bot 1' });
      expect((await live(room.id))?.players).toEqual([host, bot]);
    });

    it('updates the status, seat count, rules and host, and the update time', async () => {
      const room = await newRoom();
      const host = await addHuman(room.id, (await registered()).id, 'Ann');
      await repos().rooms.update(room.id, { hostPlayerId: host.id, seatCount: 6, rules: { firstRevealDraw: false } }, minutes(3));
      expect((await live(room.id))?.room).toMatchObject({ hostPlayerId: host.id, seatCount: 6, rules: { firstRevealDraw: false }, status: 'lobby', updatedAt: minutes(3) });
    });

    it('refuses a name a current member has, in any case (Review Focus 2)', async () => {
      const room = await newRoom();
      await addHuman(room.id, (await registered()).id, 'Ann');
      await addBot(room.id, 'Bot 1');
      await expect(addHuman(room.id, (await registered()).id, 'ANN')).rejects.toBeInstanceOf(NameTakenError);
      await expect(addHuman(room.id, (await registered()).id, 'bot 1')).rejects.toBeInstanceOf(NameTakenError);
    });

    it('allows the same name in another room', async () => {
      const first = await newRoom();
      const second = await newRoom();
      await addHuman(first.id, (await registered()).id, 'Ann');
      await expect(addHuman(second.id, (await registered()).id, 'Ann')).resolves.toMatchObject({ displayName: 'Ann' });
    });

    it('frees a name once its member has left, and drops them from the live list', async () => {
      const room = await newRoom();
      const user = await registered();
      const ann = await addHuman(room.id, user.id, 'Ann');
      await repos().rooms.markLeft(ann.id, minutes(1));
      expect((await live(room.id))?.players).toEqual([]);
      await expect(addHuman(room.id, user.id, 'Ann', minutes(2))).resolves.toMatchObject({ displayName: 'Ann', leftAt: null });
    });

    it('lets exactly one of two racing joins with the same name win', async () => {
      const room = await newRoom();
      const [a, b] = [await registered(), await registered()];
      const results = await Promise.allSettled([addHuman(room.id, a.id, 'Cao Cao'), addHuman(room.id, b.id, 'cao cao')]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(NameTakenError);
    });

    it('refuses a second current membership for one user', async () => {
      const room = await newRoom();
      const user = await registered();
      await addHuman(room.id, user.id, 'Ann');
      await expect(addHuman(room.id, user.id, 'Annie')).rejects.toThrow();
    });

    it('leaves closed rooms out of the live list', async () => {
      const room = await newRoom();
      await repos().rooms.update(room.id, { status: 'closed' }, minutes(1));
      expect(await live(room.id)).toBeUndefined();
    });

    it("keeps a deleted guest's membership, with no user", async () => {
      const longAgo = new Date('2025-12-01T00:00:00.000Z');
      const room = await newRoom();
      const guest = await repos().users.createGuest({ displayName: 'Zhou Yu', now: longAgo });
      await addHuman(room.id, guest.id, 'Zhou Yu');
      await repos().users.deleteIdleGuests(new Date('2026-01-01T00:00:00.000Z'));
      expect((await live(room.id))?.players).toEqual([expect.objectContaining({ displayName: 'Zhou Yu', userId: null, kind: 'human' })]);
    });

    it('rolls back a room created in a failed transaction', async () => {
      const failure = new Error('boom');
      let roomId = '';
      await expect(
        repos().transaction(async (tx) => {
          const room = await tx.rooms.create({ visibility: 'open', seatCount: 4, rules: {}, now: NOW });
          roomId = room.id;
          await tx.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: NOW });
          throw failure;
        })
      ).rejects.toBe(failure);
      expect(await live(roomId)).toBeUndefined();
    });
  });
```

- [ ] **Step 3: Run them and see them fail**

Run: `npx jest --selectProjects server persistence/memory`
Expected: FAIL. `repos().rooms` is undefined.

- [ ] **Step 4: Implement the in-memory rooms**

In `projects/server/src/persistence/memory/memoryRepositories.ts`:

1. Change the imports to:

```ts
import { randomUUID } from 'node:crypto';
import { ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserRecord } from '../records';
import {
  EmailTakenError,
  LiveRoomRecord,
  NameTakenError,
  Repositories,
  ResetTokenRepository,
  RoomChanges,
  RoomRepository,
  SessionRepository,
  UserRepository,
} from '../repositories';
```

2. Replace the `Store` interface, `TABLES`, `createMemoryRepositories` and `repositoriesOver` with:

```ts
interface Store {
  users: Map<string, UserRecord>;
  sessions: Map<string, SessionRecord>;
  resetTokens: Map<string, ResetTokenRecord>;
  rooms: Map<string, RoomRecord>;
  roomPlayers: Map<string, RoomPlayerRecord>;
}

type Table = keyof Store;
const TABLES: readonly Table[] = ['users', 'sessions', 'resetTokens', 'rooms', 'roomPlayers'];
```

```ts
export function createMemoryRepositories(): Repositories {
  return repositoriesOver({ users: new Map(), sessions: new Map(), resetTokens: new Map(), rooms: new Map(), roomPlayers: new Map() });
}

function repositoriesOver(store: Store): Repositories {
  return {
    users: new MemoryUsers(store),
    sessions: new MemorySessions(store),
    resetTokens: new MemoryResetTokens(store),
    rooms: new MemoryRooms(store),
    transaction: (work) => transact(store, work),
  };
}
```

3. Replace `cloneStore` and `sameRecord` with:

```ts
// Records hold dates and, for rooms, a rules object. Dates are replaced, never
// mutated, and so are rules objects, so copying each record is a deep enough copy.
const cloneMap = <T extends object>(map: Map<string, T>) => new Map([...map].map(([key, record]) => [key, { ...record }]));
const cloneStore = (store: Store): Store => ({
  users: cloneMap(store.users),
  sessions: cloneMap(store.sessions),
  resetTokens: cloneMap(store.resetTokens),
  rooms: cloneMap(store.rooms),
  roomPlayers: cloneMap(store.roomPlayers),
});

// Compare field by field: dates by time, plain objects (rules) by their JSON.
function sameRecord(a: object | undefined, b: object | undefined): boolean {
  if (!a || !b) return a === b;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].every((key) => {
    const x = left[key];
    const y = right[key];
    if (x instanceof Date && y instanceof Date) return x.getTime() === y.getTime();
    if (x !== null && y !== null && typeof x === 'object' && typeof y === 'object') return JSON.stringify(x) === JSON.stringify(y);
    return x === y;
  });
}
```

(Delete the old `// Records are flat and their dates are replaced…` comment that sat above `cloneMap`, and the old `// Records are flat: compare field by field, dates by time.` comment.)

4. In `MemoryUsers.deleteIdleGuests`, after the reset-token loop, keep the guest's memberships with no user:

```ts
      for (const player of this.store.roomPlayers.values()) if (player.userId === user.id) player.userId = null;
```

5. Append the class:

```ts
const copyRoom = (room: RoomRecord): RoomRecord => ({ ...room, rules: { ...room.rules } });

class MemoryRooms implements RoomRepository {
  constructor(private readonly store: Store) {}

  async create(input: { visibility: RoomRecord['visibility']; seatCount: number; rules: RoomRecord['rules']; now: Date }): Promise<RoomRecord> {
    const room: RoomRecord = {
      id: randomUUID(),
      visibility: input.visibility,
      status: 'lobby',
      seatCount: input.seatCount,
      rules: { ...input.rules },
      hostPlayerId: null,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.store.rooms.set(room.id, room);
    return copyRoom(room);
  }

  async update(roomId: string, changes: RoomChanges, now: Date): Promise<void> {
    const room = this.store.rooms.get(roomId);
    if (!room) return;
    this.store.rooms.set(roomId, { ...room, ...changes, ...(changes.rules ? { rules: { ...changes.rules } } : {}), updatedAt: now });
  }

  async addPlayer(input: { roomId: string; userId: string | null; kind: RoomPlayerRecord['kind']; displayName: string; now: Date }): Promise<RoomPlayerRecord> {
    if (!this.store.rooms.has(input.roomId)) throw new Error(`No room ${input.roomId}`);
    const current = [...this.store.roomPlayers.values()].filter((p) => p.roomId === input.roomId && p.leftAt === null);
    const name = input.displayName.toLowerCase();
    if (current.some((p) => p.displayName.toLowerCase() === name)) throw new NameTakenError();
    if (input.userId !== null && current.some((p) => p.userId === input.userId)) throw new Error('That user is already a member of this room');
    const player: RoomPlayerRecord = {
      id: randomUUID(),
      roomId: input.roomId,
      userId: input.userId,
      kind: input.kind,
      displayName: input.displayName,
      joinedAt: input.now,
      leftAt: null,
    };
    this.store.roomPlayers.set(player.id, player);
    return { ...player };
  }

  async markLeft(playerId: string, now: Date): Promise<void> {
    const player = this.store.roomPlayers.get(playerId);
    if (player && player.leftAt === null) player.leftAt = now;
  }

  async listLive(): Promise<LiveRoomRecord[]> {
    // A stable sort keeps insertion order for members who joined at the same time.
    const current = [...this.store.roomPlayers.values()].filter((p) => p.leftAt === null).sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
    return [...this.store.rooms.values()]
      .filter((room) => room.status !== 'closed')
      .map((room) => ({ room: copyRoom(room), players: current.filter((p) => p.roomId === room.id).map((p) => ({ ...p })) }));
  }
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npx jest --selectProjects server persistence/memory && npm run typecheck:server`
Expected: the in-memory contract PASSES (including every Stage 2 test).

The type check fails only in `postgres/postgresRepositories.ts`, because `rooms` is missing from `Repositories` there. Task 3 fixes that. **Make no other change to silence it.** Any other error must be fixed now.

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/persistence
git commit -m "feat(server): room records, repository contract and in-memory rooms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Postgres rooms: migration and Kysely repository

**Files:**
- Create: `projects/server/src/persistence/migrations/0002_rooms.ts`
- Modify:
  - `projects/server/src/persistence/migrate.ts`
  - `projects/server/src/persistence/postgres/schema.ts`
  - `projects/server/src/persistence/postgres/mappers.ts`
  - `projects/server/src/persistence/postgres/postgresRepositories.ts`
- Test: the Task 2 contract, through `projects/server/src/persistence/postgres/postgresRepositories.spec.ts` (unchanged)

**Interfaces:**
- Consumes: `RoomRepository`, `RoomChanges`, `LiveRoomRecord`, `NameTakenError`, `RoomRecord` and `RoomPlayerRecord` (Task 2).
- Produces:
  - tables `rooms` and `room_players`;
  - the unique index `room_players_current_name`, on `(room_id, lower(display_name)) WHERE left_at IS NULL`;
  - `toRoomRecord` and `toRoomPlayerRecord`;
  - `Repositories.rooms` on Postgres.

- [ ] **Step 1: Write the migration**

Create `projects/server/src/persistence/migrations/0002_rooms.ts`:

```ts
import { Kysely, sql } from 'kysely';

// Rooms and their members (spec "Database"). The host is a member, so the
// foreign key from rooms to room_players is added once both tables exist.
const UP = [
  `CREATE TABLE rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    visibility text NOT NULL CHECK (visibility IN ('open', 'solo')),
    status text NOT NULL CHECK (status IN ('lobby', 'playing', 'closed')),
    seat_count int NOT NULL CHECK (seat_count >= 2),
    rules jsonb NOT NULL,
    host_player_id uuid,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  )`,
  `CREATE INDEX rooms_live ON rooms (created_at) WHERE status <> 'closed'`,
  `CREATE TABLE room_players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
    user_id uuid REFERENCES users (id) ON DELETE SET NULL,
    kind text NOT NULL CHECK (kind IN ('human', 'bot')),
    display_name text NOT NULL,
    joined_at timestamptz NOT NULL,
    left_at timestamptz,
    CONSTRAINT room_players_bot_has_no_user CHECK (kind = 'human' OR user_id IS NULL)
  )`,
  `CREATE UNIQUE INDEX room_players_current_name ON room_players (room_id, lower(display_name)) WHERE left_at IS NULL`,
  `CREATE UNIQUE INDEX room_players_current_user ON room_players (room_id, user_id) WHERE left_at IS NULL AND user_id IS NOT NULL`,
  `CREATE INDEX room_players_user_id ON room_players (user_id)`,
  `ALTER TABLE rooms ADD CONSTRAINT rooms_host_player FOREIGN KEY (host_player_id) REFERENCES room_players (id)`,
];

const DOWN = [`ALTER TABLE rooms DROP CONSTRAINT rooms_host_player`, `DROP TABLE room_players`, `DROP TABLE rooms`];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function up(db: Kysely<any>): Promise<void> {
  for (const statement of UP) await sql.raw(statement).execute(db);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function down(db: Kysely<any>): Promise<void> {
  for (const statement of DOWN) await sql.raw(statement).execute(db);
}
```

In `projects/server/src/persistence/migrate.ts`, import it and list it:

```ts
import * as accounts from './migrations/0001_accounts';
import * as rooms from './migrations/0002_rooms';
```

```ts
const MIGRATIONS: Record<string, Migration> = {
  '0001_accounts': accounts,
  '0002_rooms': rooms,
};
```

- [ ] **Step 2: Add the row types and mappers**

In `projects/server/src/persistence/postgres/schema.ts`, add `import type { GameRules } from 'engine';` at the top, then add before `Database`:

```ts
export interface RoomsTable {
  id: Generated<string>;
  visibility: 'open' | 'solo';
  status: 'lobby' | 'playing' | 'closed';
  seat_count: number;
  // jsonb: read back as an object, written as JSON text.
  rules: ColumnType<GameRules, string, string>;
  host_player_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RoomPlayersTable {
  id: Generated<string>;
  room_id: string;
  user_id: string | null;
  kind: 'human' | 'bot';
  display_name: string;
  joined_at: Timestamp;
  left_at: NullableTimestamp;
}
```

and add these to `Database`:

```ts
  rooms: RoomsTable;
  room_players: RoomPlayersTable;
```

In `projects/server/src/persistence/postgres/mappers.ts`, extend the imports:

```ts
import { ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserRecord } from '../records';
import { PasswordResetTokensTable, RoomPlayersTable, RoomsTable, SessionsTable, UsersTable } from './schema';
```

and append:

```ts
export function toRoomRecord(row: Selectable<RoomsTable>): RoomRecord {
  return {
    id: row.id,
    visibility: row.visibility,
    status: row.status,
    seatCount: row.seat_count,
    rules: row.rules,
    hostPlayerId: row.host_player_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRoomPlayerRecord(row: Selectable<RoomPlayersTable>): RoomPlayerRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    kind: row.kind,
    displayName: row.display_name,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
  };
}
```

- [ ] **Step 3: Implement the Postgres rooms**

In `projects/server/src/persistence/postgres/postgresRepositories.ts`:

1. Extend the imports:

```ts
import { ResetTokenRecord, RoomPlayerRecord, RoomRecord, SessionRecord, UserRecord } from '../records';
import {
  EmailTakenError,
  LiveRoomRecord,
  NameTakenError,
  Repositories,
  ResetTokenRepository,
  RoomChanges,
  RoomRepository,
  SessionRepository,
  UserRepository,
} from '../repositories';
import { toResetTokenRecord, toRoomPlayerRecord, toRoomRecord, toSessionRecord, toUserRecord } from './mappers';
```

2. Below `isUniqueViolation`, add:

```ts
// For a unique index (not a constraint), Postgres reports the index name here.
const violatedIndex = (err: unknown) => (err as { constraint?: unknown } | null)?.constraint;
```

3. Add `rooms: new PostgresRooms(db),` to the object `createPostgresRepositories` returns, after `resetTokens`.

4. Append the class:

```ts
class PostgresRooms implements RoomRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async create(input: { visibility: RoomRecord['visibility']; seatCount: number; rules: RoomRecord['rules']; now: Date }): Promise<RoomRecord> {
    const row = await this.db
      .insertInto('rooms')
      .values({
        visibility: input.visibility,
        status: 'lobby',
        seat_count: input.seatCount,
        rules: JSON.stringify(input.rules),
        created_at: input.now,
        updated_at: input.now,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toRoomRecord(row);
  }

  async update(roomId: string, changes: RoomChanges, now: Date): Promise<void> {
    await this.db
      .updateTable('rooms')
      .set({
        updated_at: now,
        ...(changes.status !== undefined ? { status: changes.status } : {}),
        ...(changes.seatCount !== undefined ? { seat_count: changes.seatCount } : {}),
        ...(changes.rules !== undefined ? { rules: JSON.stringify(changes.rules) } : {}),
        ...(changes.hostPlayerId !== undefined ? { host_player_id: changes.hostPlayerId } : {}),
      })
      .where('id', '=', roomId)
      .execute();
  }

  async addPlayer(input: { roomId: string; userId: string | null; kind: RoomPlayerRecord['kind']; displayName: string; now: Date }): Promise<RoomPlayerRecord> {
    try {
      const row = await this.db
        .insertInto('room_players')
        .values({ room_id: input.roomId, user_id: input.userId, kind: input.kind, display_name: input.displayName, joined_at: input.now })
        .returningAll()
        .executeTakeFirstOrThrow();
      return toRoomPlayerRecord(row);
    } catch (err) {
      if (isUniqueViolation(err) && violatedIndex(err) === 'room_players_current_name') throw new NameTakenError();
      throw err;
    }
  }

  async markLeft(playerId: string, now: Date): Promise<void> {
    await this.db.updateTable('room_players').set({ left_at: now }).where('id', '=', playerId).where('left_at', 'is', null).execute();
  }

  async listLive(): Promise<LiveRoomRecord[]> {
    const rooms = await this.db.selectFrom('rooms').selectAll().where('status', '<>', 'closed').orderBy('created_at').execute();
    if (rooms.length === 0) return [];
    const players = await this.db
      .selectFrom('room_players')
      .selectAll()
      .where(
        'room_id',
        'in',
        rooms.map((room) => room.id)
      )
      .where('left_at', 'is', null)
      .orderBy('joined_at')
      .orderBy('id')
      .execute();
    return rooms.map((row) => ({ room: toRoomRecord(row), players: players.filter((p) => p.room_id === row.id).map(toRoomPlayerRecord) }));
  }
}
```

- [ ] **Step 4: Run the type check and the Postgres contract**

```bash
npm run typecheck:server
npm run db:up
npm run test:db
```

Expected:
- The type check prints nothing.
- `test:db` PASSES both stores' contracts, including every Stage 2 test.

If Docker can't be started, report the Postgres suite as **not run**. Never count the skip as a pass.

- [ ] **Step 5: Commit**

```bash
git add projects/server/src/persistence
git commit -m "feat(server): rooms and room_players tables with the Postgres room repository

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Room domain: `Room`, `SerialQueue` and `RoomError`

**Files:**
- Create:
  - `projects/server/src/rooms/room.ts`
  - `projects/server/src/rooms/serialQueue.ts`
  - `projects/server/src/rooms/errors.ts`
- Test: `projects/server/src/rooms/room.spec.ts`, `projects/server/src/rooms/serialQueue.spec.ts`

**Interfaces:**
- Consumes: `RoomRecord` and `RoomPlayerRecord` (Task 2); `ErrorCode` and `MemberKind` (Task 1).
- Produces:
  - `interface RoomMember { id; userId: string | null; kind: MemberKind; name; isRegistered: boolean; joinedAt: Date; connected: boolean; awaySince: number | null }`
  - `memberFrom(player: RoomPlayerRecord, isRegistered: boolean, now: number): RoomMember`. A bot starts connected. A human starts away, from `now`.
  - `sameName(a: string, b: string): boolean`
  - `class Room`, whose constructor is `(record: RoomRecord, members: RoomMember[], now: number)`. Its fields are `record` and `members` (both mutable) and `lastActivityAt: number`. Its getters are `id` and `host: RoomMember | null`. Its methods:
    - `member(id)` and `memberForUser(userId)`, each returning `RoomMember | null`;
    - `humans(): RoomMember[]`;
    - `isFull()` and `nameTaken(name)`;
    - `nextBotName(): string`;
    - `successor(connectedOnly: boolean): RoomMember | null`;
    - `remove(id): void`.
  - `class SerialQueue { run<T>(task: () => Promise<T>): Promise<T> }`
  - `type RoomErrorCode` and `class RoomError extends Error { code: RoomErrorCode }`

- [ ] **Step 1: Write the failing tests**

Create `projects/server/src/rooms/serialQueue.spec.ts`:

```ts
import { SerialQueue } from './serialQueue';

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('SerialQueue', () => {
  it('runs tasks one at a time, in the order they were queued', async () => {
    const queue = new SerialQueue();
    const log: string[] = [];
    const task = (name: string) => async () => {
      log.push(`${name} start`);
      await tick();
      log.push(`${name} end`);
      return name;
    };
    const results = await Promise.all([queue.run(task('a')), queue.run(task('b')), queue.run(task('c'))]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(log).toEqual(['a start', 'a end', 'b start', 'b end', 'c start', 'c end']);
  });

  it('rejects only the failing task, and runs the ones behind it', async () => {
    const queue = new SerialQueue();
    const failure = new Error('boom');
    const failed = queue.run(async () => {
      throw failure;
    });
    const next = queue.run(async () => 'next');
    await expect(failed).rejects.toBe(failure);
    await expect(next).resolves.toBe('next');
  });
});
```

Create `projects/server/src/rooms/room.spec.ts`:

```ts
import { RoomPlayerRecord, RoomRecord } from '../persistence/records';
import { memberFrom, Room, RoomMember, sameName } from './room';

const NOW = Date.parse('2026-10-13T12:00:00.000Z');
const at = (minutes: number) => new Date(NOW + minutes * 60_000);

const RECORD: RoomRecord = {
  id: 'room-1',
  visibility: 'open',
  status: 'lobby',
  seatCount: 4,
  rules: {},
  hostPlayerId: 'p-ann',
  createdAt: at(0),
  updatedAt: at(0),
};

function member(id: string, name: string, overrides: Partial<RoomMember> = {}): RoomMember {
  return { id, userId: `u-${id}`, kind: 'human', name, isRegistered: true, joinedAt: at(0), connected: true, awaySince: null, ...overrides };
}

const room = (members: RoomMember[], record: Partial<RoomRecord> = {}) => new Room({ ...RECORD, ...record }, members, NOW);

describe('Room', () => {
  it('compares names case-insensitively', () => {
    expect(sameName('Ann', 'aNN')).toBe(true);
    expect(sameName('Ann', 'Anne')).toBe(false);
    const r = room([member('p-ann', 'Ann'), member('p-bot', 'Bot 1', { kind: 'bot', userId: null })]);
    expect(r.nameTaken('ANN')).toBe(true);
    expect(r.nameTaken('bot 1')).toBe(true);
    expect(r.nameTaken('Bo')).toBe(false);
  });

  it('names bots with the first free number', () => {
    expect(room([member('p-ann', 'Ann')]).nextBotName()).toBe('Bot 1');
    expect(room([member('p-ann', 'Ann'), member('b1', 'Bot 1'), member('b3', 'bot 3')]).nextBotName()).toBe('Bot 2');
    expect(room([member('p-ann', 'Ann'), member('b1', 'Bot 1'), member('b2', 'Bot 2')]).nextBotName()).toBe('Bot 3');
  });

  it('is full when it has as many members as seats', () => {
    const r = room([member('p-ann', 'Ann'), member('p-bo', 'Bo')], { seatCount: 2 });
    expect(r.isFull()).toBe(true);
    r.remove('p-bo');
    expect(r.isFull()).toBe(false);
  });

  it('finds members by id and by user, and its host', () => {
    const r = room([member('p-ann', 'Ann'), member('p-bo', 'Bo')]);
    expect(r.member('p-bo')?.name).toBe('Bo');
    expect(r.memberForUser('u-p-ann')?.name).toBe('Ann');
    expect(r.memberForUser('nobody')).toBeNull();
    expect(r.host?.name).toBe('Ann');
    expect(r.humans().map((m) => m.name)).toEqual(['Ann', 'Bo']);
  });

  describe('successor', () => {
    const members = () => [
      member('p-ann', 'Ann', { joinedAt: at(0) }),
      member('p-guest', 'Guest', { joinedAt: at(1), isRegistered: false }),
      member('p-bot', 'Bot 1', { joinedAt: at(2), kind: 'bot', userId: null, isRegistered: false }),
      member('p-bo', 'Bo', { joinedAt: at(3), connected: false, awaySince: NOW }),
      member('p-cy', 'Cy', { joinedAt: at(4) }),
      member('p-di', 'Di', { joinedAt: at(5) }),
    ];

    it('prefers a connected registered human, earliest joined, never a guest or a bot', () => {
      expect(room(members()).successor(false)?.name).toBe('Cy');
      expect(room(members()).successor(true)?.name).toBe('Cy');
    });

    it('falls back to an away registered human only when away members count', () => {
      const awayOnly = members().filter((m) => !['p-cy', 'p-di'].includes(m.id));
      expect(room(awayOnly).successor(false)?.name).toBe('Bo');
      expect(room(awayOnly).successor(true)).toBeNull();
    });

    it('is null when no other registered human is left', () => {
      expect(room(members().filter((m) => m.id === 'p-ann' || !m.isRegistered)).successor(false)).toBeNull();
    });
  });

  it('builds a member from a record: a bot is connected, a human starts away', () => {
    const player: RoomPlayerRecord = { id: 'p1', roomId: 'room-1', userId: 'u1', kind: 'human', displayName: 'Ann', joinedAt: at(0), leftAt: null };
    expect(memberFrom(player, true, NOW)).toEqual({ id: 'p1', userId: 'u1', kind: 'human', name: 'Ann', isRegistered: true, joinedAt: at(0), connected: false, awaySince: NOW });
    expect(memberFrom({ ...player, kind: 'bot', userId: null }, false, NOW)).toMatchObject({ kind: 'bot', connected: true, awaySince: null });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects server rooms/`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 3: Implement**

Create `projects/server/src/rooms/serialQueue.ts`:

```ts
// Runs tasks one at a time, in the order they were queued. A failing task
// rejects its own promise and doesn't hold up the ones behind it.
// `run` queues synchronously: two calls made in a row run in that order.
export class SerialQueue {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
```

Create `projects/server/src/rooms/errors.ts`:

```ts
import type { ErrorCode } from 'protocol';

export type RoomErrorCode = Extract<
  ErrorCode,
  | 'not_found'
  | 'not_member'
  | 'not_host'
  | 'room_full'
  | 'in_progress'
  | 'name_taken'
  | 'host_must_be_registered'
  | 'already_in_room'
  | 'invalid_seat_count'
  | 'invalid_name'
  | 'invalid_message'
>;

// A room input that the rules refuse. Nothing changed; the sender gets the code.
export class RoomError extends Error {
  constructor(readonly code: RoomErrorCode) {
    super(code);
    this.name = 'RoomError';
  }
}
```

Create `projects/server/src/rooms/room.ts`:

```ts
import type { MemberKind } from 'protocol';
import { RoomPlayerRecord, RoomRecord } from '../persistence/records';

export interface RoomMember {
  id: string;
  userId: string | null;
  kind: MemberKind;
  name: string;
  isRegistered: boolean;
  joinedAt: Date;
  // Bots are always connected.
  connected: boolean;
  // When a human last lost (or never had) a connection, in ms; null while connected.
  awaySince: number | null;
}

// A member as loaded or just added: a human has no connection yet.
export function memberFrom(player: RoomPlayerRecord, isRegistered: boolean, now: number): RoomMember {
  const bot = player.kind === 'bot';
  return {
    id: player.id,
    userId: player.userId,
    kind: player.kind,
    name: player.displayName,
    isRegistered,
    joinedAt: player.joinedAt,
    connected: bot,
    awaySince: bot ? null : now,
  };
}

// Names are normalized (NFC, trimmed) before they get here.
export const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// A room's live state and the lobby rules that need no I/O. RoomService
// persists each change first, then applies it here.
export class Room {
  // The last input (join, connect, lobby command), in ms.
  lastActivityAt: number;

  constructor(
    public record: RoomRecord,
    public members: RoomMember[],
    now: number
  ) {
    this.lastActivityAt = now;
  }

  get id(): string {
    return this.record.id;
  }

  get host(): RoomMember | null {
    return this.member(this.record.hostPlayerId ?? '');
  }

  member(id: string): RoomMember | null {
    return this.members.find((m) => m.id === id) ?? null;
  }

  memberForUser(userId: string): RoomMember | null {
    return this.members.find((m) => m.userId === userId) ?? null;
  }

  humans(): RoomMember[] {
    return this.members.filter((m) => m.kind === 'human');
  }

  isFull(): boolean {
    return this.members.length >= this.record.seatCount;
  }

  nameTaken(name: string): boolean {
    return this.members.some((m) => sameName(m.name, name));
  }

  // The first free name in "Bot 1", "Bot 2", …
  nextBotName(): string {
    for (let n = 1; ; n += 1) {
      const name = `Bot ${n}`;
      if (!this.nameTaken(name)) return name;
    }
  }

  // Who the host role passes to: a registered human other than the host,
  // connected before away, then earliest joined. With `connectedOnly`, away
  // members don't count.
  successor(connectedOnly: boolean): RoomMember | null {
    const candidates = this.members.filter(
      (m) => m.kind === 'human' && m.isRegistered && m.id !== this.record.hostPlayerId && (m.connected || !connectedOnly)
    );
    candidates.sort((a, b) => Number(b.connected) - Number(a.connected) || a.joinedAt.getTime() - b.joinedAt.getTime());
    return candidates[0] ?? null;
  }

  remove(id: string): void {
    this.members = this.members.filter((m) => m.id !== id);
  }
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `npx jest --selectProjects server rooms/ && npm run typecheck:server`
Expected: PASS, and the type check prints nothing.

- [ ] **Step 5: Commit**

```bash
git add projects/server/src/rooms
git commit -m "feat(server): Room domain rules, serial queue and RoomError

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `RoomService`: create, join, lobby commands, connections and host rules

**Files:**
- Create:
  - `projects/server/src/rooms/roomService.ts`
  - `projects/server/src/views/room.ts`
- Test: `projects/server/src/rooms/roomService.spec.ts`

**Interfaces:**
- Consumes:
  - `Room`, `RoomMember`, `memberFrom`, `SerialQueue`, `RoomError` (Task 4);
  - `Repositories`, `NameTakenError`, `UserRecord`, `RoomPlayerRecord` (Tasks 2–3);
  - `CreateRoomBody`, `RoomCommand`, `RoomList`, `RoomSnapshot`, `RoomListItem`, `RoomLeftReason`, `SeatLimits`, `ServerMessage` and `normalizeDisplayName` from `protocol`.
- Produces:
  - `HOST_AWAY_MS = 60_000`, `LOBBY_IDLE_MS = 1_800_000` and `ROOM_TICK_MS = 5_000`
  - `interface MemberConnection { send(message: ServerMessage): void; close(): void }`
  - `interface RoomServiceDeps { repos; seatLimits: SeatLimits; now?: () => number; logError?: (err: unknown, message: string) => void }`
  - `class RoomService`. Every method that changes something rejects with `RoomError` when the rules refuse the input:
    - `restore(): Promise<void>`
    - `list(user: UserRecord): RoomList`
    - `snapshot(user, roomId): RoomSnapshot`
    - `create(user, body: CreateRoomBody): Promise<string>`, which resolves to the room id
    - `join(user, roomId, displayName): Promise<void>`
    - `connect(user, roomId, connection): Promise<string>`, which resolves to the player id. It sends `welcome` to the new connection itself.
    - `disconnect(roomId, playerId, connection): Promise<void>`
    - `command(user, roomId, playerId, command: RoomCommand): Promise<void>`
    - `tick(): Promise<void>`
  - From `views/room.ts`: `toRoomSnapshot(room: Room, seatLimits: SeatLimits): RoomSnapshot` and `toRoomListItem(room: Room, userId: string): RoomListItem`.

**How a room input is processed** (every method that changes a room):

1. **check**: the rules, against the in-memory `Room`;
2. **persist**: the repository writes;
3. **commit**: change the in-memory `Room`;
4. **publish**: `room.updated` to every connection in the room.

A failure in step 1 or 2 changes nothing and rejects with `RoomError`, or with the store's error.

Each room has a `SerialQueue`, and every input to it runs there. `create` and `join` look across rooms (the one-live-room rule), so they also run one at a time on a service-wide queue. A queued task first checks that its room is still live, because it may have closed while the task waited.

- [ ] **Step 1: Write the failing tests**

Create `projects/server/src/rooms/roomService.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { RoomSnapshot, ServerMessage } from 'protocol';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import { HOST_AWAY_MS, LOBBY_IDLE_MS, MemberConnection, RoomService } from './roomService';

const T0 = Date.parse('2026-10-13T12:00:00.000Z');
const LIMITS = { min: 2, max: 6 };

class FakeConnection implements MemberConnection {
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
}

async function setup() {
  const repos = createMemoryRepositories();
  let now = T0;
  const logError = jest.fn();
  const rooms = new RoomService({ repos, seatLimits: LIMITS, now: () => now, logError });
  const advance = (ms: number) => {
    now += ms;
  };
  const registered = (name: string) =>
    repos.users.createRegistered({ email: `${name.toLowerCase()}-${randomUUID()}@example.com`, passwordHash: 'h', displayName: name, now: new Date(now) });
  const guest = (name: string) => repos.users.createGuest({ displayName: name, now: new Date(now) });
  const open = (host: UserRecord, seatCount = 4) => rooms.create(host, { seatCount, rules: { firstRevealDraw: true }, displayName: host.displayName });
  const connect = async (user: UserRecord, roomId: string) => {
    const connection = new FakeConnection();
    const playerId = await rooms.connect(user, roomId, connection);
    return { connection, playerId };
  };
  const names = (snapshot: RoomSnapshot | undefined) => snapshot?.members.map((m) => m.name);
  return { repos, rooms, advance, registered, guest, open, connect, names, logError };
}

const code = (code: string) => expect.objectContaining({ code });
// What a synchronous call threw, for comparing with code(…).
const thrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (err) {
    return err;
  }
  return undefined;
};

describe('RoomService', () => {
  describe('create', () => {
    it('makes the registered creator the first member and the host', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const snapshot = rooms.snapshot(ann, id);
      expect(snapshot).toEqual({
        id,
        visibility: 'open',
        status: 'lobby',
        seatCount: 4,
        rules: { firstRevealDraw: true },
        hostPlayerId: snapshot.members[0].playerId,
        members: [{ playerId: expect.any(String), name: 'Ann', kind: 'human', isRegistered: true, connected: false, botControlled: false }],
        lastResult: null,
        seatLimits: LIMITS,
      });
    });

    it('stores the room with its host', async () => {
      const { repos, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const stored = (await repos.rooms.listLive()).find((entry) => entry.room.id === id);
      expect(stored?.players.map((p) => [p.displayName, p.userId])).toEqual([['Ann', ann.id]]);
      expect(stored?.room.hostPlayerId).toBe(stored?.players[0].id);
    });

    it('refuses a guest host, a bad seat count and a blank name', async () => {
      const { rooms, registered, guest } = await setup();
      const ann = await registered('Ann');
      await expect(rooms.create(await guest('Gus'), { seatCount: 4, rules: {}, displayName: 'Gus' })).rejects.toEqual(code('host_must_be_registered'));
      await expect(rooms.create(ann, { seatCount: 1, rules: {}, displayName: 'Ann' })).rejects.toEqual(code('invalid_seat_count'));
      await expect(rooms.create(ann, { seatCount: 7, rules: {}, displayName: 'Ann' })).rejects.toEqual(code('invalid_seat_count'));
      await expect(rooms.create(ann, { seatCount: 4, rules: {}, displayName: '   ' })).rejects.toEqual(code('invalid_name'));
    });

    it('refuses a second live room for the same user', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      await open(ann);
      await expect(rooms.create(ann, { seatCount: 4, rules: {}, displayName: 'Ann' })).rejects.toEqual(code('already_in_room'));
    });

    it('of two racing creates by one user, exactly one wins', async () => {
      const { rooms, registered } = await setup();
      const ann = await registered('Ann');
      const body = { seatCount: 4, rules: {}, displayName: 'Ann' };
      const results = await Promise.allSettled([rooms.create(ann, body), rooms.create(ann, body)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });
  });

  describe('join', () => {
    it('adds the member, and connected members see it', async () => {
      const { rooms, registered, guest, open, connect, names } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const gus = await guest('Gus');
      await rooms.join(gus, id, '  Gus  ');
      expect(names(host.connection.room)).toEqual(['Ann', 'Gus']);
      expect(host.connection.room?.members[1]).toMatchObject({ isRegistered: false, connected: false, kind: 'human' });
    });

    it('refuses a name taken in any case, including a bot name (Review Focus 2)', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      await rooms.command(ann, id, host.playerId, { type: 'lobby.addBot' });
      await expect(rooms.join(await registered('Bo'), id, ' ann ')).rejects.toEqual(code('name_taken'));
      await expect(rooms.join(await registered('Cy'), id, 'bot 1')).rejects.toEqual(code('name_taken'));
    });

    it('lets a member rejoin, keeping their name', async () => {
      const { rooms, registered, open, names } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      await rooms.join(bo, id, 'Someone Else');
      expect(names(rooms.snapshot(ann, id))).toEqual(['Ann', 'Bo']);
    });

    it('refuses a full room', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann, 2);
      await rooms.join(await registered('Bo'), id, 'Bo');
      await expect(rooms.join(await registered('Cy'), id, 'Cy')).rejects.toEqual(code('room_full'));
    });

    it('of two racing joins for the last seat, exactly one wins (Review Focus 1)', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann, 2);
      const [bo, cy] = [await registered('Bo'), await registered('Cy')];
      const results = await Promise.allSettled([rooms.join(bo, id, 'Bo'), rooms.join(cy, id, 'Cy')]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((results.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toEqual(code('room_full'));
      expect(rooms.snapshot(ann, id).members).toHaveLength(2);
    });

    it('refuses joining while a member of another room, and an unknown room', async () => {
      const { rooms, registered, open } = await setup();
      const first = await open(await registered('Ann'));
      const second = await open(await registered('Bo'));
      const cy = await registered('Cy');
      await rooms.join(cy, first, 'Cy');
      await expect(rooms.join(cy, second, 'Cy')).rejects.toEqual(code('already_in_room'));
      await expect(rooms.join(cy, randomUUID(), 'Cy')).rejects.toEqual(code('not_found'));
    });
  });

  describe('connections', () => {
    it('welcomes a member with their id and the room, and tells the others they are here', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const guestSide = await connect(bo, id);
      expect(guestSide.connection.last('welcome')).toEqual({ type: 'welcome', you: { playerId: guestSide.playerId, seatId: null }, room: expect.any(Object), game: null });
      expect(host.connection.room?.members.map((m) => m.connected)).toEqual([true, true]);
    });

    it('refuses a connection from a non-member, and to an unknown room', async () => {
      const { rooms, registered, open } = await setup();
      const id = await open(await registered('Ann'));
      await expect(rooms.connect(await registered('Bo'), id, new FakeConnection())).rejects.toEqual(code('not_member'));
      await expect(rooms.connect(await registered('Cy'), randomUUID(), new FakeConnection())).rejects.toEqual(code('not_found'));
    });

    it("replaces an older connection, and the older one's late close keeps the member connected (Review Focus 4)", async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const first = await connect(ann, id);
      const second = await connect(ann, id);
      expect(first.connection.last('replaced')).toEqual({ type: 'replaced' });
      expect(first.connection.closed).toBe(true);
      await rooms.disconnect(id, first.playerId, first.connection);
      expect(rooms.snapshot(ann, id).members[0].connected).toBe(true);
      expect(second.connection.closed).toBe(false);
    });

    it('marks a member away when their connection drops', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const other = await connect(bo, id);
      await rooms.disconnect(id, other.playerId, other.connection);
      expect(host.connection.room?.members[1].connected).toBe(false);
    });
  });

  describe('host commands', () => {
    async function lobby() {
      const ctx = await setup();
      const ann = await ctx.registered('Ann');
      const id = await ctx.open(ann);
      const host = await ctx.connect(ann, id);
      const run = (command: Parameters<RoomService['command']>[3]) => ctx.rooms.command(ann, id, host.playerId, command);
      return { ...ctx, ann, id, host, run };
    }

    it('adds bots with the first free name, and refuses when full', async () => {
      const { run, host, names } = await lobby();
      await run({ type: 'lobby.addBot' });
      await run({ type: 'lobby.addBot' });
      const bot1 = host.connection.room!.members[1].playerId;
      await run({ type: 'lobby.removePlayer', playerId: bot1 });
      await run({ type: 'lobby.addBot' });
      expect(names(host.connection.room)).toEqual(['Ann', 'Bot 2', 'Bot 1']);
      await run({ type: 'lobby.addBot' });
      await expect(run({ type: 'lobby.addBot' })).rejects.toEqual(code('room_full'));
    });

    it('refuses every lobby command from a member who is not the host', async () => {
      const { rooms, registered, id, host } = await lobby();
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const boId = await rooms.connect(bo, id, new FakeConnection());
      const hostId = host.playerId;
      for (const command of [
        { type: 'lobby.addBot' } as const,
        { type: 'lobby.removePlayer', playerId: hostId } as const,
        { type: 'lobby.setRules', seatCount: 5, rules: {} } as const,
        { type: 'lobby.makeHost', playerId: boId } as const,
      ]) {
        await expect(rooms.command(bo, id, boId, command)).rejects.toEqual(code('not_host'));
      }
    });

    it("refuses a command for someone else's player id", async () => {
      const { rooms, registered, id, host } = await lobby();
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      await expect(rooms.command(bo, id, host.playerId, { type: 'lobby.addBot' })).rejects.toEqual(code('not_member'));
    });

    it('removes a human: they are told and disconnected, and their name is free again', async () => {
      const { rooms, registered, id, run, host, names } = await lobby();
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const kicked = new FakeConnection();
      const boId = await rooms.connect(bo, id, kicked);
      await run({ type: 'lobby.removePlayer', playerId: boId });
      expect(kicked.last('room.left')).toEqual({ type: 'room.left', reason: 'removed' });
      expect(kicked.closed).toBe(true);
      expect(names(host.connection.room)).toEqual(['Ann']);
      await rooms.join(await registered('Cy'), id, 'bo');
      expect(names(host.connection.room)).toEqual(['Ann', 'bo']);
    });

    it('refuses removing the host, or someone who is not there', async () => {
      const { run, host } = await lobby();
      await expect(run({ type: 'lobby.removePlayer', playerId: host.playerId })).rejects.toEqual(code('invalid_message'));
      await expect(run({ type: 'lobby.removePlayer', playerId: 'nobody' })).rejects.toEqual(code('not_found'));
    });

    it('changes the seat count and rules, within the limits and never below the member count', async () => {
      const { run, host } = await lobby();
      await run({ type: 'lobby.setRules', seatCount: 6, rules: { firstRevealDraw: false } });
      expect(host.connection.room).toMatchObject({ seatCount: 6, rules: { firstRevealDraw: false } });
      await run({ type: 'lobby.addBot' });
      await run({ type: 'lobby.addBot' });
      await expect(run({ type: 'lobby.setRules', seatCount: 2, rules: {} })).rejects.toEqual(code('invalid_seat_count'));
      await expect(run({ type: 'lobby.setRules', seatCount: 7, rules: {} })).rejects.toEqual(code('invalid_seat_count'));
      await run({ type: 'lobby.setRules', seatCount: 3, rules: {} });
      expect(host.connection.room?.seatCount).toBe(3);
    });

    it('passes the host role only to a registered human', async () => {
      const { rooms, registered, guest, id, run, host } = await lobby();
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      await rooms.join(await guest('Gus'), id, 'Gus');
      await run({ type: 'lobby.addBot' });
      const [, boMember, gusMember, botMember] = host.connection.room!.members;
      await expect(run({ type: 'lobby.makeHost', playerId: gusMember.playerId })).rejects.toEqual(code('host_must_be_registered'));
      await expect(run({ type: 'lobby.makeHost', playerId: botMember.playerId })).rejects.toEqual(code('host_must_be_registered'));
      await run({ type: 'lobby.makeHost', playerId: boMember.playerId });
      expect(host.connection.room?.hostPlayerId).toBe(boMember.playerId);
      await expect(run({ type: 'lobby.addBot' })).rejects.toEqual(code('not_host'));
    });
  });

  describe('leaving', () => {
    it('drops a member who leaves, for everyone', async () => {
      const { rooms, registered, open, connect, names } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      const other = await connect(bo, id);
      await rooms.command(bo, id, other.playerId, { type: 'room.leave' });
      expect(names(host.connection.room)).toEqual(['Ann']);
      // The socket layer closes the leaver's connection; its close changes nothing.
      await rooms.disconnect(id, other.playerId, other.connection);
      expect(names(rooms.snapshot(ann, id))).toEqual(['Ann']);
    });

    it('passes the role to a connected registered member first when the host leaves', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const [bo, cy] = [await registered('Bo'), await registered('Cy')];
      await rooms.join(bo, id, 'Bo');
      await rooms.join(cy, id, 'Cy');
      const cySide = await connect(cy, id);
      await rooms.command(ann, id, host.playerId, { type: 'room.leave' });
      expect(cySide.connection.room?.hostPlayerId).toBe(cySide.playerId);
    });

    it('passes the role to an away registered member when no registered member is connected', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      const bo = await registered('Bo');
      await rooms.join(bo, id, 'Bo');
      await rooms.command(ann, id, host.playerId, { type: 'room.leave' });
      const snapshot = rooms.snapshot(bo, id);
      expect(snapshot.members.find((m) => m.playerId === snapshot.hostPlayerId)?.name).toBe('Bo');
    });

    it('closes the room when the host leaves and only guests and bots remain (Review Focus 3)', async () => {
      const { rooms, repos, registered, guest, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      await rooms.command(ann, id, host.playerId, { type: 'lobby.addBot' });
      const gus = await guest('Gus');
      await rooms.join(gus, id, 'Gus');
      const gusSide = await connect(gus, id);
      await rooms.command(ann, id, host.playerId, { type: 'room.leave' });
      expect(gusSide.connection.last('room.left')).toEqual({ type: 'room.left', reason: 'host_left' });
      expect(gusSide.connection.closed).toBe(true);
      expect(rooms.list(gus).rooms).toEqual([]);
      expect((await repos.rooms.listLive()).find((entry) => entry.room.id === id)).toBeUndefined();
      expect(thrown(() => rooms.snapshot(gus, id))).toEqual(code('not_found'));
    });

    it('closes the room when the last human leaves', async () => {
      const { rooms, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      await rooms.command(ann, id, host.playerId, { type: 'lobby.addBot' });
      await rooms.command(ann, id, host.playerId, { type: 'room.leave' });
      expect(rooms.list(ann).rooms).toEqual([]);
    });
  });

  describe('tick', () => {
    async function hostAway() {
      const ctx = await setup();
      const ann = await ctx.registered('Ann');
      const id = await ctx.open(ann);
      const host = await ctx.connect(ann, id);
      const bo = await ctx.registered('Bo');
      await ctx.rooms.join(bo, id, 'Bo');
      const boSide = await ctx.connect(bo, id);
      await ctx.rooms.disconnect(id, host.playerId, host.connection);
      return { ...ctx, ann, bo, id, host, boSide };
    }

    it('keeps the host role while the host has been away for less than 60 s', async () => {
      const { rooms, advance, boSide, host } = await hostAway();
      advance(HOST_AWAY_MS - 1);
      await rooms.tick();
      expect(boSide.connection.room?.hostPlayerId).toBe(host.playerId);
    });

    it('passes the role to the earliest connected registered member after 60 s', async () => {
      const { rooms, advance, boSide } = await hostAway();
      advance(HOST_AWAY_MS);
      await rooms.tick();
      expect(boSide.connection.room?.hostPlayerId).toBe(boSide.playerId);
    });

    it('keeps the role, so the room waits, when no registered member is connected', async () => {
      const { rooms, advance, boSide, host, bo, id } = await hostAway();
      await rooms.disconnect(id, boSide.playerId, boSide.connection);
      advance(HOST_AWAY_MS * 2);
      await rooms.tick();
      expect(rooms.snapshot(bo, id).hostPlayerId).toBe(host.playerId);
    });

    it('closes a lobby with no input for 30 minutes, and tells its members', async () => {
      const { rooms, advance, boSide, bo } = await hostAway();
      advance(LOBBY_IDLE_MS - 1);
      await rooms.tick();
      expect(rooms.list(bo).rooms).toHaveLength(1);
      advance(1);
      await rooms.tick();
      expect(boSide.connection.last('room.left')).toEqual({ type: 'room.left', reason: 'idle' });
      expect(boSide.connection.closed).toBe(true);
      expect(rooms.list(bo).rooms).toEqual([]);
    });

    it('counts a lobby command as activity', async () => {
      const { rooms, advance, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await rooms.connect(ann, id, new FakeConnection());
      advance(LOBBY_IDLE_MS - 1000);
      await rooms.command(ann, id, host, { type: 'lobby.addBot' });
      advance(2000);
      await rooms.tick();
      expect(rooms.list(await registered('Bo')).rooms).toHaveLength(1);
    });
  });

  describe('list and snapshot', () => {
    it("lists open rooms with the host's name, the count and capacity, your rooms first", async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const bo = await registered('Bo');
      const annRoom = await open(ann, 4);
      const boRoom = await open(bo, 6);
      const list = rooms.list(ann);
      expect(list.seatLimits).toEqual(LIMITS);
      expect(list.rooms).toEqual([
        { id: annRoom, visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: true },
        { id: boRoom, visibility: 'open', hostName: 'Bo', memberCount: 1, capacity: 6, status: 'lobby', youAreMember: false },
      ]);
    });

    it('lists the newest open rooms first', async () => {
      const { rooms, registered, open, advance } = await setup();
      const first = await open(await registered('Ann'));
      advance(1000);
      const second = await open(await registered('Bo'));
      expect(rooms.list(await registered('Cy')).rooms.map((r) => r.id)).toEqual([second, first]);
    });

    it('answers not_member to a non-member and not_found to an unknown room', async () => {
      const { rooms, registered, open } = await setup();
      const id = await open(await registered('Ann'));
      const bo = await registered('Bo');
      expect(thrown(() => rooms.snapshot(bo, id))).toEqual(code('not_member'));
      expect(thrown(() => rooms.snapshot(bo, randomUUID()))).toEqual(code('not_found'));
    });

    it('never puts user ids in a snapshot', async () => {
      const { rooms, registered, open } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      expect(JSON.stringify(rooms.snapshot(ann, id))).not.toContain(ann.id);
    });
  });

  describe('restore', () => {
    it('reloads live lobbies with every human away and bots connected', async () => {
      const { rooms, repos, registered, open, connect } = await setup();
      const ann = await registered('Ann');
      const id = await open(ann);
      const host = await connect(ann, id);
      await rooms.command(ann, id, host.playerId, { type: 'lobby.addBot' });

      const restarted = new RoomService({ repos, seatLimits: LIMITS, now: () => T0 + 5000 });
      await restarted.restore();

      const snapshot = restarted.snapshot(ann, id);
      expect(snapshot.members.map((m) => [m.name, m.connected, m.isRegistered])).toEqual([
        ['Ann', false, true],
        ['Bot 1', true, false],
      ]);
      expect(snapshot.hostPlayerId).toBe(host.playerId);
    });

    it('closes a stored room that has no human member', async () => {
      const { repos } = await setup();
      const room = await repos.rooms.create({ visibility: 'open', seatCount: 4, rules: {}, now: new Date(T0) });
      await repos.rooms.addPlayer({ roomId: room.id, userId: null, kind: 'bot', displayName: 'Bot 1', now: new Date(T0) });

      const restarted = new RoomService({ repos, seatLimits: LIMITS, now: () => T0 });
      await restarted.restore();

      expect((await repos.rooms.listLive()).find((entry) => entry.room.id === room.id)).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects server rooms/roomService`
Expected: FAIL. `./roomService` doesn't exist.

- [ ] **Step 3: Write the views**

Create `projects/server/src/views/room.ts`:

```ts
import type { RoomListItem, RoomSnapshot, SeatLimits } from 'protocol';
import { Room } from '../rooms/room';

// The room every member sees. Never user ids: members are known by player id.
export function toRoomSnapshot(room: Room, seatLimits: SeatLimits): RoomSnapshot {
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
      isRegistered: m.isRegistered,
      connected: m.connected,
      botControlled: false,
    })),
    lastResult: null,
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

- [ ] **Step 4: Write the service**

Create `projects/server/src/rooms/roomService.ts`:

```ts
import type { GameRules } from 'engine';
import { normalizeDisplayName } from 'protocol';
import type { CreateRoomBody, RoomCommand, RoomLeftReason, RoomList, RoomSnapshot, SeatLimits, ServerMessage } from 'protocol';
import { RoomPlayerRecord, UserRecord } from '../persistence/records';
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
  // Where failures of background work (tick) go.
  logError?: (err: unknown, message: string) => void;
}

interface LiveRoom {
  room: Room;
  queue: SerialQueue;
  // The current connection of each connected human, by player id.
  connections: Map<string, MemberConnection>;
}

// The rules the engine reads. Unknown keys never get stored.
function rulesFrom(rules: GameRules): GameRules {
  return rules.firstRevealDraw === undefined ? {} : { firstRevealDraw: rules.firstRevealDraw };
}

function requireName(raw: string): string {
  const name = normalizeDisplayName(raw);
  if (name === null) throw new RoomError('invalid_name');
  return name;
}

// Every live room, held in memory. Each room's inputs run one at a time on
// its queue: check, persist, commit in memory, publish room.updated.
export class RoomService {
  private readonly repos: Repositories;
  private readonly seatLimits: SeatLimits;
  private readonly now: () => number;
  private readonly logError: (err: unknown, message: string) => void;
  private readonly live = new Map<string, LiveRoom>();
  // Create and join check memberships across rooms, so they run one at a time.
  private readonly membership = new SerialQueue();

  constructor(deps: RoomServiceDeps) {
    this.repos = deps.repos;
    this.seatLimits = deps.seatLimits;
    this.now = deps.now ?? Date.now;
    this.logError = deps.logError ?? ((err, message) => console.error(message, err));
  }

  // Reloads every lobby from the store after a restart. Nobody is connected
  // yet, so every human starts away and the usual host and idle rules apply.
  async restore(): Promise<void> {
    const now = this.now();
    for (const { room, players } of await this.repos.rooms.listLive()) {
      // Rooms with a running game come back with their game in Stage 4.
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
      const rules = rulesFrom(body.rules);
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
  // told it was replaced and closed. Sends `welcome` to the new connection.
  connect(user: UserRecord, roomId: string, connection: MemberConnection): Promise<string> {
    return this.inRoom(roomId, async (entry) => {
      const member = entry.room.memberForUser(user.id);
      if (!member) throw new RoomError('not_member');
      const previous = entry.connections.get(member.id);
      entry.connections.set(member.id, connection);
      if (previous) {
        previous.send({ type: 'replaced' });
        previous.close();
      }
      member.connected = true;
      member.awaySince = null;
      entry.room.lastActivityAt = this.now();
      connection.send({ type: 'welcome', you: { playerId: member.id, seatId: null }, room: this.snapshotOf(entry), game: null });
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
        case 'room.leave':
          return this.leave(entry, actor);
      }
    });
  }

  // Timed rules, run every ROOM_TICK_MS: idle lobbies close, and a host away
  // for HOST_AWAY_MS hands the role to a connected registered member.
  tick(): Promise<void> {
    const work = [...this.live.values()].map((entry) =>
      entry.queue
        .run(async () => {
          if (this.live.get(entry.room.id) !== entry || entry.room.record.status !== 'lobby') return;
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
    const clean = rulesFrom(rules);
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

  private async leave(entry: LiveRoom, actor: RoomMember): Promise<void> {
    // Leaving a running game hands the seat to a bot: Stage 4.
    if (entry.room.record.status !== 'lobby') throw new RoomError('in_progress');
    const now = this.now();
    await this.repos.rooms.markLeft(actor.id, new Date(now));
    entry.room.remove(actor.id);
    // The socket layer acks, then closes the leaver's connection.
    entry.connections.delete(actor.id);
    if (entry.room.humans().length === 0) return this.closeRoom(entry, 'idle');
    if (entry.room.record.hostPlayerId === actor.id) {
      const next = entry.room.successor(false);
      if (!next) return this.closeRoom(entry, 'host_left');
      await this.setHost(entry, next.id, now);
    }
    this.touched(entry, now);
  }

  private async setHost(entry: LiveRoom, playerId: string, now: number): Promise<void> {
    await this.repos.rooms.update(entry.room.id, { hostPlayerId: playerId }, new Date(now));
    entry.room.record = { ...entry.room.record, hostPlayerId: playerId, updatedAt: new Date(now) };
  }

  private async closeRoom(entry: LiveRoom, reason: RoomLeftReason): Promise<void> {
    await this.repos.rooms.update(entry.room.id, { status: 'closed' }, new Date(this.now()));
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
    const entry: LiveRoom = { room, queue: new SerialQueue(), connections: new Map() };
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

  private snapshotOf(entry: LiveRoom): RoomSnapshot {
    return toRoomSnapshot(entry.room, this.seatLimits);
  }
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npx jest --selectProjects server && npm run typecheck:server`
Expected: PASS, and the type check prints nothing.

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/rooms projects/server/src/views
git commit -m "feat(server): RoomService with lobby commands, connections, host rules and restore

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Room HTTP routes and server wiring

**Files:**
- Create: `projects/server/src/http/roomRoutes.ts`
- Modify:
  - `projects/server/src/http/errors.ts`
  - `projects/server/src/http/app.ts`
  - `projects/server/src/http/app.spec.ts` (its `setup` builds a `RoomService`)
  - `projects/server/src/server.ts`
  - `projects/server/src/server.spec.ts`
- Test: `projects/server/src/http/roomRoutes.spec.ts`, `projects/server/src/server.spec.ts`

**Interfaces:**
- Consumes:
  - `RoomService`, `ROOM_TICK_MS`, `RoomError`, `RoomErrorCode` (Tasks 4–5);
  - `CreateRoomBodySchema`, `JoinRoomBodySchema`, `RoomParamsSchema` (Task 1);
  - `buildContentRegistry`, `kingdomWarMaxSeats` from `content`; `MIN_SEATS` from `protocol`.
- Produces:
  - `AppDeps.rooms: RoomService` (required)
  - `ROOM_ERROR_STATUS: Record<RoomErrorCode, number>`
  - `registerRoomRoutes(app: TypedApp, deps: { rooms: RoomService }): void`
  - Routes, each answering `401 not_signed_in` without a session (checked before the body):
    - `GET /api/rooms` → `RoomList`
    - `POST /api/rooms` → `201 { id }`
    - `POST /api/rooms/:id/join` → `200 { id }`
    - `GET /api/rooms/:id` → `RoomSnapshot`
  - `createServer` builds the `RoomService` (seat limits from the content), restores it, and runs `tick()` every `ROOM_TICK_MS`.

- [ ] **Step 1: Write the failing route tests**

Create `projects/server/src/http/roomRoutes.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { buildApp } from './app';

const ORIGIN = 'http://localhost:4200';
const LIMITS = { min: 2, max: 6 };

async function setup() {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: LIMITS });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app = await buildApp({ accounts, rooms, publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
  return { app };
}

const token = (res: LightMyRequestResponse) => res.cookies.find((c) => c.name === 'sgs_session')!.value;
const post = (app: FastifyInstance, url: string, payload: object, session?: string) =>
  app.inject({ method: 'POST', url, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
const get = (app: FastifyInstance, url: string, session?: string) => app.inject({ method: 'GET', url, cookies: session ? { sgs_session: session } : {} });
const signUp = async (app: FastifyInstance, displayName: string) =>
  token(await post(app, '/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName }));
const guest = async (app: FastifyInstance, displayName: string) => token(await post(app, '/api/auth/guest', { displayName }));
const createRoom = (app: FastifyInstance, session: string, body: object = {}) =>
  post(app, '/api/rooms', { seatCount: 4, rules: { firstRevealDraw: true }, displayName: 'Ann', ...body }, session);

describe('room routes', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('answers 401 not_signed_in on every room route without a session, before reading the body', async () => {
    ({ app } = await setup());
    const id = randomUUID();
    for (const res of [
      await get(app, '/api/rooms'),
      await post(app, '/api/rooms', {}),
      await post(app, `/api/rooms/${id}/join`, {}),
      await get(app, `/api/rooms/${id}`),
    ]) {
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('not_signed_in');
    }
  });

  it('creates a room and lists it, with the seat limits', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const created = await createRoom(app, ann);
    expect(created.statusCode).toBe(201);
    const { id } = created.json();
    const list = await get(app, '/api/rooms', ann);
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({
      rooms: [{ id, visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: true }],
      seatLimits: LIMITS,
    });
  });

  it('refuses a guest host with 403 host_must_be_registered', async () => {
    ({ app } = await setup());
    const res = await createRoom(app, await guest(app, 'Gus'));
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'host_must_be_registered', message: 'Only registered players can host a room' });
  });

  it('refuses a seat count outside the limits with 400 invalid_seat_count', async () => {
    ({ app } = await setup());
    const res = await createRoom(app, await signUp(app, 'Ann'), { seatCount: 9 });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_seat_count');
  });

  it('stores only the known rules', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann, { rules: { firstRevealDraw: true, houseRule: 'chaos' } })).json();
    expect((await get(app, `/api/rooms/${id}`, ann)).json().rules).toEqual({ firstRevealDraw: true });
  });

  it('lets a guest join and read the room', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann)).json();
    const gus = await guest(app, 'Gus');
    const joined = await post(app, `/api/rooms/${id}/join`, { displayName: 'Gus' }, gus);
    expect(joined.statusCode).toBe(200);
    expect(joined.json()).toEqual({ id });
    const snapshot = (await get(app, `/api/rooms/${id}`, gus)).json();
    expect(snapshot.members.map((m: { name: string; isRegistered: boolean }) => [m.name, m.isRegistered])).toEqual([
      ['Ann', true],
      ['Gus', false],
    ]);
  });

  it("answers a taken name with 409 and the spec's message", async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann)).json();
    const res = await post(app, `/api/rooms/${id}/join`, { displayName: 'ANN' }, await signUp(app, 'Bo'));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'name_taken', message: 'That name is already taken in this room. Choose another.' });
  });

  it('answers a full room with 409 room_full', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann, { seatCount: 2 })).json();
    await post(app, `/api/rooms/${id}/join`, { displayName: 'Bo' }, await signUp(app, 'Bo'));
    const res = await post(app, `/api/rooms/${id}/join`, { displayName: 'Cy' }, await signUp(app, 'Cy'));
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('room_full');
  });

  it('answers 403 not_member to a non-member, 404 to an unknown room and 400 to a malformed id', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann)).json();
    const bo = await signUp(app, 'Bo');
    expect((await get(app, `/api/rooms/${id}`, bo)).statusCode).toBe(403);
    expect((await get(app, `/api/rooms/${randomUUID()}`, bo)).statusCode).toBe(404);
    expect((await get(app, '/api/rooms/not-a-uuid', bo)).statusCode).toBe(400);
  });
});
```

Add to `projects/server/src/server.spec.ts`, inside the `describe`, a second test:

```ts
  it('lists rooms with the seat limits the content allows', async () => {
    const server = await createServer(loadConfig({}), { logger: false });
    try {
      const guest = await server.app.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { displayName: 'Guest' },
        headers: { origin: 'http://localhost:4200' },
      });
      const session = guest.cookies.find((c) => c.name === 'sgs_session')!.value;
      const list = await server.app.inject({ method: 'GET', url: '/api/rooms', cookies: { sgs_session: session } });
      expect(list.json()).toEqual({ rooms: [], seatLimits: { min: 2, max: kingdomWarMaxSeats(buildContentRegistry()) } });
    } finally {
      await server.close();
    }
  });
```

and add at the top of that file:

```ts
import { buildContentRegistry, kingdomWarMaxSeats } from 'content';
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects server http/roomRoutes server.spec`
Expected: FAIL. The room routes answer 404.

- [ ] **Step 3: Map room errors to HTTP statuses**

Replace `projects/server/src/http/errors.ts` with:

```ts
import { ERROR_MESSAGES, ErrorBody, ErrorCode } from 'protocol';
import { AuthErrorCode } from '../auth/accounts';
import { RoomErrorCode } from '../rooms/errors';

export function errorBody(code: ErrorCode): ErrorBody {
  return { code, message: ERROR_MESSAGES[code] };
}

export const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  email_taken: 409,
  invalid_credentials: 401,
  invalid_reset_token: 400,
  invalid_name: 400,
  weak_password: 400,
};

export const ROOM_ERROR_STATUS: Record<RoomErrorCode, number> = {
  not_found: 404,
  not_member: 403,
  not_host: 403,
  host_must_be_registered: 403,
  room_full: 409,
  in_progress: 409,
  name_taken: 409,
  already_in_room: 409,
  invalid_seat_count: 400,
  invalid_name: 400,
  invalid_message: 400,
};
```

- [ ] **Step 4: Write the routes**

Create `projects/server/src/http/roomRoutes.ts`:

```ts
import { FastifyReply, FastifyRequest } from 'fastify';
import type { RoomCreated } from 'protocol';
import { CreateRoomBodySchema, JoinRoomBodySchema, RoomParamsSchema } from 'protocol/schemas';
import { RoomService } from '../rooms/roomService';
import { errorBody } from './errors';
import { TypedApp } from './types';

// Runs before the body is parsed and validated, so a signed-out request is
// always told to sign in rather than that its body is wrong.
async function signedIn(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) return reply.code(401).send(errorBody('not_signed_in'));
}

export function registerRoomRoutes(app: TypedApp, deps: { rooms: RoomService }): void {
  const { rooms } = deps;

  app.get('/api/rooms', { onRequest: signedIn }, async (request) => rooms.list(request.auth!.user));

  app.post('/api/rooms', { onRequest: signedIn, schema: { body: CreateRoomBodySchema } }, async (request, reply) => {
    const created: RoomCreated = { id: await rooms.create(request.auth!.user, request.body) };
    return reply.code(201).send(created);
  });

  app.post('/api/rooms/:id/join', { onRequest: signedIn, schema: { params: RoomParamsSchema, body: JoinRoomBodySchema } }, async (request) => {
    await rooms.join(request.auth!.user, request.params.id, request.body.displayName);
    const joined: RoomCreated = { id: request.params.id };
    return joined;
  });

  app.get('/api/rooms/:id', { onRequest: signedIn, schema: { params: RoomParamsSchema } }, async (request) => rooms.snapshot(request.auth!.user, request.params.id));
}
```

- [ ] **Step 5: Register them in the app**

In `projects/server/src/http/app.ts`:

1. Add these imports:

```ts
import { RoomError } from '../rooms/errors';
import { RoomService } from '../rooms/roomService';
import { registerRoomRoutes } from './roomRoutes';
```

and change the errors import to:

```ts
import { AUTH_ERROR_STATUS, errorBody, ROOM_ERROR_STATUS } from './errors';
```

2. Add to `AppDeps`, after `accounts`:

```ts
  rooms: RoomService;
```

3. In the error handler, after the `AuthError` line, add:

```ts
    if (error instanceof RoomError) return reply.code(ROOM_ERROR_STATUS[error.code]).send(errorBody(error.code));
```

4. After `registerAuthRoutes(...)`, add:

```ts
  registerRoomRoutes(app, { rooms: deps.rooms });
```

In `projects/server/src/http/app.spec.ts`, import the service and build one over the same store in `setup`:

```ts
import { RoomService } from '../rooms/roomService';
```

```ts
async function setup(overrides: Partial<AppDeps> = {}) {
  const mailer = new RecordingMailer();
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer, publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const app = await buildApp({ accounts, rooms, publicOrigin: ORIGIN, cookieSecure: false, ...overrides });
  return { app, mailer };
}
```

- [ ] **Step 6: Wire the service into the server**

In `projects/server/src/server.ts`:

1. Add these imports:

```ts
import { buildContentRegistry, kingdomWarMaxSeats } from 'content';
import { MIN_SEATS } from 'protocol';
import { ROOM_TICK_MS, RoomService } from './rooms/roomService';
```

2. In `createServer`, after the `rateLimits` line, build and restore the service:

```ts
  const rooms = new RoomService({
    repos: store.repos,
    seatLimits: { min: MIN_SEATS, max: kingdomWarMaxSeats(buildContentRegistry()) },
    logError: (err, message) => app.log.error(err, message),
  });
  await rooms.restore();
```

`app` is declared below this point, so the arrow only reads it when an error is logged. Leave `logError` exactly as above.

3. Pass `rooms` to `buildApp` (add `rooms,` after `accounts,`).

4. After the `housekeeping` interval, add the room tick:

```ts
  const roomTick = setInterval(() => void rooms.tick(), ROOM_TICK_MS);
  roomTick.unref();
```

5. In `close`, clear it first: `clearInterval(roomTick);` before `clearInterval(housekeeping);`.

6. Update the comment above `createServer` to:

```ts
// Everything the process runs, wired from config: the store (Postgres,
// migrated on start, or in memory), accounts, rooms (restored from the store),
// the HTTP app, the room tick every 5 s, and an hourly clean-up of rate-limit
// windows, idle guests, and dead sessions and reset tokens.
```

- [ ] **Step 7: Run all server tests and the type check**

Run: `npx jest --selectProjects server && npm run typecheck:server`
Expected: PASS (Stage 2 tests included), and the type check prints nothing.

- [ ] **Step 8: Commit**

```bash
git add projects/server/src
git commit -m "feat(server): room HTTP routes and the RoomService in the running server

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: The WebSocket: handshake, heartbeat and lobby commands

**Files:**
- Modify:
  - `package.json` (dependencies)
  - `projects/server/src/http/app.ts`
  - `projects/server/README.md`
- Create:
  - `projects/server/src/socket/socketServer.ts`
  - `projects/server/src/socket/testClient.ts`
- Test: `projects/server/src/socket/socketServer.spec.ts`

**Interfaces:**
- Consumes:
  - `RoomService.connect`, `.disconnect`, `.command`, `MemberConnection` and `RoomError` (Tasks 4–5);
  - `AccountService.authenticate` and `SESSION_COOKIE` (Stage 2);
  - `ClientMessageSchema`, `PROTOCOL_VERSION`, `SOCKET_PATH`, `REQ_ID_MAX` and `ERROR_MESSAGES` (Task 1).
- Produces:
  - `attachSocketServer(app: TypedApp, deps: SocketDeps): void`, called by `buildApp`.
  - `interface SocketOptions { heartbeatMs?: number; helloTimeoutMs?: number }`
  - `AppDeps.socket?: SocketOptions`, for tests.
  - `HEARTBEAT_MS = 15_000` and `HELLO_TIMEOUT_MS = 10_000`
  - `TestClient`, used by Stage 4's end-to-end tests too:
    - `open(url, { origin, token?, autoPong? })`
    - `send(message)`
    - `next(type, match?, timeoutMs?)`
    - `closed(timeoutMs?)`, which resolves to the close code
    - `close()`
  - `refusedStatus(url, headers): Promise<number>`

**How the socket works:**

- **Upgrade:**
  - The path must be `/api/ws`; otherwise the server answers 404.
  - `Origin` must equal `PUBLIC_ORIGIN`; otherwise 403.
  - A valid `sgs_session` cookie is required; otherwise 401.
- **Each frame:**
  - A binary frame, or text that isn't JSON, gets `error invalid_message`.
  - A `hello` with another `protocolVersion` gets `error version`, then the socket closes.
  - A message that fails the schema gets `error invalid_message`, carrying the client's `reqId` when that is a string of 1–64 characters.
- **The first message must be a `hello`.** `RoomService.connect` then answers it with `welcome`, or an error followed by a close.
- **After that:**
  - A command goes to `RoomService.command`. It is answered with `ack { reqId }` (when a `reqId` was sent) or `error`.
  - After a successful `room.leave`, the server acks and then closes.
  - A second `hello` gets `invalid_message`.
- **Heartbeat:** every `heartbeatMs` the server pings each socket. A socket with two unanswered pings is terminated, and its close marks the member away.
- **Hello timeout:** a socket with no successful `hello` after `helloTimeoutMs` is closed.
- **Late hello:** if the socket closed while its `hello` was being handled, the server calls `disconnect` as soon as `connect` resolves, so the member isn't left looking connected.
- **Shutdown:** `preClose` terminates every socket.

- [ ] **Step 1: Install `ws`**

```bash
npm install ws@^8
npm install -D @types/ws@^8
```

- [ ] **Step 2: Write the test client**

Create `projects/server/src/socket/testClient.ts`:

```ts
import { WebSocket } from 'ws';
import type { ServerMessage } from 'protocol';

type MessageOf<T extends ServerMessage['type']> = Extract<ServerMessage, { type: T }>;

// A socket client for end-to-end tests. It keeps every message, and `next`
// waits for the next one of a type that this client hasn't handed out yet.
export class TestClient {
  readonly received: ServerMessage[] = [];
  private readonly handedOut = new Set<number>();
  private listeners: (() => void)[] = [];
  private closeCode: number | null = null;

  private constructor(private readonly ws: WebSocket) {
    ws.on('message', (data) => {
      this.received.push(JSON.parse(data.toString()) as ServerMessage);
      this.notify();
    });
    ws.on('close', (code) => {
      this.closeCode = code;
      this.notify();
    });
  }

  static open(url: string, options: { origin: string; token?: string; autoPong?: boolean }): Promise<TestClient> {
    const ws = new WebSocket(url, {
      headers: { origin: options.origin, ...(options.token ? { cookie: `sgs_session=${options.token}` } : {}) },
      autoPong: options.autoPong ?? true,
    });
    return new Promise((resolve, reject) => {
      ws.once('open', () => resolve(new TestClient(ws)));
      ws.once('error', reject);
    });
  }

  send(message: object | string): void {
    this.ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  }

  sendBinary(bytes: Uint8Array): void {
    this.ws.send(bytes, { binary: true });
  }

  // The next message of `type` (that also passes `match`, when given).
  next<T extends ServerMessage['type']>(type: T, match: (message: MessageOf<T>) => boolean = () => true, timeoutMs = 2000): Promise<MessageOf<T>> {
    return this.waitFor(() => {
      const index = this.received.findIndex((m, i) => m.type === type && !this.handedOut.has(i) && match(m as MessageOf<T>));
      if (index === -1) return undefined;
      this.handedOut.add(index);
      return this.received[index] as MessageOf<T>;
    }, `a ${type} message`, timeoutMs);
  }

  closed(timeoutMs = 2000): Promise<number> {
    return this.waitFor(() => this.closeCode ?? undefined, 'the socket to close', timeoutMs);
  }

  close(): void {
    this.ws.close();
  }

  get isOpen(): boolean {
    return this.ws.readyState === WebSocket.OPEN;
  }

  private waitFor<T>(find: () => T | undefined, what: string, timeoutMs: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const check = () => {
        const found = find();
        if (found === undefined) return false;
        clearTimeout(timer);
        this.listeners = this.listeners.filter((l) => l !== listener);
        resolve(found);
        return true;
      };
      const listener = () => void check();
      const timer = setTimeout(() => {
        this.listeners = this.listeners.filter((l) => l !== listener);
        reject(new Error(`Timed out waiting for ${what}; received ${JSON.stringify(this.received.map((m) => m.type))}`));
      }, timeoutMs);
      if (!check()) this.listeners.push(listener);
    });
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

// The HTTP status of a refused upgrade.
export function refusedStatus(url: string, headers: Record<string, string>): Promise<number> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.once('unexpected-response', (_request, response) => {
      resolve(response.statusCode ?? 0);
      ws.terminate();
    });
    ws.once('open', () => reject(new Error('The upgrade was accepted')));
    ws.once('error', () => undefined);
  });
}
```

- [ ] **Step 3: Write the failing end-to-end tests**

Create `projects/server/src/socket/socketServer.spec.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { AddressInfo } from 'node:net';
import { FastifyInstance } from 'fastify';
import { PROTOCOL_VERSION } from 'protocol';
import type { RoomSnapshot } from 'protocol';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { buildApp } from '../http/app';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { SocketOptions } from './socketServer';
import { refusedStatus, TestClient } from './testClient';

const ORIGIN = 'http://localhost:4200';

async function setup(socket: SocketOptions = {}) {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app = await buildApp({ accounts, rooms, publicOrigin: ORIGIN, cookieSecure: false, rateLimits, socket });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const url = `ws://127.0.0.1:${(app.server.address() as AddressInfo).port}/api/ws`;
  const clients: TestClient[] = [];

  const sessionOf = (res: { cookies: { name: string; value: string }[] }) => res.cookies.find((c) => c.name === 'sgs_session')!.value;
  const post = (path: string, payload: object, session?: string) =>
    app.inject({ method: 'POST', url: path, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
  const signUp = async (displayName: string) =>
    sessionOf(await post('/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName }));
  const createRoom = async (session: string, displayName = 'Ann') =>
    (await post('/api/rooms', { seatCount: 4, rules: {}, displayName }, session)).json().id as string;
  const join = (session: string, roomId: string, displayName: string) => post(`/api/rooms/${roomId}/join`, { displayName }, session);
  const snapshot = async (session: string, roomId: string) =>
    (await app.inject({ method: 'GET', url: `/api/rooms/${roomId}`, cookies: { sgs_session: session } })).json() as RoomSnapshot;
  // Lets the server finish handling a close it has already seen.
  const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
  const open = async (session: string, autoPong = true) => {
    const client = await TestClient.open(url, { origin: ORIGIN, token: session, autoPong });
    clients.push(client);
    return client;
  };
  const connect = async (session: string, roomId: string, autoPong = true) => {
    const client = await open(session, autoPong);
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId });
    const welcome = await client.next('welcome');
    return { client, welcome, playerId: welcome.you.playerId };
  };
  // A room with Ann (host) and Bo, both connected.
  const twoInRoom = async () => {
    const ann = await signUp('Ann');
    const bo = await signUp('Bo');
    const roomId = await createRoom(ann);
    await join(bo, roomId, 'Bo');
    const host = await connect(ann, roomId);
    const guest = await connect(bo, roomId);
    await host.client.next('room.updated');
    return { ann, bo, roomId, host, guest };
  };
  const teardown = async () => {
    for (const client of clients) client.close();
    await app.close();
  };
  return { app, url, signUp, createRoom, join, snapshot, settle, open, connect, twoInRoom, teardown };
}

describe('socket server', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  afterEach(async () => {
    await ctx?.teardown();
  });

  it('refuses an upgrade without a session (401), from another origin (403) or on another path (404)', async () => {
    ctx = await setup();
    const session = await ctx.signUp('Ann');
    expect(await refusedStatus(ctx.url, { origin: ORIGIN })).toBe(401);
    expect(await refusedStatus(ctx.url, { origin: ORIGIN, cookie: 'sgs_session=garbage' })).toBe(401);
    expect(await refusedStatus(ctx.url, { origin: 'https://evil.example', cookie: `sgs_session=${session}` })).toBe(403);
    expect(await refusedStatus(ctx.url.replace('/api/ws', '/api/other'), { origin: ORIGIN, cookie: `sgs_session=${session}` })).toBe(404);
  });

  it("welcomes a member with their player id and the room, and the others see them connected", async () => {
    ctx = await setup();
    const { host, guest } = await ctx.twoInRoom();
    expect(guest.welcome).toMatchObject({ type: 'welcome', you: { playerId: expect.any(String), seatId: null }, game: null });
    expect(guest.welcome.room.members.map((m) => m.name)).toEqual(['Ann', 'Bo']);
    const update = host.client.received.filter((m) => m.type === 'room.updated').at(-1);
    expect(update?.type === 'room.updated' && update.room.members.map((m) => m.connected)).toEqual([true, true]);
  });

  it('answers a hello from another protocol version with version, then closes', async () => {
    ctx = await setup();
    const ann = await ctx.signUp('Ann');
    const roomId = await ctx.createRoom(ann);
    const client = await ctx.open(ann);
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION + 1, roomId });
    expect(await client.next('error')).toEqual({ type: 'error', code: 'version', message: 'Please reload to get the latest version' });
    await client.closed();
  });

  it('answers a hello from a non-member with not_member, then closes', async () => {
    ctx = await setup();
    const roomId = await ctx.createRoom(await ctx.signUp('Ann'));
    const client = await ctx.open(await ctx.signUp('Bo'));
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId, reqId: 'h1' });
    expect(await client.next('error')).toMatchObject({ code: 'not_member', reqId: 'h1' });
    await client.closed();
  });

  it('answers malformed messages with invalid_message and stays open (Review Focus 5)', async () => {
    ctx = await setup();
    const ann = await ctx.signUp('Ann');
    const roomId = await ctx.createRoom(ann);
    const client = await ctx.open(ann);
    client.send({ type: 'lobby.addBot', reqId: 'early' });
    expect(await client.next('error')).toMatchObject({ code: 'invalid_message', reqId: 'early' });
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId });
    await client.next('welcome');
    client.send('not json');
    expect(await client.next('error')).toEqual({ type: 'error', code: 'invalid_message', message: 'That request was not understood' });
    client.sendBinary(new Uint8Array([1, 2, 3]));
    expect((await client.next('error')).code).toBe('invalid_message');
    client.send({ type: 'lobby.dance', reqId: 'r1' });
    expect(await client.next('error')).toMatchObject({ code: 'invalid_message', reqId: 'r1' });
    client.send({ type: 'lobby.addBot', reqId: 'r2', extra: true });
    expect(await client.next('error')).toMatchObject({ code: 'invalid_message', reqId: 'r2' });
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId, reqId: 'r3' });
    expect(await client.next('error')).toMatchObject({ code: 'invalid_message', reqId: 'r3' });
    client.send({ type: 'lobby.addBot', reqId: 'r4' });
    expect(await client.next('ack')).toEqual({ type: 'ack', reqId: 'r4' });
    expect(client.isOpen).toBe(true);
  });

  it('closes the socket on a message over 16 KiB', async () => {
    ctx = await setup();
    const ann = await ctx.signUp('Ann');
    const { client } = await ctx.connect(ann, await ctx.createRoom(ann));
    client.send({ type: 'lobby.addBot', reqId: 'x'.repeat(20_000) });
    await client.closed();
  });

  it('routes lobby commands: the host adds a bot and everyone hears; a non-host gets not_host', async () => {
    ctx = await setup();
    const { host, guest } = await ctx.twoInRoom();
    host.client.send({ type: 'lobby.addBot', reqId: 'a1' });
    expect(await host.client.next('ack')).toEqual({ type: 'ack', reqId: 'a1' });
    const update = await guest.client.next('room.updated');
    expect(update.room.members.map((m) => m.name)).toEqual(['Ann', 'Bo', 'Bot 1']);
    guest.client.send({ type: 'lobby.addBot', reqId: 'b1' });
    expect(await guest.client.next('error')).toEqual({ type: 'error', reqId: 'b1', code: 'not_host', message: 'Only the host can do that' });
  });

  it('a second tab replaces the first, and the member stays connected (Review Focus 4)', async () => {
    ctx = await setup();
    const { ann, guest, bo, roomId } = await ctx.twoInRoom();
    const secondTab = await ctx.connect(bo, roomId);
    expect(await guest.client.next('replaced')).toEqual({ type: 'replaced' });
    await guest.client.closed();
    expect(secondTab.playerId).toBe(guest.playerId);
    await ctx.settle();
    expect((await ctx.snapshot(ann, roomId)).members.map((m) => m.connected)).toEqual([true, true]);
    expect(secondTab.client.isOpen).toBe(true);
  });

  it('tells a removed member and closes their socket', async () => {
    ctx = await setup();
    const { host, guest } = await ctx.twoInRoom();
    host.client.send({ type: 'lobby.removePlayer', reqId: 'k1', playerId: guest.playerId });
    expect(await guest.client.next('room.left')).toEqual({ type: 'room.left', reason: 'removed' });
    await guest.client.closed();
    expect((await host.client.next('room.updated')).room.members.map((m) => m.name)).toEqual(['Ann']);
  });

  it('acks room.leave, closes the socket, and the others see the member gone', async () => {
    ctx = await setup();
    const { host, guest } = await ctx.twoInRoom();
    guest.client.send({ type: 'room.leave', reqId: 'l1' });
    expect(await guest.client.next('ack')).toEqual({ type: 'ack', reqId: 'l1' });
    await guest.client.closed();
    expect((await host.client.next('room.updated')).room.members.map((m) => m.name)).toEqual(['Ann']);
  });

  it('drops a client that stops answering pings, and shows them away', async () => {
    ctx = await setup({ heartbeatMs: 40 });
    const ann = await ctx.signUp('Ann');
    const bo = await ctx.signUp('Bo');
    const roomId = await ctx.createRoom(ann);
    await ctx.join(bo, roomId, 'Bo');
    const host = await ctx.connect(ann, roomId);
    const silent = await ctx.connect(bo, roomId, false);
    await silent.client.closed();
    await host.client.next('room.updated', (m) => m.room.members.find((member) => member.name === 'Bo')?.connected === false);
    expect(host.client.isOpen).toBe(true);
  });

  it('closes a socket that never says hello', async () => {
    ctx = await setup({ helloTimeoutMs: 40 });
    const client = await ctx.open(await ctx.signUp('Ann'));
    await client.closed();
  });
});
```

- [ ] **Step 4: Run them and see them fail**

Run: `npx jest --selectProjects server socket/`
Expected: FAIL. `./socketServer` doesn't exist.

- [ ] **Step 5: Write the socket server**

Create `projects/server/src/socket/socketServer.ts`:

```ts
import { IncomingMessage } from 'node:http';
import { Duplex } from 'node:stream';
import { TypeCompiler } from '@sinclair/typebox/compiler';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { ERROR_MESSAGES, PROTOCOL_VERSION, REQ_ID_MAX, SOCKET_PATH } from 'protocol';
import type { ClientMessage, ErrorCode } from 'protocol';
import { ClientMessageSchema } from 'protocol/schemas';
import { AccountService } from '../auth/accounts';
import { SESSION_COOKIE } from '../http/session';
import { TypedApp } from '../http/types';
import { UserRecord } from '../persistence/records';
import { RoomError } from '../rooms/errors';
import { MemberConnection, RoomService } from '../rooms/roomService';

export const HEARTBEAT_MS = 15_000;
export const HELLO_TIMEOUT_MS = 10_000;
// The largest message a client may send; real ones are a few hundred bytes.
const MAX_PAYLOAD = 16 * 1024;
// WebSocket close codes: 1000 normal, 1008 policy (refused or too slow).
const CLOSE_NORMAL = 1000;
const CLOSE_POLICY = 1008;

export interface SocketOptions {
  heartbeatMs?: number;
  helloTimeoutMs?: number;
}

export interface SocketDeps extends SocketOptions {
  accounts: AccountService;
  rooms: RoomService;
  publicOrigin: string;
}

const clientMessage = TypeCompiler.Compile(ClientMessageSchema);
const NOT_JSON = Symbol('not JSON');

function parse(data: RawData, isBinary: boolean): unknown {
  if (isBinary) return NOT_JSON;
  try {
    return JSON.parse(data.toString());
  } catch {
    return NOT_JSON;
  }
}

// The client's reqId, when it sent a usable one, so even a refused message is answered against it.
function reqIdOf(value: unknown): string | undefined {
  const reqId = (value as { reqId?: unknown } | null)?.reqId;
  return typeof reqId === 'string' && reqId.length >= 1 && reqId.length <= REQ_ID_MAX ? reqId : undefined;
}

// A hello from another protocol version, checked before the schema so a client
// of any version learns it must reload.
function isOtherVersionHello(value: unknown): boolean {
  const message = value as { type?: unknown; protocolVersion?: unknown } | null;
  return message?.type === 'hello' && message.protocolVersion !== PROTOCOL_VERSION;
}

function refuse(socket: Duplex, status: number, text: string): void {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

// The room socket on /api/ws (spec "Socket protocol"): authenticates the
// upgrade with the session cookie and Origin, then routes each member's
// messages to the RoomService.
export function attachSocketServer(app: TypedApp, deps: SocketDeps): void {
  const heartbeatMs = deps.heartbeatMs ?? HEARTBEAT_MS;
  const helloTimeoutMs = deps.helloTimeoutMs ?? HELLO_TIMEOUT_MS;
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  const missedPongs = new Map<WebSocket, number>();

  app.server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    upgrade(request, socket, head).catch((err: unknown) => {
      app.log.error(err, 'WebSocket upgrade failed');
      refuse(socket, 500, 'Internal Server Error');
    });
  });

  async function upgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    if (new URL(request.url ?? '/', 'http://localhost').pathname !== SOCKET_PATH) return refuse(socket, 404, 'Not Found');
    if (request.headers.origin !== deps.publicOrigin) return refuse(socket, 403, 'Forbidden');
    const token = app.parseCookie(request.headers.cookie ?? '')[SESSION_COOKIE];
    const auth = token ? await deps.accounts.authenticate(token) : null;
    if (!auth) return refuse(socket, 401, 'Unauthorized');
    wss.handleUpgrade(request, socket, head, (ws) => serve(ws, auth.user));
  }

  function serve(ws: WebSocket, user: UserRecord): void {
    // 'waiting' until a hello arrives, 'joining' while it is handled, then the membership.
    let state: 'waiting' | 'joining' | { roomId: string; playerId: string } = 'waiting';
    const connection: MemberConnection = {
      send: (message) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
      },
      close: () => ws.close(CLOSE_NORMAL),
    };
    const fail = (code: ErrorCode, reqId: string | undefined) =>
      connection.send({ type: 'error', ...(reqId ? { reqId } : {}), code, message: ERROR_MESSAGES[code] });
    const failWith = (err: unknown, reqId: string | undefined) => {
      if (err instanceof RoomError) return fail(err.code, reqId);
      app.log.error(err, 'Room request failed');
      fail('internal', reqId);
    };

    const helloTimer = setTimeout(() => {
      if (typeof state === 'string') ws.close(CLOSE_POLICY);
    }, helloTimeoutMs);
    missedPongs.set(ws, 0);
    ws.on('pong', () => missedPongs.set(ws, 0));
    ws.on('error', (err) => app.log.warn(err, 'WebSocket error'));
    ws.on('close', () => {
      clearTimeout(helloTimer);
      missedPongs.delete(ws);
      if (typeof state !== 'string') void deps.rooms.disconnect(state.roomId, state.playerId, connection).catch((err: unknown) => app.log.error(err, 'Disconnect failed'));
    });

    ws.on('message', (data: RawData, isBinary: boolean) => {
      const value = parse(data, isBinary);
      if (value === NOT_JSON) return fail('invalid_message', undefined);
      const reqId = reqIdOf(value);
      if (isOtherVersionHello(value)) {
        fail('version', reqId);
        return ws.close(CLOSE_POLICY);
      }
      if (!clientMessage.Check(value)) return fail('invalid_message', reqId);
      const message: ClientMessage = value;

      if (message.type === 'hello') {
        if (state !== 'waiting') return fail('invalid_message', reqId);
        state = 'joining';
        deps.rooms.connect(user, message.roomId, connection).then(
          (playerId) => {
            clearTimeout(helloTimer);
            state = { roomId: message.roomId, playerId };
            // The socket closed while the hello was handled: the close
            // handler saw no membership, so release it here.
            if (ws.readyState !== WebSocket.OPEN) void deps.rooms.disconnect(message.roomId, playerId, connection);
          },
          (err: unknown) => {
            failWith(err, reqId);
            ws.close(CLOSE_POLICY);
          }
        );
        return;
      }

      if (typeof state === 'string') return fail('invalid_message', reqId);
      deps.rooms.command(user, state.roomId, state.playerId, message).then(
        () => {
          if (reqId) connection.send({ type: 'ack', reqId });
          if (message.type === 'room.leave') ws.close(CLOSE_NORMAL);
        },
        (err: unknown) => failWith(err, reqId)
      );
    });
  }

  // Two pings in a row without a pong: the member is gone.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      const missed = missedPongs.get(ws) ?? 0;
      if (missed >= 2) {
        ws.terminate();
        continue;
      }
      missedPongs.set(ws, missed + 1);
      ws.ping();
    }
  }, heartbeatMs);
  heartbeat.unref();

  app.addHook('preClose', async () => {
    clearInterval(heartbeat);
    for (const ws of wss.clients) ws.terminate();
    wss.close();
  });
}
```

- [ ] **Step 6: Attach it in `buildApp`**

In `projects/server/src/http/app.ts`:

1. Add this import:

```ts
import { attachSocketServer, SocketOptions } from '../socket/socketServer';
```

2. Add to `AppDeps`:

```ts
  // Heartbeat and hello timeouts; tests shorten them.
  socket?: SocketOptions;
```

3. Just before `await app.ready();`, add:

```ts
  attachSocketServer(app, { accounts: deps.accounts, rooms: deps.rooms, publicOrigin: deps.publicOrigin, ...deps.socket });
```

- [ ] **Step 7: Run the tests and the type check**

Run: `npx jest --selectProjects server && npm run typecheck:server`
Expected: PASS, and the type check prints nothing.

Run the socket suite three more times to check for flakiness:

```bash
for i in 1 2 3; do npx jest --selectProjects server socket/ || break; done
```

Expected: PASS every time.

- [ ] **Step 8: Update the server README**

In `projects/server/README.md`:

1. Replace the opening paragraph with:

```markdown
The Node backend: Fastify HTTP API, the room WebSocket on `/api/ws`, and
Postgres through Kysely. Design: `docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`.
```

2. Add a section before "## Tests":

```markdown
## Rooms and the socket

- Live rooms are held in memory by `RoomService`, and every change is written
  through to Postgres. On start, lobbies are reloaded from the store with every
  player away, so a restart (or `tsx watch` reloading) keeps them.
- Each room processes its inputs one at a time (`rooms/serialQueue.ts`).
- The socket authenticates with the session cookie and `Origin`, like the HTTP
  API. A browser opens one socket per Lobby screen, and its first message is
  `hello { protocolVersion, roomId }`.
- In dev, `projects/app/proxy.conf.json` already proxies `/api` with
  `ws: true`, so the socket works through `npm start`.
```

3. Add these lines under "## Layout":

```markdown
- `src/rooms/`: `Room` (lobby rules), `RoomService` (live rooms, host rules, restore), the serial queue.
- `src/socket/`: the WebSocket server and the end-to-end `TestClient`.
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json projects/server
git commit -m "feat(server): room WebSocket with handshake, heartbeat and lobby commands

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Angular: sign-in guard, `RoomsService`, `SocketService` and `OnlineNotice`

**Files:**
- Modify: `projects/app/src/app/auth/auth.service.ts` (export the network message)
- Create:
  - `projects/app/src/app/auth/require-sign-in.ts`
  - `projects/app/src/app/online/online-notice.ts`
  - `projects/app/src/app/online/rooms.service.ts`
  - `projects/app/src/app/online/socket.service.ts`
  - `projects/app/src/app/online/testing.ts` (test fixtures: no Jest APIs, because `ng build` compiles it)
- Test:
  - `projects/app/src/app/auth/require-sign-in.spec.ts`
  - `projects/app/src/app/online/rooms.service.spec.ts`
  - `projects/app/src/app/online/socket.service.spec.ts`

**Interfaces:**
- Consumes: `AuthService`, `ApiError` and `toApiError` (Stage 2); the `protocol` types from Task 1.
- Produces:
  - `NETWORK_ERROR_MESSAGE`, exported from `auth.service.ts`
  - `requireSignIn: CanActivateFn`
  - `OnlineNotice`, provided in root:
    - `show(text: string): void`
    - `take(): string | null`, which returns the message once and then clears it
  - `RoomsService`, provided in root:
    - signals `list: Signal<RoomList | null>` and `error: Signal<string | null>`
    - `pollMs = 5000`
    - `refresh(): Promise<void>`, `startPolling(): void` and `stopPolling(): void`
    - `create(body: CreateRoomBody): Promise<string>` and `join(roomId, displayName): Promise<void>`, which reject with `ApiError`
  - `SocketService`, provided per component:
    - signal `status: Signal<SocketStatus>`, where `SocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'ended'`
    - `messages: Observable<ServerMessage>`
    - `connect(roomId): void`
    - `request(command: RoomRequest): Promise<void>`, which rejects with `ApiError`
    - `end(): void`
  - `WEB_SOCKET_FACTORY: InjectionToken<(url: string) => WebSocketLike>`
  - `RECONNECT_DELAYS_MS` and `socketUrl()`
  - From `testing.ts`: `FakeSocket` and the fixtures `ROOM` (a `RoomSnapshot`) and `welcome(room?, playerId?)`

- [ ] **Step 1: Export the network message**

In `projects/app/src/app/auth/auth.service.ts`, add above `toApiError`:

```ts
export const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again";
```

and use it in `toApiError`:

```ts
    if (err.status === 0) return new ApiError('network', NETWORK_ERROR_MESSAGE, 0);
```

- [ ] **Step 2: Write the test fixtures**

Create `projects/app/src/app/online/testing.ts`:

```ts
import type { RoomSnapshot, ServerMessage } from 'protocol';
import type { WebSocketLike } from './socket.service';

// Test fixtures for the online screens. `ng build` compiles this file, so it
// must not use Jest APIs; nothing outside tests imports it.

export const ROOM: RoomSnapshot = {
  id: '5b0d6c1e-2f43-4a8e-9a57-0c7d0c4f8e21',
  visibility: 'open',
  status: 'lobby',
  seatCount: 4,
  rules: { firstRevealDraw: true },
  hostPlayerId: 'p-ann',
  members: [
    { playerId: 'p-ann', name: 'Ann', kind: 'human', isRegistered: true, connected: true, botControlled: false },
    { playerId: 'p-bo', name: 'Bo', kind: 'human', isRegistered: true, connected: true, botControlled: false },
  ],
  lastResult: null,
  seatLimits: { min: 2, max: 8 },
};

export function welcome(room: RoomSnapshot = ROOM, playerId = 'p-ann'): ServerMessage {
  return { type: 'welcome', you: { playerId, seatId: null }, room, game: null };
}

// A WebSocket the test drives: it records what the app sends, and the test
// plays the server's side.
export class FakeSocket implements WebSocketLike {
  readyState: number = WebSocket.CONNECTING;
  onopen: WebSocket['onopen'] = null;
  onmessage: WebSocket['onmessage'] = null;
  onclose: WebSocket['onclose'] = null;
  readonly sent: Record<string, unknown>[] = [];
  closedByApp = false;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(): void {
    this.closedByApp = true;
    this.readyState = WebSocket.CLOSED;
  }

  serverOpens(): void {
    this.readyState = WebSocket.OPEN;
    this.onopen?.call(this as unknown as WebSocket, new Event('open'));
  }

  serverSends(message: ServerMessage): void {
    this.onmessage?.call(this as unknown as WebSocket, new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  serverCloses(): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.call(this as unknown as WebSocket, new CloseEvent('close'));
  }

  // The last request the app sent, as the server would see it.
  get lastSent(): Record<string, unknown> | undefined {
    return this.sent.at(-1);
  }
}
```

- [ ] **Step 3: Write the failing tests**

Create `projects/app/src/app/auth/require-sign-in.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Me } from 'protocol';
import { AuthService } from './auth.service';
import { requireSignIn } from './require-sign-in';

describe('requireSignIn', () => {
  const me = signal<Me | null>(null);
  const loaded = signal(true);
  const auth = {
    me,
    loaded,
    load: jest.fn(async () => {
      loaded.set(true);
      return me();
    }),
  };

  beforeEach(() => {
    me.set(null);
    loaded.set(true);
    auth.load.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        provideRouter([
          { path: 'rooms', canActivate: [requireSignIn], children: [] },
          { path: 'sign-in', children: [] },
        ]),
      ],
    });
  });

  it('lets a signed-in user through', async () => {
    me.set({ id: 'u2', kind: 'guest', displayName: 'Gus' });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rooms');
    expect(router.url).toBe('/rooms');
  });

  it('sends a signed-out user to Sign In, coming back afterwards', async () => {
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rooms');
    expect(router.url).toBe('/sign-in?returnUrl=%2Frooms');
  });

  it('waits for the first answer about who is signed in', async () => {
    loaded.set(false);
    auth.load.mockImplementationOnce(async () => {
      me.set({ id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
      loaded.set(true);
      return me();
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/rooms');
    expect(auth.load).toHaveBeenCalledTimes(1);
    expect(router.url).toBe('/rooms');
  });
});
```

Create `projects/app/src/app/online/rooms.service.spec.ts`:

```ts
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RoomList } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { RoomsService } from './rooms.service';

const LIST: RoomList = {
  rooms: [{ id: 'r1', visibility: 'open', hostName: 'Ann', memberCount: 2, capacity: 4, status: 'lobby', youAreMember: false }],
  seatLimits: { min: 2, max: 8 },
};

describe('RoomsService', () => {
  let rooms: RoomsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    rooms = TestBed.inject(RoomsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    rooms.stopPolling();
    http.verify();
    jest.useRealTimers();
  });

  it('refresh() loads the list', async () => {
    const done = rooms.refresh();
    http.expectOne({ method: 'GET', url: '/api/rooms' }).flush(LIST);
    await done;
    expect(rooms.list()).toEqual(LIST);
    expect(rooms.error()).toBeNull();
  });

  it("refresh() keeps the last list and shows the server's message when it fails", async () => {
    const first = rooms.refresh();
    http.expectOne('/api/rooms').flush(LIST);
    await first;
    const second = rooms.refresh();
    http.expectOne('/api/rooms').error(new ProgressEvent('error'), { status: 0 });
    await second;
    expect(rooms.list()).toEqual(LIST);
    expect(rooms.error()).toBe("Can't reach the server. Check your connection and try again");
  });

  it('polls right away and then every pollMs until stopped', async () => {
    jest.useFakeTimers();
    rooms.startPolling();
    http.expectOne('/api/rooms').flush(LIST);
    jest.advanceTimersByTime(rooms.pollMs);
    http.expectOne('/api/rooms').flush(LIST);
    rooms.stopPolling();
    jest.advanceTimersByTime(rooms.pollMs * 3);
    http.expectNone('/api/rooms');
  });

  it('create() posts the body and returns the new id', async () => {
    const done = rooms.create({ seatCount: 4, rules: { firstRevealDraw: true }, displayName: 'Ann' });
    const req = http.expectOne({ method: 'POST', url: '/api/rooms' });
    expect(req.request.body).toEqual({ seatCount: 4, rules: { firstRevealDraw: true }, displayName: 'Ann' });
    req.flush({ id: 'r9' }, { status: 201, statusText: 'Created' });
    expect(await done).toBe('r9');
  });

  it("join() posts the name, and rejects with the server's error", async () => {
    const done = rooms.join('r1', 'Ann');
    const req = http.expectOne({ method: 'POST', url: '/api/rooms/r1/join' });
    expect(req.request.body).toEqual({ displayName: 'Ann' });
    req.flush({ code: 'name_taken', message: 'That name is already taken in this room. Choose another.' }, { status: 409, statusText: 'Conflict' });
    const err = await done.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'name_taken', message: 'That name is already taken in this room. Choose another.' });
  });
});
```

Create `projects/app/src/app/online/socket.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { PROTOCOL_VERSION } from 'protocol';
import type { ServerMessage } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { RECONNECT_DELAYS_MS, SocketService, socketUrl, WEB_SOCKET_FACTORY } from './socket.service';
import { FakeSocket, ROOM, welcome } from './testing';

describe('SocketService', () => {
  let sockets: FakeSocket[];
  let service: SocketService;
  const latest = () => sockets.at(-1)!;
  const connected = () => {
    service.connect(ROOM.id);
    latest().serverOpens();
    latest().serverSends(welcome());
  };

  beforeEach(() => {
    jest.useFakeTimers();
    sockets = [];
    TestBed.configureTestingModule({
      providers: [
        SocketService,
        {
          provide: WEB_SOCKET_FACTORY,
          useValue: (url: string) => {
            const socket = new FakeSocket(url);
            sockets.push(socket);
            return socket;
          },
        },
      ],
    });
    service = TestBed.inject(SocketService);
  });
  afterEach(() => jest.useRealTimers());

  it('builds the socket URL from the page origin', () => {
    expect(socketUrl({ protocol: 'http:', host: 'localhost:4200' })).toBe('ws://localhost:4200/api/ws');
    expect(socketUrl({ protocol: 'https:', host: 'sanguosha.example' })).toBe('wss://sanguosha.example/api/ws');
  });

  it('says hello with the protocol version and the room, and is open after welcome', () => {
    service.connect(ROOM.id);
    expect(service.status()).toBe('connecting');
    latest().serverOpens();
    expect(latest().sent).toEqual([{ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId: ROOM.id }]);
    latest().serverSends(welcome());
    expect(service.status()).toBe('open');
  });

  it('passes every server message on', () => {
    const seen: ServerMessage[] = [];
    service.messages.subscribe((m) => seen.push(m));
    connected();
    latest().serverSends({ type: 'room.updated', room: ROOM });
    expect(seen.map((m) => m.type)).toEqual(['welcome', 'room.updated']);
  });

  it('numbers requests, resolving on ack and rejecting with the error', async () => {
    connected();
    const added = service.request({ type: 'lobby.addBot' });
    expect(latest().lastSent).toEqual({ type: 'lobby.addBot', reqId: 'r1' });
    latest().serverSends({ type: 'ack', reqId: 'r1' });
    await expect(added).resolves.toBeUndefined();

    const refused = service.request({ type: 'lobby.addBot' });
    latest().serverSends({ type: 'error', reqId: 'r2', code: 'room_full', message: 'This room is full' });
    const err = await refused.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'room_full', message: 'This room is full' });
  });

  it('refuses a request while not open', async () => {
    service.connect(ROOM.id);
    await expect(service.request({ type: 'lobby.addBot' })).rejects.toMatchObject({ code: 'network' });
  });

  it('rejects requests still waiting when the socket drops', async () => {
    connected();
    const pending = service.request({ type: 'lobby.addBot' });
    latest().serverCloses();
    await expect(pending).rejects.toMatchObject({ code: 'network' });
  });

  it('reconnects after 1 s, 2 s, 4 s, 8 s, then every 15 s, and starts over after a welcome', () => {
    connected();
    for (const delay of [...RECONNECT_DELAYS_MS, 15_000]) {
      const before = sockets.length;
      latest().serverCloses();
      expect(service.status()).toBe('reconnecting');
      jest.advanceTimersByTime(delay - 1);
      expect(sockets.length).toBe(before);
      jest.advanceTimersByTime(1);
      expect(sockets.length).toBe(before + 1);
      latest().serverOpens();
      expect(latest().lastSent).toMatchObject({ type: 'hello' });
    }
    latest().serverSends(welcome());
    expect(service.status()).toBe('open');
    const before = sockets.length;
    latest().serverCloses();
    jest.advanceTimersByTime(1_000);
    expect(sockets.length).toBe(before + 1);
  });

  it.each<[string, ServerMessage]>([
    ['replaced', { type: 'replaced' }],
    ['room.left', { type: 'room.left', reason: 'removed' }],
    ['a version error', { type: 'error', code: 'version', message: 'Please reload to get the latest version' }],
    ['a not_member error', { type: 'error', code: 'not_member', message: "You're not in this room" }],
  ])('stops for good after %s', (_label, message) => {
    connected();
    const before = sockets.length;
    latest().serverSends(message);
    expect(service.status()).toBe('ended');
    expect(latest().closedByApp).toBe(true);
    latest().serverCloses();
    jest.advanceTimersByTime(60_000);
    expect(sockets.length).toBe(before);
  });

  it('keeps going after an error that answers a request', () => {
    connected();
    void service.request({ type: 'lobby.addBot' }).catch(() => undefined);
    latest().serverSends({ type: 'error', reqId: 'r1', code: 'not_member', message: "You're not in this room" });
    expect(service.status()).toBe('open');
  });

  it('end() closes the socket and never reconnects', () => {
    connected();
    const socket = latest();
    service.end();
    expect(socket.closedByApp).toBe(true);
    expect(service.status()).toBe('idle');
    jest.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });
});
```

- [ ] **Step 4: Run them and see them fail**

Run: `npx jest --selectProjects app require-sign-in online/`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 5: Implement**

Create `projects/app/src/app/auth/require-sign-in.ts`:

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Online screens need a signed-in user, registered or guest. Anyone else goes
// to Sign In, which returns here afterwards.
export const requireSignIn: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const me = auth.loaded() ? auth.me() : await auth.load();
  return me ? true : router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};
```

Create `projects/app/src/app/online/online-notice.ts`:

```ts
import { Injectable } from '@angular/core';

// One message for the next online screen to show, such as why the Lobby
// closed under you. Taking it clears it, so it shows once.
@Injectable({ providedIn: 'root' })
export class OnlineNotice {
  private pending: string | null = null;

  show(text: string): void {
    this.pending = text;
  }

  take(): string | null {
    const text = this.pending;
    this.pending = null;
    return text;
  }
}
```

Create `projects/app/src/app/online/rooms.service.ts`:

```ts
import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CreateRoomBody, JoinRoomBody, RoomCreated, RoomList } from 'protocol';
import { toApiError } from '../auth/auth.service';

export const ROOM_LIST_POLL_MS = 5_000;

// The room list (polled while the Rooms screen is open), and creating and
// joining rooms over HTTP. The server decides everything; this only asks.
@Injectable({ providedIn: 'root' })
export class RoomsService {
  private readonly http = inject(HttpClient);
  private readonly _list = signal<RoomList | null>(null);
  private readonly _error = signal<string | null>(null);
  private timer: ReturnType<typeof setInterval> | null = null;

  pollMs = ROOM_LIST_POLL_MS;
  readonly list = this._list.asReadonly();
  readonly error = this._error.asReadonly();

  async refresh(): Promise<void> {
    try {
      this._list.set(await firstValueFrom(this.http.get<RoomList>('/api/rooms')));
      this._error.set(null);
    } catch (err) {
      this._error.set(toApiError(err).message);
    }
  }

  startPolling(): void {
    this.stopPolling();
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.pollMs);
  }

  stopPolling(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async create(body: CreateRoomBody): Promise<string> {
    try {
      return (await firstValueFrom(this.http.post<RoomCreated>('/api/rooms', body))).id;
    } catch (err) {
      throw toApiError(err);
    }
  }

  async join(roomId: string, displayName: string): Promise<void> {
    const body: JoinRoomBody = { displayName };
    try {
      await firstValueFrom(this.http.post<RoomCreated>(`/api/rooms/${encodeURIComponent(roomId)}/join`, body));
    } catch (err) {
      throw toApiError(err);
    }
  }
}
```

Create `projects/app/src/app/online/socket.service.ts`:

```ts
import { DestroyRef, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { PROTOCOL_VERSION, SOCKET_PATH } from 'protocol';
import type { ErrorCode, RoomRequest, ServerMessage } from 'protocol';
import { ApiError, NETWORK_ERROR_MESSAGE } from '../auth/auth.service';

export type WebSocketLike = Pick<WebSocket, 'readyState' | 'send' | 'close' | 'onopen' | 'onmessage' | 'onclose'>;

export const WEB_SOCKET_FACTORY = new InjectionToken<(url: string) => WebSocketLike>('WEB_SOCKET_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new WebSocket(url),
});

// 'connecting' until the first welcome; 'reconnecting' after a drop until the
// next welcome; 'ended' once the server said this connection is over.
export type SocketStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'ended';

export const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000];
// Errors, sent unasked, that no reconnect can fix.
const FATAL_ERRORS: ReadonlySet<ErrorCode> = new Set<ErrorCode>(['version', 'not_member', 'not_found']);

export function socketUrl(location: Pick<Location, 'protocol' | 'host'> = window.location): string {
  return `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${SOCKET_PATH}`;
}

// The room socket for one screen: provide it in the component. It says hello
// on every (re)connect, reconnects with backoff, and pairs each request with
// its ack or error. It stops for good when the server ends the connection.
@Injectable()
export class SocketService {
  private readonly createSocket = inject(WEB_SOCKET_FACTORY);
  private readonly _status = signal<SocketStatus>('idle');
  private readonly incoming = new Subject<ServerMessage>();
  private readonly pending = new Map<string, { resolve: () => void; reject: (err: ApiError) => void }>();
  private socket: WebSocketLike | null = null;
  private roomId: string | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private nextReqId = 1;

  readonly status = this._status.asReadonly();
  readonly messages: Observable<ServerMessage> = this.incoming.asObservable();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.end());
  }

  connect(roomId: string): void {
    this.stop();
    this.roomId = roomId;
    this.attempt = 0;
    this._status.set('connecting');
    this.open();
  }

  request(command: RoomRequest): Promise<void> {
    const socket = this.socket;
    if (!socket || this._status() !== 'open') return Promise.reject(new ApiError('network', NETWORK_ERROR_MESSAGE, 0));
    const reqId = `r${this.nextReqId++}`;
    return new Promise<void>((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      socket.send(JSON.stringify({ ...command, reqId }));
    });
  }

  // The screen is going away: close, and never reconnect.
  end(): void {
    this.stop();
    this.roomId = null;
    this._status.set('idle');
  }

  private open(): void {
    const socket = this.createSocket(socketUrl());
    this.socket = socket;
    socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId: this.roomId }));
    socket.onmessage = (event) => this.receive(event.data);
    socket.onclose = () => this.dropped(socket);
  }

  private receive(data: unknown): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(String(data)) as ServerMessage;
    } catch {
      return;
    }
    if (message.type === 'welcome') {
      this.attempt = 0;
      this._status.set('open');
    } else if (message.type === 'ack') {
      this.settle(message.reqId);
    } else if (message.type === 'error' && message.reqId) {
      this.settle(message.reqId, new ApiError(message.code, message.message, 0));
    }
    const final =
      message.type === 'replaced' || message.type === 'room.left' || (message.type === 'error' && !message.reqId && FATAL_ERRORS.has(message.code));
    if (final) {
      this.stop();
      this._status.set('ended');
    }
    this.incoming.next(message);
  }

  private dropped(socket: WebSocketLike): void {
    if (socket !== this.socket) return;
    this.socket = null;
    this.rejectPending();
    if (this.roomId === null || this._status() === 'ended') return;
    this._status.set('reconnecting');
    const delay = RECONNECT_DELAYS_MS[Math.min(this.attempt, RECONNECT_DELAYS_MS.length - 1)];
    this.attempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, delay);
  }

  private settle(reqId: string, error?: ApiError): void {
    const waiter = this.pending.get(reqId);
    if (!waiter) return;
    this.pending.delete(reqId);
    if (error) waiter.reject(error);
    else waiter.resolve();
  }

  private rejectPending(): void {
    for (const waiter of this.pending.values()) waiter.reject(new ApiError('network', NETWORK_ERROR_MESSAGE, 0));
    this.pending.clear();
  }

  // Detaches and closes the socket and cancels any retry; the caller sets the status.
  private stop(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.close();
    }
    this.rejectPending();
  }
}
```

- [ ] **Step 6: Run the tests and the build**

Run: `npx jest --selectProjects app && npx ng build app`
Expected: every app test PASSES, and the build succeeds.

- [ ] **Step 7: Commit**

```bash
git add projects/app/src/app/auth projects/app/src/app/online
git commit -m "feat(app): sign-in guard, RoomsService, reconnecting SocketService and OnlineNotice

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Rooms screen, Create Room and Join Room dialogs, and the Online link

**Files:**
- Create:
  - `projects/app/src/app/online/room-labels.ts`
  - `projects/app/src/app/online/online-page.css`
  - `projects/app/src/app/online/rooms-page.ts`
  - `projects/app/src/app/online/create-room-dialog.ts`
  - `projects/app/src/app/online/join-room-dialog.ts`
- Modify:
  - `projects/app/src/app/app.routes.ts`
  - `projects/app/src/app/app.ts`
  - `projects/app/src/app/app.html`
  - `projects/app/src/app/app.spec.ts`
- Test:
  - `projects/app/src/app/online/room-labels.spec.ts`
  - `projects/app/src/app/online/rooms-page.spec.ts`
  - `projects/app/src/app/online/create-room-dialog.spec.ts`
  - `projects/app/src/app/online/join-room-dialog.spec.ts`
  - `projects/app/src/app/app.spec.ts`

**Interfaces:**
- Consumes:
  - `RoomsService`, `OnlineNotice` and `requireSignIn` (Task 8);
  - `AuthService` (`me` and `isRegistered`) and `ApiError` (Stage 2);
  - `FIRST_REVEAL_MIN_SEATS` from `content`; `DISPLAY_NAME_MAX` and `ERROR_MESSAGES` from `protocol`.
- Produces:
  - the route `/rooms` → `RoomsPage`, guarded by `requireSignIn`
  - `roomStatusLabel(room: RoomListItem): 'Waiting for Players' | 'Full' | 'In Progress'` and `canJoin(room: RoomListItem): boolean`
  - `CreateRoomDialog`, which takes `CreateRoomDialogData { seatLimits: SeatLimits; displayName: string }` and closes with the new room id
  - `JoinRoomDialog`, which takes `JoinRoomDialogData { roomId: string; hostName: string | null; displayName: string }` and closes with `true` once joined
  - `online-page.css`, shared with the Lobby in Task 10
  - the toolbar item **Online**: `a.nav-online`, icon `public`, linking to `/rooms`, active on `/rooms` and below it

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/online/room-labels.spec.ts`:

```ts
import type { RoomListItem } from 'protocol';
import { canJoin, roomStatusLabel } from './room-labels';

const room = (overrides: Partial<RoomListItem>): RoomListItem => ({
  id: 'r1',
  visibility: 'open',
  hostName: 'Ann',
  memberCount: 2,
  capacity: 4,
  status: 'lobby',
  youAreMember: false,
  ...overrides,
});

describe('room labels', () => {
  it('names the status the way the Rooms list shows it', () => {
    expect(roomStatusLabel(room({}))).toBe('Waiting for Players');
    expect(roomStatusLabel(room({ memberCount: 4 }))).toBe('Full');
    expect(roomStatusLabel(room({ status: 'playing', memberCount: 4 }))).toBe('In Progress');
  });

  it('offers Join only for a lobby with space', () => {
    expect(canJoin(room({}))).toBe(true);
    expect(canJoin(room({ memberCount: 4 }))).toBe(false);
    expect(canJoin(room({ status: 'playing' }))).toBe(false);
  });
});
```

Create `projects/app/src/app/online/rooms-page.spec.ts`:

```ts
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import type { Me, RoomList } from 'protocol';
import { AuthService } from '../auth/auth.service';
import { CreateRoomDialog } from './create-room-dialog';
import { JoinRoomDialog } from './join-room-dialog';
import { OnlineNotice } from './online-notice';
import { RoomsPage } from './rooms-page';
import { RoomsService } from './rooms.service';

const ANN: Me = { id: 'u1', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' };
const GUS: Me = { id: 'u2', kind: 'guest', displayName: 'Gus' };
const LIST: RoomList = {
  rooms: [
    { id: 'r-mine', visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: true },
    { id: 'r-open', visibility: 'open', hostName: 'Bo', memberCount: 2, capacity: 4, status: 'lobby', youAreMember: false },
    { id: 'r-full', visibility: 'open', hostName: 'Cy', memberCount: 4, capacity: 4, status: 'lobby', youAreMember: false },
    { id: 'r-playing', visibility: 'open', hostName: 'Di', memberCount: 3, capacity: 3, status: 'playing', youAreMember: false },
  ],
  seatLimits: { min: 2, max: 8 },
};

describe('RoomsPage', () => {
  const list = signal<RoomList | null>(null);
  const error = signal<string | null>(null);
  const rooms = { list, error, startPolling: jest.fn(), stopPolling: jest.fn() };
  const me = signal<Me | null>(ANN);
  const auth = { me, isRegistered: computed(() => me()?.kind === 'registered') };
  const dialog = { open: jest.fn() };
  let notice: OnlineNotice;

  beforeEach(() => {
    list.set(LIST);
    error.set(null);
    me.set(ANN);
    rooms.startPolling.mockClear();
    rooms.stopPolling.mockClear();
    dialog.open.mockReset();
    notice = new OnlineNotice();
  });

  async function create() {
    await TestBed.configureTestingModule({
      imports: [RoomsPage],
      providers: [
        { provide: RoomsService, useValue: rooms },
        { provide: AuthService, useValue: auth },
        { provide: MatDialog, useValue: dialog },
        { provide: OnlineNotice, useValue: notice },
        provideRouter([{ path: 'rooms/:id', children: [] }]),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RoomsPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement, router: TestBed.inject(Router) };
  }

  const row = (el: HTMLElement, host: string) => [...el.querySelectorAll('li.room')].find((li) => li.querySelector('.host-name')?.textContent?.trim() === host) as HTMLElement;

  it('polls the list while open, and stops when closed', async () => {
    const { fixture } = await create();
    expect(rooms.startPolling).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(rooms.stopPolling).toHaveBeenCalled();
  });

  it('shows each room with its host, count and status, and Join only where there is space', async () => {
    const { el } = await create();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Rooms');
    const open = row(el, 'Bo');
    expect(open.querySelector('.count')?.textContent?.trim()).toBe('2 / 4');
    expect(open.querySelector('.status')?.textContent?.trim()).toBe('Waiting for Players');
    expect((open.querySelector('button.join') as HTMLButtonElement).disabled).toBe(false);
    expect(row(el, 'Cy').querySelector('.status')?.textContent?.trim()).toBe('Full');
    expect((row(el, 'Cy').querySelector('button.join') as HTMLButtonElement).disabled).toBe(true);
    expect(row(el, 'Di').querySelector('.status')?.textContent?.trim()).toBe('In Progress');
    expect((row(el, 'Di').querySelector('button.join') as HTMLButtonElement).disabled).toBe(true);
  });

  it('pins your own rooms with Rejoin, which opens the Lobby', async () => {
    const { el, fixture, router } = await create();
    const mine = el.querySelector('li.room') as HTMLElement;
    expect(mine.classList).toContain('mine');
    expect(mine.querySelector('button.join')).toBeNull();
    (mine.querySelector('button.rejoin') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(router.url).toBe('/rooms/r-mine');
  });

  it('asks for a name on Join, then opens the Lobby', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    const { el, fixture, router } = await create();
    (row(el, 'Bo').querySelector('button.join') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(dialog.open).toHaveBeenCalledWith(JoinRoomDialog, expect.objectContaining({ data: { roomId: 'r-open', hostName: 'Bo', displayName: 'Ann' } }));
    expect(router.url).toBe('/rooms/r-open');
  });

  it('stays on Rooms when the Join dialog is cancelled', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const { el, fixture, router } = await create();
    (row(el, 'Bo').querySelector('button.join') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(router.url).toBe('/');
  });

  it('Create Room opens the dialog with the seat limits, then the new Lobby', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of('r-new') });
    const { el, fixture, router } = await create();
    const button = el.querySelector('button.create') as HTMLButtonElement;
    expect(button.textContent).toContain('Create Room');
    button.click();
    await fixture.whenStable();
    expect(dialog.open).toHaveBeenCalledWith(CreateRoomDialog, expect.objectContaining({ data: { seatLimits: { min: 2, max: 8 }, displayName: 'Ann' } }));
    expect(router.url).toBe('/rooms/r-new');
  });

  it('disables Create Room for a guest, and says why', async () => {
    me.set(GUS);
    const { el } = await create();
    expect((el.querySelector('button.create') as HTMLButtonElement).disabled).toBe(true);
    expect(el.querySelector('.host-hint')?.textContent?.trim()).toBe('Sign in to host a room');
  });

  it('shows the hint to nobody registered', async () => {
    const { el } = await create();
    expect(el.querySelector('.host-hint')).toBeNull();
  });

  it('says so when there are no rooms', async () => {
    list.set({ rooms: [], seatLimits: { min: 2, max: 8 } });
    const { el } = await create();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('No rooms yet');
  });

  it('shows the notice the Lobby left, once', async () => {
    notice.show('The host closed the room');
    const { el } = await create();
    expect(el.querySelector('.notice')?.textContent?.trim()).toBe('The host closed the room');
    expect(notice.take()).toBeNull();
  });

  it('shows a load error', async () => {
    list.set(null);
    error.set("Can't reach the server. Check your connection and try again");
    const { el } = await create();
    expect(el.querySelector('.error')?.textContent).toContain("Can't reach the server");
  });
});
```

Create `projects/app/src/app/online/join-room-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiError } from '../auth/auth.service';
import { JoinRoomDialog } from './join-room-dialog';
import { RoomsService } from './rooms.service';

describe('JoinRoomDialog', () => {
  const rooms = { join: jest.fn() };
  const dialogRef = { close: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [JoinRoomDialog],
      providers: [
        { provide: RoomsService, useValue: rooms },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { roomId: 'r1', hostName: 'Bo', displayName: 'Ann' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(JoinRoomDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    rooms.join.mockReset();
    dialogRef.close.mockReset();
  });

  it('asks only for Your Name, filled in with the display name', async () => {
    const { el } = await create();
    expect(el.querySelector('[mat-dialog-title]')?.textContent).toContain('Join Room');
    expect(el.querySelector('mat-label')?.textContent).toContain('Your Name');
    expect((el.querySelector('input.name') as HTMLInputElement).value).toBe('Ann');
    expect(el.textContent).toContain('Hosted by Bo');
  });

  it('joins with the name and closes', async () => {
    rooms.join.mockResolvedValue(undefined);
    const { component } = await create();
    component.displayName.set('Annie');
    await component.submit();
    expect(rooms.join).toHaveBeenCalledWith('r1', 'Annie');
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it("stays open with the server's message when the name is refused", async () => {
    rooms.join.mockRejectedValue(new ApiError('name_taken', 'That name is already taken in this room. Choose another.', 409));
    const { fixture, component, el } = await create();
    await component.submit();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(el.querySelector('.error')?.textContent).toContain('That name is already taken in this room. Choose another.');
  });

  it('disables Join for a blank name', async () => {
    const { fixture, component, el } = await create();
    component.displayName.set('   ');
    fixture.detectChanges();
    expect((el.querySelector('button.submit') as HTMLButtonElement).disabled).toBe(true);
  });
});
```

Create `projects/app/src/app/online/create-room-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ApiError } from '../auth/auth.service';
import { CreateRoomDialog } from './create-room-dialog';
import { RoomsService } from './rooms.service';

describe('CreateRoomDialog', () => {
  const rooms = { create: jest.fn() };
  const dialogRef = { close: jest.fn() };

  async function create() {
    await TestBed.configureTestingModule({
      imports: [CreateRoomDialog],
      providers: [
        { provide: RoomsService, useValue: rooms },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { seatLimits: { min: 2, max: 8 }, displayName: 'Ann' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CreateRoomDialog);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    rooms.create.mockReset();
    dialogRef.close.mockReset();
  });

  it('offers the seat counts the server allows, starting at 4', async () => {
    const { el, component } = await create();
    expect(el.querySelector('[mat-dialog-title]')?.textContent).toContain('Create Room');
    expect([...el.querySelectorAll('.seats mat-button-toggle')].map((t) => t.textContent?.trim())).toEqual(['2', '3', '4', '5', '6', '7', '8']);
    expect(component.seatCount()).toBe(4);
  });

  it('offers First Reveal Bonus only at 5 seats or more', async () => {
    const { fixture, component, el } = await create();
    expect(el.querySelector('.first-reveal')).toBeNull();
    component.seatCount.set(5);
    fixture.detectChanges();
    expect(el.querySelector('.first-reveal')?.textContent).toContain('First Reveal Bonus');
  });

  it('creates the room and closes with its id', async () => {
    rooms.create.mockResolvedValue('r-new');
    const { component } = await create();
    component.seatCount.set(6);
    component.firstRevealDraw.set(false);
    await component.submit();
    expect(rooms.create).toHaveBeenCalledWith({ seatCount: 6, rules: { firstRevealDraw: false }, displayName: 'Ann' });
    expect(dialogRef.close).toHaveBeenCalledWith('r-new');
  });

  it('sends no rules below 5 seats', async () => {
    rooms.create.mockResolvedValue('r-new');
    const { component } = await create();
    await component.submit();
    expect(rooms.create).toHaveBeenCalledWith({ seatCount: 4, rules: {}, displayName: 'Ann' });
  });

  it("stays open with the server's message on failure", async () => {
    rooms.create.mockRejectedValue(new ApiError('already_in_room', "You're already in another room. Leave it first", 409));
    const { fixture, component, el } = await create();
    await component.submit();
    fixture.detectChanges();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(el.querySelector('.error')?.textContent).toContain("You're already in another room. Leave it first");
  });
});
```

In `projects/app/src/app/app.spec.ts`:

1. Add `{ path: 'rooms', children: [] },` to the test router's routes.
2. Replace the test "has three items in the bar: Play, Cards and Rules, each with an icon" with:

```ts
  it('has four items in the bar: Play, Online, Cards and Rules, each with an icon', async () => {
    const { el } = await render();
    const items = [...el.querySelectorAll('nav.nav > a, nav.nav > button')];
    expect(items.map((i) => [i.querySelector('.label')!.textContent, i.querySelector('mat-icon')!.textContent])).toEqual([
      ['Play', 'play_arrow'],
      ['Online', 'public'],
      ['Cards', 'swords'],
      ['Rules', 'menu_book'],
    ]);
  });

  it('links Online to /rooms, highlighted on the online screens', async () => {
    const { el, fixture } = await render('/rooms');
    const online = el.querySelector('a.nav-online') as HTMLAnchorElement;
    expect(online.getAttribute('href')).toBe('/rooms');
    expect(online.getAttribute('aria-label')).toBe('Online');
    expect(online.classList).toContain('active');
    expect(online.getAttribute('aria-current')).toBe('page');
    expect(el.querySelector('a.nav-play')!.classList).not.toContain('active');
    await TestBed.inject(Router).navigateByUrl('/setup');
    fixture.detectChanges();
    expect(online.classList).not.toContain('active');
  });
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app online/ app.spec`
Expected: FAIL. The online components don't exist, and the toolbar has no Online item.

- [ ] **Step 3: Write the labels and the shared styles**

Create `projects/app/src/app/online/room-labels.ts`:

```ts
import type { RoomListItem } from 'protocol';

// The status column of the Rooms list.
export function roomStatusLabel(room: RoomListItem): 'Waiting for Players' | 'Full' | 'In Progress' {
  if (room.status === 'playing') return 'In Progress';
  return room.memberCount >= room.capacity ? 'Full' : 'Waiting for Players';
}

// Whether to enable Join. The server decides for real when asked.
export function canJoin(room: RoomListItem): boolean {
  return room.status === 'lobby' && room.memberCount < room.capacity;
}
```

Create `projects/app/src/app/online/online-page.css`:

```css
.online-page {
  /* Full-bleed like Setup: cancel the app shell's content padding. */
  margin: 0 -16px -16px;
  min-height: calc(100vh - 64px);
  display: grid;
  place-items: start center;
  padding: 24px 16px;
  box-sizing: border-box;
  background: var(--mat-sys-surface-container-low);
}
.online-card {
  width: min(100%, 640px);
}
mat-card-header {
  padding-top: 20px;
}
.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 16px 0;
}
.hint {
  color: var(--mat-sys-on-surface-variant);
  font: var(--mat-sys-body-small);
}
.notice,
.banner {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--mat-sys-secondary-container);
  color: var(--mat-sys-on-secondary-container);
  font: var(--mat-sys-body-medium);
}
.error {
  margin: 0 0 12px;
  color: var(--mat-sys-error);
  font: var(--mat-sys-body-medium);
}
.empty,
.loading {
  padding: 24px 0;
  text-align: center;
  color: var(--mat-sys-on-surface-variant);
  font: var(--mat-sys-body-large);
}
.room-list,
.member-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.room,
.member {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 10px 8px;
  border-bottom: 1px solid var(--mat-sys-outline-variant);
}
.room.mine {
  background: color-mix(in srgb, var(--mat-sys-primary) 6%, transparent);
}
.host-name,
.member .name {
  flex: 1;
  min-width: 120px;
  font: var(--mat-sys-title-small);
}
.count,
.status {
  color: var(--mat-sys-on-surface-variant);
  font: var(--mat-sys-body-medium);
}
.badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--mat-sys-surface-container-high);
  color: var(--mat-sys-on-surface-variant);
  font: var(--mat-sys-label-small);
}
.badge.host {
  background: var(--mat-sys-primary-container);
  color: var(--mat-sys-on-primary-container);
}
.member.away .name {
  color: var(--mat-sys-on-surface-variant);
}
```

- [ ] **Step 4: Write the dialogs**

Create `projects/app/src/app/online/join-room-dialog.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DISPLAY_NAME_MAX, ERROR_MESSAGES } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { RoomsService } from './rooms.service';

export interface JoinRoomDialogData {
  roomId: string;
  hostName: string | null;
  displayName: string;
}

// Asks only for the name to use in this room. A refused name keeps the dialog
// open with the server's message; on success it closes with true.
@Component({
  selector: 'app-join-room-dialog',
  imports: [MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Join Room</h2>
    <mat-dialog-content>
      @if (data.hostName) {
        <p class="hosted-by">Hosted by {{ data.hostName }}</p>
      }
      <form id="join-room-form" (submit)="$event.preventDefault(); submit()">
        <mat-form-field appearance="outline" class="name-field">
          <mat-label>Your Name</mat-label>
          <input matInput class="name" autocomplete="nickname" [maxLength]="nameMax" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
        </mat-form-field>
        @if (error()) {
          <p class="error" role="alert">{{ error() }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" class="submit" form="join-room-form" [disabled]="busy() || !canSubmit()">Join</button>
    </mat-dialog-actions>
  `,
  styles: `
    .name-field { width: 100%; }
    .hosted-by { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); }
    .error { margin: 0 0 12px; color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
  `,
})
export class JoinRoomDialog {
  protected readonly data = inject<JoinRoomDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<JoinRoomDialog, boolean>>(MatDialogRef);
  private readonly rooms = inject(RoomsService);
  protected readonly nameMax = DISPLAY_NAME_MAX;

  readonly displayName = signal(this.data.displayName);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.displayName().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.rooms.join(this.data.roomId, this.displayName());
      this.dialogRef.close(true);
    } catch (err) {
      this.error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
    } finally {
      this.busy.set(false);
    }
  }
}
```

Create `projects/app/src/app/online/create-room-dialog.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import { DISPLAY_NAME_MAX, ERROR_MESSAGES } from 'protocol';
import type { SeatLimits } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { RoomsService } from './rooms.service';

export interface CreateRoomDialogData {
  seatLimits: SeatLimits;
  displayName: string;
}

// Your name, the seat count and the table rules for a new open room. Closes
// with the new room's id.
@Component({
  selector: 'app-create-room-dialog',
  imports: [MatDialogModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Create Room</h2>
    <mat-dialog-content>
      <form id="create-room-form" (submit)="$event.preventDefault(); submit()">
        <mat-form-field appearance="outline" class="name-field">
          <mat-label>Your Name</mat-label>
          <input matInput class="name" autocomplete="nickname" [maxLength]="nameMax" [value]="displayName()" (input)="displayName.set($any($event.target).value)" />
        </mat-form-field>
        <div class="field">
          <span class="label" id="create-room-seats">Seats</span>
          <mat-button-toggle-group
            class="seats"
            aria-labelledby="create-room-seats"
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
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button type="submit" class="submit" form="create-room-form" [disabled]="busy() || !canSubmit()">Create Room</button>
    </mat-dialog-actions>
  `,
  styles: `
    .name-field { width: 100%; }
    .field { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
    .label { font: var(--mat-sys-title-small); }
    .hint { margin: 0 0 12px; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-small); }
    .error { margin: 0 0 12px; color: var(--mat-sys-error); font: var(--mat-sys-body-medium); }
  `,
})
export class CreateRoomDialog {
  protected readonly data = inject<CreateRoomDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CreateRoomDialog, string>>(MatDialogRef);
  private readonly rooms = inject(RoomsService);
  protected readonly nameMax = DISPLAY_NAME_MAX;
  protected readonly firstRevealMinSeats = FIRST_REVEAL_MIN_SEATS;
  protected readonly seatOptions = Array.from({ length: this.data.seatLimits.max - this.data.seatLimits.min + 1 }, (_, i) => this.data.seatLimits.min + i);

  readonly displayName = signal(this.data.displayName);
  readonly seatCount = signal(Math.min(Math.max(4, this.data.seatLimits.min), this.data.seatLimits.max));
  readonly firstRevealDraw = signal(true);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  protected readonly canSubmit = computed(() => this.displayName().trim() !== '');

  async submit(): Promise<void> {
    if (this.busy() || !this.canSubmit()) return;
    this.busy.set(true);
    this.error.set(null);
    const seatCount = this.seatCount();
    try {
      const id = await this.rooms.create({
        seatCount,
        rules: seatCount >= FIRST_REVEAL_MIN_SEATS ? { firstRevealDraw: this.firstRevealDraw() } : {},
        displayName: this.displayName(),
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

- [ ] **Step 5: Write the Rooms screen**

Create `projects/app/src/app/online/rooms-page.ts`:

```ts
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { RoomListItem } from 'protocol';
import { AuthService } from '../auth/auth.service';
import { CreateRoomDialog, CreateRoomDialogData } from './create-room-dialog';
import { JoinRoomDialog, JoinRoomDialogData } from './join-room-dialog';
import { OnlineNotice } from './online-notice';
import { canJoin, roomStatusLabel } from './room-labels';
import { RoomsService } from './rooms.service';

// Open rooms to join, your own rooms pinned on top, and Create Room for
// registered players. The list refreshes every 5 s while this screen is open.
@Component({
  selector: 'app-rooms-page',
  imports: [MatButtonModule, MatCardModule, MatIconModule],
  styleUrl: './online-page.css',
  template: `
    <div class="online-page">
      <mat-card class="online-card" appearance="raised">
        <mat-card-header><mat-card-title>Rooms</mat-card-title></mat-card-header>
        <mat-card-content>
          <div class="toolbar">
            <button mat-flat-button type="button" class="create" [disabled]="!auth.isRegistered() || !rooms.list()" (click)="create()">
              <mat-icon>add</mat-icon> Create Room
            </button>
            @if (!auth.isRegistered()) {
              <span class="hint host-hint">Sign in to host a room</span>
            }
          </div>
          @if (notice(); as text) {
            <p class="notice" role="status">{{ text }}</p>
          }
          @if (rooms.error(); as text) {
            <p class="error" role="alert">{{ text }}</p>
          }
          @if (rooms.list(); as list) {
            @if (list.rooms.length === 0) {
              <p class="empty">No rooms yet</p>
            } @else {
              <ul class="room-list">
                @for (room of list.rooms; track room.id) {
                  <li class="room" [class.mine]="room.youAreMember">
                    <mat-icon aria-hidden="true">{{ room.youAreMember ? 'push_pin' : 'meeting_room' }}</mat-icon>
                    <span class="host-name">{{ room.hostName ?? 'Room' }}</span>
                    <span class="count">{{ room.memberCount }} / {{ room.capacity }}</span>
                    <span class="status">{{ statusLabel(room) }}</span>
                    @if (room.youAreMember) {
                      <button mat-stroked-button type="button" class="rejoin" (click)="rejoin(room)">Rejoin</button>
                    } @else {
                      <button mat-stroked-button type="button" class="join" [disabled]="!canJoin(room)" (click)="join(room)">Join</button>
                    }
                  </li>
                }
              </ul>
            }
          } @else if (!rooms.error()) {
            <p class="loading">Loading rooms…</p>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class RoomsPage {
  protected readonly rooms = inject(RoomsService);
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  // Why the last Lobby closed under you, if it did.
  protected readonly notice = signal(inject(OnlineNotice).take());
  protected readonly statusLabel = roomStatusLabel;
  protected readonly canJoin = canJoin;

  constructor() {
    this.rooms.startPolling();
    inject(DestroyRef).onDestroy(() => this.rooms.stopPolling());
  }

  create(): void {
    const list = this.rooms.list();
    if (!list) return;
    const data: CreateRoomDialogData = { seatLimits: list.seatLimits, displayName: this.auth.me()?.displayName ?? '' };
    this.dialog
      .open<CreateRoomDialog, CreateRoomDialogData, string>(CreateRoomDialog, { data, width: '440px' })
      .afterClosed()
      .subscribe((id) => {
        if (id) void this.router.navigate(['/rooms', id]);
      });
  }

  join(room: RoomListItem): void {
    const data: JoinRoomDialogData = { roomId: room.id, hostName: room.hostName, displayName: this.auth.me()?.displayName ?? '' };
    this.dialog
      .open<JoinRoomDialog, JoinRoomDialogData, boolean>(JoinRoomDialog, { data, width: '440px' })
      .afterClosed()
      .subscribe((joined) => {
        if (joined) void this.router.navigate(['/rooms', room.id]);
      });
  }

  rejoin(room: RoomListItem): void {
    void this.router.navigate(['/rooms', room.id]);
  }
}
```

- [ ] **Step 6: Add the route and the toolbar item**

In `projects/app/src/app/app.routes.ts`, import the guard:

```ts
import { requireSignIn } from './auth/require-sign-in';
```

and add this route after the `wiki` route:

```ts
  { path: 'rooms', canActivate: [requireSignIn], loadComponent: () => import('./online/rooms-page').then((m) => m.RoomsPage) },
```

In `projects/app/src/app/app.ts`, add after `playActive`:

```ts
  protected readonly onlineActive = computed(() => /^\/rooms(\/|$|\?)/.test(this.url()));
```

In `projects/app/src/app/app.html`, add straight after the `a.nav-play` element:

```html
    <a mat-button class="nav-online" routerLink="/rooms" [class.active]="onlineActive()" [attr.aria-current]="onlineActive() ? 'page' : null" aria-label="Online">
      <mat-icon>public</mat-icon><span class="label">Online</span>
    </a>
```

- [ ] **Step 7: Run the tests, the build and the ellipsis check**

Run: `npx jest --selectProjects app && npx ng build app && grep -c '\\u2026' projects/app/src/app/online/rooms-page.ts`
Expected: every app test PASSES, the build succeeds, and `grep` prints `0`.

- [ ] **Step 8: Commit**

```bash
git add projects/app/src/app
git commit -m "feat(app): Rooms screen with Create Room and Join Room dialogs, and the Online link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Lobby screen and `LobbyService`

**Files:**
- Create:
  - `projects/app/src/app/online/lobby.service.ts`
  - `projects/app/src/app/online/lobby-page.ts`
- Modify:
  - `projects/app/src/app/online/online-page.css` (Lobby styles)
  - `projects/app/src/app/app.routes.ts`
- Test: `projects/app/src/app/online/lobby.service.spec.ts`, `projects/app/src/app/online/lobby-page.spec.ts`

**Interfaces:**
- Consumes:
  - `SocketService`, `WEB_SOCKET_FACTORY`, `OnlineNotice` and the `testing.ts` fixtures (Task 8);
  - `online-page.css` (Task 9);
  - `ROOM_LEFT_MESSAGES`, `REPLACED_MESSAGE` and `ERROR_MESSAGES` from `protocol`;
  - `FIRST_REVEAL_MIN_SEATS` from `content`.
- Produces:
  - `LobbyService`, provided per component next to `SocketService`:
    - signals `room`, `you`, `notice`, `ended`, `error` and `status`;
    - computed `isHost`, `host`, `waitingForHost` and `canAct`;
    - `open(roomId)`;
    - `addBot()`, `removePlayer(id)`, `makeHost(id)` and `setRules(seatCount, rules)`, each returning `Promise<boolean>`;
    - `leave(): Promise<void>`.
  - The route `/rooms/:id` → `LobbyPage`, guarded by `requireSignIn`.

**What the Lobby does with each server message:**

| Message | Effect |
|---|---|
| `welcome` | Sets `you` and `room`. Notes a host change against the room it had before a reconnect. |
| `room.updated` | Replaces `room`. A new `hostPlayerId` sets `notice` to "{name} is now the host". |
| `room.left` | Puts the reason's text in `OnlineNotice`, then goes to `/rooms`. For `left` there is no notice. |
| `replaced` | Sets `ended` to "This room is open in another tab". |
| `error` without `reqId`, code `version` | Sets `ended` to the server's message, "Please reload to get the latest version". |
| `error` without `reqId`, code `not_member` or `not_found` | Puts the server's message in `OnlineNotice`, then goes to `/rooms`. |
| `error` with `reqId` | Handled by the request that sent it, which sets `error`. |

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/online/lobby.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { RoomSnapshot } from 'protocol';
import { LobbyService } from './lobby.service';
import { OnlineNotice } from './online-notice';
import { SocketService, WEB_SOCKET_FACTORY } from './socket.service';
import { FakeSocket, ROOM, welcome } from './testing';

describe('LobbyService', () => {
  let socket: FakeSocket;
  let lobby: LobbyService;
  let notices: OnlineNotice;
  let navigate: jest.SpyInstance;
  const withHost = (hostPlayerId: string): RoomSnapshot => ({ ...ROOM, hostPlayerId });
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SocketService,
        LobbyService,
        { provide: WEB_SOCKET_FACTORY, useValue: (url: string) => (socket = new FakeSocket(url)) },
        provideRouter([{ path: 'rooms', children: [] }]),
      ],
    });
    lobby = TestBed.inject(LobbyService);
    notices = TestBed.inject(OnlineNotice);
    navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl');
    lobby.open(ROOM.id);
    socket.serverOpens();
  });

  it('shows the room and who you are after the welcome', () => {
    socket.serverSends(welcome(ROOM, 'p-ann'));
    expect(lobby.room()).toEqual(ROOM);
    expect(lobby.you()).toBe('p-ann');
    expect(lobby.isHost()).toBe(true);
    expect(lobby.canAct()).toBe(true);
  });

  it('is not the host when someone else is', () => {
    socket.serverSends(welcome(ROOM, 'p-bo'));
    expect(lobby.isHost()).toBe(false);
  });

  it('announces a new host', () => {
    socket.serverSends(welcome(ROOM, 'p-bo'));
    socket.serverSends({ type: 'room.updated', room: withHost('p-bo') });
    expect(lobby.notice()).toBe('Bo is now the host');
  });

  it('says it is waiting for an away host', () => {
    socket.serverSends(welcome(ROOM, 'p-bo'));
    expect(lobby.waitingForHost()).toBeNull();
    socket.serverSends({ type: 'room.updated', room: { ...ROOM, members: ROOM.members.map((m) => (m.playerId === 'p-ann' ? { ...m, connected: false } : m)) } });
    expect(lobby.waitingForHost()).toBe('Waiting for Ann to return…');
  });

  it("sends lobby commands, and shows the server's refusal", async () => {
    socket.serverSends(welcome());
    const added = lobby.addBot();
    expect(socket.lastSent).toEqual({ type: 'lobby.addBot', reqId: 'r1' });
    socket.serverSends({ type: 'ack', reqId: 'r1' });
    expect(await added).toBe(true);

    const removed = lobby.removePlayer('p-bo');
    expect(socket.lastSent).toEqual({ type: 'lobby.removePlayer', playerId: 'p-bo', reqId: 'r2' });
    socket.serverSends({ type: 'error', reqId: 'r2', code: 'not_host', message: 'Only the host can do that' });
    expect(await removed).toBe(false);
    expect(lobby.error()).toBe('Only the host can do that');

    void lobby.setRules(6, { firstRevealDraw: false });
    expect(socket.lastSent).toEqual({ type: 'lobby.setRules', seatCount: 6, rules: { firstRevealDraw: false }, reqId: 'r3' });
    void lobby.makeHost('p-bo');
    expect(socket.lastSent).toEqual({ type: 'lobby.makeHost', playerId: 'p-bo', reqId: 'r4' });
  });

  it('goes back to Rooms after leaving, and stops the socket', async () => {
    socket.serverSends(welcome());
    const left = lobby.leave();
    expect(socket.lastSent).toEqual({ type: 'room.leave', reqId: 'r1' });
    socket.serverSends({ type: 'ack', reqId: 'r1' });
    await left;
    expect(socket.closedByApp).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/rooms');
    expect(notices.take()).toBeNull();
  });

  it.each([
    ['removed', 'The host removed you from the room'],
    ['host_left', 'The host closed the room'],
    ['idle', 'The room closed after 30 minutes without activity'],
  ] as const)('when the room drops you (%s), Rooms shows why', async (reason, text) => {
    socket.serverSends(welcome());
    socket.serverSends({ type: 'room.left', reason });
    await flush();
    expect(notices.take()).toBe(text);
    expect(navigate).toHaveBeenCalledWith('/rooms');
  });

  it('says so when another tab took over', () => {
    socket.serverSends(welcome());
    socket.serverSends({ type: 'replaced' });
    expect(lobby.ended()).toBe('This room is open in another tab');
    expect(lobby.canAct()).toBe(false);
  });

  it('asks for a reload after a version error', () => {
    socket.serverSends({ type: 'error', code: 'version', message: 'Please reload to get the latest version' });
    expect(lobby.ended()).toBe('Please reload to get the latest version');
  });

  it('goes back to Rooms, saying why, when you are not a member', async () => {
    socket.serverSends({ type: 'error', code: 'not_member', message: "You're not in this room" });
    await flush();
    expect(notices.take()).toBe("You're not in this room");
    expect(navigate).toHaveBeenCalledWith('/rooms');
  });
});
```

Create `projects/app/src/app/online/lobby-page.spec.ts`:

```ts
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { RoomSnapshot } from 'protocol';
import { LobbyPage } from './lobby-page';
import { LobbyService } from './lobby.service';
import { SocketStatus } from './socket.service';
import { ROOM } from './testing';

const MIXED: RoomSnapshot = {
  ...ROOM,
  seatCount: 5,
  members: [
    { playerId: 'p-ann', name: 'Ann', kind: 'human', isRegistered: true, connected: true, botControlled: false },
    { playerId: 'p-bo', name: 'Bo', kind: 'human', isRegistered: true, connected: false, botControlled: false },
    { playerId: 'p-gus', name: 'Gus', kind: 'human', isRegistered: false, connected: true, botControlled: false },
    { playerId: 'p-bot', name: 'Bot 1', kind: 'bot', isRegistered: false, connected: true, botControlled: false },
  ],
};

function fakeLobby() {
  const room = signal<RoomSnapshot | null>(MIXED);
  const you = signal<string | null>('p-ann');
  const status = signal<SocketStatus>('open');
  const ended = signal<string | null>(null);
  return {
    room,
    you,
    status,
    ended,
    notice: signal<string | null>(null),
    error: signal<string | null>(null),
    waitingForHost: signal<string | null>(null),
    isHost: computed(() => room()?.hostPlayerId === you()),
    canAct: computed(() => status() === 'open' && ended() === null),
    open: jest.fn(),
    addBot: jest.fn(async () => true),
    removePlayer: jest.fn(async () => true),
    makeHost: jest.fn(async () => true),
    setRules: jest.fn(async () => true),
    leave: jest.fn(async () => undefined),
  };
}

describe('LobbyPage', () => {
  let lobby: ReturnType<typeof fakeLobby>;

  async function render() {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'rooms/:id', component: LobbyPage }, { path: 'rooms', children: [] }])] });
    TestBed.overrideComponent(LobbyPage, { set: { providers: [{ provide: LobbyService, useValue: lobby }] } });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/rooms/${ROOM.id}`, LobbyPage);
    const el = harness.routeNativeElement as HTMLElement;
    const member = (name: string) => [...el.querySelectorAll('li.member')].find((li) => li.querySelector('.name')?.textContent?.trim() === name) as HTMLElement;
    const badges = (name: string) => [...member(name).querySelectorAll('.badge')].map((b) => b.textContent?.trim());
    return { harness, el, member, badges };
  }

  beforeEach(() => {
    lobby = fakeLobby();
  });

  it('connects to the room in the URL', async () => {
    await render();
    expect(lobby.open).toHaveBeenCalledWith(ROOM.id);
  });

  it('shows the players with Host, You, Guest, Bot and Away badges, and the count', async () => {
    const { el, badges } = await render();
    expect(el.querySelector('mat-card-title')?.textContent).toContain('Lobby');
    expect(el.querySelector('.player-count')?.textContent?.trim()).toBe('4 / 5 Players');
    expect(badges('Ann')).toEqual(['Host', 'You']);
    expect(badges('Bo')).toEqual(['Away']);
    expect(badges('Gus')).toEqual(['Guest']);
    expect(badges('Bot 1')).toEqual(['Bot']);
  });

  it('gives the host Add Bot, Remove for others, and Make Host for registered players only', async () => {
    const { el, member } = await render();
    expect(el.querySelector('button.add-bot')?.textContent).toContain('Add Bot');
    expect(member('Ann').querySelector('button.remove')).toBeNull();
    expect(member('Bo').querySelector('button.make-host')?.textContent).toContain('Make Host');
    expect(member('Gus').querySelector('button.make-host')).toBeNull();
    expect(member('Bot 1').querySelector('button.make-host')).toBeNull();
    expect(member('Bot 1').querySelector('button.remove')?.textContent).toContain('Remove');
  });

  it('sends what the host clicks', async () => {
    const { el, member, harness } = await render();
    (el.querySelector('button.add-bot') as HTMLButtonElement).click();
    (member('Bo').querySelector('button.make-host') as HTMLButtonElement).click();
    (member('Gus').querySelector('button.remove') as HTMLButtonElement).click();
    const six = [...el.querySelectorAll('.seats mat-button-toggle')].find((t) => t.textContent?.trim() === '6')!;
    (six.querySelector('button') as HTMLButtonElement).click();
    harness.detectChanges();
    (el.querySelector('button.leave') as HTMLButtonElement).click();
    expect(lobby.addBot).toHaveBeenCalled();
    expect(lobby.makeHost).toHaveBeenCalledWith('p-bo');
    expect(lobby.removePlayer).toHaveBeenCalledWith('p-gus');
    expect(lobby.setRules).toHaveBeenCalledWith(6, { firstRevealDraw: true });
    expect(lobby.leave).toHaveBeenCalled();
  });

  it('offers seat counts from the member count up to the limit', async () => {
    const { el } = await render();
    expect([...el.querySelectorAll('.seats mat-button-toggle')].map((t) => t.textContent?.trim())).toEqual(['4', '5', '6', '7', '8']);
    expect(el.querySelector('.first-reveal')?.textContent).toContain('First Reveal Bonus');
  });

  it('disables Add Bot when every seat is taken', async () => {
    lobby.room.set({ ...MIXED, seatCount: 4 });
    const { el } = await render();
    expect((el.querySelector('button.add-bot') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows a non-host the rules, with no host controls', async () => {
    lobby.you.set('p-bo');
    const { el } = await render();
    expect(el.querySelector('.rules-summary')?.textContent?.trim()).toBe('5 Seats · First Reveal Bonus: On');
    expect(el.querySelector('button.add-bot')).toBeNull();
    expect(el.querySelector('button.remove')).toBeNull();
    expect(el.querySelector('.seats')).toBeNull();
    expect(el.querySelector('button.leave')?.textContent).toContain('Leave Room');
  });

  it('shows Reconnecting… and disables actions while the socket is down', async () => {
    lobby.status.set('reconnecting');
    const { el } = await render();
    expect(el.querySelector('.banner.reconnecting')?.textContent?.trim()).toBe('Reconnecting…');
    expect((el.querySelector('button.add-bot') as HTMLButtonElement).disabled).toBe(true);
    expect((el.querySelector('button.leave') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows that the room is waiting for its host', async () => {
    lobby.waitingForHost.set('Waiting for Ann to return…');
    const { el } = await render();
    expect(el.querySelector('.banner.waiting')?.textContent?.trim()).toBe('Waiting for Ann to return…');
  });

  it('shows why the connection ended, and offers Back to Rooms', async () => {
    lobby.ended.set('This room is open in another tab');
    const { el } = await render();
    expect(el.querySelector('.banner.ended')?.textContent?.trim()).toBe('This room is open in another tab');
    expect(el.querySelector('a.back')?.getAttribute('href')).toBe('/rooms');
    expect(el.querySelector('button.leave')).toBeNull();
  });

  it('shows the host-change notice and request errors', async () => {
    lobby.notice.set('Bo is now the host');
    lobby.error.set('Only the host can do that');
    const { el } = await render();
    expect(el.querySelector('.notice')?.textContent?.trim()).toBe('Bo is now the host');
    expect(el.querySelector('.error')?.textContent?.trim()).toBe('Only the host can do that');
  });
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx jest --selectProjects app online/lobby`
Expected: FAIL. The modules don't exist yet.

- [ ] **Step 3: Write `LobbyService`**

Create `projects/app/src/app/online/lobby.service.ts`:

```ts
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ERROR_MESSAGES, REPLACED_MESSAGE, ROOM_LEFT_MESSAGES } from 'protocol';
import type { ErrorMessage, RoomRequest, RoomSnapshot, ServerMessage } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { OnlineNotice } from './online-notice';
import { SocketService } from './socket.service';

// The Lobby's state, kept from the room socket. Provide it in the Lobby
// component together with SocketService. The server decides every rule:
// this only shows its answers and sends what the player asks for.
@Injectable()
export class LobbyService {
  private readonly socket = inject(SocketService);
  private readonly router = inject(Router);
  private readonly notices = inject(OnlineNotice);
  private readonly _room = signal<RoomSnapshot | null>(null);
  private readonly _you = signal<string | null>(null);
  private readonly _notice = signal<string | null>(null);
  private readonly _ended = signal<string | null>(null);
  private readonly _error = signal<string | null>(null);

  readonly room = this._room.asReadonly();
  // Your player id in this room.
  readonly you = this._you.asReadonly();
  // The latest host change, as "Hing is now the host".
  readonly notice = this._notice.asReadonly();
  // Why this connection is over for good, when it is.
  readonly ended = this._ended.asReadonly();
  // The last refused request.
  readonly error = this._error.asReadonly();
  readonly status = this.socket.status;
  readonly canAct = computed(() => this.status() === 'open' && this._ended() === null);
  readonly isHost = computed(() => {
    const room = this._room();
    return room !== null && room.hostPlayerId === this._you();
  });
  readonly host = computed(() => {
    const room = this._room();
    return room?.members.find((m) => m.playerId === room.hostPlayerId) ?? null;
  });
  readonly waitingForHost = computed(() => {
    const host = this.host();
    return host && !host.connected ? `Waiting for ${host.name} to return…` : null;
  });

  constructor() {
    this.socket.messages.pipe(takeUntilDestroyed()).subscribe((message) => this.receive(message));
  }

  open(roomId: string): void {
    this.socket.connect(roomId);
  }

  addBot(): Promise<boolean> {
    return this.run({ type: 'lobby.addBot' });
  }

  removePlayer(playerId: string): Promise<boolean> {
    return this.run({ type: 'lobby.removePlayer', playerId });
  }

  makeHost(playerId: string): Promise<boolean> {
    return this.run({ type: 'lobby.makeHost', playerId });
  }

  setRules(seatCount: number, rules: RoomSnapshot['rules']): Promise<boolean> {
    return this.run({ type: 'lobby.setRules', seatCount, rules });
  }

  async leave(): Promise<void> {
    if (!(await this.run({ type: 'room.leave' }))) return;
    this.socket.end();
    await this.router.navigateByUrl('/rooms');
  }

  private async run(command: RoomRequest): Promise<boolean> {
    this._error.set(null);
    try {
      await this.socket.request(command);
      return true;
    } catch (err) {
      this._error.set(err instanceof ApiError ? err.message : ERROR_MESSAGES.internal);
      return false;
    }
  }

  private receive(message: ServerMessage): void {
    switch (message.type) {
      case 'welcome':
        this.noteHostChange(this._room(), message.room);
        this._you.set(message.you.playerId);
        this._room.set(message.room);
        return;
      case 'room.updated':
        this.noteHostChange(this._room(), message.room);
        this._room.set(message.room);
        return;
      case 'room.left':
        if (message.reason !== 'left') this.notices.show(ROOM_LEFT_MESSAGES[message.reason]);
        void this.router.navigateByUrl('/rooms');
        return;
      case 'replaced':
        this._ended.set(REPLACED_MESSAGE);
        return;
      case 'error':
        if (!message.reqId) this.refused(message);
        return;
    }
  }

  // An error nobody asked for: the server refused this connection.
  private refused(message: ErrorMessage): void {
    if (message.code === 'version') {
      this._ended.set(message.message);
    } else if (message.code === 'not_member' || message.code === 'not_found') {
      this.notices.show(message.message);
      void this.router.navigateByUrl('/rooms');
    }
  }

  private noteHostChange(before: RoomSnapshot | null, after: RoomSnapshot): void {
    if (!before || !after.hostPlayerId || before.hostPlayerId === after.hostPlayerId) return;
    const host = after.members.find((m) => m.playerId === after.hostPlayerId);
    if (host) this._notice.set(`${host.name} is now the host`);
  }
}
```

- [ ] **Step 4: Write the Lobby screen**

Append to `projects/app/src/app/online/online-page.css`:

```css
.rules h3,
.players h3 {
  margin: 16px 0 8px;
  font: var(--mat-sys-title-medium);
}
.field {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}
.label {
  font: var(--mat-sys-title-small);
}
.rules-summary {
  margin: 0;
  color: var(--mat-sys-on-surface-variant);
}
```

Create `projects/app/src/app/online/lobby-page.ts`:

```ts
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { FIRST_REVEAL_MIN_SEATS } from 'content';
import { LobbyService } from './lobby.service';
import { SocketService } from './socket.service';

// The members of a room, the host's controls and Leave Room, live over the
// room socket. Seat order is not shown: it is drawn when the game starts.
@Component({
  selector: 'app-lobby-page',
  imports: [RouterLink, MatButtonModule, MatButtonToggleModule, MatCardModule, MatCheckboxModule, MatIconModule],
  providers: [SocketService, LobbyService],
  styleUrl: './online-page.css',
  template: `
    <div class="online-page">
      <mat-card class="online-card" appearance="raised">
        <mat-card-header>
          <mat-card-title>Lobby</mat-card-title>
          @if (lobby.room(); as room) {
            <mat-card-subtitle class="player-count">{{ room.members.length }} / {{ room.seatCount }} Players</mat-card-subtitle>
          }
        </mat-card-header>
        <mat-card-content>
          @if (lobby.ended(); as text) {
            <p class="banner ended" role="alert">{{ text }}</p>
          } @else if (lobby.status() === 'reconnecting') {
            <p class="banner reconnecting" role="status">Reconnecting…</p>
          }
          @if (lobby.waitingForHost(); as text) {
            <p class="banner waiting" role="status">{{ text }}</p>
          }
          @if (lobby.notice(); as text) {
            <p class="notice" role="status">{{ text }}</p>
          }
          @if (lobby.error(); as text) {
            <p class="error" role="alert">{{ text }}</p>
          }
          @if (lobby.room(); as room) {
            <section class="rules">
              <h3>Rules</h3>
              @if (lobby.isHost()) {
                <div class="field">
                  <span class="label" id="lobby-seats">Seats</span>
                  <mat-button-toggle-group
                    class="seats"
                    aria-labelledby="lobby-seats"
                    [hideSingleSelectionIndicator]="true"
                    [disabled]="!lobby.canAct()"
                    [value]="room.seatCount"
                    (change)="setSeats($event.value)"
                  >
                    @for (n of seatOptions(); track n) {
                      <mat-button-toggle [value]="n">{{ n }}</mat-button-toggle>
                    }
                  </mat-button-toggle-group>
                </div>
                @if (room.seatCount >= firstRevealMinSeats) {
                  <mat-checkbox class="first-reveal" [disabled]="!lobby.canAct()" [checked]="!!room.rules.firstRevealDraw" (change)="setFirstReveal($event.checked)">
                    First Reveal Bonus
                  </mat-checkbox>
                }
              } @else {
                <p class="rules-summary">{{ rulesSummary() }}</p>
              }
            </section>
            <section class="players">
              <h3>Players</h3>
              <ul class="member-list">
                @for (member of room.members; track member.playerId) {
                  <li class="member" [class.away]="member.kind === 'human' && !member.connected">
                    <mat-icon aria-hidden="true">{{ member.kind === 'bot' ? 'smart_toy' : 'person' }}</mat-icon>
                    <span class="name">{{ member.name }}</span>
                    @if (member.playerId === room.hostPlayerId) {
                      <span class="badge host">Host</span>
                    }
                    @if (member.playerId === lobby.you()) {
                      <span class="badge you">You</span>
                    }
                    @if (member.kind === 'bot') {
                      <span class="badge bot">Bot</span>
                    } @else if (!member.isRegistered) {
                      <span class="badge guest">Guest</span>
                    }
                    @if (member.kind === 'human' && !member.connected) {
                      <span class="badge away">Away</span>
                    }
                    @if (lobby.isHost() && member.playerId !== lobby.you()) {
                      @if (member.kind === 'human' && member.isRegistered) {
                        <button mat-button type="button" class="make-host" [disabled]="!lobby.canAct()" (click)="lobby.makeHost(member.playerId)">Make Host</button>
                      }
                      <button mat-button type="button" class="remove" [disabled]="!lobby.canAct()" (click)="lobby.removePlayer(member.playerId)">Remove</button>
                    }
                  </li>
                }
              </ul>
            </section>
          } @else if (!lobby.ended()) {
            <p class="loading">Connecting…</p>
          }
        </mat-card-content>
        <mat-card-actions align="end">
          @if (lobby.ended()) {
            <a mat-button class="back" routerLink="/rooms">Back to Rooms</a>
          } @else {
            @if (lobby.isHost()) {
              <button mat-stroked-button type="button" class="add-bot" [disabled]="!lobby.canAct() || isFull()" (click)="lobby.addBot()">
                <mat-icon>smart_toy</mat-icon> Add Bot
              </button>
            }
            <button mat-button type="button" class="leave" [disabled]="!lobby.canAct()" (click)="lobby.leave()">Leave Room</button>
          }
        </mat-card-actions>
      </mat-card>
    </div>
  `,
})
export class LobbyPage {
  protected readonly lobby = inject(LobbyService);
  protected readonly firstRevealMinSeats = FIRST_REVEAL_MIN_SEATS;

  // From the member count (the server refuses fewer seats) up to the limit.
  protected readonly seatOptions = computed(() => {
    const room = this.lobby.room();
    if (!room) return [];
    const from = Math.max(room.seatLimits.min, room.members.length);
    return Array.from({ length: Math.max(0, room.seatLimits.max - from + 1) }, (_, i) => from + i);
  });

  protected readonly isFull = computed(() => {
    const room = this.lobby.room();
    return !room || room.members.length >= room.seatCount;
  });

  protected readonly rulesSummary = computed(() => {
    const room = this.lobby.room();
    if (!room) return '';
    const seats = `${room.seatCount} Seats`;
    if (room.seatCount < FIRST_REVEAL_MIN_SEATS) return seats;
    return `${seats} · First Reveal Bonus: ${room.rules.firstRevealDraw ? 'On' : 'Off'}`;
  });

  constructor() {
    this.lobby.open(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');
  }

  protected setSeats(seatCount: number): void {
    const room = this.lobby.room();
    if (room) void this.lobby.setRules(seatCount, room.rules);
  }

  protected setFirstReveal(on: boolean): void {
    const room = this.lobby.room();
    if (room) void this.lobby.setRules(room.seatCount, { ...room.rules, firstRevealDraw: on });
  }
}
```

- [ ] **Step 5: Add the route**

In `projects/app/src/app/app.routes.ts`, after the `rooms` route:

```ts
  { path: 'rooms/:id', canActivate: [requireSignIn], loadComponent: () => import('./online/lobby-page').then((m) => m.LobbyPage) },
```

- [ ] **Step 6: Run the tests, the build and the checks**

```bash
npx jest --selectProjects app
npx ng build app
grep -c '\\u2026' projects/app/src/app/online/lobby.service.ts projects/app/src/app/online/lobby-page.ts
git diff --stat main -- projects/app/src/app/setup projects/app/src/app/game-board projects/app/src/app/play-redirect.ts projects/app/src/app/game.service.ts
```

Expected:
- Every app test PASSES, and the build succeeds.
- `grep` prints `0` for each file.
- The last `git diff` prints nothing: the local screens are untouched.

- [ ] **Step 7: Run every suite**

Run: `npx jest && npm run typecheck:server && npm run test:db`
Expected: every project PASSES, and the type check prints nothing.

`test:db` needs Docker. If Docker can't be started, report the Postgres suite as **not run**.

- [ ] **Step 8: Commit**

```bash
git add projects/app/src/app
git commit -m "feat(app): Lobby screen with live members, host controls and Leave Room

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Manual check after the last task (executor, before the final review)

Run `npm run db:up`, `npm run server` and `npm start`. Use two browsers, or one normal window and one private window, both on http://localhost:4200.

1. **Window A:** sign up as "Ann", then click **Online**. Expect the Rooms screen with "No rooms yet".
2. **Window A:** Create Room with 4 seats. Expect the Lobby: Ann with the Host and You badges, "1 / 4 Players", and the seat toggles.
3. **Window B:** Play as Guest as "Gus", then click **Online**.
   - Create Room is disabled, with "Sign in to host a room".
   - Ann's room shows "1 / 4" and "Waiting for Players".
   - Join with the name "ann": the dialog stays open with "That name is already taken in this room. Choose another.".
   - Join with "Gus" instead: the Lobby opens.
4. **Window A:** Add Bot, then change the seats to 5 and tick First Reveal Bonus. Window B updates live, and shows "5 Seats · First Reveal Bonus: On".
5. **Window B:** open the same Lobby URL in a second tab. The first tab shows "This room is open in another tab" with Back to Rooms. Window A still shows Gus without the Away badge.
6. **Window A:** Remove Gus. Window B lands on Rooms with "The host removed you from the room".
7. **Window B:** join again as "Gus". **Window A:** Leave Room. Window B lands on Rooms with "The host closed the room", because no registered member is left.
8. Stop the server for about 5 seconds, with a Lobby open. The Lobby shows "Reconnecting…", then comes back on its own once the server restarts, and the room is still there.

Report each step as passed or failed.
