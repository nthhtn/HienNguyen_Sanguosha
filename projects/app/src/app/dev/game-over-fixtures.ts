import { GameResult, Kingdom } from 'engine';
import { FinalSeatView } from 'protocol';
import type { MessageKey } from '../i18n/messages';

// Fixture end-of-game results for the Game Over dev scenarios: one per shape of ending.
const seat = (n: number, kingdom: Kingdom, allegiance: FinalSeatView['allegiance'], main: string | null, deputy: string | null, eliminated: boolean): FinalSeatView => ({
  seatId: `seat-${n}`, kingdom, allegiance, mainGeneralId: main, deputyGeneralId: deputy, eliminated,
});
const res = (over: Partial<GameResult>): GameResult => ({ endedAt: 1, winningSeatIds: [], losingSeatIds: [], ...over });

export interface GameOverCase { title: MessageKey; seats: FinalSeatView[]; result: GameResult }

export const GAME_OVER_CASES: Record<string, GameOverCase> = {
  'two': {
    title: 'preview.over-two.title',
    seats: [seat(0, 'Wei', 'kingdom', 'cao-cao', 'xiahou-dun', false), seat(1, 'Shu', 'kingdom', 'liu-bei', 'zhang-fei', true)],
    result: res({ winningKingdom: 'Wei', winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1'] }),
  },
  'three': {
    title: 'preview.over-three.title',
    seats: [
      seat(0, 'Wei', 'kingdom', 'cao-cao', 'xiahou-dun', true),
      seat(1, 'Shu', 'kingdom', 'liu-bei', 'zhang-fei', false),
      seat(2, 'Shu', 'kingdom', 'guan-yu', null, false),
      seat(3, 'Wu', 'kingdom', 'sun-quan', 'zhou-yu', true),
    ],
    result: res({ winningKingdom: 'Shu', winningSeatIds: ['seat-1', 'seat-2'], losingSeatIds: ['seat-0', 'seat-3'] }),
  },
  'four': {
    title: 'preview.over-four.title',
    seats: [
      seat(0, 'Wei', 'kingdom', 'cao-cao', 'xiahou-dun', false),
      seat(1, 'Wei', 'kingdom', 'xiahou-dun', 'cao-cao', true),
      seat(2, 'Shu', 'kingdom', 'liu-bei', null, true),
      seat(3, 'Wu', 'kingdom', 'sun-quan', null, true),
      seat(4, 'Qun', 'kingdom', 'lu-bu', null, true),
    ],
    result: res({ winningKingdom: 'Wei', winningSeatIds: ['seat-0', 'seat-1'], losingSeatIds: ['seat-2', 'seat-3', 'seat-4'] }),
  },
  'six': {
    title: 'preview.over-six.title',
    seats: [
      seat(0, 'Wei', 'ambitionist', 'cao-cao', 'xiahou-dun', false),
      seat(1, 'Wei', 'kingdom', 'xiahou-dun', null, true),
      seat(2, 'Shu', 'kingdom', 'liu-bei', 'zhang-fei', true),
      seat(3, 'Wu', 'kingdom', 'sun-quan', 'zhou-yu', true),
      seat(4, 'Qun', 'kingdom', 'lu-bu', 'diao-chan', true),
      seat(5, 'Qun', 'ambitionist', 'zhen-ji', null, true),
    ],
    result: res({ winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5'] }),
  },
  'ambitionist': {
    title: 'preview.over-ambitionist.title',
    seats: [
      seat(0, 'Wei', 'ambitionist', 'cao-cao', 'xiahou-dun', false),
      seat(1, 'Shu', 'kingdom', 'liu-bei', 'zhang-fei', true),
      seat(2, 'Wu', 'kingdom', 'sun-quan', null, true),
    ],
    result: res({ winningSeatIds: ['seat-0'], losingSeatIds: ['seat-1', 'seat-2'] }),
  },
  'lone': {
    title: 'preview.over-lone.title',
    seats: [
      seat(0, 'Wei', null, 'cao-cao', null, true),
      seat(1, 'Shu', null, 'liu-bei', 'zhang-fei', false),
      seat(2, 'Wu', null, null, null, true),
    ],
    result: res({ winningSeatIds: ['seat-1'], losingSeatIds: ['seat-0', 'seat-2'] }),
  },
  'draw': {
    title: 'preview.over-draw.title',
    seats: [
      seat(0, 'Wei', 'kingdom', 'cao-cao', null, true),
      seat(1, 'Shu', 'kingdom', 'liu-bei', null, true),
      seat(2, 'Wu', 'kingdom', 'sun-quan', null, true),
    ],
    result: res({}),
  },
  'hidden': {
    title: 'preview.over-hidden.title',
    seats: [
      seat(0, 'Wei', 'kingdom', null, null, false),
      seat(1, 'Wei', 'kingdom', null, null, true),
      seat(2, 'Shu', 'kingdom', null, null, true),
    ],
    result: res({ winningKingdom: 'Wei', winningSeatIds: ['seat-0', 'seat-1'], losingSeatIds: ['seat-2'] }),
  },
};
