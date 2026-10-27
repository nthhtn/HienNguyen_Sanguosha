# Backend and deployment

The game runs two ways today:

- **Local**: Pass and Play, and Play vs Bots from the Game Setup screen, run
  in one browser tab. `GameService` holds the state and runs the engine and
  bots in-process. Nothing is saved across a reload.
- **Server-authoritative**: online rooms and Play vs Bots from the Rooms
  screen run on the Node server in `projects/server`. The server holds every
  game's full state, the browser only ever sees a redacted view, and a game
  survives a reload, a disconnect and a server restart.

This doc describes the second one: what each part is, how a move travels, and
what is deliberately not done yet. The original design and its reasoning are in
`docs/superpowers/specs/2026-10-13-backend-multiplayer-design.md`; the server's
own how-to-run notes are in [projects/server/README.md](../../projects/server/README.md).

## Projects

```
 engine  <-  content  <-  bots
   ^           ^            ^
   +-----------+------------+--- server (Node) --+
                                                 +-- protocol (wire types and schemas)
   app (Angular) ---------------------------------+
```

| Project | Role | Framework |
|---|---|---|
| `projects/protocol` | every HTTP body and socket message as a TypeBox schema plus a TypeScript type, `PROTOCOL_VERSION`, and the shared limits and error codes. May import engine *types* (`Action`, `GameState`, `EngineEvent`, `GameRules`, `GameResult`); never server or database types. Its `public-api` is browser-safe, with the schemas behind `protocol/schemas`. | none |
| `projects/server` | the application layer, authoritative side: accounts, rooms, the game runner, persistence, the socket. Imports `engine`, `content`, `bots` and `protocol`; nothing imports it. | Fastify, `ws`, Kysely on Postgres |

Database rows never cross the wire. `server/persistence` maps rows to domain
records, and `server/views` maps records and engine state to wire shapes.

## What runs where

| Concern | Browser | Server |
|---|---|---|
| Game state | only the latest `SeatView` it was sent | the full `GameState` per running game |
| Rules | none | `resolve`, `getLegalActions`, the mode and content |
| Randomness | none | the seeded RNG; the seed never leaves the server |
| Seats | shows "you are Seat 2" | draws seats from the seed at start and binds each member to one |
| Bots | none | `ruleBasedPolicy` for bot seats, after a 1.5 s delay |
| Decision clocks | displays the remaining time | owns the clock; at zero it submits the engine's default |
| Dialogs, sounds, popups, history lines | derived from the event log | sends the log; nothing else |

The browser's `RemoteGameService` exposes the same surface the board reads from
`GameService` (the `BoardGame` type), so the board is the same component in
both cases. See [Frontend](frontend.md).

## Server modules

```
projects/server/src/
  http/          Fastify app: request guard (Origin check), session cookie, auth, room and game routes
  socket/        the WebSocket on /api/ws: upgrade and auth, hello, message routing, heartbeat
  auth/          AccountService, scrypt password hashing, tokens, rate limits
  rooms/         Room (lobby rules), RoomService (live rooms, host rules, restore), ChatService, serial queue
  game/          GameRunner, engine calls and replay hashing (engineGame), history
  views/         records and engine state to wire shapes
  persistence/   repository interfaces, in-memory and Postgres stores, migrations
  mail/          the Mailer interface (console implementation only)
  config.ts      PORT, HOST, DATABASE_URL, DATABASE_SSL, PUBLIC_ORIGIN, BUILD_ID, TRUST_PROXY, STATIC_DIR
```

## Accounts and sessions

Email and password sign-up, sign-in, sign-out and password reset
(`/api/auth/*`), plus **guests** (`/api/auth/guest`) who play without
registering. The session is an HttpOnly cookie holding a random token; only its
sha256 is stored. Registered sessions slide for 30 days, guest sessions for 7.
Only registered users can host an open room, see **My Games** and read a replay.

The HTTP API and the socket both require the request's `Origin` to equal
`PUBLIC_ORIGIN`, so the app must be opened at that origin (`localhost`, not
`127.0.0.1`, in development). Sign-up, guest, forgot-password and
reset-password are rate limited per IP, which needs `TRUST_PROXY` set correctly
behind a reverse proxy (the README explains the accepted values).

## Rooms and the socket

An **open** room is listed, and anyone signed in can join while it has space.
A **solo** room is unlisted and holds one person against bots; it backs
Play vs Bots. Names are unique within a room. The lobby holds the members, the
seat count and the rules (`GameRules`: first-reveal draw, the deck, the
judgment notice). **Seats are drawn at random from the game seed when the host
starts** (`drawSeats`), so join order gives no position.

`RoomService` keeps live rooms in memory and writes every change through to
Postgres. Each room runs its inputs one at a time through a serial queue
(`rooms/serialQueue.ts`), so a room never handles two messages at once. A room
that sees no activity for 30 minutes closes.

A browser opens one socket per room screen, and its first message must be
`hello { protocolVersion, roomId }`; a mismatched `PROTOCOL_VERSION` is refused
and the client asks the player to reload. A second connection for the same
member replaces the first.

| Direction | Messages |
|---|---|
| client to server | `lobby.addBot`, `lobby.removePlayer`, `lobby.setRules`, `lobby.makeHost`, `lobby.start`, `room.leave`, `game.submit`, `game.resync`, `chat.send` |
| server to client | `welcome` (the room, the running game with its full log, recent chat), `room.updated`, `game.update`, `chat.message`, `room.left`, `replaced`, `ack`, `error` |

Every client message carries a `reqId` that the server echoes in its `ack` or
`error`.

## One online move

```
 click ("Play Sha on Seat 1")
   |
   v
 component -- takes the Action from legalActions --> RemoteGameService.submit
   |  socket: game.submit { actions }
   v
 Room (serial queue) --> GameRunner.submit(seat, actions)
   1. the seat is the active seat (getActiveSeatId) and the action is one the engine offered (isOfferedAction)
   2. next = resolve(state, action, ctx)         throws on an illegal action
   3. persist the action with the sha256 of the new state
   4. publish a GameUpdate to every member, each through its own seat's view
   5. reschedule the clock, or the bot's move, for the next decider
```

A `GameUpdate` carries the seat's `SeatView`, its legal actions (empty unless
it must act now), the new events, the running clock and a `paused` flag. The
client keeps its own log: if `logFrom` does not line up with what it holds it
sends `game.resync`, and the server answers with the whole log.

### Visibility

`SeatView` is `redactStateForSeat` minus two fields: `rng`, which holds the
seed, and `log`, which travels separately as `events`, each slice masked by
`redactEventsForSeat`. Card ids are opaque (`card-<position>` after the
shuffle, `r<counter>-<position>` after a reshuffle), so neither a masked card
nor the draw-pile order can be read from ids. `projects/sim/src/leaks.ts`
checks views, the log and reshuffles over simulated games.

## The game runner

`GameRunner` ([gameRunner.ts](../../projects/server/src/game/gameRunner.ts)) is
the only code that changes a running game's state. It owns:

- **The decision clock.** It asks the engine what each human must decide
  (`describeDecision`) and keeps the budgets (`switchClock`, `expireClock`).
  At zero it submits `defaultActionsFor`, the same default the local timer uses.
- **Bots.** A bot seat moves after `BOT_DELAY_MS` (1.5 s) using the rule-based
  policy over that seat's redacted view.
- **Away seats.** A human who disconnects keeps their clock running. After 60 s
  away, or two timeouts in a row while away, an open room's seat is **taken
  over** by a bot, and the player takes it back on return. A player who leaves
  the room is replaced by a bot to the end. A solo game instead **pauses**
  while its player is away.
- **The judgment notice.** While a judgment waits to be closed, a bot never
  closes it as long as a person controls any seat. Only a person's Continue or the
  3 s notice clock moves it on, and that timeout does not count towards the
  away rule. Both this clock and a judgment-change decision's 15 s clock start
  after a lead-in (below), and a bot that may change a judgment waits for the
  same lead-in while a person is at the table; with none, every lead-in is 0.
- **Clock lead-in.** `GameClockView` carries `startsAt` beside `endsAt`: the
  moment the countdown starts, after the judgment animation the decision follows
  (the card turning up, a replacement's swap, the verdict). Until then the clock
  shows its full length. The lead-ins are fixed constants the app and the server
  share (`JUDGMENT_LEAD_IN_MS` in the engine). Adding `startsAt` moved
  `PROTOCOL_VERSION` to 3.

Guests reclaim a seat only through their session cookie; if the cookie is lost,
the seat stays with the bot.

## Persistence and restore

Games are **event-sourced**. A game is stored as its seed, its setup and the
ordered `game_actions`, each tagged with who made it (`human`, `bot`,
`timeout`, `takeover`) and the sha256 of the state after it (computed over
JSON with sorted keys, so Postgres `jsonb` key order cannot change it).
`games.build_id` records which build the game started on.

On start the server rebuilds each running game by replaying its log:

- the **same build** replays it as stored;
- **another build** checks every hash, and a game whose hash differs stops with
  outcome `outdated` ("This game can't continue after an update").

An engine error during play stops the game with outcome `broken`. Registered
users can read a finished game's actions at `/api/games/:id/replay` for
debugging; there is no replay viewer in the app.

Postgres tables (migrations in `persistence/migrations`): `users`, `sessions`,
`password_reset_tokens`, `rooms`, `room_players`, `games`, `game_actions` and
`chat_messages`. Without `DATABASE_URL` the server uses an in-memory store and
forgets everything on restart; that is for local runs only, and production
requires `DATABASE_URL` and an `https` `PUBLIC_ORIGIN`. One repository contract
suite runs against both stores (`npm run test:db`).

### The finished game and `LastGame.finalSeats`

When a game ends, the room keeps `lastGame` (game id, outcome, `result`, the
seats' names) for the lobby that follows. `LastGame.finalSeats` is a required
list of `FinalSeatView` (seat, both Generals, printed Kingdom, allegiance,
eliminated), built by the protocol's `finalSeatViews(state)` from the **full** final state
on the server, so every member can show who was on which side whatever their
own seat could see. It is held in memory with the room only, never written to
Postgres, and is `[]` for a `broken` or `outdated` game. Adding it moved
`PROTOCOL_VERSION` to 2; an older tab is asked to reload.

## Chat

Room chat (lobby and game) is stored with the room and tied to the game and
the action count it followed. A message is 1 to 300 characters, a member may
send 5 per 10 seconds, and a welcome carries the last 100. Solo rooms have no
chat.

## Deployment

The server and the built Angular app ship as one Docker image, which runs on
Render's free web service against Supabase Postgres. The server serves the app
(`STATIC_DIR`), answers `GET /healthz`, and turns Postgres TLS on with
`DATABASE_SSL=require`; `BUILD_ID` falls back to Render's `RENDER_GIT_COMMIT`.
[Deployment](../deployment.md) has the setup and the first-deploy checklist.

## Local play compared

| | Pass and Play | Play vs Bots (Setup) | Online room, Play vs Bots (Rooms) |
|---|---|---|---|
| Engine runs | in the tab | in the tab | on the server |
| Saved across reload | no | no | yes |
| Hidden hands | gate overlay (honor system) | viewer fixed on seat 0 | redacted view per seat |
| Needs an account | no | no | yes (guest is enough) |

## Not done

- **Spectators**, room codes and passwords, share links, matchmaking, ratings
  and friends lists.
- **A replay viewer.** The data and the debug endpoint exist.
- **More than one server process.** Live games live in the memory of one
  process; there is no cross-process coordination.
- **A real Mailer.** Password reset emails go to the server log.
- **Merging a guest's games into a new account**, and a recovery code for a
  guest's seat.
- **Email verification.**
