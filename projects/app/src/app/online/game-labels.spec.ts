import type { GameSummary } from 'protocol';
import { gameHeadline, gameOutcome, gameWhen, playerLabel } from './game-labels';

const GAME: GameSummary = {
  gameId: 'g1',
  finishedAt: Date.parse('2026-10-15T12:00:00.000Z'),
  players: [
    { seatId: 'seat-0', name: 'Bot 1', kind: 'bot' },
    { seatId: 'seat-1', name: 'Ann', kind: 'human' },
    { seatId: 'seat-2', name: 'Bo', kind: 'human' },
  ],
  result: { endedAt: 40, winningKingdom: 'Wei', winningSeatIds: ['seat-1', 'seat-2'], losingSeatIds: ['seat-0'] },
  yourSeat: 'seat-1',
};

describe('gameOutcome', () => {
  it('is Won when your seat won and Lost when it lost', () => {
    expect(gameOutcome(GAME)).toBe('Won');
    expect(gameOutcome({ ...GAME, yourSeat: 'seat-0' })).toBe('Lost');
  });

  it('is Draw when your seat is on neither side, or there is no result', () => {
    expect(gameOutcome({ ...GAME, result: { endedAt: 3, winningSeatIds: [], losingSeatIds: [] } })).toBe('Draw');
    expect(gameOutcome({ ...GAME, result: null })).toBe('Draw');
  });
});

describe('gameHeadline', () => {
  it('names the winning force', () => {
    expect(gameHeadline(GAME)).toBe('Wei won');
  });

  it('names the winners when no force won', () => {
    expect(gameHeadline({ ...GAME, result: { endedAt: 9, winningSeatIds: ['seat-1', 'seat-2'], losingSeatIds: ['seat-0'] } })).toBe('Ann, Bo won');
  });

  it('says no survivors when nobody won', () => {
    expect(gameHeadline({ ...GAME, result: { endedAt: 9, winningSeatIds: [], losingSeatIds: ['seat-0', 'seat-1', 'seat-2'] } })).toBe('No survivors');
    expect(gameHeadline({ ...GAME, result: null })).toBe('No survivors');
  });
});

describe('playerLabel', () => {
  it('marks your own seat and the bots', () => {
    expect(playerLabel(GAME, 'seat-1')).toBe('Ann (You)');
    expect(playerLabel(GAME, 'seat-2')).toBe('Bo');
    expect(playerLabel(GAME, 'seat-0')).toBe('Bot 1 (Bot)');
  });
});

describe('gameWhen', () => {
  it('formats when the game finished, with the year', () => {
    const text = gameWhen(GAME);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('2026');
  });
});
