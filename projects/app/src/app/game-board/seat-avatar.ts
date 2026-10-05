import { Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { GeneralInstance, SeatGenerals } from 'engine';
import { cardArtUrl, generalDisplayData, HIDDEN_GENERAL_ART_URL } from 'content';
import { generalDisplayName } from '../labels';
import { GeneralInfoDialog, GeneralInfoDialogData } from './general-info-dialog';

const HIDDEN_ID = 'hidden';

interface AvatarHalf {
  slot: 'main' | 'deputy';
  id: string;
  // Another seat's General that hasn't been revealed: only the card back is known.
  masked: boolean;
  // The viewer's own General that is still face-down to everyone else.
  ownHidden: boolean;
  url: string | null;
  caption: string;
  name: string;
}

function toHalf(slot: 'main' | 'deputy', general: GeneralInstance): AvatarHalf {
  const id = general.generalDefinitionId;
  if (id === HIDDEN_ID) {
    return { slot, id, masked: true, ownHidden: false, url: HIDDEN_GENERAL_ART_URL, caption: 'Hidden', name: 'Hidden General' };
  }
  const name = generalDisplayData(id)?.name ?? generalDisplayName(id);
  const ownHidden = !general.revealed;
  return { slot, id, masked: false, ownHidden, url: cardArtUrl(id), caption: ownHidden ? `${name} (hidden)` : name, name };
}

// One seat's Generals as a single split portrait: Main left, Deputy right.
// The frame takes the force colour from the enclosing tile's --force.
@Component({
  selector: 'app-seat-avatar',
  imports: [MatIconModule],
  template: `
    <div class="frame">
      @for (h of halves(); track h.slot) {
        <button
          type="button"
          class="half"
          [attr.data-slot]="h.slot"
          [class.own-hidden]="h.ownHidden"
          [disabled]="h.masked"
          [attr.aria-label]="h.masked ? h.name : 'Info: ' + h.name"
          (click)="openInfo(h)"
        >
          @if (h.url; as url) {
            <img [src]="url" [alt]="h.name" />
          } @else {
            <span class="placeholder"></span>
          }
          @if (h.ownHidden) {
            <mat-icon class="eye-off" aria-hidden="true">visibility_off</mat-icon>
          }
          <span class="caption">{{ h.caption }}</span>
        </button>
      }
    </div>
  `,
  styles: `
    .frame {
      display: flex;
      width: 146px;
      height: 96px;
      border: 2px solid var(--force, var(--force-none));
      border-radius: 10px;
      overflow: hidden;
      box-sizing: border-box;
      background: #f1ece2;
    }
    .half {
      position: relative;
      flex: 1;
      min-width: 0;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      display: block;
    }
    .half + .half { border-left: 1px solid rgb(0 0 0 / 35%); }
    .half:disabled { cursor: default; }
    .half:focus-visible { outline: 2px solid #1565c0; outline-offset: -2px; }
    img, .placeholder { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top; }
    .placeholder { background: #e0d8c6; }
    .own-hidden img { filter: brightness(0.6) saturate(0.6); }
    .eye-off { position: absolute; top: 3px; right: 3px; font-size: 16px; width: 16px; height: 16px; color: #fff; }
    .caption {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      padding: 8px 2px 2px;
      font-size: 0.62em;
      line-height: 1.15;
      color: #fff;
      background: linear-gradient(transparent, rgb(0 0 0 / 70%));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class SeatAvatar {
  readonly generals = input.required<SeatGenerals>();

  protected readonly halves = computed(() => [toHalf('main', this.generals().main), toHalf('deputy', this.generals().deputy)]);

  private readonly dialog = inject(MatDialog);

  protected openInfo(h: AvatarHalf): void {
    if (h.masked) return;
    this.dialog.open<GeneralInfoDialog, GeneralInfoDialogData>(GeneralInfoDialog, {
      data: { generalDefinitionId: h.id },
      width: 'min(92vw, 520px)',
    });
  }
}
