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

  it('lets seat picker tiles grow with their General portrait, not the 44 px tap target', () => {
    expect(overlay).toMatch(/button\.option,\s*button\.item,\s*button\.pk\s*\{[^}]*min-height:\s*unset/);
  });

  it('draw card names in the phone hand on one line with an ellipsis at 12 px (spec 3f)', () => {
    const hand = read('game-board/hand-view.ts');
    const rule = /\.hand-row\.overlap ::ng-deep app-playing-card \.name-text \{([^}]*)\}/.exec(hand)?.[1] ?? '';
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

    it('General selection keeps one width whatever is picked, and its role badge wraps in the bottom right corner of the card (spec 3h)', () => {
      const source = read('game-board/general-selection.ts');
      expect(source).toMatch(/:host-context\(\[data-layout='compact'\]\) \{ width: 100%; \}/);
      expect(source).toMatch(/:host-context\(\[data-layout='compact'\]\) \.bar \{ width: 100%/);
      const chip = /:host-context\(\[data-layout='compact'\]\) \.role-chip \{([^}]*)\}/.exec(source)?.[1] ?? '';
      expect(chip).toMatch(/bottom:\s*6px/);
      expect(chip).toMatch(/right:\s*6px/);
      expect(chip).toMatch(/width:\s*min-content/);
      expect(chip).toMatch(/white-space:\s*normal/);
      expect(px(chip, 'font-size')).toBeGreaterThanOrEqual(12);
    });

    it('the Judgment outcome box is not shown on the phone board, and the set-aside cards take its space without the label', () => {
      const stage = read('game-board/judgment-stage.ts');
      const cons = /:host-context\(\[data-layout='compact'\]\) \.cons \{([^}]*)\}/.exec(stage)?.[1] ?? '';
      const aside = /:host-context\(\[data-layout='compact'\]\) \.aside \{([^}]*)\}/.exec(stage)?.[1] ?? '';
      const label = /:host-context\(\[data-layout='compact'\]\) \.aside-label \{([^}]*)\}/.exec(stage)?.[1] ?? '';
      expect(cons).toMatch(/display:\s*none/);
      expect(aside).toMatch(/flex:\s*1 1 auto/);
      expect(label).toMatch(/clip-path:\s*inset\(50%\)/);
    });

    it('puts the Judgment card beside the choice, and a long card pick scrolls with its buttons kept (iPhone 18)', () => {
      const stage = read('game-board/judgment-stage.ts');
      const grid = /:host-context\(\[data-layout='compact'\]\) \.stage \{([^}]*)\}/.exec(stage)?.[1] ?? '';
      expect(grid).toMatch(/grid-template-columns:\s*180px minmax\(0, 1fr\)/);
      expect(grid).toMatch(/"result source"/);
      expect(grid).toMatch(/"result choice"/);
      const picks = /:host-context\(\[data-layout='compact'\]\) \.choice app-selection-panel \{([^}]*)\}/.exec(stage)?.[1] ?? '';
      expect(picks).toMatch(/max-height:\s*calc\(100dvh/);
      const dialog = read('game-board/judgment-dialog.ts');
      expect(dialog).toMatch(/display: flex; flex-direction: column/);
      expect(read('../styles.scss')).toMatch(/max-height: calc\(100dvh - env\(safe-area-inset-top, 0px\) - env\(safe-area-inset-bottom, 0px\) - 48px\)/);
      expect(dialog).toMatch(/overflow-y: auto/);
      expect(dialog).toMatch(/class="header-timer"/);
      expect(dialog).toMatch(/:host-context\(\[data-layout='compact'\]\) \.timer \{ display: none; \}/);
      expect(stage).toMatch(/:host-context\(\[data-layout='compact'\]\) \.decide app-decision-countdown \{ display: none; \}/);
    });

    it('puts the decision clock in the title row on the phone board', () => {
      const countdown = read('game-board/decision-countdown.ts');
      expect(countdown).toMatch(/:host\(\.header-timer\) \{ display: none; \}/);
      expect(countdown).toMatch(/:host-context\(\[data-layout='compact'\]\)\.header-timer \{ display: flex;/);
      for (const file of ['ask-dialog.ts', 'choice-dialog.ts', 'selection-dialog.ts', 'arrange-dialog.ts', 'start-reveal-dialog.ts', 'response-dialog.ts', 'discard-dialog.ts']) {
        const src = read(`game-board/${file}`);
        expect(src).toMatch(/class="header-timer"/);
        expect(src).toMatch(/:host-context\(\[data-layout='compact'\]\)[^\{]*\.timer \{ display: none; \}/);
      }
    });

    it('Compete and Resolution notices shrink to a short phone screen', () => {
      const compete = read('game-board/compete-dialog.ts');
      expect(compete).toMatch(/:host-context\(\[data-layout='compact'\]\) \.side \{[^}]*grid-template-rows:\s*22px 60px/);
      expect(compete).toMatch(/:host-context\(\[data-layout='compact'\]\) \.skill-text \{ display: none; \}/);
      expect(compete).toMatch(/:host-context\(\[data-layout='compact'\]\) \.source app-card-art \{ display: none; \}/);
      const notice = read('game-board/resolution-notice-dialog.ts');
      expect(notice).toMatch(/:host-context\(\[data-layout='compact'\]\) \.source app-card-art \{ display: none; \}/);
      expect(notice).toMatch(/:host-context\(\[data-layout='compact'\]\) \.has-cards \.actors \{ display: none; \}/);
      expect(notice).toMatch(/:host-context\(\[data-layout='compact'\]\) \.seat-card > \.generals/);
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
    expect(overlay).toMatch(/app-playing-card \.name-text\s*\{[^}]*font-size:\s*14px/);
  });

  it('draw small cards in windows (the resolution notice) with no text under 12 px', () => {
    const name = /app-playing-card \.small \.name-text\s*\{([^}]*)\}/.exec(overlay)?.[1] ?? '';
    const faceStat = /app-playing-card \.small \.face,\s*app-playing-card \.small \.stat\s*\{([^}]*)\}/.exec(overlay)?.[1] ?? '';
    expect(px(name, 'font-size')).toBeGreaterThanOrEqual(12);
    expect(px(faceStat, 'font-size')).toBeGreaterThanOrEqual(12);
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

  it('lays out Start Reveal with Main and Deputy General on one row', () => {
    const source = read('game-board/start-reveal-dialog.ts');
    const generals = /:host-context\(\[data-layout='compact'\]\) \.generals \{([^}]*)\}/.exec(source)?.[1] ?? '';
    expect(generals).toMatch(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
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

