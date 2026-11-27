import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { ProfileMode } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import { TMsgPipe } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { MyGamesList } from '../online/my-games-list';
import { ProfileSettings } from './profile-settings';
import { ProfileStatsView } from './profile-stats';
import { ProfileService } from './profile.service';

type Tab = 'stats' | 'history' | 'settings';
const TABS: readonly Tab[] = ['stats', 'history', 'settings'];
const MODES: readonly ProfileMode[] = ['all', 'solo', 'online'];

// A registered player's Profile: their stats, their finished games and their settings.
@Component({
  selector: 'app-profile-page',
  imports: [MatButtonModule, MatCardModule, TPipe, TMsgPipe, ProfileStatsView, ProfileSettings, MyGamesList],
  providers: [ProfileService],
  styleUrls: ['../online/online-page.css', './profile.css'],
  template: `
    <div class="online-page">
      <mat-card class="online-card" appearance="raised">
        <mat-card-header>
          <h1 class="title">{{ service.stats()?.displayName ?? ('profile.title' | t) }}</h1>
        </mat-card-header>
        <mat-card-content>
          @if (service.stats(); as stats) {
            <p class="since hint">{{ 'profile.since' | t: { date: since(stats.memberSince) } }}</p>
          }
          <div class="tabs" role="tablist" [attr.aria-label]="'profile.tabs' | t">
            @for (id of tabs; track id) {
              <button type="button" role="tab" [class]="'tab tab-' + id" [class.active]="tab() === id" [attr.aria-selected]="tab() === id" (click)="tab.set(id)">{{ 'profile.tab.' + id | t }}</button>
            }
          </div>
          @switch (tab()) {
            @case ('stats') {
              <div class="modes" role="group" [attr.aria-label]="'profile.mode.aria' | t">
                @for (id of modes; track id) {
                  <button type="button" [class]="'mode mode-' + id" [class.active]="service.mode() === id" [attr.aria-pressed]="service.mode() === id" (click)="setMode(id)">{{ 'profile.mode.' + id | t }}</button>
                }
              </div>
              @if (service.error(); as text) {
                <p class="error" role="alert">{{ text | tm }}</p>
              }
              @if (service.stats(); as stats) {
                <app-profile-stats [stats]="stats" />
              } @else if (!service.error()) {
                <p class="loading">{{ 'profile.loading' | t }}</p>
              }
            }
            @case ('history') {
              <app-my-games-list />
            }
            @case ('settings') {
              @if (service.stats(); as stats) {
                <app-profile-settings [displayName]="stats.displayName" />
              } @else if (!service.error()) {
                <p class="loading">{{ 'profile.loading' | t }}</p>
              }
            }
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
})
export class ProfilePage {
  protected readonly service = inject(ProfileService);
  private readonly i18n = inject(I18n);
  protected readonly tabs = TABS;
  protected readonly modes = MODES;
  protected readonly tab = signal<Tab>(initialTab(inject(ActivatedRoute).snapshot.queryParamMap.get('tab')));

  constructor() {
    void this.service.load();
  }

  protected setMode(mode: ProfileMode): void {
    void this.service.setMode(mode);
  }

  protected since(at: number): string {
    const locale = this.i18n.locale();
    return new Date(at).toLocaleDateString(locale === 'en' ? undefined : locale, { dateStyle: 'medium' });
  }
}

function initialTab(raw: string | null): Tab {
  return TABS.find((id) => id === raw) ?? 'stats';
}
