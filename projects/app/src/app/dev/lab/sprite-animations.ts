import { SpriteId } from 'content';
import { Damage, GameState } from 'engine';
import { setHp } from '../recipe';
import type { MessageKey } from '../../i18n/messages';
import { LabAnimation, LabParamValue, seatParam, withEvents } from './lab-animation';

type P = Record<string, LabParamValue>;
const target = (p: P) => p['target'] as string;
const seatTarget = (seatId: string) => ({ kind: 'seat' as const, seatId });
const hpOf = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
const chain = (s: GameState, seatIds: string[]): GameState => ({ ...s, seats: s.seats.map((x) => (seatIds.includes(x.id) ? { ...x, chained: true as const } : x)) });

// The seats are no longer chained (the flag is absent, never false).
const unchain = (s: GameState, seatIds: string[]): GameState => ({
  ...s,
  seats: s.seats.map((x) => {
    if (!seatIds.includes(x.id)) return x;
    const { chained: _chained, ...rest } = x;
    return rest;
  }),
});

// A hit of 1 on the target, with the card it came from (the card decides the slash pictures).
function hit(seatId: string, nature: Damage['nature'], cardAs?: string, chained?: true): Damage {
  return {
    source: seatTarget('seat-0'),
    target: seatTarget(seatId),
    amount: 1,
    nature,
    ...(cardAs ? { cause: { card: { as: cardAs, colour: 'black' as const, physical: [] } } } : {}),
    ...(chained ? { chained } : {}),
  };
}

const damage = (id: string, title: MessageKey, description: MessageKey, nature: Damage['nature'], cardAs?: string): LabAnimation => ({
  id,
  group: 'Sprite Effects',
  title,
  description,
  params: [seatParam('target', 'preview.param.target', 'seat-1')],
  play: (t, p) => withEvents(t, [{ kind: 'DamageDealtEvent', damage: hit(target(p), nature, cardAs) }], (s) => setHp(s, target(p), hpOf(s, target(p)) - 1)),
});

// Keyed by every sprite sheet: adding a sheet to the game breaks this until the lab has an entry for it.
const BY_SPRITE: Record<SpriteId, LabAnimation> = {
  slash: damage('sprite-slash', 'preview.sprite-slash.title', 'preview.sprite-slash.description', 'normal', 'sha'),
  'slash-fire': damage('sprite-slash-fire', 'preview.sprite-slash-fire.title', 'preview.sprite-slash-fire.description', 'fire', 'fire-attack'),
  'slash-lightning': damage('sprite-slash-lightning', 'preview.sprite-slash-lightning.title', 'preview.sprite-slash-lightning.description', 'thunder', 'lightning-attack'),
  damage: damage('sprite-damage', 'preview.sprite-damage.title', 'preview.sprite-damage.description', 'normal'),
  fire: damage('sprite-fire', 'preview.sprite-fire.title', 'preview.sprite-fire.description', 'fire'),
  lightning: damage('sprite-lightning', 'preview.sprite-lightning.title', 'preview.sprite-lightning.description', 'thunder'),
  chain: {
    id: 'sprite-chain',
    group: 'Sprite Effects',
    title: 'preview.sprite-chain.title',
    description: 'preview.sprite-chain.description',
    params: [seatParam('target', 'preview.param.target', 'seat-1')],
    play: (t, p) => withEvents(t, [{ kind: 'ChainToggledEvent', seatId: target(p), chained: true }], (s) => chain(s, [target(p)])),
  },
};

// Fire damage on a chained seat spreads along the chain: every chained seat shows the fire picture at once.
const chainWave: LabAnimation = {
  id: 'sprite-chain-wave',
  group: 'Sprite Effects',
  title: 'preview.sprite-chain-wave.title',
  description: 'preview.sprite-chain-wave.description',
  before: (b) => chain(b, ['seat-1', 'seat-2']),
  play: (t) =>
    withEvents(
      t,
      [
        { kind: 'DamageDealtEvent', damage: hit('seat-1', 'fire', 'fire-attack') },
        { kind: 'ChainToggledEvent', seatId: 'seat-1', chained: false },
        { kind: 'DamageDealtEvent', damage: hit('seat-2', 'fire', undefined, true) },
        { kind: 'ChainToggledEvent', seatId: 'seat-2', chained: false },
      ],
      (s) => unchain(setHp(setHp(s, 'seat-1', hpOf(s, 'seat-1') - 1), 'seat-2', hpOf(s, 'seat-2') - 1), ['seat-1', 'seat-2'])
    ),
};

export const SPRITE_ANIMATIONS: LabAnimation[] = [...Object.values(BY_SPRITE), chainWave];
