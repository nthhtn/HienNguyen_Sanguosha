import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { GameBoard } from '../game-board/game-board';
import { GameService } from '../game.service';
import { I18n } from '../i18n/i18n.service';
import type { MessageKey } from '../i18n/messages';
import { TPipe } from '../i18n/t.pipe';
import { defaultGroupIndex, doneCount, groupedLessons } from './lesson-groups';
import { TutorialOverlay, OVERLAY_Z_INDEX } from './tutorial-overlay';
import { TutorialReplaceDialog } from './tutorial-replace-dialog';
import { TUTORIAL_LESSONS, TutorialService } from './tutorial.service';
import { Lesson, LessonId } from './tutorial-types';

// The Tutorial at /tutorial: the list of lessons while none runs; the real board with the spotlight while one does; and,
// once it is finished, the way on (Next Lesson) or back. It decides nothing about the lesson: TutorialService runs it.
@Component({
  selector: 'app-tutorial-page',
  imports: [GameBoard, TutorialOverlay, MatButtonModule, MatIconModule, MatTabsModule, TPipe],
  template: `
    @if (!tutorial.lesson()) {
      <div class="page">
        <h2>{{ 'tutorial.page.title' | t }}</h2>
        <p class="intro">{{ 'tutorial.page.intro' | t }}</p>
        <mat-tab-group [selectedIndex]="selectedTab()" (selectedIndexChange)="selectedTab.set($event)" animationDuration="0ms">
          @for (group of groups; track group.group.id) {
            <mat-tab [label]="groupLabel(group)">
              <ul class="lessons">
                @for (lesson of group.lessons; track lesson.id) {
                  <li class="lesson" [attr.data-lesson]="lesson.id">
                    <div class="text">
                      <h3>{{ lesson.titleKey | t }}</h3>
                      @if (tutorial.completed().has(lesson.id)) {
                        <span class="done"><mat-icon aria-hidden="true">check_circle</mat-icon>{{ 'tutorial.done' | t }}</span>
                      }
                      <p class="summary">{{ lesson.summaryKey | t }}</p>
                    </div>
                    <button mat-flat-button type="button" class="start" (click)="start(lesson.id)">{{ 'tutorial.start' | t }}</button>
                  </li>
                }
              </ul>
            </mat-tab>
          }
        </mat-tab-group>
      </div>
    } @else {
      <app-game-board />
      <app-tutorial-overlay />
      @if (tutorial.finished()) {
        <section class="finished" role="status" [style.z-index]="finishedZIndex">
          <p>{{ 'tutorial.finished' | t }}</p>
          <div class="buttons">
            <button mat-button type="button" class="back" (click)="back()">{{ 'tutorial.backToLessons' | t }}</button>
            @if (nextLesson(); as next) {
              <button mat-flat-button type="button" class="next-lesson" (click)="startNext(next)">{{ 'tutorial.nextLesson' | t }}</button>
            }
          </div>
        </section>
      }
    }
  `,
  styles: `
    :host { display: block; }
    .page { max-width: 720px; margin: 0 auto; padding: 16px; }
    h2 { margin: 8px 0; font: var(--mat-sys-headline-small); }
    .intro { margin: 0 0 16px; color: var(--mat-sys-on-surface-variant); }
    .lessons { list-style: none; margin: 0; padding: 12px 0 0; display: grid; gap: 12px; }
    .lesson {
      display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px;
      border-radius: 16px; background: var(--mat-sys-surface-container);
    }
    .text { min-width: 0; }
    h3 { display: inline; margin: 0 8px 0 0; font: var(--mat-sys-title-medium); }
    .done { display: inline-flex; align-items: center; gap: 4px; color: var(--mat-sys-primary); font: var(--mat-sys-label-large); }
    .done mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .summary { margin: 4px 0 0; color: var(--mat-sys-on-surface-variant); }
    .start { flex: none; min-height: 44px; }
    .finished {
      position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); box-sizing: border-box;
      width: 340px; max-width: calc(100vw - 16px); padding: 16px; border-radius: 16px;
      background: var(--mat-sys-surface-container-high); color: var(--mat-sys-on-surface); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
    }
    .finished p { margin: 0 0 12px; font-size: 1rem; }
    .buttons { display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
  `,
})
export class TutorialPage implements OnDestroy {
  protected readonly tutorial = inject(TutorialService);
  private readonly game = inject(GameService);
  private readonly dialog = inject(MatDialog);
  private readonly i18n = inject(I18n);
  protected readonly lessons = inject(TUTORIAL_LESSONS);
  protected readonly groups = groupedLessons(this.lessons);
  // The tab shown: the first with a lesson left, until the beginner moves it or comes back from a lesson.
  protected readonly selectedTab = signal(defaultGroupIndex(this.groups, this.tutorial.completed()));
  // At the same level as the spotlight, which is gone once the lesson is finished.
  protected readonly finishedZIndex = OVERLAY_Z_INDEX;

  // The lesson after the finished one in the list, none after the last.
  protected readonly nextLesson = computed<LessonId | null>(() => {
    const current = this.tutorial.lesson();
    const at = current ? this.lessons.findIndex((l) => l.id === current.id) : -1;
    return this.lessons[at + 1]?.id ?? null;
  });

  // "Basics (2 of 5)".
  protected groupLabel(group: { group: { titleKey: MessageKey }; lessons: Lesson[] }): string {
    return this.i18n.t('tutorial.group.progress', {
      name: this.i18n.t(group.group.titleKey),
      done: doneCount(group.lessons, this.tutorial.completed()),
      total: group.lessons.length,
    });
  }

  // A lesson replaces the game in progress on this device (it is not restored), so that asks first.
  protected start(id: LessonId): void {
    if (this.game.state() === null) {
      this.tutorial.start(id);
      return;
    }
    this.dialog
      .open<TutorialReplaceDialog, void, boolean>(TutorialReplaceDialog, { width: 'min(92vw, 420px)' })
      .beforeClosed()
      .subscribe((confirmed) => {
        if (confirmed) this.tutorial.start(id);
      });
  }

  // The game on screen is the finished lesson's own, so there is nothing of the beginner's to lose.
  protected startNext(id: LessonId): void {
    this.tutorial.start(id);
  }

  // Back to the tab of the lesson that was played.
  protected back(): void {
    const last = this.tutorial.lastGroup();
    const at = last ? this.groups.findIndex((g) => g.group.id === last) : -1;
    if (at !== -1) this.selectedTab.set(at);
    this.tutorial.exit();
  }

  ngOnDestroy(): void {
    this.tutorial.exit();
  }
}
