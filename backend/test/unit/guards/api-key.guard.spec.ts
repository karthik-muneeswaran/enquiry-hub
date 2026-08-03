import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ApiKeyGuard } from '@/common/guards/api-key.guard';
import { AppConfigService } from '@/config/config.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockConfigService: Partial<AppConfigService>;

  beforeEach(() => {
    mockConfigService = {
      apiKeys: ['valid-key-1', 'valid-key-2'],
    };
    guard = new ApiKeyGuard(mockConfigService as AppConfigService);
  });

  function createMockContext(apiKey?: string): ExecutionContext {
    const headers: Record<string, string> = {};
    if (apiKey !== undefined) {
      headers['x-api-key'] = apiKey;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow request with valid API key', () => {
    const context = createMockContext('valid-key-1');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow request with second valid API key (rotation support)', () => {
    const context = createMockContext('valid-key-2');
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when X-API-Key header is missing', () => {
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when API key is invalid', () => {
    const context = createMockContext('invalid-key');
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException with correct error message for missing key', () => {
    const context = createMockContext(undefined);
    try {
      guard.canActivate(context);
    } catch (e: any) {
      expect(e.getResponse()).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Missing X-API-Key header',
          }),
        }),
      );
    }
  });

  it('should throw ForbiddenException with correct error message for invalid key', () => {
    const context = createMockContext('wrong-key');
    try {
      guard.canActivate(context);
    } catch (e: any) {
      expect(e.getResponse()).toEqual(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Invalid API key',
          }),
        }),
      );
    }
  });

  it('should refresh keys from config', () => {
    // Initially valid-key-1 works
    expect(guard.canActivate(createMockContext('valid-key-1'))).toBe(true);

    // Update config
    (mockConfigService as any).apiKeys = ['new-key-1'];
    guard.refreshKeys();

    // Old key should now fail
    expect(() => guard.canActivate(createMockContext('valid-key-1'))).toThrow(ForbiddenException);

    // New key should work
    expect(guard.canActivate(createMockContext('new-key-1'))).toBe(true);
  });
});
