import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { WatchedWhale, ThresholdRule, MovementEvent } from '../types.js';

interface StorageState {
  whales: WatchedWhale[];
  thresholds: ThresholdRule[];
  movements: MovementEvent[];
  lastScannedBlock: number;
}

const DEFAULT_WHALES: WatchedWhale[] = [
  {
    id: 'whale-1',
    address: '0x6960d708304918e9d9e487146522c0db35a5078a',
    label: 'Atlantic Core Treasury',
    notes: 'Primary multi-sig ecosystem deployment wallet on Atlantic Testnet',
    enabled: true,
    addedAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'whale-2',
    address: '0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c',
    label: 'Atlantic Market Maker Alpha',
    notes: 'High-frequency liquidity provider and arbitrageur',
    enabled: true,
    addedAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'whale-3',
    address: '0x1111111254fb6c44bac0bed2854e76f90643097d',
    label: '1inch Atlantic Aggregator',
    notes: 'DEX routing aggregation contract on Pharos',
    enabled: true,
    addedAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'whale-4',
    address: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
    label: 'Atlantic USDC Treasury Vault',
    notes: 'Official Atlantic Testnet USDC token distributor vault',
    enabled: true,
    addedAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    id: 'whale-5',
    address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    label: 'Atlantic Router V2',
    notes: 'Automated Market Maker router contract',
    enabled: true,
    addedAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
];

const DEFAULT_THRESHOLDS: ThresholdRule[] = [
  {
    id: 'thresh-usdc',
    name: 'Significant USDC Transfer',
    tokenSymbol: 'USDC',
    tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
    minAmount: 100, // 100 USDC
    minUsdValue: 100,
    enabled: true,
  },
  {
    id: 'thresh-pharos',
    name: 'Significant Native PHAROS Move',
    tokenSymbol: 'PHAROS',
    tokenAddress: '0x0000000000000000000000000000000000000000',
    minAmount: 1, // 1 PHAROS
    minUsdValue: 5,
    enabled: true,
  },
];

export class StorageService {
  private filePath: string;
  private state: StorageState;

  constructor() {
    let baseDir: string;
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      baseDir = path.join(os.tmpdir(), 'pharos-whalewatch');
    } else {
      baseDir = path.resolve(process.cwd(), 'data');
    }

    try {
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
    } catch {
      baseDir = path.join(os.tmpdir(), 'pharos-whalewatch');
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
    }

    this.filePath = path.join(baseDir, 'storage.json');
    this.state = this.loadState();
  }

  private loadState(): StorageState {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.whales) && parsed.whales.length >= 5) {
          return parsed;
        }
      } catch (err) {
        console.warn('Failed to parse existing storage, restoring defaults:', err);
      }
    }

    const initial: StorageState = {
      whales: JSON.parse(JSON.stringify(DEFAULT_WHALES)),
      thresholds: JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS)),
      movements: [],
      lastScannedBlock: 0,
    };
    this.persist(initial);
    return initial;
  }

  private persist(state: StorageState): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to persist storage to disk:', err);
    }
  }

  public getWhales(): WatchedWhale[] {
    return [...this.state.whales];
  }

  public getWhaleById(id: string): WatchedWhale | undefined {
    return this.state.whales.find((w) => w.id === id);
  }

  public getWhaleByAddress(address: string): WatchedWhale | undefined {
    const lower = address.toLowerCase();
    return this.state.whales.find((w) => w.address.toLowerCase() === lower);
  }

  public addWhale(whale: Omit<WatchedWhale, 'id' | 'addedAt' | 'updatedAt'>): WatchedWhale {
    const lower = whale.address.toLowerCase();
    if (!/^0x[a-fA-F0-9]{40}$/.test(whale.address)) {
      throw new Error(`Invalid EVM address format: ${whale.address}`);
    }

    const existing = this.getWhaleByAddress(lower);
    if (existing) {
      throw new Error(`Address ${whale.address} is already on the watchlist (${existing.label})`);
    }

    const newWhale: WatchedWhale = {
      ...whale,
      id: `whale-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      address: lower,
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.state.whales.push(newWhale);
    this.persist(this.state);
    return newWhale;
  }

  public updateWhale(id: string, updates: Partial<Omit<WatchedWhale, 'id' | 'addedAt'>>): WatchedWhale {
    const idx = this.state.whales.findIndex((w) => w.id === id);
    if (idx === -1) {
      throw new Error(`Whale with id ${id} not found`);
    }

    if (updates.address) {
      if (!/^0x[a-fA-F0-9]{40}$/.test(updates.address)) {
        throw new Error(`Invalid EVM address format: ${updates.address}`);
      }
      updates.address = updates.address.toLowerCase();
    }

    const current = this.state.whales[idx];
    const updated: WatchedWhale = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Verify at least 5 active remain
    const futureWhales = [...this.state.whales];
    futureWhales[idx] = updated;
    const activeCount = futureWhales.filter((w) => w.enabled).length;
    if (activeCount < 5) {
      throw new Error(`Cannot disable whale: official task requires at least 5 actively monitored addresses.`);
    }

    this.state.whales[idx] = updated;
    this.persist(this.state);
    return updated;
  }

  public deleteWhale(id: string): boolean {
    const idx = this.state.whales.findIndex((w) => w.id === id);
    if (idx === -1) {
      return false;
    }

    const activeRemaining = this.state.whales.filter((w, i) => i !== idx && w.enabled).length;
    if (activeRemaining < 5) {
      throw new Error(
        `Cannot remove whale: task requirement 01 strictly mandates at least 5 active monitored addresses. Currently ${activeRemaining} active would remain.`
      );
    }

    this.state.whales.splice(idx, 1);
    this.persist(this.state);
    return true;
  }

  public getThresholds(): ThresholdRule[] {
    return [...this.state.thresholds];
  }

  public updateThreshold(id: string, updates: Partial<ThresholdRule>): ThresholdRule {
    const idx = this.state.thresholds.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new Error(`Threshold with id ${id} not found`);
    }
    const updated = { ...this.state.thresholds[idx], ...updates };
    this.state.thresholds[idx] = updated;
    this.persist(this.state);
    return updated;
  }

  public addThreshold(rule: Omit<ThresholdRule, 'id'>): ThresholdRule {
    const newRule: ThresholdRule = {
      ...rule,
      id: `thresh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    this.state.thresholds.push(newRule);
    this.persist(this.state);
    return newRule;
  }

  public getMovements(limit = 50, offset = 0): MovementEvent[] {
    return this.state.movements.slice(offset, offset + limit);
  }

  public hasMovement(id: string): boolean {
    return this.state.movements.some((m) => m.id === id);
  }

  public saveMovement(event: MovementEvent): boolean {
    if (this.hasMovement(event.id)) {
      return false; // deduplicated
    }

    // prepend for reverse-chronological order
    this.state.movements.unshift(event);
    if (this.state.movements.length > 500) {
      this.state.movements = this.state.movements.slice(0, 500);
    }
    this.persist(this.state);
    return true;
  }

  public getLastScannedBlock(): number {
    return this.state.lastScannedBlock || 0;
  }

  public setLastScannedBlock(block: number): void {
    if (block > this.state.lastScannedBlock) {
      this.state.lastScannedBlock = block;
      this.persist(this.state);
    }
  }

  public resetToDefaults(): void {
    this.state = {
      whales: JSON.parse(JSON.stringify(DEFAULT_WHALES)),
      thresholds: JSON.parse(JSON.stringify(DEFAULT_THRESHOLDS)),
      movements: [],
      lastScannedBlock: 0,
    };
    this.persist(this.state);
  }
}

export const storage = new StorageService();
