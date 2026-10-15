# Bot Stage 2 — Responses — Design Spec

Status: Approved in conversation (the roadmap); pending written-spec review
Date: 2026-10-15

Part of `docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md`.
Judged by its rule: a variant against the shipped `rule-based` on mirrored
pairs, shipping only if the whole interval is above 0 on two fresh seed ranges.
Stage 1 (`2026-10-15-bot-stage-1-card-play-design.md`) shipped nothing, so the
shipped bot is still the original rule list with weakest-first targeting.

## What the bot does today

(`projects/bots/src/lib/rule-based.ts`, section 2, "Responding".)

When it is the responding seat it answers with the first legal answering card
(a Peach first if there is one), or passes, unless the window is not worth
answering:
- **Dying round:** only for itself or a revealed ally.
- **Wuxie check:** only to cancel a harmful Tool (Barbarians, Hail of Arrows,
  Duel, Steal, Break, Capture, Lightning, Starvation) aimed at **itself**; it
  never counters a Wuxie.
- **Any other window:** answers whenever it can, including every Sha it can
  block with a Shan and every Barbarians, Hail of Arrows or Duel demand.

## What a window tells the bot

A pending response carries `reason` (dying, wuxie, card-effect, ability),
`sourceCard`, and `outcome`: for a Sha's hit, the `DamageEffect` that follows
if the bot does not answer, which has `damage.amount`, `damage.source` and
`damage.target`. The bot reads only these and its own hand.

## Rules

Each rule is a named switch, so they can be measured separately. Both are on in
the variant.

### R1 — Hold the Shan (`shanHold`)

When the bot could answer with a **Shan** and the window's `outcome` is a
`DamageEffect` on the bot itself, it passes (takes the hit) when all three hold:
- the damage would not kill it: `damage.amount < HP`;
- its HP is above 2;
- it holds fewer than 2 Shan.

Otherwise it answers as today. The idea: a lone Shan is worth more against a
lethal hit later than against a 1 HP loss now. A Peach, Wine or Sha answer, and
any window without a `DamageEffect` on the bot, are not affected.

### R2 — Wuxie for allies, and against helpful Tools (`wuxie`)

In a Wuxie check, besides cancelling a harmful Tool aimed at itself, the bot
cancels:
- a **harmful** Tool aimed at a **revealed ally** (same list of harmful Tools);
- a **helpful** Tool (Draw Two, Peach Garden, Harvest) aimed at a **known foe**
  (a seat whose kingdom is revealed and is not the bot's own).

It never cancels a Tool its own seat or a revealed ally used, and it still never
counters a Wuxie.

### Dropped from the roadmap

"Order responses by the value of the card spent" is dropped. In almost every
window only one card definition can answer (Sha, Shan, Wuxie; the dying round
already prefers Peach), so there is nothing to order.

## Design

- `ResponseRules = { shanHold: boolean; wuxie: boolean }`, all `false` for the
  shipped policies, all `true` for the variant.
- `createRuleBasedPolicy(id, rank, rules?, responseRules = NO_RESPONSE_RULES)`;
  the new parameter reaches section 2 of `decide`. With both switches off the
  behaviour is exactly today's.
- The predicates live in `projects/bots/src/lib/responses.ts`
  (`shouldHoldShan`, `wuxieWorthCancelling`), pure functions of the view, to keep
  `rule-based.ts` from growing. `HARMFUL_TOOLS` moves there from `rule-based.ts`
  (as an export) and `HELPFUL_TOOLS` is added.
- `policies.ts` registers the all-on variant as `rule-based-responses`.

## Experiment

1. `rule-based-responses` against `rule-based`, mirrored, 4000 games, first seed
   300000. Ships if the whole interval is above 0 **and** it holds on a second
   range (first seed 400000).
2. If it does not clear, run each rule on its own against `rule-based` on seed
   300000 (two runs). Only a rule that clears alone on 300000 **and** 400000 can
   ship, alone. Nothing else is tuned.
3. Every run goes into `Results` below.

When it ships, the shipped bot is frozen as `rule-based-v2`, `rule-based` takes
the new behaviour, and the app and server need no changes.

## Testing

- `responses.spec.ts`: `shouldHoldShan` on its cases (non-lethal at 3+ HP with one
  Shan holds; two Shan answers; HP 2 or less answers; lethal answers; no
  `DamageEffect` answers; damage on another seat answers); `wuxieWorthCancelling`
  (harmful Tool on an ally cancels; on a hidden seat does not; helpful Tool on a
  known foe cancels; on an ally or hidden seat does not; a Tool used by an ally
  does not).
- `rule-based.spec.ts`: with both switches off the policy answers as before; with
  each on it passes or cancels in the cases above.
- `policies.spec.ts`: the new id is registered.
- Tournaments are scripts, not unit tests.

## Acceptance

Either the variant (or one rule) ships under the experiment rule, or the results
show it did not and `rule-based` is unchanged.

## Results

(Filled in after the experiment.)
