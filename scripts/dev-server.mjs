// Runs the Angular dev server and the API server together. Started by
// `npm start` under Node's watch mode (see package.json), which restarts this
// script — and so both servers — whenever a file the dev server only reads at
// start-up changes: angular.json, the tsconfig files, package.json. Source,
// content data and asset edits don't need this: the dev server already
// rebuilds and reloads the page for those, and the API server (tsx watch)
// restarts itself when its own source changes.
//
// `npm run web` runs the Angular dev server alone. The API server reads .env
// when it exists (see .env.example); without it, it uses an in-memory store.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const path = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const withApi = !process.argv.includes('--web-only');
const ngArgs = process.argv.slice(2).filter((arg) => arg !== '--web-only');

// The Angular CLI itself (not through npx), so stopping it really stops it.
const ng = spawn(process.execPath, [path('../node_modules/@angular/cli/bin/ng.js'), 'serve', ...ngArgs], { stdio: 'inherit' });
// The same command as `npm run server`, run directly for the same reason.
const api = withApi
  ? spawn(process.execPath, [path('../node_modules/tsx/dist/cli.mjs'), 'watch', '--tsconfig', 'projects/server/tsconfig.json', 'projects/server/src/main.ts'], {
      stdio: 'inherit',
      cwd: path('..'),
    })
  : null;

// Node's watch mode stops this process before restarting it. Take both servers
// down with it, and wait until they are gone so their ports are free for the
// next start (a hard stop after 5 s if one hangs).
let stopping = false;
const children = [ng, api].filter(Boolean);
const stopThenExit = () => {
  if (stopping) return;
  stopping = true;
  const running = children.filter((child) => child.exitCode === null && child.signalCode === null);
  if (running.length === 0) process.exit(0);
  let left = running.length;
  for (const child of running) {
    child.once('exit', () => {
      if (--left === 0) process.exit(0);
    });
    child.kill('SIGTERM');
  }
  setTimeout(() => running.forEach((child) => child.kill('SIGKILL')), 5000).unref();
};
for (const signal of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(signal, stopThenExit);

// Without the Angular dev server there is nothing to look at: stop everything.
ng.on('exit', (code) => {
  if (!stopping) {
    process.exitCode = code ?? 0;
    stopThenExit();
  }
});
// The API dying (a taken port, a bad .env) leaves the Angular server running, so
// the screens that need no server still work.
api?.on('exit', (code) => {
  if (!stopping) console.error(`\n[dev] The API server stopped (exit ${code ?? 'signal'}). The Angular dev server is still running; sign-in and online play need the API. Fix the cause, then restart with npm start.\n`);
});
