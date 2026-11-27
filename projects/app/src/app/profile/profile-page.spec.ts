import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import type { ProfileMode, ProfileStats } from 'protocol';
import { MyGamesList } from '../online/my-games-list';
import { msg, type Msg } from '../i18n/msg';
import { ProfilePage } from './profile-page';
import { ProfileService } from './profile.service';

const STATS: ProfileStats = {
  displayName: 'Ann',
  memberSince: Date.parse('2026-10-01T00:00:00.000Z'),
  mode: 'all',
  totals: { games: 1, wins: 1, losses: 0, noOutcome: 0, winRate: 1 },
  byForce: [],
  topGenerals: [],
  form: [],
  streak: { current: 1, best: 1 },
};

@Component({ selector: 'app-my-games-list', template: '<p class="history-stub">history</p>' })
class MyGamesListStub {}

describe('ProfilePage', () => {
  const stats = signal<ProfileStats | null>(null);
  const error = signal<Msg | null>(null);
  const mode = signal<ProfileMode>('all');
  const service = { stats, error, mode, actionError: signal<Msg | null>(null), load: jest.fn(async () => undefined), setMode: jest.fn(async (m: ProfileMode) => mode.set(m)) };

  async function render(tab?: string) {
    await TestBed.configureTestingModule({
      imports: [ProfilePage],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: new Map(tab ? [['tab', tab]] : []) } } }],
    })
      .overrideComponent(ProfilePage, { set: { providers: [{ provide: ProfileService, useValue: service }] } })
      .overrideComponent(ProfilePage, { remove: { imports: [MyGamesList] }, add: { imports: [MyGamesListStub] } })
      .compileComponents();
    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    stats.set(STATS);
    error.set(null);
    mode.set('all');
    service.load.mockClear();
    service.setMode.mockClear();
  });

  it('loads the stats and shows the name, the member since date and the Stats tab first', async () => {
    const { el } = await render();
    expect(service.load).toHaveBeenCalledTimes(1);
    expect(el.querySelector('h1, .title')?.textContent).toContain('Ann');
    expect(el.querySelector('.since')?.textContent).toContain('Member since');
    expect(el.querySelector('[role=tab][aria-selected=true]')?.textContent).toContain('Stats');
    expect(el.querySelector('app-profile-stats')).not.toBeNull();
  });

  it('opens on the History tab when the address says so, and switches tabs on a click', async () => {
    const { fixture, el } = await render('history');
    expect(el.querySelector('.history-stub')).not.toBeNull();
    expect(el.querySelector('app-profile-stats')).toBeNull();
    (el.querySelector('[role=tab].tab-settings') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-profile-settings')).not.toBeNull();
    expect(el.querySelector('.history-stub')).toBeNull();
  });

  it('changes the mode through the service', async () => {
    const { fixture, el } = await render();
    (el.querySelector('button.mode-solo') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(service.setMode).toHaveBeenCalledWith('solo');
  });

  it('shows the error when the stats cannot be loaded', async () => {
    stats.set(null);
    error.set(msg('error.internal'));
    const { el } = await render();
    expect(el.querySelector('.error')?.textContent).toContain('Something went wrong');
  });
});
