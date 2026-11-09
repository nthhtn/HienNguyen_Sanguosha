import { amassNotice } from './draw';
import { drew, played, span, view } from './helpers.testing';

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
