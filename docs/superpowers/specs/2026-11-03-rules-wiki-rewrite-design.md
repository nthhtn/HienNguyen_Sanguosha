# Rules Wiki rewrite

Date: 2026-11-03. Status: draft for approval.

## Intent

The Rules section of the Wiki (`/wiki/rules/*`) is six short pages of one-line
rules and tables. It explains in words only, and it skips rules a player needs
(how a response window resolves, what dying means, how chains pass damage).
Players should be able to *see* each rule: a card, a seat, an HP row, a phase,
arranged on the page the way they appear in the game.

The rewrite pairs every rule with a small scene built from the game's own
art, adds the missing pages, and keeps English and Vietnamese in step.

## Reference drafts

Two throwaway HTML drafts were built and reviewed by the user. They are the
visual and content reference. They are **not** code to port: they embed
images as data URIs and hand-roll their own styles, and the product must use
the app's existing asset, i18n and component conventions.

The sources are in this repo, with the images left out:

- `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-drafts/draft-en.html`
- `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-drafts/draft-vi.html`
- `docs/superpowers/specs/2026-11-03-rules-wiki-rewrite-drafts/README.md` (how to read them)

Open them in a browser to see the layout. They hold the exact worked examples,
the scene arrangements and the Vietnamese wording to start from. Each
`<img data-k="…">` names the real art to use. The Vietnamese in the drafts is
a draft, not approved copy. Where a draft and the engine disagree, the engine
wins.

Online copies (the user's private artifacts, may not open for everyone):
https://claude.ai/artifact/VyY1YGBczF5ouExMwqpNDz (English),
https://claude.ai/artifact/Q45FGAunLgdQvjEChaK9kx (Vietnamese).

## Goals

- Every rules page shows its rules with scenes made from real art. No
  placeholders, no sketches, no screenshots.
- Scenes are arranged by the app (Angular components rendering real card, General,
  Force banner and HP images from the content project), not static pictures.
- Pages, in this order in the navigation:
  1. **Overview** (rewrite)
  2. **Setup** (rewrite)
  3. **Turn Structure** (rewrite)
  4. **Card Types** (rewrite)
  5. **Distance / Range** (rewrite; keeps its current name)
  6. **Response Windows** (new)
  7. **Damage and Dying** (new)
  8. **Judgment** (rewrite)
  9. **Chains** (new)
  10. **Glossary** (new)
- A short "not written yet" note where a rule has not been confirmed, instead
  of guessing (see Open rules).
- English and Vietnamese ship together. New Vietnamese text is a draft that
  `npm run i18n:status` reports as such, until a native speaker reviews it.
- Every old rules URL keeps working. Existing in-text links keep resolving.

## Non-goals

- No change to the engine's rules or to how the game plays.
- No change to the Setup or Game screens (see "Keep local Play and Game
  screens"), and no change to the Generals or Cards wiki pages.
- No video, audio, or animation in scenes. Static scenes only.
- No pages for Compete, Ally Far Attack Near or the remaining Tools yet.
- No new image assets. Only art already in the content project.

## Anti-goals

- A scene that disagrees with the engine. A wrong picture is worse than no picture.
- Rules logic living in a component. The distance demo must ask the engine or
  content layer for distances, not compute them in the component.
- A page that looks right in English but breaks in Vietnamese (longer
  strings, different casing).
- Placeholder boxes where art is missing. If a card or General has no art,
  the scene is changed to use one that has.

## Constraints

- Project rules in `CLAUDE.md` apply: layering (presentation does not
  implement rules), standalone components, signals where useful, UI text
  casing (Title Case labels, sentence case sentences, keywords keep their
  capitals, no ids shown), and the Vietnamese casing and terminology rules
  from `docs/superpowers/specs/2026-10-15-vietnamese-localization-design.md`.
- Terminology: Deck is Kingdom Wars or Identity, mode is Guozhan. "Tool" not
  "Trick". "Lord" not "Ruler". Seats show as "Seat N" / "Người chơi N".
- All text lives in the i18n catalogs (`en.ts`, `vi.ts`) and is shown through the
  existing rich-text mechanism (`{card:…}`, `{force:…}`, `[[link|label]]`).
  Card and General names come from the content translations.
- Art comes through the content project's helpers (`cardArtUrl`,
  `kingdomBannerUrl`, `hpIconUrls`, General art helpers), never hard-coded
  paths.
- The existing snapshot specs (`rules.en.spec.ts`, `rules.vi.spec.ts`) keep
  pinning every page's text and links. Snapshots are updated deliberately in
  each stage.
- Mobile width (about 400px) works: scenes wrap, nothing scrolls the page sideways.
- Light and dark themes both work, following the app's current theming.
- `npm run verify` and the tests pass in each stage. Work is on a branch per
  stage; the agent never merges or pushes to `main`.

## Decisions the user made

- Scenes are card art arranged by the app, using real images.
- Build the drafts first, then build for real, in three pull requests.
- Zhang Jiao is the example General for Qun (replacing Lu Bu).
- Turns go **counter-clockwise** on screen. The pages say so, and the demo
  seats run that way.
- Page set and order as listed in Goals. The three new pages and the Glossary
  were accepted from the draft.
- Staging: (1) shared scene components plus the six existing pages rewritten,
  (2) the new Response Windows, Damage and Dying, Chains and Glossary pages,
  (3) the interactive distance demo.

## Scene content (what each page shows)

Examples are illustrations. HP numbers, seat numbers and suits in them are
chosen to teach, not computed. Anything a player could take as a rule must be
checked against the engine.

- **Overview:** the four Forces as banners beside a representative General each
  (Cao Cao, Liu Bei, Sun Quan, Zhang Jiao); a four-beat summary of a game
  (Setup, Turns, Damage, Victory); the winning conditions with a worked
  "who wins" seat row; links to the other pages.
- **Setup:** the 7-General deal (Wei, Shu, Wu and Qun Generals); choosing a
  Main and a Deputy, both face down (the hidden-General card face); the shared
  HP sum (a worked odd sum, 4 + 3 = 7 gives 3, shown with HP icons); drawing 4
  cards; the reveal rules; the odd-sum reveal bonus; the two kill-reward
  cases (different Force and same Force) with banners.
- **Turn Structure:** six phase tiles in one row, each with real cards or
  icons; the Play Phase tile marked as the one that waits; a worked Play
  Phase (heal with Peach, one Sha, end); a worked Discard Phase (6 cards,
  4 HP, discard 2).
- **Card Types:** General cards, Basic, Tool (instant and delayed, shown as
  separate groups of real cards) and Equipment (Weapon, Armor, Minus Mount,
  Plus Mount), each as a row of real card art with one-line roles.
- **Distance / Range:** the existing rules plus the interactive table: six
  seats, click a seat, toggle Red Hare / Shadow Runner, knock seats out, set
  attack range, read "can your Sha reach". Stage 3. Stages 1 and 2 show a static
  version of the same example.
- **Response Windows:** Sha and Shan (play Shan or pass); a Wuxie check on a
  Tool with a Wuxie-on-Wuxie chain (ask order from the Tool's user, only seats
  holding a Wuxie, passes not announced, a seat is never asked about its own
  card, the last Wuxie decides).
- **Damage and Dying:** HP and one point of damage; Wine's extra damage; the
  three damage kinds (normal, fire, thunder) with their cards; the dying round
  (asked in turn order from the turn owner, the dying seat is always asked,
  Peach heals 1, Wine may be played on itself, saved or eliminated).
- **Judgment:** the four judgment steps; Capture, Starvation and Lightning with
  what each judgment result does, shown as pass/fail branches.
- **Chains:** chaining and unchaining (1 or 2 targets, recast); the chain wave
  on a worked example (only fire and thunder travel, the original amount is
  dealt to each other chained seat in turn order, each is unchained, a dying
  round resolves before the next hit).
- **Glossary:** Force, HP, Main and Deputy General, hidden General, chained,
  judgment area, response, Mount, attack range, dying, draw pile, each beside
  its art.

## Keeping scenes true to the engine (my call)

- Each rule a page states, and each worked example, is checked by the builder
  against the engine code, the engine's tests and `docs/architecture/`. The
  builder keeps a short table in the PR description: claim, where it was
  confirmed.
- Engine-driven spec tests are **not** required for every scene. They are
  required only where a scene computes something (the distance demo, Stage 3).
  Static examples use fixed, illustrative numbers.
- If a claim cannot be confirmed from the engine, it is cut or turned into a
  "not written yet" note. It is not written from memory.

## Routes and navigation (my call)

- Existing routes stay as they are: `rules/overview`, `rules/card-types`,
  `rules/setup`, `rules/turn`, `rules/distance`, `rules/judgment`. They stay
  canonical, with no renames and no new redirects.
- New routes: `rules/response`, `rules/damage`, `rules/chains`,
  `rules/glossary`.
- The navigation order is the order in Goals. Grouping headings from the
  drafts are optional, left to the builder.
- Page titles use the catalog's existing names for existing pages ("Turn
  Structure", "Distance / Range"). New pages are "Response Windows", "Damage and
  Dying", "Chains" and "Glossary", with Vietnamese titles from the drafts.

## Distance demo (my call)

- The content project already exports `seatDistance` and `attackRange`
  (`projects/content/src/lib/shared/queries.ts`). They take a game state and the
  content registry. The demo must get its numbers from them, not recompute.
- The builder may build a small, valid game state for the demo, or add a small
  exported helper next to those queries that wraps them for a table of
  seats. Adding an export is allowed. Changing a rule is not.
- In Stages 1 and 2 the Distance page shows a static scene: a fixed table of
  seats with distances written in. Its numbers are checked against
  `seatDistance`. Stage 3 replaces it with the interactive version.

## Vietnamese review state

Nothing to mark by hand. Every Vietnamese key counts as draft until its id is
listed in `projects/content/data/locales/vi/review.json`, and
`npm run i18n:status` reports the count. New keys are added without
being listed.

## Branches

Stages may be stacked: Stage 2 branches from the Stage 1 branch, and Stage 3
from Stage 2, so work can go on while earlier stages wait for review. After a
stage merges, the next branch is rebased onto `main`. The agent never merges
or pushes to `main`.

## Open rules

The drafts marked these as pending. The builder reads the engine and, where
the answer is clear from it, writes the rule (checked as above). Where the
engine does not settle it, the page shows a visible "not written yet" note as
catalog text in both languages, covered by the snapshot specs, and the question
is raised with the user instead of guessed. A page is never blocked by an open
rule: the note ships.

- Whether a seat may play several Peaches in one dying round to climb above 0.
- How the dying round reads when the Peach comes from another Force.
- Wuxie against a Tool that hits many seats (Barbarians), where each target
  gets its own check.
- A worked example of a General skill that changes a judgment (step 2 of
  Judgment).
- A player-wording note on why a chained hit does not start its own wave.
- Compete and Ally Far Attack Near pages (out of scope here).

## Wording fix

The current catalog says the next seat takes its turn "clockwise" (English
`rules.turn.end`, and the matching Vietnamese string). The game's table layout
(`game-board/table-layout.ts`) runs turns counter-clockwise on screen.
Stage 1 fixes the catalog strings. Engine code comments and older design docs
that say "clockwise" describe seat order, not the screen. The builder may
fix those comments but it is not required here.

## Left to the builder

- Component names, file layout, and how scene primitives (card, seat, HP row,
  step list, pass/fail branches) are split or shared.
- Catalog key names and how strings are grouped.
- Exact styling inside the app's theming, as long as it follows the drafts' intent
  (framed scenes, ordered steps only where order is the rule).
- Whether the demo builds its own small game state or uses a new wrapper
  helper (see Distance demo).
- Whether the navigation grouping from the drafts (Basics, At the Table,
  Reference) is added, or the current flat list is kept with the new pages
  inserted in order (the order itself is fixed).
- Test strategy for scenes beyond the snapshot specs.
