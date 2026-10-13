import { randomUUID } from 'node:crypto';
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { buildApp } from './app';

const ORIGIN = 'http://localhost:4200';
const LIMITS = { min: 2, max: 6 };

async function setup() {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: LIMITS });
  const rateLimits = new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app = await buildApp({ accounts, rooms, publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
  return { app };
}

const token = (res: LightMyRequestResponse) => res.cookies.find((c) => c.name === 'sgs_session')!.value;
const post = (app: FastifyInstance, url: string, payload: object, session?: string) =>
  app.inject({ method: 'POST', url, payload, headers: { origin: ORIGIN }, cookies: session ? { sgs_session: session } : {} });
const get = (app: FastifyInstance, url: string, session?: string) => app.inject({ method: 'GET', url, cookies: session ? { sgs_session: session } : {} });
const signUp = async (app: FastifyInstance, displayName: string) =>
  token(await post(app, '/api/auth/signup', { email: `${displayName.toLowerCase()}-${randomUUID()}@example.com`, password: 'secret-pass', displayName }));
const guest = async (app: FastifyInstance, displayName: string) => token(await post(app, '/api/auth/guest', { displayName }));
const createRoom = (app: FastifyInstance, session: string, body: object = {}) =>
  post(app, '/api/rooms', { seatCount: 4, rules: { firstRevealDraw: true }, displayName: 'Ann', ...body }, session);

describe('room routes', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  it('answers 401 not_signed_in on every room route without a session, before reading the body', async () => {
    ({ app } = await setup());
    const id = randomUUID();
    for (const res of [
      await get(app, '/api/rooms'),
      await post(app, '/api/rooms', {}),
      await post(app, `/api/rooms/${id}/join`, {}),
      await get(app, `/api/rooms/${id}`),
    ]) {
      expect(res.statusCode).toBe(401);
      expect(res.json().code).toBe('not_signed_in');
    }
  });

  it('creates a room and lists it, with the seat limits', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const created = await createRoom(app, ann);
    expect(created.statusCode).toBe(201);
    const { id } = created.json();
    const list = await get(app, '/api/rooms', ann);
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual({
      rooms: [{ id, visibility: 'open', hostName: 'Ann', memberCount: 1, capacity: 4, status: 'lobby', youAreMember: true }],
      seatLimits: LIMITS,
    });
  });

  it('refuses a guest host with 403 host_must_be_registered', async () => {
    ({ app } = await setup());
    const res = await createRoom(app, await guest(app, 'Gus'));
    expect(res.statusCode).toBe(403);
    expect(res.json()).toEqual({ code: 'host_must_be_registered', message: 'Only registered players can host a room' });
  });

  it('refuses a seat count outside the limits with 400 invalid_seat_count', async () => {
    ({ app } = await setup());
    const res = await createRoom(app, await signUp(app, 'Ann'), { seatCount: 9 });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('invalid_seat_count');
  });

  it('stores only the known rules', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann, { rules: { firstRevealDraw: true, houseRule: 'chaos' } })).json();
    expect((await get(app, `/api/rooms/${id}`, ann)).json().rules).toEqual({ firstRevealDraw: true });
  });

  it('lets a guest join and read the room', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann)).json();
    const gus = await guest(app, 'Gus');
    const joined = await post(app, `/api/rooms/${id}/join`, { displayName: 'Gus' }, gus);
    expect(joined.statusCode).toBe(200);
    expect(joined.json()).toEqual({ id });
    const snapshot = (await get(app, `/api/rooms/${id}`, gus)).json();
    expect(snapshot.members.map((m: { name: string; isRegistered: boolean }) => [m.name, m.isRegistered])).toEqual([
      ['Ann', true],
      ['Gus', false],
    ]);
  });

  it("answers a taken name with 409 and the spec's message", async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann)).json();
    const res = await post(app, `/api/rooms/${id}/join`, { displayName: 'ANN' }, await signUp(app, 'Bo'));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ code: 'name_taken', message: 'That name is already taken in this room. Choose another.' });
  });

  it('answers a full room with 409 room_full', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann, { seatCount: 2 })).json();
    await post(app, `/api/rooms/${id}/join`, { displayName: 'Bo' }, await signUp(app, 'Bo'));
    const res = await post(app, `/api/rooms/${id}/join`, { displayName: 'Cy' }, await signUp(app, 'Cy'));
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('room_full');
  });

  it('answers 403 not_member to a non-member, 404 to an unknown room and 400 to a malformed id', async () => {
    ({ app } = await setup());
    const ann = await signUp(app, 'Ann');
    const { id } = (await createRoom(app, ann)).json();
    const bo = await signUp(app, 'Bo');
    expect((await get(app, `/api/rooms/${id}`, bo)).statusCode).toBe(403);
    expect((await get(app, `/api/rooms/${randomUUID()}`, bo)).statusCode).toBe(404);
    expect((await get(app, '/api/rooms/not-a-uuid', bo)).statusCode).toBe(400);
  });
});
