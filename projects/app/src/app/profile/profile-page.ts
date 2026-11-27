import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { ProfileMode } from 'protocol';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TMsgPipe } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';
import { MyGamesList } from '../online/my-games-list';
import { ProfileSettings } from './profile-settings';
import { ProfileStatsView } from './profile-stats';
import { ProfileService } from './profile.service';

type Tab = 'stats' | 'history' | 'settings';
const TABS: readonly { id: Tab; label: MessageKey }[] = [
  { id: 'stats', label: 'profile.tab.stats' },
  { id: 'history', label: 'profile.tab.history' },
  { id: 'settings', label: 'profile.tab.settings' },
];
const MODES: readonly { id: ProfileMode; label: MessageKey }[] = [
  { id: 'all', label: 'profile.mode.all' },
  { id: 'solo', label: 'profile.mode.solo' },
  { id: 'online', label: 'profile.mode.online' },
];

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
            @for (item of tabs; track item.id) {
              <button type="button" role="tab" [class]="'tab tab-' + item.id" [class.active]="tab() === item.id" [attr.aria-selected]="tab() === item.id" (click)="tab.set(item.id)">{{ item.label | t }}</button>
            }
          </div>
          @switch (tab()) {
            @case ('stats') {
              <div class="modes" role="group" [attr.aria-label]="'profile.mode.aria' | t">
                @for (item of modes; track item.id) {
                  <button type="button" [class]="'mode mode-' + item.id" [class.active]="service.mode() === item.id" [attr.aria-pressed]="service.mode() === item.id" (click)="setMode(item.id)">{{ item.label | t }}</button>
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
              @if (service.error(); as text) {
                <p class="error" role="alert">{{ text | tm }}</p>
              }
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
  return TABS.find((item) => item.id === raw)?.id ?? 'stats';
}
