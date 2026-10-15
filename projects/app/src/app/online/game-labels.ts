import type { GameSummary } from 'protocol';
import { kingdomDisplayName } from '../labels';

// How a finished game went for the player: the badge of a My Games row.
export function gameOutcome(game: GameSummary): 'Won' | 'Lost' | 'Draw' {
  if (game.result?.winningSeatIds.includes(game.yourSeat)) return 'Won';
  if (game.result?.losingSeatIds.includes(game.yourSeat)) return 'Lost';
  return 'Draw';
}

// Who won, in a short sentence: the winning force, else the winners by name.
export function gameHeadline(game: GameSummary): string {
  const result = game.result;
  if (result?.winningKingdom) return `${kingdomDisplayName(result.winningKingdom)} won`;
  const winners = (result?.winningSeatIds ?? []).map((id) => game.players.find((p) => p.seatId === id)?.name ?? id);
  return winners.length > 0 ? `${winners.join(', ')} won` : 'No survivors';
}

// A player's name with who they are: "Ann (You)", "Bot 1 (Bot)".
export function playerLabel(game: GameSummary, seatId: string): string {
  const player = game.players.find((p) => p.seatId === seatId);
  if (!player) return seatId;
  if (seatId === game.yourSeat) return `${player.name} (You)`;
  return player.kind === 'bot' ? `${player.name} (Bot)` : player.name;
}
