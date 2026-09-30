import { TestBed } from '@angular/core/testing';
import { CardArt } from './card-art';

describe('CardArt', () => {
  it('renders an image with the crawled URL and given alt text when art exists', () => {
    const fixture = TestBed.createComponent(CardArt);
    fixture.componentRef.setInput('id', 'cao-cao');
    fixture.componentRef.setInput('label', 'Cao Cao');
    fixture.detectChanges();

    const img = (fixture.nativeElement as HTMLElement).querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('/card-art/generals/wei/cao-cao.jpg');
    expect(img!.getAttribute('alt')).toBe('Cao Cao');
  });

  it('renders a placeholder with the label when no art exists for the id', () => {
    const fixture = TestBed.createComponent(CardArt);
    fixture.componentRef.setInput('id', 'hidden');
    fixture.componentRef.setInput('label', 'a hidden general');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('a hidden general');
  });
});
