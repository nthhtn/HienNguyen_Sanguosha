import type { Effect } from 'engine';
import type { DamageDealtEvent, PhaseChangedEvent } from 'engine';
import type { GeneralSkillSet } from './types';

// Every skill below answers "is this about my own seat?" from the `owner`
// context the engine passes in, which names the exact seat/slot the trigger was
// gathered for. It must NOT be derived by searching GameState for the general's
// own id: the same general can be held by more than one seat at once, and such
// a search would resolve to whichever holder comes first — double-firing for
// that seat and never firing for the others.

export const xiahouDunGeneral: GeneralSkillSet = {
  id: 'xiahou-dun',
  skills: [
    {
      id: 'ferocity',
      activation: 'auto',
      triggers: [
        {
          point: 'before:DamageEffect',
          condition: (_state, subject, owner) => {
            const effect = subject as Extract<Effect, { kind: 'DamageEffect' }>;
            return (
              !!owner &&
              effect.damage.source?.kind === 'seat' &&
              effect.damage.source.seatId === owner.seatId &&
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

export const sunShangxiangGeneral: GeneralSkillSet = {
  id: 'sun-shangxiang',
  skills: [
    {
      id: 'valor',
      activation: 'auto',
      triggers: [
        {
          point: 'after:DamageDealtEvent',
          condition: (_state, subject, owner) => {
            const event = subject as DamageDealtEvent;
            return !!owner && event.damage.source?.kind === 'seat' && event.damage.source.seatId === owner.seatId;
          },
          effect: (_state, _subject, owner) => {
            if (!owner) return [];
            return [{ kind: 'HealEffect', target: { kind: 'seat', seatId: owner.seatId }, amount: 1 }];
          },
        },
      ],
    },
  ],
};

export const zhugeLiangGeneral: GeneralSkillSet = {
  id: 'zhuge-liang',
  skills: [
    {
      id: 'insight',
      activation: 'auto',
      triggers: [
        {
          point: 'after:PhaseChangedEvent',
          condition: (_state, subject, owner) => {
            const event = subject as PhaseChangedEvent;
            return !!owner && event.phase === 'Draw' && event.seatId === owner.seatId;
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
