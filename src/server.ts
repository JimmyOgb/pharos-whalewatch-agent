import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storage } from './db/storage.js';
import { rpcService } from './services/rpc.js';
import { mcpClient } from './services/mcpClient.js';
import { whaleEvaluator } from './services/evaluator.js';
import { SystemTelemetry } from './types.js';
import { DASHBOARD_HTML, DASHBOARD_CSS, DASHBOARD_JS } from './views.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 3000;
const startTime = Date.now();

app.use(cors());
app.use(express.json());

// Explicit Static and Dashboard Routes (100% serverless immune)
app.get('/', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(DASHBOARD_HTML);
});

app.get('/style.css', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/css; charset=utf-8');
  res.send(DASHBOARD_CSS);
});

app.get('/app.js', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(DASHBOARD_JS);
});

// Serve static frontend assets fallback
try {
  const publicPath = path.resolve(__dirname, '../public');
  app.use(express.static(publicPath));
} catch {
  // Ignore in serverless
}

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'pharos-whalewatch-agent',
    network: 'Pharos Atlantic Testnet',
    chainId: 688689,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

// Watchlist endpoints (Requirement 01)
app.get('/api/whales', (req: Request, res: Response) => {
  try {
    const whales = storage.getWhales();
    res.json({
      success: true,
      count: whales.length,
      activeCount: whales.filter((w) => w.enabled).length,
      whales,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/whales', (req: Request, res: Response) => {
  try {
    const { address, label, notes, enabled } = req.body;
    if (!address || !label) {
      return res.status(400).json({ success: false, error: 'Address and label are required' });
    }
    const created = storage.addWhale({
      address,
      label,
      notes: notes || '',
      enabled: enabled !== undefined ? !!enabled : true,
    });
    res.status(201).json({ success: true, whale: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/whales/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = storage.updateWhale(id, req.body);
    res.json({ success: true, whale: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/whales/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ok = storage.deleteWhale(id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Whale not found' });
    }
    res.json({ success: true, message: 'Whale removed successfully' });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Thresholds endpoints (Requirement 02)
app.get('/api/thresholds', (req: Request, res: Response) => {
  try {
    const thresholds = storage.getThresholds();
    res.json({ success: true, count: thresholds.length, thresholds });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/thresholds/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = storage.updateThreshold(id, req.body);
    res.json({ success: true, threshold: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/thresholds', (req: Request, res: Response) => {
  try {
    const { name, tokenSymbol, tokenAddress, minAmount, minUsdValue, enabled } = req.body;
    if (!name || !tokenSymbol || minAmount === undefined) {
      return res.status(400).json({ success: false, error: 'Name, tokenSymbol, and minAmount are required' });
    }
    const created = storage.addThreshold({
      name,
      tokenSymbol,
      tokenAddress: tokenAddress || '0x0000000000000000000000000000000000000000',
      minAmount: Number(minAmount),
      minUsdValue: minUsdValue !== undefined ? Number(minUsdValue) : undefined,
      enabled: enabled !== undefined ? !!enabled : true,
    });
    res.status(201).json({ success: true, threshold: created });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Movements feed (Requirement 03)
app.get('/api/movements', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const movements = storage.getMovements(limit, offset);
    res.json({ success: true, count: movements.length, movements });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Summary view (Requirement 04)
app.get('/api/summary', (req: Request, res: Response) => {
  try {
    const summary = whaleEvaluator.generateSummaryView();
    res.json({ success: true, summary });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manual / Scheduled scan trigger
app.post('/api/scan', async (req: Request, res: Response) => {
  try {
    const maxBlocks = parseInt(req.body.maxBlocks as string) || 100;
    const result = await whaleEvaluator.scanRecentBlocks(maxBlocks);
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Telemetry endpoint
app.get('/api/telemetry', async (req: Request, res: Response) => {
  try {
    let latestBlock = 0;
    let rpcAvailable = false;
    let mcpAvailable = false;

    try {
      latestBlock = await rpcService.getLatestBlockNumber();
      rpcAvailable = true;
    } catch {
      // ignore
    }

    try {
      const mcpStatus = mcpClient.getStatus();
      mcpAvailable = mcpStatus.connected;
    } catch {
      // ignore
    }

    const telemetry: SystemTelemetry = {
      network: 'Pharos Atlantic Testnet',
      chainId: 688689,
      latestBlock,
      lastScanBlock: storage.getLastScannedBlock(),
      watchedCount: storage.getWhales().filter((w) => w.enabled).length,
      thresholdsCount: storage.getThresholds().filter((t) => t.enabled).length,
      eventsCount: storage.getMovements(1000).length,
      mcpAvailable,
      rpcAvailable,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    };

    res.json({ success: true, telemetry });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fallback to SPA index.html
app.get('*', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(DASHBOARD_HTML);
});

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  // Pre-initialize MCP client in background
  mcpClient.initialize().catch((err) => {
    console.warn('Background MCP initialization warning:', err.message);
  });

  app.listen(PORT, () => {
    console.log(`[WhaleWatchAgent] Server running on http://localhost:${PORT}`);
  });
}
