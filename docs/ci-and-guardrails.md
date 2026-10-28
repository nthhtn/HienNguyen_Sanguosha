# CI and guardrails

How a change is checked before it merges, and what the agent may not do. The
design and its reasoning are in
`docs/superpowers/specs/2026-10-28-ci-and-agent-guardrails-design.md`.

## `npm run verify`

One command runs every pre-merge check, in this order, and stops at the first
failure:

1. `npm run lint`: ESLint (typescript-eslint and angular-eslint).
2. `npm run typecheck`: `tsc --noEmit` over protocol, server, bots, sim, the
   app, and the spec files of the app, engine and content. Jest does not
   typecheck, so this is the only thing that catches a type error in a spec.
3. `npm run build`: engine, content and the Angular app. The CSS budget warning
   on `judgment-stage.ts` is a warning, not a failure.
4. `npm test`: jest across all projects.
5. `npm run test:guardrails`: the tests for the hook and the deny rules below
   (`node --test`).

Cheap checks come first, so a typo fails in seconds, not after the test run.
`npm run test:db` (needs Postgres, `npm run db:up`) is not part of `verify`;
CI runs it.

## GitHub Actions

`.github/workflows/ci.yml` runs on every pull request to `main` and on pushes to
`main`. Five independent jobs, each calling the matching npm script: `lint`,
`typecheck`, `build`, `test` (also runs `test:guardrails`) and `test-db` (a
`postgres:17` service container, then `npx jest --selectProjects server`). It
needs no secrets and has read-only `contents` permission.

The repository is private on a free plan, so GitHub cannot make these checks
required and cannot disable the merge button. They report pass or fail; the
owner reads them before merging.

## The local gate

A `PreToolUse` hook (`.claude/hooks/pr-gate.mjs`, registered in
`.claude/settings.json` and found through `$CLAUDE_PROJECT_DIR`, so it works from
any directory) runs `npm run verify` whenever a Bash command creates a pull
request: `gh pr create` anywhere in the command (after `&&`, inside `$(...)`,
behind `FOO=1` or `env`, or via a full path to `gh`), or a `gh api` write to
`/pulls`. If `verify` fails, times out (after nine minutes, just under the hook's
own ten) or crashes, the call is blocked and the failing output is shown, so the
agent fixes it before a PR exists. Expect two to three minutes. The gate errs
towards matching: a command that merely mentions the PR command, in a commit
message for example, also runs `verify`. Other commands are not delayed.

## Merging is human-only

`.claude/settings.json` denies, for Claude Code:

- `gh pr merge` in any form, and `gh api` calls that merge, touch `refs/heads/main`
  or `git/refs`, write `contents`, or use `graphql`;
- `git push` to `main` in any spelling (`origin main`, `HEAD:main`,
  `HEAD:refs/heads/main`, `+main`, with options before or after), also behind
  `git -C dir` or `git -c k=v`;
- any force push (`-f`, `--force`, `--force-with-lease`, `+refspec`);
- `git push` with no branch named (`git push`, `git push origin`,
  `git push origin HEAD`) and `--all`, `--mirror` and `--tags`, because they push
  whatever branch is checked out, which could be `main`. Push a feature branch
  with `git push -u origin <branch>`.

Feature branches whose name merely contains "main" are not affected. You merge in
the GitHub UI or in your own terminal.

These rules stop the agent's ordinary routes. They are not a security boundary:
the `gh` login has the `repo` scope with admin rights, so anything that bypasses
Claude Code's permission check could still merge. One route is open on purpose:
nothing stops the agent editing `.claude/settings.json` or the hook itself.
Review changes to `.claude/` like any other change.

`.claude/settings.local.json` is gitignored, for per-machine settings.
