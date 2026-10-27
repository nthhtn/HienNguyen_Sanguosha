# Victory Window — Design

Status: draft for review, 2026-10-26.

Mock (interactive, private to the author): https://claude.ai/artifact/WrcfJSKaoxmamtcBDUVsBa. This document is written so a builder never needs it.

## Intent

The Game Over card today is a headline and two lines of names ("Winners: …", "Losers: …"). A finished Kingdom War is a story about groups: who sat with whom, who won, who fell. The window should show that at a glance: one column per group that took part, each listing its players, with the winning group lit in its own colour.

## Goals

1. **One column per group that took part, at most six**, in this order: Wei, Shu, Wu, Qun, Winning Ambitionist, Losing Ambitionist. A column exists only if at least one seat belongs to it.
2. **Each column lists its player members**, in seat order: name, the General pair, and whether the seat survived or fell. The viewer's own seat is tagged "You".
3. **The winning group is lit** in its Force colour (header, border, tint, glow and a "Winners" tag). Every other column drops its colour and dims. With no winner (a draw), no column is lit.
4. **A short reveal**: headline, then the columns one after another, then the winner lit.
5. **Works on a phone**: two columns per row, the winning column first.
6. Fallen teammates stay in their column, so a Kingdom's result reads as a team's result.

## Non-goals

- No change to `GameResult`, `checkWinCondition` or any win rule. The simulator and tournaments read `winningSeatIds` and must see the same values.
- No change to the New Game flow, the Play Again flow, or what happens after the window.
- No new statistics (kills, damage, turns).

## Anti-goals

- No win logic in the component. Which group won is derived from the result by a pure function with tests, outside the component.
- The window must not reveal anything that is still hidden while the game is running. It shows hidden information only once `state.result` is set.

## Design

### Which group a seat belongs to

A pure function over the final state (an app-side view-model module, unit-tested without TestBed), `victoryColumns(state, result, viewerSeatId)`:

- A seat's **group** is `'Ambitionist'` when `seat.allegiance === 'ambitionist'`, otherwise its Kingdom (`Wei`, `Shu`, `Wu`, `Qun`). *(Designer's call:)* a seat whose allegiance was never decided, because it never revealed, is shown under its main General's printed Kingdom.
- The **winning group**:
  - `result.winningSeatIds` empty: none (a draw).
  - `result.winningKingdom` set: that Kingdom.
  - otherwise (a sole survivor): the group of that one seat. An Ambitionist survivor gives the Winning Ambitionist column; a Kingdom seat that is the last one alive lights its own Kingdom's column.
- **Ambitionist columns:** when the winning group is Ambitionist, that seat is the only member of "Winning Ambitionist" and every other Ambitionist is in "Losing Ambitionist". Otherwise every Ambitionist is in "Losing Ambitionist". The loser label is plural when two or more seats are in it.
- **Input and output shape** *(designer's call)*: the function takes plain per-seat data (seat id, display name, allegiance, Kingdom, General ids, eliminated, viewer or not) and the result, not the whole state, so the local game and a protocol summary (the online result) feed it the same way. It returns `{ columns, winningGroup, headlineKind }` where `headlineKind` is `'kingdom' | 'ambitionist' | 'lone-survivor' | 'draw'`.
- **"You" tag:** only when the local game has one human seat (Play vs Bots: that seat). In Pass and Play, and for a viewer with no seat, no member is tagged.
- **A lone survivor with no decided allegiance** lights its printed Kingdom's column, but the headline names the player ("{name} wins!", existing `over.namesWin`) instead of claiming a Kingdom win, since the engine declared none and the seat never played for that Kingdom.
- Members within a column are in seat order. Each carries: seat id, display name, main and deputy General names, survived (`!eliminated`), and whether it is the viewer's seat.
- Fallen members of the winning Kingdom are in the winning column, shown as Fallen. (Today `result.winningSeatIds` lists only survivors and fallen teammates are in `losingSeatIds`; the window groups by allegiance and does not use `winningSeatIds` for membership.)

### What the final state must show

All Generals (full definitions, not only the `revealed` flags) and allegiances are shown once `state.result` is set. The builder confirms that redaction has a single choke point on the server (including reconnect after the game ended and spectators) or patches each path. Redaction (`redactStateForSeat` locally, and the per-seat view on the server) keeps hiding hands, but when `result` is non-null it stops hiding every seat's `generals` and `allegiance`. This is the only engine-side change, and it is public-information-only at the moment the game is over.

### Content of the window

- **Headline**, by case (English, sentence case; Vietnamese sentence case, draft):
  - A Kingdom wins (including a lone Kingdom survivor): "{Kingdom} wins!" (existing key `over.kingdomWins`).
  - An Ambitionist wins: "{name} wins as the Ambitionist!" (new key).
  - A draw: the existing `over.draw`.
- A one-line sub-headline under it explains the win ("Every survivor played for Wei.", "The last survivor, playing alone.", and a draw's "Everyone fell at the same time.").
- **Column header:** the group name (Title Case) and the member count ("3 players" / "1 player").
- **Member row:** avatar (the first General's art if available, otherwise an initial in the Force colour; a dashed outline when fallen), the name, "You" tag if the viewer, the General pair "Main · Deputy", and "Survived" or "Fallen".
- **Colours:** Force tokens from `styles.scss`: `--force-wei`, `--force-shu`, `--force-wu`, `--force-qun`, `--force-ambitionist`, with their `-text` variants where text is set. The window's headline takes the winning group's colour; with no winner it is neutral. The builder checks Qun's contrast in both themes.
- **Buttons:** unchanged for the local game ("New Game").

### Reveal sequence

| t (ms) | Beat |
|---|---|
| 50 | Headline and sub-headline fade up. |
| 500 | Columns rise in one after another, about 130 ms apart. |
| after the last column + 500 | The winner is lit (glow, tint, Winners tag, slight lift); every other column loses colour and dims. |

With `prefers-reduced-motion`, show the end state at once. The window is not blocking: the button is usable immediately.

### Layout

- A centred row that wraps. Each column is between 150 and 190 px wide, so a four-column result is not stretched across the screen.
- The window's width is a size container. At 700 px or narrower: two columns per row, the winning column first, smaller headline.
- The window is no longer the 420 px card; it is up to about 980 px wide.

### Where it is used

- **Local game** (`GameOver` in `game-board/`): fully, as above. It reads the final state it already receives (`gameService.state()`).
- **Online result** (`online/online-result.ts`, from `LastGame`): the same window, in scope for this change. `LastGame` today holds only seat names and the result, so the protocol gains a per-seat summary sent with the finished game: seat id, display name, allegiance, Kingdom, the main and deputy General ids, and whether the seat was eliminated. The server builds it from the final state (it is public once the game is over) and persists it with the finished game through the existing explicit mapping layer, not by exposing a schema. The client feeds it to the same `victoryColumns` function. Finished games stored without a summary fall back to the current text card. The protocol version bumps (together with the animation change's clock addition if both ship in one release). The online buttons (Back to Lobby, Play Again, Back to Rooms) keep their current behaviour and sit under the columns.

## Constraints

- Engine and content stay framework-free; the grouping function is pure and tested (CLAUDE.md).
- UI text follows the casing rules in CLAUDE.md (Title Case labels such as "Winning Ambitionist", "Survived", "Winners"; sentence case for the headline and sub-headline). New keys in `en.ts` and `vi.ts` (draft).
- The standing preference to keep the local Play and Game screens as they are applies to behaviour: this change only restyles the Game Over card and adds no new local game behaviour.
- No new dependency; CSS container queries and transitions only.

## Decisions made by the user

- Up to six columns: Wei, Shu, Wu, Qun, Winning Ambitionist, Losing Ambitionist; each lists its player members.
- Highlight the winning allegiance in its colour theme.
- No column for a group that did not take part.
- Fallen teammates and the engine-list question: the user approved the mock showing fallen teammates in their column.
- The online result gets the same window in this change.

## Left to the builder

Names and files; whether the avatar uses General art; the exact easing; the Vietnamese wording; how to split the work (suggested: the pure grouping function and the redaction change first, then the component, then the online result).

## Calls the designer made (not the user)

- Membership comes from allegiance and Kingdom, not from `winningSeatIds`.
- A seat that never revealed is shown under its printed Kingdom.
- All Generals and allegiances are shown once the game is over, locally and online.
- "Losing Ambitionists" is plural from two seats.
- A lone Kingdom survivor lights its own Kingdom's column.
- The sub-headline wording, the column width bounds and the reveal timing.
