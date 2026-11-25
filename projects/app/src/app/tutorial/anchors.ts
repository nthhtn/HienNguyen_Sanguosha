// The ids put in `data-tutorial` on board elements, one builder per anchor. A lesson step names its target
// with a builder (`anchor.hand()`), and the board puts the same string on the element with `tutorialAnchor`.
export type RevealSlot = 'main' | 'deputy';

export const anchor = {
  seat: (seatId: string) => `seat:${seatId}`,
  hp: (seatId: string) => `hp:${seatId}`,
  generals: (seatId: string) => `generals:${seatId}`,
  generalInfo: (seatId: string) => `general-info:${seatId}`,
  hand: () => 'hand',
  handCard: (definitionId: string) => `hand-card:${definitionId}`,
  playButton: (definitionId: string) => `play-button:${definitionId}`,
  endPhase: () => 'end-phase',
  phaseIndicator: () => 'phase-indicator',
  discardPile: () => 'discard-pile',
  actionHistory: () => 'action-history',
  targetSeat: (seatId: string) => `target-seat:${seatId}`,
  responseCard: (definitionId: string) => `response-card:${definitionId}`,
  responseConfirm: () => 'response-confirm',
  revealSlot: (slot: RevealSlot) => `reveal-slot:${slot}`,
  revealConfirm: () => 'reveal-confirm',
} as const;
