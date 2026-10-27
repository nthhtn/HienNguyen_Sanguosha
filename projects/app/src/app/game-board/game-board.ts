import { Component, DestroyRef, Injector, afterNextRender, computed, effect, inject, untracked } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Action, CardInstance, ChooseGeneralsAction, Seat, discardOwed, isSeatDying } from 'engine';

type DiscardCardAction = Extract<Action, { kind: 'DiscardCardAction' }>;
import { finalSeatViews } from 'protocol';
import { GameService } from '../game.service';
import { RevealGateOverlay } from './reveal-gate-overlay';
import { ActionList } from './action-list';
import { RoundTable } from './round-table';
import { SeatTile } from './seat-tile';
import { HandView } from './hand-view';
import { GameOver } from './game-over';
import { GeneralSelection } from './general-selection';
import { SelectionRoster, SelectionRosterRow } from './selection-roster';
import { GameStartCountdown } from './game-start-countdown';
import { PhaseIndicator } from './phase-indicator';
import { DiscardPile } from './discard-pile';
import { conversionLabel, seatForce, generalDisplayName, seatName } from '../labels';
import { discardHistory } from './discard-history';
import { ActionHistoryPanel } from './action-history-panel';
import { actionHistory } from './action-history';
import { DiscardDialog, DiscardDialogData } from './discard-dialog';
import { ResponseDialog, ResponseDialogData, ResponseOption } from './response-dialog';
import { describeResponse, startsOnNoResponse } from './response-description';
import { ChoiceDialog, ChoiceDialogData } from './choice-dialog';
import { AskDialog, AskDialogData } from './ask-dialog';
import { SelectionDialog, SelectionDialogData } from './selection-dialog';
import { describeArrangement, describeAsk, describeSelection } from './ability-description';
import { ArrangeDialog, ArrangeDialogData } from './arrange-dialog';
import { avatarSkills, extraSkillsOf } from './avatar-skills';
import { choiceDialogOptions, describeChoice } from './choice-description';
import { DecisionBanner } from './decision-banner';
import { DecisionDock } from './decision-dock';
import { openForceDialog } from './force-dialog';
import { CompeteDialog } from './compete-dialog';
import { JudgmentDialog, JudgmentDialogData } from './judgment-dialog';
import { StartRevealDialog, StartRevealDialogData } from './start-reveal-dialog';
import { judgmentDecision } from './judgment-decision';
import { judgmentDescription } from './judgment-description';
import { CompeteResult, competeResults } from './compete-result';
import { deathSoundsFor, soundsFor, voicesFor } from './event-sounds';
import { MusicService, SoundEffects } from '../music.service';
import { DecisionTimer } from '../decision-timer.service';
import { I18n } from '../i18n/i18n.service';
import { TMsgPipe } from '../i18n/msg';
import { TPipe } from '../i18n/t.pipe';

@Component({
  selector: 'app-game-board',
  imports: [TPipe, TMsgPipe, DecisionBanner, RevealGateOverlay, ActionList, PhaseIndicator, RoundTable, SeatTile, HandView, GameOver, GeneralSelection, SelectionRoster, GameStartCountdown, DiscardPile, ActionHistoryPanel, RouterLink, MatButtonModule, MatIconModule, MatCardModule, MatProgressSpinnerModule],
  template: `
    @if (lastError(); as error) {
      <div class="error-banner" role="alert">
        <mat-icon>error</mat-icon>
        <span class="message">{{ error | tm }}@if (error.detail; as detail) {<small class="detail">{{ 'error.detail' | t: { text: detail } }}</small>}</span>
        @if (gameService.mode() === 'vs-bots' && gameService.state() && !gameService.state()!.result) {
          <!-- A failed bot move stops the bots, so give the player a way out. -->
          <button mat-button type="button" (click)="goToSetup()">{{ 'ui.newGame' | t }}</button>
        }
        <button mat-button type="button" (click)="dismissError()">{{ 'ui.dismiss' | t }}</button>
      </div>
    }

    <app-decision-banner />
    @if (gameService.gameStartsAt(); as startsAt) {
      <app-game-start-countdown [startsAt]="startsAt" />
    }

    @if (gameService.state(); as state) {
      @if (state.result; as result) {
        <app-game-over [result]="result" [players]="state.players" [seats]="finalSeats()" [youSeatId]="gameService.humanSeatId()" (newGame)="goToSetup()" />
      } @else if (activeSeatId(); as activeSeatId) {
        @if (gameService.humanSeatId() === null && gameService.revealedSeatId() !== activeSeatId) {
          <app-reveal-gate-overlay [name]="nameOf(activeSeatId)" (revealed)="gameService.reveal(activeSeatId)" />
        } @else if (visibleState(); as visible) {
          @if (visible.phase === 'GeneralSelection') {
            <div class="selecting">
              <div class="selecting-main">
                @if (activeSeatId !== viewerSeatId()) {
                  @if (rosterRows()) {
                    <mat-card appearance="outlined" class="waiting-others">
                      <mat-progress-spinner mode="indeterminate" diameter="28" />
                      <span>{{ 'board.selection.waiting' | t }}</span>
                    </mat-card>
                  } @else {
                    <mat-card appearance="outlined" class="bots-choosing">
                      <mat-progress-spinner mode="indeterminate" diameter="28" />
                      <span>{{ 'board.botsChoosing' | t }}</span>
                    </mat-card>
                  }
                } @else {
                  <app-general-selection
                    [candidates]="selectionCandidates()"
                    [actions]="generalChoices()"
                    [registry]="gameService.registry"
                    [seatId]="activeSeatId"
                    [seatName]="nameOf(activeSeatId)"
                    (chosen)="submit($event)"
                  />
                }
              </div>
              @if (rosterRows(); as rows) {
                <app-selection-roster class="selecting-roster" [rows]="rows" />
              }
            </div>
          } @else {
            <div class="board">
              <app-phase-indicator [state]="visible" [viewerSeatId]="viewerSeatId()" />
              <div class="board-grid">
                <app-round-table class="battlefield" [state]="visible" [viewerSeatId]="viewerSeatId()!" [thinkingSeatId]="gameService.botThinkingSeatId()" [botSeatIds]="gameService.botSeatIds()" />
                <!-- Bottom left corner: the viewer's own seat, off the table. -->
                @if (viewerSeat(); as seat) {
                  <div class="your-seat">
                    <app-seat-tile
                      [seat]="seat"
                      [name]="nameOf(seat.id)"
                      [handCount]="ownHand().length"
                      [isViewer]="true"
                      [isTurnOwner]="seat.id === visible.turn.ownerSeatId"
                      [isResponding]="seat.id === (visible.pendingChoice?.seatId ?? visible.pendingResponse?.respondingSeatId)"
                      [isBot]="gameService.botSeatIds().includes(seat.id)"
                      [equipment]="zoneCards(seat.equipped.zoneId)"
                      [judgment]="zoneCards(seat.judgment.zoneId)"
                      [judgmentCountsAs]="countsAsOf(seat.judgment.zoneId)"
                      [pile]="zoneCards(seat.pile?.zoneId ?? '')"
                      [stash]="zoneCards(seat.stash?.zoneId ?? '')"
                      [dying]="dyingOf(seat)"
                      [skills]="viewerSkills()"
                      (useSkill)="submit($event)"
                    />
                  </div>
                }
                <section class="your-hand">
                  <div class="hand">
                    <h3>{{ 'board.yourHand' | t }}</h3>
                    <app-hand-view
                      [cards]="ownHand()"
                      [actions]="gameService.legalActions()"
                      [state]="visible"
                      [registry]="gameService.registry"
                      (play)="submit($event)"
                    />
                  </div>
                  <app-action-list
                    class="actions"
                    [actions]="boardActions()"
                    [state]="visible"
                    [registry]="gameService.registry"
                    (actionChosen)="submit($event)"
                  />
                </section>
                <!-- Bottom right: the action history, then the discard pile; same height. -->
                <app-action-history class="history" [history]="actionHistory()" />
                <app-discard-pile class="discard" [cards]="discardPile()?.cards ?? []" [history]="discardHistory()" />
              </div>
            </div>
          }
        }
      }
    } @else {
      <p>{{ 'board.noGame' | t }}</p>
      <a mat-flat-button routerLink="/setup">{{ 'board.startNewGame' | t }}</a>
    }
  `,
  styles: `
    .error-banner {
      display: flex; align-items: center; gap: 12px; margin: 8px 0; padding: 8px 12px; border-radius: 12px;
      background: var(--mat-sys-error-container); color: var(--mat-sys-on-error-container);
    }
    .error-banner .message { flex: 1; }
    .error-banner .detail { display: block; opacity: 0.8; font: var(--mat-sys-body-small); overflow-wrap: anywhere; }
    .selecting { display: flex; gap: 16px; align-items: flex-start; }
    .selecting-main { flex: 1; min-width: 0; }
    .selecting-roster { flex: 0 0 240px; }
    @media (max-width: 899px) { .selecting { flex-direction: column; } .selecting-roster { flex: none; width: 100%; } }
    .waiting-others { display: flex; align-items: center; gap: 16px; padding: 24px; margin: 24px auto; max-width: 420px; }
    .bots-choosing { display: flex; align-items: center; gap: 16px; padding: 24px; margin: 24px auto; max-width: 420px; }
    /* The game board fits the window below the app bar: no page scroll. The
       battlefield takes the room the hand row and the side column leave. */
    :host:has(.board) {
      display: flex; flex-direction: column;
      height: calc(100dvh - var(--mat-toolbar-standard-height, 64px) - 16px);
    }
    @media (max-width: 599px) { :host:has(.board) { height: calc(100dvh - var(--mat-toolbar-mobile-height, 56px) - 16px); } }
    .board { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    /* Bottom row: Player Seat, Hand (the rest of the width), Action History, Discard Pile.
       All four sections share one fixed height, so the battlefield gets the rest. */
    .board-grid {
      --bottom-height: 200px;
      flex: 1; min-height: 0;
      display: grid; gap: 8px;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      grid-template-rows: minmax(0, 1fr) var(--bottom-height);
      grid-template-areas: 'battlefield battlefield battlefield battlefield' 'seat hand history discard';
    }
    /* The battlefield runs the full width of the screen: out past the page padding. */
    .battlefield { grid-area: battlefield; margin-inline: -16px; min-height: 0; }
    /* The seat tile is shrunk to fit the row, and stretched to the row's full height. */
    .your-seat { --seat-zoom: 0.78; grid-area: seat; overflow: hidden; zoom: var(--seat-zoom); height: calc(var(--bottom-height) / var(--seat-zoom)); }
    .your-seat app-seat-tile { display: block; height: 100%; }
    .your-hand {
      grid-area: hand; min-width: 0; overflow: hidden; box-sizing: border-box;
      display: flex; align-items: stretch; gap: 12px; padding: 6px 10px; border-radius: 12px;
      background: var(--mat-sys-surface-container); color: var(--mat-sys-on-surface);
    }
    .hand { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .your-hand h3 { margin: 0; font: var(--mat-sys-label-large); }
    .your-hand app-hand-view { display: block; }
    .actions { align-self: center; max-width: 320px; }
    .history { grid-area: history; }
    .discard { grid-area: discard; }
    .history, .discard { box-sizing: border-box; width: 140px; min-height: 0; overflow: hidden; justify-content: center; }
    /* Phone-sized: stack, and let the page scroll. */
    @media (max-width: 767px) {
      :host:has(.board) { height: auto; }
      .board-grid {
        --bottom-height: auto;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        grid-template-rows: 70vh auto auto auto;
        grid-template-areas: 'battlefield battlefield' 'seat seat' 'hand hand' 'history discard';
      }
      .your-seat { justify-self: center; height: auto; }
      .your-seat app-seat-tile { height: auto; }
      .your-hand { flex-direction: column; }
      .actions { max-width: none; }
      .history, .discard { width: auto; }
    }
  `,
})
export class GameBoard {
  protected readonly gameService = inject(GameService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly timer = inject(DecisionTimer);
  private readonly music = inject(MusicService);
  private readonly sounds = inject(SoundEffects);
  private readonly i18n = inject(I18n);
  private readonly dock = inject(DecisionDock);
  private readonly injector = inject(Injector);
  private discardDialog: MatDialogRef<DiscardDialog, string[]> | null = null;
  private responseDialog: MatDialogRef<ResponseDialog, Action> | null = null;
  private judgmentDialog: MatDialogRef<JudgmentDialog> | null = null;
  // A minimized decision is being closed and opened again in the current language.
  private rebuilding = false;
  private startRevealDialog: MatDialogRef<StartRevealDialog, Array<'main' | 'deputy'>> | null = null;
  private choiceDialog: MatDialogRef<unknown, Action> | null = null;
  private selectionDialog: MatDialogRef<SelectionDialog, Action> | null = null;
  // The selection whose dialog is showing, so each opens only once.
  private selectionDialogFor: string | null = null;
  // The selection the viewer owes, while the board is on screen and the engine offers it.
  protected readonly selectionDue = computed(() => {
    const selection = this.visibleState()?.pendingSelection;
    if (!selection || selection.seatId !== this.viewerSeatId()) return null;
    if (selection.judgmentChange && this.judgmentView()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'SelectAction') ? selection.id : null;
  });
  private arrangeDialog: MatDialogRef<ArrangeDialog, Action> | null = null;
  // The arrangement whose dialog is showing, so each opens only once.
  private arrangeDialogFor: string | null = null;
  // The arrangement the viewer owes, while the board is on screen and the engine offers it.
  protected readonly arrangementDue = computed(() => {
    const arrangement = this.visibleState()?.pendingArrangement;
    if (!arrangement || arrangement.seatId !== this.viewerSeatId()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'ArrangeCardsAction') ? arrangement.id : null;
  });
  // The choice whose dialog is showing, so each opens only once.
  private choiceDialogFor: string | null = null;
  // The choice the viewer owes, while the board is on screen and the engine
  // offers them its options.
  protected readonly choiceDue = computed(() => {
    const choice = this.visibleState()?.pendingChoice;
    if (!choice || choice.seatId !== this.viewerSeatId()) return null;
    // A skill that may change the judgment asks inside the Judgment popup, not in a dialog of its own.
    if (choice.judgmentChange && this.judgmentView()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'ChooseOptionAction') ? choice.id : null;
  });
  // The response window whose dialog is showing, so each opens only once.
  private responseDialogFor: string | null = null;

  // The response window the viewer owes an answer to, while the board is on
  // screen and the engine offers them a way to answer it.
  protected readonly responseDue = computed(() => {
    const visible = this.visibleState();
    const pending = visible?.pendingResponse;
    if (!visible || !pending || pending.respondingSeatId !== this.viewerSeatId()) return null;
    const legal = this.gameService.legalActions();
    return legal.some((a) => a.kind === 'PassAction' || a.kind === 'RespondAction') ? pending.id : null;
  });

  // The turn whose Start window the viewer owes a Confirm for, while the board is on screen and the
  // engine offers it: the popup that picks which hidden Generals to reveal.
  protected readonly startRevealDue = computed(() => {
    const visible = this.visibleState();
    if (!visible || visible.phase !== 'Start' || !visible.turn.startWindow || visible.turn.ownerSeatId !== this.viewerSeatId()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'ConfirmRevealsAction') ? visible.turn.turnNumber : null;
  });

  // How many cards the viewer must discard now: non-zero only in their own
  // Discard phase while the engine offers discards (the board is on screen).
  protected readonly discardsDue = computed(() => {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (!visible || !seatId || visible.phase !== 'Discard' || visible.turn.ownerSeatId !== seatId) return 0;
    if (!this.gameService.legalActions().some((a) => a.kind === 'DiscardCardAction')) return 0;
    return discardOwed(visible, seatId);
  });

  constructor() {
    // Decisions are timed only while the board is on screen.
    this.timer.attach(inject(DestroyRef));
    // The win track while the game is won; back to the background track on leaving.
    effect(() => this.music.setTrack(this.visibleState()?.result ? 'win' : 'background'));
    inject(DestroyRef).onDestroy(() => this.music.setTrack('background'));
    // Leaving the board with a decision hidden: nothing else would ever close that dialog.
    inject(DestroyRef).onDestroy(() => this.dock.dismiss());
    // A decision's text is built when its dialog opens, so a language switch while one is
    // minimized (the one time the toolbar is reachable) rebuilds it, still minimized.
    let locale = this.i18n.locale();
    effect(() => {
      const next = this.i18n.locale();
      untracked(() => {
        if (next !== locale) this.rebuildMinimizedDecision();
        locale = next;
      });
    });
    // A judgment on show: its popup is open while the judgment is, whatever the gate or the viewer's seat.
    effect(() => {
      const on = this.judgmentView() !== null;
      untracked(() => (on ? this.openJudgmentDialog() : this.closeDialog(this.judgmentDialog)));
    });
    // Event sounds (soundsFor) for whatever the log gained since the last look.
    // The first look, and a new game's shorter log, only set the baseline, so
    // joining mid-game is silent.
    let seen: number | null = null;
    effect(() => {
      const state = this.visibleState();
      const log = state?.log;
      if (!state || !log) return;
      untracked(() => {
        if (seen !== null && log.length > seen) {
          const fresh = log.slice(seen);
          for (const sound of soundsFor(fresh)) this.sounds.play(sound);
          for (const cry of deathSoundsFor(fresh, state)) {
            if (cry.url) this.sounds.playDeathVoice(cry.url);
            else if (cry.effect) this.sounds.play(cry.effect);
          }
          for (const cue of voicesFor(fresh, state, this.gameService.registry, this.viewerSeatId())) this.sounds.playVoice(cue.gender, cue.voice);
        }
        seen = log.length;
      });
    });
    // A Compete popup for every Compete the log gains while the board is open
    // (same baseline rule as the sounds); several wait their turn.
    let competesSeen: number | null = null;
    effect(() => {
      const visible = this.visibleState();
      if (!visible) return;
      untracked(() => {
        const log = visible.log;
        if (competesSeen !== null && log.length > competesSeen) {
          this.competeQueue.push(...competeResults(log, competesSeen, visible.seats, visible.players, this.i18n.translator));
          this.showNextCompete();
        }
        competesSeen = log.length;
      });
    });
    effect(() => {
      const turn = this.startRevealDue();
      untracked(() => (turn === null ? this.closeDialog(this.startRevealDialog) : this.openStartRevealDialog()));
    });
    effect(() => {
      const count = this.discardsDue();
      untracked(() => {
        // Timed out (or otherwise settled): the open dialog has nothing left to ask.
        if (count === 0) this.closeDialog(this.discardDialog);
        else this.openDiscardDialog(count);
      });
    });
    effect(() => {
      const pendingId = this.responseDue();
      untracked(() => {
        if (this.responseDialogFor && this.responseDialogFor !== pendingId) this.closeDialog(this.responseDialog);
        if (pendingId) this.openResponseDialog(pendingId);
      });
    });
    effect(() => {
      const selectionId = this.selectionDue();
      untracked(() => {
        if (this.selectionDialogFor && this.selectionDialogFor !== selectionId) this.closeDialog(this.selectionDialog);
        if (selectionId) this.openSelectionDialog(selectionId);
      });
    });
    effect(() => {
      const arrangementId = this.arrangementDue();
      untracked(() => {
        if (this.arrangeDialogFor && this.arrangeDialogFor !== arrangementId) this.closeDialog(this.arrangeDialog);
        if (arrangementId) this.openArrangeDialog(arrangementId);
      });
    });
    effect(() => {
      const choiceId = this.choiceDue();
      untracked(() => {
        if (this.choiceDialogFor && this.choiceDialogFor !== choiceId) this.closeDialog(this.choiceDialog);
        if (choiceId) this.openChoiceDialog(choiceId);
      });
    });
  }

  protected readonly activeSeatId = this.gameService.activeSeatId;
  protected readonly visibleState = this.gameService.visibleState;
  protected readonly lastError = this.gameService.lastError;

  // Whose chair the table is seen from: the human in vs-bots, else the revealed active seat.
  // The judgment on show, read off the table's public view: it is for every seat, so the pass-and-play
  // gate does not hide it. Null when there is none.
  private readonly judgmentView = computed(() => {
    const state = this.gameService.publicState();
    return state ? judgmentDescription(state, this.gameService.registry, this.i18n.translator) : null;
  });

  // The skill decision the Judgment popup waits on, as the viewer sees it: the engine's own question for the asked
  // seat, a waiting line for the others, and in Pass and Play the hand-off before the asked seat's private view.
  private readonly judgmentDecisionView = computed(() => {
    // Behind the Pass and Play gate there is no view of the asked seat yet: the public one tells who is asked.
    const state = this.visibleState() ?? this.gameService.publicState();
    const viewer = this.viewerSeatId();
    if (!state || !viewer) return null;
    const shown = this.gameService.humanSeatId() !== null || this.gameService.revealedSeatId() === viewer;
    return judgmentDecision(state, viewer, this.gameService.legalActions(), this.i18n.translator, shown);
  });

  // What the board's action list offers: the acknowledgement of a judgment is the popup's, not a button on the board.
  protected readonly boardActions = computed(() => this.gameService.legalActions().filter((a) => a.kind !== 'AcknowledgeJudgmentAction'));

  // Everything is public at game over, so the full local state is safe to show.
  protected readonly finalSeats = computed(() => {
    const state = this.gameService.state();
    return state ? finalSeatViews(state) : [];
  });

  protected readonly viewerSeatId = computed(() => this.gameService.humanSeatId() ?? this.activeSeatId());

  // The revealed seat's own hand, shown full-size below the table.
  protected readonly ownHand = computed<CardInstance[]>(() => {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    const seat = visible?.seats.find((s) => s.id === seatId);
    if (!visible || !seat) return [];
    return visible.zones.find((z) => z.id === seat.hand.zoneId)?.cards ?? [];
  });

  // The viewer's active skills, as buttons on their avatar.
  protected readonly viewerSkills = computed(() => {
    const seat = this.visibleState()?.seats.find((s) => s.id === this.viewerSeatId());
    return seat ? avatarSkills(seat.generals, this.gameService.registry, this.gameService.legalActions(), extraSkillsOf(seat, this.gameService.registry), this.i18n.translator) : [];
  });

  // The viewer's force colour, which their decision dialogs are themed in.
  private readonly viewerForce = computed(() => seatForce(this.viewerSeat()));
  protected readonly viewerSeat = computed(() => this.visibleState()?.seats.find((s) => s.id === this.viewerSeatId()) ?? null);

  protected dyingOf(seat: Seat): boolean {
    const state = this.visibleState();
    return !!state && isSeatDying(state, seat.id);
  }

  protected zoneCards(zoneId: string): CardInstance[] {
    return this.visibleState()?.zones.find((z) => z.id === zoneId)?.cards ?? [];
  }

  // What each card in a zone counts as, when placed as another card (Country Scene's Capture).
  protected countsAsOf(zoneId: string): Record<string, string> {
    return this.visibleState()?.zones.find((z) => z.id === zoneId)?.countsAs ?? {};
  }

  protected readonly discardPile = computed(() => this.visibleState()?.zones.find((z) => z.kind === 'discardPile'));

  protected readonly actionHistory = computed(() => {
    const visible = this.visibleState();
    return visible ? actionHistory(visible.log, visible.zones, visible.players, visible.seats, this.i18n.translator) : [];
  });

  protected readonly discardHistory = computed(() => {
    const visible = this.visibleState();
    const pile = this.discardPile();
    return visible && pile ? discardHistory(visible.log, pile.id) : [];
  });

  // The revealed seat's own dealt candidates (other seats' are redacted anyway).
  protected readonly selectionCandidates = computed<string[]>(() => {
    const visible = this.visibleState();
    const seatId = this.activeSeatId();
    if (!visible || !seatId) return [];
    return visible.generalSelection?.candidates[seatId] ?? [];
  });

  protected readonly generalChoices = computed<ChooseGeneralsAction[]>(() =>
    this.gameService.legalActions().filter((a): a is ChooseGeneralsAction => a.kind === 'ChooseGeneralsAction')
  );

  // Online only: the General Selection panel's rows, with names.
  protected readonly rosterRows = computed<SelectionRosterRow[] | null>(() => this.gameService.selectionRoster()?.map((entry) => ({ ...entry, name: this.nameOf(entry.seatId) })) ?? null);

  protected nameOf(seatId: string): string {
    return seatName(this.gameService.state()?.players ?? [], seatId, this.i18n.translator);
  }

  private readonly competeQueue: CompeteResult[] = [];
  private competeDialog: MatDialogRef<CompeteDialog> | null = null;

  // Opens the next waiting Compete popup, themed in its source General's Force.
  private showNextCompete(): void {
    if (this.competeDialog) return;
    const next = this.competeQueue.shift();
    if (!next) return;
    const ref = openForceDialog<CompeteDialog, CompeteResult>(this.dialog, CompeteDialog, next.force, { data: next, width: 'min(92vw, 520px)', autoFocus: 'dialog' });
    this.competeDialog = ref;
    ref.afterClosed().subscribe(() => {
      this.competeDialog = null;
      this.showNextCompete();
    });
  }

  // The text that describes a decision (its prompt, option labels and the Compete result's
  // names) is built when the dialog opens, in the language then on: the open* methods run
  // untracked. A dialog's own fixed words do follow a switch, but dialogs are modal, so the
  // toolbar cannot be reached while one is open, except while one is minimized: then the
  // decision is rebuilt (rebuildMinimizedDecision).
  // The Discard phase in one step: the dialog returns exactly `count` cards,
  // each submitted as the engine's own legal DiscardCardAction.
  private openDiscardDialog(count: number): void {
    if (this.discardDialog) return;
    const hand = this.ownHand();
    // A timeout discards the ticked cards, topped up from the start of the hand.
    const timeoutChoice = (ticked: string[]) => {
      const fill = hand.map((c) => c.instanceId).filter((id) => !ticked.includes(id));
      const ids = [...ticked, ...fill].slice(0, count);
      const legal = this.gameService.legalActions().filter((a): a is DiscardCardAction => a.kind === 'DiscardCardAction');
      this.timer.setTimeoutChoice(ids.map((id) => legal.find((a) => a.cardInstanceId === id)).filter((a): a is DiscardCardAction => !!a));
    };
    const ref = openForceDialog<DiscardDialog, DiscardDialogData, string[]>(this.dialog, DiscardDialog, this.viewerForce(), {
      data: { cards: hand, count, chosenChanged: timeoutChoice },
      width: 'min(92vw, 640px)',
      disableClose: true,
    });
    this.discardDialog = ref;
    ref.beforeClosed().subscribe((ids) => {
      this.discardDialog = null;
      const legal = this.gameService.legalActions().filter((a): a is DiscardCardAction => a.kind === 'DiscardCardAction');
      const actions = (ids ?? []).map((id) => legal.find((a) => a.cardInstanceId === id)).filter((a): a is DiscardCardAction => !!a);
      if (actions.length > 0) this.gameService.submitAll(actions);
    });
  }

  // The start of the viewer's turn: tick the hidden Generals to reveal, Confirm. The engine's one
  // ConfirmRevealsAction template is submitted with the ticked slots.
  private openStartRevealDialog(): void {
    const seat = this.viewerSeat();
    const template = this.gameService.legalActions().find((a): a is Extract<Action, { kind: 'ConfirmRevealsAction' }> => a.kind === 'ConfirmRevealsAction');
    if (this.startRevealDialog || !seat?.generals || !template) return;
    const tr = this.i18n.translator;
    const generals = seat.generals;
    const options = (['main', 'deputy'] as const)
      .filter((slot) => !generals[slot].revealed)
      .map((slot) => ({ slot, slotLabel: tr(slot === 'main' ? 'startReveal.main' : 'startReveal.deputy'), name: generalDisplayName(generals[slot].generalDefinitionId, tr) }));
    const ref = openForceDialog<StartRevealDialog, StartRevealDialogData, Array<'main' | 'deputy'>>(this.dialog, StartRevealDialog, this.viewerForce(), {
      data: { options },
      width: 'min(92vw, 480px)',
      disableClose: true,
    });
    this.startRevealDialog = ref;
    ref.beforeClosed().subscribe((slots) => {
      this.startRevealDialog = null;
      if (slots) this.submit({ ...template, slots });
    });
  }

  // Opens the judgment popup. It reads the description live, so a replacement or a language switch
  // updates it in place. It closes when the engine's notice clock runs out; nobody can skip it.
  private openJudgmentDialog(resumed = this.rebuilding): void {
    const description = this.judgmentView();
    if (this.judgmentDialog || !description) return;
    const data: JudgmentDialogData = {
      description: this.judgmentView,
      decision: this.judgmentDecisionView,
      choose: (action) => this.submit(action),
      // A skill's decision whether to change the card is not remembered for a timeout: running out declines it.
      resumed,
      reveal: (seatId) => this.gameService.reveal(seatId),
    };
    const ref = openForceDialog<JudgmentDialog, JudgmentDialogData>(this.dialog, JudgmentDialog, description.force, { data, width: 'min(92vw, 560px)', disableClose: true });
    this.judgmentDialog = ref;
    ref.beforeClosed().subscribe(() => (this.judgmentDialog = null));
  }

  // Closes the minimized decision dialog and opens its pending decision again in the current
  // language, minimized again once it has opened.
  private rebuildMinimizedDecision(): void {
    const old = this.dock.dismiss();
    if (!old) return;
    // The Judgment popup the closing triggers a rebuild of (here or by its own effect) picks up where it was.
    this.rebuilding = true;
    old.afterClosed().subscribe(() => {
      const count = this.discardsDue();
      if (count > 0) this.openDiscardDialog(count);
      if (this.judgmentView()) this.openJudgmentDialog();
      for (const [id, open] of [
        [this.responseDue(), (i: string) => this.openResponseDialog(i)],
        [this.selectionDue(), (i: string) => this.openSelectionDialog(i)],
        [this.arrangementDue(), (i: string) => this.openArrangeDialog(i)],
        [this.choiceDue(), (i: string) => this.openChoiceDialog(i)],
      ] as const) {
        if (id) open(id);
      }
      this.rebuilding = false;
      const fresh = this.dialog.openDialogs.at(-1);
      if (!fresh) return;
      // Hidden from the moment it exists, so it never flashes; registered with the dock (title,
      // banner) as soon as its content has rendered, through its own View Board button.
      fresh.addPanelClass('decision-minimized');
      afterNextRender(() => (document.getElementById(fresh.id)?.querySelector('button.minimize') as HTMLButtonElement | null)?.click(), { injector: this.injector });
    });
  }

  // Opens the Response dialog for one response window; the chosen action
  // (a RespondAction, or the PassAction for No Response) is the engine's own.
  private openResponseDialog(pendingId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (this.responseDialogFor === pendingId || !visible || !seatId) return;
    const description = describeResponse(visible, seatId, (effect) => this.gameService.previewEffect(visible, effect), this.i18n.translator);
    const legal = this.gameService.legalActions();
    const noResponse = legal.find((a) => a.kind === 'PassAction');
    if (!description || !noResponse) return;
    const hand = this.ownHand();
    const cards: ResponseOption[] = legal.flatMap((action) => {
      if (action.kind !== 'RespondAction') return [];
      const card = hand.find((c) => c.instanceId === action.cardInstanceId);
      return card ? [{ id: card.instanceId, action, card, label: ResponseDialog.cardLabel(card, this.i18n.translator) }] : [];
    });
    const skills: ResponseOption[] = legal.flatMap((action, i) =>
      action.kind === 'UseConversionAction' ? [{ id: `convert-${i}`, action, label: conversionLabel(action, visible, this.gameService.registry, this.i18n.translator) }] : []
    );
    this.responseDialogFor = pendingId;
    const ref = openForceDialog<ResponseDialog, ResponseDialogData, Action>(this.dialog, ResponseDialog, this.viewerForce(), {
      data: { description, cards, skills, noResponse, startOnNoResponse: startsOnNoResponse(visible) },
      width: 'min(92vw, 520px)',
      disableClose: true,
    });
    this.responseDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.responseDialogFor = null;
      this.responseDialog = null;
      if (action) this.submit(action);
    });
  }

  // Opens the Choice dialog (Steal, Break, Harvest) for one pending choice;
  // the picked action is the engine's own ChooseOptionAction.
  private openChoiceDialog(choiceId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    const choice = visible?.pendingChoice;
    if (this.choiceDialogFor === choiceId || !visible || !choice || !seatId) return;
    // A "may": the Ask window instead.
    const ask = describeAsk(visible, seatId, this.gameService.legalActions(), this.i18n.translator);
    if (ask) {
      this.choiceDialogFor = choiceId;
      const ref = openForceDialog<AskDialog, AskDialogData, Action>(this.dialog, AskDialog, this.viewerForce(), { data: { description: ask }, width: 'min(92vw, 480px)', disableClose: true });
      this.choiceDialog = ref;
      ref.beforeClosed().subscribe((action) => {
        this.choiceDialogFor = null;
        this.choiceDialog = null;
        if (action) this.submit(action);
      });
      return;
    }
    const description = describeChoice(visible, seatId, this.i18n.translator);
    if (!description) return;
    const options = choiceDialogOptions(choice.options, this.gameService.legalActions(), visible.players, description.declineLabel, visible.seats, this.i18n.translator);
    this.choiceDialogFor = choiceId;
    const ref = openForceDialog<ChoiceDialog, ChoiceDialogData, Action>(this.dialog, ChoiceDialog, this.viewerForce(), {
      data: { description, options, pickedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 640px)',
      disableClose: true,
    });
    this.choiceDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.choiceDialogFor = null;
      this.choiceDialog = null;
      if (action) this.submit(action);
    });
  }

  // Opens the Selection dialog for one pending selection; it closes with the
  // engine's SelectAction (ids filled) or its CancelSelectionAction.
  private openSelectionDialog(selectionId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (this.selectionDialogFor === selectionId || !visible || !seatId) return;
    const description = describeSelection(visible, seatId, this.gameService.legalActions(), this.i18n.translator);
    if (!description) return;
    this.selectionDialogFor = selectionId;
    const ref = openForceDialog<SelectionDialog, SelectionDialogData, Action>(this.dialog, SelectionDialog, this.viewerForce(), {
      data: { description, pickedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 640px)',
      disableClose: true,
    });
    this.selectionDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.selectionDialogFor = null;
      this.selectionDialog = null;
      if (action) this.submit(action);
    });
  }

  // Opens the Arrange dialog for one pending arrangement; it closes with the
  // engine's ArrangeCardsAction filled in.
  private openArrangeDialog(arrangementId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (this.arrangeDialogFor === arrangementId || !visible || !seatId) return;
    const description = describeArrangement(visible, seatId, this.gameService.legalActions(), this.i18n.translator);
    if (!description) return;
    this.arrangeDialogFor = arrangementId;
    const ref = openForceDialog<ArrangeDialog, ArrangeDialogData, Action>(this.dialog, ArrangeDialog, this.viewerForce(), {
      data: { description, arrangedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 720px)',
      disableClose: true,
    });
    this.arrangeDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.arrangeDialogFor = null;
      this.arrangeDialog = null;
      if (action) this.submit(action);
    });
  }

  // Closes a dialog without an answer (its decision has already been made).
  private closeDialog(ref: MatDialogRef<unknown, unknown> | null): void {
    ref?.close(undefined);
  }

  submit(action: Action): void {
    this.gameService.submit(action);
  }

  dismissError(): void {
    this.gameService.clearError();
  }

  goToSetup(): void {
    this.router.navigateByUrl('/setup');
  }
}
