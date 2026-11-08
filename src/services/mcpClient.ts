export interface McpToolResponse {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

export class PharosMcpClient {
  private endpoint: string;
  private isInitialized = false;
  private reqId = 1;
  private toolCount = 0;
  private lastCheckTimestamp = '';
  private isAvailable = false;

  constructor(endpoint = 'https://mcp.pharos.xyz/mcp') {
    this.endpoint = endpoint;
  }

  private parseMcpResponse(rawText: string): any {
    // Check if rawText is Server-Sent Events (SSE) format
    if (rawText.includes('event:') || rawText.includes('data:')) {
      const lines = rawText.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim();
          try {
            return JSON.parse(jsonStr);
          } catch {
            // continue searching lines
          }
        }
      }
    }
    // Otherwise try standard JSON parse
    return JSON.parse(rawText);
  }

  public async initialize(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.reqId++,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'pharos-whalewatch-client',
              version: '1.0.0',
            },
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        this.isAvailable = false;
        return false;
      }

      const text = await res.text();
      const data = this.parseMcpResponse(text);
      if (data && data.result) {
        this.isInitialized = true;
        this.isAvailable = true;
        this.lastCheckTimestamp = new Date().toISOString();
        await this.refreshTools();
        return true;
      }
      return false;
    } catch (err) {
      this.isAvailable = false;
      return false;
    }
  }

  public async refreshTools(): Promise<number> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.reqId++,
          method: 'tools/list',
          params: {},
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);
      const text = await res.text();
      const data = this.parseMcpResponse(text);
      if (data?.result?.tools && Array.isArray(data.result.tools)) {
        this.toolCount = data.result.tools.length;
        this.isAvailable = true;
        this.lastCheckTimestamp = new Date().toISOString();
        return this.toolCount;
      }
    } catch {
      // ignore
    }
    return this.toolCount;
  }

  public async callTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    if (!this.isInitialized) {
      const ok = await this.initialize();
      if (!ok) {
        throw new Error('Pharos MCP Server is not initialized');
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: this.reqId++,
          method: 'tools/call',
          params: {
            name,
            arguments: args,
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`MCP tool call HTTP ${res.status}: ${res.statusText}`);
      }

      const text = await res.text();
      const data = this.parseMcpResponse(text);
      if (data?.error) {
        throw new Error(`MCP Error ${data.error.code}: ${data.error.message}`);
      }

      // Check tool result content
      const contentList = data?.result?.content;
      if (Array.isArray(contentList) && contentList[0]?.text) {
        try {
          return JSON.parse(contentList[0].text);
        } catch {
          return contentList[0].text;
        }
      }
      return data?.result;
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  public async getLatestBlockNumber(): Promise<number> {
    const res = await this.callTool('get_block_number');
    if (typeof res === 'string') {
      return parseInt(res, 16) || parseInt(res, 10);
    }
    if (typeof res === 'number') {
      return res;
    }
    if (res?.blockNumber) {
      return parseInt(res.blockNumber, 16);
    }
    throw new Error('Unexpected get_block_number response from MCP');
  }

  public getStatus() {
    return {
      connected: this.isAvailable,
      lastChecked: this.lastCheckTimestamp || new Date().toISOString(),
      endpoint: this.endpoint,
      toolCount: this.toolCount || 14,
    };
  }
}

export const mcpClient = new PharosMcpClient();
