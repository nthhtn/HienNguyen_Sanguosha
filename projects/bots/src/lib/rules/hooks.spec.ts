import type { Action, GameState } from 'engine';
import { weakestFirst } from '../helpers';
import { NO_CARD_PLAY_RULES } from '../card-play';
import { NO_RESPONSE_RULES } from '../responses';
import { createRuleBasedPolicy } from '../rule-based';
import { asking, card, decideWith, picked, table } from '../testing';
import { BotRule, botRules } from './registry';

const withRules = (rules: BotRule[]) => createRuleBasedPolicy('t', weakestFirst, NO_CARD_PLAY_RULES, NO_RESPONSE_RULES, undefined, { rules: botRules(rules) });
const without = createRuleBasedPolicy('t', weakestFirst, NO_CARD_PLAY_RULES, NO_RESPONSE_RULES);

describe('hooks: the ladder consults the bot rule registry', () => {
  it('play early: a rule’s pick is taken before a Sha', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha')] });
    expect(decideWith(without, s)).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 's1' });
    const policy = withRules([{ id: 'r', play: { when: 'early', pick: (c) => c.legal.find((a) => a.kind === 'EndPhaseAction') } }]);
    expect(decideWith(policy, s).kind).toBe('EndPhaseAction');
  });

  it('play late: a rule’s pick is taken only when nothing earlier in the ladder plays', () => {
    const endPhase = (c: { legal: Action[] }) => c.legal.find((a) => a.kind === 'EndPhaseAction');
    const policy = withRules([{ id: 'r', play: { when: 'late', pick: endPhase } }]);
    expect(decideWith(policy, table({ 'seat-a:hand': [card('s1', 'sha')] }))).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 's1' });
  });

  it('use ask: wantsToUse overrides the default decline', () => {
    const policy = withRules([{ id: 'fire-fan', wantsToUse: () => true }]);
    expect(picked(decideWith(policy, asking(table(), 'fire-fan', 'seat-b')))).toBe('use');
  });

  it('a hook returning undefined falls through', () => {
    const policy = withRules([{ id: 'fire-fan' }]);
    expect(picked(decideWith(policy, asking(table(), 'fire-fan', 'seat-b')))).toBe('decline');
  });

  it('answer: the rule picks among answers', () => {
    const s = table({ 'seat-a:hand': [card('wx', 'wuxie'), card('wg', 'wuxie-guo')] });
    const window: GameState = {
      ...s,
      pendingResponse: {
        id: 'r1', respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['wuxie', 'wuxie-guo'],
        context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: 'seat-a' }, amount: 0 } },
        reason: { kind: 'wuxie', tool: { as: 'barbarians', colour: 'black', physical: [] }, toolUserSeatId: 'seat-b', target: { kind: 'seat', seatId: 'seat-a' } },
      },
    };
    expect(decideWith(without, window)).toMatchObject({ kind: 'RespondAction', cardInstanceId: 'wx' });
    const policy = withRules([{ id: 'wuxie-guo', answer: (_c, as) => as.find((a) => a.cardInstanceId === 'wg') }]);
    expect(decideWith(policy, window)).toMatchObject({ kind: 'RespondAction', cardInstanceId: 'wg' });
  });

  it('a skill with a registry entry skips its Identity rule: Benevolence with no hooks is not used', () => {
    const s = table(
      { 'seat-a:hand': [card('k1', 'shan'), card('k2', 'shan')] },
      { generals: { 'seat-a': ['kingdomWars:liu-bei', 'filler-meng-huo'], 'seat-b': ['filler-jiang-wei', 'filler-liu-shan'] }, kingdoms: { 'seat-a': 'Shu', 'seat-b': 'Shu' }, hp: { 'seat-a': 3 } },
    );
    expect(decideWith(without, s)).toMatchObject({ kind: 'UseSkillAction', owner: { skillId: 'kingdomWars:benevolence' } });
    const policy = withRules([{ id: 'kingdomWars:benevolence' }]);
    expect(decideWith(policy, s).kind).toBe('EndPhaseAction');
  });
});
