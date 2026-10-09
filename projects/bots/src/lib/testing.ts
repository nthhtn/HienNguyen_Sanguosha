// The bot specs' shared table and drivers (not exported from the package).
import { advanceToDecision, getLegalActions, redactStateForSeat, resolve } from 'engine';
import type { Action, CardInstance, Effect, GameModeDefinition, GameState, GeneralOwner, Kingdom, PendingChoice, PendingSelection } from 'engine';
import { buildContentRegistry } from 'content';
import { ruleBasedPolicy } from './rule-based';

// Test-only stand-ins (as content's fillers.testing.ts): `filler-<id>` has the
// real General's kingdom, gender and max HP, and no skills.
const FILLER_IDS = [
  'cai-wenji', 'cao-pi', 'deng-ai', 'dian-wei', 'dong-zhuo', 'jia-xu', 'jiang-wei', 'liu-shan',
  'lu-su', 'meng-huo', 'pang-de', 'pang-tong', 'sun-ce', 'sun-jian', 'taishi-ci', 'xu-huang',
  'xun-yu', 'yuan-shao', 'zhang-he', 'zhang-zhao-and-zhang-hong', 'zhu-rong', 'zuo-ci',
];
export const registry = buildContentRegistry();
for (const id of FILLER_IDS) {
  const real = registry.generals.get(id)!;
  registry.generals.set(`filler-${id}`, { id: `filler-${id}`, kingdom: real.kingdom, maxHp: real.maxHp, ...(real.gender ? { gender: real.gender } : {}), skills: [] });
}
export const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
export const ctx = { registry, mode };
export const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });

export interface Options {
  generals?: Record<string, [string, string, boolean?]>;
  kingdoms?: Record<string, Kingdom>;
  hp?: Record<string, number>;
  maxHp?: Record<string, number>;
  owner?: string;
}
// Four seats (Wei, Shu, Wu, Qun by default) at 4/4 HP, all Generals revealed; seat-a's Play Phase.
export function table(cards: Record<string, CardInstance[]> = {}, o: Options = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  const kingdoms: Kingdom[] = ['Wei', 'Shu', 'Wu', 'Qun'];
  return {
    seats: ids.map((id, index) => {
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['filler-xu-huang', 'filler-dong-zhuo'];
      return {
        id, index, kingdom: o.kingdoms?.[id] ?? kingdoms[index], eliminated: false,
        generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: deputy, revealed } },
        combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: o.maxHp?.[id] ?? 4,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      };
    }),
    players: [], turn: { turnNumber: 1, ownerSeatId: o.owner ?? 'seat-a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: cards['processing'] ?? [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

export const actor = (s: GameState) => s.pendingChoice?.seatId ?? s.pendingSelection?.seatId ?? s.pendingResponse?.respondingSeatId ?? s.turn.ownerSeatId;
export const decide = (s: GameState): Action => {
  const seatId = actor(s);
  return ruleBasedPolicy.decide(redactStateForSeat(s, seatId), seatId, getLegalActions(s, seatId, registry), registry, null).action;
};
export const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
export const general = (seatId: string, skillId: string): GeneralOwner => ({ kind: 'general', seatId, slot: 'main', skillId });
// An ask of `skillId` for seat-a, about `targetSeatId`; Don't queues `otherwise`.
export const asking = (s: GameState, skillId: string, targetSeatId?: string, otherwise: Effect[] = []): GameState => {
  const choice: PendingChoice = {
    id: 'ask', seatId: 'seat-a', verb: 'use',
    reason: { kind: 'ability', owner: general('seat-a', skillId), abilityId: skillId, ...(targetSeatId ? { targetSeatId } : {}) },
    options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: otherwise }],
  };
  return { ...s, pendingChoice: choice };
};
export const picked = (a: Action) => (a.kind === 'ChooseOptionAction' ? a.optionId : a.kind === 'SelectAction' ? a.ids : a.kind);
export const useSkill = (s: GameState, skillId: string) => {
  const action = getLegalActions(s, 'seat-a', registry).find((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId)!;
  return act(s, action);
};

