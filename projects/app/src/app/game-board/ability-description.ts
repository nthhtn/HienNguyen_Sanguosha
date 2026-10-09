import { Action, CardInstance, GameState, PendingSelection } from 'engine';
import { abilityHint, abilityName, cardDisplayData, generalDisplayData, selectionText, stepSelectionText } from 'content';
import { cardFaceLabel, cardIdDisplayName, generalDisplayName, seatName } from '../labels';

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
  // The General a skill belongs to, shown as its art (null for a worn card).
  generalId: string | null;
  // The Use button: "Use", or "Reveal and Use" when using it reveals a hidden General.
  useLabel: string;
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
  const name = abilityName(abilityId);
  const target = targetSeatId && targetSeatId !== viewerSeatId ? seatName(state.players, targetSeatId) : null;
  const on = target ? ` on ${target}` : '';
  const shows = choice.options.find((o) => o.id === 'use')?.shows;
  const reveals = shows?.kind === 'use' && !!shows.reveals;
  const generalId = owner.kind === 'general' ? (state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot].generalDefinitionId ?? null) : null;
  const generalName = generalId ? (generalDisplayData(generalId)?.name ?? generalDisplayName(generalId)) : null;
  const hint = abilityHint(abilityId);
  return {
    title: name,
    prompt: reveals && generalName ? `Reveal ${generalName} to use ${name}${on}?` : `Use ${name}${on}?`,
    hint: hint ? hint.replace('{target}', target ?? 'the target') : null,
    card: owner.kind === 'equipment' ? (findCard(state, owner.cardInstanceId) ?? null) : null,
    generalId,
    useLabel: reveals ? 'Reveal and Use' : 'Use',
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
  // The cancel button's label: "Cancel", or the skill's own ("Keep the Rest").
  cancelLabel: string;
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
      if (then.as) return selection.max === 1 ? `Choose a card to use as ${cardName(then.as)}` : `Choose ${count} hand cards to use as ${cardName(then.as)}`;
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
    case 'skill-step':
      return `Choose ${count} ${selection.of === 'seats' ? (selection.max === 1 ? 'seat' : 'seats') : selection.max === 1 ? 'card' : 'cards'}`;
  }
}

const CONFIRM_LABELS: Record<PendingSelection['then']['kind'], string> = { discard: 'Discard', 'use-card': 'Use', 'card-step': 'Add Targets', give: 'Give', 'replace-judgment': 'Replace', 'skill-step': 'Confirm' };

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
  const then = selection.then;
  const step = then.kind === 'skill-step' || then.kind === 'card-step' ? then.step.step : null;
  const text = (step ? stepSelectionText(step) : null) ?? (selection.reason.kind === 'ability' ? selectionText(selection.reason.abilityId) : null);
  const reason = selection.reason;
  return {
    title: reason.kind === 'ability' ? abilityName(reason.abilityId) : reason.kind === 'choice' ? cardName(reason.card.as) : 'Choose',
    prompt: text?.prompt ?? selectionPrompt(state, selection, items),
    confirmLabel: text?.confirm ?? CONFIRM_LABELS[selection.then.kind],
    cancelLabel: text?.cancel ?? 'Cancel',
    min: selection.min,
    max: selection.max,
    items,
    template,
    cancel: legal.find((a) => a.kind === 'CancelSelectionAction') ?? null,
  };
}

type ArrangeAction = Extract<Action, { kind: 'ArrangeCardsAction' }>;

export interface ArrangeDescription {
  title: string;
  prompt: string;
  // The cards being arranged, top of the draw pile first.
  cards: CardInstance[];
  template: ArrangeAction;
}

// What the Arrange window says, read off a pending arrangement the viewer owes. Null otherwise.
export function describeArrangement(state: GameState, viewerSeatId: string, legal: readonly Action[]): ArrangeDescription | null {
  const arrangement = state.pendingArrangement;
  if (!arrangement || arrangement.seatId !== viewerSeatId) return null;
  const template = legal.find((a): a is ArrangeAction => a.kind === 'ArrangeCardsAction');
  if (!template) return null;
  return {
    title: arrangement.reason.kind === 'ability' ? abilityName(arrangement.reason.abilityId) : 'Arrange',
    prompt: 'Put each card on top of the draw pile or at the bottom. Left to right is the order they go in.',
    cards: arrangement.cardInstanceIds.map((id) => findCard(state, id)).filter((c): c is CardInstance => !!c),
    template,
  };
}
