import { CardInstance, EngineEvent } from 'engine';
import { soundsFor } from './event-sounds';

const moved = (definitionId: string, toZoneId: string): EngineEvent => ({
  kind: 'CardMovedEvent',
  cardInstanceId: 'c1',
  fromZoneId: 'seat-0:hand',
  toZoneId,
  card: { instanceId: 'c1', definitionId, suit: 'spade', rank: 1 } as CardInstance,
});

describe('soundsFor', () => {
  it.each([
    ['crossbow', 'weapon'],
    ['silver-lion', 'armor'],
    ['red-hare', 'mount'],
    ['di-lu', 'mount'],
  ])('equipping %s sounds as %s', (id, sound) => {
    expect(soundsFor([moved(id, 'seat-0:equip')])).toEqual([sound]);
  });

  it('is silent for a card moving anywhere but into an equip zone', () => {
    expect(soundsFor([moved('crossbow', 'discard'), moved('crossbow', 'seat-0:hand')])).toEqual([]);
  });

  it('injures on damage and on plain HP loss, and heals on recovery', () => {
    expect(soundsFor([{ kind: 'DamageDealtEvent', damage: {} } as never, { kind: 'HpLostEvent', seatId: 's', amount: 1 }])).toEqual(['injure']);
    expect(soundsFor([{ kind: 'HealEvent', target: { kind: 'seat', seatId: 's' }, amount: 1 }])).toEqual(['heal']);
  });

  it('makes each sound once per stretch of log', () => {
    expect(soundsFor([moved('crossbow', 'seat-0:equip'), moved('axe', 'seat-1:equip')])).toEqual(['weapon']);
  });
});
