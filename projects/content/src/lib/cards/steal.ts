import { pickACardTool } from '../shared/choices';

// Steal: another seat at distance 1 holding a card; the user takes one of its cards.
export const stealCard = pickACardTool({ id: 'steal', name: 'Steal', verb: 'take', maxDistance: 1 });
