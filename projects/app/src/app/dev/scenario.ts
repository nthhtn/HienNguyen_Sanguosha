import { Type } from '@angular/core';
import { ContentRegistry, GameState } from 'engine';
import type { MessageKey } from '../i18n/messages';

export type ScenarioGroup = 'Play Board' | 'Response Windows' | 'Choice Prompts' | 'Resolution Notices' | 'Other Screens';

// The English group names are stable ids; the headings come from the catalog.
export const GROUP_TITLES: Record<ScenarioGroup, MessageKey> = {
  'Play Board': 'preview.group.playBoard',
  'Response Windows': 'preview.group.responseWindows',
  'Choice Prompts': 'preview.group.choicePrompts',
  'Resolution Notices': 'preview.group.notices',
  'Other Screens': 'preview.group.otherScreens',
};

interface ScenarioBase {
  id: string;
  group: ScenarioGroup;
  title: MessageKey;
  description: MessageKey;
}

// Opens the real board in a state the recipe builds. `reaches` says whether the built state is in the situation the title promises.
export interface BoardScenario extends ScenarioBase {
  kind: 'board';
  seatCount: number;
  build(registry: ContentRegistry): GameState;
  reaches(state: GameState): boolean;
  // True when a bot is due to act as soon as the board loads (watching another seat's turn). Default: the human acts first.
  botDue?: true;
}

// Renders a standalone component (a screen that is not the board) from fixtures.
export interface ScreenScenario extends ScenarioBase {
  kind: 'screen';
  component: () => Promise<Type<unknown>>;
  inputs?: Record<string, unknown>;
}

export type Scenario = BoardScenario | ScreenScenario;
