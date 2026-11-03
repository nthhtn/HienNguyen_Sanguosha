import type { GameSeatView, GameSummaryPlayer, ReplaySeat, RoomMemberView } from './public-api';

// A bot's name id rides on every view that names a player; old payloads without it stay valid.
describe('botNameId on views', () => {
  it('is optional on a member, a game seat, a history player and a replay seat', () => {
    const member: RoomMemberView = { playerId: 'p', name: '[Bot] Zhou Cang', botNameId: 'zhou-cang', kind: 'bot', seatId: null, isRegistered: false, connected: true, botControlled: false };
    const seat: GameSeatView = { seatId: 'seat-1', playerId: 'p', name: '[Bot] Zhou Cang', botNameId: 'zhou-cang' };
    const player: GameSummaryPlayer = { seatId: 'seat-1', name: '[Bot] Zhou Cang', kind: 'bot', botNameId: 'zhou-cang' };
    const replay: ReplaySeat = { seatId: 'seat-1', roomPlayerId: 'p', name: '[Bot] Zhou Cang', kind: 'bot', botNameId: 'zhou-cang' };
    const old: GameSeatView = { seatId: 'seat-1', playerId: 'p', name: 'Bot 1' };
    expect([member.botNameId, seat.botNameId, player.botNameId, replay.botNameId, old.botNameId]).toEqual(['zhou-cang', 'zhou-cang', 'zhou-cang', 'zhou-cang', undefined]);
  });
});
