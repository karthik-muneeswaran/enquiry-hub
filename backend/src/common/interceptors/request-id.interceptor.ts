import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request } from 'express';
import { getRequestFromContext, getResponseFromContext } from '@common/utils';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = getRequestFromContext(context);
    const response = getResponseFromContext(context);

    if (!request) {
      return next.handle();
    }

    const requestId = (request.headers['x-request-id'] as string) || randomUUID();

    // Attach to the request object for downstream usage
    (request as Request & { id: string }).id = requestId;

    // Set response header if response is available
    if (response) {
      response.setHeader('X-Request-Id', requestId);
    }

    return next.handle();
  }
}
