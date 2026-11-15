import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export enum ClaimKind { Adult = 0, CountryAllowed = 1, Graduated = 2 }

export type Vault = { birthYear: bigint;
                      countryCode: bigint;
                      graduationYear: bigint
                    };

export type Grant = { claimKind: ClaimKind;
                      satisfied: boolean;
                      issuedAt: bigint;
                      commitment: Uint8Array;
                      agentTag: Uint8Array
                    };

export type Witnesses<PS> = {
  vault(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Vault];
  vaultSalt(context: __compactRuntime.WitnessContext<Ledger, PS>): [PS, Uint8Array];
}

export type ImpureCircuits<PS> = {
  registerCommitment(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  issueClaim(context: __compactRuntime.CircuitContext<PS>,
             kind_0: ClaimKind,
             referenceYear_0: bigint,
             countryA_0: bigint,
             countryB_0: bigint,
             countryC_0: bigint,
             issuedAt_0: bigint,
             agentTag_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
}

export type ProvableCircuits<PS> = {
  registerCommitment(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  issueClaim(context: __compactRuntime.CircuitContext<PS>,
             kind_0: ClaimKind,
             referenceYear_0: bigint,
             countryA_0: bigint,
             countryB_0: bigint,
             countryC_0: bigint,
             issuedAt_0: bigint,
             agentTag_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
}

export type PureCircuits = {
}

export type Circuits<PS> = {
  registerCommitment(context: __compactRuntime.CircuitContext<PS>): Promise<__compactRuntime.CircuitResults<PS, []>>;
  issueClaim(context: __compactRuntime.CircuitContext<PS>,
             kind_0: ClaimKind,
             referenceYear_0: bigint,
             countryA_0: bigint,
             countryB_0: bigint,
             countryC_0: bigint,
             issuedAt_0: bigint,
             agentTag_0: Uint8Array): Promise<__compactRuntime.CircuitResults<PS, bigint>>;
}

export type Ledger = {
  registered: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  spent: {
    isEmpty(): boolean;
    size(): bigint;
    member(elem_0: Uint8Array): boolean;
    [Symbol.iterator](): Iterator<Uint8Array>
  };
  readonly grantCount: bigint;
  grants: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: bigint): boolean;
    lookup(key_0: bigint): Grant;
    [Symbol.iterator](): Iterator<[bigint, Grant]>
  };
}

export declare class Contract<PS = any, W extends Witnesses<PS> = Witnesses<PS>> {
  witnesses: W;
  circuits: Circuits<PS>;
  impureCircuits: ImpureCircuits<PS>;
  provableCircuits: ProvableCircuits<PS>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<PS>): Promise<__compactRuntime.ConstructorResult<PS>>;
}

export declare function ledger(state: __compactRuntime.StateValue | __compactRuntime.ChargedState): Ledger;
export declare const pureCircuits: PureCircuits;
export declare const expectedVk: Record<string, string>;
export declare const circuitSignatures: __compactRuntime.CircuitSignatures;
export declare const declaredInterfaces: __compactRuntime.DeclaredInterfaces;
