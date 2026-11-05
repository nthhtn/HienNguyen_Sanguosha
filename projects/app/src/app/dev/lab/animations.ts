import { BEAT_ANIMATIONS } from './beat-animations';
import { LabAnimation } from './lab-animation';
import { SPRITE_ANIMATIONS } from './sprite-animations';

// Every animation the lab can play, in the order the panel lists them.
export const ANIMATIONS: LabAnimation[] = [...BEAT_ANIMATIONS, ...SPRITE_ANIMATIONS];

export const findAnimation = (id: string): LabAnimation | undefined => ANIMATIONS.find((a) => a.id === id);
