import { EngineEvent } from 'engine';
import { equipSlotOf } from 'content';
import { SoundEffect } from '../music.service';

// Which sound effects a stretch of the public log calls for, each at most once
// (several events in one update make one sound, not a pile-up). The log is
// public, so this works for any viewer. Damage and plain HP loss both injure;
// a card entering an equip zone makes the sound of its slot.
export function soundsFor(events: readonly EngineEvent[]): SoundEffect[] {
  const sounds = new Set<SoundEffect>();
  for (const event of events) {
    if (event.kind === 'DamageDealtEvent' || event.kind === 'HpLostEvent') sounds.add('injure');
    else if (event.kind === 'HealEvent') sounds.add('heal');
    else if (event.kind === 'CardMovedEvent' && event.toZoneId.endsWith(':equip') && event.card) {
      const slot = equipSlotOf(event.card.definitionId);
      if (slot === 'weapon') sounds.add('weapon');
      else if (slot === 'armor') sounds.add('armor');
      else if (slot === 'offensiveMount' || slot === 'defensiveMount') sounds.add('mount');
    }
  }
  return [...sounds];
}
