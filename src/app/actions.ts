"use server";

import { issueClaim, openDesk, sealVault, type VaultInput } from "@/chain/local-simulator";
import type { PublicGrant, PublicSnapshot } from "@/domain/agent-view";
import { hexToBytes } from "@/domain/bytes";
import type { ClaimId } from "@/domain/claims";

export type SealPayload = {
  birthYear: number;
  countryCode: number;
  graduationYear: number;
  saltHex: string;
};

export type DeskStart = {
  ok: true;
  sessionId: string;
  snapshot: PublicSnapshot;
};

export type SealResult =
  | { ok: true; commitment: string; snapshot: PublicSnapshot }
  | { ok: false; error: string };

export type IssueResult =
  | { ok: true; grant: PublicGrant; snapshot: PublicSnapshot }
  | { ok: false; error: string };

function vaultFrom(payload: SealPayload): VaultInput {
  return {
    birthYear: payload.birthYear,
    countryCode: payload.countryCode,
    graduationYear: payload.graduationYear,
    salt: hexToBytes(payload.saltHex),
  };
}

function failure(error: unknown): string {
  return error instanceof Error ? error.message : "The local simulator rejected this call.";
}

export async function startDesk(): Promise<DeskStart> {
  const opened = await openDesk();
  return { ok: true, sessionId: opened.sessionId, snapshot: opened.snapshot };
}

export async function sealDesk(sessionId: string, payload: SealPayload): Promise<SealResult> {
  try {
    const sealed = await sealVault(sessionId, vaultFrom(payload));
    return { ok: true, commitment: sealed.commitment, snapshot: sealed.snapshot };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}

export async function proveClaim(
  sessionId: string,
  payload: SealPayload,
  claim: ClaimId,
): Promise<IssueResult> {
  try {
    const issued = await issueClaim(sessionId, vaultFrom(payload), claim);
    return { ok: true, grant: issued.grant, snapshot: issued.snapshot };
  } catch (error) {
    return { ok: false, error: failure(error) };
  }
}
