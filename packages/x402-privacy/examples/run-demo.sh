#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
PIDS=()

# ANSI colors
CYAN='\033[36m'
GREEN='\033[32m'
YELLOW='\033[33m'
RED='\033[31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

cleanup() {
  echo ""
  echo -e "${DIM}Shutting down services...${RESET}"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo -e "${DIM}Done.${RESET}"
}

trap cleanup EXIT INT TERM

cd "$PACKAGE_DIR"

echo ""
echo -e "${BOLD}${CYAN}  ╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${CYAN}  ║${RESET}${BOLD}     @x402/privacy Demo — 3 Services + AI Agent               ${CYAN}║${RESET}"
echo -e "${BOLD}${CYAN}  ╠══════════════════════════════════════════════════════════════╣${RESET}"
echo -e "${BOLD}${CYAN}  ║${RESET}                                                              ${CYAN}║${RESET}"
echo -e "${BOLD}${CYAN}  ║${RESET}  ${DIM}1. Tree service   (port 3001) — Merkle tree indexer${RESET}          ${CYAN}║${RESET}"
echo -e "${BOLD}${CYAN}  ║${RESET}  ${DIM}2. Facilitator    (port 3002) — proof verification${RESET}          ${CYAN}║${RESET}"
echo -e "${BOLD}${CYAN}  ║${RESET}  ${DIM}3. API server     (port 3000) — 402 paywall${RESET}                ${CYAN}║${RESET}"
echo -e "${BOLD}${CYAN}  ║${RESET}  ${DIM}4. AI agent       — generates ZK proof, pays privately${RESET}     ${CYAN}║${RESET}"
echo -e "${BOLD}${CYAN}  ║${RESET}                                                              ${CYAN}║${RESET}"
echo -e "${BOLD}${CYAN}  ╚══════════════════════════════════════════════════════════════╝${RESET}"
echo ""

# Check for zkey file
ZKEY_PATH="$PACKAGE_DIR/../../../../contracts/dustpool/circuits/v2/build/DustV2Transaction.zkey"
if [ ! -f "$ZKEY_PATH" ]; then
  echo -e "${YELLOW}[!] ZKey file not found at $ZKEY_PATH${RESET}"
  echo -e "${YELLOW}    The agent proof generation will fail without it.${RESET}"
  echo ""
fi

echo -e "${BOLD}Starting services...${RESET}"
echo ""

echo -e "${GREEN}[1/3]${RESET} Tree service (port 3001)..."
npx tsx examples/tree-service.ts &
PIDS+=($!)

echo -e "${GREEN}[2/3]${RESET} Facilitator (port 3002)..."
npx tsx examples/demo-facilitator.ts &
PIDS+=($!)

echo -e "${GREEN}[3/3]${RESET} API server (port 3000)..."
npx tsx examples/demo-server.ts &
PIDS+=($!)

echo ""
echo -e "${DIM}Waiting for services to initialize...${RESET}"
sleep 3

# Health-check the tree service before proceeding
for i in 1 2 3 4 5; do
  if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}[OK]${RESET} Tree service ready"
    break
  fi
  if [ "$i" -eq 5 ]; then
    echo -e "${YELLOW}[!] Tree service did not respond after 5 attempts.${RESET}"
  fi
  sleep 1
done

# Health-check facilitator
for i in 1 2 3; do
  if curl -sf http://localhost:3002/health > /dev/null 2>&1; then
    echo -e "${GREEN}[OK]${RESET} Facilitator ready"
    break
  fi
  sleep 1
done

echo ""
echo -e "${BOLD}${CYAN}=== Running AI Agent ===${RESET}"
echo ""

npx tsx examples/demo-agent.ts

echo ""
echo -e "${BOLD}${GREEN}Demo complete.${RESET}"
