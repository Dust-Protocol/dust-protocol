import { DocsPage } from "@/components/docs/DocsPage";
import { DocsCallout } from "@/components/docs/DocsCallout";
import { DocsStepList } from "@/components/docs/DocsStepList";
import { DocsBadge } from "@/components/docs/DocsBadge";
import {
  SwapFlowDiagramSnippet,
  SwapTokenPairSnippet,
  SwapDenomSnippet,
  SwapPriceInfoSnippet,
} from "@/components/docs/visuals/SwapFlowPreview";

export default function SwapsAppGuidePage() {
  return (
    <DocsPage
      currentHref="/docs/app-guide/swaps"
      title="Privacy Swaps"
      subtitle="Swap tokens privately through the DustPoolV2 ZK-UTXO pool. The adapter withdraws, swaps on Uniswap V4, and re-deposits the output — all in one atomic transaction."
      badge="APP GUIDE"
    >
      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          How Privacy Swaps Work
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-4">
          Privacy Swaps execute an atomic three-step flow through{" "}
          <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">DustSwapAdapterV2</code>.
          Your browser generates an FFLONK proof to withdraw from DustPoolV2, the adapter swaps the
          withdrawn tokens on a vanilla Uniswap V4 pool, then deposits the output back into
          DustPoolV2 as a new UTXO note. The on-chain record never links your input to the swap output.
        </p>
        <SwapFlowDiagramSnippet />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-4 uppercase">
          The Swap Flow
        </h2>
        <SwapTokenPairSnippet />
        <DocsStepList steps={[
          {
            title: "Select input and output tokens",
            children: <>Choose the token pair (e.g., ETH to USDC) and enter the amount you want to swap.
              Your shielded pool balance is shown next to the FROM field.</>,
          },
          {
            title: "Get quote from Uniswap V4",
            children: <>The app fetches a real-time quote from the Uniswap V4 pool quoter. The estimated
              output, exchange rate, and minimum received amount (after slippage and relayer fee) are
              displayed in the price info panel.</>,
          },
          {
            title: "Generate FFLONK proof",
            children: <>Your browser generates a zero-knowledge proof using the DustV2Transaction circuit
              (~12,400 constraints). The proof demonstrates ownership of valid UTXO notes without
              revealing which ones. The proof&apos;s <code className="text-xs bg-[rgba(255,255,255,0.06)] px-1.5 rounded-sm">recipient</code> is
              set to the adapter contract address.</>,
          },
          {
            title: "Relayer calls DustSwapAdapterV2",
            children: <>The proof and swap parameters are sent to the relayer. The adapter atomically
              <strong> (1)</strong> withdraws from DustPoolV2,{" "}
              <strong>(2)</strong> swaps on the Uniswap V4 pool,{" "}
              <strong>(3)</strong> computes a Poseidon commitment and deposits the output back. If any
              step fails, the entire transaction reverts.</>,
          },
          {
            title: "Output deposited as new UTXO note",
            children: <>The swap output arrives as a fresh shielded note in DustPoolV2. Your browser
              saves this note (encrypted in IndexedDB). You can withdraw, transfer, or swap it
              again — it is indistinguishable from any other note in the pool.</>,
          },
        ]} />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Denomination Privacy
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
          When enabled (default ON), the denomination privacy engine splits your swap amount into
          common-sized ETH chunks (e.g., 1, 0.5, 0.3, 0.2, 0.1 ETH). Each chunk is swapped in a
          separate transaction with random 1-5 second delays between them. This prevents amount
          correlation — an observer cannot link your swap to a specific deposit by matching the exact
          amount.
        </p>
        <SwapDenomSnippet />
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          The app suggests nearby rounded amounts that require fewer chunks. Fewer chunks means a
          faster swap and less total gas.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Price &amp; Slippage
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed mb-3">
          The reference price comes from a Chainlink oracle, with the pool spot price as fallback.
          Slippage tolerance is configurable: 0.1%, 0.5%, 1%, or a custom value up to 50%.
          If price impact exceeds 50%, the UI shows a red warning — this indicates low pool liquidity.
        </p>
        <SwapPriceInfoSnippet />
      </section>

      <section className="mb-10">
        <h2 className="text-sm font-mono font-semibold text-white tracking-wider mb-3 uppercase">
          Relayer Fee
        </h2>
        <p className="text-sm text-[rgba(255,255,255,0.6)] leading-relaxed">
          A 2% fee is deducted from the swap output to cover gas costs and relayer operations. The
          minimum received amount shown in the price panel already accounts for both slippage tolerance
          and the relayer fee.
        </p>
      </section>

      <DocsCallout type="info" title="CHAIN AVAILABILITY">
        Swaps are available on Ethereum Sepolia, Arbitrum Sepolia, Base Sepolia (Uniswap V4), and
        Flow EVM Testnet (PunchSwap V2). Thanos Sepolia and OP Sepolia support pool operations
        (deposits, withdrawals, transfers) but not swaps.
      </DocsCallout>

      <DocsCallout type="tip" title="FEWER CHUNKS = FASTER">
        Use the denomination suggestions to pick a nearby amount that requires fewer chunks. Fewer
        chunks means a faster swap and less total gas.
      </DocsCallout>

      <section className="mt-8">
        <div className="flex flex-wrap gap-2">
          <DocsBadge variant="green">FFLONK</DocsBadge>
          <DocsBadge variant="green">Uniswap V4</DocsBadge>
          <DocsBadge variant="green">Chainlink</DocsBadge>
          <DocsBadge variant="muted">DustSwapAdapterV2</DocsBadge>
        </div>
      </section>
    </DocsPage>
  );
}
