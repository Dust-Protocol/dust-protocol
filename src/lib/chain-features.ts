import { getChainConfig } from '@/config/chains';
import { isSwapSupported } from '@/lib/swap/constants';

export interface ChainFeatures {
  dustPoolV2: boolean;
  dustSwap: boolean;
  compliance: boolean;
  names: boolean;
  eip7702: boolean;
}

export function getChainFeatures(chainId: number): ChainFeatures {
  const config = getChainConfig(chainId);
  const c = config.contracts;

  return {
    dustPoolV2: !!c.dustPoolV2,
    dustSwap: isSwapSupported(chainId),
    compliance: !!c.dustPoolV2ComplianceVerifier,
    names: !!c.nameRegistry,
    eip7702: config.supportsEIP7702,
  };
}

export const FEATURE_LABELS: Record<keyof ChainFeatures, string> = {
  dustPoolV2: 'Shield Pool V2',
  dustSwap: 'Private Swap',
  compliance: 'Compliance Screening',
  names: 'Stealth Names',
  eip7702: 'EIP-7702 Delegation',
};
