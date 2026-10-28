# Wiki Pages per Deck, with Per-Skill Status (Design)

Date: 2026-10-21. Status: approved by the user. Builds on the deck choice
(`docs/superpowers/plans/2026-10-21-deck-choice.md`, branch
`feat/kingdom-wars-deck-crawl`) and the Kingdom Wars deck data
(`docs/superpowers/specs/2026-10-20-kingdom-wars-deck-crawl-design.md`).

## Intent and why

The game now has two decks, Identity and Kingdom Wars. The Wiki only knows Identity.
A reader should be able to look up either deck's cards on their own pages, and
for every entry see whether it already works in the game. Today the Wiki says
"skills in game" for a whole General and says nothing about individual skills.

## What changes

### Navigation bar

The single **Cards** menu (Generals, Basic, Equipment, Tools) is replaced by two
buttons, **Identity** and **Kingdom Wars**. Each opens a menu with Generals, Basic,
Equipment and Tools. In the **Kingdom Wars** menu, **Generals** is shown but
disabled (greyed out, not clickable) for now: no Kingdom Wars Generals or skills
exist yet. The **Rules** menu is unchanged and shared by both decks. Button and
item labels follow CLAUDE.md "UI text style" (English Title Case, Vietnamese
sentence case); the buttons read "Identity" and "Kingdom Wars".

### Pages

Each deck has its own set of Wiki pages and its own addresses:

- `/wiki/identity/generals`, `/wiki/identity/basic`, `/wiki/identity/equipment`,
  `/wiki/identity/tools`: today's pages, unchanged in content apart from the
  per-skill status below.
- `/wiki/kingdom-wars/basic`, `/wiki/kingdom-wars/equipment`, `/wiki/kingdom-wars/tools`:
  new, built from the Kingdom Wars deck.
- `/wiki/kingdom-wars/generals` does not exist for now. Opening it by address
  redirects to `/wiki/identity/generals` (decided by the user).
- The old addresses (`/wiki/generals`, `/wiki/basic`, `/wiki/equipment`,
  `/wiki/tools`) keep working by redirecting to the Identity ones (my call:
  existing links and bookmarks must not break). `/wiki` itself lands on
  Identity Generals as today.

### Per-skill status (Identity Generals page, and later Kingdom Wars')

Every skill entry on a General shows one of three states, in plain words next to
the skill, in addition to the existing per-General badge:

- **Working**: the game has code for this skill.
- **Not used in Guozhan**: a Lord skill (the rules make Lord skills inactive).
- **Not in game yet**: the skill is in the data but the game has no code for it.

How the state is found (my call, checked against the data): a data skill matches
the game's skill with the same id after lower-casing the name, removing
apostrophes and turning every other run of non-letters and digits into one
hyphen ("Heaven's Envy" → `heavens-envy`). Today that gives 89 Working, 9 Lord
and 0 Not in game yet, and the 100 data skills all find their code. A test must
fail when a data skill that is not a Lord skill has no match, so a rename can
never silently turn "Working" into "Not in game yet"; it should name the skill.
The per-General badge ("skills in game") stays and is computed from these
per-skill states: a General's skills are in game when none of its non-Lord
skills is Not in game yet.

### Kingdom Wars Wiki cards

Each Kingdom Wars card page lists the Kingdom Wars deck's cards of that category
(Basic, Tool, Equipment), from `projects/content/data/decks/kingdom-wars/`
(`cards.json`, `texts.zh.json`, `ids.json`). Each entry shows:

- English name and Chinese name. The English name is Identity's name when the
  card exists in Identity, else the name in `ids.json` (Wuxie Kingdom, Amass,
  Ascertain, Ally Far Attack Near, Wu Six Swords, Trident Glaive).
- Category and equipment subtype, range or mount where the card has one,
  taken from the Kingdom Wars data.
- Copies and printings (suit and rank), shown like Identity's, from the
  Kingdom Wars deck. A card that appears in both decks therefore shows different
  copies on the two pages.
- The effect text. The Kingdom Wars text is Chinese only (as crawled). My call:
  show it in both languages, labelled as the Chinese printed text, and when
  the card also exists in Identity also show Identity's English text under a
  label that says it is Identity's. The Wiki does not say whether the two
  agree (comparing effects is a later step).
- Whether it works in the game **in the Kingdom Wars deck**: In game when the
  game has behaviour for the card, otherwise Not in game yet (today: Fire Fan
  and the six new cards, 7 in all). Slash, Fire Attack and Lightning Attack
  have no printed text on the source page; show the Identity Wiki's existing "Rules text not available" line (decided by the user), not an empty box.

### Identity Wiki cards

Unchanged: same entries, same In game / Not in game badge, same tabs. Only the
address changes.

## Goals, non-goals, anti-goals

Goals: two clearly separate sets of Wiki pages, one nav button per deck, and a
visible per-entry "works in game" state for skills and cards.

Non-goals: Kingdom Wars Generals and skills (menu item disabled; no page), English
or Vietnamese translations of Kingdom Wars effect text, comparing Identity and
Kingdom Wars effects, showing which deck a running game uses, changing the Rules
pages, changing the deck data or the crawler.

Anti-goals: breaking old Wiki links; showing a Kingdom Wars card as In game when
the game cannot play it; guessing a skill's state by anything other than the
code the game actually has; any rule logic in Angular components (CLAUDE.md:
the status comes from the content package, the components only show it).

## Constraints

- CLAUDE.md applies: the status and the Kingdom Wars card lists are computed in the
  content package (like `wikiGenerals` and `wikiCards` today), and the Angular
  pages only render them.
- All new visible text follows CLAUDE.md "UI text style"; new Vietnamese text
  is a draft and `review.json` is not touched; both catalogs must have the same
  keys (an existing test checks this).
- Identity's Wiki content and its existing tests keep passing; only addresses,
  the per-skill state and the nav change there.

## Decided by the user

- Separate Wiki pages for Identity and Kingdom Wars.
- Nav bar: a button for Identity and one for Kingdom Wars, each with Generals,
  Cards (Basic, Equipment, Tools) and so on.
- Kingdom Wars Generals is disabled for now; its address redirects to Identity
  Generals.
- Approved on 2026-10-21: the Rules menu stays shared, old addresses redirect
  to Identity, the Chinese-plus-Identity-text display for Kingdom Wars cards, the
  "Rules text not available" wording for a card with no printed text, and the three skill states with name matching.
- Every entry must show whether it already works in the game, including each
  skill.

## My calls (not yet agreed, please check)

- The Rules menu stays one shared menu; "etc." in the request is read as the
  card pages.
- Old Wiki addresses redirect to Identity.
- The three skill states and their wording, and the name-matching rule above.
- Kingdom Wars card text is shown as the Chinese printed text, plus Identity's
  English text when the card exists in Identity, each labelled.
- "Works in game" for a Kingdom Wars card means the game has behaviour for it.

## Answers from the project (reviewer questions)

- **Where "Working" is read from:** the game's skill code is one global map,
  `GENERAL_SKILLS` (skill logic keyed by General id, with each skill's `id`). It
  is not per deck or per mode, so "has code" means that map has the skill, and
  the missing-match test is one check over the General data. The Wiki already
  uses this map for the per-General badge.
- **Matching Kingdom Wars cards to Identity and to behaviour:** card ids are shared
  across decks. In `Kingdom Wars/cards.json`, `cardId` is Identity's id when the
  crawl matched the card by Chinese name, else the id in `ids.json`, and
  `identityCardId` is non-null exactly when Identity has the card. So: "card
  exists in Identity" is `identityCardId !== null`, the English name and text
  then come from Identity's data for that id, and "in game" is
  `registry.cards.has(cardId)`. A test pins the 7 not-in-game cards (the
  deck-choice work already pins the same seven in `decks.spec.ts`).
- **Categories:** Kingdom Wars data has only `basic`, `tool` and `equipment`, with
  equipment subtypes `weapon`, `armor` and `mount`. Identity's Wiki calls the
  last one `horse`; the Kingdom Wars pages show it as Identity does. A card with no
  mount value is not possible in this data. Whether `wikiCards` takes a deck
  argument or Kingdom Wars gets its own function is the builder's choice, as long
  as Identity's existing Wiki tests pass unchanged.
- **Chinese text source:** `texts.zh.json`, keyed by Chinese name, one text per
  card (not per printing). Slash, Fire Attack and Lightning Attack have no key
  at all (not an empty string); the page shows "Rules text not available" for them, as on Identity.
- **Catalogs:** the Chinese card text is content data and stays out of the
  i18n catalogs. Only the labels (buttons, badges, "Chinese printed text",
  "Identity text") get catalog keys; the no-text line reuses the existing `wiki.noText`, in both languages.
- **Redirects:** router redirects, not component navigation; keep Angular's
  default handling of query strings.

## Left to the builder

The visual design of the two buttons and of the status badges, the labels'
exact wording within the style rules, how the Kingdom Wars pages group and sort
their cards (tabs like Identity's, or one list), how Kingdom Wars printings are
labelled, and the shape of the content-package functions that feed the pages.
