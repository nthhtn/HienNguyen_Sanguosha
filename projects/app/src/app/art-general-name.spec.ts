import { TestBed } from '@angular/core/testing';
import { generalDisplayData, kingdomWarsGeneralId } from 'content';
import { artGeneralName } from './art-general-name';
import { I18n } from './i18n/i18n.service';

describe('artGeneralName', () => {
  afterEach(() => localStorage.clear());

  it('gives the name of an Identity General', () => {
    expect(artGeneralName('cao-cao', TestBed.inject(I18n))).toBe('Cao Cao');
  });

  it('gives a Kingdom Wars-only General its own name, translated, not its id in Title Case', async () => {
    const i18n = TestBed.inject(I18n);
    expect(artGeneralName('kong-rong', i18n)).toBe(generalDisplayData(kingdomWarsGeneralId('kong-rong'), 'en')!.name);
    await i18n.setLocale('vi');
    expect(artGeneralName('kong-rong', i18n)).toBe('Khổng Dung');
    expect(artGeneralName('zou-shi', i18n)).not.toBe('Zou Shi');
  });
});
