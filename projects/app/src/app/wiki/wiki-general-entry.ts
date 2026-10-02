import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { WikiGeneral } from 'content';
import { CardArt } from '../game-board/card-art';

// One general in the Wiki: art beside everything the data knows about it.
@Component({
  selector: 'app-wiki-general-entry',
  imports: [CardArt, MatIconModule],
  template: `
    <article class="entry kingdom-{{ general().kingdom }}" [attr.data-id]="general().id">
      <app-card-art [id]="general().id" [label]="general().name" size="large" />
      <div class="body">
        <header>
          <h4>
            <span class="name">{{ general().name }}</span>
            @if (general().nameZh; as zh) {
              <span class="zh">{{ zh }}</span>
            }
          </h4>
          <span class="badge" [class.on]="general().skillsInGame">
            {{ general().skillsInGame ? 'Skills in game' : 'Skills not in game yet' }}
          </span>
        </header>
        @if (general().title; as title) {
          <p class="title">
            {{ title }}
            @if (general().titleZh; as titleZh) {
              <span class="zh">{{ titleZh }}</span>
            }
          </p>
        }
        <p class="meta">
          <span class="kingdom-tag">{{ general().kingdom }}</span>
          @if (general().maxHp !== null) {
            <span class="hearts" [attr.aria-label]="'HP ' + general().maxHp">
              @for (h of hearts(); track $index) {
                <mat-icon>favorite</mat-icon>
              }
            </span>
          } @else {
            <span class="gap">HP not recorded</span>
          }
        </p>
        <ul class="skills">
          @for (skill of general().skills; track skill.name) {
            <li>
              <strong>{{ skill.name }}</strong>
              @if (skill.nameZh; as zh) {
                <span class="zh">{{ zh }}</span>
              }
              <span class="skill-text">{{ skill.text }}</span>
            </li>
          } @empty {
            <li class="gap">No skills</li>
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
  readonly general = input.required<WikiGeneral>();
  protected readonly hearts = computed(() => Array.from({ length: this.general().maxHp ?? 0 }));
}
