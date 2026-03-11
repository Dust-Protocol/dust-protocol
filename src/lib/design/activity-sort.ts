import type { StealthPayment, OutgoingPayment } from "./types";

// Sepolia Beacon Chain genesis: 2022-06-20T00:00:00Z
const SEPOLIA_GENESIS_MS = 1_655_683_200_000;
const BLOCK_TIME_MS = 12_000;

export type ActivityItem =
  | { type: "incoming"; payment: StealthPayment; index: number; timestamp: number }
  | { type: "outgoing"; payment: OutgoingPayment; timestamp: number };

function estimateBlockTimestamp(blockNumber: number): number {
  return SEPOLIA_GENESIS_MS + blockNumber * BLOCK_TIME_MS;
}

export function buildSortedActivities(
  payments: StealthPayment[],
  outgoingPayments: OutgoingPayment[],
): ActivityItem[] {
  const items: ActivityItem[] = [];

  payments.forEach((p, i) => {
    items.push({
      type: "incoming",
      payment: p,
      index: i,
      timestamp: estimateBlockTimestamp(p.announcement.blockNumber),
    });
  });

  outgoingPayments.forEach((p) => {
    items.push({
      type: "outgoing",
      payment: p,
      timestamp: p.timestamp,
    });
  });

  items.sort((a, b) => b.timestamp - a.timestamp);

  return items;
}
