import { CardInstance, ContentRegistry, EngineEvent, GameState } from 'engine';
import { playableGame, setTurn } from '../recipe';

export type LabParamValue = string | number;

// A control next to an animation's Play button.
export interface LabParam {
  key: string;
  label: string;
  kind: 'seat' | 'number' | 'choice';
  options?: { value: LabParamValue; label: string }[];
  default: LabParamValue;
}

// One animation the lab can play. `play` turns the table on show into the same table with the events
// appended, plus the facts those events record; the board's playback director then plays what is new.
export interface LabAnimation {
  id: string;
  group: 'Beats' | 'Sprite Effects';
  title: string;
  description: string;
  params?: LabParam[];
  // The table shown first, when the clean base is not the right start (a Heal needs a damaged seat).
  before?(base: GameState, params: Record<string, LabParamValue>): GameState;
  play(table: GameState, params: Record<string, LabParamValue>): GameState;
}

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

export const seatParam = (key: string, label: string, def: string): LabParam => ({
  key,
  label,
  kind: 'seat',
  options: LAB_SEATS.map((id) => ({ value: id, label: `Seat ${id.slice(5)}` })),
  default: def,
});

export const numberParam = (key: string, label: string, def: number): LabParam => ({ key, label, kind: 'number', default: def });

// The top `count` cards of the draw pile, as real card instances.
export function drawPileTop(state: GameState, count: number): CardInstance[] {
  return state.zones.find((z) => z.kind === 'drawPile')!.cards.slice(0, count);
}
