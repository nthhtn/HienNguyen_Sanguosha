import { Component, computed, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { WikiCard } from 'content';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TPipe } from '../i18n/t.pipe';
import { CARD_VOICES, SoundEffects, VoiceGender } from '../music.service';
import { CardArt } from '../game-board/card-art';
import { printingLabel } from './printing-label';
import { wikiCardView, wikiPackLabel } from './wiki-labels';

// One card in the Wiki: art beside its rules text, stats and printings.
@Component({
  selector: 'app-wiki-card-entry',
  imports: [CardArt, MatIconModule, TPipe],
  template: `
    <article class="entry" [attr.data-id]="card().id">
      <app-card-art [cropped]="true" [id]="card().id" [label]="view().name" size="large" />
      <div class="body">
        <header>
          <h4>
            <span class="name">{{ view().name }}</span>
            @if (card().nameZh; as zh) {
              <span class="zh">{{ zh }}</span>
            }
          </h4>
          <span class="badge" [class.on]="card().inGame">{{ (card().inGame ? 'wiki.inGame' : 'wiki.notInGame') | t }}</span>
        </header>
        <p class="meta"><span class="expansion-tag">{{ packLabel(card().expansion) }}</span></p>
        @if (voice(); as voice) {
          <p class="voices">
            <span class="voices-label">{{ 'wiki.voices' | t }}</span>
            @for (option of voiceButtons; track option.gender) {
              <button type="button" class="voice" [attr.data-gender]="option.gender" [attr.aria-label]="option.label | t" [attr.title]="option.label | t" (click)="play(option.gender)">
                <mat-icon>{{ option.gender === 'male' ? 'man' : 'woman' }}</mat-icon>
              </button>
            }
          </p>
        }
        @if (card().range !== null) {
          <p class="range">{{ 'wiki.range' | t: { n: card().range ?? 0 } }}</p>
        }
        @if (card().mount; as mount) {
          <p class="distance">{{ 'card.distance' | t: { n: mount === 'offensive' ? '-1' : '+1' } }}</p>
        }
        @if (view().text; as text) {
          <p class="text">{{ text }}</p>
        } @else {
          <p class="gap">{{ 'wiki.noText' | t }}</p>
        }
        @if (card().printings.length > 0) {
          @if (own().length > 0) {
            <p class="printings">{{ 'wiki.copies' | t: { n: own().length, list: labels(own()) } }}</p>
          }
          <!-- Extra copies other expansions add, one line each. -->
          @for (group of extras(); track group.expansion) {
            <p class="printings extra" [attr.data-expansion]="group.expansion">
              <span class="expansion">{{ packLabel(group.expansion) }}</span> {{ 'wiki.extraCopies' | t: { n: group.printings.length, list: labels(group.printings) } }}
            </p>
          }
        } @else {
          <p class="gap">{{ 'wiki.noPrintings' | t }}</p>
        }
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
    .meta { margin: 8px 0 0; }
    .expansion-tag { padding: 0 8px; border-radius: 8px; border: 1px solid var(--mat-sys-outline); font: var(--mat-sys-label-medium); }
    .voices { display: flex; align-items: center; gap: 6px; margin: 8px 0 0; }
    .voices-label { font-weight: 600; }
    .voice { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; border-radius: 16px; border: none; background: none; color: var(--mat-sys-on-surface); cursor: pointer; }
    .voice:hover, .voice:focus-visible { background: var(--mat-sys-surface-container-high); }
    .voice mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .range, .distance { margin: 8px 0 0; font-weight: 600; }
    .text { margin: 8px 0; }
    .printings { margin: 8px 0; letter-spacing: 0.04em; }
    .printings.extra { margin-top: -4px; color: var(--mat-sys-on-surface-variant); }
    .expansion { padding: 0 6px; border-radius: 6px; background: var(--mat-sys-surface-container-high); font: var(--mat-sys-label-medium); letter-spacing: 0; }
    .gap { margin: 8px 0; color: var(--mat-sys-on-surface-variant); font-style: italic; }
    @media (max-width: 599px) { .entry { flex-direction: column; } }
  `,
})
export class WikiCardEntry {
  private readonly i18n = inject(I18n);
  private readonly effects = inject(SoundEffects);
  readonly card = input.required<WikiCard>();
  // The spoken line this card has, if any, in both genders.
  protected readonly voice = computed(() => CARD_VOICES[this.card().id] ?? null);
  protected readonly voiceButtons: { gender: VoiceGender; label: MessageKey }[] = [
    { gender: 'male', label: 'wiki.playVoice.male' },
    { gender: 'female', label: 'wiki.playVoice.female' },
  ];
  protected play(gender: VoiceGender): void {
    const voice = this.voice();
    if (voice) this.effects.previewVoice(gender, voice);
  }
  protected readonly view = computed(() => wikiCardView(this.card(), this.i18n.locale()));
  // A pack with no key of its own shows its raw name.
  protected packLabel(pack: string): string {
    return wikiPackLabel(pack, this.i18n.translator);
  }
  // The card's own printings, and the extra copies grouped by the expansion that adds them.
  protected readonly own = computed(() => this.card().printings.filter((p) => !p.expansion));
  protected readonly extras = computed(() => {
    const groups = new Map<string, WikiCard['printings']>();
    for (const p of this.card().printings) {
      if (p.expansion) groups.set(p.expansion, [...(groups.get(p.expansion) ?? []), p]);
    }
    return [...groups].map(([expansion, printings]) => ({ expansion, printings }));
  });
  protected labels(printings: WikiCard['printings']): string {
    return printings.map(printingLabel).join(' ');
  }
}
