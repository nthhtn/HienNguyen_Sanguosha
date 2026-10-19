import type { GameState } from 'engine';
import { buildContentRegistry, kingdomWarMode } from '../../public-api';
import { card, harness, hp, ids, registry, table } from '../generals/skills.testing';
import { SHA_FLAGS } from './shaRules';

const h = harness();
const shaPick = (s: GameState, cardId = 's1') =>
  h.legal(s, 'seat-a').find((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === cardId);

describe("Slash's targets in one window", () => {
  it('one target allowed: one action per seat, as before', () => {
    const plays = h.legal(table({ 'seat-a:hand': [card('s1', 'sha'), card('x', 'shan')] }), 'seat-a').filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 's1');
    expect(plays.map((a) => a.kind === 'PlayCardAction' && a.targets[0]?.seatId)).toEqual(['seat-b', 'seat-d']);
  });

  it('Sky Scorcher with the last hand card: up to 3 targets in range, no ask', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)] }, { seats: 6 });
    expect(shaPick(s)).toMatchObject({ targets: [], pickTargets: { min: 1, max: 3 } });
    const played = h.act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: ['seat-b', 'seat-f'].map((seatId) => ({ kind: 'seat' as const, seatId })) });
    expect(played.pendingChoice).toBeUndefined();
    expect(played.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(played.turn.cardPlays).toEqual({ sha: 1 });
  });

  it('the turn-long flags: one more Slash, any distance, one extra target, or none', () => {
    const won = table({ 'seat-a:hand': [card('s1', 'sha'), card('x', 'shan')] }, { flags: { [SHA_FLAGS.extraPlay]: true, [SHA_FLAGS.anyDistance]: true, [SHA_FLAGS.extraTarget]: true } });
    expect(shaPick(won)).toMatchObject({ pickTargets: { eligibleIds: ['seat-b', 'seat-c', 'seat-d'], max: 2 } });
    const lost = table({ 'seat-a:hand': [card('s1', 'sha')] }, { flags: { [SHA_FLAGS.none]: true } });
    expect(shaPick(lost)).toBeUndefined();
  });

  it('Sky Scorcher and an extra target stack to 4', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)] }, { seats: 6, flags: { [SHA_FLAGS.anyDistance]: true, [SHA_FLAGS.extraTarget]: true } });
    expect(shaPick(s)).toMatchObject({ pickTargets: { max: 4 } });
  });

  it('each target answers on its own, and the Slash is counted once', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)], 'seat-b:hand': [card('n1', 'shan')] }, { seats: 6 });
    let t = h.act(s, { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-b' }, { kind: 'seat', seatId: 'seat-f' }] });
    t = h.respond(t, 'n1');
    expect(t.pendingResponse?.respondingSeatId).toBe('seat-f');
    t = h.pass(t);
    expect([hp(t, 'seat-b'), hp(t, 'seat-f')]).toEqual([4, 3]);
  });

  it('a conversion Slash (Serpent Spear, the last 2 hand cards) after a won compete: targets first, then cards', () => {
    const s = table({ 'seat-a:hand': [card('x1', 'shan'), card('x2', 'peach', 'heart')], 'seat-a:equip': [card('sp', 'serpent-spear', 'spade', 12)] }, { flags: { [SHA_FLAGS.anyDistance]: true, [SHA_FLAGS.extraTarget]: true } });
    const action = h.legal(s, 'seat-a').find((a) => a.kind === 'UseConversionAction')!;
    expect(action).toMatchObject({ targets: [], pickTargets: { max: 2 } });
    const selecting = h.act(s, { ...action, pickTargets: undefined, targets: [{ kind: 'seat', seatId: 'seat-b' }, { kind: 'seat', seatId: 'seat-c' }] });
    const played = h.select(selecting, 'x1', 'x2');
    expect(played.pendingResponse?.respondingSeatId).toBe('seat-b');
  });
});

describe('Blaze', () => {
  it('is in the registry and dealt: its 3 printings are in the deck', () => {
    const reg = buildContentRegistry();
    expect(reg.cards.get('blaze')?.outOfDeck).toBeUndefined();
    const { state } = kingdomWarMode.setup(['s0', 's1'], reg, { seed: 1, counter: 0 });
    expect(state.zones.flatMap((z) => z.cards).filter((c) => c.definitionId === 'blaze')).toHaveLength(3);
  });

  it('its damage is 1 fire damage, and a Wood Armor wearer takes 2', () => {
    const blaze = { as: 'blaze', colour: 'red' as const, suit: 'heart' as const, rank: 4, physical: [] };
    for (const [equip, amount] of [[[], 1], [[card('wa', 'wood-armor', 'spade', 2)], 2]] as const) {
      let s = h.run(table({ 'seat-a:hand': [card('m', 'shan', 'spade', 2)], 'seat-b:hand': [card('t', 'sha', 'spade', 9)], 'seat-b:equip': [...equip] }), [
        { kind: 'ToolRuleEffect', tool: blaze, userSeatId: 'seat-a', target: { kind: 'seat', seatId: 'seat-b' } },
      ]);
      s = h.select(h.select(s, 't'), 'm');
      expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { amount, nature: 'fire' } });
    }
  });

  it('the target shows a hand card; a matching discard deals 1 fire damage; Cancel deals none', () => {
    const blaze = { as: 'blaze', colour: 'red' as const, suit: 'heart' as const, rank: 4, physical: [] };
    let s = h.run(table({ 'seat-a:hand': [card('m', 'shan', 'spade', 2), card('o', 'shan', 'club', 3)], 'seat-b:hand': [card('t', 'sha', 'spade', 9)] }), [
      { kind: 'ToolRuleEffect', tool: blaze, userSeatId: 'seat-a', target: { kind: 'seat', seatId: 'seat-b' } },
    ]);
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-b', eligibleIds: ['t'] });
    s = h.select(s, 't');
    expect(s.log.find((e) => e.kind === 'CardShownEvent')).toMatchObject({ card: { instanceId: 't' } });
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', eligibleIds: ['m'] });
    expect(hp(h.select(s, 'm'), 'seat-b')).toBe(3);
    expect(hp(h.cancel(s), 'seat-b')).toBe(4);
  });
});

describe('Eight Trigrams', () => {
  it('still works as before for the armour', () => {
    let s = h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart')] }), 's1', 'seat-b');
    s = h.use(s);
    expect(hp(s, 'seat-b')).toBe(4);
    expect(ids(s, 'discardPile')).toContain('j');
  });
});
