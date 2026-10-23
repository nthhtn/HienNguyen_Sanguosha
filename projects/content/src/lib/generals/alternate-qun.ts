import type { SeatEliminatedEvent, SkillDefinition } from 'engine';
import { slotSilenced } from 'engine';
import { makeCurtain } from './forest';
import { makeEclipseTheMoon, makeSowDiscord } from './qun';
import { killedByLivingOther } from './mountain';
import { choiceOf, on, used } from '../shared/skills';

// Sorrow (compulsory): when a seat kills her, her player (she is out: afterDeath) chooses the killer's
// Main or Deputy General, and that General loses all its skills for the rest of the game; the other
// keeps its. The options are just Main and Deputy, whether or not the killer's Generals are revealed:
// they name no General and reveal none. A General that already lost its skills is not offered.
// (Default Heartbroken silences the whole seat.)
const SLOT_LABELS = { main: 'Main General', deputy: 'Deputy General' } as const;
const sorrow: SkillDefinition = {
  id: 'alternate:sorrow',
  compulsory: true,
  afterDeath: true,
  triggers: [
    on<SeatEliminatedEvent>('after:SeatEliminatedEvent', {
      condition: (state, event, owner) => {
        const killer = killedByLivingOther(state, event, owner) ? state.seats.find((s) => s.id === event.killerSeatId) : undefined;
        return !!killer?.generals && (['main', 'deputy'] as const).some((slot) => !slotSilenced(killer, slot));
      },
      effect: (state, event, owner) => {
        const killerId = event.killerSeatId!;
        const killer = state.seats.find((s) => s.id === killerId)!;
        const options = (['main', 'deputy'] as const)
          .filter((slot) => !slotSilenced(killer, slot))
          .map((slot) => ({
            id: slot,
            shows: { kind: 'label' as const, text: SLOT_LABELS[slot] },
            effects: [used(owner, `silenced-${slot}`, killerId), { kind: 'SilenceSeatEffect' as const, seatId: killerId, slot }],
          }));
        return [choiceOf(state, owner, { verb: 'pick', secret: true, targetSeatId: killerId, options })];
      },
    }),
  ],
};

// Alternate Qun skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_QUN_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  'diao-chan': {
    // Seed of Animosity: the Duel it makes cannot be answered by Wuxie or Wuxie Kingdom.
    离间: { ...makeSowDiscord(false), id: 'alternate:seed-of-animosity' },
    // Envious Moon: asked whether to draw 1 at the start of the End Phase (Default: compulsory).
    闭月: { ...makeEclipseTheMoon(true), id: 'alternate:envious-moon' },
  },
  // Sorrow: the killer loses one General's skills, Main or Deputy as her player chooses (Default: the whole seat).
  'cai-wenji': { 断肠: sorrow },
  // Behind the Curtain: he can be chosen by black Tools, which are cancelled for him (Default: can't be chosen).
  'jia-xu': { 帷幕: { ...makeCurtain(true), id: 'alternate:behind-the-curtain' } },
};
