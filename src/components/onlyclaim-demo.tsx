"use client";

import { useEffect, useMemo, useState } from "react";

import { proveClaim, sealDesk, startDesk } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildAgentView, type AgentView, type PublicSnapshot } from "@/domain/agent-view";
import { bytesToHex, randomSalt } from "@/domain/bytes";
import { CLAIMS, formatUnixUtc, HARBOR, type ClaimId } from "@/domain/claims";
import { COUNTRIES } from "@/domain/countries";
import { personaById, type Persona } from "@/domain/personas";

type Decision = "approved" | "declined";

const STEPS = ["Seal the vault", "Harbor asks", "You decide", "Harbor sees the claim"];

function fingerprint(birthYear: string, countryCode: number, graduationYear: string, saltHex: string) {
  return `${birthYear}|${countryCode}|${graduationYear}|${saltHex}`;
}

function shortHash(hex: string): string {
  return `${hex.slice(0, 10)}…${hex.slice(-6)}`;
}

export function OnlyClaimDemo() {
  const mira = personaById("mira");
  const [personaId, setPersonaId] = useState<Persona["id"]>("mira");
  const [name, setName] = useState(mira.name);
  const [birthYear, setBirthYear] = useState(String(mira.birthYear));
  const [countryCode, setCountryCode] = useState(mira.countryCode);
  const [graduationYear, setGraduationYear] = useState(String(mira.graduationYear));
  const [saltHex, setSaltHex] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PublicSnapshot | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [sealedAs, setSealedAs] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Partial<Record<ClaimId, Decision>>>({});
  const [denials, setDenials] = useState<ClaimId[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSaltHex(bytesToHex(randomSalt()));
    startDesk()
      .then((opened) => {
        if (cancelled) return;
        setSessionId(opened.sessionId);
        setSnapshot(opened.snapshot);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setBootError(cause instanceof Error ? cause.message : "The local desk failed to start.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentPrint =
    saltHex === null ? null : fingerprint(birthYear, countryCode, graduationYear, saltHex);
  const sealed = commitment !== null && sealedAs !== null && sealedAs === currentPrint;
  const dirty = commitment !== null && !sealed;

  const agentView: AgentView = useMemo(
    () =>
      buildAgentView({
        grants: snapshot?.grants ?? [],
        denials: denials.map((claim) => ({ claim })),
      }),
    [snapshot, denials],
  );

  const step = !sealed ? 0 : agentView.entries.length === 0 ? 2 : 3;

  function applyPersona(id: Persona["id"]) {
    const persona = personaById(id);
    setPersonaId(id);
    setName(persona.name);
    setBirthYear(String(persona.birthYear));
    setCountryCode(persona.countryCode);
    setGraduationYear(String(persona.graduationYear));
    setSaltHex(bytesToHex(randomSalt()));
    setError(null);
  }

  async function resetDemo() {
    const persona = personaById(personaId);
    setBusy("reset");
    setError(null);
    setCommitment(null);
    setSealedAs(null);
    setDecisions({});
    setDenials([]);
    setName(persona.name);
    setBirthYear(String(persona.birthYear));
    setCountryCode(persona.countryCode);
    setGraduationYear(String(persona.graduationYear));
    setSaltHex(bytesToHex(randomSalt()));
    try {
      const opened = await startDesk();
      setSessionId(opened.sessionId);
      setSnapshot(opened.snapshot);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "The local desk failed to reset.");
    } finally {
      setBusy(null);
    }
  }

  function readVault(): { birthYear: number; countryCode: number; graduationYear: number; saltHex: string } | string {
    if (!saltHex) return "The vault opening is still being generated.";
    if (!/^\d{4}$/.test(birthYear)) return "Birth year needs four digits.";
    const birth = Number(birthYear);
    if (birth < 1900 || birth > 2026) return "Use a birth year from 1900 to 2026.";
    if (!/^\d{1,4}$/.test(graduationYear)) return "Graduation year must be a whole number, or 0.";
    const graduated = Number(graduationYear);
    if (graduated !== 0 && (graduated < 1900 || graduated > 2100)) {
      return "Graduation year must be 0 or a year from 1900 to 2100.";
    }
    return { birthYear: birth, countryCode, graduationYear: graduated, saltHex };
  }

  async function seal() {
    if (!sessionId) return;
    const vault = readVault();
    if (typeof vault === "string") {
      setError(vault);
      return;
    }
    setBusy("seal");
    setError(null);
    const result = await sealDesk(sessionId, vault);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCommitment(result.commitment);
    setSnapshot(result.snapshot);
    setSealedAs(fingerprint(birthYear, countryCode, graduationYear, vault.saltHex));
  }

  async function approve(claim: ClaimId) {
    if (!sessionId || !sealed) return;
    const vault = readVault();
    if (typeof vault === "string") {
      setError(vault);
      return;
    }
    setBusy(claim);
    setError(null);
    const result = await proveClaim(sessionId, vault, claim);
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSnapshot(result.snapshot);
    setDecisions((current) => ({ ...current, [claim]: "approved" }));
    setDenials((current) => current.filter((item) => item !== claim));
  }

  function deny(claim: ClaimId) {
    setError(null);
    setDecisions((current) => ({ ...current, [claim]: "declined" }));
    setDenials((current) => (current.includes(claim) ? current : [...current, claim]));
  }

  return (
    <div className="min-h-screen bg-[#121614] text-[#f3efe6]">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[11px] tracking-[0.22em] text-[#8fd9b5] uppercase">
              Midnight hackathon · 13–15 Nov 2026
            </p>
            <h1 className="font-heading mt-2 text-4xl text-[#f7f1e4] sm:text-5xl">OnlyClaim</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#d7d1c6] sm:text-base">
              A need-to-know box for AI agents. Your file stays in the vault. Harbor Admissions
              gets the yes or no it asked for, and nothing else.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-[#8fd9b5]/40 bg-[#173028] text-[#c8f5e2]">
              Local simulator · not a network
            </Badge>
            <Button variant="outline" className="border-white/15 bg-transparent text-[#f3efe6] hover:bg-white/5" onClick={() => void resetDemo()} disabled={busy !== null}>
              Reset demo
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="rounded-2xl border border-[#8fd9b5]/25 bg-[#18211d] px-4 py-3 text-sm leading-6 text-[#d7efe4]">
          <span className="font-medium text-[#f3efe6]">How this demo runs. </span>
          Approving a request executes the compiled Compact circuits{" "}
          <span className="font-mono text-[#8fd9b5]">registerCommitment</span> and{" "}
          <span className="font-mono text-[#8fd9b5]">issueClaim</span> through Compact runtime 0.21.0
          in this process. No zero-knowledge proof is generated, and nothing is sent to Midnight
          mainnet, Preview, or Preprod. Docker and the proof server are not part of this run.
        </section>

        <ol className="grid gap-2 sm:grid-cols-4">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={`rounded-xl border px-3 py-2 text-sm ${
                index === step
                  ? "border-[#8fd9b5] bg-[#173028] text-[#e7fff4]"
                  : "border-white/10 text-[#b7b2a8]"
              }`}
            >
              <span className="font-mono text-[11px] tracking-wider uppercase">0{index + 1}</span>
              <div className="mt-1">{label}</div>
            </li>
          ))}
        </ol>

        {bootError ? (
          <p className="rounded-xl border border-[#e7a097]/40 bg-[#3a201d] px-4 py-3 text-sm" role="alert">
            {bootError}
          </p>
        ) : null}

        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
          <Card className="min-w-0 bg-[#f6f1e6] text-[#1c1914] ring-[#e4dccb]">
            <CardHeader>
              <p className="font-mono text-[11px] tracking-[0.18em] text-[#8a5a32] uppercase">01 · Private</p>
              <CardTitle className="font-heading text-2xl">Your vault</CardTitle>
              <p className="text-sm leading-5 text-[#5e584e]">
                Raw attributes live in this panel. The name is display-only and is not an input to the circuit.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex gap-2">
                {(["mira", "nico"] as const).map((id) => (
                  <Button
                    key={id}
                    type="button"
                    size="sm"
                    variant={personaId === id ? "default" : "outline"}
                    onClick={() => applyPersona(id)}
                  >
                    {personaById(id).name.split(" ")[0]}
                  </Button>
                ))}
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium tracking-wide text-[#5e584e] uppercase">
                Name, shown only here
                <Input
                  data-testid="vault-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-10 bg-white text-base text-[#1c1914] normal-case"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-xs font-medium tracking-wide text-[#5e584e] uppercase">
                  Birth year
                  <Input
                    data-testid="vault-birth-year"
                    inputMode="numeric"
                    value={birthYear}
                    onChange={(event) => setBirthYear(event.target.value)}
                    className="h-10 bg-white text-base text-[#1c1914]"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium tracking-wide text-[#5e584e] uppercase">
                  Graduation
                  <Input
                    data-testid="vault-graduation-year"
                    inputMode="numeric"
                    value={graduationYear}
                    onChange={(event) => setGraduationYear(event.target.value)}
                    className="h-10 bg-white text-base text-[#1c1914]"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs font-medium tracking-wide text-[#5e584e] uppercase">
                Country
                <select
                  data-testid="vault-country"
                  value={countryCode}
                  onChange={(event) => setCountryCode(Number(event.target.value))}
                  className="h-10 rounded-lg border border-[#d5cbb8] bg-white px-2.5 text-sm text-[#1c1914]"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs leading-5 text-[#5e584e]">
                {personaById(personaId).note} Graduation year 0 means no graduation on record.
                Opening {saltHex ? shortHash(saltHex) : "…"} stays on this device.
              </p>
              {dirty ? (
                <p className="rounded-lg bg-[#f3e0c4] px-3 py-2 text-sm text-[#6a3d12]">
                  The vault changed after it was sealed. Seal it again before approving a claim.
                </p>
              ) : null}
              <Button data-testid="seal-vault" className="h-10" onClick={() => void seal()} disabled={!sessionId || busy !== null || sealed}>
                {busy === "seal" ? "Sealing…" : sealed ? "Vault sealed" : "Seal vault"}
              </Button>
              {commitment ? (
                <p className="font-mono text-[11px] leading-5 break-all text-[#3d4a40]" data-testid="vault-commitment">
                  Commitment {commitment}
                </p>
              ) : (
                <p className="text-sm text-[#5e584e]">Nothing is registered until you seal the vault.</p>
              )}
            </CardContent>
          </Card>

          <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-white/10 bg-[#171c19] p-4">
            <div>
              <p className="font-mono text-[11px] tracking-[0.18em] text-[#d7b48a] uppercase">02 · The ask</p>
              <h2 className="font-heading mt-1 text-2xl">{HARBOR.name}</h2>
              <p className="mt-1 text-sm leading-5 text-[#c9c3b8]">{HARBOR.blurb}</p>
            </div>
            {CLAIMS.map((claim) => {
              const decision = decisions[claim.id];
              const locked = !sealed || busy !== null || decision !== undefined;
              return (
                <article key={claim.id} className="rounded-xl border border-white/10 bg-[#101412] p-3">
                  <h3 className="text-sm font-medium">{claim.question}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#b7b2a8]">{claim.policy}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      data-testid={`approve-${claim.id}`}
                      className="h-9 flex-1"
                      disabled={locked}
                      onClick={() => void approve(claim.id)}
                    >
                      {busy === claim.id ? "Proving…" : decision === "approved" ? "Approved" : "Approve"}
                    </Button>
                    <Button
                      data-testid={`deny-${claim.id}`}
                      variant="outline"
                      className="h-9 flex-1 border-white/15 bg-transparent text-[#f3efe6] hover:bg-white/5"
                      disabled={locked}
                      onClick={() => deny(claim.id)}
                    >
                      {decision === "declined" ? "Denied" : "Deny"}
                    </Button>
                  </div>
                </article>
              );
            })}
            {!sealed ? (
              <p className="text-xs text-[#b7b2a8]">Seal the vault before you answer Harbor.</p>
            ) : null}
          </section>

          <AgentPanel view={agentView} />
        </div>

        {error ? (
          <p className="rounded-xl border border-[#e7a097]/40 bg-[#3a201d] px-4 py-3 text-sm" role="alert" data-testid="demo-error">
            {error}
          </p>
        ) : null}

        <Ledger snapshot={snapshot} />
      </main>
    </div>
  );
}

function AgentPanel({ view }: { view: AgentView }) {
  return (
    <section className="min-w-0 rounded-xl border border-[#8fd9b5]/20 bg-[#0e1714] p-4" data-testid="agent-panel">
      <p className="font-mono text-[11px] tracking-[0.18em] text-[#8fd9b5] uppercase">03 · Need to know</p>
      <h2 className="font-heading mt-1 text-2xl">What Harbor sees</h2>
      <p className="mt-1 text-sm leading-5 text-[#c9ddd4]">
        This panel is rendered only from the claim payload below. It does not receive the vault.
      </p>
      {view.entries.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/15 px-3 py-6 text-sm text-[#b7c7bf]" data-testid="agent-empty">
          Harbor has no claim yet. Approve a question to record a yes or no, or deny it and share nothing.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {view.entries.map((entry) => (
            <li key={`${entry.kind}-${entry.claim}`} className="rounded-xl bg-[#13201b] px-3 py-3" data-testid={`agent-entry-${entry.claim}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm">{entry.label}</p>
                <ResultPill result={entry.result} />
              </div>
              {entry.kind === "grant" ? (
                <p className="mt-2 font-mono text-[11px] text-[#9fb2a9]">
                  Grant {entry.grantId} · {formatUnixUtc(entry.issuedAt)} · {shortHash(entry.commitment)}
                </p>
              ) : (
                <p className="mt-2 text-xs text-[#c9b3a4]">{entry.note}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-2 text-xs text-[#b7c7bf]">
        {["Legal name", "Birth year", "Country", "Graduation year", "Vault opening"].map((item) => (
          <li key={item} className="rounded-lg bg-white/5 px-2 py-1.5">
            {item} · not shared
          </li>
        ))}
      </ul>
      <pre
        data-testid="agent-payload"
        className="mt-4 max-w-full rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-5 break-words whitespace-pre-wrap text-[#d5eee4]"
      >
        {JSON.stringify(view, null, 2)}
      </pre>
    </section>
  );
}

function ResultPill({ result }: { result: "yes" | "no" | "declined" }) {
  const styles =
    result === "yes"
      ? "bg-[#1d6b4a] text-white"
      : result === "no"
        ? "bg-[#8a6232] text-white"
        : "bg-[#5c403c] text-[#f3d2cc]";
  const label = result === "declined" ? "Denied" : result === "yes" ? "Yes" : "No";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide uppercase ${styles}`}>{label}</span>;
}

function Ledger({ snapshot }: { snapshot: PublicSnapshot | null }) {
  return (
    <section className="min-w-0 rounded-2xl border border-white/10 bg-[#101412] p-4" data-testid="public-ledger">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-[#d7b48a] uppercase">Public ledger shape</p>
          <h2 className="font-heading text-2xl">What a node would store</h2>
        </div>
        <p className="text-xs text-[#b7b2a8]">
          {snapshot
            ? `${snapshot.execution} · proof generated: ${snapshot.proofGenerated ? "yes" : "no"} · network: none`
            : "Waiting for the local desk"}
        </p>
      </div>
      {!snapshot || snapshot.registeredCommitments.length === 0 ? (
        <p className="mt-4 text-sm text-[#b7b2a8]">No commitment registered yet.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {snapshot.registeredCommitments.map((commitment) => (
            <li key={commitment} className="font-mono text-[11px] break-all text-[#d7d1c6]">
              commitment {commitment}
            </li>
          ))}
        </ul>
      )}
      {snapshot && snapshot.grants.length > 0 ? (
        <div className="mt-4 max-w-full overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] tracking-wide text-[#b7b2a8] uppercase">
              <tr>
                <th className="py-2 pr-3 font-medium">Grant</th>
                <th className="py-2 pr-3 font-medium">Claim</th>
                <th className="py-2 pr-3 font-medium">Result</th>
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 font-medium">Commitment</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.grants.map((grant) => (
                <tr key={grant.grantId} className="border-t border-white/10" data-testid={`ledger-grant-${grant.grantId}`}>
                  <td className="py-2 pr-3 font-mono">{grant.grantId}</td>
                  <td className="py-2 pr-3">{grant.claim}</td>
                  <td className="py-2 pr-3">{grant.result}</td>
                  <td className="py-2 pr-3">{formatUnixUtc(grant.issuedAt)}</td>
                  <td className="py-2 font-mono text-xs">{shortHash(grant.commitment)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[#b7b2a8]">No grants recorded. A denial does not write a row.</p>
      )}
    </section>
  );
}
