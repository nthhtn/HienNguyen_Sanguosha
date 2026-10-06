import { ChoiceOption, GameState, Player } from 'engine';
import { cardDisplayData } from 'content';
import { cardFaceLabel, cardIdDisplayName, seatName } from '../labels';

export interface ChoiceDescription {
  // The Tool's name, e.g. "Steal".
  title: string;
  // What to do, e.g. "Choose a card to take from Seat 1".
  prompt: string;
  // The primary button.
  confirmLabel: 'Take' | 'Discard';
}

const cardName = (definitionId: string) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);

// What the Choice window says, read off the pending choice. Null unless the
// viewer is the one choosing.
export function describeChoice(state: GameState, viewerSeatId: string): ChoiceDescription | null {
  const choice = state.pendingChoice;
  if (!choice || choice.seatId !== viewerSeatId || choice.reason.kind !== 'choice') return null;
  const { card, targetSeatId } = choice.reason;
  const from = targetSeatId ? ` from ${seatName(state.players, targetSeatId)}` : '';
  return {
    title: cardName(card.as),
    prompt: `Choose a card to ${choice.verb}${from}`,
    confirmLabel: choice.verb === 'take' ? 'Take' : 'Discard',
  };
}

// An option's label: a hand by its owner and size, a card by its name and face.
export function choiceOptionLabel(shows: ChoiceOption['shows'], players: readonly Player[]): string {
  if (shows.kind === 'hidden-hand') {
    return `${seatName(players, shows.seatId)}'s Hand (${shows.count} ${shows.count === 1 ? 'Card' : 'Cards'})`;
  }
  return `${cardName(shows.card.definitionId)} (${cardFaceLabel(shows.card)})`;
}
