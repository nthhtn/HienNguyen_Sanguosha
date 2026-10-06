import type { CardDefinition } from 'engine';

// The turn flag Wine sets: the next proactive Sha this turn deals 1 extra damage.
export const WINE_FLAG = 'wine';

// Wine: once a turn, with no target, boosts the next Sha you play this turn.
// As a rescue (only on yourself, in your own dying round) it does nothing
// itself: the dying window heals you, and no turn flag is set.
export const wineCard: CardDefinition = {
  id: 'wine',
  name: 'Wine',
  category: 'basic',
  legalPlayTargets: (state) => ((state.turn.cardPlays?.['wine'] ?? 0) < 1 ? [[]] : []),
  play: (_state, ctx) => (ctx.respondingTo ? [] : [{ kind: 'SetTurnFlagEffect', flag: WINE_FLAG }]),
};
