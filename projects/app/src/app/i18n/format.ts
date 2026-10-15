import type { MessageParams } from './messages';

// Fills {name} placeholders. A missing param leaves its placeholder visible, and
// a function replacer keeps '$&' and friends in a value from being interpreted.
export function format(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : placeholder
  );
}
