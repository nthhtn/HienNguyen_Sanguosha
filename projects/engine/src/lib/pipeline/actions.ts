import { Target } from '../domain/types';

export type Action =
  | { kind: 'DrawCardsAction'; seatId: string; count: number }
  | { kind: 'PlayCardAction'; seatId: string; cardInstanceId: string; targets: Target[] }
  | { kind: 'RevealGeneralAction'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'RespondAction'; seatId: string; pendingResponseId: string; cardInstanceId: string }
  | { kind: 'PassAction'; seatId: string; pendingResponseId: string }
  | { kind: 'EndPhaseAction'; seatId: string };
