// Runs the Angular dev server. Started by `npm start` under Node's watch mode
// (see package.json), which restarts this script — and so the dev server —
// whenever a file the dev server only reads at start-up changes: angular.json,
// the tsconfig files, package.json. Source, content data and asset edits don't
// need this: the dev server already rebuilds and reloads the page for those.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The Angular CLI itself (not through npx), so stopping it really stops it.
const ng = fileURLToPath(new URL('../node_modules/@angular/cli/bin/ng.js', import.meta.url));
const child = spawn(process.execPath, [ng, 'serve', ...process.argv.slice(2)], { stdio: 'inherit' });

// Node's watch mode stops this process before restarting it. Take the dev
// server down with it, and wait until it is gone so its port is free for the
// next start (a hard stop after 5 s if it hangs).
let stopping = false;
const stopThenExit = () => {
  if (stopping) return;
  stopping = true;
  if (child.exitCode !== null) process.exit(0);
  child.once('exit', () => process.exit(0));
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 5000).unref();
};
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, stopThenExit);
child.on('exit', (code) => {
  if (!stopping) process.exit(code ?? 0);
});
