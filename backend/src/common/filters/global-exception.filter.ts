import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiErrorCode } from '@common/response';
import { ApiErrorResponse, ApiErrorDetail } from '@common/response';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // GraphQL context doesn't have HTTP request/response — skip custom handling
    if (host.getType<string>() === 'graphql') {
      throw exception;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    if (!response || !request) {
      throw exception;
    }

    const requestId = request.id || 'unknown';
    const timestamp = new Date().toISOString();

    const { statusCode, code, message, details } =
      this.resolveException(exception);

    // Log server errors with full context; client errors at debug level
    if (statusCode >= 500) {
      this.logger.error(
        `[${requestId}] ${code}: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.debug(`[${requestId}] ${code}: ${message}`);
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(details && details.length > 0 ? { details } : {}),
        request_id: requestId,
        timestamp,
      },
    };

    response.status(statusCode).json(errorResponse);
  }

  private resolveException(exception: unknown): {
    statusCode: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  } {
    if (exception instanceof HttpException) {
      return this.handleHttpException(exception);
    }

    // Prisma known request errors
    if (this.isPrismaError(exception)) {
      return this.handlePrismaError(exception);
    }

    // Unknown/unhandled errors — never leak internals
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
    };
  }

  private handleHttpException(exception: HttpException): {
    statusCode: number;
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  } {
    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // class-validator ValidationPipe returns an object with message array
    if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const resp = exceptionResponse as Record<string, unknown>;

      // Validation errors from ValidationPipe
      if (statusCode === HttpStatus.BAD_REQUEST && Array.isArray(resp.message)) {
        const details: ApiErrorDetail[] = (resp.message as string[]).map(
          (msg) => {
            const field = this.extractFieldFromMessage(msg);
            return {
              field,
              message: msg,
              constraint: this.extractConstraintFromMessage(msg),
            };
          },
        );

        return {
          statusCode,
          code: ApiErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details,
        };
      }

      const message =
        typeof resp.message === 'string'
          ? resp.message
          : 'Request failed';

      return {
        statusCode,
        code: this.mapStatusToCode(statusCode),
        message,
      };
    }

    // Simple string response
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : exception.message;

    return {
      statusCode,
      code: this.mapStatusToCode(statusCode),
      message,
    };
  }

  private isPrismaError(
    exception: unknown,
  ): exception is { code: string; meta?: Record<string, unknown> } {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof (exception as Record<string, unknown>).code === 'string' &&
      ((exception as Record<string, unknown>).code as string).startsWith('P')
    );
  }

  private handlePrismaError(exception: {
    code: string;
    meta?: Record<string, unknown>;
  }): {
    statusCode: number;
    code: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: ApiErrorCode.DUPLICATE_ENQUIRY,
          message: 'A record with this value already exists',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: ApiErrorCode.NOT_FOUND,
          message: 'Record not found',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'A database error occurred',
        };
    }
  }

  private mapStatusToCode(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return ApiErrorCode.VALIDATION_ERROR;
      case HttpStatus.UNAUTHORIZED:
        return ApiErrorCode.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ApiErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ApiErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ApiErrorCode.DUPLICATE_ENQUIRY;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ApiErrorCode.RATE_LIMITED;
      case HttpStatus.UNSUPPORTED_MEDIA_TYPE:
        return ApiErrorCode.CONTENT_TYPE_UNSUPPORTED;
      case HttpStatus.SERVICE_UNAVAILABLE:
        return ApiErrorCode.SERVICE_UNAVAILABLE;
      default:
        return ApiErrorCode.INTERNAL_ERROR;
    }
  }

  /**
   * Attempts to extract the field name from a validation error message.
   * class-validator messages typically start with the property name.
   */
  private extractFieldFromMessage(message: string): string {
    // Messages like "email must be an email" or "name should not be empty"
    const match = message.match(/^(\w+)\s/);
    return match?.[1] || 'unknown';
  }

  /**
   * Attempts to extract the constraint name from a validation error message.
   */
  private extractConstraintFromMessage(message: string): string {
    // Messages like "email must be an email" → "isEmail"
    // Messages like "name should not be empty" → "isNotEmpty"
    if (message.includes('must be an email')) return 'isEmail';
    if (message.includes('should not be empty')) return 'isNotEmpty';
    if (message.includes('must be a string')) return 'isString';
    if (message.includes('must be a number')) return 'isNumber';
    if (message.includes('must be a boolean')) return 'isBoolean';
    if (message.includes('must not be greater than')) return 'max';
    if (message.includes('must not be less than')) return 'min';
    if (message.includes('must be shorter than')) return 'maxLength';
    if (message.includes('must be longer than')) return 'minLength';
    return 'unknown';
  }
}
