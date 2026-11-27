# Profile: Stats, History and Account Settings

Addendum to `2026-10-13-backend-multiplayer-design.md` and
`2026-10-15-backend-stage-5-chat-my-games-design.md`. This spec adds a Profile
page for registered users.

## Intent

- **Why:** Players who register have no reason to look at their account today. My Games lists past results and nothing more.
- **Goal:** A Profile page that shows how you play (record, Generals, Forces, form) and lets you manage your account.
- **Audience:** Friends on the hosted server now, and anyone who finds it later.

## Goals

- **Record:** Games, wins, losses and win rate.
- **Forces:** Record split by the Force you played.
- **Generals:** Most played Generals, each with games and wins.
- **Form:** Your last 10 results, the current streak and the best streak.
- **Filter:** All games, solo games (Play vs Bots) or online games.
- **History:** My Games becomes a tab of the Profile page.
- **Settings:** Change your display name and your password.

## Non-goals

- **Public profiles** and head-to-head records. Both need a privacy decision.
- **Replay viewer.** `GET /games/:id/replay` stays a debugging endpoint. A viewer is its own project, recorded in `docs/deferrals.md` as far future.
- **Kills, damage and card stats.** The engine does not track them as fields. They can be derived from the log later.
- **Forgot password mail and Google sign-in.** Both are deferred. This spec does not touch them.
- **Guest profiles.** Guests have no durable identity.

## Approaches

- **Replay on read:** Rebuild every finished game when the profile loads. No schema change, but it costs CPU per game on the 0.1 CPU free instance and grows with history. Rejected.
- **Snapshot at finish (chosen):** Store one row per human seat when a game ends. Stats are SQL queries. A one-off script fills in old games.
- **Result-only stats:** No Generals or Forces. Cheapest, but the least interesting. Rejected.

## Rules for the numbers

- **Counted games:** Only games with status `finished`. Aborted, broken and outdated games never count.
- **Counted seats:** Human seats held by a registered user. Bot seats never count for the user.
- **Win:** The seat id is in `result.winningSeatIds`.
- **Loss:** The seat id is in `result.losingSeatIds`. A finished game with neither has no outcome for that seat and counts as neither (not a win or a loss) but still counts as a game played.
- **Win rate:** Wins divided by games with an outcome, as a fraction, or null with no games.
- **Force of a seat:** `ambitionist` when allegiance is `ambitionist`. Otherwise the printed Kingdom (Wei, Shu, Wu, Qun). A seat with no decided allegiance and a hidden Kingdom has no Force and is left out of the Force table.
- **General plays:** A seat counts once for its main General and once for its deputy General. Hidden or absent Generals are skipped. A General's wins are the wins of the seats that played it in either slot.
- **Form:** The last 10 counted games by `finished_at`, newest first, each `win`, `loss` or `none`.
- **Streaks:** Consecutive wins by `finished_at`. A loss ends a streak. A game with no outcome also ends it. `best` is the longest run, `current` is the run ending at the newest game.
- **Filter:** `solo` is games whose room visibility is `solo`, `online` is `open`, `all` is both.

## Server

- **Migration `0006_game_seat_results`:**
  - Table `game_seat_results`: `game_id` (FK to `games`, cascade), `seat_id`, `user_id` (FK to `users`, cascade), `main_general_id` and `deputy_general_id` (nullable), `kingdom`, `allegiance` (nullable), `eliminated`, `won` (nullable boolean, null when no outcome).
  - Primary key `(game_id, seat_id)`. Index on `(user_id)`.
- **Writing rows:** `RoomService.closeGame` already receives `finalSeats` (from `finalSeatViews`). In its existing transaction, when the outcome is `finished`, it inserts a row for every seat whose room player has a `user_id`. The `won` value comes from the result. `GameRepository` gains `saveSeatResults`.
- **Backfill script:** `npm run backfill:seat-results` loads finished games with no rows, replays each (`replay()` without hash checks), builds the rows with `finalSeatViews` and inserts them. It is idempotent (skips games that have rows) and logs games that fail to replay instead of stopping.
- **`ProfileService`** (`server/src/profile/`): `stats(userId, mode)` runs the queries and returns the shape below. It sits behind a repository method `profileStats`, so the in-memory repositories need an equivalent, covered by the repository contract tests.
- **Routes** (registered users only, like `/me/games`):
  - `GET /api/me/profile?mode=all|solo|online` returns `{ displayName, memberSince, mode, totals, byForce, topGenerals, form, streak }`.
  - `PATCH /api/me/profile` with `{ displayName }`: normalised by `normalizeDisplayName`, error `invalid_name`.
  - `POST /api/me/password` with `{ currentPassword, newPassword }`: errors `invalid_credentials` (wrong current password) and `weak_password`. On success the other sessions of the user are revoked and the current one stays.
- **Rate limit:** The password route uses a per-user limiter like the sign-in one.
- **Names in old games:** Display names live in the `games.seats` snapshot, so a rename never rewrites history.

## Protocol

- New types and Typebox schemas in `projects/protocol`: `ProfileStats`, `ProfileMode`, `ForceRecord`, `GeneralRecord`, `FormEntry`, `UpdateProfileBody`, `ChangePasswordBody`.
- `topGenerals` returns at most 10 entries, ordered by games played, then wins, then General id.

## Angular

- **Profile page** at `/profile` (needs sign-in): tabs Stats and History.
  - **Stats tab:** Summary tiles, the Force table, top Generals with their portraits, a row of recent results, the streaks and a mode filter.
  - **History tab:** The current My Games list. The `/my-games` route redirects to `/profile`.
  - **Settings:** A section with the display name form and the password form.
- **Navigation:** The user's name in the existing account control links to Profile.
- **Text:** English and Vietnamese, following the UI text style rules in `CLAUDE.md`. Vietnamese is marked as draft.
- **No game rules in components:** The server computes every number.

## Response shape

- **`totals`:** `{ games, wins, losses, noOutcome, winRate }`. `games` is wins plus losses plus `noOutcome`. `winRate` is wins divided by wins plus losses, or null.
- **`byForce`:** `{ force: 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'ambitionist', games, wins, losses, winRate }[]`, ordered by games descending. Same denominators as `totals`.
- **`topGenerals`:** `{ generalId, games, wins, winRate }[]`. Same denominators, where `losses` is games minus wins minus no outcome.
- **`form`:** `{ gameId, finishedAt, result: 'win' | 'loss' | 'none' }[]`, newest first, at most 10.
- **`streak`:** `{ current, best }`, both integers.
- **Mode:** Every list and total above follows the `mode` filter.

## Calls made while writing this (author's calls, not yet reviewed)

- **Backfill timing:** Render's free tier has no shell. The backfill therefore also runs in the background at server start, after migrations. It is idempotent and skips games that already have rows. The npm script stays for local use.
- **Backfill fidelity:** A replay runs the same actions on the same engine, so `finalSeatViews` gives the same result as at game end. A game that no longer replays (the engine changed) is logged and skipped.
- **Own rows only:** A user's stats read only that user's rows. A game with several registered humans gives each of them their own row, and the game counts once for each.
- **Guests:** Rows are written for any human seat with a `user_id`, guests included. A guest's rows disappear with the guest. There is no claim of past games when a guest registers.
- **Guests on `/profile`:** The route uses the same guard as `/my-games` today, and the nav link follows the My Games link's visibility. The `/my-games` redirect applies after the guard.
- **Password change:** Revokes the user's other sessions and keeps the current one. This adds `revokeOthersForUser(userId, exceptSessionId, now)` to the session repository, in both implementations, with contract tests. `weak_password` reuses the sign-up rule.
- **Rename:** Applies to rooms joined from then on. A room the user is already in, and a game running, keep the old name until they leave. This avoids rewriting room rows and moving seat names mid-game.
- **Qun and ambitionist:** A seat that decided `ambitionist` counts only under `ambitionist`, never also under Qun.

## Constraints

- **Local screens:** Setup and Game stay untouched.
- **Layering:** Stats code lives in the server's application layer. The engine gains nothing.
- **Persistence:** The wire shapes in `protocol` differ from the rows. Mapping happens in `views/`.
- **Docs:** `docs/architecture/backend.md` and `docs/deferrals.md` are updated to match.

## Left to the builder

- Exact SQL and the in-memory equivalent.
- Page layout and tile design, within the existing visual style.
- Whether `ProfileStats` caches per request. Not needed at this size.
- Test shape. Cover the number rules above with fixtures, including games with no outcome and unrevealed Generals.
