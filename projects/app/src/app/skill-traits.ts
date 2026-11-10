import { Component, input } from '@angular/core';
import type { SkillTrait } from 'content';
import type { MessageKey } from './i18n/messages';
import { TPipe } from './i18n/t.pipe';

// The badge for each skill trait.
const TRAIT_KEYS: Record<SkillTrait, MessageKey> = {
  locked: 'wiki.trait.locked',
  limited: 'wiki.trait.limited',
  oncePerTurn: 'wiki.trait.oncePerTurn',
};

// The badges next to a skill's name: Locked, Limited and Once Per Turn, as the game's code gives them.
@Component({
  selector: 'app-skill-traits',
  imports: [TPipe],
  template: `@for (trait of traits(); track trait) {<span class="trait" [attr.data-trait]="trait">{{ keys[trait] | t }}</span>}`,
  styles: `
    :host { display: contents; }
    .trait { display: inline-block; margin: 0 4px 0 6px; padding: 0 8px; border-radius: 8px; color: var(--mat-sys-on-tertiary-container); background: var(--mat-sys-tertiary-container); font: var(--mat-sys-label-small); vertical-align: 1px; white-space: nowrap; }
  `,
})
export class SkillTraits {
  readonly traits = input<readonly SkillTrait[] | undefined>([]);
  protected readonly keys = TRAIT_KEYS;
}
