import { CardInstance, GameState, Phase, UsedCard, moveCard } from 'engine';
import { setHp } from '../recipe';
import { LabAnimation, LabParamValue, drawPileTop, numberParam, seatParam, withEvents } from './lab-animation';

type P = Record<string, LabParamValue>;
const seat = (p: P, key: string) => p[key] as string;
const num = (p: P, key: string) => p[key] as number;
const seatTarget = (seatId: string) => ({ kind: 'seat' as const, seatId });
const hpOf = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
const update = (s: GameState, seatId: string, change: (seat: GameState['seats'][number]) => GameState['seats'][number]): GameState => ({
  ...s,
  seats: s.seats.map((x) => (x.id === seatId ? change(x) : x)),
});
const used = (as: string, colour: UsedCard['colour'], card: CardInstance): UsedCard => ({ as, colour, physical: [card] });
const beat = (a: Omit<LabAnimation, 'group'>): LabAnimation => ({ group: 'Beats', ...a });

export const BEAT_ANIMATIONS: LabAnimation[] = [
  beat({
    id: 'beat-turn',
    title: 'preview.beat-turn.title',
    description: 'preview.beat-turn.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-1')],
    play: (t, p) => withEvents(t, [{ kind: 'TurnAdvancedEvent', seatId: seat(p, 'seat'), turnNumber: t.turn.turnNumber + 1 }], (s) => ({ ...s, turn: { ...s.turn, ownerSeatId: seat(p, 'seat') } })),
  }),
  beat({
    id: 'beat-phase',
    title: 'preview.beat-phase.title',
    description: 'preview.beat-phase.description',
    params: [
      seatParam('seat', 'preview.param.seat', 'seat-0'),
      { key: 'phase', label: 'preview.param.phase', kind: 'phase', default: 'Draw' },
    ],
    play: (t, p) => withEvents(t, [{ kind: 'PhaseChangedEvent', seatId: seat(p, 'seat'), phase: p['phase'] as Phase }], (s) => ({ ...s, phase: p['phase'] as Phase })),
  }),
  beat({
    id: 'beat-draw',
    title: 'preview.beat-draw.title',
    description: 'preview.beat-draw.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-0'), numberParam('count', 'preview.param.cards', 2)],
    play: (t, p) => {
      const cards = drawPileTop(t, num(p, 'count'));
      const hand = t.seats.find((x) => x.id === seat(p, 'seat'))!.hand.zoneId;
      return withEvents(t, [{ kind: 'CardsDrawnEvent', seatId: seat(p, 'seat'), cardInstanceIds: cards.map((c) => c.instanceId) }], (s) => ({
        ...s,
        zones: cards.reduce((zones, c) => moveCard(zones, c.instanceId, hand), s.zones),
      }));
    },
  }),
  beat({
    id: 'beat-play',
    title: 'preview.beat-play.title',
    description: 'preview.beat-play.description',
    params: [
      seatParam('seat', 'preview.param.seat', 'seat-0'),
      seatParam('target', 'preview.param.target', 'seat-1'),
      { key: 'card', label: 'preview.param.card', kind: 'card', values: ['sha', 'duel', 'steal', 'break', 'peach'], default: 'sha' },
    ],
    play: (t, p) => withEvents(t, [{ kind: 'CardPlayedEvent', seatId: seat(p, 'seat'), card: used(p['card'] as string, 'black', drawPileTop(t, 1)[0]), targets: [seatTarget(seat(p, 'target'))] }]),
  }),
  beat({
    id: 'beat-response',
    title: 'preview.beat-response.title',
    description: 'preview.beat-response.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-1'), seatParam('answers', 'preview.param.answers', 'seat-0')],
    play: (t, p) => withEvents(t, [{ kind: 'CardPlayedEvent', seatId: seat(p, 'seat'), card: used('shan', 'red', drawPileTop(t, 1)[0]), targets: [], inResponseTo: { seatId: seat(p, 'answers') } }]),
  }),
  beat({
    id: 'beat-pass',
    title: 'preview.beat-pass.title',
    description: 'preview.beat-pass.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-1')],
    play: (t, p) => withEvents(t, [{ kind: 'ResponsePassedEvent', seatId: seat(p, 'seat'), pendingResponseId: 'lab', allowedCardIds: ['shan'] }]),
  }),
  beat({
    id: 'beat-move',
    title: 'preview.beat-move.title',
    description: 'preview.beat-move.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-0')],
    play: (t, p) => {
      const handId = t.seats.find((x) => x.id === seat(p, 'seat'))!.hand.zoneId;
      const card = t.zones.find((z) => z.id === handId)!.cards[0];
      const discard = t.zones.find((z) => z.kind === 'discardPile')!;
      return withEvents(t, [{ kind: 'CardMovedEvent', cardInstanceId: card.instanceId, fromZoneId: handId, toZoneId: discard.id, card }], (s) => ({
        ...s,
        zones: moveCard(s.zones, card.instanceId, discard.id),
      }));
    },
  }),
  beat({
    id: 'beat-damage',
    title: 'preview.beat-damage.title',
    description: 'preview.beat-damage.description',
    params: [seatParam('target', 'preview.param.target', 'seat-1'), seatParam('source', 'preview.param.source', 'seat-0'), numberParam('amount', 'preview.param.amount', 1)],
    play: (t, p) =>
      withEvents(t, [{ kind: 'DamageDealtEvent', damage: { source: seatTarget(seat(p, 'source')), target: seatTarget(seat(p, 'target')), amount: num(p, 'amount'), nature: 'normal' } }], (s) =>
        setHp(s, seat(p, 'target'), hpOf(s, seat(p, 'target')) - num(p, 'amount'))
      ),
  }),
  beat({
    id: 'beat-hp-lost',
    title: 'preview.beat-hp-lost.title',
    description: 'preview.beat-hp-lost.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-0'), numberParam('amount', 'preview.param.amount', 1)],
    play: (t, p) => withEvents(t, [{ kind: 'HpLostEvent', seatId: seat(p, 'seat'), amount: num(p, 'amount') }], (s) => setHp(s, seat(p, 'seat'), hpOf(s, seat(p, 'seat')) - num(p, 'amount'))),
  }),
  beat({
    id: 'beat-heal',
    title: 'preview.beat-heal.title',
    description: 'preview.beat-heal.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-0'), numberParam('amount', 'preview.param.amount', 1)],
    before: (b, p) => setHp(b, seat(p, 'seat'), hpOf(b, seat(p, 'seat')) - num(p, 'amount')),
    play: (t, p) => withEvents(t, [{ kind: 'HealEvent', target: seatTarget(seat(p, 'seat')), amount: num(p, 'amount') }], (s) => setHp(s, seat(p, 'seat'), hpOf(s, seat(p, 'seat')) + num(p, 'amount'))),
  }),
  beat({
    id: 'beat-dying',
    title: 'preview.beat-dying.title',
    description: 'preview.beat-dying.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-1')],
    before: (b, p) => setHp(b, seat(p, 'seat'), 0),
    play: (t, p) => withEvents(t, [{ kind: 'SeatDyingEvent', seatId: seat(p, 'seat') }]),
  }),
  beat({
    id: 'beat-saved',
    title: 'preview.beat-saved.title',
    description: 'preview.beat-saved.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-1')],
    before: (b, p) => setHp(b, seat(p, 'seat'), 0),
    play: (t, p) => withEvents(t, [{ kind: 'SeatSavedEvent', seatId: seat(p, 'seat') }], (s) => setHp(s, seat(p, 'seat'), 1)),
  }),
  beat({
    id: 'beat-reveal',
    title: 'preview.beat-reveal.title',
    description: 'preview.beat-reveal.description',
    params: [
      seatParam('seat', 'preview.param.seat', 'seat-1'),
      { key: 'slot', label: 'preview.param.general', kind: 'slot', default: 'main' },
    ],
    play: (t, p) => {
      const slot = p['slot'] as 'main' | 'deputy';
      return withEvents(t, [{ kind: 'GeneralRevealedEvent', seatId: seat(p, 'seat'), slot }], (s) =>
        update(s, seat(p, 'seat'), (x) => ({ ...x, generals: x.generals && { ...x.generals, [slot]: { ...x.generals[slot], revealed: true } } }))
      );
    },
  }),
  beat({
    id: 'beat-eliminated',
    title: 'preview.beat-eliminated.title',
    description: 'preview.beat-eliminated.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-1')],
    before: (b, p) => setHp(b, seat(p, 'seat'), 0),
    play: (t, p) => withEvents(t, [{ kind: 'SeatEliminatedEvent', seatId: seat(p, 'seat') }], (s) => update(s, seat(p, 'seat'), (x) => ({ ...x, eliminated: true }))),
  }),
  beat({
    id: 'beat-ability',
    title: 'preview.beat-ability.title',
    description: 'preview.beat-ability.description',
    params: [seatParam('seat', 'preview.param.seat', 'seat-0')],
    play: (t, p) =>
      withEvents(t, [
        {
          kind: 'AbilityUsedEvent',
          owner: { kind: 'general', seatId: seat(p, 'seat'), slot: 'main', skillId: 'kingdomWars:double-edged' },
          abilityId: 'kingdomWars:double-edged',
          outcome: 'used',
        },
      ]),
  }),
];
