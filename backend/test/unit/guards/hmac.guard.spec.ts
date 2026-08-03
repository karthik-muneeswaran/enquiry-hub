import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { HmacGuard } from '@/common/guards/hmac.guard';
import { AppConfigService } from '@/config/config.service';

describe('HmacGuard', () => {
  let guard: HmacGuard;
  const TEST_SECRET = 'test-webhook-secret-123';

  beforeEach(() => {
    const mockConfigService = {
      hmacSecret: TEST_SECRET,
    } as Partial<AppConfigService>;
    guard = new HmacGuard(mockConfigService as AppConfigService);
  });

  function computeSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  function createMockContext(body: object, signatureHeader?: string): ExecutionContext {
    const headers: Record<string, string | undefined> = {
      'x-webhook-signature': signatureHeader,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers, body }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow request with valid sha256= prefixed signature', () => {
    const body = { event: 'property.updated', id: 123 };
    const payload = JSON.stringify(body);
    const signature = `sha256=${computeSignature(payload, TEST_SECRET)}`;

    const context = createMockContext(body, signature);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow request with valid raw hex signature (no prefix)', () => {
    const body = { event: 'property.created' };
    const payload = JSON.stringify(body);
    const signature = computeSignature(payload, TEST_SECRET);

    const context = createMockContext(body, signature);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw UnauthorizedException when signature header is missing', () => {
    const context = createMockContext({ event: 'test' }, undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException with correct message for missing header', () => {
    const context = createMockContext({ event: 'test' }, undefined);
    try {
      guard.canActivate(context);
    } catch (e: any) {
      expect(e.getResponse()).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Missing X-Webhook-Signature header',
          }),
        }),
      );
    }
  });

  it('should throw UnauthorizedException when signature is invalid', () => {
    const body = { event: 'property.updated' };
    const signature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

    const context = createMockContext(body, signature);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should throw UnauthorizedException when signature is computed with wrong secret', () => {
    const body = { event: 'test' };
    const payload = JSON.stringify(body);
    const wrongSignature = `sha256=${computeSignature(payload, 'wrong-secret')}`;

    const context = createMockContext(body, wrongSignature);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('should reject signature that produces buffer of wrong length', () => {
    const body = { event: 'test' };
    // A valid hex string but not the right length for sha256 (64 hex chars)
    const context = createMockContext(body, 'sha256=aabbccdd');
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  describe('validateSignature', () => {
    it('should return true for matching signature', () => {
      const payload = '{"test":true}';
      const sig = computeSignature(payload, TEST_SECRET);
      expect(guard.validateSignature(payload, `sha256=${sig}`, TEST_SECRET)).toBe(true);
    });

    it('should return false for non-matching signature', () => {
      const payload = '{"test":true}';
      const sig = computeSignature('different payload', TEST_SECRET);
      expect(guard.validateSignature(payload, `sha256=${sig}`, TEST_SECRET)).toBe(false);
    });
  });
});
