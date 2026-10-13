# Backend and Online Multiplayer — Design Spec

Status: Draft for review
Date: 2026-10-13

## Purpose

Today the whole game runs in one browser tab: the Angular app holds the full
state, runs the engine and the bots in-process, and saves nothing across a
reload. This spec adds a backend so that:

- people can play Kingdom War together online, each on their own device, with
  the server as the only authority on game state;
- a player can leave and come back to their seat, in online games and in
  Play vs Bots;
- registered players keep a history of their games;
- every game is stored so it can be replayed exactly, for debugging.

It builds on the proposal in `docs/architecture/backend-and-deployment.md` and
settles that document's open decisions.

Decisions settled during brainstorming:

- **Audience (v1):** friends playing together, at small scale (a handful of
  concurrent games). No matchmaking, no moderation.
- **Hosting:** one long-running Node server (one VPS or container, such as
  Fly.io, Render or Railway). Live games are held in memory. Postgres is used
  for durability, restore and history.
- **Persistence:** **event-sourced**. A game is stored as its seed, its setup
  and its ordered list of actions. In-progress games survive a restart, and
  finished games are kept for replay.
- **Server stack:** Fastify for HTTP, `ws` for WebSocket, Kysely on Postgres,
  TypeBox for schemas. No game-server framework.
- **Accounts:** sign up, sign in, sign out and forgot password, using email
  and password. **Guests** can play without registering, but get no game
  history. **Only registered users can host** a room.
- **Rooms (v1):** every room is open, so it is listed and anyone signed in can
  join while it has room. There are no codes. The lobby is a list of players,
  and **seats are drawn at random when the game starts**. **Names are unique
  within a room.**
- **Disconnects (online rooms):** the decision clock keeps running. After a
  grace period a bot plays the seat, and the player takes it back on return.
- **Guests reclaim a seat only through their session cookie.** If the cookie
  is lost, the seat stays bot-controlled until the game ends.
- **Play vs Bots** moves to the server as an unlisted **solo room**. It
  **pauses while the player is away** and never takes over their seat.
  Pass and Play stays fully local.
- **Chat:** text chat in the room (lobby and game), stored with the game.
- **Replay:** the data and a debugging endpoint ship in v1. A replay viewer UI
  does not.

## Scope

In scope:

- the `protocol` and `server` projects
- the Postgres schema and migrations
- accounts: registered and guest users, sessions, password reset
- rooms (open and solo), the lobby, host rules, starting a game
- the socket protocol: lobby, game updates, chat
- the server-side game runner: validation, persistence, clocks, bots,
  takeover, reclaim, restore
- engine additions: `defaultActionFor` and `DecisionClock`, plus a leak test
- the Angular screens (auth, Rooms, Lobby, My Games) and `RemoteGameService`

Out of scope (v1):

- room codes or passwords, share links
- spectators
- emotes and quick reactions
- a replay viewer UI
- merging a guest's games into a new account
- a seat recovery code for guests
- matchmaking, ratings, friends lists
- horizontal scaling (more than one server process)
- requiring email verification

## Layering

```
engine  ←  content  ←  bots
   ↑          ↑          ↑
   └──────────┴──────────┴──── server (Node)  ──┐
                                                ├── protocol (wire types + schemas)
   app (Angular) ───────────────────────────────┘
   app still imports engine/content/bots for Pass and Play
```

- `protocol` is framework-free. It holds the TypeBox schemas and the
  TypeScript types for every HTTP body and socket message, plus
  `PROTOCOL_VERSION`. It may import types from `engine` (`Action`,
  `GameState`, `EngineEvent`, `GameRules`, `GameResult`). It never imports
  server or database types.
- `server` is a Node application. It imports `engine`, `content`, `bots` and
  `protocol`. Nothing imports `server`.
- Database rows never cross the wire. Mappers in `server/persistence` convert
  rows to and from the server's domain records, and `server/views` converts
  engine state to wire views.

### Server modules

```
projects/server/src/
  http/          Fastify routes: auth, rooms, games
  socket/        upgrade + auth, heartbeat, message routing, per-member connections
  auth/          password hashing, sessions, guest creation, reset tokens, rate limits
  rooms/         RoomManager, Room (lobby rules, host rules), room serial queue
  game/          GameRunner (engine calls, clocks, bots, takeover, restore)
  views/         engine state → SeatView, room → RoomSnapshot
  persistence/   repository interfaces; Postgres (Kysely) and in-memory implementations; migrations
  mail/          Mailer interface; console implementation (dev), provider implementation (prod)
  config.ts      env: DATABASE_URL, PUBLIC_ORIGIN, BUILD_ID, MAIL_*
```

## Database

Postgres. Times are `timestamptz`. Ids are `uuid` unless stated otherwise.

```
users
  id                 uuid PK
  kind               text        -- 'registered' | 'guest'
  email              citext NULL UNIQUE
  password_hash      text NULL   -- scrypt; encodes salt and parameters
  display_name       text
  email_verified_at  NULL        -- recorded, not required
  created_at, updated_at, last_seen_at
  CHECK (kind = 'guest' OR (email IS NOT NULL AND password_hash IS NOT NULL))

sessions
  id                 uuid PK
  user_id            uuid → users ON DELETE CASCADE
  token_hash         text UNIQUE -- sha256 of the cookie value
  created_at, last_seen_at
  expires_at                     -- registered: 30 days sliding; guest: 7 days sliding
  revoked_at         NULL

password_reset_tokens
  id                 uuid PK
  user_id            uuid → users ON DELETE CASCADE
  token_hash         text UNIQUE
  expires_at                     -- 1 hour
  used_at            NULL
  created_at

rooms
  id                 uuid PK
  visibility         text        -- 'open' | 'solo'
  status             text        -- 'lobby' | 'playing' | 'closed'
  seat_count         int
  rules              jsonb       -- engine GameRules
  host_player_id     uuid NULL → room_players
  created_at, updated_at

room_players                     -- a member of a room: a person or a bot
  id                 uuid PK
  room_id            uuid → rooms
  user_id            uuid NULL → users ON DELETE SET NULL   -- NULL for bots
  kind               text        -- 'human' | 'bot'
  display_name       text        -- the name used in this room
  joined_at
  left_at            NULL
  UNIQUE (room_id, lower(display_name)) WHERE left_at IS NULL
  UNIQUE (room_id, user_id) WHERE left_at IS NULL AND user_id IS NOT NULL

games                            -- one per Start Game
  id                 uuid PK
  room_id            uuid → rooms
  seed               bigint      -- never sent to any client
  seats              jsonb       -- [{ seatId, roomPlayerId, name, kind }] as drawn at start
  rules              jsonb
  build_id           text        -- engine + content build the game started on
  status             text        -- 'running' | 'finished' | 'aborted' | 'broken'
  result             jsonb NULL
  action_count       int
  started_at
  finished_at        NULL

game_actions                     -- the event-sourced log
  game_id            uuid → games
  seq                int         -- 1, 2, 3, …
  seat_id            text
  source             text        -- 'human' | 'bot' | 'timeout' | 'takeover'
  action             jsonb       -- engine Action, verbatim
  state_hash         text        -- sha256 of JSON.stringify(state) after this action
  created_at
  PRIMARY KEY (game_id, seq)

chat_messages
  id                 bigserial PK
  room_id            uuid → rooms
  game_id            uuid NULL   -- set while a game is running
  after_seq          int NULL    -- the game_actions.seq the message followed
  room_player_id     uuid → room_players
  body               text        -- 1–300 characters
  created_at
```

Rules enforced in the application layer and covered by tests:

- `rooms.host_player_id` points to a member whose user is `registered`
  (`NULL` only for solo rooms, whose single human may be a guest).
- An open room never has more members (with `left_at IS NULL`) than
  `seat_count`.

Migrations use Kysely's migrator and live in `server/persistence/migrations`.

### Retention

- Finished games and their actions are kept indefinitely in v1.
- Guest users with no activity for 7 days are deleted, together with their
  sessions. `room_players.user_id` becomes `NULL`, and `games.seats` keeps
  the name, so replays still read correctly.
- An open room closes when it has been idle in `lobby` for 30 minutes, or when
  no human member is left.
- A solo game with no activity for 7 days is marked `aborted`, and its room
  is closed.

## Accounts and sessions

- **Sign up:** `{ email, password, displayName }`. The password needs at least
  8 characters. It is hashed with Node's built-in `crypto.scrypt`, using a
  random per-user salt, and the parameters are stored in the hash string.
  Signing up also signs the user in.
- **Sign in:** `{ email, password }`. Any failure gives the same message:
  "Email or password is incorrect".
- **Guest:** `{ displayName }`. This creates a `guest` user and a session.
  The client shows the hint "Playing as a guest: if you clear your browser
  data you can't return to this game".
- **Session cookie:** an opaque random 32-byte token, set as `HttpOnly`,
  `Secure` and `SameSite=Lax`, with path `/`. The database stores only its
  sha256. Each request slides `last_seen_at` and `expires_at`.
- **Sign out:** revokes the session.
- **Forgot password:** `{ email }`. The response is always "If that email has
  an account, we sent a link". For a registered user, the server emails a
  single-use link that is valid for 1 hour.
- **Reset password:** `{ token, password }`. This sets the new hash, marks the
  token used, revokes **all** of the user's sessions, then signs in a new
  session.
- **Mailer:** an interface. In dev it logs the link to the console. In
  production it uses a provider (Resend, Postmark or SMTP), configured by env
  at deploy.
- **Rate limits** (in memory, single process):
  - sign-in: per IP and per email
  - sign-up and guest creation: per IP
  - forgot password: per IP and per email
- A guest who later signs up gets a new account. Their guest games are not
  carried over.

## Rooms

### Screens

**Rooms screen.** Available to any signed-in user.

- Header buttons:
  - **Create Room** is enabled for registered users. For guests it is
    disabled, with the hint "Sign in to host a room".
  - **Play vs Bots** creates a solo room (see "Solo rooms").
- The list shows every non-closed `open` room. Each row shows the host name,
  the player count ("4 / 6"), the status ("Waiting for Players", "Full" or
  "In Progress") and a **Join** button. Join is disabled when the room is
  full or in progress.
- Rooms the user is a member of (open or solo) are pinned at the top with a
  **Rejoin** button.
- The list is refreshed by polling `GET /api/rooms` every 5 seconds while the
  screen is open.
- Empty state: "No rooms yet".

**Join dialog.** It asks only for **Your Name**, pre-filled with the user's
display name. When the server rejects the name, the dialog stays open and
shows the message. On success the user goes to the Lobby screen.

**Lobby screen.**

- The member list shows each member's name, a host badge, whether they are a
  human or a bot, and whether they are connected or away. It does not show
  seat order.
- Host controls: Add Bot, Remove Player, Change Rules, Make Host and
  Start Game.
- **Leave Room** for everyone.
- Room chat.

### Lifecycle

```
          create                      Start Game
 (none) ─────────► lobby ──────────────────────────► playing
                    ▲  │                                 │
                    │  │ no eligible host / idle 30 min  │ game ends
                    │  └────────► closed ◄───────────────┤ (no human left)
                    └─────────────── back to lobby ◄─────┘ (members kept)
```

After a game ends, the room returns to `lobby` with the same members and the
result shown. **Play Again** means the host presses Start Game again.

### Names

- Every member name is unique in the room, compared case-insensitively
  against current members, bots included.
- Creating or joining always takes a name. A taken name is rejected with
  `name_taken`, and the message is "That name is already taken in this room.
  Choose another."
- The room name is stored on `room_players` and does not change the account's
  display name.
- Bots take the first free name in the series "Bot 1", "Bot 2", and so on.
- Reconnecting keeps the existing name.

### Rules

- **Create (open):** registered users only. The creator becomes the first
  member and the host.
- **Join:** allowed only when the room is in `lobby` and not full, and the
  name is free. A user who is already a member is reconnecting, which is
  allowed in any status. A user can't hold two memberships in one room. A
  second tab reuses the membership, and the newest connection wins.
- **Host only, in the lobby:**
  - **Add Bot:** adds a bot member while the room has space.
  - **Remove Player:** removes a human or bot member. A removed human sees
    "The host removed you from the room".
  - **Change Rules:** sets the seat count and the `GameRules`. The seat count
    can't drop below the current member count.
  - **Make Host:** passes the host role to a registered member.
  - **Start Game:** allowed only when the member count equals `seat_count`,
    and that count is within the mode's limits.
- **Start Game, step by step:**
  1. Shuffle the members with `crypto.randomInt` and assign them `seat-0` to
     `seat-n` in that order.
  2. Generate the seed with `crypto.randomInt`.
  3. Call `createGame(kingdomWarMode, registry, seatIds, seed, rules)`, then
     apply each player's kind and name, as `GameService.startGame` does
     today.
  4. Insert the `games` row with its seats, and set the room to `playing`.
  5. Start the `GameRunner`.
- **No joining mid-game, and no spectators.**

### Host rules

The host role only ever belongs to a registered member.

| Situation | Behaviour |
|---|---|
| Host offline in the lobby for less than 60 seconds | No change |
| Host offline in the lobby for 60 seconds or more | The role passes to the earliest-joined connected registered member. If there is none, the lobby shows "Waiting for Hing to return…" and the room closes at the 30-minute idle timeout |
| Host presses Leave Room in the lobby | The role transfers right away under the same rule. If no registered member is left, the room closes and members see "The host closed the room" |
| Host disconnected or away during a game | No effect on play. The host keeps the role. Their seat follows the disconnect rules |
| Host leaves during a game | A bot plays their seat for the rest of the game. The role transfers under the same rule. If no registered member is left, the room closes when the game ends |
| Game ends while the host is away | The result is shown to everyone. If the host is still away after 60 seconds, the role transfers under the same rule |

A returning former host doesn't get the role back automatically. Every
transfer is shown as "Hing is now the host".

### Solo rooms (Play vs Bots)

- Created by `POST /api/rooms/solo { seatCount, rules }`. Any signed-in user
  can do this, guests included.
- `visibility = 'solo'`. The room is never listed to others and can't be
  joined.
- The room holds the user plus `seatCount − 1` bots. The user's room name is
  their display name, and the bots use the usual bot names.
- The game starts immediately, with no lobby step. The user is seated at
  random, like any game.
- **The game pauses while the player is away.** When the player has no
  connection, the runner stops the decision clock and the bot timer. Both
  resume when the player reconnects. The seat is never taken over.
- When the game ends, the board offers **Play Again**, which starts a new
  game in the same room, and **Back to Rooms**, which closes the room.
- There can be one running solo game per user. Starting Play vs Bots while
  one exists offers **Resume Game** or **Abandon and Start New**. Abandoning
  marks the old game `aborted`.

## Socket protocol

### Connection

- There is one WebSocket at `wss://<origin>/api/ws` per open Lobby or Board
  screen. The session cookie authenticates the upgrade, and the server checks
  the `Origin` header against `PUBLIC_ORIGIN`.
- The client's first message is `hello { protocolVersion, roomId }`. The
  server checks membership and replies with `welcome`. If the protocol
  version doesn't match, the server sends the `error` code `version` and
  closes. The client then shows "Please reload to get the latest version".
- The server sends a WebSocket ping every 15 seconds. Two missed pongs mark
  the member as disconnected.
- The newest connection for a member wins. The older one receives `replaced`
  and closes, and shows "This room is open in another tab".
- Every message is JSON with a `type`. A client request may carry a `reqId`,
  and the server answers it with `ack { reqId }` or
  `error { reqId, code, message }`.
- Every incoming message is validated against its TypeBox schema before it is
  routed.

### Client → server

| Message | Who | Notes |
|---|---|---|
| `hello { protocolVersion, roomId }` | member | first message on a connection |
| `lobby.addBot` | host, lobby | |
| `lobby.removePlayer { playerId }` | host, lobby | |
| `lobby.setRules { seatCount, rules }` | host, lobby | |
| `lobby.makeHost { playerId }` | host, lobby | target must be registered |
| `lobby.start` | host, lobby | |
| `room.leave` | member | |
| `game.submit { gameId, baseSeq, actions: Action[] }` | seated human | `baseSeq` must equal the current `seq`. Actions are resolved atomically |
| `game.resync` | member | requests a full snapshot |
| `chat.send { body }` | member | 1–300 characters, at most 5 messages per 10 seconds per member |

### Server → client

| Message | When | Content |
|---|---|---|
| `welcome` | reply to `hello` | `you { playerId, seatId \| null }`, `room: RoomSnapshot`, `game: GameUpdate \| null` (full log), `chat`: the last 100 messages |
| `room.updated` | any membership, host, status or rules change | `RoomSnapshot` |
| `game.update` | after every accepted input, and on resync | `GameUpdate` |
| `chat.message` | when a chat message is accepted | `{ id, from { playerId, name }, body, at }` |
| `replaced` | a newer connection took over | |
| `error` | a request was rejected | `{ reqId?, code, message }` |

```
RoomSnapshot {
  id, visibility, status, seatCount, rules,
  hostPlayerId,
  members: [{ playerId, name, kind, isRegistered, connected, botControlled }],
  lastResult: GameResult | null
}

GameUpdate {
  gameId, seq,
  view: SeatView,             // redactStateForSeat(state, seat) without rng and without log
  legalActions: Action[],     // for the receiving seat; [] unless it must act
  logFrom: number,            // index of events[0] in the full log
  events: EngineEvent[],      // new log entries since the client's last update
  clock: { seatId, kind, endsAt, totalSeconds, serverNow } | null,
  paused: boolean             // solo rooms while the player is away
}
```

- The client appends `events` to its own log. If `logFrom` isn't equal to its
  log length, the client sends `game.resync`, and the reply carries the full
  log (`logFrom = 0`).
- The client only displays `clock`, and uses `serverNow` to correct for its
  own clock being off. A clock on a bot seat is what drives the "thinking…"
  indicator.

Error codes: `version`, `not_member`, `not_host`, `not_your_turn`, `stale`,
`illegal_action`, `room_full`, `in_progress`, `name_taken`,
`host_must_be_registered`, `rate_limited`, `invalid_message`, `game_broken`.
The client maps each code to a sentence-case message.

## Game runner (the engine on the server)

Each running game has one `GameRunner`, owned by its room. It is the only
code that calls the engine.

### State held in memory

`state` (the full `GameState`), `seq`, `seats` (seat id to member), bot
memories per seat, one decision-clock timer and one bot timer.

### The room serial queue

Every input to a room is processed one at a time, in order: human submits,
bot moves, timeouts, lobby messages, chat, connects and disconnects. So every
client sees the same order of updates.

### Processing an action input

```
1. check     game running, not broken
             seat = getActiveSeatId(state); input is for that seat
             human input: the member owns the seat, the seat is not botControlled,
                          baseSeq == seq
2. resolve   next = fold resolve(s, a, ctx).state over the actions
             any throw → error 'illegal_action' to the sender; nothing changes
3. persist   INSERT game_actions rows seq+1…seq+n (source, state_hash), one transaction
             failure → error to the sender; nothing changes
4. commit    state = next; seq += n
5. publish   game.update to each connected member (their SeatView, their
             legalActions, the log delta, the clock)
6. schedule  cancel timers
             result set → finish
             next decider is a bot or a botControlled seat → bot timer (700 ms)
             next decider is a human → decision clock
```

If `resolve` throws for a reason other than legality, the game is marked
`broken`, members receive `game_broken`, and the board shows "This game hit an
error and has stopped". An engine assertion is one example. Only that room is
affected.

### Decision clocks

- The budgets and pause rules move from the Angular `DecisionTimer` into a
  framework-free `DecisionClock` in the engine package:
  - `response` 60 s, `choice` 60 s, `discard` 60 s
  - `selection` 300 s per player
  - `play` 300 s per Play phase, paused while a response is under way
- At zero the runner submits `defaultActionFor(state, seatId, legalActions)`
  with `source = 'timeout'`.
- `defaultActionFor` is a new engine function that holds today's defaults:
  - a response → No Response
  - a choice → the first option
  - the Play phase → End Phase
  - the Discard phase → the first cards in hand
  - General selection → the first legal pair

  The server can't see a player's half-made pick, so it always uses the
  first option.
- The Angular `DecisionTimer` is rewired onto `DecisionClock` and
  `defaultActionFor` for Pass and Play, keeping its "the UI's current pick"
  preference, so offline and online behaviour can't drift apart.

### Bots, takeover and reclaim

- A bot seat moves through `ruleBasedPolicy.decide(redactStateForSeat(state,
  seat), seat, legal, registry, memory)` with `source = 'bot'`.
- **Takeover (open rooms only).** A human seat becomes `botControlled` in
  either of these cases:
  - the member has been disconnected for 60 seconds;
  - two timeouts in a row happen for that seat while the member is
    disconnected.

  The bot then plays the seat with `source = 'takeover'`, and every member
  receives `room.updated`.
- **Reclaim.** When the member reconnects, `botControlled` clears at the next
  decision boundary, never in the middle of a bot move. Members see
  "Hing is back".
  - A guest reclaims through their session cookie only.
  - A registered user can reclaim from any device after signing in.
- **A member who leaves a running game** is `botControlled` for the rest of
  that game.
- **Solo rooms** never take over a seat. The game pauses instead (see
  "Solo rooms").
- Bot memories are not stored. After a restore, bots start the current turn
  without memory.

### Finishing a game

When `state.result` is set, the server:

1. updates `games` with `status = 'finished'`, the `result` and
   `finished_at`;
2. sends a final `game.update`;
3. returns the room to `lobby` (or, for a solo room, offers Play Again);
4. drops the runner.

### Restore on startup

For each game with `status = 'running'`:

1. Rebuild it: `createGame(seed)`, apply the stored seat kinds and names,
   then call `resolve` for every action in `seq` order.
2. If `build_id` equals the current build, trust the replay. If it differs,
   every step's `state_hash` must match. Any mismatch or throw marks the game
   `broken`, and members see "This game can't continue after an update".
3. Every member starts as disconnected. Open rooms apply the normal grace
   period. Solo rooms start paused.
4. Every pending clock restarts with its full budget.

Solo runners whose player stays away are evicted from memory after 30
minutes. They are rebuilt the same way when the player rejoins.

Deploys shut down gracefully: the server stops accepting new games, finishes
in-flight actions, then exits. Restores against a new build are expected, and
the hash check is what keeps them honest.

### Views and hidden information

`server/views` is the only code that sends game data to a client. It is
`redactStateForSeat` plus removing `rng` and `log`. The engine's redaction is
left as it is, so the local app can still use it for debugging. The seed and
the full state never leave the server.

## HTTP API

All routes are under `/api` and are authenticated by the session cookie
unless noted. Bodies are JSON and validated by TypeBox. Every non-GET request
must send `Content-Type: application/json` and a matching `Origin`.

| Route | Who | Purpose |
|---|---|---|
| `POST /auth/signup` | anyone | create a registered user and sign in |
| `POST /auth/signin` | anyone | sign in |
| `POST /auth/guest` | anyone | create a guest user and sign in |
| `POST /auth/signout` | signed in | revoke the session |
| `POST /auth/forgot-password` | anyone | send a reset link |
| `POST /auth/reset-password` | anyone | set a new password from a token |
| `GET /me` | signed in | `{ id, kind, displayName, email? }` |
| `GET /rooms` | signed in | the list of open rooms plus the user's own rooms: `{ id, visibility, hostName, memberCount, capacity, status, youAreMember }` |
| `POST /rooms` | registered | `{ seatCount, rules, displayName }` → `{ id }` |
| `POST /rooms/solo` | signed in | `{ seatCount, rules }` → `{ id }`, or `409` with the existing solo room id |
| `POST /rooms/:id/join` | signed in | `{ displayName }` |
| `GET /rooms/:id` | member | `RoomSnapshot` |
| `GET /me/games` | registered | the user's finished games: `{ gameId, finishedAt, players, result, yourSeat }` |
| `GET /games/:id/replay` | a registered member of that game | finished games only: `{ seed, seats, rules, buildId, actions, chat }`, enough to rebuild the game exactly for debugging. The seed is secret only while a game is running, so revealing it afterwards is safe |

## Angular changes

- New screens: Sign In, Sign Up, Forgot Password, Reset Password,
  Play as Guest, Rooms, Lobby and My Games.
- Navigation: Play offers **Online**, which leads to Rooms, alongside
  **Play vs Bots**, which now creates a solo room, and **Pass and Play**,
  which stays local.
- `AuthService` (signals `me` and `isRegistered`), `RoomsService` (polling)
  and `SocketService` (connection, reconnect, typed messages).
- `RemoteGameService` exposes the same public signals and methods as
  `GameService` (`visibleState`, `legalActions`, `activeSeatId`,
  `botSeatIds`, `botThinkingSeatId`, `lastError`, `submit`, `submitAll`).
  The board is provided with one or the other through dependency injection,
  so board components don't change.
- `submitAll` maps to a single atomic `game.submit`.
- Previews such as `previewEffect` run locally on the received `SeatView`.
  They only read the state, and the engine package is already in the bundle.
- While the socket is down, the client reconnects with exponential backoff
  (1 s, doubling, up to 15 s), shows a "Reconnecting…" banner and disables
  actions. Each reconnect sends `hello`, and `welcome` replaces all room and
  game state.
- `DecisionTimer` stays for Pass and Play only. Online, the countdown comes
  from `GameUpdate.clock`.
- All new text follows the CLAUDE.md casing rules.

## Engine changes

1. `defaultActionFor(state, seatId, legalActions): Action`, moved out of
   `DecisionTimer`.
2. `DecisionClock`: framework-free clock rules (budgets, keys, pause and
   resume), moved out of `DecisionTimer`.
3. A **leak test** over simulated games from `sim`. For every seat and every
   step it asserts that no `SeatView` (after the server mapping) and no log
   event exposes another seat's hand, a face-down card, a hidden General, the
   draw pile order or the RNG state.

No rule changes.

## Testing

- **Unit tests (in-memory repositories):**
  - room rules: unique names, capacity, start conditions, the host only ever
    registered, host transfer
  - solo room behaviour
  - `DecisionClock` and `defaultActionFor`
  - view mapping (no `rng`, no `log`)
  - auth: hashing, session sliding and revocation, reset-token single use and
    expiry, rate limits
- **Repository tests:** against a real Postgres (Docker Compose in dev and
  CI), with migrations applied fresh.
- **End-to-end tests:** the server runs in-process, with `ws` clients that
  use the bot policy to act as humans. They:
  - play full games;
  - cover disconnect, takeover and reclaim;
  - cover the solo pause and resume;
  - check that a stale `baseSeq` is rejected;
  - check that an atomic multi-action submit rolls back on failure;
  - check that a mid-game restart restores with matching hashes, and that a
    different `build_id` with a diverging hash gives `broken`;
  - check chat ordering and `after_seq`.
- **Leak test:** as in "Engine changes".

## Stages

Each stage has its own plan, branch and merge, as the engine stages did.

1. **Engine prep:** `defaultActionFor`, `DecisionClock` and the leak test,
   with `DecisionTimer` rewired onto them. No server.
2. **Server foundation and accounts:** the `protocol` and `server` projects,
   config, Postgres, migrations and repositories, users, sessions, guests,
   sign up, sign in, sign out, password reset with the console Mailer, rate
   limits, plus the Angular auth screens and `AuthService`.
3. **Rooms and lobby:** the room HTTP routes, the socket handshake and
   heartbeat, lobby messages, the host rules, plus the Rooms and Lobby
   screens.
4. **Online game:** `GameRunner`, action persistence, clocks, bots, takeover
   and reclaim, restore on startup, solo rooms (Play vs Bots on the server),
   plus `RemoteGameService` with the board running online.
5. **Chat and My Games:** chat in the lobby and on the board, `GET /me/games`,
   the My Games screen and the replay debugging endpoint.

## Open items for deployment (not blocking the design)

- the email provider and the sender domain;
- the hosting provider and its managed Postgres;
- how `BUILD_ID` is injected (the git sha at build time).
