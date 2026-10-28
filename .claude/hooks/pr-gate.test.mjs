import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { needsGate, runGate, repoRoot, VERIFY_TIMEOUT_MS } from './pr-gate.mjs';

const input = (command) => JSON.stringify({ tool_input: { command } });
const neverCalled = () => assert.fail('verify must not run');

for (const command of [
  'gh pr create',
  'gh pr create --web',
  'git push -u origin x && gh pr create --title y',
  'cd projects && gh pr create',
  'npm test; gh pr create',
  'URL=$(gh pr create --fill)',
  'echo $(gh pr create)',
  '(gh pr create)',
  'sleep 1 & gh pr create',
  'if true; then gh pr create; fi',
  'FOO=1 gh pr create',
  'env gh pr create',
  'time gh pr create',
  'sh -c "gh pr create"',
  '/opt/homebrew/bin/gh pr create',
  'gh pr -R o/r create',
  'gh api repos/o/r/pulls -f title=x -f head=y -f base=main',
  'gh api -X POST repos/o/r/pulls --input pr.json',
]) {
  test(`gates: ${command}`, () => assert.equal(needsGate(command), true));
}

for (const command of ['gh api repos/o/r/pulls/20', 'gh api repos/o/r/pulls', 'gh pr comment 5 --body hi', 'gh pr view 20', 'gh pr list', 'gh pr merge 20', 'npm run verify', 'echo done']) {
  test(`does not gate: ${command}`, () => assert.equal(needsGate(command), false));
}

test('a command that is not a PR creation never runs verify and passes', () => {
  assert.equal(runGate(input('npm test'), neverCalled).code, 0);
});

test('a PR creation passes when verify passes', () => {
  assert.equal(runGate(input('gh pr create'), () => ({ status: 0, output: 'ok' })).code, 0);
});

test('a PR creation is blocked when verify fails, with its output', () => {
  const result = runGate(input('gh pr create'), () => ({ status: 1, output: 'lint failed' }));
  assert.equal(result.code, 2);
  assert.match(result.message, /lint failed/);
});

test('a PR creation is blocked when verify throws (timeout or crash)', () => {
  const result = runGate(input('gh pr create'), () => { throw new Error('ETIMEDOUT'); });
  assert.equal(result.code, 2);
  assert.match(result.message, /ETIMEDOUT/);
});

test('unreadable hook input passes with a warning instead of blocking every call', () => {
  const result = runGate('not json', neverCalled);
  assert.equal(result.code, 0);
  assert.match(result.message, /unreadable/i);
});

test('verify runs from the repo root, whatever the current directory', () => {
  const scripts = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).scripts;
  assert.ok(existsSync(join(repoRoot, '.claude', 'hooks', 'pr-gate.mjs')));
  assert.ok(scripts.verify);
});

test('verify times out before the harness kills the hook, so a timeout blocks', () => {
  const settings = JSON.parse(readFileSync(join(repoRoot, '.claude', 'settings.json'), 'utf8'));
  const hookSeconds = settings.hooks.PreToolUse[0].hooks[0].timeout;
  assert.ok(VERIFY_TIMEOUT_MS < hookSeconds * 1000);
});
