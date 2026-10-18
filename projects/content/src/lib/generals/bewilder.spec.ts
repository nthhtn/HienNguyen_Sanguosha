import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const yuJi = (seatId = 'seat-a'): TableOptions['generals'] => ({ [seatId]: ['yu-ji', 'filler-zuo-ci'] });
// Each other seat answers in turn: 'b' for believe, 'd' for doubt.
const answer = (s: GameState, answers: string) => [...answers].reduce((acc, a) => h.choose(acc, a === 'd' ? 'doubt' : 'believe'), s);
const claimSha = (claimed: ReturnType<typeof card>, answers: string) =>
  answer(h.select(h.convert(table({ 'seat-a:hand': [claimed], drawPile: [card('d1', 'shan'), card('d2', 'shan')] }, { generals: yuJi() }), 'seat-a', 'bewilder-sha', 'seat-b'), claimed.instanceId), answers);

describe('Yu Ji — Bewilder', () => {
  it('asks every other seat in turn whether it believes, naming the card claimed', () => {
    const s = h.select(h.convert(table({ 'seat-a:hand': [card('x', 'shan')] }, { generals: yuJi() }), 'seat-a', 'bewilder-sha', 'seat-b'), 'x');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b', verb: 'pick', reason: { abilityId: 'bewilder', cardId: 'sha' } });
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([{ kind: 'label', text: 'Believe' }, { kind: 'label', text: 'Doubt' }]);
    expect(h.choose(s, 'believe').pendingChoice?.seatId).toBe('seat-c');
  });

  it('believed by all: the card takes effect as named, and counts as a play', () => {
    const s = claimSha(card('x', 'shan', 'club'), 'bbb');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.log.find((e) => e.kind === 'CardShownEvent')).toMatchObject({ seatId: 'seat-a', card: { instanceId: 'x' } });
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'bewilder', outcome: 'claim-believed' })]);
  });

  it('doubted and a lie: each doubter draws 1, and the card is discarded', () => {
    const s = claimSha(card('x', 'shan', 'club'), 'bdd');
    expect(handIds(s, 'seat-c')).toEqual(['d1']);
    expect(handIds(s, 'seat-d')).toEqual(['d2']);
    expect(ids(s, 'discardPile')).toEqual(['x']);
    expect(s.pendingResponse).toBeNull();
  });

  it('doubted and true on a heart: each doubter loses 1 HP, and the card still takes effect', () => {
    const s = claimSha(card('x', 'sha', 'heart'), 'dbb');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('doubted and true on another suit: each doubter loses 1 HP, and the card is discarded', () => {
    const s = claimSha(card('x', 'sha', 'spade'), 'dbb');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(s.pendingResponse).toBeNull();
    expect(ids(s, 'discardPile')).toEqual(['x']);
  });

  it('a Fire Attack claimed as a Sha is a true claim (an elemental Sha is a Sha)', () => {
    const s = claimSha(card('x', 'fire-attack', 'spade', 4), 'dbb');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: 'bewilder', outcome: 'claim-true' }));
  });

  it('answering a window: a believed claim answers it', () => {
    let s = h.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('x', 'peach', 'heart')] }, { owner: 'seat-b', generals: yuJi() }), 's1', 'seat-a');
    s = h.select(h.convert(s, 'seat-a', 'bewilder-shan'), 'x');
    expect(s.pendingResponse).toBeNull(); // set aside while the seats answer
    s = answer(s, 'bbb');
    expect(hp(s, 'seat-a')).toBe(4);
  });

  describe('a failed claim answering a window', () => {
    // seat-b hits Yu Ji with Sha; she answers with Bewilder-Shan naming x, and the others doubt.
    const failed = (extraHand: ReturnType<typeof card>[], claimed: ReturnType<typeof card>) => {
      let s = h.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [claimed, ...extraHand] }, { owner: 'seat-b', generals: yuJi() }), 's1', 'seat-a');
      s = h.select(h.convert(s, 'seat-a', 'bewilder-shan'), claimed.instanceId);
      return answer(s, 'dbb');
    };

    it('a failed lie with no other answer resolves the guarded effect without re-opening the window', () => {
      const s = failed([], card('x', 'peach', 'heart'));
      expect(hp(s, 'seat-a')).toBe(3);
      expect(s.pendingResponse).toBeNull();
    });

    it('a failed lie re-opens the window when the seat still has a legal answer', () => {
      const s = failed([card('y', 'shan')], card('x', 'peach', 'heart'));
      expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' });
      expect(hp(s, 'seat-a')).toBe(4);
    });

    it('Eight Trigrams worn is asked before the window, so a failed lie after declining it does not re-open the window', () => {
      let s = h.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('x', 'peach', 'heart')], 'seat-a:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('d1', 'shan'), card('d2', 'shan')] }, { owner: 'seat-b', generals: yuJi() }), 's1', 'seat-a');
      expect(askedAbout(s)).toBe('eight-trigrams');
      expect(s.pendingResponse).toBeNull(); // the window is not open yet, so Bewilder cannot be used inside it
      s = h.decline(s);
      s = answer(h.select(h.convert(s, 'seat-a', 'bewilder-shan'), 'x'), 'dbb');
      expect(s.pendingResponse).toBeNull();
      expect(hp(s, 'seat-a')).toBe(3);
    });

    it('a true claim on a non-heart with no other answer resolves the guarded effect', () => {
      const s = failed([], card('x', 'shan', 'spade'));
      expect(hp(s, 'seat-b')).toBe(3);
      expect(hp(s, 'seat-a')).toBe(3);
      expect(s.pendingResponse).toBeNull();
    });
  });

  it('answering a Wuxie check with no real Wuxie: believed, the Tool is cancelled; caught lying with no answer left, the Tool goes ahead', () => {
    // seat-b plays Steal on Yu Ji; she holds only x.
    const steal = () => h.play(table({ 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('x', 'shan')] }, { owner: 'seat-b', generals: yuJi() }), 'st', 'seat-a');
    let s = steal();
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
    s = answer(h.select(h.convert(s, 'seat-a', 'bewilder-wuxie'), 'x'), 'bbb');
    expect(s.pendingChoice).toBeUndefined(); // no Steal choice: cancelled
    expect(s.pendingResponse).toBeNull();
    const lie = answer(h.select(h.convert(steal(), 'seat-a', 'bewilder-wuxie'), 'x'), 'bdb');
    // With no Wuxie left to answer, the check does not come back: the Steal goes ahead as a Pass would let it.
    // The Steal goes ahead once: seat-b picks from Yu Ji, whose hand is empty now, so nothing is left to pick.
    expect(lie.log.filter((e) => e.kind === 'CardPlayedEvent' && e.card.as === 'steal')).toHaveLength(1);
    expect(lie.pendingResponse).toBeNull();
  });
});

describe('Bewilder and a target who dies doubting (final review #5)', () => {
  it('a true heart Sha whose only target died of doubting is discarded, not played', () => {
    const kw = harness(kwMode);
    let s = kw.select(kw.convert(table({ 'seat-a:hand': [card('x', 'sha', 'heart')] }, { generals: yuJi(), hp: { 'seat-b': 1 } }), 'seat-a', 'bewilder-sha', 'seat-b'), 'x');
    s = kw.choose(s, 'doubt'); // seat-b doubts
    s = kw.choose(s, 'believe');
    s = kw.choose(s, 'believe');
    while (s.pendingResponse?.reason?.kind === 'dying') s = kw.pass(s);
    expect(s.seats[1].eliminated).toBe(true);
    expect(s.log.some((e) => e.kind === 'CardPlayedEvent' && e.card.as === 'sha')).toBe(false);
    expect(s.turn.cardPlays).toBeUndefined();
    expect(ids(s, 'discardPile')).toContain('x');
  });
});
