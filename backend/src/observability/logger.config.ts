import { trace } from '@opentelemetry/api';
import { Params } from 'nestjs-pino';

export function getLoggerConfig(): Params {
  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.email',
          'req.body.phone',
        ],
        censor: '[REDACTED]',
      },
      mixin() {
        const activeSpan = trace.getActiveSpan();
        if (activeSpan) {
          const spanContext = activeSpan.spanContext();
          return {
            traceId: spanContext.traceId,
            spanId: spanContext.spanId,
          };
        }
        return {};
      },
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    },
  };
}
