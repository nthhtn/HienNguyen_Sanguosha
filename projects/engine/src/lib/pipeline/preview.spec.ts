import { previewEffect } from './resolve';
import { createRng } from '../rng/rng';
import { GameState } from '../domain/types';
import { ContentRegistry, GameModeDefinition } from '../registry/types';
import { Effect } from './effects';

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;

// A mode whose only rule caps damage at 1 and cancels any heal.
const mode: GameModeDefinition = {
  id: 'stub',
  setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
  checkWinCondition: () => null,
  triggers: [
    {
      point: 'before:DamageEffect',
      condition: (_s, subject) => (subject as DamageStep).damage.amount > 1,
      effect: (_s, subject) => [{ ...(subject as DamageStep), damage: { ...(subject as DamageStep).damage, amount: 1 } }],
    },
    { point: 'before:HealEffect', condition: () => true, effect: () => [] },
  ],
};
const ctx = { registry: { cards: new Map(), generals: new Map() } as ContentRegistry, mode };
const state = {
  seats: [], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play', zones: [],
  pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
} as GameState;

describe('previewEffect', () => {
  const damage = (amount: number): Effect => ({ kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'a' }, amount, nature: 'normal' } });

  it('shows an effect as its before-triggers would rewrite it, without applying anything', () => {
    expect(previewEffect(state, damage(3), ctx)).toEqual(damage(1));
    expect(previewEffect(state, damage(1), ctx)).toEqual(damage(1));
  });

  it('is null when a before-trigger would cancel the effect', () => {
    expect(previewEffect(state, { kind: 'HealEffect', target: { kind: 'seat', seatId: 'a' }, amount: 1 }, ctx)).toBeNull();
  });
});
