import { CardInstance, ContentRegistry, EngineEvent, GameState } from 'engine';
import type { MessageKey } from '../../i18n/messages';
import { playableGame, setTurn } from '../recipe';

export type LabParamValue = string | number;

// A control next to an animation's Play button.
export interface LabParam {
  key: string;
  label: MessageKey;
  // seat, phase, card and slot are drawn as a list the page names in the viewer's language; `values` narrows card.
  kind: 'seat' | 'number' | 'phase' | 'card' | 'slot';
  values?: string[];
  default: LabParamValue;
}

// One animation the lab can play. `play` turns the table on show into the same table with the events
// appended, plus the facts those events record; the board's playback director then plays what is new.
export interface LabAnimation {
  id: string;
  group: 'Beats' | 'Sprite Effects';
  title: MessageKey;
  description: MessageKey;
  params?: LabParam[];
  // The table shown first, when the clean base is not the right start (a Heal needs a damaged seat).
  before?(base: GameState, params: Record<string, LabParamValue>): GameState;
  play(table: GameState, params: Record<string, LabParamValue>): GameState;
}

// The headings of the panel's groups.
export const LAB_GROUP_TITLES: Record<LabAnimation['group'], MessageKey> = { Beats: 'preview.group.beats', 'Sprite Effects': 'preview.group.spriteEffects' };

export const LAB_SEATS = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];

// The clean four-seat table every animation starts from: seat-0's Play Phase, nothing pending.
export function labTable(registry: ContentRegistry): GameState {
  return setTurn(playableGame(registry, 7, 4), 'seat-0', 'Play');
}

export function withEvents(state: GameState, events: EngineEvent[], patch: (s: GameState) => GameState = (s) => s): GameState {
  return patch({ ...state, log: [...state.log, ...events] });
}

export function defaultParams(a: LabAnimation): Record<string, LabParamValue> {
  return Object.fromEntries((a.params ?? []).map((p) => [p.key, p.default]));
}

export const seatParam = (key: string, label: MessageKey, def: string): LabParam => ({ key, label, kind: 'seat', default: def });

export const numberParam = (key: string, label: MessageKey, def: number): LabParam => ({ key, label, kind: 'number', default: def });

// The top `count` cards of the draw pile, as real card instances.
export function drawPileTop(state: GameState, count: number): CardInstance[] {
  return state.zones.find((z) => z.kind === 'drawPile')!.cards.slice(0, count);
}
