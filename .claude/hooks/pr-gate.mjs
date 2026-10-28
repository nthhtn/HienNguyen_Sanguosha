// PreToolUse hook for the Bash tool: `gh pr create` runs `npm run verify` first.
// Exit 2 blocks the call and shows stderr to the agent; exit 0 lets it through.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Shorter than the hook's own timeout in settings.json (600 s), so a slow verify is
// reported as a failure (exit 2) by us before the harness kills the hook (a non-blocking error).
export const VERIFY_TIMEOUT_MS = 540 * 1000;
// verify must run from here, whatever directory the agent's shell is in.
export const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const PR_CREATE = /(^|[^\w.-])gh(\s+-\S+)*\s+pr\s+(-\S+\s+\S+\s+)*create\b/;
const API_CALL = /(^|[^\w.-])gh\s+api\b/;
const API_PULLS = /\/pulls(\s|$|\?)/;
const API_WRITES = /(\s-[fF]\b|--(raw-)?field\b|(-X|--method)[ =]?POST\b)/;

// True when the command line creates a pull request anywhere in it: `gh pr create` (in a
// compound command, a $(...) capture, behind env vars or a full path to gh) or a `gh api` write to /pulls.
// Over-matching only costs a verify run, so this errs on the side of gating.
export function needsGate(command) {
  if (PR_CREATE.test(command)) return true;
  return API_CALL.test(command) && API_PULLS.test(command) && API_WRITES.test(command);
}

// `input` is the raw JSON the harness writes to stdin; `verify` runs the checks.
export function runGate(input, verify) {
  let command;
  try {
    command = JSON.parse(input).tool_input.command;
  } catch {
    return { code: 0, message: 'pr-gate: hook input unreadable, not gating this call' };
  }
  if (typeof command !== 'string' || !needsGate(command)) return { code: 0, message: '' };
  try {
    const { status, output } = verify();
    if (status === 0) return { code: 0, message: '' };
    return { code: 2, message: `npm run verify failed, so the PR was not created. Fix it and try again.\n\n${output}` };
  } catch (error) {
    return { code: 2, message: `npm run verify could not finish (${error.message}), so the PR was not created.` };
  }
}

function verifyWithNpm() {
  const run = spawnSync('npm', ['run', 'verify'], { encoding: 'utf8', timeout: VERIFY_TIMEOUT_MS, killSignal: 'SIGKILL', cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 });
  if (run.error) throw run.error;
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  return { status: run.status ?? 1, output: output.length > 8000 ? `…${output.slice(-8000)}` : output };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { code, message } = runGate(readFileSync(0, 'utf8'), verifyWithNpm);
  if (message) process.stderr.write(`${message}\n`);
  process.exit(code);
}
