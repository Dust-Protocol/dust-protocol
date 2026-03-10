import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsBadge } from "@/components/docs/DocsBadge";
import { docsMetadata } from "@/lib/seo/metadata";

const sepoliaContracts = [
  {
    name: "ERC5564Announcer",
    address: "0x64044FfBefA7f1252DdfA931c939c19F21413aB0",
    role: "Emits Announcement events when ETH is sent to a stealth address. The discovery mechanism for all incoming payments.",
    standard: "ERC-5564",
    explorer: "https://sepolia.etherscan.io/address/0x64044FfBefA7f1252DdfA931c939c19F21413aB0",
  },
  {
    name: "ERC6538Registry",
    address: "0xb848398167054cCb66264Ec25C35F8CfB1EF1Ca7",
    role: "Maps wallet addresses to stealth meta-addresses. Used for no-opt-in payments to any address that has registered.",
    standard: "ERC-6538",
    explorer: "https://sepolia.etherscan.io/address/0xb848398167054cCb66264Ec25C35F8CfB1EF1Ca7",
  },
  {
    name: "StealthNameRegistry",
    address: "0x857e17A85891Ef1C595e51Eb7Cd56c607dB21313",
    role: "Maps .dust names to stealth meta-addresses. Supports register, update, transfer, and sub-accounts.",
    standard: "Custom",
    explorer: "https://sepolia.etherscan.io/address/0x857e17A85891Ef1C595e51Eb7Cd56c607dB21313",
  },
  {
    name: "EntryPoint",
    address: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    role: "ERC-4337 EntryPoint v0.6. Processes UserOperations for gasless stealth claims.",
    standard: "ERC-4337",
    explorer: "https://sepolia.etherscan.io/address/0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  },
  {
    name: "DustPaymaster",
    address: "0x20C28cbF9bc462Fb361C8DAB0C0375011b81BEb2",
    role: "Sponsors gas for stealth claim UserOperations. Recipients claim with zero ETH in their stealth wallet.",
    standard: "ERC-4337",
    explorer: "https://sepolia.etherscan.io/address/0x20C28cbF9bc462Fb361C8DAB0C0375011b81BEb2",
  },
  {
    name: "AccountFactory",
    address: "0xc73fce071129c7dD7f2F930095AfdE7C1b8eA82A",
    role: "Deploys StealthAccount contracts at CREATE2 addresses during claims.",
    standard: "ERC-4337",
    explorer: "https://sepolia.etherscan.io/address/0xc73fce071129c7dD7f2F930095AfdE7C1b8eA82A",
  },
  {
    name: "DustPool",
    address: "0xc95a359E66822d032A6ADA81ec410935F3a88bcD",
    role: "Privacy pool. Accepts Poseidon commitments + ETH deposits. Verifies Groth16 proofs for ZK withdrawals.",
    standard: "Custom ZK",
    explorer: "https://sepolia.etherscan.io/address/0xc95a359E66822d032A6ADA81ec410935F3a88bcD",
  },
  {
    name: "DustPoolVerifier",
    address: "0x17f52f01ffcB6d3C376b2b789314808981cebb16",
    role: "On-chain Groth16 proof verifier (BN254) for DustPool withdrawals.",
    standard: "Groth16",
    explorer: "https://sepolia.etherscan.io/address/0x17f52f01ffcB6d3C376b2b789314808981cebb16",
  },
  {
    name: "DustSwapAdapterV2",
    address: "0xe2bE4d7b5C1952B3DDB210499800A45aa0DD097C",
    role: "V2 privacy swap adapter. Atomic: withdraws from DustPoolV2 via FFLONK proof, swaps on a vanilla Uniswap V4 pool, commits output back to DustPoolV2 via on-chain Poseidon.",
    standard: "ZK-UTXO / Uniswap V4",
    explorer: "https://sepolia.etherscan.io/address/0xe2bE4d7b5C1952B3DDB210499800A45aa0DD097C",
  },
  {
    name: "DustPoolV2",
    address: "0x03D52fd442965cD6791Ce5AFab78C60671f9558A",
    role: "V2 ZK-UTXO privacy pool. Arbitrary-amount deposits, FFLONK proof verification, split withdrawals, Chainalysis compliance screening, 1-hour deposit cooldown.",
    standard: "ZK-UTXO / FFLONK",
    explorer: "https://sepolia.etherscan.io/address/0x03D52fd442965cD6791Ce5AFab78C60671f9558A",
  },
  {
    name: "DustPoolV2 Verifier (FFLONK)",
    address: "0xd4B52Fd4CDFCCA41E6F88f1a1AfA9A0B715290e7",
    role: "On-chain FFLONK proof verifier for DustPoolV2 transaction circuit (2-in-2-out, 9 public signals).",
    standard: "FFLONK",
    explorer: "https://sepolia.etherscan.io/address/0xd4B52Fd4CDFCCA41E6F88f1a1AfA9A0B715290e7",
  },
  {
    name: "DustPoolV2 Split Verifier (FFLONK)",
    address: "0x2c53Ea8983dCA7b2d4cA1aa4ECfBc6e513e0Fc6E",
    role: "On-chain FFLONK proof verifier for DustPoolV2 split circuit (2-in-8-out, 15 public signals). Used for denomination privacy.",
    standard: "FFLONK",
    explorer: "https://sepolia.etherscan.io/address/0x2c53Ea8983dCA7b2d4cA1aa4ECfBc6e513e0Fc6E",
  },
  {
    name: "Uniswap V4 PoolManager",
    address: "0x93805603e0167574dFe2F50ABdA8f42C85002FD8",
    role: "Core Uniswap V4 contract. Manages liquidity pools used by DustSwapAdapterV2 for private swaps.",
    standard: "Uniswap V4",
    explorer: "https://sepolia.etherscan.io/address/0x93805603e0167574dFe2F50ABdA8f42C85002FD8",
  },
  {
    name: "SubAccount7702",
    address: "0xdf34D138d1E0beC7127c32E9Aa1273E8B4DE7dFF",
    role: "EIP-7702 sub-account delegation target. Enables EOA-as-smart-account functionality for advanced claims.",
    standard: "EIP-7702",
    explorer: "https://sepolia.etherscan.io/address/0xdf34D138d1E0beC7127c32E9Aa1273E8B4DE7dFF",
  },
];

const thanosContracts = [
  {
    name: "ERC5564Announcer",
    address: "0x2C2a59E9e71F2D1A8A2D447E73813B9F89CBb125",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0x2C2a59E9e71F2D1A8A2D447E73813B9F89CBb125",
  },
  {
    name: "ERC6538Registry",
    address: "0x9C527Cc8CB3F7C73346EFd48179e564358847296",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0x9C527Cc8CB3F7C73346EFd48179e564358847296",
  },
  {
    name: "StealthNameRegistry",
    address: "0xD06389cEEd802817C439E0F803E71b02ceb132b4",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0xD06389cEEd802817C439E0F803E71b02ceb132b4",
  },
  {
    name: "DustPool",
    address: "0x16b8c82e3480b1c5B8dbDf38aD61a828a281e2c3",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0x16b8c82e3480b1c5B8dbDf38aD61a828a281e2c3",
  },
  {
    name: "DustPoolV2",
    address: "0x283800e6394DF6ad17aC53D8d48CD8C0c048B7Ad",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0x283800e6394DF6ad17aC53D8d48CD8C0c048B7Ad",
  },
  {
    name: "DustPoolV2 Verifier (FFLONK)",
    address: "0x51B2936AF26Df0f087C18E5B478Ae2bda8AD5325",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0x51B2936AF26Df0f087C18E5B478Ae2bda8AD5325",
  },
  {
    name: "DustPoolV2 Split Verifier (FFLONK)",
    address: "0x4031D4559ba1D5878caa8Acc627555748D528AE4",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0x4031D4559ba1D5878caa8Acc627555748D528AE4",
  },
  {
    name: "EntryPoint",
    address: "0x5c058Eb93CDee95d72398E5441d989ef6453D038",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0x5c058Eb93CDee95d72398E5441d989ef6453D038",
  },
  {
    name: "DustPaymaster",
    address: "0x9e2eb36F7161C066351DC9E418E7a0620EE5d095",
    explorer: "https://explorer.thanos-sepolia.tokamak.network/address/0x9e2eb36F7161C066351DC9E418E7a0620EE5d095",
  },
];

const flowContracts = [
  {
    name: "ERC5564Announcer",
    address: "0xfE55B104f6A200cbD17D0Be5a90D17a2A2a0d223",
    explorer: "https://evm-testnet.flowscan.io/address/0xfE55B104f6A200cbD17D0Be5a90D17a2A2a0d223",
  },
  {
    name: "ERC6538Registry",
    address: "0x5ac18d5AdaC9b65E1Be9291A7C2cDbf33b584a3b",
    explorer: "https://evm-testnet.flowscan.io/address/0x5ac18d5AdaC9b65E1Be9291A7C2cDbf33b584a3b",
  },
  {
    name: "NameRegistryMerkle",
    address: "0x2319E5B6DBb639049E98f3E4D1EE9A67E0CB46fb",
    explorer: "https://evm-testnet.flowscan.io/address/0x2319E5B6DBb639049E98f3E4D1EE9A67E0CB46fb",
  },
  {
    name: "NameVerifier",
    address: "0x0d25EC7B314E4208EEa29bCDb9F6313965a99BdE",
    explorer: "https://evm-testnet.flowscan.io/address/0x0d25EC7B314E4208EEa29bCDb9F6313965a99BdE",
  },
  {
    name: "StealthWalletFactory",
    address: "0x97b74D21ca46c3CaB2918fF10c8418c606223638",
    explorer: "https://evm-testnet.flowscan.io/address/0x97b74D21ca46c3CaB2918fF10c8418c606223638",
  },
  {
    name: "StealthAccountFactory",
    address: "0x77c3d8c2B0bb27c9A8ACCa39F2398aaa021eb776",
    explorer: "https://evm-testnet.flowscan.io/address/0x77c3d8c2B0bb27c9A8ACCa39F2398aaa021eb776",
  },
  {
    name: "DustPaymaster",
    address: "0xC3c8Fa75910FED41D30221615d6875D2079179b8",
    explorer: "https://evm-testnet.flowscan.io/address/0xC3c8Fa75910FED41D30221615d6875D2079179b8",
  },
  {
    name: "FflonkVerifier (9 signals)",
    address: "0x0e4cF377fc18E46BB1184e4274367Bc0dB958573",
    explorer: "https://evm-testnet.flowscan.io/address/0x0e4cF377fc18E46BB1184e4274367Bc0dB958573",
  },
  {
    name: "FflonkSplitVerifier (15 signals)",
    address: "0x75BD499f7CA8E361b7930e2881b2B3c99Aa1eea1",
    explorer: "https://evm-testnet.flowscan.io/address/0x75BD499f7CA8E361b7930e2881b2B3c99Aa1eea1",
  },
  {
    name: "FflonkComplianceVerifier",
    address: "0x5779192B220876221Bc2871511FB764941314e04",
    explorer: "https://evm-testnet.flowscan.io/address/0x5779192B220876221Bc2871511FB764941314e04",
  },
  {
    name: "TestnetComplianceOracle",
    address: "0xACe425FC23d7594b829935EC4862f654541Bf0d3",
    explorer: "https://evm-testnet.flowscan.io/address/0xACe425FC23d7594b829935EC4862f654541Bf0d3",
  },
  {
    name: "DustPoolV2",
    address: "0x72f0bd8d014cdB045efD33311028A3013769d69F",
    explorer: "https://evm-testnet.flowscan.io/address/0x72f0bd8d014cdB045efD33311028A3013769d69F",
  },
];

export const metadata = docsMetadata("Smart Contracts — Deployed Addresses & Standards", "All Dust Protocol smart contract addresses on Ethereum Sepolia, Thanos Sepolia, and Flow EVM Testnet. Includes ERC-5564 Announcer, ERC-6538 Registry, DustPool, and DustPaymaster.", "/docs/contracts");

export default function ContractsPage() {
  return (
    <DocsPage
      currentHref="/docs/contracts"
      title="Smart Contracts"
      subtitle="Deployed contract addresses for all Dust Protocol components on supported testnets."
      badge="TECHNICAL REFERENCE"
    >

      <DocsCallout type="warning" title="Testnet Only">
        These are testnet deployments. Contract addresses will change for mainnet. Do not send mainnet funds.
      </DocsCallout>

      {/* Ethereum Sepolia */}
      <section className="mb-12">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-mono font-semibold text-white tracking-wider uppercase">Ethereum Sepolia</h2>
          <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)]">Chain ID: 11155111</span>
          <DocsBadge variant="green">EIP-7702</DocsBadge>
          <DocsBadge variant="muted">Canonical for naming</DocsBadge>
        </div>

        <div className="space-y-2">
          {sepoliaContracts.map((c) => (
            <div key={c.address} className="border border-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <p className="text-[12px] font-mono font-semibold text-white">{c.name}</p>
                    {"standard" in c && (
                      <DocsBadge variant={
                        c.standard.includes("ERC-4337") ? "amber" :
                        c.standard.includes("ZK") || c.standard.includes("Groth16") || c.standard.includes("FFLONK") ? "green" :
                        c.standard.includes("Uniswap") ? "blue" :
                        c.standard.includes("EIP-7702") ? "amber" : "muted"
                      }>{c.standard}</DocsBadge>
                    )}
                  </div>
                  {"role" in c && (
                    <p className="text-xs text-[rgba(255,255,255,0.45)] leading-relaxed mb-2">{c.role}</p>
                  )}
                  <code className="text-[10px] font-mono text-[rgba(0,255,65,0.6)] break-all">{c.address}</code>
                </div>
                <a
                  href={c.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-mono text-[rgba(255,255,255,0.3)] hover:text-[#00FF41] transition-colors pt-1"
                >
                  Explorer ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Thanos Sepolia */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-mono font-semibold text-white tracking-wider uppercase">Thanos Sepolia</h2>
          <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)]">Chain ID: 111551119090</span>
          <DocsBadge variant="muted">Tokamak Network</DocsBadge>
        </div>
        <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed mb-4">
          Thanos Sepolia has core stealth transfer, V1 pool, and V2 ZK-UTXO pool contracts. DustSwapAdapterV2 (privacy swaps via DustPoolV2 + Uniswap V4) is
          deployed on Ethereum Sepolia only.
        </p>

        <div className="space-y-2">
          {thanosContracts.map((c) => (
            <div key={c.address} className="border border-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-mono font-semibold text-white mb-1.5">{c.name}</p>
                  <code className="text-[10px] font-mono text-[rgba(0,255,65,0.6)] break-all">{c.address}</code>
                </div>
                <a
                  href={c.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-mono text-[rgba(255,255,255,0.3)] hover:text-[#00FF41] transition-colors pt-1"
                >
                  Explorer ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Flow EVM Testnet */}
      <section className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-mono font-semibold text-white tracking-wider uppercase">Flow EVM Testnet</h2>
          <span className="text-[10px] font-mono text-[rgba(255,255,255,0.3)]">Chain ID: 545</span>
          <DocsBadge variant="muted">Flow Network</DocsBadge>
        </div>
        <p className="text-xs text-[rgba(255,255,255,0.4)] leading-relaxed mb-4">
          Flow EVM Testnet has core stealth transfer, V2 ZK-UTXO pool, and compliance contracts. DustSwap not yet deployed.
        </p>

        <div className="space-y-2">
          {flowContracts.map((c) => (
            <div key={c.address} className="border border-[rgba(255,255,255,0.06)] rounded-sm overflow-hidden">
              <div className="px-4 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-mono font-semibold text-white mb-1.5">{c.name}</p>
                  <code className="text-[10px] font-mono text-[rgba(0,255,65,0.6)] break-all">{c.address}</code>
                </div>
                <a
                  href={c.explorer}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-mono text-[rgba(255,255,255,0.3)] hover:text-[#00FF41] transition-colors pt-1"
                >
                  Explorer ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Source code */}
      <section>
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">Source Code</h2>
        <div className="space-y-2">
          {[
            { name: "ERC5564Announcer.sol", path: "contracts/ERC5564Announcer.sol", desc: "ERC-5564 stealth announcement" },
            { name: "ERC6538Registry.sol", path: "contracts/ERC6538Registry.sol", desc: "ERC-6538 meta-address registry" },
            { name: "StealthNameRegistry.sol", path: "contracts/StealthNameRegistry.sol", desc: ".dust name registry" },
            { name: "StealthRelayer.sol", path: "contracts/StealthRelayer.sol", desc: "EIP-712 signed withdrawal relayer (0.5% fee)" },
            { name: "DustPool.sol", path: "contracts/dustpool/src/DustPool.sol", desc: "Privacy pool core contract" },
            { name: "DustSwapAdapterV2.sol", path: "contracts/dustswap/src/DustSwapAdapterV2.sol", desc: "V2 atomic privacy swap adapter (DustPoolV2 + vanilla V4 pool)" },
            { name: "DustPoolV2.sol", path: "contracts/dustpool/src/DustPoolV2.sol", desc: "V2 ZK-UTXO privacy pool (FFLONK, split withdrawals, compliance)" },
            { name: "DustV2Transaction.circom", path: "contracts/dustpool/circuits/v2/DustV2Transaction.circom", desc: "2-in-2-out transaction circuit (12,400 constraints)" },
            { name: "DustV2Split.circom", path: "contracts/dustpool/circuits/v2/DustV2Split.circom", desc: "2-in-8-out split circuit (32,074 constraints)" },
            { name: "ChainalysisScreener.sol", path: "contracts/dustpool/src/ChainalysisScreener.sol", desc: "Compliance oracle wrapper for deposit screening" },
          ].map(({ name, path, desc }) => (
            <div key={name} className="flex items-center gap-4 px-3 py-2.5 border border-[rgba(255,255,255,0.04)] rounded-sm hover:border-[rgba(255,255,255,0.08)] transition-colors">
              <code className="text-[11px] font-mono text-[#00FF41] shrink-0">{name}</code>
              <span className="text-xs text-[rgba(255,255,255,0.3)] flex-1 min-w-0 truncate">{path}</span>
              <span className="text-xs text-[rgba(255,255,255,0.4)] shrink-0 hidden sm:block">{desc}</span>
            </div>
          ))}
        </div>
      </section>
    </DocsPage>
  );
}
