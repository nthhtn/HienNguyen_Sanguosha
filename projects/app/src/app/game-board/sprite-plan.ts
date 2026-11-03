import { SpriteId, SpriteSheet, spriteSheet } from 'content';

// How a seat effect plays (docs/superpowers/specs/2026-11-03-sprite-animations-design.md): the frames before
// the burst, the burst, the tail, then the last frame holds and fades out. All in ms.
export const LEAD_FRAME_MS = 40;
export const BURST_FRAME_MS = 60;
export const TAIL_FRAME_MS = 40;
// A sprite that starts as a speck scales its first large frame up from POP_SCALE over POP_MS.
export const POP_MS = 80;
export const POP_SCALE = 0.6;
export const HOLD_MS = 300;
export const FADE_MS = 400;
export const FADE_SCALE = 0.9;

export interface SpritePlan {
  // The frame to show from `startMs`, in order.
  steps: { frame: number; startMs: number }[];
  // When the pop-in starts; null when the sprite has none.
  popAtMs: number | null;
  // The last frame holds from the end of the frames, then fades from `fadeFromMs`.
  fadeFromMs: number;
  totalMs: number;
}

export function spritePlan(sheet: SpriteSheet): SpritePlan {
  const steps: SpritePlan['steps'] = [];
  let popAtMs: number | null = null;
  let t = 0;
  for (let frame = 0; frame < sheet.frames; frame++) {
    let duration = frame < sheet.lead ? LEAD_FRAME_MS : frame < sheet.burstEnd ? BURST_FRAME_MS : TAIL_FRAME_MS;
    if (sheet.pop && frame === sheet.lead) {
      popAtMs = t;
      duration += POP_MS;
    }
    steps.push({ frame, startMs: t });
    t += duration;
  }
  const fadeFromMs = t + HOLD_MS;
  return { steps, popAtMs, fadeFromMs, totalMs: fadeFromMs + FADE_MS };
}

// How long an effect stays on its seat.
export function spriteDurationMs(id: SpriteId): number {
  return spritePlan(spriteSheet(id)).totalMs;
}

// Where a frame sits in the sheet, as a CSS background-position.
export function framePosition(sheet: SpriteSheet, frame: number): string {
  const col = frame % sheet.cols;
  const row = Math.floor(frame / sheet.cols);
  const x = sheet.cols > 1 ? (col * 100) / (sheet.cols - 1) : 0;
  const y = sheet.rows > 1 ? (row * 100) / (sheet.rows - 1) : 0;
  return `${x}% ${y}%`;
}

// The two animations that play an effect over `plan.totalMs`: stepping through the frames, and the pop-in
// and fade-out of the picture as a whole.
export function spriteKeyframes(sheet: SpriteSheet, plan: SpritePlan): { frames: Keyframe[]; fade: Keyframe[] } {
  const at = (ms: number) => ms / plan.totalMs;
  const frames: Keyframe[] = plan.steps.map((s) => ({ offset: at(s.startMs), backgroundPosition: framePosition(sheet, s.frame), easing: 'step-end' }));
  frames.push({ offset: 1, backgroundPosition: framePosition(sheet, sheet.frames - 1) });
  const fade: Keyframe[] = [{ offset: 0, opacity: 1, transform: 'scale(1)' }];
  if (plan.popAtMs !== null) {
    fade.push({ offset: at(plan.popAtMs), transform: 'scale(1)' });
    fade.push({ offset: at(plan.popAtMs), transform: `scale(${POP_SCALE})`, easing: 'ease-out' });
    fade.push({ offset: at(plan.popAtMs + POP_MS), transform: 'scale(1)' });
  }
  fade.push({ offset: at(plan.fadeFromMs), opacity: 1, transform: 'scale(1)' });
  fade.push({ offset: 1, opacity: 0, transform: `scale(${FADE_SCALE})` });
  return { frames, fade };
}
