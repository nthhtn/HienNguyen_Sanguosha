import { buildContentRegistry } from 'content';
import { actionLabel, cardDefinitionId, judgmentReaderName, cardIdDisplayName, generalDisplayName, kingdomDisplayName, seatName, suitLabel, targetLabel } from './labels';
import { Action, ContentRegistry, GameState, Target } from 'engine';

function stateWithZones(): GameState {
  return {
    seats: [],
    players: [],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] },
    phase: 'Play',
    zones: [
      {
        id: 'hand-0',
        kind: 'hand',
        ownerSeatId: 'seat-0',
        cards: [{ instanceId: 'card-1', definitionId: 'sha', suit: 'spade', rank: 7 }],
      },
    ],
    pendingResponse: null,
    log: [],
    rng: { seed: 1, counter: 0 },
    result: null, generalSelection: null,
  };
}

function registryWithSha(): ContentRegistry {
  return {
    cards: new Map([['sha', { id: 'sha', name: 'Slash', category: 'basic', play: () => [] }]]),
    generals: new Map(),
  };
}

describe('generalDisplayName', () => {
  it('title-cases a kebab-case id', () => {
    expect(generalDisplayName('xiahou-dun')).toBe('Xiahou Dun');
  });

  it('renders the hidden sentinel in Title Case', () => {
    expect(generalDisplayName('hidden')).toBe('Hidden General');
  });
});

describe('cardIdDisplayName', () => {
  it('title-cases a kebab-case id', () => {
    expect(cardIdDisplayName('green-dragon-blade')).toBe('Green Dragon Blade');
  });

  it('renders the hidden sentinel in Title Case', () => {
    expect(cardIdDisplayName('hidden')).toBe('Hidden Card');
  });
});

describe('cardDefinitionId', () => {
  it("returns a card instance's definitionId when it exists in a zone", () => {
    expect(cardDefinitionId(stateWithZones(), 'card-1')).toBe('sha');
  });

  it('returns undefined when no zone contains the instance', () => {
    expect(cardDefinitionId(stateWithZones(), 'missing')).toBeUndefined();
  });
});

describe('kingdomDisplayName', () => {
  it('passes through a real kingdom unchanged', () => {
    expect(kingdomDisplayName('Wei')).toBe('Wei');
  });

  it('renders the hidden sentinel in Title Case', () => {
    expect(kingdomDisplayName('hidden')).toBe('Hidden');
  });
});

describe('actionLabel', () => {
  it('labels an active skill by its name', () => {
    const use: Action = { kind: 'UseSkillAction', seatId: 'seat-0', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'reconsider' } };
    expect(actionLabel(use, stateWithZones(), registryWithSha())).toBe('Use Reconsider');
  });

  it('labels a conversion by what it makes, and its targets for a play', () => {
    const base = stateWithZones();
    const state: GameState = {
      ...base,
      zones: [...base.zones, { id: 'equip-0', kind: 'equip', ownerSeatId: 'seat-0', cards: [{ instanceId: 'spear', definitionId: 'serpent-spear', suit: 'spade', rank: 12 }] }],
    };
    const registry = registryWithSha();
    registry.cards.set('serpent-spear', {
      id: 'serpent-spear', name: 'Serpent Spear', category: 'equipment', equipSlot: 'weapon', play: () => [],
      abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' }] },
    });
    const use = (targets: Target[]): Action => ({
      kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'spear' }, conversionId: 'serpent-spear' }, targets,
    });
    expect(actionLabel(use([]), state, registry)).toBe('Use 2 Cards as Slash');
    expect(actionLabel(use([{ kind: 'seat', seatId: 'seat-1' }]), state, registry)).toBe('Use 2 Cards as Slash Targeting Seat 1');
  });

  it('labels a skill conversion as what it makes and the skill', () => {
    const registry = buildContentRegistry();
    const base = stateWithZones();
    const state: GameState = {
      ...base,
      seats: [{
        id: 'seat-0', index: 0, kingdom: 'Shu', eliminated: false, combinedHp: 4, maxCombinedHp: 4,
        generals: { main: { generalDefinitionId: 'guan-yu', revealed: true }, deputy: { generalDefinitionId: 'wei-yan', revealed: true } },
        hand: { zoneId: 'hand-0' }, equipped: { zoneId: 'equip-0' }, judgment: { zoneId: 'judgment-0' },
      }],
    };
    const use = (targets: Target[]): Action => ({
      kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'fighting-saint' }, conversionId: 'fighting-saint' }, targets,
    });
    expect(actionLabel(use([]), state, registry)).toBe('As Slash · Fighting Saint');
    expect(actionLabel(use([{ kind: 'seat', seatId: 'seat-1' }]), state, registry)).toBe('As Slash · Fighting Saint Targeting Seat 1');
  });

  it('labels DrawCardsAction with the count', () => {
    const action: Action = { kind: 'DrawCardsAction', seatId: 'seat-0', count: 2 };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Draw 2 Cards');
  });

  it('labels a targetless PlayCardAction with the card name', () => {
    const action: Action = {
      kind: 'PlayCardAction',
      seatId: 'seat-0',
      cardInstanceId: 'card-1',
      targets: [],
    };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Play Slash');
  });

  it('labels a targeted PlayCardAction with the target', () => {
    const action: Action = {
      kind: 'PlayCardAction',
      seatId: 'seat-0',
      cardInstanceId: 'card-1',
      targets: [{ kind: 'seat', seatId: 'seat-1' }],
    };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Play Slash Targeting Seat 1');
  });

  it('labels ChooseGeneralsAction with both generals and their roles', () => {
    const action: Action = { kind: 'ChooseGeneralsAction', seatId: 'seat-0', mainId: 'cao-cao', deputyId: 'xu-chu' };
    expect(actionLabel(action, stateWithZones(), registryWithSha())).toBe('Choose Cao Cao (Main) and Xu Chu (Deputy)');
  });

  it('labels PassAction and EndPhaseAction', () => {
    expect(
      actionLabel({ kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' }, stateWithZones(), registryWithSha())
    ).toBe('Pass');
    expect(actionLabel({ kind: 'EndPhaseAction', seatId: 'seat-0' }, stateWithZones(), registryWithSha())).toBe(
      'End Phase'
    );
  });

  it('labels EndPhaseAction Continue in the Start window', () => {
    const state = { ...stateWithZones(), phase: 'Start' as const, turn: { ...stateWithZones().turn, startWindow: true } };
    expect(actionLabel({ kind: 'EndPhaseAction', seatId: 'seat-0' }, state, registryWithSha())).toBe('Continue');
  });

  it('labels DiscardCardAction with the card name', () => {
    expect(
      actionLabel({ kind: 'DiscardCardAction', seatId: 'seat-0', cardInstanceId: 'card-1' }, stateWithZones(), registryWithSha())
    ).toBe('Discard Slash');
  });
});


describe('seatName', () => {
  const players = [{ id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' }];

  it('shows the player’s name', () => {
    expect(seatName(players, 'seat-0')).toBe('Hing');
  });

  it('falls back to the seat id in Title Case, without the dash', () => {
    expect(seatName(players, 'seat-3')).toBe('Seat 3');
  });

  it('names a general target after its seat', () => {
    expect(targetLabel({ kind: 'general', seatId: 'seat-0', generalSlot: 'deputy' }, players)).toBe("Hing's Deputy General");
  });
});

describe('suitLabel', () => {
  it('names a suit with its symbol', () => {
    expect([suitLabel('spade'), suitLabel('heart'), suitLabel('club'), suitLabel('diamond')]).toEqual(['♠ Spade', '♥ Heart', '♣ Club', '♦ Diamond']);
  });
});

describe('judgmentReaderName', () => {
  it('names the card or the skill a judgment is for', () => {
    expect(judgmentReaderName({ kind: 'card', card: { as: 'eight-trigrams', colour: 'none', physical: [] } })).toBe('Eight Trigrams');
    expect(judgmentReaderName({ kind: 'skill', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'unyielding' } })).toBe('Unyielding');
  });
});
