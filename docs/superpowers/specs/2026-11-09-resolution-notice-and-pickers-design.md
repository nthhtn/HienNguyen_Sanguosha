# Resolution notice, picker portraits and target labels — design

Date: 2026-11-09. Status: draft for review. Branch `feat/ui-info-popups-and-pickers`.
The agreed mockups are in the artifact https://claude.ai/artifact/1csFRXU5QCd4NrpaM2o2XX (private; the
examples there are the reference for what each notice shows).

Three independent improvements, built in this order, each its own commit series.

## 1. Resolution notice

### Intent

Many effects resolve with no popup: only an Action History line and a status change tell the player
what happened (Blaze hitting or missing is the example that prompted this). Judgment and Compete have a
popup; the rest should get one that shows the outcome at a glance.

### Goals

- One shared, extensible popup, the Resolution Notice, used by every effect with a visible outcome.
- It shows briefly and fades on its own, like Judgment and Compete. It never blocks and has no button.
- Shell (the user's decision, see the mockup): header with the word "Resolution" in the force colour of
  whoever caused it and the source (card or skill, with the card art for a card); the seats involved
  with their portraits, names and Generals; short step lines; the cards that matter (a hidden card is a
  card back); one outcome band, green when it went well for the user, red when it did not, grey when
  neutral, with a headline, one sentence and HP hearts when HP changed; a draining bar as the fade.
- Adding a notice for a new card or skill means adding data next to its definition, never a central
  switch (CLAUDE.md, Extensibility).

### Scope (the user's decision)

Gets a notice: Blaze (hit, miss), Steal, Break, Coerce, Harvest, Amass, Draw Two, Ascertain, Ally Far
Attack Near, Wine, and one skill: Meng Huo's Resurgence (the user's decision: it has no notice today;
the cards it reveals, each heart recovering 1 HP, the rest going to his hand).

Skills and equipment abilities in general get no notice in this release. The user will address them
case by case later, so the registry must make adding one a data-only change. Counterattack and
Marvelous Pick in the mockup are illustrations of that shell, not work in this release. Seat
elimination stays as it is (the user's decision).

Resurgence reveals cards and heals; it is not a judgment by the rules (no judged card, no skill may
change it), so it uses the Resolution Notice, not the Judgment popup (my call; the user called it
"Meng Huo's Judgment"). Reference text: "Resurgence" / "Hing recovered 1 HP and took 2 cards." with the
revealed cards shown, hearts marked, and HP hearts.

Does NOT get one, because it already has an informative response or popup: Sha, Wuxie, Peach Garden,
Chains, Duel, Barbarians, Hail of Arrows, saving and recovering from the brink of death, and anything
that already opens the Judgment popup (Lightning, Capture, Starvation, Eight Trigrams and the like).

### Non-goals and anti-goals

- No engine rule change, no new engine event if an existing one can carry the fact. The notice
  describes what already happened.
- No blocking and no extra input. A notice that makes the table wait would be a failure even if it
  looked right.
- Not showing anything a viewer may not see: a hidden card or hidden General stays hidden (use the
  public view, as the Judgment popup does).
- Not a second Action History. It shows one resolution, not the log.

### Decisions the user did not make (my calls, for the reviewer)

- The notice is described from the log events of one resolution, by content-supplied data attached to
  the card or skill definition (a describe function returning the notice's content). The application
  layer renders it. The engine learns nothing about notices.
- A notice for one resolution is shown once, when its last event has played (after the last of the
  batch's animations), in local play and online alike.
- The green or red tone is from the point of view of the seat that used the card or skill, the same for
  every viewer (so every player sees the same notice, as the server-paced playback expects); neutral when
  it neither helps nor hurts. This replaces the shell's loose phrase "went well for the user": "the user"
  there means the source seat, not the viewing player.
- Hidden information: a notice is built from the viewing player's own redacted view, like the Judgment
  popup. A seat that took part sees the card; everyone else sees a card back. If the log does not carry
  a fact the notice needs (the card taken from a hand), a small additive event field is allowed; no
  rule change.
- A resolution that spans response windows still gets one notice, when it finishes. A resolution that a
  Wuxie cancels gets no notice, because the Wuxie response already says so.
- Mockup content: the headline, sentence, steps and cards in the mockup are the reference text for the
  named cards (Appendix A).
- Notices that would overlap (two resolutions in one batch) queue and show in order.
- Because the notice never blocks, it does not change the shared animation durations the server uses
  for bot and clock pacing.

### Left to the builder

Which events delimit "one resolution" for each card; the exact beat timings and fade length (match the
Judgment and Compete feel); the registry shape; component structure; how the notice reads in the
animation lab and dev scenario previews (add entries there).

## 2. Picker portraits

### Intent

Pick popups show only text and a colour, so the player cannot tell who or what they are choosing.

### Goals

- In the Choice dialog and the Selection panel, a seat option shows the seat's board portrait (the
  Main and Deputy avatars; a card back while its General is hidden) above the player's name, with the
  force colour on the border.
- A General option shows the General's art above its name, with the force colour on the border. A
  hidden General is shown as a card back (the user's decision).
- Options stay keyboard- and screen-reader-reachable; the accessible label keeps naming the option.
- The Ask dialog that offers a reveal at the start of the turn (the Start Phase reveal ask, see the
  reveal conditions rules) shows the same General art or portrait (the user's decision). The General
  selection at the start of the game is left alone (my call: it already shows General cards, and the
  player is choosing their own).

### Non-goals

- No change to which options are offered or to the actions submitted: the engine's legal options stay
  the source of truth.
- The existing two-target Sha picker keeps its own popup and flow (the user's decision); it only gains
  the portraits.

## 3. Target labels

### Intent

A target reads "Hing Cao Cao - Xu Chu": the player and the Generals run together in one colour.

### Decision (the user's): variant B

Player name in the normal text colour and bold; a middle dot; then the revealed Generals in the force
colour joined by " / ". A face-down General is left out, as today. Examples: `Hing`, `Hing · Cao Cao`,
`Hing · Cao Cao / Xu Chu`. Targets are still separated by ", ".

### Scope

The shared target label component and its callers (play buttons, action list, hand view, Action
History where it uses the same component). Plain-string callers that cannot take markup (an aria-label,
a history line built as text) use the same text with the same middle dot and slash.

## Cross-cutting constraints

- UI text follows CLAUDE.md's casing rules in English and Vietnamese; every new string has English and
  Vietnamese keys (Vietnamese starts as draft).
- Works in Pass and Play, online, and at phone landscape width.
- Respects reduced motion (the notice then shows its end state and fades on the same timer).
- Components render and dispatch only; wording and outcomes come from content and the application layer.
- Each part ships with specs; `npm run verify` and the tests pass.

## Appendix A: mockup content (reference text)

Headline, then sentence. Seats are example data.

- Blaze hit: "Blaze hit" / "Seat 1 took 1 fire damage." Steps: Seat 1 showed a card; Hing discarded a card of the same suit. Cards: the shown card, the discarded card. HP hearts for Seat 1.
- Blaze miss: "Blaze missed" / "No damage was dealt." Steps: Seat 1 showed a card; Hing had no card of the same suit. Grey-red band.
- Steal: "Card taken" / "Hing took a card from the hand of Seat 2." (equipment: "Equipment taken" / "Hing took Zhuge Crossbow from Seat 2."). Card shown face up to those who took part, else a back.
- Break: "Card discarded" / "Seat 3 lost a Peach."
- Coerce: "Weapon taken" / "Hing took the weapon of Seat 1." Steps: Seat 1 must use Sha on Seat 3; Seat 1 did not use Sha.
- Harvest: "Harvest done" / "Every seat took one card." Cards: one per seat. Neutral.
- Amass: "Cards drawn" / "Hing drew 2 cards and Seat 1 drew 2 cards."
- Draw Two: "Cards drawn" / "Hing drew 2 cards."
- Ascertain: "Hand viewed" / "Only Hing saw the hand of Seat 2." Neutral; the cards seen are shown to Hing only.
- Ally Far Attack Near: "Allies drew" / "Hing and Seat 3 drew 1 card each."
- Wine: "Wine drunk" / "The next Sha this turn deals 1 extra damage."
- Counterattack (skill, illustration only): "Counterattack" / "Hing took a card from the hand of Seat 4."
- Marvelous Pick (skill, illustration only): "Marvelous Pick" / "Hing drew 2 cards." HP hearts.
- Resurgence (Meng Huo): see the Scope section.
