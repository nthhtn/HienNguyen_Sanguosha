# Battle Playback: Design

Status: draft for review. Prototype: the Battle Playback Lab artifact
(https://claude.ai/artifact/ReswScaowdZKcE8U656SJE), which shows every
technique below on three scripted sequences.

## Why

A bot's move is one `resolve` call, and one call can log five or more events
(a Slash, no Dodge, the damage, the seat dying, the card going to the Discard
Pile). The board jumps straight to the end state, and the only record is the
text ribbon in the table centre. The next bot moves 1.5 s later however much
happened. Players have to read the Action History to find out what happened, and
they fall behind.

**Success:** a player who never reads the Action History can still see who did
what to whom, and what it cost, at a pace they can follow.

## Goals

1. Play each batch of new log events as a paced sequence of animated beats.
2. While a sequence plays, the board shows the moment being animated: HP drops
   when the hit lands, a card leaves the hand when it flies.
3. Local games wait for the playback: bots and the viewer's own decisions
   start only once it has finished.
4. Online games never wait for one player's screen. The player catches up
   instead.
5. All seven techniques from the prototype: card flights, target lines, hit and
   heal effects, callouts, spotlight, caption and turn banner, and a speed setting.

## Non-goals

- No change to the protocol, no server change beyond a restore test, and no
  change to any decision's time limit.
- No bespoke per-card animation (a Lightning strike, a fire for Blaze). The
  beat registry (below) makes those easy to add later.
- No rewind, scrubbing or replay control. Playback only moves forward.
- No change to how the Compete and judgment popups animate inside themselves.

## Anti-goals (a failure even if it works)

- A hidden card's face is shown to someone who may not see it.
- One player's slow screen or Slow setting holds up anyone else online.
- The UI decides anything about the rules. Playback replays recorded facts and
  never works out what the rules would do.
- Old events play again on joining, reloading or starting a new game.

## Decided by the user

- **All techniques kept:** card flights, target lines, hit and heal effects,
  callouts, spotlight, caption and turn banner, and the speed setting.
- **The board shows the moment being animated**, not the final state with
  animation drawn over it.
- **Local: decisions wait for playback.** The viewer's decision dialog, and its
  countdown, open only when playback has finished. Bots move only after it has
  finished.
- **Online: the server clock keeps counting.** If the viewer owes a decision
  while their playback is behind, the remaining beats are rushed (shown fast,
  not skipped) so the dialog opens within about one second. The generous decision
  timers make this safe on slow connections.
- **Pass and Play stays** (removing it is a separate question). After a
  reveal, only the last move is replayed.
- **Online games running at deploy time keep running.** The new pass event
  must not stop them.
- **Catch-up cap online:** a player whose queue is more than about 4 s behind is
  sped up until they are back within it, so their screen never drifts far
  behind the room or the chat.
- **The Game Over window waits** until the final elimination has played.

## How it works

### 1. The playback director

A root-provided Angular service, `PlaybackDirector`, in the app's presentation
code. It does not import Angular component code into the engine and holds no
rules.

- It watches the board's game source (`BoardGame.visibleState`) and keeps a log
  cursor with the same baseline rule the sounds use: the first look, and a new
  game's shorter log, only set the cursor, so nothing old plays.
- New events are turned into **beats** (section 2) and queued. Events that arrive
  while beats are still playing are added to the end of the queue.
- It exposes signals:
  - `displayedState`: what the board renders (section 3);
  - `current`: the beat on show, which drives the caption, spotlight, arrows and callouts;
  - `idle`: the queue is empty and the displayed state has caught up.
- Timing runs through `beat-player.ts`, or something in the same style: plain
  `setTimeout`, testable with fake timers, and reduced motion shows the end state at once.

### 2. Beats: a registry, not a switch

Each event kind maps to a beat definition in a registry keyed by event kind,
in line with CLAUDE.md's extensibility rule. A beat definition gives:

- its duration at Normal speed (a function of the event, so a fan-out to five
  targets can take longer than one);
- what it shows (flight, line, impact, callout, banner, caption);
- the sound or voice it plays, moved here from the batch-level `soundsFor` and
  `voicesFor`, so a sound plays with its beat and not when the batch arrives.

An event kind with no registered beat gets a zero-length default: its state
change applies at once, with no visual. Adding a bespoke animation later means
registering one beat; nothing else changes.

Starting durations at Normal speed, taken from the prototype:

| Event | Beat | ms |
|---|---|---|
| `TurnAdvancedEvent` | turn banner, spotlight moves to the new turn owner | 1000 |
| `PhaseChangedEvent` | phase chip on the turn owner | 250 |
| `CardsDrawnEvent` | card backs fly from the Draw Pile to the seat, staggered | 500 + 140 per card |
| `CardPlayedEvent` | callout with the card name; the card flies from the seat to the centre; a line to each target. A response lands on the stack and greys the line it answers. | 900, plus 150 for a fan-out to more than two targets |
| `ResponsePassedEvent` (new, section 6) | grey callout on the seat: "No Dodge" | 700 |
| `CardMovedEvent` to the Discard Pile | a card not on the centre stack flies to the Discard Pile. The stack itself (and its lines and spotlight) stays, across idle, until the next non-response play replaces it or a turn or phase change clears it; it then sweeps to the Discard Pile | 400 |
| `CardMovedEvent` elsewhere (equip, judgment area, hand to hand) | the card flies between the zones, face down unless the move is public (section 4) | 500 |
| `DamageDealtEvent`, `HpLostEvent` | tile shakes and flashes red, "−N" floats up, the HP pip pops | 900 |
| `HealEvent` | green glow, "+N" | 800 |
| `SeatDyingEvent` | "Help!" callout; the tile pulses until saved or eliminated | 900 |
| `SeatSavedEvent` | the pulse stops | 300 |
| `GeneralRevealedEvent` | the portrait flips | 700 |
| `SeatEliminatedEvent` | "Eliminated" stamp, the tile greys | 1400 |
| `AbilityUsedEvent` | callout with the skill's name on its owner | 700 |
| everything else | none | 0 |

The durations are a starting point to tune by eye. Between batches (one
`resolve` call each) there is a 350 ms gap at Normal.

### 3. The displayed state

The board renders `displayedState` instead of `visibleState`. During a
sequence it is the previous visible state with the played events folded in one
by one. When the queue empties it becomes the real visible state again
(reconciliation), so anything the fold does not cover can only lag, never end
up wrong.

The fold is a pure module (`displayed-state.ts`) that applies **only what an
event records**. It never works out what the rules would do:

- HP (`DamageDealtEvent`, `HpLostEvent`, `HealEvent`, `MaxHpReducedEvent`);
- card zones (`CardMovedEvent`, `CardsDrawnEvent`, `CardPlayedEvent`): a card
  leaves one zone and enters another, so hand counts, equipment, judgment
  areas and the Discard Pile follow;
- dying, saved and eliminated seats;
- revealed and hidden Generals;
- turn owner and phase.

The log itself is cut to the events already played, so the Action History
panel, the centre ribbon and the discard history show nothing the playback has
not reached yet.

Hidden information: the fold works on the viewer's redacted state and the
public log, so it can show no more than the board shows today.

### 4. What the techniques look like

As in the prototype, adapted to the real board:

- **Card flights:** from the source seat's tile, or from the viewer's hand view
  for the viewer's own cards, to the table centre, then to the Discard Pile.
  Draws fly face down from the Draw Pile. A card that moves to or from a hand is
  shown face down to everyone except the hand's owner, who sees its face only
  when their redacted state already shows it. Positions are read from the DOM
  (`data-seat-id` on the seat elements), not from the layout maths.
- **Target lines:** an SVG layer over the table, a curved arrow per target. A
  Dodge greys the line it answers.
- **Hit and heal effects:** as in the table above. A seat stays marked as dying
  until it is saved or eliminated.
- **Callouts:** a bubble above the tile for plays, passes, "Help!" and skill
  names. The words come from the i18n catalogs (English, plus Vietnamese drafts)
  and follow CLAUDE.md's casing rules.
- **Spotlight:** the turn owner glows. While a card is resolving, seats that are
  neither its source, a target nor the current responder are dimmed. The
  spotlight clears when the stack goes to the Discard Pile (the next play, turn or phase).
- **Caption and turn banner:** one large line above the centre for the current
  beat, in the Action History wording (reusing `actionHistory`), and a banner
  sweeping across when a turn begins. The existing step ribbon stays as the record.

### 5. Speed setting

Slow (×0.5), Normal (×1), Fast (×2) and Instant. It sits in the toolbar next to
the music toggle and is remembered in `localStorage`, like music. Instant
applies every beat's end state at once: the board behaves as it does today, but
in event order. Reduced motion (`prefers-reduced-motion`) means Instant unless
the player picks a speed.

### 6. Engine change: a logged pass

Today `PassAction` logs nothing, so there is no event for "Seat 5 had no Dodge".
Add one additive event, `ResponsePassedEvent { seatId, pendingResponseId,
allowedCardIds? }`, logged when a pending response is passed. It is public
(no card), serializable, and needs no change to bots or the protocol (the log
is already sent). Rules text is unaffected.

**Only for windows every seat is asked in** (my call): a pass is logged only
when the seat was asked whatever it holds, such as a Dodge against a Slash, a
Slash in a Duel or against Barbarians, or a Dodge against Hail of Arrows. The
engine asks a seat in a Wuxie check or a dying round only if it holds a
counter or rescue card, so a logged pass there would tell everyone that the
seat held one. Those passes stay unlogged. The Action History shows a line for
each logged pass ("Seat 5 had no Dodge").

**Games in progress keep running (user's decision).** The server runs the
engine and checks a state hash when it restores games by replaying their
actions, and the log is part of that hash. Logging passes in a game that
started without them would stop it as `outdated`. So the event sits behind a
rule in `state.rules` (for example `logPasses: true`), which every new game
turns on, local and online. A game restored without it replays exactly as
before and simply shows no pass callouts. (The rule flag is my call; any path
that keeps such games running works.) Add a server test that restores a game
saved before the change.

### 7. Waiting for playback

**Local (`GameService`):**
- `scheduleBotIfDue` starts its timer only when the director is idle. The
  director is presentation, so `GameService` must not import it. Instead it
  reads a small injected "presentation gate" (an injection token with an `idle`
  signal) that the board provides and that defaults to always idle (tests,
  the simulator, no board on screen).
- The bot's own delay after playback becomes 600 ms. At Instant speed it keeps
  today's 1500 ms, so Instant feels as it does now.
- The viewer's decision dialogs (`responseDue`, `choiceDue`, `selectionDue`,
  `arrangementDue`, `discardsDue`, the Start reveal) open only while the
  director is idle. `DecisionTimer` already pauses a decision that is not on
  screen, so the countdown starts when the dialog opens.
- The viewer's own Play Phase counts as a decision (my call): the hand, the
  action list, skill buttons and End Phase are disabled until the director is
  idle, and its countdown starts then. A card still flying can never be clicked.
- Board indicators (the "waiting for Seat X" line, bot thinking, a seat
  marked as responding) follow the displayed state, so they never get ahead
  of the playback.
- The judgment popup and the Compete popup open when playback reaches their
  event, and the director waits while they are open.
- In Pass and Play, the director does not play while the reveal gate is up.
  The gate rises after every move, so the visible state is null in between.
  Playback after a reveal must start from the state before the move, redacted
  for the newly revealed seat, never from a state redacted for someone else.
  `GameService` keeps the full state from before each move for this.
- **Pass and Play replays only the last move (user's decision):** after a
  reveal, the director plays the events of the last submit (one `resolve`
  call), starting from the state before it, redacted for the revealed seat.
  Anything earlier is already part of that starting state.

**Online (`RemoteGameService`):**
- Nothing waits on the server. The server clock runs as it does now.
- **Rush:** when the viewer owes a decision and the queue is not empty, the
  remaining beats play fast enough to finish in about one second.
- **Cap:** when the queued beats add up to more than about 4 s at the chosen
  speed, the director speeds up until they are back under it.
- Decision dialogs still open when playback is idle, which the rush ensures
  happens quickly. The viewer's own Play Phase counts as a decision for the rush.
- The Compete popup (about 9 s with its countdown, and no skip) does not hold
  the queue online (my call). Playback goes on behind it, and when the viewer
  owes a decision the popup closes early. The judgment popup is an engine
  pause, so it already holds every client. When a rush is due, its own beats
  run at the rush speed.

**Game Over:** the window opens when the director is idle, after the last
elimination has played.

## Constraints

- CLAUDE.md layering: no rules in components. The fold and the beat registry
  only replay facts recorded in the log.
- The board is shared by the local and online screens (`OnlineGame` wraps
  `GameBoard`), so this one change serves both.
- Visible text goes through the i18n catalogs, in English and Vietnamese
  (Vietnamese starts as a draft), with CLAUDE.md's casing rules.
- 12 seats: flights and lines must stay readable on a crowded table.
- `npm run verify` and the tests pass. The pure modules (beat plan, fold,
  catch-up maths) and the director under fake timers are unit-tested, without TestBed where possible.
- Update `docs/architecture/frontend.md` ("Events become presentation") and
  `event-chain.md`, which needs a line for the new event.

## Left to the builder

- Exact visuals, easing and the final durations (tune against the prototype).
- How flights are rendered (a single overlay layer with the Web Animations API
  is suggested).
- The rush and cap maths, within the behaviour above.
- Where the speed control sits in the toolbar menu, and its icon.
- How the director is wired into the board, as long as `GameService` only sees
  the injected gate.

## Calls made without the user (check these)

- Passes get a new engine event (section 6), not inference from state, and
  only for windows every seat is asked in.
- The pass event sits behind a `logPasses` rule that new games turn on, so restored games replay unchanged.
- The viewer's own Play Phase is locked until playback is idle, and it counts as
  a decision for the online rush.
- Waiting and thinking indicators follow the displayed state.
- Online, the Compete popup does not hold the queue, and it closes early when the viewer owes a decision.
- The fold takes a General's identity from the final visible state, and does not count
  a played card's move twice (`CardPlayedEvent` and its `CardMovedEvent`).
- The displayed state reconciles to the real state at the end of each queue.
- Sounds and voices move onto their beats.
- The Action History and ribbon show only what playback has reached.
- The bot delay after playback is 600 ms, and 1500 ms at Instant.
- Reduced motion means Instant.
- Joining or reloading plays nothing old.
