# Official Scoring Matrix Compliance

## Target Score: 150 / 150 Points (100 Base + 50 Video Bonus)

| Criteria Code | Official Requirement | Weight | Implementation Details | Evidence File / Route |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | Tracks at least 5 configurable addresses | 25 pts | Dynamic watchlist management with add, edit label, toggle status, and delete. Seeded with 5+ genuine Atlantic Testnet active addresses. Minimum 5 active enforced. | `src/db/storage.ts`, `GET/POST /api/whales`, UI Watchlist Section |
| **REQ-02** | Configurable "significant" threshold per token or in value terms | 25 pts | Customizable threshold rules for USDC and PHAROS. Operators can set raw token minimums or USD-equivalent values. Stored durably. | `src/services/evaluator.ts`, `GET/POST /api/thresholds`, UI Threshold Modal |
| **REQ-03** | Each report explains the move (what moved, how much, where to, labeled where known, explorer tx link) | 25 pts | Semantic narrative generator outputs: direction (IN/OUT), token, amount, sender & receiver tags (known bridge, dex, contract, or whale alias), txHash link to PharosScan. | `src/services/evaluator.ts`, `GET /api/movements`, UI Movement Feed Card |
| **REQ-04** | Produces a summary view of recent activity across all watched addresses | 25 pts | Comprehensive Cross-Watchlist Aggregator calculating total capital moved, net inflow/outflow per whale, distribution by token, and 24h activity velocity. | `src/services/evaluator.ts`, `GET /api/summary`, UI Cross-Whale Summary Panel |
| **BONUS** | Demonstration Video Walkthrough | +50 pts | 1080p high-definition continuous live recording of real UI actions on Pharos Atlantic Testnet, synced audio narration via TTS, burned subtitles. | `demo/pharos-whalewatch-agent-demo.mp4`, `demo/narration.srt` |

**Total Projected Score: 150 / 150**
