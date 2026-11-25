import { Action, ContentRegistry, GameState } from 'engine';
import type { MessageKey } from '../i18n/messages';

export type LessonId = 'generals' | 'allegiance' | 'turn' | 'sha-shan' | 'damage' | 'equipment' | 'tools' | 'wuxie' | 'judgment' | 'chains';

// The tab a lesson sits in on the Tutorial page.
export type LessonGroupId = 'basics' | 'cards' | 'effects';

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

// One anchor id, or several tried in order: the spotlight rings the first that is on the page. A step whose action takes
// several clicks (a card, its Play button, a target in a menu that opens) lists them, the latest control first.
export type StepTarget = string | string[];

export interface Step {
  id: string;
  textKey: MessageKey;
  // The `data-tutorial` anchor id to spotlight; without one the step shows as a centred card.
  target?: StepTarget;
  // Where the phone board differs: its own target and, if the words differ, its own text.
  phone?: { target?: StepTarget; textKey?: MessageKey };
  completes: Completion;
  bot?: BotMove[];
}

export interface Lesson {
  id: LessonId;
  group: LessonGroupId;
  titleKey: MessageKey;
  summaryKey: MessageKey;
  seatCount: number;
  build: (registry: ContentRegistry) => GameState;
  steps: Step[];
}
