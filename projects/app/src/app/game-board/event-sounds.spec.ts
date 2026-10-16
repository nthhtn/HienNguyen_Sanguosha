import { CardInstance, ContentRegistry, EngineEvent, GameState } from 'engine';
import { deathSoundsFor, soundsFor, voicesFor } from './event-sounds';

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

describe('voicesFor', () => {
  const registry = { generals: new Map([['m', { gender: 'male' }], ['f', { gender: 'female' }]]) } as unknown as ContentRegistry;
  const seat = (id: string, main: string, revealed: boolean) => ({
    id,
    generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: 'm', revealed: false } },
  });
  const state = { seats: [seat('s0', 'm', true), seat('s1', 'f', true), seat('s2', 'f', false)] } as unknown as GameState;
  const played = (seatId: string, as: string): EngineEvent => ({ kind: 'CardPlayedEvent', seatId, card: { as, physical: [] }, targets: [] }) as never;

  it('voices a Sha, a Shan and a dying seat by the seat’s gender', () => {
    expect(voicesFor([played('s0', 'sha'), played('s1', 'shan'), { kind: 'SeatDyingEvent', seatId: 's1' }], state, registry)).toEqual([
      { gender: 'male', voice: 'slash' },
      { gender: 'female', voice: 'dodge' },
      { gender: 'female', voice: 'sos' },
    ]);
  });

  it('is silent for other cards, and uses the male voice for a seat with both Generals face down', () => {
    expect(voicesFor([played('s0', 'peach')], state, registry)).toEqual([]);
    expect(voicesFor([played('s2', 'sha')], state, registry)).toEqual([{ gender: 'male', voice: 'slash' }]);
  });

  it('voices a Fire Attack or a Lightning Attack, played as a Sha, as a slash', () => {
    const fire = { kind: 'CardPlayedEvent', seatId: 's0', card: { as: 'sha', nature: 'fire', physical: [{ instanceId: 'f', definitionId: 'fire-attack', suit: 'heart', rank: 4 }] }, targets: [] } as never;
    expect(voicesFor([fire], state, registry)).toEqual([{ gender: 'male', voice: 'slash' }]);
  });

  it('says each line once per gender', () => {
    expect(voicesFor([played('s0', 'sha'), played('s0', 'sha')], state, registry)).toEqual([{ gender: 'male', voice: 'slash' }]);
  });
});

describe('deathSoundsFor', () => {
  const state = { seats: [{ id: 's0', kingdom: 'Wei' }, { id: 's1', kingdom: 'Qun' }, { id: 's2', kingdom: 'Wei' }, { id: 's3', kingdom: 'hidden' }] } as unknown as GameState;
  const out = (seatId: string): EngineEvent => ({ kind: 'SeatEliminatedEvent', seatId });

  it('cries by the eliminated seat’s kingdom, once per kingdom', () => {
    expect(deathSoundsFor([out('s0'), out('s1'), out('s2')], state)).toEqual(['death-wei', 'death-qun']);
  });

  it('is silent for a dying seat, and for an unrevealed kingdom', () => {
    expect(deathSoundsFor([{ kind: 'SeatDyingEvent', seatId: 's0' }, out('s3')], state)).toEqual([]);
  });
});
