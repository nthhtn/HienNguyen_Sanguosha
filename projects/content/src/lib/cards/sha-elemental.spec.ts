import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, registry, table, TableOptions } from '../generals/skills.testing';
import { isShaCard } from '../shared/queries';

// Fire Attack and Lightning Attack (spec "Fire Attack and Lightning Attack"):
// Sha in every respect, except that the damage has the card's nature.
const { act, legal, play, pass, respond, convert, select, use } = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', revealed] });
const damages = (s: GameState) => s.log.flatMap((e) => (e.kind === 'DamageDealtEvent' ? [e.damage] : []));
const playTargets = (s: GameState, seatId: string, cardId: string) =>
  legal(s, seatId).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));
const respondable = (s: GameState) => legal(s, s.pendingResponse!.respondingSeatId).flatMap((a) => (a.kind === 'RespondAction' ? [a.cardInstanceId] : []));

describe('Fire Attack and Lightning Attack', () => {
  it('are Sha cards; Sha is too, nothing else is', () => {
    expect(['sha', 'fire-attack', 'lightning-attack', 'shan', 'duel'].map((id) => isShaCard(registry, id))).toEqual([true, true, true, false, false]);
  });

  it('a Fire Attack deals 1 fire damage when no Shan comes; it is played as a Sha carrying its nature', () => {
    const played = play(table({ 'seat-a:hand': [card('f', 'fire-attack', 'heart', 4)] }), 'f', 'seat-b');
    expect(played.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(played.turn.cardPlays).toEqual({ sha: 1 });
    const s = pass(played);
    expect(hp(s, 'seat-b')).toBe(3);
    expect(damages(s)).toMatchObject([{ amount: 1, nature: 'fire', cause: { card: { as: 'sha', nature: 'fire' } } }]);
  });

  it('a Lightning Attack deals 1 thunder damage', () => {
    const s = pass(play(table({ 'seat-a:hand': [card('l', 'lightning-attack', 'spade', 5)] }), 'l', 'seat-b'));
    expect(hp(s, 'seat-b')).toBe(3);
    expect(damages(s)).toMatchObject([{ amount: 1, nature: 'thunder' }]);
  });

  it('a plain Sha stays plain', () => {
    const s = pass(play(table({ 'seat-a:hand': [card('s', 'sha')] }), 's', 'seat-b'));
    expect(damages(s)).toMatchObject([{ nature: 'normal' }]);
    expect(damages(s)[0].cause?.card).not.toHaveProperty('nature');
  });

  it('reach only seats within attacking range', () => {
    expect(playTargets(table({ 'seat-a:hand': [card('f', 'fire-attack', 'heart', 4)] }), 'seat-a', 'f')).toEqual(['seat-b', 'seat-d']);
  });

  it('a Shan answers them and a dodged one deals nothing', () => {
    const s = respond(play(table({ 'seat-a:hand': [card('f', 'fire-attack', 'heart', 4)], 'seat-b:hand': [card('d', 'shan')] }), 'f', 'seat-b'), 'd');
    expect(hp(s, 'seat-b')).toBe(4);
    expect(damages(s)).toEqual([]);
  });

  it('count toward the one Sha a turn, with any Sha', () => {
    const s = pass(play(table({ 'seat-a:hand': [card('f', 'fire-attack', 'heart', 4), card('l', 'lightning-attack', 'spade', 5), card('s', 'sha')] }), 'f', 'seat-b'));
    expect(playTargets(s, 'seat-a', 'l')).toEqual([]);
    expect(playTargets(s, 'seat-a', 's')).toEqual([]);
    const afterSha = pass(play(table({ 'seat-a:hand': [card('s', 'sha'), card('f', 'fire-attack', 'heart', 4)] }), 's', 'seat-b'));
    expect(playTargets(afterSha, 'seat-a', 'f')).toEqual([]);
  });

  it('Crossbow lifts the limit for them', () => {
    let s = table({ 'seat-a:hand': [card('f', 'fire-attack', 'heart', 4), card('l', 'lightning-attack', 'spade', 5)], 'seat-a:equip': [card('x', 'crossbow', 'club', 1)] });
    s = pass(play(s, 'f', 'seat-b'));
    expect(playTargets(s, 'seat-a', 'l')).toContain('seat-b');
  });

  it('Roar lifts the limit for them', () => {
    let s = table({ 'seat-a:hand': [card('f', 'fire-attack', 'heart', 4), card('l', 'lightning-attack', 'spade', 5)] }, { generals: at('seat-a', 'zhang-fei') });
    s = pass(play(s, 'f', 'seat-b'));
    expect(playTargets(s, 'seat-a', 'l')).toContain('seat-b');
  });

  it('Wine adds 1 to the elemental damage', () => {
    const s = pass(play(table({ 'seat-a:hand': [card('f', 'fire-attack', 'heart', 4)] }, { flags: { wine: true } }), 'f', 'seat-b'));
    expect(hp(s, 'seat-b')).toBe(2);
    expect(damages(s)).toMatchObject([{ amount: 2, nature: 'fire' }]);
    expect(s.turn.flags?.['wine']).toBeFalsy();
  });

  it('a Duel accepts a Fire Attack as the Sha played', () => {
    let s = play(table({ 'seat-a:hand': [card('du', 'duel', 'spade', 1)], 'seat-b:hand': [card('f', 'fire-attack', 'heart', 4)] }), 'du', 'seat-b');
    expect(respondable(s)).toEqual(['f']);
    s = respond(s, 'f');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', allowedCardIds: ['sha'] });
    s = pass(s);
    expect(hp(s, 'seat-a')).toBe(3);
    expect(damages(s)).toMatchObject([{ nature: 'normal' }]); // a Duel's damage is plain
  });

  it('Barbarians accept a Lightning Attack as the Sha played', () => {
    let s = play(table({ 'seat-a:hand': [card('ba', 'barbarians', 'spade', 7)], 'seat-b:hand': [card('l', 'lightning-attack', 'spade', 5)] }), 'ba');
    while (s.pendingResponse?.respondingSeatId !== 'seat-b') s = pass(s); // Wuxie windows, if any
    expect(respondable(s)).toEqual(['l']);
    s = respond(s, 'l');
    expect(hp(s, 'seat-b')).toBe(4);
    expect(handIds(s, 'seat-b')).toEqual([]);
  });

  it('Green Dragon Blade’s follow-up Sha offers a Fire Attack', () => {
    let s = play(
      table({ 'seat-a:hand': [card('s1', 'sha'), card('f', 'fire-attack', 'heart', 4)], 'seat-a:equip': [card('gdb', 'green-dragon-blade', 'spade', 5)], 'seat-b:hand': [card('d', 'shan')] }),
      's1',
      'seat-b'
    );
    s = respond(s, 'd');
    expect(askedAbout(s)).toBe('green-dragon-blade');
    s = use(s);
    expect(s.pendingSelection).toMatchObject({ eligibleIds: ['f'] });
    s = pass(select(s, 'f'));
    expect(damages(s)).toMatchObject([{ amount: 1, nature: 'fire' }]);
  });

  it('a Fire Attack converted to Sha by Fighting Saint is a plain Sha', () => {
    const s = pass(select(convert(table({ 'seat-a:hand': [card('f', 'fire-attack', 'heart', 4)] }, { generals: at('seat-a', 'guan-yu') }), 'seat-a', 'fighting-saint', 'seat-b'), 'f'));
    expect(hp(s, 'seat-b')).toBe(3);
    expect(damages(s)).toMatchObject([{ nature: 'normal' }]);
    expect(damages(s)[0].cause?.card).not.toHaveProperty('nature');
  });

  it('Dragon Courage uses a Fire Attack as a Shan', () => {
    let s = play(table({ 'seat-a:hand': [card('s', 'sha')], 'seat-b:hand': [card('f', 'fire-attack', 'heart', 4)] }, { generals: at('seat-b', 'zhao-yun') }), 's', 'seat-b');
    s = select(convert(s, 'seat-b', 'sha-as-shan'), 'f');
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it('Black Shield stops a black Lightning Attack', () => {
    const s = play(table({ 'seat-a:hand': [card('l', 'lightning-attack', 'club', 5)], 'seat-b:equip': [card('bs', 'black-shield', 'club', 2)] }), 'l', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'black-shield', outcome: 'no-effect' }]);
  });

  it('Ice Sword works on a Lightning Attack: no damage, 2 discards', () => {
    let s = pass(play(table({ 'seat-a:hand': [card('l', 'lightning-attack', 'spade', 5)], 'seat-a:equip': [card('is', 'ice-sword', 'spade', 2)], 'seat-b:hand': [card('p', 'peach', 'heart', 3)] }), 'l', 'seat-b'));
    expect(askedAbout(s)).toBe('ice-sword');
    s = use(s);
    while (s.pendingChoice) s = act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice.seatId, choiceId: s.pendingChoice.id, optionId: s.pendingChoice.options[0].id });
    expect(hp(s, 'seat-b')).toBe(4);
    expect(damages(s)).toEqual([]);
    expect(handIds(s, 'seat-b')).toEqual([]);
  });
});
