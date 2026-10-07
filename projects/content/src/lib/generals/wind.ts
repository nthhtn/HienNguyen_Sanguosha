import type { GeneralSkillSet } from './types';

// The Wind Generals' skills (stage 8 spec, "Rule text"). Every skill acts for
// the `owner` the engine passes in: the same General can sit at two seats in
// tests, so a skill must never find "its" seat by searching for its id.
export const WIND_GENERALS: GeneralSkillSet[] = [];
