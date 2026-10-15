# Bot Stage 0: Mirrored Seed Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the tournament harness play each seed twice with the sides swapped and take the pair's average as one data point, so a 1 to 3 pp bot improvement can be seen in a few thousand games.

**Architecture:** `runTournament` gets a `mirrored` option. Game `i` uses seed `firstSeed + floor(i / 2)`, and the existing `sideOf(game, seat)` already flips sides on every odd game, so the pair shares a deal and swaps who sits where. A pure `pairMeans` function turns per-game differences into per-pair values; the interval is taken over pairs. The CLI defaults to mirrored.

**Tech Stack:** TypeScript (strict), Jest via ts-jest (`npx jest --selectProjects sim`), `tsx` for the CLI (`npm run sim`).

**Spec:** `docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md` (Stage 0). The harness it extends: `docs/superpowers/specs/2026-10-15-bot-tournament-and-targeting-design.md`.

## Global Constraints

- `sim` is plain TypeScript; no engine, content, bots, app or server changes in this stage.
- Strict TS with `noPropertyAccessFromIndexSignature`: read `Record<string, T>` entries with brackets.
- Existing callers and specs must keep their numbers: `mirrored` is optional and off by default in `runTournament`; only the CLI defaults it on.
- Commit only the files named in each task, with explicit paths (the working tree holds unrelated uncommitted changes from the user; never `git add -A` or `git commit -a`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Work on branch `feat/bot-stage-0-mirrored-pairs`.

## Review Focus

- An odd `games` count cannot form pairs: `runTournament` throws in mirrored mode (Task 1).
- A pair where either game ends without a result counts for nothing in the interval; the other game still counts in the win-rate tallies (Task 1, `pairMeans`).
- Every game cut off by the action cap, mirrored: no NaN or Infinity, zero pairs, verdict "too few games to judge" (Task 1).
- Unmirrored mode keeps exactly its old numbers, including odd game counts (Task 1).
- A misspelt CLI option must fail loudly, not silently run the default mode (Task 2).

## File Structure

| File | Responsibility |
|---|---|
| `projects/sim/src/tournament.ts` (modify) | `mirrored` option, `pairMeans`, pair-based interval, report wording |
| `projects/sim/src/tournament.spec.ts` (modify) | specs for the above |
| `projects/sim/src/cli.ts` (modify) | trailing `mirrored` / `unmirrored` argument, default mirrored |
| `docs/architecture/bots-and-simulation.md` (modify) | document mirrored mode |
| `docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md` (modify) | record Stage 0 results |

---

### Task 1: Mirrored pairs in `runTournament`

**Files:**
- Modify: `projects/sim/src/tournament.ts`
- Modify: `projects/sim/src/tournament.spec.ts`

**Interfaces:**
- Consumes: existing `sideOf`, `scoreGame`, `interval`, `runGame` (unchanged).
- Produces:
  ```ts
  export function pairMeans(differences: (number | null)[]): number[]; // pairs (0,1), (2,3)…; a pair with a null is dropped
  export interface TournamentConfig { …existing…; mirrored?: boolean }
  // runTournament: with mirrored, game i uses seed firstSeed + floor(i / 2); difference is the interval over pair means.
  ```

- [ ] **Step 1: Write the failing tests.** In `tournament.spec.ts` change the import to
  `import { formatReport, interval, pairMeans, runTournament, scoreGame, sideOf, Side } from './tournament';`
  and append:

```ts
describe('pairMeans', () => {
  it('averages each consecutive pair and drops a pair with an unfinished game', () => {
    expect(pairMeans([0.5, -0.1, null, 0.3, 1, 0])).toEqual([0.2, 0.5]);
  });

  it('is empty for no games, and ignores a trailing unpaired game', () => {
    expect(pairMeans([])).toEqual([]);
    expect(pairMeans([0.5])).toEqual([]);
  });
});

describe('runTournament, mirrored', () => {
  const mirrored = { games: 6, seats: 4, challenger: 'rule-based', baseline: 'rule-based-v1', firstSeed: 1, mirrored: true } as const;

  it('gives exactly zero for two bots that behave identically: each pair replays one deal with the sides swapped', () => {
    const report = runTournament(mirrored);
    expect(report.finished).toBe(6);
    expect(report.difference).toEqual({ mean: 0, low: 0, high: 0, games: 3 });
  });

  it('is deterministic', () => {
    expect(runTournament(mirrored)).toEqual(runTournament(mirrored));
  });

  it('rejects an odd number of games, which cannot form pairs', () => {
    expect(() => runTournament({ ...mirrored, games: 5 })).toThrow(/even number of games/);
  });

  it('allows an odd number of games when not mirrored', () => {
    expect(runTournament({ ...mirrored, games: 3, mirrored: false }).finished).toBe(3);
  });

  it('reports no pairs, and no NaN, when every game is cut off by the action cap', () => {
    const report = runTournament({ ...mirrored, games: 4, maxActions: 1 });
    expect(report.unfinished).toBe(4);
    expect(report.difference.games).toBe(0);
    expect(formatReport(report)).not.toMatch(/NaN|Infinity/);
    expect(formatReport(report)).toMatch(/too few games to judge/);
  });

  it('counts the report in pairs', () => {
    expect(formatReport(runTournament(mirrored))).toMatch(/over 3 pairs/);
    expect(formatReport(runTournament({ ...mirrored, mirrored: false }))).toMatch(/over 6 games/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --selectProjects sim --runTestsByPath projects/sim/src/tournament.spec.ts`
Expected: FAIL — `pairMeans` is not exported (TypeScript or runtime error), and the mirrored tests fail.

- [ ] **Step 3: Implement** in `tournament.ts`.

1. Add to `TournamentConfig` a last field: `mirrored?: boolean;` with the comment line above it
   `// Play each seed twice with the sides swapped; the interval is over pairs. Needs an even number of games.`
2. Add above `runTournament`:

```ts
// One value per consecutive pair of games (0 and 1, 2 and 3, …); a pair with an unfinished game is dropped.
export function pairMeans(differences: (number | null)[]): number[] {
  const means: number[] = [];
  for (let i = 0; i + 1 < differences.length; i += 2) {
    const a = differences[i];
    const b = differences[i + 1];
    if (a !== null && b !== null) means.push((a + b) / 2);
  }
  return means;
}
```

3. In `runTournament`, directly after the whole-number validation loop and before the seats check, add:
   ```ts
   if (config.mirrored && config.games % 2 !== 0) throw new Error('A mirrored tournament needs an even number of games');
   ```
4. Replace the declarations `const differences: number[] = [];` and `let unfinished = 0;` with:
   ```ts
   const gameDifferences: (number | null)[] = []; // null for a game with no result
   ```
5. Change the seed line `const seed = firstSeed + game;` to
   `const seed = firstSeed + (config.mirrored ? Math.floor(game / 2) : game);`
6. Replace
   ```ts
       if (!score.finished) {
         unfinished += 1;
         continue;
       }
       differences.push(score.wins.challenger / half - score.wins.baseline / half);
   ```
   with
   ```ts
       if (!score.finished) {
         gameDifferences.push(null);
         continue;
       }
       gameDifferences.push(score.wins.challenger / half - score.wins.baseline / half);
   ```
7. Replace the final `return { config, finished: differences.length, unfinished, … }` with:
   ```ts
   const finished = gameDifferences.filter((d) => d !== null).length;
   const values = config.mirrored ? pairMeans(gameDifferences) : gameDifferences.filter((d): d is number => d !== null);
   return { config, finished, unfinished: gameDifferences.length - finished, challenger: tallies.challenger, baseline: tallies.baseline, difference: interval(values) };
   ```
8. In `formatReport`, change the last line's `over ${d.games} games:` to `over ${d.games} ${config.mirrored ? 'pairs' : 'games'}:` and the first line's `seats ${config.seats}, first seed ${config.firstSeed ?? 0}` to `seats ${config.seats}, first seed ${config.firstSeed ?? 0}${config.mirrored ? ', mirrored pairs' : ''}`.

- [ ] **Step 4: Run the tests**

Run: `npx jest --selectProjects sim --runTestsByPath projects/sim/src/tournament.spec.ts`
Expected: PASS, including the older tournament specs unchanged. If the "exactly zero" test fails with a small non-zero difference, the two policies are not behaving identically (a real finding: `rule-based` and `rule-based-v1` should be the same bot); print the report and investigate before changing the test.

- [ ] **Step 5: Run the sim suite and commit**

Run: `npx jest --selectProjects bots sim`
Expected: PASS.

```bash
git add projects/sim/src/tournament.ts projects/sim/src/tournament.spec.ts
git commit -m "feat(sim): mirrored seed pairs in the tournament

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: CLI option, docs, and the Stage 0 results

**Files:**
- Modify: `projects/sim/src/cli.ts`
- Modify: `docs/architecture/bots-and-simulation.md`
- Modify: `docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md`

**Interfaces:**
- Consumes: `runTournament` with `mirrored` (Task 1).

- [ ] **Step 1: CLI.** In `cli.ts` replace `runTournamentCommand` and the tournament dispatch so the option is parsed and validated. Replace the function with:

```ts
function parseMirrored(option: string | undefined): boolean {
  if (option === undefined || option === 'mirrored') return true;
  if (option === 'unmirrored') return false;
  throw new Error(`Unknown option "${option}". Use mirrored or unmirrored`);
}

function runTournamentCommand(games: number, numSeats: number, challenger: string, baseline: string, firstSeed: number, option: string | undefined): void {
  const mirrored = parseMirrored(option);
  const report = runTournament({ games, seats: numSeats, challenger: parseBotKind(challenger), baseline: parseBotKind(baseline), firstSeed, mirrored });
  console.log(formatReport(report));
}
```

Change the argument destructuring to `const [, , mode, arg1, arg2, arg3, arg4, arg5, arg6] = process.argv;`, the call to
`runTournamentCommand(Number(arg1 ?? 100), Number(arg2 ?? 4), arg3 ?? 'rule-based', arg4 ?? 'rule-based-v1', Number(arg5 ?? 0), arg6);`
and the usage string's tournament part to
`sim tournament <games> <numSeats> <challenger> <baseline> [firstSeed] [mirrored|unmirrored]`.

- [ ] **Step 2: Run it**

Run: `npm run sim -- tournament 20 4 rule-based rule-based-v1 0`
Expected: report header ends `mirrored pairs`, last line says `over 10 pairs`, difference `0.0 pp` with interval `0.0 pp to 0.0 pp`.

Run: `npm run sim -- tournament 20 4 rule-based rule-based-v1 0 unmirrored`
Expected: `over 20 games`, no "mirrored pairs" in the header.

Run: `npm run sim -- tournament 21 4 rule-based rule-based-v1 0`
Expected: `A mirrored tournament needs an even number of games`, exit code 1 (check with `; echo $?` and no pipe).

Run: `npm run sim -- tournament 20 4 rule-based rule-based-v1 0 mirrorred`
Expected: `Unknown option "mirrorred". Use mirrored or unmirrored`, exit code 1.

- [ ] **Step 3: Docs.** In `docs/architecture/bots-and-simulation.md`, in the `tournament` paragraph, replace the sentence beginning "Each finished game gives the challenger's share…" through "…excludes 0." with:

```md
Each finished game gives the challenger's share of winning seats minus the
baseline's. By default the tournament is **mirrored**: each seed is played twice
with the sides swapped, and a pair's average is one data point, which cancels
the luck of the deal and of the Generals. The report shows the mean over pairs
with a 95% interval and says which bot is better only when the interval
excludes 0. Add `unmirrored` as a last argument for one fresh seed per game.
```

and change the example command in that paragraph to
`npm run sim -- tournament 4000 4 rule-based rule-based-v1`.

- [ ] **Step 4: Measure.** These runs are the stage's check; run each and keep the output (each takes under a minute; run in the background if a command may exceed two minutes):

```bash
npm run sim -- tournament 200 4 rule-based random 0 unmirrored
npm run sim -- tournament 200 4 rule-based random 0 mirrored
npm run sim -- tournament 4000 4 rule-based rule-based-v1 0 mirrored
```

Expected: both `rule-based` against `random` runs say "challenger is better" and the mirrored interval is narrower than the unmirrored one at the same game count (if it is not, say so in the results; do not hide it). The last run is the identical-bots control and must read exactly `0.0 pp … 0.0 pp`.

- [ ] **Step 5: Record the results.** Append to the roadmap spec:

```md

## Stage 0 results

Date: <today>. Stage 0 implemented as specified. 200 games of `rule-based` against `random`, seed 0: unmirrored <difference and interval>, mirrored <difference and interval>; <one sentence: how much narrower>. 4000 mirrored games of `rule-based` against `rule-based-v1` (identical behaviour): <the exact output line>. Because identical bots give exactly zero in mirrored mode, the control checks the pairing (same deal, sides swapped) rather than the size of the noise; the width on `random` is the practical measure.
```

Fill every `<…>` with the real output; no placeholders may remain.

- [ ] **Step 6: Final checks and commit**

Run: `npx jest --selectProjects bots sim app` and `npm run typecheck:server`
Expected: PASS, no type errors.

```bash
git add projects/sim/src/cli.ts docs/architecture/bots-and-simulation.md docs/superpowers/specs/2026-10-15-bot-improvement-roadmap-design.md
git commit -m "feat(sim): mirrored is the CLI default; Stage 0 results

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
