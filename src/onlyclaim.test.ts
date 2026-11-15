import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { agentViewFor, issueClaim, openDesk, resetDesks, sealVault } from "./chain/local-simulator";
import { buildAgentView, type PublicSnapshot } from "./domain/agent-view";
import { textExcludingHashes } from "./domain/bytes";
import { countryCode } from "./domain/countries";
import { PERSONAS, type Persona } from "./domain/personas";

const ALDER = countryCode("AL");
const KEEL = countryCode("KE");
const BRUME = countryCode("BR");

function salt(marker: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.fill(0x5a);
  bytes[0] = marker;
  return bytes;
}

function secretsOf(persona: Persona, opening: Uint8Array) {
  return {
    nameParts: persona.name.split(" "),
    birthYear: String(persona.birthYear),
    graduationYear: persona.graduationYear === 0 ? null : String(persona.graduationYear),
    country: persona.id === "mira" ? "Alder" : "Brume",
    saltHex: [...opening].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  };
}

function expectHidden(payload: unknown, persona: Persona, opening: Uint8Array) {
  const text = textExcludingHashes(payload);
  const secrets = secretsOf(persona, opening);
  for (const part of secrets.nameParts) {
    expect(text).not.toContain(part);
  }
  expect(text).not.toContain(secrets.birthYear);
  if (secrets.graduationYear) {
    expect(text).not.toContain(secrets.graduationYear);
  }
  expect(text).not.toContain(secrets.country);
  expect(text).not.toContain(secrets.saltHex);
  expect(text).not.toContain("birthYear");
  expect(text).not.toContain("countryCode");
  expect(text).not.toContain("graduationYear");
}

async function sealedDesk(persona: Persona, opening: Uint8Array) {
  const opened = await openDesk();
  const sealed = await sealVault(opened.sessionId, {
    birthYear: persona.birthYear,
    countryCode: persona.countryCode,
    graduationYear: persona.graduationYear,
    salt: opening,
  });
  return { sessionId: opened.sessionId, ...sealed };
}

describe("OnlyClaim compiled circuits", () => {
  it("records Compact toolchain 0.36.0 and language 0.28", () => {
    const info = JSON.parse(
      readFileSync("contracts/managed/onlyclaim/compiler/contract-info.json", "utf8"),
    ) as { "compiler-version": string; "language-version": string; "runtime-version": string };
    expect(info["compiler-version"]).toBe("0.36.0");
    expect(info["language-version"]).toBe("0.28.0");
    expect(info["runtime-version"]).toBe("0.21.0");
  });

  it("starts with an empty public ledger", async () => {
    const opened = await openDesk();
    expect(opened.snapshot.deployment).toBe("none");
    expect(opened.snapshot.proofGenerated).toBe(false);
    expect(opened.snapshot.network).toBeNull();
    expect(opened.snapshot.registeredCommitments).toEqual([]);
    expect(opened.snapshot.grants).toEqual([]);
    expect(opened.snapshot.grantCount).toBe("0");
  });

  it("seals a commitment and refuses to store the raw vault", async () => {
    const mira = PERSONAS[0];
    const opening = salt(1);
    const sealed = await sealedDesk(mira, opening);
    expect(sealed.commitment).toMatch(/^[0-9a-f]{64}$/);
    expect(sealed.snapshot.registeredCommitments).toEqual([sealed.commitment]);
    expect(sealed.snapshot.grants).toEqual([]);
    expectHidden(sealed.snapshot, mira, opening);
    expect(sealed.commitment).not.toBe(
      [...opening].map((byte) => byte.toString(16).padStart(2, "0")).join(""),
    );
  });

  it("rejects a second seal of the same vault", async () => {
    const mira = PERSONAS[0];
    const opening = salt(2);
    const sealed = await sealedDesk(mira, opening);
    await expect(
      sealVault(sealed.sessionId, {
        birthYear: mira.birthYear,
        countryCode: mira.countryCode,
        graduationYear: mira.graduationYear,
        salt: opening,
      }),
    ).rejects.toThrow(/already registered/i);
  });

  it("rejects a claim before the vault is sealed", async () => {
    const opened = await openDesk();
    const mira = PERSONAS[0];
    await expect(
      issueClaim(
        opened.sessionId,
        {
          birthYear: mira.birthYear,
          countryCode: mira.countryCode,
          graduationYear: mira.graduationYear,
          salt: salt(3),
        },
        "adult",
      ),
    ).rejects.toThrow(/not registered/i);
  });

  it("rejects a vault that no longer matches the commitment", async () => {
    const mira = PERSONAS[0];
    const opening = salt(4);
    const sealed = await sealedDesk(mira, opening);
    await expect(
      issueClaim(
        sealed.sessionId,
        {
          birthYear: mira.birthYear - 1,
          countryCode: mira.countryCode,
          graduationYear: mira.graduationYear,
          salt: opening,
        },
        "adult",
      ),
    ).rejects.toThrow(/not registered/i);
  });

  it("approves Mira: adult, allowed country, and graduated are yes", async () => {
    const mira = PERSONAS[0];
    const opening = salt(5);
    const sealed = await sealedDesk(mira, opening);
    const results = [];
    for (const claim of ["adult", "country", "graduated"] as const) {
      results.push(await issueClaim(sealed.sessionId, {
        birthYear: mira.birthYear,
        countryCode: mira.countryCode,
        graduationYear: mira.graduationYear,
        salt: opening,
      }, claim));
    }
    expect(results.map((item) => item.grant.result)).toEqual(["yes", "yes", "yes"]);
    expect(results.map((item) => item.grant.claim)).toEqual(["adult", "country", "graduated"]);
    const snapshot = results[2].snapshot;
    expect(snapshot.grantCount).toBe("3");
    expect(snapshot.registeredCommitments).toEqual([sealed.commitment]);
    expect(snapshot.grants.every((grant) => grant.commitment === sealed.commitment)).toBe(true);
    const view = agentViewFor(snapshot, []);
    expect(view.sees).toBe("claim results only");
    expect(view.entries.map((entry) => entry.result)).toEqual(["yes", "yes", "yes"]);
    expectHidden(view, mira, opening);
    expectHidden(snapshot, mira, opening);
  });

  it("approves Nico and records no for every claim, still without the raw vault", async () => {
    const nico = PERSONAS[1];
    const opening = salt(6);
    const sealed = await sealedDesk(nico, opening);
    const vault = {
      birthYear: nico.birthYear,
      countryCode: nico.countryCode,
      graduationYear: nico.graduationYear,
      salt: opening,
    };
    let snapshot: PublicSnapshot = sealed.snapshot;
    for (const claim of ["adult", "country", "graduated"] as const) {
      snapshot = (await issueClaim(sealed.sessionId, vault, claim)).snapshot;
    }
    expect(snapshot.grants.map((grant) => grant.result)).toEqual(["no", "no", "no"]);
    const view = agentViewFor(snapshot, []);
    expect(view.entries.every((entry) => entry.kind === "grant" && entry.result === "no")).toBe(true);
    expectHidden(view, nico, opening);
    expectHidden(snapshot, nico, opening);
    expect(textExcludingHashes(view)).not.toContain("Brume");
    expect(textExcludingHashes(view)).not.toContain(String(BRUME));
  });

  it("denies a request without calling the ledger and without leaking the vault", async () => {
    const mira = PERSONAS[0];
    const opening = salt(7);
    const sealed = await sealedDesk(mira, opening);
    const view = buildAgentView({
      grants: sealed.snapshot.grants,
      denials: [{ claim: "adult" }, { claim: "country" }, { claim: "graduated" }],
    });
    expect(sealed.snapshot.grants).toEqual([]);
    expect(view.entries).toHaveLength(3);
    expect(view.entries.every((entry) => entry.kind === "declined" && entry.result === "declined")).toBe(true);
    expect(view.entries.every((entry) => entry.kind === "declined" && entry.note.includes("No attribute"))).toBe(true);
    expectHidden(view, mira, opening);
    expect(JSON.stringify(view)).not.toContain(String(mira.birthYear));
    expect(JSON.stringify(view)).not.toContain("Mira");
    expect(JSON.stringify(view)).not.toContain("Solen");
  });

  it("checks the age boundary at 18 in 2026", async () => {
    const turnsEighteen = { birthYear: 2008, countryCode: ALDER, graduationYear: 2020 };
    const stillSeventeen = { birthYear: 2009, countryCode: ALDER, graduationYear: 2020 };
    const adultDesk = await openDesk();
    await sealVault(adultDesk.sessionId, { ...turnsEighteen, salt: salt(8) });
    const adult = await issueClaim(adultDesk.sessionId, { ...turnsEighteen, salt: salt(8) }, "adult");
    expect(adult.grant.result).toBe("yes");

    const minorDesk = await openDesk();
    await sealVault(minorDesk.sessionId, { ...stillSeventeen, salt: salt(9) });
    const minor = await issueClaim(minorDesk.sessionId, { ...stillSeventeen, salt: salt(9) }, "adult");
    expect(minor.grant.result).toBe("no");
    expect(textExcludingHashes(minor.snapshot)).not.toContain("2009");
    expect(textExcludingHashes(adult.snapshot)).not.toContain("2008");
  });

  it("accepts Keel on the allowlist and rejects Brume", async () => {
    const keelDesk = await openDesk();
    const keelVault = { birthYear: 1990, countryCode: KEEL, graduationYear: 2012, salt: salt(10) };
    await sealVault(keelDesk.sessionId, keelVault);
    expect((await issueClaim(keelDesk.sessionId, keelVault, "country")).grant.result).toBe("yes");

    const brumeDesk = await openDesk();
    const brumeVault = { birthYear: 1990, countryCode: BRUME, graduationYear: 2012, salt: salt(11) };
    await sealVault(brumeDesk.sessionId, brumeVault);
    const denied = await issueClaim(brumeDesk.sessionId, brumeVault, "country");
    expect(denied.grant.result).toBe("no");
    expect(textExcludingHashes(denied.snapshot)).not.toContain("Brume");
    expect(textExcludingHashes(denied.grant)).not.toContain(String(BRUME));
  });

  it("treats a future graduation year as not yet graduated", async () => {
    const desk = await openDesk();
    const vault = { birthYear: 1998, countryCode: ALDER, graduationYear: 2027, salt: salt(12) };
    await sealVault(desk.sessionId, vault);
    const issued = await issueClaim(desk.sessionId, vault, "graduated");
    expect(issued.grant.result).toBe("no");
    expect(textExcludingHashes(issued.snapshot)).not.toContain("2027");
    expect(textExcludingHashes(issued.snapshot)).not.toContain("1998");
  });

  it("treats graduation in the reference year as graduated", async () => {
    const desk = await openDesk();
    const vault = { birthYear: 1998, countryCode: ALDER, graduationYear: 2026, salt: salt(13) };
    await sealVault(desk.sessionId, vault);
    expect((await issueClaim(desk.sessionId, vault, "graduated")).grant.result).toBe("yes");
  });

  it("rejects issuing the same claim to Harbor twice", async () => {
    const mira = PERSONAS[0];
    const opening = salt(14);
    const sealed = await sealedDesk(mira, opening);
    const vault = {
      birthYear: mira.birthYear,
      countryCode: mira.countryCode,
      graduationYear: mira.graduationYear,
      salt: opening,
    };
    await issueClaim(sealed.sessionId, vault, "adult");
    await expect(issueClaim(sealed.sessionId, vault, "adult")).rejects.toThrow(/already issued/i);
  });

  it("keeps a denial off the ledger when other claims were approved", async () => {
    resetDesks();
    const mira = PERSONAS[0];
    const opening = salt(15);
    const sealed = await sealedDesk(mira, opening);
    const vault = {
      birthYear: mira.birthYear,
      countryCode: mira.countryCode,
      graduationYear: mira.graduationYear,
      salt: opening,
    };
    const approved = await issueClaim(sealed.sessionId, vault, "adult");
    const view = agentViewFor(approved.snapshot, [{ claim: "country" }]);
    expect(view.entries.map((entry) => `${entry.claim}:${entry.result}`)).toEqual([
      "adult:yes",
      "country:declined",
    ]);
    expect(approved.snapshot.grants).toHaveLength(1);
    expectHidden(view, mira, opening);
  });
});
