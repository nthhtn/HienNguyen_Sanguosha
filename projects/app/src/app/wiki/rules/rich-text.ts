import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { cardDisplayData } from 'content';
import { I18n } from '../../i18n/i18n.service';
import type { MessageKey } from '../../i18n/messages';

// A sentence from the catalog that may hold a link or a name:
//   [[/wiki/rules/setup|Setup]]  a link to a Wiki page, labelled in the sentence's language
//   {card:sha}                   a card's name in the current language
//   {force:Wei}                  a Force's name in the current language
export type RichPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; path: string; text: string }
  | { kind: 'card'; id: string }
  | { kind: 'force'; name: string };

const TOKEN = /\[\[([^|\]]+)\|([^\]]+)\]\]|\{(card|force):([^}]+)\}/g;

export function parseRich(source: string): RichPart[] {
  const parts: RichPart[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    if (match.index > last) parts.push({ kind: 'text', text: source.slice(last, match.index) });
    if (match[1] !== undefined) parts.push({ kind: 'link', path: match[1], text: match[2] });
    else if (match[3] === 'card') parts.push({ kind: 'card', id: match[4] });
    else parts.push({ kind: 'force', name: match[4] });
    last = match.index + match[0].length;
  }
  if (last < source.length) parts.push({ kind: 'text', text: source.slice(last) });
  return parts;
}

// Shows a rules sentence: from the catalog by `key`, or a `text` of its own
// (a table heading that is just a card's name).
@Component({
  selector: 'app-rich',
  imports: [RouterLink],
  template: `@for (part of parts(); track $index) {@if (part.path) {<a [routerLink]="part.path">{{ part.text }}</a>} @else {<ng-container>{{ part.text }}</ng-container>}}`,
  styles: `:host { display: inline; }`,
})
export class RichText {
  private readonly i18n = inject(I18n);
  readonly key = input<MessageKey>();
  readonly text = input<string>();

  protected readonly parts = computed(() => {
    const key = this.key();
    const source = key ? this.i18n.t(key) : (this.text() ?? '');
    const locale = this.i18n.locale();
    return parseRich(source).map((part): { text: string; path?: string } => {
      switch (part.kind) {
        case 'text':
          return { text: part.text };
        case 'link':
          return { text: part.text, path: part.path };
        case 'card':
          return { text: cardDisplayData(part.id, locale)?.name ?? part.id };
        case 'force':
          return { text: this.i18n.t(`label.kingdom.${part.name}` as MessageKey) };
      }
    });
  });
}
