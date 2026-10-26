import { advanceToDecision, resolve } from './resolve';
import { Effect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner, PendingSelection } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { getLegalActions } from '../rules/legality';
import { skillsInPlay } from '../skills/generalSkills';
import { redactStateForSeat } from '../domain/redact';

// Bolt: no target; played, its user draws 1.
const bolt: CardDefinition = { id: 'bolt', name: 'Bolt', category: 'basic', legalPlayTargets: () => [[]], play: (_s, ctx) => [{ kind: 'DrawCardsEffect', seatId: ctx.seatId, count: 1 }] };
const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', legalPlayTargets: () => [], play: () => [] };
// Forge: 2 hand cards as a Bolt, in the Play Phase or to answer.
const forge: SkillDefinition = { id: 'forge', conversions: [{ id: 'forge', as: 'bolt', cards: 2, when: 'both' }] };
const hint: SkillDefinition = { id: 'hint' };
const registry: ContentRegistry = {
  cards: new Map([[bolt.id, bolt], [filler.id, filler]]),
  generals: new Map([
    ['smith', { id: 'smith', kingdom: 'Wei', maxHp: 4, skills: [forge] }],
    ['seer', { id: 'seer', kingdom: 'Wei', maxHp: 4, skills: [hint] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit: 'club', rank: 5 });
const hintOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'deputy', skillId: 'hint' };
const forgeOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'forge' };

// Seat a (turn owner, Play Phase): Main 'smith', Deputy 'seer', both hidden; holds k1, k2.
function table(queue: Effect[] = [], revealed = false): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'smith', revealed }, deputy: { generalDefinitionId: 'seer', revealed } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const s: GameState = {
    seats: [seat('a', 0), { ...seat('b', 1), generals: null }], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('k1'), card('k2')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, ...(queue.length ? { resolutionQueue: queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
  return advanceToDecision(s, ctx).state;
}
const ask: Effect = { kind: 'AskUseEffect', owner: hintOwner, abilityId: 'hint', effects: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] };
const choose = (s: GameState, optionId: string) => resolve(s, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: s.pendingChoice!.id, optionId }, ctx).state;
const kinds = (s: GameState) => s.log.map((e) => e.kind);

describe('reveal to use: asks (Review Focus 1)', () => {
  it('a hidden General’s ask says it reveals; Use reveals the General first, naming the skill', () => {
    const s = table([ask]);
    expect(s.pendingChoice!.options[0].shows).toEqual({ kind: 'use', reveals: 'deputy' });
    const used = choose(s, 'use');
    expect(used.seats[0].generals!.deputy.revealed).toBe(true);
    expect(used.log.filter((e) => e.kind !== 'ChoiceMadeEvent')).toEqual([
      { kind: 'GeneralRevealedEvent', seatId: 'a', slot: 'deputy', forAbilityId: 'hint' },
      { kind: 'CardsDrawnEvent', seatId: 'a', cardInstanceIds: ['d1'] },
    ]);
  });

  it('Don’t leaves the General hidden and logs no reveal', () => {
    const declined = choose(table([ask]), 'decline');
    expect(declined.seats[0].generals!.deputy.revealed).toBe(false);
    expect(kinds(declined)).toEqual(['ChoiceMadeEvent']);
  });

  it('a revealed General’s ask needs no reveal', () => {
    expect(table([ask], true).pendingChoice!.options[0].shows).toEqual({ kind: 'use' });
  });

  it('a paused reveal ask survives a JSON round trip', () => {
    const s = table([ask]);
    expect(choose(JSON.parse(JSON.stringify(s)), 'use')).toEqual(choose(s, 'use'));
  });
});

describe('reveal to use: conversions', () => {
  const convert = (s: GameState) => {
    const action = getLegalActions(s, 'a', registry).find((a) => a.kind === 'UseConversionAction')!;
    return resolve(s, action, ctx).state;
  };

  it('a hidden General’s conversion is offered, and reveals only when its cards are confirmed', () => {
    const opened = convert(table());
    expect(opened.seats[0].generals!.main.revealed).toBe(false);
    expect(opened.pendingSelection!.onSelect).toEqual([{ kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main', forAbilityId: 'forge' }]);
    const used = resolve(opened, { kind: 'SelectAction', seatId: 'a', selectionId: opened.pendingSelection!.id, ids: ['k1', 'k2'] }, ctx).state;
    expect(used.seats[0].generals!.main.revealed).toBe(true);
    expect(kinds(used)).toEqual(['SelectionMadeEvent', 'GeneralRevealedEvent', 'CardPlayedEvent', 'CardMovedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
    expect(used.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'bolt', via: { owner: forgeOwner, abilityId: 'forge' } } });
  });

  it('Cancel leaves the General hidden', () => {
    const opened = convert(table());
    const cancelled = resolve(opened, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: opened.pendingSelection!.id }, ctx).state;
    expect(cancelled.seats[0].generals!.main.revealed).toBe(false);
    expect(cancelled.log).toEqual([]);
  });
});

describe('onSelect', () => {
  it('runs when the picks are confirmed, before the continuation', () => {
    const selection: PendingSelection = {
      id: 'sel', seatId: 'a', reason: { kind: 'ability', owner: hintOwner, abilityId: 'hint' }, of: 'cards', eligibleIds: ['k1'], min: 1, max: 1,
      then: { kind: 'discard' }, onSelect: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }],
    };
    const s = table([{ kind: 'OpenSelectionEffect', selection }]);
    const next = resolve(s, { kind: 'SelectAction', seatId: 'a', selectionId: 'sel', ids: ['k1'] }, ctx).state;
    expect(kinds(next)).toEqual(['SelectionMadeEvent', 'CardsDrawnEvent', 'CardMovedEvent']);
  });
});

describe('hiding a General', () => {
  // Smith with a compulsory skill too, to see it go off once hidden.
  const iron: SkillDefinition = { id: 'iron', compulsory: true, modifiers: { shaLimit: 2 } };
  const withIron: ContentRegistry = { ...registry, generals: new Map([...registry.generals, ['smith', { id: 'smith', kingdom: 'Wei', maxHp: 4, skills: [forge, iron] }]]) };
  const hide = (slot: 'main' | 'deputy', revealed = true): GameState => table([{ kind: 'HideGeneralEffect', seatId: 'a', slot }], revealed);

  it('hides that General only, and logs it', () => {
    const s = hide('main');
    expect(s.seats[0].generals!.main.revealed).toBe(false);
    expect(s.seats[0].generals!.deputy.revealed).toBe(true);
    expect(s.log).toEqual([{ kind: 'GeneralHiddenEvent', seatId: 'a', slot: 'main' }]);
  });

  it('its skills need a reveal again, and its compulsory skills go off', () => {
    const s = hide('main');
    expect(skillsInPlay(s, 'a', withIron).map((x) => [x.owner.skillId, x.needsReveal])).toEqual([
      ['forge', true],
      ['hint', false],
    ]);
  });

  it('hiding a hidden General changes nothing and logs nothing', () => {
    const s = hide('main', false);
    expect(s.seats[0].generals!.main.revealed).toBe(false);
    expect(s.log).toEqual([]);
  });

  it('another seat’s view shows the General as hidden again', () => {
    const view = redactStateForSeat(hide('main'), 'b');
    expect(view.seats[0].generals!.main.generalDefinitionId).toBe('hidden');
    expect(view.seats[0].generals!.deputy.generalDefinitionId).toBe('seer');
    expect(view.seats[0].kingdom).toBe('Wei');
  });

  it('a hidden General can be revealed again', () => {
    const again = table([{ kind: 'HideGeneralEffect', seatId: 'a', slot: 'main' }, { kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main' }], true);
    expect(again.seats[0].generals!.main.revealed).toBe(true);
    expect(kinds(again)).toEqual(['GeneralHiddenEvent', 'GeneralRevealedEvent']);
  });
});

describe('reveals blocked during another seat’s turn', () => {
  const femme: SkillDefinition = { id: 'femme', blocksOtherReveals: true };
  const blocking: ContentRegistry = { ...registry, generals: new Map([...registry.generals, ['siren', { id: 'siren', kingdom: 'Qun', maxHp: 3, skills: [femme] }]]) };
  const bctx = { registry: blocking, mode };
  // Seat b holds Siren (revealed unless said) and it is b's turn; seat a's Generals are hidden.
  const blocked = (sirenRevealed = true, extra: Partial<GameState> = {}): GameState => {
    const s = table();
    return {
      ...s,
      seats: s.seats.map((x) => (x.id === 'b' ? { ...x, generals: { main: { generalDefinitionId: 'siren', revealed: sirenRevealed }, deputy: { generalDefinitionId: 'seer', revealed: false } } } : x)),
      turn: { ...s.turn, ownerSeatId: 'b' },
      ...extra,
    };
  };
  const answering: Partial<GameState> = {
    pendingResponse: { id: 'w', respondingSeatId: 'a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['bolt'], context: { effect: { kind: 'DrawCardsEffect', seatId: 'b', count: 1 } } },
  };

  it('a hidden General’s conversion is not offered to answer', () => {
    const offered = (s: GameState) => getLegalActions(s, 'a', blocking).filter((a) => a.kind === 'UseConversionAction');
    expect(offered(blocked(false, answering))).toHaveLength(1);
    expect(offered(blocked(true, answering))).toEqual([]);
  });

  it('an ask that would reveal is skipped: what happens otherwise goes ahead', () => {
    const skipped: Effect = { ...ask, otherwise: [{ kind: 'DrawCardsEffect', seatId: 'b', count: 1 }] };
    const s = advanceToDecision(blocked(true, { resolutionQueue: [skipped] }), bctx).state;
    expect(s.pendingChoice).toBeFalsy();
    expect(s.seats[0].generals!.deputy.revealed).toBe(false);
    expect(kinds(s)).toEqual(['CardsDrawnEvent']);
    expect(s.log[0]).toMatchObject({ seatId: 'b' });
  });

  it('a Start-window reveal by the blocked seat throws', () => {
    const s = blocked(true, { phase: 'Start', turn: { turnNumber: 1, ownerSeatId: 'b', extraTurnStack: [], startWindow: true } });
    expect(() => resolve(s, { kind: 'ConfirmRevealsAction', seatId: 'a', slots: ['main'] }, bctx)).toThrow();
  });
});

describe('allegiance is decided by the mode at a seat’s first reveal', () => {
  // The stub mode puts the first seat to show a General in 'kingdom' and any later one in 'ambitionist'.
  const decidingMode: GameModeDefinition = {
    ...mode,
    decideAllegiance: (state) => (state.seats.some((s) => s.allegiance === 'kingdom') ? 'ambitionist' : 'kingdom'),
  };
  const run = (queue: Effect[]) => advanceToDecision({ ...table([], false), resolutionQueue: queue }, { registry, mode: decidingMode }).state;
  const both = (s: GameState) => s.seats.map((x) => x.allegiance);

  it('a reveal decides the seat in the same step; other seats stay undecided', () => {
    const s = run([{ kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main' }]);
    expect(both(s)).toEqual(['kingdom', undefined]);
  });

  it('each decision sees the earlier ones, even with other work queued between the reveals', () => {
    const start = table([], false);
    const withB = { ...start, seats: start.seats.map((x) => (x.id === 'b' ? { ...x, generals: start.seats[0].generals } : x)) };
    const s = advanceToDecision({ ...withB, resolutionQueue: [
      { kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main' },
      { kind: 'DrawCardsEffect', seatId: 'a', count: 1 },
      { kind: 'RevealGeneralEffect', seatId: 'b', slot: 'main' },
    ] }, { registry, mode: decidingMode }).state;
    expect(both(s)).toEqual(['kingdom', 'ambitionist']);
  });

  it('a second reveal of the same seat does not change it', () => {
    const s = run([{ kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main' }, { kind: 'RevealGeneralEffect', seatId: 'a', slot: 'deputy' }]);
    expect(both(s)).toEqual(['kingdom', undefined]);
  });

  it('a mode without the hook leaves every seat undecided', () => {
    const s = advanceToDecision({ ...table([], false), resolutionQueue: [{ kind: 'RevealGeneralEffect', seatId: 'a', slot: 'main' }] }, ctx).state;
    expect(both(s)).toEqual([undefined, undefined]);
  });
});
