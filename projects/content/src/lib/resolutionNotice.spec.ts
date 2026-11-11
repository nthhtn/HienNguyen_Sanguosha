import type { GameState } from 'engine';
import { describeResolution, ResolutionNoticeContent, ResolutionNoticeDefinition, ResolutionSpan, RESOLUTION_NOTICES } from './resolutionNotice';

const view = { seats: [], log: [] } as unknown as GameState;
const span = (sourceId: string): ResolutionSpan => ({ sourceId, userSeatId: 'seat-0', targetSeatIds: ['seat-1'], startIndex: 0, endIndex: 0, events: [] });
const content: ResolutionNoticeContent = {
  source: { kind: 'card', id: 'blaze' },
  seatIds: ['seat-0', 'seat-1'],
  steps: [],
  cards: [],
  outcome: { tone: 'neutral', symbol: '?', headline: { key: 'notice.test' }, text: { key: 'notice.test' } },
};

describe('describeResolution', () => {
  it('has no notice for a card whose own response already says what happened', () => {
    for (const id of ['sha', 'wuxie', 'wuxie-guo', 'peach-garden', 'chains', 'duel', 'barbarians', 'hail-of-arrows', 'draw-two', 'ally-far-attack-near', 'wine', 'amass', 'ascertain', 'steal', 'break']) {
      expect(RESOLUTION_NOTICES[id]).toBeUndefined();
      expect(describeResolution(span(id), view)).toBeNull();
    }
  });

  it('has a notice for each card and skill in scope', () => {
    expect(['blaze', 'coerce', 'harvest', 'resurgence'].every((id) => RESOLUTION_NOTICES[id] !== undefined)).toBe(true);
  });

  it('asks the registered definition, with the span and the viewer’s view', () => {
    const describe = jest.fn().mockReturnValue(content);
    const registry: Record<string, ResolutionNoticeDefinition> = { blaze: { describe } };
    expect(describeResolution(span('blaze'), view, registry)).toBe(content);
    expect(describe).toHaveBeenCalledWith(span('blaze'), view);
  });

  it('gives nothing when the definition has nothing to show', () => {
    const registry: Record<string, ResolutionNoticeDefinition> = { blaze: { describe: () => null } };
    expect(describeResolution(span('blaze'), view, registry)).toBeNull();
  });
});
