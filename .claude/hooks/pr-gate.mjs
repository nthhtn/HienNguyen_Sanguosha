// PreToolUse hook for the Bash tool: `gh pr create` runs `npm run verify` first.
// Exit 2 blocks the call and shows stderr to the agent; exit 0 lets it through.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TEN_MINUTES = 10 * 60 * 1000;

// True when `gh pr create` is one of the commands in a compound command line.
export function needsGate(command) {
  return command
    .split(/&&|\|\||;|\||\n/)
    .some((part) => /^gh\s+pr\s+create(\s|$)/.test(part.trim()));
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
  const run = spawnSync('npm', ['run', 'verify'], { encoding: 'utf8', timeout: TEN_MINUTES, maxBuffer: 64 * 1024 * 1024 });
  if (run.error) throw run.error;
  const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
  return { status: run.status ?? 1, output: output.length > 8000 ? `…${output.slice(-8000)}` : output };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { code, message } = runGate(readFileSync(0, 'utf8'), verifyWithNpm);
  if (message) process.stderr.write(`${message}\n`);
  process.exit(code);
}
