import { Action, CardInstance, GameState, PendingSelection } from 'engine';
import { abilityHint, cardDisplayData } from 'content';
import { cardFaceLabel, cardIdDisplayName, seatName } from '../labels';

type SelectAction = Extract<Action, { kind: 'SelectAction' }>;

const cardName = (definitionId: string) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);
const findCard = (state: GameState, instanceId: string) => state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === instanceId);

export interface AskDescription {
  // The ability's name, e.g. "Axe".
  title: string;
  // The question, e.g. "Use Axe on Seat 1?".
  prompt: string;
  // What it does here, e.g. "Discard 2 cards to make your Sha hit Seat 1".
  hint: string | null;
  // The worn card the ability comes from, shown as its art.
  card: CardInstance | null;
  use: Action;
  decline: Action;
}

// What the Ask window says, read off a pending ask the viewer owes. Null otherwise.
export function describeAsk(state: GameState, viewerSeatId: string, legal: readonly Action[]): AskDescription | null {
  const choice = state.pendingChoice;
  if (!choice || choice.seatId !== viewerSeatId || choice.verb !== 'use' || choice.reason.kind !== 'ability') return null;
  const use = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'use');
  const decline = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'decline');
  if (!use || !decline) return null;
  const { abilityId, owner, targetSeatId } = choice.reason;
  const name = cardName(abilityId);
  const target = targetSeatId && targetSeatId !== viewerSeatId ? seatName(state.players, targetSeatId) : null;
  const hint = abilityHint(abilityId);
  return {
    title: name,
    prompt: `Use ${name}${target ? ` on ${target}` : ''}?`,
    hint: hint ? hint.replace('{target}', target ?? 'the target') : null,
    card: owner.kind === 'equipment' ? (findCard(state, owner.cardInstanceId) ?? null) : null,
    use,
    decline,
  };
}

export interface SelectionItem {
  id: string;
  // A card, face up (the selector's own); absent for a seat.
  card?: CardInstance;
  label: string;
}

export interface SelectionDescription {
  title: string;
  prompt: string;
  // The primary button: Discard, Use or Add Targets.
  confirmLabel: string;
  min: number;
  max: number;
  items: SelectionItem[];
  // The engine's SelectAction, to be filled with the picked ids.
  template: SelectAction;
  cancel: Action | null;
}

function selectionPrompt(state: GameState, selection: PendingSelection, items: SelectionItem[]): string {
  const count = selection.min === selection.max ? `${selection.min}` : `up to ${selection.max}`;
  const then = selection.then;
  switch (then.kind) {
    case 'discard':
      return `Choose ${count} ${selection.max === 1 ? 'card' : 'cards'} to discard`;
    case 'use-card': {
      if (then.as) return `Choose ${count} hand cards to use as ${cardName(then.as)}`;
      const kinds = new Set(items.map((i) => i.card?.definitionId));
      const [only] = [...kinds];
      const what = kinds.size === 1 && only ? cardName(only) : 'card';
      const target = then.targets[0];
      return `Choose a ${what} to play${target ? ` at ${seatName(state.players, target.seatId)}` : ''}`;
    }
    case 'card-step':
      return `Choose ${count} more ${selection.max === 1 ? 'target' : 'targets'}`;
    case 'give':
      return `Choose ${selection.max === 1 ? 'a card' : 'cards'} to give`;
    case 'replace-judgment':
      return 'Choose a hand card to replace the judgment';
  }
}

const CONFIRM_LABELS: Record<PendingSelection['then']['kind'], string> = { discard: 'Discard', 'use-card': 'Use', 'card-step': 'Add Targets', give: 'Give', 'replace-judgment': 'Replace' };

// What the Selection window says, read off a pending selection the viewer owes. Null otherwise.
export function describeSelection(state: GameState, viewerSeatId: string, legal: readonly Action[]): SelectionDescription | null {
  const selection = state.pendingSelection;
  if (!selection || selection.seatId !== viewerSeatId) return null;
  const template = legal.find((a): a is SelectAction => a.kind === 'SelectAction');
  if (!template) return null;
  const items = selection.eligibleIds.map((id): SelectionItem => {
    if (selection.of === 'seats') return { id, label: seatName(state.players, id) };
    const card = findCard(state, id);
    return card ? { id, card, label: `${cardName(card.definitionId)} (${cardFaceLabel(card)})` } : { id, label: 'Card' };
  });
  return {
    title: selection.reason.kind === 'ability' ? cardName(selection.reason.abilityId) : 'Choose',
    prompt: selectionPrompt(state, selection, items),
    confirmLabel: CONFIRM_LABELS[selection.then.kind],
    min: selection.min,
    max: selection.max,
    items,
    template,
    cancel: legal.find((a) => a.kind === 'CancelSelectionAction') ?? null,
  };
}
