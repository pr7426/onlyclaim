import { randomUUID } from "node:crypto";

import * as RT from "@midnight-ntwrk/compact-runtime";

import {
  ClaimKind,
  Contract,
  ledger,
} from "../../contracts/managed/onlyclaim/contract/index.js";
import { witnesses, type HolderState } from "../../contracts/witnesses";
import {
  buildAgentView,
  type AgentView,
  type PublicGrant,
  type PublicSnapshot,
} from "../domain/agent-view";
import { bytesToHex } from "../domain/bytes";
import { HARBOR_AGENT_ID, harborTagBytes, ISSUED_AT_UNIX, REFERENCE_YEAR, type ClaimId } from "../domain/claims";
import { ALLOWED_COUNTRY_CODES } from "../domain/countries";

/**
 * Local simulator for OnlyClaim.
 *
 * This runs the compiled Compact circuits (registerCommitment, issueClaim)
 * through @midnight-ntwrk/compact-runtime on this machine. It checks the same
 * assertions the circuit would enforce. It does not generate a zero-knowledge
 * proof, and it does not talk to a Midnight node, indexer, or proof server.
 * Do not describe a session created here as a mainnet, Preview, or Preprod deployment.
 */

const COIN = "0".repeat(64);
const contract = new Contract(witnesses);

export type VaultInput = {
  birthYear: number;
  countryCode: number;
  graduationYear: number;
  salt: Uint8Array;
};

export class ClaimRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimRejected";
  }
}

type StoredDesk = {
  id: string;
  address: ReturnType<typeof RT.sampleContractAddress>;
  state: RT.CircuitContext<HolderState>["callContext"]["currentQueryContext"]["state"];
};

const deskGlobal = globalThis as unknown as { __onlyclaimDesks?: Map<string, StoredDesk> };

function deskStore(): Map<string, StoredDesk> {
  if (!deskGlobal.__onlyclaimDesks) {
    deskGlobal.__onlyclaimDesks = new Map();
  }
  return deskGlobal.__onlyclaimDesks;
}

function blankHolder(): HolderState {
  return {
    vault: { birthYear: 0n, countryCode: 0n, graduationYear: 0n },
    salt: new Uint8Array(32),
  };
}

function holderFrom(input: VaultInput): HolderState {
  const fields = {
    birthYear: input.birthYear,
    countryCode: input.countryCode,
    graduationYear: input.graduationYear,
  } as const;
  for (const [name, value] of Object.entries(fields)) {
    if (!Number.isInteger(value) || value < 0 || value > 65535) {
      throw new ClaimRejected(`${name} must be an integer from 0 to 65535`);
    }
  }
  if (!(input.salt instanceof Uint8Array) || input.salt.length !== 32) {
    throw new ClaimRejected("The vault opening must be 32 bytes");
  }
  return {
    vault: {
      birthYear: BigInt(input.birthYear),
      countryCode: BigInt(input.countryCode),
      graduationYear: BigInt(input.graduationYear),
    },
    salt: input.salt,
  };
}

function explain(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const asserted = message.match(/failed assert:\s*(.+)/i);
  if (asserted) {
    return asserted[1].trim();
  }
  const first = message.split("\n").map((line) => line.trim()).find(Boolean);
  return first || "The circuit rejected this call.";
}

function contextFor(desk: StoredDesk, circuitId: string, holder: HolderState) {
  return RT.createCircuitContext({
    circuitId,
    contractAddress: desk.address,
    coinPublicKeyOrZswapState: COIN,
    contractState: desk.state,
    privateState: holder,
  });
}

const CLAIM_KIND: Record<ClaimId, ClaimKind> = {
  adult: ClaimKind.Adult,
  country: ClaimKind.CountryAllowed,
  graduated: ClaimKind.Graduated,
};

const KIND_TO_CLAIM: Record<number, ClaimId> = {
  [ClaimKind.Adult]: "adult",
  [ClaimKind.CountryAllowed]: "country",
  [ClaimKind.Graduated]: "graduated",
};

export function readSnapshot(state: StoredDesk["state"]): PublicSnapshot {
  const view = ledger(state);
  const grants: PublicGrant[] = [...view.grants].map(([id, grant]) => {
    const claim = KIND_TO_CLAIM[grant.claimKind];
    if (!claim) {
      throw new Error(`Unexpected claim kind ${String(grant.claimKind)}`);
    }
    return {
      grantId: id.toString(),
      claim,
      result: grant.satisfied ? "yes" : "no",
      issuedAt: grant.issuedAt.toString(),
      commitment: bytesToHex(grant.commitment),
      agentTag: bytesToHex(grant.agentTag),
    };
  });
  grants.sort((a, b) => Number(a.grantId) - Number(b.grantId));
  return {
    execution: "compiled-compact-runtime",
    deployment: "none",
    proofGenerated: false,
    network: null,
    registeredCommitments: [...view.registered].map((commitment) => bytesToHex(commitment)),
    grantCount: view.grantCount.toString(),
    grants,
  };
}

export async function openDesk(): Promise<{ sessionId: string; snapshot: PublicSnapshot }> {
  const address = RT.sampleContractAddress();
  const holder = blankHolder();
  const constructed = await contract.initialState(
    RT.createConstructorContext(holder, COIN),
  );
  const primed = RT.createCircuitContext({
    circuitId: "registerCommitment",
    contractAddress: address,
    coinPublicKeyOrZswapState: COIN,
    contractState: constructed.currentContractState,
    privateState: holder,
  });
  const desk: StoredDesk = {
    id: randomUUID(),
    address,
    state: primed.callContext.currentQueryContext.state,
  };
  deskStore().set(desk.id, desk);
  return { sessionId: desk.id, snapshot: readSnapshot(desk.state) };
}

function requireDesk(sessionId: string): StoredDesk {
  const desk = deskStore().get(sessionId);
  if (!desk) {
    throw new ClaimRejected("This desk expired. Reset the demo and seal the vault again.");
  }
  return desk;
}

export async function sealVault(
  sessionId: string,
  input: VaultInput,
): Promise<{ commitment: string; snapshot: PublicSnapshot }> {
  const desk = requireDesk(sessionId);
  const holder = holderFrom(input);
  const before = new Set(readSnapshot(desk.state).registeredCommitments);
  try {
    const call = await contract.impureCircuits.registerCommitment(
      contextFor(desk, "registerCommitment", holder),
    );
    desk.state = call.context.callContext.currentQueryContext.state;
  } catch (error) {
    throw new ClaimRejected(explain(error));
  }
  const snapshot = readSnapshot(desk.state);
  const commitment = snapshot.registeredCommitments.find((item) => !before.has(item));
  if (!commitment) {
    throw new ClaimRejected("The circuit finished without recording a commitment");
  }
  return { commitment, snapshot };
}

export async function issueClaim(
  sessionId: string,
  input: VaultInput,
  claim: ClaimId,
): Promise<{ grant: PublicGrant; snapshot: PublicSnapshot }> {
  const desk = requireDesk(sessionId);
  const holder = holderFrom(input);
  const [countryA, countryB, countryC] = ALLOWED_COUNTRY_CODES;
  let grantId: bigint;
  try {
    const call = await contract.impureCircuits.issueClaim(
      contextFor(desk, "issueClaim", holder),
      CLAIM_KIND[claim],
      BigInt(REFERENCE_YEAR),
      BigInt(countryA),
      BigInt(countryB),
      BigInt(countryC),
      BigInt(ISSUED_AT_UNIX),
      harborTagBytes(),
    );
    grantId = call.result;
    desk.state = call.context.callContext.currentQueryContext.state;
  } catch (error) {
    throw new ClaimRejected(explain(error));
  }
  const snapshot = readSnapshot(desk.state);
  const grant = snapshot.grants.find((item) => item.grantId === grantId.toString());
  if (!grant) {
    throw new ClaimRejected("The circuit finished without recording a grant");
  }
  if (!grant.agentTag.includes(bytesToHex(new TextEncoder().encode(HARBOR_AGENT_ID)).slice(0, 8))) {
    throw new ClaimRejected("Grant was not tagged for Harbor");
  }
  return { grant, snapshot };
}

/** Decline is local. The contract is not called, so nothing new is written. */
export function declineClaim(claim: ClaimId, snapshot: PublicSnapshot): AgentView {
  return buildAgentView({
    grants: snapshot.grants,
    denials: [{ claim }],
  });
}

export function agentViewFor(
  snapshot: PublicSnapshot,
  denials: readonly { claim: ClaimId }[],
): AgentView {
  return buildAgentView({ grants: snapshot.grants, denials });
}

/** Test helper: drop every desk. The web demo does not call this. */
export function resetDesks(): void {
  deskStore().clear();
}
