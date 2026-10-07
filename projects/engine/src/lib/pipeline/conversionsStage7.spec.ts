import { advanceToDecision, resolve } from './resolve';
import { getLegalActions } from '../rules/legality';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { CardInstance, GameState } from '../domain/types';
import { Effect } from './effects';

const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const red = (c: CardInstance) => c.suit === 'heart' || c.suit === 'diamond';
const peach: CardDefinition = { id: 'peach', name: 'Peach', category: 'basic', play: () => [] };
const plain: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };
const gear: CardDefinition = { id: 'gear', name: 'Gear', category: 'equipment', equipSlot: 'armor', play: () => [] };
// A red card from hand or equipment as a Peach, to answer, only outside its owner's turn.
const medic: SkillDefinition = { id: 'medic', conversions: [{ id: 'medic', as: 'peach', cards: 1, from: 'hand-and-equipment', accepts: red, when: 'respond', outsideOwnTurnOnly: true }] };
const registry: ContentRegistry = {
  cards: new Map([['peach', peach], ['plain', plain], ['gear', gear]]),
  generals: new Map([['healer', { id: 'healer', kingdom: 'Qun', maxHp: 3, skills: [medic] }], ['nobody', { id: 'nobody', kingdom: 'Wei', maxHp: 4, skills: [] }]]),
};
const ctx = { registry, mode };
const card = (instanceId: string, definitionId: string, suit: CardInstance['suit']): CardInstance => ({ instanceId, definitionId, suit, rank: 5 });

// a is dying at 0 HP; b holds the Medic General, two hand cards and a red Gear.
function table(owner: 'a' | 'b'): GameState {
  const seat = (id: string, index: number, general: string, combinedHp: number) => ({
    id, index, kingdom: 'Qun' as const, eliminated: false,
    generals: { main: { generalDefinitionId: general, revealed: true }, deputy: { generalDefinitionId: 'nobody', revealed: true } },
    combinedHp, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const dying: Effect = { kind: 'DyingEffect', seatId: 'a', order: ['a', 'b'], rescueCardIds: { any: ['peach'], self: [] }, entering: true };
  return {
    seats: [seat('a', 0, 'nobody', 0), seat('b', 1, 'healer', 4)], players: [], turn: { turnNumber: 1, ownerSeatId: owner, extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] }, { id: 'discardPile', kind: 'discardPile', cards: [] }, { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }, { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [card('h1', 'plain', 'heart'), card('h2', 'plain', 'spade')] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [card('e1', 'gear', 'diamond')] },
      { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null, resolutionQueue: [dying],
  };
}

describe('a one-card conversion from hand and equipment', () => {
  it("asks a seat with no Peach in the dying round when it can make one, and offers only the cards it accepts", () => {
    const asked = advanceToDecision(table('a'), ctx).state;
    const passed = resolve(asked, { kind: 'PassAction', seatId: 'a', pendingResponseId: asked.pendingResponse!.id }, ctx).state;
    expect(passed.pendingResponse?.respondingSeatId).toBe('b');
    const convert = getLegalActions(passed, 'b', registry).find((a) => a.kind === 'UseConversionAction')!;
    expect(convert).toBeDefined();
    const selecting = resolve(passed, convert, ctx).state;
    expect(selecting.pendingSelection).toMatchObject({ eligibleIds: ['h1', 'e1'], min: 1, max: 1 });
    const saved = resolve(selecting, { kind: 'SelectAction', seatId: 'b', selectionId: selecting.pendingSelection!.id, ids: ['e1'] }, ctx).state;
    expect(saved.seats[0].combinedHp).toBe(1);
    expect(saved.zones.find((z) => z.id === 'b:equip')!.cards).toEqual([]);
  });

  it("is not offered on its owner's own turn, so that seat isn't asked without a Peach", () => {
    const asked = advanceToDecision(table('b'), ctx).state;
    const passed = resolve(asked, { kind: 'PassAction', seatId: 'a', pendingResponseId: asked.pendingResponse!.id }, ctx).state;
    expect(passed.pendingResponse).toBeNull();
    expect(passed.seats[0].eliminated).toBe(true);
  });
});

describe('a hidden General’s conversion answering a window', () => {
  it('reveals the General on confirm, with the window it answers still open until then', () => {
    const base = table('a');
    const hidden: GameState = { ...base, seats: base.seats.map((s) => (s.id === 'b' ? { ...s, generals: { ...s.generals!, main: { ...s.generals!.main, revealed: false } } } : s)) };
    const asked = advanceToDecision(hidden, ctx).state;
    const passed = resolve(asked, { kind: 'PassAction', seatId: 'a', pendingResponseId: asked.pendingResponse!.id }, ctx).state;
    const convert = getLegalActions(passed, 'b', registry).find((a) => a.kind === 'UseConversionAction')!;
    const selecting = resolve(passed, convert, ctx).state;
    const saved = resolve(selecting, { kind: 'SelectAction', seatId: 'b', selectionId: selecting.pendingSelection!.id, ids: ['h1'] }, ctx).state;
    expect(saved.seats[1].generals!.main.revealed).toBe(true);
    expect(saved.seats[0].combinedHp).toBe(1);
  });
});
