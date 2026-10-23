import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { WikiAlternateGeneral } from 'content';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import type { MessageKey } from '../i18n/messages';
import { CardArt } from '../game-board/card-art';
import { wikiAlternateGeneralView } from './wiki-labels';

// One Alternate General in the Wiki: art (or a placeholder) beside its text and the state of each skill.
// The state comes from the content package; this component only shows it.
@Component({
  selector: 'app-wiki-alternate-general-entry',
  imports: [CardArt, MatIconModule, TPipe],
  template: `
    <article class="entry kingdom-{{ general().kingdom }}" [attr.data-id]="general().id">
      <app-card-art [skin]="true" [id]="general().id" [label]="view().name" size="large" />
      <div class="body">
        <header>
          <h4>
            <span class="name">{{ view().name }}</span>
            @if (general().nameZh; as zh) {
              <span class="zh">{{ zh }}</span>
            }
          </h4>
        </header>
        @if (view().title; as title) {
          <p class="title">{{ title }}</p>
        }
        <p class="meta">
          <span class="kingdom-tag">{{ kingdomKey() | t }}</span>
          <span class="gender-tag">{{ (general().gender === 'female' ? 'wiki.female' : 'wiki.male') | t }}</span>
          <span class="hearts" [attr.aria-label]="'wiki.hp' | t: { n: general().maxHp }">
            @for (h of hearts(); track $index) {
              <mat-icon>favorite</mat-icon>
            }
          </span>
        </p>
        <ul class="skills">
          @for (skill of general().skills; track skill.name; let i = $index) {
            <li>
              <strong>{{ view().skills[i].name }}</strong>
              @if (skill.nameZh; as zh) {
                <span class="zh">{{ zh }}</span>
              }
              <span class="skill-text">{{ view().skills[i].text }}</span>
              <span class="skill-status" [attr.data-status]="skill.status">{{ statusLabels[skill.status] | t }}</span>
            </li>
          } @empty {
            <li class="gap">{{ 'wiki.noSkills' | t }}</li>
          }
        </ul>
        @if (view().partners.length > 0) {
          <div class="partners">
            <h5>{{ 'wiki.partners' | t }}</h5>
            <ul>
              @for (partner of view().partners; track $index) {
                <li>{{ partner }}</li>
              }
            </ul>
          </div>
        }
        @if (view().differenceNote; as note) {
          <div class="difference">
            <h5>{{ 'wiki.differenceNote' | t }}</h5>
            <p>{{ note }}</p>
          </div>
        }
      </div>
    </article>
  `,
  styles: `
    .entry { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .body { flex: 1; min-width: 0; }
    h4 { margin: 0; font: var(--mat-sys-title-large); }
    h5 { margin: 12px 0 4px; font: var(--mat-sys-title-small); }
    .zh { margin-left: 8px; color: var(--mat-sys-on-surface-variant); }
    .title { margin: 4px 0; font-style: italic; }
    .meta { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
    .kingdom-Wei { --kingdom: #3f6fd8; }
    .kingdom-Shu { --kingdom: #d84a3f; }
    .kingdom-Wu { --kingdom: #2f9e58; }
    .kingdom-Qun { --kingdom: #8a7f8c; }
    .kingdom-tag { padding: 0 8px; border-radius: 8px; color: #fff; background: var(--kingdom); font: var(--mat-sys-label-medium); }
    .gender-tag { padding: 0 8px; border-radius: 8px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-medium); }
    .skill-status { display: block; width: fit-content; margin-top: 2px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-small); color: var(--mat-sys-on-surface-variant); }
    .skill-status[data-status='worksAsAlternate'], .skill-status[data-status='worksAsDefault'] { border-color: var(--mat-sys-primary); color: var(--mat-sys-primary); }
    .hearts { display: inline-flex; color: #d84a3f; }
    .hearts mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .skills, .partners ul { margin: 0; padding-left: 18px; }
    .skills li { margin: 4px 0; }
    .skill-text { margin-left: 6px; white-space: pre-line; }
    .difference p { margin: 0; white-space: pre-line; }
    .gap { color: var(--mat-sys-on-surface-variant); font-style: italic; }
    @media (max-width: 599px) { .entry { flex-direction: column; } }
  `,
})
export class WikiAlternateGeneralEntry {
  private readonly i18n = inject(I18n);
  readonly general = input.required<WikiAlternateGeneral>();
  // The words for a skill's state: a variant, or Default's code when the rules are the same, makes it playable.
  protected readonly statusLabels: Record<WikiAlternateGeneral['skills'][number]['status'], MessageKey> = {
    worksAsDefault: 'wiki.skillStatus.worksAsDefault',
    worksAsAlternate: 'wiki.skillStatus.worksAsAlternate',
    missing: 'wiki.notInGame',
  };
  protected readonly view = computed(() => wikiAlternateGeneralView(this.general(), this.i18n.locale()));
  protected readonly kingdomKey = computed((): MessageKey => `label.kingdom.${this.general().kingdom}`);
  protected readonly hearts = computed(() => Array.from({ length: this.general().maxHp }));
}
