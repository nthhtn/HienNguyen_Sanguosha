import { ContentRegistry, GameState, getActiveSeatId, awaitsAcknowledgement } from 'engine';
import { BoardScenario } from '../scenario';
import { act, emptyHand, give, giveOfSuit, playCard, playableGame, revealGenerals, setGenerals, setTurn, stackDrawPile, stepUntil } from '../recipe';

const SEED = 7;
const ZHEN_JI = 'kingdomWars:zhen-ji';
const GODDESS_LUO = 'kingdomWars:goddess-luo';
const XIAO_QIAO = 'xiao-qiao';
const PARTNER = 'kingdomWars:guan-yu';

const askedAbout = (s: GameState, abilityId: string): boolean =>
  getActiveSeatId(s) === 'seat-0' && s.pendingChoice?.reason.kind === 'ability' && s.pendingChoice.reason.abilityId === abilityId;

const use = (state: GameState, registry: ContentRegistry): GameState =>
  act(state, registry, { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: state.pendingChoice!.id, optionId: 'use' });

// Seat-0 plays Zhen Ji with her General face up. The bots play on until her Start Phase asks about Goddess Luo, and then the
// draw pile is stacked so the judgments come up in `suits` order: black, black, red lets the whole chain play.
function goddessLuoAsk(registry: ContentRegistry, suits: Array<'spade' | 'heart' | 'club' | 'diamond'>): GameState {
  let state = revealGenerals(setGenerals(playableGame(registry, SEED, 4), registry, 'seat-0', ZHEN_JI, PARTNER), 'seat-0', ['main']);
  state = stepUntil(setTurn(state, 'seat-1', 'Play'), registry, (s) => askedAbout(s, GODDESS_LUO), 400);
  return stackDrawPile(state, suits);
}

// Xiao Qiao is face down with only spades in hand. Seat-1 hits her with a Sha she cannot answer, so Fantasy asks.
function fantasyAsk(registry: ContentRegistry): GameState {
  let state = revealGenerals(setGenerals(setTurn(playableGame(registry, SEED, 4), 'seat-1', 'Play'), registry, 'seat-0', XIAO_QIAO, PARTNER), 'seat-0', []);
  state = give(emptyHand(emptyHand(state, 'seat-0'), 'seat-1'), 'seat-1', ['sha']);
  state = giveOfSuit(state, 'seat-0', 'spade', 3);
  state = playCard(state, registry, 'seat-1', 'sha', ['seat-0']);
  return act(state, registry, { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: state.pendingResponse!.id });
}

export const SKILL_SCENARIOS: BoardScenario[] = [
  {
    kind: 'board',
    id: 'luo-first-ask',
    group: 'Choice Prompts',
    title: 'preview.luo-first-ask.title',
    description: 'preview.luo-first-ask.description',
    seatCount: 4,
    build: (registry) => goddessLuoAsk(registry, ['spade', 'club', 'heart']),
    reaches: (s) => askedAbout(s, GODDESS_LUO) && s.judgmentView === undefined,
  },
  {
    kind: 'board',
    id: 'luo-judge-again',
    group: 'Choice Prompts',
    title: 'preview.luo-judge-again.title',
    description: 'preview.luo-judge-again.description',
    seatCount: 4,
    build: (registry) => use(goddessLuoAsk(registry, ['spade', 'club', 'heart']), registry),
    reaches: (s) => askedAbout(s, GODDESS_LUO) && s.judgmentView?.continuing === true && (s.judgmentView.aside?.length ?? 0) === 1,
  },
  {
    kind: 'board',
    id: 'luo-chain-end',
    group: 'Choice Prompts',
    title: 'preview.luo-chain-end.title',
    description: 'preview.luo-chain-end.description',
    seatCount: 4,
    build: (registry) => use(use(use(goddessLuoAsk(registry, ['spade', 'club', 'heart']), registry), registry), registry),
    reaches: (s) => awaitsAcknowledgement(s.judgmentView) && s.judgmentView?.aside?.length === 2 && s.judgmentView.card.suit === 'heart',
  },
  {
    kind: 'board',
    id: 'fantasy-hidden-spade',
    group: 'Choice Prompts',
    title: 'preview.fantasy-hidden-spade.title',
    description: 'preview.fantasy-hidden-spade.description',
    seatCount: 4,
    build: fantasyAsk,
    reaches: (s) => askedAbout(s, 'fantasy') && s.seats.find((x) => x.id === 'seat-0')?.generals?.main.revealed === false,
  },
];

