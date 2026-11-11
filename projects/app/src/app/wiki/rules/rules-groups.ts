import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { MessageKey } from '../../i18n/messages';
import { TPipe } from '../../i18n/t.pipe';
import { RulesAllegiance } from './allegiance';
import { RulesCardTypes } from './card-types';
import { RulesChains } from './chains';
import { RulesDamage } from './damage';
import { RulesDistance } from './distance';
import { RulesJudgment } from './judgment';
import { RulesResponse } from './response';
import { RulesSetup } from './setup';
import { RulesTurn } from './turn';

// The list of sections at the top of a page that holds several topics. Each links to its heading.
@Component({
  selector: 'app-rules-contents',
  imports: [RouterLink, TPipe],
  template: `
    <nav class="contents" [attr.aria-label]="'rules.onThisPage' | t">
      <b>{{ 'rules.onThisPage' | t }}</b>
      @for (item of items(); track item.id) {
        <a routerLink="." [fragment]="item.id">{{ item.label | t }}</a>
      }
    </nav>
  `,
  styles: `
    :host { display: block; max-width: 800px; margin: 0 auto 8px; }
    .contents { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    b { font: var(--mat-sys-label-large); color: var(--mat-sys-on-surface-variant); margin-right: 4px; }
    a { padding: 4px 14px; border-radius: 16px; background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container); text-decoration: none; font: var(--mat-sys-label-large); }
    a:hover, a:focus-visible { background: var(--mat-sys-surface-container-highest); }
  `,
})
export class RulesContents {
  readonly items = input.required<{ id: string; label: MessageKey }[]>();
}

const GROUP_STYLES = `
  :host { display: block; }
  section { scroll-margin-top: 80px; }
  section + section { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--mat-sys-outline-variant); }
`;

// Setup and Allegiance: how a game starts, then whom each seat plays for.
@Component({
  selector: 'app-rules-setup-group',
  imports: [RulesContents, RulesSetup, RulesAllegiance],
  styles: GROUP_STYLES,
  template: `
    <app-rules-contents [items]="sections" />
    <section id="setup"><app-rules-setup /></section>
    <section id="allegiance"><app-rules-allegiance /></section>
  `,
})
export class RulesSetupGroup {
  protected readonly sections: { id: string; label: MessageKey }[] = [
    { id: 'setup', label: 'nav.rules.setup' },
    { id: 'allegiance', label: 'nav.rules.allegiance' },
  ];
}

// Turn and Cards: the turn's phases, then the kinds of card.
@Component({
  selector: 'app-rules-turn-group',
  imports: [RulesContents, RulesTurn, RulesCardTypes],
  styles: GROUP_STYLES,
  template: `
    <app-rules-contents [items]="sections" />
    <section id="turn"><app-rules-turn /></section>
    <section id="card-types"><app-rules-card-types /></section>
  `,
})
export class RulesTurnGroup {
  protected readonly sections: { id: string; label: MessageKey }[] = [
    { id: 'turn', label: 'nav.rules.turn' },
    { id: 'card-types', label: 'nav.rules.cardTypes' },
  ];
}

// Attack and Defence: who you can reach, how they answer, and how HP is lost.
@Component({
  selector: 'app-rules-attack-group',
  imports: [RulesContents, RulesDistance, RulesResponse, RulesDamage],
  styles: GROUP_STYLES,
  template: `
    <app-rules-contents [items]="sections" />
    <section id="distance"><app-rules-distance /></section>
    <section id="response"><app-rules-response /></section>
    <section id="damage"><app-rules-damage /></section>
  `,
})
export class RulesAttackGroup {
  protected readonly sections: { id: string; label: MessageKey }[] = [
    { id: 'distance', label: 'nav.rules.distance' },
    { id: 'response', label: 'nav.rules.response' },
    { id: 'damage', label: 'nav.rules.damage' },
  ];
}

// Judgment and Chains: the two special resolutions.
@Component({
  selector: 'app-rules-judgment-group',
  imports: [RulesContents, RulesJudgment, RulesChains],
  styles: GROUP_STYLES,
  template: `
    <app-rules-contents [items]="sections" />
    <section id="judgment"><app-rules-judgment /></section>
    <section id="chains"><app-rules-chains /></section>
  `,
})
export class RulesJudgmentGroup {
  protected readonly sections: { id: string; label: MessageKey }[] = [
    { id: 'judgment', label: 'nav.rules.judgment' },
    { id: 'chains', label: 'nav.rules.chains' },
  ];
}
