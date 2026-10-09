import { computed, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';

// Keeps a page's selected tab in the `tab` query parameter, so Back, refresh
// and shared links land on the same tab. A missing or unknown key selects the
// first tab. Call in an injection context.
export function tabQueryParam(keys: readonly string[]): { selectedIndex: Signal<number>; select(index: number): void } {
  const route = inject(ActivatedRoute);
  const router = inject(Router);
  const tab = toSignal(route.queryParamMap.pipe(map((params) => params.get('tab'))), {
    initialValue: route.snapshot.queryParamMap.get('tab'),
  });
  const selectedIndex = computed(() => Math.max(0, keys.indexOf(tab() ?? '')));
  const select = (index: number) => {
    const key = keys[index];
    if (!key || key === tab()) return;
    void router.navigate([], { relativeTo: route, queryParams: { tab: key }, queryParamsHandling: 'merge', replaceUrl: true });
  };
  return { selectedIndex, select };
}
