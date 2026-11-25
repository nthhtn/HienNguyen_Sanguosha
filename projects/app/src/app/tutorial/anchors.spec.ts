import { anchor, isAnchorId } from './anchors';

describe('isAnchorId', () => {
  it.each([anchor.seat('seat-0'), anchor.hp('seat-1'), anchor.hand(), anchor.handCard('sha'), anchor.playButton('peach'), anchor.endPhase(), anchor.revealSlot('deputy'), anchor.responseConfirm(), anchor.revealDialog(), anchor.responseDialog(), anchor.discardDialog(), anchor.historyButton(), anchor.equipment('seat-1'), anchor.judgmentArea('seat-1'), anchor.chainBadge('seat-1'), anchor.judgmentDialog(), anchor.choiceDialog()])(
    'accepts %s, which a builder made',
    (id) => expect(isAnchorId(id)).toBe(true)
  );

  it.each(['', 'bogus', 'handcard:sha', 'hand-card:', 'seat', 'hand:sha', 'end-phase:seat-0', 'equipment:', 'judgment-area:', 'chain-badge:', 'judgment-dialog:seat-0', 'choice-dialog:x'])('refuses %j, which no builder makes', (id) => expect(isAnchorId(id)).toBe(false));

  it('builds the ids the board and the lessons share', () => {
    expect([anchor.equipment('seat-1'), anchor.judgmentArea('seat-1'), anchor.chainBadge('seat-1'), anchor.judgmentDialog()]).toEqual([
      'equipment:seat-1',
      'judgment-area:seat-1',
      'chain-badge:seat-1',
      'judgment-dialog',
    ]);
    expect(anchor.choiceDialog()).toBe('choice-dialog');
  });
});
