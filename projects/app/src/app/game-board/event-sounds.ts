import { ContentRegistry, EngineEvent, GameState } from 'engine';
import { equipSlotOf, seatGender } from 'content';
import { SoundEffect, Voice, VoiceGender } from '../music.service';

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

export interface VoiceCue {
  gender: VoiceGender;
  voice: Voice;
}

// The spoken lines a stretch of the public log calls for: a Sha played says
// "slash", a Shan "dodge", a seat falling dying "sos", each in the voice of
// that seat's gender (its Main General's while revealed, else its Deputy's).
// A seat whose Generals are both face down gets the male voice. Each (gender, line) at most once per stretch.
export function voicesFor(events: readonly EngineEvent[], state: GameState, registry: ContentRegistry): VoiceCue[] {
  const cues = new Map<string, VoiceCue>();
  const add = (seatId: string, voice: Voice) => {
    const gender = seatGender(state, seatId, registry) ?? 'male';
    cues.set(`${gender}:${voice}`, { gender, voice });
  };
  for (const event of events) {
    if (event.kind === 'CardPlayedEvent') {
      if (event.card.as === 'sha') add(event.seatId, 'slash');
      else if (event.card.as === 'shan') add(event.seatId, 'dodge');
    } else if (event.kind === 'SeatDyingEvent') add(event.seatId, 'sos');
  }
  return [...cues.values()];
}

// The death cry of each seat a stretch of the log eliminates, by the kingdom
// it is shown as; a seat that went out with its kingdom still hidden is silent.
// Each kingdom's cry at most once per stretch.
export function deathSoundsFor(events: readonly EngineEvent[], state: GameState): SoundEffect[] {
  const sounds = new Set<SoundEffect>();
  for (const event of events) {
    if (event.kind !== 'SeatEliminatedEvent') continue;
    const kingdom = state.seats.find((s) => s.id === event.seatId)?.kingdom;
    if (kingdom && kingdom !== 'hidden') sounds.add(`death-${kingdom.toLowerCase()}` as SoundEffect);
  }
  return [...sounds];
}
