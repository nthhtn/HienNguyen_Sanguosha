# Judgment Popup — Design

> Amended by `2026-10-26-judgment-compete-animation-design.md`: the notice timer is 3 s (not 10 s), the popup plays a fixed animation (the "no animation" non-goal is lifted), and a skill's decision to change the card is made inside the popup.

Status: draft for review, 2026-10-20. Builds on the minimizable decision popups (branch `feat/minimizable-decisions`: `DecisionDock`, `MinimizeButton`, `DecisionBanner`), which must be merged first.

## Intent

When a card or a General skill makes a seat judge, every player should see what is being judged, why, and what the result does, and the game should not rush past it. Today a judgment shows only as a line in Action History; the consequence (a skipped phase, 3 damage) happens a moment later with no explanation.

## Goals

1. **A popup for every judgment, for every seat**, showing:
   - **Source:** the effect that required the judgment: the General and skill, in the General's force color, or the card (name and the seat it sits on).
   - **Card:** the judgment card, with each replacement in turn ("Devil replaced 7 ♠ with K ♥").
   - **Consequence:** one sentence saying what the final card does, e.g. "Hing skips the Play Phase".
   - **Timer:** 10 seconds, started only when the card is final.
   - **Close** (ends the timer, the game moves on) and **View Board** (minimize, with the banner from the minimize work).
2. **The game waits.** The wait is part of the engine's state, not a screen effect, so it holds locally, online and in replays, and bots cannot run past it.
3. **Humans only close it.** Any human seat may Close; the first Close (or the 10 s timeout) proceeds for everyone. Bots never close it while a human is seated.
4. **Hand-written consequence text per effect**, English and Vietnamese (drafts), for all 12 judging effects below.

## Non-goals

- No change to the Compete popup, to Action History, or to what skills can do to a judgment.
- No sound or animation beyond the existing dialog.
- Spectators and reconnect-mid-judgment are covered only by "the popup is rebuilt from state"; no new reconnect protocol.

## Anti-goals

- The popup must never be able to stall a game for more than 10 s of human time. A game with no human seat must not stall at all (headless simulation, all-bot games).
- No game rule may live in the Angular code: the consequence text and who may close come from the engine and content packages.
- Existing saved and replayed games must still replay exactly.

## Design

### Engine: a judgment view in state

`GameState` gains an optional public field:

```ts
judgmentView?: {
  seatId: string;                 // the judged seat
  reader: JudgmentReader;         // the card or General skill that required it
  card: CardInstance;             // the card as it stands now
  data?: Record<string, unknown>; // what the reader passed along (e.g. the damage source), for the consequence text
  changes: { owner: AbilityOwner; abilityId: string; card: CardInstance; replaced: CardInstance }[];
  settled: boolean;               // false while skills may still change the card; true while waiting for Close
}
```

- Set by `JudgeEffect` when it turns the card up (`settled: false`); updated by `ReplaceJudgmentEffect` (new `card`, one more entry in `changes`).
- When `JudgmentShownEffect` applies (every changer has had its say) and the option below is on, it sets `settled: true` and **stops the pipeline** instead of queueing `JudgmentResolveEffect`. The judgment is resolved by the acknowledgement.
- A new action `AcknowledgeJudgmentAction { kind, seatId }` clears `judgmentView`, logs a `JudgmentAcknowledgedEvent { seatId, source: 'close' | 'timeout' }` and queues `JudgmentResolveEffect` for the same judgment. `resolveAction` rejects it when no settled `judgmentView` exists.
- `judgmentView` is public (the judged card is already in a face-up zone); redaction keeps it as is.
- While `settled: false`, nothing new is pending beyond today's asks; the popup is open and shows who is deciding.

### Who acts, and the clock

- **The engine keeps one actor.** While `settled: true` the active seat (`getActiveSeatId`) is the **first living seat in seat order whose `Player.kind` is human**; if there is none, the judged seat. `getLegalActions` offers `AcknowledgeJudgmentAction` to that seat only, and `applyMove` / `resolveAction` / replay hashing are unchanged.
- **Any human may close it, by proxy.** The action is `AcknowledgeJudgmentAction { kind, seatId, by?: string }`: `seatId` is always the active seat, `by` is the seat whose player pressed Close. The server (`submit`) and the local game service accept a close request from any seat the game treats as a human player and turn it into the action for the active seat with `by` set. The engine accepts the action as the active seat's, and `JudgmentAcknowledgedEvent { seatId, by?, source: 'close' | 'timeout' }` records who actually closed (`by` absent for a timeout).
- **"Human" at run time.** The engine knows only `Player.kind`. The application layer knows which seats a bot is playing right now (the server's `isBotPlayed`: taken over, left; locally the bot seats). For this action the rule is applied there: a bot never closes it while at least one seat is controlled by a person. The server and the local bot driver therefore **do not schedule a bot move** for a settled judgment unless no seat is controlled by a person (all-bot or fully taken-over game); in every other case the 10 s clock runs, and the first person to press Close, or the timeout, proceeds.
- **Clock:** new decision kind `'notice'`, `DECISION_SECONDS.notice = 10`, `defaultActionsFor` returns the acknowledge action (as the active seat, no `by`). It runs only while `settled: true`. The local `DecisionTimer` and the server `reschedule`/`timeout` treat it like any other kind; `GameClockView.kind` gains `'notice'`. A disconnected or away human does not lengthen the wait beyond the 10 s.
- **Away takeover:** a timeout of this kind does **not** count towards the "away" takeover rule (a one-line exclusion in `gameRunner.ts` where timeouts are counted); it asks nothing of the player.
- **Local Pass and Play:** every seat is a human on one device. The popup shows no hidden information, so the "Pass the device to …" gate is **not** shown for a settled judgment: whoever holds the device sees the popup and may Close, and the local service submits it as the active seat with `by` set to the revealed seat. The gate returns for the next decision as usual.

### Compatibility: a game option

The wait changes the action sequence, so it is a game option, `judgmentNotice: boolean`, stored in state at `createGame`. Default `false`. The app and the server set it `true` for new games; the simulation harness and existing tests keep `false`. A stored game keeps the value it started with, so replays are unchanged. Engine tests of the new behavior set it `true`.

### Content: consequence text

The text says what **will actually happen** to the final card in the current state (a dead damage source, a short hand, the suit as skills currently count it), not just what the card alone says. Content therefore defines, per reader, one outcome function over the full judgment context:

```ts
// content: pure, no UI
judgmentOutcome(state, judgmentView, registry): { key: string; seats: { seat: string; owner: string; source: string | null } } | null
judgmentOutcomeText(readerId, key, names: { seat: string; owner: string; source: string }, locale): string | null
```

- `seat` is the judged seat, `owner` the seat of the skill or card that required the judgment, `source` a third seat the effect acts on (Unyielding's and Lament's damage source), taken from `judgmentView.data`.
- Following `competeOutcomeText` (`content/src/lib/display.ts`): an English table keyed by reader id and outcome `key`, Vietnamese in `content/data/locales/vi/prose.json`, and a parity spec in `prose.vi.spec.ts`.
- The rule (the predicate on the card and context) lives in **one function per reader** that both the reader's `onJudged` and `judgmentOutcome` call, so they cannot disagree. Each reader gets a test over every suit and rank, and over the dead-source and short-hand cases where they matter, asserting the key matches what `onJudged` actually does.

Texts (draft English; final copy follows CLAUDE.md casing; the builder checks each row against the reader's code and corrects the text, never the rule). `{seat}` judged seat, `{owner}` owner, `{source}` damage source:

| Reader | Final card / state | English text |
|---|---|---|
| Lightning (card) | Spade 2–9 | "{seat} takes 3 thunder damage" |
| Lightning | otherwise | "Lightning moves to the next seat" |
| Capture (card) | not Heart | "{seat} skips the Play Phase" |
| Capture | Heart | "Nothing happens" |
| Starvation (card) | not Club | "{seat} skips the Draw Phase" |
| Starvation | Club | "Nothing happens" |
| Eight Trigrams, Eight Arrays | Red | "{seat} counts as having played a Shan" |
| Eight Trigrams, Eight Arrays | Black | "Nothing happens" |
| Unyielding | not Heart, source alive | "{source} discards 2 cards or takes 1 damage" |
| Unyielding | Heart, or source gone | "Nothing happens" |
| River Goddess | Black | "{seat} takes the card and judges again" |
| River Goddess | Red | "The card is discarded and the judging ends" |
| Iron Cavalry | Red | "The Sha cannot be dodged" |
| Iron Cavalry | Black | "Nothing happens" |
| Lightning Strike | Spade | "{seat} takes 2 thunder damage" |
| Lightning Strike | otherwise | "Nothing happens" |
| Dueling Heroes | Red / Black | "{owner} takes the card and may play {red or black} hand cards as Duel this turn" |
| Military Farm | not Heart | "{owner} stashes the card as a Farm" |
| Military Farm | Heart | "The card is discarded" |
| Lament | Heart | "{seat} heals 1 HP" |
| Lament | Diamond | "{seat} draws 2 cards" |
| Lament | Club | "{source} discards 2 cards" |
| Lament | Spade | "{source} turns face down or face up" |

"Card names, General names and seat names" are localized in the popup, never ids.

### Application layer and UI

- `GameBoard` opens a `JudgmentDialog` (via `openForceDialog`, `disableClose: true`) when `judgmentView` becomes non-null and closes it when it becomes null. This also covers a client joining mid-judgment: the popup is rebuilt from state.
- **The dialog reads state, not a snapshot.** Its model is computed from `visibleState` and the translator, so each replacement and a language switch update it in place (no rebuild needed).
- **Color:** the force of the skill owner's seat for a skill; for a card, the force of the judged seat, whose judgment zone holds it. Same `force-dialog-<force>` classes and `data-force` as the other dialogs.
- **Content, top to bottom:** Source (General art, name and skill; or card), Card (the card face, and one line per replacement), Consequence (shown once `settled`), and while not settled a line "Waiting for {seat} to decide whether to change the judgment" with no timer and no Close.
- **When settled:** the countdown (the existing `DecisionCountdown`) and a Close button. Close submits `AcknowledgeJudgmentAction` for the viewing seat if it is a human seat. A viewer with no seat (spectator) sees no Close.
- **Minimize:** `MinimizeButton` in the title row and the existing banner. The banner reads "Judgment" with the timer; the minimize logic needs no change. Hidden or revealed seats use the same rules as other dialogs (`openForceDialog` with the viewer's force when no source seat is visible).
- A skill owner's Ask or Selection popup appears over the open Judgment popup as it does over the board.
- Strings: new keys for the title, the waiting line, "Close", and the replaced line, in `en.ts` and `vi.ts`, English Title Case for names and labels, sentence case for sentences; Vietnamese sentence case; Vietnamese starts as draft.

### Online

The server runs the same engine, so `judgmentView` rides in each seat's `SeatView` and the wait is enforced there. `submit` accepts `AcknowledgeJudgmentAction` from any non-bot living seat (see Who acts). `ActionSchema` is shape-only, so no schema change; the clock's new `'notice'` kind flows through `GameClockView`. Bump `PROTOCOL_VERSION` only if the version check treats an unknown kind as breaking (*builder to confirm*).

## Constraints

- Engine and content stay framework-free; no rule logic in components (CLAUDE.md).
- Rules before code: the table above is the rule text, confirmed per reader before implementing that reader.
- Existing tests, sim and saved games unaffected while `judgmentNotice` is false.
- UI text follows the casing rules in CLAUDE.md; no ids shown.

## Decisions made by the user

Wait everywhere (engine-level); show each change in turn; hand-written consequence text per effect; only humans close it; timer starts when the card is final; minimize like the other popups; all judging cards and skills, in English and Vietnamese.

## Left to the builder

Names of types, files and message keys; how the popup lays out the card and replacements; how to split the work into stages (suggested order: engine state, action and clock behind the option; content text; bots, sim and server; the app popup); updating `redact.ts`, sim invariants and leak checks for the new field; the Vietnamese draft wording.

## Calls the designer made (not the user)

- The engine keeps a single actor; "any human may close" is done by proxy with a `by` field, not by changing the legality model.
- "Human" is decided at run time by the application layer (who is controlling a seat), not by the engine.
- No device hand-off for a settled judgment in Pass and Play.
- The consequence text follows the real game state, so `judgmentView` carries the reader's `data`.
- Two judgments cannot overlap: a settled judgment stops the queue, and any later one starts after the Close.
