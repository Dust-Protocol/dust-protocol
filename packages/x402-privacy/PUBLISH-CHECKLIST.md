# @x402/privacy — Pre-Publish Checklist

## Package Metadata

- [x] `name`: `@x402/privacy` (scoped under `@x402` org)
- [x] `version`: `0.1.0`
- [x] `description`: Present and accurate
- [x] `license`: `Apache-2.0` (LICENSE file included in pack)
- [x] `author`: `Dust Protocol`
- [x] `repository`, `homepage`, `bugs`: All set
- [x] `keywords`: 10 relevant keywords
- [x] `engines`: `node >= 18`

## Build

- [x] `npm run build` exits 0
- [x] ESM output: `dist/esm/` (6 entry points + chunks + sourcemaps)
- [x] CJS output: `dist/cjs/` (6 entry points + sourcemaps)
- [x] Type declarations: `.d.ts` (ESM) and `.d.cts` (CJS) for all entry points
- [x] `"type": "module"` set (ESM-first)
- [x] `sideEffects: false` set (tree-shaking)

## Exports Map

- [x] `.` -> `dist/esm/index.js` / `dist/cjs/index.cjs`
- [x] `./client` -> `dist/esm/client/index.js` / `dist/cjs/client/index.cjs`
- [x] `./facilitator` -> `dist/esm/facilitator/index.js` / `dist/cjs/facilitator/index.cjs`
- [x] `./server` -> `dist/esm/server/index.js` / `dist/cjs/server/index.cjs`
- [x] `./tree` -> `dist/esm/tree/index.js` / `dist/cjs/tree/index.cjs`
- [x] `./crypto` -> `dist/esm/crypto/index.js` / `dist/cjs/crypto/index.cjs`
- [x] All `types` conditions point to `.d.ts` files that exist
- [x] `typesVersions` fallback for older TypeScript versions

## Files Included in Pack

- [x] `dist/` — compiled JS + types + sourcemaps
- [x] `circuits/DustV2Transaction.wasm` (3.3 MB) — ZK circuit
- [x] `circuits/verification_key.json` (1.1 KB) — verification key
- [x] `README.md` (20.7 KB)
- [x] `LICENSE` (10.3 KB)
- [x] `package.json`
- [x] Total: 54 files, 1.1 MB compressed / 3.6 MB unpacked

## Files Excluded from Pack

- [x] `src/` — source TypeScript (via `.npmignore`)
- [x] `test/` — test files (via `.npmignore`)
- [x] `examples/` — demo scripts (via `.npmignore`)
- [x] `docs/` — architecture diagrams (via `.npmignore`)
- [x] `circuits/*.zkey` — 112 MB proving key (via `.gitignore`, downloaded separately)
- [x] Config files: `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`

## Dependencies

- [x] `circomlibjs` — Poseidon hash (required)
- [x] `snarkjs` — FFLONK proof generation/verification (required)
- [x] `viem` — Ethereum types + contract interaction (required)
- [x] `@x402/core >= 2.0.0` — peer dependency (not bundled)
- [x] No unused dependencies (`express` removed — only used in examples)

## Tests

- [x] `npm run test` — 58 tests across 12 suites, all passing
- [x] Unit tests: crypto, merkle, keys, UTXO store, proof inputs, types
- [x] Scheme tests: client, facilitator, server
- [x] Integration test: TreeIndexer against live Base Sepolia

## README

- [x] Description of what the package does
- [x] Architecture diagram (excalidraw PNG)
- [x] Role breakdown (Server, Client, Facilitator, Tree, Crypto)
- [x] Installation instructions
- [x] Quick start code examples for all roles
- [x] API reference for all public classes and functions
- [x] Type definitions
- [x] Constants reference
- [x] Security considerations
- [x] License

## Before Publishing

- [ ] Verify npm org access: `npm whoami --registry https://registry.npmjs.org`
- [ ] Verify `@x402` org exists on npm (or publish unscoped)
- [ ] Set version appropriately (`0.1.0` for initial release)
- [ ] Run `npm pack` and inspect tarball contents one final time
- [ ] Publish: `npm publish --access public`
- [ ] Verify install: `npm install @x402/privacy` in a fresh project
- [ ] Verify subpath imports work: `import { ShieldedEvmClientScheme } from "@x402/privacy/client"`

## Post-Publish

- [ ] Tag release: `git tag v0.1.0 && git push --tags`
- [ ] Document zkey download instructions (112 MB, not included in npm package)
- [ ] Verify README renders correctly on npmjs.com
