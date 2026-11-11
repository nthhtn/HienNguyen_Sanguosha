# Resolution Notice, Picker Portraits and Target Labels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give card effects with a visible outcome a shared fading Resolution Notice, show portraits in the seat and General pickers, and split the target label into name and Generals.

**Architecture:** The notice is data, not a component per card: `content` holds a registry keyed by card or skill id whose `describe` turns one resolution's log events into structured notice content (i18n keys plus params). The app's `PlaybackDirector` finds the end of each resolution while it plays beats and publishes the notice; a `ResolutionNotice` component renders it and fades it on its own timer, without holding playback. The pickers and target label are presentation-only changes.

**Tech Stack:** Angular (standalone components, signals), Angular Material dialogs, Jest, the `engine` / `content` / `protocol` projects.

**Spec:** `docs/superpowers/specs/2026-11-09-resolution-notice-and-pickers-design.md` (Appendix A has the reference text; the mockups are at https://claude.ai/artifact/1csFRXU5QCd4NrpaM2o2XX).

## Global Constraints

- Engine knows nothing about notices; no rule change. A small additive event field is allowed only if the log lacks a fact a notice needs.
- The notice never blocks: no `PlaybackDirector.hold()`, no button, no input. It fades on its own timer and queues if two overlap.
- Tone is from the source seat's side, identical for every viewer. A hidden card shows as a card back to seats that did not take part.
- No notice for: Sha, Wuxie, Peach Garden, Chains, Duel, Barbarians, Hail of Arrows, saving, anything that opens the Judgment popup, seat elimination, or skills other than Resurgence. Wuxie-cancelled resolutions get none.
- Adding a notice later is a data-only change (one registry entry plus i18n keys).
- Target label variant B: name bold in the text colour, " · ", revealed Generals in the force colour joined by " / ", a face-down General left out, targets joined by ", ".
- A hidden General in a picker shows `HIDDEN_GENERAL_ART_URL` (the card back). The game-start General selection is not changed. The two-target Sha picker keeps its flow.
- UI text follows CLAUDE.md casing (Title Case labels, sentence case sentences, keywords capitalised) in English and Vietnamese; every new string has `en.ts` and `vi.ts` keys.
- Respect reduced motion. Works in Pass and Play, online and phone landscape.
- Components only render and dispatch; wording and outcomes come from `content` and the application layer.
- Final gate: `npm run verify` and `npm test` pass.

## Review Focus

- Steal or Break from a hand seen by a third seat: the notice shows a card back, not the card. (Task 9)
- Two resolutions finishing in one batch: both notices show in order, none dropped. (Task 7)
- Late join, reconnect or Pass and Play reveal replays the last move: old notices do not pop up for events that were not played live. (Task 7)
- A Blaze whose target had no card of the suit, or a Harvest with a seat eliminated midway: the notice still has a sensible outcome. (Tasks 9, 10)
- A seat with both Generals hidden, or a name wider than the card on phone landscape: labels wrap, nothing overflows. (Tasks 1, 8)
- A Wuxie-cancelled Break shows no notice. (Task 9)

---

### Task 1: Target label variant B

**Files:**
- Modify: `projects/app/src/app/game-board/target-label.ts`
- Test: `projects/app/src/app/game-board/target-label.spec.ts`

**Interfaces:**
- Produces: `TargetLabel` renders `<span class="target"><span class="name">Name</span>[ · <span class="generals" data-force="…">Main / Deputy</span>]</span>`; inputs unchanged (`label`, `prefix`, `targets`, `state`).

- [ ] **Step 1: Update `target-label.spec.ts`.** Replace the expectations to the new text: hidden kingdom `el.textContent` is `'Targeting Hing'` with no `.generals`; revealed `seat-2` is `'Targeting Bot · Cao Cao / Sima Yi'` and `.generals` has `data-force="wei"`; `seat-3` (Deputy face down) is `'… · Liu Bei'`; two targets read `'Targeting Hing, Bot · Cao Cao / Sima Yi'`. Assert `.name` has no `data-force` attribute.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board/target-label.spec.ts` — expect FAIL.
- [ ] **Step 3: Change `TargetPart` to `{ sep: string; name: string; generals: string; force: … | null }`** and the template to render the name span, then, only when `generals` is non-empty, `" · "` and the generals span carrying `[attr.data-force]="part.force"`. Keep the Generals filter (revealed only) and join with `' / '`. Style `.name { font-weight: 700 }`, `.generals[data-force] { color: var(--force-text) }`; allow the label to wrap.
- [ ] **Step 4: Run the spec** — expect PASS. Run `npx jest projects/app/src/app/game-board` — fix any other spec that asserted the old text.
- [ ] **Step 5: Commit** `feat(ui): split target labels into name and Generals`.

### Task 2: Seat portrait component

**Files:**
- Create: `projects/app/src/app/game-board/seat-portrait.ts`, `seat-portrait.spec.ts`

**Interfaces:**
- Produces: standalone `SeatPortrait` (`selector: 'app-seat-portrait'`) with inputs `generals = input<SeatGenerals | null>(null)` and `size = input<'small' | 'medium'>('medium')`. Renders Main left and Deputy right as plain images (no buttons): `generalSkinUrl(id)` for a shown General, `HIDDEN_GENERAL_ART_URL` for `'hidden'`, a card back when `generals` is null. The border takes `--force` from the enclosing element.
- Consumes: `generalSkinUrl`, `HIDDEN_GENERAL_ART_URL` from `content`; the split layout of `seat-avatar.ts` as the visual reference (do not reuse it: it nests buttons).

- [ ] **Step 1: Write `seat-portrait.spec.ts`:** a seat with Cao Cao and a hidden Deputy renders two `img` elements, the first with `src` `generalSkinUrl('cao-cao')`, the second `HIDDEN_GENERAL_ART_URL`; `generals: null` renders two card backs; the host has no `button`.
- [ ] **Step 2: Run it** — FAIL (missing component).
- [ ] **Step 3: Implement `SeatPortrait`**; a failed image falls back to the hidden art like `SeatAvatar`'s `failedUrls`.
- [ ] **Step 4: Run it** — PASS. **Step 5: Commit** `feat(ui): seat portrait component for pickers`.

### Task 3: Portraits in the Choice dialog

**Files:**
- Modify: `choice-dialog.ts`, `choice-description.ts` (all in `projects/app/src/app/game-board/`), specs `choice-dialog.spec.ts`, `choice-description.spec.ts`

**Interfaces:**
- Consumes: `SeatPortrait` (Task 2).
- Produces: `ChoiceDialogOption` gains `generals?: SeatGenerals | null` (set for a seat option). A General option (`generalId`) whose id is `'hidden'` shows `HIDDEN_GENERAL_ART_URL`.

- [ ] **Step 1: Failing specs.** `choice-description.spec.ts`: a `shows.kind === 'seat'` option carries that seat's `generals` and its `force`. `choice-dialog.spec.ts`: a seat option renders `app-seat-portrait` and no `.swatch`; its `aria-label` is still the seat name; a hidden General option's image is the hidden art.
- [ ] **Step 2: Run both** — FAIL.
- [ ] **Step 3: In `choice-description.ts` set `generals` where the option list is built for seat options** (grep `kind === 'seat'`); **in `choice-dialog.ts` replace the `.swatch` with `<app-seat-portrait [generals]="option.generals ?? null">`**, keep the force-coloured border via the existing `--force` rules, and map `'hidden'` ids to the hidden art.
- [ ] **Step 4: Run both** — PASS. **Step 5: Commit** `feat(ui): portraits for seat and General choices`.

### Task 4: Portraits in the Selection panel and the targets dialog

**Files:**
- Modify: `ability-description.ts` (`SelectionItem`), `selection-panel.ts`, `targets-dialog.ts`, and their specs, all in `projects/app/src/app/game-board/`

**Interfaces:**
- Produces: `SelectionItem` gains `generals?: SeatGenerals | null` and `force?: Force`; seat items set both.

- [ ] **Step 1: Failing specs:** `selection-panel` renders a portrait above the seat name for a seat item and none for a card item; `ability-description.spec.ts` shows seat items carry `generals`; `targets-dialog.spec.ts` shows its seat options render a portrait and still submit the same action.
- [ ] **Step 2: Run them** — FAIL. **Step 3: Build `generals` and `force` where seat items are made (`ability-description.ts:123` region); render `app-seat-portrait` in `selection-panel.ts` and `targets-dialog.ts`.** The flow and the actions submitted do not change.
- [ ] **Step 4: Run them** — PASS. **Step 5: Commit** `feat(ui): portraits in selection and targets pickers`.

### Task 5: General art in the start-of-turn reveal ask

**Files:**
- Modify: `start-reveal-dialog.ts`, its builder in `game-board.ts` (grep `StartRevealOption`), spec `start-reveal-dialog` (create if absent: `start-reveal-dialog.spec.ts`)

**Interfaces:**
- Produces: `StartRevealOption` gains `generalId: string`; each option shows `app-card-art [skin]="true" [id]="option.generalId"` before the slot label.

- [ ] **Step 1: Failing spec:** two options render two General arts with the ids given and keep the checkbox toggle and Confirm behaviour. **Step 2: Run** — FAIL. **Step 3: Implement**, passing the viewer's own hidden General ids from the builder. **Step 4: Run** — PASS. **Step 5: Commit** `feat(ui): General art in the start reveal ask`.

### Task 6: Notice data model and registry (content)

**Files:**
- Create: `projects/content/src/lib/resolutionNotice.ts`, `resolutionNotice.spec.ts`
- Modify: `projects/content/src/public-api.ts` (export it)

**Interfaces:**
- Produces:
  ```ts
  export type NoticeTone = 'good' | 'bad' | 'neutral';
  export interface NoticeText { key: string; params?: Record<string, string | number> }
  export interface NoticeCard { card: CardInstance | null /* null = back */; label?: NoticeText }
  export interface ResolutionNoticeContent {
    source: { kind: 'card'; id: string } | { kind: 'skill'; id: string; seatId: string };
    seatIds: string[];                 // actors in order: source seat first
    steps: NoticeText[];
    cards: NoticeCard[];
    outcome: { tone: NoticeTone; symbol: string; headline: NoticeText; text: NoticeText; hp?: { seatId: string } };
  }
  export interface ResolutionSpan { sourceId: string; userSeatId: string; targetSeatIds: string[]; events: EngineEvent[] }
  export interface ResolutionNoticeDefinition { describe(span: ResolutionSpan, view: GameState): ResolutionNoticeContent | null }
  export const RESOLUTION_NOTICES: Record<string, ResolutionNoticeDefinition>;
  export function describeResolution(span: ResolutionSpan, view: GameState): ResolutionNoticeContent | null;
  ```
  `describeResolution` returns null for an unregistered id. `view` is the viewer's redacted state; `describe` must read only what the view and the span's events show.

- [ ] **Step 1: Write `resolutionNotice.spec.ts`:** `describeResolution` returns null for `'sha'`, `'wuxie'`, `'peach-garden'`, `'chains'`, `'duel'`, `'barbarians'`, `'hail-of-arrows'`; returns null when a registered `describe` returns null. **Step 2: Run** — FAIL. **Step 3: Implement the types, an empty-but-for-guard registry, and `describeResolution`.** **Step 4: Run** — PASS. **Step 5: Commit** `feat(content): resolution notice registry`.

### Task 7: Director publishes notices

**Files:**
- Modify: `projects/app/src/app/game-board/playback/playback-director.ts`, `beats.ts`
- Create: `playback/resolution-spans.ts`, `playback/resolution-spans.spec.ts`
- Test: `playback/playback-director.spec.ts`

**Interfaces:**
- Consumes: `describeResolution`, `ResolutionSpan`, `ResolutionNoticeContent` (Task 6).
- Produces: `resolutionSpans(log: readonly EngineEvent[], from: number, to: number): { span: ResolutionSpan; endIndex: number }[]` (pure: a span opens at a non-response `CardPlayedEvent` of a registered id, or at the `AbilityUsedEvent` of a registered skill, and ends at the last event before the next play, turn or phase change, or the end of the log). `PlaybackDirector.notices: Signal<ResolutionNoticeContent[]>` (queue, oldest first) and `dismissNotice(): void`.

- [ ] **Step 1: Failing specs.** `resolution-spans.spec.ts`: a Blaze play followed by shown card, discard and damage events gives one span ending at the damage event; two plays in one range give two spans in order; a play with a Wuxie `CardPlayedEvent` response that cancels it gives no span. `playback-director.spec.ts`: the notice is appended when the beat at `endIndex` plays, not before; a first look, reveal or late join (cursor skip) appends none; the director never calls `hold()` for a notice.
- [ ] **Step 2: Run both** — FAIL. **Step 3: Implement `resolutionSpans`**, then in `enqueue` compute spans for the new range and attach `notice` content to the step at `endIndex`; in `play` push it to the queue signal. Describing needs the visible state at that point, so use `this.target`.
- [ ] **Step 4: Run both** — PASS. **Step 5: Commit** `feat(ui): playback director publishes resolution notices`.

### Task 8: Resolution notice component and layer

**Files:**
- Create: `projects/app/src/app/game-board/resolution-notice.ts`, `resolution-notice.spec.ts`
- Modify: `game-board.ts` (host the notice beside the playback layer), `projects/app/src/app/i18n/en.ts`, `vi.ts` (`notice.title`: "Resolution" / Vietnamese draft)

**Interfaces:**
- Consumes: `PlaybackDirector.notices`, `dismissNotice()`, `SeatPortrait`-style portraits, `describe` content from Task 6, the shell in the mockup.
- Produces: `ResolutionNotice` (`selector: 'app-resolution-notice'`), input `content = input.required<ResolutionNoticeContent>()`, output `faded`. Header (title in the source seat's force colour, source art), actors row, steps, cards, outcome band (green, red or grey by tone), HP hearts, draining bar; fades after `NOTICE_MS = 4000` and emits `faded`. Reduced motion: shows its end state and uses the same timer. It is `pointer-events: none` and not focusable.

- [ ] **Step 1: Failing spec:** renders title, one portrait per `seatIds`, a step line per step, a card back for a `null` card, the band with `data-tone`, hearts when `hp` is set; with fake timers emits `faded` after 4000 ms and not before; the host has no button.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**, translating `NoticeText` through the translator with the `notice.*` keys; in `game-board.ts` show the first queued notice and call `dismissNotice()` on `faded`.
- [ ] **Step 4: Run** `npx jest projects/app/src/app/game-board` — PASS. **Step 5: Commit** `feat(ui): resolution notice popup`.

### Task 9: Notices for Blaze, Steal, Break and Coerce

**Files:**
- Create: `projects/content/src/lib/resolutionNotices/` with `blaze.ts`, `take-cards.ts` (Steal, Break, Coerce), `blaze.spec.ts`, `take-cards.spec.ts`
- Modify: `resolutionNotice.ts` (register), `en.ts`, `vi.ts` (`notice.blaze.*`, `notice.steal.*`, `notice.break.*`, `notice.coerce.*`)

**Interfaces:**
- Consumes: Task 6 types. Registers ids `blaze`, `steal`, `break`, `coerce`.

- [ ] **Step 1: Failing specs, using the Appendix A text:** Blaze with a discard then damage: `outcome.tone 'good'`, headline `notice.blaze.hit`, `hp.seatId` the target; Blaze with no match: `tone 'bad'`, headline `notice.blaze.missed`; Steal from a hand: the card is the real one when the viewer is the user or target and `null` for a third seat; Steal of equipment names the card; Break discards show the discarded card; Coerce shows "Weapon taken"; a Break cancelled by Wuxie returns null.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement the four `describe` functions** reading only the span's events and the viewer's `view`. **Step 4: Run** — PASS. **Step 5: Commit** `feat(content): notices for Blaze, Steal, Break and Coerce`.

### Task 10: Notices for Harvest, Amass, Draw Two, Ascertain, Ally Far Attack Near, Wine and Resurgence

**Files:**
- Create: `resolutionNotices/harvest.ts`, `draw.ts` (Amass, Draw Two, Ally Far Attack Near), `ascertain.ts`, `wine.ts`, `resurgence.ts` and a spec for each
- Modify: `resolutionNotice.ts`, `en.ts`, `vi.ts`

**Interfaces:**
- Registers `harvest`, `amass`, `draw-two`, `ascertain`, `ally-far-attack-near`, `wine` (cards) and `resurgence` (skill, `source.kind 'skill'`, `seatId` = the owner).

- [ ] **Step 1: Failing specs (Appendix A text):** Harvest lists one card per seat and `tone 'neutral'`, with a seat eliminated midway omitted; Amass and Draw Two give `tone 'good'` with the counts drawn; Ascertain shows the seen cards only when the viewer is the user, backs otherwise; Wine's text states the extra damage; Resurgence with two hearts and one other card says it recovered 2 HP and took 1 card, shows the revealed cards and `hp.seatId` the owner, `tone 'good'`; a Resurgence that reveals no heart recovers nothing and says so.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement the seven describes.** **Step 4: Run** — PASS. **Step 5: Commit** `feat(content): notices for the remaining cards and Resurgence`.

### Task 11: Lab entries, Vietnamese parity, docs and the final gate

**Files:**
- Modify: `projects/app/src/app/dev/lab/animation-lab-page.ts`, `dev/recipe.ts` (one lab entry per registered notice, via the registry), `docs/architecture/frontend.md`, `docs/architecture/content-and-extensibility.md` (how to add a notice)

- [ ] **Step 1: Add the lab entries** so each registered notice has a replay button; the existing lab specs must still pass.
- [ ] **Step 2: Run** `npm run i18n:status` — every `notice.*` key has an English and a Vietnamese entry (Vietnamese may be draft).
- [ ] **Step 3: Document** the registry and the "never blocks" rule in the two architecture docs.
- [ ] **Step 4: Run** `npm run verify && npm test` — all pass; fix anything that fails.
- [ ] **Step 5: Commit** `docs: resolution notice architecture`. Open a pull request (human merges).
