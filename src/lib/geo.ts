/**
 * Convert local farm coordinates (feet or meters) to GPS lat/lng.
 *
 * The farm coordinate system has:
 *   - Origin at a known GPS point (e.g. SW corner pipe)
 *   - x-axis pointing roughly east, y-axis pointing roughly north
 *   - A bearing angle rotating the local y-axis from true north
 *
 * @param x  Local x coordinate (in farm units)
 * @param y  Local y coordinate (in farm units)
 * @param origin  GPS coordinates of the local origin (0,0)
 * @param bearing  Degrees clockwise from true north to local y-axis
 * @param unit  'ft' or 'm'
 * @returns { lat, lng } in decimal degrees
 */
export function localToGps(
  x: number,
  y: number,
  origin: { lat: number; lng: number },
  bearing: number,
  unit: 'ft' | 'm' = 'ft',
): { lat: number; lng: number } {
  // Convert to meters
  const scale = unit === 'ft' ? 0.3048 : 1;
  const xm = x * scale;
  const ym = y * scale;

  // Rotate local coords to true north/east
  const rad = (bearing * Math.PI) / 180;
  const cosB = Math.cos(rad);
  const sinB = Math.sin(rad);

  // dN = displacement north (meters), dE = displacement east (meters)
  const dN = ym * cosB - xm * sinB;
  const dE = ym * sinB + xm * cosB;

  // Convert meters to degrees
  const dLat = dN / 111320;
  const dLng = dE / (111320 * Math.cos((origin.lat * Math.PI) / 180));

  return {
    lat: origin.lat + dLat,
    lng: origin.lng + dLng,
  };
}

/**
 * Convert GPS lat/lng back to local farm coordinates.
 * Inverse of localToGps().
 */
export function gpsToLocal(
  lat: number,
  lng: number,
  origin: { lat: number; lng: number },
  bearing: number,
  unit: 'ft' | 'm' = 'ft',
): { x: number; y: number } {
  // Convert degree deltas to meters
  const dLat = lat - origin.lat;
  const dLng = lng - origin.lng;
  const dN = dLat * 111320;
  const dE = dLng * 111320 * Math.cos((origin.lat * Math.PI) / 180);

  // Inverse rotation: from true north/east back to local coords
  const rad = (bearing * Math.PI) / 180;
  const cosB = Math.cos(rad);
  const sinB = Math.sin(rad);

  // Solve: dN = ym*cosB - xm*sinB, dE = ym*sinB + xm*cosB
  const xm = dE * cosB - dN * sinB;
  const ym = dN * cosB + dE * sinB;

  // Convert meters to local units
  const scale = unit === 'ft' ? 0.3048 : 1;
  return {
    x: xm / scale,
    y: ym / scale,
  };
}

/**
 * Format GPS coordinates as a human-readable string.
 */
export function formatGps(lat: number, lng: number, precision = 6): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

/**
 * Generate a Google Maps link for given coordinates.
 */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
