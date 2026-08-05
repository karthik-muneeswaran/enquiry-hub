import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventLoopMonitor } from '@common/services/event-loop-monitor.service';
import { getResponseFromContext } from '@common/utils';

/**
 * LoadSheddingInterceptor rejects incoming requests with 503 + Retry-After
 * when the event loop is overloaded (lag > 200ms).
 * Context-aware: works for both HTTP and GraphQL.
 */
@Injectable()
export class LoadSheddingInterceptor implements NestInterceptor {
  private static readonly RETRY_AFTER_SECONDS = 5;

  constructor(private readonly eventLoopMonitor: EventLoopMonitor) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (this.eventLoopMonitor.isShedding) {
      const response = getResponseFromContext(context);
      if (response) {
        response.setHeader('Retry-After', String(LoadSheddingInterceptor.RETRY_AFTER_SECONDS));
      }

      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Server is under heavy load. Please retry after the indicated period.',
        code: 'LOAD_SHEDDING',
      });
    }

    return next.handle();
  }
}
