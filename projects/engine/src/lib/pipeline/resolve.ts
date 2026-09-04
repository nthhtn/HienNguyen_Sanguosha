import { GameState, GameEvent } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Action } from './actions';
import { applyEffect, Effect } from './effects';
import { lookupCard } from '../registry/lookup';

export interface EngineContext {
  registry: ContentRegistry;
  mode: GameModeDefinition;
}

export interface ResolveResult {
  state: GameState;
  events: GameEvent[];
}

export function resolve(state: GameState, action: Action, ctx: EngineContext): ResolveResult {
  switch (action.kind) {
    case 'DrawCardsAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      return applyEffect(state, { kind: 'DrawCardsEffect', seatId: action.seatId, count: action.count });
    }
    case 'PlayCardAction': {
      const seat = state.seats.find((s) => s.id === action.seatId);
      if (!seat) throw new Error(`Unknown seat: ${action.seatId}`);
      const handZone = state.zones.find((z) => z.id === seat.hand.zoneId);
      const cardInHand = handZone?.cards.find((c) => c.instanceId === action.cardInstanceId);
      if (!cardInHand) {
        throw new Error(`Seat ${action.seatId} does not hold card ${action.cardInstanceId}`);
      }

      for (const target of action.targets) {
        if (target.kind === 'seat') {
          const targetSeat = state.seats.find((s) => s.id === target.seatId);
          if (!targetSeat || targetSeat.eliminated) {
            throw new Error(`Illegal target seat: ${target.seatId}`);
          }
        }
      }

      const cardDefinition = lookupCard(ctx.registry, cardInHand.definitionId);
      const effects = cardDefinition.play(state, {
        seatId: action.seatId,
        cardInstanceId: action.cardInstanceId,
        targets: action.targets,
      }) as Effect[];

      let currentState = state;
      let allEvents: GameEvent[] = [];
      for (const effect of effects) {
        const result = applyEffect(currentState, effect);
        currentState = result.state;
        allEvents = [...allEvents, ...result.events];
      }
      return { state: currentState, events: allEvents };
    }
    default:
      throw new Error(`Action kind not yet handled by resolve(): ${action.kind}`);
  }
}
