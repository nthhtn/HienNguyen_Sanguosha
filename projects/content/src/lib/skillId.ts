// A skill's id: its English name in kebab case, apostrophes dropped
// ("Heaven's Envy" → "heavens-envy"). Stage 7's skills use these ids.
export function skillIdOf(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
