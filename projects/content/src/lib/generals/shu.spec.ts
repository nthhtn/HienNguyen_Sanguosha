import type { GameState } from 'engine';
import { card, handIds, harness, hp, registry, table, TableOptions } from './skills.testing';
import { shaLimit } from '../shared/queries';

const { legal, play, pass, convert, select, cancel } = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', revealed] });
const playTargets = (s: GameState, seatId: string, cardId: string) =>
  legal(s, seatId).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));
const conversions = (s: GameState, seatId: string) => legal(s, seatId).filter((a) => a.kind === 'UseConversionAction');

describe('Zhang Fei — Roar', () => {
  it('no limit on Slash', () => {
    let s = table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha'), card('s3', 'sha')] }, { generals: at('seat-a', 'zhang-fei') });
    s = pass(play(s, 's1', 'seat-b'));
    s = pass(play(s, 's2', 'seat-b'));
    expect(playTargets(s, 'seat-a', 's3')).toContain('seat-b');
  });

  it('is off while Zhang Fei is hidden: the Sha limit is the revealed one', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha')] }, { generals: at('seat-a', 'zhang-fei', false) });
    expect(shaLimit(s, 'seat-a', registry)).toBe(1);
  });
});

describe('Zhang Fei — Roar (revealed on use)', () => {
  const hidden = () => table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha'), card('s3', 'sha')] }, { generals: at('seat-a', 'zhang-fei', false) });

  it('the first Sha does not reveal him; a second Sha is offered and playing it does', () => {
    let s = pass(play(hidden(), 's1', 'seat-b'));
    expect(s.seats[0].generals!.main.revealed).toBe(false);
    expect(playTargets(s, 'seat-a', 's2')).toContain('seat-b');
    s = pass(play(s, 's2', 'seat-b'));
    expect(s.seats[0].generals!.main.revealed).toBe(true);
    expect(s.log.filter((e) => e.kind === 'GeneralRevealedEvent')).toEqual([{ kind: 'GeneralRevealedEvent', seatId: 'seat-a', slot: 'main', forAbilityId: 'roar' }]);
    // Revealed, Roar is on without another reveal.
    expect(playTargets(s, 'seat-a', 's3')).toContain('seat-b');
  });

  it('offers no reveal by itself: nothing but a play reveals him', () => {
    expect(legal(hidden(), 'seat-a').some((a) => a.kind === 'ConfirmRevealsAction')).toBe(false);
  });
});

describe('Ma Chao — Horsemanship', () => {
  it('reaches a seat 2 away with an unarmed Slash', () => {
    const cards = { 'seat-a:hand': [card('s1', 'sha')] };
    expect(playTargets(table(cards, { generals: at('seat-a', 'ma-chao') }), 'seat-a', 's1')).toEqual(['seat-b', 'seat-c', 'seat-d']);
    expect(playTargets(table(cards, { generals: at('seat-a', 'ma-chao', false) }), 'seat-a', 's1')).toEqual(['seat-b', 'seat-d']);
  });
});

describe('Zhuge Liang — Empty City', () => {
  it('with no hand cards he can’t be targeted by Slash or Duel', () => {
    const attacker = { 'seat-a:hand': [card('s1', 'sha'), card('du', 'duel', 'spade', 1)] };
    const empty = table(attacker, { generals: at('seat-b', 'zhuge-liang') });
    expect(playTargets(empty, 'seat-a', 's1')).not.toContain('seat-b');
    expect(playTargets(empty, 'seat-a', 'du')).not.toContain('seat-b');
    const holding = table({ ...attacker, 'seat-b:hand': [card('x', 'peach', 'heart')] }, { generals: at('seat-b', 'zhuge-liang') });
    expect(playTargets(holding, 'seat-a', 's1')).toContain('seat-b');
    expect(playTargets(table(attacker, { generals: at('seat-b', 'zhuge-liang', false) }), 'seat-a', 's1')).toContain('seat-b');
  });
});

describe('Huang Yueying — Wondrous Talent', () => {
  it('her Steal and Starvation ignore distance', () => {
    const s = table({ 'seat-a:hand': [card('st', 'steal'), card('sv', 'starvation', 'club', 4)], 'seat-c:hand': [card('x', 'shan')] }, { generals: { 'seat-a': ['huang-yueying', 'filler-meng-huo'] } });
    expect(playTargets(s, 'seat-a', 'st')).toContain('seat-c');
    expect(playTargets(s, 'seat-a', 'sv')).toContain('seat-c');
  });
});

describe('Guan Yu — Fighting Saint', () => {
  it('uses a red card from his hand or equipment as a Slash in his Play Phase', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach', 'heart'), card('k', 'shan', 'spade')], 'seat-a:equip': [card('rh', 'red-hare', 'heart', 5)] }, { generals: at('seat-a', 'guan-yu') });
    const selecting = convert(s, 'seat-a', 'fighting-saint', 'seat-b');
    expect(selecting.pendingSelection).toMatchObject({ eligibleIds: ['p', 'rh'], min: 1, max: 1 });
    const used = select(selecting, 'rh');
    expect(used.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(used.turn.cardPlays).toEqual({ sha: 1 });
    expect(handIds(used, 'seat-a')).toEqual(['p', 'k']);
  });

  it('answers a Duel with a red card', () => {
    let s = play(table({ 'seat-b:hand': [card('du', 'duel', 'spade', 1)], 'seat-a:hand': [card('p', 'peach', 'heart')] }, { owner: 'seat-b', generals: at('seat-a', 'guan-yu') }), 'du', 'seat-a');
    s = select(convert(s, 'seat-a', 'fighting-saint'), 'p');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
  });

  it('is not offered without a red card', () => {
    expect(conversions(table({ 'seat-a:hand': [card('k', 'shan', 'spade')] }, { generals: at('seat-a', 'guan-yu') }), 'seat-a')).toEqual([]);
  });
});

describe('Zhao Yun — Dragon Courage', () => {
  it('a Dodge as a Slash in his Play Phase', () => {
    const s = select(convert(table({ 'seat-a:hand': [card('n', 'shan', 'diamond')] }, { generals: at('seat-a', 'zhao-yun') }), 'seat-a', 'shan-as-sha', 'seat-b'), 'n');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
  });

  it('a Slash as a Dodge, answering', () => {
    let s = play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('s2', 'sha', 'club')] }, { owner: 'seat-b', generals: at('seat-a', 'zhao-yun') }), 's1', 'seat-a');
    s = select(convert(s, 'seat-a', 'sha-as-shan'), 's2');
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('hidden: Cancel leaves him hidden and the window open; confirming reveals him, then the Slash is dodged', () => {
    let s = play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('s2', 'sha', 'club')] }, { owner: 'seat-b', generals: at('seat-a', 'zhao-yun', false) }), 's1', 'seat-a');
    const window = s.pendingResponse!.id;
    const cancelled = cancel(convert(s, 'seat-a', 'sha-as-shan'));
    expect(cancelled.seats[0].generals!.main.revealed).toBe(false);
    expect(cancelled.pendingResponse?.id).toBe(window);
    s = select(convert(cancelled, 'seat-a', 'sha-as-shan'), 's2');
    expect(s.seats[0].generals!.main.revealed).toBe(true);
    expect(s.log.find((e) => e.kind === 'GeneralRevealedEvent')).toMatchObject({ seatId: 'seat-a', slot: 'main', forAbilityId: 'dragon-courage' });
    expect(hp(s, 'seat-a')).toBe(4);
  });
});

describe('Fighting Saint with a worn card (final review #1)', () => {
  it('can’t use the horse that brings the target in reach', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach', 'heart')], 'seat-a:equip': [card('rh', 'red-hare', 'heart', 5)] }, { generals: at('seat-a', 'guan-yu') });
    expect(convert(s, 'seat-a', 'fighting-saint', 'seat-c').pendingSelection?.eligibleIds).toEqual(['p']);
    const horseOnly = table({ 'seat-a:equip': [card('rh', 'red-hare', 'heart', 5)] }, { generals: at('seat-a', 'guan-yu') });
    expect(conversions(horseOnly, 'seat-a').map((a) => a.targets[0]?.seatId)).toEqual(['seat-b', 'seat-d']);
  });

  it('can’t use the Crossbow that lifts the Slash limit', () => {
    const s = table({ 'seat-a:hand': [card('p', 'peach', 'heart')], 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)] }, { generals: at('seat-a', 'guan-yu') });
    const afterOne = { ...s, turn: { ...s.turn, cardPlays: { sha: 1 } } };
    expect(convert(afterOne, 'seat-a', 'fighting-saint', 'seat-b').pendingSelection?.eligibleIds).toEqual(['p']);
  });
});
