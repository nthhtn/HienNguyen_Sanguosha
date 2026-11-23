import { readFileSync } from 'fs';
import { join } from 'path';

// jsdom applies no styles, so the phone window rules are pinned by reading them (spec, "Windows on the phone"). The
// browser audit at 800 x 366 and 760 x 340 is the acceptance check.
const read = (path: string) => readFileSync(join(__dirname, path), 'utf8');
const px = (block: string, property: string) => Number(new RegExp(`${property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(\\d+)px`).exec(block)?.[1]);

describe('windows on the phone board', () => {
  const styles = read('../styles.scss');
  const start = styles.indexOf("html[data-layout='compact'] .cdk-overlay-container {");
  const overlay = start < 0 ? '' : styles.slice(start, styles.indexOf('\n}\n', start));

  it('make every Material button in a window at least 44 px tall', () => {
    for (const kind of ['filled', 'outlined', 'text', 'protected']) {
      expect(px(overlay, `--mat-button-${kind}-container-height`)).toBeGreaterThanOrEqual(44);
    }
    expect(px(overlay, '--mat-icon-button-state-layer-size')).toBeGreaterThanOrEqual(44);
    expect(overlay).toMatch(/button\s*\{[^}]*min-height:\s*44px/);
  });

  it('draw card names in the phone hand on one line with an ellipsis at 12 px (spec 3f)', () => {
    const hand = read('game-board/hand-view.ts');
    const rule = /\.hand-row\.overlap ::ng-deep app-playing-card \.name \{([^}]*)\}/.exec(hand)?.[1] ?? '';
    expect(px(rule, 'font-size')).toBe(12);
    expect(rule).toMatch(/white-space:\s*nowrap/);
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
  });

  it('trim the window chrome: an 18 px title, 12 px content padding, a compact actions row (spec 4b)', () => {
    expect(px(overlay, '--mat-dialog-subhead-size')).toBe(18);
    expect(px(overlay, '--mat-dialog-subhead-line-height')).toBe(24);
    expect(overlay).toMatch(/--mat-dialog-headline-padding:\s*8px 12px 4px/);
    expect(overlay).toMatch(/--mat-dialog-content-padding:\s*12px/);
    // With an actions row Material uses this token instead, so the title and the content line up at 12 px.
    expect(overlay).toMatch(/--mat-dialog-with-actions-content-padding:\s*12px 12px 0/);
    expect(overlay).toMatch(/--mat-dialog-actions-padding:\s*8px 12px/);
  });

  it('lighten the backdrop to 15% so the board shows through (spec 4b)', () => {
    expect(overlay).toMatch(/\.cdk-overlay-dark-backdrop\s*\{[^}]*rgb\(0 0 0 \/ 0\.15\)/);
  });

  describe('Response and Discard in two columns and one footer row (spec 4b)', () => {
    const compact = (source: string, selector: string) =>
      new RegExp(`:host-context\\(\\[data-layout='compact'\\]\\) ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(source)?.[1] ?? '';

    it('Response puts the description and the choices side by side', () => {
      const source = read('game-board/response-dialog.ts');
      expect(compact(source, 'mat-dialog-content')).toMatch(/display:\s*grid/);
      expect(compact(source, 'mat-dialog-content')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
    });

    it('Response hides an empty Skills block', () => {
      expect(compact(read('game-board/response-dialog.ts'), '.skills.none')).toMatch(/display:\s*none/);
    });

    it('Response and Discard keep the countdown and the button on one row', () => {
      for (const file of ['response-dialog.ts', 'discard-dialog.ts']) {
        const rule = compact(read(`game-board/${file}`), '.foot');
        expect(rule).toMatch(/display:\s*flex/);
        expect(rule).toMatch(/align-items:\s*center/);
      }
    });
  });

  describe('feedback from the third phone test (spec 3g)', () => {
    it('Discard: full-size cards wrap with room between them and scroll vertically, with no minimum width that pushes the buttons out (spec 3h)', () => {
      const source = read('game-board/discard-dialog.ts');
      const rule = /:host-context\(\[data-layout='compact'\]\) \.hand \{([^}]*)\}/.exec(source)?.[1] ?? '';
      expect(rule).toMatch(/minmax\(84px, 1fr\)/);
      expect(Number(/gap:\s*(\d+)px/.exec(rule)?.[1])).toBeGreaterThanOrEqual(10);
      expect(rule).not.toMatch(/overflow-x/);
      expect(source).not.toMatch(/min-width:\s*600px/);
    });

    it('the General selection column stretches to the full width, so its width never follows the bar (spec 3h)', () => {
      expect(read('game-board/game-board.ts')).toMatch(/\.selecting \{ flex-direction: column; align-items: stretch; \}/);
    });

    it('General selection keeps one width whatever is picked, and its role chip stays on one line (spec 3h)', () => {
      const source = read('game-board/general-selection.ts');
      expect(source).toMatch(/:host-context\(\[data-layout='compact'\]\) \{ width: 100%; \}/);
      expect(source).toMatch(/:host-context\(\[data-layout='compact'\]\) \.bar \{ width: 100%/);
      const chip = /:host-context\(\[data-layout='compact'\]\) \.role-chip \{([^}]*)\}/.exec(source)?.[1] ?? '';
      expect(chip).toMatch(/white-space:\s*nowrap/);
      expect(px(chip, 'font-size')).toBeGreaterThanOrEqual(12);
    });

    it('the Judgment outcome box has no minimum height on the phone board', () => {
      const rule = /:host-context\(\[data-layout='compact'\]\) \.cons \{([^}]*)\}/.exec(read('game-board/judgment-stage.ts'))?.[1] ?? '';
      expect(rule).toMatch(/min-height:\s*0/);
    });

    it('the centre band gives the countdown room for its icon, seconds and bar', () => {
      const band = read('game-board/phone/phone-centre-band.ts');
      expect(Number(/\.timer \{ width: (\d+)px; \}/.exec(band)?.[1])).toBeGreaterThanOrEqual(140);
    });

    it("Seat Details colours the player's name by force, beating Material's title colour", () => {
      expect(read('game-board/phone/seat-details-dialog.ts')).toMatch(/h2\.mdc-dialog__title \{ color: var\(--force-text/);
    });

    it('Seat Details writes the HP and hand summary in bold', () => {
      expect(read('game-board/phone/seat-details-dialog.ts')).toMatch(/\.summary \{ font-weight: 700; \}/);
    });
  });

  it('draw card names in windows at 14 px', () => {
    expect(overlay).toMatch(/app-playing-card \.name\s*\{[^}]*font-size:\s*14px/);
  });

  it('draw small cards in windows (the resolution notice) with no text under 12 px', () => {
    const rule = /app-playing-card \.small \.name,\s*app-playing-card \.small \.face,\s*app-playing-card \.small \.stat\s*\{([^}]*)\}/.exec(overlay)?.[1] ?? '';
    expect(px(rule, 'font-size')).toBeGreaterThanOrEqual(12);
  });

  it('draw the skill trait chips at 12 px or more on the phone board', () => {
    const traits = read('skill-traits.ts');
    const rule = /:host-context\(\[data-layout='compact'\]\) \.trait \{([^}]*)\}/.exec(traits)?.[1] ?? '';
    expect(px(rule, 'font-size')).toBeGreaterThanOrEqual(12);
  });

  it('keep the selection panel buttons below a card area that scrolls, never over a card (Compete, picks, Amass; spec 3h)', () => {
    const panel = read('game-board/selection-panel.ts');
    const items = /:host-context\(\[data-layout='compact'\]\) \.items \{([^}]*)\}/.exec(panel)?.[1] ?? '';
    expect(items).toMatch(/overflow-y:\s*auto/);
    const actions = /:host-context\(\[data-layout='compact'\]\) \.actions \{([^}]*)\}/.exec(panel)?.[1] ?? '';
    expect(actions).not.toMatch(/position:\s*sticky/);
    expect(read('game-board/selection-dialog.ts')).toMatch(/:host-context\(\[data-layout='compact'\]\) mat-dialog-content \{[^}]*overflow:\s*hidden/);
  });

  describe('Game Over and the online result', () => {
    const compactRule = (source: string, selector: string) =>
      new RegExp(`:host-context\\(\\[data-layout='compact'\\]\\) ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(source)?.[1] ?? '';

    it('Game Over is one screen tall, its standings scroll and New Game stays outside them', () => {
      const source = read('game-board/game-over.ts');
      expect(compactRule(source, '.game-over')).toMatch(/height:\s*calc\(100dvh/);
      expect(compactRule(source, 'app-victory-board')).toMatch(/overflow-y:\s*auto/);
      expect(px(compactRule(source, '.new-game'), 'min-height')).toBeGreaterThanOrEqual(44);
    });

    it('the victory board has a compact headline on the phone', () => {
      const source = read('game-board/victory-board.ts');
      expect(px(compactRule(source, '.headline'), 'font-size')).toBeLessThanOrEqual(28);
      expect(px(compactRule(source, '.sub'), 'font-size')).toBe(14);
    });

    it('the online result is one screen tall, its board scrolls and its buttons stay outside it', () => {
      const source = read('online/online-result.ts');
      // The toolbar, then the online page's own box (24 px padding top and bottom, -16 px margin) and the content's 16 px.
      expect(compactRule(source, '.online-card.result')).toMatch(/max-height:\s*calc\(100dvh - var\(--mat-toolbar-standard-height, 44px\) - 48px\)/);
      expect(compactRule(source, '.result mat-card-content')).toMatch(/overflow-y:\s*auto/);
      expect(px(compactRule(source, '.result mat-card-actions button'), 'min-height')).toBeGreaterThanOrEqual(44);
    });
  });

  it("keep the phone board's action buttons 36 px tall on one line", () => {
    const board = read('game-board/phone/phone-board.ts');
    const rule = /\.actions ::ng-deep button \{([^}]*)\}/.exec(board)?.[1] ?? '';
    expect(px(rule, 'height')).toBe(36);
    expect(px(rule, 'font-size')).toBe(13);
    expect(rule).toMatch(/white-space:\s*nowrap/);
    expect(rule).toMatch(/text-overflow:\s*ellipsis/);
  });

  it('keep the menu drawer 220 px wide on the phone board layout', () => {
    const app = read('app.css');
    const rule = /:host-context\(\[data-layout='compact'\]\) \.nav-drawer \{([^}]*)\}/.exec(app)?.[1] ?? '';
    expect(px(rule, 'width')).toBe(220);
  });

  describe('the General picker on the phone', () => {
    const picker = read('game-board/general-selection.ts');
    const rule = (selector: string) =>
      new RegExp(`:host-context\\(\\[data-layout='compact'\\]\\) ${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{([^}]*)\\}`).exec(picker)?.[1] ?? '';

    it('shows only the portrait card: no skills half, and the Info button', () => {
      expect(rule('.right')).toMatch(/display:\s*none/);
      expect(rule('.general-info')).toMatch(/display:\s*inline-flex/);
      expect(picker).toMatch(/\.general-info \{[^}]*display:\s*none/);
    });

    it('keeps the two rows (4 + 3, 3 + 2) with no scrolling, cards as tall as their row', () => {
      expect(rule('.candidates')).toMatch(/flex-direction:\s*column/);
      expect(rule('.candidates')).toMatch(/overflow:\s*hidden/);
      expect(rule('.row')).toMatch(/display:\s*flex/);
      expect(rule('.row')).toMatch(/flex:\s*1 1 0/);
      expect(rule('.candidate')).toMatch(/height:\s*100%/);
    });

    it('puts the name, force and HP beside the portrait, the Info button in the portrait corner', () => {
      expect(rule('.left')).toMatch(/flex-direction:\s*row/);
      expect(rule('.art')).toMatch(/aspect-ratio:\s*200 \/ 290/);
      expect(rule('.caption')).not.toMatch(/position:\s*absolute/);
      expect(rule('.general-info')).toMatch(/bottom:\s*2px/);
    });
  });

  describe('full-bleed background pages (Rooms, lobby, sign-in) in the installed app', () => {
    it('the content area publishes its real side padding, safe areas included', () => {
      const app = read('app.css');
      expect(app).toMatch(/--content-inline-start:\s*max\(16px, env\(safe-area-inset-left, 0px\)\)/);
      expect(app).toMatch(/--content-inline-end:\s*max\(16px, env\(safe-area-inset-right, 0px\)\)/);
    });

    it.each(['online/online-page.css', 'auth/auth-card.css'])('%s cancels that padding exactly and fills the height under the toolbar', (file) => {
      const css = read(file);
      expect(css).toMatch(/calc\(-1 \* var\(--content-inline-start, 16px\)\)/);
      expect(css).toMatch(/calc\(-1 \* var\(--content-inline-end, 16px\)\)/);
      expect(css).toMatch(/min-height:\s*calc\(100dvh - var\(--mat-toolbar-standard-height, 64px\)\)/);
    });
  });
});

