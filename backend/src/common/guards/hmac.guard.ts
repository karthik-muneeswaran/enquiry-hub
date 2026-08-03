import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';
import { AppConfigService } from '@config/config.service';
import { ApiErrorCode } from '@common/response';

/**
 * Guard that validates the X-Webhook-Signature header using HMAC-SHA256.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * Expected header format: X-Webhook-Signature: sha256=<hex-encoded-hmac>
 *
 * Returns 401 Unauthorized if:
 * - X-Webhook-Signature header is missing
 * - Signature does not match the computed HMAC of the request body
 */
@Injectable()
export class HmacGuard implements CanActivate {
  constructor(private readonly configService: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signatureHeader = request.headers['x-webhook-signature'] as
      | string
      | undefined;

    if (!signatureHeader) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: ApiErrorCode.WEBHOOK_INVALID_SIGNATURE,
          message: 'Missing X-Webhook-Signature header',
        },
      });
    }

    const body = this.getRequestBody(request);
    const secret = this.configService.hmacSecret;
    const isValid = this.validateSignature(body, signatureHeader, secret);

    if (!isValid) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: ApiErrorCode.WEBHOOK_INVALID_SIGNATURE,
          message: 'Invalid webhook signature',
        },
      });
    }

    return true;
  }

  /**
   * Validates the HMAC-SHA256 signature using timing-safe comparison.
   */
  validateSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = this.computeSignature(payload, secret);

    // Handle both raw hex and "sha256=" prefixed formats
    const providedSignature = signature.startsWith('sha256=')
      ? signature.slice(7)
      : signature;

    // Both must be same length for timingSafeEqual
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(providedSignature, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  /**
   * Computes HMAC-SHA256 of the payload using the provided secret.
   */
  private computeSignature(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  /**
   * Extracts the raw body from the request.
   * Falls back to JSON.stringify if rawBody is not available.
   */
  private getRequestBody(request: Request): string {
    // If rawBody is available (configured via express raw body parser)
    if ((request as any).rawBody) {
      return (request as any).rawBody.toString('utf-8');
    }

    // Fallback: re-serialize the parsed body
    return JSON.stringify(request.body);
  }
}
