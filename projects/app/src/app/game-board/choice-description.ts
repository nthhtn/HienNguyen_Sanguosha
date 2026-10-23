import { Action, ChoiceOption, GameState, PendingChoice, Player, Seat } from 'engine';
import { abilityName, cardDisplayData, choicePromptText, generalDisplayData, seatPickText } from 'content';
import { englishTranslator, localeOf, Translator } from '../i18n/translator';
import { abilityDisplayName, cardFaceLabel, cardIdDisplayName, forceOf, generalDisplayName, seatName, suitLabel } from '../labels';
import type { MessageKey } from '../i18n/messages';
import type { ChoiceDialogOption } from './choice-dialog';

// The wording of the engine's fixed label options, by the option's id. The engine still
// supplies its English text; a label is only replaced when the English template, filled with
// the numbers of that text, gives the text back, so a label this table does not know keeps
// showing the engine's own words.
const LABEL_OPTIONS: Record<string, { key: MessageKey; params: (numbers: string[]) => Record<string, string> }> = {
  'draw-x': { key: 'choice.label.drawXDiscard1', params: (n) => ({ n: n[0] }) },
  'draw-1': { key: 'choice.label.draw1DiscardX', params: (n) => ({ n: n[1] }) },
  'lose-hp': { key: 'choice.label.loseHp', params: () => ({}) },
  'reduce-max-hp': { key: 'choice.label.reduceMaxHp', params: () => ({}) },
  cancel: { key: 'selection.cancel', params: () => ({}) },
  pass: { key: 'choice.label.pass', params: () => ({}) },
  recover: { key: 'choice.label.recover', params: () => ({}) },
  draw: { key: 'choice.label.draw2', params: () => ({}) },
  believe: { key: 'choice.label.believe', params: () => ({}) },
  doubt: { key: 'choice.label.doubt', params: () => ({}) },
  discard: { key: 'choice.label.discard2', params: () => ({}) },
  damage: { key: 'choice.label.damage1', params: () => ({}) },
};

// The language's wording of a label the engine sent, found from its English text alone (the
// Action History has no option id); the text itself when no known label matches.
export function translateLabelText(text: string, tr: Translator): string {
  const numbers = text.match(/\d+/g) ?? [];
  for (const entry of Object.values(LABEL_OPTIONS)) {
    const params = entry.params(numbers);
    if (englishTranslator(entry.key, params) === text) return tr(entry.key, params);
  }
  return text;
}

// The labels of a Tool's secret look (Ascertain), by option id; as LABEL_OPTIONS, only when the
// engine's English text is the one expected.
const LOOK_LABELS: Record<string, MessageKey> = {
  main: 'choice.label.mainGeneral',
  deputy: 'choice.label.deputyGeneral',
  hand: 'choice.label.handCards',
  done: 'choice.label.done',
};

function labelOptionText(optionId: string | undefined, text: string, tr: Translator): string {
  if (!optionId) return text;
  const look = Object.prototype.hasOwnProperty.call(LOOK_LABELS, optionId) ? LOOK_LABELS[optionId] : undefined;
  if (look && englishTranslator(look) === text) return tr(look);
  const form = optionId.split('/');
  if (form.length === 2) {
    // Zuo Ci's pick of a Form's skill: "Skill (General)".
    const locale = localeOf(tr);
    const general = generalDisplayData(form[0])?.name ?? form[0];
    if (text !== `${abilityName(form[1])} (${general})`) return text;
    return tr('choice.label.form', { skill: abilityName(form[1], locale), general: generalDisplayData(form[0], locale)?.name ?? form[0] });
  }
  const entry = Object.prototype.hasOwnProperty.call(LABEL_OPTIONS, optionId) ? LABEL_OPTIONS[optionId] : undefined;
  if (!entry) return text;
  const params = entry.params(text.match(/\d+/g) ?? []);
  return englishTranslator(entry.key, params) === text ? tr(entry.key, params) : text;
}

export interface ChoiceDescription {
  // The Tool's name, e.g. "Steal".
  title: string;
  // What to do, e.g. "Choose a card to take from Seat 1".
  prompt: string;
  // The primary button: "Take", "Discard", "Give" or "Choose".
  confirmLabel: string;
  // The label of a "decline" option, when the choice has one (Gender Swords: "Let Seat 1 Draw").
  declineLabel?: string;
}

const cardName = (definitionId: string, tr: Translator) => cardDisplayData(definitionId, localeOf(tr))?.name ?? cardIdDisplayName(definitionId, tr);

// "Choose a card to take from Seat 1", or without "from ..." when no seat is named.
const chooseCardTo = (tr: Translator, verb: PendingChoice['verb'], from: string | null): string =>
  from === null ? tr(`choice.cardTo.${verb}` as const) : tr(`choice.cardTo.${verb}.from` as const, { seat: from });

// What the Choice window says, read off the pending choice. Null unless the
// viewer is the one choosing.
export function describeChoice(state: GameState, viewerSeatId: string, tr: Translator = englishTranslator): ChoiceDescription | null {
  const choice = state.pendingChoice;
  if (!choice || choice.seatId !== viewerSeatId) return null;
  // A claim to believe or doubt (Bewilder).
  if (choice.reason.kind === 'ability' && choice.reason.cardId && choice.verb === 'pick') {
    const claimer = seatName(state.players, choice.reason.owner.seatId, tr);
    return { title: abilityDisplayName(choice.reason.abilityId, tr), prompt: tr('choice.claim', { claimer, card: cardName(choice.reason.cardId, tr) }), confirmLabel: tr('choice.confirm.choose') };
  }
  // A skill's take from, or discard of, another seat's card (Feedback, Sudden Attack).
  if (choice.reason.kind === 'ability' && (choice.verb === 'take' || choice.verb === 'discard')) {
    const from = choice.reason.targetSeatId ? seatName(state.players, choice.reason.targetSeatId, tr) : null;
    const take = choice.verb === 'take';
    return { title: abilityDisplayName(choice.reason.abilityId, tr), prompt: chooseCardTo(tr, choice.verb, from), confirmLabel: tr(take ? 'choice.confirm.take' : 'choice.confirm.discard') };
  }
  // A skill's pick (a seat, a suit, one of several labels) or who gets given cards.
  if (choice.reason.kind === 'ability' && (choice.verb === 'pick' || choice.verb === 'give')) {
    const title = abilityDisplayName(choice.reason.abilityId, tr);
    if (choice.verb === 'give') return { title, prompt: tr('choice.give'), confirmLabel: tr('choice.confirm.give') };
    const fixed = choicePromptText(choice.reason.abilityId, localeOf(tr));
    // A seat pick keeps the seat wording (Exile, Alliance); a mixed or label pick uses its own prompt.
    const onlySeats = choice.options.every((o) => o.shows.kind === 'seat');
    if (fixed && !(onlySeats && seatPickText(choice.reason.abilityId, localeOf(tr)))) {
      // A fixed prompt may name the seat the skill was used on (Brave Spirit's mode).
      const named = choice.reason.targetSeatId ? seatName(state.players, choice.reason.targetSeatId, tr) : tr('choice.aSeat');
      return { title, prompt: fixed.replace('{target}', named), confirmLabel: tr('choice.confirm.choose') };
    }
    const kinds = new Set(choice.options.map((o) => o.shows.kind));
    const only = kinds.size === 1 ? [...kinds][0] : null;
    // A skill's own words for its seat pick (Rouse the Tiger), its target named.
    const own = seatPickText(choice.reason.abilityId, localeOf(tr));
    const target = choice.reason.targetSeatId;
    // A card the options carry (Bequeathed Strategy: the card being given) is named with its face.
    const carried = choice.options.find((o) => o.card)?.card;
    const cardText = carried ? `${cardName(carried.definitionId, tr)} (${cardFaceLabel(carried)})` : tr('choice.aCard');
    const seatPrompt = own ? own.replace('{target}', target ? seatName(state.players, target, tr) : tr('choice.aSeat')).replace('{card}', cardText) : tr('choice.pick.seat');
    const prompt = only === 'seat' ? seatPrompt : only === 'suit' ? tr('choice.pick.suit') : tr('choice.pick.one');
    return { title, prompt, confirmLabel: tr('choice.confirm.choose') };
  }
  if (choice.reason.kind !== 'choice') return null;
  const { card, targetSeatId } = choice.reason;
  // A Tool's secret look at another seat (Ascertain): what to look at, then the cards or the General shown.
  if (choice.verb === 'pick' && choice.secret && targetSeatId) {
    const seat = seatName(state.players, targetSeatId, tr);
    const shows = choice.options.map((o) => o.shows.kind);
    const prompt = shows.includes('general')
      ? tr('choice.look.general', { seat })
      : shows.includes('card')
        ? tr('choice.look.hand', { seat })
        : choice.options.every((o) => o.id === 'done')
          ? tr('choice.look.emptyHand', { seat })
          : tr('choice.look.pick', { seat });
    // Its second stage (the choice id `ascertain-look-…`) only shows what was picked, closed with Done.
    const looking = choice.id.startsWith('ascertain-look-');
    return { title: cardName(card.as, tr), prompt, confirmLabel: tr(looking ? 'choice.label.done' : 'choice.confirm.choose') };
  }
  // Choosing among your own cards (Gender Swords): discard one, or let the user draw.
  if (targetSeatId === viewerSeatId && choice.options.some((o) => o.shows.kind === 'decline')) {
    const user = seatName(state.players, choice.reason.userSeatId, tr);
    return { title: cardName(card.as, tr), prompt: tr('choice.discardOrDraw', { user }), confirmLabel: tr('choice.confirm.discard'), declineLabel: tr('choice.letDraw', { user }) };
  }
  const from = targetSeatId ? seatName(state.players, targetSeatId, tr) : null;
  return {
    title: cardName(card.as, tr),
    prompt: chooseCardTo(tr, choice.verb, from),
    confirmLabel: tr(choice.verb === 'take' ? 'choice.confirm.take' : 'choice.confirm.discard'),
  };
}

// An option's label: a hand by its owner and size, a card by its name and face.
export function choiceOptionLabel(shows: ChoiceOption['shows'], players: readonly Player[], declineLabel?: string, tr: Translator = englishTranslator, optionId?: string): string {
  if (shows.kind === 'seat') return seatName(players, shows.seatId, tr);
  if (shows.kind === 'suit') return suitLabel(shows.suit, tr);
  if (shows.kind === 'label') return labelOptionText(optionId, shows.text, tr);
  if (shows.kind === 'use') return tr('choice.option.use');
  if (shows.kind === 'decline') return declineLabel ?? tr('choice.option.decline');
  if (shows.kind === 'general') return generalDisplayData(shows.generalId, localeOf(tr))?.name ?? generalDisplayName(shows.generalId, tr);
  if (shows.kind === 'hidden-hand') {
    return tr(shows.count === 1 ? 'choice.option.hand.one' : 'choice.option.hand.other', { seat: seatName(players, shows.seatId, tr), count: shows.count });
  }
  return tr('card.named', { name: cardName(shows.card.definitionId, tr), face: cardFaceLabel(shows.card) });
}

// What the Choice window offers: the engine's options it can legally pick. A
// hand shows as one face-down card per card in it; every one of them picks the
// hand, and the engine takes a card from it at random.
export function choiceDialogOptions(
  options: readonly ChoiceOption[],
  legal: readonly Action[],
  players: readonly Player[],
  declineLabel?: string,
  seats: readonly Seat[] = [],
  tr: Translator = englishTranslator
): ChoiceDialogOption[] {
  return options.flatMap((option): ChoiceDialogOption[] => {
    const action = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === option.id);
    if (!action) return [];
    if (option.shows.kind === 'hidden-hand') {
      return Array.from({ length: option.shows.count }, (_, i) => ({ id: `${option.id}#${i + 1}`, action, faceDown: true as const, label: tr('choice.option.handCard', { n: i + 1 }) }));
    }
    if (option.shows.kind === 'card') {
      return [{ id: option.id, action, card: option.shows.card, label: choiceOptionLabel(option.shows, players, undefined, tr, option.id) }];
    }
    const label = choiceOptionLabel(option.shows, players, declineLabel, tr, option.id);
    if (option.shows.kind === 'seat') {
      const seatId = option.shows.seatId;
      return [{ id: option.id, action, label, force: forceOf(seats.find((s) => s.id === seatId)?.kingdom) }];
    }
    if (option.shows.kind === 'suit') return [{ id: option.id, action, label, suit: option.shows.suit }];
    if (option.shows.kind === 'general') return [{ id: option.id, action, label, generalId: option.shows.generalId }];
    return [{ id: option.id, action, label }];
  });
}
