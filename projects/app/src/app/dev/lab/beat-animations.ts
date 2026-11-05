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

const PHASES: Phase[] = ['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End'];

export const BEAT_ANIMATIONS: LabAnimation[] = [
  beat({
    id: 'beat-turn',
    title: 'Turn',
    description: 'A seat’s turn begins: the turn banner.',
    params: [seatParam('seat', 'Seat', 'seat-1')],
    play: (t, p) => withEvents(t, [{ kind: 'TurnAdvancedEvent', seatId: seat(p, 'seat'), turnNumber: t.turn.turnNumber + 1 }], (s) => ({ ...s, turn: { ...s.turn, ownerSeatId: seat(p, 'seat') } })),
  }),
  beat({
    id: 'beat-phase',
    title: 'Phase',
    description: 'A seat enters a phase.',
    params: [
      seatParam('seat', 'Seat', 'seat-0'),
      { key: 'phase', label: 'Phase', kind: 'choice', options: PHASES.map((v) => ({ value: v, label: v })), default: 'Draw' },
    ],
    play: (t, p) => withEvents(t, [{ kind: 'PhaseChangedEvent', seatId: seat(p, 'seat'), phase: p['phase'] as Phase }], (s) => ({ ...s, phase: p['phase'] as Phase })),
  }),
  beat({
    id: 'beat-draw',
    title: 'Draw',
    description: 'A seat draws cards from the Draw Pile.',
    params: [seatParam('seat', 'Seat', 'seat-0'), numberParam('count', 'Cards', 2)],
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
    title: 'Play a Card',
    description: 'A seat uses a card on a target: the card shows at the centre with arrows to its target.',
    params: [
      seatParam('seat', 'Seat', 'seat-0'),
      seatParam('target', 'Target', 'seat-1'),
      { key: 'card', label: 'Card', kind: 'choice', options: ['sha', 'duel', 'steal', 'break', 'peach'].map((v) => ({ value: v, label: v })), default: 'sha' },
    ],
    play: (t, p) => withEvents(t, [{ kind: 'CardPlayedEvent', seatId: seat(p, 'seat'), card: used(p['card'] as string, 'black', drawPileTop(t, 1)[0]), targets: [seatTarget(seat(p, 'target'))] }]),
  }),
  beat({
    id: 'beat-response',
    title: 'Respond with a Card',
    description: 'A seat answers another seat’s card with a card of its own.',
    params: [seatParam('seat', 'Seat', 'seat-1'), seatParam('answers', 'Answers', 'seat-0')],
    play: (t, p) => withEvents(t, [{ kind: 'CardPlayedEvent', seatId: seat(p, 'seat'), card: used('shan', 'red', drawPileTop(t, 1)[0]), targets: [], inResponseTo: { seatId: seat(p, 'answers') } }]),
  }),
  beat({
    id: 'beat-pass',
    title: 'Pass',
    description: 'A seat declines to answer.',
    params: [seatParam('seat', 'Seat', 'seat-1')],
    play: (t, p) => withEvents(t, [{ kind: 'ResponsePassedEvent', seatId: seat(p, 'seat'), pendingResponseId: 'lab', allowedCardIds: ['shan'] }]),
  }),
  beat({
    id: 'beat-move',
    title: 'Move a Card',
    description: 'A card goes from a seat’s hand to the Discard Pile.',
    params: [seatParam('seat', 'Seat', 'seat-0')],
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
    title: 'Damage',
    description: 'A seat takes damage from another seat (the damage picture itself is in Sprite Effects).',
    params: [seatParam('target', 'Target', 'seat-1'), seatParam('source', 'Source', 'seat-0'), numberParam('amount', 'Amount', 1)],
    play: (t, p) =>
      withEvents(t, [{ kind: 'DamageDealtEvent', damage: { source: seatTarget(seat(p, 'source')), target: seatTarget(seat(p, 'target')), amount: num(p, 'amount'), nature: 'normal' } }], (s) =>
        setHp(s, seat(p, 'target'), hpOf(s, seat(p, 'target')) - num(p, 'amount'))
      ),
  }),
  beat({
    id: 'beat-hp-lost',
    title: 'Lose HP',
    description: 'A seat loses HP with no damage (a cost).',
    params: [seatParam('seat', 'Seat', 'seat-0'), numberParam('amount', 'Amount', 1)],
    play: (t, p) => withEvents(t, [{ kind: 'HpLostEvent', seatId: seat(p, 'seat'), amount: num(p, 'amount') }], (s) => setHp(s, seat(p, 'seat'), hpOf(s, seat(p, 'seat')) - num(p, 'amount'))),
  }),
  beat({
    id: 'beat-heal',
    title: 'Heal',
    description: 'A damaged seat recovers HP.',
    params: [seatParam('seat', 'Seat', 'seat-0'), numberParam('amount', 'Amount', 1)],
    before: (b, p) => setHp(b, seat(p, 'seat'), hpOf(b, seat(p, 'seat')) - num(p, 'amount')),
    play: (t, p) => withEvents(t, [{ kind: 'HealEvent', target: seatTarget(seat(p, 'seat')), amount: num(p, 'amount') }], (s) => setHp(s, seat(p, 'seat'), hpOf(s, seat(p, 'seat')) + num(p, 'amount'))),
  }),
  beat({
    id: 'beat-dying',
    title: 'Dying',
    description: 'A seat falls to 0 HP and is asked to be saved.',
    params: [seatParam('seat', 'Seat', 'seat-1')],
    before: (b, p) => setHp(b, seat(p, 'seat'), 0),
    play: (t, p) => withEvents(t, [{ kind: 'SeatDyingEvent', seatId: seat(p, 'seat') }]),
  }),
  beat({
    id: 'beat-saved',
    title: 'Saved',
    description: 'A dying seat is back above 0 HP.',
    params: [seatParam('seat', 'Seat', 'seat-1')],
    before: (b, p) => setHp(b, seat(p, 'seat'), 0),
    play: (t, p) => withEvents(t, [{ kind: 'SeatSavedEvent', seatId: seat(p, 'seat') }], (s) => setHp(s, seat(p, 'seat'), 1)),
  }),
  beat({
    id: 'beat-reveal',
    title: 'Reveal a General',
    description: 'A seat turns a General face up.',
    params: [
      seatParam('seat', 'Seat', 'seat-1'),
      { key: 'slot', label: 'General', kind: 'choice', options: [{ value: 'main', label: 'Main' }, { value: 'deputy', label: 'Deputy' }], default: 'main' },
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
    title: 'Eliminated',
    description: 'A seat is out of the game.',
    params: [seatParam('seat', 'Seat', 'seat-1')],
    before: (b, p) => setHp(b, seat(p, 'seat'), 0),
    play: (t, p) => withEvents(t, [{ kind: 'SeatEliminatedEvent', seatId: seat(p, 'seat') }], (s) => update(s, seat(p, 'seat'), (x) => ({ ...x, eliminated: true }))),
  }),
  beat({
    id: 'beat-ability',
    title: 'Use a Skill',
    description: 'A seat uses a skill: the skill callout.',
    params: [seatParam('seat', 'Seat', 'seat-0')],
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
