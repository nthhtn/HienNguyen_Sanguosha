import { CardInstance, EngineEvent, GeneralOwner, Seat } from 'engine';
import { competeResults } from './compete-result';

const seat = (id: string, index: number, kingdom: Seat['kingdom'], main: string, revealed = true): Seat => ({
  id, index, kingdom, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
  generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: 'cao-cao', revealed: false } },
  hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
});
const seats = [seat('seat-0', 0, 'Wu', 'taishi-ci'), seat('seat-1', 1, 'Shu', 'guan-yu', false)];
const owner: GeneralOwner = { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'heavens-justice' };
const nine: CardInstance = { instanceId: 'c9', definitionId: 'sha', suit: 'spade', rank: 9 };
const seven: CardInstance = { instanceId: 'c7', definitionId: 'shan', suit: 'heart', rank: 7 };
const competition = (won: boolean, mine = nine, theirs = seven): EngineEvent[] => [
  { kind: 'CardShownEvent', seatId: 'seat-0', card: mine, abilityId: 'heavens-justice' },
  { kind: 'CardShownEvent', seatId: 'seat-1', card: theirs, abilityId: 'heavens-justice' },
  { kind: 'AbilityUsedEvent', owner, abilityId: 'heavens-justice', outcome: won ? 'compete-won' : 'compete-lost', targetSeatId: 'seat-1' },
];
const players = [{ id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' }];

describe('competeResults', () => {
  it('reads the source, both players, their cards, the result and the outcome off the log', () => {
    const [result] = competeResults(competition(true), 0, seats, players);
    expect(result).toMatchObject({
      abilityName: "Heaven's Justice",
      generalId: 'taishi-ci',
      generalName: 'Taishi Ci',
      force: 'Wu',
      won: true,
      tie: false,
      winnerName: 'Hing',
      user: { seatId: 'seat-0', name: 'Hing', generalId: 'taishi-ci', card: nine },
      target: { seatId: 'seat-1', name: 'Seat 1', generalId: null, card: seven },
      outcome: 'Hing can play one more Slash this turn, at any distance, with one more target',
    });
    expect(result.skillText).toBeTruthy();
  });

  it('a loss names the other seat as the winner and gives the loss outcome', () => {
    const [result] = competeResults(competition(false, seven, nine), 0, seats, players);
    expect(result).toMatchObject({ won: false, tie: false, winnerName: 'Seat 1', outcome: "Hing can't play a Slash this turn" });
  });

  it('equal ranks are a tie, which the challenger loses', () => {
    const [result] = competeResults(competition(false, nine, { ...seven, rank: 9 }), 0, seats, players);
    expect(result).toMatchObject({ won: false, tie: true });
  });

  it('is themed by the source seat’s Force', () => {
    const [result] = competeResults(competition(true), 0, [{ ...seats[0], kingdom: 'Qun' }, seats[1]], players);
    expect(result.force).toBe('Qun');
  });

  it('reports only competes at or after the given log index, each with a distinct id', () => {
    const log = [...competition(true), ...competition(false)];
    expect(competeResults(log, 0, seats, players).map((r) => r.won)).toEqual([true, false]);
    const after = competeResults(log, 3, seats, players);
    expect(after).toHaveLength(1);
    expect(after[0].won).toBe(false);
    expect(new Set(competeResults(log, 0, seats, players).map((r) => r.id)).size).toBe(2);
  });

  it('skips a compete whose cards were not shown', () => {
    expect(competeResults([competition(true)[2]], 0, seats, players)).toEqual([]);
  });

  it('ignores events that are not competes', () => {
    expect(competeResults([{ kind: 'AbilityUsedEvent', owner, abilityId: 'heavens-justice', outcome: 'used' }], 0, seats, players)).toEqual([]);
  });
});
