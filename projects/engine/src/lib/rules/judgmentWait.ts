import { JudgmentView } from '../domain/types';

// Whether the game waits for someone to close this judgment: its card is final and no chain is going on past it.
// A chaining judgment (Goddess Luo's black card) is settled for the table to read but waits for nobody.
export function awaitsAcknowledgement(view: JudgmentView | undefined): boolean {
  return !!view && view.settled && !view.continuing;
}
