import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { Action } from 'engine';
import { SelectionDescription } from './ability-description';
import { PlayingCard } from './playing-card';

// Picking cards or seats for an ability. Confirms between min and max picks; Cancel when it may be. The
// content of the Selection dialog, and of the decision area of the Judgment popup. It offers only the
// engine's own actions: the SelectAction filled with the picks, or the cancel the engine offered.
@Component({
  selector: 'app-selection-panel',
  imports: [MatButtonModule, PlayingCard],
  template: `
    <p class="prompt">{{ description().prompt }}</p>
    <ul class="items">
      @for (item of description().items; track item.id) {
        <li>
          <button
            type="button"
            class="item"
            [class.picked]="isPicked(item.id)"
            [attr.aria-pressed]="isPicked(item.id)"
            [attr.aria-label]="item.label"
            [attr.data-item-id]="item.id"
            (click)="toggle(item.id)"
          >
            @if (item.card; as card) {
              <app-playing-card [card]="card" />
            } @else {
              <span class="seat">{{ item.label }}</span>
            }
          </button>
        </li>
      }
    </ul>
    <div class="actions">
      @if (description().cancel; as cancel) {
        <button mat-button type="button" class="cancel" (click)="chosen.emit(cancel)">{{ description().cancelLabel }}</button>
      }
      <button mat-flat-button type="button" class="confirm" [disabled]="!ready()" (click)="confirm()">{{ description().confirmLabel }}</button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .prompt { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .items { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }
    .item {
      display: flex; flex-direction: column; align-items: center; width: 100%; padding: 6px 4px;
      border: 2px solid transparent; border-radius: 10px; background: none; color: inherit; cursor: pointer;
    }
    .item:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .item.picked { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); }
    .seat { padding: 16px 8px; font: var(--mat-sys-title-small); }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
  `,
})
export class SelectionPanel {
  readonly description = input.required<SelectionDescription>();
  // Told the filled SelectAction whenever enough are picked, so a timeout can use it.
  readonly pickedChanged = input<((action: Action) => void) | undefined>(undefined);
  readonly chosen = output<Action>();

  protected readonly picked = signal<string[]>([]);
  protected readonly ready = computed(() => this.picked().length >= this.description().min && this.picked().length <= this.description().max);

  protected isPicked(id: string): boolean {
    return this.picked().includes(id);
  }

  // Pick or unpick; at max, a further pick is ignored (or, picking one, replaces the pick).
  protected toggle(id: string): void {
    const d = this.description();
    const now = this.picked();
    if (now.includes(id)) this.picked.set(now.filter((x) => x !== id));
    else if (now.length < d.max) this.picked.set([...now, id]);
    else if (d.max === 1) this.picked.set([id]);
    if (this.ready()) this.pickedChanged()?.({ ...d.template, ids: this.picked() });
  }

  protected confirm(): void {
    if (this.ready()) this.chosen.emit({ ...this.description().template, ids: this.picked() });
  }
}
