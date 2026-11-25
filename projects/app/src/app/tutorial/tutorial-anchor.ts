import { Directive, input } from '@angular/core';

// Puts a stable `data-tutorial` id on a board element so the Tutorial's spotlight can find it. Inert: it adds that
// attribute and nothing else, and no board component reads the Tutorial. A null id leaves the element unmarked.
@Directive({
  selector: '[appTutorialAnchor]',
  host: { '[attr.data-tutorial]': 'appTutorialAnchor()' },
})
export class TutorialAnchor {
  readonly appTutorialAnchor = input.required<string | null | undefined>();
}
