# OnlyClaim

**Tagline:** Prove the answer. Keep the file.

## Description

AI agents are starting to ask for whole profiles when they only need a fact. OnlyClaim is a need-to-know box: a person keeps birth year, country, and graduation year in a private vault, and an agent may ask only “18 or older?”, “in an allowed country?”, or “graduated?”. The holder approves or denies each question. A denial shares nothing. An approval runs a Midnight Compact circuit that checks the vault and records a yes or no.

The raw attributes never go on the public ledger and never appear in the agent’s view. The ledger stores a commitment to the vault, a grant id, the claim type, a timestamp, and a nullifier that stops the same answer being issued twice to the same agent. The demo person, Mira Solen of the fictional country of Alder, is invented. There is no real contact or identity data in the project.

The contract is Compact 0.28, compiled with toolchain 0.36.0 for ledger 9. `registerCommitment` hides the vault behind `persistentCommit`. `issueClaim` proves one predicate and discloses only the boolean. The web demo runs those compiled circuits locally through Compact runtime 0.21.0. It does not generate a zero-knowledge proof and it is not deployed to Midnight mainnet, Preview, or Preprod. Docker was not available for a proof server, and the UI says so.

## Built with

- Compact 0.28 and Compact toolchain 0.36.0 (ledger 9)
- `@midnight-ntwrk/compact-runtime` 0.21.0
- TypeScript, Next.js, React, Tailwind, shadcn/ui
- Yarn, Node.js 22
- Vitest

## What a judge should click first

Open the demo (`yarn dev`, then http://127.0.0.1:4317). Seal Mira Solen’s vault. Approve “Is this person 18 or older in 2026?” and deny the country question. Look at **What Harbor sees** and the JSON under it: a yes, a denial, a commitment, and no birth year, country, or name. Then scroll to **What a node would store** and confirm the denial did not write a row. Switch to Nico Voss, reset, seal, and approve the same age question to see a proven **no** that still hides 2011.
