import { readableTextColor } from './color';

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
