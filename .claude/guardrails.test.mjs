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
  'git push origin main --no-verify',
  'git push origin main -u',
  'git push origin HEAD:main --follow-tags',
  'git push origin refs/heads/main',
  'git push origin HEAD:heads/main',
  'git -C . push origin main',
  'git -c k=v push origin main',
  'git --git-dir=.git push origin main',
  'git push',
  'git push origin',
  'git push origin HEAD',
  'git push --all',
  'git push --mirror',
  'git push --tags',
  'git push origin +feat/x',
  'git push +main',
  'gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc',
  'gh api -X PUT repos/o/r/contents/f -f branch=main',
  'gh api graphql -F query=@m.graphql',
  `gh api graphql -f query='mutation { enablePullRequestAutoMerge(input: {}) { clientMutationId } }'`,
  'gh pr -R o/r merge 20',
];
const shouldAllow = [
  'git push -u origin feat/maintenance',
  'git push origin chore/ci-and-agent-guardrails',
  'gh pr create --title x',
  'gh pr view 20',
  'gh pr list',
  'npm test',
  'git push -u origin feat/x',
  'git push -u origin feat/x --follow-tags',
  'git -C . push -u origin feat/x',
  'gh api repos/o/r/pulls/20',
  'gh api repos/o/r/branches/main/protection',
  'gh pr create --title x --body "ready to merge once green"',
  'gh pr comment 5 --body "please merge soon"',
  'git commit -m "Deny push to main for the agent"',
  'git commit -m "push main to staging is not a thing"',
];

for (const command of shouldDeny) {
  test(`denies: ${command}`, () => assert.equal(denied(command, rules), true));
}
for (const command of shouldAllow) {
  test(`allows: ${command}`, () => assert.equal(denied(command, rules), false));
}

test('the PR gate hook is found from any working directory', () => {
  const hook = settings.hooks.PreToolUse[0].hooks[0];
  assert.match(hook.command, /\$CLAUDE_PROJECT_DIR/);
});
