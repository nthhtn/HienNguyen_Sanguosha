import { pickACardTool } from '../shared/choices';

// Break: any other seat holding a card; the user discards one of its cards.
export const breakCard = pickACardTool({ id: 'break', name: 'Break', verb: 'discard' });
