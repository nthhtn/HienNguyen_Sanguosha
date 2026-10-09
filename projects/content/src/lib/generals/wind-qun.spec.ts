import { usedCardOf } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, table, TableOptions } from './skills.testing';

const h = harness();
const zhangJiao = (seatId: string): TableOptions['generals'] => ({ [seatId]: ['zhang-jiao', 'zuo-ci'] });

describe('Zhang Jiao — Lightning Strike', () => {
  const dodged = (judged: ReturnType<typeof card>) => {
    let s = h.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('n1', 'shan')], drawPile: [judged] }, { owner: 'seat-b', generals: zhangJiao('seat-a') }), 's1', 'seat-a');
    s = h.respond(s, 'n1');
    expect(askedAbout(s)).toBe('lightning-strike');
    return h.choose(h.use(s), 'seat-b');
  };

  it('after he plays a Shan, a seat he picks judges: on a spade it takes 2 plain damage with no source', () => {
    const s = dodged(card('j', 'sha', 'spade', 5));
    expect(hp(s, 'seat-b')).toBe(2);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent').at(-1)).toMatchObject({ damage: { source: null, amount: 2, nature: 'normal' } });
  });

  it('anything else does nothing', () => {
    expect(hp(dodged(card('j', 'sha', 'heart', 5)), 'seat-b')).toBe(4);
  });
});

describe('Zhang Jiao — Dark Magic', () => {
  const capture = usedCardOf(card('cp', 'capture', 'spade', 6));
  const judgedOnC = (generals: TableOptions['generals'], hands: Record<string, ReturnType<typeof card>[]>, judged = card('j', 'peach', 'heart', 4)) =>
    h.run(table({ ...Object.fromEntries(Object.entries(hands).map(([id, cs]) => [`${id}:hand`, cs])), drawPile: [judged] }, { generals }), [
      { kind: 'JudgeEffect', seatId: 'seat-c', reader: { kind: 'card', card: capture } },
    ]);

  it('replaces the judged card with a black card; the old card goes to his hand', () => {
    let s = judgedOnC(zhangJiao('seat-a'), { 'seat-a': [card('k', 'sha', 'club', 3), card('r', 'peach', 'heart', 2)] });
    expect(askedAbout(s)).toBe('dark-magic');
    s = h.use(s);
    expect(s.pendingSelection?.eligibleIds).toEqual(['k']);
    s = h.select(s, 'k');
    expect(handIds(s, 'seat-a')).toEqual(['r', 'j']);
    expect(s.turn.flags).toEqual({ skipPlay: true }); // a club: the Capture lands
    expect(ids(s, 'discardPile')).toEqual(['k']);
  });

  it('is ordered with Devil, from the judged seat', () => {
    const s = judgedOnC({ ...zhangJiao('seat-d'), 'seat-b': ['sima-yi', 'xun-yu'] }, { 'seat-d': [card('k', 'sha', 'club', 3)], 'seat-b': [card('x', 'shan')] });
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-d', reason: { abilityId: 'dark-magic' } });
    expect(h.decline(s).pendingChoice).toMatchObject({ seatId: 'seat-b', reason: { abilityId: 'devil' } });
  });
});

describe('Lightning Strike and Eight Trigrams (final review #2)', () => {
  it("an Eight Trigrams red judgment counts as his Shan: Lightning Strike is asked", () => {
    let s = h.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart', 3)] }, { owner: 'seat-b', generals: zhangJiao('seat-a') }), 's1', 'seat-a');
    s = h.use(s); // Eight Trigrams: red
    if (askedAbout(s) === 'dark-magic') s = h.decline(s); // his own Dark Magic, on his worn black card
    expect(askedAbout(s)).toBe('lightning-strike');
  });
});
