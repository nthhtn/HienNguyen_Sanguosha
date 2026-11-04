// Load test: many rooms of human players against a running server.
//
//   npx tsx --tsconfig projects/server/tsconfig.json scripts/load-test.ts \
//     --url http://localhost:8080 --rooms 10 --seats 7 --think-ms 1500 --container sgs-load
//
// Each player (the host registered, the rest guests) is on its own socket that plays with the rule-based bot's
// picks (the same `BotSeat` the server's socket tests use), after waiting
// `--think-ms` the way a person would. It reports how long the server took to
// acknowledge each move, how many games finished, and, with `--container`, the
// container's memory and CPU. The server needs TRUST_PROXY=1: every client sends
// its own X-Forwarded-For, so the per-IP sign-up limit does not stop the test.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildContentRegistry } from 'content';
import { PROTOCOL_VERSION } from 'protocol';
import { BotSeat, TestClient } from '../projects/server/src/socket/testClient';

const run = promisify(execFile);

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

const BASE = arg('url', 'http://localhost:8080').replace(/\/$/, '');
const ROOMS = Number(arg('rooms', '10'));
const SEATS = Number(arg('seats', '7'));
const THINK_MS = Number(arg('think-ms', '1500'));
const MAX_MINUTES = Number(arg('max-minutes', '15'));
const CONTAINER = arg('container', '');
const ORIGIN = new URL(BASE).origin;
const WS_URL = `${BASE.replace(/^http/, 'ws')}/api/ws`;
const registry = buildContentRegistry();

let fakeIp = 1;
const nextIp = () => `10.${(fakeIp >> 16) & 255}.${(fakeIp >> 8) & 255}.${fakeIp++ & 255}`;

async function api(path: string, body: object, cookie?: string): Promise<{ json: { id?: string }; cookie?: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': nextIp(), ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} answered ${res.status}: ${await res.text()}`);
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('sgs_session='));
  return { json: await res.json().catch(() => ({})), cookie: setCookie?.split(';')[0] };
}

const ackMs: number[] = [];
let errors = 0;
let resyncs = 0;
let finished = 0;
const bytes = { received: 0 };

// A client whose game.submit goes out after a think delay, timed from the moment it is sent.
function withThinkTime(client: TestClient): TestClient {
  const sentAt = new Map<string, number>();
  client.onMessage((message) => {
    bytes.received += 1;
    if (message.type === 'ack' && sentAt.has(message.reqId)) {
      ackMs.push(performance.now() - sentAt.get(message.reqId)!);
      sentAt.delete(message.reqId);
    } else if (message.type === 'error') errors += 1;
  });
  const wrapped = Object.create(client) as TestClient;
  wrapped.send = (message: object | string) => {
    const submit = typeof message === 'object' && (message as { type?: string }).type === 'game.submit';
    if (!submit) return client.send(message);
    const wait = THINK_MS * (0.5 + Math.random());
    setTimeout(() => {
      if (!client.isOpen) return;
      sentAt.set((message as { reqId: string }).reqId, performance.now());
      client.send(message);
    }, wait);
  };
  return wrapped;
}

async function playRoom(index: number): Promise<void> {
  const players: { cookie: string; name: string }[] = [];
  for (let seat = 0; seat < SEATS; seat++) {
    const name = `R${index}P${seat}`;
    // Only a registered player may host, so seat 0 signs up; the others join as guests.
    const { cookie } =
      seat === 0
        ? await api('/api/auth/signup', { email: `${name.toLowerCase()}-${Date.now()}@example.com`, password: 'secret-pass', displayName: name })
        : await api('/api/auth/guest', { displayName: name });
    players.push({ cookie: cookie!, name });
  }
  const host = players[0];
  const { json: room } = await api('/api/rooms', { seatCount: SEATS, rules: {}, displayName: host.name }, host.cookie);
  for (const player of players.slice(1)) await api(`/api/rooms/${room.id}/join`, { displayName: player.name }, player.cookie);

  const clients: TestClient[] = [];
  const seats: BotSeat[] = [];
  for (const player of players) {
    const client = await TestClient.open(WS_URL, { origin: ORIGIN, token: player.cookie.split('=')[1] });
    clients.push(client);
    seats.push(new BotSeat(withThinkTime(client), registry));
    client.send({ type: 'hello', protocolVersion: PROTOCOL_VERSION, roomId: room.id });
    await client.next('welcome', () => true, 15_000);
  }
  clients[0].send({ type: 'lobby.start', reqId: 'start' });
  await clients[0].next('ack', (m) => m.reqId === 'start', 15_000);
  const ended = await clients[0].next('room.updated', (m) => m.room.status === 'lobby' && m.room.lastGame !== null, MAX_MINUTES * 60_000);
  if (ended.room.lastGame?.outcome === 'finished') finished += 1;
  else console.log(`room ${index}: game ended as ${ended.room.lastGame?.outcome}`);
  resyncs += seats.reduce((sum, seat) => sum + seat.resyncs, 0);
  for (const client of clients) client.close();
}

async function sample(): Promise<string> {
  if (!CONTAINER) return '';
  try {
    const { stdout } = await run('docker', ['stats', '--no-stream', '--format', '{{.CPUPerc}} cpu, {{.MemUsage}}', CONTAINER]);
    return stdout.trim();
  } catch {
    return 'docker stats failed';
  }
}

function pct(values: number[], p: number): string {
  if (values.length === 0) return 'n/a';
  const sorted = [...values].sort((a, b) => a - b);
  return `${sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))].toFixed(0)} ms`;
}

async function main(): Promise<void> {
  console.log(`Load test: ${ROOMS} rooms x ${SEATS} players, think time ${THINK_MS} ms, against ${BASE}`);
  const started = Date.now();
  const timer = setInterval(async () => {
    const secs = Math.round((Date.now() - started) / 1000);
    console.log(`t=${secs}s moves acked=${ackMs.length} finished=${finished}/${ROOMS} errors=${errors} | ack p50 ${pct(ackMs, 50)} p95 ${pct(ackMs, 95)} | ${await sample()}`);
  }, 30_000);
  const results = await Promise.allSettled(Array.from({ length: ROOMS }, (_, i) => playRoom(i)));
  clearInterval(timer);
  const failed = results.filter((r) => r.status === 'rejected');
  for (const f of failed) console.log('room failed:', String((f as PromiseRejectedResult).reason?.message ?? f).slice(0, 120));
  console.log('--- Result ---');
  console.log(`games finished: ${finished}/${ROOMS}, rooms failed: ${failed.length}`);
  console.log(`moves acked: ${ackMs.length}, ack latency p50 ${pct(ackMs, 50)}, p95 ${pct(ackMs, 95)}, p99 ${pct(ackMs, 99)}, max ${pct(ackMs, 100)}`);
  console.log(`errors: ${errors} (stale replies are normal when two seats answer at once), resyncs: ${resyncs}`);
  console.log(`wall time: ${Math.round((Date.now() - started) / 1000)} s; ${await sample()}`);
  process.exit(0);
}

void main();
