import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const settings = JSON.parse(readFileSync(new URL('./settings.json', import.meta.url), 'utf8'));
const rules = settings.permissions?.deny ?? [];

// A rule is `Bash(<pattern>)`; `*` matches any run of characters, the rest is literal.
export function denied(command, denyRules) {
  return denyRules.some((rule) => {
    const m = /^Bash\((.*)\)$/.exec(rule);
    if (!m) return false;
    const source = m[1].split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(`^${source}$`, 's').test(command);
  });
}

const shouldDeny = [
  'gh pr merge 20',
  'gh pr merge',
  'gh pr merge --squash --auto 20',
  'gh api -X PUT repos/o/r/pulls/20/merge',
  `gh api graphql -f query='mutation { mergePullRequest(input: {pullRequestId: "x"}) { clientMutationId } }'`,
  'git push origin main',
  'git push origin HEAD:main',
  'git push origin HEAD:refs/heads/main',
  'git push origin +main',
  'git push -f origin feat/x',
  'git push --force origin feat/x',
  'git push --force-with-lease origin feat/x',
];
const shouldAllow = [
  'git push -u origin feat/maintenance',
  'git push origin chore/ci-and-agent-guardrails',
  'gh pr create --title x',
  'gh pr view 20',
  'gh pr list',
  'npm test',
];

for (const command of shouldDeny) {
  test(`denies: ${command}`, () => assert.equal(denied(command, rules), true));
}
for (const command of shouldAllow) {
  test(`allows: ${command}`, () => assert.equal(denied(command, rules), false));
}
