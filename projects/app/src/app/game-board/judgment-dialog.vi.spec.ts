import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { I18n } from '../i18n/i18n.service';
import { JudgmentDialog, JudgmentDialogData } from './judgment-dialog';
import { skillDescription } from './judgment-description.testing';

beforeEach(() => localStorage.clear());
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  localStorage.clear();
});

describe('JudgmentDialog in Vietnamese', () => {
  it('says its title and View Board in Vietnamese, around the description it is given', async () => {
    jest.useFakeTimers();
    TestBed.resetTestingModule();
    const data: JudgmentDialogData = { description: signal(skillDescription({ outcome: 'Bo chịu 1 sát thương' })) };
    TestBed.configureTestingModule({ providers: [{ provide: MAT_DIALOG_DATA, useValue: data }, { provide: MatDialogRef, useValue: { close: jest.fn() } }] });
    await TestBed.inject(I18n).setLocale('vi');
    const fixture = TestBed.createComponent(JudgmentDialog);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')!.textContent).toContain('Phán xét');
    expect(el.querySelector('button.minimize')!.textContent!.trim()).toBe('Xem bàn');
    jest.advanceTimersByTime(3000);
    fixture.detectChanges();
    expect(el.querySelector('.line')!.textContent).toContain('Bo chịu 1 sát thương');
  });
});
