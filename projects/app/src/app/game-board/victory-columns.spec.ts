import { GameResult, Kingdom } from 'engine';
import { FinalSeatView } from 'protocol';
import { victoryColumns } from './victory-columns';

const view = (n: number, kingdom: Kingdom, allegiance: FinalSeatView['allegiance'], eliminated = false): FinalSeatView => ({
  seatId: `seat-${n}`, kingdom, allegiance, mainGeneralId: `main-${n}`, deputyGeneralId: `deputy-${n}`, eliminated,
});
const result = (over: Partial<GameResult> = {}): GameResult => ({ endedAt: 1, winningSeatIds: [], losingSeatIds: [], ...over });
const groups = (v: ReturnType<typeof victoryColumns>) => v.columns.map((c) => c.group);

describe('victoryColumns', () => {
  it('Wei win with fallen teammates: columns are Wei, Shu, Wu, LosingAmbitionist; the fallen Wei seat is in the Wei column with survived false; only Wei is winning; headlineKind kingdom', () => {
    const seats = [view(0, 'Wei', 'kingdom'), view(1, 'Wei', 'kingdom', true), view(2, 'Shu', 'kingdom', true), view(3, 'Wu', 'kingdom', true), view(4, 'Qun', 'ambitionist', true)];
    const v = victoryColumns(seats, result({ winningKingdom: 'Wei', winningSeatIds: ['seat-0'], losingSeatIds: ['seat-2', 'seat-3', 'seat-4'] }), null);
    expect(groups(v)).toEqual(['Wei', 'Shu', 'Wu', 'LosingAmbitionist']);
    expect(v.columns[0].members.map((m) => [m.seatId, m.survived])).toEqual([['seat-0', true], ['seat-1', false]]);
    expect(v.columns.filter((c) => c.winning).map((c) => c.group)).toEqual(['Wei']);
    expect(v.winningGroup).toBe('Wei');
    expect(v.headlineKind).toBe('kingdom');
    expect(v.winningKingdom).toBe('Wei');
  });

  it('Ambitionist win with eight seats gives six columns in the fixed order; WinningAmbitionist holds only the winner; headlineKind ambitionist', () => {
    const seats = [
      view(0, 'Qun', 'ambitionist'), view(1, 'Wei', 'kingdom', true), view(2, 'Shu', 'kingdom', true), view(3, 'Wu', 'kingdom', true),
      view(4, 'Qun', 'kingdom', true), view(5, 'Wei', 'ambitionist', true), view(6, 'Shu', 'kingdom', true), view(7, 'Wu', 'kingdom', true),
    ];
    const v = victoryColumns(seats, result({ winningSeatIds: ['seat-0'] }), null);
    expect(groups(v)).toEqual(['Wei', 'Shu', 'Wu', 'Qun', 'WinningAmbitionist', 'LosingAmbitionist']);
    expect(v.columns[4].members.map((m) => m.seatId)).toEqual(['seat-0']);
    expect(v.columns[5].members.map((m) => m.seatId)).toEqual(['seat-5']);
    expect(v.columns[4].force).toBe('Ambitionist');
    expect(v.winningGroup).toBe('WinningAmbitionist');
    expect(v.headlineKind).toBe('ambitionist');
    expect(v.winnerSeatId).toBe('seat-0');
    expect(v.winningKingdom).toBeNull();
  });

  it('Qun win lists only the Kingdoms that took part', () => {
    const seats = [view(0, 'Qun', 'kingdom'), view(1, 'Wei', 'kingdom', true), view(2, 'Qun', 'kingdom')];
    const v = victoryColumns(seats, result({ winningKingdom: 'Qun', winningSeatIds: ['seat-0', 'seat-2'] }), null);
    expect(groups(v)).toEqual(['Wei', 'Qun']);
    expect(v.winningGroup).toBe('Qun');
  });

  it('a draw lights no column and has headlineKind draw', () => {
    const seats = [view(0, 'Wei', 'kingdom', true), view(1, 'Shu', 'kingdom', true)];
    const v = victoryColumns(seats, result(), null);
    expect(v.columns.some((c) => c.winning)).toBe(false);
    expect(v.winningGroup).toBeNull();
    expect(v.headlineKind).toBe('draw');
    expect(v.winnerSeatId).toBeNull();
  });

  it("a lone Kingdom survivor with a decided allegiance lights its own Kingdom's column, headlineKind kingdom", () => {
    const seats = [view(0, 'Wu', 'kingdom'), view(1, 'Shu', 'kingdom', true)];
    const v = victoryColumns(seats, result({ winningSeatIds: ['seat-0'] }), null);
    expect(v.winningGroup).toBe('Wu');
    expect(v.columns.find((c) => c.winning)?.group).toBe('Wu');
    expect(v.headlineKind).toBe('kingdom');
    expect(v.winningKingdom).toBe('Wu');
    expect(v.winnerSeatId).toBe('seat-0');
  });

  it("a lone survivor with a null allegiance lights its printed Kingdom's column, headlineKind lone-survivor", () => {
    const seats = [view(0, 'Wu', null), view(1, 'Shu', 'kingdom', true)];
    const v = victoryColumns(seats, result({ winningSeatIds: ['seat-0'] }), null);
    expect(v.winningGroup).toBe('Wu');
    expect(v.headlineKind).toBe('lone-survivor');
    expect(v.winningKingdom).toBeNull();
    expect(v.winnerSeatId).toBe('seat-0');
  });

  it('two losing Ambitionists share LosingAmbitionist; with a Kingdom win there is never a WinningAmbitionist column', () => {
    const seats = [view(0, 'Wei', 'kingdom'), view(1, 'Shu', 'ambitionist', true), view(2, 'Wu', 'ambitionist', true)];
    const v = victoryColumns(seats, result({ winningKingdom: 'Wei', winningSeatIds: ['seat-0'] }), null);
    expect(groups(v)).toEqual(['Wei', 'LosingAmbitionist']);
    expect(v.columns[1].members.map((m) => m.seatId)).toEqual(['seat-1', 'seat-2']);
    expect(groups(v)).not.toContain('WinningAmbitionist');
  });

  it('members are in seat order and only youSeatId is marked you; null marks none', () => {
    const seats = [view(0, 'Wei', 'kingdom'), view(1, 'Wei', 'kingdom'), view(2, 'Wei', 'kingdom')];
    const members = (you: string | null) => victoryColumns(seats, result({ winningKingdom: 'Wei' }), you).columns[0].members;
    expect(members('seat-1').map((m) => [m.seatId, m.you])).toEqual([['seat-0', false], ['seat-1', true], ['seat-2', false]]);
    expect(members(null).some((m) => m.you)).toBe(false);
  });

  it('a seat whose Kingdom is hidden and allegiance null is left out without throwing', () => {
    const seats = [view(0, 'Wei', 'kingdom'), view(1, 'hidden', null)];
    const v = victoryColumns(seats, result({ winningKingdom: 'Wei' }), null);
    expect(groups(v)).toEqual(['Wei']);
    expect(v.columns[0].members.map((m) => m.seatId)).toEqual(['seat-0']);
  });

  it('a winning seat id with no summary lights nothing and gives lone-survivor', () => {
    const seats = [view(0, 'Wei', 'kingdom', true)];
    const v = victoryColumns(seats, result({ winningSeatIds: ['seat-9'] }), null);
    expect(v.columns.some((c) => c.winning)).toBe(false);
    expect(v.winningGroup).toBeNull();
    expect(v.headlineKind).toBe('lone-survivor');
  });
});
