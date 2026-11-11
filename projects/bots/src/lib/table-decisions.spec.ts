import type { GameState, Kingdom, Seat } from 'engine';
import { dangerOf } from './danger';
import { ruleBasedV4Policy } from './rule-based';
import { massAttackWorthIt } from './table';
import { card, decideTable, decideWith, registry, table } from './testing';

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

describe('Barbarians and Hail of Arrows weigh the table (rule 8)', () => {
  const barbarians = { 'seat-a:hand': [card('b1', 'barbarians')] };
  const plays = (a: { kind: string; cardInstanceId?: string }) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'b1';
  // Extra seats (seat-g, seat-h) cloned from seat-f, so a table can grow past 6 seats.
  const extra = (s: GameState, specs: { kingdom: Kingdom; hp?: number; dangerous?: boolean }[]): GameState => {
    const f = s.seats.find((x) => x.id === 'seat-f')!;
    let out = s;
    specs.forEach((spec, n) => {
      const id = `seat-${'gh'[n]}`;
      const seat: Seat = {
        ...f, id, index: 6 + n, kingdom: spec.kingdom, combinedHp: spec.hp ?? 4,
        ...(spec.dangerous ? { generals: { main: { generalDefinitionId: DANGEROUS[0], revealed: true }, deputy: { generalDefinitionId: DANGEROUS[1], revealed: true } } } : {}),
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, stash: { zoneId: `${id}:stash` },
      };
      const zone = (kind: 'hand' | 'equip' | 'judgment' | 'pile', name: string) => ({ id: `${id}:${name}`, kind, ownerSeatId: id, cards: [] });
      out = { ...out, seats: [...out.seats, seat], zones: [...out.zones, zone('hand', 'hand'), zone('equip', 'equip'), zone('judgment', 'judgment'), zone('pile', 'stash')] };
    });
    return out;
  };
  const worth = (s: GameState) => massAttackWorthIt(s, s.seats[0], registry, dangerOf(registry));
  // Shu bot seat-a; Wei leads with seat-c, seat-d and seat-e; seat-f is a Shu ally; seat-b (Wu) a truce partner.
  const BASE: Kingdom[] = ['Shu', 'Wu', 'Wei', 'Wei', 'Wei', 'Shu'];

  it('plays it against 3 enemies and 1.5 friends', () => {
    const s = game(BASE, { cards: barbarians });
    expect(worth(s)).toBe(true);
    expect(plays(decideTable(s))).toBe(true);
  });

  it('holds it against 3 enemies and 3 friends (an ally and two partners at 2 HP)', () => {
    const s = extra(game(BASE, { cards: barbarians, hp: { 'seat-b': 2 } }), [{ kingdom: 'Qun', hp: 2 }]);
    expect(worth(s)).toBe(false);
    expect(plays(decideTable(s))).toBe(false);
  });

  it('counts a dangerous healthy truce partner as an enemy', () => {
    // Friends: ally 1 + two 2 HP partners 2 + a healthy partner 0.5 = 3.5 against 3 enemies.
    const specs = (dangerous: boolean) => [{ kingdom: 'Qun' as Kingdom, hp: 2 }, { kingdom: 'Wu' as Kingdom, dangerous }];
    const calm = extra(game(BASE, { cards: barbarians, hp: { 'seat-b': 2 } }), specs(false));
    expect(worth(calm)).toBe(false);
    expect(plays(decideTable(calm))).toBe(false);
    const dangerous = extra(game(BASE, { cards: barbarians, hp: { 'seat-b': 2 } }), specs(true));
    expect(worth(dangerous)).toBe(true);
    expect(plays(decideTable(dangerous))).toBe(true);
  });

  it("keeps today's rule when no force leads", () => {
    const s = game(['Shu', 'Wu', 'Wei', 'Qun', 'Shu', 'Wei'], { cards: barbarians });
    expect(worth(s)).toBe(true);
    expect(plays(decideTable(s))).toBe(true);
    expect(plays(decideWith(ruleBasedV4Policy, s))).toBe(true);
  });

  it('rule-based-v4 keeps the old count where the table rule holds', () => {
    const s = extra(game(BASE, { cards: barbarians, hp: { 'seat-b': 2 } }), [{ kingdom: 'Qun', hp: 2 }]);
    expect(plays(decideWith(ruleBasedV4Policy, s))).toBe(true);
  });
});
