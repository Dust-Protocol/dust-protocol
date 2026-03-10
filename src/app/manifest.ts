import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dust Protocol — Private Transfers on Ethereum",
    short_name: "Dust",
    description:
      "Send and receive crypto privately using stealth addresses (ERC-5564) and zero-knowledge proofs. Gasless claims, .dust usernames, and private swaps via Uniswap V4.",
    start_url: "/",
    display: "standalone",
    background_color: "#06080F",
    theme_color: "#00FF41",
    orientation: "any",
    categories: ["finance", "cryptocurrency", "security"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Dashboard",
        short_name: "Dashboard",
        url: "/dashboard",
        description: "View stealth wallet balances and claim payments",
      },
      {
        name: "Privacy Pools",
        short_name: "Pools",
        url: "/pools",
        description: "Deposit to ZK privacy pools and withdraw with zero-knowledge proofs",
      },
      {
        name: "Private Swap",
        short_name: "Swap",
        url: "/swap",
        description: "Swap tokens privately via Uniswap V4 with ZK proofs",
      },
      {
        name: "Documentation",
        short_name: "Docs",
        url: "/docs/overview",
        description: "Technical documentation for stealth addresses, privacy pools, and swaps",
      },
    ],
  };
}
