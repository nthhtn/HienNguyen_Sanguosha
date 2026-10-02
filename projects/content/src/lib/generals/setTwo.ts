import type { Effect } from 'engine';
import { getSeatDistance } from '../shared/queries';
import type { GeneralSkillSet } from './types';

// See the note in setOne.ts: "which seat am I" comes from the `owner` context
// the engine passes in, never from searching GameState for this general's id.

export const zhaoYunGeneral: GeneralSkillSet = {
  id: 'zhao-yun',
  skills: [
    {
      id: 'vanguard',
      activation: 'auto',
      triggers: [
        {
          point: 'before:DamageEffect',
          condition: (state, subject, owner) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            if (!owner) return false;
            if (effect.damage.target.kind !== 'seat' || effect.damage.target.seatId !== owner.seatId) return false;
            if (effect.damage.source?.kind !== 'seat') return false;
            return getSeatDistance(state, effect.damage.source.seatId, owner.seatId) >= 2;
          },
          effect: (_state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            return [{ ...effect, damage: { ...effect.damage, amount: Math.max(0, effect.damage.amount - 1) } }];
          },
        },
      ],
    },
  ],
};

export const huangYueyingGeneral: GeneralSkillSet = {
  id: 'huang-yueying',
  skills: [],
};
