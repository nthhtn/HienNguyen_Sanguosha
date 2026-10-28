import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsGate, runGate } from './pr-gate.mjs';

const input = (command) => JSON.stringify({ tool_input: { command } });
const neverCalled = () => assert.fail('verify must not run');

for (const command of [
  'gh pr create',
  'gh pr create --web',
  'git push -u origin x && gh pr create --title y',
  'cd projects && gh pr create',
  'npm test; gh pr create',
]) {
  test(`gates: ${command}`, () => assert.equal(needsGate(command), true));
}

for (const command of ['gh pr view 20', 'gh pr list', 'gh pr merge 20', 'npm run verify', 'echo done']) {
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
