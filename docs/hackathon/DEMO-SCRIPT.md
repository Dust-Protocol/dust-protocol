# Dust Protocol -- Demo Video Script

**Total runtime:** ~3 minutes
**Format:** Screen recording with voiceover narration

---

## Intro (0:00 -- 0:15)

[SCREEN: Dust Protocol landing page (dustprotocol.app). WebGL background animates in. Logo and tagline visible.]

[NARRATION: "Dust Protocol: private payments for humans and AI agents. Compliant. Cross-chain. Zero-knowledge."]

---

## Section 1 -- The Problem (0:15 -- 0:35)

[SCREEN: Etherscan transaction page showing a wallet's full history -- amounts, counterparties, timestamps all visible. Scroll slowly through the list.]

[NARRATION: "Every on-chain payment is public. Your salary, your medical bills, your political donations -- all visible to anyone with a block explorer."]

[SCREEN: Zoom in on a specific transaction showing sender, receiver, and amount in plain text.]

[NARRATION: "Ethereum has no native privacy. We built one."]

---

## Section 2 -- Stealth Send (0:35 -- 1:05)

[SCREEN: Navigate to dustprotocol.app/pay/main. The pay page loads with the recipient field and amount input.]

[NARRATION: "Dust uses stealth addresses -- a fresh, one-time address is generated for every payment using elliptic curve Diffie-Hellman key exchange."]

[SCREEN: Type a registered Dust name into the recipient field. Enter 0.01 ETH. Click Send. Show the transaction confirming.]

[NARRATION: "The sender pays to a brand-new address that only the recipient can control."]

[SCREEN: Open the confirmed transaction on the block explorer. Highlight the recipient address. Show that it has no prior history -- single incoming transaction, no link to the recipient's main wallet.]

[NARRATION: "On-chain, there is no connection between this address and the recipient. Only the recipient's stealth keys can derive the private key to claim these funds."]

---

## Section 3 -- ZK Privacy Pool (1:05 -- 1:45)

[SCREEN: Navigate to DustPool V2 deposit page. Enter 1 ETH deposit amount.]

[NARRATION: "For stronger privacy, Dust Pool uses a ZK-UTXO model. Deposit any amount -- no fixed denominations."]

[SCREEN: Click Deposit. Show the transaction confirming on-chain. The deposit creates a Pedersen commitment stored in a Poseidon Merkle tree.]

[NARRATION: "Your deposit becomes a cryptographic commitment in a Merkle tree. The amount is hidden."]

[SCREEN: Switch to the Withdraw tab. Enter a fresh recipient address and 0.3 ETH. Click Withdraw. Show the FFLONK proof generating in the browser -- progress indicator visible.]

[NARRATION: "To withdraw, your browser generates an FFLONK zero-knowledge proof entirely client-side. No trusted setup required."]

[SCREEN: Proof completes. Transaction submits via relayer. Show the withdrawal transaction on the explorer -- no link to the deposit.]

[NARRATION: "The proof verifies you have funds in the pool without revealing which deposit is yours, what amount you deposited, or who you are. The link between deposit and withdrawal is completely severed."]

---

## Section 4 -- Compliance (1:45 -- 2:05)

[SCREEN: Show a deposit attempt. Before the transaction, a compliance check badge appears -- green checkmark with "Chainalysis: Clear".]

[NARRATION: "Unlike Tornado Cash, Dust screens every depositor against the Chainalysis sanctions oracle."]

[SCREEN: Show the ChainalysisScreener contract on the block explorer. Highlight the on-chain compliance check.]

[NARRATION: "Sanctioned addresses are blocked at the contract level. Privacy with accountability -- not a tool for illicit finance."]

---

## Section 5 -- AI Agent Payments (2:05 -- 2:35)

[SCREEN: Terminal window. Run the x402 agent demo. The agent makes an HTTP request to a paid API endpoint.]

[NARRATION: "AI agents need to pay for services autonomously -- APIs, compute, data. But public payments leak the agent's identity and spending patterns."]

[SCREEN: Terminal shows: HTTP 402 Payment Required. The agent detects the payment request, generates a ZK proof, and submits payment through Dust Pool. Response: HTTP 200 OK with the API data.]

[NARRATION: "The agent receives a 402, generates a zero-knowledge proof, pays privately through Dust Pool, and gets access. No identity revealed. No spending pattern exposed."]

[SCREEN: Show the on-chain transaction -- the payment came from the relayer, not the agent's wallet.]

[NARRATION: "The API provider gets paid. The agent stays private. Fully programmatic, fully private."]

---

## Section 6 -- Multi-chain (2:35 -- 2:50)

[SCREEN: Back in the Dust app. Click the chain selector dropdown. Show Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, Optimism Sepolia, and Thanos Sepolia all available.]

[NARRATION: "Dust is deployed on five chains and counting."]

[SCREEN: Switch from Ethereum to Base. The UI updates -- pool balances, contract addresses, and chain icon all refresh. Show a quick deposit on Base to prove it works.]

[NARRATION: "Same privacy guarantees. Same compliance. Every chain."]

---

## Outro (2:50 -- 3:00)

[SCREEN: Dust Protocol landing page. Logo centered. Tagline fades in below.]

[NARRATION: "Dust Protocol. Privacy is a right, not a feature."]

[SCREEN: URL dustprotocol.app and GitHub link fade in. Hold for 3 seconds.]
