import { Scenario } from '../scenario';
import { PLAY_BOARD_SCENARIOS } from './play-board';
import { CHOICE_SCENARIOS } from './choices';
import { RESPONSE_SCENARIOS } from './responses';
import { NOTICE_SCENARIOS } from './notices';
import { SCREEN_SCENARIOS } from './screens';

// Every dev scenario, in the order the /dev index shows them within a group.
export const SCENARIOS: Scenario[] = [...PLAY_BOARD_SCENARIOS, ...RESPONSE_SCENARIOS, ...CHOICE_SCENARIOS, ...NOTICE_SCENARIOS, ...SCREEN_SCENARIOS];

export const findScenario = (id: string): Scenario | undefined => SCENARIOS.find((s) => s.id === id);
