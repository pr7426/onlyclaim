/** Two-letter codes packed into the Uint<16> the contract compares. 0 means "unused". */

export function countryCode(alpha2: string): number {
  if (!/^[A-Z]{2}$/.test(alpha2)) {
    throw new Error(`Country code must be two uppercase letters, received ${alpha2}`);
  }
  return (alpha2.charCodeAt(0) << 8) | alpha2.charCodeAt(1);
}

export function countryAlpha(code: number): string {
  const hi = (code >> 8) & 0xff;
  const lo = code & 0xff;
  return String.fromCharCode(hi, lo);
}

export const COUNTRIES = [
  { name: "Alder", code: countryCode("AL") },
  { name: "Keel", code: countryCode("KE") },
  { name: "Brume", code: countryCode("BR") },
] as const;

export type CountryName = (typeof COUNTRIES)[number]["name"];

export function countryName(code: number): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? countryAlpha(code);
}

/** Harbor's published allowlist. The third slot is unused. Not the holder's country. */
export const ALLOWED_COUNTRY_CODES = [
  countryCode("AL"),
  countryCode("KE"),
  0,
] as const;
