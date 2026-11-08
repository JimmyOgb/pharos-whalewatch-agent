import { createPublicClient, http, formatUnits, parseAbiItem, Address } from 'viem';

export const ATLANTIC_TESTNET = {
  id: 688689,
  name: 'Pharos Atlantic Testnet',
  network: 'pharos-atlantic',
  nativeCurrency: {
    decimals: 18,
    name: 'Pharos',
    symbol: 'PHAROS',
  },
  rpcUrls: {
    default: {
      http: ['https://atlantic.dplabs-internal.com'],
    },
    public: {
      http: ['https://atlantic.dplabs-internal.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PharosScan',
      url: 'https://atlantic.pharosscan.xyz',
    },
  },
} as const;

export const KNOWN_CONTRACTS: Record<string, string> = {
  '0x0000000000000000000000000000000000000000': 'Genesis / Mint / Faucet',
  '0xcfc8330f4bcab529c625d12781b1c19466a9fc8b': 'Atlantic Test USDC Contract',
  '0x6960d708304918e9d9e487146522c0db35a5078a': 'Atlantic Core Treasury Multi-Sig',
  '0x2b4c76d0dc16be1c31d4c1dc53bf9b45987fc75c': 'Atlantic MM Liquidity Pool',
  '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch Aggregation Router V5',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
};

export const TRANSFER_EVENT_ABI = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
);

export class PharosRpcService {
  private client: ReturnType<typeof createPublicClient>;
  private cachedBlockNumber: number | null = null;
  private lastBlockFetchTime = 0;
  private readonly CACHE_TTL_MS = 3500;

  constructor(rpcUrl = 'https://atlantic.dplabs-internal.com') {
    this.client = createPublicClient({
      chain: ATLANTIC_TESTNET,
      transport: http(rpcUrl, {
        timeout: 4500,
        retryCount: 1,
      }),
    });
  }

  public async getLatestBlockNumber(): Promise<number> {
    const now = Date.now();
    if (this.cachedBlockNumber !== null && now - this.lastBlockFetchTime < this.CACHE_TTL_MS) {
      return this.cachedBlockNumber;
    }

    try {
      const block = await this.client.getBlockNumber();
      this.cachedBlockNumber = Number(block);
      this.lastBlockFetchTime = now;
      return this.cachedBlockNumber;
    } catch (err) {
      if (this.cachedBlockNumber !== null) {
        return this.cachedBlockNumber;
      }
      throw err;
    }
  }

  public async getErc20TransferLogs(params: {
    fromBlock: bigint;
    toBlock: bigint;
    tokenAddress?: Address;
  }) {
    return await this.client.getLogs({
      address: params.tokenAddress,
      event: TRANSFER_EVENT_ABI,
      fromBlock: params.fromBlock,
      toBlock: params.toBlock,
    });
  }

  public async getTransactionReceipt(hash: `0x${string}`) {
    return await this.client.getTransactionReceipt({ hash });
  }

  public formatTokenAmount(rawAmount: bigint | string, decimals: number): string {
    const bigVal = typeof rawAmount === 'string' ? BigInt(rawAmount) : rawAmount;
    const formatted = formatUnits(bigVal, decimals);
    const num = parseFloat(formatted);
    if (num >= 1000) {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  }

  public buildExplorerTxUrl(txHash: string): string {
    return `https://atlantic.pharosscan.xyz/tx/${txHash}`;
  }

  public resolveKnownLabel(address: string): string {
    const lower = address.toLowerCase();
    if (KNOWN_CONTRACTS[lower]) {
      return KNOWN_CONTRACTS[lower];
    }
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }
}

export const rpcService = new PharosRpcService();
