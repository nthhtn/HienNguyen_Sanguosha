# Simultaneous General Selection — Design

Status: implemented, 2026-10-27.

## Intent

When an online game starts, every player is dealt five Generals and must pick a Main General and a Deputy General. Today the picks happen one seat at a time, in seat order: the second player stares at a "Bots are choosing their Generals…" spinner until the first has confirmed. The author tested with two browsers in an online room and found the waiting is the problem. Nobody should wait on another player to start thinking. The game begins when the last player confirms.

## Goals

1. **Online, every human picks at the same time.** Any seat that has not yet chosen may submit its choice, in any order.
2. **A right-hand panel shows who is ready.** Each seat is listed as "Choosing" or "Ready". It never shows which Generals were picked or offered.
3. **A choice is locked once confirmed.** A seat that has chosen cannot choose again.
4. **The game starts 3 seconds after the last seat is ready.** A "Game starts in 3" countdown plays. No decision clock runs and no bot moves during it.
5. **Bots count as ready straight away.** They never hold anyone up.
6. **The clock stays 300 seconds.** One clock for the whole selection, shared by everyone, because everyone starts together. When it runs out the server picks for every seat still choosing, using the engine's default (the first legal pair).

## Non-goals

- Local pass-and-play and vs-bots games on one device are unchanged: one person at a time, behind the hand-off gate, in seat order. Their screens get no ready panel and no 3-second countdown. *(Designer's guess, not yet confirmed by the author.)*
- No change to which Generals are dealt, how many (5), the Kingdom-matching pairing rule, or the shuffle: the same seed deals the same candidates.
- No change to the General Selection clock length.
- No takeover or away rules are changed: a seat whose player has been away long enough is played by a bot, as today.

## Anti-goals

- The panel and the redacted state must not reveal anyone's candidates or pick. The panel learns only who is still choosing.
- The client must not decide who may choose. It asks the engine's legal actions, as everywhere else.

## Rules (written before implementation, per the project process)

**Rule text.** During General Selection, every seat that has candidates left may choose. A seat chooses once, by picking an ordered pair of two of its own candidates that belong to the same Kingdom (unchanged). The seat then has no candidates left, so it is ready and cannot act again. When the last seat has chosen, the game moves on to the Start phase of the first turn. Seats may choose in any order, and a second seat's choice does not depend on the first's.

**Engine.**

- `getLegalActions(state, seatId, registry)` during `GeneralSelection` returns the legal pairs for *any* seat that still has candidates, not only the first one.
- `applyGeneralChoice` stops requiring the seat to be the single "active seat". It still rejects a seat with no candidates, a non-candidate General, equal Generals and mismatched Kingdoms.
- `getActiveSeatId` is a single-seat concept used in many places (the app, bots, the simulator, the server). During `GeneralSelection` it keeps returning the first seat that still has candidates, so sequential callers (the local game, the simulator, bots) keep working. A new helper, for example `getActingSeatIds(state)`, returns every seat that may act now (during `GeneralSelection`: all seats with candidates; otherwise the active seat alone, or none). The name and shape are the builder's call.
- Redaction already keeps the *keys* of `generalSelection.candidates` and masks the values for other seats. So a seat's absence from the keys means "ready", and no protocol change is needed to show the panel. The builder should confirm this holds for the online views.
- The `GeneralsChosenEvent` is logged in the order the choices arrive.

**Server (`GameRunner`).** Today it assumes one acting seat and one clock, and a submit whose `baseSeq` is behind is refused as stale.

- During General Selection it must accept a choice from any seat that still has candidates. Two players confirming at nearly the same moment must both succeed: a choice does not depend on the other seats' choices, so it must not be refused as stale because another seat's choice landed first. (A Close of a settled judgment is the existing precedent for a move that must not lose a race.)
- It runs one shared 300 s clock for the phase, started when the game starts. On expiry it submits the default choice for each seat still choosing and records them as timeouts. Whether a timeout during selection counts towards the away-takeover count is the builder's call; this document does not intend it to.
- Bot seats choose immediately when the phase opens, without the usual per-move delay. A seat played by a bot (taken over or gone) chooses at once, not after the clock.
- The 3-second start: after the last choice commits, no clock starts and no bot moves for 3 s. The length is a shared constant exported from the engine, like `JUDGMENT_LEAD_IN_MS`, so the server and the app agree. The decision clock of the first decision of the game (the Start window, or the bot's first move) begins after it.
- A client that reconnects during the 3 s sees the remaining time, not a fresh 3.

**App (online only).**

- While the phase is `GeneralSelection`, a person sees their own five candidates and the selection controls at once, with the ready panel on the right. After they confirm, the controls give way to a waiting view, and the panel keeps updating.
- The panel lists every seat by display name: "Choosing" or "Ready". Bots are listed as Ready from the start. The viewer's own row is marked.
- When every seat is ready, a "Game starts in 3" countdown plays in place of the waiting view, then the board appears.
- The existing spinner ("Bots are choosing their Generals…") is replaced online. It remains for local games.
- Text follows the project's UI text style: the panel title is Title Case ("Players"); status words and the countdown are sentence case ("Choosing", "Ready", "Game starts in 3"). English and Vietnamese strings are both added, Vietnamese as a draft. Seat names never show ids.

## Decisions made while writing this (designer's calls)

1. **A General choice is exempt from the stale-`baseSeq` check.** The server accepts it if it is legal against the *current* state (the seat still has candidates, the pair is legal). There is no rebase. The action log records choices in the order they commit, so replay reproduces the same game. If a seat's choice and the 300 s timeout (or a takeover) race, the first to commit wins and the other is refused as illegal ("already chosen"). The client treats that refusal as a resync, not an error.
2. **One shared clock, shown to everyone.** During selection the server sends every seat the same clock view (`GameClockView`, as for any decision), so the existing countdown shows the time left for the phase. A seat that is ready still sees it, because it is the time until the game starts at the latest. Nothing is added to the protocol for this.
3. **The 3 seconds is a lead-in, not a phase.** After the last choice the engine is in the Start phase of turn 1 straight away. The server then sends the first decision's clock view with `startsAt` in the future (the same mechanism as the judgment lead-in), and the app shows "Game starts in N" while that clock has not started and the game is at turn 1 with nothing played yet. A client that reconnects during it reads the remaining time from `startsAt - serverNow`. "All ready" is therefore derived from the game being past General Selection plus that pending start, not from the candidates. This does not conflict with "Ready is derived from the redacted state", which holds during General Selection.
4. **No one can act during the 3 seconds.** The server offers no legal actions to anyone until it ends, and the app covers the board with the countdown. Bots do not move either.
5. **Taken-over or gone seats are Ready at once** (a bot picks for them immediately). A player who disconnects while choosing does not hold up the countdown beyond the shared 300 s: when it runs out, or when the away rule hands the seat to a bot, a choice is made for them.
6. **Every online caller of `getActiveSeatId` during selection moves to the new helper**: the server's runner (legal actions, timers, bot and timeout moves) and the online app service. The local game, the simulator and the offline bots keep `getActiveSeatId`. The builder finds the callers by search.

## Constraints

- The engine stays framework-free and executable under plain Node. The simulator and tournaments must keep working and keep producing the same games for the same seeds.
- The engine remains the source of truth for who may choose. The panel derives "Ready" from the (redacted) state only.
- The saved game's action log stays an ordered list of actions with seat ids; replay must reproduce the same game, including choices made out of seat order.
- Old documents under `docs/architecture/` that say "seats choose in seat order" are updated.

## Left to the builder

- The helper's name and shape for "every acting seat".
- How the server tracks the one shared clock beside its single-clock structure.
- Whether the app computes the 3-second countdown from a server clock field or from the phase change plus the shared constant.
- Panel layout and animation, within the existing visual style.
- Whether bots in the server choose in one commit or one commit each.

## Open for the author

- Local pass-and-play and vs-bots keep sequential selection (see Non-goals). Say so if you want the ready panel or the 3-second countdown there too.
