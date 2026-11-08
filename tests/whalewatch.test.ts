import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { storage } from '../src/db/storage.js';
import { whaleEvaluator } from '../src/services/evaluator.js';
import { rpcService } from '../src/services/rpc.js';
import { mcpClient } from '../src/services/mcpClient.js';

describe('Pharos Whale-Watching Agent Automated Verification', () => {
  beforeEach(() => {
    storage.resetToDefaults();
  });

  describe('Requirement 01: Tracks At Least 5 Configurable Addresses', () => {
    it('initializes with at least 5 active watched whale addresses', () => {
      const whales = storage.getWhales();
      const active = whales.filter((w) => w.enabled);
      assert.ok(whales.length >= 5, `Expected >= 5 whales, found ${whales.length}`);
      assert.ok(active.length >= 5, `Expected >= 5 active whales, found ${active.length}`);
    });

    it('allows dynamically adding a new whale with custom label', () => {
      const newWhale = storage.addWhale({
        address: '0x999999cf1046e68e36e1aa2e0e07105eddd840bd',
        label: 'Arbitrum Atlantic Bridge Pool',
        notes: 'Cross-chain settlement vault',
        enabled: true,
      });

      assert.equal(newWhale.address, '0x999999cf1046e68e36e1aa2e0e07105eddd840bd');
      assert.equal(newWhale.label, 'Arbitrum Atlantic Bridge Pool');

      const all = storage.getWhales();
      assert.ok(all.some((w) => w.id === newWhale.id));
    });

    it('rejects malformed EVM addresses', () => {
      assert.throws(() => {
        storage.addWhale({
          address: 'invalid-address',
          label: 'Bad Whale',
          enabled: true,
        });
      }, /Invalid EVM address format/);
    });

    it('rejects duplicate address registration', () => {
      const existing = storage.getWhales()[0];
      assert.throws(() => {
        storage.addWhale({
          address: existing.address,
          label: 'Duplicate Attempt',
          enabled: true,
        });
      }, /already on the watchlist/);
    });

    it('strictly enforces minimum 5 active addresses constraint on deletion', () => {
      const initial = storage.getWhales();
      assert.equal(initial.length, 5);

      // Attempting to delete when count is 5 must be rejected
      assert.throws(() => {
        storage.deleteWhale(initial[0].id);
      }, /task requirement 01 strictly mandates at least 5 active monitored addresses/);

      // Add a 6th whale
      const sixth = storage.addWhale({
        address: '0x1234567890123456789012345678901234567890',
        label: 'Sixth Whale',
        enabled: true,
      });
      assert.equal(storage.getWhales().length, 6);

      // Now deleting sixth should succeed
      const deleted = storage.deleteWhale(sixth.id);
      assert.equal(deleted, true);
      assert.equal(storage.getWhales().length, 5);
    });
  });

  describe('Requirement 02: Configurable "Significant" Thresholds', () => {
    it('loads default thresholds for USDC and PHAROS', () => {
      const thresholds = storage.getThresholds();
      assert.ok(thresholds.length >= 2);
      const usdcThresh = thresholds.find((t) => t.tokenSymbol === 'USDC');
      assert.ok(usdcThresh);
      assert.equal(usdcThresh?.minAmount, 100);
    });

    it('updates existing threshold minAmount', () => {
      const thresholds = storage.getThresholds();
      const usdcThresh = thresholds.find((t) => t.tokenSymbol === 'USDC')!;

      const updated = storage.updateThreshold(usdcThresh.id, { minAmount: 500 });
      assert.equal(updated.minAmount, 500);

      const refreshed = storage.getThresholds().find((t) => t.id === usdcThresh.id);
      assert.equal(refreshed?.minAmount, 500);
    });

    it('filters transfers strictly according to active thresholds', () => {
      const whales = storage.getWhales();
      const whaleSender = whales[0]; // watched sender

      // 1. Transfer of 50 USDC with 100 USDC threshold => should NOT generate event
      const belowEvents = whaleEvaluator.evaluateTransfer({
        txHash: '0xabc111',
        logIndex: 0,
        blockNumber: 1000,
        from: whaleSender.address,
        to: '0xdead000000000000000000000000000000000000',
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 50_000_000n, // 50 USDC (6 decimals)
      });
      assert.equal(belowEvents.length, 0);

      // 2. Transfer of 250 USDC with 100 USDC threshold => MUST generate event
      const aboveEvents = whaleEvaluator.evaluateTransfer({
        txHash: '0xabc222',
        logIndex: 0,
        blockNumber: 1001,
        from: whaleSender.address,
        to: '0xdead000000000000000000000000000000000000',
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 250_000_000n, // 250 USDC
      });
      assert.equal(aboveEvents.length, 1);
      assert.equal(aboveEvents[0].direction, 'OUTFLOW');
      assert.equal(aboveEvents[0].formattedAmount, '250.00');
    });
  });

  describe('Requirement 03: Explains The Move (What, How Much, Where To, Labels, Tx Link)', () => {
    it('generates semantic OUTFLOW explanation with label, amount, and PharosScan link', () => {
      const whales = storage.getWhales();
      const sender = whales[0]; // Atlantic Core Treasury

      const events = whaleEvaluator.evaluateTransfer({
        txHash: '0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
        logIndex: 1,
        blockNumber: 888999,
        from: sender.address,
        to: '0x5555555555555555555555555555555555555555', // Unmonitored external account
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 15_000_000_000n, // 15,000 USDC
      });

      assert.equal(events.length, 1);
      const ev = events[0];
      assert.equal(ev.direction, 'OUTFLOW');
      assert.equal(ev.tokenSymbol, 'USDC');
      assert.equal(ev.formattedAmount, '15,000.00');
      assert.equal(ev.watchedAddressRole, 'SENDER');
      assert.equal(ev.senderLabel, sender.label);
      assert.equal(ev.counterpartyLabel, '0x5555...5555');
      assert.ok(ev.semanticExplanation.includes('Whale outflow: Atlantic Core Treasury transferred 15,000.00 USDC'));
      assert.ok(ev.semanticExplanation.includes('0x5555...5555'));
      assert.equal(
        ev.explorerUrl,
        `https://atlantic.pharosscan.xyz/tx/0x111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000`
      );
    });

    it('generates semantic INFLOW explanation when whale receives tokens', () => {
      const whales = storage.getWhales();
      const receiver = whales[1]; // Atlantic Market Maker Alpha

      const events = whaleEvaluator.evaluateTransfer({
        txHash: '0x9999888877776666555544443333222211110000aaaabbbbccccddddeeeeffff',
        logIndex: 0,
        blockNumber: 888999,
        from: '0x0000000000000000000000000000000000000000', // Mint / Faucet
        to: receiver.address,
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 50_000_000_000n, // 50,000 USDC
      });

      assert.equal(events.length, 1);
      const ev = events[0];
      assert.equal(ev.direction, 'INFLOW');
      assert.equal(ev.tokenSymbol, 'USDC');
      assert.equal(ev.formattedAmount, '50,000.00');
      assert.equal(ev.watchedAddressRole, 'RECEIVER');
      assert.ok(ev.semanticExplanation.includes('Whale inflow: Atlantic Market Maker Alpha received 50,000.00 USDC'));
      assert.ok(ev.semanticExplanation.includes('Genesis / Mint / Faucet'));
    });

    it('generates INTERNAL transfer report when move occurs between two watched whales', () => {
      const whales = storage.getWhales();
      const sender = whales[0];
      const receiver = whales[1];

      const events = whaleEvaluator.evaluateTransfer({
        txHash: '0xabcdef9988776655',
        logIndex: 0,
        blockNumber: 900001,
        from: sender.address,
        to: receiver.address,
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 10_000_000_000n, // 10,000 USDC
      });

      assert.equal(events.length, 1);
      const ev = events[0];
      assert.equal(ev.direction, 'INTERNAL');
      assert.ok(ev.semanticExplanation.includes('Internal whale transfer:'));
      assert.ok(ev.semanticExplanation.includes(sender.label));
      assert.ok(ev.semanticExplanation.includes(receiver.label));
    });

    it('deduplicates movement events on storage insertion', () => {
      const whales = storage.getWhales();
      const events = whaleEvaluator.evaluateTransfer({
        txHash: '0xunique123',
        logIndex: 0,
        blockNumber: 100,
        from: whales[0].address,
        to: '0x1230000000000000000000000000000000000000',
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 1_000_000_000n,
      });

      assert.equal(events.length, 1);
      const firstSave = storage.saveMovement(events[0]);
      assert.equal(firstSave, true);

      // Second identical save must be rejected
      const secondSave = storage.saveMovement(events[0]);
      assert.equal(secondSave, false);
    });
  });

  describe('Requirement 04: Summary View of Recent Activity Across All Watched Addresses', () => {
    it('produces cross-watchlist aggregate statistics and flow breakdown', () => {
      const whales = storage.getWhales();
      const whaleA = whales[0];
      const whaleB = whales[1];

      // Simulate Whale A receiving 20,000 USDC (Inflow)
      const ev1 = whaleEvaluator.evaluateTransfer({
        txHash: '0xtx1',
        logIndex: 0,
        blockNumber: 100,
        from: '0x0000000000000000000000000000000000000000',
        to: whaleA.address,
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 20_000_000_000n, // 20,000 USDC
      });
      storage.saveMovement(ev1[0]);

      // Simulate Whale A sending 5,000 USDC to external account (Outflow)
      const ev2 = whaleEvaluator.evaluateTransfer({
        txHash: '0xtx2',
        logIndex: 1,
        blockNumber: 101,
        from: whaleA.address,
        to: '0x7777777777777777777777777777777777777777',
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 5_000_000_000n, // 5,000 USDC
      });
      storage.saveMovement(ev2[0]);

      // Simulate Whale B receiving 15,000 USDC (Inflow)
      const ev3 = whaleEvaluator.evaluateTransfer({
        txHash: '0xtx3',
        logIndex: 0,
        blockNumber: 102,
        from: '0x0000000000000000000000000000000000000000',
        to: whaleB.address,
        tokenAddress: '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b',
        tokenSymbol: 'USDC',
        decimals: 6,
        rawAmount: 15_000_000_000n, // 15,000 USDC
      });
      storage.saveMovement(ev3[0]);

      const summary = whaleEvaluator.generateSummaryView();

      assert.equal(summary.totalWatchedAddresses, 5);
      assert.equal(summary.activeWatchedAddresses, 5);
      assert.equal(summary.totalMovementsDetected, 3);
      assert.equal(summary.totalVolumeUsd, 40_000); // 20k + 5k + 15k
      assert.equal(summary.totalUsdcVolume, 40_000);

      // Check Whale A flow stats
      const statA = summary.whaleBreakdown.find((s) => s.address.toLowerCase() === whaleA.address.toLowerCase());
      assert.ok(statA);
      assert.equal(statA?.inflowUsd, 20_000);
      assert.equal(statA?.outflowUsd, 5_000);
      assert.equal(statA?.netFlowUsd, 15_000);
      assert.equal(statA?.movementCount, 2);

      // Check Most Active Whale
      assert.ok(summary.mostActiveWhale);
      assert.equal(summary.mostActiveWhale?.address.toLowerCase(), whaleA.address.toLowerCase());
      assert.equal(summary.mostActiveWhale?.count, 2);

      // Check Top Counterparties
      assert.ok(summary.topCounterparties.length > 0);
    });
  });

  describe('Live Network & RPC Integration', () => {
    it('connects to Pharos Atlantic Testnet and fetches current block number', async () => {
      const block = await rpcService.getLatestBlockNumber();
      assert.ok(typeof block === 'number');
      assert.ok(block > 0, `Block number should be > 0, got ${block}`);
    });
  });
});
