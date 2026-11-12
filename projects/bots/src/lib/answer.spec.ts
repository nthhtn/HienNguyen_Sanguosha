import { getLegalActions } from 'engine';
import type { Action, CardInstance, GameState } from 'engine';
import { ruleBasedV5Policy } from './rule-based';
import { act, card, decideWaste, decideWith, registry, table as baseTable } from './testing';

// Every seat plays for its Kingdom, so allies, truce partners and foes are told apart.
const table: typeof baseTable = (c, o) => {
  const s = baseTable(c, o);
  return { ...s, seats: s.seats.map((x) => ({ ...x, allegiance: 'kingdom' as const })) };
};
const hiddenHand = (seat: string, n: number) => ({ [`${seat}:hand`]: Array.from({ length: n }, (_, i) => card(`${seat}-h${i}`, 'hidden')) });
const cards = (seat: string, ...defs: string[]): Record<string, CardInstance[]> => ({ [`${seat}:hand`]: defs.map((d, i) => card(`${seat}-${i}`, d)) });
// seat-c and seat-d are revealed allies of the bot (seat-a), so seat-b is the only foe unless a test says so.
const ALLIED = { 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Wei', 'seat-d': 'Wei' } as const;
// seat-b, seat-c and seat-d each wield an Axe (a weapon adds to the threat they pose, rule C2).
const armed = Object.fromEntries(['seat-b', 'seat-c', 'seat-d'].map((id) => [`${id}:equip`, [card(`${id}-axe`, 'axe')]]));

// `owner` plays `definitionId` at seat-a (the bot): any Wuxie check passes, and the state rests on seat-a's answer.
function hitOn(s: GameState, owner: string, definitionId: string): GameState {
  const play = (state: GameState): GameState => {
    const ids = state.pendingResponse?.respondingSeatId;
    if (ids === 'seat-a' && state.pendingResponse?.reason?.kind !== 'wuxie') return state;
    const pass = getLegalActions(state, ids ?? owner, registry).find((a: Action) => a.kind === 'PassAction');
    return pass ? play(act(state, pass)) : state;
  };
  const legal = getLegalActions(s, owner, registry).filter((a) => a.kind === 'PlayCardAction' && s.zones.some((z) => z.cards.some((c) => c.instanceId === a.cardInstanceId && c.definitionId === definitionId)));
  const target = legal.find((a) => a.kind === 'PlayCardAction' && (a.targets.length === 0 || a.targets[0].kind === 'seat' && a.targets[0].seatId === 'seat-a'));
  return play(act(s, target ?? legal[0]));
}
const sha = (s: GameState, owner = 'seat-b') => hitOn(s, owner, 'sha');
const kind = (s: GameState) => decideWaste(s).kind;

describe('answer: a Sha (C3)', () => {
  it('answers a lethal hit', () => {
    const s = sha(table({ ...cards('seat-a', 'shan'), ...cards('seat-b', 'sha') }, { owner: 'seat-b', hp: { 'seat-a': 1 }, kingdoms: ALLIED }));
    expect(kind(s)).toBe('RespondAction');
  });
  it('passes with one Shan when only the attacker acts before its next turn and it is not exposed', () => {
    const s = sha(table({ ...cards('seat-a', 'shan'), ...cards('seat-b', 'sha') }, { owner: 'seat-b', hp: { 'seat-a': 3 }, kingdoms: ALLIED }));
    expect(kind(s)).toBe('PassAction');
  });
  it('answers with a spare Shan: more Shan in hand than seats counted as threats', () => {
    const s = sha(table({ ...cards('seat-a', 'shan', 'shan'), ...cards('seat-b', 'sha') }, { owner: 'seat-b', hp: { 'seat-a': 3 }, kingdoms: ALLIED }));
    expect(kind(s)).toBe('RespondAction');
  });
  it('passes with one Shan when a 2-card foe acts before its next turn and it is not exposed', () => {
    const s = sha(table({ ...cards('seat-a', 'shan'), ...cards('seat-b', 'sha'), ...hiddenHand('seat-d', 2) }, { owner: 'seat-b', hp: { 'seat-a': 3 }, kingdoms: { ...ALLIED, 'seat-d': 'Qun' } }));
    expect(kind(s)).toBe('PassAction');
  });
  it('answers when three armed 5-card foes act next and it is at 2 HP', () => {
    const s = sha(table({ ...cards('seat-a', 'shan'), 'seat-b:hand': [card('s', 'sha'), ...hiddenHand('seat-b', 5)['seat-b:hand']], ...hiddenHand('seat-c', 5), ...hiddenHand('seat-d', 5), ...armed }, { owner: 'seat-b', hp: { 'seat-a': 2 }, kingdoms: { ...ALLIED, 'seat-c': 'Wu', 'seat-d': 'Qun' } }));
    expect(kind(s)).toBe('RespondAction');
  });
});

describe('answer: Matchless (C3)', () => {
  const lu = { 'seat-b': ['lu-bu', 'filler-dong-zhuo', true] as [string, string, boolean] };
  it('never gives a partial answer: one Shan at 1 HP passes', () => {
    const s = sha(table({ ...cards('seat-a', 'shan'), ...cards('seat-b', 'sha') }, { owner: 'seat-b', hp: { 'seat-a': 1 }, generals: lu, kingdoms: ALLIED }));
    expect(decideWaste(s)).toMatchObject({ kind: 'PassAction' });
  });
  it('answers with two Shan when exposed', () => {
    const s = sha(table({ ...cards('seat-a', 'shan', 'shan'), 'seat-b:hand': [card('s', 'sha'), ...hiddenHand('seat-b', 7)['seat-b:hand']], ...hiddenHand('seat-c', 7), ...hiddenHand('seat-d', 7), ...armed }, { owner: 'seat-b', hp: { 'seat-a': 2 }, generals: lu, kingdoms: { ...ALLIED, 'seat-c': 'Wu', 'seat-d': 'Qun' } }));
    expect(kind(s)).toBe('RespondAction');
  });
});

describe('answer: Matchless, later windows and mass cards (C3, C3a)', () => {
  const lu = { 'seat-b': ['lu-bu', 'filler-dong-zhuo', true] as [string, string, boolean] };
  it('keeps answering the second window after the first Shan', () => {
    const first = sha(table({ ...cards('seat-a', 'shan', 'shan'), ...cards('seat-b', 'sha') }, { owner: 'seat-b', hp: { 'seat-a': 3 }, generals: lu, kingdoms: ALLIED }));
    const one = decideWaste(first);
    expect(one.kind).toBe('RespondAction');
    const second = act(first, one);
    expect(second.pendingResponse?.respondingSeatId).toBe('seat-a');
    expect(decideWaste(second).kind).toBe('RespondAction');
  });
  it('a Hail of Arrows from Lu Bu needs one answer: one Shan at 1 HP answers', () => {
    const s = hitOn(table({ ...cards('seat-a', 'shan'), ...cards('seat-b', 'hail-of-arrows') }, { owner: 'seat-b', hp: { 'seat-a': 1 }, generals: lu, kingdoms: ALLIED }), 'seat-b', 'hail-of-arrows');
    expect(kind(s)).toBe('RespondAction');
  });
  it('counts a Shan made by a conversion: Dragon Courage with a Sha and no Shan answers a lethal Sha', () => {
    const s = sha(table({ ...cards('seat-a', 'sha'), ...cards('seat-b', 'sha') }, { owner: 'seat-b', hp: { 'seat-a': 1 }, generals: { 'seat-a': ['zhao-yun', 'filler-dong-zhuo', true] }, kingdoms: ALLIED }));
    expect(kind(s)).toBe('UseConversionAction');
  });
});

describe('answer: a Duel (C3)', () => {
  const duel = (c: Record<string, CardInstance[]>, o: Parameters<typeof table>[1]) => hitOn(table({ ...cards('seat-b', 'duel'), ...c }, { owner: 'seat-b', ...o }), 'seat-b', 'duel');
  it('passes against a truce partner when not exposed', () => {
    const s = duel(cards('seat-a', 'sha', 'sha'), { hp: { 'seat-a': 3 }, kingdoms: { 'seat-a': 'Qun', 'seat-b': 'Wu', 'seat-c': 'Wei', 'seat-d': 'Wei' } });
    expect(kind(s)).toBe('PassAction');
  });
  it('fights a foe with 1 card while holding 2 Sha', () => {
    const s = duel({ ...cards('seat-a', 'sha', 'sha'), ...hiddenHand('seat-b', 0), 'seat-b:hand': [card('d', 'duel')] }, { hp: { 'seat-a': 3 }, kingdoms: ALLIED });
    expect(kind(s)).toBe('RespondAction');
  });
  it('passes against a foe with 6 cards while holding 1 Sha at 3 HP', () => {
    const s = duel({ ...cards('seat-a', 'sha'), 'seat-b:hand': [card('d', 'duel'), ...hiddenHand('seat-b', 5)['seat-b:hand']] }, { hp: { 'seat-a': 3 }, kingdoms: ALLIED });
    expect(kind(s)).toBe('PassAction');
  });
});

describe('answer: Hail of Arrows (C3a)', () => {
  it('passes at 4 HP with one Shan, not exposed', () => {
    const s = hitOn(table({ ...cards('seat-a', 'shan'), ...cards('seat-b', 'hail-of-arrows'), ...hiddenHand('seat-d', 2) }, { owner: 'seat-b', hp: { 'seat-a': 4 }, kingdoms: { ...ALLIED, 'seat-d': 'Qun' } }), 'seat-b', 'hail-of-arrows');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-a');
    expect(kind(s)).toBe('PassAction');
  });
});

describe('answer: the switch off', () => {
  it('rule-based-v5 still answers the 3-HP Sha with a foe acting next', () => {
    const s = sha(table({ ...cards('seat-a', 'shan'), ...cards('seat-b', 'sha'), ...hiddenHand('seat-d', 2) }, { owner: 'seat-b', hp: { 'seat-a': 3 }, kingdoms: { ...ALLIED, 'seat-d': 'Qun' } }));
    expect(decideWith(ruleBasedV5Policy, s).kind).toBe('RespondAction');
  });
});

describe('answer: starting a Duel (C4)', () => {
  const play = (foeCards: number) => {
    const s = table({ ...cards('seat-a', 'duel', 'sha'), ...hiddenHand('seat-b', foeCards) }, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Shu', 'seat-c': 'Wei', 'seat-d': 'Wei' } });
    // The Sha limit is spent, so the Sha is held for the Duel rather than played.
    return decideWaste({ ...s, turn: { ...s.turn, cardPlays: { sha: 1 } } });
  };
  it('is not played on a 7-card foe while holding one Sha', () => expect(play(7).kind).toBe('EndPhaseAction'));
  it('is played on a 0-card foe', () => expect(play(0)).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'seat-a-0' }));
});
