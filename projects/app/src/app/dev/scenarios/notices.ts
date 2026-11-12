import { CardInstance, ContentRegistry, GameState, getActiveSeatId, moveCard } from 'engine';
import { BoardScenario } from '../scenario';
import { act, emptyHand, equip, give, playableGame, setGenerals, setHp, setTurn, windowOf } from '../recipe';

const SEED = 7;
const SEATS = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];

// Seat-0 in its Play Phase with every seat's hand emptied, so nothing but what a scenario gives can answer or be taken.
const bareTable = (registry: ContentRegistry): GameState => SEATS.reduce((s, id) => emptyHand(s, id), setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Play'));

// A card of the given suit from the Draw Pile (never a Blaze or a Wuxie), moved into the seat's hand.
function giveSuit(state: GameState, seatId: string, suit: CardInstance['suit']): GameState {
  const card = state.zones.find((z) => z.kind === 'drawPile')!.cards.find((c) => c.suit === suit && !['blaze', 'wuxie', 'wuxie-guo'].includes(c.definitionId));
  if (!card) throw new Error(`No ${suit} card in the Draw Pile`);
  return { ...state, zones: moveCard(state.zones, card.instanceId, state.seats.find((s) => s.id === seatId)!.hand.zoneId) };
}

const handOf = (state: GameState, seatId: string): string[] =>
  state.zones.find((z) => z.id === state.seats.find((s) => s.id === seatId)!.hand.zoneId)!.cards.map((c) => c.definitionId);

// You are about to play `card`: it is your Play Phase, nothing is pending, and you hold it.
const aboutToPlay = (card: string) => (s: GameState): boolean => s.phase === 'Play' && getActiveSeatId(s) === 'seat-0' && windowOf(s) === null && handOf(s, 'seat-0').includes(card);

// Seat-1 holds a heart. Blaze: seat-1 shows it, then you may discard a card of the same suit. Seat-1's Generals
// are fixed (Ji Ling and Yuan Shao, whose skills do not touch Blaze), so the bots' General picks cannot change it.
const blazeTable = (registry: ContentRegistry, yourSuit: CardInstance['suit']): GameState =>
  giveSuit(giveSuit(give(setGenerals(bareTable(registry), registry, 'seat-1', 'kingdomWars:ji-ling', 'kingdomWars:yuan-shao'), 'seat-0', ['blaze']), 'seat-0', yourSuit), 'seat-1', 'heart');

export const NOTICE_SCENARIOS: BoardScenario[] = [
  {
    kind: 'board',
    id: 'notice-blaze-hit',
    group: 'Resolution Notices',
    title: 'preview.notice-blaze-hit.title',
    description: 'preview.notice-blaze-hit.description',
    seatCount: 4,
    build: (registry) => blazeTable(registry, 'heart'),
    reaches: aboutToPlay('blaze'),
  },
  {
    kind: 'board',
    id: 'notice-blaze-miss',
    group: 'Resolution Notices',
    title: 'preview.notice-blaze-miss.title',
    description: 'preview.notice-blaze-miss.description',
    seatCount: 4,
    build: (registry) => blazeTable(registry, 'spade'),
    reaches: aboutToPlay('blaze'),
  },
  {
    kind: 'board',
    id: 'notice-harvest',
    group: 'Resolution Notices',
    title: 'preview.notice-harvest.title',
    description: 'preview.notice-harvest.description',
    seatCount: 4,
    build: (registry) => give(bareTable(registry), 'seat-0', ['harvest']),
    reaches: aboutToPlay('harvest'),
  },
  {
    kind: 'board',
    id: 'notice-coerce',
    group: 'Resolution Notices',
    title: 'preview.notice-coerce.title',
    description: 'preview.notice-coerce.description',
    seatCount: 4,
    // Seat-1 wears a Crossbow and holds no Sha: play Coerce at seat-1 and seat-2, and its weapon comes to you.
    build: (registry) => equip(give(bareTable(registry), 'seat-0', ['coerce']), 'seat-1', 'crossbow'),
    reaches: aboutToPlay('coerce'),
  },
  {
    kind: 'board',
    id: 'notice-resurgence',
    group: 'Resolution Notices',
    title: 'preview.notice-resurgence.title',
    description: 'preview.notice-resurgence.description',
    seatCount: 4,
    // You are Meng Huo, hurt, at the start of your turn: confirming the reveals reaches your Draw Phase, which opens the ask.
    build: (registry) => {
      const state = setHp(setGenerals(setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Start'), registry, 'seat-0', 'meng-huo', 'guan-yu'), 'seat-0', 2);
      return act(state, registry, { kind: 'ConfirmRevealsAction', seatId: 'seat-0', slots: [] });
    },
    reaches: (s) => getActiveSeatId(s) === 'seat-0' && s.pendingChoice?.reason.kind === 'ability' && s.pendingChoice.reason.abilityId === 'resurgence',
  },
];
