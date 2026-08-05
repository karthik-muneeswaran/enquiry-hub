import CircuitBreaker = require('opossum');
import { Logger } from '@nestjs/common';

export interface CircuitBreakerOptions {
  /** Timeout in milliseconds before a call is considered failed (default: 10000) */
  timeout?: number;
  /** Percentage of failures before opening (default: 50) */
  errorThresholdPercentage?: number;
  /** Time in ms to wait before transitioning from OPEN → HALF-OPEN (default: 30000) */
  resetTimeout?: number;
  /** Minimum number of requests in the rolling window before the circuit can trip (default: 5) */
  volumeThreshold?: number;
  /** Rolling count window in ms (default: 30000) */
  rollingCountTimeout?: number;
}

/**
 * Factory function to create a circuit breaker wrapping an async action.
 *
 * State machine:
 *   CLOSED → (failures exceed errorThresholdPercentage within volumeThreshold) → OPEN
 *   OPEN → (resetTimeout elapsed) → HALF-OPEN
 *   HALF-OPEN → (probe succeeds) → CLOSED
 *   HALF-OPEN → (probe fails) → OPEN
 */
export function createCircuitBreaker<TArgs extends unknown[], TResult>(
  name: string,
  action: (...args: TArgs) => Promise<TResult>,
  options: CircuitBreakerOptions = {},
): CircuitBreaker<TArgs, TResult> {
  const logger = new Logger(`CircuitBreaker:${name}`);

  const defaults: Required<CircuitBreakerOptions> = {
    timeout: 10000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000,
    volumeThreshold: 5,
    rollingCountTimeout: 30000,
  };

  const mergedOptions = { ...defaults, ...options };

  const breaker = new CircuitBreaker(action, {
    timeout: mergedOptions.timeout,
    errorThresholdPercentage: mergedOptions.errorThresholdPercentage,
    resetTimeout: mergedOptions.resetTimeout,
    volumeThreshold: mergedOptions.volumeThreshold,
    rollingCountTimeout: mergedOptions.rollingCountTimeout,
    name,
  });

  // Log state transitions
  breaker.on('open', () => {
    logger.warn(
      `Circuit OPEN — requests will be short-circuited for ${mergedOptions.resetTimeout}ms`,
    );
  });

  breaker.on('halfOpen', () => {
    logger.log(`Circuit HALF-OPEN — next request will probe external service`);
  });

  breaker.on('close', () => {
    logger.log(`Circuit CLOSED — normal operation resumed`);
  });

  breaker.on('timeout', () => {
    logger.warn(`Circuit timeout — call exceeded ${mergedOptions.timeout}ms`);
  });

  breaker.on('reject', () => {
    logger.warn(`Circuit rejected call — breaker is OPEN`);
  });

  breaker.on('fallback', () => {
    logger.log(`Circuit fallback invoked`);
  });

  return breaker;
}
