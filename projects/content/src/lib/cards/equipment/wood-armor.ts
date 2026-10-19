import type { Effect } from 'engine';
import { makeEquipmentCard } from './index';
import { stopsSha } from '../../shared/armor';
import { armorIgnored } from '../../shared/abilities';

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;

// Wood Armor: a plain Sha has no effect on its wearer (a Fire Attack or a
// Lightning Attack is not stopped), and Barbarians and Hail of Arrows skip it as
// a target. Fire damage dealt to its wearer is increased by 1, unless armour is
// ignored for it (Black Pommel's own hit, not a hit passed along a chain).
export const woodArmorCard = makeEquipmentCard('wood-armor', 'Wood Armor', 'armor', undefined, {
  abilities: {
    triggers: [
      stopsSha('wood-armor', (step) => !step.card.nature),
      {
        point: 'before:DamageEffect',
        condition: (state, subject, owner, registry) => {
          const { damage } = subject as DamageStep;
          return (
            owner?.kind === 'equipment' &&
            damage.nature === 'fire' &&
            damage.target.kind === 'seat' &&
            damage.target.seatId === owner.seatId &&
            !(registry && armorIgnored(state, damage, registry))
          );
        },
        effect: (_state, subject) => {
          const step = subject as DamageStep;
          return [{ ...step, damage: { ...step.damage, amount: step.damage.amount + 1 } }];
        },
      },
    ],
    modifiers: { untargetableBy: ['barbarians', 'hail-of-arrows'] },
  },
});
