import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const serviceName = process.env.OTEL_SERVICE_NAME || 'enquiry-backend';

const prometheusExporter = new PrometheusExporter({
  port: 8081,
});

const traceExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
});

const otelSDK = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  }),
  metricReader: prometheusExporter,
  spanProcessors: [new BatchSpanProcessor(traceExporter) as any],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-net': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-dns': {
        enabled: false,
      },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/metrics'],
      },
      '@opentelemetry/instrumentation-pg': {
        enhancedDatabaseReporting: true,
      },
    }),
  ],
});

otelSDK.start();

process.on('SIGTERM', () => {
  otelSDK
    .shutdown()
    .then(() => console.log('OpenTelemetry SDK shut down'))
    .catch((err) => console.error('Error shutting down OpenTelemetry SDK', err))
    .finally(() => process.exit(0));
});

export { otelSDK };
