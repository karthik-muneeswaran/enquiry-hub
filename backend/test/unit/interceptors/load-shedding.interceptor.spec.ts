import { ExecutionContext, CallHandler, ServiceUnavailableException } from '@nestjs/common';
import { of, lastValueFrom } from 'rxjs';
import { LoadSheddingInterceptor } from '@/common/interceptors/load-shedding.interceptor';

// Mock the getResponseFromContext utility
jest.mock('@/common/utils', () => ({
  getResponseFromContext: jest.fn((context: any) => {
    return context.switchToHttp().getResponse();
  }),
}));

describe('LoadSheddingInterceptor', () => {
  let interceptor: LoadSheddingInterceptor;
  let mockMonitor: any;
  let mockResponse: any;

  beforeEach(() => {
    mockMonitor = { isShedding: false };
    interceptor = new LoadSheddingInterceptor(mockMonitor);

    mockResponse = { setHeader: jest.fn() };
  });

  function createMockContext(): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  }

  const mockHandler: CallHandler = { handle: () => of('response-data') };

  it('should pass through when event loop is healthy', async () => {
    mockMonitor.isShedding = false;
    const context = createMockContext();

    const result = await lastValueFrom(interceptor.intercept(context, mockHandler));

    expect(result).toBe('response-data');
  });

  it('should throw ServiceUnavailableException when shedding', () => {
    mockMonitor.isShedding = true;
    const context = createMockContext();

    expect(() => interceptor.intercept(context, mockHandler)).toThrow(ServiceUnavailableException);
  });

  it('should set Retry-After header when shedding', () => {
    mockMonitor.isShedding = true;
    const context = createMockContext();

    try {
      interceptor.intercept(context, mockHandler);
    } catch {
      // expected
    }

    expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', '5');
  });

  it('should include proper error payload in exception', () => {
    mockMonitor.isShedding = true;
    const context = createMockContext();

    try {
      interceptor.intercept(context, mockHandler);
      fail('Should have thrown');
    } catch (e: any) {
      const response = e.getResponse();
      expect(response.statusCode).toBe(503);
      expect(response.code).toBe('LOAD_SHEDDING');
      expect(response.message).toContain('heavy load');
    }
  });

  it('should not call next.handle() when shedding', () => {
    mockMonitor.isShedding = true;
    const context = createMockContext();
    const spyHandler = { handle: jest.fn(() => of('data')) };

    try {
      interceptor.intercept(context, spyHandler);
    } catch {
      // expected
    }

    expect(spyHandler.handle).not.toHaveBeenCalled();
  });

  it('should allow request when shedding flag is false', async () => {
    mockMonitor.isShedding = false;
    const context = createMockContext();

    const result = await lastValueFrom(interceptor.intercept(context, mockHandler));
    expect(result).toBe('response-data');
  });
});
