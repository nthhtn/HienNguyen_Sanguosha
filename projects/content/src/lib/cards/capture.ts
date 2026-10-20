import type { CardInstance, ContentRegistry, GameState } from 'engine';
import { skipPhaseOutcome, skipPhaseTool } from '../shared/delayed';

// Capture: on another seat; judged in its Judgment Phase, anything but a heart skips its Play Phase.
export const captureCard = skipPhaseTool({ id: 'capture', name: 'Capture', skips: 'Play', spares: 'heart' });

export const captureOutcome = (state: GameState, seatId: string, judged: CardInstance, registry: ContentRegistry) => skipPhaseOutcome(state, seatId, judged, 'heart', registry);
