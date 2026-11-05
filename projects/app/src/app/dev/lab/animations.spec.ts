import { buildContentRegistry } from 'content';
import { CardZone, GameState } from 'engine';
import { BEATS, planBeat } from '../../game-board/playback/beats';
import { LabAnimation, defaultParams, labTable } from './lab-animation';
import { ANIMATIONS } from './animations';
import { BEAT_ANIMATIONS } from './beat-animations';
import { SPRITE_ANIMATIONS } from './sprite-animations';
import { chainEffectsFor, damageEffectsFor } from '../../game-board/damage-effects';

const registry = buildContentRegistry();
const base = labTable(registry);

// The table an animation is played on and the table after it, as the page does.
const run = (a: LabAnimation, params = defaultParams(a)): { before: GameState; after: GameState } => {
  const before = a.before?.(base, params) ?? base;
  return { before, after: a.play(before, params) };
};

describe('animation lab', () => {
  it('the lab table rests on seat-0’s Play Phase with nothing pending', () => {
    expect(base.phase).toBe('Play');
    expect(base.turn.ownerSeatId).toBe('seat-0');
    expect(base.pendingResponse).toBeNull();
    expect(base.pendingChoice).toBeUndefined();
  });

  it('animation ids are unique', () => {
    const ids = ANIMATIONS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every beat kind in BEATS has at least one lab animation', () => {
    const covered = new Set(BEAT_ANIMATIONS.flatMap((a) => {
      const { before, after } = run(a);
      return after.log.slice(before.log.length).map((e) => e.kind);
    }));
    expect(Object.keys(BEATS).filter((kind) => !covered.has(kind as never))).toEqual([]);
  });

  it.each(BEAT_ANIMATIONS.map((a) => [a.id, a] as const))('%s appends events that each plan a visible beat', (_id, a) => {
    const { before, after } = run(a);
    const added = after.log.slice(before.log.length);
    expect(added.length).toBeGreaterThan(0);
    const kinds = new Map<string, CardZone['kind']>(after.zones.map((z) => [z.id, z.kind]));
    added.forEach((event, i) => {
      const beat = planBeat(event, before.log.length + i, { zoneKindOf: (id) => kinds.get(id), previous: after.log[before.log.length + i - 1] });
      expect({ event: event.kind, visible: beat.visual !== null && beat.durationMs > 0 }).toEqual({ event: event.kind, visible: true });
    });
  });

  it('play leaves the base table untouched', () => {
    const length = base.log.length;
    const hp = base.seats.map((s) => s.combinedHp);
    for (const a of ANIMATIONS) run(a);
    expect(base.log).toHaveLength(length);
    expect(base.seats.map((s) => s.combinedHp)).toEqual(hp);
  });

  it('playing twice from the same base gives the same table', () => {
    for (const a of ANIMATIONS) expect(JSON.stringify(run(a).after)).toEqual(JSON.stringify(run(a).after));
  });

  it.each(['slash', 'slash-fire', 'slash-lightning', 'damage', 'fire', 'lightning', 'chain'] as const)('a sprite animation yields the %s effect', (image) => {
    const yielded = SPRITE_ANIMATIONS.some((a) => {
      const { before, after } = run(a);
      const events = after.log.slice(before.log.length);
      return [...damageEffectsFor(events), ...chainEffectsFor(events)].some((e) => e.image === image);
    });
    expect(yielded).toBe(true);
  });

  it('the chain wave reaches more than one seat', () => {
    const wave = SPRITE_ANIMATIONS.find((a) => a.id === 'sprite-chain-wave')!;
    const { before, after } = run(wave);
    expect(new Set(damageEffectsFor(after.log.slice(before.log.length)).map((e) => e.seatId)).size).toBeGreaterThan(1);
  });

  it('turning chained also sets the seat’s chained flag', () => {
    const chain = SPRITE_ANIMATIONS.find((a) => a.id === 'sprite-chain')!;
    const { after } = run(chain);
    expect(after.seats[1].chained).toBe(true);
  });

  it('sprite animations are part of the lab', () => {
    for (const a of SPRITE_ANIMATIONS) expect(ANIMATIONS).toContain(a);
  });
});
