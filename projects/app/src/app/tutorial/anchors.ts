// The ids put in `data-tutorial` on board elements, one builder per anchor. A lesson step names its target
// with a builder (`anchor.hand()`), and the board puts the same string on the element with `appTutorialAnchor`.
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
  // The phone's History button, which opens the panel holding the Discard Pile and the Action History.
  historyButton: () => 'history-button',
  targetSeat: (seatId: string) => `target-seat:${seatId}`,
  responseCard: (definitionId: string) => `response-card:${definitionId}`,
  responseConfirm: () => 'response-confirm',
  // A window as a whole, for a step whose action takes several clicks inside it (tick a General, then Confirm).
  responseDialog: () => 'response-dialog',
  revealSlot: (slot: RevealSlot) => `reveal-slot:${slot}`,
  revealConfirm: () => 'reveal-confirm',
  revealDialog: () => 'reveal-dialog',
  discardDialog: () => 'discard-dialog',
} as const;

// Whether `id` is one a builder above makes: the board and the lessons agree on the ids through the builders alone.
// A builder with a parameter makes its id from a prefix, so an id counts when it has that prefix and a value after it.
export function isAnchorId(id: string): boolean {
  return (Object.values(anchor) as Array<(value: string) => string>).some((build) => {
    if (build.length === 0) return id === build('');
    const prefix = build('');
    return id.startsWith(prefix) && id.length > prefix.length;
  });
}
