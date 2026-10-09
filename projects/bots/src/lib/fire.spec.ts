import { getLegalActions } from 'engine';
import { act, card, decide, picked, registry, table } from './testing';

// The Fire Generals' bot rules (stage 9 spec, "Bots").

describe('Fire conversions', () => {
  it('a bot that opened See Through fills its card pick instead of cancelling', () => {
    // seat-b Steals from Fire Zhuge Liang (seat-a), who holds a black card.
    let s = table({ 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('k', 'shan', 'club', 4)] }, { owner: 'seat-b', generals: { 'seat-a': ['fire-zhuge-liang', 'filler-jiang-wei'] } });
    s = act(s, { kind: 'PlayCardAction', seatId: 'seat-b', cardInstanceId: 'st', targets: [{ kind: 'seat', seatId: 'seat-a' }] });
    const open = getLegalActions(s, 'seat-a', registry).find((a) => a.kind === 'UseConversionAction')!;
    s = act(s, open);
    expect(picked(decide(s))).toEqual(['k']);
  });
});
