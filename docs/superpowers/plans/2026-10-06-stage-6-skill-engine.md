# Stage 6: The Skill Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Make a General's skills real abilities, gathered from its seat the way worn cards' abilities are: triggers, modifiers, conversions and Play-Phase active skills.
- Hidden Generals: optional and active skills are offered as "Reveal X to use Y"; compulsory skills and modifiers stay off; Lord skills are never in play.
- Give skills the engine pieces stage 7 needs: per-turn use counts and game-long marks, losing HP, the Draw Phase as a step, judgments in three steps (with replacing and taking the card), seat/suit/label choices, giving cards, and arranging the top of the draw pile.
- Show it all: skill buttons on your avatar, the Ask window's reveal wording, seat and suit options, an Arrange window, new Action History lines, and the wiki's gender and Lord notes.
- No new cards, and no real General skills yet: the five placeholder skills stay until stage 7 replaces them.

**Architecture:**
- **Engine (generic, names no card or skill):**
  - `SkillDefinition` becomes `Abilities` plus `id`, `compulsory`, `lord`, `active` and `onJudged`. A General's ability owner gains `skillId`.
  - `skillsInPlay(state, seatId, registry)` is the one place that decides which skills count: a revealed General's all; a hidden General's non-compulsory ones, marked `needsReveal`; Lord skills never. Triggers, conversions, active skills and content's modifiers all read it.
  - Reveal to use: an `AskUseEffect` for a hidden General's skill puts the reveal at the front of its Use option. A conversion or active skill of a hidden General reveals when its first selection is confirmed (`PendingSelection.onSelect`), so Cancel leaves the General hidden.
  - Active skills: `UseSkillAction`, listed in the owner's Play Phase while `canUse` holds and the turn count is under `usesPerTurn`. The count is spent with the first answer.
  - Counters: `Turn.abilityUses`, `Seat.marks`, `IncrementEffect`, and `Turn.ownerUses` (every card the turn owner used this turn, responses included).
  - `LoseHpEffect` / `HpLostEvent`; `DrawPhaseEffect`.
  - Judgments run as `JudgeEffect` (turn the card up) → `JudgmentShownEffect` (changers' moment) → `JudgmentResolveEffect` (the reader reads) → `JudgmentDoneEffect` (to the discard pile, unless taken). A reader is a card or a skill. `ReplaceJudgmentEffect` swaps the card.
  - Decisions: choice options for a seat, a suit or a label; a `give` selection continuation; `pendingArrangement` with `ArrangeCardsAction`.
- **Content:** modifiers from revealed Generals; placeholder skills marked compulsory; skill names and the Lord flag from the General data; Guozhan's Draw Phase and HP-drop triggers on the new effects; delayed Tools and Eight Trigrams on the new judgment shape.
- **Around the engine:** bots reveal by the spec's rule and arrange the draw pile; the sim checks the new decision; the app gains avatar skill buttons, reveal wording, seat/suit/label options, the Arrange window and history lines.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 with Angular CDK drag-drop (app tasks).

**Spec:**
- `docs/superpowers/specs/2026-10-05-general-skills-design.md`: "Common rules", "Engine design (stage 6)", "Bots" (the generic rules), "UI", "Testing".
- `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`: the stage table and the decisions (reveal to use; Lord skills inactive; "may" always asks).

**Already built in earlier stages (not redone here):**
- Gender data on all 57 Generals, `GeneralDefinition.gender` and content's `seatGender` (stage 5).
- Abilities on worn cards, `atStep`/`askAtStep`, `AskUseEffect`, selections, conversions, `previewEffect` (stage 5).
- `skipFlagOf(phase)` works for every phase but End, so `skipDiscard` needs no new code, only a test.

**Where this plan departs from the spec, and why:**
- **No `hasLord` on the mode.** Lord skills are never gathered, in any mode: Guozhan is the only mode, and it has no Lord. A mode with a Lord would add the flag. Cost if wrong: one parameter threaded through `skillsInPlay` later.
- **`Turn.ownerUses` instead of `Turn.shaUsed`.** The engine names no card, so it counts every card the turn owner used this turn, by what it counted as, responses included. Self-Restraint reads `ownerUses.sha`.
- **The use of a conversion or active skill happens when its first selection is confirmed.** The reveal of a hidden General, the turn count and the "used" log all wait for the confirm (`PendingSelection.onSelect`). Cancel leaves nothing done, the General still hidden. The spec has the reveal "before anything else"; this keeps its intent (reveal to use) without revealing for a use that never happens.
- **No `RetargetStepEffect`.** A step is plain data: Displace (stage 7) rewrites the Sha step's `target` in its before-trigger, like Ancient Scimitar rewrites `extra`.
- **`JudgeEffect` stays as the first judgment step.** It turns the card up; `JudgmentShownEffect`, `JudgmentResolveEffect` and `JudgmentDoneEffect` follow. Its `tool` field becomes `reader` (a card or a skill).
- **A reader may place the judgment's Done step itself.** `onJudged` receives `done`; if its effects include it, the engine doesn't add another at the end. Eight Trigrams uses this so its judged card is in the discard pile before the Shan window opens (stage 5's Review Focus 4).
- **Stage 5 follow-ups folded in:**
  - `JudgeEffect.otherwise` runs when nothing is left to judge with, so Eight Trigrams no longer loses the Sha's step.
  - `atStep` abilities don't fire on an eliminated target.
- **The seat series with Done (Raid, Sow Discord) waits for stage 7.** Stage 6 adds the seat option; stage 7 composes the series where it is first used.
- **The placeholder skills stay until stage 7**, marked `compulsory` (they never asked). So they are now off while their General is hidden. Their tests reveal the General.
- **The sim invariant "a hidden General never fires a compulsory skill" waits for stage 7**, where skills log their use. Stage 6 pins the rule with gathering tests.
- **Skill names come from the data.** A skill's id is its English name in kebab case (`skillIdOf("Heaven's Envy")` is `heavens-envy`). Content's `abilityName(id)` gives a card's or a skill's display name.
- **Lord skills are flagged in the data** (`"lord": true`, the nine "King Ability" skills), so the wiki can say "Not used in Guozhan".
- **The Ask window's Use button reads "Reveal and Use"** when a reveal is needed. The prompt carries the full sentence: "Reveal Guan Yu to use Fighting Saint?".
- **History for an active skill.** Its use logs an `AbilityUsedEvent` with outcome `used`: "Seat 1 used Reconsider". Stage 7 adds what each skill did.

## Global Constraints

- **The engine names no card or skill.** Content supplies everything specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** Continuations, readers and asks hold data, never functions. Absent optional state is left out (`pendingArrangement` absent, not `null`).
- **Common rules (General Skills spec):**
  - A hidden General's skills are off. Optional triggers, active skills and conversions are still offered, as "Reveal X to use Y"; using one reveals that General first. Compulsory triggers and modifiers of a hidden General don't apply.
  - Gender: Main's while revealed, else Deputy's while revealed, else none.
  - Lord skills (Escort, Fierce General, Rescued) are inactive in Guozhan. The wiki shows them with the note "Not used in Guozhan".
  - Losing HP is not damage. It has no source, and nothing that reacts to damage applies. A seat at 0 HP or below after losing HP is dying, as after damage.
- **Active skills:** listed as one `UseSkillAction` while `canUse` holds and the turn count is below `usesPerTurn`. The first decision is cancellable, which undoes the use: the count is spent only once the first decision is answered.
- **Arranging:** `top` and `bottom` together must be exactly the given cards. `top[0]` becomes the top of the draw pile; `bottom` goes under the pile in the order given. The cards are visible only to the arranging seat.
- **Bots (spec, generic part):** reveal for a skill only when the use passes the bot's rule, and the bot's kingdom is already revealed or it holds at least 4 HP. Astrology-style arranging: Peach, Shan and Sha on top, everything else at the bottom.
- **UI text** follows CLAUDE.md's UI text style: buttons Title Case ("Reveal and Use", "Top", "Bottom", "Confirm"), prompts and history lines sentence case with keywords capitalised (General, Main General, HP, card names, skill names).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Declining a hidden General's ask.** Don't leaves the General hidden and logs no reveal; Use reveals it before the skill's effect, and the reveal's log line names the skill. (Test in Task 3.)
2. **Cancelling an active skill's first selection.** The turn count stays unspent, a hidden General stays hidden, nothing is logged, and the skill is offered again in the same Play Phase. (Test in Task 4.)
3. **A judgment replaced twice.** Both replaced cards end in the discard pile, the reader reads the last card, and `processing` is empty afterwards. (Test in Task 6.)
4. **Losing HP to 0.** The dying round starts and a Peach saves; no `after:DamageDealtEvent` trigger fires. (Test in Task 5.)
5. **Pausing on an arrangement.** It survives a JSON round trip and resumes identically. The arranging seat's redacted view shows the cards' faces; every other seat's view masks them. (Test in Task 7.)

---

## File Structure

**Engine (`projects/engine/src/lib/`)**
- Create:
  - `skills/generalSkills.ts`: `skillsInPlay`, `skillOf`, `abilityUseKey`.
  - `rules/arrangement.ts`: `validateArrangement`.
  - Tests: `skills/generalSkills.spec.ts`, `pipeline/reveal.spec.ts`, `pipeline/activeSkill.spec.ts`, `pipeline/hpAndDraw.spec.ts`, `pipeline/arrangement.spec.ts`.
- Modify:
  - `domain/types.ts`: `GeneralOwner` and `skillId`; `Turn.abilityUses`/`ownerUses`; `Seat.marks`; the `use` option's `reveals`; seat/suit/label options and the `pick`/`give` verbs; `PendingSelection.onSelect`; the `give` and `replace-judgment` continuations; `JudgmentReader`, `Judgment`; `PendingArrangement` and `GameState.pendingArrangement`.
  - `registry/types.ts`: `SkillDefinition`, `ActiveSkill`, `ActiveContext`, `SkillJudgedContext`, `JudgedContext.done`.
  - `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/actions.ts`, `pipeline/resolve.ts`, `pipeline/judgment.ts`.
  - `skills/triggers.ts`, `rules/legality.ts`, `rules/activeSeat.ts` (`decisionPending`), `domain/redact.ts`, `public-api.ts`.
  - Tests updated: `skills/triggers.spec.ts`, `skills/equipmentAbilities.spec.ts`, `pipeline/resolve.spec.ts`, `pipeline/judgment.spec.ts`, `pipeline/cardStep.spec.ts`, `pipeline/selection.spec.ts`, `pipeline/choice.spec.ts`, `domain/redact.spec.ts`, `rules/phaseSequence.spec.ts`.

**Content (`projects/content/`)**
- Modify:
  - `src/lib/shared/abilities.ts` (`activeAbilities` adds revealed Generals' skills), `src/lib/shared/steps.ts` (owner key; eliminated target), `src/lib/shared/delayed.ts`.
  - `src/lib/generals/setOne.ts`, `setTwo.ts` (compulsory) and their specs.
  - `src/lib/cards/equipment/eight-trigrams.ts`.
  - `src/lib/modes/guozhan.ts` (`DrawPhaseEffect`; HP-drop triggers on `HpLostEvent` too).
  - `src/lib/display.ts` (`skillIdOf`, `abilityName`), `src/lib/wiki.ts` (gender, Lord).
  - `data/generals/index.ts` (`lord?`), the nine Lord-skill data files, `scripts/restructure-content-data.py`.
- Create: `src/lib/shared/abilities.spec.ts`, `src/lib/shared/steps.spec.ts`.

**Bots / sim:** `bots/src/lib/rule-based.ts`, `bots/src/lib/random.ts`, `sim/src/invariants.ts` and their specs.

**App (`projects/app/src/app/`)**
- Create: `game-board/avatar-skills.ts`, `game-board/arrange-dialog.ts`, and their specs.
- Modify: `game-board/ability-description.ts`, `ask-dialog.ts`, `choice-description.ts`, `choice-dialog.ts`, `seat-avatar.ts`, `seat-tile.ts`, `round-table.ts`, `game-board.ts`, `action-history.ts`, `response-description.ts`, `action-list.ts`, `labels.ts`, `decision-timer.service.ts`, `wiki/wiki-general-entry.ts`.

**Docs:** `docs/architecture/event-chain.md`.

---
### Task 1: Skills as abilities — the shape, the owner, and which skills are in play

**Files:**
- Create: `projects/engine/src/lib/skills/generalSkills.ts`, `projects/engine/src/lib/skills/generalSkills.spec.ts`
- Modify: `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/skills/triggers.ts`, `projects/engine/src/lib/rules/legality.ts`, `projects/engine/src/public-api.ts`
- Test fixtures updated: `projects/engine/src/lib/skills/triggers.spec.ts`, `projects/engine/src/lib/skills/equipmentAbilities.spec.ts`, `projects/engine/src/lib/pipeline/resolve.spec.ts`

**Interfaces:**
- Consumes: `Abilities`, `Conversion`, `gatherTriggeredSkills`, `conversionsOf`, `OwnedConversion`, `sameAbilityOwner` (stage 5).
- Produces:
  - `AbilityOwner` general variant `{ kind: 'general'; seatId: string; slot: 'main' | 'deputy'; skillId: string }`; `type GeneralOwner = Extract<AbilityOwner, { kind: 'general' }>`.
  - `interface SkillDefinition extends Abilities { id: string; compulsory?: boolean; lord?: boolean }` (Task 4 adds `active`, Task 6 adds `onJudged`).
  - `interface SkillInPlay { owner: GeneralOwner; skill: SkillDefinition; needsReveal: boolean }`.
  - `skillsInPlay(state: GameState, seatId: string, registry: ContentRegistry): SkillInPlay[]`.
  - `skillOf(state: GameState, owner: GeneralOwner, registry: ContentRegistry): SkillDefinition | undefined`.
  - `GatheredTrigger.needsReveal?: boolean`; `OwnedConversion.needsReveal?: boolean`.
  - `conversionsOf` lists a seat's Generals' conversions (Main, then Deputy) before its worn cards'.

- [ ] **Step 1: Write the failing test**

Create `projects/engine/src/lib/skills/generalSkills.spec.ts`:

```ts
import { GameState, Seat } from '../domain/types';
import { createRng } from '../rng/rng';
import { ContentRegistry, GameModeDefinition, SkillDefinition, SkillTrigger } from '../registry/types';
import { skillOf, skillsInPlay } from './generalSkills';
import { gatherTriggeredSkills } from './triggers';
import { conversionsOf } from '../rules/legality';

const onX = (): SkillTrigger => ({ point: 'after:X', condition: () => true, effect: () => [] });
const iron: SkillDefinition = { id: 'iron', compulsory: true, triggers: [onX()], modifiers: { shaLimit: 2 } };
const hint: SkillDefinition = { id: 'hint', triggers: [onX()] };
const crown: SkillDefinition = { id: 'crown', lord: true, triggers: [onX()] };
const forge: SkillDefinition = { id: 'forge', conversions: [{ id: 'forge', as: 'bolt', cards: 2, when: 'both' }] };
const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    ['smith', { id: 'smith', kingdom: 'Wei', maxHp: 4, skills: [iron, hint, crown] }],
    ['seer', { id: 'seer', kingdom: 'Wei', maxHp: 3, skills: [forge] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };

function table(mainRevealed: boolean, deputyRevealed: boolean, eliminated = false): GameState {
  const seat: Seat = {
    id: 'a', index: 0, kingdom: 'Wei', combinedHp: 3, maxCombinedHp: 3, eliminated,
    generals: { main: { generalDefinitionId: 'smith', revealed: mainRevealed }, deputy: { generalDefinitionId: 'seer', revealed: deputyRevealed } },
    hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' },
  };
  return {
    seats: [seat], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [{ id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
const owner = (slot: 'main' | 'deputy', skillId: string) => ({ kind: 'general' as const, seatId: 'a', slot, skillId });

describe('skills in play', () => {
  it('a revealed General: every skill but a Lord skill, with no reveal needed', () => {
    expect(skillsInPlay(table(true, true), 'a', registry).map((s) => [s.owner, s.needsReveal])).toEqual([
      [owner('main', 'iron'), false],
      [owner('main', 'hint'), false],
      [owner('deputy', 'forge'), false],
    ]);
  });

  it('a hidden General: compulsory skills are off; the others need a reveal', () => {
    expect(skillsInPlay(table(false, false), 'a', registry).map((s) => [s.owner.skillId, s.needsReveal])).toEqual([
      ['hint', true],
      ['forge', true],
    ]);
  });

  it('a Lord skill is never in play, and an eliminated seat has none', () => {
    expect(skillsInPlay(table(true, true), 'a', registry).some((s) => s.skill.lord)).toBe(false);
    expect(skillsInPlay(table(true, true, true), 'a', registry)).toEqual([]);
  });

  it('skillOf finds a skill by its owner, hidden or not', () => {
    expect(skillOf(table(false, false), owner('main', 'iron'), registry)).toBe(iron);
    expect(skillOf(table(false, false), owner('main', 'nope'), registry)).toBeUndefined();
  });

  it('gathers triggers from skills in play only, marking those that need a reveal', () => {
    const hidden = gatherTriggeredSkills(table(false, true), registry, mode, 'after:X', {});
    expect(hidden.map((g) => [g.owner, g.needsReveal])).toEqual([[owner('main', 'hint'), true]]);
    const shown = gatherTriggeredSkills(table(true, true), registry, mode, 'after:X', {});
    expect(shown.map((g) => [g.owner, g.needsReveal])).toEqual([[owner('main', 'iron'), undefined], [owner('main', 'hint'), undefined]]);
  });

  it('a General’s conversions are the seat’s, marked when they need a reveal', () => {
    expect(conversionsOf(table(true, false), 'a', registry)).toEqual([
      { owner: owner('deputy', 'forge'), abilityId: 'forge', conversion: forge.conversions![0], needsReveal: true },
    ]);
    expect(conversionsOf(table(true, true), 'a', registry)[0]).not.toHaveProperty('needsReveal');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/engine/src/lib/skills/generalSkills.spec.ts`
Expected: FAIL — `Cannot find module './generalSkills'`.

- [ ] **Step 3: The owner and the skill shape**

In `projects/engine/src/lib/domain/types.ts`, replace the `AbilityOwner` type and its comment with:

```ts
// Who an ability belongs to: a General's skill (the seat and slot it was
// gathered for, since the same General can be held by more than one seat, and
// the skill's id), or a worn card (its wearer and the card).
export type AbilityOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy'; skillId: string }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };

export type GeneralOwner = Extract<AbilityOwner, { kind: 'general' }>;
```

In `projects/engine/src/lib/registry/types.ts`, replace `SkillDefinition` with:

```ts
// A General's skill: abilities like a worn card's, owned by the General's seat.
export interface SkillDefinition extends Abilities {
  id: string;
  // Applies without asking. Off while its General is hidden (see skillsInPlay).
  compulsory?: boolean;
  // A Lord skill: never in play, since Guozhan has no Lord.
  lord?: boolean;
}
```

- [ ] **Step 4: `skillsInPlay` and `skillOf`**

Create `projects/engine/src/lib/skills/generalSkills.ts`:

```ts
import { GameState, GeneralOwner } from '../domain/types';
import { ContentRegistry, SkillDefinition } from '../registry/types';

// One skill of a seat's Generals that is in play, and whether using it
// reveals its General first (the General is hidden).
export interface SkillInPlay {
  owner: GeneralOwner;
  skill: SkillDefinition;
  needsReveal: boolean;
}

const SLOTS = ['main', 'deputy'] as const;

// The skills of `seatId`'s Generals that are in play, Main first, in skill
// order. All of a revealed General's. A hidden General's compulsory skills are
// off (its modifiers with them); its other skills are offered, but using one
// reveals it. Lord skills never are: Guozhan has no Lord. An eliminated
// seat has none.
export function skillsInPlay(state: GameState, seatId: string, registry: ContentRegistry): SkillInPlay[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.eliminated || !seat.generals) return [];
  const found: SkillInPlay[] = [];
  for (const slot of SLOTS) {
    const general = seat.generals[slot];
    for (const skill of registry.generals.get(general.generalDefinitionId)?.skills ?? []) {
      if (skill.lord || (!general.revealed && skill.compulsory)) continue;
      found.push({ owner: { kind: 'general', seatId, slot, skillId: skill.id }, skill, needsReveal: !general.revealed });
    }
  }
  return found;
}

// The skill behind a General owner, whether or not it is in play now.
export function skillOf(state: GameState, owner: GeneralOwner, registry: ContentRegistry): SkillDefinition | undefined {
  const general = state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot];
  return general && registry.generals.get(general.generalDefinitionId)?.skills.find((s) => s.id === owner.skillId);
}
```

Add to `projects/engine/src/public-api.ts`, after the `triggers` export:

```ts
export * from './lib/skills/generalSkills';
```

- [ ] **Step 5: Gather triggers from skills in play**

In `projects/engine/src/lib/skills/triggers.ts`:
- Add `import { skillsInPlay } from './generalSkills';`.
- Give `GatheredTrigger` a third field, after `owner`:

```ts
  // A hidden General's skill: using it reveals the General first.
  needsReveal?: boolean;
```

- Remove `GENERAL_SLOTS` and replace the Generals loop (the `for (const seat of state.seats)` block that reads `seat.generals[slot]`) with:

```ts
  // Generals' skills in play, seat by seat (see skillsInPlay).
  for (const seat of state.seats) {
    for (const { owner, skill, needsReveal } of skillsInPlay(state, seat.id, registry)) {
      for (const trigger of skill.triggers ?? []) {
        if (trigger.point === point) candidates.push({ trigger, owner, ...(needsReveal ? { needsReveal } : {}) });
      }
    }
  }
```

- [ ] **Step 6: Generals' conversions, and owners compared by skill**

In `projects/engine/src/lib/rules/legality.ts`:
- Add `import { skillsInPlay } from '../skills/generalSkills';`.
- Replace `OwnedConversion`, `sameAbilityOwner` and `conversionsOf` with:

```ts
export interface OwnedConversion {
  owner: AbilityOwner;
  // The ability's id: the skill's id, or the worn card's definition id.
  abilityId: string;
  conversion: Conversion;
  // A hidden General's: using it reveals the General.
  needsReveal?: boolean;
}

export function sameAbilityOwner(a: AbilityOwner, b: AbilityOwner): boolean {
  if (a.kind === 'equipment' && b.kind === 'equipment') return a.seatId === b.seatId && a.cardInstanceId === b.cardInstanceId;
  if (a.kind === 'general' && b.kind === 'general') return a.seatId === b.seatId && a.slot === b.slot && a.skillId === b.skillId;
  return false;
}

// Every conversion `seatId` has: its Generals' skills in play (Main, then
// Deputy), then the cards it wears, in zone order.
export function conversionsOf(state: GameState, seatId: string, registry: ContentRegistry): OwnedConversion[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.eliminated) return [];
  const fromSkills = skillsInPlay(state, seatId, registry).flatMap(({ owner, skill, needsReveal }) =>
    (skill.conversions ?? []).map((conversion): OwnedConversion => ({ owner, abilityId: skill.id, conversion, ...(needsReveal ? { needsReveal } : {}) }))
  );
  const worn = state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? [];
  const fromCards = worn.flatMap((card) =>
    (registry.cards.get(card.definitionId)?.abilities?.conversions ?? []).map((conversion): OwnedConversion => ({
      owner: { kind: 'equipment', seatId, cardInstanceId: card.instanceId },
      abilityId: card.definitionId,
      conversion,
    }))
  );
  return [...fromSkills, ...fromCards];
}
```

- [ ] **Step 7: Run it to see it pass**

Run: `npx jest projects/engine/src/lib/skills/generalSkills.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Bring the old engine fixtures to the new shape**

Run: `npx tsc -p projects/engine/tsconfig.spec.json --noEmit 2>&1 | head -40` (or `npx jest projects/engine` and read the type errors).
Expected: errors in `triggers.spec.ts`, `equipmentAbilities.spec.ts` and `resolve.spec.ts`, where test skills still say `activation: 'auto'` and expected owners have no `skillId`.

Fix each fixture:
- Delete every `activation: 'auto',` line (and the `activation: 'auto'` inside one-line skill objects). These test skills stay non-compulsory, so they are still gathered while their test Generals are hidden.
- Add the skill's id to every expected General owner, e.g. `{ kind: 'general', seatId: 'seat-a', slot: 'main' }` becomes `{ kind: 'general', seatId: 'seat-a', slot: 'main', skillId: '<that test skill's id>' }`.
- Where a test compares a whole `GatheredTrigger` with `toEqual`, add `needsReveal: true` (the test Generals are hidden).

Run: `npx jest projects/engine`
Expected: PASS, every engine test.

- [ ] **Step 9: Commit**

```bash
git add projects/engine
git commit -m "feat(engine): General skills as abilities, gathered by skillsInPlay

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Content — skills in play, skill names, the Lord flag, and the wiki

**Files:**
- Create: `projects/content/src/lib/shared/abilities.spec.ts`, `projects/content/src/lib/shared/steps.spec.ts`
- Modify: `projects/content/src/lib/shared/abilities.ts`, `projects/content/src/lib/shared/steps.ts`, `projects/content/src/lib/generals/setOne.ts`, `projects/content/src/lib/generals/setTwo.ts`, `projects/content/src/lib/generals/setOne.spec.ts`, `projects/content/src/lib/generals/setTwo.spec.ts`, `projects/content/src/lib/display.ts`, `projects/content/src/lib/display.spec.ts`, `projects/content/src/lib/wiki.ts`, `projects/content/src/lib/wiki.spec.ts`, `projects/content/data/generals/index.ts`, the nine data files below, `scripts/restructure-content-data.py`, `projects/app/src/app/wiki/wiki-general-entry.ts`, `projects/app/src/app/wiki/wiki-entries.spec.ts`

**Interfaces:**
- Consumes: `skillsInPlay`, `GeneralOwner` (Task 1).
- Produces:
  - `activeAbilities(state, seatId, registry)` returns the seat's revealed Generals' skills (as `Abilities`) before its worn cards'.
  - `skillIdOf(name: string): string` — "Heaven's Envy" → `heavens-envy`.
  - `abilityName(abilityId: string): string` — a card's name, else a base or expansion skill's name from the data, else the id in Title Case.
  - `GeneralSkillData.lord?: boolean`; `WikiSkill.lord: boolean`; `WikiGeneral.gender: 'male' | 'female'`.
  - `atStep` rules don't fire when the step's target is eliminated.

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/shared/abilities.spec.ts`:

```ts
import type { ContentRegistry, GameState } from 'engine';
import { createRng } from 'engine';
import { shaLimit } from './queries';

// A General whose compulsory skill lifts the Sha limit (a Roar-like modifier).
const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    ['roarer', { id: 'roarer', kingdom: 'Shu', maxHp: 4, skills: [{ id: 'roar-test', compulsory: true, modifiers: { shaLimit: Infinity } }] }],
    ['plain', { id: 'plain', kingdom: 'Shu', maxHp: 4, skills: [] }],
  ]),
};

function table(revealed: boolean): GameState {
  return {
    seats: [{
      id: 'a', index: 0, kingdom: 'Shu', combinedHp: 4, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: 'roarer', revealed }, deputy: { generalDefinitionId: 'plain', revealed: false } },
      hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' },
    }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [{ id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('active abilities from Generals', () => {
  it('a revealed General’s modifier applies', () => {
    expect(shaLimit(table(true), 'a', registry)).toBe(Infinity);
  });

  it('a hidden General’s compulsory modifier doesn’t', () => {
    expect(shaLimit(table(false), 'a', registry)).toBe(1);
  });
});
```

Create `projects/content/src/lib/shared/steps.spec.ts`:

```ts
import type { ContentRegistry, GameState } from 'engine';
import { createRng } from 'engine';
import { atStep, cardStep } from './steps';

const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const owner = { kind: 'equipment' as const, seatId: 'a', cardInstanceId: 'w' };
const step = cardStep('sha-armor', { as: 'sha', colour: 'black', physical: [] }, 'a', { kind: 'seat', seatId: 'b' });

function table(bEliminated: boolean): GameState {
  const seat = (id: string, index: number, eliminated: boolean) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated, generals: null,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0, false), seat('b', 1, bEliminated)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play', zones: [], pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('atStep', () => {
  const trigger = atStep(['sha-armor'], { effect: () => [] });

  it('acts at a named step on a living target', () => {
    expect(trigger.condition(table(false), step, owner, registry)).toBe(true);
  });

  it('never acts on an eliminated target (stage 5 follow-up)', () => {
    expect(trigger.condition(table(true), step, owner, registry)).toBe(false);
  });
});
```

In `projects/content/src/lib/display.spec.ts`, add (merge `abilityName, skillIdOf` into the existing import from `./display`):

```ts
describe('skill names', () => {
  it('a skill id is its English name in kebab case, apostrophes dropped', () => {
    expect(skillIdOf("Heaven's Envy")).toBe('heavens-envy');
    expect(skillIdOf('Self-Restraint')).toBe('self-restraint');
    expect(skillIdOf('Fighting Saint')).toBe('fighting-saint');
  });

  it('names a card, a skill from the data, or else the id in Title Case', () => {
    expect(abilityName('eight-trigrams')).toBe('Eight Trigrams');
    expect(abilityName('kindness')).toBe('Kindness');
    expect(abilityName('heavens-envy')).toBe("Heaven's Envy");
    expect(abilityName('ferocity')).toBe('Ferocity');
  });
});
```

In `projects/content/src/lib/wiki.spec.ts`, add:

```ts
describe('wiki Generals: gender and Lord skills', () => {
  const general = (id: string) => wikiGenerals().find((g) => g.id === id)!;

  it('shows each General’s gender', () => {
    expect(general('diao-chan').gender).toBe('female');
    expect(general('lu-bu').gender).toBe('male');
  });

  it('flags the Lord skills, which Guozhan doesn’t use', () => {
    expect(general('liu-bei').skills.map((s) => [s.name, s.lord])).toEqual([['Kindness', false], ['Fierce General', true]]);
    const lords = wikiGenerals().flatMap((g) => g.skills.filter((s) => s.lord).map((s) => s.name)).sort();
    expect(lords).toEqual(['Amber Sky', 'Bloodline', 'Escort', 'Exaltation', 'Fierce General', 'Rescued', 'Seem Foolish', 'Takeover', 'Violent Tyrant']);
  });
});
```

(Add `wikiGenerals` to the spec's import from `./wiki` if it isn't there.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/content/src/lib/shared projects/content/src/lib/display.spec.ts projects/content/src/lib/wiki.spec.ts`
Expected: FAIL — `shaLimit` is 1 for the revealed General; `atStep` acts on the eliminated target; `skillIdOf`/`abilityName` are not exported; `gender`/`lord` are undefined.

- [ ] **Step 3: Modifiers from revealed Generals**

Replace `activeAbilities` in `projects/content/src/lib/shared/abilities.ts` (and add `skillsInPlay` to the `engine` value import — the file has only a type import now, so add `import { skillsInPlay } from 'engine';`):

```ts
// Every ability active for a seat: its revealed Generals' skills (a hidden
// General's modifiers don't apply), then the cards it wears. Queries read
// modifiers through this, never by card or skill id.
export function activeAbilities(state: GameState, seatId: string, registry: ContentRegistry): Abilities[] {
  const skills = skillsInPlay(state, seatId, registry).filter((s) => !s.needsReveal).map((s) => s.skill);
  const seat = state.seats.find((s) => s.id === seatId);
  const worn = seat ? (state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? []) : [];
  return [
    ...skills,
    ...worn.flatMap((card) => {
      const abilities = registry.cards.get(card.definitionId)?.abilities;
      return abilities ? [abilities] : [];
    }),
  ];
}
```

- [ ] **Step 4: Step keys by skill, and no ability on an eliminated target**

In `projects/content/src/lib/shared/steps.ts`:
- Replace `ownerKey` with:

```ts
const ownerKey = (owner: AbilityOwner) => (owner.kind === 'equipment' ? owner.cardInstanceId : `${owner.seatId}:${owner.slot}:${owner.skillId}`);
```

- In `atStep`'s `condition`, add the living-target check:

```ts
    condition: (state, subject, owner, registry) => {
      const step = subject as CardStep;
      const targetLiving = state.seats.some((s) => s.id === step.target.seatId && !s.eliminated);
      return !!owner && !!registry && steps.includes(step.step) && targetLiving && !hasActed(step, owner) && (rule.condition?.(state, step, owner, registry) ?? true);
    },
```

- Update `atStep`'s comment: add "It never acts on an eliminated target."

- [ ] **Step 5: The placeholder skills are compulsory**

In `projects/content/src/lib/generals/setOne.ts` and `setTwo.ts`, replace each `activation: 'auto',` with `compulsory: true,`. In each file's header comment add one line: "Placeholders until stage 7: compulsory, so off while their General is hidden."

In `setOne.spec.ts` and `setTwo.spec.ts`, every seat built to hold the skill's General gets that General revealed: change `{ generalDefinitionId: generalId, revealed: false }` to `revealed: true`, and likewise for the `zhuge-liang` and `sun-shangxiang` overrides. Add one test to `setOne.spec.ts`'s `describe('Xiahou Dun — Ferocity')`:

```ts
  it('is off while Xiahou Dun is hidden', () => {
    const state = stateWithMainGeneral('xiahou-dun');
    const hidden: GameState = {
      ...state,
      phase: 'Play',
      seats: state.seats.map((s) => (s.id === 'seat-a' ? { ...s, generals: { ...s.generals!, main: { ...s.generals!.main, revealed: false } } } : s)),
    };
    const { state: next } = resolve(
      hidden, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'card-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, { registry: registry(), mode: stubMode() });
    expect(next.seats.find((s) => s.id === 'seat-b')!.combinedHp).toBe(4); // 6 - 2, no +1
  });
```

- [ ] **Step 6: Skill names**

In `projects/content/src/lib/display.ts`, add:

```ts
// A skill's id: its English name in kebab case, apostrophes dropped
// ("Heaven's Envy" → "heavens-envy"). Stage 7's skills use these ids.
export function skillIdOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const SKILL_NAMES: ReadonlyMap<string, string> = new Map(
  Object.values(generalsData).flatMap((g) => g.skills.map((s): [string, string] => [skillIdOf(s.name), s.name]))
);

const titleCase = (id: string) => id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// The name of an ability, for any text: a worn card's name, else a skill's
// name from the General data, else its id in Title Case.
export function abilityName(abilityId: string): string {
  return cardDisplayData(abilityId)?.name ?? SKILL_NAMES.get(abilityId) ?? titleCase(abilityId);
}
```

- [ ] **Step 7: The Lord flag in the data**

Flag the nine "King Ability" skills. Run from the repo root:

```bash
python3 - <<'EOF'
import json, glob
for path in glob.glob('projects/content/data/generals/*/*.json'):
    with open(path, encoding='utf-8') as f:
        raw = f.read()
    data = json.loads(raw)
    changed = False
    for skill in data['skills']:
        if skill['text'].startswith('King Ability'):
            skill['lord'] = True
            changed = True
    if changed:
        out = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(out + ('\n' if raw.endswith('\n') else ''))
        print(path)
EOF
```

Expected: nine paths printed (cao-cao, cao-pi, liu-bei, liu-shan, sun-quan, sun-ce, dong-zhuo, yuan-shao, zhang-jiao). `git diff --stat` shows only those files, each with one added line per Lord skill.

In `projects/content/data/generals/index.ts`, give `GeneralSkillData` the flag:

```ts
export interface GeneralSkillData {
  name: string;
  nameZh: string;
  text: string;
  // A Lord skill ("King Ability"): not used in Guozhan.
  lord?: boolean;
}
```

In `scripts/restructure-content-data.py`, find where it writes the `GeneralSkillData` interface lines and add the same `lord?: boolean;` line (with its comment), so a rerun regenerates the same type.

- [ ] **Step 8: The wiki's gender and Lord notes**

In `projects/content/src/lib/wiki.ts`:
- `WikiSkill` gains `lord: boolean;` (comment: "A Lord skill: not used in Guozhan.").
- `WikiGeneral` gains `gender: 'male' | 'female';`.
- In `wikiGenerals()`, map skills as `{ name: s.name, nameZh: s.nameZh || null, text: s.text, lord: !!s.lord }` and add `gender: data.gender,`.

In `projects/app/src/app/wiki/wiki-general-entry.ts`:
- In `.meta`, after the expansion tag, add `<span class="gender-tag">{{ general().gender === 'female' ? 'Female' : 'Male' }}</span>`.
- In the skill `<li>`, after the skill text, add:

```html
              @if (skill.lord) {
                <span class="lord-note">Not used in Guozhan</span>
              }
```

- Styles: `.gender-tag` like `.expansion-tag`; `.lord-note { display: block; font: var(--mat-sys-body-small); font-style: italic; color: var(--mat-sys-on-surface-variant); }`.

In `projects/app/src/app/wiki/wiki-entries.spec.ts`, add a test that renders the Liu Bei entry (as the file's other General tests do) and expects `.gender-tag` to read "Male" and one `.lord-note` reading "Not used in Guozhan".

- [ ] **Step 9: Run them to see them pass**

Run: `npx jest projects/content projects/app/src/app/wiki`
Expected: one known failure in `guozhan.spec.ts`: "draws 3 cards (2 base + 1 Zhuge Liang bonus)" seats Zhuge Liang hidden, so Insight no longer fires. Reveal him in that test (seat-c's deputy: `revealed: true` in the `state` it builds), and rerun: PASS. Any other test that relied on a placeholder firing while hidden gets the same fix, ledgered as a ruling (the placeholders follow the compulsory rule).

- [ ] **Step 10: Commit**

```bash
git add projects/content projects/app/src/app/wiki scripts/restructure-content-data.py
git commit -m "feat(content): Generals' modifiers in play, skill names, Lord skills flagged

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reveal to use — asks, conversions, and `onSelect`

**Files:**
- Create: `projects/engine/src/lib/pipeline/reveal.spec.ts`
- Modify: `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/events.ts`, `projects/engine/src/lib/pipeline/resolve.ts`

**Interfaces:**
- Consumes: `skillsInPlay`, `OwnedConversion.needsReveal`, `GeneralOwner` (Task 1).
- Produces:
  - `RevealGeneralEffect.forAbilityId?: string` → `GeneralRevealedEvent.forAbilityId?: string`.
  - `ChoiceOption['shows']` use variant `{ kind: 'use'; reveals?: 'main' | 'deputy' }`.
  - `PendingSelection.onSelect?: Effect[]`: resolved, in order, when the picks are confirmed, before the continuation. They must not pause (no decisions).
  - An `AskUseEffect` whose owner is a hidden General's skill: Use = reveal (with `forAbilityId`) then `effects`; the option shows `reveals`.
  - A `UseConversionAction` of a hidden General: its selection's `onSelect` reveals the General.

- [ ] **Step 1: Write the failing test**

Create `projects/engine/src/lib/pipeline/reveal.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { Effect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner, PendingSelection } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { getLegalActions } from '../rules/legality';

// Bolt: no target; played, its user draws 1.
const bolt: CardDefinition = { id: 'bolt', name: 'Bolt', category: 'basic', legalPlayTargets: () => [[]], play: (_s, ctx) => [{ kind: 'DrawCardsEffect', seatId: ctx.seatId, count: 1 }] };
const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', legalPlayTargets: () => [], play: () => [] };
// Forge: 2 hand cards as a Bolt, in the Play Phase or to answer.
const forge: SkillDefinition = { id: 'forge', conversions: [{ id: 'forge', as: 'bolt', cards: 2, when: 'both' }] };
const hint: SkillDefinition = { id: 'hint' };
const registry: ContentRegistry = {
  cards: new Map([[bolt.id, bolt], [filler.id, filler]]),
  generals: new Map([
    ['smith', { id: 'smith', kingdom: 'Wei', maxHp: 4, skills: [forge] }],
    ['seer', { id: 'seer', kingdom: 'Wei', maxHp: 4, skills: [hint] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit: 'club', rank: 5 });
const hintOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'deputy', skillId: 'hint' };
const forgeOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'forge' };

// Seat a (turn owner, Play Phase): Main 'smith', Deputy 'seer', both hidden; holds k1, k2.
function table(queue: Effect[] = [], revealed = false): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'smith', revealed }, deputy: { generalDefinitionId: 'seer', revealed } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const s: GameState = {
    seats: [seat('a', 0), { ...seat('b', 1), generals: null }], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('k1'), card('k2')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, ...(queue.length ? { resolutionQueue: queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
  return advanceToDecision(s, ctx).state;
}
const ask: Effect = { kind: 'AskUseEffect', owner: hintOwner, abilityId: 'hint', effects: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] };
const choose = (s: GameState, optionId: string) => resolve(s, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: s.pendingChoice!.id, optionId }, ctx).state;
const kinds = (s: GameState) => s.log.map((e) => e.kind);

describe('reveal to use: asks (Review Focus 1)', () => {
  it('a hidden General’s ask says it reveals; Use reveals the General first, naming the skill', () => {
    const s = table([ask]);
    expect(s.pendingChoice!.options[0].shows).toEqual({ kind: 'use', reveals: 'deputy' });
    const used = choose(s, 'use');
    expect(used.seats[0].generals!.deputy.revealed).toBe(true);
    expect(used.log.filter((e) => e.kind !== 'ChoiceMadeEvent')).toEqual([
      { kind: 'GeneralRevealedEvent', seatId: 'a', slot: 'deputy', forAbilityId: 'hint' },
      { kind: 'CardsDrawnEvent', seatId: 'a', cardInstanceIds: ['d1'] },
    ]);
  });

  it('Don’t leaves the General hidden and logs no reveal', () => {
    const declined = choose(table([ask]), 'decline');
    expect(declined.seats[0].generals!.deputy.revealed).toBe(false);
    expect(kinds(declined)).toEqual(['ChoiceMadeEvent']);
  });

  it('a revealed General’s ask needs no reveal', () => {
    expect(table([ask], true).pendingChoice!.options[0].shows).toEqual({ kind: 'use' });
  });

  it('a paused reveal ask survives a JSON round trip', () => {
    const s = table([ask]);
    expect(choose(JSON.parse(JSON.stringify(s)), 'use')).toEqual(choose(s, 'use'));
  });
});

describe('reveal to use: conversions', () => {
  const convert = (s: GameState) => {
    const action = getLegalActions(s, 'a', registry).find((a) => a.kind === 'UseConversionAction')!;
    return resolve(s, action, ctx).state;
  };

  it('a hidden General’s conversion is offered, and reveals only when its cards are confirmed', () => {
    const opened = convert(table());
    expect(opened.seats[0].generals!.main.revealed).toBe(false);
    expect(opened.pendingSelection!.onSelect).toEqual([{ kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main', forAbilityId: 'forge' }]);
    const used = resolve(opened, { kind: 'SelectAction', seatId: 'a', selectionId: opened.pendingSelection!.id, ids: ['k1', 'k2'] }, ctx).state;
    expect(used.seats[0].generals!.main.revealed).toBe(true);
    expect(kinds(used)).toEqual(['SelectionMadeEvent', 'GeneralRevealedEvent', 'CardPlayedEvent', 'CardMovedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
    expect(used.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'bolt', via: { owner: forgeOwner, abilityId: 'forge' } } });
  });

  it('Cancel leaves the General hidden', () => {
    const opened = convert(table());
    const cancelled = resolve(opened, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: opened.pendingSelection!.id }, ctx).state;
    expect(cancelled.seats[0].generals!.main.revealed).toBe(false);
    expect(cancelled.log).toEqual([]);
  });
});

describe('onSelect', () => {
  it('runs when the picks are confirmed, before the continuation', () => {
    const selection: PendingSelection = {
      id: 'sel', seatId: 'a', reason: { kind: 'ability', owner: hintOwner, abilityId: 'hint' }, of: 'cards', eligibleIds: ['k1'], min: 1, max: 1,
      then: { kind: 'discard' }, onSelect: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }],
    };
    const s = table([{ kind: 'OpenSelectionEffect', selection }]);
    const next = resolve(s, { kind: 'SelectAction', seatId: 'a', selectionId: 'sel', ids: ['k1'] }, ctx).state;
    expect(kinds(next)).toEqual(['SelectionMadeEvent', 'CardsDrawnEvent', 'CardMovedEvent']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/engine/src/lib/pipeline/reveal.spec.ts`
Expected: FAIL — the ask's Use option shows `{ kind: 'use' }` with no `reveals`; `forAbilityId` and `onSelect` don't exist.

- [ ] **Step 3: Types**

In `projects/engine/src/lib/domain/types.ts`:
- In `ChoiceOption['shows']`, replace `{ kind: 'use' }` with `{ kind: 'use'; reveals?: 'main' | 'deputy' }`, and extend the comment: "`reveals`: Use reveals that hidden General first."
- In `PendingSelection`, after `onCancel`, add:

```ts
  // Resolved, in order, the moment the picks are confirmed, before the
  // continuation: a hidden General's reveal, an active skill's use being
  // counted. They must not open a decision.
  onSelect?: Effect[];
```

In `projects/engine/src/lib/pipeline/effects.ts`, change the reveal effect to:

```ts
  // `forAbilityId`: revealed to use that skill (the history names it).
  | { kind: 'RevealGeneralEffect'; seatId: string; slot: 'main' | 'deputy'; forAbilityId?: string }
```

In `projects/engine/src/lib/pipeline/events.ts`, `GeneralRevealedEvent` gains:

```ts
  // Set when it was revealed to use that skill.
  forAbilityId?: string;
```

- [ ] **Step 4: Applying a reveal, and the ask's reveal**

In `applyEffect`'s `RevealGeneralEffect` case, build the event as:

```ts
      const event: EngineEvent = {
        kind: 'GeneralRevealedEvent',
        seatId: effect.seatId,
        slot: effect.slot,
        ...(effect.forAbilityId ? { forAbilityId: effect.forAbilityId } : {}),
      };
```

Replace the `AskUseEffect` case with:

```ts
    case 'AskUseEffect': {
      const owner = state.seats.find((s) => s.id === effect.owner.seatId);
      // An owner who is out can't be asked: what happens otherwise goes ahead.
      if (!owner || owner.eliminated) return { state: queueFront(state, effect.otherwise ?? []), events: [] };
      // A hidden General's skill: Use reveals it first.
      const hidden = effect.owner.kind === 'general' && owner.generals && !owner.generals[effect.owner.slot].revealed ? effect.owner.slot : null;
      const reveal: Effect[] = hidden ? [{ kind: 'RevealGeneralEffect', seatId: owner.id, slot: hidden, forAbilityId: effect.abilityId }] : [];
      const choice: PendingChoice = {
        id: `ask-${effect.abilityId}-${owner.id}-${state.log.length}`,
        seatId: owner.id,
        reason: { kind: 'ability', owner: effect.owner, abilityId: effect.abilityId, ...(effect.targetSeatId ? { targetSeatId: effect.targetSeatId } : {}) },
        verb: 'use',
        options: [
          { id: 'use', shows: { kind: 'use', ...(hidden ? { reveals: hidden } : {}) }, effects: [...reveal, ...effect.effects] },
          { id: 'decline', shows: { kind: 'decline' }, effects: effect.otherwise ?? [] },
        ],
      };
      return { state: { ...state, pendingChoice: choice }, events: [] };
    }
```

- [ ] **Step 5: `onSelect`, and a hidden General's conversion**

In `projects/engine/src/lib/pipeline/resolve.ts`, replace the `SelectAction` case with:

```ts
    case 'SelectAction': {
      const error = validateSelection(state, action);
      if (error) throw new Error(error);
      const selection = state.pendingSelection!;
      const { pendingSelection: _done, ...cleared } = state;
      // Logged for the history; nothing reacts to it.
      const event: SelectionMadeEvent = { kind: 'SelectionMadeEvent', seatId: action.seatId, reason: selection.reason, of: selection.of, ids: action.ids };
      let current = logged(cleared, [event]);
      const events: GameEvent[] = [event];
      // What confirming does at once (a reveal, a use counted), before the continuation.
      for (const effect of selection.onSelect ?? []) {
        const step = resolveEffect(current, effect, ctx);
        current = step.state;
        events.push(...step.events);
      }
      const continued = continueSelection(current, selection, action.ids, ctx);
      return { state: continued.state, events: [...events, ...continued.events] };
    }
```

In the `UseConversionAction` case, after building `selection`, add the reveal (and change `const selection` to build it with the reveal included):

```ts
      // A hidden General's conversion reveals it once the cards are confirmed.
      const reveal: Effect[] =
        owned.needsReveal && owned.owner.kind === 'general'
          ? [{ kind: 'RevealGeneralEffect', seatId: action.seatId, slot: owned.owner.slot, forAbilityId: owned.abilityId }]
          : [];
      return { state: { ...state, pendingSelection: reveal.length ? { ...selection, onSelect: reveal } : selection }, events: [] };
```

(replacing the old `return { state: { ...state, pendingSelection: selection }, events: [] };`).

- [ ] **Step 6: Run it to see it pass**

Run: `npx jest projects/engine/src/lib/pipeline/reveal.spec.ts`
Expected: PASS (7 tests).

Run: `npx jest projects/engine projects/content`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add projects/engine
git commit -m "feat(engine): reveal a hidden General to use its skill

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Active skills and counters

**Files:**
- Create: `projects/engine/src/lib/pipeline/activeSkill.spec.ts`
- Modify: `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/pipeline/actions.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/rules/legality.ts`, `projects/engine/src/lib/skills/generalSkills.ts`, `projects/app/src/app/labels.ts`, `projects/app/src/app/game-board/action-list.ts`

**Interfaces:**
- Consumes: `skillsInPlay`, `SkillInPlay` (Task 1); `PendingSelection.onSelect` (Task 3).
- Produces:
  - `interface ActiveContext { seatId: string; owner: GeneralOwner }`.
  - `interface ActiveSkill { usesPerTurn?: number; canUse(state, ctx: ActiveContext, registry): boolean; start(state, ctx: ActiveContext, registry): unknown[] }`; `SkillDefinition.active?: ActiveSkill`.
  - `Action` `{ kind: 'UseSkillAction'; seatId: string; owner: AbilityOwner }`.
  - `activeSkillActions(state, seatId, registry): UseSkillAction[]` (in `legality.ts`), listed by `getLegalActions` in the Play Phase.
  - `abilityUseKey(owner: GeneralOwner): string` = `seatId/slot/skillId`; `Turn.abilityUses?: Record<string, number>`.
  - `Effect` `{ kind: 'IncrementEffect'; scope: 'turn' | 'seat'; key: string; by: number; seatId?: string }` (`seatId` required for `'seat'`); `Seat.marks?: Record<string, number>`.
  - `Turn.ownerUses?: Record<string, number>`: every card the turn owner used this turn, by what it counted as, responses included.
  - Using an active skill: reveal (if hidden), `IncrementEffect`, then `AbilityUsedEffect { outcome: 'used' }` — spent at once, or, when `start` opens with a cancellable selection, through that selection's `onSelect`.

- [ ] **Step 1: Write the failing test**

Create `projects/engine/src/lib/pipeline/activeSkill.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { Action } from './actions';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { getLegalActions } from '../rules/legality';
import { applyEffect } from './effects';

const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', legalPlayTargets: () => [], play: () => [] };
// Study (once per turn, needs a hand card): discard 1 hand card, then draw 1. Cancellable.
const study: SkillDefinition = {
  id: 'study',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => (state.zones.find((z) => z.id === `${seatId}:hand`)?.cards.length ?? 0) > 0,
    start: (state, { seatId, owner }) => [{
      kind: 'OpenSelectionEffect',
      selection: {
        id: `study-${state.log.length}`, seatId, reason: { kind: 'ability', owner, abilityId: 'study' }, of: 'cards',
        eligibleIds: state.zones.find((z) => z.id === `${seatId}:hand`)!.cards.map((c) => c.instanceId), min: 1, max: 1,
        then: { kind: 'discard', then: [{ kind: 'DrawCardsEffect', seatId, count: 1 }] }, onCancel: [],
      },
    }],
  },
};
// Rally (any number of times): draw 1. No decision.
const rally: SkillDefinition = { id: 'rally', active: { canUse: () => true, start: (_s, { seatId }) => [{ kind: 'DrawCardsEffect', seatId, count: 1 }] } };
const registry: ContentRegistry = {
  cards: new Map([[filler.id, filler]]),
  generals: new Map([
    ['scholar', { id: 'scholar', kingdom: 'Wu', maxHp: 4, skills: [study] }],
    ['captain', { id: 'captain', kingdom: 'Wu', maxHp: 4, skills: [rally] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'filler', suit: 'club', rank: 5 });
const studyOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'study' };
const rallyOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'deputy', skillId: 'rally' };
const useSkill = (owner: GeneralOwner): Action => ({ kind: 'UseSkillAction', seatId: 'a', owner });

// Seat a (turn owner, Play Phase): Main 'scholar', Deputy 'captain'; holds k1.
function table(revealed = true, phase: GameState['phase'] = 'Play'): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wu' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'scholar', revealed }, deputy: { generalDefinitionId: 'captain', revealed } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), { ...seat('b', 1), generals: null }], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase,
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('k1')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
const skillActions = (s: GameState, seatId = 'a') => getLegalActions(s, seatId, registry).filter((a) => a.kind === 'UseSkillAction');
const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const used = (s: GameState) => s.log.filter((e) => e.kind === 'AbilityUsedEvent');

describe('active skills', () => {
  it('are offered in their owner’s Play Phase while canUse holds', () => {
    expect(skillActions(table())).toEqual([useSkill(studyOwner), useSkill(rallyOwner)]);
    expect(skillActions(table(), 'b')).toEqual([]);
    expect(skillActions(table(true, 'Discard'))).toEqual([]);
    const emptyHand = table();
    emptyHand.zones = emptyHand.zones.map((z) => (z.id === 'a:hand' ? { ...z, cards: [] } : z));
    expect(skillActions(emptyHand)).toEqual([useSkill(rallyOwner)]);
  });

  it('with no decision, the use is counted and logged at once', () => {
    const next = act(table(), useSkill(rallyOwner));
    expect(next.turn.abilityUses).toEqual({ 'a/deputy/rally': 1 });
    expect(used(next)).toEqual([{ kind: 'AbilityUsedEvent', owner: rallyOwner, abilityId: 'rally', outcome: 'used' }]);
    expect(next.log.at(-1)).toMatchObject({ kind: 'CardsDrawnEvent', seatId: 'a' });
    // Unlimited: still offered.
    expect(skillActions(next)).toContainEqual(useSkill(rallyOwner));
  });

  it('a first selection is confirmed: the use is counted, then the skill goes on; once per turn', () => {
    const opened = act(table(), useSkill(studyOwner));
    expect(opened.turn.abilityUses).toBeUndefined();
    const done = act(opened, { kind: 'SelectAction', seatId: 'a', selectionId: opened.pendingSelection!.id, ids: ['k1'] });
    expect(done.turn.abilityUses).toEqual({ 'a/main/study': 1 });
    expect(done.log.map((e) => e.kind)).toEqual(['SelectionMadeEvent', 'AbilityUsedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
    expect(skillActions(done)).toEqual([useSkill(rallyOwner)]);
  });

  it('cancelling the first selection undoes the use (Review Focus 2)', () => {
    const opened = act(table(false), useSkill(studyOwner));
    const cancelled = act(opened, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: opened.pendingSelection!.id });
    expect(cancelled.turn.abilityUses).toBeUndefined();
    expect(cancelled.seats[0].generals!.main.revealed).toBe(false);
    expect(cancelled.log).toEqual([]);
    expect(cancelled.phase).toBe('Play');
    expect(skillActions(cancelled)).toContainEqual(useSkill(studyOwner));
  });

  it('a hidden General’s skill is offered, and using it reveals the General', () => {
    expect(skillActions(table(false))).toEqual([useSkill(studyOwner), useSkill(rallyOwner)]);
    const next = act(table(false), useSkill(rallyOwner));
    expect(next.seats[0].generals!.deputy.revealed).toBe(true);
    expect(next.log[0]).toEqual({ kind: 'GeneralRevealedEvent', seatId: 'a', slot: 'deputy', forAbilityId: 'rally' });
  });

  it('a new turn starts with no uses counted', () => {
    const spent = act(act(table(), useSkill(studyOwner)), { kind: 'SelectAction', seatId: 'a', selectionId: 'study-0', ids: ['k1'] });
    const ended = act(spent, { kind: 'EndPhaseAction', seatId: 'a' });
    expect(ended.turn.ownerSeatId).toBe('b');
    expect(ended.turn.abilityUses).toBeUndefined();
  });

  it('an action that isn’t offered is refused', () => {
    expect(() => act(table(true, 'Discard'), useSkill(rallyOwner))).toThrow();
    expect(() => act(table(), { kind: 'UseSkillAction', seatId: 'a', owner: { ...studyOwner, skillId: 'nope' } })).toThrow('can’t use');
  });

  it('a paused first selection survives a JSON round trip', () => {
    const opened = act(table(false), useSkill(studyOwner));
    const select = (s: GameState) => act(s, { kind: 'SelectAction', seatId: 'a', selectionId: opened.pendingSelection!.id, ids: ['k1'] });
    expect(select(JSON.parse(JSON.stringify(opened)))).toEqual(select(opened));
  });
});

describe('counters', () => {
  it('IncrementEffect counts for the turn, or marks a seat for the game', () => {
    const turn = applyEffect(table(), { kind: 'IncrementEffect', scope: 'turn', key: 'x', by: 2 }).state;
    expect(turn.turn.abilityUses).toEqual({ x: 2 });
    const marked = applyEffect(applyEffect(table(), { kind: 'IncrementEffect', scope: 'seat', seatId: 'a', key: 'm', by: 1 }).state, { kind: 'IncrementEffect', scope: 'seat', seatId: 'a', key: 'm', by: 1 }).state;
    expect(marked.seats[0].marks).toEqual({ m: 2 });
    expect(() => applyEffect(table(), { kind: 'IncrementEffect', scope: 'seat', key: 'm', by: 1 })).toThrow('seatId');
  });

  it('ownerUses counts every card the turn owner used, answers included; never another seat’s', () => {
    const shan: CardDefinition = { id: 'shan', name: 'Shan', category: 'basic', legalPlayTargets: () => [], play: () => [] };
    const withShan: ContentRegistry = { ...registry, cards: new Map([...registry.cards, [shan.id, shan]]) };
    const s = table();
    s.zones = s.zones.map((z) => (z.id === 'a:hand' ? { ...z, cards: [{ ...card('s1'), definitionId: 'shan' }] } : z.id === 'b:hand' ? { ...z, cards: [{ ...card('s2'), definitionId: 'shan' }] } : z));
    const windowFor = (seatId: string) => ({
      ...s,
      pendingResponse: {
        id: `w-${seatId}`, respondingSeatId: seatId, allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['shan'],
        context: { effect: { kind: 'DrawCardsEffect' as const, seatId, count: 1 } },
      },
    });
    const answered = resolve(windowFor('a'), { kind: 'RespondAction', seatId: 'a', pendingResponseId: 'w-a', cardInstanceId: 's1' }, { registry: withShan, mode }).state;
    expect(answered.turn.ownerUses).toEqual({ shan: 1 });
    const other = resolve(windowFor('b'), { kind: 'RespondAction', seatId: 'b', pendingResponseId: 'w-b', cardInstanceId: 's2' }, { registry: withShan, mode }).state;
    expect(other.turn.ownerUses).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/engine/src/lib/pipeline/activeSkill.spec.ts`
Expected: FAIL — type errors: `active`, `UseSkillAction`, `IncrementEffect`, `abilityUses`, `ownerUses` and `marks` don't exist.

- [ ] **Step 3: Types**

In `projects/engine/src/lib/domain/types.ts`:
- `Turn` gains, after `cardPlays`:

```ts
  // Active skills' uses this turn, by abilityUseKey (seatId/slot/skillId).
  abilityUses?: Record<string, number>;
  // Every card the turn owner used this turn, by what it counted as,
  // responses included (Self-Restraint reads 'sha').
  ownerUses?: Record<string, number>;
```

- `Seat` gains, after `judgment`:

```ts
  // Game-long marks some skills keep (none of the base Generals do yet).
  marks?: Record<string, number>;
```

In `projects/engine/src/lib/registry/types.ts`, import `GeneralOwner` and add, above `SkillDefinition`:

```ts
// Who is using an active skill: its owner's seat, and the skill.
export interface ActiveContext {
  seatId: string;
  owner: GeneralOwner;
}

// A skill used on purpose in its owner's Play Phase (Kindness, Reconsider).
export interface ActiveSkill {
  // Uses allowed per turn; absent = any number.
  usesPerTurn?: number;
  canUse(state: GameState, ctx: ActiveContext, registry: ContentRegistry): boolean;
  // The effects that open its decisions. If the first is a selection with
  // onCancel, Cancel undoes the use: it counts only once the picks are confirmed.
  start(state: GameState, ctx: ActiveContext, registry: ContentRegistry): unknown[];
}
```

and in `SkillDefinition`, after `lord`:

```ts
  active?: ActiveSkill;
```

In `projects/engine/src/lib/pipeline/actions.ts`, add to `Action` and to `ACTION_KINDS`:

```ts
  // Uses an active skill of the seat's General (owner.kind === 'general').
  | { kind: 'UseSkillAction'; seatId: string; owner: AbilityOwner };
```

In `projects/engine/src/lib/pipeline/effects.ts`, add to `Effect`:

```ts
  // Adds `by` to a counter: this turn's ability uses (scope 'turn'), or a
  // seat's game-long marks (scope 'seat', with `seatId`). Logs nothing.
  | { kind: 'IncrementEffect'; scope: 'turn' | 'seat'; key: string; by: number; seatId?: string }
```

and the case to `applyEffect`:

```ts
    case 'IncrementEffect': {
      if (effect.scope === 'turn') {
        const uses = state.turn.abilityUses ?? {};
        return { state: { ...state, turn: { ...state.turn, abilityUses: { ...uses, [effect.key]: (uses[effect.key] ?? 0) + effect.by } } }, events: [] };
      }
      if (!effect.seatId) throw new Error('IncrementEffect with scope seat needs a seatId');
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const marks = seat.marks ?? {};
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, marks: { ...marks, [effect.key]: (marks[effect.key] ?? 0) + effect.by } } : s));
      return { state: { ...state, seats }, events: [] };
    }
```

In `projects/engine/src/lib/skills/generalSkills.ts`, add:

```ts
// The key an active skill's uses are counted under in Turn.abilityUses.
export function abilityUseKey(owner: GeneralOwner): string {
  return `${owner.seatId}/${owner.slot}/${owner.skillId}`;
}
```

- [ ] **Step 4: Listing active skills**

In `projects/engine/src/lib/rules/legality.ts`, add `abilityUseKey` to the `generalSkills` import and add:

```ts
type UseSkill = Extract<Action, { kind: 'UseSkillAction' }>;

// The active skills `seatId` may use now: in its own Play Phase with nothing
// pending, each one whose canUse holds and whose uses this turn are under its
// limit. A hidden General's are offered too (using one reveals it).
export function activeSkillActions(state: GameState, seatId: string, registry: ContentRegistry): UseSkill[] {
  if (state.phase !== 'Play' || state.turn.ownerSeatId !== seatId) return [];
  if (state.pendingResponse || state.pendingChoice || state.pendingSelection) return [];
  return skillsInPlay(state, seatId, registry)
    .filter(({ owner, skill }) => {
      const active = skill.active;
      if (!active) return false;
      const uses = state.turn.abilityUses?.[abilityUseKey(owner)] ?? 0;
      return (active.usesPerTurn === undefined || uses < active.usesPerTurn) && active.canUse(state, { seatId, owner }, registry);
    })
    .map(({ owner }): UseSkill => ({ kind: 'UseSkillAction', seatId, owner }));
}
```

In `getLegalActions`, in the Play-phase block, change the last push to:

```ts
  if (registry) actions.push(...conversionActions(state, seatId, registry), ...activeSkillActions(state, seatId, registry));
```

- [ ] **Step 5: Using an active skill; counting the turn owner's cards**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- Import `activeSkillActions` from `../rules/legality` and `abilityUseKey, skillsInPlay` from `../skills/generalSkills`.
- Add the case to `resolveAction`, before `CancelSelectionAction`:

```ts
    case 'UseSkillAction': {
      const offered = activeSkillActions(state, action.seatId, ctx.registry).some((a) => sameAbilityOwner(a.owner, action.owner));
      if (!offered || action.owner.kind !== 'general') throw new Error(`Seat ${action.seatId} can’t use that skill now`);
      const owner = action.owner;
      const { skill, needsReveal } = skillsInPlay(state, action.seatId, ctx.registry).find((s) => sameAbilityOwner(s.owner, owner))!;
      // The use itself: reveal a hidden General, count it, log it.
      const spend: Effect[] = [
        ...(needsReveal ? [{ kind: 'RevealGeneralEffect' as const, seatId: action.seatId, slot: owner.slot, forAbilityId: owner.skillId }] : []),
        { kind: 'IncrementEffect', scope: 'turn', key: abilityUseKey(owner), by: 1 },
        { kind: 'AbilityUsedEffect', owner, abilityId: owner.skillId, outcome: 'used' },
      ];
      const [first, ...rest] = skill.active!.start(state, { seatId: action.seatId, owner }, ctx.registry) as Effect[];
      // A cancellable first selection: the use happens only once its picks are confirmed.
      if (first?.kind === 'OpenSelectionEffect' && first.selection.onCancel) {
        const selection = { ...first.selection, onSelect: [...spend, ...(first.selection.onSelect ?? [])] };
        return { state: queueFront(state, [{ ...first, selection }, ...rest]), events: [] };
      }
      return { state: queueFront(state, [...spend, ...(first ? [first] : []), ...rest]), events: [] };
    }
```

- In `useCard`, count the turn owner's uses. After the `counted` constant, add:

```ts
  // Every card the turn owner uses, answers included (Self-Restraint).
  const ownerUses = counted.turn.ownerUses ?? {};
  const tallied: GameState =
    seatId === counted.turn.ownerSeatId ? { ...counted, turn: { ...counted.turn, ownerUses: { ...ownerUses, [used.as]: (ownerUses[used.as] ?? 0) + 1 } } } : counted;
```

and use `tallied` in place of `counted` in the rest of `useCard` (the `afterTriggerFollowUps` call and the returned `queueFront`).

- [ ] **Step 6: The app's exhaustive switches**

`actionLabel` in `projects/app/src/app/labels.ts` switches over every action kind. Add (with `abilityName` imported from `content`):

```ts
    case 'UseSkillAction':
      return action.owner.kind === 'general' ? `Use ${abilityName(action.owner.skillId)}` : 'Use Skill';
```

In `projects/app/src/app/game-board/action-list.ts`, add `action.kind === 'UseSkillAction'` to `isCardAction` (skills get their own buttons on the avatar, Task 10), and update its comment to say so.

- [ ] **Step 7: Run it to see it pass**

Run: `npx jest projects/engine/src/lib/pipeline/activeSkill.spec.ts`
Expected: PASS (10 tests).

Run: `npx jest projects/engine projects/content projects/app/src/app/labels.spec.ts projects/app/src/app/game-board/action-list.spec.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add projects/engine projects/app/src/app/labels.ts projects/app/src/app/game-board/action-list.ts
git commit -m "feat(engine): active skills, use counts, marks and the turn owner's card uses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Losing HP, the Draw Phase as a step, and skipping Discard

**Files:**
- Create: `projects/engine/src/lib/pipeline/hpAndDraw.spec.ts`
- Modify: `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/events.ts`, `projects/content/src/lib/modes/guozhan.ts`, `projects/content/src/lib/modes/guozhan.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `Effect` `{ kind: 'LoseHpEffect'; seatId: string; amount: number; abilityId?: string }` → `HpLostEvent { kind: 'HpLostEvent'; seatId: string; amount: number; abilityId?: string }`. No-op on an eliminated seat.
  - `Effect` `{ kind: 'DrawPhaseEffect'; seatId: string; count: number }`: draws `count` (nothing at 0 or less). Before-triggers rewrite `count` or replace it.
  - Guozhan queues `DrawPhaseEffect { count: 2 }` when the Draw Phase starts, and runs its reveal and dying triggers after `HpLostEvent` as after `DamageDealtEvent`.

- [ ] **Step 1: Write the failing engine test**

Create `projects/engine/src/lib/pipeline/hpAndDraw.spec.ts`:

```ts
import { advanceToDecision } from './resolve';
import { Effect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, Phase, QueueItem } from '../domain/types';
import { ContentRegistry, GameModeDefinition, SkillTrigger } from '../registry/types';

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'filler', suit: 'club', rank: 5 });
const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const modeWith = (triggers: SkillTrigger[] = []): GameModeDefinition => ({
  id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers,
});

function table(o: { queue?: QueueItem[]; phase?: Phase; hand?: number; flags?: Record<string, boolean>; eliminated?: boolean } = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 3, maxCombinedHp: 4, eliminated: id === 'a' && !!o.eliminated, generals: null,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [], ...(o.flags ? { flags: o.flags } : {}) }, phase: o.phase ?? 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: Array.from({ length: o.hand ?? 0 }, (_, i) => card(`h${i}`)) },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, ...(o.queue ? { resolutionQueue: o.queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
const settle = (s: GameState, triggers: SkillTrigger[] = []) => advanceToDecision(s, { registry, mode: modeWith(triggers) }).state;
const hand = (s: GameState) => s.zones.find((z) => z.id === 'a:hand')!.cards.map((c) => c.instanceId);

describe('LoseHpEffect (Review Focus 4)', () => {
  it('lowers HP and logs it, as no damage: damage triggers don’t fire, HP-lost triggers do', () => {
    const seen: string[] = [];
    const listen = (point: SkillTrigger['point']): SkillTrigger => ({ point, condition: () => true, effect: () => { seen.push(point); return []; } });
    const next = settle(table({ queue: [{ kind: 'LoseHpEffect', seatId: 'a', amount: 1, abilityId: 'battered-body' }] }), [listen('after:DamageDealtEvent'), listen('after:HpLostEvent')]);
    expect(next.seats[0].combinedHp).toBe(2);
    expect(next.log).toEqual([{ kind: 'HpLostEvent', seatId: 'a', amount: 1, abilityId: 'battered-body' }]);
    expect(seen).toEqual(['after:HpLostEvent']);
  });

  it('goes below 0 like damage, and does nothing to an eliminated seat', () => {
    expect(settle(table({ queue: [{ kind: 'LoseHpEffect', seatId: 'a', amount: 5 }] })).seats[0].combinedHp).toBe(-2);
    const out = settle(table({ eliminated: true, phase: 'Play', queue: [{ kind: 'LoseHpEffect', seatId: 'a', amount: 1 }] }));
    expect(out.log.some((e) => e.kind === 'HpLostEvent')).toBe(false);
  });
});

describe('DrawPhaseEffect', () => {
  const drawPhase = (count: number): Effect => ({ kind: 'DrawPhaseEffect', seatId: 'a', count });

  it('draws its count', () => {
    expect(hand(settle(table({ queue: [drawPhase(2)] })))).toEqual(['d1', 'd2']);
  });

  it('draws nothing, and logs nothing, at 0', () => {
    expect(settle(table({ queue: [drawPhase(0)] })).log).toEqual([]);
  });

  it('a before-trigger can change the count, or replace the draw', () => {
    const plusOne: SkillTrigger = {
      point: 'before:DrawPhaseEffect', condition: () => true,
      effect: (_s, subject) => [{ ...(subject as Extract<Effect, { kind: 'DrawPhaseEffect' }>), count: 3 }],
    };
    expect(hand(settle(table({ queue: [drawPhase(2)] }), [plusOne]))).toEqual(['d1', 'd2', 'd3']);
    const instead: SkillTrigger = { point: 'before:DrawPhaseEffect', condition: () => true, effect: () => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: 'a' }, amount: 1 }] };
    const replaced = settle(table({ queue: [drawPhase(2)] }), [instead]);
    expect(hand(replaced)).toEqual([]);
    expect(replaced.seats[0].combinedHp).toBe(4);
  });
});

describe('skipping the Discard Phase', () => {
  // Seat a's 3 HP gives a hand limit of 3, so 6 cards is over it.
  it('a seat over its hand limit skips Discard when flagged, and keeps its cards', () => {
    const ended = resolve(table({ phase: 'Play', hand: 6, flags: { skipDiscard: true } }), { kind: 'EndPhaseAction', seatId: 'a' }, { registry, mode: modeWith() }).state;
    expect(ended.log).toContainEqual({ kind: 'PhaseSkippedEvent', seatId: 'a', phase: 'Discard' });
    expect(ended.log.some((e) => e.kind === 'PhaseChangedEvent' && e.phase === 'Discard')).toBe(false);
    expect(hand(ended)).toHaveLength(6);
    expect(ended.turn.ownerSeatId).toBe('b');
  });
});
```

Add `resolve` to the test's import from `./resolve`.

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/engine/src/lib/pipeline/hpAndDraw.spec.ts`
Expected: FAIL — `LoseHpEffect` and `DrawPhaseEffect` are unhandled effect kinds (type errors). The skip test already passes once compiled: it pins existing behaviour.

- [ ] **Step 3: The effects and the event**

In `projects/engine/src/lib/pipeline/events.ts`, add and include in `EngineEvent`:

```ts
// A seat lost HP: not damage, so it has no source and nothing that reacts to
// damage applies. `abilityId`: the skill that cost it (Battered Body).
export interface HpLostEvent {
  kind: 'HpLostEvent';
  seatId: string;
  amount: number;
  abilityId?: string;
}
```

In `projects/engine/src/lib/pipeline/effects.ts`, add to `Effect`:

```ts
  // Lowers HP without damage (see HpLostEvent). The mode starts the dying round.
  | { kind: 'LoseHpEffect'; seatId: string; amount: number; abilityId?: string }
  // The Draw Phase's draw: `count` cards. Skills rewrite the count or replace
  // the draw with before-triggers.
  | { kind: 'DrawPhaseEffect'; seatId: string; count: number }
```

and the cases:

```ts
    case 'LoseHpEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      if (seat.eliminated) return { state, events: [] };
      const seats = state.seats.map((s) => (s.id === seat.id ? { ...s, combinedHp: s.combinedHp - effect.amount } : s));
      const event: EngineEvent = { kind: 'HpLostEvent', seatId: seat.id, amount: effect.amount, ...(effect.abilityId ? { abilityId: effect.abilityId } : {}) };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
    case 'DrawPhaseEffect':
      if (effect.count <= 0) return { state, events: [] };
      return applyEffect(state, { kind: 'DrawCardsEffect', seatId: effect.seatId, count: effect.count });
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest projects/engine/src/lib/pipeline/hpAndDraw.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Write the failing Guozhan tests**

In `projects/content/src/lib/modes/guozhan.spec.ts`, add `Effect` to the type import from `engine` and add:

```ts
describe('Guozhan: losing HP', () => {
  // seat-a (its turn) plays a test card that makes seat-b (Liu Bei and Guan
  // Yu: 4 HP) lose `amount` HP.
  function loseHp(amount: number, bHand: CardInstance[] = []) {
    const registry = buildContentRegistry();
    const created = createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 7);
    const card: CardDefinition = { id: `test-lose-${amount}`, name: 'Test Lose', category: 'basic', play: (_s, ctx) => [{ kind: 'LoseHpEffect', seatId: ctx.targets[0].seatId, amount }] };
    registry.cards.set(card.id, card);
    const base = seated(created, registry, { 'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'] });
    const state: GameState = {
      ...base,
      phase: 'Play',
      zones: base.zones.map((z) =>
        z.id === 'seat-a:hand' ? { ...z, cards: [{ instanceId: 'lose-1', definitionId: card.id, suit: 'spade' as const, rank: 1 }] }
        : z.id === 'seat-b:hand' ? { ...z, cards: bHand }
        : z
      ),
    };
    const ctx = { registry, mode: guozhanMode };
    const next = resolve(state, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'lose-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] }, ctx).state;
    return { next, ctx };
  }
  const seatB = (s: GameState) => s.seats.find((x) => x.id === 'seat-b')!;

  it('at 0 HP the seat is dying, its Generals revealed, and a Peach saves it — with no damage at all (Review Focus 4)', () => {
    const { next, ctx } = loseHp(4, [{ instanceId: 'pb', definitionId: 'peach', suit: 'heart', rank: 12 }]);
    expect(seatB(next).combinedHp).toBe(0);
    expect(seatB(next).generals!.main.revealed && seatB(next).generals!.deputy.revealed).toBe(true);
    expect(next.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
    expect(next.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', reason: { kind: 'dying', seatId: 'seat-b' } });
    const saved = resolve(next, { kind: 'RespondAction', seatId: 'seat-b', pendingResponseId: next.pendingResponse!.id, cardInstanceId: 'pb' }, ctx).state;
    expect(seatB(saved).combinedHp).toBe(1);
    expect(seatB(saved).eliminated).toBe(false);
  });

  it('above half HP nothing is revealed', () => {
    const { next } = loseHp(1);
    expect(seatB(next).generals!.main.revealed).toBe(false);
  });
});

describe('Guozhan: the Draw Phase step', () => {
  it('is one DrawPhaseEffect of 2, which a skill’s before-trigger can change', () => {
    const registry = buildContentRegistry();
    registry.generals.set('test-scholar', {
      id: 'test-scholar', kingdom: 'Wei', maxHp: 4,
      skills: [{
        id: 'study-hard', compulsory: true,
        triggers: [{
          point: 'before:DrawPhaseEffect',
          condition: (_s, subject, owner) => (subject as Extract<Effect, { kind: 'DrawPhaseEffect' }>).seatId === owner?.seatId,
          effect: (_s, subject) => {
            const draw = subject as Extract<Effect, { kind: 'DrawPhaseEffect' }>;
            return [{ ...draw, count: draw.count + 1 }];
          },
        }],
      }],
    });
    const base = seated(createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 42), registry, { 'seat-a': ['test-scholar', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'] });
    const state: GameState = { ...base, seats: base.seats.map((s) => (s.id === 'seat-a' ? { ...s, generals: { ...s.generals!, main: { ...s.generals!.main, revealed: true } } } : s)) };
    const next = advanceToDecision(state, { registry, mode: guozhanMode }).state;
    const draws = next.log.flatMap((e) => (e.kind === 'CardsDrawnEvent' ? [e.cardInstanceIds.length] : []));
    expect(draws).toEqual([3]);
  });
});
```

(Add `CardInstance` to the spec's type import from `engine`.)

- [ ] **Step 6: Run them to see them fail**

Run: `npx jest projects/content/src/lib/modes/guozhan.spec.ts`
Expected: FAIL — losing HP to 0 starts no dying round and reveals nothing; the Draw Phase draws 2 (the trigger never sees a `DrawPhaseEffect`).

- [ ] **Step 7: Guozhan on the new effects**

In `projects/content/src/lib/modes/guozhan.ts`:
- Add `HpLostEvent`, `SkillTrigger` and `TriggerPoint` to the type import from `engine`.
- Replace `seatIdOfTarget` with:

```ts
// The seat whose HP just dropped: a damaged seat, or one that lost HP.
function droppedSeatId(subject: unknown): string | null {
  const event = subject as DamageDealtEvent | HpLostEvent;
  if (event.kind === 'HpLostEvent') return event.seatId;
  return event.damage.target.kind === 'seat' ? event.damage.target.seatId : null;
}

// What happens when a seat's HP drops, by damage or by losing HP: at half its
// max HP or below its Main General is revealed; at 0 or below its Deputy too,
// and it is dying (the rescue round asks every living seat in turn order from
// the turn owner).
function hpDropTriggers(point: TriggerPoint): SkillTrigger[] {
  const seatOf = (state: GameState, subject: unknown) => state.seats.find((s) => s.id === droppedSeatId(subject));
  return [
    {
      point,
      condition: (state, subject) => {
        const seat = seatOf(state, subject);
        return !!seat && !!seat.generals && !seat.generals.main.revealed && seat.combinedHp <= Math.floor(seat.maxCombinedHp / 2);
      },
      effect: (_state, subject) => [{ kind: 'RevealGeneralAction', seatId: droppedSeatId(subject)!, slot: 'main' as const }],
    },
    {
      point,
      condition: (state, subject) => {
        const seat = seatOf(state, subject);
        return !!seat && !!seat.generals && !seat.generals.deputy.revealed && seat.combinedHp <= 0;
      },
      effect: (_state, subject) => [{ kind: 'RevealGeneralAction', seatId: droppedSeatId(subject)!, slot: 'deputy' as const }],
    },
    {
      point,
      condition: (state, subject) => {
        const seat = seatOf(state, subject);
        return !!seat && !seat.eliminated && seat.combinedHp <= 0;
      },
      effect: (state, subject) => [{
        kind: 'DyingEffect',
        seatId: droppedSeatId(subject)!,
        order: turnOrderFrom(state, state.turn.ownerSeatId),
        rescueCardIds: RESCUE_CARD_IDS,
        entering: true,
      }],
    },
  ];
}
```

- In `triggers`, replace the Draw trigger's effect with `[{ kind: 'DrawPhaseEffect', seatId: event.seatId, count: 2 }]`, and replace the three `after:DamageDealtEvent` triggers with:

```ts
    ...hpDropTriggers('after:DamageDealtEvent'),
    ...hpDropTriggers('after:HpLostEvent'),
```

- [ ] **Step 8: Run them to see them pass**

Run: `npx jest projects/content projects/engine`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add projects/engine projects/content
git commit -m "feat(engine): losing HP and the Draw Phase as a step; Guozhan on both

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Judgments in steps — readers, replacing the card, taking it

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/registry/types.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/events.ts`, `projects/engine/src/lib/pipeline/judgment.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/pipeline/judgment.spec.ts`, `projects/engine/src/lib/pipeline/cardStep.spec.ts`
- Modify (content): `projects/content/src/lib/shared/delayed.ts`, `projects/content/src/lib/cards/equipment/eight-trigrams.ts`, `projects/content/src/lib/cards/delayed.spec.ts`, `projects/content/src/lib/cards/equipment/sha-equipment.spec.ts`
- Modify (app, to compile): `projects/app/src/app/labels.ts`, `projects/app/src/app/game-board/action-history.ts`, `projects/app/src/app/game-board/response-description.ts`, `projects/app/src/app/game-board/action-history.spec.ts`, `projects/app/src/app/game-board/response-description.spec.ts`

**Interfaces:**
- Consumes: `GeneralOwner`, `skillOf` (Task 1); `abilityName` (Task 2).
- Produces:
  - `type JudgmentReader = { kind: 'card'; card: UsedCard } | { kind: 'skill'; owner: GeneralOwner }`.
  - `interface Judgment { seatId: string; reader: JudgmentReader; card: CardInstance; data?: Record<string, unknown> }`.
  - Effects:
    - `{ kind: 'JudgeEffect'; seatId: string; reader: JudgmentReader; data?: Record<string, unknown>; otherwise?: Effect[] }` (replaces `tool`).
    - `{ kind: 'JudgmentShownEffect'; judgment: Judgment; acted?: string[]; changedBy?: string }`.
    - `{ kind: 'JudgmentResolveEffect'; judgment: Judgment }`.
    - `{ kind: 'JudgmentDoneEffect'; judgment: Judgment; acted?: string[] }`.
    - `{ kind: 'ReplaceJudgmentEffect'; judgment: Judgment; withCardInstanceId: string; owner: AbilityOwner; abilityId: string }`.
  - `JudgmentEvent { seatId; reader; card }`; `JudgmentChangedEvent { owner; abilityId; judgedSeatId; card; replaced }`.
  - `JudgedContext.done: Effect`; `SkillDefinition.onJudged?(state, ctx: SkillJudgedContext): unknown[]` with `SkillJudgedContext { owner: GeneralOwner; seatId; judged; data?; done: Effect }`.
  - Selection continuation `{ kind: 'replace-judgment'; judgment: Judgment; owner: AbilityOwner; abilityId: string }`.
  - App: `judgmentReaderName(reader: JudgmentReader): string` in `labels.ts`.

- [ ] **Step 1: Write the failing tests**

In `projects/engine/src/lib/pipeline/judgment.spec.ts`:
- Add imports: `Effect` from `./effects`; `GeneralOwner, Judgment` from `../domain/types`; `SkillDefinition` from `../registry/types`.
- Replace the whole `describe('JudgeEffect', …)` block with:

```ts
type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;
type Done = Extract<Effect, { kind: 'JudgmentDoneEffect' }>;

// A registry whose seat-a Main General ('g1') has the given skills.
function ctxWith(skills: SkillDefinition[], cards: CardDefinition[] = []) {
  return {
    registry: { cards: new Map([...registry.cards, ...cards.map((c): [string, CardDefinition] => [c.id, c])]), generals: new Map([['g1', { id: 'g1', kingdom: 'Wei' as const, maxHp: 4, skills }]]) },
    mode,
  };
}
const settleWith = (s: GameState, c: ReturnType<typeof ctxWith>) => advanceToDecision(s, c).state;
const owner = (skillId: string): GeneralOwner => ({ kind: 'general', seatId: 'seat-a', slot: 'main', skillId });

describe('judgment steps', () => {
  const tool = usedCardOf(card('o1', 'omen'));
  const reader = { kind: 'card' as const, card: tool };
  const judge: Effect = { kind: 'JudgeEffect', seatId: 'seat-a', reader };

  it('turns up the top card, logs it, lets the reader read it, then discards it', () => {
    const judged = card('j1', 'x', 'club', 3);
    const next = settle(table({ queue: [judge], cards: { drawPile: [judged, card('j2')] } }));
    expect(next.log).toEqual([
      { kind: 'JudgmentEvent', seatId: 'seat-a', reader, card: judged },
      { kind: 'CardMovedEvent', cardInstanceId: 'j1', fromZoneId: 'processing', toZoneId: 'discardPile', card: judged },
    ]);
    expect(next.turn.flags).toEqual({ skipPlay: true });
    expect(idsIn(next, 'processing')).toEqual([]);
    expect(idsIn(next, 'drawPile')).toEqual(['j2']);
  });

  it('a card the reader reads as harmless does nothing', () => {
    const next = settle(table({ queue: [judge], cards: { drawPile: [card('j1', 'x', 'heart', 3)] } }));
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'discardPile')).toEqual(['j1']);
  });

  it('shuffles the discard pile in when the draw pile is empty', () => {
    const next = settle(table({ queue: [judge], cards: { discardPile: [card('j1')] } }));
    expect(next.log.map((e) => e.kind)).toEqual(['DiscardPileReshuffledEvent', 'JudgmentEvent', 'CardMovedEvent']);
  });

  it('with no card left anywhere, judges nothing and goes on with `otherwise` (stage 5 follow-up)', () => {
    const next = settle(table({ queue: [{ ...judge, otherwise: [{ kind: 'SetTurnFlagEffect', flag: 'nothingJudged' }] }] }));
    expect(next.log).toEqual([]);
    expect(next.turn.flags).toEqual({ nothingJudged: true });
  });

  it('a skill can read a judgment: its onJudged gets its owner, the card and the data', () => {
    const seen: unknown[] = [];
    const seer: SkillDefinition = { id: 'seer', onJudged: (_s, ctx) => { seen.push([ctx.owner, ctx.seatId, ctx.judged.instanceId, ctx.data]); return [{ kind: 'SetTurnFlagEffect', flag: 'read' }]; } };
    const skillReader = { kind: 'skill' as const, owner: owner('seer') };
    const next = settleWith(table({ queue: [{ kind: 'JudgeEffect', seatId: 'seat-a', reader: skillReader, data: { x: 1 } }], cards: { drawPile: [card('j1')] } }), ctxWith([seer]));
    expect(seen).toEqual([[owner('seer'), 'seat-a', 'j1', { x: 1 }]]);
    expect(next.turn.flags).toEqual({ read: true });
    expect(next.log[0]).toMatchObject({ kind: 'JudgmentEvent', reader: skillReader });
    expect(idsIn(next, 'discardPile')).toEqual(['j1']);
  });

  it('a reader may place the Done step itself, ahead of what it does', () => {
    const early: CardDefinition = { id: 'early', name: 'Early', category: 'basic', play: () => [], onJudged: (_s, { done }) => [done, { kind: 'DrawCardsEffect', seatId: 'seat-a', count: 1 }] };
    const next = settleWith(
      table({ queue: [{ kind: 'JudgeEffect', seatId: 'seat-a', reader: { kind: 'card', card: usedCardOf(card('e1', 'early')) } }], cards: { drawPile: [card('j1'), card('j2')] } }),
      ctxWith([], [early])
    );
    expect(next.log.map((e) => e.kind)).toEqual(['JudgmentEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
  });

  it('a changer at the Shown step replaces the card and is asked again; replaced twice (Review Focus 3)', () => {
    // While seat-a holds a card, it swaps the first one in.
    const changer: SkillDefinition = {
      id: 'changer',
      triggers: [{
        point: 'before:JudgmentShownEffect',
        condition: (state) => idsIn(state, 'seat-a:hand').length > 0,
        effect: (state, subject, o) => [{ kind: 'ReplaceJudgmentEffect', judgment: (subject as Shown).judgment, withCardInstanceId: idsIn(state, 'seat-a:hand')[0], owner: o!, abilityId: 'changer' }],
      }],
    };
    const next = settleWith(
      table({ queue: [judge], cards: { drawPile: [card('j1', 'x', 'club', 3)], 'seat-a:hand': [card('r1', 'x', 'spade', 4), card('r2', 'x', 'heart', 5)] } }),
      ctxWith([changer])
    );
    expect(next.log.filter((e) => e.kind === 'JudgmentChangedEvent')).toEqual([
      { kind: 'JudgmentChangedEvent', owner: owner('changer'), abilityId: 'changer', judgedSeatId: 'seat-a', card: card('r1', 'x', 'spade', 4), replaced: card('j1', 'x', 'club', 3) },
      { kind: 'JudgmentChangedEvent', owner: owner('changer'), abilityId: 'changer', judgedSeatId: 'seat-a', card: card('r2', 'x', 'heart', 5), replaced: card('r1', 'x', 'spade', 4) },
    ]);
    // Omen reads the last card, a heart: harmless.
    expect(next.turn.flags).toBeUndefined();
    expect(idsIn(next, 'discardPile')).toEqual(['j1', 'r1', 'r2']);
    expect(idsIn(next, 'processing')).toEqual([]);
  });

  it('a replace-judgment selection swaps in the picked card, and the Shown step says who changed it', () => {
    const picker: SkillDefinition = {
      id: 'picker',
      triggers: [{
        point: 'before:JudgmentShownEffect',
        condition: (_s, subject) => !(subject as Shown).changedBy,
        effect: (state, subject, o) => [{
          kind: 'OpenSelectionEffect',
          selection: {
            id: 'pick-1', seatId: 'seat-a', reason: { kind: 'ability', owner: o!, abilityId: 'picker' }, of: 'cards', eligibleIds: idsIn(state, 'seat-a:hand'), min: 1, max: 1,
            then: { kind: 'replace-judgment', judgment: (subject as Shown).judgment, owner: o!, abilityId: 'picker' },
          },
        }],
      }],
    };
    const c = ctxWith([picker]);
    const opened = settleWith(table({ queue: [judge], cards: { drawPile: [card('j1', 'x', 'club', 3)], 'seat-a:hand': [card('r1', 'x', 'heart', 4)] } }), c);
    expect(opened.pendingSelection).toMatchObject({ id: 'pick-1' });
    const next = resolve(opened, { kind: 'SelectAction', seatId: 'seat-a', selectionId: 'pick-1', ids: ['r1'] }, c).state;
    expect(next.turn.flags).toBeUndefined(); // a heart now
    expect(idsIn(next, 'discardPile')).toEqual(['j1', 'r1']);
  });

  it('a taker at the Done step takes the card instead of the discard pile', () => {
    const taker: SkillDefinition = {
      id: 'taker',
      triggers: [{
        point: 'before:JudgmentDoneEffect',
        condition: (_s, subject) => !(subject as Done).acted?.includes('taker'),
        effect: (_s, subject) => {
          const done = subject as Done;
          return [{ kind: 'MoveCardEffect', cardInstanceId: done.judgment.card.instanceId, toZoneId: 'seat-a:hand' }, { ...done, acted: ['taker'] }];
        },
      }],
    };
    const next = settleWith(table({ queue: [judge], cards: { drawPile: [card('j1', 'x', 'club', 3)] } }), ctxWith([taker]));
    expect(next.turn.flags).toEqual({ skipPlay: true }); // read first, then taken
    expect(idsIn(next, 'seat-a:hand')).toEqual(['j1']);
    expect(idsIn(next, 'discardPile')).toEqual([]);
  });

  it('survives a JSON round trip while queued, and mid-way', () => {
    const queued = table({ queue: [judge], cards: { drawPile: [card('j1')] } });
    expect(settle(JSON.parse(JSON.stringify(queued)))).toEqual(settle(queued));
    const judgment: Judgment = { seatId: 'seat-a', reader, card: card('j1') };
    const midway = table({ queue: [{ kind: 'JudgmentResolveEffect', judgment }], cards: { processing: [card('j1')] } });
    expect(settle(JSON.parse(JSON.stringify(midway)))).toEqual(settle(midway));
  });
});
```

The `table` helper builds `processing` empty; make it take cards like the other zones: change `{ id: 'processing', kind: 'processing', cards: [] }` to `{ id: 'processing', kind: 'processing', cards: cardsOf('processing') }`.

In `projects/engine/src/lib/pipeline/cardStep.spec.ts`, in the "a judgment passes its data to the reader" test, change the queued effect's `tool: { as: 'omen', colour: 'none', physical: [] }` to `reader: { kind: 'card', card: { as: 'omen', colour: 'none', physical: [] } }`.

In `projects/content/src/lib/cards/equipment/sha-equipment.spec.ts`:
- In "a red judgment counts as a Shan", change `tool: { as: 'eight-trigrams' }` to `reader: { kind: 'card', card: { as: 'eight-trigrams' } }`.
- Add to `describe('Eight Trigrams')`:

```ts
  it('with nothing left to judge, the Shan is asked for as normal (stage 5 follow-up)', () => {
    const s = attack(card('j', 'peach', 'heart', 9));
    const judge = s.pendingChoice!.options.find((o) => o.id === 'use')!.effects.find((e) => e.kind === 'JudgeEffect');
    expect(judge).toMatchObject({ otherwise: [{ kind: 'CardStepEffect', step: 'sha-shan', target: { seatId: 'seat-b' } }] });
  });
```

In `projects/content/src/lib/cards/delayed.spec.ts`, change the `judgments` helper's `${e.tool.as}` to `${e.reader.kind === 'card' ? e.reader.card.as : e.reader.owner.skillId}`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/judgment.spec.ts projects/engine/src/lib/pipeline/cardStep.spec.ts`
Expected: FAIL — type errors: `reader`, `otherwise`, `JudgmentShownEffect`, `ReplaceJudgmentEffect`, `JudgmentChangedEvent`, `onJudged` on a skill and `done` don't exist.

- [ ] **Step 3: Types**

In `projects/engine/src/lib/domain/types.ts`, add after `UsedCard`:

```ts
// Who reads a judgment: a card through its definition's onJudged (a delayed
// Tool; a worn card such as Eight Trigrams), or a General's skill through its own.
export type JudgmentReader = { kind: 'card'; card: UsedCard } | { kind: 'skill'; owner: GeneralOwner };

// A judgment under way: whose it is, who reads it, what the reader passed
// along, and the card turned up (the latest, once a skill has replaced it).
export interface Judgment {
  seatId: string;
  reader: JudgmentReader;
  card: CardInstance;
  data?: Record<string, unknown>;
}
```

and add to `SelectionContinuation`:

```ts
  // Replace the judgment's card with the one picked (Devil).
  | { kind: 'replace-judgment'; judgment: Judgment; owner: AbilityOwner; abilityId: string };
```

In `projects/engine/src/lib/registry/types.ts`:
- `JudgedContext` gains, after `data`:

```ts
  // The judgment's last step (the card to the discard pile). Include it among
  // the returned effects to place it there; otherwise it comes after them.
  done: Effect;
```

- Add:

```ts
// A skill reading its own judgment (Unyielding, Iron Cavalry, River Goddess).
export interface SkillJudgedContext {
  owner: GeneralOwner;
  // The seat being judged, and the card it got.
  seatId: string;
  judged: CardInstance;
  data?: Record<string, unknown>;
  // As JudgedContext.done.
  done: Effect;
}
```

- `SkillDefinition` gains, after `active`:

```ts
  // Reads a judgment this skill asked for (JudgmentReader 'skill').
  onJudged?(state: GameState, ctx: SkillJudgedContext): unknown[];
```

- [ ] **Step 4: Effects and events**

In `projects/engine/src/lib/pipeline/effects.ts`, replace the `JudgeEffect` member with:

```ts
  // Judgment, step 1: turn the top card up for `seatId`, for `reader` (which
  // receives `data`). Nothing left to judge with: `otherwise` goes ahead.
  | { kind: 'JudgeEffect'; seatId: string; reader: JudgmentReader; data?: Record<string, unknown>; otherwise?: Effect[] }
  // Step 2: the card is shown. Skills that change judgments hook in here with
  // before-triggers (`acted`: those that had their say; `changedBy`: the seat
  // that replaced the card last).
  | { kind: 'JudgmentShownEffect'; judgment: Judgment; acted?: string[]; changedBy?: string }
  // Step 3: the reader reads the final card.
  | { kind: 'JudgmentResolveEffect'; judgment: Judgment }
  // Step 4: the card goes to the discard pile, unless something took it
  // (a before-trigger here may take it first; `acted` as above).
  | { kind: 'JudgmentDoneEffect'; judgment: Judgment; acted?: string[] }
  // Replaces the judgment's card with a hand card: the old one is discarded,
  // and the judgment is shown again.
  | { kind: 'ReplaceJudgmentEffect'; judgment: Judgment; withCardInstanceId: string; owner: AbilityOwner; abilityId: string }
```

(import `Judgment`, `JudgmentReader` from `../domain/types`.)

In `projects/engine/src/lib/pipeline/events.ts`:
- Replace `JudgmentEvent` with:

```ts
// A card turned up for `seatId`'s judgment, for `reader`.
export interface JudgmentEvent {
  kind: 'JudgmentEvent';
  seatId: string;
  reader: JudgmentReader;
  card: CardInstance;
}

// A skill replaced a judgment's card (`replaced`) with `card`.
export interface JudgmentChangedEvent {
  kind: 'JudgmentChangedEvent';
  owner: AbilityOwner;
  abilityId: string;
  judgedSeatId: string;
  card: CardInstance;
  replaced: CardInstance;
}
```

- Add `JudgmentChangedEvent` to `EngineEvent`, and `JudgmentReader` to the import.

- [ ] **Step 5: The judgment steps**

Replace `projects/engine/src/lib/pipeline/judgment.ts` with:

```ts
import { GameState, Judgment } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { drawTop, judgmentZoneOf, requireZoneOfKind } from '../cards/zones';
import { skillOf } from '../skills/generalSkills';
import { ApplyResult, Effect, applyEffect } from './effects';
import { EngineEvent } from './events';
import { queueFront } from './queue';

const JUDGMENT_STEP_KINDS = new Set([
  'JudgeEffect',
  'JudgmentShownEffect',
  'JudgmentResolveEffect',
  'JudgmentDoneEffect',
  'ReplaceJudgmentEffect',
  'DelayedCleanupEffect',
]);
type JudgmentStepEffect = Extract<
  Effect,
  { kind: 'JudgeEffect' | 'JudgmentShownEffect' | 'JudgmentResolveEffect' | 'JudgmentDoneEffect' | 'ReplaceJudgmentEffect' | 'DelayedCleanupEffect' }
>;

export function isJudgmentStepEffect(effect: Effect): effect is JudgmentStepEffect {
  return JUDGMENT_STEP_KINDS.has(effect.kind);
}

// What the reader makes of the judgment's card.
function readJudgment(state: GameState, judgment: Judgment, done: Effect, registry: ContentRegistry): Effect[] {
  const { reader, seatId, card: judged, data } = judgment;
  const ctx = { seatId, judged, ...(data ? { data } : {}), done };
  if (reader.kind === 'card') return (lookupCard(registry, reader.card.as).onJudged?.(state, { tool: reader.card, ...ctx }) ?? []) as Effect[];
  return (skillOf(state, reader.owner, registry)?.onJudged?.(state, { owner: reader.owner, ...ctx }) ?? []) as Effect[];
}

// Judgments (turned up, shown, read, done; a card replaced) and delayed Tools'
// cleanup. Each asks the reader's definition what happens, so it needs the
// registry, as the Tool lifecycle does.
export function applyJudgmentStepEffect(state: GameState, effect: JudgmentStepEffect, registry: ContentRegistry): ApplyResult {
  const discardPile = requireZoneOfKind(state.zones, 'discardPile');
  const processing = requireZoneOfKind(state.zones, 'processing');
  switch (effect.kind) {
    case 'JudgeEffect': {
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const { zones, drawn, rng, reshuffled } = drawTop(state.zones, drawPile.id, processing.id, 1, state.rng);
      const [judged] = drawn;
      // No card left anywhere to judge with: nothing is judged.
      if (!judged) return { state: queueFront(state, effect.otherwise ?? []), events: [] };
      const events: EngineEvent[] = [
        ...(reshuffled > 0 ? [{ kind: 'DiscardPileReshuffledEvent' as const, cardCount: reshuffled }] : []),
        { kind: 'JudgmentEvent', seatId: effect.seatId, reader: effect.reader, card: judged },
      ];
      const judgment: Judgment = { seatId: effect.seatId, reader: effect.reader, card: judged, ...(effect.data ? { data: effect.data } : {}) };
      return { state: queueFront({ ...state, zones, rng, log: [...state.log, ...events] }, [{ kind: 'JudgmentShownEffect', judgment }]), events };
    }
    case 'JudgmentShownEffect':
      // Every skill that changes judgments has had its say: the card stands.
      return { state: queueFront(state, [{ kind: 'JudgmentResolveEffect', judgment: effect.judgment }]), events: [] };
    case 'JudgmentResolveEffect': {
      const done: Effect = { kind: 'JudgmentDoneEffect', judgment: effect.judgment };
      const readings = readJudgment(state, effect.judgment, done, registry);
      // The reader may have placed the card's trip itself; otherwise it comes last.
      const placed = readings.some((e) => e.kind === 'JudgmentDoneEffect');
      return { state: queueFront(state, placed ? readings : [...readings, done]), events: [] };
    }
    case 'JudgmentDoneEffect':
      // To the discard pile, unless something has taken it already.
      return applyEffect(state, { kind: 'MoveCardEffect', cardInstanceId: effect.judgment.card.instanceId, toZoneId: discardPile.id, onlyFrom: processing.id });
    case 'ReplaceJudgmentEffect': {
      const old = effect.judgment.card;
      const out = applyEffect(state, { kind: 'MoveCardEffect', cardInstanceId: old.instanceId, toZoneId: discardPile.id, onlyFrom: processing.id });
      const into = applyEffect(out.state, { kind: 'MoveCardEffect', cardInstanceId: effect.withCardInstanceId, toZoneId: processing.id });
      const card = requireZoneOfKind(into.state.zones, 'processing').cards.find((c) => c.instanceId === effect.withCardInstanceId)!;
      const changed: EngineEvent = { kind: 'JudgmentChangedEvent', owner: effect.owner, abilityId: effect.abilityId, judgedSeatId: effect.judgment.seatId, card, replaced: old };
      const next: GameState = { ...into.state, log: [...into.state.log, changed] };
      // Shown again: the other changers get their say on the new card.
      const shown: Effect = { kind: 'JudgmentShownEffect', judgment: { ...effect.judgment, card }, changedBy: effect.owner.seatId };
      return { state: queueFront(next, [shown]), events: [...out.events, ...into.events, changed] };
    }
    case 'DelayedCleanupEffect': {
      const definition = lookupCard(registry, effect.tool.as);
      if (definition.onCleanup) {
        return { state: queueFront(state, definition.onCleanup(state, { tool: effect.tool, ownerSeatId: effect.ownerSeatId }) as Effect[]), events: [] };
      }
      const card = effect.tool.physical[0];
      const stillThere = !!card && !!judgmentZoneOf(state, effect.ownerSeatId)?.cards.some((c) => c.instanceId === card.instanceId);
      if (!stillThere) return { state, events: [] };
      return { state: queueFront(state, [{ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: discardPile.id }]), events: [] };
    }
  }
}
```

In `projects/engine/src/lib/pipeline/resolve.ts`, add the continuation to `continueSelection`'s switch:

```ts
    case 'replace-judgment':
      return {
        state: queueFront(state, [{ kind: 'ReplaceJudgmentEffect', judgment: then.judgment, withCardInstanceId: ids[0], owner: then.owner, abilityId: then.abilityId }]),
        events: [],
      };
```

- [ ] **Step 6: Run the engine tests**

Run: `npx jest projects/engine`
Expected: PASS.

- [ ] **Step 7: Content on the new shape**

In `projects/content/src/lib/shared/delayed.ts`, `judgeTarget` becomes:

```ts
export const judgeTarget: NonNullable<CardDefinition['onTarget']> = (_state, { tool, target }) =>
  target.kind === 'seat' ? [{ kind: 'JudgeEffect', seatId: target.seatId, reader: { kind: 'card', card: tool } }] : [];
```

In `projects/content/src/lib/cards/equipment/eight-trigrams.ts`:
- The ask's judgment:

```ts
          // Nothing left to judge with: the Shan is asked for as normal.
          const judge: Effect = {
            kind: 'JudgeEffect',
            seatId: owner.seatId,
            reader: { kind: 'card', card: usedCardOf(worn) },
            data: { step: actedOn(step, owner) },
            otherwise: [actedOn(step, owner)],
          };
```

- `onJudged` uses the engine's `done` instead of building the move (drop the `requireZoneOfKind` import if nothing else uses it):

```ts
  // The judged card goes to the discard pile first (`done`), so it doesn't lie
  // in processing while the Shan window waits. Then the step goes on: with one
  // more Shan provided on red.
  onJudged: (_state, { judged, data, seatId, tool, done }) => {
    const step = data?.['step'] as CardStep;
    if (colourOf(judged) === 'black') return [done, step];
    const { provided = 0 } = (step.data ?? {}) as ShanData;
    const owner = { kind: 'equipment' as const, seatId, cardInstanceId: tool.physical[0].instanceId };
    return [
      done,
      { kind: 'AbilityUsedEffect', owner, abilityId: 'eight-trigrams', outcome: 'counts-as-shan' },
      { ...step, data: { ...step.data, provided: provided + 1 } },
    ];
  },
```

- [ ] **Step 8: The app reads the reader**

In `projects/app/src/app/labels.ts`, add (with `JudgmentReader` imported from `engine` and `abilityName` from `content`):

```ts
// What a judgment is for: the card's name, or the skill's.
export function judgmentReaderName(reader: JudgmentReader): string {
  return abilityName(reader.kind === 'card' ? reader.card.as : reader.owner.skillId);
}
```

In `projects/app/src/app/game-board/action-history.ts`, the `JudgmentEvent` line becomes:

```ts
      case 'JudgmentEvent':
        action(`${name(event.seatId)}'s ${judgmentReaderName(event.reader)} judgment: ${cardFaceLabel(event.card)}`, event.card);
        break;
```

and in `projects/app/src/app/game-board/response-description.ts`, the Eight Trigrams line uses `judgmentReaderName(event.reader)` in place of `cardName({ definitionId: event.tool.as })`.

In the two app specs, every `{ kind: 'JudgmentEvent', seatId, tool: X, card }` becomes `{ kind: 'JudgmentEvent', seatId, reader: { kind: 'card', card: X }, card }`.

- [ ] **Step 9: Run everything touched**

Run: `npx jest projects/engine projects/content projects/app/src/app/game-board/action-history.spec.ts projects/app/src/app/game-board/response-description.spec.ts`
Expected: PASS. Eight Trigrams' Review Focus 4 test from stage 5 still passes: the judged card is in the discard pile before the Shan window opens.

- [ ] **Step 10: Commit**

```bash
git add projects/engine projects/content projects/app/src/app/labels.ts projects/app/src/app/game-board
git commit -m "feat(engine): judgments in steps, read by a card or a skill; replacing and taking the card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: New decisions — seat, suit and label options; giving cards; arranging the draw pile

**Files:**
- Create: `projects/engine/src/lib/rules/arrangement.ts`, `projects/engine/src/lib/pipeline/arrangement.spec.ts`
- Modify: `projects/engine/src/lib/domain/types.ts`, `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/events.ts`, `projects/engine/src/lib/pipeline/actions.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/rules/legality.ts`, `projects/engine/src/lib/rules/activeSeat.ts`, `projects/engine/src/lib/domain/redact.ts`, `projects/engine/src/public-api.ts`, `projects/engine/src/lib/pipeline/choice.spec.ts`, `projects/engine/src/lib/pipeline/selection.spec.ts`
- Modify (app, to compile): `projects/app/src/app/labels.ts`, `projects/app/src/app/game-board/action-list.ts`

**Interfaces:**
- Consumes: selections and `continueSelection` (stage 5); `activeSkillActions` (Task 4).
- Produces:
  - `ChoiceOption['shows']` gains `{ kind: 'seat'; seatId: string }`, `{ kind: 'suit'; suit: CardInstance['suit'] }`, `{ kind: 'label'; text: string }`. `PendingChoice['verb']` gains `'pick'` and `'give'`.
  - Selection continuation `{ kind: 'give'; toSeatIds: string[]; then?: Effect[] }`: after the cards are picked, a `give` choice of one seat among `toSeatIds` (options `{ id: seatId, shows: { kind: 'seat', seatId } }`); picking moves the cards into that seat's hand, then `then`.
  - `interface PendingArrangement { id: string; seatId: string; reason: DecisionReason; cardInstanceIds: string[] }`; `GameState.pendingArrangement?: PendingArrangement`.
  - `Effect` `{ kind: 'OpenArrangementEffect'; arrangement: PendingArrangement }`.
  - `Action` `{ kind: 'ArrangeCardsAction'; seatId: string; arrangementId: string; top: string[]; bottom: string[] }`; offered as a template with empty `top` and `bottom`.
  - `validateArrangement(state, action): string | null`.
  - `ArrangementMadeEvent { kind: 'ArrangementMadeEvent'; seatId: string; reason: DecisionReason; top: number; bottom: number }`.
  - `decisionPending(state): boolean` (in `rules/activeSeat.ts`): a response, choice, selection or arrangement is pending.

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/arrangement.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { Action } from './actions';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, PendingArrangement } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { getActiveSeatId } from '../rules/activeSeat';
import { getLegalActions } from '../rules/legality';
import { validateArrangement } from '../rules/arrangement';
import { redactStateForSeat } from '../domain/redact';

const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };
const card = (instanceId: string, definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit: 'heart', rank: 7 });
const owner = { kind: 'general' as const, seatId: 'a', slot: 'main' as const, skillId: 'astrology' };
const arrangement: PendingArrangement = { id: 'arr-1', seatId: 'a', reason: { kind: 'ability', owner, abilityId: 'astrology' }, cardInstanceIds: ['t1', 't2', 't3'] };

// The draw pile is t1 t2 t3 (the top three, being arranged) then r1 r2.
function opened(): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Shu' as const, combinedHp: 3, maxCombinedHp: 3, eliminated: false, generals: null,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const s: GameState = {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('t1', 'peach'), card('t2', 'duel'), card('t3', 'sha'), card('r1'), card('r2')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, resolutionQueue: [{ kind: 'OpenArrangementEffect', arrangement }, { kind: 'DrawCardsEffect', seatId: 'b', count: 1 }],
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
  return advanceToDecision(s, ctx).state;
}
const arrange = (top: string[], bottom: string[], seatId = 'a'): Extract<Action, { kind: 'ArrangeCardsAction' }> => ({ kind: 'ArrangeCardsAction', seatId, arrangementId: 'arr-1', top, bottom });
const pile = (s: GameState) => s.zones.find((z) => z.id === 'drawPile')!.cards.map((c) => c.instanceId);

describe('arranging the draw pile', () => {
  it('pauses the queue for the arranging seat, who is offered a template', () => {
    const s = opened();
    expect(s.pendingArrangement).toEqual(arrangement);
    expect(getActiveSeatId(s)).toBe('a');
    expect(getLegalActions(s, 'a', registry)).toEqual([arrange([], [])]);
    expect(getLegalActions(s, 'b', registry)).toEqual([]);
    expect(() => resolve(s, { kind: 'EndPhaseAction', seatId: 'a' }, ctx)).toThrow('not legal while an arrangement is pending');
  });

  it('validates: the arranger, every card placed once, no others', () => {
    const s = opened();
    expect(validateArrangement(s, arrange(['t1'], ['t2', 't3']))).toBeNull();
    expect(validateArrangement(s, arrange(['t1'], ['t2', 't3'], 'b'))).toMatch('not the arranger');
    expect(validateArrangement(s, arrange(['t1', 't1'], ['t2']))).toMatch('twice');
    expect(validateArrangement(s, arrange(['t1', 'r1'], ['t2', 't3']))).toMatch('not one of the cards');
    expect(validateArrangement(s, arrange(['t1'], ['t2']))).toMatch('Place all 3 cards');
    expect(() => resolve(s, arrange([], []), ctx)).toThrow('Place all 3 cards');
  });

  it('puts `top` on top in order and `bottom` under the pile in order, logs the counts, then the queue goes on', () => {
    const next = resolve(opened(), arrange(['t3', 't1'], ['t2']), ctx).state;
    expect(next.pendingArrangement).toBeUndefined();
    // Seat b's queued draw then takes the new top card.
    expect(next.zones.find((z) => z.id === 'b:hand')!.cards.map((c) => c.instanceId)).toEqual(['t3']);
    expect(pile(next)).toEqual(['t1', 'r1', 'r2', 't2']);
    expect(next.log[0]).toEqual({ kind: 'ArrangementMadeEvent', seatId: 'a', reason: arrangement.reason, top: 2, bottom: 1 });
  });

  it('only the arranging seat sees the cards; a paused arrangement survives a JSON round trip (Review Focus 5)', () => {
    const s = opened();
    const faces = (viewer: string) => redactStateForSeat(s, viewer).zones.find((z) => z.id === 'drawPile')!.cards.map((c) => c.definitionId);
    expect(faces('a')).toEqual(['peach', 'duel', 'sha', 'hidden', 'hidden']);
    expect(faces('b')).toEqual(['hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
    expect(getLegalActions(redactStateForSeat(s, 'a'), 'a', registry)).toEqual([arrange([], [])]);
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(resolve(copy, arrange(['t1', 't2', 't3'], []), ctx).state).toEqual(resolve(s, arrange(['t1', 't2', 't3'], []), ctx).state);
  });
});
```

In `projects/engine/src/lib/pipeline/selection.spec.ts`, add:

```ts
  it('give: after the cards are picked, the seat picks who gets them; they go to that hand, then `then`', () => {
    const s = select(opened(selection({ then: { kind: 'give', toSeatIds: ['b'], then: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] } })), ['k1', 'k2']);
    expect(s.pendingChoice).toMatchObject({ seatId: 'a', verb: 'give', reason: selection().reason, options: [{ id: 'b', shows: { kind: 'seat', seatId: 'b' } }] });
    const given = resolve(s, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: s.pendingChoice!.id, optionId: 'b' }, ctx).state;
    expect(cardsIn(given, 'b:hand')).toEqual(['k1', 'k2', 'd2']);
    expect(cardsIn(given, 'a:hand')).toEqual(['bolt-1', 'd1']);
  });
```

(Seat b's hand gets k1 and k2, then the selection fixture's queued `afterwards` draws it d2 once seat a has drawn d1 from `then`.)

In `projects/engine/src/lib/pipeline/choice.spec.ts`, add:

```ts
describe('seat, suit and label options', () => {
  it('are offered and logged like any option, and survive a JSON round trip', () => {
    const naming: PendingChoice = {
      id: 'c2', seatId: 'a', verb: 'pick',
      reason: { kind: 'ability', owner: { kind: 'general', seatId: 'b', slot: 'main', skillId: 'sow-revolt' }, abilityId: 'sow-revolt' },
      options: [
        { id: 'b', shows: { kind: 'seat', seatId: 'b' }, effects: [] },
        { id: 'heart', shows: { kind: 'suit', suit: 'heart' }, effects: [healA] },
        { id: 'done', shows: { kind: 'label', text: 'Done' }, effects: [] },
      ],
    };
    const s = applyEffect(state(), { kind: 'OpenChoiceEffect', choice: naming }).state;
    expect(getLegalActions(s, 'a').map((a) => (a.kind === 'ChooseOptionAction' ? a.optionId : a.kind))).toEqual(['b', 'heart', 'done']);
    const chosen = (from: GameState) => resolve(from, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: 'c2', optionId: 'heart' }, ctx).state;
    expect(chosen(s).log[0]).toEqual({ kind: 'ChoiceMadeEvent', seatId: 'a', reason: naming.reason, verb: 'pick', shows: { kind: 'suit', suit: 'heart' } });
    expect(chosen(s).seats[0].combinedHp).toBe(4);
    expect(chosen(JSON.parse(JSON.stringify(s)))).toEqual(chosen(s));
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/engine/src/lib/pipeline/arrangement.spec.ts projects/engine/src/lib/pipeline/selection.spec.ts projects/engine/src/lib/pipeline/choice.spec.ts`
Expected: FAIL — type errors: the new option kinds, verbs, `give`, `PendingArrangement`, `OpenArrangementEffect`, `ArrangeCardsAction` and `validateArrangement` don't exist.

- [ ] **Step 3: Types, effect, action and event**

In `projects/engine/src/lib/domain/types.ts`:
- `PendingChoice.verb` becomes `'take' | 'discard' | 'use' | 'pick' | 'give'` (comment: "`pick`: a seat, a suit or a label; `give`: who gets the cards").
- `ChoiceOption['shows']` becomes:

```ts
  shows:
    | { kind: 'card'; card: CardInstance }
    | { kind: 'hidden-hand'; seatId: string; count: number }
    | { kind: 'use'; reveals?: 'main' | 'deputy' }
    | { kind: 'decline' }
    | { kind: 'seat'; seatId: string }
    | { kind: 'suit'; suit: CardInstance['suit'] }
    | { kind: 'label'; text: string };
```

  and its comment gains: "A seat (Raid's targets, who gets given cards), a suit to name, or a label (Done, an Unyielding outcome)."
- `SelectionContinuation` gains:

```ts
  // Give the picked cards to one of `toSeatIds`, chosen next; then `then`.
  | { kind: 'give'; toSeatIds: string[]; then?: Effect[] }
```

- Add:

```ts
// A seat putting cards from the top of the draw pile back in the order it
// likes, some on top and some at the bottom (Astrology). The cards stay in the
// draw pile meanwhile; only the arranging seat sees them.
export interface PendingArrangement {
  id: string;
  seatId: string;
  reason: DecisionReason;
  cardInstanceIds: string[];
}
```

- `GameState` gains, after `pendingSelection`:

```ts
  // The cards a seat owes an arrangement of, if any. Absent (never null) when none.
  pendingArrangement?: PendingArrangement;
```

In `projects/engine/src/lib/pipeline/effects.ts`, add to `Effect` and to `applyEffect`:

```ts
  // Asks `arrangement.seatId` to arrange cards; the queue waits.
  | { kind: 'OpenArrangementEffect'; arrangement: PendingArrangement }
```

```ts
    case 'OpenArrangementEffect':
      return { state: { ...state, pendingArrangement: effect.arrangement }, events: [] };
```

In `projects/engine/src/lib/pipeline/actions.ts`, add to `Action` and `ACTION_KINDS`:

```ts
  // Fills the pending arrangement: `top` (top card first) and `bottom` (in the
  // order they go under the pile). Offered as a template with both empty.
  | { kind: 'ArrangeCardsAction'; seatId: string; arrangementId: string; top: string[]; bottom: string[] }
```

In `projects/engine/src/lib/pipeline/events.ts`, add and include in `EngineEvent`:

```ts
// A seat arranged cards from the draw pile. Counts only: the cards stay hidden.
export interface ArrangementMadeEvent {
  kind: 'ArrangementMadeEvent';
  seatId: string;
  reason: DecisionReason;
  top: number;
  bottom: number;
}
```

- [ ] **Step 4: Validating, pausing, whose move it is**

Create `projects/engine/src/lib/rules/arrangement.ts`:

```ts
import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';

// Why `action` can't fill the pending arrangement, or null when it can: the
// arranger, the arrangement's id, and every card placed exactly once, on top
// or at the bottom, with no others. The engine, bots and the UI share this check.
export function validateArrangement(state: GameState, action: Extract<Action, { kind: 'ArrangeCardsAction' }>): string | null {
  const arrangement = state.pendingArrangement;
  if (!arrangement || arrangement.id !== action.arrangementId) return `No matching pending arrangement: ${action.arrangementId}`;
  if (action.seatId !== arrangement.seatId) return `Seat ${action.seatId} is not the arranger for ${arrangement.id}`;
  const placed = [...action.top, ...action.bottom];
  if (new Set(placed).size !== placed.length) return 'The same card was placed twice';
  const stray = placed.find((id) => !arrangement.cardInstanceIds.includes(id));
  if (stray) return `${stray} is not one of the cards being arranged`;
  if (placed.length !== arrangement.cardInstanceIds.length) return `Place all ${arrangement.cardInstanceIds.length} cards; got ${placed.length}`;
  return null;
}
```

Export it from `projects/engine/src/public-api.ts` (`export * from './lib/rules/arrangement';`).

In `projects/engine/src/lib/rules/activeSeat.ts`, add:

```ts
// Whether a seat owes a decision that pauses the queue: a response, a choice,
// a selection or an arrangement.
export function decisionPending(state: GameState): boolean {
  return !!state.pendingResponse || !!state.pendingChoice || !!state.pendingSelection || !!state.pendingArrangement;
}
```

and put the arranger in `getActiveSeatId`'s chain, after the selector:

```ts
  const candidateId =
    state.pendingChoice?.seatId ??
    state.pendingSelection?.seatId ??
    state.pendingArrangement?.seatId ??
    state.pendingResponse?.respondingSeatId ??
    state.turn.ownerSeatId;
```

(update its comment: "a pending chooser, selector or arranger, then a pending responder").

In `projects/engine/src/lib/rules/legality.ts`, in `getLegalActions`, after the `pendingSelection` block:

```ts
  if (state.pendingArrangement) {
    const arrangement = state.pendingArrangement;
    if (arrangement.seatId !== seatId) return [];
    // A template: the seat fills in top and bottom (validateArrangement checks them).
    return [{ kind: 'ArrangeCardsAction', seatId, arrangementId: arrangement.id, top: [], bottom: [] }];
  }
```

In `conversionActions`, change the guard to `if (!seat || state.pendingChoice || state.pendingSelection || state.pendingArrangement) return [];`. In `activeSkillActions`, change the pending guard to `if (decisionPending(state)) return [];` (import it from `./activeSeat`).

- [ ] **Step 5: Resolving**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- Import `decisionPending` from `../rules/activeSeat`, `validateArrangement` from `../rules/arrangement`, `ArrangementMadeEvent` from `./events`, and `PendingChoice` from `../domain/types`.
- In `advanceToDecision`, the break condition becomes `if (current.result || current.phase === 'GeneralSelection' || decisionPending(current)) break;`.
- In `drain`, the loop condition becomes `while (!current.result && !decisionPending(current) && (current.resolutionQueue?.length ?? 0) > 0) {`.
- At the top of `resolveAction`, after the selection guard:

```ts
  if (state.pendingArrangement && action.kind !== 'ArrangeCardsAction') {
    throw new Error(`Action ${action.kind} is not legal while an arrangement is pending`);
  }
```

- Add the case:

```ts
    case 'ArrangeCardsAction': {
      const error = validateArrangement(state, action);
      if (error) throw new Error(error);
      const arrangement = state.pendingArrangement!;
      const { pendingArrangement: _done, ...cleared } = state;
      const drawPile = requireZoneOfKind(state.zones, 'drawPile');
      const inPile = (id: string) => {
        const found = drawPile.cards.find((c) => c.instanceId === id);
        if (!found) throw new Error(`Card ${id} is no longer in the draw pile`);
        return found;
      };
      const rest = drawPile.cards.filter((c) => !arrangement.cardInstanceIds.includes(c.instanceId));
      const zones = state.zones.map((z) => (z.id === drawPile.id ? { ...z, cards: [...action.top.map(inPile), ...rest, ...action.bottom.map(inPile)] } : z));
      const event: ArrangementMadeEvent = { kind: 'ArrangementMadeEvent', seatId: action.seatId, reason: arrangement.reason, top: action.top.length, bottom: action.bottom.length };
      return logWithTriggers({ ...cleared, zones }, [event], ctx);
    }
```

- Add the `give` continuation to `continueSelection`:

```ts
    case 'give': {
      // Who gets the picked cards: one choice, each option a seat.
      const choice: PendingChoice = {
        id: `give-${selection.id}`,
        seatId: selection.seatId,
        reason: selection.reason,
        verb: 'give',
        options: then.toSeatIds.map((seatId) => {
          const seat = state.seats.find((s) => s.id === seatId);
          if (!seat) throw new Error(`Unknown seat: ${seatId}`);
          const moves: Effect[] = ids.map((id) => ({ kind: 'MoveCardEffect', cardInstanceId: id, toZoneId: seat.hand.zoneId }));
          return { id: seatId, shows: { kind: 'seat' as const, seatId }, effects: [...moves, ...(then.then ?? [])] };
        }),
      };
      return { state: queueFront(state, [{ kind: 'OpenChoiceEffect', choice }]), events: [] };
    }
```

- [ ] **Step 6: Redaction**

In `projects/engine/src/lib/domain/redact.ts`:
- `redactZone` takes the set of cards the viewer may see wherever they lie:

```ts
function redactZone(zone: CardZone, viewerSeatId: string, shown: ReadonlySet<string>): CardZone {
  const isViewersOwnHand = zone.kind === 'hand' && zone.ownerSeatId === viewerSeatId;
  const shouldMask = !isFaceUpZoneKind(zone.kind) && !isViewersOwnHand;
  if (!shouldMask) return zone;
  return { ...zone, cards: zone.cards.map((c) => (shown.has(c.instanceId) ? c : maskCard(c))) };
}
```

- Add:

```ts
// Cards the viewer sees though their zone is hidden: those it is arranging.
function shownToViewer(state: GameState, viewerSeatId: string): ReadonlySet<string> {
  return new Set(state.pendingArrangement?.seatId === viewerSeatId ? state.pendingArrangement.cardInstanceIds : []);
}
```

- `hiddenInstanceIds` gains a `shown` parameter and leaves those out: `.flatMap((z) => z.cards.map((c) => c.instanceId)).filter((id) => !shown.has(id))`.
- In `redactStateForSeat`, compute `const shown = shownToViewer(state, viewerSeatId);`, pass it to `hiddenInstanceIds` and to `redactZone`.

- [ ] **Step 7: The app's exhaustive switch**

In `projects/app/src/app/labels.ts`'s `actionLabel`, add:

```ts
    case 'ArrangeCardsAction':
      return 'Arrange';
```

and add `action.kind === 'ArrangeCardsAction'` to `isCardAction` in `projects/app/src/app/game-board/action-list.ts` (the Arrange window offers it, Task 10).

- [ ] **Step 8: Run them to see them pass**

Run: `npx jest projects/engine`
Expected: PASS (the three new test groups included).

Run: `npx jest projects/content projects/app/src/app/labels.spec.ts projects/app/src/app/game-board/action-list.spec.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add projects/engine projects/app/src/app/labels.ts projects/app/src/app/game-board/action-list.ts
git commit -m "feat(engine): seat, suit and label options; giving cards; arranging the draw pile

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Bots and the sim — revealing to use, arranging, the new decision

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts`, `projects/bots/src/lib/rule-based.spec.ts`, `projects/bots/src/lib/random.ts`, `projects/bots/src/lib/random.spec.ts`, `projects/sim/src/invariants.ts`, `projects/sim/src/invariants.spec.ts`

**Interfaces:**
- Consumes: `ChoiceOption` `use.reveals` (Task 3); `PendingArrangement`, `ArrangeCardsAction`, `decisionPending` (Task 7).
- Produces:
  - Rule-based bot: an ask that reveals a General is answered Use only when the bot would use the ability anyway and (either of its Generals is revealed, or it holds at least 4 HP). An arrangement puts Peach, Shan and Sha on top (in the order given) and everything else at the bottom.
  - Random bot: fills an arrangement template with every card on top, in the given order.
  - Sim: `pendingArrangement` must name a living, known seat; a pending arrangement counts as a decision for `checkRestingState`.

- [ ] **Step 1: Write the failing tests**

In `projects/bots/src/lib/rule-based.spec.ts`, add (with `PendingArrangement` added to the type import):

```ts
describe('reveal to use', () => {
  // An ask from the bot's own hidden Main General. 'eight-trigrams' is an id the bot always wants to use.
  const revealAsk: PendingChoice = {
    id: 'ask', seatId: 'seat-0', verb: 'use',
    reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'eight-trigrams' }, abilityId: 'eight-trigrams' },
    options: [{ id: 'use', shows: { kind: 'use', reveals: 'main' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
  };
  const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));
  const answer = (me: Seat) => {
    const action = ruleBasedPolicy.decide(view({ seats: [me, seat('seat-1', 1, 'hidden', 6)], pendingChoice: revealAsk }), 'seat-0', asked, registry, null).action;
    return action.kind === 'ChooseOptionAction' ? action.optionId : action.kind;
  };

  it('reveals with 4 HP or more', () => {
    expect(answer(seat('seat-0', 0, 'Wei', 4))).toBe('use');
  });

  it('keeps hidden below 4 HP while both Generals are hidden', () => {
    expect(answer(seat('seat-0', 0, 'Wei', 3))).toBe('decline');
  });

  it('reveals below 4 HP once its kingdom is known (a General already revealed)', () => {
    const shown = seat('seat-0', 0, 'Wei', 3);
    expect(answer({ ...shown, generals: { ...shown.generals!, deputy: { ...shown.generals!.deputy, revealed: true } } })).toBe('use');
  });
});

describe('arranging the draw pile', () => {
  it('keeps Peach, Shan and Sha on top and sends the rest to the bottom', () => {
    const arrangement: PendingArrangement = {
      id: 'arr', seatId: 'seat-0', cardInstanceIds: ['a1', 'a2', 'a3', 'a4'],
      reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'astrology' }, abilityId: 'astrology' },
    };
    const pile: CardZone = {
      id: 'drawPile', kind: 'drawPile',
      cards: [
        { instanceId: 'a1', definitionId: 'duel', suit: 'spade', rank: 1 },
        { instanceId: 'a2', definitionId: 'shan', suit: 'heart', rank: 2 },
        { instanceId: 'a3', definitionId: 'lion', suit: 'club', rank: 3 },
        { instanceId: 'a4', definitionId: 'peach', suit: 'heart', rank: 4 },
      ],
    };
    const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
    const s = { ...view({ zones: [pile] }), pendingArrangement: arrangement };
    expect(ruleBasedPolicy.decide(s, 'seat-0', [template], registry, null).action).toEqual({ ...template, top: ['a2', 'a4'], bottom: ['a1', 'a3'] });
  });
});
```

In `projects/bots/src/lib/random.spec.ts`, add:

```ts
describe('pickRandomAction with an arrangement', () => {
  it('puts every card on top, in the order given', () => {
    const s: GameState = {
      ...state(),
      pendingArrangement: {
        id: 'arr', seatId: 'seat-a', cardInstanceIds: ['t1', 't2'],
        reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-a', slot: 'main', skillId: 'x' }, abilityId: 'x' },
      },
    };
    expect(pickRandomAction(s, createRng(3), emptyRegistry).action).toEqual({ kind: 'ArrangeCardsAction', seatId: 'seat-a', arrangementId: 'arr', top: ['t1', 't2'], bottom: [] });
  });
});
```

In `projects/sim/src/invariants.spec.ts`, add (with `PendingArrangement` added to the type import):

```ts
describe('a pending arrangement', () => {
  const arrangementFor = (seatId: string): PendingArrangement => ({
    id: 'arr', seatId, cardInstanceIds: [],
    reason: { kind: 'ability', owner: { kind: 'general', seatId, slot: 'main', skillId: 'x' }, abilityId: 'x' },
  });

  it('counts as a decision, so a game may rest with items queued behind it', () => {
    const s = baseState();
    expect(checkRestingState({ ...s, resolutionQueue: [{ kind: 'SkipNextEffect' }], pendingArrangement: arrangementFor(s.seats[0].id) })).toEqual([]);
  });

  it('flags a pending arrangement for an eliminated seat', () => {
    const s = baseState();
    const out = { ...s, seats: s.seats.map((x) => ({ ...x, eliminated: true })), pendingArrangement: arrangementFor(s.seats[0].id) };
    expect(checkInvariants(out)).toContain(`pendingArrangement references eliminated seat ${s.seats[0].id}`);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/bots projects/sim/src/invariants.spec.ts`
Expected: FAIL — the bot reveals at 3 HP (it answers by `wantsToUse` alone) and returns the arrangement template unfilled; the random bot does too; the sim neither flags the eliminated arranger nor treats the arrangement as a decision.

- [ ] **Step 3: The rule-based bot**

In `projects/bots/src/lib/rule-based.ts`:
- Add the type alias `type Arrange = Extract<Action, { kind: 'ArrangeCardsAction' }>;`.
- Add, after `wantsToUse`:

```ts
// Whether the bot will reveal a hidden General to use a skill: once its
// kingdom is known anyway (a General already revealed), or while it holds at
// least 4 HP.
function mayReveal(self: Seat): boolean {
  return !!self.generals && (self.generals.main.revealed || self.generals.deputy.revealed || self.combinedHp >= 4);
}

// Cards worth drawing soon: kept on top when arranging the draw pile.
const KEEP_ON_TOP = new Set(['peach', 'shan', 'sha']);
```

- In `decide`, before step 1a (the selection), add:

```ts
  // 1a0. An arrangement: Peach, Shan and Sha on top, the rest at the bottom.
  const arrangeTemplate = legal.find((a): a is Arrange => a.kind === 'ArrangeCardsAction');
  if (arrangeTemplate && view.pendingArrangement) {
    const ids = view.pendingArrangement.cardInstanceIds;
    const onTop = (id: string) => KEEP_ON_TOP.has(definitionIdOf(view, id) ?? '');
    return take({ ...arrangeTemplate, top: ids.filter(onTop), bottom: ids.filter((id) => !onTop(id)) });
  }
```

- In step 1a', replace the ability ask's decision with:

```ts
    if (choiceNow.reason.kind === 'ability') {
      const use = choiceNow.options.find((o) => o.id === 'use')?.shows;
      const reveals = use?.kind === 'use' && !!use.reveals;
      const wants = wantsToUse(view, me, choiceNow.reason.abilityId, choiceNow.reason.targetSeatId) && (!reveals || mayReveal(me));
      const pick = choiceActions.find((a) => a.optionId === (wants ? 'use' : 'decline'));
      if (pick) return take(pick);
    }
```

- [ ] **Step 4: The random bot**

In `projects/bots/src/lib/random.ts`, before the selection handling:

```ts
  // An arrangement template: every card on top, as given.
  if (picked.kind === 'ArrangeCardsAction' && state.pendingArrangement) {
    return { action: { ...picked, top: [...state.pendingArrangement.cardInstanceIds], bottom: [] }, rng: step.rng };
  }
```

- [ ] **Step 5: The sim's invariants**

In `projects/sim/src/invariants.ts`:
- After the `pendingSelection` block, add:

```ts
  if (state.pendingArrangement) {
    const seat = state.seats.find((s) => s.id === state.pendingArrangement!.seatId);
    if (!seat) violations.push(`pendingArrangement references unknown seat ${state.pendingArrangement.seatId}`);
    else if (seat.eliminated) violations.push(`pendingArrangement references eliminated seat ${seat.id}`);
  }
```

- In `checkRestingState`, use the engine's check: `const decisionPending = isDecisionPending(state);` with `import { decisionPending as isDecisionPending, phaseWaitsForPlayer } from 'engine';`.

- [ ] **Step 6: Run them to see them pass**

Run: `npx jest projects/bots projects/sim`
Expected: PASS, the seeded simulations included.

- [ ] **Step 7: Commit**

```bash
git add projects/bots projects/sim
git commit -m "feat(bots): reveal to use by the spec's rule; arrange the draw pile; sim checks arrangements

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: App — the Ask window's reveal wording, skill names, and seat, suit and label options

**Files:**
- Modify: `projects/app/src/app/game-board/ability-description.ts`, `ability-description.spec.ts`, `ask-dialog.ts`, `ask-dialog.spec.ts`, `choice-description.ts`, `choice-description.spec.ts`, `choice-dialog.ts`, `choice-dialog.spec.ts`, `game-board.ts`, `projects/app/src/app/labels.ts`, `projects/app/src/app/labels.spec.ts`

**Interfaces:**
- Consumes: `abilityName` (Task 2); `use.reveals` (Task 3); seat/suit/label options, `pick`/`give` verbs, the `give` and `replace-judgment` continuations (Tasks 6–7).
- Produces:
  - `AskDescription` gains `generalId: string | null` (the skill's General, shown as its art) and `useLabel: string` ("Use" or "Reveal and Use"). A reveal ask's prompt: "Reveal Guan Yu to use Fighting Saint?".
  - Asks, selections and choices name abilities with `abilityName`.
  - `describeChoice` handles an ability's `pick` and `give` choices; `ChoiceDescription.confirmLabel` is `'Take' | 'Discard' | 'Give' | 'Choose'`.
  - `choiceOptionLabel` labels a seat by its name, a suit as "♥ Heart", a label by its text.
  - `choiceDialogOptions(options, legal, players, declineLabel?, seats?)`: a seat option carries `force`; a suit option carries `suit`.
  - `suitLabel(suit): string` in `labels.ts` ("♠ Spade").
  - `describeSelection` prompts for `give` ("Choose cards to give") and `replace-judgment` ("Choose a hand card to replace the judgment"), with buttons "Give" and "Replace".

- [ ] **Step 1: Write the failing tests**

In `projects/app/src/app/game-board/ability-description.spec.ts`:
- Add `generalId: null, useLabel: 'Use',` to the object the first `describeAsk` test expects with `toEqual`.
- Add:

```ts
  it('a hidden General’s skill: shows the General and asks to reveal it', () => {
    const general = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'fighting-saint' };
    const revealAsk: PendingChoice = {
      id: 'ask', seatId: 'seat-0', verb: 'use',
      reason: { kind: 'ability', owner: general, abilityId: 'fighting-saint' },
      options: [{ id: 'use', shows: { kind: 'use', reveals: 'main' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
    };
    const seated = state({ pendingChoice: revealAsk });
    seated.seats = [{
      id: 'seat-0', index: 0, kingdom: 'Shu', combinedHp: 4, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: 'guan-yu', revealed: false }, deputy: { generalDefinitionId: 'zhang-fei', revealed: true } },
      hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' },
    }];
    expect(describeAsk(seated, 'seat-0', asked)).toMatchObject({
      title: 'Fighting Saint',
      prompt: 'Reveal Guan Yu to use Fighting Saint?',
      useLabel: 'Reveal and Use',
      generalId: 'guan-yu',
      card: null,
    });
  });
```

In `projects/app/src/app/game-board/ask-dialog.spec.ts`:
- Add `generalId: null, useLabel: 'Use',` to the description in `render()`, and give `render` an optional `over: Partial<AskDialogData['description']> = {}` spread into it.
- Add:

```ts
  it('a skill: shows its General’s art, and the Use button says it reveals', () => {
    const { el } = render({ card: null, generalId: 'guan-yu', useLabel: 'Reveal and Use' });
    expect(el.querySelector('app-card-art')).not.toBeNull();
    expect(el.querySelector('app-playing-card')).toBeNull();
    expect(el.querySelector('button.use')!.textContent!.trim()).toBe('Reveal and Use');
  });
```

In `projects/app/src/app/game-board/choice-description.spec.ts`, add:

```ts
describe('describeChoice for a skill’s pick or give', () => {
  const owner = { kind: 'general' as const, seatId: 'seat-1', slot: 'main' as const, skillId: 'kindness' };
  const pick = (verb: 'pick' | 'give', options: ChoiceOption[]): PendingChoice => ({ id: 'p', seatId: 'seat-0', verb, options, reason: { kind: 'ability', owner, abilityId: 'kindness' } });

  it('give: who gets the cards', () => {
    expect(describeChoice(state(pick('give', [{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }])), 'seat-0')).toEqual({
      title: 'Kindness', prompt: 'Choose who gets the cards', confirmLabel: 'Give',
    });
  });

  it('pick: a seat, a suit, or one of several things', () => {
    const say = (options: ChoiceOption[]) => describeChoice(state(pick('pick', options)), 'seat-0')?.prompt;
    expect(say([{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }])).toBe('Choose a seat');
    expect(say([{ id: 'heart', shows: { kind: 'suit', suit: 'heart' }, effects: [] }])).toBe('Name a suit');
    expect(say([{ id: 'done', shows: { kind: 'label', text: 'Done' }, effects: [] }, { id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }])).toBe('Choose one');
  });

  it('labels seats by name, suits by symbol and name, labels by their text; a seat carries its force', () => {
    expect(choiceOptionLabel({ kind: 'seat', seatId: 'seat-1' }, players)).toBe('Seat 1');
    expect(choiceOptionLabel({ kind: 'suit', suit: 'heart' }, players)).toBe('♥ Heart');
    expect(choiceOptionLabel({ kind: 'label', text: 'Discard 2 Hand Cards' }, players)).toBe('Discard 2 Hand Cards');
    const seats = [{ id: 'seat-1', index: 1, kingdom: 'Wu' as const, combinedHp: 3, maxCombinedHp: 3, eliminated: false, generals: null, hand: { zoneId: 'h' }, equipped: { zoneId: 'e' }, judgment: { zoneId: 'j' } }];
    const legal: Action[] = [{ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'p', optionId: 'seat-1' }, { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'p', optionId: 'spade' }];
    const options: ChoiceOption[] = [{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }, { id: 'spade', shows: { kind: 'suit', suit: 'spade' }, effects: [] }];
    expect(choiceDialogOptions(options, legal, players, undefined, seats)).toEqual([
      { id: 'seat-1', action: legal[0], label: 'Seat 1', force: 'Wu' },
      { id: 'spade', action: legal[1], label: '♠ Spade', suit: 'spade' },
    ]);
  });
});
```

In `projects/app/src/app/game-board/choice-dialog.spec.ts`, add:

```ts
  it('shows a seat in its force colour, and a suit in its colour', () => {
    const close = jest.fn();
    const pickSeat: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'p', optionId: 'seat-1' };
    const pickHeart: Action = { ...pickSeat, optionId: 'heart' };
    const data: ChoiceDialogData = {
      description: { title: 'Sow Revolt', prompt: 'Name a suit', confirmLabel: 'Choose' },
      options: [{ id: 'seat-1', action: pickSeat, label: 'Seat 1', force: 'Wu' }, { id: 'heart', action: pickHeart, label: '♥ Heart', suit: 'heart' }],
    };
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
    const fixture = TestBed.createComponent(ChoiceDialog);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-option-id="seat-1"]')!.getAttribute('data-force')).toBe('Wu');
    expect(el.querySelector('[data-option-id="heart"]')!.classList).toContain('red-suit');
    expect(el.querySelector('button.confirm')!.textContent!.trim()).toBe('Choose');
  });
```

In `projects/app/src/app/labels.spec.ts`, add:

```ts
  it('names a suit with its symbol', () => {
    expect([suitLabel('spade'), suitLabel('heart'), suitLabel('club'), suitLabel('diamond')]).toEqual(['♠ Spade', '♥ Heart', '♣ Club', '♦ Diamond']);
  });
```

In `ability-description.spec.ts`'s `describeSelection` tests, add:

```ts
  it('prompts for giving cards and for replacing a judgment', () => {
    const general = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'kindness' };
    const base: PendingSelection = { id: 'g', seatId: 'seat-0', reason: { kind: 'ability', owner: general, abilityId: 'kindness' }, of: 'cards', eligibleIds: ['p1'], min: 1, max: 2, then: { kind: 'give', toSeatIds: ['seat-1'] } };
    const template: Action[] = [{ kind: 'SelectAction', seatId: 'seat-0', selectionId: 'g', ids: [] }];
    expect(describeSelection(state({ pendingSelection: base }), 'seat-0', template)).toMatchObject({ title: 'Kindness', prompt: 'Choose cards to give', confirmLabel: 'Give' });
    const judgment = { seatId: 'seat-1', reader: { kind: 'card' as const, card: { as: 'capture', colour: 'red' as const, physical: [] } }, card: sha };
    const replace: PendingSelection = { ...base, reason: { ...base.reason, abilityId: 'devil' } as PendingSelection['reason'], then: { kind: 'replace-judgment', judgment, owner: general, abilityId: 'devil' } };
    expect(describeSelection(state({ pendingSelection: replace }), 'seat-0', template)).toMatchObject({ title: 'Devil', prompt: 'Choose a hand card to replace the judgment', confirmLabel: 'Replace' });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/app/src/app/game-board/ability-description.spec.ts projects/app/src/app/game-board/ask-dialog.spec.ts projects/app/src/app/game-board/choice-description.spec.ts projects/app/src/app/game-board/choice-dialog.spec.ts projects/app/src/app/labels.spec.ts`
Expected: FAIL — no `generalId`/`useLabel`, no reveal wording, `describeChoice` is null for a skill's pick, option labels and `suitLabel` missing, the new selection kinds have no prompt.

- [ ] **Step 3: Labels**

In `projects/app/src/app/labels.ts`, add after `SUIT_SYMBOLS`:

```ts
const SUIT_NAMES: Record<CardInstance['suit'], string> = { spade: 'Spade', heart: 'Heart', club: 'Club', diamond: 'Diamond' };

// "♥ Heart": a suit as an option to pick.
export function suitLabel(suit: CardInstance['suit']): string {
  return `${SUIT_SYMBOLS[suit]} ${SUIT_NAMES[suit]}`;
}
```

- [ ] **Step 4: The Ask window**

In `projects/app/src/app/game-board/ability-description.ts`:
- Import `abilityName` and `generalDisplayData` from `content` (drop `abilityHint`'s neighbour `cardDisplayData` only if nothing else uses it — `cardName` still does), and `generalDisplayName` from `../labels`.
- `AskDescription` gains:

```ts
  // The General a skill belongs to, shown as its art (null for a worn card).
  generalId: string | null;
  // The Use button: "Use", or "Reveal and Use" when using it reveals a hidden General.
  useLabel: string;
```

- `describeAsk` builds:

```ts
  const { abilityId, owner, targetSeatId } = choice.reason;
  const name = abilityName(abilityId);
  const target = targetSeatId && targetSeatId !== viewerSeatId ? seatName(state.players, targetSeatId) : null;
  const on = target ? ` on ${target}` : '';
  const shows = choice.options.find((o) => o.id === 'use')?.shows;
  const reveals = shows?.kind === 'use' && !!shows.reveals;
  const generalId = owner.kind === 'general' ? (state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot].generalDefinitionId ?? null) : null;
  const generalName = generalId ? (generalDisplayData(generalId)?.name ?? generalDisplayName(generalId)) : null;
  const hint = abilityHint(abilityId);
  return {
    title: name,
    prompt: reveals && generalName ? `Reveal ${generalName} to use ${name}${on}?` : `Use ${name}${on}?`,
    hint: hint ? hint.replace('{target}', target ?? 'the target') : null,
    card: owner.kind === 'equipment' ? (findCard(state, owner.cardInstanceId) ?? null) : null,
    generalId,
    useLabel: reveals ? 'Reveal and Use' : 'Use',
    use,
    decline,
  };
```

- In `describeSelection`, the title becomes `selection.reason.kind === 'ability' ? abilityName(selection.reason.abilityId) : 'Choose'`. Add to `selectionPrompt`'s switch:

```ts
    case 'give':
      return `Choose ${selection.max === 1 ? 'a card' : 'cards'} to give`;
    case 'replace-judgment':
      return 'Choose a hand card to replace the judgment';
```

  and to `CONFIRM_LABELS`: `give: 'Give', 'replace-judgment': 'Replace'`.

In `projects/app/src/app/game-board/ask-dialog.ts`:
- Import `CardArt` from `./card-art` and add it to `imports`.
- Replace the card block with:

```html
      @if (data.description.card; as card) {
        <app-playing-card [card]="card" />
      } @else if (data.description.generalId; as generalId) {
        <app-card-art [id]="generalId" [label]="data.description.title" size="small" />
      }
```

- The Use button's text becomes `{{ data.description.useLabel }}`.

- [ ] **Step 5: The Choice window**

In `projects/app/src/app/game-board/choice-description.ts`:
- Import `Seat` from `engine`, `abilityName` from `content`, and `Force, forceOf, suitLabel` from `../labels`.
- `ChoiceDescription.confirmLabel` becomes `'Take' | 'Discard' | 'Give' | 'Choose'`.
- At the top of `describeChoice`, after the seat check, handle a skill's pick:

```ts
  if (!choice || choice.seatId !== viewerSeatId) return null;
  // A skill's pick (a seat, a suit, one of several labels) or who gets given cards.
  if (choice.reason.kind === 'ability' && (choice.verb === 'pick' || choice.verb === 'give')) {
    const title = abilityName(choice.reason.abilityId);
    if (choice.verb === 'give') return { title, prompt: 'Choose who gets the cards', confirmLabel: 'Give' };
    const kinds = new Set(choice.options.map((o) => o.shows.kind));
    const only = kinds.size === 1 ? [...kinds][0] : null;
    const prompt = only === 'seat' ? 'Choose a seat' : only === 'suit' ? 'Name a suit' : 'Choose one';
    return { title, prompt, confirmLabel: 'Choose' };
  }
  if (choice.reason.kind !== 'choice') return null;
```

  (replacing the old combined `if (!choice || … || choice.reason.kind !== 'choice') return null;`).
- `choiceOptionLabel` handles the new kinds first:

```ts
  if (shows.kind === 'seat') return seatName(players, shows.seatId);
  if (shows.kind === 'suit') return suitLabel(shows.suit);
  if (shows.kind === 'label') return shows.text;
```

- `choiceDialogOptions` gains a last parameter `seats: readonly Seat[] = []`, and its final return becomes:

```ts
    const label = choiceOptionLabel(option.shows, players, declineLabel);
    if (option.shows.kind === 'seat') {
      const seatId = option.shows.seatId;
      return [{ id: option.id, action, label, force: forceOf(seats.find((s) => s.id === seatId)?.kingdom) }];
    }
    if (option.shows.kind === 'suit') return [{ id: option.id, action, label, suit: option.shows.suit }];
    return [{ id: option.id, action, label }];
```

In `projects/app/src/app/game-board/choice-dialog.ts`:
- `ChoiceDialogOption` gains `force?: Force;` (a seat's force colour) and `suit?: CardInstance['suit'];` (import `Force` from `../labels`).
- On the option `<button>`, add `[attr.data-force]="option.force ?? null"` and `[class.red-suit]="option.suit === 'heart' || option.suit === 'diamond'"`; inside, before the label, show a force swatch for seats: `@if (option.force) { <span class="swatch" aria-hidden="true"></span> }`.
- Styles: `.swatch { width: 28px; height: 28px; border-radius: 50%; background: var(--force); }`, `.option[data-force] .label { color: var(--force-text); font-weight: 500; }`, `.red-suit .label { color: #c62828; }`.
- Update the component comment: "A pick: a card (Steal, Break, Harvest), a seat, a suit or one of several labels; then the confirm button."

In `projects/app/src/app/game-board/game-board.ts`, pass the seats: `choiceDialogOptions(choice.options, this.gameService.legalActions(), visible.players, description.declineLabel, visible.seats)`.

- [ ] **Step 6: Run them to see them pass**

Run: `npx jest projects/app`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add projects/app
git commit -m "feat(app): reveal wording and General art in the Ask window; seat, suit and label options

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: App — skill buttons on your avatar, and the Arrange window

**Files:**
- Create: `projects/app/src/app/game-board/avatar-skills.ts`, `avatar-skills.spec.ts`, `arrange-dialog.ts`, `arrange-dialog.spec.ts`
- Modify: `projects/app/src/app/game-board/seat-avatar.ts`, `seat-avatar.spec.ts`, `seat-tile.ts`, `round-table.ts`, `game-board.ts`, `ability-description.ts`, `ability-description.spec.ts`, `projects/app/src/app/decision-timer.service.ts`, `projects/app/src/app/decision-timer.service.spec.ts`

**Interfaces:**
- Consumes: `UseSkillAction`, `SkillDefinition.active`/`lord` (Tasks 1, 4); `pendingArrangement`, `ArrangeCardsAction` (Task 7); `abilityName` (Task 2).
- Produces:
  - `interface AvatarSkill { slot: 'main' | 'deputy'; skillId: string; label: string; action: UseSkillAction | null }`; `avatarSkills(generals: SeatGenerals | null, registry: ContentRegistry, legal: readonly Action[]): AvatarSkill[]`.
  - `SeatAvatar` inputs `skills: AvatarSkill[]` (default `[]`), output `useSkill: Action`. `SeatTile` passes them through (`skills` input, `useSkill` output). `RoundTable` gains `viewerSkills` input and `actionChosen` output.
  - `interface ArrangeDescription { title: string; prompt: string; cards: CardInstance[]; template: ArrangeCardsAction }`; `describeArrangement(state, viewerSeatId, legal): ArrangeDescription | null` (in `ability-description.ts`).
  - `ArrangeDialog` (data `{ description; arrangedChanged?(action) }`), closing with the filled `ArrangeCardsAction`.
  - `defaultDecision(state: GameState, legal: readonly Action[]): Action[]` exported from `decision-timer.service.ts` (what a timeout submits); an arrangement times out with every card on top.

- [ ] **Step 1: Write the failing tests**

Create `projects/app/src/app/game-board/avatar-skills.spec.ts`:

```ts
import { Action, ContentRegistry, SeatGenerals } from 'engine';
import { avatarSkills } from './avatar-skills';

const active = { canUse: () => true, start: () => [] };
const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    ['sun-quan', { id: 'sun-quan', kingdom: 'Wu', maxHp: 4, skills: [{ id: 'reconsider', active }, { id: 'rescued', lord: true, active }] }],
    ['liu-bei', { id: 'liu-bei', kingdom: 'Shu', maxHp: 4, skills: [{ id: 'kindness', active }, { id: 'passive' }] }],
  ]),
};
const generals = (mainRevealed: boolean): SeatGenerals => ({
  main: { generalDefinitionId: 'sun-quan', revealed: mainRevealed },
  deputy: { generalDefinitionId: 'liu-bei', revealed: true },
});
const kindness: Action = { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'general', seatId: 'seat-0', slot: 'deputy', skillId: 'kindness' } };

describe('avatarSkills', () => {
  it('one button per active skill, Lord skills left out, enabled exactly when the engine offers it', () => {
    expect(avatarSkills(generals(true), registry, [kindness])).toEqual([
      { slot: 'main', skillId: 'reconsider', label: 'Reconsider', action: null },
      { slot: 'deputy', skillId: 'kindness', label: 'Kindness', action: kindness },
    ]);
  });

  it('a hidden General’s skill reads "Reveal: …"', () => {
    expect(avatarSkills(generals(false), registry, [])[0].label).toBe('Reveal: Reconsider');
  });

  it('none before the Generals are chosen', () => {
    expect(avatarSkills(null, registry, [])).toEqual([]);
  });
});
```

In `projects/app/src/app/game-board/seat-avatar.spec.ts`, add (importing `Action` from `engine` and `AvatarSkill` from `./avatar-skills`):

```ts
  it('shows skill buttons under each half; a disabled one when not offered; clicking one emits its action', () => {
    const use: Action = { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'reconsider' } };
    const skills: AvatarSkill[] = [
      { slot: 'main', skillId: 'reconsider', label: 'Reconsider', action: use },
      { slot: 'deputy', skillId: 'kindness', label: 'Kindness', action: null },
    ];
    const fixture = TestBed.createComponent(SeatAvatar);
    fixture.componentRef.setInput('generals', { main: { generalDefinitionId: 'sun-quan', revealed: true }, deputy: { generalDefinitionId: 'liu-bei', revealed: true } });
    fixture.componentRef.setInput('skills', skills);
    const emitted: Action[] = [];
    fixture.componentInstance.useSkill.subscribe((a) => emitted.push(a));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const main = el.querySelector('.skill-column[data-slot="main"] button.skill') as HTMLButtonElement;
    const deputy = el.querySelector('.skill-column[data-slot="deputy"] button.skill') as HTMLButtonElement;
    expect(main.textContent!.trim()).toBe('Reconsider');
    expect(deputy.disabled).toBe(true);
    main.click();
    expect(emitted).toEqual([use]);
  });

  it('shows no skill row without skills', () => {
    const el = render({ main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'zhang-fei', revealed: true } });
    expect(el.querySelector('.skills')).toBeNull();
  });
```

In `projects/app/src/app/game-board/ability-description.spec.ts`, add:

```ts
describe('describeArrangement', () => {
  const owner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'astrology' };
  const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
  it('names the skill and shows the cards being arranged, in order', () => {
    const s = state();
    s.zones = [...s.zones, { id: 'drawPile', kind: 'drawPile', cards: [sha, peach] }];
    s.pendingArrangement = { id: 'arr', seatId: 'seat-0', reason: { kind: 'ability', owner, abilityId: 'astrology' }, cardInstanceIds: ['s2', 'p1'] };
    expect(describeArrangement(s, 'seat-0', [template])).toEqual({
      title: 'Astrology',
      prompt: 'Put each card on top of the draw pile or at the bottom. Left to right is the order they go in.',
      cards: [sha, peach],
      template,
    });
    expect(describeArrangement(s, 'seat-1', [])).toBeNull();
  });
});
```

(Import `describeArrangement` with the others.)

Create `projects/app/src/app/game-board/arrange-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { ArrangeDialog, ArrangeDialogData } from './arrange-dialog';

const cards: CardInstance[] = [
  { instanceId: 't1', definitionId: 'peach', suit: 'heart', rank: 3 },
  { instanceId: 't2', definitionId: 'duel', suit: 'spade', rank: 1 },
  { instanceId: 't3', definitionId: 'sha', suit: 'club', rank: 7 },
];
const template: Extract<Action, { kind: 'ArrangeCardsAction' }> = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };

function render() {
  const close = jest.fn();
  const arrangedChanged = jest.fn();
  const data: ArrangeDialogData = { description: { title: 'Astrology', prompt: 'Put each card…', cards, template }, arrangedChanged };
  TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close } }] });
  const fixture = TestBed.createComponent(ArrangeDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    (el.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  };
  return { el, close, arrangedChanged, click };
}

describe('ArrangeDialog', () => {
  it('starts with every card on top, in order', () => {
    const { el, close, click, arrangedChanged } = render();
    expect([...el.querySelectorAll('.item')].map((i) => i.getAttribute('data-card-id'))).toEqual(['t1', 't2', 't3']);
    expect(arrangedChanged).toHaveBeenLastCalledWith({ ...template, top: ['t1', 't2', 't3'], bottom: [] });
    click('button.confirm');
    expect(close).toHaveBeenCalledWith({ ...template, top: ['t1', 't2', 't3'], bottom: [] });
  });

  it('sends a card to the bottom, and moves cards along the row', () => {
    const { close, click, arrangedChanged } = render();
    click('[data-card-id="t2"] button.bottom');
    click('[data-card-id="t3"] button.left');
    expect(arrangedChanged).toHaveBeenLastCalledWith({ ...template, top: ['t1', 't3'], bottom: ['t2'] });
    click('button.confirm');
    expect(close).toHaveBeenCalledWith({ ...template, top: ['t1', 't3'], bottom: ['t2'] });
  });
});
```

In `projects/app/src/app/decision-timer.service.spec.ts`, add a top-level `describe` (importing `defaultDecision` and the `Action`/`GameState` types):

```ts
describe('defaultDecision', () => {
  it('an arrangement times out with every card on top, as given', () => {
    const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
    const state = {
      pendingArrangement: { id: 'arr', seatId: 'seat-0', cardInstanceIds: ['t1', 't2'], reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'x' }, abilityId: 'x' } },
      turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    } as unknown as GameState;
    expect(defaultDecision(state, [template])).toEqual([{ ...template, top: ['t1', 't2'], bottom: [] }]);
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest projects/app/src/app/game-board/avatar-skills.spec.ts projects/app/src/app/game-board/seat-avatar.spec.ts projects/app/src/app/game-board/ability-description.spec.ts projects/app/src/app/game-board/arrange-dialog.spec.ts projects/app/src/app/decision-timer.service.spec.ts`
Expected: FAIL — the modules `./avatar-skills` and `./arrange-dialog`, `describeArrangement`, `defaultDecision` and the avatar's `skills` input don't exist.

- [ ] **Step 3: Avatar skills**

Create `projects/app/src/app/game-board/avatar-skills.ts`:

```ts
import { Action, ContentRegistry, SeatGenerals } from 'engine';
import { abilityName } from 'content';

type UseSkill = Extract<Action, { kind: 'UseSkillAction' }>;

export interface AvatarSkill {
  slot: 'main' | 'deputy';
  skillId: string;
  // "Kindness", or "Reveal: Kindness" for a hidden General's.
  label: string;
  // The engine's action while it offers the skill; null = the button is disabled.
  action: UseSkill | null;
}

// One button per active skill of the viewer's own Generals, Lord skills left
// out (they are never in play). Each is enabled exactly when the engine lists
// its UseSkillAction: the UI never decides whether a skill may be used.
export function avatarSkills(generals: SeatGenerals | null, registry: ContentRegistry, legal: readonly Action[]): AvatarSkill[] {
  if (!generals) return [];
  return (['main', 'deputy'] as const).flatMap((slot) => {
    const general = generals[slot];
    const skills = registry.generals.get(general.generalDefinitionId)?.skills ?? [];
    return skills
      .filter((skill) => skill.active && !skill.lord)
      .map((skill): AvatarSkill => {
        const action =
          legal.find((a): a is UseSkill => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.slot === slot && a.owner.skillId === skill.id) ?? null;
        const name = abilityName(skill.id);
        return { slot, skillId: skill.id, label: general.revealed ? name : `Reveal: ${name}`, action };
      });
  });
}
```

In `projects/app/src/app/game-board/seat-avatar.ts`:
- Import `output` from `@angular/core`, `Action` from `engine`, and `AvatarSkill` from `./avatar-skills`.
- Add to the class:

```ts
  // The viewer's own active skills, as buttons under each half.
  readonly skills = input<AvatarSkill[]>([]);
  readonly useSkill = output<Action>();
  protected readonly slots = ['main', 'deputy'] as const;
  protected skillsOf(slot: 'main' | 'deputy'): AvatarSkill[] {
    return this.skills().filter((s) => s.slot === slot);
  }
```

- After the `.frame` div in the template:

```html
    @if (skills().length) {
      <div class="skills">
        @for (slot of slots; track slot) {
          <div class="skill-column" [attr.data-slot]="slot">
            @for (s of skillsOf(slot); track s.skillId) {
              <button type="button" class="skill" [disabled]="!s.action" (click)="s.action && useSkill.emit(s.action)">{{ s.label }}</button>
            }
          </div>
        }
      </div>
    }
```

- Styles:

```css
    .skills { display: flex; width: 146px; gap: 2px; margin-top: 3px; }
    .skill-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .skill {
      padding: 2px 4px; border: 1px solid var(--force, var(--force-none)); border-radius: 6px;
      background: #fff; font-size: 0.62em; line-height: 1.2; cursor: pointer;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .skill:disabled { opacity: 0.45; cursor: default; }
    .skill:focus-visible { outline: 2px solid #1565c0; outline-offset: 1px; }
```

In `projects/app/src/app/game-board/seat-tile.ts`: add `readonly skills = input<AvatarSkill[]>([]);` and `readonly useSkill = output<Action>();`, and render `<app-seat-avatar [generals]="generals" [skills]="skills()" (useSkill)="useSkill.emit($event)" />`.

In `projects/app/src/app/game-board/round-table.ts`: add `readonly viewerSkills = input<AvatarSkill[]>([]);` and `readonly actionChosen = output<Action>();`; on `<app-seat-tile>` add `[skills]="p.isViewer ? viewerSkills() : []"` and `(useSkill)="actionChosen.emit($event)"`.

In `projects/app/src/app/game-board/game-board.ts`:

```ts
  // The viewer's active skills, as buttons on their avatar.
  protected readonly viewerSkills = computed(() => {
    const seat = this.visibleState()?.seats.find((s) => s.id === this.viewerSeatId());
    return seat ? avatarSkills(seat.generals, this.gameService.registry, this.gameService.legalActions()) : [];
  });
```

and on `<app-round-table>`: `[viewerSkills]="viewerSkills()" (actionChosen)="submit($event)"`.

- [ ] **Step 4: The Arrange window**

In `projects/app/src/app/game-board/ability-description.ts`, add:

```ts
type ArrangeAction = Extract<Action, { kind: 'ArrangeCardsAction' }>;

export interface ArrangeDescription {
  title: string;
  prompt: string;
  // The cards being arranged, top of the draw pile first.
  cards: CardInstance[];
  template: ArrangeAction;
}

// What the Arrange window says, read off a pending arrangement the viewer owes. Null otherwise.
export function describeArrangement(state: GameState, viewerSeatId: string, legal: readonly Action[]): ArrangeDescription | null {
  const arrangement = state.pendingArrangement;
  if (!arrangement || arrangement.seatId !== viewerSeatId) return null;
  const template = legal.find((a): a is ArrangeAction => a.kind === 'ArrangeCardsAction');
  if (!template) return null;
  return {
    title: arrangement.reason.kind === 'ability' ? abilityName(arrangement.reason.abilityId) : 'Arrange',
    prompt: 'Put each card on top of the draw pile or at the bottom. Left to right is the order they go in.',
    cards: arrangement.cardInstanceIds.map((id) => findCard(state, id)).filter((c): c is CardInstance => !!c),
    template,
  };
}
```

Create `projects/app/src/app/game-board/arrange-dialog.ts`:

```ts
import { Component, inject, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { PlayingCard } from './playing-card';
import { DecisionCountdown } from './decision-countdown';
import { ArrangeDescription } from './ability-description';
import { cardFaceLabel } from '../labels';

type ArrangeAction = Extract<Action, { kind: 'ArrangeCardsAction' }>;

export interface ArrangeDialogData {
  description: ArrangeDescription;
  // Told the arrangement on every change, so a timeout can use it.
  arrangedChanged?: (action: Action) => void;
}

interface Placed {
  card: CardInstance;
  place: 'top' | 'bottom';
}

// Astrology: each card on top or at the bottom, in the order the row shows
// (drag, or the arrows, to reorder). Closes only through Confirm, with the
// engine's own ArrangeCardsAction filled in.
@Component({
  selector: 'app-arrange-dialog',
  imports: [MatDialogModule, MatButtonModule, PlayingCard, DecisionCountdown, CdkDropList, CdkDrag],
  template: `
    <h2 mat-dialog-title>{{ data.description.title }}</h2>
    <mat-dialog-content>
      <p class="prompt">{{ data.description.prompt }}</p>
      <ol class="row" cdkDropList cdkDropListOrientation="horizontal" (cdkDropListDropped)="drop($event)">
        @for (item of items(); track item.card.instanceId; let i = $index) {
          <li class="item" cdkDrag [attr.data-card-id]="item.card.instanceId" [class.bottom]="item.place === 'bottom'">
            <app-playing-card [card]="item.card" />
            <div class="place" role="group" [attr.aria-label]="'Where ' + faceOf(item.card) + ' goes'">
              <button type="button" class="top" [class.on]="item.place === 'top'" [attr.aria-pressed]="item.place === 'top'" (click)="place(i, 'top')">Top</button>
              <button type="button" class="bottom" [class.on]="item.place === 'bottom'" [attr.aria-pressed]="item.place === 'bottom'" (click)="place(i, 'bottom')">Bottom</button>
            </div>
            <div class="move">
              <button type="button" class="left" [disabled]="i === 0" [attr.aria-label]="'Move ' + faceOf(item.card) + ' left'" (click)="move(i, -1)">‹</button>
              <button type="button" class="right" [disabled]="i === items().length - 1" [attr.aria-label]="'Move ' + faceOf(item.card) + ' right'" (click)="move(i, 1)">›</button>
            </div>
          </li>
        }
      </ol>
    </mat-dialog-content>
    <!-- At zero: the arrangement as it stands. -->
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" class="confirm" (click)="confirm()">Confirm</button>
    </mat-dialog-actions>
  `,
  styles: `
    .prompt { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .row { list-style: none; padding: 0; margin: 0; display: flex; gap: 12px; overflow-x: auto; }
    .item { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; border-radius: 10px; background: var(--mat-sys-surface-container); cursor: grab; }
    .item.bottom { opacity: 0.7; }
    .place, .move { display: flex; gap: 4px; }
    .place button, .move button {
      padding: 2px 8px; border: 1px solid var(--mat-sys-outline); border-radius: 12px; background: none; color: inherit; cursor: pointer; font: var(--mat-sys-label-medium);
    }
    .place button.on { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); border-color: var(--mat-sys-primary); }
    .move button:disabled { opacity: 0.4; cursor: default; }
    .timer { display: block; padding: 8px 24px 0; }
    .cdk-drag-preview { box-shadow: 0 4px 12px rgb(0 0 0 / 30%); }
    .cdk-drag-placeholder { opacity: 0.3; }
  `,
})
export class ArrangeDialog {
  protected readonly data = inject<ArrangeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<ArrangeDialog, Action>>(MatDialogRef);
  protected readonly items = signal<Placed[]>(this.data.description.cards.map((card) => ({ card, place: 'top' })));

  constructor() {
    this.changed();
  }

  protected faceOf(card: CardInstance): string {
    return cardFaceLabel(card);
  }

  protected place(index: number, place: Placed['place']): void {
    this.items.update((items) => items.map((item, i) => (i === index ? { ...item, place } : item)));
    this.changed();
  }

  protected move(index: number, by: number): void {
    this.items.update((items) => {
      const next = [...items];
      moveItemInArray(next, index, index + by);
      return next;
    });
    this.changed();
  }

  protected drop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex - event.previousIndex);
  }

  protected confirm(): void {
    this.dialogRef.close(this.action());
  }

  private action(): ArrangeAction {
    const items = this.items();
    return {
      ...this.data.description.template,
      top: items.filter((i) => i.place === 'top').map((i) => i.card.instanceId),
      bottom: items.filter((i) => i.place === 'bottom').map((i) => i.card.instanceId),
    };
  }

  private changed(): void {
    this.data.arrangedChanged?.(this.action());
  }
}
```

In `projects/app/src/app/game-board/game-board.ts`:
- Import `ArrangeDialog, ArrangeDialogData` and `describeArrangement`.
- Add, beside the selection fields:

```ts
  private arrangeDialog: MatDialogRef<ArrangeDialog, Action> | null = null;
  // The arrangement whose dialog is showing, so each opens only once.
  private arrangeDialogFor: string | null = null;
  // The arrangement the viewer owes, while the board is on screen and the engine offers it.
  protected readonly arrangementDue = computed(() => {
    const arrangement = this.visibleState()?.pendingArrangement;
    if (!arrangement || arrangement.seatId !== this.viewerSeatId()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'ArrangeCardsAction') ? arrangement.id : null;
  });
```

- In the constructor, beside the selection effect:

```ts
    effect(() => {
      const arrangementId = this.arrangementDue();
      untracked(() => {
        if (this.arrangeDialogFor && this.arrangeDialogFor !== arrangementId) this.closeDialog(this.arrangeDialog);
        if (arrangementId) this.openArrangeDialog(arrangementId);
      });
    });
```

- Add the method:

```ts
  // Opens the Arrange dialog for one pending arrangement; it closes with the
  // engine's ArrangeCardsAction filled in.
  private openArrangeDialog(arrangementId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (this.arrangeDialogFor === arrangementId || !visible || !seatId) return;
    const description = describeArrangement(visible, seatId, this.gameService.legalActions());
    if (!description) return;
    this.arrangeDialogFor = arrangementId;
    const ref = this.dialog.open<ArrangeDialog, ArrangeDialogData, Action>(ArrangeDialog, {
      data: { description, arrangedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 720px)',
      disableClose: true,
    });
    this.arrangeDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.arrangeDialogFor = null;
      this.arrangeDialog = null;
      if (action) this.submit(action);
    });
  }
```

- [ ] **Step 5: The timer**

In `projects/app/src/app/decision-timer.service.ts`:
- Count an arrangement as a choice: `if (state.pendingChoice || state.pendingSelection || state.pendingArrangement) return { kind: 'choice', state, key: this.keyOf(state) };`.
- Move the body of the private `defaultActions(state)` into an exported function, and add the arrangement first:

```ts
// What a timeout submits when the UI hasn't said: Cancel or the first picks
// for a selection, every card on top for an arrangement, Don't for an ask, the
// first option of a choice, No Response, the first General pair, the first
// discards, else End Phase.
export function defaultDecision(state: GameState, legal: readonly Action[]): Action[] {
  const arrange = legal.find((a): a is Extract<Action, { kind: 'ArrangeCardsAction' }> => a.kind === 'ArrangeCardsAction');
  if (arrange && state.pendingArrangement) return [{ ...arrange, top: [...state.pendingArrangement.cardInstanceIds], bottom: [] }];
  // Then the old defaultActions body, from `const cancel = …` to its last
  // `return`, unchanged except that it reads `legal` (not this.game.legalActions()).
}
```

  and in the class, `tick()` calls `defaultDecision(state, this.game.legalActions())`; delete the private method.

- [ ] **Step 6: Run them to see them pass**

Run: `npx jest projects/app`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add projects/app
git commit -m "feat(app): skill buttons on your avatar, and the Arrange window

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: App — the new Action History lines

**Files:**
- Modify: `projects/app/src/app/game-board/action-history.ts`, `projects/app/src/app/game-board/action-history.spec.ts`, `projects/app/src/app/labels.ts`

**Interfaces:**
- Consumes: `GeneralRevealedEvent.forAbilityId` (Task 3); `AbilityUsedEvent` outcome `used` (Task 4); `HpLostEvent` (Task 5); `JudgmentChangedEvent`, skill readers (Task 6); seat/suit/label options, `give`, `ArrangementMadeEvent` (Task 7); `abilityName` (Task 2).
- Produces (history lines, sentence case, keywords capitalised):
  - "Hing revealed Guan Yu to use Fighting Saint" (the ask's own "used" line is left out when it revealed).
  - "Seat 1 used Reconsider" (an active skill's use).
  - "Hing lost 1 HP (Battered Body)", or "Hing lost 1 HP" with no skill, as a status line in Hing's force colour.
  - "Seat 2's Devil changed the judgment to 3 ♠", with the new card beside it.
  - "Seat 1's Unyielding judgment: 5 ♥" (a skill's judgment; from Task 6's `judgmentReaderName`).
  - "Hing gave 2 cards to Seat 1"; "Hing chose Seat 1"; "Seat 1 named ♥"; "Seat 1 chose Done".
  - "Seat 1 put 2 cards on top of the draw pile and 1 at the bottom" (or only one half when the other is 0).
  - Every ability named in a line uses `abilityName` (cards and skills alike).
  - `suitSymbol(suit): string` exported from `labels.ts`.

- [ ] **Step 1: Write the failing tests**

In `projects/app/src/app/game-board/action-history.spec.ts`, add (importing `Seat` from `engine`):

```ts
describe('skill lines', () => {
  const general = (seatId: string, slot: 'main' | 'deputy', skillId: string) => ({ kind: 'general' as const, seatId, slot, skillId });
  const seats: Seat[] = [{
    id: 'seat-0', index: 0, kingdom: 'Shu', combinedHp: 3, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'liu-bei', revealed: false } },
    hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' },
  }];
  const lines = (log: EngineEvent[]) => actionHistory(log, zones, [], seats).flatMap((e) => (e.kind === 'action' ? [e.text] : []));

  it('a reveal to use a skill names the General and the skill, once', () => {
    expect(lines([
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'use', shows: { kind: 'use', reveals: 'main' }, reason: { kind: 'ability', owner: general('seat-0', 'main', 'fighting-saint'), abilityId: 'fighting-saint' } },
      { kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'main', forAbilityId: 'fighting-saint' },
    ])).toEqual(['Seat 0 revealed Guan Yu to use Fighting Saint']);
  });

  it('an active skill’s use, and HP lost to a skill', () => {
    expect(lines([
      { kind: 'AbilityUsedEvent', owner: general('seat-0', 'main', 'battered-body'), abilityId: 'battered-body', outcome: 'used' },
      { kind: 'HpLostEvent', seatId: 'seat-0', amount: 1, abilityId: 'battered-body' },
      { kind: 'HpLostEvent', seatId: 'seat-0', amount: 2 },
    ])).toEqual(['Seat 0 lost 2 HP', 'Seat 0 lost 1 HP (Battered Body)', 'Seat 0 used Battered Body']);
    expect(actionHistory([{ kind: 'HpLostEvent', seatId: 'seat-0', amount: 1 }], zones, [], seats)[0]).toMatchObject({ force: 'Shu' });
  });

  it('a changed judgment, and a skill’s judgment', () => {
    const three: CardInstance = { instanceId: 'r1', definitionId: 'sha', suit: 'spade', rank: 3 };
    const five: CardInstance = { instanceId: 'j1', definitionId: 'shan', suit: 'heart', rank: 5 };
    const history = actionHistory([
      { kind: 'JudgmentEvent', seatId: 'seat-1', reader: { kind: 'skill', owner: general('seat-1', 'main', 'unyielding') }, card: five },
      { kind: 'JudgmentChangedEvent', owner: general('seat-0', 'main', 'devil'), abilityId: 'devil', judgedSeatId: 'seat-1', card: three, replaced: five },
    ], zones, [], seats);
    expect(history.flatMap((e) => (e.kind === 'action' ? [e.text] : []))).toEqual(["Seat 0's Devil changed the judgment to 3 ♠", "Seat 1's Unyielding judgment: 5 ♥"]);
    expect(history[0]).toMatchObject({ card: three });
  });

  it('giving cards, picking a seat, naming a suit, choosing a label', () => {
    const reason = { kind: 'ability' as const, owner: general('seat-0', 'deputy', 'kindness'), abilityId: 'kindness' };
    expect(lines([
      { kind: 'SelectionMadeEvent', seatId: 'seat-0', reason, of: 'cards', ids: ['a', 'b'] },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'give', shows: { kind: 'seat', seatId: 'seat-1' }, reason },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'seat', seatId: 'seat-1' }, reason },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'pick', shows: { kind: 'suit', suit: 'heart' }, reason },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'label', text: 'Done' }, reason },
    ])).toEqual(['Seat 0 chose Done', 'Seat 1 named ♥', 'Seat 0 chose Seat 1', 'Seat 0 gave 2 cards to Seat 1']);
  });

  it('an arrangement of the draw pile, by its counts', () => {
    const reason = { kind: 'ability' as const, owner: general('seat-0', 'main', 'astrology'), abilityId: 'astrology' };
    expect(lines([
      { kind: 'ArrangementMadeEvent', seatId: 'seat-0', reason, top: 2, bottom: 1 },
      { kind: 'ArrangementMadeEvent', seatId: 'seat-0', reason, top: 3, bottom: 0 },
      { kind: 'ArrangementMadeEvent', seatId: 'seat-0', reason, top: 0, bottom: 1 },
    ])).toEqual([
      'Seat 0 put 1 card at the bottom of the draw pile',
      'Seat 0 put 3 cards on top of the draw pile',
      'Seat 0 put 2 cards on top of the draw pile and 1 at the bottom',
    ]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest projects/app/src/app/game-board/action-history.spec.ts`
Expected: FAIL — none of the new events has a line yet; the reveal reads "Seat 0 revealed their Main General" after a "used" line.

- [ ] **Step 3: The lines**

In `projects/app/src/app/labels.ts`, export the symbol lookup:

```ts
// "♥": a suit's symbol alone.
export function suitSymbol(suit: CardInstance['suit']): string {
  return SUIT_SYMBOLS[suit];
}
```

In `projects/app/src/app/game-board/action-history.ts`:
- Import `abilityName` and `generalDisplayData` from `content`, and `generalDisplayName`, `judgmentReaderName` (already, from Task 6), `suitSymbol` from `../labels`.
- Add helpers near the top of `actionHistory`:

```ts
  const cards = (n: number) => `${n} ${n === 1 ? 'card' : 'cards'}`;
  // The General in `slot` of a seat, by name, when the viewer can see it.
  const generalIn = (seatId: string, slot: 'main' | 'deputy'): string | null => {
    const id = seats.find((s) => s.id === seatId)?.generals?.[slot].generalDefinitionId;
    return id && id !== 'hidden' ? (generalDisplayData(id)?.name ?? generalDisplayName(id)) : null;
  };
  // How many cards a seat picked last, for "gave 2 cards".
  let lastPicked: { seatId: string; count: number } | null = null;
```

- Replace the `GeneralRevealedEvent` case:

```ts
      case 'GeneralRevealedEvent': {
        const which = generalIn(event.seatId, event.slot) ?? `their ${event.slot === 'main' ? 'Main' : 'Deputy'} General`;
        action(event.forAbilityId ? `${name(event.seatId)} revealed ${which} to use ${abilityName(event.forAbilityId)}` : `${name(event.seatId)} revealed their ${event.slot === 'main' ? 'Main' : 'Deputy'} General`);
        break;
      }
```

- Replace the `ChoiceMadeEvent` case:

```ts
      case 'ChoiceMadeEvent': {
        const { reason, shows } = event;
        const chooser = name(event.seatId);
        if (shows.kind === 'card' || shows.kind === 'hidden-hand') {
          picked = event;
        } else if (shows.kind === 'use' && reason.kind === 'ability') {
          // A reveal says it on its own line, next.
          if (!shows.reveals) {
            const on = reason.targetSeatId && reason.targetSeatId !== event.seatId ? ` on ${name(reason.targetSeatId)}` : '';
            action(`${chooser} used ${abilityName(reason.abilityId)}${on}`);
          }
        } else if (shows.kind === 'decline' && reason.kind === 'choice') {
          action(`${chooser} let ${name(reason.userSeatId)} draw a card (${cardName(reason.card.as)})`);
        } else if (shows.kind === 'seat') {
          const given = lastPicked?.seatId === event.seatId ? lastPicked.count : 0;
          action(event.verb === 'give' ? `${chooser} gave ${cards(given)} to ${name(shows.seatId)}` : `${chooser} chose ${name(shows.seatId)}`);
        } else if (shows.kind === 'suit') {
          action(`${chooser} named ${suitSymbol(shows.suit)}`);
        } else if (shows.kind === 'label') {
          action(`${chooser} chose ${shows.text}`);
        }
        break;
      }
```

- In the `AbilityUsedEvent` case, use `abilityName(event.abilityId)` for `ability`, and add the active skill's line first:

```ts
        if (event.outcome === 'used') {
          action(`${owner} used ${ability}`);
        } else if (event.outcome === 'no-effect' && event.targetSeatId) {
```

- In the `SelectionMadeEvent` case, record card picks and use `abilityName`:

```ts
      case 'SelectionMadeEvent':
        if (event.of === 'cards') lastPicked = { seatId: event.seatId, count: event.ids.length };
        if (event.of === 'seats' && event.reason.kind === 'ability') {
          const picks = event.ids.map(name);
          const list = picks.length > 1 ? `${picks.slice(0, -1).join(', ')} and ${picks.at(-1)}` : picks[0];
          action(`${name(event.seatId)} picked ${list} with ${abilityName(event.reason.abilityId)}`);
        }
        break;
```

- Add the new cases:

```ts
      case 'HpLostEvent':
        status(event.seatId, `${name(event.seatId)} lost ${event.amount} HP${event.abilityId ? ` (${abilityName(event.abilityId)})` : ''}`);
        break;
      case 'JudgmentChangedEvent':
        action(`${name(event.owner.seatId)}'s ${abilityName(event.abilityId)} changed the judgment to ${cardFaceLabel(event.card)}`, event.card);
        break;
      case 'ArrangementMadeEvent': {
        const top = event.top > 0 ? `${cards(event.top)} on top of the draw pile` : '';
        const bottom = event.bottom > 0 ? (top ? `${event.bottom} at the bottom` : `${cards(event.bottom)} at the bottom of the draw pile`) : '';
        action(`${name(event.seatId)} put ${[top, bottom].filter(Boolean).join(' and ')}`);
        break;
      }
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx jest projects/app`
Expected: PASS (the round table's recent-log lines read from the same function).

- [ ] **Step 5: Commit**

```bash
git add projects/app
git commit -m "feat(app): history lines for reveals to use, skills, lost HP, changed judgments, gifts and arrangements

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The event chain doc, and the full check

**Files:**
- Modify: `docs/architecture/event-chain.md`

- [ ] **Step 1: Add a section on skills**

Insert before `## Plugging into the chain`:

```markdown
## General skills

**Which skills count.** `skillsInPlay(state, seatId, registry)` decides, for
triggers, conversions, active skills and content's modifiers alike:
- a revealed General's skills all count;
- a hidden General's compulsory skills (and their modifiers) are off; its
  other skills count, marked `needsReveal`;
- Lord skills never count (Guozhan has no Lord).

A General's ability owner is `{ kind: 'general', seatId, slot, skillId }`.

**Reveal to use.** An `AskUseEffect` from a hidden General's skill puts a
`RevealGeneralEffect` (with `forAbilityId`) at the front of its Use option. A
hidden General's conversion or active skill reveals when its first selection
is confirmed: `PendingSelection.onSelect` resolves at the confirm, before the
continuation. Cancel leaves the General hidden.

**Active skills.** `SkillDefinition.active` gives a `UseSkillAction` in its
owner's Play Phase while `canUse` holds and `Turn.abilityUses` is under
`usesPerTurn`. Using one counts it (`IncrementEffect`) and logs an
`AbilityUsedEvent` (`used`), at once or, when `start` opens with a
cancellable selection, through that selection's `onSelect`.

**Counters.** `Turn.abilityUses` and `Turn.ownerUses` (every card the turn
owner used, answers included) end with the turn; `Seat.marks` last the game.

**Losing HP** (`LoseHpEffect` → `HpLostEvent`) is not damage: damage triggers
don't fire. Guozhan runs its reveal and dying rules after both.

**The Draw Phase** is one `DrawPhaseEffect { count }`. Before-triggers change
the count or replace the draw.

**Judgments** run in steps, each a queue item:
1. `JudgeEffect`: the top card is turned up into `processing` (nothing left:
   `otherwise` goes ahead).
2. `JudgmentShownEffect`: skills that change judgments hook in here.
   `ReplaceJudgmentEffect` discards the card, puts a hand card in its place
   and shows the judgment again.
3. `JudgmentResolveEffect`: the reader (a card's `onJudged`, or a skill's)
   reads the final card.
4. `JudgmentDoneEffect`: the card goes to the discard pile unless something
   took it first. A reader may place this step itself (Eight Trigrams does,
   ahead of the Shan window it opens).

**More decisions.**
- Choice options may show a seat, a suit or a label (`pick`), and a `give`
  selection is followed by a choice of who gets the cards.
- `pendingArrangement` asks a seat to put cards from the top of the draw
  pile back, some on top and some at the bottom, in its order
  (`ArrangeCardsAction`, checked by `validateArrangement`). Only that seat
  sees the cards.
```

Add rows to the "Plugging into the chain" table:

```markdown
| A General's skill | `SkillDefinition` (abilities, plus `compulsory`, `lord`, `active`, `onJudged`) | the placeholder skills |
| A skill used on purpose | `SkillDefinition.active` → `UseSkillAction` | Kindness (stage 7) |
| Changing or taking a judgment | `before:JudgmentShownEffect` / `before:JudgmentDoneEffect` triggers | Devil, Heaven's Envy (stage 7) |
| Rewriting the Draw Phase | a `before:DrawPhaseEffect` trigger | Brave Gesture (stage 7) |
| Arranging the draw pile | `OpenArrangementEffect` | Astrology (stage 7) |
```

- [ ] **Step 2: Run everything**

Run: `npx jest`
Expected: PASS, every project, including the sim's seeded batches at every seat count from 2 to 10.

Run: `npm run build && npx ng build app`
Expected: both builds succeed.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/event-chain.md
git commit -m "docs: General skills, reveal to use, judgment steps and arrangements in the event chain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
