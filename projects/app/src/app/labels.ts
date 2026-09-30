import { Action, CardInstance, ContentRegistry, EngineEvent, GameState, Kingdom, Target } from 'engine';

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

function targetLabel(target: Target): string {
  if (target.kind === 'seat') return target.seatId;
  return `${target.seatId}'s ${target.generalSlot} general`;
}

export function generalDisplayName(generalDefinitionId: string): string {
  if (generalDefinitionId === 'hidden') return 'a hidden general';
  return generalDefinitionId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function kingdomDisplayName(kingdom: Kingdom): string {
  return kingdom === 'hidden' ? 'Hidden' : kingdom;
}

export function actionLabel(action: Action, state: GameState, registry: ContentRegistry): string {
  switch (action.kind) {
    case 'DrawCardsAction':
      return `Draw ${action.count} card${action.count === 1 ? '' : 's'}`;
    case 'PlayCardAction': {
      const name = cardDisplayName(state, registry, action.cardInstanceId);
      if (action.targets.length === 0) return `Play ${name}`;
      return `Play ${name} targeting ${action.targets.map(targetLabel).join(', ')}`;
    }
    case 'ChooseGeneralsAction':
      return `Choose ${generalDisplayName(action.mainId)} (main) and ${generalDisplayName(action.deputyId)} (deputy)`;
    case 'RevealGeneralAction':
      return `Reveal ${action.slot} general`;
    case 'RespondAction':
      return `Respond with ${cardDisplayName(state, registry, action.cardInstanceId)}`;
    case 'PassAction':
      return 'Pass';
    case 'EndPhaseAction':
      return 'End phase';
  }
}

export function eventLabel(event: EngineEvent): string {
  switch (event.kind) {
    case 'CardsDrawnEvent':
      return `${event.seatId} drew ${event.cardInstanceIds.length} card(s)`;
    case 'DamageDealtEvent':
      return `${targetLabel(event.damage.target)} took ${event.damage.amount} ${event.damage.nature} damage`;
    case 'PhaseChangedEvent':
      return `${event.seatId} entered the ${event.phase} phase`;
    case 'TurnAdvancedEvent':
      return `Turn ${event.turnNumber}: ${event.seatId}'s turn`;
    case 'GeneralRevealedEvent':
      return `${event.seatId} revealed their ${event.slot} general`;
    case 'HealEvent':
      return `${targetLabel(event.target)} healed ${event.amount}`;
    case 'CardMovedEvent':
      return `A card moved to ${event.toZoneId}`;
    case 'SeatEliminatedEvent':
      return `${event.seatId} was eliminated`;
    case 'GeneralsChosenEvent':
      return `${event.seatId} chose their generals`;
  }
}
