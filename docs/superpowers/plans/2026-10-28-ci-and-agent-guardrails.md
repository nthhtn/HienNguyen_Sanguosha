# CI and Agent Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One `npm run verify` that runs lint, typecheck, build and tests; a GitHub Actions workflow that runs the same checks on every PR; a Claude Code hook that blocks `gh pr create` until `verify` passes; and deny rules so the agent can never merge or push to `main`.

**Architecture:** `verify` is a chain of existing npm scripts, so CI and the local gate call the same thing. The gate is a `PreToolUse` hook on the Bash tool, written as a small Node module with a pure matcher function that is unit-tested with `node --test`. Merge protection is deny rules in the committed project `.claude/settings.json`, with a test that checks sample commands against those rules.

**Tech Stack:** npm scripts, Node 24 (`node:test`), GitHub Actions, Claude Code hooks and permissions.

**Spec:** `docs/superpowers/specs/2026-10-28-ci-and-agent-guardrails-design.md`

## Global Constraints

- The merge is always a human act. Nothing in this work may let the agent merge, directly or by another route.
- `verify` order: lint, typecheck, build, test; it stops at the first failure.
- CI and the hook call npm scripts; they do not repeat the commands.
- Node 24 in CI, matching the Dockerfile. `npm ci` for installs.
- CI needs no secrets and holds read-only `contents` permission.
- The repo is private on a free plan: branch protection is unavailable, so checks report but cannot block the merge button.
- `test:db` runs in CI only (a `postgres:17` service container, user and password `sanguosha`, `TEST_DATABASE_URL` as the admin URL). It is never part of local `verify`.
- The hook runs the full `verify`, timeout ten minutes, and fails closed.
- Do not touch `~/.claude/settings.json`. `.claude/settings.local.json` is gitignored.
- Leave the `judgment-stage.ts` CSS budget warning alone. Add no test retries.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A compound command (`git push -u origin x && gh pr create --web`, `cd x && gh pr create`) must still trigger the gate.
- An unrelated Bash command (`npm test`, `gh pr view 20`, `gh pr list`) must not trigger the gate or be denied.
- Pushing a feature branch whose name contains `main` (`feat/maintenance`) must stay allowed, while `origin main`, `HEAD:main`, `HEAD:refs/heads/main`, `+main`, `-f`, `--force` and `--force-with-lease` are denied.
- A failing or timed-out `verify` must block (exit 2) with the failing output on stderr; a passing one must exit 0 and print nothing that confuses the agent.
- Hook input that cannot be parsed as JSON must not block every Bash call: it exits 0 with a warning on stderr (a call we cannot identify as a PR creation is not gated).

---

### Task 1: `typecheck` and `verify` scripts

**Files:**
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `npm run typecheck`, `npm run build:app`, `npm run verify`. Later tasks and the workflow call these names.

- [ ] **Step 1: Replace `typecheck:server` with `typecheck`.** It runs `tsc -p <project> --noEmit` for these tsconfigs, chained with `&&`: `projects/protocol/tsconfig.json`, `projects/server/tsconfig.json`, `projects/bots/tsconfig.json`, `projects/sim/tsconfig.json`, `projects/app/tsconfig.app.json`, `projects/app/tsconfig.spec.json`, `projects/engine/tsconfig.spec.json`, `projects/content/tsconfig.spec.json`. Keep `typecheck:server` as is if anything references it (grep first, including `docs/`); otherwise remove it.
- [ ] **Step 2: Add `build:app`** as `ng build app`, and make `build` run `build:engine`, `build:content` then `build:app`.
- [ ] **Step 3: Add `verify`** as `npm run lint && npm run typecheck && npm run build && npm test`.
- [ ] **Step 4: Run `npm run typecheck`.** Expected: exit 0, no errors.
- [ ] **Step 5: Run `npm run verify`.** Expected: exit 0; lint clean, build prints the existing `judgment-stage.ts` budget warning only, jest ends with `Tests: 51 skipped, 4189 passed` (the count may differ by a few if `main` has moved).
- [ ] **Step 6: Break something on purpose, confirm `verify` stops early, then undo.** Add `const x: number = 'a';` to a spec file, run `npm run verify`, expect it to fail at the `typecheck` step before the build starts, then `git checkout` the file.
- [ ] **Step 7: Commit** `package.json` as "Add typecheck and verify scripts".

### Task 2: Merge deny rules and their test

**Files:**
- Create: `.claude/settings.json`
- Create: `.claude/guardrails.test.mjs`
- Modify: `package.json` (add `test:guardrails`), `.gitignore` (add `.claude/settings.local.json` if absent)

**Interfaces:**
- Produces: `npm run test:guardrails` (`node --test .claude`), which Task 3's tests also join. The settings file's `permissions.deny` array, read by the test.
- Produces: in the test file, `denied(command: string, rules: string[]): boolean` that turns each `Bash(<pattern>)` rule into a regex where `*` matches any characters and the rest is literal, and returns true if any rule matches the whole command.

- [ ] **Step 1: Write the failing test** `.claude/guardrails.test.mjs` using `node:test` and `node:assert`. It loads `.claude/settings.json`, reads `permissions.deny`, and asserts `denied(cmd)` is true for: `gh pr merge 20`, `gh pr merge`, `gh pr merge --squash --auto 20`, `gh api -X PUT repos/o/r/pulls/20/merge`, `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`, `git push origin main`, `git push origin HEAD:main`, `git push origin HEAD:refs/heads/main`, `git push origin +main`, `git push -f origin feat/x`, `git push --force origin feat/x`, `git push --force-with-lease origin feat/x`. It asserts false for: `git push -u origin feat/maintenance`, `git push origin chore/ci-and-agent-guardrails`, `gh pr create --title x`, `gh pr view 20`, `gh pr list`, `npm test`.
- [ ] **Step 2: Add `"test:guardrails": "node --test .claude"` to `package.json`.** Run `npm run test:guardrails`. Expected: FAIL (settings file missing).
- [ ] **Step 3: Create `.claude/settings.json`** with `permissions.deny` holding these rules: `Bash(gh pr merge)`, `Bash(gh pr merge *)`, `Bash(gh api *merge*)`, `Bash(git push * main)`, `Bash(git push main)`, `Bash(git push *:main)`, `Bash(git push *:refs/heads/main)`, `Bash(git push * +main)`, `Bash(git push -f*)`, `Bash(git push * -f*)`, `Bash(git push --force*)`, `Bash(git push * --force*)`. Pattern note: `*main*` is deliberately not used, so `feat/maintenance` stays allowed.
- [ ] **Step 4: Run `npm run test:guardrails`.** Expected: PASS.
- [ ] **Step 5: Add `.claude/settings.local.json` to `.gitignore`** if it is not already ignored.
- [ ] **Step 6: Manual check in a real session.** Start Claude Code in the repo, ask it to run `gh pr merge --help`, and confirm the permission check denies it. Note the result in the commit message body. If Claude Code's own matching differs from the test's glob approximation for any listed command, fix the rule and the test together.
- [ ] **Step 7: Commit** `.claude/settings.json`, `.claude/guardrails.test.mjs`, `package.json`, `.gitignore` as "Deny merge and push-to-main for the agent".

### Task 3: PR gate hook

**Files:**
- Create: `.claude/hooks/pr-gate.mjs`
- Create: `.claude/hooks/pr-gate.test.mjs`
- Modify: `.claude/settings.json` (add `hooks`)

**Interfaces:**
- Produces in `pr-gate.mjs`: `export function needsGate(command: string): boolean` (true when `gh pr create` appears as a command anywhere in the string, including after `&&`, `;`, `||`, `|` or `cd x &&`); `export function runGate(input: string, verify: () => { status: number; output: string }): { code: 0 | 2; message: string }`, where `input` is the raw stdin JSON (`{ tool_input: { command } }`), and a `verify` result with non-zero status gives code 2 and a message containing the output. When run as a script (not imported), it reads stdin, calls `runGate` with a `verify` that spawns `npm run verify` synchronously with a ten-minute timeout, writes the message to stderr and exits with the code.
- Consumes: `npm run verify` from Task 1.

- [ ] **Step 1: Write the failing tests** in `pr-gate.test.mjs`. `needsGate` is true for: `gh pr create`, `gh pr create --web`, `git push -u origin x && gh pr create --title y`, `cd projects && gh pr create`, `npm test; gh pr create`. It is false for: `gh pr view 20`, `gh pr list`, `gh pr merge 20`, `npm run verify`, `echo done`. `runGate` cases: non-matching command, `verify` never called, code 0; matching command with `verify` returning status 0, code 0; matching command with status 1 and output `lint failed`, code 2 and the message includes `lint failed`; matching command where `verify` throws (timeout or crash), code 2; input that is not valid JSON, code 0 and a message saying the input was unreadable.
- [ ] **Step 2: Run `npm run test:guardrails`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `pr-gate.mjs`.** For `needsGate`, split the command on `&&`, `||`, `;`, `|` and newlines, trim each part, and test each against `/^gh\s+pr\s+create(\s|$)/`. The script entry point only runs when the file is the main module.
- [ ] **Step 4: Run `npm run test:guardrails`.** Expected: PASS, including Task 2's tests.
- [ ] **Step 5: Register the hook** in `.claude/settings.json`: `hooks.PreToolUse` with matcher `Bash` and one `command` hook running `node .claude/hooks/pr-gate.mjs` with `timeout` 600.
- [ ] **Step 6: Manual check in a real session.** Ask Claude Code to run `gh pr create --title test --body test` on a branch where `verify` fails (introduce a lint error, do not commit it). Expected: the call is blocked and the lint output is shown. Then fix it and confirm `verify` passes and the PR creation proceeds (use `--draft` and close the PR afterwards). Also confirm `gh pr view 20` is not delayed.
- [ ] **Step 7: Add `test:guardrails` to the end of `verify`'s chain** in `package.json` (after `npm test`), and run `npm run verify`. Expected: exit 0.
- [ ] **Step 8: Commit** the hook files, settings and `package.json` as "Gate gh pr create on npm run verify".

### Task 4: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm run lint`, `typecheck`, `build`, `test`, `test:guardrails`, `test:db` (the last reads `TEST_DATABASE_URL`; the script already sets one for port 5433, so the job runs `npx jest --selectProjects server` itself with the service container's URL).

- [ ] **Step 1: Create the workflow.** Triggers: `pull_request` to `main`, and `push` to `main`. Top-level `permissions: contents: read`. A `concurrency` group per ref with `cancel-in-progress: true`. Six independent jobs on `ubuntu-latest`, each doing checkout, `actions/setup-node` with Node 24 and `cache: npm`, `npm ci`, then its script: `lint`, `typecheck`, `build`, `test` (runs `npm test` and `npm run test:guardrails`), and `test-db`. `test-db` adds a `postgres:17` service (user and password `sanguosha`, health check on `pg_isready`, port mapped to the host) and runs `npx jest --selectProjects server` with `TEST_DATABASE_URL=postgres://sanguosha:sanguosha@localhost:<mapped port>/postgres`.
- [ ] **Step 2: Validate the YAML** with `npx --yes yaml-lint .github/workflows/ci.yml` (or `actionlint` if available). Expected: no errors.
- [ ] **Step 3: Check the `test-db` command locally** with `npm run db:up` then `TEST_DATABASE_URL=postgres://sanguosha:sanguosha@localhost:5433/postgres npx jest --selectProjects server`. Expected: pass. Then `npm run db:down`.
- [ ] **Step 4: Commit** the workflow as "Run the checks in GitHub Actions".
- [ ] **Step 5: Open the PR** for this branch and watch the workflow with `gh run watch`. Expected: all jobs green. If `test` or any job fails on the flaky test noted in the spec, record which test it was in the PR description and re-run once; do not add retries.

### Task 5: Documentation

**Files:**
- Create: `docs/ci-and-guardrails.md`
- Modify: `docs/architecture/README.md` (add a table row), `CLAUDE.md` (one line)

- [ ] **Step 1: Write `docs/ci-and-guardrails.md`** covering: what `npm run verify` runs and in what order; what CI runs (the six jobs) and that `test-db` is CI-only; the hook (what triggers it, that it fails closed, roughly 2 to 3 minutes); the deny rules and their limit (they stop the agent's ordinary routes, not a token with admin rights; the owner merges in the GitHub UI or own terminal); and that GitHub cannot block the merge button on this plan.
- [ ] **Step 2: Add a row** to the table in `docs/architecture/README.md`: `[CI and guardrails](../ci-and-guardrails.md)` with a "read it when you want to know…" cell about how changes are checked before merge and what the agent may not do.
- [ ] **Step 3: Add one line to `CLAUDE.md`** under the "Process" section pointing at `docs/ci-and-guardrails.md` and stating that `npm run verify` must pass before a PR and that merging is human-only.
- [ ] **Step 4: Run `npm run verify`.** Expected: exit 0.
- [ ] **Step 5: Commit** as "Document the CI checks and the agent guardrails".
