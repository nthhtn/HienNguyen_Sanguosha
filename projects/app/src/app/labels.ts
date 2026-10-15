import { Action, CardInstance, ContentRegistry, GameState, JudgmentReader, Kingdom, Player, Target, findSkill } from 'engine';
import { abilityName } from 'content';
import type { MessageKey } from './i18n/messages';
import { englishTranslator, Translator } from './i18n/translator';

function findCardInstance(state: GameState, cardInstanceId: string): CardInstance | undefined {
  for (const zone of state.zones) {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (found) return found;
  }
  return undefined;
}

function cardDisplayName(state: GameState, registry: ContentRegistry, cardInstanceId: string): string {
  const card = findCardInstance(state, cardInstanceId);
  if (!card) return cardInstanceId;
  return registry.cards.get(card.definitionId)?.name ?? card.definitionId;
}

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// "seat-0" → "Seat 0": the fallback for a seat with no player name.
function titleCaseId(id: string): string {
  return id.split('-').map(capitalise).join(' ');
}

// The name shown for a seat: its player's name, else "Seat N" in the viewer's
// language for a `seat-<n>` id, else the id in Title Case.
export function seatName(players: readonly Player[], seatId: string, tr: Translator = englishTranslator): string {
  const numbered = /^seat-(\d+)$/.exec(seatId);
  return players.find((p) => p.seatId === seatId)?.name ?? (numbered ? tr('label.seat', { n: numbered[1] }) : titleCaseId(seatId));
}

export function targetLabel(target: Target, players: readonly Player[] = [], tr: Translator = englishTranslator): string {
  const seat = seatName(players, target.seatId, tr);
  if (target.kind === 'seat') return seat;
  return tr(target.generalSlot === 'main' ? 'label.target.main' : 'label.target.deputy', { seat });
}

export function cardIdDisplayName(cardDefinitionId: string, tr: Translator = englishTranslator): string {
  if (cardDefinitionId === 'hidden') return tr('label.hiddenCard');
  return titleCaseId(cardDefinitionId);
}

export function cardDefinitionId(state: GameState, cardInstanceId: string): string | undefined {
  return findCardInstance(state, cardInstanceId)?.definitionId;
}

export function generalDisplayName(generalDefinitionId: string, tr: Translator = englishTranslator): string {
  if (generalDefinitionId === 'hidden') return tr('label.hiddenGeneral');
  return titleCaseId(generalDefinitionId);
}

// The force colour a seat is shown in: its kingdom once known, else 'none'
// (hidden, or a seat that belongs to no force).
export type Force = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'none';
export function forceOf(kingdom: Kingdom | undefined): Force {
  return kingdom === 'Wei' || kingdom === 'Shu' || kingdom === 'Wu' || kingdom === 'Qun' ? kingdom : 'none';
}

const KINGDOM_KEYS = {
  hidden: 'label.kingdom.hidden',
  Wei: 'label.kingdom.Wei',
  Shu: 'label.kingdom.Shu',
  Wu: 'label.kingdom.Wu',
  Qun: 'label.kingdom.Qun',
} as const satisfies Record<Kingdom, MessageKey>;

// A kingdom outside the five known (data cast) is shown as it is.
export function kingdomDisplayName(kingdom: Kingdom, tr: Translator = englishTranslator): string {
  const key = KINGDOM_KEYS[kingdom];
  return key ? tr(key) : kingdom;
}

export function actionLabel(action: Action, state: GameState, registry: ContentRegistry, tr: Translator = englishTranslator): string {
  switch (action.kind) {
    case 'DrawCardsAction':
      return tr(action.count === 1 ? 'label.action.draw.one' : 'label.action.draw.other', { n: action.count });
    case 'PlayCardAction': {
      const card = cardDisplayName(state, registry, action.cardInstanceId);
      if (action.targets.length === 0) return tr('label.action.play', { card });
      return tr('label.action.playTargeting', { card, targets: action.targets.map((t) => targetLabel(t, state.players, tr)).join(', ') });
    }
    case 'ChooseGeneralsAction':
      return tr('label.action.chooseGenerals', { main: generalDisplayName(action.mainId, tr), deputy: generalDisplayName(action.deputyId, tr) });
    case 'RevealGeneralAction':
      return tr(action.slot === 'main' ? 'label.action.revealMain' : 'label.action.revealDeputy');
    case 'RespondAction':
      return tr('label.action.respond', { card: cardDisplayName(state, registry, action.cardInstanceId) });
    case 'PassAction':
      return tr('label.action.pass');
    case 'EndPhaseAction':
      return tr('label.action.endPhase');
    case 'ChooseOptionAction':
      return tr('label.action.choose');
    case 'UseConversionAction':
      return conversionLabel(action, state, registry, tr);
    case 'UseSkillAction':
      return action.owner.kind === 'general' ? tr('label.action.useSkill', { ability: abilityName(action.owner.skillId) }) : tr('label.action.useSkillGeneric');
    case 'ArrangeCardsAction':
      return tr('label.action.arrange');
    case 'SelectAction':
      return tr('label.action.confirm');
    case 'CancelSelectionAction':
      return tr('label.action.cancel');
    case 'DiscardCardAction':
      return tr('label.action.discard', { card: cardDisplayName(state, registry, action.cardInstanceId) });
  }
}

// An action's label split where its targets begin, so the targets can be shown
// richly: "Play Sha Targeting" + [Seat 1]. Null for an action with no seat to name.
export function targetingParts(action: Action, state: GameState, registry: ContentRegistry, tr: Translator = englishTranslator): { prefix: string; targets: Target[] } | null {
  if ((action.kind !== 'PlayCardAction' && action.kind !== 'UseConversionAction') || action.targets.length === 0) return null;
  return { prefix: tr('label.targetingPrefix', { label: actionLabel({ ...action, targets: [] }, state, registry, tr) }), targets: action.targets };
}

// "Use 2 Cards as Sha" (a worn card's), "As Sha · Fighting Saint" (a skill's),
// with its targets for a play.
export function conversionLabel(
  action: Extract<Action, { kind: 'UseConversionAction' }>,
  state: GameState,
  registry: ContentRegistry,
  tr: Translator = englishTranslator
): string {
  const owner = action.via.owner;
  const cardName = (id: string) => registry.cards.get(id)?.name ?? id;
  let base = tr('label.useCards');
  if (owner.kind === 'equipment') {
    const worn = findCardInstance(state, owner.cardInstanceId);
    const conversion = worn && registry.cards.get(worn.definitionId)?.abilities?.conversions?.find((c) => c.id === action.via.conversionId);
    if (conversion) base = tr('label.useCardsAs', { count: conversion.cards, card: cardName(conversion.as) });
  } else {
    const generalId = state.seats.find((s) => s.id === owner.seatId)?.generals?.[owner.slot].generalDefinitionId;
    const skill = (generalId ? registry.generals.get(generalId)?.skills.find((s) => s.id === owner.skillId) : undefined) ?? findSkill(registry, owner.skillId);
    const conversion = skill?.conversions?.find((c) => c.id === action.via.conversionId);
    if (conversion) base = tr('label.asCardVia', { card: cardName(conversion.as), ability: abilityName(owner.skillId) });
  }
  return action.targets.length > 0 ? tr('label.withTargets', { base, targets: action.targets.map((t) => targetLabel(t, state.players, tr)).join(', ') }) : base;
}

const SUIT_SYMBOLS: Record<CardInstance['suit'], string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };
// "♥": a suit's symbol alone.
export function suitSymbol(suit: CardInstance['suit']): string {
  return SUIT_SYMBOLS[suit];
}

const SUIT_KEYS = {
  spade: 'label.suit.spade',
  heart: 'label.suit.heart',
  club: 'label.suit.club',
  diamond: 'label.suit.diamond',
} as const satisfies Record<CardInstance['suit'], MessageKey>;

// "♥ Heart": a suit as an option to pick.
export function suitLabel(suit: CardInstance['suit'], tr: Translator = englishTranslator): string {
  return tr('label.suitLabel', { symbol: SUIT_SYMBOLS[suit], name: tr(SUIT_KEYS[suit]) });
}
const FACE_RANKS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

// "A ♦", "7 ♠", "Q ♥" — a card's printed corner.
export function cardFaceLabel(card: Pick<CardInstance, 'suit' | 'rank'>): string {
  return `${FACE_RANKS[card.rank] ?? card.rank} ${SUIT_SYMBOLS[card.suit]}`;
}

// What a judgment is for: the card's name, or the skill's.
export function judgmentReaderName(reader: JudgmentReader): string {
  return abilityName(reader.kind === 'card' ? reader.card.as : reader.owner.skillId);
}
