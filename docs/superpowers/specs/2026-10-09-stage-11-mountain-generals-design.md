# Stage 11: The Mountain Generals — Design Spec

Status: Built

> Superseded in part: its "no elemental damage" decision is replaced by [Elemental Damage and Chains](2026-10-16-elemental-damage-and-chains-design.md) (2026-10-16).

Date: 2026-10-09

## Purpose

Give the 8 Mountain Generals their real skills: Zhang He, Deng Ai, Liu Shan,
Jiang Wei, Sun Ce, Zhang Zhao and Zhang Hong (one General card), Cai Wenji and
Zuo Ci. It is the last of four expansion stages (roadmap stages 8–11) and
closes the roadmap. The crawled data holds 8 Mountain Generals with 17 skills,
2 of them Lord ("King") skills.

User decision (2026-10-09): Zuo Ci is built in full (spare-General pool,
borrowed skills with gender, New Life).

## Common rules

Stages 7–10's common rules hold unchanged: reveal to use, gender, Lord skills
inactive, losing HP is not damage, "may" always asks, no elemental damage,
synthetic `filler-<id>` Generals in specs. The skill text is the crawled
standard edition applied to Kingdom War ("attack" is Sha, "flip a judgment" is
a judgment, "flip character card" is turning the seat over).

**Lord skills.** Seem Foolish (Liu Shan) and Takeover (Sun Ce) are inactive;
the wiki shows them with "Not used in Kingdom War".

**New kinds of skill.**
- **Awakening skill:** compulsory. It fires once, at the start of its owner's
  turn, when its condition holds. It then marks itself awakened for the rest of
  the game. A hidden General's awakening skill is off, like any compulsory one.
  Strategic Pass, Follow the Master and Soul Position are awakening skills.
- **Gained skill:** an awakening can give its owner another General's skill
  for the rest of the game. The gained skill is used under the same rules as if
  it were printed on the General that gained it (hidden means reveal to use).
- **Limited skill:** a skill usable once per game (Upheaval). Flagged so that
  Incarnation cannot borrow it.

## Rule text: the Mountain Generals

### Wei

- **Zhang He: Clever Change** (may, four times per turn, one per phase). At the
  start of his Judgment, Draw, Play or Discard Phase, he may discard a hand card
  to skip that phase.
  - Skipped Draw Phase: he chooses up to 2 other seats with hand cards and
    takes 1 hand card from each (hidden pick, as Steal).
  - Skipped Play Phase: he moves one equipment card or one delayed Tool in the
    Judgment slot from one seat to the matching place on another seat. The
    target place must be free (an equipment slot empty; for a delayed Tool, the
    target seat not already holding a card with that name). A moved equipment
    card keeps its slot. Equipment moved this way does not replace another.
  - Skipped Judgment or Discard Phase: nothing more.
- **Deng Ai: Military Farm** (may). Whenever he loses a card (from hand or
  equipment) outside his own turn, he may judge. If the card is not a heart it
  becomes a Farm: it goes under his General, face up, instead of the discard
  pile. Each Farm he holds gives him a −1 horse (see Distance). The judgment is per card lost.
- **Deng Ai: Strategic Pass** (awakening). At the start of his turn, with 3 or
  more Farms, he reduces his max HP by 1 and awakens. From then on he may use a
  Farm as a Steal (a conversion, from the Farm pile, at Steal's normal range).

### Shu

- **Liu Shan: Pleasure** (compulsory). When a Sha is used on him, its user must
  discard a Basic card (hand) as the Sha begins to resolve against him;
  otherwise that Sha has no effect on him. The user needs another Basic card:
  the Sha card itself does not count.
- **Liu Shan: Decentralization** (may). In his Play Phase he may skip it. At the
  end of his turn he discards 1 hand card (if he has none, he does nothing more),
  then chooses another living seat, which immediately takes an extra turn. The
  normal order then resumes after Liu Shan's seat.
- **Liu Shan: Seem Foolish.** A Lord skill, so inactive.
- **Jiang Wei: Instigate** (active, once per turn, Play Phase). Choose a seat
  with Jiang Wei within its Sha range. It must use a Sha on him (a forced Sha
  window, as Coerce). If it does not, Jiang Wei discards one of its cards (a
  hidden hand card, or any equipment card).
- **Jiang Wei: Follow the Master** (awakening). At the start of his turn with no
  hand cards, he chooses: recover 1 HP, or draw 2 cards. Then he reduces his max
  HP by 1 and gains Astrology.

### Wu

- **Sun Ce: Passion** (compulsory). Whenever he uses a Duel or a red Sha, or is
  the target of a Duel or red Sha, he draws 1 card. (Duel: when it is used on
  him and when he uses it; Sha: once per target.)
- **Sun Ce: Soul Position** (awakening). At the start of his turn with exactly 1
  HP, he reduces his max HP by 1 and gains Brave Gesture and Brave Spirit.
- **Sun Ce: Takeover.** A Lord skill, so inactive.
- **Zhang Zhao and Zhang Hong: Direct Instruction** (active, any number of times
  in the Play Phase). Place an equipment card from their hand into another
  seat's matching equipment slot. The slot must be empty. They then draw 1 card.
- **Zhang Zhao and Zhang Hong: Stubborn** (may). At the end of another seat's
  Discard Phase, if that seat discarded 2 or more cards, they may choose one of
  the discarded cards to give back to that seat. They take the other discarded
  cards into their hand.

### Qun

- **Cai Wenji: Lament** (may). Whenever any seat takes damage from a Sha, she may
  discard 1 card (hand or equipment). The victim then judges:
  - heart: the victim recovers 1 HP;
  - diamond: the victim draws 2 cards;
  - club: the source discards 2 cards (hand or equipment, its choice; all of them
    if it holds fewer than 2);
  - spade: the source turns over.
  If the damage has no living source, the club and spade results do nothing.
- **Cai Wenji: Heartbroken** (compulsory). When a seat kills her, that seat
  loses all of its skills, on both Generals, for the rest of the game
  (including gained and borrowed skills). Nothing happens if she dies without a
  killer, or to a seat that is the killer of itself.
- **Zuo Ci: Incarnation** (see Incarnation below).
- **Zuo Ci: New Life** (compulsory). For each point of damage he takes, he
  acquires one more Form.

## Distance (Farms)

A Farm is a −1 horse for its holder: the distance *from* Deng Ai to every other
seat is reduced by 1 per Farm (as an Attack horse is). It stacks with horses.
The distance query that reads horses reads Farms through the ability modifier `attackHorseBonus`
(the count of Farms), so no engine code names Farms.

## Incarnation

At the start of the game, each seat holding Zuo Ci on either card is dealt 2
**Forms**: unused Generals drawn from the draw of Generals nobody was dealt (the
leftover pool of a seeded shuffle, never Zuo Ci himself, never a General already
in play). A Form is a General card kept face down, except the one in use.

- **Choosing.** At the start and the end of each of his turns, and once at game
  start, Zuo Ci may choose one skill from one of his Forms. A skill cannot be
  chosen if it is a Lord skill, an awakening skill, or a limited skill. The
  chosen Form turns face up; the previously chosen Form turns face down. He
  holds the chosen skill, used under the same rules as a printed skill.
- **Gender.** While a Form's skill is chosen, Zuo Ci's gender is that Form's
  gender. His force does not change (ruling, below).
- **Hidden.** If Zuo Ci is hidden when the game starts, the Forms are dealt and
  stay face down. The first choice happens when he is revealed or at his turn
  start (revealed at that point), as a "may".
- **New Life** adds one Form per damage point, from the remaining pool. An empty
  pool adds nothing.
- Forms are never visible to other seats except the chosen one. The viewer's
  state projection hides the face-down Forms' General ids.

## Engine design

Generic; the engine names no card, skill or General.

1. **Gained skills.** `Seat.gainedSkills?: { slot: 'main' | 'deputy'; skillId: string }[]`.
   `skillsInPlay` includes each entry, looked up by skill id across the registry
   (`ContentRegistry` gains a derived `skills` lookup; ids are unique across
   Generals, asserted in a spec). A gained skill has no Lord, awakening or
   limited exemption: those flags still apply.
2. **Borrowed skills (Incarnation).** `Seat.forms?: { generalId: string; chosen?: true }[]`,
   plus the pool of spare General ids on `GameState` (`spareGenerals: string[]`,
   hidden by the projection). `skillsInPlay` includes the chosen Form's skill
   with Zuo Ci's slot as owner. A content query `seatGender` reads the chosen
   Form's gender.
3. **Silenced seats.** `Seat.silenced?: true`. `skillsInPlay` returns `[]` for a
   silenced seat, so no trigger, modifier, active skill or conversion of its
   exists.
4. **Awakening.** `SkillDefinition.awakening?: true` and `limited?: true`. The
   awakening mark lives in `Seat.marks` (`awakened:<skillId>`). A helper
   `awakened(state, seatId, skillId)` is in `shared/skills.ts`. An awakening
   skill fires from a trigger at the start of the turn (the same hook point as
   the stage 7 turn-start skills).
5. **Phase skip.** A before-trigger on the phase's start effect that replaces the
   phase with nothing (as Dueling Heroes replaces the Draw Phase), for all four
   of Clever Change's phases. If the engine only has a Draw Phase hook today, add
   one generic `before:PhaseStartEffect` carrying the phase, and re-point the
   existing replacements to it only if the move is free.
6. **Card-loss hook.** Military Farm reads a card leaving the hand or equipment
   of a seat, outside its owner's turn, from existing zone-move events
   (`CardMovedEvent` or the nearest equivalent); if the existing events do not
   say "lost, not played", add a field `cause` naming the effect kind.
7. **Death hook.** Heartbroken reads the death event with its killer (the damage
   source of the fatal damage). If the death event lacks the killer, add it.
8. **Farms.** `Seat.farm?: CardZoneRef` (a third pile beside `pile`), a generic
   "pile" zone with a name. If `pile` can be generalised into named piles
   cheaply, do that; otherwise a sibling field. Farm cards are face up.
9. **Extra turn.** Decentralization uses the existing `extraTurnStack`.
10. **Distance modifier.** A content query reads an ability modifier
    `attackHorseBonus` (a number) into the distance calculation next to horses;
    Farms feed it. The engine never names Farms.

## Content design

- **Files:** `generals/mountain.ts` (`MOUNTAIN_GENERALS`, `MOUNTAIN_GENERAL_IDS`),
  `shared/farm.ts` (Farm pile helpers), `shared/forms.ts` (Incarnation helpers),
  `shared/awaken.ts` (the awakening helper).
- **Setup:** Incarnation's deal is a Kingdom War setup step: after dealing
  Generals, for each seat holding Zuo Ci, draw 2 spare Forms from a seeded
  shuffle of the leftover Generals. This is a mode rule, kept in
  `modes/kingdomWar.ts`.
- **Hooks:**

  | Skill | Hook |
  |---|---|
  | Clever Change | before each of four phases; ask; discard; then a phase-specific step |
  | Military Farm | after a card loss outside his turn; a judgment; the Farm pile |
  | Strategic Pass | an awakening at turn start; then a conversion from the Farm pile |
  | Pleasure | before a Sha's effect on him; a pay-or-cancel step on the user |
  | Decentralization | skip Play Phase (before the phase), then at turn end |
  | Instigate | active, once per turn; a forced Sha window |
  | Follow the Master | an awakening at turn start |
  | Passion | after Duel or red Sha is used or targets him |
  | Soul Position | an awakening at turn start |
  | Direct Instruction | active, repeatable; a seat pick then an equip |
  | Stubborn | after another seat's Discard Phase |
  | Lament | after damage by a Sha; ask; a judgment on the victim |
  | Heartbroken | on her death: `silenced` on the killer |
  | Incarnation | start, turn start, turn end: a choice among Form skills |
  | New Life | after damage: add Forms |

## Bots (rule-based)

- **Clever Change:** skips Draw for 2 cards when two non-allies hold hands
  larger than 1; skips Play to move a delayed Tool from an ally to a non-ally,
  or equipment from a non-ally to an ally; never skips Judgment or Discard.
- **Military Farm:** always. **Strategic Pass:** uses Farms as Steal when it
  has any.
- **Pleasure:** compulsory. **Decentralization:** when it holds more than 3
  cards in its Play Phase; gives the extra turn to the ally with the most
  hand cards, else a non-ally with the fewest.
- **Instigate:** against a non-ally holding no Sha. **Follow the Master:**
  recovers HP if damaged, else draws.
- **Direct Instruction:** gives equipment to allies, to empty slots.
- **Stubborn:** when 2 or more cards were discarded; gives back the least useful.
- **Lament:** against a non-ally victim's source only if the source is a non-ally;
  heals allies.
- **Incarnation:** the best-ranked skill by a fixed bot preference list; changes
  each turn start. **New Life:** compulsory.

## UI

- **Seat tile:** Farms shown as a count beside the pile; Zuo Ci's chosen Form
  shown as a small second portrait with its skill name; a silenced seat marked
  "No Skills".
- **Prompts:** Clever Change's four phases, "Skip this phase?"; the seat pick for
  its Draw version (up to 2, Choose Targets window); the move step's source,
  card, destination picks; Incarnation's Form choice ("Choose a Form skill").
- **Instigate:** the target's window reads "Use a Sha on Jiang Wei"; Pass is
  "Pass (discard 1 card)" from the target's view.
- **History lines** for each skill in the stage 9–10 style.
- **Wiki:** Mountain Generals as in play; Lord skills "Not used in Kingdom War";
  awakening skills labelled "Awakening".
- **Text** follows CLAUDE.md's UI text style.

## Testing

- **Engine:** gained skills, borrowed skills, silencing, the awakening mark,
  phase skip for all phases, the card-loss and death hooks, serialisation,
  hiding Forms in the projection.
- **Content:** one test per rule bullet, including:
  - Clever Change in each phase; the Draw version with 0, 1 and 2 targets;
    equipment-move legality (occupied slot, duplicate delayed Tool);
  - Military Farm only outside his turn, not on a heart, Farms as −1 horse;
  - Strategic Pass at 2 Farms (no) and 3 (yes), once only;
  - Pleasure with no other Basic card;
  - Decentralization with no hand, with extra turn order afterwards;
  - Instigate answered and not answered; Follow the Master's two options;
  - Passion on Duel both directions and on a black Sha (no draw);
  - Soul Position at 2 HP (no) and 1 HP (yes), gaining both skills;
  - Direct Instruction on an occupied slot (illegal);
  - Stubborn with 1 card discarded (no) and 3 (yes);
  - Lament on all four suits, with and without a source;
  - Heartbroken silencing both Generals and gained skills, not firing on suicide;
  - Incarnation with a hidden Zuo Ci, an empty pool, banned skills, gender
    swap with Gender Swords; New Life with 2 damage.
- **Bots:** each rule above.
- **Simulator:** all 57 Generals (up to 10 seats), seeds at 2, 5 and 8 seats, and
  a forced pairing per Mountain General that fires each skill that leaves a trace.
- **App:** Form choice, Farm count, silenced marker, new history lines.

## Rulings to confirm in review

1. **Zuo Ci's force** does not change with a Form (only gender), because force
   identity in Kingdom War is set by the revealed General and drives allies.
2. **Stubborn** follows the printed rule: it gives one discarded card back and
   takes the rest; the crawled text ("return into their hand") is ambiguous.
   It needs 2 or more discarded cards.
3. **Heartbroken** silences both Generals of the killer, as the crawled text
   says "all of their abilities".
4. **Deng Ai's Farm** fires per card lost, including each card of a multi-card
   loss, each with its own judgment.
5. **Clever Change** may be used once per phase, so up to four times per turn.
6. **Pleasure** requires a Basic card other than the Sha itself.
7. **Decentralization** takes the extra turn after discarding; with no hand the
   discard is skipped but the extra turn still happens.
8. **Passion** draws once per target of a Sha.
9. **Incarnation's pool** is the Generals nobody was dealt. A table that
   deals every General leaves no Forms, and Zuo Ci acts as a vanilla General.

## Rulings made while building

- **Spare Generals are stored as `Seat.forms = { slot, held, chosen? }`**, the Farm pile as `Seat.stash`; dealing Forms logs nothing, and other seats see no Forms at all while their holder is hidden (the log is public).
- **An extra turn for a seat that is out is not passed over** (an existing spec pins that eliminated stack seats become the owner; a seat granted an extra turn at End cannot die before it).
- **Upheaval and Nirvana are flagged `limited`** so Incarnation cannot borrow them.
- **A step of a skill the seat no longer holds does nothing** (Zuo Ci switching Forms while an ask waited, or a silenced seat).
- **Stage 10's `competeStart` opens nothing when the user's hand emptied after the ask** (found by the 10-seat property spec once Mountain changed the deal).
- **Lament's payment step opens nothing when the card was spent meanwhile.**
- **The wiki gets no "Awakening" label:** the crawled skill text already says "Awakened Ability".
