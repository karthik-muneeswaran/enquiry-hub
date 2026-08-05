import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiSuccessResponse } from '@common/response';
import { isGraphQLContext, getRequestFromContext } from '@common/utils';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T> | T> {
    // Skip envelope wrapping for GraphQL — Apollo handles response shaping
    if (isGraphQLContext(context)) {
      return next.handle();
    }

    const request = getRequestFromContext(context);
    const requestId = (request as Request & { id?: string })?.id || 'unknown';

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        request_id: requestId,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
