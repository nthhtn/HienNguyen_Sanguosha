import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { GameSummary } from 'protocol';
import { MyGamesPage } from './my-games-page';
import { MyGamesService } from './my-games.service';

const WON: GameSummary = {
  gameId: 'g-won',
  finishedAt: Date.parse('2026-10-15T12:00:00.000Z'),
  players: [
    { seatId: 'seat-0', name: 'Bot 1', kind: 'bot' },
    { seatId: 'seat-1', name: 'Ann', kind: 'human' },
  ],
  result: { endedAt: 40, winningKingdom: 'Wei', winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0'] },
  yourSeat: 'seat-1',
};
const LOST: GameSummary = { ...WON, gameId: 'g-lost', yourSeat: 'seat-0' };

describe('MyGamesPage', () => {
  const games = signal<GameSummary[] | null>(null);
  const error = signal<string | null>(null);
  const service = { games, error, load: jest.fn(async () => undefined) };

  async function render() {
    await TestBed.configureTestingModule({ imports: [MyGamesPage], providers: [provideRouter([])] })
      .overrideComponent(MyGamesPage, { set: { providers: [{ provide: MyGamesService, useValue: service }] } })
      .compileComponents();
    const fixture = TestBed.createComponent(MyGamesPage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    games.set(null);
    error.set(null);
    service.load.mockClear();
  });

  it('loads the games when it opens, and says it is loading', async () => {
    const { el } = await render();
    expect(service.load).toHaveBeenCalled();
    expect(el.querySelector('mat-card-title')?.textContent?.trim()).toBe('My Games');
    expect(el.querySelector('.loading')?.textContent?.trim()).toBe('Loading games…');
  });

  it('says there are no finished games yet', async () => {
    games.set([]);
    const { el } = await render();
    expect(el.querySelector('.empty')?.textContent?.trim()).toBe('No finished games yet');
    expect(el.querySelector('.loading')).toBeNull();
  });

  it('shows each game read-only: outcome, who won, the players with you marked, and when', async () => {
    games.set([WON, LOST]);
    const { el } = await render();
    const rows = [...el.querySelectorAll('li.game')];
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.outcome')?.textContent?.trim()).toBe('Won');
    expect(rows[1].querySelector('.outcome')?.textContent?.trim()).toBe('Lost');
    expect(rows[0].querySelector('.headline')?.textContent?.trim()).toBe('Wei won');
    expect(rows[0].querySelector('.players')?.textContent?.trim()).toBe('Bot 1 (Bot), Ann (You)');
    expect(rows[1].querySelector('.players')?.textContent?.trim()).toBe('Bot 1 (You), Ann');
    expect(rows[0].querySelector('.when')?.textContent?.trim()).toBeTruthy();
    expect(el.querySelectorAll('li.game button, li.game a')).toHaveLength(0);
  });

  it('shows why when it could not load', async () => {
    error.set('Sign in with an account to see your games');
    const { el } = await render();
    expect(el.querySelector('.error')?.textContent?.trim()).toBe('Sign in with an account to see your games');
  });

  it('links back to Rooms', async () => {
    const { el } = await render();
    expect((el.querySelector('a.back') as HTMLAnchorElement).getAttribute('href')).toBe('/rooms');
    expect(el.querySelector('a.back')?.textContent?.trim()).toBe('Back to Rooms');
  });

  it('starts each visit empty, so the next player never sees the last list', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [MyGamesPage], providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const first = TestBed.createComponent(MyGamesPage);
    first.detectChanges();
    http.expectOne('/api/me/games').flush({ games: [WON] });
    await first.whenStable();
    first.detectChanges();
    expect((first.nativeElement as HTMLElement).querySelectorAll('.game').length).toBe(1);
    first.destroy();
    const second = TestBed.createComponent(MyGamesPage);
    second.detectChanges();
    expect((second.nativeElement as HTMLElement).querySelectorAll('.game').length).toBe(0);
    expect((second.nativeElement as HTMLElement).querySelector('.loading')).not.toBeNull();
    http.expectOne('/api/me/games').flush({ games: [] });
  });
});
