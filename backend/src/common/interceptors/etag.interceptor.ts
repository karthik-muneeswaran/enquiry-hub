import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { createHash } from 'crypto';
import { Request, Response } from 'express';

/**
 * ETagInterceptor computes a weak ETag (MD5 hash) of the response body
 * and handles conditional requests via If-None-Match header.
 *
 * - On response, computes MD5 of JSON.stringify(data) and sets ETag header.
 * - If request has If-None-Match header matching the computed ETag, returns 304.
 */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // Compute weak ETag from the response body
        const body = JSON.stringify(data);
        const hash = createHash('md5').update(body).digest('hex');
        const etag = `W/"${hash}"`;

        // Set ETag on response
        response.setHeader('ETag', etag);

        // Check If-None-Match header from the request
        const ifNoneMatch = request.headers['if-none-match'];

        if (ifNoneMatch && ifNoneMatch === etag) {
          // Resource has not been modified — return 304 with no body
          response.status(HttpStatus.NOT_MODIFIED);
          return undefined;
        }

        return data;
      }),
    );
  }
}
