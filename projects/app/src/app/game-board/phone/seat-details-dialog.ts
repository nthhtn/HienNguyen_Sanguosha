import { Component, Signal, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CardInstance, EQUIP_SLOTS, GameState, GeneralInstance, isSeatDying } from 'engine';
import { abilityName, equipSlotOf, generalDisplayData, generalSkinUrl, HIDDEN_GENERAL_ART_URL } from 'content';
import { cardIdDisplayName, generalDisplayName, seatForce, seatName } from '../../labels';
import { I18n } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import type { MessageKey } from '../../i18n/messages';
import { localeOf } from '../../i18n/translator';
import { CardInfoDialog, CardInfoDialogData } from '../card-info-dialog';
import { GeneralInfoDialog, GeneralInfoDialogData } from '../general-info-dialog';
import { PlayingCard } from '../playing-card';
import { SLOT_ICONS } from './phone-seat-tile';

// The live state (the board's visible, redacted state) and the seat to show. A signal, so the window follows the game.
export interface SeatDetailsData {
  state: Signal<GameState>;
  seatId: string;
}

interface CardSection {
  key: string;
  title: MessageKey;
  cards: { card: CardInstance; name: string; countsAs: string | null }[];
}

// What a tap on a phone seat tile opens (spec, "The phone board"): everything the tile is too small to show, by name,
// with each General and card opening its existing info window. It shows only what the visible state holds.
@Component({
  selector: 'app-seat-details-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButtonModule, MatIconModule, PlayingCard, TPipe],
  template: `
    @if (seat(); as seat) {
      <h2 mat-dialog-title [attr.data-force]="force()">{{ name() }}</h2>
      <mat-dialog-content>
        <p class="summary">
          {{ 'seat.hp' | t: { hp: seat.combinedHp, max: seat.maxCombinedHp } }} · {{ 'seat.handAria' | t: { n: handCount() } }}
        </p>
        @if (states().length) {
          <p class="states">
            @for (state of states(); track state) {
              <span class="state">{{ state }}</span>
            }
          </p>
        }
        <div class="generals">
          @for (g of generals(); track g.slot) {
            <section class="general" [attr.data-slot]="g.slot">
              @if (g.hidden) {
                <img class="portrait hidden" [src]="hiddenArt" alt="" />
                <div class="text"><span class="general-name">{{ 'avatar.hidden' | t }}</span></div>
              } @else {
                <button type="button" class="open-general" (click)="openGeneral(g.id)">
                  <img class="portrait" [src]="g.url" alt="" />
                  <span class="text">
                    <span class="general-name">{{ g.name }}</span>
                    @for (skill of g.skills; track skill) {
                      <span class="skill">{{ skill }}</span>
                    }
                  </span>
                </button>
              }
              @if (g.form; as form) {
                <p class="form">{{ 'seat.form' | t: { form: form } }}</p>
              }
            </section>
          }
        </div>
        <div class="cards-area" [class.with-judgment]="judgmentCards().length > 0">
        <section class="equipment">
          <h3>{{ 'seat.equipment' | t }}</h3>
          <div class="slots">
            @for (s of equipmentSlots(); track s.slot) {
              @if (s.card; as equipped) {
                <button type="button" class="card slot" [attr.data-slot]="s.slot" [attr.aria-label]="s.name" (click)="openCard(equipped, s.name)">
                  <app-playing-card [card]="equipped" />
                </button>
              } @else {
                <div class="slot empty" [attr.data-slot]="s.slot" [attr.title]="'seat.slotEmpty' | t: { slot: s.label }">
                  <mat-icon aria-hidden="true">{{ s.icon }}</mat-icon>
                  <span>{{ s.label }}</span>
                </div>
              }
            }
          </div>
        </section>
        @if (judgmentCards().length) {
          <section class="judgment">
            <h3>{{ 'seat.judgment' | t }}</h3>
            <div class="slots">
              @for (entry of judgmentCards(); track entry.card.instanceId) {
                <button type="button" class="card slot" [attr.aria-label]="entry.name" (click)="openCard(entry.card, entry.name)">
                  <app-playing-card [card]="entry.card" />
                  @if (entry.countsAs; as countsAs) {
                    <span class="counts-as">{{ 'seat.countsAs' | t: { card: countsAs } }}</span>
                  }
                </button>
              }
            </div>
          </section>
        }
        </div>
        @for (section of sections(); track section.key) {
          <section [class]="section.key">
            <h3>{{ section.title | t }}</h3>
            @for (entry of section.cards; track entry.card.instanceId) {
              <button type="button" class="card" (click)="openCard(entry.card, entry.name)">
                {{ entry.name }}
                @if (entry.countsAs; as countsAs) {
                  <span class="counts-as">{{ 'seat.countsAs' | t: { card: countsAs } }}</span>
                }
              </button>
            }
          </section>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-flat-button type="button" class="close" (click)="ref.close()">{{ 'ui.close' | t }}</button>
      </mat-dialog-actions>
    }
  `,
  styles: `
    h2 { color: var(--force-text, inherit); }
    .summary, .states, .form { margin: 0 0 8px; font-size: 14px; }
    .summary { font-weight: 700; }
    .states { display: flex; flex-wrap: wrap; gap: 6px; }
    .state { padding: 2px 8px; border-radius: 10px; background: var(--mat-sys-surface-container-high); font-size: 14px; }
    .generals { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; }
    .general { flex: 1 1 200px; min-width: 0; }
    .open-general {
      display: flex; gap: 10px; align-items: flex-start; width: 100%; min-height: 44px; padding: 4px; text-align: left;
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer;
    }
    .general:has(.hidden) { display: flex; gap: 10px; align-items: center; }
    .portrait { flex: none; width: 48px; height: 64px; object-fit: cover; object-position: top; border-radius: 6px; }
    .portrait.hidden { background: var(--mat-sys-surface-container-high); }
    .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .general-name { font-size: 14px; font-weight: 600; }
    .skill { font-size: 14px; color: var(--mat-sys-on-surface-variant); }
    h3 { margin: 8px 0 4px; font-size: 14px; font-weight: 600; }
    .card {
      display: block; width: 100%; min-height: 44px; margin-bottom: 4px; padding: 4px 10px; text-align: left;
      border: 1px solid var(--mat-sys-outline-variant); border-radius: 8px; background: transparent; color: inherit; font-size: 14px; cursor: pointer;
    }
    .slots { display: grid; grid-template-columns: repeat(4, 70px); gap: 8px; justify-content: space-around; }
    /* With Judgment cards: Equipment 2 x 2 on the left, Judgment in up to 3 columns on the right (spec 3g). */
    .cards-area.with-judgment { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0 24px; }
    .cards-area.with-judgment .equipment .slots { grid-template-columns: repeat(2, 70px); justify-content: start; }
    .cards-area.with-judgment .judgment .slots { grid-template-columns: repeat(3, 70px); justify-content: start; }
    .card.slot { width: auto; min-height: 0; margin: 0; padding: 0; border: 0; border-radius: 4px; background: none; }
    .judgment .counts-as { width: 70px; }
    .slot.empty {
      box-sizing: border-box; width: 70px; height: 96px; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 4px; padding: 4px; text-align: center; border: 1px dashed var(--mat-sys-outline); border-radius: 4px; opacity: 0.55; font-size: 12px;
    }
    .counts-as { display: block; font-size: 12px; color: var(--mat-sys-on-surface-variant); }
  `,
})
export class SeatDetailsDialog {
  private readonly data = inject<SeatDetailsData>(MAT_DIALOG_DATA);
  protected readonly ref = inject(MatDialogRef<SeatDetailsDialog>);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);

  private readonly state = computed(() => this.data.state());
  protected readonly seat = computed(() => this.state().seats.find((s) => s.id === this.data.seatId) ?? null);
  protected readonly name = computed(() => seatName(this.state().players, this.data.seatId, this.i18n.translator));
  protected readonly force = computed(() => {
    const seat = this.seat();
    return seat ? seatForce(seat) : 'none';
  });
  protected readonly handCount = computed(() => this.zone(this.seat()?.hand.zoneId).length);

  protected readonly states = computed(() => {
    const seat = this.seat();
    if (!seat) return [];
    const t = (key: MessageKey) => this.i18n.t(key);
    const states: string[] = [];
    if (seat.eliminated) states.push(t('seat.eliminated'));
    else if (isSeatDying(this.state(), seat.id)) states.push(t('seat.dying'));
    if (seat.faceDown) states.push(t('seat.faceDown'));
    if (seat.chained) states.push(t('seat.chained'));
    if (seat.silenced) states.push(t('seat.noSkills'));
    else for (const slot of seat.silencedSlots ?? []) states.push(t(slot === 'main' ? 'seat.noSkillsMain' : 'seat.noSkillsDeputy'));
    return states;
  });

  protected readonly generals = computed(() => {
    const seat = this.seat();
    if (!seat?.generals) return [];
    return [this.general('main', seat.generals.main), this.general('deputy', seat.generals.deputy)];
  });

  protected readonly hiddenArt = HIDDEN_GENERAL_ART_URL;

  // The four Equipment slots in their fixed order, filled or not (spec 3f).
  protected readonly equipmentSlots = computed(() => {
    const cards = this.zone(this.seat()?.equipped.zoneId);
    return EQUIP_SLOTS.map((slot) => {
      const card = cards.find((c) => equipSlotOf(c.definitionId) === slot) ?? null;
      return { slot, card, name: card ? this.cardName(card.definitionId) : '', label: this.i18n.t(SLOT_ICONS[slot].label), icon: SLOT_ICONS[slot].icon };
    });
  });

  // Judgment cards as card faces, with what a card counts as; none at all when there are none (spec 3g).
  protected readonly judgmentCards = computed(() => {
    const seat = this.seat();
    if (!seat) return [];
    const countsAs = this.state().zones.find((z) => z.id === seat.judgment.zoneId)?.countsAs ?? {};
    return this.zone(seat.judgment.zoneId).map((card) => ({
      card,
      name: this.cardName(card.definitionId),
      countsAs: countsAs[card.instanceId] ? this.cardName(countsAs[card.instanceId]) : null,
    }));
  });

  protected readonly sections = computed<CardSection[]>(() => {
    const seat = this.seat();
    if (!seat) return [];
    const section = (key: string, title: MessageKey, cards: CardInstance[]): CardSection => ({
      key,
      title,
      cards: cards.map((card) => ({ card, name: this.cardName(card.definitionId), countsAs: null })),
    });
    return [
      section('pile', 'seat.underGeneral', this.zone(seat.pile?.zoneId)),
      section('stash', 'seat.farms', this.zone(seat.stash?.zoneId)),
    ].filter((s) => s.cards.length > 0);
  });

  protected openGeneral(generalDefinitionId: string): void {
    this.dialog.open<GeneralInfoDialog, GeneralInfoDialogData>(GeneralInfoDialog, { data: { generalDefinitionId }, width: 'min(92vw, 520px)' });
  }

  protected openCard(card: CardInstance, name: string): void {
    this.dialog.open<CardInfoDialog, CardInfoDialogData>(CardInfoDialog, { data: { card, name }, width: 'min(92vw, 480px)' });
  }

  private general(slot: 'main' | 'deputy', general: GeneralInstance) {
    const id = general.generalDefinitionId;
    const locale = localeOf(this.i18n.translator);
    const forms = this.seat()?.forms;
    const chosen = forms?.chosen && forms.slot === slot ? forms.chosen : null;
    const form = chosen
      ? this.i18n.t('seat.formName', { general: generalDisplayData(chosen.generalId, locale)?.name ?? this.i18n.t('seat.formFallback'), skill: abilityName(chosen.skillId, locale) })
      : null;
    if (id === 'hidden') return { slot, id, hidden: true, url: null, name: '', skills: [] as string[], form };
    const display = generalDisplayData(id, locale);
    return {
      slot,
      id,
      hidden: false,
      url: generalSkinUrl(id),
      name: display?.name ?? generalDisplayName(id, this.i18n.translator),
      skills: (display?.skills ?? []).map((s) => s.name),
      form,
    };
  }

  private zone(zoneId: string | undefined): CardInstance[] {
    return zoneId ? (this.state().zones.find((z) => z.id === zoneId)?.cards ?? []) : [];
  }

  private cardName(definitionId: string): string {
    return cardIdDisplayName(definitionId, this.i18n.translator);
  }
}
