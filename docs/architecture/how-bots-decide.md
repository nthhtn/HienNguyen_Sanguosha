# How the bots decide

A plain-words guide to how the shipped computer opponent, `rule-based`
(`projects/bots`), thinks: what it sees, in what order it handles a decision,
how it reads the table, whom it attacks, when it holds back, and how it
answers. It is written for a developer or game designer who knows Sanguosha
and Guozhan but not the code, and it describes the code as it is today
(after Kingdom Wars bots Part 4, shipped by the developer's decision).

For the code structure (the `BotPolicy` interface, callers, the registry's
hooks, the simulator) read [Bots and simulation](bots-and-simulation.md). The
design history is in the bot specs under `docs/superpowers/specs/`, chiefly
`2026-11-11-kingdom-wars-bots-design.md` and its Part 3 and Part 4 specs.
Where a spec and the code differ, this page follows the code and says so.

The bot is a ladder of simple, explainable rules. It never searches ahead,
never simulates future turns, and never guesses hidden cards beyond a few
visible counts.

## 1. What a bot sees, and what it does not

- **Only its own redacted view.** Every caller (the local `GameService`, the
  server's `GameRunner`, the simulator) hands the bot `redactStateForSeat`
  output. It sees its own hand, everyone's worn equipment, HP, revealed
  Generals, the log, and the number of cards in other hands, but never another
  hand's faces, a hidden General, or the draw pile. Other seats' hand cards
  appear as `hidden`.
- **Only legal actions.** The bot picks one of the engine's
  `getLegalActions`. It never encodes whether a play is allowed; when the
  engine offers a template (pick targets, pick cards, pick reveals), the bot
  fills it in.
- **Deterministic.** The same view and legal actions give the same choice.
  Ties break by seat order or by the order the engine lists actions. No
  `Math.random`.
- **A little memory.** Per turn it counts its actions; after 30
  (`MAX_BOT_ACTIONS_PER_TURN`, `policy.ts`) it ends the phase, so a turn
  always ends.
- **Its own Kingdom.** A seat sees its own Main General's Kingdom even while
  hidden, so a bot knows its own side from the start; it learns other seats'
  sides only as they reveal.

## 2. The decision ladder

`decide` in [rule-based.ts](../../projects/bots/src/lib/rule-based.ts) runs
the same steps for every decision. Before the steps it does two things to the
legal actions:

- **Fills target templates** (`fillPick`, `helpers.ts`): a card that can take
  several targets gets the attackable seats, best first by the ranker
  (section 5), up to the card's maximum. With no attackable seat the play is
  dropped.
- **Drops wasted plays** (`withoutWaste`, `waste.ts`, section 6): a Sha into a
  visible stop is removed before any rule sees it.

Then the first step that applies decides:

| Step | When | What it does |
|---|---|---|
| 1 | General selection | Picks the pair with the highest value-table score (section 8). |
| 1a0 | Arranging cards (Astrology) | Peach, Shan and any Sha on top; everything else at the bottom. |
| 1a | A selection (cards or seats to pick) | A registry rule, then the per-skill code, then the default: seats only if attackable (else cancel); cards for Axe, Green Dragon Blade, Serpent Spear and conversion skills are the least useful; any other selection is cancelled when allowed. |
| 1a' | An ability's ask or pick | Synergistic Partners reward: recover if offered, else draw. A "use this?" ask: see below. A pick of a seat, suit or label: registry rule, then per-skill code, else the first option. Gender Swords aimed at it: with 2 or fewer hand cards let the user draw, otherwise discard its least useful card. |
| 1b | A Tool's pick (Steal, Break, Harvest) | From a seat: a weapon, then armour, then a mount, then a card from the hand. From Harvest's face-up cards: the one it most wants to keep. |
| 2 | A response window aimed at it | Section 7. |
| 3 | Discard Phase | Throws away the least useful card first (keep order below). |
| 4 | Safety cap | 30 actions this turn: end the phase. |
| 5 | Play Phase | The play ladder below. |
| 6 | Anything else | End the phase, else pass, else the first legal action. |

**"Use this ability?" asks.** In order:

- A compulsory skill's ask is only about revealing, so the bot always says Use.
- An optional ask whose only effect is revealing the General (nothing drawn,
  healed, damaged or moved) is declined (rule D2, "no reveal for nothing").
- Otherwise the registry rule decides, then the per-skill code
  (`skills.ts`, `wind.ts`, `fire.ts`, `forest.ts`, `mountain.ts`), then the
  equipment defaults: Eight Trigrams, Longbow, Gender Swords and Green Dragon
  Blade always; Axe only on a non-ally; Ice Sword only on a non-ally above 1 HP
  that wears equipment.

**Start-of-turn reveals.** The Start window is a template the bot does not
know, so the fallback takes it as offered: reveal nothing. Bots reveal only
by using a skill, a conversion or a compulsory ask ("a bot has no reason to
hide" once it acts).

**Keep order.** Most "least useful" choices use `keepRank` (`helpers.ts`):
Peach 4, Shan 3, Sha / Wine / Draw Two 2, Equipment 1, everything else 0
(Wuxie included, so a Wuxie is discarded before a Sha). The Stage 1
`discardRank`, which keeps Wuxie with Shan, exists but is off in `rule-based`.

### The Play Phase ladder

The first item that yields an action is taken; the bot then asks again with
the new state, so one turn walks down the ladder many times.

1. **Peach** when below max HP (always; the Stage 1 "only at 2 HP or with
   more cards than HP" rule is off).
2. **Equipment** into an empty slot. It never swaps a worn weapon or armour
   (the upgrade rule is off).
3. **Draw Two**, then **Peach Garden** when hurt.
4. **Early registry rules** (Amass, Ally Far Attack Near, Harvest, Femme
   Fatale), then early legacy active skills (`ACTIVE_ORDER.early` in
   `skills.ts`).
5. **Barbarians or Hail of Arrows** (or Random Strike's conversion) when the
   mass-attack test passes (section 4).
6. **Steal or Break** at the best attackable seat, one that wears equipment
   first; then conversions into Break, Steal, Capture, Starvation and Blaze
   (Blaze only while holding 3 or more cards).
7. **Delayed Tools.** Capture at the attackable seat with the most HP;
   Starvation at the one with the most hand cards; Lightning only at 3 HP or
   more.
8. **Wine** whenever a Sha at an attackable seat is legal (the Sha follows
   next); Dong Zhuo's spade Wine only with no real one.
9. **Sha** at the best attackable seat, every time the engine offers one
   (Crossbow simply means it keeps offering). With no real Sha, a conversion
   into Sha if it costs no Peach.
10. **Duel** at the best attackable seat, then Dueling Heroes' conversion.
11. **Coerce** when both the weapon holder and the victim are attackable.
12. **Late registry rules** (Ascertain, Chains, Blaze, Impetus for Conflicts,
    Benevolence), then late legacy active skills (`ACTIVE_ORDER.late`).
13. **End the phase.**

A conversion is used only if the least useful cards it would take contain no
Peach (`conversionSpare`). A bluffing claim (Bewilder) is made only with more
than 4 cards.

## 3. Reading the table

`table.ts` and `danger.ts` build a picture from the redacted view (on in
`rule-based` through `tableReading`).

**Allies** (`isAlly`, `helpers.ts`): a seat that has revealed the bot's own
Kingdom. A hidden seat could be anyone, so it is not an ally. An Ambitionist is
nobody's ally. A bot whose Kingdom already holds half the table (rounded down)
will become an Ambitionist when it reveals, so it treats nobody as an ally.

**Forces** (`forcesOf`): a Kingdom's living, revealed seats playing for it;
each living Ambitionist is a force of one. A hidden seat belongs to no force.
Each force has a seat count and summed HP.

**The leading force** (`leadingForceOf`): a force with at least 2 seats and
strictly more seats than every other force, while its HP is greater than the
highest HP among the forces with the next most seats. It counts as
**weakened**, and stops leading, as soon as either fails: another force
catches up in seats, or the runner-up force has as much HP. There is then no
leader, and no truce.

**Relations** (`relationOf`), from the bot's side:

| Relation | Who |
|---|---|
| self | the bot |
| ally | as above |
| truce | a seat of a force that is neither the bot's own nor the leading one, while another force leads (Ambitionists included) |
| foe | everyone else: the leading force, hidden seats, and everybody when there is no leader or the bot's own force leads |

**Danger** (`danger.ts`): each skill has a hand rating in content data
(`projects/content/src/data/decks/kingdom-wars/skill-danger.json`): high 2,
medium 1, low 0; Lord skills are not rated. A General's danger is its highest
skill rating plus 10 times its value in `GENERAL_VALUES` (the Identity-fitted
table, by base id). A seat's danger is the sum over its **revealed** Generals
(hidden counts 0). A seat at 2 or more is **dangerous**. Example: a General
with one high-rated skill is dangerous on its own; a medium skill plus a value
of +0.10 also reaches 2.

**Hostile acts** (`hostileActs`, `targeting.ts`): from the log, how many times
a seat has damaged the bot or a revealed ally, or played Sha, Duel, Steal,
Break, Capture, Starvation, Barbarians, Hail of Arrows or Lightning at them
(not as a response). This is the bot's memory of grudges.

## 4. Truce (temporary alliance)

Nothing is announced and no rule of the game changes; each bot just behaves
as if the forces outside the leader have agreed to gang up on it.

**When it forms:** as soon as a force leads (section 3) and the bot is not in
it. Every seat of every other force (not the bot's own) becomes a truce
partner. **When it ends:** the moment the leader is weakened or a force is
wiped out so nobody leads, or the bot's own force becomes the leader. It is
recomputed on every decision.

What changes with a truce partner:

- **Hold fire.** The ranker returns `HOLD_FIRE` for a truce partner below 3 HP
  or not dangerous. Card plays, conversions, filled templates, seat
  selections, registry rules (Chains, Blaze, Trident Glaive, Impetus) and the
  legacy skill picks all skip a `HOLD_FIRE` seat; a play with no other target
  is simply not made.
- **A dangerous partner** (3 HP or more and danger 2 or more) may still be
  attacked, but it always ranks below every leading-force seat.
- **Peach for a dying partner.** In a dying round the bot spends a Peach on a
  truce partner as it would on an ally.
- **Mass attacks.** With a leader on the table, Barbarians / Hail of Arrows
  are played only when enemies strictly outnumber friends: an ally is 1
  friend; a truce partner at 2 HP or less is 1 friend, a healthy one that is
  not dangerous 0.5 friend, a dangerous one 1 enemy; a foe is 1 enemy. With no
  leader, the old count stands: play when non-allies are at least as many as
  allies.
- **Ally Far Attack Near** gives its card to the offered seat the ranker likes
  least, which is a held-fire truce partner when one is offered.

What does not change: a truce partner is still not an ally. It does not count
for Amass or Harvest, its Tools are not cancelled for it with Wuxie, and the
bot answers its attacks as any other (rule C, which would let the bot take a
truce partner's hit, is off).

## 5. Choosing whom to attack

Every attack (cards, conversions, filled templates, registry rules and, since
Part 3, the legacy skill picks) asks the same ranker: `tableRank`
([table-rank.ts](../../projects/bots/src/lib/table-rank.ts)). Higher is
better; allies and the bot itself are filtered out before ranking.

| Term | Weight |
|---|---|
| Seat of the leading force | +1000 |
| The hit would take it to 0 HP (1 HP or less) | +500 |
| Per point of danger | +20 |
| Per hostile act against the bot or an ally (up to 3) | +30 |
| Per HP | −10 |
| Seat index (tiebreak) | −0.01 |

A truce partner is `HOLD_FIRE` unless it has 3 HP or more and is dangerous;
then its score is capped just below the lowest leading-force seat.

So, in practice: the leader first, always; among the rest, a seat one hit from
death, then dangerous revealed Generals, then whoever has been hitting the bot
or its allies, then the lowest HP. Example: with no leader, a revealed General
with a high-rated skill (danger 2) at 4 HP scores about +40 − 40 = 0, and
outranks a hidden seat at 3 HP (danger 0), which scores −30.

Each card then adds its own taste on top of the order: Steal and Break prefer a
seat that wears equipment, Capture the most HP, Starvation and Blockade the
most hand cards, Blaze a seat holding at least one card.

**Legacy skill picks** (rule E1, on with `noWaste`): the older per-skill code
in `skills.ts`, `wind.ts`, `fire.ts`, `forest.ts` and `mountain.ts` that
chooses a seat to harm (Sow Discord, Godspeed, Exile, Instigate and others,
listed in `helpers.ts` above `rankHarmTargets`) now takes its candidates
through the ranker and skips `HOLD_FIRE` seats; picks that aim the bot's own
card at the seat also drop seats where it would be wasted. Picks that help a
seat keep their own logic.

Two older rankers remain for the frozen bots: `weakestFirst` (lowest HP, then
seat order) and `targetScore` (`targeting.ts`), which never shipped.

## 6. Weighing advantage and avoiding waste

The bot has no single "advantage" score. It weighs plays through four kinds
of rule.

**Card-play rules in the ladder** (section 2): Peach whenever hurt, equip only
empty slots, Lightning at 3 HP or more, Wine whenever a Sha follows, mass
attacks by the friends/enemies count. The Stage 1 switches that would make
these stricter (`CardPlayRules` in `card-play.ts`) and the Stage 2 response
switches (`ResponseRules` in `responses.ts`) are all off in `rule-based`.

**The registry's "worth it" rules** (`rules/`):

| Card or skill | When the bot uses it |
|---|---|
| Amass | when it has at least one revealed ally, or a surplus card |
| Ally Far Attack Near | whenever offered, at the seat it likes least |
| Harvest | when allies + itself outnumber foes |
| Ascertain | always as a Recast |
| Chains | if chained itself: itself plus the best unchained foe (or itself alone); else two unchained foes; else Recast; a surplus card may go on one foe. Never an ally, never a chained foe |
| Blaze | at the best foe holding a card, while it has 3 other cards or a surplus card |
| Fire Fan | when every Sha target is a foe, unless the fire would spread through a chain to its own side |
| Trident Glaive | when a foe sits next to the damaged seat and it has a spare card (keep rank 2 or less); hits the best such foe |
| Wuxie Kingdom | only to stop Barbarians or Hail of Arrows on itself or a revealed ally; otherwise it plays a plain Wuxie and keeps Wuxie Kingdom |
| Femme Fatale | whenever offered |
| Impetus for Conflicts | when a foe shows both Generals and the bot holds an Equipment card it would not equip; picks the higher-valued General |
| Benevolence | when an ally exists and it holds more than 3 cards, or is hurt and can reach 3 given this turn |

**Waste checks** (`waste.ts`, rules A and B, on through `noWaste`). Facts come
from content (`wouldStop`, `extraCostOf` in
`projects/content/src/lib/shared/stops.ts`); the bot only reads them.

- **Stopped plays (A1).** A play whose target has a visible stop is dropped: a
  black Sha into Black Shield, a plain Sha into Wood Armor (unless the user's
  weapon ignores armour), a Sha on Liu Shan (Pleasure) when the bot holds no
  other Basic card to pay. For a multi-target play only the stopped seats are
  removed. Mass cards with no chosen target are never dropped (A3).
- **Costly targets (B2).** A Sha on Liu Shan with a Basic card to spare costs
  that card. The bot pays only if Liu Shan ranks above every cost-free target
  of the same card, and either he is at 1 HP or the bot still holds a Shan or a
  Peach after paying.

**Surplus Tools (D1).** Cards above the hand limit would be thrown away in the
Discard Phase anyway, so the Tool rules spend them: Amass with no ally, Chains
on a single foe, Blaze with a small hand.

**No reveal for nothing (D2).** Section 2.

## 7. Responding

When a response window is aimed at it, the bot first decides whether the
window is worth answering, then which card to give.

- **A hit (Sha, Duel, Barbarians, Hail of Arrows).** Today it **answers every
  hit it can**, with the first offered answer (a Shan, or a Sha in a Duel or
  Barbarians); with no real card, a response-time conversion such as Dragon
  Courage or Serpent Spear (the latter only if its 2 cards hold no Peach). Rule
  C, which would take some hits to keep the card (`shouldAnswer` in
  `answer.ts`, `exposure` in `exposure.ts`), and C4's "no Duel the target
  would win", are built but off (`answerRule: false`). The Stage 2 "hold the
  Shan" rule is off too.
- **Dying rounds.** A Peach (a dying bot drinks Wine only without one) only for itself,
  a revealed ally, or a truce partner. Never for a foe or a hidden seat.
- **Wuxie.** Only to cancel a harmful Tool (Barbarians, Hail of Arrows, Duel,
  Steal, Break, Capture, Lightning, Starvation) aimed at **itself**. It does
  not protect allies, does not cancel helpful Tools on foes (the extended
  Stage 2 rule is off), and never counters another Wuxie. Holding both kinds,
  it chooses between Wuxie and Wuxie Kingdom as in section 6.
- **Upheaval and Instigate.** Forced to play a Sha or suffer, it plays the Sha
  only when the seat it would hit is a non-ally (for Instigate, also one the
  ranker does not hold fire on); otherwise it takes the loss.
- **Anything else** (a Wuxie Kongjie counter, unknown windows): pass.

## 8. Picking Generals

At General selection the bot scores each offered pair as value(Main) +
value(Deputy) + 0.0001 × summed max HP, and takes the highest; the first on a
tie (`bestPair`, `general-values.ts`).

In a Kingdom Wars game the values are the Kingdom Wars table
(`general-values.kingdom-wars.data.ts`): fitted by full id against each force's
own strength, so a General is not rated for belonging to a strong force, plus
bonuses for candidate pairs that win more together. Impetus for Conflicts
(hiding a General) uses the same table. In an Identity game the values are
`GENERAL_VALUES` (`general-values.data.ts`): win-rate points a seat gained
holding each General, measured once on 20,000 Identity-deck games at 4 seats
with older bots (Stage 4), looked up by base id.

The danger rating (section 3) still reads `GENERAL_VALUES` by base id, so it
shapes whom bots attack with the old table, and Kingdom Wars-only Generals
count 0 there.

Part 4 shipped by the developer's decision although the all-bot force-gap gate
failed on one run (44.2 points against 32.3 at 8 seats, seed 2600000; see
`docs/deferrals.md`). In all-bot games Qun wins 44 to 49% (about 10% before),
and the leading force wins less often. Against the earlier bot the new picks
gain 6.6 to 7.2 points of seat share.

## 9. The other registered policies

All are in `policies.ts` (`policyById`), for the tournament and balance runs
in `projects/sim`. Only `rule-based` plays people.

| Id | What it is |
|---|---|
| `rule-based` | the shipped bot described here (same picks as `rule-based-picks-kw`) |
| `rule-based-v1`, `rule-based-v2` | the original bot: weakest-first targeting, highest max HP pairs (v2 kept as Stage 4's baseline) |
| `rule-based-v3` | before Kingdom Wars Part 1 (value table, no registry) |
| `rule-based-v4` | end of Part 1 (registry, no table reading) |
| `rule-based-v5` | end of Part 2 (table reading, no waste rules) |
| `rule-based-v6` | end of Part 3, with Identity-table picks for every deck; frozen as Part 4's baseline |
| `rule-based-cards` | Stage 1 experiment: every card-play rule on |
| `rule-based-responses` | Stage 2 experiment: Shan hold and extended Wuxie on |
| `rule-based-picks` | Stage 4 value table on the original bot |
| `rule-based-waste` | Part 3 with rule C on (failed: fewer seats won) |
| `rule-based-waste-no-c` | Part 3 without rule C; what shipped |
| `rule-based-picks-kw` | Part 4 Kingdom Wars value table; `rule-based` now decides the same |

The random bot (`random.ts`) is not a registered policy; the simulator uses it
to explore odd lines of play.

## 10. Known limits and open items

- **Rule C is off.** The bot answers every hit and starts every Duel it can,
  even hopeless ones; it never takes a cheap hit to keep a Shan. Rule C lost
  seats in the Part 3 tournament and waits for a rework (Part 3 spec,
  Results).
- **Qun dominates all-bot games.** With the Kingdom Wars picks Qun wins 44 to
  49% of all-bot games, and the 8-seat force gap failed its gate on one run
  (Part 4 spec, Results; `docs/deferrals.md`). Danger still leans on the
  Identity table.
- **Stage 1 and 2 switches stay off.** Peach, Wine, equipment upgrades,
  discard order, Shan holding and extended Wuxie are built and switchable but
  not in `rule-based`.
- **Legacy per-skill code is not migrated.** Only the harmful seat picks moved
  onto the ranker (rule E); the rest of `skills.ts` and the pack files still
  use their own logic and the plain ally test. Skills move into the registry
  when a part touches them.
- **No reading of hidden Kingdoms.** A hidden seat is always a foe; the bot
  does not infer sides from behaviour.
- **No protecting allies with Wuxie,** and Wuxie Kingdom is only spent on mass
  Tools.
- **Never reveals at the start of a turn,** so a bot's Generals stay hidden
  until it uses a skill or conversion.
- **Engine crash seed.** 8-seat self-play on seed 2600625 throws `Card
  card-103 not found in any zone` in the engine (`docs/deferrals.md`).
