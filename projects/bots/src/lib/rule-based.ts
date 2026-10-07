import type { Action, ContentRegistry, GameState, Seat } from 'engine';
import { BotDecision, BotPolicy, BotTurnMemory, MAX_BOT_ACTIONS_PER_TURN } from './policy';

type ChooseGenerals = Extract<Action, { kind: 'ChooseGeneralsAction' }>;
type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;
type DiscardCard = Extract<Action, { kind: 'DiscardCardAction' }>;
type ChooseOption = Extract<Action, { kind: 'ChooseOptionAction' }>;
type Select = Extract<Action, { kind: 'SelectAction' }>;
type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;
type Arrange = Extract<Action, { kind: 'ArrangeCardsAction' }>;

function definitionIdOf(view: GameState, cardInstanceId: string): string | undefined {
  for (const zone of view.zones) {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (found) return found.definitionId;
  }
  return undefined;
}

// An ally shares the bot's own (known) kingdom and has revealed it. Qun is
// allied with no one; a hidden kingdom could be anyone, so it is not an ally.
function isAlly(self: Seat, other: Seat): boolean {
  return self.kingdom !== 'Qun' && self.kingdom !== 'hidden' && other.kingdom === self.kingdom;
}

// Tools worth cancelling when they are aimed at this bot.
const HARMFUL_TOOLS = new Set(['barbarians', 'hail-of-arrows', 'duel', 'steal', 'break', 'capture', 'lightning', 'starvation']);

// Plays of `definitionId` aimed at a living non-ally, weakest target first.
function targetedPlays(view: GameState, self: Seat, plays: PlayCard[], definitionId: string): PlayCard[] {
  return plays
    .filter((p) => p.targets.length === 1 && p.targets[0].kind === 'seat' && definitionIdOf(view, p.cardInstanceId) === definitionId)
    .map((p) => ({ play: p, target: view.seats.find((s) => p.targets[0].kind === 'seat' && s.id === p.targets[0].seatId) }))
    .filter((t): t is { play: PlayCard; target: Seat } => !!t.target && !t.target.eliminated && !isAlly(self, t.target))
    .sort((a, b) => a.target.combinedHp - b.target.combinedHp || a.target.index - b.target.index)
    .map((t) => t.play);
}

// Higher = keep longer. Peach saves a life, Shan blocks a Sha, Sha attacks.
function keepRank(view: GameState, registry: ContentRegistry, cardInstanceId: string): number {
  const definitionId = definitionIdOf(view, cardInstanceId);
  if (definitionId === 'peach') return 4;
  if (definitionId === 'shan') return 3;
  if (definitionId === 'sha' || definitionId === 'wine' || definitionId === 'draw-two') return 2;
  if (definitionId && registry.cards.get(definitionId)?.category === 'equipment') return 1;
  return 0;
}

// Instance ids, least useful first (then lowest rank).
function leastUseful(view: GameState, registry: ContentRegistry, ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => keepRank(view, registry, a) - keepRank(view, registry, b));
}

// Whether to use an optional ability (the Sha-Equipment spec's bot rules).
function wantsToUse(view: GameState, self: Seat, abilityId: string, targetSeatId: string | undefined): boolean {
  const target = view.seats.find((s) => s.id === targetSeatId);
  const hostile = !!target && !isAlly(self, target);
  switch (abilityId) {
    case 'eight-trigrams':
    case 'longbow':
    case 'gender-swords':
    case 'sky-scorcher':
    case 'green-dragon-blade':
      return true;
    case 'axe':
      return hostile;
    case 'ice-sword': {
      const wears = !!target && (view.zones.find((z) => z.id === target.equipped.zoneId)?.cards.length ?? 0) > 0;
      return hostile && !!target && target.combinedHp > 1 && wears;
    }
    default:
      return false;
  }
}

// Whether the bot will reveal a hidden General to use a skill: once its
// kingdom is known anyway (a General already revealed), or while it holds at
// least 4 HP.
function mayReveal(self: Seat): boolean {
  return !!self.generals && (self.generals.main.revealed || self.generals.deputy.revealed || self.combinedHp >= 4);
}

// Cards worth drawing soon: kept on top when arranging the draw pile.
const KEEP_ON_TOP = new Set(['peach', 'shan', 'sha']);

// Abilities whose card selections the bot fills rather than cancels.
const SELECTS_FOR = new Set(['axe', 'green-dragon-blade', 'serpent-spear']);

// Serpent Spear is worth it when the 2 least useful hand cards hold no Peach.
function spareForConversion(view: GameState, self: Seat, registry: ContentRegistry): boolean {
  const hand = (view.zones.find((z) => z.id === self.hand.zoneId)?.cards ?? []).map((c) => c.instanceId);
  return hand.length >= 2 && !leastUseful(view, registry, hand).slice(0, 2).some((id) => definitionIdOf(view, id) === 'peach');
}

function decide(
  view: GameState,
  seatId: string,
  legal: Action[],
  registry: ContentRegistry,
  memory: BotTurnMemory | null
): BotDecision {
  if (legal.length === 0) throw new Error(`Bot ${seatId} has no legal action`);
  const mem: BotTurnMemory =
    memory && memory.turnNumber === view.turn.turnNumber
      ? memory
      : { turnNumber: view.turn.turnNumber, shaPlayed: 0, actionsThisTurn: 0 };
  const take = (action: Action, shaPlayed = 0): BotDecision => ({
    action,
    memory: { ...mem, shaPlayed: mem.shaPlayed + shaPlayed, actionsThisTurn: mem.actionsThisTurn + 1 },
  });
  const me = view.seats.find((s) => s.id === seatId);

  // 1. General selection: highest combined max HP, first on ties.
  if (view.phase === 'GeneralSelection') {
    const choices = legal.filter((a): a is ChooseGenerals => a.kind === 'ChooseGeneralsAction');
    const hp = (a: ChooseGenerals) =>
      (registry.generals.get(a.mainId)?.maxHp ?? 0) + (registry.generals.get(a.deputyId)?.maxHp ?? 0);
    if (choices.length > 0) return take(choices.reduce((best, a) => (hp(a) > hp(best) ? a : best)));
  }

  // 1a0. An arrangement: Peach, Shan and Sha on top, the rest at the bottom.
  const arrangeTemplate = legal.find((a): a is Arrange => a.kind === 'ArrangeCardsAction');
  if (arrangeTemplate && view.pendingArrangement) {
    const ids = view.pendingArrangement.cardInstanceIds;
    const onTop = (id: string) => KEEP_ON_TOP.has(definitionIdOf(view, id) ?? '');
    return take({ ...arrangeTemplate, top: ids.filter(onTop), bottom: ids.filter((id) => !onTop(id)) });
  }

  // 1a. A selection. Sky Scorcher's seats: non-allies only, else cancel. Cards
  // for Axe, Green Dragon Blade, Serpent Spear: the least useful. Anything
  // else: cancel when allowed.
  const selectTemplate = legal.find((a): a is Select => a.kind === 'SelectAction');
  if (selectTemplate && view.pendingSelection && me) {
    const selection = view.pendingSelection;
    const cancel = legal.find((a) => a.kind === 'CancelSelectionAction');
    if (selection.of === 'seats') {
      const ids = selection.eligibleIds
        .filter((id) => {
          const other = view.seats.find((s) => s.id === id);
          return !!other && !isAlly(me, other);
        })
        .slice(0, selection.max);
      if (ids.length >= selection.min) return take({ ...selectTemplate, ids });
      if (cancel) return take(cancel);
    }
    const known = selection.reason.kind === 'ability' && SELECTS_FOR.has(selection.reason.abilityId);
    if (cancel && !known) return take(cancel);
    return take({ ...selectTemplate, ids: leastUseful(view, registry, selection.eligibleIds).slice(0, selection.min) });
  }

  // 1a'. An ability's ask; Gender Swords' choice for its target.
  const choiceNow = view.pendingChoice;
  const choiceActions = legal.filter((a): a is ChooseOption => a.kind === 'ChooseOptionAction');
  if (choiceNow && me && choiceActions.length > 0) {
    if (choiceNow.reason.kind === 'ability') {
      const use = choiceNow.options.find((o) => o.id === 'use')?.shows;
      const reveals = use?.kind === 'use' && !!use.reveals;
      const wants = wantsToUse(view, me, choiceNow.reason.abilityId, choiceNow.reason.targetSeatId) && (!reveals || mayReveal(me));
      const pick = choiceActions.find((a) => a.optionId === (wants ? 'use' : 'decline'));
      if (pick) return take(pick);
    }
    const decline = choiceActions.find((a) => a.optionId === 'decline');
    if (decline && choiceNow.reason.kind === 'choice' && choiceNow.reason.targetSeatId === seatId) {
      const handSize = view.zones.find((z) => z.id === me.hand.zoneId)?.cards.length ?? 0;
      const discards = choiceActions.filter((a) => a !== decline);
      if (handSize <= 2 || discards.length === 0) return take(decline);
      return take(discards.reduce((best, a) => (keepRank(view, registry, a.optionId) < keepRank(view, registry, best.optionId) ? a : best)));
    }
  }

  // 1b. A pick (Steal, Break, Harvest): a weapon, then armour, then a mount,
  // then the hand; among Harvest's face-up cards, the one worth keeping most.
  const picks = legal.filter((a): a is ChooseOption => a.kind === 'ChooseOptionAction');
  if (picks.length > 0 && view.pendingChoice) {
    const options = view.pendingChoice.options;
    const worth = (p: ChooseOption): number => {
      const shows = options.find((o) => o.id === p.optionId)?.shows;
      if (!shows) return -1;
      if (shows.kind === 'hidden-hand') return 1;
      if (shows.kind !== 'card') return 0;
      const zone = view.zones.find((z) => z.cards.some((c) => c.instanceId === shows.card.instanceId));
      if (zone?.kind === 'processing') return keepRank(view, registry, shows.card.instanceId);
      const slot = registry.cards.get(shows.card.definitionId)?.equipSlot;
      return slot === 'weapon' ? 4 : slot === 'armor' ? 3 : slot ? 2 : 0;
    };
    return take(picks.reduce((best, p) => (worth(p) > worth(best) ? p : best)));
  }

  // 2. Responding. A dying round: spend a Peach only on ourselves or a
  // revealed ally. A Wuxie check: cancel only a harmful Tool aimed at us, and
  // never counter a Wuxie. Any other window: every answer cancels damage to us.
  if (view.pendingResponse?.respondingSeatId === seatId) {
    const reason = view.pendingResponse.reason;
    const self = view.seats.find((s) => s.id === seatId);
    const dying = reason?.kind === 'dying' ? view.seats.find((s) => s.id === reason.seatId) : undefined;
    const worthAnswering =
      !reason || reason.kind === 'card-effect'
        ? true
        : reason.kind === 'dying'
          ? !!self && !!dying && (dying.id === seatId || isAlly(self, dying))
          : reason.kind === 'wuxie'
            ? reason.target.kind === 'seat' && reason.target.seatId === seatId && HARMFUL_TOOLS.has(reason.tool.as)
            : false; // never counter a Wuxie Kongjie
    const answers = legal.filter((a): a is Extract<Action, { kind: 'RespondAction' }> => a.kind === 'RespondAction');
    // A Peach before anything else (a dying bot drinks Wine only without one).
    const best = answers.find((a) => definitionIdOf(view, a.cardInstanceId) === 'peach') ?? answers[0];
    // Serpent Spear: only with no real answer, and no Peach among the 2 cards it would take.
    const converted = legal.find((a): a is UseConversion => a.kind === 'UseConversionAction');
    const chosen = best ?? (converted && self && spareForConversion(view, self, registry) ? converted : undefined);
    const answer = (worthAnswering ? chosen : undefined) ?? legal.find((a) => a.kind === 'PassAction');
    if (answer) return take(answer);
  }

  // 3. Discard phase: lose the least useful card first, first in hand on ties.
  const discards = legal.filter((a): a is DiscardCard => a.kind === 'DiscardCardAction');
  if (discards.length > 0) {
    return take(
      discards.reduce((best, a) =>
        keepRank(view, registry, a.cardInstanceId) < keepRank(view, registry, best.cardInstanceId) ? a : best
      )
    );
  }

  const endPhase = legal.find((a) => a.kind === 'EndPhaseAction');
  // 4. Safety cap.
  if (endPhase && mem.actionsThisTurn >= MAX_BOT_ACTIONS_PER_TURN) return take(endPhase);

  // 5. Play phase.
  const self = view.seats.find((s) => s.id === seatId);
  if (view.phase === 'Play' && self) {
    const plays = legal.filter((a): a is PlayCard => a.kind === 'PlayCardAction');
    const untargeted = (p: PlayCard) => p.targets.length === 0;
    const equippedSlots = new Set(
      (view.zones.find((z) => z.id === self.equipped.zoneId)?.cards ?? []).map(
        (c) => registry.cards.get(c.definitionId)?.equipSlot
      )
    );

    const peach = plays.find((p) => untargeted(p) && definitionIdOf(view, p.cardInstanceId) === 'peach');
    if (peach && self.combinedHp < self.maxCombinedHp) return take(peach);

    // Equip only into an empty slot; never swap one weapon for another.
    const equipment = plays.find((p) => {
      const definitionId = definitionIdOf(view, p.cardInstanceId);
      const slot = definitionId ? registry.cards.get(definitionId)?.equipSlot : undefined;
      return untargeted(p) && !!slot && !equippedSlots.has(slot);
    });
    if (equipment) return take(equipment);

    const untargetedOf = (definitionId: string) => plays.find((p) => untargeted(p) && definitionIdOf(view, p.cardInstanceId) === definitionId);

    const drawTwo = untargetedOf('draw-two');
    if (drawTwo) return take(drawTwo);

    const peachGarden = untargetedOf('peach-garden');
    if (peachGarden && self.combinedHp < self.maxCombinedHp) return take(peachGarden);

    // Barbarians and Hail of Arrows hit everyone else: only worth it when
    // non-allies are at least as many as allies.
    const others = view.seats.filter((s) => s.id !== seatId && !s.eliminated);
    const allies = others.filter((s) => isAlly(self, s)).length;
    if (others.length - allies >= allies) {
      const massAttack = untargetedOf('barbarians') ?? untargetedOf('hail-of-arrows');
      if (massAttack) return take(massAttack);
    }

    // Steal and Break: the lowest-HP non-ally, preferring one that wears equipment.
    const wearsEquipment = (p: PlayCard) => {
      const target = view.seats.find((s) => s.id === p.targets[0]?.seatId);
      return !!target && (view.zones.find((z) => z.id === target.equipped.zoneId)?.cards.length ?? 0) > 0;
    };
    const [grab] = [...targetedPlays(view, self, plays, 'steal'), ...targetedPlays(view, self, plays, 'break')].sort(
      (a, b) => Number(wearsEquipment(b)) - Number(wearsEquipment(a))
    );
    if (grab) return take(grab);

    // Delayed Tools. Capture: the highest-HP non-ally. Starvation: the
    // non-ally in reach with the most hand cards. Lightning: at 3 HP or more.
    const targetOf = (p: PlayCard) => view.seats.find((s) => s.id === p.targets[0]?.seatId);
    const handSize = (p: PlayCard) => {
      const target = targetOf(p);
      return target ? (view.zones.find((z) => z.id === target.hand.zoneId)?.cards.length ?? 0) : 0;
    };
    const best = (candidates: PlayCard[], score: (p: PlayCard) => number) =>
      candidates.reduce<PlayCard | undefined>((top, p) => (!top || score(p) > score(top) ? p : top), undefined);
    const capture = best(targetedPlays(view, self, plays, 'capture'), (p) => targetOf(p)?.combinedHp ?? 0);
    if (capture) return take(capture);
    const starvation = best(targetedPlays(view, self, plays, 'starvation'), handSize);
    if (starvation) return take(starvation);
    const lightning = untargetedOf('lightning');
    if (lightning && self.combinedHp >= 3) return take(lightning);

    // Wine first when a Sha at a non-ally is legal: the Sha follows next.
    const shaPlays = targetedPlays(view, self, plays, 'sha');
    const wine = untargetedOf('wine');
    if (wine && shaPlays.length > 0) return take(wine);
    // Whenever the engine offers a Sha (Crossbow lifts the limit); the safety cap still ends the turn.
    const [sha] = shaPlays;
    if (sha) return take(sha, 1);
    // Serpent Spear: with no real Sha, 2 cards as one at the weakest non-ally.
    const [conversion] = legal
      .filter((a): a is UseConversion => a.kind === 'UseConversionAction' && a.targets.length === 1)
      .map((a) => ({ a, target: view.seats.find((s) => s.id === a.targets[0].seatId) }))
      .filter((t): t is { a: UseConversion; target: Seat } => !!t.target && !t.target.eliminated && !isAlly(self, t.target))
      .sort((x, y) => x.target.combinedHp - y.target.combinedHp || x.target.index - y.target.index)
      .map((t) => t.a);
    if (conversion && spareForConversion(view, self, registry)) return take(conversion, 1);
    const [duel] = targetedPlays(view, self, plays, 'duel');
    if (duel) return take(duel);
    // Coerce: when one non-ally's weapon can reach another non-ally.
    const coerce = plays.find((p) => {
      if (p.targets.length !== 2 || definitionIdOf(view, p.cardInstanceId) !== 'coerce') return false;
      const [holder, victim] = p.targets.map((t) => view.seats.find((s) => s.id === t.seatId));
      return !!holder && !!victim && victim.id !== seatId && !isAlly(self, holder) && !isAlly(self, victim);
    });
    if (coerce) return take(coerce);
    if (endPhase) return take(endPhase);
  }

  // 6. Fallback: never stall.
  return take(endPhase ?? legal.find((a) => a.kind === 'PassAction') ?? legal[0]);
}

// Simple, explainable opponent; see the bot-opponents design spec for its rules.
export const ruleBasedPolicy: BotPolicy = { id: 'rule-based', decide };
