import { CardInstance, EngineEvent, UsedCard } from 'engine';
import { abilityName } from 'content';
import type { BeatVisual, PlannedBeat } from './beats';
import { NO_CENTRE, nextCentre, seatCues } from './seat-cues';

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'sha', suit: 'spade', rank: 7 });
const used: UsedCard = { as: 'sha', colour: 'black', physical: [card('c1')] };
const beat = (visual: BeatVisual): PlannedBeat => ({ logIndex: 0, event: {} as EngineEvent, durationMs: 900, visual });
const play = (extra: Partial<Extract<BeatVisual, { kind: 'play' }>> = {}) =>
  beat({ kind: 'play', seatId: 'a', card: used, targetSeatIds: ['b'], response: false, ...extra });

describe('seatCues', () => {
  it('a damage beat hits its target with a minus number', () => {
    const cues = seatCues(beat({ kind: 'damage', seatId: 'b', amount: 1, sourceSeatId: 'a' }), NO_CENTRE);
    expect(cues['b']).toMatchObject({ impact: 'hit', floatText: '−1' });
    expect(cues['a'].involved).toBe(true);
  });

  it('a heal beat heals with a plus number', () => {
    expect(seatCues(beat({ kind: 'heal', seatId: 'b', amount: 2 }), NO_CENTRE)['b']).toMatchObject({ impact: 'heal', floatText: '+2' });
  });

  it('a play calls out its card on its user', () => {
    expect(seatCues(play(), NO_CENTRE)['a'].callout).toEqual({ text: { key: 'cue.play', params: { card: 'Slash' } }, tone: 'play' });
  });

  it('a pass is a pass-toned callout', () => {
    const cue = seatCues(beat({ kind: 'pass', seatId: 'b', cardId: 'shan' }), NO_CENTRE)['b'];
    expect(cue.callout?.tone).toBe('pass');
    expect(cue.callout?.text).toEqual({ key: 'cue.pass', params: { card: 'Dodge' } });
  });

  it('an ability beat names the skill on its owner', () => {
    expect(seatCues(beat({ kind: 'ability', seatId: 'a', abilityId: 'unyielding' }), NO_CENTRE)['a'].callout?.text).toEqual({ text: abilityName('unyielding') });
  });

  it('dying calls for help in red', () => {
    expect(seatCues(beat({ kind: 'dying', seatId: 'b' }), NO_CENTRE)['b'].callout).toEqual({ text: { key: 'cue.help' }, tone: 'red' });
  });

  it('an eliminated or saved beat involves its seat without a callout', () => {
    for (const kind of ['eliminated', 'saved'] as const) {
      const cue = seatCues(beat({ kind, seatId: 'b' }), NO_CENTRE)['b'];
      expect(cue.involved).toBe(true);
      expect(cue.callout).toBeUndefined();
      expect(cue.reveal).toBeUndefined();
    }
  });

  it('a reveal flips the portrait', () => {
    expect(seatCues(beat({ kind: 'reveal', seatId: 'b', slot: 'main' }), NO_CENTRE)['b'].reveal).toBe(true);
  });

  it('involves the source, the targets and the responder, and nobody else', () => {
    const cues = seatCues(play({ answersSeatId: 'c' }), NO_CENTRE);
    expect(['a', 'b', 'c'].map((id) => cues[id].involved)).toEqual([true, true, true]);
    expect(cues['d']).toBeUndefined();
  });

  it('keeps the resolution centre involved while another seat acts', () => {
    const cues = seatCues(beat({ kind: 'pass', seatId: 'b' }), { sourceSeatId: 'a', targetSeatIds: ['b'] });
    expect(cues['a'].involved).toBe(true);
  });

  it('has no cues without a beat or a centre', () => expect(seatCues(null, NO_CENTRE)).toEqual({}));
});

describe('nextCentre', () => {
  it('a play starts a resolution with its source and targets', () => {
    expect(nextCentre(NO_CENTRE, play(), 1)).toEqual({ sourceSeatId: 'a', targetSeatIds: ['b'] });
  });

  it('a response leaves the resolution as it was', () => {
    const centre = { sourceSeatId: 'a', targetSeatIds: ['b'] };
    expect(nextCentre(centre, play({ seatId: 'b', response: true }), 2)).toBe(centre);
  });

  it('clears when the centre empties', () => {
    expect(nextCentre({ sourceSeatId: 'a', targetSeatIds: ['b'] }, null, 0)).toEqual(NO_CENTRE);
  });
});
