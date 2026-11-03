import { SpriteSheet, spriteSheet } from 'content';
import { BURST_FRAME_MS, FADE_MS, framePosition, HOLD_MS, LEAD_FRAME_MS, POP_MS, spriteDurationMs, spriteKeyframes, spritePlan, TAIL_FRAME_MS } from './sprite-plan';

const sheet = (overrides: Partial<SpriteSheet> = {}): SpriteSheet => ({
  url: '/x.png',
  frames: 10,
  cols: 5,
  rows: 2,
  width: 100,
  height: 100,
  lead: 2,
  burstEnd: 6,
  pop: true,
  peak: 4,
  ...overrides,
});

describe('spritePlan', () => {
  it('runs lead-in, burst (with the pop), tail, hold and fade in order', () => {
    const plan = spritePlan(sheet());
    // frames 0-1 lead-in, 2-5 burst (the first with the pop), 6-9 tail
    const frames = 2 * LEAD_FRAME_MS + 4 * BURST_FRAME_MS + POP_MS + 4 * TAIL_FRAME_MS;
    expect(plan.popAtMs).toBe(2 * LEAD_FRAME_MS);
    expect(plan.fadeFromMs).toBe(frames + HOLD_MS);
    expect(plan.totalMs).toBe(frames + HOLD_MS + FADE_MS);
    expect(plan.steps.map((s) => s.frame)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(plan.steps.map((s) => s.startMs)).toEqual([0, 40, 80, 80 + 60 + POP_MS, 80 + 120 + POP_MS, 80 + 180 + POP_MS, 80 + 240 + POP_MS, 80 + 280 + POP_MS, 80 + 320 + POP_MS, 80 + 360 + POP_MS]);
  });

  it('has no pop-in for a sprite that does not start as a speck', () => {
    const plan = spritePlan(sheet({ pop: false, lead: 1 }));
    expect(plan.popAtMs).toBeNull();
    expect(plan.totalMs).toBe(LEAD_FRAME_MS + 5 * BURST_FRAME_MS + 4 * TAIL_FRAME_MS + HOLD_MS + FADE_MS);
  });

  it('gives every shipped effect a length of 1 to 2.5 seconds', () => {
    for (const id of ['slash', 'slash-fire', 'slash-lightning', 'damage', 'fire', 'lightning', 'chain'] as const) {
      expect(spriteDurationMs(id)).toBeGreaterThan(1000);
      expect(spriteDurationMs(id)).toBeLessThan(2500);
    }
  });
});

describe('framePosition', () => {
  it('maps a frame to its cell as percentages, row by row', () => {
    const s = sheet();
    expect(framePosition(s, 0)).toBe('0% 0%');
    expect(framePosition(s, 4)).toBe('100% 0%');
    expect(framePosition(s, 5)).toBe('0% 100%');
    expect(framePosition(s, 7)).toBe('50% 100%');
  });

  it('copes with a single row or column', () => {
    expect(framePosition(sheet({ cols: 6, rows: 1 }), 3)).toBe('60% 0%');
    expect(framePosition(spriteSheet('damage'), 0)).toBe('0% 0%');
  });
});

describe('spriteKeyframes', () => {
  it('steps through every frame, then holds the last one to the end', () => {
    const s = sheet();
    const { frames } = spriteKeyframes(s, spritePlan(s));
    expect(frames).toHaveLength(11);
    expect(frames[0]).toMatchObject({ offset: 0, backgroundPosition: '0% 0%', easing: 'step-end' });
    expect(frames[10]).toMatchObject({ offset: 1, backgroundPosition: framePosition(s, 9) });
    expect(frames.map((f) => f.offset)).toEqual([...frames.map((f) => f.offset)].sort((a, b) => (a as number) - (b as number)));
  });

  it('pops in at its first large frame and fades after the hold', () => {
    const s = sheet();
    const plan = spritePlan(s);
    const { fade } = spriteKeyframes(s, plan);
    expect(fade[0]).toMatchObject({ offset: 0, opacity: 1 });
    const pop = fade.find((f) => f['transform'] === 'scale(0.6)');
    expect(pop?.offset).toBeCloseTo((plan.popAtMs as number) / plan.totalMs);
    expect(fade[fade.length - 2]).toMatchObject({ opacity: 1, offset: plan.fadeFromMs / plan.totalMs });
    expect(fade[fade.length - 1]).toMatchObject({ offset: 1, opacity: 0, transform: 'scale(0.9)' });
  });

  it('has no pop keyframes without a pop', () => {
    const s = sheet({ pop: false, lead: 1 });
    const { fade } = spriteKeyframes(s, spritePlan(s));
    expect(fade.some((f) => f['transform'] === 'scale(0.6)')).toBe(false);
  });
});
