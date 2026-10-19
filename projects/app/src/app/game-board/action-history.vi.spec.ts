import { CardInstance, CardZone, EngineEvent, Seat, usedCardOf } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { actionHistory } from './action-history';

const tr = makeTranslator(vi);
const zones: CardZone[] = [
  { id: 'drawPile', kind: 'drawPile', cards: [] },
  { id: 'discardPile', kind: 'discardPile', cards: [] },
  ...['seat-0', 'seat-1'].flatMap((id) => [
    { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:pile`, kind: 'pile' as const, ownerSeatId: id, cards: [] },
    { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
  ]),
];
const players = [0, 1, 2, 3].map((i) => ({ id: `p${i}`, seatId: `seat-${i}`, kind: 'bot' as const, name: `Seat ${i}` }));
const seats: Seat[] = [{
  id: 'seat-0', index: 0, kingdom: 'Shu', combinedHp: 3, maxCombinedHp: 4, eliminated: false,
  generals: { main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'liu-bei', revealed: false } },
  hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' },
}];

const sha: CardInstance = { instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 7 };
const shan: CardInstance = { instanceId: 'shan-1', definitionId: 'shan', suit: 'heart', rank: 2 };
const peach: CardInstance = { instanceId: 'peach-1', definitionId: 'peach', suit: 'heart', rank: 12 };
const lion: CardInstance = { instanceId: 'lion-1', definitionId: 'silver-lion', suit: 'club', rank: 1 };
const blade: CardInstance = { instanceId: 'blade-1', definitionId: 'green-dragon-blade', suit: 'spade', rank: 5 };
const barbarians: CardInstance = { instanceId: 'barb-1', definitionId: 'barbarians', suit: 'spade', rank: 7 };
const drawTwo: CardInstance = { instanceId: 'dt-1', definitionId: 'draw-two', suit: 'heart', rank: 7 };
const wuxie: CardInstance = { instanceId: 'wx-1', definitionId: 'wuxie', suit: 'spade', rank: 11 };
const counter: CardInstance = { instanceId: 'wx-2', definitionId: 'wuxie', suit: 'club', rank: 3 };

const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });
const move = (card: CardInstance, fromZoneId: string, toZoneId: string): EngineEvent => ({ kind: 'CardMovedEvent', cardInstanceId: card.instanceId, fromZoneId, toZoneId, card });
const general = (seatId: string, skillId: string) => ({ kind: 'general' as const, seatId, slot: 'main' as const, skillId });
const textsOf = (log: EngineEvent[], translator?: typeof tr) =>
  actionHistory(log, zones, players, seats, translator).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
const vi_ = (log: EngineEvent[]) => textsOf(log, tr);
const en_ = (log: EngineEvent[]) => textsOf(log);

describe('card plays in Vietnamese', () => {
  it('a play, an answer against it, an equip, an untargeted use', () => {
    expect(vi_([
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(sha), targets: [seat('seat-1')] },
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(shan), targets: [], inResponseTo: { seatId: 'seat-0', cardInstanceId: 'sha-1' } },
    ])).toEqual(['Người chơi 1 dùng Dodge (2 ♥) chống lại Slash của Người chơi 0', 'Người chơi 0 dùng Slash (7 ♠) lên Người chơi 1']);
    expect(vi_([{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(lion), targets: [] }])).toEqual(['Người chơi 0 trang bị Silver Lion (A ♣)']);
    expect(vi_([{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(peach), targets: [] }])).toEqual(['Người chơi 0 dùng Peach (Q ♥)']);
  });

  it('an answer to no named seat, and an answer to a seat but no known card', () => {
    const answer = (inResponseTo: object): EngineEvent => ({ kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(shan), targets: [], inResponseTo });
    expect(vi_([answer({ cardInstanceId: 'sha-1' })])).toEqual(['Người chơi 1 dùng Dodge (2 ♥) để phản hồi']);
    expect(en_([answer({ cardInstanceId: 'sha-1' })])).toEqual(['Seat 1 used Dodge (2 ♥) in response']);
    expect(vi_([answer({ seatId: 'seat-0' })])).toEqual(['Người chơi 1 dùng Dodge (2 ♥) chống lại Người chơi 0']);
    expect(en_([answer({ seatId: 'seat-0' })])).toEqual(['Seat 1 used Dodge (2 ♥) against Seat 0']);
  });

  it('saving a dying seat, another or oneself', () => {
    const save = (dyingSeatId: string): EngineEvent => ({ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(peach), targets: [], inResponseTo: { dyingSeatId } });
    expect(vi_([save('seat-1')])).toEqual(['Người chơi 0 dùng Peach (Q ♥) để cứu Người chơi 1']);
    expect(vi_([save('seat-0')])).toEqual(['Người chơi 0 dùng Peach (Q ♥) để cứu chính mình']);
    expect(en_([save('seat-0')])).toEqual(['Seat 0 used Peach (Q ♥) to save themselves']);
  });

  it('cancelling a Tool, a counter Wuxie, and a Tool aimed at the player themselves', () => {
    expect(vi_([
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(barbarians), targets: [] },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(wuxie), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'barb-1', targetSeatId: 'seat-2' } },
      { kind: 'CardPlayedEvent', seatId: 'seat-2', card: usedCardOf(counter), targets: [], inResponseTo: { seatId: 'seat-0', counters: true } },
    ])).toEqual([
      'Người chơi 2 hủy Wuxie của Người chơi 0 bằng Wuxie (3 ♣)',
      'Người chơi 0 hủy Barbarians của Người chơi 1 lên Người chơi 2 bằng Wuxie (J ♠)',
      'Người chơi 1 dùng Barbarians (7 ♠)',
    ]);
    const self: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(drawTwo), targets: [] },
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(wuxie), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'dt-1', targetSeatId: 'seat-1' } },
    ];
    expect(vi_(self)[0]).toBe('Người chơi 0 hủy Draw Two của Người chơi 1 bằng Wuxie (J ♠)');
    expect(en_(self)[0]).toBe("Seat 0 cancelled Seat 1's Draw Two with Wuxie (J ♠)");
  });

  it('cancelling a Tool that is not known names a Tool', () => {
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(wuxie), targets: [], inResponseTo: { seatId: 'seat-1', cardInstanceId: 'never-played', targetSeatId: 'seat-2' } },
    ];
    expect(vi_(log)).toEqual(['Người chơi 0 hủy Cẩm nang của Người chơi 1 lên Người chơi 2 bằng Wuxie (J ♠)']);
    expect(en_(log)).toEqual(["Seat 0 cancelled Seat 1's Tool on Seat 2 with Wuxie (J ♠)"]);
  });
});

describe('moves and picks in Vietnamese', () => {
  it('a discard from hand, and a worn card discarded', () => {
    expect(vi_([move(sha, 'seat-0:hand', 'discardPile')])).toEqual(['Người chơi 0 bỏ Slash (7 ♠)']);
    expect(vi_([move(lion, 'seat-0:equip', 'discardPile')])).toEqual(['Silver Lion của Người chơi 0 bị bỏ']);
    expect(en_([move(lion, 'seat-0:equip', 'discardPile')])).toEqual(["Seat 0's Silver Lion was discarded"]);
  });

  it('a worn card handed over, one put under a General, Lightning moving on', () => {
    expect(vi_([move(blade, 'seat-0:equip', 'seat-1:hand')])).toEqual(['Người chơi 1 lấy Green Dragon Blade (5 ♠) của Người chơi 0']);
    expect(vi_([move(sha, 'drawPile', 'seat-0:pile')])).toEqual(['Người chơi 0 đặt Slash (7 ♠) dưới Tướng của mình']);
    expect(vi_([move(sha, 'seat-0:judgment', 'seat-1:judgment')])).toEqual(['Slash (7 ♠) chuyển từ Người chơi 0 sang Người chơi 1']);
    expect(en_([move(sha, 'seat-0:judgment', 'seat-1:judgment')])).toEqual(['Slash (7 ♠) moved on from Seat 0 to Seat 1']);
  });

  it('a Tool taking a worn card, and a skill taking a hand card', () => {
    const steal = { kind: 'choice' as const, card: { as: 'steal', colour: 'black' as const, physical: [] }, userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    const take: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'take', reason: steal, shows: { kind: 'card', card: lion } },
      move(lion, 'seat-0:equip', 'seat-1:hand'),
    ];
    expect(vi_(take)).toEqual(['Người chơi 1 lấy Silver Lion (A ♣) của Người chơi 0 bằng Steal']);
    expect(en_(take)).toEqual(["Seat 1 took Seat 0's Silver Lion (A ♣) with Steal"]);
    const feedback = { kind: 'ability' as const, owner: general('seat-0', 'feedback'), abilityId: 'feedback', targetSeatId: 'seat-1' };
    const hand: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', reason: feedback, shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 2 } },
      { kind: 'CardMovedEvent', cardInstanceId: 'x', fromZoneId: 'seat-1:hand', toZoneId: 'seat-0:hand' },
    ];
    expect(vi_(hand)).toEqual(['Người chơi 0 lấy một lá bài trên tay của Người chơi 1 bằng Feedback']);
  });

  it('a discard from a hand, with and without a known face', () => {
    const reason = { kind: 'ability' as const, owner: general('seat-1', 'sudden-attack'), abilityId: 'sudden-attack', targetSeatId: 'seat-0' };
    const pick: EngineEvent = { kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'discard', reason, shows: { kind: 'hidden-hand', seatId: 'seat-0', count: 1 } };
    const known = [pick, move(sha, 'seat-0:hand', 'discardPile')];
    expect(vi_(known)).toEqual(['Người chơi 1 bỏ Slash (7 ♠) trên tay của Người chơi 0 bằng Sudden Attack']);
    expect(en_(known)).toEqual(["Seat 1 discarded Slash (7 ♠) from Seat 0's hand with Sudden Attack"]);
    const unknown = [pick, { kind: 'CardMovedEvent' as const, cardInstanceId: 'x', fromZoneId: 'seat-0:hand', toZoneId: 'discardPile' }];
    expect(vi_(unknown)).toEqual(['Người chơi 1 bỏ một lá bài trên tay của Người chơi 0 bằng Sudden Attack']);
    expect(en_(unknown)).toEqual(["Seat 1 discarded a card from Seat 0's hand with Sudden Attack"]);
  });

  it('a card taken from the chooser’s own zone has no possessive', () => {
    const reason = { kind: 'ability' as const, owner: general('seat-0', 'x-skill'), abilityId: 'x-skill' };
    const log: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'take', reason, shows: { kind: 'card', card: peach } },
      move(peach, 'seat-0:pile', 'seat-0:hand'),
    ];
    expect(en_(log)).toEqual(['Seat 0 took Peach (Q ♥) with X Skill']);
    expect(vi_(log)).toEqual(['Người chơi 0 lấy Peach (Q ♥) bằng X Skill']);
  });
});

describe('status and table lines in Vietnamese', () => {
  it('damage, with and without a source or a nature', () => {
    const hit = (source: ReturnType<typeof seat> | null, amount: number, nature: string): EngineEvent => ({ kind: 'DamageDealtEvent', damage: { source, target: seat('seat-0'), amount, nature } as never });
    expect(vi_([hit(seat('seat-1'), 2, 'normal')])).toEqual(['Người chơi 0 chịu 2 sát thương từ Người chơi 1']);
    expect(vi_([hit(null, 1, 'normal')])).toEqual(['Người chơi 0 chịu 1 sát thương']);
    expect(vi_([hit(null, 3, 'thunder')])).toEqual(['Người chơi 0 chịu 3 sát thương sét']);
    expect(vi_([hit(seat('seat-1'), 1, 'thunder')])).toEqual(['Người chơi 0 chịu 1 sát thương sét từ Người chơi 1']);
    expect(en_([hit(seat('seat-1'), 1, 'thunder')])).toEqual(['Seat 0 took 1 thunder damage from Seat 1']);
    expect(vi_([hit(null, 1, 'fire')])).toEqual(['Người chơi 0 chịu 1 sát thương lửa']);
  });

  it('chain toggles, a Chains Recast and a played Fire Attack', () => {
    const chains: CardInstance = { instanceId: 'ch-1', definitionId: 'chains', suit: 'club', rank: 12 };
    const fire: CardInstance = { instanceId: 'fa-1', definitionId: 'fire-attack', suit: 'heart', rank: 4 };
    expect(vi_([
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(chains), targets: [seat('seat-0'), seat('seat-1')] },
      { kind: 'ChainToggledEvent', seatId: 'seat-0', chained: true },
      { kind: 'ChainToggledEvent', seatId: 'seat-1', chained: false },
      { kind: 'DamageDealtEvent', damage: { source: null, target: seat('seat-0'), amount: 1, nature: 'fire' } },
      { kind: 'ChainToggledEvent', seatId: 'seat-0', chained: false },
    ])).toEqual([
      'Người chơi 0 được tháo xích',
      'Người chơi 0 chịu 1 sát thương lửa',
      'Người chơi 1 tự tháo xích',
      'Người chơi 1 xích Người chơi 0',
      'Người chơi 1 dùng Chains (Q ♣) lên Người chơi 0, Người chơi 1',
    ]);
    expect(vi_([{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(chains), targets: [] }])).toEqual(['Người chơi 1 đổi lại Chains (Q ♣)']);
    expect(vi_([{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: { ...usedCardOf(fire), as: 'sha', nature: 'fire' }, targets: [seat('seat-0')] }])).toEqual(['Người chơi 1 dùng Fire Attack (4 ♥) lên Người chơi 0']);
  });

  it('healing, drawing, dying, saved, eliminated, generals chosen, reshuffle', () => {
    expect(vi_([{ kind: 'HealEvent', target: seat('seat-0'), amount: 1 }])).toEqual(['Người chơi 0 hồi 1 Sinh lực']);
    expect(vi_([{ kind: 'CardsDrawnEvent', seatId: 'seat-0', cardInstanceIds: ['a'] }])).toEqual(['Người chơi 0 rút 1 lá bài']);
    expect(vi_([{ kind: 'CardsDrawnEvent', seatId: 'seat-1', cardInstanceIds: ['a', 'b'] }])).toEqual(['Người chơi 1 rút 2 lá bài']);
    expect(vi_([{ kind: 'SeatDyingEvent', seatId: 'seat-1' }])).toEqual(['Người chơi 1 cận kề cái chết']);
    expect(vi_([{ kind: 'SeatSavedEvent', seatId: 'seat-1' }])).toEqual(['Người chơi 1 đã được cứu']);
    expect(vi_([{ kind: 'SeatEliminatedEvent', seatId: 'seat-1' }])).toEqual(['Người chơi 1 bị loại']);
    expect(vi_([{ kind: 'GeneralsChosenEvent', seatId: 'seat-0' }])).toEqual(['Người chơi 0 đã chọn Tướng của mình']);
    expect(vi_([{ kind: 'DiscardPileReshuffledEvent', cardCount: 9 }])).toEqual(['Chồng bài bỏ (9) đã được xáo vào chồng bài rút']);
  });

  it('keeps the force colour of a status line', () => {
    const history = actionHistory([{ kind: 'HealEvent', target: seat('seat-0'), amount: 1 }], zones, players, seats, tr);
    expect(history[0]).toMatchObject({ text: 'Người chơi 0 hồi 1 Sinh lực', force: 'Shu' });
  });

  it('revealing a General, with and without a skill and a known name', () => {
    expect(vi_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'main' }])).toEqual(['Người chơi 0 lật Chủ tướng của mình']);
    expect(vi_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'deputy' }])).toEqual(['Người chơi 0 lật Phó tướng của mình']);
    expect(vi_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-0', slot: 'main', forAbilityId: 'fighting-saint' }])).toEqual(['Người chơi 0 lật Guan Yu để dùng Fighting Saint']);
    expect(vi_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-1', slot: 'main', forAbilityId: 'fighting-saint' }])).toEqual(['Người chơi 1 lật Chủ tướng của mình để dùng Fighting Saint']);
    expect(en_([{ kind: 'GeneralRevealedEvent', seatId: 'seat-1', slot: 'deputy', forAbilityId: 'fighting-saint' }])).toEqual(['Seat 1 revealed their Deputy General to use Fighting Saint']);
  });

  it('skipped phases, including the raw GeneralSelection id', () => {
    expect(vi_([{ kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'Play' }])).toEqual(['Người chơi 0 bỏ qua giai đoạn ra bài']);
    expect(vi_([{ kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'Judgment' }])).toEqual(['Người chơi 0 bỏ qua giai đoạn phán xét']);
    expect(en_([{ kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'Judgment' }])).toEqual(['Seat 0 skipped the Judgment Phase']);
    expect(en_([{ kind: 'PhaseSkippedEvent', seatId: 'seat-0', phase: 'GeneralSelection' }])).toEqual(['Seat 0 skipped the GeneralSelection Phase']);
  });
});

describe('choices and skills in Vietnamese', () => {
  const reason = { kind: 'ability' as const, owner: general('seat-0', 'kindness'), abilityId: 'kindness' };

  it('using an ability, with and without a target other than oneself', () => {
    const use = (targetSeatId?: string): EngineEvent => ({ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'use', shows: { kind: 'use' }, reason: { kind: 'ability', owner: general('seat-0', 'ax'), abilityId: 'axe', ...(targetSeatId ? { targetSeatId } : {}) } });
    expect(vi_([use('seat-1')])).toEqual(['Người chơi 0 dùng Axe lên Người chơi 1']);
    expect(vi_([use()])).toEqual(['Người chơi 0 dùng Axe']);
    expect(vi_([use('seat-0')])).toEqual(['Người chơi 0 dùng Axe']);
  });

  it('letting the user draw, giving cards, choosing a seat, a suit, a label', () => {
    const gs = { kind: 'choice' as const, card: usedCardOf({ instanceId: 'gs', definitionId: 'gender-swords', suit: 'spade', rank: 2 }), userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    expect(vi_([{ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'discard', reason: gs, shows: { kind: 'decline' } }])).toEqual(['Người chơi 0 để Người chơi 1 rút một lá bài (Gender Swords)']);
    expect(vi_([
      { kind: 'SelectionMadeEvent', seatId: 'seat-0', reason, of: 'cards', ids: ['a', 'b'] },
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'give', shows: { kind: 'seat', seatId: 'seat-1' }, reason },
    ])).toEqual(['Người chơi 0 đưa 2 lá bài cho Người chơi 1']);
    expect(vi_([{ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'seat', seatId: 'seat-1' }, reason }])).toEqual(['Người chơi 0 đã chọn Người chơi 1']);
    expect(vi_([{ kind: 'ChoiceMadeEvent', seatId: 'seat-1', verb: 'pick', shows: { kind: 'suit', suit: 'heart' }, reason }])).toEqual(['Người chơi 1 gọi tên ♥']);
    expect(vi_([{ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'label', text: 'Done' }, reason }])).toEqual(['Người chơi 0 đã chọn Done']);
  });

  it('believing or doubting a claim', () => {
    const answer = (text: string): EngineEvent => ({
      kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'pick', shows: { kind: 'label', text },
      reason: { kind: 'ability', owner: general('seat-1', 'bewilder'), abilityId: 'bewilder', cardId: 'sha' },
    });
    expect(vi_([answer('Doubt')])).toEqual(['Người chơi 0 nghi ngờ Slash của Người chơi 1']);
    expect(vi_([answer('Believe')])).toEqual(['Người chơi 0 tin Slash của Người chơi 1']);
    expect(en_([answer('Doubt')])).toEqual(["Seat 0 doubted Seat 1's Slash"]);
  });

  it('a list of picked seats: one, two and three', () => {
    const picked = (ids: string[]): EngineEvent => ({ kind: 'SelectionMadeEvent', seatId: 'seat-0', of: 'seats', ids, reason: { kind: 'ability', owner: general('seat-0', 'sk'), abilityId: 'sky-scorcher' } });
    expect(vi_([picked(['seat-1'])])).toEqual(['Người chơi 0 đã chọn Người chơi 1 bằng Sky Scorcher']);
    expect(vi_([picked(['seat-1', 'seat-2'])])).toEqual(['Người chơi 0 đã chọn Người chơi 1 và Người chơi 2 bằng Sky Scorcher']);
    expect(vi_([picked(['seat-1', 'seat-2', 'seat-3'])])).toEqual(['Người chơi 0 đã chọn Người chơi 1, Người chơi 2 và Người chơi 3 bằng Sky Scorcher']);
    expect(en_([picked(['seat-1'])])).toEqual(['Seat 0 picked Seat 1 with Sky Scorcher']);
    expect(en_([picked(['seat-1', 'seat-2', 'seat-3'])])).toEqual(['Seat 0 picked Seat 1, Seat 2 and Seat 3 with Sky Scorcher']);
  });

  it('gaining a skill, choosing a Form, a lower max HP, HP lost', () => {
    expect(vi_([{ kind: 'SkillGainedEvent', seatId: 'seat-0', slot: 'main', skillId: 'fighting-saint' }])).toEqual(['Người chơi 0 nhận được Fighting Saint']);
    expect(vi_([{ kind: 'FormChosenEvent', seatId: 'seat-0', skillId: 'fighting-saint', generalId: 'guan-yu' }])).toEqual(['Người chơi 0 chọn Fighting Saint từ Guan Yu']);
    expect(vi_([{ kind: 'FormChosenEvent', seatId: 'seat-0', skillId: 'fighting-saint', generalId: 'no-such-general' }])).toEqual(['Người chơi 0 chọn Fighting Saint từ một Hóa thân']);
    expect(en_([{ kind: 'FormChosenEvent', seatId: 'seat-0', skillId: 'fighting-saint', generalId: 'no-such-general' }])).toEqual(['Seat 0 chose Fighting Saint from a Form']);
    expect(vi_([{ kind: 'MaxHpReducedEvent', seatId: 'seat-0', amount: 1, maxHp: 3 }])).toEqual(['Người chơi 0 giờ có Sinh lực tối đa là 3']);
    expect(vi_([{ kind: 'HpLostEvent', seatId: 'seat-0', amount: 2 }])).toEqual(['Người chơi 0 mất 2 Sinh lực']);
    expect(vi_([{ kind: 'HpLostEvent', seatId: 'seat-0', amount: 1, abilityId: 'battered-body' }])).toEqual(['Người chơi 0 mất 1 Sinh lực (Battered Body)']);
  });

  it('a skill’s judgment, and a changed judgment', () => {
    const five: CardInstance = { instanceId: 'j1', definitionId: 'shan', suit: 'heart', rank: 5 };
    const three: CardInstance = { instanceId: 'r1', definitionId: 'sha', suit: 'spade', rank: 3 };
    expect(vi_([{ kind: 'JudgmentEvent', seatId: 'seat-1', reader: { kind: 'skill', owner: general('seat-1', 'unyielding') }, card: five }])).toEqual(['Phán xét Unyielding của Người chơi 1: 5 ♥']);
    expect(vi_([{ kind: 'JudgmentChangedEvent', owner: general('seat-0', 'devil'), abilityId: 'devil', judgedSeatId: 'seat-1', card: three, replaced: five }])).toEqual(['Devil của Người chơi 0 đổi lá phán xét thành 3 ♠']);
  });

  it('arranging the draw pile, including zero on both ends', () => {
    const arranged = (top: number, bottom: number): EngineEvent => ({ kind: 'ArrangementMadeEvent', seatId: 'seat-0', reason: { kind: 'ability', owner: general('seat-0', 'astrology'), abilityId: 'astrology' }, top, bottom });
    expect(vi_([arranged(2, 1)])).toEqual(['Người chơi 0 đặt 2 lá bài lên trên chồng bài rút và 1 xuống dưới cùng']);
    expect(vi_([arranged(3, 0)])).toEqual(['Người chơi 0 đặt 3 lá bài lên trên chồng bài rút']);
    expect(vi_([arranged(0, 1)])).toEqual(['Người chơi 0 đặt 1 lá bài xuống dưới cùng chồng bài rút']);
    expect(en_([arranged(0, 0)])).toEqual(['Seat 0 put ']);
  });

  it('turning over, showing a card and turning cards up', () => {
    expect(vi_([{ kind: 'SeatTurnedEvent', seatId: 'seat-0', faceDown: true }])).toEqual(['Người chơi 0 úp Tướng']);
    expect(vi_([{ kind: 'SeatTurnedEvent', seatId: 'seat-0', faceDown: false }])).toEqual(['Người chơi 0 lật lại']);
    expect(vi_([{ kind: 'SeatTurnedEvent', seatId: 'seat-0', faceDown: false, passedTurn: true }])).toEqual(['Người chơi 0 lật lại và bỏ lượt']);
    expect(vi_([{ kind: 'CardShownEvent', seatId: 'seat-1', card: sha, abilityId: 'sow-revolt' }])).toEqual(['Người chơi 1 cho xem Slash (7 ♠)']);
    expect(vi_([{ kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [peach, sha] }])).toEqual(['Đã lật 2 lá bài: Peach (Q ♥), Slash (7 ♠)']);
    expect(en_([{ kind: 'CardsTurnedUpEvent', zoneId: 'processing', cards: [peach] }])).toEqual(['Turned up 1 card: Peach (Q ♥)']);
  });
});

describe('seats without a player name', () => {
  it('are named in the viewer’s language', () => {
    const log: EngineEvent[] = [{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: usedCardOf(peach), targets: [] }];
    const texts = (translator?: typeof tr) => actionHistory(log, zones, [], seats, translator).flatMap((e) => (e.kind === 'action' ? [e.text] : []));
    expect(texts(tr)).toEqual(['Người chơi 0 dùng Peach (Q ♥)']);
    expect(texts()).toEqual(['Seat 0 used Peach (Q ♥)']);
  });
});
