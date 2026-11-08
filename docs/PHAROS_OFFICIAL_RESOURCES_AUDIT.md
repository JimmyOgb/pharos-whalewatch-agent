# Pharos Official Resources Audit

## 1. Network Specifications (Pharos Atlantic Testnet)
- **Network Name**: Pharos Atlantic Testnet
- **Chain ID**: `688689`
- **CAIP-2 Identifier**: `eip155:688689`
- **Native Currency**: Pharos Testnet Token (`PHAROS`, 18 decimals)
- **Public RPC Endpoint**: `https://atlantic.dplabs-internal.com`
- **Official Block Explorer**: `https://atlantic.pharosscan.xyz`
- **Explorer API**: Standard Etherscan-compatible / Blockscout APIs available on PharosScan.

## 2. Token & Smart Contract Deployments
- **Atlantic Test USDC**:
  - Address: `0xcfc8330f4bcab529c625d12781b1c19466a9fc8b`
  - Decimals: `6`
  - Standard: ERC-20
  - Transfer Event Signature: `Transfer(address indexed from, address indexed to, uint256 value)`
  - Topic0: `0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef`
- **Known Infrastructure Addresses for Labeling**:
  - Atlantic Bridge / Faucet: `0x0000000000000000000000000000000000000000` (Mint/Burn)
  - USDC Token Contract: `0xcfc8330f4bcab529c625d12781b1c19466a9fc8b`
  - Active Protocol / Deployer Wallets identified on Atlantic Testnet for default initial watchlist seeds.

## 3. Official Documentation & Tooling References
- **Pharos Developer Hub**: https://www.pharos.xyz/devhub
- **Pharos Official Docs**: https://docs.pharos.xyz/
- **Pharos x402 Protocol Specs**: https://docs.pharos.xyz/developer-guide/x402
- **Pharos Skill Engine Repository**: https://github.com/PharosNetwork/pharos-skill-engine
- **Pharos Agent Arena Platform**: https://pharos-agent-arena.vercel.app/

## 4. Query Bounds & RPC Limits
- **Log Query Window**: Max 1,000 blocks per single `eth_getLogs` or MCP `get_logs` request.
- **Failover Strategy**: The agent implements bounded sliding block ranges (typically 50-100 blocks during live auto-poll, expanding to 500 blocks for historical lookback) to guarantee sub-second responses and prevent RPC HTTP 413 / timeout errors.
