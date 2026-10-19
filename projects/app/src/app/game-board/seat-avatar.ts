import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Action, GeneralInstance, SeatGenerals } from 'engine';
import { generalDisplayData, HIDDEN_GENERAL_ART_URL, generalSkinUrl } from 'content';
import { generalDisplayName } from '../labels';
import { GeneralInfoDialog, GeneralInfoDialogData } from './general-info-dialog';
import { AvatarReveal, AvatarSkill } from './avatar-skills';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { localeOf, type Translator } from '../i18n/translator';

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

function toHalf(slot: 'main' | 'deputy', general: GeneralInstance, tr: Translator): AvatarHalf {
  const id = general.generalDefinitionId;
  if (id === HIDDEN_ID) {
    return { slot, id, masked: true, ownHidden: false, url: HIDDEN_GENERAL_ART_URL, caption: tr('avatar.hidden'), name: generalDisplayName(id, tr) };
  }
  const name = generalDisplayData(id, localeOf(tr))?.name ?? generalDisplayName(id, tr);
  const ownHidden = !general.revealed;
  return { slot, id, masked: false, ownHidden, url: generalSkinUrl(id), caption: ownHidden ? tr('avatar.hiddenOwn', { name }) : name, name };
}

// One seat's Generals as a single split portrait: Main left, Deputy right.
// The frame takes the force colour from the enclosing tile's --force.
@Component({
  selector: 'app-seat-avatar',
  imports: [MatIconModule, TPipe],
  template: `
    <div class="frame">
      @for (h of halves(); track h.slot) {
        <button
          type="button"
          class="half"
          [attr.data-slot]="h.slot"
          [class.own-hidden]="h.ownHidden"
          [disabled]="h.masked"
          [attr.aria-label]="h.masked ? h.name : ('ui.info' | t: { name: h.name })"
          (click)="openInfo(h)"
        >
          @if (h.url && !failedUrls().has(h.url)) {
            <img [src]="h.url" [alt]="h.name" (error)="markFailed(h.url)" />
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
    @if (skills().length || reveals().length) {
      <div class="skills">
        @for (slot of slots; track slot) {
          <div class="skill-column" [attr.data-slot]="slot">
            @if (revealOf(slot); as r) {
              <button type="button" class="skill reveal" [disabled]="!r.action" (click)="r.action && revealGeneral.emit(r.action)">{{ 'avatar.reveal' | t }}</button>
            }
            @for (s of skillsOf(slot); track s.skillId) {
              <button type="button" class="skill" [disabled]="!s.action" (click)="s.action && useSkill.emit(s.action)">{{ s.label }}</button>
            }
          </div>
        }
      </div>
    }
  `,
  styles: `
    .frame {
      display: flex;
      width: 190px;
      height: 132px;
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
    .half:focus-visible { outline: 2px solid var(--mat-sys-primary); outline-offset: -2px; }
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
    .skills { display: flex; width: 190px; gap: 2px; margin-top: 3px; }
    .skill-column { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .skill {
      padding: 2px 4px; border: 1px solid var(--force, var(--force-none)); border-radius: 6px;
      background: #fff; font-size: 0.62em; line-height: 1.2; cursor: pointer;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .skill:disabled { opacity: 0.45; cursor: default; }
    .skill:focus-visible { outline: 2px solid #1565c0; outline-offset: 1px; }
  `,
})
export class SeatAvatar {
  readonly generals = input.required<SeatGenerals>();
  // The viewer's own active skills, as buttons under each half.
  readonly skills = input<AvatarSkill[]>([]);
  readonly useSkill = output<Action>();
  // The viewer's own hidden Generals' Reveal buttons.
  readonly reveals = input<AvatarReveal[]>([]);
  readonly revealGeneral = output<Action>();
  private readonly i18n = inject(I18n);
  protected readonly slots = ['main', 'deputy'] as const;
  protected revealOf(slot: 'main' | 'deputy'): AvatarReveal | undefined {
    return this.reveals().find((r) => r.slot === slot);
  }

  protected skillsOf(slot: 'main' | 'deputy'): AvatarSkill[] {
    return this.skills().filter((s) => s.slot === slot);
  }

  protected readonly halves = computed(() => [toHalf('main', this.generals().main, this.i18n.translator), toHalf('deputy', this.generals().deputy, this.i18n.translator)]);

  // Art that didn't load (e.g. not crawled on this machine) falls back to the
  // captioned placeholder rather than a broken image.
  protected readonly failedUrls = signal<ReadonlySet<string>>(new Set());

  protected markFailed(url: string): void {
    this.failedUrls.update((urls) => new Set(urls).add(url));
  }

  private readonly dialog = inject(MatDialog);

  protected openInfo(h: AvatarHalf): void {
    if (h.masked) return;
    this.dialog.open<GeneralInfoDialog, GeneralInfoDialogData>(GeneralInfoDialog, {
      data: { generalDefinitionId: h.id },
      width: 'min(92vw, 520px)',
    });
  }
}
