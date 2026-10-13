import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { RoomList } from 'protocol';
import { ApiError } from '../auth/auth.service';
import { RoomsService } from './rooms.service';

const LIST: RoomList = {
  rooms: [{ id: 'r1', visibility: 'open', hostName: 'Ann', memberCount: 2, capacity: 4, status: 'lobby', youAreMember: false }],
  seatLimits: { min: 2, max: 8 },
};

describe('RoomsService', () => {
  let rooms: RoomsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    rooms = TestBed.inject(RoomsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    rooms.stopPolling();
    http.verify();
    jest.useRealTimers();
  });

  it('refresh() loads the list', async () => {
    const done = rooms.refresh();
    http.expectOne({ method: 'GET', url: '/api/rooms' }).flush(LIST);
    await done;
    expect(rooms.list()).toEqual(LIST);
    expect(rooms.error()).toBeNull();
  });

  it("refresh() keeps the last list and shows the server's message when it fails", async () => {
    const first = rooms.refresh();
    http.expectOne('/api/rooms').flush(LIST);
    await first;
    const second = rooms.refresh();
    http.expectOne('/api/rooms').error(new ProgressEvent('error'), { status: 0 });
    await second;
    expect(rooms.list()).toEqual(LIST);
    expect(rooms.error()).toBe("Can't reach the server. Check your connection and try again");
  });

  it('polls right away and then every pollMs until stopped', async () => {
    jest.useFakeTimers();
    rooms.startPolling();
    http.expectOne('/api/rooms').flush(LIST);
    jest.advanceTimersByTime(rooms.pollMs);
    http.expectOne('/api/rooms').flush(LIST);
    rooms.stopPolling();
    jest.advanceTimersByTime(rooms.pollMs * 3);
    http.expectNone('/api/rooms');
  });

  it('create() posts the body and returns the new id', async () => {
    const done = rooms.create({ seatCount: 4, rules: { firstRevealDraw: true }, displayName: 'Ann' });
    const req = http.expectOne({ method: 'POST', url: '/api/rooms' });
    expect(req.request.body).toEqual({ seatCount: 4, rules: { firstRevealDraw: true }, displayName: 'Ann' });
    req.flush({ id: 'r9' }, { status: 201, statusText: 'Created' });
    expect(await done).toBe('r9');
  });

  it("join() posts the name, and rejects with the server's error", async () => {
    const done = rooms.join('r1', 'Ann');
    const req = http.expectOne({ method: 'POST', url: '/api/rooms/r1/join' });
    expect(req.request.body).toEqual({ displayName: 'Ann' });
    req.flush({ code: 'name_taken', message: 'That name is already taken in this room. Choose another.' }, { status: 409, statusText: 'Conflict' });
    const err = await done.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'name_taken', message: 'That name is already taken in this room. Choose another.' });
  });

  it('creates a solo room and returns its id, or throws the API error', async () => {
    const created = rooms.createSolo({ seatCount: 3, rules: {} });
    const req = http.expectOne('/api/rooms/solo');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ seatCount: 3, rules: {} });
    req.flush({ id: 'r-solo' });
    await expect(created).resolves.toBe('r-solo');
  });
});
