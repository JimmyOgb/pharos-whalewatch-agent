export interface WatchedWhale {
  id: string;
  address: string;
  label: string;
  notes?: string;
  enabled: boolean;
  addedAt: string;
  updatedAt: string;
}

export interface ThresholdRule {
  id: string;
  name: string;
  tokenSymbol: 'USDC' | 'PHAROS' | 'ALL';
  tokenAddress: string;
  minAmount: number;
  minUsdValue?: number;
  enabled: boolean;
}

export type MovementDirection = 'INFLOW' | 'OUTFLOW' | 'INTERNAL';

export interface MovementEvent {
  id: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
  tokenSymbol: string;
  tokenAddress: string;
  rawAmount: string;
  formattedAmount: string;
  decimals: number;
  estimatedUsdValue: number;
  watchedAddress: string;
  watchedAddressRole: 'SENDER' | 'RECEIVER' | 'INTERNAL';
  counterpartyAddress: string;
  counterpartyLabel: string;
  senderAddress: string;
  senderLabel: string;
  receiverAddress: string;
  receiverLabel: string;
  direction: MovementDirection;
  semanticExplanation: string;
  explorerUrl: string;
  source: 'MCP' | 'RPC';
}

export interface WhaleFlowStat {
  address: string;
  label: string;
  inflowUsd: number;
  outflowUsd: number;
  netFlowUsd: number;
  movementCount: number;
  lastActiveTimestamp?: string;
}

export interface WhaleSummaryView {
  totalWatchedAddresses: number;
  activeWatchedAddresses: number;
  totalMovementsDetected: number;
  totalVolumeUsd: number;
  totalUsdcVolume: number;
  totalPharosVolume: number;
  whaleBreakdown: WhaleFlowStat[];
  recentActivity: MovementEvent[];
  mostActiveWhale: { address: string; label: string; count: number } | null;
  topCounterparties: Array<{ address: string; label: string; count: number }>;
  lastScanBlock: number;
  mcpStatus: {
    connected: boolean;
    lastChecked: string;
    endpoint: string;
    toolCount: number;
  };
}

export interface SystemTelemetry {
  network: string;
  chainId: number;
  latestBlock: number;
  lastScanBlock: number;
  watchedCount: number;
  thresholdsCount: number;
  eventsCount: number;
  mcpAvailable: boolean;
  rpcAvailable: boolean;
  uptimeSeconds: number;
}
