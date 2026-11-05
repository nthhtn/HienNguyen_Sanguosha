import { BEAT_ANIMATIONS } from './beat-animations';
import { LabAnimation } from './lab-animation';

// Every animation the lab can play, in the order the panel lists them.
export const ANIMATIONS: LabAnimation[] = [...BEAT_ANIMATIONS];

export const findAnimation = (id: string): LabAnimation | undefined => ANIMATIONS.find((a) => a.id === id);
