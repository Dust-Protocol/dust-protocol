import { GraphQLClient } from 'graphql-request';

const SUBGRAPH_URLS: Record<number, string | undefined> = {
  // Thanos Sepolia: no subgraph deployed (custom network not supported on Studio free tier)
  // Falls back to RPC automatically via isGraphAvailable()
  111551119090: process.env.NEXT_PUBLIC_SUBGRAPH_URL_THANOS || undefined,
  11155111: process.env.NEXT_PUBLIC_SUBGRAPH_URL_SEPOLIA
    || 'https://api.studio.thegraph.com/query/1741961/dust-protocol-sepolia/v0.0.2',
  421614: process.env.NEXT_PUBLIC_SUBGRAPH_URL_ARBITRUM_SEPOLIA || undefined,
  11155420: process.env.NEXT_PUBLIC_SUBGRAPH_URL_OP_SEPOLIA || undefined,
  84532: process.env.NEXT_PUBLIC_SUBGRAPH_URL_BASE_SEPOLIA || undefined,
  545: process.env.NEXT_PUBLIC_SUBGRAPH_URL_FLOW_TESTNET || undefined,
};

const REQUEST_TIMEOUT_MS = 10_000;

const clients = new Map<number, GraphQLClient>();

/** Fetch wrapper that enforces a timeout via AbortController */
const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
};

/** Check whether The Graph is available for a given chain */
export function isGraphAvailable(chainId: number): boolean {
  const url = SUBGRAPH_URLS[chainId];
  return !!url && url.length > 0;
}

export function getGraphClient(chainId: number): GraphQLClient {
  const existing = clients.get(chainId);
  if (existing) return existing;

  const url = SUBGRAPH_URLS[chainId];
  if (!url) {
    throw new Error(`No subgraph configured for chain ${chainId}`);
  }

  const client = new GraphQLClient(url, {
    fetch: fetchWithTimeout,
  });
  clients.set(chainId, client);
  return client;
}

/**
 * Check if a name is available using The Graph
 * Returns true if available, false if taken, null on error
 */
export async function checkNameAvailabilityGraph(name: string, chainId: number): Promise<boolean | null> {
  try {
    if (!isGraphAvailable(chainId)) return null;
    const client = getGraphClient(chainId);
    const GET_NAME = `
      query GetName($name: String!) {
        names(where: { name: $name }, first: 1) {
          id
          name
        }
      }
    `;
    const data = await client.request<{ names: Array<{ id: string; name: string }> }>(GET_NAME, {
      name: name.toLowerCase(),
    });
    return data.names.length === 0;
  } catch (err) {
    console.error('[Graph] checkNameAvailabilityGraph error:', err);
    return null;
  }
}
