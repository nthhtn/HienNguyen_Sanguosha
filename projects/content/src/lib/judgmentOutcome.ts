import type { ContentRegistry, GameState, JudgmentReader, JudgmentView } from 'engine';
import { captureOutcome } from './cards/capture';
import { eightTrigramsOutcome } from './cards/equipment/eight-trigrams';
import { lightningOutcome } from './cards/lightning';
import { starvationOutcome } from './cards/starvation';
import { duelingHeroesOutcome } from './generals/fire';
import { lamentOutcome, militaryFarmOutcome } from './generals/mountain';
import { ironCavalryOutcome } from './generals/shu';
import { lightningStrikeOutcome } from './generals/wind';
import { riverGoddessOutcome, unyieldingOutcome } from './generals/wei';

// What a settled judgment will do to the table, in outcome keys that `judgmentOutcomeText`
// (display.ts) has text for. Every decision is the reader's own: the function its `onJudged`
// calls, so the text cannot disagree with the rule.
export interface JudgmentOutcome {
  // A card reader's id (the card it counts as) or a skill reader's skill id.
  readerId: string;
  key: string;
  // How it went for the judged seat's player, and what the table is shown happening.
  verdict: JudgmentVerdict;
  effect: JudgmentEffect;
  // Seat ids: the judged seat, the reader's owner, and a third seat it acts on (a damage source).
  seats: { seat: string; owner: string; source: string | null };
}

// Good or bad for the judged seat's player, whoever the effect lands on; neutral when neither reading
// means anything (Dueling Heroes: only which colour is allowed differs).
export type JudgmentVerdict = 'good' | 'bad' | 'neutral';

// What the popup shows happening, as data: `subject` is whose HP is lost.
export type JudgmentEffect =
  | { kind: 'damage'; amount: number; subject: 'seat' | 'owner' | 'source' }
  | { kind: 'skip-phase'; phase: 'Draw' | 'Play' }
  | { kind: 'keep-phase'; phase: 'Draw' | 'Play' }
  | { kind: 'pass-on' }
  | { kind: 'none' };

export interface JudgmentPresentation {
  verdict: JudgmentVerdict;
  effect: JudgmentEffect;
}

const NONE: JudgmentEffect = { kind: 'none' };
const good = (effect: JudgmentEffect = NONE): JudgmentPresentation => ({ verdict: 'good', effect });
const bad = (effect: JudgmentEffect = NONE): JudgmentPresentation => ({ verdict: 'bad', effect });
const neutral: JudgmentPresentation = { verdict: 'neutral', effect: NONE };

const EIGHT_TRIGRAMS: Record<string, JudgmentPresentation> = { shan: good(), none: bad() };
const RIVER_GODDESS: Record<string, JudgmentPresentation> = { again: good(), ends: bad() };
const LIGHTNING_STRIKE: Record<string, JudgmentPresentation> = { damage: bad({ kind: 'damage', amount: 2, subject: 'seat' }), none: good() };

// By reader id, then outcome key (the keys of `JUDGMENT_OUTCOMES` in display.ts). Each row is read from
// the judged seat's player's point of view; a spec checks that every key with text has a row here.
const PRESENTATION: Record<string, Record<string, JudgmentPresentation>> = {
  lightning: { struck: bad({ kind: 'damage', amount: 3, subject: 'seat' }), moves: good({ kind: 'pass-on' }), stays: good() },
  capture: { skip: bad({ kind: 'skip-phase', phase: 'Play' }), spared: good({ kind: 'keep-phase', phase: 'Play' }) },
  starvation: { skip: bad({ kind: 'skip-phase', phase: 'Draw' }), spared: good({ kind: 'keep-phase', phase: 'Draw' }) },
  'eight-trigrams': EIGHT_TRIGRAMS,
  'eight-arrays': EIGHT_TRIGRAMS,
  unyielding: { 'discard-or-damage': good(), damage: good({ kind: 'damage', amount: 1, subject: 'source' }), spared: bad() },
  'river-goddess': RIVER_GODDESS,
  'alternate:goddess-luo': RIVER_GODDESS,
  'iron-cavalry': { unblockable: good(), none: bad() },
  'lightning-strike': LIGHTNING_STRIKE,
  'alternate:lightning-strike': LIGHTNING_STRIKE,
  'dueling-heroes': { red: neutral, black: neutral },
  'military-farm': { farm: good(), discard: bad() },
  lament: { heal: good(), draw: good(), discard2: good(), discard1: good(), 'face-down': good(), 'face-up': good(), none: bad() },
};

const has = (table: object, key: string) => Object.prototype.hasOwnProperty.call(table, key);

// null for a reader or key with no row.
export function judgmentPresentation(readerId: string, key: string): JudgmentPresentation | null {
  if (!has(PRESENTATION, readerId) || !has(PRESENTATION[readerId], key)) return null;
  return PRESENTATION[readerId][key];
}

export function judgmentReaderId(reader: JudgmentReader): string {
  return reader.kind === 'card' ? reader.card.as : reader.owner.skillId;
}

interface Decision {
  key: string;
  source?: string | null;
}
type Decide = (state: GameState, view: JudgmentView, registry: ContentRegistry) => Decision;

const READERS: Record<string, Decide> = {
  lightning: (state, view, registry) => ({ key: lightningOutcome(state, view.seatId, view.card, registry) }),
  capture: (state, view, registry) => ({ key: captureOutcome(state, view.seatId, view.card, registry) }),
  starvation: (state, view, registry) => ({ key: starvationOutcome(state, view.seatId, view.card, registry) }),
  'eight-trigrams': (state, view, registry) => ({ key: eightTrigramsOutcome(state, view.seatId, view.card, registry) }),
  // The skill has the card's ability.
  'eight-arrays': (state, view, registry) => ({ key: eightTrigramsOutcome(state, view.seatId, view.card, registry) }),
  // The judged seat is the skill's owner; the damage source rides in the judgment's data.
  unyielding: (state, view, registry) => {
    const source = view.data?.['sourceSeatId'] as string;
    return { key: unyieldingOutcome(state, view.seatId, view.card, source, registry), source };
  },
  'river-goddess': (state, view, registry) => ({ key: riverGoddessOutcome(state, view.seatId, view.card, registry) }),
  // Alternate Goddess Luo decides as River Goddess does; only what happens to a black card differs (its text).
  'alternate:goddess-luo': (state, view, registry) => ({ key: riverGoddessOutcome(state, view.seatId, view.card, registry) }),
  'iron-cavalry': (state, view, registry) => ({ key: ironCavalryOutcome(state, view.seatId, view.card, registry) }),
  'lightning-strike': (state, view, registry) => ({ key: lightningStrikeOutcome(state, view.seatId, view.card, registry) }),
  // Alternate Lightning Strike judges and strikes as Default's; only who he may pick differs.
  'alternate:lightning-strike': (state, view, registry) => ({ key: lightningStrikeOutcome(state, view.seatId, view.card, registry) }),
  'dueling-heroes': (state, view, registry) => ({ key: duelingHeroesOutcome(state, view.seatId, view.card, registry) }),
  'military-farm': (state, view, registry) => ({ key: militaryFarmOutcome(state, view.seatId, view.card, registry) }),
  // The judged seat is the victim; the damage source rides in the judgment's data.
  lament: (state, view, registry) => {
    const source = view.data?.['source'] as string | undefined;
    return { key: lamentOutcome(state, view.seatId, source, view.card, registry), source: source ?? null };
  },
};

// The ids of every reader with an outcome (for the coverage spec).
export const judgmentReaderIds = (): string[] => Object.keys(READERS);

// null when the reader has no entry.
export function judgmentOutcome(state: GameState, view: JudgmentView, registry: ContentRegistry): JudgmentOutcome | null {
  const readerId = judgmentReaderId(view.reader);
  if (!Object.prototype.hasOwnProperty.call(READERS, readerId)) return null;
  const decision = READERS[readerId](state, view, registry);
  const owner = view.reader.kind === 'skill' ? view.reader.owner.seatId : view.seatId;
  const shown = judgmentPresentation(readerId, decision.key) ?? neutral;
  return { readerId, key: decision.key, ...shown, seats: { seat: view.seatId, owner, source: decision.source ?? null } };
}
