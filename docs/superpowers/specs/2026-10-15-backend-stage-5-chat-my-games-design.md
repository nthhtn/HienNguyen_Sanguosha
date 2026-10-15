# Backend Stage 5: Chat and My Games

Addendum to `2026-10-13-backend-multiplayer-design.md`. That spec defines the
architecture, the tables, the socket messages and the HTTP routes. This file
fixes the Stage 5 decisions that spec leaves open.

## Scope

- Room chat in the lobby and on the online board.
- `GET /me/games` and a read-only My Games screen.
- `GET /games/:id/replay`, a debugging endpoint with no viewer UI.

**Out of scope:** every item deferred from Stages 3 and 4 (socket lifetime on
revoke, client 401 retry, "Not found" text for closed rooms, grace-period
text, `room_players` rows on close, lobby rate limit, membership queue,
restore retry, shutdown refusal, JSON target comparison, solo eviction and
7-day abort, Leave Game button, "Draw — No survivors." casing, the manual
two-browser check). The local Setup and Game screens stay untouched.

## Decisions

- Solo (Play vs Bots) rooms have no chat. `chat.send` there is refused with
  `chat_unavailable`, and the panel is hidden.
- On the online board, chat is a collapsible side panel, closed by default,
  with an unread badge on its toggle. In the lobby the panel is always open.
- A My Games row is read-only: date, players, result and your seat. No
  download button and no detail page.

## Server

- **Migration `0004_chat`:** creates `chat_messages` as in the main spec, plus
  an index on `(room_id, id)`.
- **`ChatService`** (`server/src/rooms/`, no socket knowledge):
  - `send(roomId, member, body)` trims the body and rejects empty bodies and
    bodies over 300 characters. It enforces 5 messages per 10 seconds per
    member with an in-memory sliding window. It stores the message with
    `game_id` and `after_seq` taken from the running game, and returns it.
  - `recent(roomId, 100)` returns the last 100 messages, oldest first.
- **`SocketService`:** `chat.send` calls `ChatService.send` and broadcasts
  `chat.message` to the room. Failures go back to the sender as `error` with
  `chat_empty`, `chat_too_long`, `chat_rate_limited` or `chat_unavailable`.
  `welcome` gains `chat`.
- **`GET /me/games`:** registered users only, newest first,
  `{ gameId, finishedAt, players, result, yourSeat }`. `players` comes from
  `games.seats`, so names survive guest deletion.
- **`GET /games/:id/replay`:** the caller must be a registered member of the
  game. Unfinished, unknown and not-yours all return 404. The body is
  `{ seed, seats, rules, buildId, actions, chat }`, where `chat` holds the
  messages with that `game_id`. Lobby messages sent before the game are not
  included.

## Protocol

`projects/protocol` gains the `chat.send` client message, the `chat.message`
server message, `welcome.chat`, and the `ChatMessage` and `GameSummary` types,
with Typebox schemas beside the existing ones.

## Angular

- `ChatService`, provided by the Lobby page beside `LobbyService`, keeps the
  `messages` signal (replaced by `welcome`, appended by `chat.message`) and
  sends with `send(body)`. `SocketService` stays transport only.
- `ChatPanel` (standalone) renders the messages and an input limited to 300
  characters. It shows the server's error text and decides nothing about the
  rate limit.
- `BoardChat` wraps the panel in the board's collapsible side panel. Its
  unread count is presentation state and resets when the panel opens.
- My Games: a route, an Online toolbar link hidden from guests, and a
  `MyGamesService` calling `GET /me/games`. Empty state: "No finished games
  yet".
- All new text follows the CLAUDE.md casing rules.

## Testing

- `ChatService`: validation, the rate window, `game_id` and `after_seq`.
- Socket integration with the existing `TestClient`: broadcast, `welcome`
  history, solo refusal.
- HTTP: `/me/games` and replay, including guest, non-member and unfinished
  cases, and a replay whose actions rebuild the stored state hash.
- Angular specs: `ChatPanelComponent`, the unread badge, the My Games list.
