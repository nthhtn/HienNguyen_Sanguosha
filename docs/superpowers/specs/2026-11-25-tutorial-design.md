# Tutorial design

A guided Tutorial for beginners: Short lessons on the real game board, with a spotlight on one control at a time.

## Intent

- **Who.** A person who has never played Sanguosha (or Guozhan).
- **Why.**
  - The Wiki explains the rules, but a beginner cannot try them there.
  - The board has many controls, and a beginner does not know which one to press.
- **What success looks like.**
  - After the Tutorial, a beginner can start a Play vs Bots game and take a turn without help.
  - They know their Generals, their Force and what Allegiance means.
  - They know the turn phases and which button ends the Play Phase.
  - They can attack with Sha, answer with Shan, and recover HP with Tao.
  - They know where the hand, the action buttons, the discard pile and the Action History are.

## Goals

- **Real board.** Lessons run on the real board (`GameBoard`, and `PhoneBoard` on phones), so what a beginner learns transfers.
- **Spotlight and instruction.** Each step dims the screen, circles one control and shows a short instruction beside it.
- **Rail.** In this first version the board is locked: Only the highlighted control works.
- **Five lessons.** Each is short and playable on its own:
  1. **Your Generals:** Main and Deputy General, HP, skills, the hand, and how to read a General.
  2. **Allegiance:** Force, hidden Generals, revealing, and how a Force wins.
  3. **Turn structure:** The six phases, the Play Phase waiting for you, the End Phase button, and discarding to the hand limit.
  4. **Sha and Shan:** Attack a bot (it plays Shan), then a bot attacks you and you answer with Shan from the response dialog.
  5. **Damage and recovery:** A Sha that is not answered removes 1 HP, then Tao recovers it.
- **Both languages.** Every instruction is a catalog key in English and Vietnamese.
- **Phones.** The Tutorial works on the phone board.

## Non-goals

- **Free play with hints.** Deferred, see `docs/deferrals.md` ("Tutorial: free play with hints").
- **Other content.** No lessons on Tools, Equipment, Delayed Tools, Judgment, Compete, Wuxie or Chains. The Wiki covers them.
- **Online and Pass and Play.** The Tutorial is offline, one human against bots.
- **Engine changes.** The Tutorial adds no rule and changes none.
- **Video.** No recorded clips.

## Anti-goals

- **Wrong rules.** A lesson that teaches something the engine does not do is a failure. Lessons must run headlessly against the real engine in tests.
- **A trap.** A beginner who cannot get out, or who gets stuck on a step the engine will not let them finish, is a failure. Exit is always available.
- **Rules in the UI.** The Tutorial decides what to highlight and what to allow. It never decides what is legal: That stays the engine's job (CLAUDE.md).

## Constraints

- **Layering.** Lesson data and scripted bot moves live outside the engine and content projects. The engine is not touched.
- **No dev code in production.** The `/preview` scenarios and `dev/recipe.ts` are dev-only (the production build empties the dev routes). Lessons need their own production copy of the state-building helpers.
- **The board is shared.** `GameBoard` injects the root `GameService` and is also the local `/game` screen. The Tutorial gets its own `/tutorial` route and leaves `/game` and Setup alone.
- **Bots decide in `GameService`.** `runBot` calls the rule-based policy and waits for playback plus 1.5 s. Scripted bot replies need a seam there.
- **No anchors exist yet.** The board templates have no `data-testid` or other stable hooks, and the phone board is a separate component.
- **UI text style** (CLAUDE.md). Instructions are sentences, so sentence case with keywords capitalised ("Click Sha to attack Seat 1"). Buttons and titles are Title Case ("Next", "Exit Tutorial"). Vietnamese is sentence case everywhere and starts as a draft.
- **Docs style.** The finished feature gets a section in `docs/architecture/frontend.md`.

## Approaches

- **A. Overlay on the real board, driven by scripted lessons (chosen).**
  - A lesson is data: A state recipe plus ordered steps.
  - A `TutorialService` runs the lesson on the real board and adds a spotlight layer and an action filter.
  - Trade-off: The board needs stable anchors, which is the main new coupling.
- **B. A separate mock board.** Easy to control, but it drifts from the real board and a beginner learns the board twice. Rejected.
- **C. Pre-recorded walkthrough.** Cheap, but nobody presses a real button, which misses the goal. Rejected.

## Design

### Lesson data

- **Lesson.** `id`, a title key, a `build(registry)` recipe returning a `GameState`, and ordered `steps`.
- **Step.** A text key, an optional `target` anchor id, and a `completes` rule:
  - `next`: The beginner presses Next (explanation steps).
  - `action`: A predicate over the submitted `Action`, such as "a Sha card played at seat-1".
  - `state`: A predicate over the new `GameState`, such as "phase is Discard".
- **Allowed actions.** An `action` step names the action(s) the filter lets through. Anything else is refused.
- **Scripted bots.** A step may give a bot's reply as data (for example, "seat-1 plays Shan"), so a lesson never depends on the rule-based policy.
- **Pure and testable.** Lessons, rules and scripts are plain data and functions, so a spec can play each lesson headlessly with the real engine and fail, naming the step, if a step cannot be completed.

### The rail

- **Two layers, both needed.**
  1. **Overlay:** A dim layer with a hole over the target. Clicks outside the hole are caught by the layer, and the click inside reaches the real control.
  2. **Action filter:** `GameService` refuses an action the current step does not allow. This also covers the keyboard and anything the overlay misses.
- **Anchors.** A small directive puts a stable `data-tutorial` id on board elements: The hand and its cards, the action buttons, the End Phase button, the seat tiles, the General pictures, the HP, the discard pile, the Action History, the phase indicator, and the buttons in the response and start dialogs. The spotlight finds the element by that id and follows it when the layout changes.
- **Dialogs.** The response dialog and the Start popup open in an overlay layer above the board. The spotlight layer must sit above them and still let the target through.
- **Playback.** A step completes when its state change is reached and the board's playback has caught up (`PlaybackGate`), so an instruction never appears over a running animation.

### Lessons in outline

- **1. Your Generals.**
  - Spotlight: The viewer's seat tile (two Generals), then HP, then the skill list, then the hand.
  - Press the General to open its info dialog, then close it.
- **2. Allegiance.**
  - Spotlight: The Force shown on the seat tile, the hidden Generals of the bots, and the Start popup where the beginner reveals a General.
  - Then explain, in a Next step, that when only one Force remains, it wins.
- **3. Turn structure.**
  - The lesson starts at the beginning of the beginner's turn. The Start, Judgment and Draw phases pass by themselves while the phase indicator is spotlighted.
  - The Play Phase waits: Spotlight the End Phase button.
  - The Discard Phase: The beginner holds more cards than their HP and discards down, with the discard pile spotlighted.
- **4. Sha and Shan.**
  - The beginner plays Sha on a bot. The bot's scripted reply is Shan, so nothing happens.
  - Then a bot plays Sha on the beginner. The response dialog opens and the beginner plays Shan.
  - Spotlight: The hand card, the target choice, the response dialog, and the Action History line.
- **5. Damage and recovery.**
  - A Sha is not answered and the HP drops. Spotlight the HP.
  - The beginner then plays Tao to recover, and sees the HP rise.
- **Board tour woven through.** The hand, action buttons, discard pile and Action History each get a spotlight in the first lesson that uses them.
- **Exact step wording.** Each step's text uses the Rules page wording (`rules.turn.*`, `rules.response.*`, `rules.damage.*`, `rules.overview.*`) so the Wiki and the Tutorial never disagree.

### Entry, exit and progress

- **Entry.** A "Tutorial" link in the toolbar and on Home, and a `/tutorial` route (lazy, behind `offlineOnly`). It lists the five lessons and a Start button for each.
- **Order.** Lessons can be played in any order. "Next Lesson" is offered at the end of each.
- **Exit.** An "Exit Tutorial" button is on screen at every step and never asks for confirmation. Leaving discards the Tutorial game.
- **Progress.** Which lessons were completed is remembered in the browser (`localStorage`, in `try/catch`, and the page works without it). It only marks lessons done in the list.
- **Local game in progress.** A lesson replaces the `GameService` game. If a local game is in progress, the Start button warns that it will be lost and asks first. The earlier game is not restored. When a lesson ends or is exited, the Tutorial game is discarded so `/play` does not offer it as a game in progress.

### Layers

- **Engine, content, protocol, server.** Unchanged.
- **App.**
  - New `projects/app/src/app/tutorial/`: Lesson data, step rules, `TutorialService`, the spotlight overlay component, the lesson list page and a state-building helper module (production copy of what the dev recipes need).
  - Small changes: `GameService` gets a scripted-bot seam and an action filter, both off by default; board templates get inert anchor attributes; the toolbar, Home and the routes get a link; the catalogs get the `tutorial.*` keys.

## Testing

- **Lessons run headlessly.** A spec builds each lesson and plays its steps with the real engine and the scripted bots, failing with the step id if a step cannot complete (same idea as `scenarios.spec.ts`).
- **Every key exists.** A catalog spec checks each step's text key in English and Vietnamese.
- **Overlay.** Component specs check the hole follows its anchor and that a click outside the hole does not reach the board.
- **Filter.** `GameService` specs check a refused action leaves the state unchanged and the filter is off by default.
- **Browser check.** A manual look at desktop and phone widths is still needed, as the overlay depends on layout.

## Left to the builder

- **Seed and hands.** The exact seed, General pairs and hands for each lesson.
- **Step wording.** The text of each step, within the style rules above.
- **Anchor ids and names.** The id scheme, and how the spotlight shape (circle or rounded box) is drawn per target size.
- **Phone details.** How the instruction card sits on the phone board's small screen.
- **Vietnamese text.** Drafted with the glossary in the Vietnamese localization spec.

## Decisions from the review

- **Scripted bots (builder-check call).**
  - **Scope:** Scripting covers only the bot decisions a lesson needs: A reply to the beginner (Shan, or no response) and, in lessons 4 and 5, the bot's own Sha. Phases that pass by themselves (Start, Judgment, Draw) are the engine's, not scripted.
  - **Mechanism:** A per-seat queue of actions that the bots consume. When a seat's queue is empty, that bot waits; it does not fall back to the rule-based policy. The next step sets up its own queue.
  - **Starting position:** A lesson's recipe starts the state where the lesson needs it, such as a bot's Play Phase for the bot attacking the beginner, so no turn has to be played through first.
  - **Timers:** The decision clocks are off during a lesson, so a timeout never submits an action.
- **Phones (builder-check call).**
  - **Where it runs:** `/tutorial` is playable wherever the board is (`Layout.canPlay`), with the existing prompts elsewhere. `Layout` is not changed, so a small browser tab shows the existing install or rotate prompt.
  - **Steps:** One lesson script. A step may give a phone variant (its own target, and text where the board differs). On the phone board this covers: Skills and General details inside Seat Details, the slim HP tile, and tapping a hand card and then pressing Play.
- **Allegiance start (checked against the engine).**
  - **Rule:** At the start of your own turn a window lists your hidden Generals and you may reveal any or none (`rules.setup.reveal1`). The engine already supports this, so no engine change is needed.
  - **Recipe:** The lesson starts at the beginner's Start decision, with the window as a real pending decision. The Force is shown on the seat tile only after the reveal.
- **Step wording (builder-check call).** Steps use new short `tutorial.*` keys that condense the Rules pages, each noting the Rules page it condenses. Nothing forces them to follow a later Rules change, so a Rules edit means checking the matching steps.
- **Exit and the earlier game.** See "Entry, exit and progress": No confirmation on exit, a warning before the earlier game is replaced, and no restore.
