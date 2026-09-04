import type { GeneralDefinition, Effect } from 'engine';
import type { DamageDealtEvent, PhaseChangedEvent } from 'engine';
import { findSeatIdForGeneral } from '../shared/queries';

export const xiahouDunGeneral: GeneralDefinition = {
  id: 'xiahou-dun',
  kingdom: 'Wei',
  maxHp: 4,
  skills: [
    {
      id: 'ferocity',
      activation: 'auto',
      triggers: [
        {
          point: 'before:DamageEffect',
          condition: (state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            const seatId = findSeatIdForGeneral(state, 'xiahou-dun');
            return (
              !!seatId &&
              effect.damage.source?.kind === 'seat' &&
              effect.damage.source.seatId === seatId &&
              !!effect.damage.cause?.cardInstanceId
            );
          },
          effect: (_state, subject) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            return [{ ...effect, damage: { ...effect.damage, amount: effect.damage.amount + 1 } }];
          },
        },
      ],
    },
  ],
};

export const sunShangxiangGeneral: GeneralDefinition = {
  id: 'sun-shangxiang',
  kingdom: 'Wu',
  maxHp: 3,
  skills: [
    {
      id: 'valor',
      activation: 'auto',
      triggers: [
        {
          point: 'after:DamageDealtEvent',
          condition: (state, subject) => {
            const event = subject as DamageDealtEvent;
            const seatId = findSeatIdForGeneral(state, 'sun-shangxiang');
            return !!seatId && event.damage.source?.kind === 'seat' && event.damage.source.seatId === seatId;
          },
          effect: (state) => {
            const seatId = findSeatIdForGeneral(state, 'sun-shangxiang')!;
            return [{ kind: 'HealEffect', target: { kind: 'seat', seatId }, amount: 1 }];
          },
        },
      ],
    },
  ],
};

export const zhugeLiangGeneral: GeneralDefinition = {
  id: 'zhuge-liang',
  kingdom: 'Shu',
  maxHp: 3,
  skills: [
    {
      id: 'insight',
      activation: 'auto',
      triggers: [
        {
          point: 'after:PhaseChangedEvent',
          condition: (state, subject) => {
            const event = subject as PhaseChangedEvent;
            const seatId = findSeatIdForGeneral(state, 'zhuge-liang');
            return event.phase === 'Draw' && event.seatId === seatId;
          },
          effect: (_state, subject) => {
            const event = subject as PhaseChangedEvent;
            return [{ kind: 'DrawCardsEffect', seatId: event.seatId, count: 1 }];
          },
        },
      ],
    },
  ],
};
