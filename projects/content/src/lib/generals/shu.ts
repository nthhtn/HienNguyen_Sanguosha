import type { GeneralSkillSet } from './types';

// The Shu base Generals' skills (General Skills spec, "Shu"). Every skill acts
// for the `owner` the engine passes in: the same General can sit at two seats
// in tests, so a skill must never find "its" seat by searching for its id.
export const SHU_GENERALS: GeneralSkillSet[] = [];
