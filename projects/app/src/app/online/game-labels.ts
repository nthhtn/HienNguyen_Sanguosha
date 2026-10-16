import type { GameSummary } from 'protocol';
import { englishTranslator, localeOf, type Translator } from '../i18n/translator';
import { kingdomDisplayName } from '../labels';

// How a finished game went for the player: the badge of a My Games row.
export function gameOutcome(game: GameSummary, tr: Translator = englishTranslator): string {
  if (didWin(game)) return tr('myGames.won');
  if (game.result?.losingSeatIds.includes(game.yourSeat)) return tr('myGames.lost');
  return tr('myGames.draw');
}

export function didWin(game: GameSummary): boolean {
  return !!game.result?.winningSeatIds.includes(game.yourSeat);
}

// Who won, in a short sentence: the winning force, else the winners by name.
export function gameHeadline(game: GameSummary, tr: Translator = englishTranslator): string {
  const result = game.result;
  if (result?.winningKingdom) return tr('myGames.kingdomWon', { kingdom: kingdomDisplayName(result.winningKingdom, tr) });
  const winners = (result?.winningSeatIds ?? []).map((id) => game.players.find((p) => p.seatId === id)?.name ?? id);
  return winners.length > 0 ? tr('myGames.namesWon', { names: winners.join(', ') }) : tr('myGames.noSurvivors');
}

// A player's name with who they are: "Ann (You)", "Bot 1 (Bot)".
export function playerLabel(game: GameSummary, seatId: string, tr: Translator = englishTranslator): string {
  const player = game.players.find((p) => p.seatId === seatId);
  if (!player) return seatId;
  if (seatId === game.yourSeat) return tr('myGames.you', { name: player.name });
  return player.kind === 'bot' ? tr('myGames.bot', { name: player.name }) : player.name;
}

// When the game finished, in the viewer's locale and time zone.
export function gameWhen(game: GameSummary, tr: Translator = englishTranslator): string {
  // English keeps the browser's own format; another language formats in its own.
  const locale = localeOf(tr);
  return new Date(game.finishedAt).toLocaleString(locale === 'en' ? undefined : locale, { dateStyle: 'medium', timeStyle: 'short' });
}
