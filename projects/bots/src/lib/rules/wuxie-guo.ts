import type { Seat } from 'engine';
import { definitionIdOf, isAlly } from '../helpers';
import type { BotRule } from './registry';

// Wuxie Kingdom (answer). Whether the bot answers a Wuxie window is decided elsewhere; this only picks which
// card to answer with. Holding both Wuxie and Wuxie Kingdom, it plays Wuxie Kingdom only when the Tool is
// Barbarians or Hail of Arrows and the target is the bot itself or an ally with an exposed General (it then
// cancels for every later target of that Kingdom); otherwise the plain Wuxie, keeping Wuxie Kingdom. Holding
// only one of them, that one.
const MASS_TOOLS = new Set(['barbarians', 'hail-of-arrows']);
const exposed = (seat: Seat) => !!seat.generals && (seat.generals.main.revealed || seat.generals.deputy.revealed);

export const wuxieKingdomRule: BotRule = {
  id: 'wuxie-guo',
  answer: (ctx, answers) => {
    const of = (id: string) => answers.find((a) => definitionIdOf(ctx.view, a.cardInstanceId) === id);
    const wuxie = of('wuxie');
    const kingdom = of('wuxie-guo');
    if (!wuxie || !kingdom) return kingdom ?? wuxie; // only one of them: that one
    const reason = ctx.view.pendingResponse?.reason;
    if (reason?.kind !== 'wuxie' || reason.target.kind !== 'seat') return wuxie;
    const targetId = reason.target.seatId;
    const target = ctx.view.seats.find((s) => s.id === targetId);
    const covers = !!target && MASS_TOOLS.has(reason.tool.as) && exposed(target) && (target.id === ctx.me.id || isAlly(ctx.me, target, ctx.view));
    return covers ? kingdom : wuxie;
  },
};
