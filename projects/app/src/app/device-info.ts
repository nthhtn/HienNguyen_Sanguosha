import { Component, computed, inject } from '@angular/core';
import type { MessageKey } from './i18n/messages';
import { TPipe } from './i18n/t.pipe';
import { DisplayMode, Layout, LayoutKind } from './layout.service';

const MODE_LABELS: Record<DisplayMode, MessageKey> = {
  fullscreen: 'device.displayMode.fullscreen',
  standalone: 'device.displayMode.standalone',
  browser: 'device.displayMode.browser',
};
// 'phone' is the kind that cannot play, so it is shown as that.
const LAYOUT_LABELS: Record<LayoutKind, MessageKey> = {
  phone: 'device.layout.phone',
  compact: 'device.layout.compact',
  medium: 'device.layout.medium',
  large: 'device.layout.large',
};

// What window this device gives the app, read on the phone itself: The installed app has no address bar and no
// developer tools, so this page is how a player reports their window size. It reads `Layout`; it decides nothing.
@Component({
  selector: 'app-device-info',
  imports: [TPipe],
  template: `
    <section class="device-info">
      <h2>{{ 'device.title' | t }}</h2>
      <dl>
        <dt>{{ 'device.windowSize' | t }}</dt>
        <dd class="window-size">{{ layout.size().width }} × {{ layout.size().height }}</dd>
        <dt>{{ 'device.displayMode' | t }}</dt>
        <dd class="display-mode">{{ modeLabel() | t }}</dd>
        <dt>{{ 'device.orientation' | t }}</dt>
        <dd class="orientation">{{ (layout.portrait() ? 'device.orientation.portrait' : 'device.orientation.landscape') | t }}</dd>
        <dt>{{ 'device.layout' | t }}</dt>
        <dd class="layout">{{ layoutLabel() | t }}</dd>
        <dt>{{ 'device.pixelRatio' | t }}</dt>
        <dd class="pixel-ratio">{{ pixelRatio() }}</dd>
      </dl>
    </section>
  `,
  styles: `
    .device-info {
      max-width: 480px;
      margin: 24px auto;
      padding: 0 16px;
    }
    dl {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 8px 24px;
      font-size: 16px;
    }
    dt {
      font-weight: 500;
    }
    dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class DeviceInfo {
  protected readonly layout = inject(Layout);
  protected readonly modeLabel = computed(() => MODE_LABELS[this.layout.displayMode()]);
  protected readonly layoutLabel = computed(() => LAYOUT_LABELS[this.layout.kind()]);
  // Read again when the window changes, since moving to another screen can change it.
  protected readonly pixelRatio = computed(() => {
    this.layout.size();
    return window.devicePixelRatio;
  });
}
