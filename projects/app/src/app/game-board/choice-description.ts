import { Action, ChoiceOption, GameState, Player } from 'engine';
import { cardDisplayData } from 'content';
import { cardFaceLabel, cardIdDisplayName, seatName } from '../labels';
import type { ChoiceDialogOption } from './choice-dialog';

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
  if (shows.kind === 'use') return 'Use';
  if (shows.kind === 'decline') return "Don't";
  if (shows.kind === 'hidden-hand') {
    return `${seatName(players, shows.seatId)}'s Hand (${shows.count} ${shows.count === 1 ? 'Card' : 'Cards'})`;
  }
  return `${cardName(shows.card.definitionId)} (${cardFaceLabel(shows.card)})`;
}

// What the Choice window offers: the engine's options it can legally pick. A
// hand shows as one face-down card per card in it; every one of them picks the
// hand, and the engine takes a card from it at random.
export function choiceDialogOptions(options: readonly ChoiceOption[], legal: readonly Action[], players: readonly Player[]): ChoiceDialogOption[] {
  return options.flatMap((option): ChoiceDialogOption[] => {
    const action = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === option.id);
    if (!action) return [];
    if (option.shows.kind === 'hidden-hand') {
      return Array.from({ length: option.shows.count }, (_, i) => ({ id: `${option.id}#${i + 1}`, action, faceDown: true as const, label: `Hand Card ${i + 1}` }));
    }
    if (option.shows.kind === 'card') {
      return [{ id: option.id, action, card: option.shows.card, label: choiceOptionLabel(option.shows, players) }];
    }
    return [{ id: option.id, action, label: choiceOptionLabel(option.shows, players) }];
  });
}
