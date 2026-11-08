import { storage } from '../db/storage.js';
import { rpcService } from './rpc.js';
import { mcpClient } from './mcpClient.js';
import {
  MovementEvent,
  WhaleSummaryView,
  WhaleFlowStat,
  WatchedWhale,
  ThresholdRule,
  MovementDirection,
} from '../types.js';
import { formatUnits } from 'viem';

export class WhaleEvaluatorService {
  /**
   * Evaluates an individual transfer against active thresholds and watched whales.
   */
  public evaluateTransfer(params: {
    txHash: string;
    logIndex: number;
    blockNumber: number;
    from: string;
    to: string;
    tokenAddress: string;
    tokenSymbol: string;
    decimals: number;
    rawAmount: bigint;
    usdRate?: number;
    source?: 'MCP' | 'RPC';
  }): MovementEvent[] {
    const fromLower = params.from.toLowerCase();
    const toLower = params.to.toLowerCase();
    const tokenLower = params.tokenAddress.toLowerCase();

    const whales = storage.getWhales().filter((w) => w.enabled);
    const thresholds = storage.getThresholds().filter((t) => t.enabled);

    const watchedFrom = whales.find((w) => w.address.toLowerCase() === fromLower);
    const watchedTo = whales.find((w) => w.address.toLowerCase() === toLower);

    // If neither sender nor receiver is a watched whale, ignore
    if (!watchedFrom && !watchedTo) {
      return [];
    }

    const formattedUnit = parseFloat(formatUnits(params.rawAmount, params.decimals));
    const usdPrice = params.usdRate ?? (params.tokenSymbol === 'USDC' ? 1.0 : 5.0);
    const estimatedUsd = formattedUnit * usdPrice;

    // Check against threshold rules
    const matchedThresholds = thresholds.filter((thresh) => {
      if (thresh.tokenSymbol !== 'ALL' && thresh.tokenSymbol !== params.tokenSymbol) {
        if (thresh.tokenAddress && thresh.tokenAddress.toLowerCase() !== tokenLower) {
          return false;
        }
      }

      const meetsAmount = formattedUnit >= thresh.minAmount;
      const meetsUsd = thresh.minUsdValue !== undefined ? estimatedUsd >= thresh.minUsdValue : false;
      return meetsAmount || meetsUsd;
    });

    if (matchedThresholds.length === 0) {
      return [];
    }

    const events: MovementEvent[] = [];

    // Determine direction and explanations
    const senderLabel = watchedFrom?.label || rpcService.resolveKnownLabel(params.from);
    const receiverLabel = watchedTo?.label || rpcService.resolveKnownLabel(params.to);
    const formattedAmountStr = rpcService.formatTokenAmount(params.rawAmount, params.decimals);

    // If both are watched whales, record an INTERNAL movement for each or joint
    if (watchedFrom && watchedTo) {
      const explanation = `Internal whale transfer: ${senderLabel} transferred ${formattedAmountStr} ${params.tokenSymbol} (~$${estimatedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) to ${receiverLabel}`;
      
      const evt: MovementEvent = {
        id: `688689:${params.txHash}:${params.logIndex}:${watchedFrom.address}:internal`,
        txHash: params.txHash,
        blockNumber: params.blockNumber,
        timestamp: new Date().toISOString(),
        tokenSymbol: params.tokenSymbol,
        tokenAddress: params.tokenAddress,
        rawAmount: params.rawAmount.toString(),
        formattedAmount: formattedAmountStr,
        decimals: params.decimals,
        estimatedUsdValue: estimatedUsd,
        watchedAddress: watchedFrom.address,
        watchedAddressRole: 'SENDER',
        counterpartyAddress: watchedTo.address,
        counterpartyLabel: receiverLabel,
        senderAddress: params.from,
        senderLabel,
        receiverAddress: params.to,
        receiverLabel,
        direction: 'INTERNAL',
        semanticExplanation: explanation,
        explorerUrl: rpcService.buildExplorerTxUrl(params.txHash),
        source: params.source || 'RPC',
      };
      events.push(evt);
    } else if (watchedFrom) {
      // Outflow from watched whale
      const explanation = `Whale outflow: ${senderLabel} transferred ${formattedAmountStr} ${params.tokenSymbol} (~$${estimatedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) out to ${receiverLabel}`;
      
      const evt: MovementEvent = {
        id: `688689:${params.txHash}:${params.logIndex}:${watchedFrom.address}:outflow`,
        txHash: params.txHash,
        blockNumber: params.blockNumber,
        timestamp: new Date().toISOString(),
        tokenSymbol: params.tokenSymbol,
        tokenAddress: params.tokenAddress,
        rawAmount: params.rawAmount.toString(),
        formattedAmount: formattedAmountStr,
        decimals: params.decimals,
        estimatedUsdValue: estimatedUsd,
        watchedAddress: watchedFrom.address,
        watchedAddressRole: 'SENDER',
        counterpartyAddress: params.to,
        counterpartyLabel: receiverLabel,
        senderAddress: params.from,
        senderLabel,
        receiverAddress: params.to,
        receiverLabel,
        direction: 'OUTFLOW',
        semanticExplanation: explanation,
        explorerUrl: rpcService.buildExplorerTxUrl(params.txHash),
        source: params.source || 'RPC',
      };
      events.push(evt);
    } else if (watchedTo) {
      // Inflow to watched whale
      const explanation = `Whale inflow: ${receiverLabel} received ${formattedAmountStr} ${params.tokenSymbol} (~$${estimatedUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) from ${senderLabel}`;

      const evt: MovementEvent = {
        id: `688689:${params.txHash}:${params.logIndex}:${watchedTo.address}:inflow`,
        txHash: params.txHash,
        blockNumber: params.blockNumber,
        timestamp: new Date().toISOString(),
        tokenSymbol: params.tokenSymbol,
        tokenAddress: params.tokenAddress,
        rawAmount: params.rawAmount.toString(),
        formattedAmount: formattedAmountStr,
        decimals: params.decimals,
        estimatedUsdValue: estimatedUsd,
        watchedAddress: watchedTo.address,
        watchedAddressRole: 'RECEIVER',
        counterpartyAddress: params.from,
        counterpartyLabel: senderLabel,
        senderAddress: params.from,
        senderLabel,
        receiverAddress: params.to,
        receiverLabel,
        direction: 'INFLOW',
        semanticExplanation: explanation,
        explorerUrl: rpcService.buildExplorerTxUrl(params.txHash),
        source: params.source || 'RPC',
      };
      events.push(evt);
    }

    return events;
  }

  /**
   * Compiles the Cross-Watchlist Summary View (Requirement 04).
   */
  public generateSummaryView(): WhaleSummaryView {
    const allWhales = storage.getWhales();
    const activeWhales = allWhales.filter((w) => w.enabled);
    const movements = storage.getMovements(200);

    let totalVolumeUsd = 0;
    let totalUsdcVolume = 0;
    let totalPharosVolume = 0;

    const whaleStatMap = new Map<string, WhaleFlowStat>();
    const counterpartyMap = new Map<string, { label: string; count: number }>();

    for (const whale of allWhales) {
      whaleStatMap.set(whale.address.toLowerCase(), {
        address: whale.address,
        label: whale.label,
        inflowUsd: 0,
        outflowUsd: 0,
        netFlowUsd: 0,
        movementCount: 0,
      });
    }

    for (const m of movements) {
      totalVolumeUsd += m.estimatedUsdValue;
      if (m.tokenSymbol === 'USDC') {
        totalUsdcVolume += parseFloat(m.formattedAmount.replace(/,/g, ''));
      } else if (m.tokenSymbol === 'PHAROS') {
        totalPharosVolume += parseFloat(m.formattedAmount.replace(/,/g, ''));
      }

      // Update watched whale stats
      const whaleStat = whaleStatMap.get(m.watchedAddress.toLowerCase());
      if (whaleStat) {
        whaleStat.movementCount += 1;
        whaleStat.lastActiveTimestamp = m.timestamp;
        if (m.direction === 'INFLOW') {
          whaleStat.inflowUsd += m.estimatedUsdValue;
          whaleStat.netFlowUsd += m.estimatedUsdValue;
        } else if (m.direction === 'OUTFLOW') {
          whaleStat.outflowUsd += m.estimatedUsdValue;
          whaleStat.netFlowUsd -= m.estimatedUsdValue;
        }
      }

      // Track counterparties
      const cpAddress = m.counterpartyAddress.toLowerCase();
      const currentCp = counterpartyMap.get(cpAddress) || {
        label: m.counterpartyLabel,
        count: 0,
      };
      currentCp.count += 1;
      counterpartyMap.set(cpAddress, currentCp);
    }

    const whaleBreakdown = Array.from(whaleStatMap.values()).sort(
      (a, b) => b.movementCount - a.movementCount || (b.inflowUsd + b.outflowUsd) - (a.inflowUsd + a.outflowUsd)
    );

    let mostActive: { address: string; label: string; count: number } | null = null;
    if (whaleBreakdown.length > 0 && whaleBreakdown[0].movementCount > 0) {
      mostActive = {
        address: whaleBreakdown[0].address,
        label: whaleBreakdown[0].label,
        count: whaleBreakdown[0].movementCount,
      };
    }

    const topCounterparties = Array.from(counterpartyMap.entries())
      .map(([address, info]) => ({
        address,
        label: info.label,
        count: info.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalWatchedAddresses: allWhales.length,
      activeWatchedAddresses: activeWhales.length,
      totalMovementsDetected: movements.length,
      totalVolumeUsd,
      totalUsdcVolume,
      totalPharosVolume,
      whaleBreakdown,
      recentActivity: movements.slice(0, 20),
      mostActiveWhale: mostActive,
      topCounterparties,
      lastScanBlock: storage.getLastScannedBlock(),
      mcpStatus: mcpClient.getStatus(),
    };
  }

  /**
   * Scans a specific block window for Atlantic USDC and native transfers.
   */
  public async scanRecentBlocks(maxBlocks = 100): Promise<{
    scannedFrom: number;
    scannedTo: number;
    newEventsCount: number;
  }> {
    let latest = 0;
    let source: 'MCP' | 'RPC' = 'RPC';

    try {
      latest = await mcpClient.getLatestBlockNumber();
      source = 'MCP';
    } catch {
      latest = await rpcService.getLatestBlockNumber();
      source = 'RPC';
    }

    let lastScanned = storage.getLastScannedBlock();
    if (lastScanned === 0) {
      // First run: inspect the last 150 blocks
      lastScanned = Math.max(0, latest - 150);
    }

    if (lastScanned >= latest) {
      return { scannedFrom: latest, scannedTo: latest, newEventsCount: 0 };
    }

    const fromBlock = BigInt(Math.max(lastScanned + 1, latest - maxBlocks));
    const toBlock = BigInt(latest);

    const usdcAddress = '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b' as const;

    let newCount = 0;
    try {
      const logs = await rpcService.getErc20TransferLogs({
        fromBlock,
        toBlock,
        tokenAddress: usdcAddress,
      });

      for (const log of logs) {
        if (!log.args.from || !log.args.to || log.args.value === undefined) continue;

        const evaluatedEvents = this.evaluateTransfer({
          txHash: log.transactionHash,
          logIndex: log.logIndex ?? 0,
          blockNumber: Number(log.blockNumber),
          from: log.args.from,
          to: log.args.to,
          tokenAddress: usdcAddress,
          tokenSymbol: 'USDC',
          decimals: 6,
          rawAmount: log.args.value,
          usdRate: 1.0,
          source,
        });

        for (const evt of evaluatedEvents) {
          const saved = storage.saveMovement(evt);
          if (saved) newCount++;
        }
      }
    } catch (err) {
      console.warn('Block scan encountered non-fatal RPC issue:', err);
    }

    storage.setLastScannedBlock(latest);
    return {
      scannedFrom: Number(fromBlock),
      scannedTo: Number(toBlock),
      newEventsCount: newCount,
    };
  }
}

export const whaleEvaluator = new WhaleEvaluatorService();
