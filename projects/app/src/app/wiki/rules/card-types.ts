import { Component, inject } from '@angular/core';
import { generalDisplayData } from 'content';
import { I18n } from '../../i18n/i18n.service';
import { RouterLink } from '@angular/router';
import { TPipe } from '../../i18n/t.pipe';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneGeneral } from './scene/scene-general';
import { SceneHp } from './scene/scene-hp';

@Component({
  selector: 'app-rules-card-types',
  imports: [RouterLink, RichText, TPipe, SceneCard, SceneFrame, SceneGeneral, SceneHp],
  styleUrls: ['./rules-page.css', './scene/scene.css'],
  template: `
    <h2>{{ 'nav.rules.cardTypes' | t }}</h2>
    <p class="lead">{{ 'rules.cardTypes.lead' | t }}</p>

    <h3><a routerLink="/wiki/generals">{{ 'rules.cardTypes.general' | t }}</a></h3>
    <p><app-rich key="rules.cardTypes.generalText" /></p>
    <div class="scene-row top">
      <figure class="fig" data-force="Wei">
        <app-scene-general id="cao-cao" size="normal" />
        <figcaption><b>{{ generalName('cao-cao') }}</b></figcaption>
        <app-scene-hp [hp]="4" />
      </figure>
      <figure class="fig" data-force="Shu">
        <app-scene-general id="guan-yu" size="normal" />
        <figcaption><b>{{ generalName('guan-yu') }}</b></figcaption>
        <app-scene-hp [hp]="4" />
      </figure>
      <figure class="fig">
        <app-scene-general id="hidden" size="normal" />
        <figcaption><b>{{ 'seat.faceDown' | t }}</b> {{ 'rules.cardTypes.faceDownHint' | t }}</figcaption>
      </figure>
    </div>

    <h3><a routerLink="/wiki/basic">{{ 'rules.cardTypes.basic' | t }}</a></h3>
    <p><app-rich key="rules.cardTypes.basicText" /></p>
    <div class="scene-row top">
      @for (card of basic; track card.id) {
        <figure class="fig">
          <app-scene-card [id]="card.id" size="normal" />
          <figcaption><b><app-rich [text]="'{card:' + card.id + '}'" /></b> <app-rich [key]="card.role" /></figcaption>
        </figure>
      }
    </div>

    <h3><a routerLink="/wiki/tools">{{ 'rules.cardTypes.tools' | t }}</a></h3>
    <p><app-rich key="rules.cardTypes.toolsText" /></p>
    <app-scene caption="rules.cardTypes.instantCap">
      <div class="scene-row top">
        @for (id of instant; track id) {
          <figure class="fig">
            <app-scene-card [id]="id" size="small" />
            <figcaption><b><app-rich [text]="'{card:' + id + '}'" /></b></figcaption>
          </figure>
        }
      </div>
    </app-scene>
    <app-scene caption="rules.cardTypes.delayedCap">
      <div class="scene-row top">
        @for (id of delayed; track id) {
          <figure class="fig">
            <app-scene-card [id]="id" size="small" />
            <figcaption><b><app-rich [text]="'{card:' + id + '}'" /></b></figcaption>
          </figure>
        }
      </div>
      <p><app-rich key="rules.cardTypes.delayedSee" /></p>
    </app-scene>

    <h3><a routerLink="/wiki/equipment">{{ 'rules.cardTypes.equipment' | t }}</a></h3>
    <p><app-rich key="rules.cardTypes.equipmentText" /></p>
    <app-scene caption="rules.cardTypes.equipCap">
      <div class="scene-row top">
        @for (slot of slots; track slot.id) {
          <figure class="fig">
            <app-scene-card [id]="slot.id" size="small" />
            <span class="tag">{{ slot.tag | t }}</span>
            <figcaption><b><app-rich [text]="'{card:' + slot.id + '}'" /></b> <app-rich [key]="slot.role" /></figcaption>
          </figure>
        }
      </div>
    </app-scene>
    <p><app-rich key="rules.cardTypes.see" /></p>
  `,
  styles: `
    figure { margin: 0; max-width: 120px; }
    figcaption { font: var(--mat-sys-body-small); }
  `,
})
export class RulesCardTypes {
  private readonly i18n = inject(I18n);
  protected readonly generalName = (id: string) => generalDisplayData(id, this.i18n.locale())?.name ?? '';
  protected readonly basic = [
    { id: 'sha', role: 'rules.cardTypes.role.sha' },
    { id: 'shan', role: 'rules.cardTypes.role.shan' },
    { id: 'peach', role: 'rules.cardTypes.role.peach' },
    { id: 'wine', role: 'rules.cardTypes.role.wine' },
  ] as const;
  protected readonly instant = ['steal', 'break', 'duel', 'barbarians', 'hail-of-arrows', 'peach-garden', 'wuxie'] as const;
  protected readonly delayed = ['capture', 'starvation', 'lightning'] as const;
  protected readonly slots = [
    { id: 'crossbow', tag: 'card.subtype.weapon', role: 'rules.cardTypes.role.crossbow' },
    { id: 'eight-trigrams', tag: 'card.subtype.armor', role: 'rules.cardTypes.role.eightTrigrams' },
    { id: 'red-hare', tag: 'slot.offensiveMount', role: 'rules.cardTypes.role.redHare' },
    { id: 'shadow-runner', tag: 'slot.defensiveMount', role: 'rules.cardTypes.role.shadowRunner' },
  ] as const;
}
