import type { Effect, GameState, Kingdom, PendingChoice, Seat } from 'engine';
import { dangerOf } from './danger';
import { lowestHpFirst, rankHarmTargets } from './helpers';
import { ruleBasedPolicy, ruleBasedV4Policy, ruleBasedV5Policy } from './rule-based';
import { massAttackWorthIt } from './table';
import { tableRankFor } from './table-rank';
import { card, decideWaste, decideWith, general, picked, registry, table } from './testing';

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
    expect(decideWith(ruleBasedPolicy, s)).toMatchObject({ kind: 'RespondAction', cardInstanceId: 'p1' });
  });

  it('does not save a dying seat of the leading force', () => {
    const s = dying(game(KINGDOMS, { cards: peach }), 'seat-c');
    expect(decideWith(ruleBasedPolicy, s)).toMatchObject({ kind: 'PassAction' });
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
    expect(plays(decideWith(ruleBasedPolicy, s))).toBe(true);
  });

  it('holds it against 3 enemies and 3 friends (an ally and two partners at 2 HP)', () => {
    const s = extra(game(BASE, { cards: barbarians, hp: { 'seat-b': 2 } }), [{ kingdom: 'Qun', hp: 2 }]);
    expect(worth(s)).toBe(false);
    expect(plays(decideWith(ruleBasedPolicy, s))).toBe(false);
  });

  it('counts a dangerous healthy truce partner as an enemy', () => {
    // Friends: ally 1 + two 2 HP partners 2 + a healthy partner 0.5 = 3.5 against 3 enemies.
    const specs = (dangerous: boolean) => [{ kingdom: 'Qun' as Kingdom, hp: 2 }, { kingdom: 'Wu' as Kingdom, dangerous }];
    const calm = extra(game(BASE, { cards: barbarians, hp: { 'seat-b': 2 } }), specs(false));
    expect(worth(calm)).toBe(false);
    expect(plays(decideWith(ruleBasedPolicy, calm))).toBe(false);
    const dangerous = extra(game(BASE, { cards: barbarians, hp: { 'seat-b': 2 } }), specs(true));
    expect(worth(dangerous)).toBe(true);
    expect(plays(decideWith(ruleBasedPolicy, dangerous))).toBe(true);
  });

  it("keeps today's rule when no force leads", () => {
    const s = game(['Shu', 'Wu', 'Wei', 'Qun', 'Shu', 'Wei'], { cards: barbarians });
    expect(worth(s)).toBe(true);
    expect(plays(decideWith(ruleBasedPolicy, s))).toBe(true);
    expect(plays(decideWith(ruleBasedV4Policy, s))).toBe(true);
  });

  it('rule-based-v4 keeps the old count where the table rule holds', () => {
    const s = extra(game(BASE, { cards: barbarians, hp: { 'seat-b': 2 } }), [{ kingdom: 'Qun', hp: 2 }]);
    expect(plays(decideWith(ruleBasedV4Policy, s))).toBe(true);
  });
});

describe('legacy skill picks rank targets (rules E1-E3)', () => {
  // Wei leads with seat-c, seat-d and seat-f; seat-b (Wu, 2 HP) and seat-e (Qun) are truce partners of the Shu bot.
  const KINGDOMS: Kingdom[] = ['Shu', 'Wu', 'Wei', 'Wei', 'Qun', 'Wei'];
  const lowPartner = { 'seat-b': 2 };
  const OTHERS = ['seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'];
  // A pick of one of `ids` for seat-a's `abilityId`; each option queues `effects(seatId)`.
  const choosing = (s: GameState, abilityId: string, ids: string[], effects: (seatId: string) => Effect[] = () => []): GameState => {
    const choice: PendingChoice = {
      id: 'pick', seatId: 'seat-a', verb: 'pick',
      reason: { kind: 'ability', owner: general('seat-a', abilityId), abilityId },
      options: ids.map((seatId) => ({ id: seatId, shows: { kind: 'seat' as const, seatId }, effects: effects(seatId) })),
    };
    return { ...s, pendingChoice: choice };
  };

  it('rankHarmTargets: with a ranker, attackable seats best first; without, the fallback order of every seat', () => {
    const s = game(KINGDOMS, { hp: lowPartner });
    const me = s.seats[0];
    expect(rankHarmTargets(s, me, OTHERS, tableRankFor(registry), lowestHpFirst).map((x) => x.id)).toEqual(['seat-c', 'seat-d', 'seat-f']);
    expect(rankHarmTargets(s, me, OTHERS, undefined, lowestHpFirst).map((x) => x.id)).toEqual(['seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f']);
  });

  it('a damage pick (Lightning Strike) goes to the leading force, not the low-HP truce partner', () => {
    const s = choosing(game(KINGDOMS, { hp: lowPartner }), 'lightning-strike', OTHERS);
    expect(picked(decideWaste(s))).toBe('seat-c');
    expect(picked(decideWith(ruleBasedV5Policy, s))).toBe('seat-b');
  });

  it('a card-taking pick (Clever Change) takes from the leading force, not the low-HP truce partner', () => {
    const hands = { 'seat-b:hand': [card('b1', 'shan'), card('b2', 'shan'), card('b3', 'shan')], 'seat-c:hand': [card('c1', 'shan')], 'seat-d:hand': [card('d1', 'shan')] };
    const base = game(KINGDOMS, { hp: lowPartner, cards: hands });
    const s: GameState = {
      ...base,
      pendingSelection: {
        id: 'sel', seatId: 'seat-a', of: 'seats', eligibleIds: ['seat-b', 'seat-c', 'seat-d'], min: 1, max: 2,
        reason: { kind: 'ability', owner: general('seat-a', 'clever-change'), abilityId: 'clever-change' },
        then: { kind: 'skill-step', step: { kind: 'SkillStepEffect', owner: general('seat-a', 'clever-change'), step: 'draw-take', data: {} } },
        onCancel: [],
      },
    };
    expect(picked(decideWaste(s))).toEqual(['seat-c', 'seat-d']);
    expect(picked(decideWith(ruleBasedV5Policy, s))).toEqual(['seat-b', 'seat-c']);
  });

  describe('fallbacks when the ranker leaves no seat (fix round 1)', () => {
    const sha = { as: 'sha', colour: 'none' as const, physical: [] };
    const shaAt = (seatId: string): Effect[] => [{ kind: 'UseCardEffect', seatId: 'seat-a', card: sha, targets: [{ kind: 'seat', seatId }] }];

    it('Upheaval Shas a HOLD_FIRE truce partner rather than lose 1 HP', () => {
      const base = game(KINGDOMS, { hp: lowPartner, cards: { 'seat-a:hand': [card('s1', 'sha')] } });
      const picking = choosing(base, 'upheaval', ['seat-b']);
      const withPass: GameState = { ...picking, pendingChoice: { ...picking.pendingChoice!, options: [...picking.pendingChoice!.options, { id: 'pass', shows: { kind: 'label', text: 'Pass (Lose 1 HP)' }, effects: [] }] } };
      expect(picked(decideWaste(withPass))).toBe('seat-b');
      // Its window then plays the Sha at that seat.
      const window: GameState = {
        ...base,
        pendingResponse: {
          id: 'w', respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha'],
          reason: { kind: 'ability', owner: general('seat-c', 'upheaval'), abilityId: 'upheaval', targetSeatId: 'seat-b' },
          context: { effect: { kind: 'LoseHpEffect', seatId: 'seat-a', amount: 1 } },
        },
      };
      expect(decideWaste(window)).toMatchObject({ kind: 'RespondAction', cardInstanceId: 's1' });
    });

    it('Godspeed with every leader seat stopping the Sha and every other non-ally HOLD_FIRE aims at a non-ally, never the ally', () => {
      // seat-e is a Shu ally, listed first; seat-c, seat-d and seat-f (Wei) wear Wood Armor; seat-b (Wu, 2 HP) holds fire.
      const armor = (id: string) => [card(`wa-${id}`, 'wood-armor', 'spade', 2)];
      const s = game(['Shu', 'Wu', 'Wei', 'Wei', 'Shu', 'Wei'], { hp: lowPartner, cards: { 'seat-c:equip': armor('c'), 'seat-d:equip': armor('d'), 'seat-f:equip': armor('f') } });
      const pick = choosing(s, 'godspeed', ['seat-e', 'seat-b', 'seat-c', 'seat-d', 'seat-f'], shaAt);
      expect(picked(decideWaste(pick))).toBe('seat-b');
      expect(picked(decideWith(ruleBasedV5Policy, pick))).toBe('seat-b');
    });
  });

  describe('a forced-Sha pick (Double Edged)', () => {
    const id = 'kingdomWars:double-edged';
    const sha = { as: 'sha', colour: 'none' as const, physical: [] };
    const shaAt = (seatId: string): Effect[] => [{ kind: 'UseCardEffect', seatId: 'seat-a', card: sha, targets: [{ kind: 'seat', seatId }] }];

    it('aims at the leading force, not the low-HP truce partner', () => {
      const s = choosing(game(KINGDOMS, { hp: lowPartner }), id, ['seat-b', 'seat-c', 'seat-d'], shaAt);
      expect(picked(decideWaste(s))).toBe('seat-c');
      expect(picked(decideWith(ruleBasedV5Policy, s))).toBe('seat-b');
    });

    it('skips a seat whose Wood Armor would stop the Sha (rule A1)', () => {
      const armored = game(KINGDOMS, { hp: lowPartner, cards: { 'seat-c:equip': [card('wa', 'wood-armor', 'spade', 2)] } });
      const s = choosing(armored, id, ['seat-b', 'seat-c', 'seat-d'], shaAt);
      expect(picked(decideWaste(s))).toBe('seat-d');
      expect(picked(decideWith(ruleBasedV5Policy, s))).toBe('seat-b');
    });
  });
});
