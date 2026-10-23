import { AbilityOwner, CardInstance, GeneralOwner, GameState, GameRules, Target, Kingdom, GameResult, PendingResponse, UsedCard } from '../domain/types';
import { RngState } from '../rng/rng';
import type { Effect } from '../pipeline/effects';

export interface PlayContext {
  seatId: string;
  // The first physical card's instance id ('' for a card with none).
  cardInstanceId: string;
  // The card as used: itself, or what a conversion made it.
  card: UsedCard;
  targets: Target[];
  respondingTo?: string;
  // The window being answered (state.pendingResponse is already cleared when
  // play() runs), so an answer can read what it answers.
  answering?: PendingResponse;
  // Played by an ability, outside the Play Phase's limits (Green Dragon
  // Blade's follow-up Sha): it never counts toward a limit or spends Wine.
  free?: boolean;
}

// The four equipment slots a seat has. One card per slot.
export type EquipSlot = 'weapon' | 'armor' | 'defensiveMount' | 'offensiveMount';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'defensiveMount', 'offensiveMount'];

export interface PlayOptionsContext {
  seatId: string;
  cardInstanceId: string;
  // Set when asked for a conversion: how many cards it takes, and whether only
  // from the hand.
  via?: { cards: number; fromHandOnly: boolean };
}

// A card's targets picked in one go: between `min` and `max` of `eligibleIds`
// (several equal targets: a Sha at several seats).
export interface TargetPick {
  eligibleIds: string[];
  min: number;
  max: number;
  // At most `max` of the picked seats may come from `ids` (Close Combat: the first target may be at any
  // distance in range, but each extra one it adds must be near).
  capped?: { ids: string[]; max: number };
}

export interface CardDefinition {
  id: string;
  name: string;
  category: 'basic' | 'tool' | 'equipment';
  // Which equipment slot the card occupies; set exactly when category is 'equipment'.
  equipSlot?: EquipSlot;
  // Reach of a weapon (attack range while equipped); set only for weapons.
  weaponRange?: number;
  // Every legal target list for proactively playing this card in the owner's
  // Play phase: [] = not playable now, [[]] = no target, [[t1], [t2]] = one of
  // these targets. Absent = legacy offers (untargeted + each living other seat).
  legalPlayTargets?(state: GameState, ctx: PlayOptionsContext, registry: ContentRegistry): Target[][];
  // When it may take more than one target now: the pick (legal actions then
  // offer one template). Null or max 1: legalPlayTargets as usual.
  targetPick?(state: GameState, ctx: PlayOptionsContext, registry: ContentRegistry): TargetPick | null;
  // Never dealt (a card only a skill makes). No card uses it now: Blaze is dealt.
  outOfDeck?: true;
  // The card is another card in every respect when used as itself (a Fire
  // Attack is a Sha): it is used as that id (UsedCard.as), and answers a window
  // that asks for that id. Its own legalPlayTargets/targetPick still offer it.
  playsAs?: string;
  // The damage nature the card carries when used as itself (UsedCard.nature).
  nature?: 'fire' | 'thunder';
  // Played with no target, the card is a Recast: discarded, and its user draws 1 (Chains, Ascertain).
  recastable?: true;
  play(state: GameState, ctx: PlayContext, registry: ContentRegistry): unknown[];
  // When present, the card (in hand, or made by a conversion) answers a window
  // that allows it only while this holds (Wuxie Kingdom: not against a seat
  // with both Generals hidden). Also decides who is asked in a Wuxie check.
  answerCondition?(state: GameState, pending: PendingResponse, seatId: string, registry: ContentRegistry): boolean;
  // Called when a seat answers a response window this card opened (see
  // PendingResponse.sourceCard), after the answering card's own effects. Its
  // effects replace the default of simply cancelling the pending effect, e.g.
  // a Duel turning back on the other player.
  onResponse?(state: GameState, ctx: ResponseContext, registry: ContentRegistry): unknown[];
  // A Tool's rule on one target, once its Wuxie check has passed
  // (ToolRuleEffect). Its effects go to the front of the queue.
  onTarget?(state: GameState, ctx: ToolTargetContext, registry: ContentRegistry): unknown[];
  // A delayed Tool: play() puts it in a judgment area, so playing it doesn't
  // send it to the discard pile (like Equipment).
  delayed?: boolean;
  // A delayed Tool reading its judgment card (JudgeEffect). Its effects go to
  // the front of the queue, ahead of the judged card's move to the discard pile.
  onJudged?(state: GameState, ctx: JudgedContext, registry: ContentRegistry): unknown[];
  // What becomes of a delayed Tool once it has had its turn in the Judgment
  // phase (DelayedCleanupEffect). Absent = discarded, if it is still in its
  // owner's judgment area.
  onCleanup?(state: GameState, ctx: DelayedToolContext): unknown[];
  // Active while the card is worn (in an equip zone); the wearer owns them.
  abilities?: Abilities;
  // Resolved for the former wearer right after the card leaves an equip zone,
  // for any reason (Silver Lion's parting heal).
  onUnequip?(state: GameState, ctx: UnequipContext): unknown[];
  // One step of this card's resolution (CardStepEffect, e.g. a Sha's
  // 'sha-shan'). Its effects go to the front of the queue. Abilities hook in
  // with before:CardStepEffect triggers.
  onStep?(state: GameState, step: Extract<Effect, { kind: 'CardStepEffect' }>, registry: ContentRegistry): unknown[];
}

export interface ResponseContext {
  pending: PendingResponse;
  // The seat that answered, and the card it answered with.
  seatId: string;
  cardInstanceId: string;
  // The answering card as used (two physical cards for a Serpent Spear Sha).
  card: UsedCard;
}

export interface ToolTargetContext {
  tool: UsedCard;
  userSeatId: string;
  target: Target;
  extra?: Target[];
}

export interface JudgedContext {
  tool: UsedCard;
  // The seat being judged, and the card turned up for it.
  seatId: string;
  judged: CardInstance;
  // What the JudgeEffect carried for its reader (Eight Trigrams: the step it answers).
  data?: Record<string, unknown>;
  // The judgment's last step (the card to the discard pile). Include it among
  // the returned effects to place it there; otherwise it comes after them.
  done: Effect;
}

// A skill reading its own judgment (Unyielding, Iron Cavalry, River Goddess).
export interface SkillJudgedContext {
  owner: GeneralOwner;
  // The seat being judged, and the card it got.
  seatId: string;
  judged: CardInstance;
  data?: Record<string, unknown>;
  // As JudgedContext.done.
  done: Effect;
}

export interface DelayedToolContext {
  tool: UsedCard;
  // The seat whose judgment area the delayed Tool was judged in.
  ownerSeatId: string;
}

export type TriggerPoint = `before:${string}` | `after:${string}`;

// Who a gathered trigger acts for. `owner` is undefined only for a mode's own
// triggers. (The domain name is AbilityOwner.)
export type TriggerOwner = AbilityOwner;

export interface SkillTrigger {
  point: TriggerPoint;
  // `registry` lets content read worn cards' abilities (e.g. Black Pommel).
  condition(state: GameState, subject: unknown, owner?: TriggerOwner, registry?: ContentRegistry): boolean;
  effect(state: GameState, subject: unknown, owner?: TriggerOwner, registry?: ContentRegistry): unknown[];
}

// Rule changes a worn card gives its wearer. Content's queries read them; the
// engine never does.
export interface AbilityModifiers {
  // Sha plays allowed per turn: the highest wins; Infinity = no limit (Crossbow).
  shaLimit?: number;
  // More targets, by card id, for the wearer's play of that card when it is its last hand card (Sky Scorcher: { sha: 2 }).
  extraTargetsWhenLastCard?: Record<string, number>;
  // More targets for the owner's Sha, each one near the owner (Close Combat: 1). See `targetPick` in the Sha card.
  extraShaTargets?: number;
  // The wearer's Sha ignores the target's armour (Black Pommel).
  ignoresArmor?: boolean;
  // Card ids that can't target the wearer (Wood Armor: Barbarians, Hail of Arrows).
  untargetableBy?: string[];
  // Added to the owner's distance to every other seat (Horsemanship: -1); never below 1.
  distanceToOthers?: number;
  // The bonus this ability's owner gives to `seatId`'s attack range (Six Swords of Wu: +1 to the owner's Kingdom).
  attackRangeBonusTo?(state: GameState, ownerSeatId: string, seatId: string): number;
  // The owner's Tools ignore distance (Wondrous Talent: Steal, Starvation).
  toolsIgnoreDistance?: boolean;
  // Card ids that can't target the owner while its hand is empty (Empty City: Sha, Duel).
  untargetableWithEmptyHandBy?: string[];
  // The owner's Sha needs two Shan, and in a Duel with it the other seat plays two Sha each time (Matchless).
  doubleAnswers?: boolean;
  // Added to the owner's distance to every other seat, from the state (Farms:
  // -1 each). Added with `distanceToOthers`; the distance never goes below 1.
  distanceToOthersFrom?(state: GameState, seatId: string): number;
  // How the owner's own cards' suits count (Beauty: { spade: 'heart' }): its
  // hand, worn and judgment cards wherever a rule reads a suit.
  suitAs?: Partial<Record<CardInstance['suit'], CardInstance['suit']>>;
  // Extra reach for using the named cards (Blockade: { starvation: 1 }).
  rangeBonusFor?: Record<string, number>;
  // Black Tools can't target the owner (Curtain).
  untargetableByBlackTools?: boolean;
  // In the turn owner's turn, only the owner and the dying seat may use Peach (Complete Kill).
  peachOnlyOwnerAndDying?: boolean;
  // The owner's Sha needs two Shan against a female, and a female's Sha at the owner needs two (Garden of Lust).
  doubleAnswersWithFemale?: boolean;
}

// Using cards as another card (Serpent Spear: 2 hand cards as a Sha; Fighting
// Saint: a red card as a Sha).
export interface Conversion {
  // Unique among its owner's conversions.
  id: string;
  // The card the picked cards count as.
  as: string;
  // How many cards it takes.
  cards: 1 | 2;
  // Where they come from: the hand (default), or the hand and worn equipment.
  // or only from the seat's stash pile.
  from?: 'hand' | 'hand-and-equipment' | 'stash';
  // Which cards may be used; absent = any. `seatId` holds the card (a suit
  // modifier of that seat may apply).
  accepts?(card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry): boolean;
  // 'play': proactively in your Play Phase; 'respond': to answer a window.
  when: 'play' | 'respond' | 'both';
  // Only while it is not its owner's turn (First Aid).
  outsideOwnTurnOnly?: boolean;
  // The picked card isn't used at once: the owning skill's step 'deferred'
  // decides (Bewilder's doubt round). Only a General's skill may defer.
  deferred?: true;
  // Its cards must share a suit (Random Strike).
  sameSuit?: true;
}

// What a card does while worn.
export interface Abilities {
  triggers?: SkillTrigger[];
  modifiers?: AbilityModifiers;
  conversions?: Conversion[];
}

export interface UnequipContext {
  // The former wearer, and the card that left its equipment.
  seatId: string;
  cardInstanceId: string;
}

// Who is using an active skill: its owner's seat, and the skill.
export interface ActiveContext {
  seatId: string;
  owner: GeneralOwner;
}

// A skill used on purpose in its owner's Play Phase (Kindness, Reconsider).
export interface ActiveSkill {
  // Uses allowed per turn; absent = any number.
  usesPerTurn?: number;
  canUse(state: GameState, ctx: ActiveContext, registry: ContentRegistry): boolean;
  // The effects that open its decisions. If the first is a selection with
  // onCancel, Cancel undoes the use: it counts only once the picks are confirmed,
  // and that selection must be the only effect (what follows goes in its
  // continuation).
  start(state: GameState, ctx: ActiveContext, registry: ContentRegistry): unknown[];
}

// A General's skill: abilities like a worn card's, owned by the General's seat.
export interface SkillDefinition extends Abilities {
  id: string;
  // Applies without asking. Off while its General is hidden (see skillsInPlay).
  compulsory?: boolean;
  // A Lord skill: never in play, since Kingdom War has no Lord.
  lord?: boolean;
  // Fires once, compulsorily, when its condition holds at its owner's turn
  // start (content marks it awakened). Never borrowed (Incarnation).
  awakening?: true;
  // Usable once per game. Never borrowed (Incarnation).
  limited?: true;
  // Its triggers are also gathered for its own seat's elimination, though an
  // eliminated seat has no skills in play (Heartbroken).
  afterDeath?: true;
  // While revealed, in its owner's turn: no other seat may reveal a General by
  // choice or by an ask (revealBlockedFor). A death's reveal still happens.
  blocksOtherReveals?: true;
  // Spare Generals dealt to its owner's seat when Generals are chosen.
  spareGenerals?: number;
  active?: ActiveSkill;
  // Reads a judgment this skill asked for (JudgmentReader 'skill').
  onJudged?(state: GameState, ctx: SkillJudgedContext, registry: ContentRegistry): unknown[];
  // One step of this skill's own resolution (SkillStepEffect), for skills that
  // decide in several moves (Raid, Kindness, Sow Revolt). Its effects go to the
  // front of the queue.
  onStep?(state: GameState, step: Extract<Effect, { kind: 'SkillStepEffect' }>, registry: ContentRegistry): unknown[];
}

export interface GeneralDefinition {
  id: string;
  kingdom: Kingdom;
  maxHp: number;
  // From the data; read through content's seatGender (Gender Swords).
  gender?: 'male' | 'female';
  skills: SkillDefinition[];
}

export interface ContentRegistry {
  cards: Map<string, CardDefinition>;
  generals: Map<string, GeneralDefinition>;
}

export interface GameModeDefinition {
  id: string;
  setup(seatIds: string[], registry: ContentRegistry, rng: RngState, rules?: GameRules): { state: GameState; rng: RngState };
  checkWinCondition(state: GameState): GameResult | null;
  triggers: SkillTrigger[];
  // Largest table this mode can seat with the given content, if it is limited.
  maxSeats?(registry: ContentRegistry): number;
}

export type ModeRegistry = Map<string, GameModeDefinition>;
