import { EngineEvent } from 'engine';

// The picture a hit leaves on a seat: only a Sha (Fire Sha, Lightning Sha, a Sha turned fire by Fire Fan)
// shows a slash picture (plain, fire or lightning); every other source of fire or thunder damage (Blaze,
// Lightning, skills, chains) shows fire or lightning; any other damage (Duel, skills) shows the plain damage one.
export type DamageImage = 'damage' | 'slash' | 'slash-fire' | 'slash-lightning' | 'fire' | 'lightning';

export const DAMAGE_IMAGE_URLS: Record<DamageImage, string> = {
  damage: '/card-art/animation/damage.png',
  slash: '/card-art/animation/slash.png',
  'slash-fire': '/card-art/animation/slash_fire.png',
  'slash-lightning': '/card-art/animation/slash_lightning.png',
  fire: '/card-art/animation/fire.png',
  lightning: '/card-art/animation/lightning.png',
};

// An effect on show; a fresh `id` restarts the fade when a seat is hit again.
export interface ShownDamage {
  id: number;
  image: DamageImage;
}

// How long the picture takes to fade out, in ms.
export const DAMAGE_FADE_MS = 3000;

export interface DamageEffect {
  seatId: string;
  image: DamageImage;
}

// A hit of this much or more in one go sounds harder.
export const HARD_HIT = 2;

const SHA_CARDS = new Set(['sha', 'fire-attack', 'lightning-attack']);

export function damageImageOf(nature: 'normal' | 'fire' | 'thunder', cardAs?: string): DamageImage {
  const sha = cardAs !== undefined && SHA_CARDS.has(cardAs);
  if (nature === 'normal') return sha ? 'slash' : 'damage';
  if (nature === 'fire') return sha ? 'slash-fire' : 'fire';
  return sha ? 'slash-lightning' : 'lightning';
}

// The element's own picture, for a seat in a chain wave.
const elementImage = (nature: 'fire' | 'thunder'): DamageImage => (nature === 'fire' ? 'fire' : 'lightning');

// The seats a wave reaches: the chained hits that follow `origin` in `after`, up to the next hit that is
// not itself passed along a chain. Null when the origin did not unchain (it was no chained seat).
function waveAfter(origin: Extract<EngineEvent, { kind: 'DamageDealtEvent' }>, after: readonly EngineEvent[]): string[] | null {
  const seatId = origin.damage.target.seatId;
  let unchained = false;
  const reached: string[] = [];
  for (const e of after) {
    if (e.kind === 'DamageDealtEvent') {
      if (!e.damage.chained) break;
      reached.push(e.damage.target.seatId);
    } else if (e.kind === 'ChainToggledEvent' && e.seatId === seatId && !e.chained) unchained = true;
  }
  return unchained ? reached : null;
}

// The effect each seat shows for a stretch of the public log, in order (the caller keeps the last per
// seat). A chained wave shows at once: the seat hit first and every seat the chain reaches take the
// element's picture together, so the hits passed along the chain (found in the log, which may run past
// the stretch: `ahead`) show nothing of their own when their turn comes.
export function damageEffectsFor(events: readonly EngineEvent[], ahead: readonly EngineEvent[] = []): DamageEffect[] {
  const effects: DamageEffect[] = [];
  events.forEach((event, i) => {
    if (event.kind !== 'DamageDealtEvent' || event.damage.chained) return;
    const { target, nature, cause } = event.damage;
    const wave = nature === 'normal' ? null : waveAfter(event, [...events.slice(i + 1), ...ahead]);
    if (wave && nature !== 'normal') {
      const image = elementImage(nature);
      for (const seatId of [target.seatId, ...wave]) effects.push({ seatId, image });
    } else effects.push({ seatId: target.seatId, image: damageImageOf(nature, cause?.card?.as) });
  });
  return effects;
}
