"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { WagmiProvider, createConfig as createPrivyConfig } from "@privy-io/wagmi";
import { createConfig as createWagmiConfig } from "wagmi";
import { http, fallback } from "wagmi";
import { injected, metaMask } from "wagmi/connectors";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getVisibleChains } from "@/config/chains";
import { PRIVY_APP_ID, PRIVY_CONFIG, isPrivyEnabled } from "@/config/privy";

const supportedChains = getVisibleChains();
const viemChains = supportedChains.map(c => c.viemChain);
const transports = Object.fromEntries(
  supportedChains.map(c => [
    c.id,
    c.rpcUrls.length > 1
      ? fallback(c.rpcUrls.map(url => http(url)))
      : http(c.rpcUrls[0])
  ])
);

// Privy-managed wagmi config (used when Privy is enabled)
const privyConfig = createPrivyConfig({
  chains: viemChains as [typeof viemChains[0], ...typeof viemChains],
  transports,
});

// Standalone wagmi config (used when Privy is disabled — dev / no env var)
const standaloneConfig = createWagmiConfig({
  chains: viemChains as [typeof viemChains[0], ...typeof viemChains],
  transports,
  connectors: [injected(), metaMask()],
});

// Re-export so the landing page can import WagmiProvider from here when needed
import { WagmiProvider as WagmiProviderStandalone } from "wagmi";

export function Providers({ children }: { children: React.ReactNode }) {
  // QueryClient inside component prevents SSR cache pollution and cross-session data leakage
  const [queryClient] = useState(() => new QueryClient());
  if (!isPrivyEnabled) {
    // Always provide a WagmiProvider so useConnect / useAccount work everywhere
    return (
      <WagmiProviderStandalone config={standaloneConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProviderStandalone>
    );
  }

  return (
    <PrivyProvider appId={PRIVY_APP_ID} config={PRIVY_CONFIG}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={privyConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
