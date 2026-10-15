import { DEFAULT_CATALOG_LOADERS } from './catalogs';
import { en } from './en';
import { LOCALES } from './locales';
import type { MessageKey } from './messages';

const placeholders = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const keys = Object.keys(en) as MessageKey[];

describe.each(LOCALES.map((l) => l.code))('catalog %s', (code) => {
  it('has exactly the English keys', async () => {
    const messages = await DEFAULT_CATALOG_LOADERS[code]();
    expect(Object.keys(messages).sort()).toEqual([...keys].sort());
  });

  it('keeps every placeholder of the English message', async () => {
    const messages = await DEFAULT_CATALOG_LOADERS[code]();
    for (const key of keys) {
      expect({ key, placeholders: placeholders(messages[key]) }).toEqual({ key, placeholders: placeholders(en[key]) });
    }
  });

  it('has no empty messages', async () => {
    const messages = await DEFAULT_CATALOG_LOADERS[code]();
    for (const key of keys) expect({ key, empty: messages[key].trim() === '' }).toEqual({ key, empty: false });
  });
});
