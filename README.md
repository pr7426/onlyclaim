# OnlyClaim

Need-to-know grants for AI agents, built for the Midnight Hackathon (13–15 November 2026).

An agent asks a yes-or-no question about a person: are they 18 or older, are they in an allowed country, have they graduated. The holder keeps the raw attributes in a private vault and approves or denies each question. On approval, a Compact contract checks the attribute inside a circuit and records only the answer. The agent never receives the birth year, the country, or the graduation year.

The sample person is fictional. Mira Solen was born in 1999 in the made-up country of Alder and graduated in 2021. Nico Voss, the other sample, is younger, lives in Brume, and has no graduation on record. The demo does not contain a real address, phone number, email, or ID number.

## Why it matters

Agents are starting to ask apps for personal data they do not need. “Send me the profile” is the usual answer. OnlyClaim is the smaller answer: the holder proves the fact the agent asked for, and the file stays put.

That is the privacy shape Midnight is for. The sensitive values are witness inputs on the holder’s machine. The public ledger stores a commitment, a grant id, the claim type, a timestamp, and a replay nullifier. A zero-knowledge proof is what would convince the network that `issueClaim` followed those rules. This repository includes that contract. The browser demo runs the compiled circuit logic locally because this environment has no Docker proof server and no Midnight node.

## How Midnight is used

The contract is `contracts/onlyclaim.compact`.

- Language version **0.28**, compiled with Compact toolchain **0.36.0** (ledger 9, Compact runtime 0.21.0), which is the version the November 2026 networks document for Mainnet, Preview, and Preprod.
- `registerCommitment` reads the vault and a 32-byte opening from witnesses and stores `persistentCommit` of that vault. The preimage is not disclosed.
- `issueClaim` recomputes the commitment, requires it to be registered, and checks one predicate: age in 2026, membership in a three-slot country allowlist, or graduation by 2026. Only the boolean is disclosed into a `Grant`.
- A nullifier (`persistentHash` of the commitment, the claim kind, and the agent tag) stops the same claim being issued twice to the same agent.
- Denying a request does not call the contract. Nothing new is written.

Public ledger fields are `registered`, `spent`, `grantCount`, and `grants`. There is no ledger field for a name, birth year, country, or graduation year.

## What is compiled, and what is simulated

| Piece | Status in this repo |
| --- | --- |
| Compact source | Written for language 0.28 |
| `compact compile` with toolchain 0.36.0 | Ran successfully. Outputs are in `contracts/managed/onlyclaim/` (prover keys are gitignored; `yarn compile` regenerates them) |
| Circuit logic tests | `yarn test` runs the compiled JavaScript through `@midnight-ntwrk/compact-runtime` 0.21.0. No network |
| Zero-knowledge proof | Not generated. A proof server (`midnightntwrk/proof-server:9.0.0`) and Docker were not available here |
| Chain deployment | None. The demo is not on mainnet, Preview, Preprod, or a local devnet |

The web UI labels this as a **local simulator**. Approving a claim calls the compiled `issueClaim` circuit in the Next.js server process and returns the public grant. That is the same logic the chain would enforce. It is not a submitted transaction and it is not a verified proof.

## Install and run

Requirements:

- Node.js **22** or **24**. Node 23 is not supported. This repo pins `22` in `.nvmrc`.
- Yarn 1.22 (the `packageManager` field). Enable it with `corepack enable` if `yarn` is missing.
- Compact toolchain **0.36.0** only if you want to recompile. The demo and the tests run from the checked-in compiler output.

```bash
yarn install
yarn test
yarn dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

Click through, in order:

1. Leave Mira Solen in the vault, or switch to Nico Voss.
2. **Seal vault.** The commitment appears. The birth year does not.
3. **Approve** “18 or older” and **Deny** the country question. Approve graduation if you want a third row.
4. Read **What Harbor sees** and the JSON under it. Then read **What a node would store**.

Change the birth year after sealing and the desk asks you to seal again. The old commitment will not prove the edited vault.

### Recompile

Install the Compact developer tools, then pin the compiler:

```bash
curl --proto '=https' --tlsv1.2 -LsSf \
  https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
source "$HOME/.local/bin/env"
compact update 0.36.0
compact compile --version   # 0.36.0
yarn compile
```

`yarn compile` writes `contracts/managed/onlyclaim/`. Do not edit those files by hand.

### Proof server and a real network

Not required for `yarn test` or `yarn dev`. When you have Docker, the current documented proof server is:

```bash
docker run -p 6300:6300 -e MIDNIGHT_PROOF_SERVER_VERBOSE=true midnightntwrk/proof-server:9.0.0
```

Deploying `registerCommitment` and `issueClaim` still needs a funded wallet, a node, and an indexer (local devnet, Preview, or Preprod). This demo does not ship that path, and it does not pretend the simulator is one.

## Test

```bash
yarn test
```

Vitest drives the compiled circuits and the agent view. The suite covers:

- adult, country allowlist, and graduation, including the age boundary (2008 vs 2009 in 2026)
- approve (a grant with yes or no) and deny (no ledger write)
- a second seal, a claim before sealing, a vault that no longer matches, and a replayed claim
- the agent payload and the public snapshot must not contain the name, birth year, country, graduation year, or vault opening

## Architecture

```text
vault panel (browser)          Next.js server                         agent panel (browser)
name, years, country, salt --> sealDesk / proveClaim                  AgentView only
                           --> Compact runtime executes the circuit
                           --> returns commitments + grants
                           Harbor is never given the vault object
```

- `contracts/onlyclaim.compact` is the on-chain rules.
- `contracts/witnesses.ts` supplies the vault and the opening when a circuit asks.
- `src/chain/local-simulator.ts` is the off-chain runner. It keeps public contract state in memory for the demo process and discards the witness inputs after each call. It is not a Midnight node.
- `src/domain/agent-view.ts` builds the object the agent panel is allowed to render.
- `src/components/onlyclaim-demo.tsx` is the three-step desk: vault, request, claim.

A denial is decided in the browser and never hits `issueClaim`. An approval does. The JSON block titled as Harbor’s payload is that agent view, not the React state of the vault.

## Layout

```text
contracts/onlyclaim.compact          Compact source
contracts/witnesses.ts               Private-state witnesses
contracts/managed/onlyclaim/         Compiler output (JS, verifier keys, ZKIR)
src/chain/local-simulator.ts         Off-chain circuit runner
src/domain/                          Claim copy, personas, agent view
src/app/actions.ts                   Server actions the vault panel calls
src/components/onlyclaim-demo.tsx    Demo UI
src/onlyclaim.test.ts                Circuit and non-leakage tests
DEVPOST.md                           Hackathon submission blurb
```
