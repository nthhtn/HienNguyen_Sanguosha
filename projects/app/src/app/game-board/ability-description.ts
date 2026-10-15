import { Action, CardInstance, GameState, PendingSelection } from 'engine';
import { abilityHint, abilityName, cardDisplayData, generalDisplayData, selectionText, stepSelectionText } from 'content';
import { cardFaceLabel, cardIdDisplayName, generalDisplayName, seatName } from '../labels';
import type { MessageKey } from '../i18n/messages';
import { englishTranslator, localeOf, Translator } from '../i18n/translator';

type SelectAction = Extract<Action, { kind: 'SelectAction' }>;

const cardName = (definitionId: string, tr: Translator) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId, tr);
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
export function describeAsk(state: GameState, viewerSeatId: string, legal: readonly Action[], tr: Translator = englishTranslator): AskDescription | null {
  const choice = state.pendingChoice;
  if (!choice || choice.seatId !== viewerSeatId || choice.verb !== 'use' || choice.reason.kind !== 'ability') return null;
  const use = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'use');
  const decline = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'decline');
  if (!use || !decline) return null;
  const { abilityId, owner, targetSeatId } = choice.reason;
  const name = abilityName(abilityId);
  const target = targetSeatId && targetSeatId !== viewerSeatId ? seatName(state.players, targetSeatId, tr) : null;
  const shows = choice.options.find((o) => o.id === 'use')?.shows;
  const reveals = shows?.kind === 'use' && !!shows.reveals;
  const generalId = owner.kind === 'general' ? (state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot].generalDefinitionId ?? null) : null;
  const generalName = generalId ? (generalDisplayData(generalId)?.name ?? generalDisplayName(generalId, tr)) : null;
  const hint = abilityHint(abilityId, localeOf(tr));
  return {
    title: name,
    prompt: reveals && generalName
      ? target ? tr('ask.reveal.on', { general: generalName, ability: name, target }) : tr('ask.reveal', { general: generalName, ability: name })
      : target ? tr('ask.use.on', { ability: name, target }) : tr('ask.use', { ability: name }),
    hint: hint ? hint.replace('{target}', target ?? tr('ask.theTarget')) : null,
    card: owner.kind === 'equipment' ? (findCard(state, owner.cardInstanceId) ?? null) : null,
    generalId,
    useLabel: reveals ? tr('ask.button.revealAndUse') : tr('ask.button.use'),
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

function selectionPrompt(state: GameState, selection: PendingSelection, items: SelectionItem[], tr: Translator): string {
  const one = selection.max === 1;
  const count = selection.min === selection.max ? `${selection.min}` : tr('selection.upTo', { max: selection.max });
  const then = selection.then;
  switch (then.kind) {
    case 'discard':
      return tr(one ? 'selection.discard.one' : 'selection.discard.other', { count });
    case 'use-card': {
      if (then.as) return one ? tr('selection.useAs.one', { card: cardName(then.as, tr) }) : tr('selection.useAs.other', { count, card: cardName(then.as, tr) });
      const kinds = new Set(items.map((i) => i.card?.definitionId));
      const [only] = [...kinds];
      const what = kinds.size === 1 && only ? cardName(only, tr) : tr('selection.anyCard');
      const target = then.targets[0];
      return target ? tr('selection.play.at', { what, seat: seatName(state.players, target.seatId, tr) }) : tr('selection.play', { what });
    }
    case 'card-step':
      return tr(one ? 'selection.targets.one' : 'selection.targets.other', { count });
    case 'give':
      return tr(one ? 'selection.give.one' : 'selection.give.other');
    case 'replace-judgment':
      return tr('selection.replaceJudgment');
    case 'skill-step': {
      const what = selection.of === 'seats' ? 'seat' : 'card';
      return tr(`selection.skill.${what}.${one ? 'one' : 'other'}` as const, { count });
    }
  }
}

const CONFIRM_KEYS = {
  discard: 'selection.confirm.discard',
  'use-card': 'selection.confirm.use',
  'card-step': 'selection.confirm.cardStep',
  give: 'selection.confirm.give',
  'replace-judgment': 'selection.confirm.replace',
  'skill-step': 'selection.confirm.skillStep',
} as const satisfies Record<PendingSelection['then']['kind'], MessageKey>;

// What the Selection window says, read off a pending selection the viewer owes. Null otherwise.
export function describeSelection(state: GameState, viewerSeatId: string, legal: readonly Action[], tr: Translator = englishTranslator): SelectionDescription | null {
  const selection = state.pendingSelection;
  if (!selection || selection.seatId !== viewerSeatId) return null;
  const template = legal.find((a): a is SelectAction => a.kind === 'SelectAction');
  if (!template) return null;
  const items = selection.eligibleIds.map((id): SelectionItem => {
    if (selection.of === 'seats') return { id, label: seatName(state.players, id, tr) };
    const card = findCard(state, id);
    return card ? { id, card, label: tr('card.named', { name: cardName(card.definitionId, tr), face: cardFaceLabel(card) }) } : { id, label: tr('selection.cardFallback') };
  });
  const then = selection.then;
  const step = then.kind === 'skill-step' || then.kind === 'card-step' ? then.step.step : null;
  const text = (step ? stepSelectionText(step, localeOf(tr)) : null) ?? (selection.reason.kind === 'ability' ? selectionText(selection.reason.abilityId, localeOf(tr)) : null);
  const reason = selection.reason;
  return {
    title: reason.kind === 'ability' ? abilityName(reason.abilityId) : reason.kind === 'choice' ? cardName(reason.card.as, tr) : tr('selection.title'),
    prompt: text?.prompt ?? selectionPrompt(state, selection, items, tr),
    confirmLabel: text?.confirm ?? tr(CONFIRM_KEYS[selection.then.kind]),
    cancelLabel: text?.cancel ?? tr('selection.cancel'),
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
export function describeArrangement(state: GameState, viewerSeatId: string, legal: readonly Action[], tr: Translator = englishTranslator): ArrangeDescription | null {
  const arrangement = state.pendingArrangement;
  if (!arrangement || arrangement.seatId !== viewerSeatId) return null;
  const template = legal.find((a): a is ArrangeAction => a.kind === 'ArrangeCardsAction');
  if (!template) return null;
  return {
    title: arrangement.reason.kind === 'ability' ? abilityName(arrangement.reason.abilityId) : tr('arrange.title'),
    prompt: tr('arrange.prompt'),
    cards: arrangement.cardInstanceIds.map((id) => findCard(state, id)).filter((c): c is CardInstance => !!c),
    template,
  };
}
