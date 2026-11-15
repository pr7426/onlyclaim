import { ALLOWED_COUNTRY_CODES } from "./countries";

export const REFERENCE_YEAR = 2026;

/** Fixed demo timestamp: 14 Nov 2026, 16:00 UTC. Public, not a birth date. */
export const ISSUED_AT_UNIX = Math.floor(Date.UTC(2026, 10, 14, 16, 0, 0) / 1000);

export const HARBOR_AGENT_ID = "harbor-admissions";

export type ClaimId = "adult" | "country" | "graduated";

export type ClaimCopy = {
  id: ClaimId;
  title: string;
  question: string;
  /** Sentence Harbor is allowed to see. It names the predicate, never the vault. */
  resultLabel: string;
  policy: string;
};

export const CLAIMS: readonly ClaimCopy[] = [
  {
    id: "adult",
    title: "18 or older",
    question: "Is this person 18 or older in 2026?",
    resultLabel: "18 or older in 2026",
    policy: "Compared with the year 2026. The birth year is not revealed.",
  },
  {
    id: "country",
    title: "Allowed country",
    question: "Is this person in an allowed country?",
    resultLabel: "In an allowed country",
    policy: "Harbor's allowlist is Alder or Keel. A yes does not name which one.",
  },
  {
    id: "graduated",
    title: "Graduated",
    question: "Has this person graduated by 2026?",
    resultLabel: "Graduated by 2026",
    policy: "A graduation year of 0 means no graduation on record.",
  },
];

export function claimCopy(id: ClaimId): ClaimCopy {
  const found = CLAIMS.find((claim) => claim.id === id);
  if (!found) {
    throw new Error(`Unknown claim ${id}`);
  }
  return found;
}

export const HARBOR = {
  name: "Harbor Admissions",
  role: "Demo agent",
  blurb:
    "A fictional admissions agent. It asks for three facts and never receives the file those facts come from.",
  allowlist: ALLOWED_COUNTRY_CODES,
} as const;

export function harborTagBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  const encoded = new TextEncoder().encode(HARBOR_AGENT_ID);
  bytes.set(encoded.slice(0, 32));
  return bytes;
}

export function formatUnixUtc(unixSeconds: string | number): string {
  const ms = Number(unixSeconds) * 1000;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(ms)) + " UTC";
}
