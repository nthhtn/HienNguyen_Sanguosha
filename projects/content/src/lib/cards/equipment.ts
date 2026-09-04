import type { CardDefinition } from 'engine';

function makeEquipmentCard(id: string, name: string): CardDefinition {
  return {
    id,
    name,
    category: 'equipment',
    play: (_state, ctx) => [{ kind: 'MoveCardEffect', cardInstanceId: ctx.cardInstanceId, toZoneId: `${ctx.seatId}:equip` }],
  };
}

export const silverLionCard = makeEquipmentCard('silver-lion', 'Silver Lion');
export const greenDragonBladeCard = makeEquipmentCard('green-dragon-blade', 'Green Dragon Blade');
