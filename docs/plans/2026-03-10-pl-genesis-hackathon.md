# PL_Genesis: Frontiers of Collaboration — Hackathon Plan

**Branch:** `feat/pl-genesis-hackathon`
**Deadline:** March 16, 2026
**Track:** Existing Code ($5K) + AI & Robotics Focus ($6K)
**Max Prize:** ~$29.5K (stacked) | Conservative: $16-20K | Floor: $11K

## Strategy

1. **Main Track**: Existing Code — deployed multi-chain ZK privacy protocol
2. **Focus Area**: AI & Robotics — x402-privacy (AI agent private payments)
3. **Sponsor Bounties**: Flow ($10K), Filecoin ($2.5K), Community Vote ($1K)
4. **Stretch**: World ($5K) if confirmed as sponsor

## Work Streams

### WS1: Flow EVM Integration [HIGH PRIORITY — $10K swing]
- [ ] Test ecPairing precompile (0x08) on Flow EVM Testnet — GO/NO-GO day 1
- [ ] Add Flow Testnet chain config to `src/config/chains.ts`
- [ ] Add Flow icon to `src/components/stealth/icons.tsx`
- [ ] Deploy DustPoolV2 + FflonkVerifier to Flow EVM
- [ ] Deploy stealth contracts (Announcer, Registry, NameVerifier, Factories)
- [ ] Verify one deposit + withdraw E2E on Flow
- [ ] Add Flow to frontend chain selector

### WS2: Filecoin Encrypted Note Backup [MEDIUM — $2.5K]
- [ ] Install @web3-storage/w3up-client
- [ ] Create `src/lib/storage-backup.ts` — encrypt notes + upload to Filecoin/IPFS
- [ ] Create `src/lib/storage-restore.ts` — download + decrypt from CID
- [ ] Add backup/restore UI buttons to settings or V2 dashboard
- [ ] Test round-trip: backup → clear IndexedDB → restore

### WS3: x402 AI Agent Demo [HIGH PRIORITY — Focus Area]
- [ ] Polish `packages/x402-privacy/examples/demo-agent.ts`
- [ ] Create standalone demo script that runs E2E
- [ ] Prepare @x402/privacy for npm publish
- [ ] Write demo narration script for video
- [ ] Record or screenshot the agent flow

### WS4: World ID Integration [STRETCH — $5K if sponsor confirmed]
- [ ] Confirm World is a sponsor on the bounty page
- [ ] If yes: Add World ID verification to deposit flow
- [ ] If yes: Build World Mini App wrapper
- [ ] If no: Skip, reallocate time to WS1-3

### WS5: Submission & Polish
- [ ] Write hackathon submission README
- [ ] Create architecture diagram for judges
- [ ] Write "Digital Human Rights" narrative framing
- [ ] Draft 3-5 tweets for Community Vote
- [ ] Document security audit results
- [ ] Record 3-5 min demo video
- [ ] Final E2E test on all chains

## Timeline

| Day | Focus |
|-----|-------|
| Mar 10 | Flow precompile test (go/no-go). Research. Start Filecoin. |
| Mar 11 | Flow deployment (if go). Filecoin backup complete. |
| Mar 12 | Flow frontend. x402 demo polish. World research. |
| Mar 13 | World integration (if confirmed). Submission docs. |
| Mar 14 | Demo video. Full E2E testing. Polish. |
| Mar 15 | Buffer. Community vote tweets. Final fixes. |
| Mar 16 | Submit. |

## Critical Decision: Flow Go/No-Go

Test on day 1: Deploy FFLONK verifier to Flow EVM Testnet.
- If ecPairing precompile works → proceed with full Flow integration
- If not → drop Flow, redirect 2 days to deeper Filecoin + World + demo polish
