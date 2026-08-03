import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

/**
 * EventLoopMonitor samples event loop lag every 1 second using setImmediate.
 * Exposes the current lag and a hysteresis-based `isShedding` property:
 * - Starts shedding when lag > 200ms
 * - Stops shedding when lag drops below 100ms
 *
 * This prevents oscillation between shedding and accepting states.
 */
@Injectable()
export class EventLoopMonitor implements OnModuleInit, OnModuleDestroy {
  private lag = 0;
  private shedding = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;

  private static readonly SHED_THRESHOLD_MS = 200;
  private static readonly RECOVERY_THRESHOLD_MS = 100;
  private static readonly SAMPLE_INTERVAL_MS = 1000;

  onModuleInit(): void {
    this.startMonitoring();
  }

  onModuleDestroy(): void {
    this.stopMonitoring();
  }

  /**
   * Returns the most recently measured event loop lag in milliseconds.
   */
  getLag(): number {
    return this.lag;
  }

  /**
   * Returns the current lag as seconds (for Prometheus gauge export).
   */
  getLagSeconds(): number {
    return this.lag / 1000;
  }

  /**
   * Returns true when the system is in load-shedding state.
   * Uses hysteresis: activates at >200ms, deactivates at <100ms.
   */
  get isShedding(): boolean {
    return this.shedding;
  }

  private startMonitoring(): void {
    this.intervalHandle = setInterval(() => {
      const start = Date.now();
      setImmediate(() => {
        this.lag = Date.now() - start;
        this.updateSheddingState();
      });
    }, EventLoopMonitor.SAMPLE_INTERVAL_MS);

    // Ensure the interval doesn't prevent the process from exiting
    if (this.intervalHandle && typeof this.intervalHandle.unref === 'function') {
      this.intervalHandle.unref();
    }
  }

  private stopMonitoring(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }

  private updateSheddingState(): void {
    if (!this.shedding && this.lag > EventLoopMonitor.SHED_THRESHOLD_MS) {
      this.shedding = true;
    } else if (this.shedding && this.lag < EventLoopMonitor.RECOVERY_THRESHOLD_MS) {
      this.shedding = false;
    }
    // If shedding and lag is between 100-200ms, stay in shedding state (hysteresis)
  }
}
