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
});

