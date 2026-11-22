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

  it('keep the selection panel buttons on screen while its cards scroll (Compete, picks)', () => {
    const panel = read('game-board/selection-panel.ts');
    const rule = /:host-context\(\[data-layout='compact'\]\) \.actions \{([^}]*)\}/.exec(panel)?.[1] ?? '';
    expect(rule).toMatch(/position:\s*sticky/);
    expect(rule).toMatch(/bottom:\s*0/);
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
      expect(compactRule(source, '.online-card.result')).toMatch(/max-height:\s*calc\(100dvh/);
      expect(compactRule(source, '.result mat-card-content')).toMatch(/overflow-y:\s*auto/);
      expect(px(compactRule(source, '.result mat-card-actions button'), 'min-height')).toBeGreaterThanOrEqual(44);
    });
  });
});

