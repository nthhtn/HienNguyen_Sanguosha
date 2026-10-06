import { skipPhaseTool } from '../shared/delayed';

// Capture: on another seat; judged in its Judgment Phase, anything but a heart skips its Play Phase.
export const captureCard = skipPhaseTool({ id: 'capture', name: 'Capture', skips: 'Play', spares: 'heart' });
