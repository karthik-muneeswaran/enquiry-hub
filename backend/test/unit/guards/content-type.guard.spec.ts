import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ContentTypeGuard } from '@/common/guards/content-type.guard';

// Mock the getRequestFromContext utility
jest.mock('@/common/utils', () => ({
  getRequestFromContext: jest.fn((context: any) => {
    return context.switchToHttp().getRequest();
  }),
}));

describe('ContentTypeGuard', () => {
  let guard: ContentTypeGuard;

  beforeEach(() => {
    guard = new ContentTypeGuard();
  });

  function createMockContext(
    method: string,
    headers: Record<string, string> = {},
  ): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method, headers }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow GET requests regardless of content-type', () => {
    const context = createMockContext('GET', {
      'content-type': 'text/html',
      'content-length': '10',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow DELETE requests regardless of content-type', () => {
    const context = createMockContext('DELETE', {
      'content-type': 'text/html',
      'content-length': '10',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow POST with application/json content-type', () => {
    const context = createMockContext('POST', {
      'content-type': 'application/json',
      'content-length': '50',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow POST with application/json; charset=utf-8', () => {
    const context = createMockContext('POST', {
      'content-type': 'application/json; charset=utf-8',
      'content-length': '50',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject POST with text/plain content-type', () => {
    const context = createMockContext('POST', {
      'content-type': 'text/plain',
      'content-length': '50',
    });
    expect(() => guard.canActivate(context)).toThrow(HttpException);
    try {
      guard.canActivate(context);
    } catch (e: any) {
      expect(e.getStatus()).toBe(HttpStatus.UNSUPPORTED_MEDIA_TYPE);
    }
  });

  it('should reject PUT with no content-type when body is present', () => {
    const context = createMockContext('PUT', { 'content-length': '50' });
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('should reject PATCH with form-urlencoded content-type', () => {
    const context = createMockContext('PATCH', {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': '50',
    });
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });

  it('should allow POST with multipart/form-data (file uploads)', () => {
    const context = createMockContext('POST', {
      'content-type': 'multipart/form-data; boundary=----WebKitFormBoundary',
      'content-length': '1000',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow POST with content-length 0 (empty body)', () => {
    const context = createMockContext('POST', {
      'content-type': 'text/plain',
      'content-length': '0',
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow POST with no content-length header (no body)', () => {
    const context = createMockContext('POST', {});
    expect(guard.canActivate(context)).toBe(true);
  });
});
