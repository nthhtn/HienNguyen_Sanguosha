import { Component, computed, inject, signal } from '@angular/core';
import { wikiDistanceTable } from 'content';
import { I18n } from '../../i18n/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { DISTANCE_EXAMPLE } from './distance-example';
import { RichText } from './rich-text';
import { SceneCard } from './scene/scene-card';
import { SceneFrame } from './scene/scene-frame';
import { SceneSeat } from './scene/scene-seat';

// Seats go round the table counter-clockwise from Seat 1 at the bottom, as turns do on the Game screen.
const SEATS = DISTANCE_EXAMPLE.seats.map((seat, i) => {
  const angle = Math.PI / 2 - (i / DISTANCE_EXAMPLE.seats.length) * Math.PI * 2;
  return { n: seat.n, general: seat.general, force: seat.force, left: 50 + Math.cos(angle) * 38, top: 50 + Math.sin(angle) * 36 };
});
const OTHERS = SEATS.filter((seat) => seat.n !== 1).map((seat) => seat.n);

// A table the reader can play with. It holds only what the reader has chosen (who is selected, who is out, who wears what);
// every distance, range and "can a Sha reach" comes from the game through wikiDistanceTable.
@Component({
  selector: 'app-distance-demo',
  imports: [RichText, TPipe, SceneCard, SceneFrame, SceneSeat],
  styleUrls: ['./scene/scene.css'],
  template: `
    <app-scene caption="rules.distance.demo.cap">
      <div class="dist">
        <div class="ring">
          @for (row of rows(); track row.n) {
            @if (row.n === 1) {
              <div class="spot" [style.left.%]="row.left" [style.top.%]="row.top">
                <app-scene-seat [general]="row.general" [n]="row.n" [force]="row.force" [label]="'rules.distance.demo.you' | t" />
              </div>
            } @else {
              <button type="button" class="spot" [attr.data-seat]="row.n" [style.left.%]="row.left" [style.top.%]="row.top" [disabled]="row.out" [attr.aria-pressed]="selected() === row.n" (click)="select(row.n)">
                <app-scene-seat [general]="row.general" [n]="row.n" [force]="row.force" [out]="row.out" [selected]="selected() === row.n" />
                @if (row.distance !== null) {
                  <span class="dbadge" [class.reach]="row.canReach" [attr.title]="'card.distance' | t: { n: row.distance }" [attr.aria-label]="badgeName(row.n, row.distance, row.canReach)">{{ row.distance }}</span>
                }
                @if (row.mount && !row.out) {
                  <app-scene-card class="mount" [id]="row.mount" size="tiny" />
                }
              </button>
            }
          }
        </div>
        <div class="ctl">
          <fieldset>
            <legend>{{ 'rules.distance.demo.outLegend' | t }}</legend>
            <div class="outs">
              @for (n of others; track n) {
                <label><input type="checkbox" [attr.data-out]="n" [checked]="out().has(n)" (change)="setOut(n, $event)" /> {{ 'label.seat' | t: { n } }}</label>
              }
            </div>
          </fieldset>
          <div class="readout" aria-live="polite"><app-rich [text]="readout()" /></div>
        </div>
      </div>
      <p>{{ 'rules.distance.demo.hint' | t }}</p>
    </app-scene>
  `,
  styles: `
    .dist { display: grid; grid-template-columns: minmax(0, 1fr) 230px; gap: 16px; align-items: start; }
    .ring { position: relative; margin-top: 16px; aspect-ratio: 1.5; min-height: 280px; background: radial-gradient(ellipse at center, var(--mat-sys-surface) 0 55%, transparent 56%); border-radius: 8px; }
    .spot { position: absolute; transform: translate(-50%, -50%); background: none; border: 0; padding: 4px; font: inherit; color: inherit; border-radius: 8px; }
    button.spot { cursor: pointer; }
    button.spot:disabled { cursor: default; }
    button.spot:focus-visible { outline: 2px solid var(--mat-sys-primary); }
    .dbadge { position: absolute; top: -4px; right: 2px; min-width: 24px; height: 24px; padding: 0 5px; border-radius: 12px; display: grid; place-items: center; font: var(--mat-sys-label-large); background: var(--mat-sys-surface-container-highest); color: var(--mat-sys-on-surface-variant); border: 1px solid var(--mat-sys-outline); }
    .dbadge.reach { background: var(--mat-sys-primary); color: var(--mat-sys-on-primary); border-color: var(--mat-sys-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mat-sys-primary) 30%, transparent); }
    .mount { position: absolute; top: 14px; left: -16px; }
    .ctl { display: flex; flex-direction: column; gap: 10px; font: var(--mat-sys-body-medium); }
    fieldset { border: 1px solid var(--mat-sys-outline-variant); border-radius: 6px; padding: 8px 10px; margin: 0; }
    legend { font: var(--mat-sys-label-small); font-weight: 700; letter-spacing: 0.06em; color: var(--mat-sys-on-surface-variant); padding: 0 4px; }
    .outs { display: flex; flex-wrap: wrap; gap: 4px 12px; }
    .outs label { display: flex; align-items: center; gap: 6px; }
    .readout { background: var(--mat-sys-surface); border: 1px solid var(--mat-sys-outline-variant); border-radius: 6px; padding: 10px 12px; }
    /* A narrow screen: smaller seats keep the six round the ring apart, even with the longer Vietnamese names; the controls go under the ring. */
    @media (max-width: 520px) {
      .dist { grid-template-columns: minmax(0, 1fr); }
      .ring { --seat-w: 70px; --seat-av: 44px; min-height: 340px; aspect-ratio: 1.1; }
      .mount { left: -12px; }
    }
  `,
})
export class DistanceDemo {
  private readonly i18n = inject(I18n);
  protected readonly others = OTHERS;

  protected readonly out = signal<ReadonlySet<number>>(new Set(DISTANCE_EXAMPLE.seats.filter((seat) => 'out' in seat && seat.out).map((seat) => seat.n)));
  protected readonly mounts = signal<Record<number, string>>(Object.fromEntries(DISTANCE_EXAMPLE.seats.filter((seat) => 'mount' in seat && seat.mount).map((seat) => [seat.n, (seat as { mount: string }).mount])));
  protected readonly selected = signal<number | null>(DISTANCE_EXAMPLE.seats.find((seat) => 'distance' in seat && seat.distance !== undefined)?.n ?? null);

  // What the game says about this table.
  private readonly result = computed(() =>
    wikiDistanceTable({ seats: SEATS.map((seat) => ({ n: seat.n, out: this.out().has(seat.n), ...(this.mounts()[seat.n] ? { mount: this.mounts()[seat.n] } : {}) })) }),
  );

  protected readonly rows = computed(() =>
    SEATS.map((seat) => {
      const said = this.result().seats.find((s) => s.n === seat.n)!;
      return { ...seat, out: this.out().has(seat.n), mount: this.mounts()[seat.n], steps: said.steps, distance: said.distance, canReach: said.canReach };
    }),
  );

  protected readonly readout = computed(() => {
    const n = this.selected();
    const row = this.rows().find((r) => r.n === n);
    if (!row || row.steps === null || row.distance === null) return this.i18n.t('rules.distance.demo.allOut');
    const seat = this.i18n.t('label.seat', { n: row.n });
    const line = this.i18n.t('rules.distance.demo.line', { seat, steps: row.steps, distance: row.distance });
    const reach = this.i18n.t(row.canReach ? 'rules.distance.demo.reach' : 'rules.distance.demo.noReach', { seat, range: this.result().range });
    return `${line} ${reach}`;
  });

  protected badgeName(n: number, distance: number, canReach: boolean): string {
    const range = this.i18n.t(canReach ? 'rules.distance.demo.inRange' : 'rules.distance.demo.outRange');
    return `${this.i18n.t('label.seat', { n })}, ${this.i18n.t('card.distance', { n: distance })}, ${range}`;
  }

  protected select(n: number): void {
    if (!this.out().has(n)) this.selected.set(n);
  }

  protected setOut(n: number, event: Event): void {
    const isOut = (event.target as HTMLInputElement).checked;
    const next = new Set(this.out());
    if (isOut) next.add(n);
    else next.delete(n);
    this.out.set(next);
    if (isOut && this.selected() === n) this.selected.set(this.nextLiving(n, next));
    else if (!isOut && this.selected() === null) this.selected.set(n);
  }

  // The first living seat after `from`, in seat order and wrapping round; none when every other seat is out.
  private nextLiving(from: number, out: ReadonlySet<number>): number | null {
    const at = OTHERS.indexOf(from);
    for (let step = 1; step <= OTHERS.length; step++) {
      const candidate = OTHERS[(at + step) % OTHERS.length];
      if (!out.has(candidate)) return candidate;
    }
    return null;
  }
}
