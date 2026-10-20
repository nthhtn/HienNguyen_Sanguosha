import { englishTranslator } from '../i18n/translator';
import { abilityDisplayName } from '../labels';
import { judgmentDescription } from './judgment-description';
import { card, cardReader, publicOf, registry, skillReader, table, view, xiahouOwner } from './judgment-description.testing';

const describeIt = (state: ReturnType<typeof table>) => judgmentDescription(publicOf(state), registry, englishTranslator);

describe('judgmentDescription', () => {
  it('is null without a judgment view', () => {
    expect(describeIt(table(undefined))).toBeNull();
  });

  it('a skill judgment names the General, the skill and the owner’s force', () => {
    const state = table(view(skillReader(), 'seat-0', card('j', 'club', 5), { data: { sourceSeatId: 'seat-1' } }));
    expect(describeIt(state)).toMatchObject({
      force: 'Wei',
      judgedSeatName: 'Hing',
      card: card('j', 'club', 5),
      settled: true,
      source: { kind: 'skill', generalId: 'xiahou-dun', generalName: 'Xiahou Dun', abilityName: abilityDisplayName('unyielding') },
    });
    const source = describeIt(state)!.source;
    expect(source.kind === 'skill' && source.skillText).toBeTruthy();
  });

  it('a card judgment names the card and the judged seat, in the judged seat’s force', () => {
    const description = describeIt(table(view(cardReader('lightning'), 'seat-1', card('j', 'spade', 5))));
    expect(description).toMatchObject({ force: 'Shu', judgedSeatName: 'Bo', source: { kind: 'card', cardName: 'Lightning', seatName: 'Bo' } });
  });

  it('a seat that has shown no General is the neutral force', () => {
    const description = describeIt(table(view(cardReader('lightning'), 'seat-1', card('j', 'spade', 5)), { hidden: true }));
    expect(description?.force).toBe('none');
  });

  it('lists each replacement as a line naming its owner, the skill and both faces', () => {
    const changes = [
      { owner: xiahouOwner, abilityId: 'unyielding', card: card('r1', 'heart', 7), replaced: card('j', 'club', 5) },
      { owner: xiahouOwner, abilityId: 'unyielding', card: card('r2', 'spade', 13), replaced: card('r1', 'heart', 7) },
    ];
    const description = describeIt(table(view(skillReader(), 'seat-0', card('r2', 'spade', 13), { changes, data: { sourceSeatId: 'seat-1' } })));
    expect(description!.changes).toEqual([
      { text: `Hing's ${abilityDisplayName('unyielding')} replaced 5 ♣ with 7 ♥`, card: card('r1', 'heart', 7) },
      { text: `Hing's ${abilityDisplayName('unyielding')} replaced 7 ♥ with K ♠`, card: card('r2', 'spade', 13) },
    ]);
  });

  it('settled: the consequence from the real game state, and no waiting line', () => {
    const description = describeIt(table(view(skillReader(), 'seat-0', card('j', 'club', 5), { data: { sourceSeatId: 'seat-1' } })));
    expect(description).toMatchObject({ outcome: 'Bo discards 2 cards or takes 1 damage', waiting: null });
    const short = describeIt(table(view(skillReader(), 'seat-0', card('j', 'club', 5), { data: { sourceSeatId: 'seat-1' } }), { handOfSeat1: 1 }));
    expect(short?.outcome).toBe('Bo takes 1 damage');
  });

  it('a Lightning that strikes names the judged seat', () => {
    expect(describeIt(table(view(cardReader('lightning'), 'seat-1', card('j', 'spade', 5))))?.outcome).toBe('Bo takes 3 thunder damage');
  });

  it('unsettled: no consequence, and the waiting line names the seat that is deciding', () => {
    const unsettled = view(skillReader(), 'seat-0', card('j', 'club', 5), { settled: false, data: { sourceSeatId: 'seat-1' } });
    const deciding = describeIt(table(unsettled, { pending: { pendingChoice: { id: 'c', seatId: 'seat-1', options: [] } as never } }));
    expect(deciding).toMatchObject({ settled: false, outcome: null, waiting: 'Waiting for Bo to decide whether to change the judgment' });
    expect(describeIt(table(unsettled))?.waiting).toBe('Waiting for skills that can change the judgment');
  });

  it('a reader without an outcome entry has no consequence, and does not throw', () => {
    const description = describeIt(table(view(cardReader('sha'), 'seat-0', card('j', 'club', 5))));
    expect(description).toMatchObject({ settled: true, outcome: null, waiting: null });
  });
});
