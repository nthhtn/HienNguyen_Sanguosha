import type { Action, ContentRegistry, GameState, Seat } from 'engine';
import { BotDecision, BotPolicy, BotTurnMemory, MAX_BOT_ACTIONS_PER_TURN } from './policy';

type ChooseGenerals = Extract<Action, { kind: 'ChooseGeneralsAction' }>;
type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;

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

// Plays of `definitionId` aimed at a living non-ally, weakest target first.
function targetedPlays(view: GameState, self: Seat, plays: PlayCard[], definitionId: string): PlayCard[] {
  return plays
    .filter((p) => p.targets.length === 1 && p.targets[0].kind === 'seat' && definitionIdOf(view, p.cardInstanceId) === definitionId)
    .map((p) => ({ play: p, target: view.seats.find((s) => p.targets[0].kind === 'seat' && s.id === p.targets[0].seatId) }))
    .filter((t): t is { play: PlayCard; target: Seat } => !!t.target && !t.target.eliminated && !isAlly(self, t.target))
    .sort((a, b) => a.target.combinedHp - b.target.combinedHp || a.target.index - b.target.index)
    .map((t) => t.play);
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

  // 1. General selection: highest combined max HP, first on ties.
  if (view.phase === 'GeneralSelection') {
    const choices = legal.filter((a): a is ChooseGenerals => a.kind === 'ChooseGeneralsAction');
    const hp = (a: ChooseGenerals) =>
      (registry.generals.get(a.mainId)?.maxHp ?? 0) + (registry.generals.get(a.deputyId)?.maxHp ?? 0);
    if (choices.length > 0) return take(choices.reduce((best, a) => (hp(a) > hp(best) ? a : best)));
  }

  // 2. Responding: every response the engine offers cancels damage to us.
  if (view.pendingResponse?.respondingSeatId === seatId) {
    const answer = legal.find((a) => a.kind === 'RespondAction') ?? legal.find((a) => a.kind === 'PassAction');
    if (answer) return take(answer);
  }

  const endPhase = legal.find((a) => a.kind === 'EndPhaseAction');
  // 3. Safety cap.
  if (endPhase && mem.actionsThisTurn >= MAX_BOT_ACTIONS_PER_TURN) return take(endPhase);
  // 4. Nothing to do outside the Play phase.
  if (view.phase !== 'Play' && endPhase) return take(endPhase);

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

    if (mem.shaPlayed === 0) {
      const [sha] = targetedPlays(view, self, plays, 'sha');
      if (sha) return take(sha, 1);
    }
    const [duel] = targetedPlays(view, self, plays, 'duel');
    if (duel) return take(duel);
    if (endPhase) return take(endPhase);
  }

  // 6. Fallback: never stall.
  return take(endPhase ?? legal.find((a) => a.kind === 'PassAction') ?? legal[0]);
}

// Simple, explainable opponent; see the bot-opponents design spec for its rules.
export const ruleBasedPolicy: BotPolicy = { id: 'rule-based', decide };
