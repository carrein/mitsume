import { suggestionLabel } from './label';

describe('suggestionLabel', () => {
  it('composes POI with street, housenumber, city, country', () => {
    expect(
      suggestionLabel({
        name: 'Primark',
        housenumber: '5-7',
        street: 'Alexanderplatz',
        city: 'Berlin',
        country: 'Germany',
        countrycode: 'DE',
      })
    ).toBe('Primark, Alexanderplatz 5-7, Berlin, Germany');
  });

  it('city result: name + country only', () => {
    expect(
      suggestionLabel({ name: 'Berlin', country: 'Germany', countrycode: 'DE' })
    ).toBe('Berlin, Germany');
  });

  it('keeps the state only for US results', () => {
    expect(
      suggestionLabel({
        name: 'Berlin',
        state: 'New Hampshire',
        country: 'United States',
        countrycode: 'US',
      })
    ).toBe('Berlin, New Hampshire, United States');
    expect(
      suggestionLabel({
        name: 'Berlin',
        state: 'Brandenburg',
        country: 'Germany',
        countrycode: 'DE',
      })
    ).toBe('Berlin, Germany');
  });

  it('dedups case-insensitively (street === name)', () => {
    expect(
      suggestionLabel({
        name: 'Alexanderplatz',
        street: 'alexanderplatz',
        city: 'Berlin',
        country: 'Germany',
      })
    ).toBe('Alexanderplatz, Berlin, Germany');
  });

  it('bare address without name', () => {
    expect(
      suggestionLabel({
        street: 'Orchard Road',
        housenumber: '313',
        city: 'Singapore',
        country: 'Singapore',
        countrycode: 'SG',
      })
    ).toBe('Orchard Road 313, Singapore');
  });

  it('empty properties → empty label', () => {
    expect(suggestionLabel({})).toBe('');
  });
});
