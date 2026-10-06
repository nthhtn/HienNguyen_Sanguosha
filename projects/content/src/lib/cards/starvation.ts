import { skipPhaseTool } from '../shared/delayed';

// Starvation: on another seat at distance 1; judged in its Judgment Phase, anything but a club skips its Draw Phase.
export const starvationCard = skipPhaseTool({ id: 'starvation', name: 'Starvation', skips: 'Draw', spares: 'club', maxDistance: 1 });
