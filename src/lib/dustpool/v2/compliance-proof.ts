// Client-side FFLONK proof generation for the DustV2Compliance circuit.
//
// The compliance circuit (~6,884 constraints) is small enough to run on the
// main thread without a web worker. Follows the same pattern as proof.ts.


export const COMPLIANCE_WASM_PATH = '/circuits/v2-compliance/DustV2Compliance.wasm'
export const COMPLIANCE_ZKEY_PATH = '/circuits/v2-compliance/DustV2Compliance.zkey'
export const COMPLIANCE_VKEY_PATH = '/circuits/v2-compliance/verification_key.json'

const SMT_LEVELS = 20

export interface ComplianceProofInputs {
  exclusionRoot: bigint
  nullifier: bigint
  commitment: bigint
  nullifierKey: bigint
  leafIndex: bigint
  smtSiblings: bigint[]
  smtOldKey: bigint
  smtOldValue: bigint
  smtIsOld0: bigint
}

export interface ComplianceProofResult {
  proof: unknown
  publicSignals: string[]
  proofCalldata: string
}

function formatCircuitInputs(
  inputs: ComplianceProofInputs
): Record<string, string | string[]> {
  if (inputs.smtSiblings.length !== SMT_LEVELS) {
    throw new Error(
      `Expected ${SMT_LEVELS} SMT siblings, got ${inputs.smtSiblings.length}`
    )
  }

  return {
    exclusionRoot: inputs.exclusionRoot.toString(),
    nullifier: inputs.nullifier.toString(),
    commitment: inputs.commitment.toString(),
    nullifierKey: inputs.nullifierKey.toString(),
    leafIndex: inputs.leafIndex.toString(),
    smtSiblings: inputs.smtSiblings.map(String),
    smtOldKey: inputs.smtOldKey.toString(),
    smtOldValue: inputs.smtOldValue.toString(),
    smtIsOld0: inputs.smtIsOld0.toString(),
  }
}

/**
 * Extract 768-byte proof from FFLONK calldata.
 * Format: `[0x<el0>, ..., 0x<el23>],[0x<sig0>, ...]`
 */
function parseCalldataProofHex(calldata: string): string {
  const hexElements = calldata.match(/0x[0-9a-fA-F]+/g)
  if (!hexElements || hexElements.length < 24) {
    throw new Error(
      `Failed to parse FFLONK calldata — expected ≥24 hex elements, got ${hexElements?.length ?? 0}`
    )
  }
  return '0x' + hexElements.slice(0, 24).map((e) => e.slice(2)).join('')
}

export async function generateComplianceProof(
  inputs: ComplianceProofInputs
): Promise<ComplianceProofResult> {
  const circuitInputs = formatCircuitInputs(inputs)

  const { fflonk } = await import('snarkjs')
  const { proof, publicSignals } = await fflonk.fullProve(
    circuitInputs,
    COMPLIANCE_WASM_PATH,
    COMPLIANCE_ZKEY_PATH
  )

  // DustV2Compliance has 2 public signals: [exclusionRoot, nullifier]
  if (publicSignals.length !== 2) {
    throw new Error(
      `Compliance proof produced ${publicSignals.length} public signals, expected 2`
    )
  }

  const calldata = await fflonk.exportSolidityCallData(publicSignals, proof)
  const proofCalldata = parseCalldataProofHex(calldata)

  return { proof, publicSignals, proofCalldata }
}

export async function verifyComplianceProofLocally(
  proof: unknown,
  publicSignals: string[]
): Promise<boolean> {
  try {
    const vKeyResponse = await fetch(COMPLIANCE_VKEY_PATH)
    const vKey = await vKeyResponse.json()
    const { fflonk } = await import('snarkjs')
    return await fflonk.verify(vKey, publicSignals, proof)
  } catch (error) {
    console.error('[Compliance] Local verification failed:', error)
    return false
  }
}
