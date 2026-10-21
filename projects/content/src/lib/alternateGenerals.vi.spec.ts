import { generalsData } from '../../data/generals';
import { alternateGeneralRecords } from './alternateGenerals';
import { alternateGeneralDisplayData, alternateGeneralTranslations, generalTranslations, skillIdOf } from './display';

const vi = alternateGeneralTranslations('vi');

describe('the Vietnamese Alternate Generals', () => {
  it('has an entry with a name, title and Difference note for every General', () => {
    const found: string[] = [];
    for (const g of alternateGeneralRecords()) {
      const t = vi[g.id];
      if (!t?.name) found.push(`${g.id}: name`);
      if (g.title && !t?.title) found.push(`${g.id}: title`);
      if (g.differenceFromNormal && !t?.differenceNote) found.push(`${g.id}: note`);
    }
    expect(found).toEqual([]);
  });

  it('has a name and text for exactly each skill', () => {
    const found: string[] = [];
    for (const g of alternateGeneralRecords()) {
      const keys = g.skills.map((s) => skillIdOf(s.name));
      const have = Object.keys(vi[g.id]?.skills ?? {});
      for (const s of g.skills) {
        const t = vi[g.id]?.skills?.[skillIdOf(s.name)];
        if (!t?.name || !t.text) found.push(`${g.id}/${s.name}: missing`);
      }
      for (const k of have) if (!keys.includes(k)) found.push(`${g.id}/${k}: extra`);
    }
    expect(found).toEqual([]);
  });

  it('translates each Synergistic Partners list to the same length', () => {
    const found = alternateGeneralRecords()
      .filter((g) => (vi[g.id]?.partners ?? []).length !== g.synergisticPartners.length)
      .map((g) => g.id);
    expect(found).toEqual([]);
  });

  it('shows the English data in English', () => {
    const cao = alternateGeneralRecords().find((g) => g.id === 'cao-cao')!;
    const d = alternateGeneralDisplayData('cao-cao', 'en')!;
    expect(d.name).toBe(cao.name);
    expect(d.skills.map((s) => s.text)).toEqual(cao.skills.map((s) => s.text));
    expect(d.partners).toEqual(cao.synergisticPartners);
  });

  it('reads English for a language with no entry', () => {
    const cao = alternateGeneralRecords().find((g) => g.id === 'cao-cao')!;
    expect(alternateGeneralDisplayData('cao-cao', 'fr')).toEqual(alternateGeneralDisplayData('cao-cao', 'en'));
    expect(alternateGeneralDisplayData('cao-cao', 'fr')!.name).toBe(cao.name);
  });

  it('returns null for an id the Alternate deck lacks', () => {
    expect(alternateGeneralDisplayData('dong-zhuo', 'vi')).toBeNull();
  });

  it('uses its own text, not Default’s, for a shared id whose English differs', () => {
    const alt = alternateGeneralDisplayData('cao-cao', 'vi')!;
    const aDefault = generalTranslations('vi')['cao-cao'];
    const differing = alternateGeneralRecords().find((g) => g.id === 'cao-cao')!.skills.filter((s, i) => s.text !== generalsData['cao-cao'].skills[i]?.text);
    expect(differing.length).toBeGreaterThan(0);
    const i = alternateGeneralRecords().find((g) => g.id === 'cao-cao')!.skills.indexOf(differing[0]);
    const defaultText = aDefault.skills?.[skillIdOf(generalsData['cao-cao'].skills[i].name)]?.text;
    expect(alt.skills[i].text).not.toBe(defaultText);
  });

  it('names a General like Default does when Default has the same one', () => {
    const found: string[] = [];
    for (const g of alternateGeneralRecords()) {
      const d = generalsData[g.id];
      if (!d || d.nameZh !== g.nameZh) continue;
      const def = generalTranslations('vi')[g.id];
      if (def && vi[g.id]?.name !== def.name) found.push(`${g.id}: ${vi[g.id]?.name} vs ${def.name}`);
    }
    expect(found).toEqual([]);
  });
});
