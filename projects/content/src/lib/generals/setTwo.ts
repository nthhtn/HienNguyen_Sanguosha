import type { GeneralDefinition, Effect } from 'engine';
import { findSeatIdForGeneral, getSeatDistance } from '../shared/queries';

export const dongZhuoGeneral: GeneralDefinition = {
  id: 'dong-zhuo',
  kingdom: 'Qun',
  maxHp: 4,
  skills: [
    {
      id: 'tyranny',
      activation: 'auto',
      triggers: [
        {
          point: 'before:HealEffect',
          condition: (state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'HealEffect' }>;
            const seatId = findSeatIdForGeneral(state, 'dong-zhuo');
            return !!seatId && effect.target.kind === 'seat' && effect.target.seatId === seatId;
          },
          effect: (_state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'HealEffect' }>;
            const reduced = Math.max(0, effect.amount - 1);
            return reduced === 0 ? [] : [{ ...effect, amount: reduced }];
          },
        },
      ],
    },
  ],
};

export const zhaoYunGeneral: GeneralDefinition = {
  id: 'zhao-yun',
  kingdom: 'Wei',
  maxHp: 4,
  skills: [
    {
      id: 'vanguard',
      activation: 'auto',
      triggers: [
        {
          point: 'before:DamageEffect',
          condition: (state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            const seatId = findSeatIdForGeneral(state, 'zhao-yun');
            if (!seatId || effect.damage.target.kind !== 'seat' || effect.damage.target.seatId !== seatId) return false;
            if (effect.damage.source?.kind !== 'seat') return false;
            return getSeatDistance(state, effect.damage.source.seatId, seatId) >= 2;
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

export const huangYueyingGeneral: GeneralDefinition = {
  id: 'huang-yueying',
  kingdom: 'Shu',
  maxHp: 3,
  skills: [],
};
