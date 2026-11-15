import { CLAIMS, claimCopy, type ClaimId, HARBOR } from "./claims";

export type PublicGrant = {
  grantId: string;
  claim: ClaimId;
  result: "yes" | "no";
  issuedAt: string;
  commitment: string;
  agentTag: string;
};

/**
 * What a Midnight node would be allowed to store for this demo.
 * Commitments, grant ids, claim types, timestamps, and the agent tag.
 * Execution is off-chain: this object is not a mainnet deployment.
 */
export type PublicSnapshot = {
  execution: "compiled-compact-runtime";
  deployment: "none";
  proofGenerated: false;
  network: null;
  registeredCommitments: string[];
  grantCount: string;
  grants: PublicGrant[];
};

export type AgentGrantEntry = {
  kind: "grant";
  claim: ClaimId;
  label: string;
  result: "yes" | "no";
  grantId: string;
  issuedAt: string;
  commitment: string;
};

export type AgentDenialEntry = {
  kind: "declined";
  claim: ClaimId;
  label: string;
  result: "declined";
  note: "No proof was issued. No attribute was shared.";
};

export type AgentEntry = AgentGrantEntry | AgentDenialEntry;

/** The only object the agent panel is allowed to render. */
export type AgentView = {
  agent: typeof HARBOR.name;
  sees: "claim results only";
  entries: AgentEntry[];
};

export function buildAgentView(input: {
  grants: readonly PublicGrant[];
  denials: readonly { claim: ClaimId }[];
}): AgentView {
  const byClaim = new Map<ClaimId, AgentEntry>();

  for (const denial of input.denials) {
    const entry: AgentDenialEntry = {
      kind: "declined",
      claim: denial.claim,
      label: claimCopy(denial.claim).resultLabel,
      result: "declined",
      note: "No proof was issued. No attribute was shared.",
    };
    byClaim.set(denial.claim, entry);
  }

  for (const grant of input.grants) {
    const entry: AgentGrantEntry = {
      kind: "grant",
      claim: grant.claim,
      label: claimCopy(grant.claim).resultLabel,
      result: grant.result,
      grantId: grant.grantId,
      issuedAt: grant.issuedAt,
      commitment: grant.commitment,
    };
    byClaim.set(grant.claim, entry);
  }

  return {
    agent: HARBOR.name,
    sees: "claim results only",
    entries: CLAIMS.flatMap((claim) => {
      const entry = byClaim.get(claim.id);
      return entry ? [entry] : [];
    }),
  };
}
