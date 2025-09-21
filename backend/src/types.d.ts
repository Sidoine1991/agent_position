// Types globaux pour Node.js
declare global {
  var process: {
    cwd(): string;
    env: Record<string, string | undefined>;
    uptime(): number;
    memoryUsage(): {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
    };
    on(event: string, listener: (...args: any[]) => void): void;
    exit(code?: number): never;
  };
}

export {};
