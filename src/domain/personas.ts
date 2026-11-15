import { countryCode, countryName } from "./countries";

export type Persona = {
  id: "mira" | "nico";
  name: string;
  birthYear: number;
  countryCode: number;
  graduationYear: number;
  note: string;
};

/** Fictional people. Nothing here is a real address, phone, email, or ID number. */
export const PERSONAS: readonly Persona[] = [
  {
    id: "mira",
    name: "Mira Solen",
    birthYear: 1999,
    countryCode: countryCode("AL"),
    graduationYear: 2021,
    note: "Adult, graduated, lives in the fictional country of Alder.",
  },
  {
    id: "nico",
    name: "Nico Voss",
    birthYear: 2011,
    countryCode: countryCode("BR"),
    graduationYear: 0,
    note: "Not yet 18, no graduation on record, lives in the fictional country of Brume.",
  },
];

export function personaById(id: Persona["id"]): Persona {
  const found = PERSONAS.find((persona) => persona.id === id);
  if (!found) {
    throw new Error(`Unknown persona ${id}`);
  }
  return found;
}

export function countryLabel(code: number): string {
  return countryName(code);
}
