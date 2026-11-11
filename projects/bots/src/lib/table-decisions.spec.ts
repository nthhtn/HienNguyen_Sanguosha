import type { GameState, Kingdom, Seat } from 'engine';
import { ruleBasedV4Policy } from './rule-based';
import { card, decideTable, decideWith, table } from './testing';

const IDS = ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'];
const DANGEROUS: [string, string] = ['kingdomWars:gan-ning', 'kingdomWars:taishi-ci'];

function game(
  kingdoms: Kingdom[],
  o: { seats?: number; hp?: Record<string, number>; dangerous?: string[]; cards?: Record<string, ReturnType<typeof card>[]>; owner?: string } = {},
): GameState {
  const s = table(o.cards ?? {}, {
    seats: o.seats ?? 6,
    kingdoms: Object.fromEntries(IDS.map((id, i) => [id, kingdoms[i]])),
    generals: Object.fromEntries((o.dangerous ?? []).map((id) => [id, DANGEROUS])),
    hp: o.hp,
    owner: o.owner,
  });
  return { ...s, seats: s.seats.map((seat): Seat => ({ ...seat, allegiance: 'kingdom' })) };
}
const dying = (s: GameState, seatId: string): GameState => ({
  ...s,
  pendingResponse: { id: `dying-${seatId}-0`, respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['peach'], reason: { kind: 'dying', seatId }, context: { effect: { kind: 'DyingEffect', seatId, order: ['seat-a'], rescueCardIds: { any: ['peach'], self: [] }, entering: false } } },
  seats: s.seats.map((x) => (x.id === seatId ? { ...x, combinedHp: 0 } : x)),
}) as GameState;

describe('a dying truce partner (rule 7)', () => {
  // Wei leads with seat-c, seat-d and seat-f; seat-b (Wu) and seat-e (Qun) are truce partners for the Shu bot.
  const KINGDOMS: Kingdom[] = ['Shu', 'Wu', 'Wei', 'Wei', 'Qun', 'Wei'];
  const peach = { 'seat-a:hand': [card('p1', 'peach')] };

  it('saves a dying truce partner with a Peach', () => {
    const s = dying(game(KINGDOMS, { cards: peach }), 'seat-b');
    expect(decideTable(s)).toMatchObject({ kind: 'RespondAction', cardInstanceId: 'p1' });
  });

  it('does not save a dying seat of the leading force', () => {
    const s = dying(game(KINGDOMS, { cards: peach }), 'seat-c');
    expect(decideTable(s)).toMatchObject({ kind: 'PassAction' });
  });

  it('rule-based-v4 does not save the truce partner', () => {
    const s = dying(game(KINGDOMS, { cards: peach }), 'seat-b');
    expect(decideWith(ruleBasedV4Policy, s)).toMatchObject({ kind: 'PassAction' });
  });
});
