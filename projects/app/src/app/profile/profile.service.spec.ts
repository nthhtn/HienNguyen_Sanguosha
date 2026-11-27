import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { ProfileStats } from 'protocol';
import { AuthService } from '../auth/auth.service';
import { english } from '../i18n/msg.testing';
import { ProfileService } from './profile.service';

const STATS: ProfileStats = {
  displayName: 'Ann',
  memberSince: 0,
  mode: 'all',
  totals: { games: 2, wins: 1, losses: 1, noOutcome: 0, winRate: 0.5 },
  byForce: [],
  topGenerals: [],
  form: [],
  streak: { current: 0, best: 1 },
};

describe('ProfileService', () => {
  let service: ProfileService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), ProfileService] });
    service = TestBed.inject(ProfileService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the stats for the current mode', async () => {
    const done = service.load();
    http.expectOne({ method: 'GET', url: '/api/me/profile?mode=all' }).flush(STATS);
    await done;
    expect(service.stats()).toEqual(STATS);
    expect(service.error()).toBeNull();
  });

  it('setMode loads the stats again for the new mode', async () => {
    const done = service.setMode('solo');
    http.expectOne('/api/me/profile?mode=solo').flush({ ...STATS, mode: 'solo' });
    await done;
    expect(service.mode()).toBe('solo');
    expect(service.stats()?.mode).toBe('solo');
  });

  it('shows an error and keeps the last stats when a reload fails', async () => {
    const first = service.load();
    http.expectOne('/api/me/profile?mode=all').flush(STATS);
    await first;
    const second = service.load();
    http.expectOne('/api/me/profile?mode=all').error(new ProgressEvent('error'), { status: 0 });
    await second;
    expect(service.stats()).toEqual(STATS);
    expect(english(service.error())).toBe("Can't reach the server. Check your connection and try again");
  });

  it('rename sends the name, updates the signed-in user and reloads the stats', async () => {
    const done = service.rename('Ann Two');
    const patch = http.expectOne({ method: 'PATCH', url: '/api/me/profile' });
    expect(patch.request.body).toEqual({ displayName: 'Ann Two' });
    patch.flush({ id: 'u1', kind: 'registered', displayName: 'Ann Two', email: 'ann@example.com' });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne('/api/me/profile?mode=all').flush({ ...STATS, displayName: 'Ann Two' });
    expect(await done).toBe(true);
    expect(TestBed.inject(AuthService).me()?.displayName).toBe('Ann Two');
    expect(service.stats()?.displayName).toBe('Ann Two');
  });

  it('rename answers false and shows the server error when the name is refused', async () => {
    const done = service.rename('   ');
    http.expectOne('/api/me/profile').flush({ code: 'invalid_name', message: 'Bad name' }, { status: 400, statusText: 'Bad Request' });
    expect(await done).toBe(false);
    expect(english(service.actionError())).toContain('Names need');
  });

  it('changePassword posts both passwords and answers true on 204', async () => {
    const done = service.changePassword('old-pass', 'new-password');
    const post = http.expectOne({ method: 'POST', url: '/api/me/password' });
    expect(post.request.body).toEqual({ currentPassword: 'old-pass', newPassword: 'new-password' });
    post.flush(null, { status: 204, statusText: 'No Content' });
    expect(await done).toBe(true);
    expect(service.actionError()).toBeNull();
  });

  it('changePassword answers false and shows the error for a wrong current password', async () => {
    const done = service.changePassword('wrong', 'new-password');
    http.expectOne('/api/me/password').flush({ code: 'invalid_credentials', message: 'Email or password is incorrect' }, { status: 401, statusText: 'Unauthorized' });
    expect(await done).toBe(false);
    expect(english(service.actionError())).toBe('Email or password is incorrect');
  });
});
