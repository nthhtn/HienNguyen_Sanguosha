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
    expect(img!.getAttribute('src')).toBe('/card-art/generals/cards/wei/cao-cao.jpg');
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

  it('renders at a smaller size when size is "small"', () => {
    const fixture = TestBed.createComponent(CardArt);
    fixture.componentRef.setInput('id', 'hidden');
    fixture.componentRef.setInput('label', 'a hidden general');
    fixture.componentRef.setInput('size', 'small');
    fixture.detectChanges();

    const art = (fixture.nativeElement as HTMLElement).querySelector('.card-art')!;
    expect(art.classList).toContain('small');
  });

  it('renders full-card size when size is "large"', () => {
    const fixture = TestBed.createComponent(CardArt);
    fixture.componentRef.setInput('id', 'cao-cao');
    fixture.componentRef.setInput('label', 'Cao Cao');
    fixture.componentRef.setInput('size', 'large');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('img')!.classList).toContain('large');
  });

  it('renders at slot size when size is "tiny"', () => {
    const fixture = TestBed.createComponent(CardArt);
    fixture.componentRef.setInput('id', 'cao-cao');
    fixture.componentRef.setInput('label', 'Cao Cao');
    fixture.componentRef.setInput('size', 'tiny');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('img')!.classList).toContain('tiny');
  });

  it('renders a General skin when asked, and falls back to the original art without one', () => {
    const src = (id: string) => {
      const fixture = TestBed.createComponent(CardArt);
      fixture.componentRef.setInput('id', id);
      fixture.componentRef.setInput('label', id);
      fixture.componentRef.setInput('skin', true);
      fixture.detectChanges();
      return (fixture.nativeElement as HTMLElement).querySelector('img')!.getAttribute('src');
    };
    expect(src('cao-cao')).toBe('/card-art/generals/skins/wei/caocao.png');
    expect(src('zuo-ci')).toBe('/card-art/generals/skins/qun/zuoci.png');
  });

  it('renders the cropped art of a card when asked', () => {
    const fixture = TestBed.createComponent(CardArt);
    fixture.componentRef.setInput('id', 'axe');
    fixture.componentRef.setInput('label', 'Axe');
    fixture.componentRef.setInput('cropped', true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('img')!.getAttribute('src')).toBe('/card-art/cards/cropped/equipment/weapon/axe.jpg');
  });
});
