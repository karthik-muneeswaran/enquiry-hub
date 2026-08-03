import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../../observability/metrics.service';
import { getRequestFromContext, getResponseFromContext } from '@common/utils';

/**
 * Records http_request_duration_seconds histogram for every HTTP/GraphQL request.
 * Labels: method, route, status — matching the Grafana API Performance dashboard queries.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = getRequestFromContext(context);
    if (!request) {
      return next.handle();
    }

    const startTime = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.recordMetric(context, request, startTime),
        error: () => this.recordMetric(context, request, startTime),
      }),
    );
  }

  private recordMetric(
    context: ExecutionContext,
    request: Request,
    startTime: bigint,
  ): void {
    const response = getResponseFromContext(context);
    const durationNs = process.hrtime.bigint() - startTime;
    const durationSeconds = Number(durationNs) / 1e9;

    const method = request.method;
    const route = (request as any).route?.path || request.path || 'unknown';
    const status = response?.statusCode?.toString() || 'unknown';

    this.metricsService.recordHistogram(
      'http_request_duration_seconds',
      durationSeconds,
      { method, route, status },
    );
  }
}
