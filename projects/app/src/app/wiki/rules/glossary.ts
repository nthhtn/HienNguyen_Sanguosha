import { Component, computed, inject } from '@angular/core';
import { CHAIN_ICON_URL, kingdomBannerUrl } from 'content';
import { DAMAGE_IMAGE_URLS } from '../../game-board/damage-effects';
import { I18n } from '../../i18n/i18n.service';
import type { MessageKey } from '../../i18n/messages';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneGeneral } from './scene/scene-general';
import { SceneHp } from './scene/scene-hp';

type Art =
  | { kind: 'banners' }
  | { kind: 'hp' }
  | { kind: 'general'; id: string }
  | { kind: 'card'; id: string }
  | { kind: 'chain' }
  | { kind: 'damage' };

// Each term with the picture that stands for it. The sentences are in the catalog under rules.glossary.<id>.term / .def.
const ENTRIES: { id: string; art: Art }[] = [
  { id: 'force', art: { kind: 'banners' } },
  { id: 'hp', art: { kind: 'hp' } },
  { id: 'main', art: { kind: 'general', id: 'cao-cao' } },
  { id: 'deputy', art: { kind: 'general', id: 'guo-jia' } },
  { id: 'hidden', art: { kind: 'general', id: 'hidden' } },
  { id: 'chained', art: { kind: 'chain' } },
  { id: 'area', art: { kind: 'card', id: 'capture' } },
  { id: 'response', art: { kind: 'card', id: 'wuxie' } },
  { id: 'mount', art: { kind: 'card', id: 'red-hare' } },
  { id: 'range', art: { kind: 'card', id: 'crossbow' } },
  { id: 'dying', art: { kind: 'damage' } },
  { id: 'pile', art: { kind: 'card', id: 'back' } },
];

@Component({
  selector: 'app-rules-glossary',
  imports: [RichText, TPipe, SceneCard, SceneGeneral, SceneHp],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.glossary' | t }}</h2>
    <p class="lead">{{ 'rules.glossary.lead' | t }}</p>
    <dl class="defs">
      @for (entry of entries; track entry.id) {
        <div class="entry">
          <div class="thumb">
            @switch (entry.art.kind) {
              @case ('banners') {
                @for (banner of banners(); track banner.force) {
                  <img class="banner" [src]="banner.url" [alt]="banner.alt" />
                }
              }
              @case ('hp') {
                <app-scene-hp [hp]="1" />
              }
              @case ('general') {
                <app-scene-general [id]="entry.art.id" size="small" />
              }
              @case ('card') {
                <app-scene-card [id]="entry.art.id" size="small" />
              }
              @case ('chain') {
                <img class="scene-chain" [src]="chainUrl" [alt]="'seat.chained' | t" />
              }
              @case ('damage') {
                <img class="scene-mark" [src]="damageUrl" alt="" />
              }
            }
          </div>
          <div class="tx">
            <dt>{{ termKey(entry.id) | t }}</dt>
            <dd><app-rich [key]="defKey(entry.id)" /></dd>
          </div>
        </div>
      }
    </dl>
  `,
  styles: `
    .defs { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin: 0; }
    .entry { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 12px; align-items: center; padding: 12px; background: var(--mat-sys-surface-container); border: 1px solid var(--mat-sys-outline-variant); border-radius: 6px; min-width: 0; }
    .thumb { display: flex; flex-wrap: wrap; gap: 2px; justify-content: center; align-items: center; }
    .banner { width: 10px; height: 44px; object-fit: fill; }
    .scene-chain, .scene-mark { width: 40px; }
    dt { font-weight: 700; }
    dd { margin: 2px 0 0; color: var(--mat-sys-on-surface-variant); font: var(--mat-sys-body-medium); }
  `,
})
export class RulesGlossary {
  private readonly i18n = inject(I18n);
  protected readonly entries = ENTRIES;
  protected readonly chainUrl = CHAIN_ICON_URL;
  protected readonly damageUrl = DAMAGE_IMAGE_URLS.damage;
  protected readonly termKey = (id: string) => `rules.glossary.${id}.term` as MessageKey;
  protected readonly defKey = (id: string) => `rules.glossary.${id}.def` as MessageKey;
  // The four Force banners, each named by its Force in the current language.
  protected readonly banners = computed(() =>
    (['Wei', 'Shu', 'Wu', 'Qun'] as const).map((force) => ({
      force,
      url: kingdomBannerUrl(force) ?? '',
      alt: this.i18n.t(`label.kingdom.${force}` as MessageKey),
    })),
  );
}
