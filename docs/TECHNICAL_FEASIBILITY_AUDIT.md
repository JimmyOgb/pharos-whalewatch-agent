# Technical Feasibility & Architecture Audit

## 1. System Architecture Overview

```mermaid
flowchart TD
    subgraph PharosNetwork ["Pharos Atlantic Testnet (Chain ID 688689)"]
        RPC["Direct RPC: atlantic.dplabs-internal.com"]
        MCP["Official Pharos MCP Server: mcp.pharos.xyz/mcp"]
        Scan["PharosScan: atlantic.pharosscan.xyz"]
    end

    subgraph DualIngestion ["Dual-Engine Ingestion Layer"]
        McpService["MCP Client (get_block_number, get_logs)"]
        RpcService["Viem Atlantic Client (Stale-while-revalidate)"]
    end

    subgraph WhaleAgent ["Pharos Whale-Watching Core Engine"]
        WatchlistMgr["Watchlist Manager (>= 5 configurable addresses)"]
        ThresholdEvaluator["Threshold Evaluator (USDC & PHAROS)"]
        SemanticExplainer["Movement Explainer & Entity Labeler"]
        Aggregator["Cross-Watchlist Activity Aggregator"]
    end

    subgraph Persistence ["Persistence Layer"]
        Storage["Storage Adapter (Local FS / os.tmpdir() on Vercel)"]
    end

    subgraph Presentation ["Presentation & API Layer"]
        ExpressServer["Express 5 / Node.js Serverless Handler"]
        REST_API["REST Endpoints: /api/whales, /api/thresholds, /api/movements, /api/summary, /api/scan"]
        WebUI["Responsive Cyberpunk/Fintech Command Dashboard"]
    end

    MCP --> McpService
    RPC --> RpcService
    McpService --> WhaleAgent
    RpcService --> WhaleAgent
    WhaleAgent <--> Storage
    WhaleAgent --> Presentation
    Presentation -. Direct Links .-> Scan
```

## 2. Serverless & Cloud Resilience Safeguards
Based on lessons learned from high-load serverless environments:
1. **Bounded Execution**: Every network call (MCP or RPC) has an aggressive `AbortController` timeout (4.5s) to stay safely beneath Vercel's execution limits.
2. **In-Memory Block & Log Cache**: Reduces redundant upstream queries when multiple dashboard clients or pollers request telemetry simultaneously.
3. **Safe Storage Fallback**: Automatic directory resolution using `process.env.VERCEL ? os.tmpdir() : dataDir` ensures zero read-only filesystem errors (`EROFS`).
4. **Self-Paced UI Polling**: The frontend uses recursive `setTimeout` with `isPolling` guards and 5-second backoff rather than unbounded `setInterval`, preventing browser connection saturation.

## 3. Decimal Precision & Value Calculations
- **Atlantic Test USDC**: 6 decimals.
- **Native PHAROS**: 18 decimals.
- BigInt math handles raw wei / atomic units without precision loss before converting to human-readable strings with fixed decimal places.
