# CI and agent guardrails design

Date: 2026-10-28. Status: draft for review.

> **Revised 2026-10-28.** The owner dropped the local gate: opening a pull request
> is no longer blocked by a hook, and CI is a single `verify` job (plus `test-db`)
> instead of one job per check. Where the text below describes the "local gate",
> the `PreToolUse` hook or per-check jobs, it was built, reviewed and then removed
> in this revision. The deny rules, `npm run verify` and the `test-db` job stand.

## Intent

Today nothing checks a change before it merges. There is no CI, no project
`.claude/` setup, and `docs/` records no pre-merge routine. The owner works
alone, with Claude Code doing most of the changes, and wants more checks
between "the agent finished" and "a human merges". The merge itself stays a
human act, always.

## Goals

- One command, `npm run verify`, that runs every pre-merge check in a fixed
  order and fails if any fails. Locally and in CI it is the same command, so
  the two cannot drift.
- A GitHub Actions workflow that runs those checks on every pull request to
  `main`, with each check visible as its own job.
- A local gate: Claude Code cannot open a pull request until `verify` passes.
- Claude Code cannot merge a pull request or push to `main`.

## Non-goals

- No deployment automation. Render deploys as it does today
  (`docs/deployment.md`).
- No separate CI agent, no PR-review bot, no auto-fix of failures.
- No dependency updates, release tagging or changelog automation.
- No GitHub-side merge blocking. The repository is private on a free plan, so
  branch protection and required status checks are unavailable (the API
  returns HTTP 403). The checks report pass or fail; they cannot disable the
  merge button.

## Anti-goals

- Anything that lets the agent merge, directly or by another route, even if
  every check is green.
- A gate so slow or flaky that the owner starts bypassing it.
- Checks that only run in CI, so that a failure is first seen after the PR is
  open.

## Decisions made with the owner

- **Checks:** build, typecheck, lint and tests.
- **Where they run:** both a local gate and GitHub Actions.
- **Merge:** always human. Enforced by Claude Code permissions, not by a
  sentence in `CLAUDE.md`.
- **Lint:** ESLint is installed and the codebase is clean (PR #19). `npm run
  lint` exists.
- **Audience:** the owner only.

## Design

### `npm run verify`

Runs, in this order, stopping at the first failure:

1. `lint`
2. typecheck
3. build
4. test

Cheap checks go first so a typo fails in seconds, not after the 70-second
test run.

**Typecheck** covers every project, not only the server. Today only
`typecheck:server` exists (protocol and server). `verify` adds bots, sim, the
app (`tsconfig.app.json`) and the specs, so a type error in a spec file is
caught too. The engine and content libraries are typechecked by their
`ng build`. The exact `tsc` invocations are left to the builder.

**Build** is `npm run build` (engine and content) plus `ng build app`, which
the Dockerfile also runs. The build's CSS budget warning (see Known issues) is
not a failure.

**Test** is `npm test`.

`test:db` (needs Postgres on port 5433) is not part of the local `verify`. CI
runs it as a separate job with a Postgres service container.

### GitHub Actions

One workflow, `.github/workflows/ci.yml`, triggered on pull requests to
`main` and on pushes to `main`. Jobs: lint, typecheck, build, test, and
test-db. Each job installs with `npm ci` and calls the matching npm script
rather than repeating commands, so a script change is made in one place.
Node version 24, matching the Dockerfile. The npm cache is enabled. Read-only
`contents` permission only.

CI needs no secrets. The workflow must not hold a token able to merge.

### Local gate

A project `PreToolUse` hook on the Bash tool. When the command is `gh pr
create`, the hook runs `npm run verify` and blocks the call if it fails, so
the agent sees the failing output and fixes it before a PR exists. The hook
script lives in `.claude/hooks/`, is committed, and is small and readable.

### Merge guardrails

In the committed project `.claude/settings.json`, deny rules for: `gh pr
merge`, `gh api` calls that merge, `git push` to `main`, and `git push
--force`. The owner merges in the GitHub UI or in their own terminal.

These deny rules stop the agent's ordinary paths. They are not a security
boundary: the `gh` login has the `repo` scope with admin rights, so anything
that bypasses Claude Code's permission check could still merge. The design
accepts that and says so in the docs; it does not try to restrict the token.

### Documentation

A short `docs/` page, linked from `docs/architecture/README.md`, saying how to
run `verify`, what CI checks, and the merge rule. `CLAUDE.md` gets one line
pointing at it. The user's global `~/.claude/settings.json` is not touched.

## Known issues the builder should handle or flag

- Spec files had 31 type errors across engine, bots, content, sim and app
  (Jest does not typecheck). They were fixed in PR #20 before this work, so
  the typecheck check starts green and covers specs.
- One full `npx jest` run during the lint cleanup had a single failure that
  did not reproduce in the next three runs. It was not captured. Expect CI to
  expose it; treat a repeat as a real flaky test to fix, not a reason to add
  retries.
- `ng build app` warns that `judgment-stage.ts` exceeds its 4 kB CSS budget
  (4.99 kB). Leave the budget alone; it is not part of this work.

## Left to the builder

- The exact `tsc` commands and their order inside `verify`.
- Script and hook file names and layout.
- How the hook reads the command from its input and how it reports failures.
- The exact deny-rule patterns, as long as the merge routes above are covered
  and the owner can still commit and push feature branches.
- Whether `verify` is a plain npm script chain or a small Node script.
- Caching and concurrency settings in the workflow.

## Details settled after the builder check

- **Hook matching:** the hook inspects the whole Bash command string and
  matches `gh pr create` anywhere in it, so `git push && gh pr create`,
  `cd x && gh pr create` and `--web` are all gated. Deny rules cover
  `git push` to `main` in every spelling (`origin main`, `HEAD:main`,
  `HEAD:refs/heads/main`), `git push` with `-f`, `--force` or
  `--force-with-lease`, `gh pr merge`, and `gh api` merge calls in both the
  REST form (`.../pulls/N/merge`) and the GraphQL `mergePullRequest` form.
  Tests for the hook and the patterns are part of the work.
- **Hook runtime:** the hook runs the full `verify` (roughly two to three
  minutes) with its timeout set explicitly to ten minutes. It fails closed: a
  timeout or crash blocks the PR. There is no faster mode; the gate is only
  worth having if it is the same check CI runs.
- **Libraries need no build step before app checks.** `tsconfig.json` `paths`
  and the jest `moduleNameMapper` entries point at each project's `src`, so
  typecheck and tests read source. Every CI job therefore runs on its own
  after `npm ci`, with no job dependencies.
- **`test-db` job:** the specs read `TEST_DATABASE_URL` as an admin URL and
  the server's own `migrate.ts` migrations create the schema, so the job needs
  only a `postgres:17` service container (user and password `sanguosha`) and
  `TEST_DATABASE_URL` pointing at it. The local `5433` port is a docker-compose
  detail; CI uses whatever port the service container maps.
- **Scope and order of the work:** the spec type errors are already fixed
  (PR #20). The flaky test is not hunted before CI lands; CI will show
  whether it repeats. The CSS budget is left alone.
- **Permissions layout:** the committed project `.claude/settings.json` holds
  the deny rules. Deny beats any allow in the owner's global settings, so
  the global file does not need checking. `.claude/settings.local.json` is
  gitignored.

## Calls I made (not the owner's)

- `verify` order is lint, typecheck, build, test.
- Node 24 in CI.
- `test:db` runs in CI only, never in local `verify`.
- The hook triggers on `gh pr create` only, not on every commit or push.
- Deny rules live in the project `.claude/settings.json`, committed.
- No retries on flaky tests.
- The hook fails closed and uses the full `verify`, with a ten-minute timeout.
- The hook matches `gh pr create` anywhere in a compound command.
- The flaky test is left for CI to expose.
