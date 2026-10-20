import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { I18n } from '../i18n/i18n.service';
import { JudgmentDialog, JudgmentDialogData } from './judgment-dialog';
import { skillDescription } from './judgment-description.testing';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('JudgmentDialog in Vietnamese', () => {
  it('says its title, Close and View Board in Vietnamese, around the description it is given', async () => {
    TestBed.resetTestingModule();
    const data: JudgmentDialogData = { description: signal(skillDescription({ outcome: 'Bo chịu 1 sát thương' })), canClose: signal(true), close: jest.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: jest.fn() } }] });
    await TestBed.inject(I18n).setLocale('vi');
    const fixture = TestBed.createComponent(JudgmentDialog);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')!.textContent).toContain('Phán xét');
    expect(el.querySelector('button.close')!.textContent!.trim()).toBe('Đóng');
    expect(el.querySelector('button.minimize')!.textContent!.trim()).toBe('Xem bàn');
    expect(el.querySelector('.outcome')!.textContent).toContain('Hệ quả');
    expect(el.querySelector('.outcome')!.textContent).toContain('Bo chịu 1 sát thương');
  });
});
