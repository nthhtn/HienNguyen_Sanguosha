import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { judgmentDescription } from './judgment-description';
import { card, cardReader, publicOf, registry, skillReader, table, view } from './judgment-description.testing';

const trVi = makeTranslator(vi, 'vi');

describe('judgmentDescription in Vietnamese', () => {
  it('says the consequence and the waiting line in Vietnamese', () => {
    const settled = judgmentDescription(publicOf(table(view(cardReader('lightning'), 'seat-1', card('j', 'spade', 5)))), registry, trVi)!;
    expect(settled.outcome).toBe('Bo chịu 3 sát thương sét');
    expect(settled.source).toMatchObject({ kind: 'card', cardName: 'Thiểm Điện' });
    const unsettled = view(skillReader(), 'seat-0', card('j', 'club', 5), { settled: false });
    const waiting = judgmentDescription(publicOf(table(unsettled)), registry, trVi)!;
    expect(waiting.waiting).toMatch(/phán xét/);
    expect(waiting.outcome).toBeNull();
  });

  it('names the General and skill in Vietnamese', () => {
    const description = judgmentDescription(publicOf(table(view(skillReader(), 'seat-0', card('j', 'club', 5), { data: { sourceSeatId: 'seat-1' } }))), registry, trVi)!;
    const source = description.source;
    expect(source.kind).toBe('skill');
    expect(source.kind === 'skill' && source.generalName).not.toBe('Xiahou Dun');
  });
});
