# General Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each seat in a Kingdom War game is dealt 5 candidate generals and picks 2 of the same kingdom, as Main and Deputy, in an Angular Material view before turn 1.

**Architecture:** Selection is a real pre-game phase (`'GeneralSelection'`) inside `GameState`, driven by the existing `getLegalActions` → `resolve` loop through a new `ChooseGeneralsAction`. The content registry is first rebuilt from the 25 crawled general data files plus a migrated Dong Zhuo (26 generals). `kingdomWarMode.setup` deals the candidates. The Angular `GeneralSelection` component only renders the engine's legal actions and emits the one matching the player's selection.

**Tech Stack:** TypeScript 6, Angular 22 (standalone components, signals), Angular Material 22 (M3 prebuilt theme), Jest 30 (ts-jest for engine/content/sim, jest-preset-angular for app).

**Spec:** `docs/superpowers/specs/2026-09-30-general-selection-design.md`

## Global Constraints

- The engine (`projects/engine`) MUST NOT import Angular, browser APIs, or `content`. It stays executable under plain Node.
- The UI MUST NOT decide legality. It only renders and emits `Action`s returned by `getLegalActions` (CLAUDE.md, Presentation layer).
- There must be no central switch over content ids. General definitions come from the data registry (CLAUDE.md, Extensibility).
- `GameState` stays plain JSON-serializable data. `generalSelection.candidates` is a `Record<string, string[]>`, not a `Map`.
- `GENERALS_PER_SEAT = 5`, and `maxSeats(registry) = floor(registry.generals.size / 5)`, which is 5 with 26 generals.
- `GeneralsChosenEvent` carries only `{ kind, seatId }` and never a general id, because the log is public.
- Material components are used only in `GeneralSelection`. Setup and Board are not restyled.
- Commits end with the trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Commit only the files a task touches, because the working tree has unrelated uncommitted work.
- Type-check commands (Jest does not type-check here, because tsconfig uses `isolatedModules`):
  - engine: `npx tsc -p projects/engine/tsconfig.spec.json --noEmit`
  - content: `npx tsc -p projects/content/tsconfig.spec.json --noEmit`
  - sim: `npx tsc -p projects/sim/tsconfig.json --noEmit`
  - app: `npx tsc -p projects/app/tsconfig.spec.json --noEmit`
  - app templates: `npx ng build app --configuration development`

## Review Focus

1. **Every seat picks the same kingdom** (for example, both seats of a 2-seat game pick Shu). The existing win rule (one living non-Qun kingdom wins) fires as soon as the last seat chooses, so the game ends before turn 1. This is the spec's behavior (the win check is skipped only *during* selection). Task 3 pins it with a test so any change is deliberate, and it is flagged to the user at handoff.
2. **A seat count above `maxSeats` reaching `GameService.startGame`** (for example, a stale 8 in Setup). The user expects a clamp or a visible error, not an uncaught exception. Task 6 pins this: Setup clamps to 5, and `startGame(8)` sets `lastError` and leaves the state null.
3. **A dealt candidate that has no same-kingdom partner** (for example, the only Qun among 5). The user expects that card to be unselectable from the start, so they can't get stuck with a pick nothing matches. Task 7 disables any card that appears in no legal action. This is slightly stricter than the spec's wording ("enabled iff nothing is selected…"), which would have allowed the stuck state.
4. **Deselecting Main while a Deputy is selected.** The user expects the remaining pick to become Main, not a blank Main slot. Task 7 pins this.
5. **Another seat's candidates leaking through the redacted view,** via `generalSelection`, `seats`, or the log. Task 3 pins that the viewer sees only `'hidden'` placeholders for other seats' candidates (count preserved) and that `GeneralsChosenEvent` has no general ids.

---

## File Structure

| File | Responsibility |
|---|---|
| `projects/content/data/generals/qun/dong-zhuo.json` (new) | Migrated data for the one hand-coded non-base general |
| `projects/content/data/generals/index.ts` | Adds Dong Zhuo to `generalsData` |
| `projects/content/src/lib/generals/types.ts` (new) | `GeneralSkillSet` = `{ id, skills }` |
| `projects/content/src/lib/generals/setOne.ts`, `setTwo.ts` | Export `GeneralSkillSet`s (skills only) |
| `projects/content/src/lib/generals/index.ts` (new) | `GENERAL_SKILLS` map, keyed by general id |
| `projects/content/src/lib/registry.ts` | Builds generals from data + `GENERAL_SKILLS` |
| `projects/content/src/lib/display.ts` (new) | `generalDisplayData(id)` for the UI |
| `projects/engine/src/lib/domain/types.ts` | `Phase` gains `'GeneralSelection'`; `SeatGenerals`, `GeneralSelectionState`; nullable `Seat.generals`; `GameState.generalSelection` |
| `projects/engine/src/lib/pipeline/actions.ts`, `events.ts` | `ChooseGeneralsAction`, `GeneralsChosenEvent` |
| `projects/engine/src/lib/rules/activeSeat.ts` (new) | `getActiveSeatId(state)` |
| `projects/engine/src/lib/rules/generalSelection.ts` (new) | Legal pair enumeration and applying a choice |
| `projects/engine/src/lib/rules/legality.ts` | Delegates to selection rules during `GeneralSelection` |
| `projects/engine/src/lib/pipeline/resolve.ts` | New action case, phase guard, win-check skip |
| `projects/engine/src/lib/domain/redact.ts` | Null-safe seats; candidate redaction |
| `projects/content/src/lib/modes/kingdomWar.ts` | Deal, seat cap, initial selection state |
| `projects/sim/src/bot.ts`, `runGame.ts`, `invariants.ts` | Registry-aware bot; selection invariants |
| `projects/app/src/app/game.service.ts` | Engine `getActiveSeatId`, registry-aware legal actions, `maxSeats`, guarded `startGame` |
| `projects/app/src/app/labels.ts` | Labels for the new action and event |
| `projects/app/src/app/game-board/seat-summary.ts` | Renders a seat with no generals yet |
| `projects/app/src/app/setup/setup.ts` | Seat cap from `maxSeats` |
| `projects/app/src/app/game-board/general-selection.ts` (new) | Material selection view |
| `projects/app/src/app/game-board/game-board.ts` | Shows `GeneralSelection` during the phase |

---

### Task 1: Content registry built from general data

**Files:**
- Create: `projects/content/data/generals/qun/dong-zhuo.json`
- Modify: `projects/content/data/generals/index.ts`
- Create: `projects/content/src/lib/generals/types.ts`
- Modify: `projects/content/src/lib/generals/setOne.ts`, `projects/content/src/lib/generals/setTwo.ts`
- Create: `projects/content/src/lib/generals/index.ts`
- Modify: `projects/content/src/lib/registry.ts`
- Create: `projects/content/src/lib/display.ts`, `projects/content/src/lib/display.spec.ts`
- Modify: `projects/content/src/public-api.ts`
- Test: `projects/content/src/lib/registry.spec.ts`, `projects/content/src/lib/generals/setOne.spec.ts`, `projects/content/src/lib/generals/setTwo.spec.ts`

**Interfaces:**
- Consumes: `generalsData: Record<string, GeneralData>` from `projects/content/data/generals/index.ts` (existing).
- Produces:
  - `buildContentRegistry(): ContentRegistry` with 26 generals. `kingdom` and `maxHp` come from the data, and `skills` from `GENERAL_SKILLS`, defaulting to `[]`.
  - `interface GeneralSkillSet { id: string; skills: SkillDefinition[] }`.
  - `generalDisplayData(id: string): GeneralDisplayData | null`, where `interface GeneralDisplayData { name: string; title: string | null; skills: { name: string; text: string }[] }`, exported from `content`.

- [ ] **Step 1: Write the failing registry test**

Replace `projects/content/src/lib/registry.spec.ts` with:

```ts
import { buildContentRegistry } from './registry';

describe('buildContentRegistry', () => {
  it('registers the same seven cards as before', () => {
    const registry = buildContentRegistry();
    expect([...registry.cards.keys()].sort()).toEqual(
      ['duel', 'green-dragon-blade', 'peach', 'sha', 'shan', 'silver-lion', 'wuxie'].sort()
    );
  });

  it('builds every data-driven general: 25 base-set plus the migrated Dong Zhuo', () => {
    const registry = buildContentRegistry();
    expect(registry.generals.size).toBe(26);
    expect(registry.generals.has('cao-cao')).toBe(true);
    expect(registry.generals.has('dong-zhuo')).toBe(true);
  });

  it('takes kingdom and maxHp from the data files (data wins over old hand-coded values)', () => {
    const registry = buildContentRegistry();
    expect(registry.generals.get('zhao-yun')!.kingdom).toBe('Shu');
    expect(registry.generals.get('cao-cao')).toMatchObject({ kingdom: 'Wei', maxHp: 4 });
    expect(registry.generals.get('dong-zhuo')).toMatchObject({ kingdom: 'Qun', maxHp: 4 });
  });

  it('attaches hand-coded skills by id and gives data-only generals no skills', () => {
    const registry = buildContentRegistry();
    const skillIds = (id: string) => registry.generals.get(id)!.skills.map((s) => s.id);
    expect(skillIds('xiahou-dun')).toEqual(['ferocity']);
    expect(skillIds('sun-shangxiang')).toEqual(['valor']);
    expect(skillIds('zhuge-liang')).toEqual(['insight']);
    expect(skillIds('dong-zhuo')).toEqual(['tyranny']);
    expect(skillIds('zhao-yun')).toEqual(['vanguard']);
    expect(skillIds('huang-yueying')).toEqual([]);
    expect(skillIds('cao-cao')).toEqual([]);
  });

  it('has at least two generals in each of the four kingdoms', () => {
    const registry = buildContentRegistry();
    const counts = new Map<string, number>();
    for (const g of registry.generals.values()) counts.set(g.kingdom, (counts.get(g.kingdom) ?? 0) + 1);
    for (const kingdom of ['Wei', 'Shu', 'Wu', 'Qun']) {
      expect(counts.get(kingdom)).toBeGreaterThanOrEqual(2);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest projects/content/src/lib/registry.spec.ts`
Expected: FAIL. The size test fails with `Expected: 26, Received: 6`, and the Zhao Yun test fails with `Received: "Wei"`.

- [ ] **Step 3: Add Dong Zhuo's migrated data file**

Create `projects/content/data/generals/qun/dong-zhuo.json`:

```json
{
  "maxHp": 4,
  "name": "Dong Zhuo",
  "skills": [
    {
      "name": "Tyranny",
      "nameZh": "",
      "text": "Whenever Dong Zhuo would recover health, he recovers 1 less."
    }
  ],
  "source": {
    "crawledAt": "2026-09-30",
    "site": "Hand-coded content migrated from projects/content/src/lib/generals/setTwo.ts (not a base-set general; maxHp carried forward as-is, see the content data pipeline spec's Open Items)",
    "url": ""
  }
}
```

In `projects/content/data/generals/index.ts`, add the import after the `luBuQun` import:

```ts
import dongZhuoQun from './qun/dong-zhuo.json';
```

Then add this entry after the `'lu-bu'` entry in `generalsData`:

```ts
  'dong-zhuo': { ...(dongZhuoQun as GeneralFileData), kingdom: 'Qun' },
```

- [ ] **Step 4: Refactor the hand-coded generals to skills-only**

Create `projects/content/src/lib/generals/types.ts`:

```ts
import type { SkillDefinition } from 'engine';

// The hand-coded half of a general: only its skill logic. Its id, kingdom and
// maxHp come from the general's data file (projects/content/data/generals).
export interface GeneralSkillSet {
  id: string;
  skills: SkillDefinition[];
}
```

In `setOne.ts`:
- Change `import type { GeneralDefinition, Effect } from 'engine';` to `import type { Effect } from 'engine';`, and add `import type { GeneralSkillSet } from './types';`.
- For each of `xiahouDunGeneral`, `sunShangxiangGeneral` and `zhugeLiangGeneral`, change the type annotation `: GeneralDefinition` to `: GeneralSkillSet`, and delete that object's `kingdom:` and `maxHp:` lines.

Make the same edit in `setTwo.ts` for `dongZhuoGeneral`, `zhaoYunGeneral` and `huangYueyingGeneral`. Keep its existing `getSeatDistance` import.

Create `projects/content/src/lib/generals/index.ts`:

```ts
import type { SkillDefinition } from 'engine';
import type { GeneralSkillSet } from './types';
import { xiahouDunGeneral, sunShangxiangGeneral, zhugeLiangGeneral } from './setOne';
import { dongZhuoGeneral, zhaoYunGeneral, huangYueyingGeneral } from './setTwo';

const HAND_CODED: GeneralSkillSet[] = [
  xiahouDunGeneral,
  sunShangxiangGeneral,
  zhugeLiangGeneral,
  dongZhuoGeneral,
  zhaoYunGeneral,
  huangYueyingGeneral,
];

// Skill logic keyed by general id. A general with data but no entry here is a
// playable vanilla general (skills: []).
export const GENERAL_SKILLS: ReadonlyMap<string, SkillDefinition[]> = new Map(
  HAND_CODED.map((g) => [g.id, g.skills])
);
```

- [ ] **Step 5: Rebuild `buildContentRegistry` from data**

Replace `projects/content/src/lib/registry.ts` with:

```ts
import type { ContentRegistry, GeneralDefinition } from 'engine';
import { generalsData } from '../../data/generals';
import { GENERAL_SKILLS } from './generals';
import { shaCard } from './cards/sha';
import { shanCard } from './cards/shan';
import { peachCard } from './cards/peach';
import { duelCard } from './cards/duel';
import { wuxieCard } from './cards/wuxie';
import { silverLionCard, greenDragonBladeCard } from './cards/equipment';

function buildGenerals(): GeneralDefinition[] {
  const generals: GeneralDefinition[] = [];
  for (const [id, data] of Object.entries(generalsData)) {
    // maxHp is load-bearing for combined HP, so a general without one stays out
    // of play rather than silently defaulting.
    if (data.maxHp === null) {
      console.warn(`Excluding general "${id}" from registry: maxHp not yet known.`);
      continue;
    }
    generals.push({ id, kingdom: data.kingdom, maxHp: data.maxHp, skills: GENERAL_SKILLS.get(id) ?? [] });
  }
  // Skill logic with no data file would silently never be playable.
  for (const id of GENERAL_SKILLS.keys()) {
    if (!generals.some((g) => g.id === id)) {
      throw new Error(`Hand-coded skills exist for general "${id}" but it has no data file`);
    }
  }
  return generals;
}

export function buildContentRegistry(): ContentRegistry {
  const cards = [shaCard, shanCard, peachCard, duelCard, wuxieCard, silverLionCard, greenDragonBladeCard];
  const generals = buildGenerals();
  return {
    cards: new Map(cards.map((c) => [c.id, c])),
    generals: new Map(generals.map((g) => [g.id, g])),
  };
}
```

- [ ] **Step 6: Update the skill specs to build definitions from skill sets**

In `projects/content/src/lib/generals/setOne.spec.ts`:
- Change the type import to `import type { GameState, ContentRegistry, GameModeDefinition, CardDefinition, GeneralDefinition } from 'engine';`, and add `import type { GeneralSkillSet } from './types';`.
- Add this helper after the imports:

```ts
// Skill tests don't depend on kingdom or maxHp (seat HP is set explicitly below).
const asDefinition = (g: GeneralSkillSet): GeneralDefinition => ({ ...g, kingdom: 'Wei', maxHp: 4 });
```

- Change the three map entries to `['xiahou-dun', asDefinition(xiahouDunGeneral)]`, `['sun-shangxiang', asDefinition(sunShangxiangGeneral)]` and `['zhuge-liang', asDefinition(zhugeLiangGeneral)]`.

In `projects/content/src/lib/generals/setTwo.spec.ts`, make the same changes: add `GeneralDefinition` to the type import, add the `GeneralSkillSet` import and the `asDefinition` helper, and change the map to `new Map([['dong-zhuo', asDefinition(dongZhuoGeneral)], ['zhao-yun', asDefinition(zhaoYunGeneral)]])`.

- [ ] **Step 7: Write the failing display-data test**

Create `projects/content/src/lib/display.spec.ts`:

```ts
import { generalDisplayData } from './display';

describe('generalDisplayData', () => {
  it('returns name, title and skill name/text for a known general', () => {
    const data = generalDisplayData('cao-cao')!;
    expect(data.name).toBe('Cao Cao');
    expect(data.title).toBe('Martial Emperor of Wei');
    expect(data.skills[0]).toEqual({
      name: 'Evil Hero',
      text: 'When Cao Cao is damaged by a card, he can immediately put it into his hand.',
    });
  });

  it('returns a null title when the data has none', () => {
    expect(generalDisplayData('dong-zhuo')!.title).toBeNull();
  });

  it('returns null for an unknown id', () => {
    expect(generalDisplayData('no-such-general')).toBeNull();
  });
});
```

Run: `npx jest projects/content/src/lib/display.spec.ts`
Expected: FAIL with `Cannot find module './display'`.

- [ ] **Step 8: Implement `generalDisplayData` and export it**

Create `projects/content/src/lib/display.ts`:

```ts
import { generalsData } from '../../data/generals';

export interface GeneralDisplayData {
  name: string;
  title: string | null;
  skills: { name: string; text: string }[];
}

// Presentation-facing view of a general's data file, so UI code never imports
// raw content JSON.
export function generalDisplayData(id: string): GeneralDisplayData | null {
  if (!Object.prototype.hasOwnProperty.call(generalsData, id)) return null;
  const data = generalsData[id];
  return {
    name: data.name,
    title: data.title ?? null,
    skills: data.skills.map(({ name, text }) => ({ name, text })),
  };
}
```

Add this line to `projects/content/src/public-api.ts`:

```ts
export * from './lib/display';
```

- [ ] **Step 9: Run the content suite, the type check, and the library build**

Run: `npx jest --selectProjects content && npx tsc -p projects/content/tsconfig.spec.json --noEmit && npm run build:content`
Expected: all content tests PASS, no type errors, and the library builds.

Some `kingdomWar.spec.ts` cases assert on the old deterministic assignment ("seat-c is assigned zhuge-liang"), and those may now fail. That is expected, because Task 4 rewrites that file. Everything else must pass.

If `npm run build:content` fails because `data/` lies outside the library's `rootDir`, add `"../data/**/*.ts", "../data/**/*.json"` to the `include` of `projects/content/tsconfig.lib.json` (and `tsconfig.ngbuild.json`), mirroring how `assets/manifest.json` is already handled.

- [ ] **Step 10: Commit**

```bash
git add projects/content/data/generals/qun/dong-zhuo.json projects/content/data/generals/index.ts \
  projects/content/src/lib/generals projects/content/src/lib/registry.ts projects/content/src/lib/registry.spec.ts \
  projects/content/src/lib/display.ts projects/content/src/lib/display.spec.ts projects/content/src/public-api.ts
git commit -m "feat(content): build the general registry from data files

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

If `projects/content/data/` or `public-api.ts` were still untracked or unstaged from earlier pipeline work, stage only the files listed above. `git add` of `data/generals/index.ts` adds the whole file, which is intended.

---

### Task 2: Engine domain model for general selection (types and null-safety)

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts`
- Modify: `projects/engine/src/lib/pipeline/actions.ts`, `projects/engine/src/lib/pipeline/events.ts`
- Modify: `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/skills/triggers.ts`, `projects/engine/src/lib/domain/redact.ts`
- Modify: `projects/content/src/lib/modes/kingdomWar.ts` (null-safe trigger conditions plus `generalSelection: null` only; the deal comes in Task 4)
- Modify (fixtures): every spec file with a `GameState` literal, listed in Step 5
- Test: `projects/engine/src/lib/skills/triggers.spec.ts`, `projects/engine/src/lib/pipeline/resolve.spec.ts`, `projects/engine/src/lib/domain/redact.spec.ts`

**Interfaces:**
- Produces (in `engine`):
  - `type Phase = 'GeneralSelection' | 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End'`
  - `interface SeatGenerals { main: GeneralInstance; deputy: GeneralInstance }`
  - `Seat.generals: SeatGenerals | null`
  - `interface GeneralSelectionState { candidates: Record<string, string[]> }`
  - `GameState.generalSelection: GeneralSelectionState | null`
  - `Action` gains `{ kind: 'ChooseGeneralsAction'; seatId: string; mainId: string; deputyId: string }`, and `ACTION_KINDS` includes it.
  - `EngineEvent` gains `interface GeneralsChosenEvent { kind: 'GeneralsChosenEvent'; seatId: string }`.

- [ ] **Step 1: Write the failing null-safety tests**

Append to `projects/engine/src/lib/skills/triggers.spec.ts`:

```ts
describe('gatherTriggeredSkills with a seat that has not chosen generals', () => {
  it('skips the seat instead of throwing', () => {
    const skill: GeneralDefinition = {
      id: 'g1', kingdom: 'Wei', maxHp: 4,
      skills: [{ id: 's', activation: 'auto', triggers: [{ point: 'after:X', condition: () => true, effect: () => [] }] }],
    };
    const registry: ContentRegistry = { cards: new Map(), generals: new Map([['g1', skill]]) };
    const mode: GameModeDefinition = { id: 'm', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
    const state = stateWithSeats([{ ...seat('seat-a', 0, 'g1', 'g1'), generals: null }]);
    expect(gatherTriggeredSkills(state, registry, mode, 'after:X', {})).toEqual([]);
  });
});
```

Append to `projects/engine/src/lib/domain/redact.spec.ts`:

```ts
describe('redactStateForSeat with seats that have not chosen generals', () => {
  it('passes an unchosen seat through without masking', () => {
    const state = makeState();
    state.seats[1] = { ...state.seats[1], generals: null, kingdom: 'hidden' };
    const redacted = redactStateForSeat(state, 'seat-a');
    expect(redacted.seats[1].generals).toBeNull();
    expect(redacted.seats[1].kingdom).toBe('hidden');
  });
});
```

Append to `projects/engine/src/lib/pipeline/resolve.spec.ts`, which already defines `baseState()`, `emptyRegistry()` and `stubMode()`:

```ts
describe('RevealGeneralAction on a seat with no generals yet', () => {
  it('throws a clear error', () => {
    const state = baseState();
    const unchosen = { ...state, seats: state.seats.map((s, i) => (i === 0 ? { ...s, generals: null } : s)) };
    expect(() =>
      resolve(
        unchosen,
        { kind: 'RevealGeneralAction', seatId: unchosen.seats[0].id, slot: 'main' },
        { registry: emptyRegistry(), mode: stubMode() }
      )
    ).toThrow(/has not chosen its generals/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest --selectProjects engine -t "not chosen"`
Expected: FAIL. The trigger test throws `Cannot read properties of null (reading 'main')`, and the redact test throws a TypeError. Type errors may also appear. That is fine.

- [ ] **Step 3: Change the domain types**

In `projects/engine/src/lib/domain/types.ts`:

```ts
export type Phase = 'GeneralSelection' | 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End';
```

Add after `GeneralInstance`:

```ts
export interface SeatGenerals {
  main: GeneralInstance;
  deputy: GeneralInstance;
}

// Pre-game general selection. `candidates` holds the general ids dealt to each
// seat that has not chosen yet; a seat's entry is removed once it chooses.
export interface GeneralSelectionState {
  candidates: Record<string, string[]>;
}
```

In `Seat`, replace the `generals` line with:

```ts
  // null only during the GeneralSelection phase, before this seat has chosen.
  generals: SeatGenerals | null;
```

In `GameState`, add after `result`:

```ts
  generalSelection: GeneralSelectionState | null;
```

In `projects/engine/src/lib/pipeline/actions.ts`, add this member to the `Action` union:

```ts
  | { kind: 'ChooseGeneralsAction'; seatId: string; mainId: string; deputyId: string }
```

Also add `'ChooseGeneralsAction',` to `ACTION_KINDS`.

In `projects/engine/src/lib/pipeline/events.ts`, add:

```ts
// Deliberately carries no general ids: the log is visible to every seat.
export interface GeneralsChosenEvent {
  kind: 'GeneralsChosenEvent';
  seatId: string;
}
```

Also add `| GeneralsChosenEvent` to `EngineEvent`.

- [ ] **Step 4: Make the readers null-safe**

`projects/engine/src/lib/pipeline/effects.ts`: replace the body of `case 'RevealGeneralEffect'` with:

```ts
    case 'RevealGeneralEffect': {
      const seat = state.seats.find((s) => s.id === effect.seatId);
      if (!seat) throw new Error(`Unknown seat: ${effect.seatId}`);
      const generals = seat.generals;
      if (!generals) throw new Error(`Seat ${effect.seatId} has not chosen its generals yet`);
      if (generals[effect.slot].revealed) {
        return { state, events: [] };
      }
      const seats = state.seats.map((s) =>
        s.id === effect.seatId
          ? { ...s, generals: { ...generals, [effect.slot]: { ...generals[effect.slot], revealed: true } } }
          : s
      );
      const event: EngineEvent = { kind: 'GeneralRevealedEvent', seatId: effect.seatId, slot: effect.slot };
      return { state: { ...state, seats, log: [...state.log, event] }, events: [event] };
    }
```

`projects/engine/src/lib/skills/triggers.ts`: replace the seat loop body with:

```ts
  for (const seat of state.seats) {
    // An eliminated seat's generals are out of the game — their skills must not
    // keep firing. A seat still choosing its generals has none to fire.
    if (seat.eliminated || !seat.generals) continue;
    for (const slot of GENERAL_SLOTS) {
      const general = registry.generals.get(seat.generals[slot].generalDefinitionId);
```

The rest of the loop is unchanged.

`projects/engine/src/lib/domain/redact.ts`: replace `isKingdomRevealed` and `redactSeat` with:

```ts
function isKingdomRevealed(generals: SeatGenerals): boolean {
  return generals.main.revealed || generals.deputy.revealed;
}

function redactSeat(seat: Seat, viewerSeatId: string): Seat {
  // A seat with no generals yet has nothing to mask (its kingdom is 'hidden').
  if (seat.id === viewerSeatId || !seat.generals) return seat;
  const { main, deputy } = seat.generals;
  return {
    ...seat,
    kingdom: isKingdomRevealed(seat.generals) ? seat.kingdom : 'hidden',
    generals: {
      main: main.revealed ? main : { ...main, generalDefinitionId: HIDDEN_GENERAL_ID },
      deputy: deputy.revealed ? deputy : { ...deputy, generalDefinitionId: HIDDEN_GENERAL_ID },
    },
  };
}
```

Also change the import to `import { CardInstance, CardZone, GameState, Seat, SeatGenerals } from './types';`.

`projects/content/src/lib/modes/kingdomWar.ts`: in the two forced-reveal trigger conditions, change `!!seat && !seat.generals.main.revealed` to `!!seat && !!seat.generals && !seat.generals.main.revealed`, and change `!!seat && !seat.generals.deputy.revealed` to `!!seat && !!seat.generals && !seat.generals.deputy.revealed`. In the `state` literal, add `generalSelection: null,` after `result: null,`.

- [ ] **Step 5: Update test fixtures for the new required field and the nullable generals**

Every spec file below has exactly one `result: null,` at the end of a line inside a `GameState` literal. Add the new field to all of them:

```bash
for f in projects/app/src/app/labels.spec.ts projects/app/src/app/game-board/action-list.spec.ts \
  projects/content/src/lib/generals/setOne.spec.ts projects/content/src/lib/generals/setTwo.spec.ts \
  projects/content/src/lib/cards/tricks.spec.ts projects/content/src/lib/cards/cards.spec.ts \
  projects/content/src/lib/shared/queries.spec.ts projects/sim/src/bot.spec.ts projects/sim/src/invariants.spec.ts \
  projects/engine/src/lib/pipeline/winCondition.spec.ts projects/engine/src/lib/pipeline/resolve.spec.ts \
  projects/engine/src/lib/setup/gameSetup.spec.ts projects/engine/src/lib/rules/phaseSequence.spec.ts \
  projects/engine/src/lib/rules/legality.spec.ts projects/engine/src/lib/skills/triggers.spec.ts \
  projects/engine/src/lib/domain/redact.spec.ts; do
  sed -i '' 's/result: null,$/result: null, generalSelection: null,/' "$f"
done
```

Add non-null assertions where specs read or spread a seat's generals:

```bash
for f in projects/engine/src/lib/domain/redact.spec.ts projects/engine/src/lib/domain/factories.spec.ts \
  projects/content/src/lib/modes/kingdomWar.spec.ts projects/content/src/lib/generals/setOne.spec.ts \
  projects/app/src/app/game.service.spec.ts; do
  sed -i '' -E 's/\.generals\.(main|deputy)/.generals!.\1/g; s/\.\.\.s\.generals,/...s.generals!,/g' "$f"
done
```

- [ ] **Step 6: Run the engine, content and sim tests and type checks**

Run: `npx jest --selectProjects engine content sim && npx tsc -p projects/engine/tsconfig.spec.json --noEmit && npx tsc -p projects/content/tsconfig.spec.json --noEmit && npx tsc -p projects/sim/tsconfig.json --noEmit`

Expected: the three new tests PASS, and the engine and sim suites PASS. The only allowed content failures are the `kingdomWar.spec.ts` cases already noted in Task 1, which Task 4 rewrites. There must be no type errors.

If `tsc` reports another `seat.generals` access in a spec that the sed missed, add `!` there. The app is type-checked in Task 6.

- [ ] **Step 7: Commit**

```bash
git add projects/engine/src projects/content/src/lib/modes/kingdomWar.ts projects/content/src/lib/modes/kingdomWar.spec.ts \
  projects/content/src/lib/generals/setOne.spec.ts projects/content/src/lib/generals/setTwo.spec.ts \
  projects/content/src/lib/cards/tricks.spec.ts projects/content/src/lib/cards/cards.spec.ts \
  projects/content/src/lib/shared/queries.spec.ts projects/sim/src/bot.spec.ts projects/sim/src/invariants.spec.ts \
  projects/app/src/app/labels.spec.ts projects/app/src/app/game-board/action-list.spec.ts projects/app/src/app/game.service.spec.ts
git commit -m "feat(engine): model the general-selection phase and nullable seat generals

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

`labels.spec.ts` and `action-list.spec.ts` have unrelated uncommitted edits in the working tree. Use `git add -p` on those two files and stage only the `generalSelection: null` hunk.

---

### Task 3: Engine general-selection rules (active seat, legal pairs, resolve, redaction)

**Files:**
- Create: `projects/engine/src/lib/rules/activeSeat.ts`, `projects/engine/src/lib/rules/activeSeat.spec.ts`
- Create: `projects/engine/src/lib/rules/generalSelection.ts`, `projects/engine/src/lib/rules/generalSelection.spec.ts`
- Modify: `projects/engine/src/lib/rules/legality.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, `projects/engine/src/lib/domain/redact.ts`, `projects/engine/src/public-api.ts`

**Interfaces:**
- Consumes: the types from Task 2 and `lookupGeneral(registry, id): GeneralDefinition` (existing).
- Produces:
  - `getActiveSeatId(state: GameState): string | null`
  - `type ChooseGeneralsAction = Extract<Action, { kind: 'ChooseGeneralsAction' }>`
  - `getLegalGeneralChoices(state: GameState, seatId: string, registry: ContentRegistry): ChooseGeneralsAction[]`
  - `applyGeneralChoice(state: GameState, action: ChooseGeneralsAction, registry: ContentRegistry): { state: GameState; event: GeneralsChosenEvent }`
  - `getLegalActions(state: GameState, seatId: string, registry?: ContentRegistry): Action[]`. The registry is required during `GeneralSelection`.

- [ ] **Step 1: Write the failing `getActiveSeatId` test**

Create `projects/engine/src/lib/rules/activeSeat.spec.ts`:

```ts
import { getActiveSeatId } from './activeSeat';
import { GameState, Seat } from '../domain/types';
import { createRng } from '../rng/rng';

function seat(id: string, index: number, eliminated = false): Seat {
  return {
    id, index, kingdom: 'Wei',
    generals: { main: { generalDefinitionId: 'g1', revealed: false }, deputy: { generalDefinitionId: 'g2', revealed: false } },
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated,
  };
}

function state(overrides: Partial<GameState> = {}): GameState {
  return {
    seats: [seat('seat-a', 0), seat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'Play',
    zones: [],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
    generalSelection: null,
    ...overrides,
  };
}

describe('getActiveSeatId', () => {
  it('is the turn owner when no response is pending', () => {
    expect(getActiveSeatId(state())).toBe('seat-a');
  });

  it('is the responder when a response is pending', () => {
    const pending = {
      id: 'r1', respondingSeatId: 'seat-b', allowedActionKinds: ['PassAction'],
      context: { effect: { kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: 'seat-b' }, amount: 1 } },
    };
    expect(getActiveSeatId(state({ pendingResponse: pending }))).toBe('seat-b');
  });

  it('is null when the would-be actor is eliminated', () => {
    expect(getActiveSeatId(state({ seats: [seat('seat-a', 0, true), seat('seat-b', 1)] }))).toBeNull();
  });

  it('is null once the game has a result', () => {
    expect(getActiveSeatId(state({ result: { endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] } }))).toBeNull();
  });

  it('is the first seat, in seat order, still holding candidates during GeneralSelection', () => {
    const selecting = state({ phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-b': ['x'], 'seat-a': ['y'] } } });
    expect(getActiveSeatId(selecting)).toBe('seat-a');
    const afterA = state({ phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-b': ['x'] } } });
    expect(getActiveSeatId(afterA)).toBe('seat-b');
  });
});
```

Run: `npx jest projects/engine/src/lib/rules/activeSeat.spec.ts`
Expected: FAIL with `Cannot find module './activeSeat'`.

- [ ] **Step 2: Implement `getActiveSeatId`**

Create `projects/engine/src/lib/rules/activeSeat.ts`:

```ts
import { GameState } from '../domain/types';

// The single source of truth for "whose move is it". During GeneralSelection
// seats choose in seat order; afterwards a pending responder acts before the
// turn owner. An unknown or eliminated seat can never act.
export function getActiveSeatId(state: GameState): string | null {
  if (state.result) return null;
  if (state.phase === 'GeneralSelection') {
    const candidates = state.generalSelection?.candidates ?? {};
    return state.seats.find((s) => Object.prototype.hasOwnProperty.call(candidates, s.id))?.id ?? null;
  }
  const candidateId = state.pendingResponse?.respondingSeatId ?? state.turn.ownerSeatId;
  const seat = state.seats.find((s) => s.id === candidateId);
  return seat && !seat.eliminated ? candidateId : null;
}
```

Run: `npx jest projects/engine/src/lib/rules/activeSeat.spec.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing selection-rules test**

Create `projects/engine/src/lib/rules/generalSelection.spec.ts`:

```ts
import { getLegalActions } from './legality';
import { resolve, EngineContext } from '../pipeline/resolve';
import { redactStateForSeat } from '../domain/redact';
import { ContentRegistry, GameModeDefinition, GeneralDefinition } from '../registry/types';
import { GameResult, GameState, Kingdom, Seat } from '../domain/types';
import { Action } from '../pipeline/actions';
import { createRng } from '../rng/rng';

function general(id: string, kingdom: Kingdom, maxHp: number): [string, GeneralDefinition] {
  return [id, { id, kingdom, maxHp, skills: [] }];
}

const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    general('w1', 'Wei', 4), general('w2', 'Wei', 3), general('s1', 'Shu', 4), general('s2', 'Shu', 4),
    general('q1', 'Qun', 5), general('w3', 'Wei', 4), general('u1', 'Wu', 3), general('u2', 'Wu', 4),
    general('s3', 'Shu', 3), general('q2', 'Qun', 4),
  ]),
};

function unchosenSeat(id: string, index: number): Seat {
  return {
    id, index, kingdom: 'hidden', generals: null, combinedHp: 0, maxCombinedHp: 0,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, eliminated: false,
  };
}

function selectingState(): GameState {
  return {
    seats: [unchosenSeat('seat-a', 0), unchosenSeat('seat-b', 1)],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] },
    phase: 'GeneralSelection',
    zones: [],
    pendingResponse: null,
    log: [],
    rng: createRng(1),
    result: null,
    generalSelection: {
      candidates: { 'seat-a': ['w1', 's1', 'w2', 's2', 'q1'], 'seat-b': ['w3', 'u1', 'u2', 's3', 'q2'] },
    },
  };
}

function mode(checkWinCondition: (s: GameState) => GameResult | null = () => null): GameModeDefinition {
  return { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition, triggers: [] };
}

const ctx: EngineContext = { registry, mode: mode() };
const choose = (seatId: string, mainId: string, deputyId: string): Action => ({ kind: 'ChooseGeneralsAction', seatId, mainId, deputyId });

describe('getLegalActions during GeneralSelection', () => {
  it('offers every ordered same-kingdom pair of the active seat, main-major in candidate order', () => {
    expect(getLegalActions(selectingState(), 'seat-a', registry)).toEqual([
      choose('seat-a', 'w1', 'w2'),
      choose('seat-a', 's1', 's2'),
      choose('seat-a', 'w2', 'w1'),
      choose('seat-a', 's2', 's1'),
    ]);
  });

  it('offers nothing to a seat that is not the active chooser', () => {
    expect(getLegalActions(selectingState(), 'seat-b', registry)).toEqual([]);
  });

  it('requires the registry during GeneralSelection', () => {
    expect(() => getLegalActions(selectingState(), 'seat-a')).toThrow(/registry/);
  });
});

describe('resolving ChooseGeneralsAction', () => {
  it('seats the chosen pair unrevealed, derives kingdom and HP, and removes the candidates', () => {
    const { state } = resolve(selectingState(), choose('seat-a', 'w2', 'w1'), ctx);
    const seatA = state.seats[0];
    expect(seatA.generals).toEqual({
      main: { generalDefinitionId: 'w2', revealed: false },
      deputy: { generalDefinitionId: 'w1', revealed: false },
    });
    expect(seatA.kingdom).toBe('Wei');
    expect(seatA.combinedHp).toBe(7);
    expect(seatA.maxCombinedHp).toBe(7);
    expect(state.generalSelection).toEqual({ candidates: { 'seat-b': ['w3', 'u1', 'u2', 's3', 'q2'] } });
    expect(state.phase).toBe('GeneralSelection');
  });

  it('logs a GeneralsChosenEvent that names no general', () => {
    const { state } = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), ctx);
    const event = state.log[state.log.length - 1];
    expect(event).toEqual({ kind: 'GeneralsChosenEvent', seatId: 'seat-a' });
  });

  it('starts turn 1 at Judgment once the last seat has chosen', () => {
    const afterA = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), ctx).state;
    const { state } = resolve(afterA, choose('seat-b', 'u1', 'u2'), ctx);
    expect(state.phase).toBe('Judgment');
    expect(state.generalSelection).toBeNull();
    expect(state.turn).toEqual({ turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] });
    expect(state.seats.map((s) => s.kingdom)).toEqual(['Wei', 'Wu']);
  });

  it('does not evaluate the win condition until selection has finished', () => {
    const alwaysWins = mode(() => ({ endedAt: 1, winningSeatIds: [], losingSeatIds: [] }));
    const winCtx: EngineContext = { registry, mode: alwaysWins };
    const afterA = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), winCtx).state;
    expect(afterA.result).toBeNull();
    const afterB = resolve(afterA, choose('seat-b', 'u1', 'u2'), winCtx).state;
    expect(afterB.result).not.toBeNull();
  });

  it.each([
    ['a seat that is not the active chooser', choose('seat-b', 'u1', 'u2'), /not seat seat-b's turn/],
    ['a general that is not one of the seat’s candidates', choose('seat-a', 'w1', 'w3'), /not a candidate/],
    ['the same general twice', choose('seat-a', 'w1', 'w1'), /different generals/],
    ['a cross-kingdom pair', choose('seat-a', 'w1', 's1'), /do not share a kingdom/],
  ])('rejects %s', (_label, action, message) => {
    expect(() => resolve(selectingState(), action, ctx)).toThrow(message);
  });

  it('rejects any other action kind during GeneralSelection', () => {
    expect(() => resolve(selectingState(), { kind: 'EndPhaseAction', seatId: 'seat-a' }, ctx)).toThrow(
      /not legal during general selection/
    );
  });

  it('rejects ChooseGeneralsAction after selection has finished', () => {
    const afterA = resolve(selectingState(), choose('seat-a', 'w1', 'w2'), ctx).state;
    const done = resolve(afterA, choose('seat-b', 'u1', 'u2'), ctx).state;
    expect(() => resolve(done, choose('seat-a', 'w1', 'w2'), ctx)).toThrow(/only be chosen during the GeneralSelection phase/);
  });
});

describe('redactStateForSeat during GeneralSelection', () => {
  it("hides other seats' candidates but keeps their count, and keeps the viewer's own", () => {
    const redacted = redactStateForSeat(selectingState(), 'seat-a');
    expect(redacted.generalSelection!.candidates['seat-a']).toEqual(['w1', 's1', 'w2', 's2', 'q1']);
    expect(redacted.generalSelection!.candidates['seat-b']).toEqual(['hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
  });

  it('leaves a null generalSelection as null', () => {
    const done = { ...selectingState(), phase: 'Judgment' as const, generalSelection: null };
    expect(redactStateForSeat(done, 'seat-a').generalSelection).toBeNull();
  });
});
```

Run: `npx jest projects/engine/src/lib/rules/generalSelection.spec.ts`
Expected: FAIL. The first `getLegalActions` test receives the Play-phase actions (for example `[{ kind: 'EndPhaseAction', ... }]`), and the resolve tests throw `Action kind not yet handled by resolve(): ChooseGeneralsAction`.

- [ ] **Step 4: Implement the selection rules**

Create `projects/engine/src/lib/rules/generalSelection.ts`:

```ts
import { GameState } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupGeneral } from '../registry/lookup';
import { Action } from '../pipeline/actions';
import { GeneralsChosenEvent } from '../pipeline/events';
import { getActiveSeatId } from './activeSeat';

export type ChooseGeneralsAction = Extract<Action, { kind: 'ChooseGeneralsAction' }>;

// Every ordered (main, deputy) pair of distinct candidates that share a
// kingdom, main-major in the seat's candidate order.
export function getLegalGeneralChoices(
  state: GameState,
  seatId: string,
  registry: ContentRegistry
): ChooseGeneralsAction[] {
  const candidates = state.generalSelection?.candidates[seatId] ?? [];
  const choices: ChooseGeneralsAction[] = [];
  for (const mainId of candidates) {
    for (const deputyId of candidates) {
      if (mainId === deputyId) continue;
      if (lookupGeneral(registry, mainId).kingdom === lookupGeneral(registry, deputyId).kingdom) {
        choices.push({ kind: 'ChooseGeneralsAction', seatId, mainId, deputyId });
      }
    }
  }
  return choices;
}

export function applyGeneralChoice(
  state: GameState,
  action: ChooseGeneralsAction,
  registry: ContentRegistry
): { state: GameState; event: GeneralsChosenEvent } {
  const selection = state.generalSelection;
  if (state.phase !== 'GeneralSelection' || !selection) {
    throw new Error('Generals can only be chosen during the GeneralSelection phase');
  }
  if (getActiveSeatId(state) !== action.seatId) {
    throw new Error(`It is not seat ${action.seatId}'s turn to choose generals`);
  }
  const candidates = selection.candidates[action.seatId];
  for (const id of [action.mainId, action.deputyId]) {
    if (!candidates.includes(id)) throw new Error(`General ${id} is not a candidate for seat ${action.seatId}`);
  }
  if (action.mainId === action.deputyId) {
    throw new Error('Main and deputy must be different generals');
  }
  const main = lookupGeneral(registry, action.mainId);
  const deputy = lookupGeneral(registry, action.deputyId);
  if (main.kingdom !== deputy.kingdom) {
    throw new Error(`${main.id} (${main.kingdom}) and ${deputy.id} (${deputy.kingdom}) do not share a kingdom`);
  }

  const maxCombinedHp = main.maxHp + deputy.maxHp;
  const seats = state.seats.map((s) =>
    s.id === action.seatId
      ? {
          ...s,
          kingdom: main.kingdom,
          generals: {
            main: { generalDefinitionId: main.id, revealed: false },
            deputy: { generalDefinitionId: deputy.id, revealed: false },
          },
          combinedHp: maxCombinedHp,
          maxCombinedHp,
        }
      : s
  );
  const remaining = Object.fromEntries(
    Object.entries(selection.candidates).filter(([seatId]) => seatId !== action.seatId)
  );
  const finished = Object.keys(remaining).length === 0;
  const event: GeneralsChosenEvent = { kind: 'GeneralsChosenEvent', seatId: action.seatId };
  return {
    state: {
      ...state,
      seats,
      phase: finished ? 'Judgment' : 'GeneralSelection',
      generalSelection: finished ? null : { candidates: remaining },
      log: [...state.log, event],
    },
    event,
  };
}
```

`projects/engine/src/lib/rules/legality.ts`: change the imports and the start of `getLegalActions`:

```ts
import { GameState, Target } from '../domain/types';
import { Action } from '../pipeline/actions';
import { ContentRegistry } from '../registry/types';
import { getActiveSeatId } from './activeSeat';
import { getLegalGeneralChoices } from './generalSelection';
```

```ts
export function getLegalActions(state: GameState, seatId: string, registry?: ContentRegistry): Action[] {
  if (state.result) return [];

  // An unknown or eliminated seat can never act, whether or not it happens to
  // be named as the turn owner or as a pending response's responder.
  const actingSeat = state.seats.find((s) => s.id === seatId);
  if (!actingSeat || actingSeat.eliminated) return [];

  if (state.phase === 'GeneralSelection') {
    if (getActiveSeatId(state) !== seatId) return [];
    // Pairing candidates needs each general's kingdom, which lives in content.
    if (!registry) throw new Error('getLegalActions needs the content registry during GeneralSelection');
    return getLegalGeneralChoices(state, seatId, registry);
  }
```

The rest of the function is unchanged.

`projects/engine/src/lib/pipeline/resolve.ts`:
- Add `import { applyGeneralChoice } from '../rules/generalSelection';`.
- In `resolve()`, replace the `gameResult` line with:

```ts
  // Seats still choosing have kingdom 'hidden'; reading that as a one-kingdom
  // table would end the game before it starts.
  const gameResult =
    result.state.phase === 'GeneralSelection' ? null : ctx.mode.checkWinCondition(result.state);
```

- In `resolveAction`, directly after the `pendingResponse` guard, add:

```ts
  if (state.phase === 'GeneralSelection' && action.kind !== 'ChooseGeneralsAction') {
    throw new Error(`Action ${action.kind} is not legal during general selection`);
  }
```

- Add this case before `default:`:

```ts
    case 'ChooseGeneralsAction': {
      const { state: chosen, event } = applyGeneralChoice(state, action, ctx.registry);
      const followUp = runAfterTriggers(chosen, event, ctx, depth);
      return { state: followUp.state, events: [event, ...followUp.events] };
    }
```

`projects/engine/src/lib/domain/redact.ts`: change the types import to include `GeneralSelectionState`, and add:

```ts
function redactSelection(selection: GeneralSelectionState | null, viewerSeatId: string): GeneralSelectionState | null {
  if (!selection) return null;
  const candidates = Object.fromEntries(
    Object.entries(selection.candidates).map(([seatId, ids]) => [
      seatId,
      seatId === viewerSeatId ? ids : ids.map(() => HIDDEN_GENERAL_ID),
    ])
  );
  return { candidates };
}
```

In `redactStateForSeat`, add `generalSelection: redactSelection(state.generalSelection, viewerSeatId),` to the returned object.

`projects/engine/src/public-api.ts`: add these lines after the `legality` export:

```ts
export * from './lib/rules/activeSeat';
export * from './lib/rules/generalSelection';
```

- [ ] **Step 5: Run the engine suite and the type check**

Run: `npx jest --selectProjects engine && npx tsc -p projects/engine/tsconfig.spec.json --noEmit`
Expected: all PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add projects/engine/src
git commit -m "feat(engine): add general selection rules — legal pairs, choice resolution, redaction

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Kingdom War deal and seat cap

**Files:**
- Modify: `projects/content/src/lib/modes/kingdomWar.ts`
- Rewrite: `projects/content/src/lib/modes/kingdomWar.spec.ts`

**Interfaces:**
- Consumes: `shuffle` (engine), `getActiveSeatId`, `getLegalActions(state, seatId, registry)` and `resolve` (Task 3), and `buildContentRegistry` (Task 1).
- Produces:
  - `export const GENERALS_PER_SEAT = 5`
  - `export function kingdomWarMaxSeats(registry: ContentRegistry): number`
  - `GameModeDefinition` gains optional `maxSeats?(registry: ContentRegistry): number`, which `kingdomWarMode` sets to `kingdomWarMaxSeats`.
  - `kingdomWarMode.setup` returns a state in `phase: 'GeneralSelection'`.

- [ ] **Step 1: Write the new mode spec (failing)**

Replace `projects/content/src/lib/modes/kingdomWar.spec.ts` with:

```ts
import { kingdomWarMode, kingdomWarMaxSeats, GENERALS_PER_SEAT } from './kingdomWar';
import { buildContentRegistry } from '../registry';
import { createGame, resolve, getActiveSeatId, getLegalActions } from 'engine';
import type { GameState, CardDefinition, ContentRegistry } from 'engine';

// Skips general selection by seating fixed pairs directly, for tests about
// in-game rules that must not depend on which candidates a seed deals.
function seated(state: GameState, registry: ContentRegistry, picks: Record<string, [string, string]>): GameState {
  return {
    ...state,
    phase: 'Judgment',
    generalSelection: null,
    seats: state.seats.map((seat) => {
      const [mainId, deputyId] = picks[seat.id];
      const main = registry.generals.get(mainId)!;
      const deputy = registry.generals.get(deputyId)!;
      const maxCombinedHp = main.maxHp + deputy.maxHp;
      return {
        ...seat,
        kingdom: main.kingdom,
        generals: {
          main: { generalDefinitionId: mainId, revealed: false },
          deputy: { generalDefinitionId: deputyId, revealed: false },
        },
        combinedHp: maxCombinedHp,
        maxCombinedHp,
      };
    }),
  };
}

describe('Kingdom War setup and deal', () => {
  const registry = buildContentRegistry();

  it('starts in GeneralSelection with unchosen seats, 4-card hands, and seat-a first', () => {
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d'], 42);
    expect(state.phase).toBe('GeneralSelection');
    expect(state.turn).toEqual({ turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] });
    expect(getActiveSeatId(state)).toBe('seat-a');
    for (const seat of state.seats) {
      expect(seat.generals).toBeNull();
      expect(seat.kingdom).toBe('hidden');
      expect(seat.combinedHp).toBe(0);
      expect(seat.maxCombinedHp).toBe(0);
      expect(state.zones.find((z) => z.id === seat.hand.zoneId)!.cards).toHaveLength(4);
    }
  });

  it('deals 5 unique registry generals to every seat, each containing a same-kingdom pair', () => {
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e'], 42);
    const candidates = state.generalSelection!.candidates;
    const all = Object.values(candidates).flat();
    expect(Object.keys(candidates).sort()).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e']);
    expect(all).toHaveLength(5 * GENERALS_PER_SEAT);
    expect(new Set(all).size).toBe(all.length);
    for (const ids of Object.values(candidates)) {
      expect(ids).toHaveLength(GENERALS_PER_SEAT);
      const kingdoms = ids.map((id) => registry.generals.get(id)!.kingdom);
      expect(new Set(kingdoms).size).toBeLessThan(kingdoms.length);
    }
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const b = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const c = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 8);
    expect(JSON.stringify(b)).toEqual(JSON.stringify(a));
    expect(c.generalSelection).not.toEqual(a.generalSelection);
  });

  it('caps the table at floor(generals / 5) seats and rejects fewer than 2', () => {
    expect(kingdomWarMaxSeats(registry)).toBe(5);
    expect(kingdomWarMode.maxSeats!(registry)).toBe(5);
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(() => createGame(kingdomWarMode, registry, six, 1)).toThrow(/between 2 and 5 seats/);
    expect(() => createGame(kingdomWarMode, registry, ['a'], 1)).toThrow(/between 2 and 5 seats/);
  });

  it('a full selection through resolve seats every seat with a same-kingdom pair and starts Judgment', () => {
    let state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c'], 42);
    const ctx = { registry, mode: kingdomWarMode };
    while (state.phase === 'GeneralSelection') {
      const seatId = getActiveSeatId(state)!;
      state = resolve(state, getLegalActions(state, seatId, registry)[0], ctx).state;
    }
    expect(state.phase).toBe('Judgment');
    expect(state.generalSelection).toBeNull();
    for (const seat of state.seats) {
      const main = registry.generals.get(seat.generals!.main.generalDefinitionId)!;
      const deputy = registry.generals.get(seat.generals!.deputy.generalDefinitionId)!;
      expect(seat.kingdom).toBe(main.kingdom);
      expect(deputy.kingdom).toBe(main.kingdom);
      expect(seat.maxCombinedHp).toBe(main.maxHp + deputy.maxHp);
      expect(seat.combinedHp).toBe(seat.maxCombinedHp);
    }
  });

  it('ends the game right after selection if every seat picked the same non-Qun kingdom (Review Focus 1)', () => {
    // Pins current behavior: the existing win rule (one living non-Qun
    // kingdom) is evaluated as soon as the last seat chooses.
    const state = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 1);
    const allWei: GameState = {
      ...state,
      generalSelection: {
        candidates: {
          'seat-a': ['cao-cao', 'xu-chu', 'guan-yu', 'lu-xun', 'lu-bu'],
          'seat-b': ['sima-yi', 'guo-jia', 'zhang-fei', 'gan-ning', 'hua-tuo'],
        },
      },
    };
    const ctx = { registry, mode: kingdomWarMode };
    const afterA = resolve(allWei, { kind: 'ChooseGeneralsAction', seatId: 'seat-a', mainId: 'cao-cao', deputyId: 'xu-chu' }, ctx).state;
    expect(afterA.result).toBeNull();
    const afterB = resolve(afterA, { kind: 'ChooseGeneralsAction', seatId: 'seat-b', mainId: 'sima-yi', deputyId: 'guo-jia' }, ctx).state;
    expect(afterB.result).toEqual({ endedAt: 1, winningKingdom: 'Wei', winningSeatIds: ['seat-a', 'seat-b'], losingSeatIds: [] });
  });
});

describe('Kingdom War forced reveal and elimination', () => {
  const testDamageCard: CardDefinition = {
    id: 'test-damage-card', name: 'Test Damage Card', category: 'basic',
    play: (_state, ctx) => [{
      kind: 'DamageEffect',
      damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 10, nature: 'normal' },
    }],
  };

  it('force-reveals both generals and eliminates the seat on lethal damage, ending the game', () => {
    const registry = buildContentRegistry();
    registry.cards.set('test-damage-card', testDamageCard);
    const created = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 7);
    const base = seated(created, registry, { 'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'] });
    const state: GameState = {
      ...base,
      zones: base.zones.map((z) =>
        z.id === base.seats[0].hand.zoneId
          ? { ...z, cards: [{ instanceId: 'lethal-1', definitionId: 'test-damage-card', suit: 'spade', rank: 1 }] }
          : z
      ),
    };
    const { state: next } = resolve(
      state,
      { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'lethal-1', targets: [{ kind: 'seat', seatId: 'seat-b' }] },
      { registry, mode: kingdomWarMode }
    );
    const seatB = next.seats.find((s) => s.id === 'seat-b')!;
    expect(seatB.generals!.main.revealed).toBe(true);
    expect(seatB.generals!.deputy.revealed).toBe(true);
    expect(seatB.eliminated).toBe(true);
    expect(next.result).toEqual({ endedAt: 1, winningSeatIds: ['seat-a'], losingSeatIds: ['seat-b'] });
  });
});

describe('Kingdom War win condition', () => {
  const registry = buildContentRegistry();

  it('returns a real draw result — not null — when every seat is eliminated at once', () => {
    const created = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 3), registry, {
      'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'],
    });
    const allEliminated: GameState = {
      ...created,
      seats: created.seats.map((s) => ({ ...s, eliminated: true, combinedHp: 0 })),
    };
    expect(kingdomWarMode.checkWinCondition(allEliminated)).toEqual({
      endedAt: allEliminated.turn.turnNumber,
      winningSeatIds: [],
      losingSeatIds: ['seat-a', 'seat-b'],
    });
  });

  it('still returns null while more than one kingdom is alive', () => {
    const created = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 3), registry, {
      'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'],
    });
    expect(kingdomWarMode.checkWinCondition(created)).toBeNull();
  });
});

describe('Kingdom War per-turn draw', () => {
  const registry = buildContentRegistry();

  it('draws 2 cards for whichever seat enters the Draw phase', () => {
    // cao-cao and xu-chu have no hand-coded skills, isolating the mode-level draw.
    const state = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 42), registry, {
      'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['liu-bei', 'guan-yu'],
    });
    const handBefore = state.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handBefore.cards).toHaveLength(4);
    const originalCardIds = new Set(handBefore.cards.map((c) => c.instanceId));

    const { state: next } = resolve(state, { kind: 'EndPhaseAction', seatId: 'seat-a' }, { registry, mode: kingdomWarMode });

    expect(next.phase).toBe('Draw');
    const handAfter = next.zones.find((z) => z.id === state.seats[0].hand.zoneId)!;
    expect(handAfter.cards).toHaveLength(6);
    expect(handAfter.cards.map((c) => c.instanceId).filter((id) => !originalCardIds.has(id))).toHaveLength(2);
  });

  it('draws 3 cards (2 base + 1 Zhuge Liang bonus) when a Zhuge Liang-holding seat enters Draw', () => {
    const created = seated(createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c'], 42), registry, {
      'seat-a': ['cao-cao', 'xu-chu'], 'seat-b': ['sun-quan', 'zhou-yu'], 'seat-c': ['zhao-yun', 'zhuge-liang'],
    });
    const seatC = created.seats.find((s) => s.id === 'seat-c')!;
    const state: GameState = { ...created, turn: { turnNumber: 1, ownerSeatId: 'seat-c', extraTurnStack: [] } };
    const originalCardIds = new Set(state.zones.find((z) => z.id === seatC.hand.zoneId)!.cards.map((c) => c.instanceId));

    const { state: next } = resolve(state, { kind: 'EndPhaseAction', seatId: 'seat-c' }, { registry, mode: kingdomWarMode });

    expect(next.phase).toBe('Draw');
    const handAfter = next.zones.find((z) => z.id === seatC.hand.zoneId)!;
    expect(handAfter.cards.map((c) => c.instanceId).filter((id) => !originalCardIds.has(id))).toHaveLength(3);
  });
});
```

Run: `npx jest projects/content/src/lib/modes/kingdomWar.spec.ts`
Expected: FAIL at import (`kingdomWarMaxSeats` is not exported), or at `expect(state.phase).toBe('GeneralSelection')`.

- [ ] **Step 2: Add `maxSeats` to `GameModeDefinition`**

In `projects/engine/src/lib/registry/types.ts`, add this to `GameModeDefinition`:

```ts
  // Largest table this mode can seat with the given content, if it is limited.
  maxSeats?(registry: ContentRegistry): number;
```

- [ ] **Step 3: Implement the deal**

In `projects/content/src/lib/modes/kingdomWar.ts`:
- Change the value import to `import { buildDeck, drawTop, shuffle } from 'engine';`, and add `Seat` to the type import.
- Delete `KINGDOM_ORDER` and the `Kingdom` type import, since nothing else uses them.
- Add after `SUITS`:

```ts
export const GENERALS_PER_SEAT = 5;

export function kingdomWarMaxSeats(registry: ContentRegistry): number {
  return Math.floor(registry.generals.size / GENERALS_PER_SEAT);
}

function hasSameKingdomPair(generalIds: string[], registry: ContentRegistry): boolean {
  const kingdoms = generalIds.map((id) => registry.generals.get(id)!.kingdom);
  return new Set(kingdoms).size < kingdoms.length;
}

// Deals GENERALS_PER_SEAT unique generals to each seat from a seeded shuffle of
// the whole registry. With four kingdoms, five candidates always contain a
// same-kingdom pair (pigeonhole); the check guards a future fifth kingdom or a
// smaller deal rather than silently seating an unplayable hand.
function dealCandidates(seatIds: string[], registry: ContentRegistry, rng: RngState) {
  const { items: pool, rng: afterShuffle } = shuffle([...registry.generals.keys()].sort(), rng);
  const candidates: Record<string, string[]> = {};
  seatIds.forEach((seatId, index) => {
    const dealt = pool.slice(index * GENERALS_PER_SEAT, (index + 1) * GENERALS_PER_SEAT);
    if (!hasSameKingdomPair(dealt, registry)) {
      throw new Error(`Seat ${seatId} was dealt no same-kingdom pair: ${dealt.join(', ')}`);
    }
    candidates[seatId] = dealt;
  });
  return { candidates, rng: afterShuffle };
}
```

Add `RngState` to the type import from `'engine'`.

Replace the `setup` implementation's seat construction and state literal. The deck and hand-drawing code in between stays as it is, except that the deck is built from `afterDeal`:

```ts
  maxSeats: kingdomWarMaxSeats,

  setup: (seatIds, registry, rng) => {
    const limit = kingdomWarMaxSeats(registry);
    if (seatIds.length < 2 || seatIds.length > limit) {
      throw new Error(
        `Kingdom War needs between 2 and ${limit} seats with ${registry.generals.size} generals; got ${seatIds.length}`
      );
    }
    const { candidates, rng: afterDeal } = dealCandidates(seatIds, registry, rng);

    // Generals, kingdom and HP are set when each seat resolves its
    // ChooseGeneralsAction during the GeneralSelection phase.
    const seats: Seat[] = seatIds.map((id, index) => ({
      id,
      index,
      kingdom: 'hidden',
      generals: null,
      combinedHp: 0,
      maxCombinedHp: 0,
      hand: { zoneId: `${id}:hand` },
      equipped: { zoneId: `${id}:equip` },
      eliminated: false,
    }));

    const { cards, rng: afterShuffle } = buildDeck(buildDeckSpec(registry), afterDeal);
    // ... zones + drawTop loop unchanged ...

    const state: GameState = {
      seats,
      players: seatIds.map((id) => ({ id: `player-${id}`, seatId: id, kind: 'bot' as const })),
      turn: { turnNumber: 1, ownerSeatId: seatIds[0], extraTurnStack: [] },
      phase: 'GeneralSelection',
      zones,
      pendingResponse: null,
      log: [],
      rng: currentRng,
      result: null,
      generalSelection: { candidates },
    };
    return { state, rng: currentRng };
  },
```

- [ ] **Step 4: Run the content suite and the type checks**

Run: `npx jest --selectProjects content && npx tsc -p projects/content/tsconfig.spec.json --noEmit && npx tsc -p projects/engine/tsconfig.spec.json --noEmit`
Expected: all PASS, no type errors.

If the "same non-Qun kingdom" test's picks fail because one of the listed ids isn't in the registry, choose any two Wei generals from `projects/content/data/generals/wei/`.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/registry/types.ts projects/content/src/lib/modes/kingdomWar.ts projects/content/src/lib/modes/kingdomWar.spec.ts
git commit -m "feat(content): deal 5 generals per seat in Kingdom War and cap seats by pool size

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Sim drives selection and checks its invariants

**Files:**
- Modify: `projects/sim/src/bot.ts`, `projects/sim/src/runGame.ts`, `projects/sim/src/invariants.ts`, `projects/sim/src/cli.ts`
- Test: `projects/sim/src/bot.spec.ts`, `projects/sim/src/invariants.spec.ts`, `projects/sim/src/property.spec.ts`

**Interfaces:**
- Consumes: `getActiveSeatId`, `getLegalActions(state, seatId, registry)` (Task 3), and `kingdomWarMaxSeats` (Task 4).
- Produces:
  - `pickRandomAction(state: GameState, rng: RngState, registry: ContentRegistry): { action: Action; rng: RngState }`
  - `checkInvariants(state: GameState, registry?: ContentRegistry): string[]`

- [ ] **Step 1: Write the failing invariant tests**

Append to `projects/sim/src/invariants.spec.ts`. Its existing `baseState(overrides)` has one Play-phase seat: seat-a, Wei, holding g1/g2.

```ts
describe('general-selection invariants', () => {
  const secondSeat = (generals: GameState['seats'][number]['generals']): GameState['seats'][number] => ({
    id: 'seat-b', index: 1, kingdom: 'Wei', generals,
    combinedHp: 5, maxCombinedHp: 5,
    hand: { zoneId: 'seat-b:hand' }, equipped: { zoneId: 'seat-b:equip' }, eliminated: false,
  });

  it('flags a seat with no generals after selection has ended', () => {
    const state = baseState();
    state.seats[0] = { ...state.seats[0], generals: null };
    expect(checkInvariants(state)).toEqual([expect.stringContaining('has no generals after general selection')]);
  });

  it('does not flag unchosen seats during GeneralSelection', () => {
    const state = baseState({ phase: 'GeneralSelection', generalSelection: { candidates: { 'seat-a': ['g1'] } } });
    state.seats[0] = { ...state.seats[0], generals: null };
    expect(checkInvariants(state)).toEqual([]);
  });

  it('flags a leftover generalSelection after the phase has ended', () => {
    expect(checkInvariants(baseState({ generalSelection: { candidates: {} } }))).toEqual([
      expect.stringContaining('generalSelection is still set'),
    ]);
  });

  it('flags a general held by two seats', () => {
    const base = baseState();
    const state = { ...base, seats: [...base.seats, secondSeat(base.seats[0].generals)] };
    expect(checkInvariants(state)).toEqual(expect.arrayContaining([expect.stringContaining('is held by both')]));
  });

  it('flags a seat whose generals do not match its kingdom, when given the registry', () => {
    const registry = {
      cards: new Map(),
      generals: new Map([
        ['g1', { id: 'g1', kingdom: 'Wei' as const, maxHp: 4, skills: [] }],
        ['g2', { id: 'g2', kingdom: 'Shu' as const, maxHp: 4, skills: [] }],
      ]),
    };
    expect(checkInvariants(baseState(), registry)).toEqual([expect.stringContaining('g2')]);
  });
});
```

Run: `npx jest projects/sim/src/invariants.spec.ts`
Expected: FAIL. The new cases receive `[]`.

- [ ] **Step 2: Implement the invariants**

In `projects/sim/src/invariants.ts`, change the signature and import:

```ts
import type { ContentRegistry, GameState } from 'engine';

export function checkInvariants(state: GameState, registry?: ContentRegistry): string[] {
```

Insert before the `if (state.result)` block:

```ts
  if (state.phase !== 'GeneralSelection') {
    if (state.generalSelection !== null) {
      violations.push('generalSelection is still set after the GeneralSelection phase ended');
    }
    for (const seat of state.seats) {
      if (!seat.generals) violations.push(`Seat ${seat.id} has no generals after general selection`);
    }
  }

  const holderByGeneralId = new Map<string, string>();
  for (const seat of state.seats) {
    if (!seat.generals) continue;
    for (const slot of ['main', 'deputy'] as const) {
      const generalId = seat.generals[slot].generalDefinitionId;
      const other = holderByGeneralId.get(generalId);
      if (other) violations.push(`General ${generalId} is held by both ${other} and ${seat.id}`);
      holderByGeneralId.set(generalId, seat.id);
      const kingdom = registry?.generals.get(generalId)?.kingdom;
      if (registry && kingdom !== seat.kingdom) {
        violations.push(`Seat ${seat.id} (${seat.kingdom}) holds ${generalId} of kingdom ${kingdom ?? 'unknown'}`);
      }
    }
  }
```

Run: `npx jest projects/sim/src/invariants.spec.ts`
Expected: PASS.

- [ ] **Step 3: Make the bot registry-aware**

Replace `projects/sim/src/bot.ts` with:

```ts
import { nextInt, getActiveSeatId, getLegalActions } from 'engine';
import type { GameState, RngState, Action, ContentRegistry } from 'engine';

// Kept as the bot's named entry point; the engine owns the rule.
export function seatToAct(state: GameState): string | null {
  return getActiveSeatId(state);
}

export function pickRandomAction(
  state: GameState,
  rng: RngState,
  registry: ContentRegistry
): { action: Action; rng: RngState } {
  const seatId = seatToAct(state);
  if (seatId === null) {
    throw new Error(
      'No seat is able to act: the turn owner / pending responder is unknown or eliminated ' +
        `(turn owner ${state.turn.ownerSeatId}, responder ${state.pendingResponse?.respondingSeatId ?? 'none'})`
    );
  }
  const legal = getLegalActions(state, seatId, registry);
  if (legal.length === 0) {
    throw new Error(`No legal actions for seat ${seatId} to act with`);
  }
  const step = nextInt(rng, legal.length);
  return { action: legal[step.value], rng: step.rng };
}
```

In `projects/sim/src/bot.spec.ts`, add `const emptyRegistry = { cards: new Map(), generals: new Map() };` after the imports, and pass it as the third argument to all four `pickRandomAction(...)` calls (lines 75, 80, 81 and 91).

In `projects/sim/src/runGame.ts`, change the call to `pickRandomAction(state, botRng, ctx.registry)`.

In `projects/sim/src/cli.ts`, change both calls to `checkInvariants(finalState, registry)`. In `runSingle` and `runBatch`, hoist `const registry = buildContentRegistry();` to module level, and use it in `playOneGame` and at the call sites.

- [ ] **Step 4: Cap the property test's seat counts and pass the registry**

In `projects/sim/src/property.spec.ts`:
- Add `kingdomWarMaxSeats` to the `content` import.
- Replace `const seatCounts = [2, 3, 4, 5, 6, 7, 8];` with:

```ts
    // Kingdom War deals 5 unique generals per seat, so the table is capped by the pool.
    const maxSeats = kingdomWarMaxSeats(registry);
    const seatCounts = Array.from({ length: maxSeats - 1 }, (_, i) => i + 2);
```

- Change `for (let i = 0; i < 10; i++)` to `for (let i = 0; i < 15; i++)`. That keeps about 60 games with 4 seat counts.
- Change `checkInvariants(finalState)` to `checkInvariants(finalState, registry)`.
- Change the test title to `'every game terminates with a valid, non-dangling GameResult and no invariant violations'` (unchanged), and the describe title to `'property: simulated Kingdom War games across many seeds and every legal seat count'`.

- [ ] **Step 5: Run the sim suite and the type check**

Run: `npx jest --selectProjects sim && npx tsc -p projects/sim/tsconfig.json --noEmit`
Expected: all PASS (the property test drives about 60 games through selection to a result), no type errors.

- [ ] **Step 6: Commit**

```bash
git add projects/sim/src
git commit -m "feat(sim): drive general selection in the bot and check selection invariants

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: App service, labels, seat summary and Setup cap

**Files:**
- Modify: `projects/app/src/app/game.service.ts`, `projects/app/src/app/labels.ts`, `projects/app/src/app/game-board/seat-summary.ts`, `projects/app/src/app/setup/setup.ts`
- Test: `projects/app/src/app/game.service.spec.ts`, `projects/app/src/app/labels.spec.ts`, `projects/app/src/app/game-board/seat-summary.spec.ts`, `projects/app/src/app/setup/setup.spec.ts`, `projects/app/src/app/game-board/game-board.spec.ts`

**Interfaces:**
- Consumes: `getActiveSeatId`, `getLegalActions(state, seatId, registry)` and `ChooseGeneralsAction` (engine), and `kingdomWarMaxSeats` (content).
- Produces: `GameService.maxSeats: number`. `GameService.startGame` now surfaces a setup error through `lastError` instead of throwing.

- [ ] **Step 1: Write the failing service tests**

In `projects/app/src/app/game.service.spec.ts`, add this helper after the imports:

```ts
function finishSelection(service: GameService): void {
  while (service.state()!.phase === 'GeneralSelection') {
    service.submit(service.legalActions()[0]);
  }
}
```

Then replace these tests:

```ts
  it('activeSeatId is the first seat still choosing during general selection', () => {
    service.startGame(2, 1);
    expect(service.state()!.phase).toBe('GeneralSelection');
    expect(service.activeSeatId()).toBe('seat-0');
  });

  it('legalActions are the active seat’s ChooseGeneralsActions during selection', () => {
    service.startGame(2, 1);
    const actions = service.legalActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.kind === 'ChooseGeneralsAction' && a.seatId === 'seat-0')).toBe(true);
  });

  it('visibleState is null until reveal is called, then hides other seats’ candidates', () => {
    service.startGame(2, 1);
    expect(service.visibleState()).toBeNull();
    service.reveal('seat-0');
    const visible = service.visibleState()!;
    expect(visible.generalSelection!.candidates['seat-0']).not.toContain('hidden');
    expect(visible.generalSelection!.candidates['seat-1']).toEqual(['hidden', 'hidden', 'hidden', 'hidden', 'hidden']);
  });

  it('submit advances state on a legal action and resets revealedSeatId', () => {
    service.startGame(2, 1);
    service.reveal('seat-0');
    service.submit(service.legalActions()[0]);
    expect(service.revealedSeatId()).toBeNull();
    expect(service.lastError()).toBeNull();
    expect(service.activeSeatId()).toBe('seat-1');
  });

  it('submit sets lastError and leaves state unchanged when resolve() throws', () => {
    service.startGame(2, 1);
    const stateBefore = service.state();
    service.submit({ kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'does-not-exist' });
    expect(service.lastError()).toContain('not legal during general selection');
    expect(service.state()).toBe(stateBefore);
  });
```

Add these new tests:

```ts
  it('completes general selection for every seat, then starts turn 1 at Judgment', () => {
    service.startGame(3, 5);
    finishSelection(service);
    const state = service.state()!;
    expect(state.phase).toBe('Judgment');
    expect(state.seats.every((s) => s.generals !== null)).toBe(true);
    expect(service.activeSeatId()).toBe('seat-0');
  });

  it('exposes the mode’s seat cap', () => {
    expect(service.maxSeats).toBe(5);
  });

  it('startGame reports an over-cap table through lastError instead of throwing', () => {
    expect(() => service.startGame(8, 1)).not.toThrow();
    expect(service.state()).toBeNull();
    expect(service.lastError()).toContain('between 2 and 5 seats');
  });
```

Keep "starts with no game in progress", "startGame creates a game with the requested seat count", "startGame is deterministic" and "clearError" as they are.

Run: `npx jest projects/app/src/app/game.service.spec.ts`
Expected: FAIL. `legalActions` throws `getLegalActions needs the content registry`, and `maxSeats` is undefined.

- [ ] **Step 2: Update `GameService`**

In `projects/app/src/app/game.service.ts`:
- Add `getActiveSeatId` to the `engine` import, and `kingdomWarMaxSeats` to the `content` import.
- Replace `activeSeatId`, `legalActions` and `startGame` with:

```ts
  readonly maxSeats: number = kingdomWarMaxSeats(this.registry);

  readonly activeSeatId: Signal<string | null> = computed(() => {
    const state = this._state();
    return state ? getActiveSeatId(state) : null;
  });

  readonly legalActions: Signal<Action[]> = computed(() => {
    const state = this._state();
    const seatId = this.activeSeatId();
    if (!state || !seatId) return [];
    return getLegalActions(state, seatId, this.registry);
  });
```

```ts
  startGame(seatCount: number, seed?: number): void {
    const seatIds = Array.from({ length: seatCount }, (_, i) => `seat-${i}`);
    const rngSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
    this._revealedSeatId.set(null);
    try {
      this._state.set(createGame(kingdomWarMode, this.registry, seatIds, rngSeed));
      this._lastError.set(null);
    } catch (err) {
      this._state.set(null);
      this._lastError.set(err instanceof Error ? err.message : String(err));
    }
  }
```

`maxSeats` must be declared after `registry`, because field initializers run in order.

Run: `npx jest projects/app/src/app/game.service.spec.ts`
Expected: PASS.

- [ ] **Step 3: Labels for the new action and event (test first)**

Append to `projects/app/src/app/labels.spec.ts`, inside the existing `describe('actionLabel', ...)`:

```ts
  it('labels ChooseGeneralsAction with both generals and their roles', () => {
    const action: Action = { kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId: 'cao-cao', deputyId: 'xu-chu' };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Choose Cao Cao (main) and Xu Chu (deputy)');
  });
```

Append inside `describe('eventLabel', ...)`:

```ts
  it('labels GeneralsChosenEvent without naming any general', () => {
    expect(eventLabel({ kind: 'GeneralsChosenEvent', seatId: 'seat-1' })).toBe('seat-1 chose their generals');
  });
```

Run: `npx jest projects/app/src/app/labels.spec.ts`
Expected: FAIL (`undefined` returned).

In `projects/app/src/app/labels.ts`, add this to `actionLabel`'s switch:

```ts
    case 'ChooseGeneralsAction':
      return `Choose ${generalDisplayName(action.mainId)} (main) and ${generalDisplayName(action.deputyId)} (deputy)`;
```

Add this to `eventLabel`'s switch:

```ts
    case 'GeneralsChosenEvent':
      return `${event.seatId} chose their generals`;
```

Run: `npx jest projects/app/src/app/labels.spec.ts`
Expected: PASS.

- [ ] **Step 4: Seat summary for a seat with no generals (test first)**

Add to the `describe('SeatSummary', ...)` block in `projects/app/src/app/game-board/seat-summary.spec.ts`, which builds the standalone component directly with no `configureTestingModule`:

```ts
  it('shows a placeholder instead of portraits for a seat still choosing generals', () => {
    const fixture = TestBed.createComponent(SeatSummary);
    fixture.componentRef.setInput('seat', makeSeat({ generals: null }));
    fixture.componentRef.setInput('hand', makeHand(4));
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Choosing generals');
    expect(el.querySelectorAll('.generals app-card-art')).toHaveLength(0);
  });
```

Run: `npx jest projects/app/src/app/game-board/seat-summary.spec.ts`
Expected: FAIL with `TypeError: Cannot read properties of null (reading 'main')`.

In `projects/app/src/app/game-board/seat-summary.ts`, replace the `<div class="generals">…</div>` block with:

```html
      <div class="generals">
        @if (seat().generals; as generals) {
          <app-card-art
            [id]="generals.main.generalDefinitionId"
            [label]="generalDisplayName(generals.main.generalDefinitionId)"
          />
          <app-card-art
            [id]="generals.deputy.generalDefinitionId"
            [label]="generalDisplayName(generals.deputy.generalDefinitionId)"
          />
        } @else {
          <span>Choosing generals…</span>
        }
      </div>
```

Run: `npx jest projects/app/src/app/game-board/seat-summary.spec.ts`
Expected: PASS.

- [ ] **Step 5: Setup seat cap (test first)**

In `projects/app/src/app/setup/setup.spec.ts`, replace the clamp test's final two assertions and its title:

```ts
  it('clamps a zeroed/cleared seat count into [2, maxSeats] instead of sending 0', async () => {
```

```ts
    const seatCount = gameService.state()!.seats.length;
    expect(seatCount).toBeGreaterThanOrEqual(2);
    expect(seatCount).toBeLessThanOrEqual(gameService.maxSeats);
```

Add this test:

```ts
  it('clamps a seat count above the mode’s cap down to maxSeats', async () => {
    await TestBed.configureTestingModule({
      imports: [Setup],
      providers: [provideRouter([{ path: 'game', children: [] }])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Setup);
    const gameService = TestBed.inject(GameService);
    fixture.componentInstance.seatCount.set(8);
    fixture.componentInstance.startGame();
    expect(gameService.state()!.seats).toHaveLength(gameService.maxSeats);
    fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector('input[type="number"]') as HTMLInputElement;
    expect(input.max).toBe(String(gameService.maxSeats));
  });
```

Run: `npx jest projects/app/src/app/setup/setup.spec.ts`
Expected: FAIL. `state()` is null (createGame threw for 8 seats), so `seats` is read on null.

In `projects/app/src/app/setup/setup.ts`, change the label and input to:

```html
    <label>
      Seat count (2-{{ maxSeats }}):
      <input
        type="number"
        min="2"
        [max]="maxSeats"
        [value]="seatCount()"
        (input)="seatCount.set(+$any($event.target).value)"
      />
    </label>
```

In the class:

```ts
  protected readonly maxSeats = this.gameService.maxSeats;
```

Declare it after `gameService`. Change the clamp to:

```ts
    const clamped = Math.min(this.maxSeats, Math.max(2, this.seatCount() || 2));
```

Run: `npx jest projects/app/src/app/setup/setup.spec.ts`
Expected: PASS.

- [ ] **Step 6: Keep the GameBoard specs green against the new start phase**

In `projects/app/src/app/game-board/game-board.spec.ts`:
- In "re-shows the reveal gate for the next seat after an action is submitted", replace the `endPhase` lookup and submit with `gameService.submit(gameService.legalActions()[0]);`.
- In "shows a dismissible error banner", change the expected text to `'not legal during general selection'`.

(Task 8 updates the "shows the action list once revealed" test.)

- [ ] **Step 7: Run the app suite and the type checks**

Run: `npx jest --selectProjects app && npx tsc -p projects/app/tsconfig.spec.json --noEmit && npx ng build app --configuration development`
Expected: all PASS, no type or template errors.

- [ ] **Step 8: Commit**

```bash
git add projects/app/src/app/game.service.ts projects/app/src/app/game.service.spec.ts projects/app/src/app/setup \
  projects/app/src/app/game-board/game-board.spec.ts
git add -p projects/app/src/app/labels.ts projects/app/src/app/labels.spec.ts \
  projects/app/src/app/game-board/seat-summary.ts projects/app/src/app/game-board/seat-summary.spec.ts
git commit -m "feat(app): route active seat and legal actions through the engine for general selection

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

With `git add -p`, stage only this task's hunks. Those four files carry unrelated uncommitted card-art work.

---

### Task 7: Angular Material and the `GeneralSelection` component

**Files:**
- Modify: `package.json`, `package-lock.json`, `angular.json`, `projects/app/src/index.html` (via `ng add`)
- Create: `projects/app/src/app/game-board/general-selection.ts`, `projects/app/src/app/game-board/general-selection.spec.ts`

**Interfaces:**
- Consumes: `ChooseGeneralsAction` and `ContentRegistry` (engine), `generalDisplayData` and `GeneralDisplayData` (content, Task 1), `CardArt` (existing), and `generalDisplayName` (labels).
- Produces: `GeneralSelection`, a standalone component with selector `app-general-selection`.
  - Inputs: `candidates: string[]`, `actions: ChooseGeneralsAction[]`, `registry: ContentRegistry`.
  - Output: `chosen: ChooseGeneralsAction`.

- [ ] **Step 1: Install Angular Material**

Run: `npx ng add @angular/material --project app --skip-confirmation --defaults`

Expected: `@angular/material` and `@angular/cdk` (v22) are added to `package.json`, a prebuilt M3 theme (for example `@angular/material/prebuilt-themes/azure-blue.css`) is added to `projects.app.architect.build.options.styles` in `angular.json`, Roboto is added to `projects/app/src/index.html`, and `class="mat-typography"` is added to `<body>`.

If the schematic cannot run (for example, when offline or on a prompt error), apply the same changes by hand:
1. Run `npm install @angular/material@^22.1.0 @angular/cdk@^22.1.0`.
2. Set `"styles": ["@angular/material/prebuilt-themes/azure-blue.css", "projects/app/src/styles.css"]` in `angular.json`.
3. Add `<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet" />` to the `<head>` of `index.html`.
4. Change `<body>` to `<body class="mat-typography">`.

Run: `npx ng build app --configuration development`
Expected: the build succeeds.

- [ ] **Step 2: Write the failing component test**

Create `projects/app/src/app/game-board/general-selection.spec.ts`:

```ts
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ChooseGeneralsAction, ContentRegistry, GeneralDefinition, Kingdom } from 'engine';
import { GeneralSelection } from './general-selection';

function general(id: string, kingdom: Kingdom, maxHp: number): [string, GeneralDefinition] {
  return [id, { id, kingdom, maxHp, skills: [] }];
}

const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([general('w1', 'Wei', 4), general('w2', 'Wei', 3), general('w3', 'Wei', 4), general('s1', 'Shu', 4), general('q1', 'Qun', 5)]),
};
const candidates = ['w1', 'w2', 'w3', 's1', 'q1'];
const pair = (mainId: string, deputyId: string): ChooseGeneralsAction => ({ kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId, deputyId });
// What the engine returns for these candidates: every ordered Wei pair.
const actions = [pair('w1', 'w2'), pair('w1', 'w3'), pair('w2', 'w1'), pair('w2', 'w3'), pair('w3', 'w1'), pair('w3', 'w2')];

describe('GeneralSelection', () => {
  let fixture: ComponentFixture<GeneralSelection>;
  let el: HTMLElement;
  let emitted: ChooseGeneralsAction[];

  const card = (id: string) => el.querySelector(`[data-general-id="${id}"]`) as HTMLElement;
  const click = (id: string) => { card(id).click(); fixture.detectChanges(); };
  const badge = (id: string) => card(id).querySelector('.mat-badge-content')?.textContent?.trim() ?? '';
  const button = (cls: string) => el.querySelector(`button.${cls}`) as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [GeneralSelection] }).compileComponents();
    fixture = TestBed.createComponent(GeneralSelection);
    fixture.componentRef.setInput('candidates', candidates);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('registry', registry);
    emitted = [];
    fixture.componentInstance.chosen.subscribe((a) => emitted.push(a));
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders one card per candidate with its kingdom and HP', () => {
    expect(el.querySelectorAll('[data-general-id]')).toHaveLength(5);
    expect(card('q1').textContent).toContain('Qun');
    expect(card('q1').textContent).toContain('HP 5');
  });

  it('disables candidates that appear in no legal pair from the start (Review Focus 3)', () => {
    expect(card('s1').classList).toContain('disabled');
    expect(card('q1').classList).toContain('disabled');
    click('s1');
    expect(badge('s1')).toBe('');
  });

  it('badges the first pick Main and the second Deputy', () => {
    click('w1');
    click('w2');
    expect(badge('w1')).toBe('Main');
    expect(badge('w2')).toBe('Deputy');
  });

  it('replaces the Deputy when a third card is picked', () => {
    click('w1');
    click('w2');
    click('w3');
    expect(badge('w1')).toBe('Main');
    expect(badge('w2')).toBe('');
    expect(badge('w3')).toBe('Deputy');
  });

  it('promotes the Deputy to Main when the Main is deselected (Review Focus 4)', () => {
    click('w1');
    click('w2');
    click('w1');
    expect(badge('w1')).toBe('');
    expect(badge('w2')).toBe('Main');
  });

  it('Swap reverses Main and Deputy', () => {
    click('w1');
    click('w2');
    button('swap').click();
    fixture.detectChanges();
    expect(badge('w2')).toBe('Main');
    expect(badge('w1')).toBe('Deputy');
  });

  it('enables Confirm only for a legal pair, and emits exactly the engine’s action', () => {
    expect(button('confirm').disabled).toBe(true);
    click('w1');
    expect(button('confirm').disabled).toBe(true);
    click('w2');
    button('swap').click();
    fixture.detectChanges();
    expect(button('confirm').disabled).toBe(false);
    button('confirm').click();
    expect(emitted).toEqual([actions[2]]);
    expect(emitted[0]).toBe(actions[2]);
  });

  it('summarises the resulting kingdom and combined HP', () => {
    click('w1');
    click('w2');
    expect(el.querySelector('.summary')!.textContent).toContain('Kingdom: Wei');
    expect(el.querySelector('.summary')!.textContent).toContain('Combined HP: 7');
  });
});
```

Run: `npx jest projects/app/src/app/game-board/general-selection.spec.ts`
Expected: FAIL with `Cannot find module './general-selection'`.

- [ ] **Step 3: Implement the component**

Create `projects/app/src/app/game-board/general-selection.ts`:

```ts
import { Component, computed, input, output, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChooseGeneralsAction, ContentRegistry, Kingdom } from 'engine';
import { GeneralDisplayData, generalDisplayData } from 'content';
import { CardArt } from './card-art';
import { generalDisplayName } from '../labels';

interface CandidateViewModel {
  id: string;
  name: string;
  display: GeneralDisplayData | null;
  kingdom: Kingdom;
  maxHp: number;
  role: 'Main' | 'Deputy' | null;
  enabled: boolean;
}

// Presentational: which pairs are legal comes entirely from `actions` (the
// engine's getLegalActions); this component never compares kingdoms itself.
@Component({
  selector: 'app-general-selection',
  imports: [MatBadgeModule, MatButtonModule, MatCardModule, MatChipsModule, MatTooltipModule, CardArt],
  template: `
    <h2>Choose your generals</h2>
    <p class="hint">Pick two generals of the same kingdom. Your first pick is your Main general.</p>
    <div class="candidates">
      @for (vm of candidateViewModels(); track vm.id) {
        <mat-card
          appearance="outlined"
          class="candidate"
          role="button"
          [attr.tabindex]="vm.enabled ? 0 : -1"
          [attr.aria-disabled]="!vm.enabled"
          [attr.aria-pressed]="vm.role !== null"
          [attr.data-general-id]="vm.id"
          [class.selected]="vm.role !== null"
          [class.disabled]="!vm.enabled"
          [matBadge]="vm.role ?? ''"
          [matBadgeHidden]="vm.role === null"
          matBadgePosition="above after"
          matTooltip="Must share a kingdom with your first pick"
          [matTooltipDisabled]="vm.enabled"
          (click)="toggle(vm)"
          (keydown.enter)="toggle(vm)"
          (keydown.space)="toggle(vm); $event.preventDefault()"
        >
          <mat-card-header>
            <mat-card-title>{{ vm.name }}</mat-card-title>
            @if (vm.display?.title; as title) {
              <mat-card-subtitle>{{ title }}</mat-card-subtitle>
            }
          </mat-card-header>
          <app-card-art [id]="vm.id" [label]="vm.name" />
          <mat-card-content>
            <mat-chip-set>
              <mat-chip [class]="'kingdom-' + vm.kingdom" [disableRipple]="true">{{ vm.kingdom }}</mat-chip>
            </mat-chip-set>
            <span class="hp">HP {{ vm.maxHp }}</span>
            <ul class="skills">
              @for (skill of vm.display?.skills ?? []; track skill.name) {
                <li><strong>{{ skill.name }}</strong> — {{ skill.text }}</li>
              }
            </ul>
          </mat-card-content>
        </mat-card>
      }
    </div>
    @if (summary(); as s) {
      <p class="summary">Kingdom: {{ s.kingdom }} · Combined HP: {{ s.hp }}</p>
    }
    <div class="controls">
      <button mat-stroked-button type="button" class="swap" [disabled]="selected().length !== 2" (click)="swap()">
        Swap
      </button>
      <button mat-flat-button type="button" class="confirm" [disabled]="!matchingAction()" (click)="confirm()">
        Confirm
      </button>
    </div>
  `,
  styles: `
    .candidates {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
      gap: 16px;
      margin: 16px 0;
    }
    .candidate { cursor: pointer; transition: box-shadow 120ms, opacity 120ms; }
    .candidate.selected { outline: 3px solid var(--mat-sys-primary); }
    .candidate.disabled { opacity: 0.45; cursor: not-allowed; }
    .skills { padding-left: 1.1em; font-size: 0.85em; }
    .hp { margin-left: 8px; }
    .controls { display: flex; gap: 8px; flex-wrap: wrap; }
    .kingdom-Wei { --mat-chip-elevated-container-color: #d6e4ff; }
    .kingdom-Shu { --mat-chip-elevated-container-color: #ffd9d6; }
    .kingdom-Wu { --mat-chip-elevated-container-color: #d6f5dc; }
    .kingdom-Qun { --mat-chip-elevated-container-color: #e6e1e5; }
  `,
})
export class GeneralSelection {
  readonly candidates = input.required<string[]>();
  readonly actions = input.required<ChooseGeneralsAction[]>();
  readonly registry = input.required<ContentRegistry>();
  readonly chosen = output<ChooseGeneralsAction>();

  // UI-only state: the player's picks in order, [main, deputy].
  protected readonly selected = signal<string[]>([]);

  protected readonly candidateViewModels = computed<CandidateViewModel[]>(() => {
    const selected = this.selected();
    const actions = this.actions();
    return this.candidates().map((id) => {
      const definition = this.registry().generals.get(id);
      const display = generalDisplayData(id);
      const index = selected.indexOf(id);
      return {
        id,
        name: display?.name ?? generalDisplayName(id),
        display,
        kingdom: definition?.kingdom ?? 'hidden',
        maxHp: definition?.maxHp ?? 0,
        role: index === 0 ? 'Main' : index === 1 ? 'Deputy' : null,
        enabled: this.isSelectable(id, selected, actions),
      };
    });
  });

  protected readonly matchingAction = computed<ChooseGeneralsAction | null>(() => {
    const [mainId, deputyId] = this.selected();
    return this.actions().find((a) => a.mainId === mainId && a.deputyId === deputyId) ?? null;
  });

  protected readonly summary = computed(() => {
    const action = this.matchingAction();
    if (!action) return null;
    const main = this.registry().generals.get(action.mainId);
    const deputy = this.registry().generals.get(action.deputyId);
    if (!main || !deputy) return null;
    return { kingdom: main.kingdom, hp: main.maxHp + deputy.maxHp };
  });

  // Selectable iff already picked, or the engine offers a pair containing it:
  // with no picks yet, any pair at all; otherwise a pair with the first pick.
  private isSelectable(id: string, selected: string[], actions: ChooseGeneralsAction[]): boolean {
    if (selected.includes(id)) return true;
    const first = selected[0];
    return first === undefined
      ? actions.some((a) => a.mainId === id)
      : actions.some((a) => a.mainId === first && a.deputyId === id);
  }

  protected toggle(vm: CandidateViewModel): void {
    if (!vm.enabled) return;
    const selected = this.selected();
    if (selected.includes(vm.id)) {
      this.selected.set(selected.filter((id) => id !== vm.id));
    } else if (selected.length < 2) {
      this.selected.set([...selected, vm.id]);
    } else {
      this.selected.set([selected[0], vm.id]);
    }
  }

  protected swap(): void {
    const [mainId, deputyId] = this.selected();
    if (mainId && deputyId) this.selected.set([deputyId, mainId]);
  }

  protected confirm(): void {
    const action = this.matchingAction();
    if (action) this.chosen.emit(action);
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx jest projects/app/src/app/game-board/general-selection.spec.ts`
Expected: PASS.

If Material's tooltip or badge complains about a missing animations provider under Jest, add `providers: [provideNoopAnimations()]` (from `@angular/platform-browser/animations`) to the spec's `configureTestingModule`. Do not change the component.

- [ ] **Step 5: Type-check and build (component style budget)**

Run: `npx tsc -p projects/app/tsconfig.spec.json --noEmit && npx ng build app --configuration development`
Expected: no errors. If the `anyComponentStyle` 4kB warning appears, that is acceptable. The error threshold is 8kB.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json angular.json projects/app/src/index.html \
  projects/app/src/app/game-board/general-selection.ts projects/app/src/app/game-board/general-selection.spec.ts
git commit -m "feat(app): add Angular Material and the general selection view

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

`angular.json` has an unrelated uncommitted edit (the card-art asset glob). Use `git add -p angular.json` and stage only the styles change.

---

### Task 8: Show `GeneralSelection` on the board during the phase

**Files:**
- Modify: `projects/app/src/app/game-board/game-board.ts`
- Test: `projects/app/src/app/game-board/game-board.spec.ts`

**Interfaces:**
- Consumes: `GeneralSelection` (Task 7), `GameService` (Task 6), and `ChooseGeneralsAction` (engine).
- Produces: none (leaf).

- [ ] **Step 1: Write the failing board tests**

In `projects/app/src/app/game-board/game-board.spec.ts`, add `import { By } from '@angular/platform-browser';` and `import { GeneralSelection } from './general-selection';`, and this helper:

```ts
function finishSelection(gameService: GameService): void {
  while (gameService.state()!.phase === 'GeneralSelection') {
    gameService.submit(gameService.legalActions()[0]);
  }
}
```

Replace "shows the action list once the active seat is revealed, and hides the gate" with:

```ts
  it('shows the general selection view, not the action list, after reveal during GeneralSelection', () => {
    gameService.startGame(2, 1);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-reveal-gate-overlay')).toBeNull();
    expect(el.querySelector('app-general-selection')).not.toBeNull();
    expect(el.querySelector('app-action-list')).toBeNull();
    expect(el.querySelectorAll('app-general-selection [data-general-id]')).toHaveLength(5);
  });

  it('submits the chosen generals and gates the next seat', () => {
    gameService.startGame(2, 1);
    gameService.reveal('seat-0');
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const selection = fixture.debugElement.query(By.directive(GeneralSelection)).componentInstance as GeneralSelection;
    selection.chosen.emit(gameService.legalActions()[0] as import('engine').ChooseGeneralsAction);
    fixture.detectChanges();

    expect(gameService.state()!.seats[0].generals).not.toBeNull();
    expect(gameService.activeSeatId()).toBe('seat-1');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-reveal-gate-overlay')).not.toBeNull();
  });

  it('shows the action list once every seat has chosen and the active seat is revealed', () => {
    gameService.startGame(2, 1);
    finishSelection(gameService);
    gameService.reveal(gameService.activeSeatId()!);
    const fixture = TestBed.createComponent(GameBoard);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-general-selection')).toBeNull();
    expect(el.querySelector('app-action-list')).not.toBeNull();
  });
```

Run: `npx jest projects/app/src/app/game-board/game-board.spec.ts`
Expected: FAIL. `app-general-selection` is not rendered, and the action list is shown instead.

- [ ] **Step 2: Integrate into `GameBoard`**

In `projects/app/src/app/game-board/game-board.ts`:
- Change the engine import to `import { Action, CardInstance, ChooseGeneralsAction } from 'engine';`.
- Add `import { GeneralSelection } from './general-selection';`, and add `GeneralSelection` to `imports`.
- Replace the `@else if (visibleState(); as visible) { ... }` block with:

```html
        } @else if (visibleState(); as visible) {
          @if (visible.phase === 'GeneralSelection') {
            <app-general-selection
              [candidates]="selectionCandidates()"
              [actions]="generalChoices()"
              [registry]="gameService.registry"
              (chosen)="submit($event)"
            />
          } @else {
            <div class="seats">
              @for (vm of seatViewModels(); track vm.seat.id) {
                <app-seat-summary [seat]="vm.seat" [hand]="vm.hand" />
              }
            </div>
            <app-action-list
              [actions]="gameService.legalActions()"
              [state]="visible"
              [registry]="gameService.registry"
              (actionChosen)="submit($event)"
            />
            <app-event-log [events]="visible.log" />
          }
        }
```

Add to the class:

```ts
  // The revealed seat's own dealt candidates (other seats' are redacted anyway).
  protected readonly selectionCandidates = computed<string[]>(() => {
    const visible = this.visibleState();
    const seatId = this.activeSeatId();
    if (!visible || !seatId) return [];
    return visible.generalSelection?.candidates[seatId] ?? [];
  });

  protected readonly generalChoices = computed<ChooseGeneralsAction[]>(() =>
    this.gameService.legalActions().filter((a): a is ChooseGeneralsAction => a.kind === 'ChooseGeneralsAction')
  );
```

- [ ] **Step 3: Run the full suite, the type checks and the build**

Run: `npx jest && npx tsc -p projects/engine/tsconfig.spec.json --noEmit && npx tsc -p projects/content/tsconfig.spec.json --noEmit && npx tsc -p projects/sim/tsconfig.json --noEmit && npx tsc -p projects/app/tsconfig.spec.json --noEmit && npx ng build app --configuration development && npm run build`
Expected: all 4 Jest projects PASS, no type errors, and the app and libraries build.

- [ ] **Step 4: Manual check in the dev server**

Run `npx ng serve app` (use the `run` skill to drive it in a browser if available), then:
1. On Setup, the label reads "Seat count (2-5)". Enter 3 and start.
2. The gate reads "Pass to seat-0". Tap it. Five Material cards with art, name, kingdom chip, HP and skill text appear.
3. Check that cards without a same-kingdom partner are dimmed and show the tooltip on hover.
4. Pick two cards of the same kingdom. The Main and Deputy badges appear. Press Swap and the badges flip. The summary line shows the kingdom and HP. Press Confirm.
5. The gate reappears for seat-1. Repeat for seat-1 and seat-2.
6. The normal board appears at turn 1 (Judgment) for seat-0, with each seat's own two generals visible to it and other seats hidden.
7. Resize to about 400px wide. The cards stack into one column.

Record anything that deviates as a note for the final review. Do not fix unrelated issues.

- [ ] **Step 5: Commit**

```bash
git add projects/app/src/app/game-board/game-board.ts projects/app/src/app/game-board/game-board.spec.ts
git commit -m "feat(app): show general selection on the board before turn 1

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

`game-board.ts` has an unrelated uncommitted edit. Use `git add -p` and stage only this task's hunks.
