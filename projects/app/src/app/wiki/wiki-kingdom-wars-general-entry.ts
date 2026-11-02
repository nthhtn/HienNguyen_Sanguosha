import { Component, computed, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { generalDeathVoiceUrl, skillPreviewUrl, type WikiKingdomWarsGeneral } from 'content';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import type { MessageKey } from '../i18n/messages';
import { SoundEffects } from '../music.service';
import { CardArt } from '../game-board/card-art';
import { wikiKingdomWarsGeneralView } from './wiki-labels';

// One Kingdom Wars General in the Wiki: art (or a placeholder) beside its text and the state of each skill.
// The state comes from the content package; this component only shows it.
@Component({
  selector: 'app-wiki-kingdom-wars-general-entry',
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
        @if (voiceUrl(); as url) {
          <p class="voices">
            <span class="voices-label">{{ 'wiki.voice' | t }}</span>
            <button type="button" class="voice" [attr.aria-label]="'wiki.playDeathVoice' | t" [attr.title]="'wiki.playDeathVoice' | t" (click)="play(url)">
              <mat-icon>graphic_eq</mat-icon>
            </button>
          </p>
        }
        <ul class="skills">
          @for (skill of general().skills; track skill.name; let i = $index) {
            <li>
              <strong>{{ view().skills[i].name }}</strong>
              @if (skill.nameZh; as zh) {
                <span class="zh">{{ zh }}</span>
              }
              <span class="skill-text">{{ view().skills[i].text }}</span>
              @if (skill.status === 'missing') {
                <span class="skill-status" data-status="missing">{{ 'wiki.notInGame' | t }}</span>
              }
              @if (previews()[skill.name]; as url) {
                @if (playing().has(skill.name)) {
                  <video class="preview" controls autoplay playsinline [src]="url" [attr.aria-label]="'wiki.skillPreview' | t"></video>
                } @else {
                  <button type="button" class="preview-play" (click)="playPreview(skill.name)">
                    <mat-icon>play_circle</mat-icon>
                    {{ 'wiki.playPreview' | t }}
                  </button>
                }
              }
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
    .hearts { display: inline-flex; color: #d84a3f; }
    .hearts mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .voices { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; }
    .voices-label { font-weight: 600; }
    .voice { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border-radius: 16px; border: none; background: none; color: var(--mat-sys-on-surface); cursor: pointer; }
    .voice:hover, .voice:focus-visible { background: var(--mat-sys-surface-container-high); }
    .voice mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .skills, .partners ul { margin: 0; padding-left: 18px; }
    .skills li { margin: 4px 0; }
    .skill-text { margin-left: 6px; white-space: pre-line; }
    .preview-play { display: flex; align-items: center; gap: 4px; margin-top: 6px; padding: 4px 12px 4px 8px; border-radius: 16px; border: 1px solid var(--mat-sys-outline); background: none; color: var(--mat-sys-on-surface); font: var(--mat-sys-label-large); cursor: pointer; }
    .preview-play:hover, .preview-play:focus-visible { background: var(--mat-sys-surface-container-high); }
    .preview-play mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .preview { display: block; width: 100%; max-width: 480px; margin-top: 8px; border-radius: 12px; background: #000; }
    .difference p { margin: 0; white-space: pre-line; }
    .gap { color: var(--mat-sys-on-surface-variant); font-style: italic; }
    @media (max-width: 599px) { .entry { flex-direction: column; } }
  `,
})
export class WikiKingdomWarsGeneralEntry {
  private readonly i18n = inject(I18n);
  private readonly effects = inject(SoundEffects);
  readonly general = input.required<WikiKingdomWarsGeneral>();
  // The base General's recorded death cry; the nine new Generals have none yet.
  protected readonly voiceUrl = computed(() => generalDeathVoiceUrl(`kingdomWars:${this.general().id}`));
  protected play(url: string): void {
    this.effects.previewUrl(url);
  }
  // Each skill's preview video in the app's language, by skill name; a skill with none is absent.
  protected readonly previews = computed(() =>
    Object.fromEntries(this.general().skills.map((s) => [s.name, skillPreviewUrl(this.general().id, s.name, this.i18n.locale())] as const).filter(([, url]) => url !== null)),
  );
  // The skills whose player is open. A video loads only once the reader asks for it.
  protected readonly playing = signal<ReadonlySet<string>>(new Set());
  protected playPreview(skillName: string): void {
    this.playing.update((open) => new Set(open).add(skillName));
  }
  protected readonly view = computed(() => wikiKingdomWarsGeneralView(this.general(), this.i18n.locale()));
  protected readonly kingdomKey = computed((): MessageKey => `label.kingdom.${this.general().kingdom}`);
  protected readonly hearts = computed(() => Array.from({ length: this.general().maxHp }));
}
