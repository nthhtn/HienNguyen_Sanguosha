import { anchor, isAnchorId } from './anchors';

describe('isAnchorId', () => {
  it.each([anchor.seat('seat-0'), anchor.hp('seat-1'), anchor.hand(), anchor.handCard('sha'), anchor.playButton('peach'), anchor.endPhase(), anchor.revealSlot('deputy'), anchor.responseConfirm(), anchor.revealDialog(), anchor.responseDialog()])(
    'accepts %s, which a builder made',
    (id) => expect(isAnchorId(id)).toBe(true)
  );

  it.each(['', 'bogus', 'handcard:sha', 'hand-card:', 'seat', 'hand:sha', 'end-phase:seat-0'])('refuses %j, which no builder makes', (id) => expect(isAnchorId(id)).toBe(false));
});
