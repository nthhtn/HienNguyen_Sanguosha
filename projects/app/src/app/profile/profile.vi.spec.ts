import { TestBed } from '@angular/core/testing';
import type { ProfileStats } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import { ProfileStatsView } from './profile-stats';

const STATS: ProfileStats = {
  displayName: 'Ann',
  memberSince: 0,
  mode: 'all',
  totals: { games: 4, wins: 2, losses: 1, noOutcome: 1, winRate: 2 / 3 },
  byForce: [
    { force: 'Wei', games: 3, wins: 2, losses: 1, winRate: 2 / 3 },
    { force: 'ambitionist', games: 1, wins: 0, losses: 0, winRate: null },
  ],
  topGenerals: [{ generalId: 'cao-cao', games: 3, wins: 2, losses: 1, winRate: 2 / 3 }],
  form: [{ gameId: 'g', finishedAt: 1, result: 'win' }],
  streak: { current: 1, best: 2 },
};

describe('Profile in Vietnamese', () => {
  it('shows the labels, the Force names and the streak in Vietnamese', async () => {
    await TestBed.configureTestingModule({ imports: [ProfileStatsView] }).compileComponents();
    await TestBed.inject(I18n).setLocale('vi');
    const fixture = TestBed.createComponent(ProfileStatsView);
    fixture.componentRef.setInput('stats', STATS);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(Array.from(el.querySelectorAll('.tile-label')).map((n) => n.textContent)).toEqual(['Số ván', 'Thắng', 'Thua', 'Tỷ lệ thắng', 'Không kết quả']);
    expect(Array.from(el.querySelectorAll('.force-row .name')).map((n) => n.textContent)).toEqual(['Ngụy', 'Dã tâm gia']);
    expect(el.querySelector('.streak')?.textContent).toBe('Chuỗi hiện tại: 1, chuỗi dài nhất: 2');
  });
});
