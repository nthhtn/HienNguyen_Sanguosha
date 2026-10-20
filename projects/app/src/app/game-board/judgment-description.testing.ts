import { buildContentRegistry } from 'content';
import { redactStateForSeat, usedCardOf } from 'engine';
import type { JudgmentDescription } from './judgment-description';
import type { CardInstance, GameState, GeneralOwner, JudgmentChange, JudgmentReader, JudgmentView, Seat } from 'engine';

export const registry = buildContentRegistry();

const seat = (id: string, index: number, kingdom: Seat['kingdom'], main: string, revealed = true): Seat => ({
  id, index, kingdom, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
  generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: 'cao-cao', revealed: false } },
  hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
});

export const card = (instanceId: string, suit: CardInstance['suit'], rank: number, definitionId = 'sha'): CardInstance => ({ instanceId, definitionId, suit, rank });
export const xiahouOwner: GeneralOwner = { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'unyielding' };
export const skillReader = (owner: GeneralOwner = xiahouOwner): JudgmentReader => ({ kind: 'skill', owner });
export const cardReader = (definitionId: string): JudgmentReader => ({ kind: 'card', card: usedCardOf(card(`${definitionId}-tool`, 'spade', 1, definitionId)) });

// seat-0 (Hing, Wei, Xiahou Dun) and seat-1 (Bo, Shu, Guan Yu); `view` is on show. `hidden`: seat-1 has shown no General.
export function table(view: JudgmentView | undefined, o: { hidden?: boolean; handOfSeat1?: number; pending?: Partial<GameState> } = {}): GameState {
  const hand = (seatId: string, n: number) => ({ id: `${seatId}:hand`, kind: 'hand' as const, ownerSeatId: seatId, cards: Array.from({ length: n }, (_, i) => card(`${seatId}-h${i}`, 'spade', 3)) });
  return {
    seats: [seat('seat-0', 0, 'Wei', 'xiahou-dun'), seat('seat-1', 1, 'Shu', 'guan-yu', !o.hidden)],
    players: [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Bo' },
    ],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play',
    zones: [hand('seat-0', 2), hand('seat-1', o.handOfSeat1 ?? 3), { id: 'processing', kind: 'processing', cards: view ? [view.card] : [] }],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...(view ? { judgmentView: view } : {}),
    ...o.pending,
  };
}

export const view = (reader: JudgmentReader, seatId: string, judged: CardInstance, over: Partial<JudgmentView> = {}): JudgmentView => ({
  seatId, reader, card: judged, changes: [], settled: true, ...over,
});

export const publicOf = (state: GameState): GameState => redactStateForSeat(state, '');
export type { JudgmentChange };

export const seven: CardInstance = { instanceId: 'c7', definitionId: 'sha', suit: 'heart', rank: 7 };
export const king: CardInstance = { instanceId: 'ck', definitionId: 'sha', suit: 'spade', rank: 13 };

export const skillDescription = (over: Partial<JudgmentDescription> = {}): JudgmentDescription => ({
  force: 'Wei',
  source: { kind: 'skill', generalId: 'xiahou-dun', generalName: 'Xiahou Dun', abilityName: 'Unyielding', skillText: 'After you take damage, judge.' },
  judgedSeatName: 'Hing',
  card: seven,
  changes: [],
  settled: true,
  outcome: 'Bo discards 2 cards or takes 1 damage',
  waiting: null,
  ...over,
});
