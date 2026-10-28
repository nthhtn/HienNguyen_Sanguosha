# Deck Choice (Identity / Kingdom Wars) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The host picks a card distribution, Identity or Kingdom Wars, with one radio group in every Game Setup screen (local Setup, online Create Room, online Play vs Bots, and the lobby), and the game is dealt from it.

**Architecture:** A deck is only a distribution: `{ id, entries: [{ cardId, printings }] }`. Card behaviour and card data stay per card, keyed by id. The chosen deck id travels as `GameRules.deck` (stored on the game state, so it survives saving and replay), and Guozhan's `buildDeckSpec` reads that deck instead of reading card data directly. Identity is built from the existing card data (no migration); Kingdom Wars is the crawler's `deck.json`. Entries for cards the registry has no definition for are left out of the deal.

**Tech Stack:** TypeScript (engine, content, protocol, server, Angular app), Jest, TypeBox, Angular Material, Python 3 (crawler).

**Spec:** `docs/superpowers/specs/2026-10-20-kingdom-wars-deck-crawl-design.md` (data and crawler). The structure for engine reuse was agreed in conversation on 2026-10-21 and is recorded in the "Deck structure" section added to that spec in Task 1.

## Global Constraints

- CLAUDE.md layering: the engine and content know nothing of Angular; the UI asks, it does not decide rules. The deck is chosen by data (`GameRules.deck`), never by an `if (deck === 'kingdomWars')` inside a card's behaviour.
- UI text: Title Case for labels, sentence case for hints (CLAUDE.md "UI text style"). English: "Deck", "Identity", "Kingdom Wars". Vietnamese: sentence case, new text is a draft (do not touch `review.json`).
- Identity must behave exactly as today: `GameRules.deck` absent means Identity, and the Identity deck is still 141 cards (`guozhan.spec.ts`).
- Do not edit Identity's card data files under `projects/content/data/cards/`.
- The user explicitly asked for the radio group in the local Setup screen too; this overrides the earlier "keep Play and Game screens as-is" note for this feature only. Change nothing else on those screens.
- Commits: end messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Work is on branch `feat/kingdom-wars-deck-crawl`.

## Review Focus

- **A game or room saved before this change (no `deck` in its rules):** deals Identity, unchanged. Test in Task 2.
- **An unknown deck id reaches the engine** (tampered client): `createGame` throws `Unknown deck "x"`; the server's schema refuses it before that. Tests in Tasks 2 and 3.
- **Kingdom Wars lists cards the game cannot play yet** (7 cards, 10 printings): none of them appear in the draw pile, and a whole bot game finishes. Test in Task 2.
- **Host changes the seat count below 5 in the lobby:** the deck is kept (only First Reveal Bonus is dropped). Test in Task 3.
- **A non-host in the lobby:** sees the deck but cannot change it. Test in Task 5.

---

### Task 1: Crawler writes `deck.json` and uses `ids.json`

**Files:**
- Modify: `scripts/crawl-kingdom-wars-deck.py`, `scripts/test_crawl_kingdom_wars_deck.py`
- Create: `projects/content/data/decks/kingdom-wars/ids.json` (hand-kept), generated `deck.json`
- Modify: `docs/superpowers/specs/2026-10-20-kingdom-wars-deck-crawl-design.md`

**Interfaces:**
- Produces `projects/content/data/decks/kingdom-wars/deck.json`:
  `{ "id": "kingdomWars", "entries": [ { "cardId": string, "printings": [ { "suit": "spade"|"heart"|"club"|"diamond", "rank": 1-13 } ] } ] }`, in page order.
- `ids.json`: `{ "<nameZh>": { "id": "<kebab-case card id>", "name": "<English name>" } }`, for cards Identity does not have. The six entries, my calls: 无懈可击•国 → `wuxie-guo` "Wuxie Kingdom"; 以逸待劳 → `amass` "Amass"; 知己知彼 → `ascertain` "Ascertain"; 远交近攻 → `ally-far-attack-near` "Ally Far Attack Near"; 吴六剑 → `wu-six-swords` "Wu Six Swords"; 三尖两刃刀 → `trident-glaive` "Trident Glaive".
- `cards.json` records gain `cardId` (the Identity id, else the `ids.json` id) next to `identityCardId`.

- [ ] **Step 1: Failing tests** in `test_crawl_kingdom_wars_deck.py`: `deck_entries(cards, ids)` returns entries whose `cardId` is the Identity id when matched (青釭剑 → `black-pommel`), the `ids.json` id when not (吴六剑 → `wu-six-swords`), and raises `CardError` naming the card when neither exists. Another test: the entry's printings equal the card's `printings`.
- [ ] **Step 2:** Run `python3 -m unittest discover -s scripts -p 'test_*.py'`; expect the new tests to fail (function missing).
- [ ] **Step 3:** Implement `deck_entries(cards: list[dict], ids: dict) -> list[dict]` in the crawler, load `ids.json` from the output folder, write `deck.json`, and treat an unmapped card as a skipped card (non-zero exit, like any other). Create `ids.json` with the six entries above.
- [ ] **Step 4:** Run the unit tests (pass) and `python3 scripts/crawl-kingdom-wars-deck.py` (exit 0, `deck.json` has 45 entries, 108 printings in all).
- [ ] **Step 5:** Add a "Deck structure" section to the spec: the deck shape above, that Kingdom Wars' `deck.json` is generated, that `ids.json` is the only hand-kept file, and that adding a card is (1) an `ids.json` line, (2) the card's data file, (3) its behaviour file plus one registry line.
- [ ] **Step 6: Commit** `feat(content): Kingdom Wars deck.json and card ids from the crawl`.

---

### Task 2: Engine rule, content decks, dealing from the chosen deck

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (`GameRules`), `projects/content/src/lib/modes/guozhan.ts` (`buildDeckSpec`, its call in `setup`), `projects/content/src/public-api.ts`
- Create: `projects/content/src/lib/decks.ts`, `projects/content/src/lib/decks.spec.ts`
- Test: `projects/content/src/lib/modes/guozhan.spec.ts`, `projects/sim/src/runGame.spec.ts`

**Interfaces:**
- Produces (`decks.ts`, exported from content's public API):
  ```ts
  export const DECK_IDS = ['identity', 'kingdomWars'] as const;
  export type DeckId = (typeof DECK_IDS)[number];
  export interface DeckEntry { cardId: string; printings: { suit: CardPrinting['suit']; rank: number }[] }
  export interface DeckDefinition { id: DeckId; entries: DeckEntry[] }
  export function deckFor(deckId: string | undefined): DeckDefinition; // undefined is 'identity'; unknown throws Error(`Unknown deck "${id}"`)
  export function undealtCardIds(deck: DeckDefinition, registry: ContentRegistry): string[]; // entries with no definition in the registry
  ```
- Produces: `GameRules.deck?: string` with a comment (the distribution the draw pile is dealt from; absent means Identity).
- `deckFor('identity')` is built from `cardsData`: one entry per card id with that card's printings that carry no `expansion` tag. `deckFor('kingdomWars')` is `data/decks/kingdom-wars/deck.json`.

- [ ] **Step 1: Failing tests** in `decks.spec.ts`: `deckFor(undefined)` equals `deckFor('identity')`; `deckFor('nope')` throws `Unknown deck "nope"`; Identity has an entry for every card in `buildContentRegistry()` that is not `outOfDeck`; `undealtCardIds(deckFor('kingdomWars'), registry)` equals exactly `['wuxie-guo','amass','ascertain','ally-far-attack-near','wu-six-swords','trident-glaive','fire-fan']` (Fire Fan has data but no definition: elemental cards stay out) (sorted compare); every Kingdom Wars entry's printings are valid suits and ranks 1-13.
- [ ] **Step 2: Failing tests** in `guozhan.spec.ts`: (a) the existing 141-card test still passes untouched, and a game created with `rules: {}` and one with `{ deck: 'identity' }` deal the same cards; (b) `createGame(guozhanMode, registry, seats, 1, { deck: 'kingdomWars' })` deals exactly 98 cards, none of them one of the seven undealt ids, with 21 `sha`, 14 `shan`, 8 `peach`; (c) `{ deck: 'bogus' }` throws `Unknown deck "bogus"`; (d) the state's `rules.deck` is `'kingdomWars'` and the state survives `JSON.parse(JSON.stringify(state))`.
- [ ] **Step 3:** Run `npx jest projects/content`; expect these to fail.
- [ ] **Step 4:** Implement `decks.ts`; change `buildDeckSpec(registry, deck: DeckDefinition)` to deal each entry whose card is in the registry and not `outOfDeck`, keeping the old guard: an entry with zero printings for a registry card throws `Card "<id>" has no printings in the data, so it cannot be put in the deck`. `setup` calls `deckFor(rules?.deck)`. Add the `GameRules.deck` field.
- [ ] **Step 5:** In `projects/sim/src/runGame.spec.ts` add a test: a 4-seat game with `{ deck: 'kingdomWars' }` and rule-based bots runs to a non-null `result`.
- [ ] **Step 6:** Run `npx jest projects/content projects/sim projects/engine`; all pass.
- [ ] **Step 7: Commit** `feat(content): deal the draw pile from the chosen deck`.

---

### Task 3: Protocol and server carry `deck`

**Files:**
- Modify: `projects/protocol/src/schemas/rooms.ts`, `projects/server/src/rooms/roomService.ts` (`rulesFrom`)
- Test: `projects/protocol/src/schemas/*.spec.ts` (the rooms schema spec), `projects/server/src/rooms/roomGames.spec.ts` (or the nearest room service spec)

**Interfaces:**
- Produces in protocol: `export const DECK_IDS = ['identity', 'kingdomWars'] as const` and `RoomRulesSchema` gaining `deck: Type.Optional(Type.Union([Type.Literal('identity'), Type.Literal('kingdomWars')]))` (still `additionalProperties: false`).
- `rulesFrom(rules, seatCount)` keeps `deck` when it is `'kingdomWars'` at any seat count and drops it when it is `'identity'` or absent (stored rules stay as they are today for Identity); First Reveal Bonus handling is unchanged.

- [ ] **Step 1: Failing tests:** the schema accepts `{deck:'kingdomWars'}` and `{deck:'identity'}` and refuses `{deck:'bogus'}`; creating a room with `rules: {deck:'kingdomWars'}` at 4 seats stores `{deck:'kingdomWars'}`; `setRules` to a 3-seat table keeps `deck:'kingdomWars'` and drops `firstRevealDraw`; a game started from that room has `state.rules.deck === 'kingdomWars'`; the protocol's `DECK_IDS` equals content's `DECK_IDS` (one test in the server project, which sees both).
- [ ] **Step 2:** Run `npx jest --selectProjects server` (and the protocol project); expect failures.
- [ ] **Step 3:** Implement the schema field and `rulesFrom`.
- [ ] **Step 4:** Run the same, plus `npm run typecheck:server`; all pass. (Postgres storage is `jsonb`, so no migration.)
- [ ] **Step 5: Commit** `feat(server): rooms carry the deck rule`.

---

### Task 4: `DeckPicker` and the local Setup screen

**Files:**
- Create: `projects/app/src/app/deck-picker.ts`, `projects/app/src/app/deck-picker.spec.ts`
- Modify: `projects/app/src/app/setup/setup.ts`, `projects/app/src/app/setup/setup.spec.ts`, `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`

**Interfaces:**
- Produces `DeckPicker`: standalone component, selector `app-deck-picker`, `value = model<DeckId>('identity')`, `disabled = input(false)`, optional `labelledBy = input<string>()`. It renders a `mat-radio-group` with the label "Deck" (`setup.deck`), one `mat-radio-button` per id in `DECK_IDS` labelled by `setup.deck.<id>`, and the hint `setup.deck.hint`. The component owns the options list, so adding a deck later is one line plus catalog keys.
- i18n keys (en / vi draft): `setup.deck` "Deck" / "Bộ bài"; `setup.deck.identity` "Identity" / "Mặc định"; `setup.deck.kingdomWars` "Kingdom Wars" / "Thay thế"; `setup.deck.hint` "Which card distribution the game is dealt from." / "Cách chia bài mà ván chơi dùng."; `lobby.deckSummary` "Deck: {deck}" / "Bộ bài: {deck}".
- Setup passes `rules` = `{ ...(deck !== 'identity' ? { deck } : {}), ...(seats >= FIRST_REVEAL_MIN_SEATS ? { firstRevealDraw } : {}) }`, or `undefined` when empty, so the Identity call is exactly as it is today.

- [ ] **Step 1: Failing tests:** in `deck-picker.spec.ts`, it renders two radios named "Identity" and "Kingdom Wars" with Identity selected, clicking Kingdom Wars updates `value`, and `disabled` disables both. In `setup.spec.ts`: Start with the default choice calls `startGame` with the same arguments as today (`rules` `undefined` at 4 seats); choosing Kingdom Wars then Start passes `{ deck: 'kingdomWars' }` at 4 seats and `{ deck: 'kingdomWars', firstRevealDraw: true }` at 5; the radio group shows at every seat count and in both modes. In `setup.vi.spec.ts` (or the catalog parity spec that already exists) the Vietnamese catalog has every new key.
- [ ] **Step 2:** Run `npx jest projects/app/src/app/deck-picker projects/app/src/app/setup`; expect failures.
- [ ] **Step 3:** Implement `DeckPicker`, add the keys to both catalogs, use the picker in `setup.ts` after the Seats field, add the `deck` signal and the rules composition.
- [ ] **Step 4:** Run `npx jest projects/app` for the touched specs plus the catalog and label specs; all pass. Run `npm run i18n:status` and confirm the new Vietnamese keys show as draft, nothing else changed.
- [ ] **Step 5: Commit** `feat(app): deck radio group in the local Setup screen`.

---

### Task 5: Online screens

**Files:**
- Modify: `projects/app/src/app/online/create-room-dialog.ts`, `play-vs-bots-dialog.ts`, `lobby-page.ts` and their specs, `projects/app/src/app/online/testing.ts` if the fixture needs a `deck`

**Interfaces:**
- Consumes: `DeckPicker` and the `lobby.deckSummary` key from Task 4; `RoomRulesSchema.deck` from Task 3.
- Create Room and Play vs Bots send `rules` composed exactly as in Task 4 (deck only when not Identity; First Reveal Bonus as today).
- Lobby: the host sees a `DeckPicker` that calls `lobby.setRules(room.seatCount, { ...room.rules, deck })`, disabled when `!lobby.canAct()`; `rulesSummary` shows the deck for everyone ("Deck: Identity" when absent) and a refused change restores the control, like First Reveal Bonus does today.

- [ ] **Step 1: Failing tests,** in each spec's existing style: Create Room and Play vs Bots show the radio group, send `rules: { deck: 'kingdomWars' }` after choosing it, and send the same body as today for Identity; the lobby shows the picker to the host, calls `setRules` with the new deck and keeps `firstRevealDraw`; a non-host sees no picker and the summary reads "Deck: Kingdom Wars"; a refused change puts the picker back to the server's value.
- [ ] **Step 2:** Run `npx jest projects/app/src/app/online`; expect failures.
- [ ] **Step 3:** Implement the three screens; update any existing summary expectations to include the deck part.
- [ ] **Step 4:** Run `npx jest` for the whole workspace and `npm run typecheck:server`; all pass (report any failure that existed before this branch separately; the notes record a known `game-board.spec.ts` type error).
- [ ] **Step 5:** Start the app (`npm start`), open Setup, choose Kingdom Wars, start a Pass and Play game and confirm the draw pile count is 98 and no card named Wu Six Swords, Trident Glaive, Amass, Ascertain, Ally Far Attack Near, Wuxie Kingdom, or Fire Fan can appear. Say what was and was not checked in a browser.
- [ ] **Step 6: Commit** `feat(app): deck radio group in the online screens`.

---

## Self-review

- **Coverage:** the radio group in every setup screen (Tasks 4, 5), carried to the engine through rules (Tasks 2, 3), Kingdom Wars data and ids (Task 1), Identity unchanged (Task 2 tests), Vietnamese catalog (Task 4).
- **Consistency:** `DECK_IDS`, `DeckId`, `deckFor`, `GameRules.deck`, `DeckPicker` and `lobby.deckSummary` are named the same wherever they appear.
- **Left to the implementer:** the picker's layout and styling, the exact test harness and helper names in each existing spec, and CSS.
