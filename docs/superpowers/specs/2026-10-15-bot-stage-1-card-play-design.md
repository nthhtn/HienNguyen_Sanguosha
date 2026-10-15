# Bot Stage 1 — Card Play — Design Spec

Status: Approved in conversation (the roadmap); pending written-spec review
Date: 2026-10-15

Part of `docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md`.
It is judged by the rule in that spec: a variant policy against the shipped
`rule-based` on mirrored pairs, shipping only if the whole interval is above 0
on two fresh seed ranges.

## What the bot does today

(`projects/bots/src/lib/rule-based.ts`, Play and Discard phases.)

- **Peach:** plays one on itself whenever below max HP.
- **Wine:** plays Wine whenever a Sha at a non-ally is legal.
- **Equipment:** equips a card only into an empty slot, never swapping.
- **Discarding:** throws away the card with the lowest `keepRank`: Peach 4,
  Shan 3, Sha, Wine and Draw Two 2, equipment 1, every other Tool 0. So at the
  Discard phase it keeps spare equipment over a Wuxie, a Duel or a Steal.

## Rules

Each rule is a named switch so they can be measured separately. All are on in
the variant.

### R1 — Peach (`peach`)

In its own Play phase the bot plays a Peach on itself only when it is below
max HP **and** one of these holds:
- its HP is 2 or less; or
- it holds more hand cards than its HP (it would discard at the end of the turn,
  and playing the Peach both uses a card and raises the hand limit).

Otherwise it keeps the Peach for a dying round. It also keeps its last Peach
while a revealed ally has HP 2 or less. Peach Garden is not changed.

### R2 — Wine (`wine`)

The bot plays Wine (or Dong Zhuo's Wine conversion) only when a Sha is legal
**and** the Sha it would play goes to a target with HP 2 or less, so the extra
point is lethal. With a healthier target it keeps the Wine, which also still
saves it in its own dying round.

### R3 — Equipment (`equipment`)

Besides filling an empty slot, the bot replaces a worn card in the same slot
when the new card is better:
- **Weapon:** by `weaponRange`, with Crossbow counted as range 4 (it removes
  the Sha limit, which this bot uses).
- **Armor:** by a fixed order, best first: Eight Trigrams, Silver Lion, Black
  Shield, Wood Armor.
- **Mounts:** never replaced.

The replaced card goes to the discard pile as the engine already does.

### R4 — Discard ranking (`discard`)

At the Discard phase (only) the bot loses the card with the lowest
**discard rank**, first in hand on ties: Peach 6, Shan 5, Wuxie 5, Sha 4,
Wine 3, any other Tool 2, equipment 1, anything else 0. `keepRank` is not
changed, because skills use it for other decisions.

R4 also covers the roadmap's "keep a Shan and Peach reserve": the two are
the last cards the bot discards.

## Design

- `CardPlayRules = { peach: boolean; wine: boolean; equipment: boolean; discard: boolean }`,
  all `false` for the shipped `rule-based` and `rule-based-v1`, all `true` for
  the variant.
- `createRuleBasedPolicy(id, rank, rules = NO_CARD_PLAY_RULES)`; the rules go
  to `decide` next to the ranker. With every switch off the behaviour is
  exactly today's, which the existing specs and a tournament of the two
  identical policies (0.0 pp) confirm.
- New code lives in `projects/bots/src/lib/card-play.ts` (the rule predicates
  and `discardRank`), keeping `rule-based.ts` from growing.
- `policies.ts` registers the all-on variant as `rule-based-cards` and gains
  `registerPolicy(policy)` so experiments can add single-rule variants without
  editing the registry file. `sim`'s `BOT_KINDS` accepts any registered id.

## Experiment

1. `rule-based-cards` against `rule-based`, mirrored, 4000 games, first seed
   100000. Ships if the whole interval is above 0 **and** it holds on a second
   range (first seed 200000).
2. If it does not clear, run each rule on its own against `rule-based` on seed
   100000 (four runs), for diagnosis. Only a rule that clears alone on
   seed 100000 **and** on 200000 can ship, alone. Nothing else is tuned.
3. Every run, including failures, goes into `Results` below.

When it ships, the shipped bot is frozen as `rule-based-v2`, `rule-based` takes
the new behaviour, and the app and server need no changes.

## Testing

- `card-play.spec.ts`: `discardRank` order; the Peach rule on its four cases
  (HP 2 or less, hand above HP, healthy and light hand, ally at 2 HP); the
  Wine rule (lethal target, healthy target, none legal); the equipment rule
  (empty slot, better weapon, worse weapon, Crossbow, armor order, mount).
- `rule-based.spec.ts`: with every switch off the policy picks what it did
  before (the existing tests), and with each switch on it picks the new
  action in the cases above.
- `policies.spec.ts`: `registerPolicy`, the new id, and unknown ids still
  rejected.
- The tournaments are scripts, not unit tests.

## Acceptance

Either the variant (or one rule) ships under the experiment rule above, or the
results show it did not and nothing changes in `rule-based`.

## Results

(Filled in after the experiment.)
