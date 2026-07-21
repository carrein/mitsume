// Pure composition of a Photon suggestion into the single line stored in the
// event's LOCATION. Rule (matches leaflet.photon + dedup): name, street +
// housenumber, city, US state, country — dropping any part already present.

/** The subset of Photon feature properties the label uses. */
export type PhotonProperties = {
  name?: string;
  street?: string;
  housenumber?: string;
  city?: string;
  state?: string;
  country?: string;
  countrycode?: string;
  osm_key?: string;
  osm_value?: string;
};

export function suggestionLabel(p: PhotonProperties): string {
  const street = p.street
    ? p.housenumber
      ? `${p.street} ${p.housenumber}`
      : p.street
    : undefined;
  const candidates = [
    p.name,
    street,
    p.city,
    // Disambiguates the many US Berlins; elsewhere state is mostly noise.
    p.countrycode === 'US' ? p.state : undefined,
    p.country,
  ];
  const parts: string[] = [];
  const seen = new Set<string>();
  for (const part of candidates) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    parts.push(trimmed);
  }
  return parts.join(', ');
}
