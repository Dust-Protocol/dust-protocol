# Contract Addresses

## Ethereum Sepolia (chain ID: 11155111)

### Core Stealth

| Contract | Address |
|----------|---------|
| ERC5564Announcer | `0x64044FfBefA7f1252DdfA931c939c19F21413aB0` |
| ERC6538Registry | `0xb848398167054cCb66264Ec25C35F8CfB1EF1Ca7` |
| StealthNameRegistry | `0x857e17A85891Ef1C595e51Eb7Cd56c607dB21313` |

### ERC-4337

| Contract | Address |
|----------|---------|
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| StealthAccountFactory | `0xc73fce071129c7dD7f2F930095AfdE7C1b8eA82A` |
| StealthWalletFactory | `0x1c65a6F830359f207e593867B78a303B9D757453` |
| DustPaymaster | `0x20C28cbF9bc462Fb361C8DAB0C0375011b81BEb2` |

### DustPool

| Contract | Address |
|----------|---------|
| DustPool | `0xc95a359E66822d032A6ADA81ec410935F3a88bcD` |
| Groth16Verifier | `0x17f52f01ffcB6d3C376b2b789314808981cebb16` |

Deployment block: `10251347` · DustPool: `10259728`

### DustSwap (Privacy Swaps) — chainId + relayerFee Range Check

| Contract | Address |
|----------|---------|
| DustSwapPoolETH | `0xE30Cd101AA3d58A5124E8fF8Dda825F1bA5f8799` |
| DustSwapPoolUSDC | `0x1791D13995FfA9e00a9A2C07A9ad1251a668A669` |
| DustSwapHook | `0xCb2e9147B96e385c2c00A11D92026eb16eB400c4` |
| DustSwapVerifier | `0x629A2d1CDB1E4510b95a42c64aF2754Ac1dd6a7F` |
| DustSwapRouter | `0xDC839820cc24f312f10945939C4aCa41887FC78F` |
| Uniswap V4 PoolManager | `0x93805603e0167574dFe2F50ABdA8f42C85002FD8` |

Deployment block: `10313992`

#### Previous DustSwap Deployments (deprecated)

| Contract | Address | Note |
|----------|---------|------|
| DustSwapHook | `0x78139b89777bAC63B346C2DA4829667529E5c0C4` | Poseidon-binding, no chainId |
| DustSwapVerifier | `0xD7Ec2400B53c0E51EBd72a962aeF15f6e22B3b89` | Pre-chainId verifier |
| DustSwapPoolETH | `0x52FAc2AC445b6a5b7351cb809DCB0194CEa223D0` | Original pools (V1) |
| DustSwapPoolUSDC | `0xc788576786381d41B8F5180D0B92A15497CF72B3` | Original pools (V1) |
| DustSwapHook | `0x09b6a164917F8ab6e8b552E47bD3957cAe6d80C4` | Original hook (V1) |
| DustSwapVerifier | `0x1677C9c4E575C910B9bCaF398D615B9F3775d0f1` | Original verifier (V1) |
| DustSwapRouter | `0x82faD70Aa95480F719Da4B81E17607EF3A631F42` | Original router (V1) |

---

## Thanos Sepolia (chain ID: 111551119090)

### Core Stealth

| Contract | Address |
|----------|---------|
| ERC5564Announcer | `0x2C2a59E9e71F2D1A8A2D447E73813B9F89CBb125` |
| ERC6538Registry | `0x9C527Cc8CB3F7C73346EFd48179e564358847296` |
| StealthNameRegistry | `0xD06389cEEd802817C439E0F803E71b02ceb132b4` |

### ERC-4337

| Contract | Address |
|----------|---------|
| EntryPoint v0.6 | `0x5c058Eb93CDee95d72398E5441d989ef6453D038` (non-canonical — custom deployment for Thanos chain) |
| StealthAccountFactory | `0xfE89381ae27a102336074c90123A003e96512954` |
| StealthWalletFactory | `0xbc8e75a5374a6533cD3C4A427BF4FA19737675D3` |
| DustPaymaster | `0x9e2eb36F7161C066351DC9E418E7a0620EE5d095` |

### DustPool

| Contract | Address |
|----------|---------|
| DustPool | `0x16b8c82e3480b1c5B8dbDf38aD61a828a281e2c3` |
| Groth16Verifier | `0x9914F482c262dC8BCcDa734c6fF3f5384B1E19Aa` |

Deployment block: `6272527` · DustPool: `6372598`

*DustSwap not yet deployed on Thanos Sepolia.*

---

## V2 Contracts (DustPool ZK-UTXO) — With Split Circuit

Deployed with: Pausable, Ownable2Step, chainId, I1 recipient binding, 2-in-8-out split verifier.

### Ethereum Sepolia (chain ID: 11155111)

| Contract | Address |
|----------|---------|
| FflonkVerifier (9 signals) | `0xd0f5aB15Ef3C882EB4341D38A3183Cc1FDcCFD8a` |
| FflonkSplitVerifier (15 signals) | `0x472CBA068f19738eB514B7f0b846a63E7E502120` |
| DustPoolV2 | `0x3cbf3459e7E0E9Fd2fd86a28c426CED2a60f023f` |
| DustSwapVerifierProduction | `0x629A2d1CDB1E4510b95a42c64aF2754Ac1dd6a7F` |

Deployer/Relayer: `0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496`

### DustSwap V2 — Adapter (Ethereum Sepolia)

Atomic private swaps: withdraw from DustPoolV2 → swap on Uniswap V4 → deposit output back.

| Contract | Address |
|----------|---------|
| DustSwapAdapterV2 | `0xb91Afd19FeB4000E228243f40B8d98ea07127400` |
| Chainlink ETH/USD Oracle | `0x694AA1769357215DE4FAC081bf1f309aDC325306` |
| PoseidonT3 (library) | `0x203a488C06e9add25D4b51F7EDE8e56bCC4B1A1C` |
| PoseidonT6 (library) | `0x666333F371685334CdD69bdDdaFBABc87CE7c7Db` |
| Uniswap V4 PoolManager | `0x93805603e0167574dFe2F50ABdA8f42C85002FD8` |

Oracle: Chainlink ETH/USD, 10% max deviation, 1-hour stale threshold.

Verified: [Blockscout](https://eth-sepolia.blockscout.com/address/0xb91afd19feb4000e228243f40b8d98ea07127400)

#### Previous DustSwap V2 Adapter Deployments (deprecated)

| Contract | Address | Note |
|----------|---------|------|
| DustSwapAdapterV2 | `0xe2bE4d7b5C1952B3DDB210499800A45aa0DD097C` | Pre-oracle, no Chainlink bound |

### Thanos Sepolia (chain ID: 111551119090)

| Contract | Address |
|----------|---------|
| FflonkVerifier (9 signals) | `0x3a8D53179862a2a7Ede73F42c021056B06364dda` |
| FflonkSplitVerifier (15 signals) | `0xbcb3FDB42C2bAEA700B840e25e32da25f2C78Ef7` |
| DustPoolV2 | `0x130eEBe65DC1B3f9639308C253F3F9e4F0bbDC29` |

Deployer/Relayer: `0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496`

### Previous V2 Deployments (deprecated)

| Chain | FflonkVerifier | FflonkSplitVerifier | DustPoolV2 |
|-------|-------|-------|-------|
| Ethereum Sepolia (pre-hardening) | `0xd4B52Fd4CDFCCA41E6F88f1a1AfA9A0B715290e7` | `0x2c53Ea8983dCA7b2d4cA1aa4ECfBc6e513e0Fc6E` | `0x03D52fd442965cD6791Ce5AFab78C60671f9558A` |
| Thanos Sepolia (pre-hardening) | `0x51B2936AF26Df0f087C18E5B478Ae2bda8AD5325` | `0x4031D4559ba1D5878caa8Acc627555748D528AE4` | `0x283800e6394DF6ad17aC53D8d48CD8C0c048B7Ad` |
| Ethereum Sepolia (pre-split) | `0xC639C2594cf2841a7aC2E8298208fe33a98Dc98D` | — | `0x6f37E2Df430E1c516148157E6d42db6a3747eB8f` |
| Thanos Sepolia (pre-split) | `0x301e16F08238e6414ff8Ea3B1F2A85387e9453Df` | — | `0x29f4822161bcf02687e02bDD48850C0385a5eEd2` |
| Ethereum Sepolia (1st gen) | `0xD1D89bBAeD5b2e4453d6ED59c6e6fa78C13852A7` | — | `0x36ECE3c48558630372fa4d35B1C4293Fcc18F7B6` |
| Thanos Sepolia (1st gen) | `0x1f01345e6dCccfC3E213C391C81a70FAa20Ea6bc` | — | `0x6987FE79057D83BefD19B80822Decb52235A5a67` |

---

## Arbitrum Sepolia (chain ID: 421614)

### Core Stealth

| Contract | Address |
|----------|---------|
| ERC5564Announcer | `0x66254f9EdBaAe71B1d81A7cb7b40748A67D6AE42` |
| ERC6538Registry | `0xbF9cB629aEB33d7D3934c93aB2b467c366895Cf2` |

### ERC-4337

| Contract | Address |
|----------|---------|
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| StealthAccountFactory | `0x85C0b4B3f8d594E3d72B781A915852409E3327fd` |
| StealthWalletFactory | `0xba3772E8a0D78f1909339aCfeb5420bD0C7c5D95` |
| DustPaymaster | `0x3E140c501A39ab9DcA569E76f902E3bd8B11366c` |

### V2 Contracts

| Contract | Address |
|----------|---------|
| DustPoolV2 | `0x07E961c0d881c1439be55e5157a3d92a3efE305d` |
| FflonkVerifier (9 signals) | `0x8359c6d73c92D8D63fF0f650f0F0061ed65B1128` |
| FflonkSplitVerifier (15 signals) | `0x7E726D2F8eE60B4Dede7A92461c2Fd15Bf38bb3A` |
| ComplianceVerifier | `0xe6236145fddbC50439934Afb404a607Afaa14f51` |
| NameVerifier | `0x068C9591409CCa14c891DB2bfc061923CF1EfbaB` |

### DustSwap V2

| Contract | Address |
|----------|---------|
| DustSwapAdapterV2 | `0xe1Ca871aE6905eAe7B442d0AF7c5612CAE0a9B94` |
| Uniswap V4 PoolManager | `0xFB3e0C6F74eB1a21CC1Da29aeC80D2Dfe6C9a317` |

Deployment block: `246396709`

---

## OP Sepolia (chain ID: 11155420)

### Core Stealth

| Contract | Address |
|----------|---------|
| ERC5564Announcer | `0x6CcA05728116B486dB2ee2E43344888708fFceb6` |
| ERC6538Registry | `0x0Fe67f27ed9Ff208b7C275A68da3a28Ec039F4dD` |

### ERC-4337

| Contract | Address |
|----------|---------|
| EntryPoint v0.6 | `0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789` |
| StealthAccountFactory | `0xB1D73BeA90f2eF2bAaA67740aEf97C6129192b94` |
| StealthWalletFactory | `0x753D0F47c21093Ba5A09666Ec694c71684998626` |
| DustPaymaster | `0xe1Ca871aE6905eAe7B442d0AF7c5612CAE0a9B94` |

### V2 Contracts

| Contract | Address |
|----------|---------|
| DustPoolV2 | `0x068C9591409CCa14c891DB2bfc061923CF1EfbaB` |
| FflonkVerifier (9 signals) | `0xe13075B576D879F3Da58dA6E768B3Ce87bED54cA` |
| FflonkSplitVerifier (15 signals) | `0x65462968988B191ec43E55E911Ff3D47B885A906` |
| ComplianceVerifier | `0x769810c0A461aC0f457747324b7f2fedD65963A7` |
| NameVerifier | `0x9E63A1d2505BC630C1bf0DEE1660050dF21D8c84` |

Deployment block: `40332900`

*DustSwap intentionally not deployed on OP Sepolia — no Uniswap V4 PoolManager available on this chain. Private swaps are available on Eth Sepolia, Arbitrum Sepolia, and Base Sepolia.*

---

## Base Sepolia (chain ID: 84532)

### Core Stealth

| Contract | Address |
|----------|---------|
| ERC5564Announcer | [`0x26640Ae565CB324b9253b41101E415f983E85DEf`](https://sepolia.basescan.org/address/0x26640Ae565CB324b9253b41101E415f983E85DEf) |
| ERC6538Registry | [`0xF1c5F2bF2E21287C49779c6893728A2B954478d1`](https://sepolia.basescan.org/address/0xF1c5F2bF2E21287C49779c6893728A2B954478d1) |

### ERC-4337

| Contract | Address |
|----------|---------|
| EntryPoint v0.6 | [`0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789`](https://sepolia.basescan.org/address/0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789) |
| StealthAccountFactory | [`0xd539DA238B7407aE06886458dBdD8e4068c29A3e`](https://sepolia.basescan.org/address/0xd539DA238B7407aE06886458dBdD8e4068c29A3e) |
| StealthWalletFactory | [`0xF201ad71388aA1624B8005E3d9c4f02B6FC2D547`](https://sepolia.basescan.org/address/0xF201ad71388aA1624B8005E3d9c4f02B6FC2D547) |
| DustPaymaster | [`0xA2ec6653f6F56bb1215071D4cD8daE7A5A87ddB2`](https://sepolia.basescan.org/address/0xA2ec6653f6F56bb1215071D4cD8daE7A5A87ddB2) |

### V2 Contracts

| Contract | Address |
|----------|---------|
| DustPoolV2 | [`0x17f52f01ffcB6d3C376b2b789314808981cebb16`](https://sepolia.basescan.org/address/0x17f52f01ffcB6d3C376b2b789314808981cebb16) |
| FflonkVerifier (9 signals) | [`0xe51ebD6B1F1ad7d7E4874Bb7D4E53a0504cCf652`](https://sepolia.basescan.org/address/0xe51ebD6B1F1ad7d7E4874Bb7D4E53a0504cCf652) |
| FflonkSplitVerifier (15 signals) | [`0x503e68AdccFbAc5A2F991FC285735a119bF364F7`](https://sepolia.basescan.org/address/0x503e68AdccFbAc5A2F991FC285735a119bF364F7) |
| ComplianceVerifier | [`0x33b72e6d7b39a32B88715b658f2248897Af2e650`](https://sepolia.basescan.org/address/0x33b72e6d7b39a32B88715b658f2248897Af2e650) |
| NameVerifier | [`0x416D52f0566081b6881eA887baD3FB1a54fa94aF`](https://sepolia.basescan.org/address/0x416D52f0566081b6881eA887baD3FB1a54fa94aF) |

### DustSwap V2

| Contract | Address |
|----------|---------|
| DustSwapAdapterV2 | [`0x844d11bD48D85411eE8cD1a7cB0aC00672B1d516`](https://sepolia.basescan.org/address/0x844d11bD48D85411eE8cD1a7cB0aC00672B1d516) |
| Uniswap V4 PoolManager | [`0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`](https://sepolia.basescan.org/address/0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408) |
| Uniswap V4 StateView | [`0x571291b572ed32ce6751a2cb2486ebee8defb9b4`](https://sepolia.basescan.org/address/0x571291b572ed32ce6751a2cb2486ebee8defb9b4) |
| Uniswap V4 Quoter | [`0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba`](https://sepolia.basescan.org/address/0x4a6513c898fe1b2d0e78d3b0e0a4a151589b1cba) |

Deployment block: `38350029`

---

## Base Mainnet (chain ID: 8453)

*Deployment pending. Contract addresses will be added after mainnet deployment.*

Deployer/Relayer: `0x8d56E94a02F06320BDc68FAfE23DEc9Ad7463496`

USDC on Base mainnet: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

---

All chain configuration including RPC URLs, contract addresses, and CREATE2 creation codes lives in `src/config/chains.ts`.
