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

  describe('what the popup plays', () => {
    const lightning = (suit: 'spade' | 'heart', rank = 5, over: object = {}) => describeIt(table(view(cardReader('lightning'), 'seat-1', card('j', suit, rank), over)));

    it('carries the verdict, the effect and the rule line from content', () => {
      expect(lightning('spade')).toMatchObject({ verdict: 'bad', effect: { kind: 'damage', amount: 3, subject: 'seat' } });
      expect(lightning('spade')?.rule).toContain('A spade from 2 to 9 deals 3 thunder damage');
      expect(lightning('heart')).toMatchObject({ verdict: 'good', effect: { kind: 'pass-on' } });
    });

    it('is neutral with no stamp to draw when neither reading means anything', () => {
      const duel = describeIt(table(view(skillReader({ kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'dueling-heroes' }), 'seat-0', card('j', 'heart', 5))));
      expect(duel).toMatchObject({ verdict: 'neutral', effect: { kind: 'none' } });
    });

    it('reads the damage subject’s HP from the public state', () => {
      expect(lightning('spade')?.hp).toEqual({ seatName: 'Bo', current: 4, max: 4 });
    });

    it('has no HP unless the effect is damage', () => {
      expect(lightning('heart')?.hp).toBeNull();
    });

    it('has a null maximum when the table shows none for that seat', () => {
      const state = table(view(cardReader('lightning'), 'seat-1', card('j', 'spade', 5)));
      state.seats[1] = { ...state.seats[1], maxCombinedHp: 0 };
      expect(describeIt(state)?.hp).toEqual({ seatName: 'Bo', current: 4, max: null });
    });

    it('unsettled: no verdict, effect or HP yet, but the rule line is there', () => {
      const unsettled = lightning('spade', 5, { settled: false });
      expect(unsettled).toMatchObject({ verdict: null, effect: null, hp: null });
      expect(unsettled?.rule).toBeTruthy();
    });

    it('lists the cards that were replaced, oldest first, and keeps only the last three', () => {
      const chain = ['a', 'b', 'c', 'd'].map((id, i) => ({ owner: xiahouOwner, abilityId: 'devil', card: card(`r${id}`, 'heart', i + 2), replaced: card(id === 'a' ? 'j' : `r${['a', 'b', 'c'][i - 1]}`, 'club', i + 1) }));
      const description = describeIt(table(view(cardReader('lightning'), 'seat-1', card('rd', 'heart', 5), { changes: chain })));
      expect(description!.replaced.map((c) => c.instanceId)).toEqual(['ra', 'rb', 'rc']);
      expect(description!.changes).toHaveLength(4);
    });
  });
});
