declare module 'opossum' {
  import { EventEmitter } from 'events';

  interface CircuitBreakerOptions {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    volumeThreshold?: number;
    rollingCountTimeout?: number;
    name?: string;
  }

  class CircuitBreaker<TI extends unknown[] = unknown[], TO = unknown> extends EventEmitter {
    constructor(action: (...args: TI) => Promise<TO>, options?: CircuitBreakerOptions);
    fire(...args: TI): Promise<TO>;
    open(): void;
    close(): void;
    get opened(): boolean;
    get closed(): boolean;
    get name(): string;
    get status(): { stats: Record<string, number> };
    on(event: string, listener: (...args: any[]) => void): this;
  }

  export = CircuitBreaker;
}
