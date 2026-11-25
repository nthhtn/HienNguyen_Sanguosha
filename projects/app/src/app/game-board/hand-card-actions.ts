import { Component, computed, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Action, CardInstance, ContentRegistry, GameState, Target } from 'engine';
import { actionLabel, targetLabel, targetingParts } from '../labels';
import { TutorialAnchor } from '../tutorial/tutorial-anchor';
import { anchor } from '../tutorial/anchors';
import { TargetLabel } from './target-label';
import { CardInfoDialog, CardInfoDialogData } from './card-info-dialog';
import { TargetsDialog, TargetsDialogData } from './targets-dialog';
import { TPipe } from '../i18n/t.pipe';
import type { Translator } from '../i18n/translator';

type PlayCard = Extract<Action, { kind: 'PlayCardAction' }>;

export interface HandCardViewModel {
  card: CardInstance;
  name: string;
  actions: LabeledPlay[];
  // Two-seat plays (Coerce: the holder, then the victim), grouped by first seat.
  pairs: { seatId: string; labeled: LabeledPlay; seconds: LabeledPlay[] }[] | null;
  // A lone targeted play is still shown as a menu: the viewer decides whether
  // the only target is really the one they want.
  confirmTargets: boolean;
  // A play with several equal targets (Sha with Sky Scorcher): picked in the Choose Targets window.
  template: PlayCard | null;
  // Beside a template, the card's other plays (Chains' Recast): a menu then
  // offers the template's window and these.
  besideTemplate: LabeledPlay[];
  templateLabel: string;
}

// A menu entry: the plain label, and where its targets begin when it names any.
export interface LabeledPlay {
  action: Action;
  label: string;
  targeting: { prefix: string; targets: Target[] } | null;
}

function labeled(action: Action, state: GameState, registry: ContentRegistry, tr: Translator): LabeledPlay {
  return { action, label: actionLabel(action, state, registry, tr), targeting: targetingParts(action, state, registry, tr) };
}

function cardInstanceIdOf(action: Action): string | undefined {
  return action.kind === 'PlayCardAction' ? action.cardInstanceId : undefined;
}

// Two-seat plays grouped by their first seat, in order: "Play Coerce
// Targeting Seat 1", then "At Seat 2".
function groupPairs(plays: PlayCard[], state: GameState, registry: ContentRegistry, tr: Translator): NonNullable<HandCardViewModel['pairs']> {
  const groups: NonNullable<HandCardViewModel['pairs']> = [];
  for (const play of plays) {
    const [first, second]: Target[] = play.targets;
    let group = groups.find((g) => g.seatId === first.seatId);
    if (!group) {
      group = { seatId: first.seatId, labeled: labeled({ ...play, targets: [first] }, state, registry, tr), seconds: [] };
      groups.push(group);
    }
    group.seconds.push({ action: play, label: tr('hand.atTarget', { target: targetLabel(second, state.players, tr) }), targeting: { prefix: tr('hand.at'), targets: [second] } });
  }
  return groups;
}

// Each hand card's view model: its plays from the engine's legal actions for that card only, labelled for the menus.
export function handCardViewModels(cards: CardInstance[], legal: Action[], state: GameState, registry: ContentRegistry, tr: Translator): HandCardViewModel[] {
  return cards.map((card) => {
    const plays = legal.filter((a): a is PlayCard => a.kind === 'PlayCardAction' && a.cardInstanceId === card.instanceId);
    const pairs = plays.length > 0 && plays.every((p) => p.targets.length === 2) ? groupPairs(plays, state, registry, tr) : null;
    const actions = legal.filter((action) => cardInstanceIdOf(action) === card.instanceId).map((action) => labeled(action, state, registry, tr));
    const template = plays.find((p) => !!p.pickTargets) ?? null;
    return {
      card,
      name: CardInfoDialog.nameFor(card.definitionId, registry.cards.get(card.definitionId)?.name, tr),
      actions,
      pairs,
      confirmTargets: plays.length > 0 && plays.every((p) => p.targets.length > 0),
      template,
      besideTemplate: template ? actions.filter((a) => a.action !== template) : [],
      templateLabel: template ? actionLabel(template, state, registry, tr) : '',
    };
  });
}

// One hand card's buttons: Play (only when the card can be played: at once, through a menu of targets, or through the
// Choose Targets window) and Info. On the card on tablets and computers; in the action column on the phone board.
@Component({
  selector: 'app-hand-card-actions',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, TargetLabel, TPipe, TutorialAnchor],
  template: `
    @let v = vm();
      @if (v.template && v.besideTemplate.length > 0) {
        <button mat-flat-button type="button" class="play" [appTutorialAnchor]="playAnchor()" [matMenuTriggerFor]="withPick">
          <mat-icon>play_arrow</mat-icon> {{ 'hand.play' | t }}
        </button>
        <mat-menu #withPick="matMenu">
          <button mat-menu-item type="button" (click)="pickTargets(v)">{{ v.templateLabel }}</button>
          @for (choice of v.besideTemplate; track choice.action) {
            <button mat-menu-item type="button" (click)="played.emit(choice.action)"><app-target-label [label]="choice.label" [prefix]="choice.targeting?.prefix ?? null" [targets]="choice.targeting?.targets ?? []" [state]="state()" /></button>
          }
        </mat-menu>
      } @else if (v.template) {
        <button mat-flat-button type="button" class="play" [appTutorialAnchor]="playAnchor()" (click)="pickTargets(v)">
          <mat-icon>play_arrow</mat-icon> {{ 'hand.play' | t }}
        </button>
      } @else if (v.pairs) {
        <button mat-flat-button type="button" class="play" [appTutorialAnchor]="playAnchor()" [matMenuTriggerFor]="firsts">
          <mat-icon>play_arrow</mat-icon> {{ 'hand.play' | t }}
        </button>
        <mat-menu #firsts="matMenu">
          @for (group of v.pairs; track group.seatId) {
            <button mat-menu-item type="button" [matMenuTriggerFor]="seconds" [matMenuTriggerData]="{ group }"><app-target-label [label]="group.labeled.label" [prefix]="group.labeled.targeting?.prefix ?? null" [targets]="group.labeled.targeting?.targets ?? []" [state]="state()" /></button>
          }
        </mat-menu>
        <mat-menu #seconds="matMenu">
          <ng-template matMenuContent let-group="group">
            @for (second of group.seconds; track second.label) {
              <button mat-menu-item type="button" (click)="played.emit(second.action)"><app-target-label [label]="second.label" [prefix]="second.targeting?.prefix ?? null" [targets]="second.targeting?.targets ?? []" [state]="state()" /></button>
            }
          </ng-template>
        </mat-menu>
      } @else if (v.confirmTargets || v.actions.length > 1) {
        <button mat-flat-button type="button" class="play" [appTutorialAnchor]="playAnchor()" [matMenuTriggerFor]="choices">
          <mat-icon>play_arrow</mat-icon> {{ 'hand.play' | t }}
        </button>
        <mat-menu #choices="matMenu">
          @for (choice of v.actions; track choice.action) {
            <button mat-menu-item type="button" [appTutorialAnchor]="targetAnchor(choice.action)" (click)="played.emit(choice.action)"><app-target-label [label]="choice.label" [prefix]="choice.targeting?.prefix ?? null" [targets]="choice.targeting?.targets ?? []" [state]="state()" /></button>
          }
        </mat-menu>
      } @else if (v.actions.length > 0) {
        <button
          mat-flat-button
          type="button"
          class="play" [appTutorialAnchor]="playAnchor()"
          (click)="played.emit(v.actions[0].action)"
        >
          <mat-icon>play_arrow</mat-icon> {{ 'hand.play' | t }}
        </button>
      }
      <button mat-stroked-button type="button" class="info" (click)="openInfo(v)">
        <mat-icon>info</mat-icon> {{ 'hand.info' | t }}
      </button>
  `,
  styles: `
    :host { display: contents; }
  `,
})
export class HandCardActions {
  readonly vm = input.required<HandCardViewModel>();
  readonly state = input.required<GameState>();
  readonly played = output<Action>();

  // Every Play button of the card carries the same anchor, whichever way the card is played.
  protected readonly playAnchor = computed(() => anchor.playButton(this.vm().card.definitionId));

  // A menu item that plays the card on one seat, for a Tutorial step to spotlight once the menu has opened.
  protected targetAnchor(action: Action): string | null {
    const target = action.kind === 'PlayCardAction' && action.targets.length === 1 ? action.targets[0] : null;
    return target?.kind === 'seat' ? anchor.targetSeat(target.seatId) : null;
  }

  private readonly dialog = inject(MatDialog);

  // The Choose Targets window, then the play at the seats picked (none: nothing is played).
  protected pickTargets(vm: HandCardViewModel): void {
    const template = vm.template;
    if (!template?.pickTargets) return;
    this.dialog
      .open<TargetsDialog, TargetsDialogData, string[]>(TargetsDialog, { data: { title: vm.name, pick: template.pickTargets, state: this.state() }, width: 'min(92vw, 420px)' })
      .beforeClosed()
      .subscribe((ids) => {
        if (!ids?.length) return;
        const { pickTargets: _pick, ...play } = template;
        this.played.emit({ ...play, targets: ids.map((seatId) => ({ kind: 'seat' as const, seatId })) });
      });
  }

  protected openInfo(vm: HandCardViewModel): void {
    this.dialog.open<CardInfoDialog, CardInfoDialogData>(CardInfoDialog, {
      data: { card: vm.card, name: vm.name },
      width: 'min(92vw, 480px)',
    });
  }
}
