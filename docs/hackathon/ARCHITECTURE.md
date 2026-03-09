# Dust Protocol — Architecture

## System Overview

```mermaid
graph TB
    subgraph Users
        W[Wallet User]
        AI[AI Agent]
    end

    subgraph Frontend ["Frontend (Next.js 14)"]
        PR[Privy Auth]
        PIN[PIN + Signature]
        KD[Key Derivation<br/>PBKDF2]
        SA[Stealth Address<br/>ECDH / ERC-5564]
    end

    subgraph ZK ["ZK-UTXO Pool (DustPoolV2)"]
        DEP[deposit]
        MT[Poseidon Merkle Tree<br/>depth 20]
        WD[withdraw<br/>FFLONK proof]
        SP[withdrawSplit<br/>2-in-8-out]
        CO[Chainalysis Oracle<br/>Deposit Screening]
    end

    subgraph Swap ["Private Swaps"]
        DSA[DustSwapAdapterV2]
        V4[Uniswap V4 Pool]
        CL[Chainlink Oracle<br/>ETH/USD]
    end

    subgraph x402 ["x402 Privacy Payments"]
        SRV[API Server<br/>HTTP 402]
        CLI[Agent Client<br/>ZK Proof Gen]
        FAC[Facilitator<br/>Verify + Settle]
        TS[Tree Service<br/>Merkle Indexer]
    end

    W --> PR --> PIN --> KD
    KD --> SA
    KD --> DEP
    W --> DEP
    CO -->|screen| DEP
    DEP --> MT
    MT --> WD
    MT --> SP
    WD -->|nullifiers + proof| W

    DSA -->|withdraw| ZK
    DSA -->|swap| V4
    V4 -->|output| DSA
    DSA -->|deposit back| ZK
    CL --> DSA

    AI -->|request| SRV
    SRV -->|402 + shielded| AI
    AI --> CLI
    CLI -->|ZK proof| FAC
    FAC -->|settle via withdraw| ZK
    CLI --> TS
    FAC --> TS
    TS --> MT
```

## ZK Circuit: 2-in-2-out Transaction

```mermaid
graph LR
    subgraph Private Inputs
        SK[spendingKey]
        NK[nullifierKey]
        N0[note0: owner, amount,<br/>asset, chainId, blinding]
        N1[note1: owner, amount,<br/>asset, chainId, blinding]
        MP0[merkleProof0]
        MP1[merkleProof1]
        ON0[outNote0: owner, amount,<br/>asset, chainId, blinding]
        ON1[outNote1: owner, amount,<br/>asset, chainId, blinding]
    end

    subgraph Circuit ["FFLONK Circuit (12,420 constraints)"]
        OWN[Verify ownership<br/>Poseidon check spendingKey]
        NUL[Compute nullifiers<br/>Poseidon check nullifierKey]
        MRK[Verify Merkle inclusion<br/>depth-20 path]
        COM[Compute output commitments<br/>Poseidon 5-ary]
        BAL[Balance check<br/>sumIn = sumOut + pubAmount]
    end

    subgraph Public Signals ["9 Public Signals"]
        PS1[merkleRoot]
        PS2[nullifier0]
        PS3[nullifier1]
        PS4[outCommitment0]
        PS5[outCommitment1]
        PS6[pubAmount]
        PS7[pubAsset]
        PS8[recipient]
        PS9[chainId]
    end

    N0 & N1 --> OWN
    SK --> OWN
    NK --> NUL
    N0 & N1 --> NUL
    MP0 & MP1 --> MRK
    ON0 & ON1 --> COM
    N0 & N1 & ON0 & ON1 --> BAL

    OWN --> PS2 & PS3
    NUL --> PS2 & PS3
    MRK --> PS1
    COM --> PS4 & PS5
    BAL --> PS6
```

## Key Derivation

```mermaid
graph LR
    WS[Wallet Signature<br/>sign 'Dust Protocol'] --> PBKDF2
    PIN[6-digit PIN] --> PBKDF2
    PBKDF2["PBKDF2<br/>100K iterations<br/>salt v2"] --> SEED[Master Seed]
    SEED --> SS[Spending Seed]
    SEED --> VS[Viewing Seed]
    SS -->|mod BN254| SPK[spendingKey]
    VS -->|mod BN254| NLK[nullifierKey]
    SPK -->|"Poseidon(sk)"| OPK[ownerPubKey]
    NLK -->|"Poseidon(nk, commitment, idx)"| NUL[nullifier]
```

## Privacy Guarantees

| Property | Hidden | Public |
|----------|--------|--------|
| **Deposit amount** | After mixing | At deposit time |
| **Withdrawal source** | Which deposit funded it | That *some* valid UTXO was spent |
| **Sender identity** | Deposit-to-withdraw link | Nullifier (unlinkable to deposit) |
| **Recipient** | Stealth address (ECDH) | On-chain stealth address (one-time) |
| **Swap amounts** | Input/output split | Net pool delta |
| **UTXO balances** | Individual note values | Pool TVL |
| **x402 payer** | Agent identity + deposit link | Proof validity + payment amount |
| **Key material** | spendingKey, nullifierKey, PIN | ownerPubKey, nullifiers, commitments |

## Multi-Chain Deployment

| Contract | Eth Sepolia | Thanos Sepolia | Arbitrum Sepolia | OP Sepolia | Base Sepolia |
|----------|:-----------:|:--------------:|:----------------:|:----------:|:------------:|
| **DustPoolV2** | `0x3cbf..3f` | `0x130e..29` | `0x07E9..5d` | `0x068C..aB` | `0x17f5..16` |
| **FFLONK Verifier** | `0xd0f5..8a` | `0x3a8D..da` | `0x8359..28` | `0xe130..cA` | `0xe51e..52` |
| **Split Verifier** | `0x472C..20` | `0xbcb3..E7` | `0x7E72..3A` | `0x6546..06` | `0x503e..F7` |
| **DustSwapAdapterV2** | `0xb91A..00` | -- | `0xe1Ca..94` | -- | `0x844d..16` |
| **Stealth (5564/6538)** | yes | yes | yes | yes | yes |
| **ERC-4337 (Paymaster)** | yes | yes | yes | yes | yes |
| **Compliance Oracle** | yes | yes | yes | yes | yes |

## x402 Privacy Payment Flow

```mermaid
sequenceDiagram
    participant Agent as AI Agent
    participant API as API Server
    participant Fac as Facilitator
    participant Tree as Tree Service
    participant Pool as DustPoolV2

    Agent->>API: GET /api/data
    API-->>Agent: 402 {scheme: "shielded", amount, payTo}

    Agent->>Tree: GET /tree/root
    Tree-->>Agent: {root, leafCount}
    Agent->>Tree: GET /tree/path/:idx
    Tree-->>Agent: {pathElements, pathIndices}

    Note over Agent: Generate FFLONK proof<br/>(proves UTXO ownership,<br/>hides which deposit)

    Agent->>API: GET /api/data + X-PAYMENT header
    API->>Fac: verify(proof, signals)
    Fac->>Pool: isKnownRoot(root)
    Pool-->>Fac: true
    Fac->>Pool: nullifiers(n0), nullifiers(n1)
    Pool-->>Fac: false, false (not spent)
    Fac-->>API: {isValid: true}

    Fac->>Pool: withdraw(proof, signals)
    Pool-->>Fac: tx receipt

    API-->>Agent: 200 {data: "premium content"}
```

## Contract Architecture

```mermaid
graph TB
    subgraph Core
        DP2[DustPoolV2<br/>Pausable, Ownable2Step]
        FV[FflonkVerifier<br/>9 signals]
        SV[FflonkSplitVerifier<br/>15 signals]
        CO[ComplianceOracle]
    end

    subgraph Stealth
        AN[ERC5564Announcer]
        RG[ERC6538Registry]
        NR[NameVerifier]
    end

    subgraph Wallet
        SF[StealthAccountFactory]
        WF[StealthWalletFactory]
        PM[DustPaymaster]
        EP[EntryPoint v0.6]
    end

    subgraph Swap
        DSA[DustSwapAdapterV2<br/>ReentrancyGuard]
        V4PM[Uniswap V4<br/>PoolManager]
        CL[Chainlink<br/>ETH/USD]
    end

    DP2 -->|verify tx proof| FV
    DP2 -->|verify split proof| SV
    DP2 -->|screen deposits| CO
    DSA -->|withdraw + deposit| DP2
    DSA -->|swap| V4PM
    DSA -->|price check| CL
    SF --> EP
    PM --> EP
```
