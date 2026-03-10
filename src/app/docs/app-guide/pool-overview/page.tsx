import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsBadge } from "@/components/docs/DocsBadge";
import {
  PoolTvlSnippet,
  PoolShieldedSnippet,
  PoolOracleSnippet,
  PoolInfoSnippet,
  PoolCapacitySnippet,
  PoolNetworksSnippet,
} from "@/components/docs/visuals/PoolOverviewPreview";

export default function PoolOverviewAppGuidePage() {
  return (
    <DocsPage
      currentHref="/docs/app-guide/pool-overview"
      title="Pool Overview"
      subtitle="Real-time stats for the privacy pool and swap liquidity. TVL, shielded balances, oracle pricing, Merkle tree capacity, and supported networks — all in one view."
      badge="APP GUIDE"
    >
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Two Pools
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
          Dust Protocol operates two distinct pools that together form the privacy infrastructure.{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">DustPoolV2</code> is the
          ZK-UTXO privacy pool where deposits, withdrawals, and transfers happen. It holds shielded
          ETH and USDC as encrypted UTXO notes. The second pool is a vanilla Uniswap V4 pool used
          exclusively for swap liquidity (ETH/USDC).
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          The TVL displayed in the sidebar is the combined value of both pools — shielded assets in
          DustPoolV2 plus the ETH and USDC reserves in the Uniswap V4 pool.
        </p>
        <PoolTvlSnippet />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Shielded Balances
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
          The &ldquo;Shielded&rdquo; section shows the total ETH and USDC held inside DustPoolV2, read
          from the contract&apos;s{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">totalDeposited(asset)</code>{" "}
          mapping. The progress bar shows the USD-denominated ratio between the two assets.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          These balances are fully shielded — individual note amounts, owners, and transaction history
          are hidden by the ZK-UTXO model. Only the aggregate totals per asset are publicly visible
          on-chain.
        </p>
        <PoolShieldedSnippet />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Oracle Price
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
          The ETH/USD price comes from two sources, with Chainlink preferred. The Chainlink oracle
          at{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">0x694AA1769357215DE4FAC081bf1f309aDC325306</code>{" "}
          on Ethereum Sepolia is checked first. If the price is stale (older than 1 hour) or deviates
          more than 10% from the pool spot price, the app falls back to computing the price from the
          Uniswap V4 pool&apos;s{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">sqrtPriceX96</code>.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          The badge next to the &ldquo;Oracle&rdquo; label indicates which source is active —{" "}
          <span className="text-[#00FF41]">CHAINLINK</span> (green) or POOL (dim). The current pool
          tick is shown below the price for reference.
        </p>
        <PoolOracleSnippet />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Pool Parameters
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider py-2 pr-4">Parameter</th>
                <th className="text-left text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider py-2 pr-4">Value</th>
                <th className="text-left text-[10px] text-[rgba(255,255,255,0.45)] uppercase tracking-wider py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="text-[rgba(255,255,255,0.6)]">
              <tr className="border-b border-[rgba(255,255,255,0.04)]">
                <td className="py-2 pr-4">Fee tier</td>
                <td className="py-2 pr-4 text-white">0.05%</td>
                <td className="py-2">Uniswap V4 swap fee</td>
              </tr>
              <tr className="border-b border-[rgba(255,255,255,0.04)]">
                <td className="py-2 pr-4">Relayer fee</td>
                <td className="py-2 pr-4 text-white">2%</td>
                <td className="py-2">Deducted from withdrawal/swap output</td>
              </tr>
              <tr className="border-b border-[rgba(255,255,255,0.04)]">
                <td className="py-2 pr-4">Proof system</td>
                <td className="py-2 pr-4 text-white">FFLONK</td>
                <td className="py-2">22% cheaper than Groth16, no trusted setup</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Merkle tree depth</td>
                <td className="py-2 pr-4 text-white">20</td>
                <td className="py-2">1,048,576 max notes (2<sup>20</sup>)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <PoolInfoSnippet />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Merkle Tree Capacity
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
          Every deposit creates a new leaf in the Merkle tree. The tree has 2<sup>20</sup> = 1,048,576 slots.
          The &ldquo;Capacity&rdquo; bar shows current utilization — how many notes exist versus the
          maximum. On testnet this is typically well under 1%.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          When the tree fills completely, new deposits would require deploying a new DustPoolV2
          instance with a fresh tree. This migration path is planned but not yet implemented.
        </p>
        <PoolCapacitySnippet />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Supported Networks
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
          <span className="text-white">Ethereum Sepolia</span> — Full feature set: DustPoolV2 (deposits,
          withdrawals, transfers), Uniswap V4 swap pool, DustSwapAdapterV2, and Chainlink oracle.
          This is the primary testnet.
        </p>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          <span className="text-white">Thanos Sepolia</span> — Pool operations only (deposits,
          withdrawals, transfers). No swap pool or oracle. Shown as a dimmed entry in the networks
          list. Additional L2 deployments are planned.
        </p>
        <PoolNetworksSnippet />
      </section>

      <DocsCallout type="info" title="TVL COMPUTATION">
        TVL = (shielded ETH &times; oracle price) + shielded USDC + (swap pool ETH reserve &times; oracle
        price) + swap pool USDC reserve. All values update every 60 seconds via RPC polling.
      </DocsCallout>

      <DocsCallout type="tip" title="POOL COMPOSITION">
        The vertical bar on the right shows the combined ETH vs USDC composition across both pools.
        This helps gauge exposure before swapping — a heavily lopsided pool may have higher price impact.
      </DocsCallout>

      <section className="mt-8">
        <div className="flex flex-wrap gap-2">
          <DocsBadge variant="green">Chainlink</DocsBadge>
          <DocsBadge variant="green">FFLONK</DocsBadge>
          <DocsBadge variant="green">Uniswap V4</DocsBadge>
          <DocsBadge variant="muted">Multi-chain</DocsBadge>
        </div>
      </section>
    </DocsPage>
  );
}
