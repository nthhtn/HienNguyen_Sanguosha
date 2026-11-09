import { allyFarAttackNearNotice, amassNotice, drawTwoNotice } from './draw';
import { drew, played, span, view } from './helpers.testing';

describe('Draw Two notice', () => {
  it('the user drew 2 cards', () => {
    const n = drawTwoNotice.describe(span('draw-two', 'a', ['a'], [played('draw-two', 'a', ['a']), drew('a', 2)]), view())!;
    expect(n.seatIds).toEqual(['a']);
    expect(n.outcome).toMatchObject({ tone: 'good', headline: { key: 'notice.draw.drawn' }, text: { key: 'notice.drawTwo.text', params: { userSeat: 'a' } } });
  });
  it('has nothing to show when nothing was drawn (a Wuxie cancelled it)', () => {
    expect(drawTwoNotice.describe(span('draw-two', 'a', ['a'], [played('draw-two', 'a', ['a'])]), view())).toBeNull();
  });
});

describe('Amass notice', () => {
  it('names the one seat that drew and discarded', () => {
    const n = amassNotice.describe(span('amass', 'a', ['a'], [played('amass', 'a', ['a']), drew('a', 2)]), view())!;
    expect(n.outcome).toMatchObject({ tone: 'good', text: { key: 'notice.amass.one', params: { userSeat: 'a' } } });
  });
  it('counts the seats when several did', () => {
    const n = amassNotice.describe(span('amass', 'a', ['a', 'b'], [played('amass', 'a', ['a', 'b']), drew('a', 2), drew('b', 2)]), view())!;
    expect(n.seatIds).toEqual(['a', 'b']);
    expect(n.outcome.text).toEqual({ key: 'notice.amass.many', params: { count: 2 } });
  });
  it('has nothing to show when no one drew', () => {
    expect(amassNotice.describe(span('amass', 'a', ['a'], [played('amass', 'a', ['a'])]), view())).toBeNull();
  });
});

describe('Ally Far Attack Near notice', () => {
  it('the target drew 1 and the user drew 3', () => {
    const n = allyFarAttackNearNotice.describe(span('ally-far-attack-near', 'a', ['b'], [played('ally-far-attack-near', 'a', ['b']), drew('b', 1), drew('a', 3)]), view())!;
    expect(n.seatIds).toEqual(['a', 'b']);
    expect(n.outcome).toMatchObject({ tone: 'good', text: { key: 'notice.allyFarAttackNear.text', params: { userSeat: 'a', targetSeat: 'b' } } });
  });
  it('has nothing to show when it was cancelled', () => {
    expect(allyFarAttackNearNotice.describe(span('ally-far-attack-near', 'a', ['b'], [played('ally-far-attack-near', 'a', ['b'])]), view())).toBeNull();
  });
});
