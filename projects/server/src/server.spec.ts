import { buildContentRegistry, kingdomWarMaxSeats } from 'content';
import { loadConfig } from './config';
import { createServer } from './server';

describe('createServer', () => {
  it('serves the auth API on the in-memory store when there is no DATABASE_URL', async () => {
    const server = await createServer(loadConfig({}), { logger: false });
    try {
      expect((await server.app.inject({ method: 'GET', url: '/api/me' })).statusCode).toBe(401);
      const guest = await server.app.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { displayName: 'Guest' },
        headers: { origin: 'http://localhost:4200' },
      });
      expect(guest.statusCode).toBe(201);
    } finally {
      await server.close();
    }
  });

  it('lists rooms with the seat limits the content allows', async () => {
    const server = await createServer(loadConfig({}), { logger: false });
    try {
      const guest = await server.app.inject({
        method: 'POST',
        url: '/api/auth/guest',
        payload: { displayName: 'Guest' },
        headers: { origin: 'http://localhost:4200' },
      });
      const session = guest.cookies.find((c) => c.name === 'sgs_session')!.value;
      const list = await server.app.inject({ method: 'GET', url: '/api/rooms', cookies: { sgs_session: session } });
      expect(list.json()).toEqual({ rooms: [], seatLimits: { min: 2, max: kingdomWarMaxSeats(buildContentRegistry()) } });
    } finally {
      await server.close();
    }
  });
});
