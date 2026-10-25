import type { Action, ContentRegistry, GameState, Seat } from 'engine';
import { conversionsOf, findSkill, sameAbilityOwner } from 'engine';
import { baseSkillId } from 'content';
import { BotDecision, BotPolicy, BotTurnMemory, MAX_BOT_ACTIONS_PER_TURN } from './policy';
import { definitionIdOf, isShaCard, fillPick, fillSelection, isAlly, keepRank, leastUseful, TargetRanker, weakestFirst } from './helpers';
import { CardPlayRules, NO_CARD_PLAY_RULES, discardRank, isEquipUpgrade, peachWorthPlaying, wineWorthPlaying } from './card-play';
import { fireSelection } from './fire';
import { bestPair, GENERAL_VALUES } from './general-values';
import { NO_RESPONSE_RULES, ResponseRules, shouldHoldShan, wuxieWorthCancelling } from './responses';
import { upheavalVictimIsFoe } from './forest';
import { CONVERSION_SKILLS, conversionSpare, pickActiveSkill, skillChoice, skillSelection, wantsSkill } from './skills';

type ChooseGenerals = Extract<Action, { kind: 'ChooseGeneralsAction' }>;
type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;
type DiscardCard = Extract<Action, { kind: 'DiscardCardAction' }>;
type ChooseOption = Extract<Action, { kind: 'ChooseOptionAction' }>;
type Select = Extract<Action, { kind: 'SelectAction' }>;
type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;
type Arrange = Extract<Action, { kind: 'ArrangeCardsAction' }>;



// Plays of `definitionId` aimed at a living non-ally, best target first.
function targetedPlays(view: GameState, self: Seat, plays: PlayCard[], definitionId: string, rank: TargetRanker, registry: ContentRegistry): PlayCard[] {
  const matches = (id: string | undefined) => (definitionId === 'sha' ? isShaCard(registry, id) : id === definitionId);
  return plays
    .filter((p) => p.targets.length >= 1 && p.targets[0].kind === 'seat' && matches(definitionIdOf(view, p.cardInstanceId)))
    .map((p) => ({ play: p, target: view.seats.find((s) => p.targets[0].kind === 'seat' && s.id === p.targets[0].seatId) }))
    .filter((t): t is { play: PlayCard; target: Seat } => !!t.target && !t.target.eliminated && !isAlly(self, t.target))
    .sort((a, b) => rank(view, self, b.target) - rank(view, self, a.target) || a.target.index - b.target.index)
    .map((t) => t.play);
}



// Whether to use an optional ability (the Sha-Equipment spec's bot rules).
function wantsToUse(view: GameState, self: Seat, abilityId: string, targetSeatId: string | undefined): boolean {
  const target = view.seats.find((s) => s.id === targetSeatId);
  const hostile = !!target && !isAlly(self, target);
  switch (abilityId) {
    case 'eight-trigrams':
    case 'longbow':
    case 'gender-swords':
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


// Cards worth drawing soon: kept on top when arranging the draw pile.
const KEEP_ON_TOP = new Set(['peach', 'shan']);

// Abilities whose card selections the bot fills rather than cancels.
const SELECTS_FOR = new Set(['axe', 'green-dragon-blade', 'serpent-spear', ...CONVERSION_SKILLS]);

// What a conversion action makes, read from the seat's conversions.
const conversionAs = (a: UseConversion, view: GameState, registry: ContentRegistry) =>
  conversionsOf(view, a.seatId, registry).find((o) => o.conversion.id === a.via.conversionId && sameAbilityOwner(o.owner, a.via.owner))?.conversion.as;

function decide(
  rank: TargetRanker,
  rules: CardPlayRules,
  responseRules: ResponseRules,
  generalValues: Readonly<Record<string, number>> | undefined,
  view: GameState,
  seatId: string,
  offered: Action[],
  registry: ContentRegistry,
  memory: BotTurnMemory | null
): BotDecision {
  if (offered.length === 0) throw new Error(`Bot ${seatId} has no legal action`);
  // Target templates filled in (several targets in one pick), or dropped when no non-ally fits.
  const mine = view.seats.find((s) => s.id === seatId);
  const legal = offered.flatMap((a): Action[] => {
    if ((a.kind !== 'PlayCardAction' && a.kind !== 'UseConversionAction') || !a.pickTargets) return [a];
    const filled = mine ? fillPick(view, mine, a, rank) : null;
    return filled ? [filled] : [];
  });
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
    if (choices.length > 0) return take(generalValues ? bestPair(generalValues, registry, choices) : choices.reduce((best, a) => (hp(a) > hp(best) ? a : best)));
  }

  // 1a0. An arrangement: Peach, Shan and Sha on top, the rest at the bottom.
  const arrangeTemplate = legal.find((a): a is Arrange => a.kind === 'ArrangeCardsAction');
  if (arrangeTemplate && view.pendingArrangement) {
    const ids = view.pendingArrangement.cardInstanceIds;
    const onTop = (id: string) => KEEP_ON_TOP.has(definitionIdOf(view, id) ?? '') || isShaCard(registry, definitionIdOf(view, id));
    return take({ ...arrangeTemplate, top: ids.filter(onTop), bottom: ids.filter((id) => !onTop(id)) });
  }

  // 1a. A selection. Sky Scorcher's seats: non-allies only, else cancel. Cards
  // for Axe, Green Dragon Blade, Serpent Spear: the least useful. Anything
  // else: cancel when allowed.
  const selectTemplate = legal.find((a): a is Select => a.kind === 'SelectAction');
  if (selectTemplate && view.pendingSelection && me) {
    const selection = view.pendingSelection;
    const cancel = legal.find((a) => a.kind === 'CancelSelectionAction');
    const skillPick = fireSelection(view, me, selection, registry) ?? skillSelection(view, me, selection, registry);
    if (skillPick === 'cancel' && cancel) return take(cancel);
    if (Array.isArray(skillPick) && skillPick.length >= selection.min) return take({ ...selectTemplate, ids: skillPick });
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
    return take({ ...selectTemplate, ids: fillSelection(view, selection, leastUseful(view, registry, selection.eligibleIds)) });
  }

  // 1a'. An ability's ask; Gender Swords' choice for its target.
  const choiceNow = view.pendingChoice;
  const choiceActions = legal.filter((a): a is ChooseOption => a.kind === 'ChooseOptionAction');
  if (choiceNow && me && choiceActions.length > 0) {
    if (choiceNow.reason.kind === 'ability' && choiceNow.verb === 'use') {
      const skillWants = wantsSkill(view, me, choiceNow, registry);
      // A compulsory skill's ask is only about revealing, and a bot has no reason to hide: it says Use.
      const compulsory = findSkill(registry, choiceNow.reason.abilityId)?.compulsory === true;
      const wants = compulsory || (skillWants ?? wantsToUse(view, me, choiceNow.reason.abilityId, choiceNow.reason.targetSeatId));
      const pick = choiceActions.find((a) => a.optionId === (wants ? 'use' : 'decline'));
      if (pick) return take(pick);
    }
    // A skill's pick of a seat, a suit or a label, or who gets given cards.
    if (choiceNow.reason.kind === 'ability' && (choiceNow.verb === 'pick' || choiceNow.verb === 'give')) {
      const optionId = skillChoice(view, me, choiceNow, registry);
      return take(choiceActions.find((a) => a.optionId === optionId) ?? choiceActions[0]);
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
            ? !!self && wuxieWorthCancelling(view, self, reason, responseRules.wuxie)
            : reason.kind === 'ability' && (baseSkillId(reason.abilityId) === 'upheaval' || reason.abilityId === 'instigate')
              ? !!self && upheavalVictimIsFoe(view, self, reason.targetSeatId)
              : false; // never counter a Wuxie Kongjie
    const answers = legal.filter((a): a is Extract<Action, { kind: 'RespondAction' }> => a.kind === 'RespondAction');
    // A Peach before anything else (a dying bot drinks Wine only without one).
    const best = answers.find((a) => definitionIdOf(view, a.cardInstanceId) === 'peach') ?? answers[0];
    // Serpent Spear: only with no real answer, and no Peach among the 2 cards it would take.
    const converted = legal.find((a): a is UseConversion => a.kind === 'UseConversionAction' && !!self && conversionSpare(view, self, a, registry));
    const holding = responseRules.shanHold && !!self && !!best && definitionIdOf(view, best.cardInstanceId) === 'shan' && shouldHoldShan(view, self);
    const chosen = holding ? undefined : (best ?? converted);
    const answer = (worthAnswering ? chosen : undefined) ?? legal.find((a) => a.kind === 'PassAction');
    if (answer) return take(answer);
  }

  // 3. Discard phase: lose the least useful card first, first in hand on ties.
  const discards = legal.filter((a): a is DiscardCard => a.kind === 'DiscardCardAction');
  if (discards.length > 0) {
    const worth = rules.discard ? discardRank : keepRank;
    return take(discards.reduce((best, a) => (worth(view, registry, a.cardInstanceId) < worth(view, registry, best.cardInstanceId) ? a : best)));
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
    if (peach && self.combinedHp < self.maxCombinedHp && (!rules.peach || peachWorthPlaying(view, self))) return take(peach);

    // Equip into an empty slot; with the equipment rule, also swap a worn weapon or armor for a better one.
    const wornIds = (view.zones.find((z) => z.id === self.equipped.zoneId)?.cards ?? []).map((c) => c.definitionId);
    const equipment = plays.find((p) => {
      const definitionId = definitionIdOf(view, p.cardInstanceId);
      const slot = definitionId ? registry.cards.get(definitionId)?.equipSlot : undefined;
      const better = rules.equipment && !!definitionId && isEquipUpgrade(registry, definitionId, wornIds);
      return untargeted(p) && !!slot && (!equippedSlots.has(slot) || better);
    });
    if (equipment) return take(equipment);

    const untargetedOf = (definitionId: string) => plays.find((p) => untargeted(p) && definitionIdOf(view, p.cardInstanceId) === definitionId);

    const drawTwo = untargetedOf('draw-two');
    if (drawTwo) return take(drawTwo);

    const peachGarden = untargetedOf('peach-garden');
    if (peachGarden && self.combinedHp < self.maxCombinedHp) return take(peachGarden);

    const early = pickActiveSkill(view, self, legal, registry, 'early');
    if (early) return take(early);

    // Barbarians and Hail of Arrows hit everyone else: only worth it when
    // non-allies are at least as many as allies.
    const others = view.seats.filter((s) => s.id !== seatId && !s.eliminated);
    const allies = others.filter((s) => isAlly(self, s)).length;
    if (others.length - allies >= allies) {
      const massAttack = untargetedOf('barbarians') ?? untargetedOf('hail-of-arrows');
      if (massAttack) return take(massAttack);
      // Random Strike: a Hail of Arrows from 2 same-suit cards.
      const hailVia = legal.find(
        (a): a is UseConversion => a.kind === 'UseConversionAction' && !a.pendingResponseId && conversionAs(a, view, registry) === 'hail-of-arrows' && conversionSpare(view, self, a, registry)
      );
      if (hailVia) return take(hailVia);
    }

    // Steal and Break: the lowest-HP non-ally, preferring one that wears equipment.
    const wearsEquipment = (p: PlayCard) => {
      const target = view.seats.find((s) => s.id === p.targets[0]?.seatId);
      return !!target && (view.zones.find((z) => z.id === target.equipped.zoneId)?.cards.length ?? 0) > 0;
    };
    const [grab] = [...targetedPlays(view, self, plays, 'steal', rank, registry), ...targetedPlays(view, self, plays, 'break', rank, registry)].sort(
      (a, b) => Number(wearsEquipment(b)) - Number(wearsEquipment(a))
    );
    if (grab) return take(grab);

    // Conversions into a Break or a Capture, under the same rules as the cards.
    const targetSeat = (a: UseConversion) => view.seats.find((s) => s.id === a.targets[0].seatId)!;
    const conversionsAs = (as: string) =>
      legal.filter(
        (a): a is UseConversion =>
          a.kind === 'UseConversionAction' && !a.pendingResponseId && a.targets.length === 1 && conversionAs(a, view, registry) === as && conversionSpare(view, self, a, registry) && !isAlly(self, targetSeat(a))
      );
    const [breakVia] = conversionsAs('break');
    if (breakVia) return take(breakVia);
    // Strategic Pass: a Farm as Steal.
    const [stealVia] = conversionsAs('steal');
    if (stealVia) return take(stealVia);
    const [captureVia] = conversionsAs('capture').sort((x, y) => targetSeat(y).combinedHp - targetSeat(x).combinedHp);
    if (captureVia) return take(captureVia);
    // Blockade: a Starvation at the non-ally with the most hand cards.
    const holds = (seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
    const [starvationVia] = conversionsAs('starvation').sort((x, y) => holds(targetSeat(y)) - holds(targetSeat(x)));
    if (starvationVia) return take(starvationVia);
    // Fire Strategy: Blaze at the weakest non-ally while holding 3 or more hand cards.
    const handCount = view.zones.find((z) => z.id === self.hand.zoneId)?.cards.length ?? 0;
    const byWeakest = (x: UseConversion, y: UseConversion) => rank(view, self, targetSeat(y)) - rank(view, self, targetSeat(x)) || targetSeat(x).index - targetSeat(y).index;
    const [blazeVia] = conversionsAs('blaze').filter((a) => targetSeat(a).id !== seatId).sort(byWeakest);
    if (blazeVia && handCount >= 3) return take(blazeVia);

    // Delayed Tools. Capture: the highest-HP non-ally. Starvation: the
    // non-ally in reach with the most hand cards. Lightning: at 3 HP or more.
    const targetOf = (p: PlayCard) => view.seats.find((s) => s.id === p.targets[0]?.seatId);
    const handSize = (p: PlayCard) => {
      const target = targetOf(p);
      return target ? (view.zones.find((z) => z.id === target.hand.zoneId)?.cards.length ?? 0) : 0;
    };
    const best = (candidates: PlayCard[], score: (p: PlayCard) => number) =>
      candidates.reduce<PlayCard | undefined>((top, p) => (!top || score(p) > score(top) ? p : top), undefined);
    const capture = best(targetedPlays(view, self, plays, 'capture', rank, registry), (p) => targetOf(p)?.combinedHp ?? 0);
    if (capture) return take(capture);
    const starvation = best(targetedPlays(view, self, plays, 'starvation', rank, registry), handSize);
    if (starvation) return take(starvation);
    const lightning = untargetedOf('lightning');
    if (lightning && self.combinedHp >= 3) return take(lightning);

    // Wine first when a Sha at a non-ally is legal: the Sha follows next.
    const shaPlays = targetedPlays(view, self, plays, 'sha', rank, registry);
    const shaTarget = view.seats.find((s) => s.id === shaPlays[0]?.targets[0]?.seatId);
    const wineOk = shaPlays.length > 0 && (!rules.wine || wineWorthPlaying(shaTarget));
    const wine = untargetedOf('wine');
    if (wine && wineOk) return take(wine);
    // Dong Zhuo's Wine, made from a spade, when he holds no real one.
    const wineVia = legal.find((a): a is UseConversion => a.kind === 'UseConversionAction' && !a.pendingResponseId && a.targets.length === 0 && conversionAs(a, view, registry) === 'wine' && conversionSpare(view, self, a, registry));
    if (wineVia && wineOk) return take(wineVia);
    // Whenever the engine offers a Sha (Crossbow lifts the limit); the safety cap still ends the turn.
    const [sha] = shaPlays;
    if (sha) return take(sha, 1);
    // A conversion into a Sha (Serpent Spear, Fighting Saint…): with no real Sha, at the weakest non-ally.
    const [conversion] = legal
      .filter((a): a is UseConversion => a.kind === 'UseConversionAction' && a.targets.length >= 1 && conversionAs(a, view, registry) === 'sha')
      .map((a) => ({ a, target: view.seats.find((s) => s.id === a.targets[0].seatId) }))
      .filter((t): t is { a: UseConversion; target: Seat } => !!t.target && !t.target.eliminated && !isAlly(self, t.target))
      .sort((x, y) => rank(view, self, y.target) - rank(view, self, x.target) || x.target.index - y.target.index)
      .map((t) => t.a);
    if (conversion && conversionSpare(view, self, conversion, registry)) return take(conversion, 1);
    const [duel] = targetedPlays(view, self, plays, 'duel', rank, registry);
    if (duel) return take(duel);
    // Dueling Heroes: a Duel from an opposite-colour card, at the weakest non-ally.
    const [duelVia] = conversionsAs('duel').sort(byWeakest);
    if (duelVia) return take(duelVia);
    // Coerce: when one non-ally's weapon can reach another non-ally.
    const coerce = plays.find((p) => {
      if (p.targets.length !== 2 || definitionIdOf(view, p.cardInstanceId) !== 'coerce') return false;
      const [holder, victim] = p.targets.map((t) => view.seats.find((s) => s.id === t.seatId));
      return !!holder && !!victim && victim.id !== seatId && !isAlly(self, holder) && !isAlly(self, victim);
    });
    if (coerce) return take(coerce);
    const late = pickActiveSkill(view, self, legal, registry, 'late');
    if (late) return take(late);
    if (endPhase) return take(endPhase);
  }

  // 6. Fallback: never stall.
  return take(endPhase ?? legal.find((a) => a.kind === 'PassAction') ?? legal[0]);
}

// Simple, explainable opponent; see the bot-opponents design spec for its rules.
// The ranker decides which non-ally a targeted play goes to.
export function createRuleBasedPolicy(id: string, rank: TargetRanker, rules: CardPlayRules = NO_CARD_PLAY_RULES, responseRules: ResponseRules = NO_RESPONSE_RULES, generalValues?: Readonly<Record<string, number>>): BotPolicy {
  return { id, decide: (view, seatId, legal, registry, memory) => decide(rank, rules, responseRules, generalValues, view, seatId, legal, registry, memory) };
}

// Stage 4 shipped: General pairs are chosen with the measured value table (max HP breaks ties).
export const ruleBasedPolicy: BotPolicy = createRuleBasedPolicy('rule-based', weakestFirst, NO_CARD_PLAY_RULES, NO_RESPONSE_RULES, GENERAL_VALUES);

// Weakest-first targeting and highest-max-HP General pairs, frozen as a fixed opponent for the tournament
// harness. 'rule-based-v1' was 'rule-based' before the Stage 4 value table; 'rule-based-v2' is the same bot,
// kept as the baseline Stage 4 was judged against.
export const ruleBasedV1Policy: BotPolicy = createRuleBasedPolicy('rule-based-v1', weakestFirst);
export const ruleBasedV2Policy: BotPolicy = createRuleBasedPolicy('rule-based-v2', weakestFirst);
