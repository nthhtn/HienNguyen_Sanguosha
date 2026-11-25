import { Action, ContentRegistry, GameState } from 'engine';
import type { MessageKey } from '../i18n/messages';

export type LessonId = 'generals' | 'allegiance' | 'turn' | 'sha-shan' | 'damage';

// One kind of action a step lets through. `match` narrows it (for example a Sha aimed at one seat).
export interface ActionPattern {
  kind: Action['kind'];
  match?: (action: Action, state: GameState) => boolean;
}

// What ends a step: the beginner presses Next, does one of the allowed actions, or the game reaches a state.
export type Completion =
  | { kind: 'next' }
  | { kind: 'action'; allow: ActionPattern[] }
  | { kind: 'state'; reached: (state: GameState) => boolean };

// A bot's scripted reply: it picks from the legal actions the engine offers and never invents one.
export interface BotMove {
  seatId: string;
  pick: (legal: Action[], state: GameState) => Action | undefined;
}

export interface Step {
  id: string;
  textKey: MessageKey;
  // The `data-tutorial` anchor id to spotlight; without one the step shows as a centred card.
  target?: string;
  // Where the phone board differs: its own target and, if the words differ, its own text.
  phone?: { target?: string; textKey?: MessageKey };
  completes: Completion;
  bot?: BotMove[];
}

export interface Lesson {
  id: LessonId;
  titleKey: MessageKey;
  summaryKey: MessageKey;
  seatCount: number;
  build: (registry: ContentRegistry) => GameState;
  steps: Step[];
}
