import { generalsData } from '../../../data/generals';
import { BASE_GENERAL_IDS, WIND_GENERAL_IDS } from './index';

describe('BASE_GENERAL_IDS', () => {
  it('names the 25 base Generals, each with a data file from the base pack', () => {
    expect(BASE_GENERAL_IDS).toHaveLength(25);
    for (const id of BASE_GENERAL_IDS) {
      expect(generalsData[id]?.source.url).toContain('/base/');
    }
  });

  it('is every base-pack General in the data', () => {
    const base = Object.entries(generalsData).filter(([, g]) => g.source.url.includes('/base/')).map(([id]) => id);
    expect([...BASE_GENERAL_IDS].sort()).toEqual(base.sort());
  });
});

describe('WIND_GENERAL_IDS', () => {
  it('is every Wind General in the data', () => {
    const wind = Object.entries(generalsData).filter(([, g]) => g.source.expansion === 'Wind').map(([id]) => id);
    expect([...WIND_GENERAL_IDS].sort()).toEqual(wind.sort());
    expect(WIND_GENERAL_IDS).toHaveLength(8);
  });
});
