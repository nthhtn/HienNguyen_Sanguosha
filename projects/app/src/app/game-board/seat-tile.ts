import { Component, computed, inject, input, output } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Action, CardInstance, EQUIP_SLOTS, EquipSlot, Seat } from 'engine';
import { abilityName, AMBITIONIST_ICON_URL, equipSlotOf, generalDisplayData, hpIconUrls } from 'content';
import { cardIdDisplayName, seatForce, seatKingdomLabel } from '../labels';
import { SeatAvatar } from './seat-avatar';
import { AvatarSkill } from './avatar-skills';
import { PlayingCard } from './playing-card';
import { CardInfoDialog, CardInfoDialogData } from './card-info-dialog';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import type { MessageKey } from '../i18n/messages';

const SLOT_LABELS: Record<EquipSlot, { label: MessageKey; icon: string }> = {
  weapon: { label: 'slot.weapon', icon: 'gavel' },
  armor: { label: 'slot.armor', icon: 'shield' },
  defensiveMount: { label: 'slot.defensiveMount', icon: 'add' },
  offensiveMount: { label: 'slot.offensiveMount', icon: 'remove' },
};

// One seat at the round table, compact enough to sit on the table's rim.
@Component({
  selector: 'app-seat-tile',
  imports: [SeatAvatar, PlayingCard, MatIconModule, TPipe],
  template: `
    <div
      class="tile"
      [class.turn-owner]="isTurnOwner()"
      [class.responding]="isResponding()"
      [class.eliminated]="seat().eliminated"
      [class.viewer]="isViewer()"
      [attr.data-force]="force()"
    >
      @if (seat().allegiance === 'ambitionist') {
        <img class="ambitionist-icon" [src]="ambitionistIcon" [alt]="'label.kingdom.Ambitionist' | t" />
      }
      <div class="sections">
      <section class="panel general" [attr.aria-label]="'seat.generalAria' | t">
        <div class="header">
          <strong>{{ name() }}</strong>
          @if (isBot()) {
            <mat-icon class="bot-icon" [attr.aria-label]="'seat.computerAria' | t">smart_toy</mat-icon>
          }
          @if (isViewer()) {
            <span class="you">{{ 'seat.you' | t }}</span>
          }
        </div>
        <div class="generals" [class.face-down]="seat().faceDown">
          @if (seat().generals; as generals) {
            <app-seat-avatar [generals]="generals" [skills]="skills()" (useSkill)="useSkill.emit($event)" />
          } @else {
            <span class="choosing">{{ 'seat.choosing' | t }}</span>
          }
          @if (seat().faceDown) {
            <span class="face-down-badge">{{ 'seat.faceDown' | t }}</span>
          }
        </div>
        @if (pile().length) {
          <div class="pile" [attr.aria-label]="'seat.underGeneral' | t">
            @for (card of pile(); track card.instanceId) {
              <app-playing-card size="small" [card]="card" />
            }
          </div>
        }
        @if (stash().length) {
          <div class="pile" [attr.aria-label]="'seat.farms' | t">
            @for (card of stash(); track card.instanceId) {
              <app-playing-card size="small" [card]="card" />
            }
          </div>
        }
        @if (formName(); as form) {
          <span class="form-badge">{{ 'seat.form' | t: { form: form } }}</span>
        }
        @if (seat().chained) {
          <!-- Chained (Chains): fire or thunder damage to it passes along the chain. -->
          <span class="chain-badge" [attr.title]="'seat.chainedTitle' | t">{{ 'seat.chained' | t }}</span>
        }
        @if (seat().silenced) {
          <span class="silenced-badge">{{ 'seat.noSkills' | t }}</span>
        } @else {
          <!-- One General lost its skills (Alternate Sorrow). -->
          @for (slot of seat().silencedSlots ?? []; track slot) {
            <span class="silenced-badge">{{ (slot === 'main' ? 'seat.noSkillsMain' : 'seat.noSkillsDeputy') | t }}</span>
          }
        }
        <div class="stats">
          <span class="kingdom kingdom-{{ seat().allegiance === 'ambitionist' ? 'Ambitionist' : seat().kingdom }}">{{ kingdomName(seat()) }}</span>
          @if (hpIcons().length) {
            <span class="hp-icons">
              @for (src of hpIcons(); track src) {
                <img class="hp-icon" [src]="src" alt="" />
              }
            </span>
          }
          <span>{{ 'seat.hp' | t: { hp: seat().combinedHp, max: seat().maxCombinedHp } }}</span>
          <span class="hand-count" [attr.title]="'seat.handTitle' | t" [attr.aria-label]="'seat.handAria' | t: { n: handCount() }">
            <mat-icon aria-hidden="true">style</mat-icon>{{ handCount() }}
          </span>
        </div>
      </section>
        <section class="panel equipment" [attr.aria-label]="'seat.equipment' | t">
          <!-- Weapon, Armor on top; Defensive Mount, Offensive Mount below. -->
          <div class="equip">
            @for (s of slots(); track s.slot) {
              <div
                class="slot"
                [class.empty]="!s.card"
                [attr.data-slot]="s.slot"
                [attr.title]="s.card ? ('seat.slotTitle' | t: { slot: s.label, card: cardName(s.card.definitionId) }) : ('seat.slotEmpty' | t: { slot: s.label })"
              >
                @if (s.card; as card) {
                  <!-- Its rules text is in the Info popup. -->
                  <button type="button" class="slot-card" [attr.aria-label]="'ui.info' | t: { name: cardName(card.definitionId) }" (click)="openInfo(card)">
                    <app-playing-card size="small" [card]="card" />
                  </button>
                } @else {
                  <mat-icon>{{ s.icon }}</mat-icon>
                }
              </div>
            }
          </div>
        </section>
        <section class="panel judgment-section" [attr.aria-label]="'seat.judgment' | t">
          <div class="judgment" [attr.aria-label]="'seat.judgmentArea' | t">
            @for (card of judgment(); track card.instanceId) {
              @let countsAs = judgmentCountsAs()[card.instanceId];
              <div class="slot" [attr.title]="countsAs ? ('seat.judgmentTitleAs' | t: { card: cardName(card.definitionId), as: cardName(countsAs) }) : ('seat.judgmentTitle' | t: { card: cardName(card.definitionId) })">
                <button type="button" class="slot-card" [attr.aria-label]="'ui.info' | t: { name: cardName(card.definitionId) }" (click)="openInfo(card)">
                  <app-playing-card size="small" [card]="card" />
                </button>
                @if (countsAs) {
                  <span class="counts-as">{{ 'seat.countsAs' | t: { card: cardName(countsAs) } }}</span>
                }
              </div>
            } @empty {
              <div class="slot empty" [attr.title]="'seat.judgmentEmpty' | t"><mat-icon>balance</mat-icon></div>
            }
          </div>
        </section>
      </div>
      <!-- Status lines in the seat's force colour. -->
      @if (seat().eliminated) {
        <div class="status force-status" [attr.data-force]="force()">{{ 'seat.eliminated' | t }}</div>
      } @else if (dying() ?? seat().combinedHp <= 0) {
        <div class="status force-status dying" [attr.data-force]="force()">{{ 'seat.dying' | t }}</div>
      } @else if (isResponding()) {
        <div class="status force-status" [attr.data-force]="force()">{{ 'seat.responding' | t }}</div>
      }
    </div>
  `,
  styles: `
    .tile {
      position: relative;
      box-sizing: border-box;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      background: #fffdf7;
      border: 2px solid var(--force);
      border-radius: 14px;
      padding: 8px 10px;
      box-shadow: 0 2px 6px rgb(0 0 0 / 25%);
      font-size: 1.1em;
      text-align: center;
    }
    /* The border and name are the seat's force colour (data-force, styles.scss);
       a hidden or force-less seat is yellow. */
    .header strong { color: var(--force-text); }
    /* Highlights add to the force colour rather than replacing it. */
    .tile.turn-owner { border-width: 4px; padding: 6px 8px; box-shadow: 0 0 0 4px color-mix(in srgb, var(--force) 40%, transparent), 0 2px 6px rgb(0 0 0 / 25%); }
    .tile.responding { box-shadow: 0 0 0 3px #fff, 0 0 0 6px rgb(230 81 0 / 70%); }
    /* Faded, but the status line keeps its force colour. */
    .tile.eliminated > :not(.status) { opacity: 0.45; filter: grayscale(1); }
    /* Marks an Ambitionist, over the tile's top left corner (inside it: the seat panels clip their edges). */
    .ambitionist-icon { position: absolute; top: 3px; left: 3px; height: 44px; width: auto; z-index: 1; pointer-events: none; filter: drop-shadow(0 1px 2px rgb(0 0 0 / 40%)); }
    .bot-icon { font-size: 18px; width: 18px; height: 18px; vertical-align: middle; margin-left: 3px; color: #666; }
    .you { margin-left: 4px; color: var(--mat-sys-primary); }
    .generals { display: flex; gap: 6px; justify-content: center; margin: 4px 0; align-items: center; }
    .choosing { font-style: italic; color: #666; }
    .stats { display: flex; flex-wrap: wrap; gap: 2px 8px; justify-content: center; align-items: center; white-space: nowrap; }
    .hp-icons { display: inline-flex; gap: 1px; vertical-align: middle; }
    .hp-icon { height: 20px; width: auto; }
    .kingdom { padding: 0 5px; border-radius: 6px; background: #e6e1e5; }
    .kingdom-Wei { background: #d6e4ff; }
    .kingdom-Shu { background: #ffd9d6; }
    .kingdom-Wu { background: #d6f5dc; }
    .kingdom-Ambitionist { background: #e6dcf7; }
    .hand-count { display: inline-flex; align-items: center; gap: 2px; }
    .hand-count mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .status { font-weight: bold; margin-top: 2px; }
    .sections { flex: 1; min-height: 0; display: flex; gap: 6px; align-items: stretch; }
    /* Three equal-height panels: General, Equipment, Judgment. */
    .panel { box-sizing: border-box; padding: 4px 6px; border: 1px solid #d5c8ad; border-radius: 8px; background: #fbf7ec; display: flex; flex-direction: column; justify-content: center; align-items: center; }
    .general { flex: 1; min-width: 0; }
    .equipment, .judgment-section { flex: none; }
    .equip { display: grid; grid-template-columns: repeat(2, 44px); gap: 5px; justify-content: center; }
    .generals { position: relative; }
    .generals.face-down app-seat-avatar { filter: grayscale(0.6) brightness(0.8); }
    .form-badge, .silenced-badge { align-self: center; padding: 0 6px; border-radius: 6px; font-size: 11px; background: #3b2f2a; color: #fbf7ec; }
    .chain-badge { align-self: center; padding: 0 6px; border-radius: 6px; font-size: 11px; background: #5a4a3a; color: #fbf7ec; border: 1px dashed #d5c8ad; }
    .chain-badge::before { content: '⛓ '; }
    .face-down-badge { position: absolute; top: 2px; left: 50%; transform: translateX(-50%); padding: 0 6px; border-radius: 6px; font-size: 11px; background: #3b2f2a; color: #fbf7ec; }
    .pile { display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; }
    .slot { position: relative; width: 44px; height: 60px; border-radius: 3px; overflow: hidden; display: grid; place-items: center; background: #f1ece2; border: 1px solid #d5c8ad; }
    /* A card placed as another (Country Scene's Capture): named over its bottom edge. */
    .counts-as { position: absolute; left: 0; right: 0; bottom: 0; font-size: 9px; line-height: 1.2; text-align: center; background: rgb(251 247 236 / 0.9); pointer-events: none; }
    .slot-card { padding: 0; border: none; background: none; cursor: pointer; display: block; }
    .slot-card:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: -2px; }
    .judgment { display: flex; flex-direction: column; gap: 5px; align-items: center; }
    .slot.empty mat-icon { font-size: 22px; width: 22px; height: 22px; color: #b9a37a; }
  `,
})
export class SeatTile {
  readonly seat = input.required<Seat>();
  readonly name = input.required<string>();
  readonly handCount = input.required<number>();
  readonly isTurnOwner = input(false);
  // The viewer's own active skills, shown on the avatar.
  readonly skills = input<AvatarSkill[]>([]);
  readonly useSkill = output<Action>();
  readonly isResponding = input(false);
  readonly isViewer = input(false);
  readonly isBot = input(false);
  readonly equipment = input<CardInstance[]>([]);
  readonly judgment = input<CardInstance[]>([]);
  // The cards kept face up under the seat's General (Refusing Death).
  readonly pile = input<CardInstance[]>([]);
  // Cards in the seat's stash pile (Deng Ai's Farms), face up.
  readonly stash = input<CardInstance[]>([]);
  // The General whose skill Zuo Ci holds now (his chosen Form), shown to everyone.
  readonly formName = computed(() => {
    const chosen = this.seat().forms?.chosen;
    return chosen ? this.i18n.t('seat.formName', { general: generalDisplayData(chosen.generalId, this.i18n.locale())?.name ?? this.i18n.t('seat.formFallback'), skill: abilityName(chosen.skillId, this.i18n.locale()) }) : null;
  });
  // Whether the seat is dying, when the parent knows (a seat Refusing Death
  // keeps alive below 1 HP isn't); null: judged by its HP.
  readonly dying = input<boolean | null>(null);
  // What each Judgment slot card counts as, when placed as another card.
  readonly judgmentCountsAs = input<Record<string, string>>({});

  // Wei, Shu, Wu or Qun once known to the viewer; 'none' while hidden (or for a
  // seat that belongs to no force).
  protected readonly force = computed(() => seatForce(this.seat()));
  protected readonly ambitionistIcon = AMBITIONIST_ICON_URL;
  protected readonly hpIcons = computed(() => hpIconUrls(this.seat().combinedHp));


  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);

  protected openInfo(card: CardInstance): void {
    this.dialog.open<CardInfoDialog, CardInfoDialogData>(CardInfoDialog, {
      data: { card, name: CardInfoDialog.nameFor(card.definitionId, undefined, this.i18n.translator) },
      width: 'min(92vw, 480px)',
    });
  }


  protected readonly slots = computed(() =>
    EQUIP_SLOTS.map((slot) => ({
      slot,
      label: this.i18n.t(SLOT_LABELS[slot].label),
      icon: SLOT_LABELS[slot].icon,
      card: this.equipment().find((c) => equipSlotOf(c.definitionId) === slot) ?? null,
    }))
  );
  protected cardName(definitionId: string): string {
    return cardIdDisplayName(definitionId, this.i18n.translator);
  }

  protected kingdomName(seat: Parameters<typeof seatKingdomLabel>[0]): string {
    return seatKingdomLabel(seat, this.i18n.translator);
  }
}
