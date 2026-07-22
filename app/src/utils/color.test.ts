import { readableTextColor, rgbHex } from './color';

describe('readableTextColor', () => {
  it('picks light text on dark fills', () => {
    expect(readableTextColor('#000000')).toBe('#FFFFFF');
    expect(readableTextColor('#0060E0')).toBe('#FFFFFF'); // Firefox blue
  });

  it('picks dark text on light fills', () => {
    expect(readableTextColor('#FFFFFF')).toBe('#1C1B22');
    expect(readableTextColor('#FFBD4F')).toBe('#1C1B22'); // amber accent
  });

  it('ignores the alpha byte in #RRGGBBAA', () => {
    expect(readableTextColor('#ffbd4fff')).toBe('#1C1B22');
    expect(readableTextColor('#f8708cff')).toBe(readableTextColor('#f8708c'));
  });

  it('expands #RGB shorthand', () => {
    expect(readableTextColor('#000')).toBe('#FFFFFF');
    expect(readableTextColor('#fff')).toBe('#1C1B22');
  });

  it('falls back to dark on a malformed string', () => {
    expect(readableTextColor('nope')).toBe('#1C1B22');
    expect(readableTextColor('')).toBe('#1C1B22');
  });
});

describe('rgbHex', () => {
  it('drops the alpha byte of #RRGGBBAA', () => {
    expect(rgbHex('#f8708cff')).toBe('#f8708c');
    expect(rgbHex('#FFBD4FFF')).toBe('#ffbd4f');
  });

  it('passes #RRGGBB through (normalized to lowercase)', () => {
    expect(rgbHex('#FFBD4F')).toBe('#ffbd4f');
  });

  it('expands #RGB shorthand', () => {
    expect(rgbHex('#f0a')).toBe('#ff00aa');
  });

  it('returns a non-hex string unchanged', () => {
    expect(rgbHex('nope')).toBe('nope');
  });
});
