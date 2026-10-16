import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MyGames } from 'protocol';
import { MyGamesService } from './my-games.service';
import { english } from '../i18n/msg.testing';

const GAMES: MyGames = {
  games: [
    {
      gameId: 'g1',
      finishedAt: Date.parse('2026-10-15T12:00:00.000Z'),
      players: [{ seatId: 'seat-0', name: 'Ann', kind: 'human' }],
      result: { endedAt: 5, winningSeatIds: ['seat-0'], losingSeatIds: [] },
      yourSeat: 'seat-0',
    },
  ],
};

describe('MyGamesService', () => {
  let service: MyGamesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), MyGamesService] });
    service = TestBed.inject(MyGamesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('has no list until it loads', () => {
    expect(service.games()).toBeNull();
    expect(service.error()).toBeNull();
  });

  it('loads the finished games', async () => {
    const done = service.load();
    http.expectOne({ method: 'GET', url: '/api/me/games' }).flush(GAMES);
    await done;
    expect(service.games()).toEqual(GAMES.games);
    expect(service.error()).toBeNull();
  });

  it("shows the server's message when it refuses, as for a guest (Review Focus 4)", async () => {
    const done = service.load();
    http.expectOne('/api/me/games').flush({ code: 'registered_only', message: 'Sign in with an account to see your games' }, { status: 403, statusText: 'Forbidden' });
    await done;
    expect(service.games()).toBeNull();
    expect(english(service.error())).toBe('Sign in with an account to see your games');
  });

  it('keeps the last list and shows an error when a reload fails', async () => {
    const first = service.load();
    http.expectOne('/api/me/games').flush(GAMES);
    await first;
    const second = service.load();
    http.expectOne('/api/me/games').error(new ProgressEvent('error'), { status: 0 });
    await second;
    expect(service.games()).toEqual(GAMES.games);
    expect(english(service.error())).toBe("Can't reach the server. Check your connection and try again");
  });
});
