import type { Witnesses } from "./managed/onlyclaim/contract/index.js";
import type { Vault } from "./managed/onlyclaim/contract/index.js";

/** Private state on the holder's machine. The ledger never stores this object. */
export type HolderState = {
  vault: Vault;
  salt: Uint8Array;
};

export const witnesses: Witnesses<HolderState> = {
  vault: ({ privateState }) => {
    if (!privateState) {
      throw new Error("vault witness: private state is missing");
    }
    return [privateState, privateState.vault];
  },
  vaultSalt: ({ privateState }) => {
    if (!privateState || privateState.salt.length !== 32) {
      throw new Error("vaultSalt witness: salt must be 32 bytes");
    }
    return [privateState, privateState.salt];
  },
};
