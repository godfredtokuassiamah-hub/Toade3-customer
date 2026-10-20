// Minimal Open Location Code ("plus code") encoder for 10- and 11-digit
// codes. Follows the reference implementation's integer method:
// https://github.com/google/open-location-code (Apache-2.0 spec).
// Plain JS for the JS thread (never called from a worklet).

const ALPHABET = "23456789CFGHJMPQRVWX";
const ENCODING_BASE = 20;
const LATITUDE_MAX = 90;
const LONGITUDE_MAX = 180;
const PAIR_CODE_LENGTH = 10;
const MAX_DIGIT_COUNT = 15;
const SEPARATOR_POSITION = 8;
// Units per degree at the 5th pair (20^3).
const PAIR_PRECISION = 8000;
// Grid digits split a cell into 5 rows x 4 columns.
const GRID_ROWS = 5;
const GRID_COLUMNS = 4;
const GRID_DIGITS = MAX_DIGIT_COUNT - PAIR_CODE_LENGTH;
const GRID_ROWS_FULL = GRID_ROWS ** GRID_DIGITS; // 3125
const GRID_COLS_FULL = GRID_COLUMNS ** GRID_DIGITS; // 1024
const FINAL_LAT_PRECISION = PAIR_PRECISION * GRID_ROWS_FULL;
const FINAL_LNG_PRECISION = PAIR_PRECISION * GRID_COLS_FULL;

export type PlusCodeLength = 10 | 11;

// Height in degrees of a cell for the given code length.
function latitudePrecision(codeLength: PlusCodeLength): number {
  return codeLength === 10
    ? ENCODING_BASE ** -3
    : ENCODING_BASE ** -3 / GRID_ROWS ** (codeLength - PAIR_CODE_LENGTH);
}

function normalizeLongitude(longitude: number): number {
  let lng = longitude;
  while (lng < -LONGITUDE_MAX) lng += 360;
  while (lng >= LONGITUDE_MAX) lng -= 360;
  return lng;
}

// Global code: "XXXXXXXX+XX" (10) or "XXXXXXXX+XXX" (11).
export function encode(
  latitude: number,
  longitude: number,
  codeLength: PlusCodeLength = 10,
): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new RangeError("Invalid coordinates");
  }
  let lat = Math.min(LATITUDE_MAX, Math.max(-LATITUDE_MAX, latitude));
  // Latitude 90 is outside the top cell; step down one cell.
  if (lat === LATITUDE_MAX) lat -= latitudePrecision(codeLength);
  const lng = normalizeLongitude(longitude);

  // Round at full precision first to avoid floating point errors.
  let latVal = Math.floor(
    Math.round((lat + LATITUDE_MAX) * FINAL_LAT_PRECISION * 1e6) / 1e6,
  );
  let lngVal = Math.floor(
    Math.round((lng + LONGITUDE_MAX) * FINAL_LNG_PRECISION * 1e6) / 1e6,
  );

  // Grid section (built right to left, trimmed to codeLength below).
  let grid = "";
  for (let i = 0; i < GRID_DIGITS; i++) {
    const latDigit = latVal % GRID_ROWS;
    const lngDigit = lngVal % GRID_COLUMNS;
    grid = ALPHABET[latDigit * GRID_COLUMNS + lngDigit] + grid;
    latVal = Math.floor(latVal / GRID_ROWS);
    lngVal = Math.floor(lngVal / GRID_COLUMNS);
  }

  let pairs = "";
  for (let i = 0; i < PAIR_CODE_LENGTH / 2; i++) {
    pairs = ALPHABET[lngVal % ENCODING_BASE] + pairs;
    pairs = ALPHABET[latVal % ENCODING_BASE] + pairs;
    latVal = Math.floor(latVal / ENCODING_BASE);
    lngVal = Math.floor(lngVal / ENCODING_BASE);
  }

  const digits = (pairs + grid).slice(0, codeLength);
  return `${digits.slice(0, SEPARATOR_POSITION)}+${digits.slice(SEPARATOR_POSITION)}`;
}

// Local short form: drops the 4-character area prefix,
// e.g. "6CQXPV6H+4HM" -> "PV6H+4HM". Only meaningful near a known locality.
export function shortenCode(code: string): string {
  return code.slice(4);
}

// Short code shown in the UI. 11 digits (~3 m cell) to match the design's
// "PV6H+4HM" form.
export function shortPlusCode(latitude: number, longitude: number): string {
  return shortenCode(encode(latitude, longitude, 11));
}
