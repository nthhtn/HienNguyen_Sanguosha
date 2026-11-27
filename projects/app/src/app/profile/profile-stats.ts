import { Component, inject, input } from '@angular/core';
import type { Force, ProfileStats } from 'protocol';
import { CardArt } from '../game-board/card-art';
import { I18n } from '../i18n/i18n.service';
import { TPipe } from '../i18n/t.pipe';
import { generalDisplayName, kingdomDisplayName } from '../labels';

// The Stats tab: the numbers the server computed, laid out. Nothing here
// counts a game or decides a win.
@Component({
  selector: 'app-profile-stats',
  imports: [CardArt, TPipe],
  styleUrl: './profile.css',
  template: `
    @if (stats().totals.games === 0) {
      <p class="empty">{{ 'myGames.empty' | t }}</p>
    } @else {
      <div class="tiles">
        <div class="tile"><span class="tile-label">{{ 'profile.tile.games' | t }}</span><span class="tile-value">{{ stats().totals.games }}</span></div>
        <div class="tile"><span class="tile-label">{{ 'profile.tile.wins' | t }}</span><span class="tile-value">{{ stats().totals.wins }}</span></div>
        <div class="tile"><span class="tile-label">{{ 'profile.tile.losses' | t }}</span><span class="tile-value">{{ stats().totals.losses }}</span></div>
        <div class="tile"><span class="tile-label">{{ 'profile.tile.winRate' | t }}</span><span class="tile-value">{{ percent(stats().totals.winRate) }}</span></div>
        @if (stats().totals.noOutcome > 0) {
          <div class="tile"><span class="tile-label">{{ 'profile.tile.noResult' | t }}</span><span class="tile-value">{{ stats().totals.noOutcome }}</span></div>
        }
      </div>
      <p class="streak hint">{{ 'profile.streak' | t: { current: stats().streak.current, best: stats().streak.best } }}</p>

      @if (stats().form.length > 0) {
        <h2>{{ 'profile.form' | t }}</h2>
        <div class="form-row">
          @for (entry of stats().form; track entry.gameId) {
            <span class="form-chip" [class]="entry.result" [attr.title]="resultLabel(entry.result)" [attr.aria-label]="resultLabel(entry.result)">{{ glyph(entry.result) }}</span>
          }
        </div>
      }

      @if (stats().byForce.length > 0) {
        <h2>{{ 'profile.forces' | t }}</h2>
        <ul class="table">
          <li class="table-head">
            <span class="name">{{ 'profile.col.force' | t }}</span><span>{{ 'profile.tile.games' | t }}</span><span>{{ 'profile.tile.wins' | t }}</span><span>{{ 'profile.tile.losses' | t }}</span><span>{{ 'profile.tile.winRate' | t }}</span>
          </li>
          @for (row of stats().byForce; track row.force) {
            <li class="force-row" [class]="'force-row force-' + row.force">
              <span class="name">{{ forceName(row.force) }}</span><span>{{ row.games }}</span><span>{{ row.wins }}</span><span>{{ row.losses }}</span><span>{{ percent(row.winRate) }}</span>
            </li>
          }
        </ul>
      }

      @if (stats().topGenerals.length > 0) {
        <h2>{{ 'profile.generals' | t }}</h2>
        <ul class="table">
          <li class="table-head">
            <span class="name">{{ 'profile.col.general' | t }}</span><span>{{ 'profile.tile.games' | t }}</span><span>{{ 'profile.tile.wins' | t }}</span><span>{{ 'profile.tile.losses' | t }}</span><span>{{ 'profile.tile.winRate' | t }}</span>
          </li>
          @for (row of stats().topGenerals; track row.generalId) {
            <li class="general-row">
              <span class="name"><app-card-art [skin]="true" [id]="row.generalId" [label]="generalName(row.generalId)" size="tiny" />{{ generalName(row.generalId) }}</span
              ><span>{{ row.games }}</span><span>{{ row.wins }}</span><span>{{ row.losses }}</span><span>{{ percent(row.winRate) }}</span>
            </li>
          }
        </ul>
      }
    }
  `,
})
export class ProfileStatsView {
  readonly stats = input.required<ProfileStats>();
  private readonly i18n = inject(I18n);

  protected percent(rate: number | null): string {
    return rate === null ? '—' : `${Math.round(rate * 100)}%`;
  }

  protected forceName(force: Force): string {
    return force === 'ambitionist' ? this.i18n.t('label.kingdom.Ambitionist') : kingdomDisplayName(force, this.i18n.translator);
  }

  protected generalName(id: string): string {
    return generalDisplayName(id, this.i18n.translator);
  }

  protected glyph(result: 'win' | 'loss' | 'none'): string {
    return result === 'win' ? '✓' : result === 'loss' ? '✗' : '–';
  }

  protected resultLabel(result: 'win' | 'loss' | 'none'): string {
    return this.i18n.t(result === 'win' ? 'myGames.won' : result === 'loss' ? 'myGames.lost' : 'profile.tile.noResult');
  }
}
