import type { GameState } from 'engine';
import { redactStateForSeat } from 'engine';
import { card, handIds, harness, ids, registry, table, TableOptions } from '../generals/skills.testing';
import { alternateCardData } from '../alternateCards';
import { isRecast } from './chains';

// Ascertain (spec "Ascertain"): a Tool at another living seat; after its Wuxie
// check the user looks, in secret, at one of the target's hidden Generals or at
// its whole hand (only the hand when both its Generals are exposed). Or Recast:
// discard it and draw 1, with no target and no Wuxie check.
const h = harness();
const as = card('as', 'ascertain', 'spade', 3);
const drawPile = [card('d1', 'shan', 'heart', 1), card('d2', 'shan', 'heart', 2)];
const bHand = [card('b1', 'peach', 'heart', 4), card('b2', 'duel', 'club', 9)];
const ascertainIn = (more: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
  table({ 'seat-a:hand': [as], drawPile, 'seat-b:hand': bHand, ...more }, o);
// seat-b with the named slots face down (Kingdom kept as dealt).
const hide = (s: GameState, ...slots: ('main' | 'deputy')[]): GameState => ({
  ...s,
  seats: s.seats.map((x) =>
    x.id === 'seat-b' && x.generals
      ? { ...x, generals: { main: { ...x.generals.main, revealed: !slots.includes('main') }, deputy: { ...x.generals.deputy, revealed: !slots.includes('deputy') } } }
      : x
  ),
});
const offers = (s: GameState) => h.legal(s, 'seat-a').filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'as');
const optionIds = (s: GameState) => s.pendingChoice?.options.map((o) => o.id);

describe('Ascertain', () => {
  it('is a registered Tool', () => {
    expect(registry.cards.get('ascertain')).toMatchObject({ id: 'ascertain', category: 'tool', name: alternateCardData('ascertain')!.name });
  });

  it('offers the Recast and each other living seat, not the user or a dead seat', () => {
    const t = ascertainIn();
    const s: GameState = { ...t, seats: t.seats.map((x) => (x.id === 'seat-d' ? { ...x, eliminated: true } : x)) };
    expect(offers(s).map((a) => (a.kind === 'PlayCardAction' ? a.targets : null))).toEqual([[], [{ kind: 'seat', seatId: 'seat-b' }], [{ kind: 'seat', seatId: 'seat-c' }]]);
  });

  it('leaves out a seat that cannot be targeted by it (Curtain: a black Tool)', () => {
    const s = ascertainIn({}, { generals: { 'seat-b': ['jia-xu', 'filler-dong-zhuo'] } });
    expect(offers(s).map((a) => (a.kind === 'PlayCardAction' ? a.targets.map((t) => (t.kind === 'seat' ? t.seatId : '')) : null))).toEqual([[], ['seat-c'], ['seat-d']]);
  });

  describe('Recast', () => {
    it('discards Ascertain and draws 1, opening no Wuxie check and no look', () => {
      const s = h.play(ascertainIn({ 'seat-d:hand': [card('w', 'wuxie', 'spade', 12)] }), 'as');
      expect(s.pendingResponse).toBeNull();
      expect(s.pendingChoice).toBeUndefined();
      expect(ids(s, 'discardPile')).toEqual(['as']);
      expect(handIds(s, 'seat-a')).toEqual(['d1']);
      const played = s.log.find((e) => e.kind === 'CardPlayedEvent');
      expect(played && played.kind === 'CardPlayedEvent' && isRecast(played)).toBe(true);
    });

    it('is not a use: Gathering Wisdom is not asked', () => {
      const s = h.play(ascertainIn({}, { generals: { 'seat-a': ['huang-yueying', 'filler-meng-huo'] } }), 'as');
      expect(s.pendingChoice).toBeUndefined();
      expect(handIds(s, 'seat-a')).toEqual(['d1']);
    });
  });

  describe('the look', () => {
    it('both Generals exposed: only the hand is offered, in a secret choice for the user', () => {
      const s = h.play(ascertainIn(), 'as', 'seat-b');
      expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true, reason: { kind: 'choice', userSeatId: 'seat-a', targetSeatId: 'seat-b' } });
      expect(optionIds(s)).toEqual(['hand']);
      expect(s.pendingChoice!.options[0].shows).toEqual({ kind: 'label', text: 'Hand Cards' });
    });

    it('both Generals exposed and an empty hand: still only the hand', () => {
      const s = h.play(ascertainIn({ 'seat-b:hand': [] }), 'as', 'seat-b');
      expect(optionIds(s)).toEqual(['hand']);
      const look = h.choose(s, 'hand');
      expect(look.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true });
      expect(optionIds(look)).toEqual(['done']);
    });

    it('one hidden General: it and the hand are offered', () => {
      const s = h.play(hide(ascertainIn(), 'deputy'), 'as', 'seat-b');
      expect(optionIds(s)).toEqual(['deputy', 'hand']);
      expect(s.pendingChoice!.options[0].shows).toEqual({ kind: 'label', text: 'Deputy General' });
    });

    it('both hidden: both slots and the hand are offered', () => {
      const s = h.play(hide(ascertainIn(), 'main', 'deputy'), 'as', 'seat-b');
      expect(optionIds(s)).toEqual(['main', 'deputy', 'hand']);
      expect(s.pendingChoice!.options[0].shows).toEqual({ kind: 'label', text: 'Main General' });
    });

    it('the hand: a second secret choice shows each hand card face up, then Done; nothing moves', () => {
      let s = h.choose(h.play(ascertainIn(), 'as', 'seat-b'), 'hand');
      expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true });
      expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([
        { kind: 'card', card: bHand[0] },
        { kind: 'card', card: bHand[1] },
        { kind: 'label', text: 'Done' },
      ]);
      expect(s.pendingChoice!.options.every((o) => o.effects.length === 0)).toBe(true);
      s = h.choose(s, 'done');
      expect(s.pendingChoice).toBeUndefined();
      expect(handIds(s, 'seat-b')).toEqual(['b1', 'b2']);
      expect(ids(s, 'discardPile')).toEqual(['as']);
    });

    it('a hidden General: the second choice shows that General', () => {
      const s = h.choose(h.play(hide(ascertainIn(), 'main', 'deputy'), 'as', 'seat-b'), 'deputy');
      expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([
        { kind: 'general', generalId: 'filler-dong-zhuo' },
        { kind: 'label', text: 'Done' },
      ]);
      expect(s.seats.find((x) => x.id === 'seat-b')!.generals!.deputy.revealed).toBe(false);
    });

    it('a Wuxie cancels it: no look', () => {
      let s = h.play(ascertainIn({ 'seat-d:hand': [card('w', 'wuxie', 'spade', 12)] }), 'as', 'seat-b');
      expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', reason: { kind: 'wuxie' } });
      s = h.respond(s, 'w');
      expect(s.pendingChoice).toBeUndefined();
    });

    it('only the user sees it: other seats see neither the options nor the cards, and the log says only that it was used', () => {
      let s = h.choose(h.play(hide(ascertainIn(), 'deputy'), 'as', 'seat-b'), 'hand');
      expect(redactStateForSeat(s, 'seat-a').pendingChoice!.options.map((o) => o.id)).toEqual(['b1', 'b2', 'done']);
      expect(redactStateForSeat(s, 'seat-a').pendingChoice!.options[0].shows).toEqual({ kind: 'card', card: bHand[0] });
      for (const viewer of ['seat-b', 'seat-c']) expect(redactStateForSeat(s, viewer).pendingChoice!.options).toEqual([]);
      s = h.choose(s, 'done');
      const log = JSON.stringify(s.log);
      expect(log).not.toContain('Hand Cards');
      expect(log).not.toContain('"peach"');
      expect(log).not.toContain('filler-dong-zhuo');
      const picks = s.log.filter((e) => e.kind === 'ChoiceMadeEvent');
      expect(picks).toHaveLength(2);
      expect(picks.every((e) => e.kind === 'ChoiceMadeEvent' && e.secret)).toBe(true);
    });
  });
});
