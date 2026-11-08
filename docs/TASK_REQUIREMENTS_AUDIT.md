# Task Requirements Audit: Whale-Watching Agent

## 1. Official Task Metadata
- **Task Title**: Whale-Watching Agent
- **URL**: https://pharos-agent-arena.vercel.app/tasks/whale-watching-agent
- **Category**: MediumTrading / Monitoring
- **Base Points**: 100
- **Video Bonus**: +50 points
- **Maximum Attainable Points**: 150 points
- **Build Platform**: https://ai.pharos.xyz/

## 2. Core Objective & Scope
The Whale-Watching Agent is an autonomous blockchain monitoring system that continuously watches large ("whale") accounts on the Pharos Atlantic Testnet. It detects, interprets, evaluates, and summarizes significant capital transfers (both native token transfers and ERC-20 transfers like test USDC).

Crucially, it is not a dumb log dumper: each reported event must semantically explain the move—stating what moved, the precise amount, direction (inflow vs. outflow), counterparty labeling (known contracts, routers, whales, or unlabelled external accounts), transaction identifier, and direct PharosScan explorer link. Furthermore, the agent maintains an overarching summary view that synthesizes recent capital flow across all monitored addresses.

## 3. Strict Verification of Official Requirements

| Requirement ID | Official Specification | Implementation Verification Strategy |
| :--- | :--- | :--- |
| **01** | Tracks at least 5 configurable addresses | Dynamic Watchlist Manager in persistent storage (pre-seeded with 5 active Pharos accounts, editable via web UI and REST API). Rejects invalid addresses and enforces >= 5 active slots. |
| **02** | Configurable "significant" threshold per token or in value terms | Dual-threshold evaluation engine: supports both token-specific absolute minimum amounts (e.g., 500 USDC, 10 PHAROS) and fiat/USD estimated value thresholds with real decimal scaling (6 decimals for USDC, 18 for PHAROS). |
| **03** | Each report explains the move (what moved, how much, where to, labeled where known, explorer tx link) | Contextual Movement Interpreter: constructs structured semantic reports with token symbol, formatted amount, movement direction (INCOMING/OUTGOING/INTERNAL), labeled counterparty tags (e.g. "Atlantic Bridge", "USDC Token Contract", "Whale #1"), txHash, block number, and live explorer URL (`https://atlantic.pharosscan.xyz/tx/{txHash}`). |
| **04** | Produces a summary view of recent activity across all watched addresses | Cross-Watchlist Aggregator: real-time dashboard and `/api/summary` endpoint compiling total volume moved, net inflow/outflow per watched address, top active whales, recent movement count, and token distribution breakdown. |

## 4. Operating Boundaries & Quality Constraints
- **Zero Simulation**: All transaction data, blocks, and events are fetched from genuine Pharos Atlantic Testnet RPC and official Pharos MCP Server (`https://mcp.pharos.xyz/mcp`). No fabricated or mocked transactions masquerading as live data.
- **Monitoring Only**: Safe, read-only queries (`eth_blockNumber`, `eth_getLogs`, `eth_getTransactionReceipt`, `get_logs`, `get_transaction`). Zero private keys requested or stored, zero wallet signatures, zero gas spending.
- **Durable State**: Watchlist and alert settings are stored in local storage with automatic fallback to `/tmp` in serverless/Vercel production environments.
