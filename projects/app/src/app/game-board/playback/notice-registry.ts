import { InjectionToken } from '@angular/core';
import { RESOLUTION_NOTICES, ResolutionNoticeDefinition } from 'content';

// The cards and skills that have a Resolution Notice. Injected so a spec can try the director with its own.
export const RESOLUTION_NOTICE_REGISTRY = new InjectionToken<Record<string, ResolutionNoticeDefinition>>('RESOLUTION_NOTICE_REGISTRY', {
  providedIn: 'root',
  factory: () => RESOLUTION_NOTICES,
});
