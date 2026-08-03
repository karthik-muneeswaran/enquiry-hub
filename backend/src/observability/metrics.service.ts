import { Injectable, Logger } from '@nestjs/common';
import { metrics, Counter, Histogram, Meter } from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly meter: Meter;

  // Counters
  private readonly counters: Map<string, Counter> = new Map();

  // Histograms
  private readonly histograms: Map<string, Histogram> = new Map();

  // Gauge values (OpenTelemetry gauges use observable callbacks)
  private readonly gaugeValues: Map<string, number> = new Map();

  constructor() {
    this.meter = metrics.getMeter('enquiry-hub');
    this.initializeCounters();
    this.initializeHistograms();
    this.initializeGauges();
  }

  private initializeCounters(): void {
    const counterDefinitions: Array<{ name: string; description: string }> = [
      {
        name: 'enquiry_created_total',
        description: 'Total number of enquiries created',
      },

      {
        name: 'cache_hit_total',
        description: 'Total number of cache hits',
      },
      {
        name: 'cache_miss_total',
        description: 'Total number of cache misses',
      },
      {
        name: 'rate_limit_triggered_total',
        description: 'Total number of rate limit triggers',
      },
      {
        name: 'webhook_received_total',
        description: 'Total number of webhook events received',
      },
    ];

    for (const def of counterDefinitions) {
      const counter = this.meter.createCounter(def.name, {
        description: def.description,
      });
      this.counters.set(def.name, counter);
    }
  }

  private initializeHistograms(): void {
    const histogramDefinitions: Array<{
      name: string;
      description: string;
      unit: string;
      advice?: { explicitBucketBoundaries: number[] };
    }> = [
      {
        name: 'http_request_duration_seconds',
        description: 'Duration of HTTP requests in seconds',
        unit: 's',
        advice: {
          explicitBucketBoundaries: [
            0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
          ],
        },
      },
      {
        name: 'queue_job_duration_seconds',
        description: 'Duration of queue job processing in seconds',
        unit: 's',
      },
      {
        name: 'db_query_duration_seconds',
        description: 'Duration of database queries in seconds',
        unit: 's',
      },
    ];

    for (const def of histogramDefinitions) {
      const options: any = {
        description: def.description,
        unit: def.unit,
      };
      if (def.advice) {
        options.advice = def.advice;
      }
      const histogram = this.meter.createHistogram(def.name, options);
      this.histograms.set(def.name, histogram);
    }
  }

  private initializeGauges(): void {
    const gaugeDefinitions: Array<{ name: string; description: string }> = [
      {
        name: 'queue_depth',
        description: 'Current depth of job queues',
      },
      {
        name: 'db_pool_active_connections',
        description: 'Number of active database pool connections',
      },
      {
        name: 'event_loop_lag_seconds',
        description: 'Event loop lag in seconds',
      },
    ];

    for (const def of gaugeDefinitions) {
      this.gaugeValues.set(def.name, 0);

      this.meter.createObservableGauge(def.name, {
        description: def.description,
      }).addCallback((observableResult) => {
        const value = this.gaugeValues.get(def.name) ?? 0;
        observableResult.observe(value);
      });
    }
  }

  /**
   * Increment a counter metric by 1 (or more).
   */
  incrementCounter(
    name: string,
    labels?: Record<string, string>,
  ): void {
    const counter = this.counters.get(name);
    if (!counter) {
      this.logger.warn(`Counter "${name}" not found`);
      return;
    }
    counter.add(1, labels);
  }

  /**
   * Record a value in a histogram metric.
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const histogram = this.histograms.get(name);
    if (!histogram) {
      this.logger.warn(`Histogram "${name}" not found`);
      return;
    }
    histogram.record(value, labels);
  }

  /**
   * Set the current value of a gauge metric.
   */
  setGauge(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    if (!this.gaugeValues.has(name)) {
      this.logger.warn(`Gauge "${name}" not found`);
      return;
    }
    this.gaugeValues.set(name, value);
  }
}
