import type { EngineEvent } from 'engine';
import { ascertainNotice } from './ascertain';
import { played, span, view } from './helpers.testing';

const secretPick: EngineEvent = { kind: 'ChoiceMadeEvent', seatId: 'a', reason: { kind: 'choice' }, verb: 'pick', shows: { kind: 'label', text: '' }, secret: true } as unknown as EngineEvent;

describe('Ascertain notice', () => {
  it('says who looked at whom, and shows nothing the log does not, so no card is revealed', () => {
    const n = ascertainNotice.describe(span('ascertain', 'a', ['b'], [played('ascertain', 'a', ['b']), secretPick]), view())!;
    expect(n.cards).toEqual([]);
    expect(n.outcome).toMatchObject({ tone: 'neutral', headline: { key: 'notice.ascertain.looked' }, text: { key: 'notice.ascertain.text', params: { userSeat: 'a', targetSeat: 'b' } } });
  });
  it('has nothing to show for a recast or a cancelled Ascertain', () => {
    expect(ascertainNotice.describe(span('ascertain', 'a', [], [played('ascertain', 'a', [])]), view())).toBeNull();
    expect(ascertainNotice.describe(span('ascertain', 'a', ['b'], [played('ascertain', 'a', ['b'])]), view())).toBeNull();
  });
});
