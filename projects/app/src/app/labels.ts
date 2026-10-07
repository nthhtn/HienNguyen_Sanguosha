import { Action, CardInstance, ContentRegistry, GameState, JudgmentReader, Kingdom, Player, Target } from 'engine';
import { abilityName } from 'content';

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

// The name shown for a seat: its player's name, else its id in Title Case.
export function seatName(players: readonly Player[], seatId: string): string {
  return players.find((p) => p.seatId === seatId)?.name ?? titleCaseId(seatId);
}

export function targetLabel(target: Target, players: readonly Player[] = []): string {
  if (target.kind === 'seat') return seatName(players, target.seatId);
  return `${seatName(players, target.seatId)}'s ${capitalise(target.generalSlot)} General`;
}

export function cardIdDisplayName(cardDefinitionId: string): string {
  if (cardDefinitionId === 'hidden') return 'Hidden Card';
  return titleCaseId(cardDefinitionId);
}

export function cardDefinitionId(state: GameState, cardInstanceId: string): string | undefined {
  return findCardInstance(state, cardInstanceId)?.definitionId;
}

export function generalDisplayName(generalDefinitionId: string): string {
  if (generalDefinitionId === 'hidden') return 'Hidden General';
  return titleCaseId(generalDefinitionId);
}

// The force colour a seat is shown in: its kingdom once known, else 'none'
// (hidden, or a seat that belongs to no force).
export type Force = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'none';
export function forceOf(kingdom: Kingdom | undefined): Force {
  return kingdom === 'Wei' || kingdom === 'Shu' || kingdom === 'Wu' || kingdom === 'Qun' ? kingdom : 'none';
}

export function kingdomDisplayName(kingdom: Kingdom): string {
  return kingdom === 'hidden' ? 'Hidden' : kingdom;
}

export function actionLabel(action: Action, state: GameState, registry: ContentRegistry): string {
  switch (action.kind) {
    case 'DrawCardsAction':
      return `Draw ${action.count} Card${action.count === 1 ? '' : 's'}`;
    case 'PlayCardAction': {
      const name = cardDisplayName(state, registry, action.cardInstanceId);
      if (action.targets.length === 0) return `Play ${name}`;
      return `Play ${name} Targeting ${action.targets.map((t) => targetLabel(t, state.players)).join(', ')}`;
    }
    case 'ChooseGeneralsAction':
      return `Choose ${generalDisplayName(action.mainId)} (Main) and ${generalDisplayName(action.deputyId)} (Deputy)`;
    case 'RevealGeneralAction':
      return `Reveal ${capitalise(action.slot)} General`;
    case 'RespondAction':
      return `Respond with ${cardDisplayName(state, registry, action.cardInstanceId)}`;
    case 'PassAction':
      return 'Pass';
    case 'EndPhaseAction':
      return 'End Phase';
    case 'ChooseOptionAction':
      return 'Choose';
    case 'UseConversionAction':
      return conversionLabel(action, state, registry);
    case 'UseSkillAction':
      return action.owner.kind === 'general' ? `Use ${abilityName(action.owner.skillId)}` : 'Use Skill';
    case 'SelectAction':
      return 'Confirm';
    case 'CancelSelectionAction':
      return 'Cancel';
    case 'DiscardCardAction':
      return `Discard ${cardDisplayName(state, registry, action.cardInstanceId)}`;
  }
}

// "Use 2 Cards as Sha", with its targets for a play.
export function conversionLabel(action: Extract<Action, { kind: 'UseConversionAction' }>, state: GameState, registry: ContentRegistry): string {
  const owner = action.via.owner;
  const worn = owner.kind === 'equipment' ? findCardInstance(state, owner.cardInstanceId) : undefined;
  const conversion = worn && registry.cards.get(worn.definitionId)?.abilities?.conversions?.find((c) => c.id === action.via.conversionId);
  const base = conversion ? `Use ${conversion.cards} Cards as ${registry.cards.get(conversion.as)?.name ?? conversion.as}` : 'Use Cards';
  return action.targets.length > 0 ? `${base} Targeting ${action.targets.map((t) => targetLabel(t, state.players)).join(', ')}` : base;
}

const SUIT_SYMBOLS: Record<CardInstance['suit'], string> = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };
const FACE_RANKS: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

// "A ♦", "7 ♠", "Q ♥" — a card's printed corner.
export function cardFaceLabel(card: Pick<CardInstance, 'suit' | 'rank'>): string {
  return `${FACE_RANKS[card.rank] ?? card.rank} ${SUIT_SYMBOLS[card.suit]}`;
}

// What a judgment is for: the card's name, or the skill's.
export function judgmentReaderName(reader: JudgmentReader): string {
  return abilityName(reader.kind === 'card' ? reader.card.as : reader.owner.skillId);
}
