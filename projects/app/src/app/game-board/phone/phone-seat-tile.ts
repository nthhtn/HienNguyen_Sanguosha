import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance, EQUIP_SLOTS, EquipSlot, GeneralInstance, Seat } from 'engine';
import { AMBITIONIST_ICON_URL, equipSlotOf, generalSkinUrl, HIDDEN_GENERAL_ART_URL } from 'content';
import { cardIdDisplayName, seatForce } from '../../labels';
import { I18n } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { TMsgPipe } from '../../i18n/msg';
import type { MessageKey } from '../../i18n/messages';
import type { SeatCue } from '../playback/seat-cues';
import { ShownDamage } from '../damage-effects';
import { SpriteEffect } from '../sprite-effect';

const SLOT_ICONS: Record<EquipSlot, { label: MessageKey; icon: string }> = {
  weapon: { label: 'slot.weapon', icon: 'gavel' },
  armor: { label: 'slot.armor', icon: 'shield' },
  defensiveMount: { label: 'slot.defensiveMount', icon: 'add' },
  offensiveMount: { label: 'slot.offensiveMount', icon: 'remove' },
};
const JUDGMENT_BOXES = 3;

// One seat on the phone board, laid out to be read at arm's length (spec, "The phone board"): the name with up to three
// Judgment boxes, both Generals, HP and hand count with the chained mark, and four Equipment boxes. Nothing in it is
// scaled down; a slim tile is narrower, not smaller. An opponent's tile is one tap target (2b-2 opens Seat Details).
@Component({
  selector: 'app-phone-seat-tile',
  imports: [NgTemplateOutlet, MatIconModule, SpriteEffect, TPipe, TMsgPipe],
  template: `
    <ng-template #body>
      <div class="name-row">
        @if (seat().allegiance === 'ambitionist') {
          <img class="ambitionist-mark" [src]="ambitionistIcon" [alt]="'label.kingdom.Ambitionist' | t" />
        }
        <span class="name" [attr.title]="name()">{{ name() }}</span>
        @if (isBot()) {
          <mat-icon class="bot" [attr.aria-label]="'seat.computerAria' | t">smart_toy</mat-icon>
        }
        @if (isViewer()) {
          <span class="you">{{ 'seat.you' | t }}</span>
        }
        <span class="judgment" [attr.aria-label]="'seat.judgment' | t">
          @for (box of judgmentBoxes(); track $index) {
            <span
              class="judgment-box"
              [class.filled]="box"
              [attr.title]="box ? ('seat.judgmentTitle' | t: { card: cardName(box) }) : ('seat.judgmentEmpty' | t)"
            ></span>
          }
        </span>
      </div>
      <div class="generals">
        @for (g of generals(); track g.slot) {
          <span class="general" [attr.data-slot]="g.slot" [class.own-hidden]="g.ownHidden">
            <img [src]="g.url" alt="" />
          </span>
        }
        @for (fx of shownDamage(); track fx.id) {
          <app-sprite-effect class="damage-fx" [image]="fx.image" />
        }
      </div>
      <div class="stats">
        <span class="hp">{{ 'seat.hp' | t: { hp: seat().combinedHp, max: seat().maxCombinedHp } }}</span>
        <span class="hand" [attr.aria-label]="'seat.handAria' | t: { n: handCount() }"><mat-icon aria-hidden="true">style</mat-icon>{{ handCount() }}</span>
        @if (seat().chained) {
          <mat-icon class="chain-mark" role="img" [attr.aria-label]="'seat.chained' | t">link</mat-icon>
        }
      </div>
      <div class="equipment" [attr.aria-label]="'seat.equipment' | t">
        @for (s of slots(); track s.slot) {
          <span
            class="equip-box"
            [attr.data-slot]="s.slot"
            [class.filled]="s.card"
            [attr.title]="s.card ? ('seat.slotTitle' | t: { slot: s.label, card: cardName(s.card) }) : ('seat.slotEmpty' | t: { slot: s.label })"
          >
            <mat-icon aria-hidden="true">{{ s.icon }}</mat-icon>
          </span>
        }
      </div>
      @if (seat().eliminated) {
        <span class="stamp">{{ 'seat.eliminated' | t }}</span>
      } @else if (showDying()) {
        <span class="status">{{ 'seat.dying' | t }}</span>
      }
      @if (cue(); as c) {
        @if (c.floatText) {
          <span class="float" [class.up]="c.impact === 'heal'" aria-hidden="true">{{ c.floatText }}</span>
        }
        @if (c.callout; as callout) {
          <span class="callout {{ callout.tone }}" role="status">{{ callout.text | tm }}</span>
        }
      }
    </ng-template>
    @if (isViewer()) {
      <div class="tile" [class]="tileClasses()" [attr.data-force]="force()">
        <ng-container [ngTemplateOutlet]="body" />
      </div>
    } @else {
      <button type="button" class="tile" [class]="tileClasses()" [attr.data-force]="force()" [attr.aria-label]="name()" (click)="opened.emit()">
        <ng-container [ngTemplateOutlet]="body" />
      </button>
    }
  `,
  styles: `
    :host { display: block; height: 100%; min-width: 0; }
    .tile {
      position: relative; box-sizing: border-box; width: 100%; height: 100%; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 2px; overflow: hidden; text-align: left; cursor: pointer;
      font: inherit; font-size: 14px; line-height: 1.2; color: #2b2520;
      background: #fbf7ec; border: 1px solid #b9a37a; border-radius: 7px;
    }
    div.tile { cursor: default; }
    .tile.turn-owner { border: 2px solid #e0a92e; box-shadow: 0 0 0 2px rgb(224 169 46 / 0.35); }
    .tile.responding { outline: 2px dashed var(--force, #e0a92e); outline-offset: -4px; }
    .tile.dimmed { opacity: 0.55; }
    .tile.eliminated { filter: grayscale(1); }
    .tile.hit { animation: hit 0.4s; }
    @keyframes hit { 30% { transform: translateX(-3px); } 60% { transform: translateX(3px); } }
    .name-row {
      display: flex; align-items: center; gap: 4px; min-height: 20px; padding: 1px 5px;
      background: var(--force, #6b6058); color: #fff; font-weight: 700;
    }
    .name { flex: 1 1 auto; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .you { flex: none; font-size: 12px; font-weight: 500; }
    .ambitionist-mark { flex: none; width: 14px; height: 14px; }
    .bot { flex: none; width: 16px; height: 16px; font-size: 16px; }
    .judgment { flex: none; display: inline-flex; gap: 2px; }
    .judgment-box { width: 12px; height: 16px; border: 1px dashed rgb(255 255 255 / 0.8); border-radius: 3px; box-sizing: border-box; }
    .judgment-box.filled { border-style: solid; background: #e9d49a; }
    .generals { position: relative; flex: 1 1 auto; min-height: 0; display: flex; gap: 2px; padding: 0 5px; }
    .general { flex: 1 1 0; min-width: 0; border-radius: 4px; overflow: hidden; background: var(--force, #6b6058); }
    .general img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
    .general.own-hidden img { opacity: 0.6; }
    .damage-fx { position: absolute; inset: 0; pointer-events: none; }
    .stats { display: flex; align-items: center; gap: 6px; padding: 0 5px; white-space: nowrap; font-weight: 500; }
    .hp { color: #b23a2e; }
    .hand { display: inline-flex; align-items: center; }
    .hand mat-icon { width: 14px; height: 14px; font-size: 14px; }
    .chain-mark { margin-left: auto; width: 16px; height: 16px; font-size: 16px; color: #4a443d; }
    .equipment { display: flex; gap: 3px; padding: 0 5px 4px; }
    .equip-box {
      flex: 1 1 0; min-width: 0; height: 18px; display: flex; align-items: center; justify-content: center;
      border: 1px dashed #b9a37a; border-radius: 3px; box-sizing: border-box; color: #b9a37a;
    }
    .equip-box.filled { border-style: solid; background: #efe7d4; color: #2b2520; }
    .equip-box mat-icon { width: 14px; height: 14px; font-size: 14px; }
    .stamp {
      position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%) rotate(-12deg);
      padding: 0 6px; border: 2px solid #b23a2e; border-radius: 6px; background: rgb(251 247 236 / 0.9);
      color: #b23a2e; font-size: 13px; font-weight: 700; white-space: nowrap;
    }
    .status {
      position: absolute; left: 6px; right: 6px; top: 45%; text-align: center; border-radius: 4px;
      background: #b23a2e; color: #fff; font-size: 12px; font-weight: 500;
    }
    .float { position: absolute; left: 0; right: 0; top: 30%; text-align: center; font-size: 18px; font-weight: 700; color: #b23a2e; pointer-events: none; }
    .float.up { color: #2e7d4f; }
    .callout {
      position: absolute; left: 4px; right: 4px; bottom: 26px; padding: 2px 4px; border-radius: 6px;
      background: rgb(43 37 32 / 0.9); color: #fbf7ec; font-size: 12px; text-align: center;
    }
  `,
})
export class PhoneSeatTile {
  readonly seat = input.required<Seat>();
  readonly name = input.required<string>();
  readonly handCount = input.required<number>();
  readonly isTurnOwner = input(false);
  readonly isResponding = input(false);
  readonly isViewer = input(false);
  readonly isBot = input(false);
  readonly equipment = input<CardInstance[]>([]);
  readonly judgment = input<CardInstance[]>([]);
  // As SeatTile: whether the seat is dying, when the parent knows; null: judged by its HP.
  readonly dying = input<boolean | null>(null);
  readonly cue = input<SeatCue | null>(null);
  readonly damageEffect = input<ShownDamage | null>(null);
  readonly dimmed = input(false);
  readonly slim = input(false);
  // A tap on an opponent's tile.
  readonly opened = output<void>();

  private readonly i18n = inject(I18n);
  protected readonly ambitionistIcon = AMBITIONIST_ICON_URL;
  protected readonly force = computed(() => seatForce(this.seat()));
  protected readonly showDying = computed(() => !this.seat().eliminated && (this.dying() ?? this.seat().combinedHp <= 0));
  protected readonly shownDamage = computed(() => {
    const fx = this.damageEffect();
    return fx ? [fx] : [];
  });
  protected readonly tileClasses = computed(() => {
    const cue = this.cue();
    return {
      tile: true,
      slim: this.slim(),
      'turn-owner': this.isTurnOwner(),
      responding: this.isResponding(),
      eliminated: this.seat().eliminated,
      dying: this.showDying(),
      dimmed: this.dimmed(),
      hit: cue?.impact === 'hit',
      heal: cue?.impact === 'heal',
    };
  });
  protected readonly judgmentBoxes = computed(() => Array.from({ length: JUDGMENT_BOXES }, (_, i) => this.judgment()[i] ?? null));
  protected readonly slots = computed(() =>
    EQUIP_SLOTS.map((slot) => ({
      slot,
      label: this.i18n.t(SLOT_ICONS[slot].label),
      icon: SLOT_ICONS[slot].icon,
      card: this.equipment().find((c) => equipSlotOf(c.definitionId) === slot) ?? null,
    }))
  );
  protected readonly generals = computed(() => {
    const generals = this.seat().generals;
    if (!generals) return [];
    return [this.general('main', generals.main), this.general('deputy', generals.deputy)];
  });

  private general(slot: 'main' | 'deputy', general: GeneralInstance) {
    const hidden = general.generalDefinitionId === 'hidden';
    return { slot, url: hidden ? HIDDEN_GENERAL_ART_URL : generalSkinUrl(general.generalDefinitionId), ownHidden: !hidden && !general.revealed };
  }

  protected cardName(card: CardInstance): string {
    return cardIdDisplayName(card.definitionId, this.i18n.translator);
  }
}
