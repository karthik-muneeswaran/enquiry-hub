import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiErrorCode } from '@common/response';
import { getRequestFromContext } from '@common/utils';

/**
 * Guard that rejects non-JSON Content-Type on POST, PUT, PATCH requests.
 * Context-aware: works for both HTTP and GraphQL (GQL is always JSON).
 */
@Injectable()
export class ContentTypeGuard implements CanActivate {
  private readonly METHODS_TO_CHECK = ['POST', 'PUT', 'PATCH'];

  canActivate(context: ExecutionContext): boolean {
    const request = getRequestFromContext(context);

    // No request available (shouldn't happen) — allow through
    if (!request) {
      return true;
    }

    const method = request.method.toUpperCase();

    // Only check methods that typically carry a body
    if (!this.METHODS_TO_CHECK.includes(method)) {
      return true;
    }

    // Skip if body is empty (Content-Length: 0 or missing)
    const contentLength = request.headers['content-length'];
    if (contentLength === '0' || contentLength === undefined) {
      return true;
    }

    const contentType = request.headers['content-type'] || '';

    // Skip for multipart/form-data (file uploads)
    if (contentType.includes('multipart/form-data')) {
      return true;
    }

    // Require application/json
    if (!contentType.includes('application/json')) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: ApiErrorCode.CONTENT_TYPE_UNSUPPORTED,
            message: 'Content-Type must be application/json for API endpoints',
          },
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }

    return true;
  }
}
