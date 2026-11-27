import { TestBed } from '@angular/core/testing';
import type { ProfileStats } from 'protocol';
import { ProfileStatsView } from './profile-stats';

const STATS: ProfileStats = {
  displayName: 'Ann',
  memberSince: Date.parse('2026-10-01T00:00:00.000Z'),
  mode: 'all',
  totals: { games: 5, wins: 3, losses: 1, noOutcome: 1, winRate: 0.75 },
  byForce: [
    { force: 'Wei', games: 3, wins: 2, losses: 1, winRate: 2 / 3 },
    { force: 'ambitionist', games: 1, wins: 1, losses: 0, winRate: 1 },
    { force: 'Shu', games: 1, wins: 0, losses: 0, winRate: null },
  ],
  topGenerals: [{ generalId: 'cao-cao', games: 3, wins: 2, losses: 1, winRate: 2 / 3 }],
  form: [
    { gameId: 'g3', finishedAt: 3, result: 'win' },
    { gameId: 'g2', finishedAt: 2, result: 'loss' },
    { gameId: 'g1', finishedAt: 1, result: 'none' },
  ],
  streak: { current: 1, best: 2 },
};
const EMPTY: ProfileStats = { ...STATS, totals: { games: 0, wins: 0, losses: 0, noOutcome: 0, winRate: null }, byForce: [], topGenerals: [], form: [], streak: { current: 0, best: 0 } };

function render(stats: ProfileStats) {
  const fixture = TestBed.createComponent(ProfileStatsView);
  fixture.componentRef.setInput('stats', stats);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
// One string per match: a match made of cells reads cell by cell, whatever whitespace the template keeps between them.
const text = (el: Element, selector: string) =>
  Array.from(el.querySelectorAll(selector)).map((n) => (n.children.length > 0 ? Array.from(n.children).map((c) => c.textContent!.trim()).join(' ') : n.textContent!.trim()));

describe('ProfileStatsView', () => {
  it('shows the totals as tiles, with the win rate as a percentage', () => {
    const el = render(STATS);
    expect(text(el, '.tile')).toEqual(['Games 5', 'Wins 3', 'Losses 1', 'Win Rate 75%', 'No Result 1']);
  });

  it('lists a row per Force, with a dash when there is no win rate and Ambitionist spelled out', () => {
    const rows = text(render(STATS), '.force-row');
    expect(rows).toEqual(['Wei 3 2 1 67%', 'Ambitionist 1 1 0 100%', 'Shu 1 0 0 —']);
  });

  it('lists the most played Generals by name with their games and wins', () => {
    expect(text(render(STATS), '.general-row')).toEqual([expect.stringContaining('Cao Cao')]);
    expect(text(render(STATS), '.general-row')[0]).toContain('3');
  });

  it('shows the recent results newest first, and the streaks as a sentence', () => {
    const el = render(STATS);
    expect(Array.from(el.querySelectorAll('.form-chip')).map((n) => n.className.split(' ').find((c) => ['win', 'loss', 'none'].includes(c)))).toEqual(['win', 'loss', 'none']);
    expect(text(el, '.streak')[0]).toBe('Current streak: 1, best streak: 2');
  });

  it('says nothing matches when a filter has no games, not that there are none', () => {
    expect(text(render({ ...EMPTY, mode: 'solo' }), '.empty')).toEqual(['No finished games match this filter']);
  });

  it('shows an empty message and no tables when there are no games', () => {
    const el = render(EMPTY);
    expect(text(el, '.empty')).toEqual(['No finished games yet']);
    expect(el.querySelector('.force-row')).toBeNull();
    expect(el.querySelector('.tile')).toBeNull();
  });
});
