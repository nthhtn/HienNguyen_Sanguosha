import { ContentRegistry, EngineEvent, GameState } from 'engine';
import { equipSlotOf, generalDeathVoiceUrl, isRecast, seatGender } from 'content';
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

// The gender of a seat's own Main General, shown or not (a revealed Main keeps
// seatGender's rules, a chosen Form's included).
function ownGender(state: GameState, seatId: string, registry: ContentRegistry): VoiceGender | null {
  const main = state.seats.find((s) => s.id === seatId)?.generals?.main;
  if (!main || main.revealed) return seatGender(state, seatId, registry);
  return registry.generals.get(main.generalDefinitionId)?.gender ?? null;
}

// The cards that speak when used (Tools, and Wine), by the card as it is played, each in the voice of the same name.
const TOOL_VOICES: Partial<Record<string, Voice>> = {
  break: 'break',
  chains: 'chains',
  blaze: 'blaze',
  'hail-of-arrows': 'hail-of-arrows',
  barbarians: 'barbarians',
  steal: 'steal',
  wuxie: 'wuxie',
  starvation: 'starvation',
  coerce: 'coerce',
  wine: 'wine',
  harvest: 'harvest',
  'draw-two': 'draw-two',
  'peach-garden': 'peach-garden',
  capture: 'capture',
  lightning: 'lightning',
  duel: 'duel',
};

export interface VoiceCue {
  gender: VoiceGender;
  voice: Voice;
}

// The spoken lines a stretch of the public log calls for: a Sha played says
// "slash", a Shan "dodge", a seat falling dying "sos", a card played (TOOL_VOICES;
// a Chains Recast is no use of it) its own name, each in the voice of
// that seat's gender (its Main General's while revealed, else its Deputy's).
// A seat whose Generals are both face down gets the male voice, except the
// viewer's own seat (`viewerSeatId`): it knows its Main General, so it speaks
// in that General's gender while the Main is still face down. Each (gender,
// line) at most once per stretch.
export function voicesFor(events: readonly EngineEvent[], state: GameState, registry: ContentRegistry, viewerSeatId?: string | null): VoiceCue[] {
  const cues = new Map<string, VoiceCue>();
  const add = (seatId: string, voice: Voice) => {
    const gender = (seatId === viewerSeatId ? ownGender(state, seatId, registry) : seatGender(state, seatId, registry)) ?? 'male';
    cues.set(`${gender}:${voice}`, { gender, voice });
  };
  for (const event of events) {
    if (event.kind === 'CardPlayedEvent') {
      if (event.card.as === 'sha') add(event.seatId, 'slash');
      else if (event.card.as === 'shan') add(event.seatId, 'dodge');
      else if (TOOL_VOICES[event.card.as] && !isRecast(event)) add(event.seatId, TOOL_VOICES[event.card.as]!);
    } else if (event.kind === 'SeatDyingEvent') add(event.seatId, 'sos');
  }
  return [...cues.values()];
}

// A death cry: the Main General's own voice (`url`), else a kingdom's (`effect`).
export interface DeathCue {
  effect?: SoundEffect;
  url?: string;
}

// The death cry of each seat a stretch of the log eliminates: its Main General's
// voice. A Main General with no recording falls back to the cry of the kingdom
// the seat is shown as; a seat with neither is silent. Each cry at most once per stretch.
export function deathSoundsFor(events: readonly EngineEvent[], state: GameState): DeathCue[] {
  const cues = new Map<string, DeathCue>();
  for (const event of events) {
    if (event.kind !== 'SeatEliminatedEvent') continue;
    const seat = state.seats.find((s) => s.id === event.seatId);
    const mainId = seat?.generals?.main.generalDefinitionId;
    const url = mainId ? generalDeathVoiceUrl(mainId) : null;
    if (url) {
      cues.set(url, { url });
      continue;
    }
    const kingdom = seat?.kingdom;
    if (kingdom && kingdom !== 'hidden') {
      const effect = `death-${kingdom.toLowerCase()}` as SoundEffect;
      cues.set(effect, { effect });
    }
  }
  return [...cues.values()];
}
