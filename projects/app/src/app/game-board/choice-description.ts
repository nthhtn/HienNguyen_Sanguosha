import { Action, ChoiceOption, GameState, Player, Seat } from 'engine';
import { abilityName, cardDisplayData } from 'content';
import { cardFaceLabel, cardIdDisplayName, forceOf, seatName, suitLabel } from '../labels';
import type { ChoiceDialogOption } from './choice-dialog';

export interface ChoiceDescription {
  // The Tool's name, e.g. "Steal".
  title: string;
  // What to do, e.g. "Choose a card to take from Seat 1".
  prompt: string;
  // The primary button.
  confirmLabel: 'Take' | 'Discard' | 'Give' | 'Choose';
  // The label of a "decline" option, when the choice has one (Gender Swords: "Let Seat 1 Draw").
  declineLabel?: string;
}

const cardName = (definitionId: string) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);

// What the Choice window says, read off the pending choice. Null unless the
// viewer is the one choosing.
export function describeChoice(state: GameState, viewerSeatId: string): ChoiceDescription | null {
  const choice = state.pendingChoice;
  if (!choice || choice.seatId !== viewerSeatId) return null;
  // A claim to believe or doubt (Bewilder).
  if (choice.reason.kind === 'ability' && choice.reason.cardId && choice.verb === 'pick') {
    const claimer = seatName(state.players, choice.reason.owner.seatId);
    return { title: abilityName(choice.reason.abilityId), prompt: `${claimer} claims ${cardName(choice.reason.cardId)}. Believe or doubt?`, confirmLabel: 'Choose' };
  }
  // A skill's take from another seat (Feedback).
  if (choice.reason.kind === 'ability' && choice.verb === 'take') {
    const from = choice.reason.targetSeatId ? ` from ${seatName(state.players, choice.reason.targetSeatId)}` : '';
    return { title: abilityName(choice.reason.abilityId), prompt: `Choose a card to take${from}`, confirmLabel: 'Take' };
  }
  // A skill's pick (a seat, a suit, one of several labels) or who gets given cards.
  if (choice.reason.kind === 'ability' && (choice.verb === 'pick' || choice.verb === 'give')) {
    const title = abilityName(choice.reason.abilityId);
    if (choice.verb === 'give') return { title, prompt: 'Choose who gets the cards', confirmLabel: 'Give' };
    const kinds = new Set(choice.options.map((o) => o.shows.kind));
    const only = kinds.size === 1 ? [...kinds][0] : null;
    const prompt = only === 'seat' ? 'Choose a seat' : only === 'suit' ? 'Name a suit' : 'Choose one';
    return { title, prompt, confirmLabel: 'Choose' };
  }
  if (choice.reason.kind !== 'choice') return null;
  const { card, targetSeatId } = choice.reason;
  // Choosing among your own cards (Gender Swords): discard one, or let the user draw.
  if (targetSeatId === viewerSeatId && choice.options.some((o) => o.shows.kind === 'decline')) {
    const user = seatName(state.players, choice.reason.userSeatId);
    return { title: cardName(card.as), prompt: `Discard a hand card, Or let ${user} draw 1 card`, confirmLabel: 'Discard', declineLabel: `Let ${user} Draw` };
  }
  const from = targetSeatId ? ` from ${seatName(state.players, targetSeatId)}` : '';
  return {
    title: cardName(card.as),
    prompt: `Choose a card to ${choice.verb}${from}`,
    confirmLabel: choice.verb === 'take' ? 'Take' : 'Discard',
  };
}

// An option's label: a hand by its owner and size, a card by its name and face.
export function choiceOptionLabel(shows: ChoiceOption['shows'], players: readonly Player[], declineLabel?: string): string {
  if (shows.kind === 'seat') return seatName(players, shows.seatId);
  if (shows.kind === 'suit') return suitLabel(shows.suit);
  if (shows.kind === 'label') return shows.text;
  if (shows.kind === 'use') return 'Use';
  if (shows.kind === 'decline') return declineLabel ?? "Don't";
  if (shows.kind === 'hidden-hand') {
    return `${seatName(players, shows.seatId)}'s Hand (${shows.count} ${shows.count === 1 ? 'Card' : 'Cards'})`;
  }
  return `${cardName(shows.card.definitionId)} (${cardFaceLabel(shows.card)})`;
}

// What the Choice window offers: the engine's options it can legally pick. A
// hand shows as one face-down card per card in it; every one of them picks the
// hand, and the engine takes a card from it at random.
export function choiceDialogOptions(
  options: readonly ChoiceOption[],
  legal: readonly Action[],
  players: readonly Player[],
  declineLabel?: string,
  seats: readonly Seat[] = []
): ChoiceDialogOption[] {
  return options.flatMap((option): ChoiceDialogOption[] => {
    const action = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === option.id);
    if (!action) return [];
    if (option.shows.kind === 'hidden-hand') {
      return Array.from({ length: option.shows.count }, (_, i) => ({ id: `${option.id}#${i + 1}`, action, faceDown: true as const, label: `Hand Card ${i + 1}` }));
    }
    if (option.shows.kind === 'card') {
      return [{ id: option.id, action, card: option.shows.card, label: choiceOptionLabel(option.shows, players) }];
    }
    const label = choiceOptionLabel(option.shows, players, declineLabel);
    if (option.shows.kind === 'seat') {
      const seatId = option.shows.seatId;
      return [{ id: option.id, action, label, force: forceOf(seats.find((s) => s.id === seatId)?.kingdom) }];
    }
    if (option.shows.kind === 'suit') return [{ id: option.id, action, label, suit: option.shows.suit }];
    return [{ id: option.id, action, label }];
  });
}
