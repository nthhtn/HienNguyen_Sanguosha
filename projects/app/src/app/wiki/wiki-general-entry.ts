import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { WikiGeneral } from 'content';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import type { MessageKey } from '../i18n/messages';
import { CardArt } from '../game-board/card-art';
import { wikiGeneralView, wikiPackLabel } from './wiki-labels';

// One general in the Wiki: art beside everything the data knows about it.
@Component({
  selector: 'app-wiki-general-entry',
  imports: [CardArt, MatIconModule, TPipe],
  template: `
    <article class="entry kingdom-{{ general().kingdom }}" [attr.data-id]="general().id">
      <app-card-art [id]="general().id" [label]="view().name" size="large" />
      <div class="body">
        <header>
          <h4>
            <span class="name">{{ view().name }}</span>
            @if (general().nameZh; as zh) {
              <span class="zh">{{ zh }}</span>
            }
          </h4>
          <span class="badge" [class.on]="general().skillsInGame">
            {{ (general().skillsInGame ? 'wiki.skillsInGame' : 'wiki.skillsNotInGame') | t }}
          </span>
        </header>
        @if (view().title; as title) {
          <p class="title">
            {{ title }}
            @if (general().titleZh; as titleZh) {
              <span class="zh">{{ titleZh }}</span>
            }
          </p>
        }
        <p class="meta">
          <span class="kingdom-tag">{{ kingdomKey() | t }}</span>
          <span class="expansion-tag">{{ packLabel() }}</span>
          <span class="gender-tag">{{ (general().gender === 'female' ? 'wiki.female' : 'wiki.male') | t }}</span>
          @if (general().maxHp !== null) {
            <span class="hearts" [attr.aria-label]="'wiki.hp' | t: { n: general().maxHp ?? 0 }">
              @for (h of hearts(); track $index) {
                <mat-icon>favorite</mat-icon>
              }
            </span>
          } @else {
            <span class="gap">{{ 'wiki.noHp' | t }}</span>
          }
        </p>
        <ul class="skills">
          @for (skill of general().skills; track skill.name; let i = $index) {
            <li>
              <strong>{{ view().skills[i].name }}</strong>
              @if (skill.nameZh; as zh) {
                <span class="zh">{{ zh }}</span>
              }
              <span class="skill-text">{{ view().skills[i].text }}</span>
              @if (skill.lord) {
                <span class="lord-note">{{ 'wiki.lordNote' | t }}</span>
              }
            </li>
          } @empty {
            <li class="gap">{{ 'wiki.noSkills' | t }}</li>
          }
        </ul>
      </div>
    </article>
  `,
  styles: `
    .entry { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--mat-sys-outline-variant); }
    .body { flex: 1; min-width: 0; }
    header { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px; }
    h4 { margin: 0; font: var(--mat-sys-title-large); }
    .zh { margin-left: 8px; color: var(--mat-sys-on-surface-variant); }
    .badge { padding: 2px 10px; border-radius: 12px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-medium); }
    .badge.on { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); border-color: var(--mat-sys-primary); }
    .title { margin: 4px 0; font-style: italic; }
    .meta { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
    .kingdom-Wei { --kingdom: #3f6fd8; }
    .kingdom-Shu { --kingdom: #d84a3f; }
    .kingdom-Wu { --kingdom: #2f9e58; }
    .kingdom-Qun { --kingdom: #8a7f8c; }
    .kingdom-tag { padding: 0 8px; border-radius: 8px; color: #fff; background: var(--kingdom); font: var(--mat-sys-label-medium); }
    .expansion-tag, .gender-tag { padding: 0 8px; border-radius: 8px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-medium); }
    .lord-note { display: block; font: var(--mat-sys-body-small); font-style: italic; color: var(--mat-sys-on-surface-variant); }
    .hearts { display: inline-flex; color: #d84a3f; }
    .hearts mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .skills { margin: 0; padding-left: 18px; }
    .skills li { margin: 4px 0; }
    .skill-text { margin-left: 6px; }
    .gap { color: var(--mat-sys-on-surface-variant); font-style: italic; }
    @media (max-width: 599px) { .entry { flex-direction: column; } }
  `,
})
export class WikiGeneralEntry {
  private readonly i18n = inject(I18n);
  readonly general = input.required<WikiGeneral>();
  protected readonly view = computed(() => wikiGeneralView(this.general(), this.i18n.locale()));
  protected readonly kingdomKey = computed((): MessageKey => `label.kingdom.${this.general().kingdom}`);
  protected readonly packLabel = computed(() => wikiPackLabel(this.general().expansion, this.i18n.translator));
  protected readonly hearts = computed(() => Array.from({ length: this.general().maxHp ?? 0 }));
}
