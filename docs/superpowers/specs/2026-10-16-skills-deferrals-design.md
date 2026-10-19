# Skills Deferrals — Design Spec

Status: Draft for review
Date: 2026-10-16

## Purpose

Close the deferred review items about the skill engine, the General skills and
their bots that still reproduce. Every item was re-checked against the code on
2026-10-16; items that were already fixed are listed under "Dropped". This is the
second of four deferral specs (Engine, Skills, Backend, Frontend). The Engine
spec is merged (`67c0539`) and this spec builds on its redaction work.

## Goals

1. The skill engine enforces the rules it documents (reveal-to-use, the
   no-decision rule for `onSelect`).
2. Each General skill that deviates from its spec rule text behaves as written.
3. Bots stop making plainly bad choices for the skills below.
4. The engine names no card or skill (layering).

## Non-goals and anti-goals

- No new Generals, cards or skills.
- No change to the decision-id scheme or to recorded action shapes. Games in
  progress at deploy may stop as `outdated` on replay (accepted by the user for
  the Engine work; the same applies here).
- Blockade (Xu Huang's +1 range only while revealed) stays as it is; the user
  chose to keep it.
- No bot strength work beyond the four bot items below.

## Decisions

Rule text is written here first, as CLAUDE.md requires. Items marked
"user decision" were chosen by the user on 2026-10-16; the rest are my calls
(taken from the existing stage specs, which stay the authority).

### Skill engine

**S1. `needsReveal` is enforced (user decision: auto-reveal).** Rule: *using an
optional skill of a hidden General reveals that General first.* Today the reveal
happens only because every optional trigger goes through `ask()`, which becomes
`AskUseEffect` and adds `RevealGeneralEffect` on Use. The pipeline
(`afterTriggerFollowUps`, `rewriteEffect` in `pipeline/resolve.ts`) never reads
`needsReveal`. New behaviour: when a trigger marked `needsReveal` produces
effects that contain neither an ask nor a `RevealGeneralEffect`, the pipeline puts
a `RevealGeneralEffect` for that skill's General in front of them. Before-triggers cannot take the reveal (it would have to run ahead of the effect they rewrite, and the rewritten effect would be offered to the before-triggers again), so a hidden General's before-trigger that returns direct effects instead of an ask throws, as a loud content bug; every current before-trigger asks (Nirvana and Refusing Death included). Scope: triggers
only. Active skills and conversions already add the reveal themselves
(`pipeline/resolve.ts` ~631 and ~658-661). The General revealed is the one in the
trigger owner's slot (`owner.slot`), which is also right for a borrowed or Form
skill (its owner slot is the slot holding it). The builder
also reports which content, if any, takes this path (it would break the "optional
abilities always ask" rule and should be fixed in content, not hidden).

**S2. The Lord flag has one guard (user decision: keep both, add a guard spec).**
The General data JSON (`lord: true`, read by the Wiki) and
`SkillDefinition.lord` (read by the engine) both stay. Add a registry spec that
asserts, for every General, that the two agree. No data-pipeline change.

**S3. The `onSelect` no-decision guard gets its spec.** The guard already exists
(`SelectAction` throws "An onSelect effect of X opened a decision" when a choice,
selection, arrangement or response window opened). Add the missing spec: a
selection whose `onSelect` opens a decision throws; one whose reveal follow-ups
are only queued does not.

**S13. The engine type names no card.** `AbilityModifiers.extraShaTargetsWhenLastCard`
becomes a card-keyed field, `extraTargetsWhenLastCard?: Record<string, number>`
(Sky Scorcher sets `{ sha: 2 }`, its current value; `cards/sha.ts` reads the `sha` entry). Behaviour
is unchanged; the comment that says "the engine never reads them" stays true.

**S14. `JUDGMENT_CHANGERS` is an explicit registry.** Today `shared/judgments.ts`
seeds the map with Devil and `generals/wind.ts` calls
`JUDGMENT_CHANGERS.set('dark-magic', …)` at import time, so Dark Magic exists only
if `wind.ts` was imported. Replace the import side effect with explicit
registration that happens whenever the content registry is built, so every
registered General's judgment changer is present. Spec: building the registry
without importing `wind.ts` first still lets Dark Magic change a judgment.

### Skill rules (as the stage specs already write them)

**S9. Borrowed and gained skills fire on death.** Heartbroken (*when a seat kills
her, that seat loses all its skills, on both Generals, including gained and
borrowed skills*) must also work when Zuo Ci holds it through Incarnation. The
after-death loop in `skills/triggers.ts` reads only the dead seat's printed
Generals; it must also read `seat.gainedSkills` and the chosen Form
(`seat.forms.chosen`), for any `afterDeath` skill (Heartbroken is the only one
today, so no other outcome changes). The silenced killer loses its own gained and
borrowed skills too, which the existing `silenced` flag already does. Spec: Zuo Ci with Heartbroken chosen dies to a killer; the
killer is silenced.

**S10. A Form chosen at Start fires in that Start.** Incarnation chooses a Form
skill on `after:PhaseChangedEvent` Start, but the after-triggers of an event are
all gathered before any resolves, so the new skill misses them. Rule: *a Form skill
chosen at the start of his turn takes part in that same Start, as if held from the
beginning.* Scope: Incarnation's Form choice
(`ChooseFormSkillEffect`) only; other mid-event skill gains are unchanged. The
firing follows the choice, whichever of its three triggers asked (Start, End, or the
reveal path): the newly chosen skill's after-triggers for the event that caused the
choice fire. The reveal path is a no-op today, since no Form skill has an
`after:GeneralRevealedEvent` trigger. After it
resolves, the after-triggers of that one newly chosen skill for the event being
resolved are gathered and queued; before-triggers of that event have already
passed and are not replayed; the previously chosen Form's triggers, if already
gathered, are not recalled; no other skill fires twice. Spec: Zuo Ci chooses a Start-trigger skill at his own Start and
it fires once at that Start; a Form skill with an End trigger chosen at End fires once at that End.

**S11. Bewilder.** Two fixes.
- *Engine/content:* when Bewilder answers a response window and the lie fails (the
  card is discarded), the window re-opens only if the seat still has a legal answer
  other than Pass, read from the engine's own `getLegalActions` for that seat (so
  conversions and other skills count; equipment such as Eight Trigrams does not, because it is asked before the window opens); if it
  has none, the window resolves as no response without asking. Spec: a lie with an empty hand and no other answer does not
  re-open the window; with a real Shan in hand it does. (Eight Trigrams cannot be staged here: it is asked before the window opens, not offered inside it, so a seat wearing it has already answered or declined it when Bewilder is used; declined, a failed lie re-opens nothing, which a spec records.)
- *Bot:* stage 8 says Yu Ji's bot *names only what the card truly is, unless it
  holds more than 4 cards, when it may bluff with its least useful card; it prefers
  true claims on hearts.* The code gates every deferred use on `hand > 4`, so the
  bot never Bewilders with 4 or fewer cards. Gate only the bluff on `> 4`.

**S12. Alliance.** User decision: *Cancel at the second seat pick cancels the whole
use and refunds the once-per-turn use* (nothing is paid or swapped before both picks
and the discard are confirmed). The current step order stays: first-seat selection (cancellable) → `second` (a
seat choice) → `pay` (a card selection) → `swap`, where the discard and the swap
happen, so nothing is paid before `swap`. The use is counted when the first
selection confirms (`IncrementEffect` in its `onSelect`), so a cancel at the
second pick, and also at the `pay` card selection (my call, same rule), must undo
that count. Cancel is an option of the existing choice or the selection's
`onCancel`; no new action kind and no decision-id change. The hidden General stays revealed after a cancel (the reveal happens when the first pick confirms and cannot be undone); only the use count is refunded. Bot: the second pick must
keep the total cost at 2 or fewer (the first-pick pairing already does), and never
falls back to the first seat offered.

### Hidden information

**S5 is closed by the Engine work.** A declined ask's `ChoiceMadeEvent` is now
redacted per viewer, and the sim property check scans events for other seats'
hidden skill ids. Nothing further here.

### Wording and history (casing follows CLAUDE.md; Vietnamese updated too)

**S7. History lines follow the stage 8 spec.**
- Refusing Death: "Seat 1's Refusing Death: 7 ♠ (no match)" and
  "Seat 1's Refusing Death: 7 ♠ matched" (the turned card is public; it lies face up
  in the pile). The code's current "no match, Seat 0 stays alive" lines are
  replaced.
- Fantasy gets a history handler: "Seat 1's Fantasy moved the damage to Seat 3".
  Today the log shows "used Fantasy", the discard, then a generic "chose Seat 3".

**S8. Instigate wording.** The target's window reads "Use a Sha on Jiang Wei"
(sentence case). The Pass button reads "Pass (Discard 1 Card)" (a button, so Title
Case under CLAUDE.md; the stage 11 spec's lowercase form is superseded for casing).
Vietnamese follows its own sentence-case rules.

**S15d. Selection text is keyed on the skill and its step.** `STEP_SELECTION_TEXT`
is keyed on the generic step name `pay`, but no selection leads to a step named
`pay` (Alliance's pay selection leads to `swap`, Lament's to `judge`), so
Alliance's discard prompt never uses its own text and any future `pay` step would
show Alliance's. Key the table on `<skillId>/<step>` and fix the Alliance entry.

### Bots

**S6.** `leastShownSuit` (bots/src/lib/skills.ts) counts `CardPlayedEvent` only; its
own comment says it also counts cards shown from the hand. It must count
`CardShownEvent` too.

**S15b.** Sow Discord, Displace and Marriage choices fall back to the first seat
offered (`seats[0]`), which can be an ally or a foe. Rule: when no suitable seat
exists the bot cancels if the decision offers a cancel (a selection with
`onCancel`, or a choice with a cancel option); otherwise it picks the least harmful
seat (a non-ally for a harmful effect, an ally for a helpful one; the builder reads
each skill's text for which it is). No protocol change.

**S15c.** Blaze's `blaze-shown` and `blaze-hit` discards must not discard a Peach
unless it is the only eligible card.

## Dropped (already fixed, or not a fault)

S4 top-N draw-pile helper (`drawPileTop` exists and Astrology uses it); S15a bots and
`mayReveal` for conversions (`skills.ts` returns false when `needsReveal && !mayReveal`);
S5 (see above); Blockade (kept as is).

## Moved to the Frontend spec

The dying prompt saying "Peaches" when the viewer can drink Wine (E5).

## Constraints

- The engine stays framework-free and names no card or skill (S13 enforces it).
- Content must not change engine behaviour except through the registry hooks above.
- Existing specs stay green; behaviour that the stage specs describe is the
  authority when code and spec differ (S7, S8, S11).
- Rule text above is written before code. The plan must restate each rule as the
  spec for its task.
- Run the sim leak property check and `npm run test:db` as part of acceptance, since
  S1 and S10 touch the pipeline.

## Left to the builder

How the pipeline detects "contains neither an ask nor a reveal" (S1); how a new
skill's triggers for the current event are gathered once (S10); how the Alliance
use count is refunded (S12); the registration mechanism for judgment changers (S14);
the exact bot code for S15b's "least harmful"; spec file names.
